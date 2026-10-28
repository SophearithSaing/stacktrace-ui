import { computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Post } from '../api/models';
import { account, authenticate, post, profile, reply, setupApi } from '../api/testing/http';
import { SessionContext } from '../session/session-context';
import { ApiCollections } from './api-collections';
import { CommandResult } from './command-executor';
import { EntityStore } from './entity-store';
import { Mutations } from './mutations';
import { ReadBoundary } from './read-boundary';

describe('Mutations', (): void => {
  let mutations: Mutations;
  let entities: EntityStore;
  let session: SessionContext;
  let reads: ReadBoundary;
  let http: HttpTestingController;
  beforeEach((): void => {
    ({ http, session } = setupApi());
    authenticate(session);
    mutations = TestBed.inject(Mutations);
    entities = TestBed.inject(EntityStore);
    reads = TestBed.inject(ReadBoundary);
    entities.putPost(post, session.generation());
  });
  afterEach((): void => http.verify());

  it('reconciles authoritative reaction state into Home/search/bookmark projections without optimistic drift', (): void => {
    const generation = session.generation();
    entities.putEvents(
      [
        { id: 'post:event', kind: 'post', occurred_at: post.created_at, reposter: null, post },
        {
          id: 'repost:event',
          kind: 'repost',
          occurred_at: post.created_at,
          reposter: account,
          post,
        },
      ],
      generation,
    );
    entities.putMembership('search', { kind: 'posts', ids: [post.id], private: false }, generation);
    entities.putMembership(
      'bookmarks',
      { kind: 'posts', purpose: 'bookmarks', ids: [post.id], private: true },
      generation,
    );
    const home = computed((): Post | undefined => entities.event('post:event')?.post);
    const search = computed((): Post | undefined =>
      entities.post(entities.membership('search')?.ids[0] ?? ''),
    );
    const bookmarks = computed((): Post | undefined =>
      entities.post(entities.membership('bookmarks')?.ids[0] ?? ''),
    );
    mutations.reaction(post.id, 'brilliant').subscribe();
    expect(entities.post(post.id)?.counts.reactions_total).toBe(0);
    expect(mutations.pending({ type: 'post', id: post.id })).toBe(true);
    mutations.bookmark(post.id, true).subscribe((result): void => {
      expect(result).toEqual({ status: 'blocked', reason: 'pending' });
    });
    const confirmed = {
      ...post,
      counts: {
        ...post.counts,
        reactions_total: 50,
        reactions_by_kind: { ...post.counts.reactions_by_kind, brilliant: 50 },
      },
      viewer: { reaction: 'brilliant' as const, bookmarked: true, reposted: true },
    };
    http.expectOne(`/api/v1/posts/${post.id}/reaction`).flush(confirmed);
    for (const projection of [
      home(),
      search(),
      bookmarks(),
      entities.event('repost:event')?.post,
    ]) {
      expect(projection?.counts.reactions_total).toBe(50);
      expect(projection?.viewer?.reaction).toBe('brilliant');
    }
    mutations.bookmark(post.id, false).subscribe();
    http
      .expectOne(`/api/v1/posts/${post.id}/bookmark`)
      .flush({ ...confirmed, viewer: { ...confirmed.viewer, bookmarked: false } });
    expect(entities.membership('bookmarks')?.ids).toEqual([]);
    expect(entities.membership('search')?.ids).toEqual([post.id]);
  });

  it('preserves drafts/keys/payloads across uncertain retries and suppresses duplicate creations', (): void => {
    const draft = { body: '  exact draft  ' };
    const operation = mutations.createPost(draft, 'logical-key');
    operation.subscribe((result): void => {
      expect(result.status).toBe('failed');
    });
    const first = http.expectOne('/api/v1/posts');
    const body = first.request.body;
    mutations.createPost(draft, 'another-click-key').subscribe((result): void => {
      expect(result).toEqual({ status: 'blocked', reason: 'pending' });
    });
    first.error(new ProgressEvent('error'));
    expect(draft.body).toBe('  exact draft  ');
    draft.body = 'edited after attempt';
    operation.subscribe((result): void => {
      expect(result.status).toBe('confirmed');
    });
    const retried = http.expectOne('/api/v1/posts');
    expect(retried.request.body).toBe(body);
    expect(retried.request.headers.getAll('Idempotency-Key')).toEqual(['logical-key']);
    retried.flush({ ...post, id: 'created-post' }, { status: 201, statusText: 'Created' });
    expect(entities.post('created-post')).toBeDefined();
    expect(draft.body).toBe('edited after attempt');
  });

  it('uses authoritative reply totals and never clears a failed reply draft', (): void => {
    const draft = { body: 'reply draft' };
    mutations.createReply(post.id, draft, 'reply-key').subscribe((result): void => {
      expect(result).toMatchObject({ status: 'failed', failure: { kind: 'conflict' } });
    });
    http
      .expectOne(`/api/v1/posts/${post.id}/replies`)
      .flush({ error: { code: 'conflict' } }, { status: 409, statusText: 'Conflict' });
    expect(draft.body).toBe('reply draft');
    expect(entities.post(post.id)?.counts.replies).toBe(0);
    mutations.createReply(post.id, draft, 'reply-key').subscribe();
    http.expectOne(`/api/v1/posts/${post.id}/replies`).flush({ reply, reply_total: 98 });
    expect(entities.reply(reply.id)).toEqual(reply);
    expect(entities.post(post.id)?.counts.replies).toBe(98);
    expect(entities.post(post.id)?.reply_preview.items).toHaveLength(0);
  });

  it('keeps repost event identity/time on no-op PUT and removes only this viewer on DELETE', (): void => {
    const result = {
      post,
      repost_entry_id: 'repost:server-id',
      repost_occurred_at: '2026-10-28T12:00:00Z',
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      mutations.repost(post.id, true).subscribe();
      http.expectOne(`/api/v1/posts/${post.id}/repost`).flush(result);
      expect(entities.event(result.repost_entry_id)?.occurred_at).toBe(result.repost_occurred_at);
    }
    entities.putEvents(
      [
        {
          id: 'other-repost',
          kind: 'repost',
          occurred_at: post.created_at,
          reposter: { ...account, id: 'other-account' },
          post,
        },
      ],
      session.generation(),
    );
    mutations.repost(post.id, false).subscribe();
    const removed = http.expectOne(`/api/v1/posts/${post.id}/repost`);
    expect(removed.request.method).toBe('DELETE');
    removed.flush({ post, repost_entry_id: null, repost_occurred_at: null });
    expect(entities.event('repost:server-id')).toBeUndefined();
    expect(entities.event('other-repost')).toBeDefined();
    mutations.repost(post.id, true).subscribe();
    http
      .expectOne(`/api/v1/posts/${post.id}/repost`)
      .flush({ ...result, repost_entry_id: 'repost:new-id' });
    expect(entities.event('repost:new-id')).toBeDefined();
    expect(entities.event('repost:server-id')).toBeUndefined();
  });

  it('reconciles profiles, canonical author metadata and suggestions without local follower deltas', (): void => {
    entities.putProfile(profile, session.generation());
    entities.putReplies(
      post.id,
      { items: [reply], total_count: 1, next_cursor: null },
      session.generation(),
    );
    entities.putMembership(
      'suggestions',
      { kind: 'accounts', purpose: 'suggestions', ids: [account.id], private: false },
      session.generation(),
    );
    mutations.follow(account.id, true).subscribe();
    expect(entities.profile(account.id)?.follower_count).toBe(0);
    http.expectOne(`/api/v1/accounts/${account.id}/follow`).flush({
      ...profile,
      follower_count: 777,
      display_name: 'Updated account',
      viewer: { following: true },
    });
    expect(entities.profile(account.id)?.follower_count).toBe(777);
    expect(entities.profile(account.id)?.viewer?.following).toBe(true);
    expect(entities.post(post.id)?.author.display_name).toBe('Updated account');
    expect(entities.reply(reply.id)?.author.display_name).toBe('Updated account');
    expect(entities.membership('suggestions')?.ids).toEqual([]);
  });

  it('invalidates deleted posts/quotes and cannot restore deleted quote metadata from overlapping commands', (): void => {
    const generation = session.generation();
    const quoting = {
      ...post,
      id: 'quoting',
      quote: {
        id: post.id,
        availability: 'available' as const,
        author: account,
        body: 'private cached quote',
      },
    };
    entities.putPost(quoting, generation);
    entities.putEvents(
      [{ id: 'deleted-event', kind: 'post', occurred_at: post.created_at, reposter: null, post }],
      generation,
    );
    entities.putMembership(
      'deleted-search',
      { kind: 'posts', ids: [post.id], private: false, snippets: { [post.id]: 'cached excerpt' } },
      generation,
    );
    entities.putMembership(
      'deleted-feed',
      { kind: 'events', ids: ['deleted-event'], private: false },
      generation,
    );
    entities.putReplies(post.id, { items: [reply], total_count: 1, next_cursor: null }, generation);
    mutations.createPost({ body: 'other', quoted_post_id: post.id }, 'overlapping-key').subscribe();
    const oldCreation = http.expectOne('/api/v1/posts');
    mutations.deletePost(post.id).subscribe();
    http
      .expectOne(`/api/v1/posts/${post.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(entities.post(post.id)).toBeUndefined();
    expect(entities.reply(reply.id)).toBeUndefined();
    expect(entities.event('deleted-event')).toBeUndefined();
    expect(entities.membership('deleted-search')).toMatchObject({ ids: [], snippets: {} });
    expect(entities.membership('deleted-feed')?.ids).toEqual([]);
    expect(entities.post('quoting')?.quote).toEqual({ id: post.id, availability: 'deleted' });
    oldCreation.flush({ ...quoting, id: 'created-after-delete' });
    expect(entities.post('created-after-delete')?.quote).toEqual({
      id: post.id,
      availability: 'deleted',
    });
    entities.putPost(post, generation);
    expect(entities.post(post.id)).toBeUndefined();
  });

  it('treats terminal 410 as authoritative unavailability without falsely reporting a successful write', (): void => {
    entities.putPost(
      {
        ...post,
        id: 'quote',
        quote: { id: post.id, availability: 'available', author: account, body: 'stale' },
      },
      session.generation(),
    );
    mutations.reaction(post.id, 'ship').subscribe((result): void => {
      expect(result).toMatchObject({ status: 'failed', failure: { kind: 'deleted' } });
    });
    http
      .expectOne(`/api/v1/posts/${post.id}/reaction`)
      .flush({ error: { code: 'deleted' } }, { status: 410, statusText: 'Gone' });
    expect(entities.post(post.id)).toBeUndefined();
    expect(entities.post('quote')?.quote).toEqual({ id: post.id, availability: 'deleted' });
  });

  it('invalidates reply parents on 204 rather than inventing an authoritative new total', (): void => {
    entities.putReplies(
      post.id,
      { items: [reply], total_count: 50, next_cursor: null },
      session.generation(),
    );
    mutations.deleteReply(reply.id).subscribe();
    http
      .expectOne(`/api/v1/replies/${reply.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(entities.reply(reply.id)).toBeUndefined();
    expect(entities.post(post.id)).toBeUndefined();
    entities.putPost(
      { ...post, reply_preview: { items: [reply], next_cursor: null } },
      session.generation(),
    );
    expect(entities.post(post.id)?.reply_preview.items).toEqual([]);
  });

  it('cancels old read chains, commits confirmed state then refreshes first pages with no foreign cursors', (): void => {
    const api = TestBed.inject(ApiCollections);
    const feed = api.create(api.feed());
    try {
      http
        .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
        .flush({ items: [], next_cursor: 'old-chain' });
      feed.loadMore();
      const obsolete = http.expectOne(
        '/api/v1/feed?limit=20&cursor=old-chain&view=for-you&sort=newest',
      );
      const ticket = reads.capture();
      mutations.bookmark(post.id, true).subscribe();
      http
        .expectOne(`/api/v1/posts/${post.id}/bookmark`)
        .flush({ ...post, viewer: { reaction: null, bookmarked: true, reposted: false } });
      expect(obsolete.cancelled).toBe(true);
      expect(entities.post(post.id)?.viewer?.bookmarked).toBe(true);
      expect(entities.putPost(post, ticket)).toBe(false);
      const fresh = http.expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest');
      expect(fresh.request.params.has('cursor')).toBe(false);
      fresh.flush({ items: [], next_cursor: null });
      expect(feed.state().empty).toBe(true);
    } finally {
      feed.dispose();
    }
  });

  it('binds logical retries to their originating session and handles local serialization failures safely', (): void => {
    const old = mutations.createPost({ body: 'old account draft' }, 'key');
    session.accept({ account: { ...account, id: 'B' }, csrf_token: 'token-B' }, session.begin());
    old.subscribe((result): void => {
      expect(result.status).toBe('stale');
    });
    const results: CommandResult<Post>[] = [];
    mutations.createPost({ body: 'x'.repeat(65536) }, 'large').subscribe((result): void => {
      results.push(result);
    });
    expect(results[0]).toMatchObject({ status: 'failed', failure: { kind: 'too-large' } });
    http.expectNone('/api/v1/posts');
  });
});
