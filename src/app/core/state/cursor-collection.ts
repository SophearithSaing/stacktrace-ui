import { HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { Observable, Subscription, take } from 'rxjs';
import { AsyncViewState } from '../../shared/models/async-state';
import { EntityMembership, EntityStore } from './entity-store';
import { ReadBoundary, ReadTicket } from './read-boundary';

export interface CursorResult {
  readonly next_cursor: string | null;
}

export interface PageReferences {
  readonly ids: readonly string[];
  readonly snippets?: Readonly<Record<string, string>>;
}

export interface CollectionDefinition<P extends CursorResult> {
  readonly key: string;
  readonly session: number;
  readonly kind: EntityMembership['kind'];
  readonly private: boolean;
  readonly load: (cursor: string | null) => Observable<P>;
  readonly project: (page: P) => PageReferences;
  readonly commit: (page: P, ticket: ReadTicket) => boolean;
  readonly seed?: { readonly page: P; readonly ticket: ReadTicket };
}

export interface CollectionViewState extends AsyncViewState {
  readonly key: string | null;
  readonly membershipKey: string | null;
  readonly ids: readonly string[];
  readonly nextCursor: string | null;
  readonly exhausted: boolean;
}

interface CollectionMeta {
  phase: AsyncViewState['phase'];
  loaded: boolean;
  nextCursor: string | null;
  stale: boolean;
  failure: unknown;
  failedMode: 'first' | 'more' | null;
}

/** One owned request chain; ordered references live only in EntityStore. */
export class CursorCollection<P extends CursorResult> {
  private static sequence = 0;
  private readonly owner = ++CursorCollection.sequence;
  private readonly selected = signal<CollectionDefinition<P> | null>(null);
  private readonly meta = signal<CollectionMeta>(initialMeta());
  private readonly invalidations: Subscription;
  private active: Subscription | null = null;
  private requestVersion = 0;
  private disposed = false;
  readonly state = computed(this.viewState.bind(this));

  /**
   * Creates an inert collection; select starts its first read.
   * @param entities Canonical entities and membership references.
   * @param reads Shared session/mutation boundary.
   */
  constructor(
    private readonly entities: EntityStore,
    private readonly reads: ReadBoundary,
  ) {
    this.invalidations = reads.invalidations.subscribe(this.invalidate.bind(this));
  }

  /**
   * Cancels the previous chain and starts a fresh selection without old cursors.
   * @param definition Endpoint-specific, session-bound read definition.
   * @returns Whether the selection belongs to the current session.
   */
  select(definition: CollectionDefinition<P>): boolean {
    this.cancel();
    this.releaseMembership();
    this.selected.set(null);
    this.meta.set(initialMeta());
    if (this.disposed || definition.session !== this.reads.capture().session) {
      return false;
    }
    this.selected.set(definition);
    this.entities.putMembership(
      this.membershipKey(definition),
      {
        kind: definition.kind,
        ids: [],
        private: definition.private,
      },
      this.reads.capture(),
    );
    if (definition.seed && this.reads.isCurrent(definition.seed.ticket)) {
      this.acceptPage(definition.seed.page, 'first', this.requestVersion, definition.seed.ticket);
    } else {
      this.fetch('first');
    }
    return true;
  }

  /** Refreshes from the first page while retaining currently loaded rows. */
  refresh(): void {
    this.fetch('first');
  }

  /** Appends one page only when a current, non-exhausted chain is ready. */
  loadMore(): void {
    const state = this.state();
    if (state.canLoadMore) {
      this.fetch('more');
    }
  }

  /** Retries the failed page, or starts a new first page after invalidation. */
  retry(): void {
    if (this.state().canRetry) {
      this.fetch(this.meta().failedMode === 'more' ? 'more' : 'first');
    }
  }

  /**
   * Exposes the original failure to later normalization without displaying it.
   * @returns Last request failure, or null when resolved.
   */
  failure(): unknown {
    return this.meta().failure;
  }

  /** Cancels active work and releases the owning container's subscriptions. */
  dispose(): void {
    this.disposed = true;
    this.cancel();
    this.invalidations.unsubscribe();
    this.releaseMembership();
    this.selected.set(null);
    this.meta.set(initialMeta());
  }

  /** Invalidates cursors and old reads without replaying any work automatically. */
  private invalidate(): void {
    this.cancel();
    const selection = this.selected();
    if (!selection || selection.session !== this.reads.capture().session) {
      this.selected.set(null);
      this.meta.set(initialMeta());
      return;
    }
    const previous = this.meta();
    this.meta.set({
      ...previous,
      phase: previous.loaded ? 'ready' : 'idle',
      nextCursor: null,
      stale: true,
      failure: null,
      failedMode: 'first',
    });
  }

  /** Cancels transport work and makes every previous request callback obsolete. */
  private cancel(): void {
    this.requestVersion += 1;
    this.active?.unsubscribe();
    this.active = null;
  }

  /**
   * Namespaces references so independent owners cannot mix continuation chains.
   * @param selection Endpoint-specific selection.
   * @returns Owner/selection-specific canonical membership key.
   */
  private membershipKey(selection: CollectionDefinition<P>): string {
    return JSON.stringify([this.owner, selection.key]);
  }

  /** Releases references while keeping canonical entities available elsewhere. */
  private releaseMembership(): void {
    const selection = this.selected();
    if (selection) {
      this.entities.removeMembership(this.membershipKey(selection), this.reads.capture());
    }
  }

  /**
   * Starts a guarded first/continuation read, including synchronous failures.
   * @param mode First page replacement or continuation append.
   */
  private fetch(mode: 'first' | 'more'): void {
    const selection = this.selected();
    if (!selection || this.disposed) {
      return;
    }
    if (selection.session !== this.reads.capture().session) {
      this.invalidate();
      return;
    }
    const previous = this.meta();
    if (mode === 'more' && (!previous.loaded || previous.nextCursor === null || previous.stale)) {
      return;
    }
    this.cancel();
    const version = this.requestVersion;
    const ticket = this.reads.capture();
    const cursor = mode === 'more' ? previous.nextCursor : null;
    this.meta.set({
      ...previous,
      phase: mode === 'more' ? 'loading-more' : previous.loaded ? 'refreshing' : 'loading',
      stale: previous.stale || (mode === 'first' && previous.loaded),
    });
    const active = new Subscription();
    this.active = active;
    let received = false;
    try {
      active.add(
        selection
          .load(cursor)
          .pipe(take(1))
          .subscribe({
            /**
             * Commits a current page once.
             * @param page Server page.
             */
            next: (page: P): void => {
              received = true;
              this.acceptPage(page, mode, version, ticket);
            },
            /**
             * Preserves existing rows and the failed continuation cursor.
             * @param error Original transport failure.
             */
            error: (error: unknown): void => this.rejectPage(error, mode, version, ticket),
            /** Rejects a completed read that never produced a page. */
            complete: (): void => {
              if (!received) {
                this.rejectPage(new Error('Read completed without a page'), mode, version, ticket);
              }
              if (version === this.requestVersion) {
                this.active = null;
              }
            },
          }),
      );
    } catch (error: unknown) {
      this.rejectPage(error, mode, version, ticket);
      active.unsubscribe();
    }
  }

  /**
   * Commits entities and references only after all request boundaries pass.
   * @param page Complete server page.
   * @param mode Replacement or append.
   * @param version Request generation.
   * @param ticket Captured session/mutation boundary.
   */
  private acceptPage(page: P, mode: 'first' | 'more', version: number, ticket: ReadTicket): void {
    if (!this.isCurrent(version, ticket)) {
      return;
    }
    try {
      const selection = this.selected();
      if (!selection) {
        return;
      }
      const cursor = page.next_cursor;
      if (cursor !== null && (typeof cursor !== 'string' || !cursor || [...cursor].length > 2048)) {
        throw new Error('Invalid continuation cursor');
      }
      const projected = selection.project(page);
      const key = this.membershipKey(selection);
      const previous = mode === 'more' ? this.entities.membership(key) : undefined;
      const ids = [...new Set([...(previous?.ids ?? []), ...projected.ids])];
      const committed = selection.commit(page, ticket);
      if (!this.isCurrent(version, ticket)) {
        return;
      }
      if (!committed) {
        throw new Error('Read commit rejected');
      }
      const accepted = this.entities.putMembership(
        key,
        {
          kind: selection.kind,
          private: selection.private,
          ids,
          ...(projected.snippets
            ? { snippets: { ...previous?.snippets, ...projected.snippets } }
            : {}),
        },
        ticket,
      );
      if (accepted) {
        this.meta.set({
          phase: 'ready',
          loaded: true,
          nextCursor: cursor,
          stale: false,
          failure: null,
          failedMode: null,
        });
      }
    } catch (error: unknown) {
      this.rejectPage(error, mode, version, ticket);
    }
  }

  /**
   * Records only current failures without discarding previously loaded rows.
   * @param failure Original failure.
   * @param mode Failed read kind for explicit retries.
   * @param version Request generation.
   * @param ticket Captured session/mutation boundary.
   */
  private rejectPage(
    failure: unknown,
    mode: 'first' | 'more',
    version: number,
    ticket: ReadTicket,
  ): void {
    if (this.isCurrent(version, ticket)) {
      this.meta.set({ ...this.meta(), phase: 'error', failure, failedMode: mode });
      this.active = null;
    }
  }

  /**
   * Checks transport ownership in addition to session and mutation generations.
   * @param version Captured request generation.
   * @param ticket Captured session/mutation boundary.
   * @returns Whether this callback may still commit.
   */
  private isCurrent(version: number, ticket: ReadTicket): boolean {
    return !this.disposed && version === this.requestVersion && this.reads.isCurrent(ticket);
  }

  /**
   * Projects safe async view state from metadata and canonical membership.
   * @returns A presentation-only lifecycle plus ordered entity references.
   */
  private viewState(): CollectionViewState {
    const selection = this.selected();
    const meta = this.meta();
    const membershipKey = selection ? this.membershipKey(selection) : null;
    const ids = membershipKey ? (this.entities.membership(membershipKey)?.ids ?? []) : [];
    const busy = ['loading', 'refreshing', 'loading-more'].includes(meta.phase);
    const error =
      meta.failure === null
        ? null
        : meta.failure instanceof HttpErrorResponse && meta.failure.status === 0
          ? 'network'
          : 'request';
    return {
      key: selection?.key ?? null,
      membershipKey,
      ids,
      nextCursor: meta.nextCursor,
      phase: meta.phase,
      hasContent: ids.length > 0,
      empty: meta.loaded && !ids.length && !error && !meta.stale && !busy,
      exhausted: meta.loaded && meta.nextCursor === null && !meta.stale && !error && !busy,
      stale: meta.stale || (meta.loaded && error !== null),
      error,
      canRetry: !!selection && !busy && (error !== null || meta.stale),
      canLoadMore:
        !!selection && !busy && !error && !meta.stale && meta.loaded && meta.nextCursor !== null,
    };
  }
}

/**
 * Creates a fresh lifecycle without pretending that an unread collection is empty.
 * @returns Initial idle metadata.
 */
function initialMeta(): CollectionMeta {
  return {
    phase: 'idle',
    loaded: false,
    nextCursor: null,
    stale: false,
    failure: null,
    failedMode: null,
  };
}
