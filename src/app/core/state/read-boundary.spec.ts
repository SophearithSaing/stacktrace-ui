import { TestBed } from '@angular/core/testing';
import { account, post, profile, reply } from '../api/testing/http';
import { SessionContext } from '../session/session-context';
import { EntityStore } from './entity-store';
import { ReadBoundary } from './read-boundary';

describe('ReadBoundary', (): void => {
  it('invalidates old reads synchronously on confirmed mutations, not on failed commands', (): void => {
    const reads = TestBed.inject(ReadBoundary);
    const before = reads.capture();
    const invalidated = vi.fn();
    const subscription = reads.invalidations.subscribe(invalidated);
    expect(reads.isCurrent(before)).toBe(true);
    expect(reads.confirmMutation(before.session - 1)).toBe(false);
    expect(invalidated).not.toHaveBeenCalled();
    expect(reads.confirmMutation(before.session)).toBe(true);
    expect(reads.isCurrent(before)).toBe(false);
    expect(invalidated).toHaveBeenCalledTimes(1);
    expect(reads.isCurrent(reads.capture())).toBe(true);
    subscription.unsubscribe();
  });

  it('publishes session invalidations synchronously after advancing the epoch', (): void => {
    const reads = TestBed.inject(ReadBoundary);
    const session = TestBed.inject(SessionContext);
    const tickets: number[] = [];
    const subscription = reads.invalidations.subscribe((): void => {
      tickets.push(reads.capture().session);
    });
    const old = reads.capture();
    const loading = session.begin();
    expect(tickets).toEqual([loading]);
    session.accept({ account, csrf_token: 'token' }, loading);
    expect(tickets).toEqual([loading, session.generation()]);
    expect(reads.isCurrent(old)).toBe(false);
    subscription.unsubscribe();
  });

  it('protects every canonical read commit after a newer confirmed write', (): void => {
    const reads = TestBed.inject(ReadBoundary);
    const entities = TestBed.inject(EntityStore);
    const before = reads.capture();
    reads.confirmMutation(before.session);
    entities.putPost({ ...post, body: 'Confirmed' }, before.session);
    expect(entities.putPost(post, before)).toBe(false);
    expect(entities.putPosts([post], before)).toBe(false);
    expect(entities.putProfile(profile, before)).toBe(false);
    expect(
      entities.putReplies(post.id, { items: [reply], next_cursor: null, total_count: 1 }, before),
    ).toBe(false);
    expect(
      entities.putEvents(
        [{ id: 'late', kind: 'post', occurred_at: post.created_at, reposter: null, post }],
        before,
      ),
    ).toBe(false);
    expect(
      entities.putMembership('late', { kind: 'posts', ids: [post.id], private: false }, before),
    ).toBe(false);
    expect(entities.post(post.id)?.body).toBe('Confirmed');
  });
});
