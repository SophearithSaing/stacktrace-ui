import { signal } from '@angular/core';
import { Observable, Subscription, take } from 'rxjs';
import { AsyncViewState } from '../../shared/models/async-state';
import { ApiFailure, cooldownFailure, normalizeFailure } from '../api/failure';
import { ReadBoundary, ReadTicket } from './read-boundary';
import { RetryGate } from './retry-gate';

interface ReadDefinition<T, R> {
  readonly key: string;
  readonly load: () => Observable<T>;
  readonly commit: (value: T, ticket: ReadTicket) => R;
  readonly deleted?: (ticket: ReadTicket) => void;
}

interface ReadMeta {
  readonly phase: AsyncViewState['phase'];
  readonly loaded: boolean;
  readonly stale: boolean;
  readonly failure: ApiFailure | null;
}

/** A guarded single-resource read; canonical entities are stored by commit, not here. */
export class RemoteRead<T, R> {
  private readonly data = signal<R | null>(null);
  private readonly meta = signal<ReadMeta>({
    phase: 'idle',
    loaded: false,
    stale: false,
    failure: null,
  });
  readonly value = this.data.asReadonly();
  private definition: ReadDefinition<T, R> | null = null;
  private session = -1;
  private version = 0;
  private active: Subscription | null = null;
  private readonly lifecycle = new Subscription();

  /**
   * Creates inert ownership for one detail/profile/discovery request.
   * @param reads Session and mutation guards.
   * @param gate Shared explicit-retry cooldown.
   */
  constructor(
    private readonly reads: ReadBoundary,
    private readonly gate: RetryGate,
  ) {
    this.lifecycle.add(reads.invalidations.subscribe(this.invalidate.bind(this)));
    this.lifecycle.add(reads.refreshes.subscribe(this.reload.bind(this)));
  }

  /**
   * Switches resource identity without exposing a previous resource during loading.
   * @param definition Captured endpoint operation and canonical commit.
   */
  select(definition: ReadDefinition<T, R>): void {
    if (this.definition?.key !== definition.key || this.session !== this.reads.capture().session) {
      this.clear();
    }
    this.definition = definition;
    this.session = this.reads.capture().session;
    this.reload();
  }

  /** Reissues the first resource read explicitly, respecting cooldown and generations. */
  reload(): void {
    const definition = this.definition;
    if (!definition || this.session !== this.reads.capture().session) {
      return;
    }
    this.cancel();
    const ticket = this.reads.capture();
    const version = this.version;
    const previous = this.meta();
    if (!this.gate.canStart()) {
      this.meta.set({
        ...previous,
        phase: 'error',
        failure: previous.failure ?? cooldownFailure(),
      });
      return;
    }
    this.meta.set({
      ...previous,
      phase: previous.loaded ? 'refreshing' : 'loading',
      stale: previous.loaded,
    });
    const active = new Subscription();
    this.active = active;
    let received = false;
    try {
      active.add(
        definition
          .load()
          .pipe(take(1))
          .subscribe({
            /**
             * Commits a current resource, keeping full entities in their canonical store.
             * @param value Server representation.
             */
            next: (value: T): void => {
              received = true;
              if (!this.current(version, ticket)) {
                return;
              }
              try {
                const mapped = definition.commit(value, ticket);
                if (this.current(version, ticket)) {
                  this.data.set(mapped);
                  this.meta.set({ phase: 'ready', loaded: true, stale: false, failure: null });
                }
              } catch (error: unknown) {
                this.reject(error, version, ticket, definition);
              }
            },
            /**
             * Retains current content on recoverable errors.
             * @param error Original request failure.
             */
            error: (error: unknown): void => this.reject(error, version, ticket, definition),
            /** Rejects an empty transport completion instead of inventing success. */
            complete: (): void => {
              if (!received) {
                this.reject(new Error('Read returned no result'), version, ticket, definition);
              }
              if (version === this.version) {
                this.active = null;
              }
            },
          }),
      );
    } catch (error: unknown) {
      this.reject(error, version, ticket, definition);
    }
  }

  /**
   * Returns normalized feedback without exposing raw private response payloads.
   * @returns Current safe failure, or null.
   */
  failure(): ApiFailure | null {
    return this.meta().failure;
  }

  /**
   * Projects presentation-only lifecycle using canonical content availability.
   * @param hasContent Whether the caller's canonical projection has content.
   * @returns Safe loading/empty/failure/retry state.
   */
  view(hasContent: boolean): AsyncViewState {
    const meta = this.meta();
    const busy = meta.phase === 'loading' || meta.phase === 'refreshing';
    return {
      phase: meta.phase,
      hasContent,
      empty: meta.loaded && !hasContent && !meta.failure && !busy && !meta.stale,
      stale: meta.stale || (hasContent && !!meta.failure),
      error: meta.failure ? (meta.failure.kind === 'network' ? 'network' : 'request') : null,
      coolingDown: !this.gate.ready(),
      canRetry: !!this.definition && !busy && this.gate.ready() && !!(meta.failure || meta.stale),
      canLoadMore: false,
    };
  }

  /** Clears a selection and all session-bound representation references. */
  clear(): void {
    this.cancel();
    this.definition = null;
    this.data.set(null);
    this.meta.set({ phase: 'idle', loaded: false, stale: false, failure: null });
  }

  /** Releases all ownership on product/container destruction. */
  dispose(): void {
    this.clear();
    this.lifecycle.unsubscribe();
  }

  /** Cancels obsolete transport work before making callbacks ineligible. */
  private cancel(): void {
    this.version += 1;
    this.active?.unsubscribe();
    this.active = null;
  }

  /** Invalidates a session entirely, or retains stale content until confirmed refresh. */
  private invalidate(): void {
    if (this.session !== this.reads.capture().session) {
      this.clear();
      return;
    }
    this.cancel();
    this.meta.set({ ...this.meta(), phase: this.meta().loaded ? 'ready' : 'idle', stale: true });
  }

  /**
   * Checks request ownership plus the shared read boundary.
   * @param version Captured request version.
   * @param ticket Captured session/mutation ticket.
   * @returns Whether this result can still commit.
   */
  private current(version: number, ticket: ReadTicket): boolean {
    return version === this.version && this.reads.isCurrent(ticket);
  }

  /**
   * Normalizes failures and applies definitive deletion facts without replay loops.
   * @param error Original request failure.
   * @param version Request ownership.
   * @param ticket Session/mutation boundary.
   * @param definition Resource that initiated the request.
   */
  private reject(
    error: unknown,
    version: number,
    ticket: ReadTicket,
    definition: ReadDefinition<T, R>,
  ): void {
    if (!this.current(version, ticket)) {
      return;
    }
    const failure = normalizeFailure(error);
    this.gate.note(failure);
    if (failure.kind === 'deleted') {
      definition.deleted?.(ticket);
    }
    if (this.definition !== definition || this.session !== this.reads.capture().session) {
      return;
    }
    if (failure.kind === 'not-found' || failure.kind === 'deleted') {
      this.data.set(null);
    }
    this.meta.set({ ...this.meta(), phase: 'error', failure });
    if (failure.kind === 'unauthenticated') {
      this.reads.expireSession(ticket);
    }
  }
}
