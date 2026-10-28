import { TestBed } from '@angular/core/testing';
import { computed } from '@angular/core';
import { FeedEntry } from '../api/models';
import { account, authenticate, post, profile, reply } from '../api/testing/http';
import { SessionContext } from '../session/session-context';
import { EntityStore } from './entity-store';

describe('EntityStore', (): void => {
  let store: EntityStore;
  let session: SessionContext;
  beforeEach((): void => {
    store = TestBed.inject(EntityStore);
    session = TestBed.inject(SessionContext);
  });

  it('treats inherited names as missing IDs and accepts opaque membership keys', (): void => {
    expect(store.account('constructor')).toBeUndefined();
    expect(store.post('toString')).toBeUndefined();
    expect(store.event('__proto__')).toBeUndefined();
    store.putMembership(
      '__proto__',
      { kind: 'posts', ids: [post.id], private: false },
      store.captureGeneration(),
    );
    expect(store.membership('__proto__')?.ids).toEqual([post.id]);
  });

  it('preserves distinct event IDs/times while projecting the latest shared canonical post', (): void => {
    const generation = store.captureGeneration();
    const events: FeedEntry[] = [
      { id: 'post:event', kind: 'post', occurred_at: post.created_at, reposter: null, post },
      {
        id: 'repost:event',
        kind: 'repost',
        occurred_at: '2026-10-05T09:00:00Z',
        reposter: account,
        post,
      },
    ];
    store.putEvents(events, generation);
    store.putMembership(
      'feed',
      { kind: 'events', ids: events.map((event): string => event.id), private: false },
      generation,
    );
    const first = computed((): FeedEntry | undefined => store.event('post:event'));
    const second = computed((): FeedEntry | undefined => store.event('repost:event'));
    expect(first()?.post.body).toBe(post.body);
    expect(second()?.post.body).toBe(post.body);
    store.putPost(
      { ...post, body: 'Confirmed change', counts: { ...post.counts, reposts: 4 } },
      generation,
    );
    expect(first()?.post.body).toBe('Confirmed change');
    expect(second()?.post.counts.reposts).toBe(4);
    expect(first()?.id).not.toBe(second()?.id);
    expect(second()?.occurred_at).toBe(events[1].occurred_at);
    expect(second()?.reposter?.id).toBe(account.id);
    expect(store.membership('feed')?.ids).toEqual(['post:event', 'repost:event']);
  });

  it('does not upgrade quotes into entities or overwrite a complete quoted source', (): void => {
    const generation = store.captureGeneration();
    const source = {
      ...post,
      body: 'Complete source',
      code: { filename: 'full', language: 'ts', source: 'full code' },
    };
    store.putPost(source, generation);
    store.putPost(
      {
        ...post,
        id: 'quoting-post',
        quote: {
          id: source.id,
          availability: 'available',
          author: account,
          body: 'Truncated preview',
        },
      },
      generation,
    );
    expect(store.post(source.id)).toEqual(source);
    store.putPost(
      {
        ...post,
        id: 'other-post',
        quote: {
          id: 'not-loaded',
          availability: 'available',
          author: account,
          body: 'Preview only',
        },
      },
      generation,
    );
    expect(store.post('not-loaded')).toBeUndefined();
    store.putPost(
      {
        ...post,
        id: 'quoting-post',
        quote: { id: source.id, availability: 'deleted', author: account, body: 'stale' },
      },
      generation,
    );
    expect(store.post('quoting-post')?.quote).toEqual({ id: source.id, availability: 'deleted' });
    expect(store.post(source.id)?.body).toBe('Complete source');
  });

  it('retains full profiles when summaries arrive and separates relationship state', (): void => {
    const generation = store.captureGeneration();
    store.putProfile({ ...profile, bio: 'Full bio', viewer: { following: true } }, generation);
    store.putPost({ ...post, author: { ...account, display_name: 'Updated name' } }, generation);
    expect(store.profile(account.id)?.bio).toBe('Full bio');
    expect(store.profile(account.id)?.display_name).toBe('Updated name');
    expect(store.profile(account.id)?.viewer).toEqual({ following: true });
    expect(store.account(account.id)).not.toHaveProperty('viewer');
    expect(store.post(post.id)?.author.display_name).toBe('Updated name');
  });

  it('stores complete replies separately from previews and keeps authoritative totals', (): void => {
    const generation = store.captureGeneration();
    store.putPost(
      {
        ...post,
        counts: { ...post.counts, replies: 99 },
        reply_preview: { items: [reply], next_cursor: 'oldest' },
      },
      generation,
    );
    expect(store.post(post.id)?.counts.replies).toBe(99);
    const later = { ...reply, id: 'later', body: 'Later reply' };
    store.putReplies(
      post.id,
      { items: [reply, later], next_cursor: null, total_count: 100 },
      generation,
    );
    store.putMembership(
      'replies',
      { kind: 'replies', ids: [reply.id, later.id], private: false },
      generation,
    );
    expect(store.reply(later.id)?.body).toBe('Later reply');
    expect(store.post(post.id)?.reply_preview.items).toHaveLength(1);
    expect(store.post(post.id)?.reply_preview.next_cursor).toBe('oldest');
    expect(store.post(post.id)?.counts.replies).toBe(100);
    expect(store.membership('replies')?.ids).toHaveLength(2);
  });

  it('synchronously resets all viewer data/references across A → anonymous → B and rejects late A writes', (): void => {
    authenticate(session);
    const a = store.captureGeneration();
    store.putPost({ ...post, viewer: { reaction: 'ship', bookmarked: true, reposted: true } }, a);
    store.putProfile(profile, a);
    store.putMembership('bookmarks-A', { kind: 'posts', ids: [post.id], private: true }, a);
    session.accept({ account: null, csrf_token: null }, session.begin());
    expect(store.post(post.id)).toBeUndefined();
    expect(store.profile(account.id)).toBeUndefined();
    expect(store.membership('bookmarks-A')).toBeUndefined();
    expect(store.putPost(post, a)).toBe(false);
    expect(store.putProfile(profile, a)).toBe(false);
    expect(
      store.putReplies(post.id, { items: [reply], total_count: 1, next_cursor: null }, a),
    ).toBe(false);
    expect(
      store.putEvents(
        [{ id: 'stale', kind: 'post', occurred_at: post.created_at, reposter: null, post }],
        a,
      ),
    ).toBe(false);
    expect(
      store.putMembership('bookmarks-A', { kind: 'posts', ids: [post.id], private: true }, a),
    ).toBe(false);
    session.accept(
      { account: { ...account, id: 'account-B' }, csrf_token: 'token-B' },
      session.begin(),
    );
    const b = store.captureGeneration();
    store.putPost({ ...post, viewer: { reaction: null, bookmarked: false, reposted: false } }, b);
    expect(store.post(post.id)?.viewer?.bookmarked).toBe(false);
    expect(store.membership('bookmarks-A')).toBeUndefined();
    expect(store.event('stale')).toBeUndefined();
    expect(store.putPost({ ...post, body: 'Late A' }, a)).toBe(false);
    expect(store.post(post.id)?.body).toBe(post.body);
  });

  it('invalidates viewer data immediately on loading/failure/clear, without waiting for effects', (): void => {
    authenticate(session);
    store.putPost(post, store.captureGeneration());
    const loading = session.begin();
    expect(store.post(post.id)).toBeUndefined();
    store.putPost(post, loading);
    session.fail(new Error('network'), loading);
    expect(store.post(post.id)).toBeUndefined();
    const failed = store.captureGeneration();
    session.clear();
    expect(store.putPost(post, failed)).toBe(false);
  });

  it('does not publish mutable references to canonical counts or viewer relationships', (): void => {
    const generation = store.captureGeneration();
    store.putPost(post, generation);
    store.putProfile(profile, generation);
    const projected = store.post(post.id);
    const projectedProfile = store.profile(account.id);
    if (projected) {
      projected.counts.replies = 900;
    }
    if (projectedProfile?.viewer) {
      projectedProfile.viewer.following = false;
    }
    expect(store.post(post.id)?.counts.replies).toBe(0);
    expect(store.profile(account.id)?.viewer?.following).toBe(true);
  });
});
