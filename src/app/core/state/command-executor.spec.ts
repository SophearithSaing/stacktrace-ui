import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EMPTY, Observable, Subject, defer, throwError } from 'rxjs';
import { Post } from '../api/models';
import { account, authenticate, post } from '../api/testing/http';
import { SessionContext } from '../session/session-context';
import { CommandExecutor, CommandResult, CommandSpec } from './command-executor';
import { ReadBoundary } from './read-boundary';

describe('CommandExecutor', (): void => {
  let executor: CommandExecutor;
  let session: SessionContext;
  let reads: ReadBoundary;
  beforeEach((): void => {
    executor = TestBed.inject(CommandExecutor);
    session = TestBed.inject(SessionContext);
    reads = TestBed.inject(ReadBoundary);
    authenticate(session);
  });

  function spec(request: Observable<Post>, reconcile = vi.fn()): CommandSpec<Post> {
    return {
      generation: session.generation(),
      resource: `post:${post.id}`,
      action: 'reaction',
      request,
      reconcile,
    };
  }

  it('blocks anonymous writes without subscribing or simulating success', (): void => {
    session.clear();
    const source = new Subject<Post>();
    const apply = vi.fn();
    const values: CommandResult<Post>[] = [];
    executor.run(spec(source, apply)).subscribe((result): void => {
      values.push(result);
    });
    expect(values).toEqual([{ status: 'blocked', reason: 'anonymous' }]);
    expect(source.observed).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });

  it('blocks duplicate and competing resource actions and invalidates reads before confirmation', (): void => {
    const source = new Subject<Post>();
    const before = reads.capture();
    const apply = vi.fn((): void => {
      expect(reads.isCurrent(before)).toBe(false);
    });
    const refresh = vi.fn();
    reads.refreshes.subscribe(refresh);
    executor.run(spec(source, apply)).subscribe();
    expect(executor.pending(`post:${post.id}`, 'reaction')).toBe(true);
    const blocked: CommandResult<Post>[] = [];
    executor.run({ ...spec(new Subject<Post>()), action: 'bookmark' }).subscribe((result): void => {
      blocked.push(result);
    });
    expect(blocked).toEqual([{ status: 'blocked', reason: 'pending' }]);
    source.next(post);
    expect(apply).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
    expect(executor.pending(`post:${post.id}`)).toBe(false);
  });

  it('keeps the lock and transport after a view stops observing an uncertain write', (): void => {
    const source = new Subject<Post>();
    const apply = vi.fn();
    const subscription = executor.run(spec(source, apply)).subscribe();
    subscription.unsubscribe();
    expect(executor.pending(`post:${post.id}`)).toBe(true);
    expect(source.observed).toBe(true);
    source.next(post);
    expect(apply).toHaveBeenCalledOnce();
    expect(executor.pending(`post:${post.id}`)).toBe(false);
  });

  it('cancels old viewer work and never lets its late completion clear a newer lock', (): void => {
    const oldSource = new Subject<Post>();
    const oldSpec = spec(oldSource);
    const oldResults: CommandResult<Post>[] = [];
    const oldOperation = executor.run(oldSpec);
    oldOperation.subscribe((result): void => {
      oldResults.push(result);
    });
    session.accept({ account: { ...account, id: 'B' }, csrf_token: 'token-B' }, session.begin());
    expect(oldSource.observed).toBe(false);
    expect(oldResults).toEqual([{ status: 'stale' }]);
    const freshSource = new Subject<Post>();
    const apply = vi.fn();
    executor.run(spec(freshSource, apply)).subscribe();
    oldSource.next(post);
    oldOperation.subscribe((result): void => {
      expect(result.status).toBe('stale');
    });
    expect(executor.pending(`post:${post.id}`)).toBe(true);
    expect(apply).not.toHaveBeenCalled();
    freshSource.next({ ...post, body: 'B' });
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'B' }),
      session.generation(),
    );
  });

  it.each([403, 409, 422, 500])(
    'keeps the session and does not replay or reconcile failed HTTP %s',
    (status): void => {
      const source = new Subject<Post>();
      const apply = vi.fn();
      const before = reads.capture();
      executor.run(spec(source, apply)).subscribe();
      source.error(new HttpErrorResponse({ status }));
      expect(session.state().status).toBe('authenticated');
      expect(reads.isCurrent(before)).toBe(true);
      expect(apply).not.toHaveBeenCalled();
      expect(executor.failure(`post:${post.id}`)?.status).toBe(status);
      expect(executor.pending(`post:${post.id}`)).toBe(false);
    },
  );

  it('clears expired sessions on authenticated 401 without replay', (): void => {
    const values: CommandResult<Post>[] = [];
    executor
      .run(spec(throwError((): HttpErrorResponse => new HttpErrorResponse({ status: 401 }))))
      .subscribe((result): void => {
        values.push(result);
      });
    expect(values[0]).toMatchObject({ status: 'failed', failure: { kind: 'unauthenticated' } });
    expect(session.csrfToken()).toBeNull();
    expect(session.state().status).toBe('uninitialized');
  });

  it('enforces cooldown without timer-triggered writes and permits only explicit retry', (): void => {
    vi.useFakeTimers();
    try {
      let attempts = 0;
      const request = defer((): Observable<Post> => {
        attempts += 1;
        return throwError(
          (): HttpErrorResponse =>
            new HttpErrorResponse({
              status: 429,
              headers: new HttpHeaders({ 'Retry-After': '2' }),
            }),
        );
      });
      const operation = executor.run(spec(request));
      operation.subscribe();
      operation.subscribe((result): void => {
        expect(result).toEqual({ status: 'blocked', reason: 'cooldown' });
      });
      vi.advanceTimersByTime(2000);
      expect(attempts).toBe(1);
      operation.subscribe();
      expect(attempts).toBe(2);
    } finally {
      TestBed.resetTestingModule();
      vi.useRealTimers();
    }
  });

  it('never confirms an empty completion', (): void => {
    executor.run(spec(EMPTY)).subscribe((result): void => {
      expect(result).toMatchObject({ status: 'failed', failure: { kind: 'unexpected' } });
    });
    expect(executor.pending(`post:${post.id}`)).toBe(false);
  });

  it('does not publish an old viewer payload if reconciliation refresh changes the session synchronously', (): void => {
    const source = new Subject<Post>();
    const refresh = reads.refreshes.subscribe((): void => session.clear());
    const results: CommandResult<Post>[] = [];
    executor.run(spec(source)).subscribe((result): void => {
      results.push(result);
    });
    source.next(post);
    expect(results).toEqual([{ status: 'stale' }]);
    refresh.unsubscribe();
  });
});
