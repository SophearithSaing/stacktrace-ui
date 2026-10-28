import { DestroyRef, Service, inject, signal } from '@angular/core';
import { Observable, ReplaySubject, Subscription, defer, of, take } from 'rxjs';
import { ApiFailure, normalizeFailure } from '../api/failure';
import { SessionContext } from '../session/session-context';
import { ReadBoundary } from './read-boundary';
import { RetryGate } from './retry-gate';

export type CommandResult<T> =
  | { readonly status: 'confirmed'; readonly value: T }
  | { readonly status: 'failed'; readonly failure: ApiFailure }
  | { readonly status: 'blocked'; readonly reason: 'pending' | 'cooldown' | 'anonymous' }
  | { readonly status: 'stale' };

export interface CommandSpec<T> {
  readonly generation: number;
  readonly resource: string;
  readonly action: string;
  readonly request: Observable<T>;
  readonly reconcile: (value: T, generation: number) => void;
  readonly onDeleted?: (generation: number) => void;
}

interface ActiveCommand {
  readonly resource: string;
  readonly action: string;
  readonly generation: number;
  readonly subscription: Subscription;
  readonly cancel: () => void;
}

@Service()
export class CommandExecutor {
  private readonly session = inject(SessionContext);
  private readonly reads = inject(ReadBoundary);
  private readonly retry = inject(RetryGate);
  private readonly active = signal<ReadonlyMap<string, ActiveCommand>>(new Map());
  private readonly failures = signal<ReadonlyMap<string, ApiFailure>>(new Map());
  private readonly transitions = this.session.generationChanges.subscribe(
    this.cancelAll.bind(this),
  );

  /** Owns write completion independently of view subscriptions and cleans up at shutdown. */
  constructor() {
    inject(DestroyRef).onDestroy(this.destroy.bind(this));
  }

  /**
   * Checks resource-level single flight, optionally restricted to one action.
   * @param resource Canonical resource lock key.
   * @param action Optional action discriminator for feedback.
   * @returns Whether the resource/action is pending.
   */
  pending(resource: string, action?: string): boolean {
    const operation = this.active().get(resource);
    return !!operation && (action === undefined || operation.action === action);
  }

  /**
   * Reads safe action feedback without exposing an HTTP payload.
   * @param resource Canonical resource lock key.
   * @returns Latest normalized failure, or null.
   */
  failure(resource: string): ApiFailure | null {
    return this.failures().get(resource) ?? null;
  }

  /**
   * Starts one explicit attempt on subscription; never retries or queues writes.
   * View unsubscription detaches observation, not the in-flight resource lock.
   * @param spec Captured request and confirmed-response reconciliation.
   * @returns One confirmed, failed, blocked or obsolete outcome.
   */
  run<T>(spec: CommandSpec<T>): Observable<CommandResult<T>> {
    return defer(
      /** @returns One guarded attempt, with no automatic replay. */
      (): Observable<CommandResult<T>> => this.start(spec),
    );
  }

  /**
   * Installs a resource lock before subscribing, including synchronous sources.
   * @param spec Captured request and reconciliation.
   * @returns Result stream observed separately from owned transport work.
   */
  private start<T>(spec: CommandSpec<T>): Observable<CommandResult<T>> {
    if (spec.generation !== this.session.generation()) {
      return of({ status: 'stale' });
    }
    if (this.session.state().status !== 'authenticated') {
      return of({ status: 'blocked', reason: 'anonymous' });
    }
    if (this.pending(spec.resource)) {
      return of({ status: 'blocked', reason: 'pending' });
    }
    if (!this.retry.canStart()) {
      return of({ status: 'blocked', reason: 'cooldown' });
    }
    const result = new ReplaySubject<CommandResult<T>>(1);
    const operation: ActiveCommand = {
      resource: spec.resource,
      action: spec.action,
      generation: this.session.generation(),
      subscription: new Subscription(),
      /** Ends observation without accepting a previous viewer's response. */
      cancel: (): void => {
        result.next({ status: 'stale' });
        result.complete();
      },
    };
    const next = new Map(this.active());
    next.set(operation.resource, operation);
    this.active.set(next);
    const failures = new Map(this.failures());
    failures.delete(operation.resource);
    this.failures.set(failures);
    let received = false;
    operation.subscription.add(
      spec.request.pipe(take(1)).subscribe({
        /**
         * Applies only a current server-confirmed response, after invalidating reads.
         * @param value Confirmed server result.
         */
        next: (value: T): void => {
          received = true;
          if (!this.current(operation)) {
            return;
          }
          try {
            if (!this.reads.confirmMutation(operation.generation)) {
              return;
            }
            spec.reconcile(value, operation.generation);
            if (!this.current(operation)) {
              return;
            }
            this.release(operation);
            this.reads.refreshCollections(operation.generation);
            result.next({ status: 'confirmed', value });
            result.complete();
          } catch (error: unknown) {
            this.reject(operation, result, error);
          }
        },
        /**
         * Preserves failed submissions for caller-owned explicit retry.
         * @param error Original transport failure.
         */
        error: (error: unknown): void => this.reject(operation, result, error, spec.onDeleted),
        /** Rejects a completed write with no response, rather than faking success. */
        complete: (): void => {
          if (!received) {
            this.reject(operation, result, new Error('Command completed without a result'));
          }
        },
      }),
    );
    return result.asObservable();
  }

  /**
   * Records a current failure; only authenticated 401 expiry clears the session.
   * @param operation Owned command.
   * @param result Result observer boundary.
   * @param error Original failure.
   * @param onDeleted Optional authoritative 410 resource invalidation.
   */
  private reject<T>(
    operation: ActiveCommand,
    result: ReplaySubject<CommandResult<T>>,
    error: unknown,
    onDeleted?: (generation: number) => void,
  ): void {
    if (!this.current(operation)) {
      return;
    }
    let failure = normalizeFailure(error);
    if (failure.kind === 'deleted' && onDeleted) {
      try {
        if (this.reads.confirmMutation(operation.generation)) {
          onDeleted(operation.generation);
          this.reads.refreshCollections(operation.generation);
        }
      } catch (reconciliationError: unknown) {
        failure = normalizeFailure(reconciliationError);
      }
    }
    this.release(operation);
    const failures = new Map(this.failures());
    failures.set(operation.resource, failure);
    this.failures.set(failures);
    this.retry.note(failure);
    if (failure.kind === 'unauthenticated') {
      this.session.clear();
    }
    result.next({ status: 'failed', failure });
    result.complete();
  }

  /**
   * Checks both viewer ownership and the exact resource lock instance.
   * @param operation Command captured before sending.
   * @returns Whether the completion may affect current state.
   */
  private current(operation: ActiveCommand): boolean {
    return (
      this.session.generation() === operation.generation &&
      this.active().get(operation.resource) === operation
    );
  }

  /**
   * Releases only the exact operation, never a newer resource owner.
   * @param operation Command being completed.
   */
  private release(operation: ActiveCommand): void {
    if (this.active().get(operation.resource) === operation) {
      const next = new Map(this.active());
      next.delete(operation.resource);
      this.active.set(next);
    }
  }

  /** Cancels old-viewer transport work and clears all viewer-bound action feedback. */
  private cancelAll(): void {
    const operations = this.active();
    this.active.set(new Map());
    this.failures.set(new Map());
    for (const operation of operations.values()) {
      operation.subscription.unsubscribe();
      operation.cancel();
    }
  }

  /** Releases owned subscriptions when the application injector is destroyed. */
  private destroy(): void {
    this.transitions.unsubscribe();
    this.cancelAll();
  }
}
