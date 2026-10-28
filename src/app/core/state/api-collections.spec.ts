import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FeedPage, PostPage, ReplyPage, SearchPage } from '../api/models';
import { account, authenticate, post, reply, setupApi } from '../api/testing/http';
import { SessionContext } from '../session/session-context';
import { ApiCollections } from './api-collections';
import { CollectionDefinition, CursorCollection, CursorResult } from './cursor-collection';
import { EntityStore } from './entity-store';
import { ReadBoundary } from './read-boundary';

describe('ApiCollections', (): void => {
  let api: ApiCollections;
  let http: HttpTestingController;
  let session: SessionContext;
  let reads: ReadBoundary;
  let entities: EntityStore;
  let owned: { dispose(): void }[];

  beforeEach((): void => {
    ({ http, session } = setupApi());
    authenticate(session);
    api = TestBed.inject(ApiCollections);
    reads = TestBed.inject(ReadBoundary);
    entities = TestBed.inject(EntityStore);
    owned = [];
  });
  afterEach((): void => {
    for (const collection of owned) {
      collection.dispose();
    }
    http.verify();
  });

  function create<P extends CursorResult>(
    definition: CollectionDefinition<P>,
  ): CursorCollection<P> {
    const collection = api.create(definition);
    owned.push(collection);
    return collection;
  }

  it('keys each endpoint by documented selection and viewer without accepting foreign cursors', (): void => {
    const feed = api.feed();
    expect(feed.key).toBe(api.feed({ view: 'for-you', sort: 'newest', tag: '', limit: 20 }).key);
    expect(feed.key).not.toBe(api.feed({ view: 'following' }).key);
    expect(feed.key).not.toBe(api.feed({ sort: 'reacted' }).key);
    expect(feed.key).not.toBe(api.feed({ tag: 'Go' }).key);
    expect(api.search({ q: '  query  ' }).key).toBe(api.search({ q: 'query' }).key);
    expect(api.search({ q: 'query' }).key).not.toBe(api.search({ q: 'other' }).key);
    expect(api.accountFeed('A').key).not.toBe(api.accountFeed('B').key);
    expect(api.bookmarks().key).not.toBe(feed.key);
    expect(api.replies(post.id, { sort: 'newest' }).key).not.toBe(api.replies(post.id).key);
    const replyKey = api.replies(post.id).key;
    const bookmarkKey = api.bookmarks().key;
    session.accept({ account: { ...account, id: 'B' }, csrf_token: 'token-B' }, session.begin());
    expect(api.feed().key).not.toBe(feed.key);
    expect(api.bookmarks().key).not.toBe(bookmarkKey);
    expect(api.replies(post.id).key).toBe(replyKey);
    expect(api.replies(post.id).session).not.toBe(feed.session);
    const obsolete = create(feed);
    expect(obsolete.state().key).toBeNull();
  });

  it('deduplicates feed events by event ID, never by their shared post ID', (): void => {
    const selection = {
      view: 'spicy' as const,
      sort: 'reacted' as const,
      tag: 'Go',
      limit: 2,
      cursor: 'foreign',
    };
    const feed = create(api.feed(selection));
    const first = http.expectOne('/api/v1/feed?limit=2&view=spicy&sort=reacted&tag=Go');
    const original = {
      id: 'post:event',
      kind: 'post' as const,
      occurred_at: post.created_at,
      reposter: null,
      post,
    };
    const repost = { ...original, id: 'repost:event', kind: 'repost' as const, reposter: account };
    first.flush({ items: [original, repost], next_cursor: '+/opaque=&' } satisfies FeedPage);
    expect(feed.state().ids).toEqual(['post:event', 'repost:event']);
    feed.loadMore();
    const more = http.expectOne(
      '/api/v1/feed?limit=2&cursor=%2B/opaque=%26&view=spicy&sort=reacted&tag=Go',
    );
    expect(more.request.withCredentials).toBe(true);
    more.flush({ items: [repost], next_cursor: null } satisfies FeedPage);
    expect(feed.state().ids).toEqual(['post:event', 'repost:event']);
    expect(feed.state().exhausted).toBe(true);
  });

  it('cancels fast feed filter changes and starts a fresh cursor for every selection', (): void => {
    const feed = create(api.feed());
    const old = http.expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest');
    feed.select(api.feed({ view: 'following', sort: 'relevant', tag: 'ts' }));
    expect(old.cancelled).toBe(true);
    const next = http.expectOne('/api/v1/feed?limit=20&view=following&sort=relevant&tag=ts');
    expect(next.request.params.has('cursor')).toBe(false);
    next.flush({ items: [], next_cursor: null });
    expect(feed.state().empty).toBe(true);
  });

  it('keeps search snippets collection-local and cancels obsolete query results', (): void => {
    const input = { q: '  first  ', sort: 'liked', tag: 'unsupported', cursor: 'foreign' };
    const search = create(api.search(input));
    const old = http.expectOne('/api/v1/search/posts?limit=4&q=first');
    search.select(api.search({ q: 'second' }));
    expect(old.cancelled).toBe(true);
    http.expectOne('/api/v1/search/posts?limit=4&q=second').flush({
      items: [{ post, snippet: '<literal excerpt>' }],
      next_cursor: 'search-only',
    } satisfies SearchPage);
    expect(entities.post(post.id)?.body).toBe(post.body);
    expect(entities.membership(search.state().membershipKey ?? '')?.snippets).toEqual({
      [post.id]: '<literal excerpt>',
    });
    search.loadMore();
    http.expectOne('/api/v1/search/posts?limit=4&cursor=search-only&q=second').flush({
      items: [
        { post, snippet: 'updated excerpt' },
        { post: { ...post, id: 'next' }, snippet: 'next excerpt' },
      ],
      next_cursor: null,
    } satisfies SearchPage);
    expect(search.state().ids).toEqual([post.id, 'next']);
    expect(entities.membership(search.state().membershipKey ?? '')?.snippets?.[post.id]).toBe(
      'updated excerpt',
    );
  });

  it('sends account/bookmark-only pagination, invalidating all private rows on session changes', (): void => {
    const extra = { limit: 1, sort: 'reacted', tag: 'go', cursor: 'foreign' };
    const activity = create(api.accountFeed(account.id, extra));
    http
      .expectOne(`/api/v1/accounts/${account.id}/feed?limit=1`)
      .flush({ items: [], next_cursor: null });
    expect(activity.state().empty).toBe(true);
    const bookmarks = create(api.bookmarks(extra));
    http
      .expectOne('/api/v1/me/bookmarks?limit=1')
      .flush({ items: [post], next_cursor: 'private-A' } satisfies PostPage);
    bookmarks.loadMore();
    const old = http.expectOne('/api/v1/me/bookmarks?limit=1&cursor=private-A');
    const key = bookmarks.state().membershipKey ?? '';
    session.clear();
    expect(old.cancelled).toBe(true);
    expect(bookmarks.state().ids).toEqual([]);
    expect(bookmarks.state().nextCursor).toBeNull();
    expect(entities.membership(key)).toBeUndefined();
  });

  it('uses an embedded oldest preview cursor only for the matching post and ordering', (): void => {
    const previewPost = {
      ...post,
      counts: { ...post.counts, replies: 50 },
      reply_preview: { items: [reply], next_cursor: 'oldest-only' },
    };
    const preview = { post: previewPost, ticket: reads.capture() };
    const oldest = create(api.replies(post.id, {}, preview));
    expect(oldest.state().ids).toEqual([reply.id]);
    expect(oldest.state().nextCursor).toBe('oldest-only');
    http.expectNone(`/api/v1/posts/${post.id}/replies?limit=20&sort=oldest`);
    oldest.loadMore();
    http
      .expectOne(`/api/v1/posts/${post.id}/replies?limit=20&cursor=oldest-only&sort=oldest`)
      .flush({ items: [reply], total_count: 50, next_cursor: null } satisfies ReplyPage);
    expect(oldest.state().ids).toEqual([reply.id]);
    const newest = create(api.replies(post.id, { sort: 'newest' }, preview));
    const fresh = http.expectOne(`/api/v1/posts/${post.id}/replies?limit=20&sort=newest`);
    expect(fresh.request.params.has('cursor')).toBe(false);
    fresh.flush({ items: [], total_count: 0, next_cursor: null } satisfies ReplyPage);
    expect(newest.state().empty).toBe(true);
    expect((): CollectionDefinition<ReplyPage> => api.replies('wrong-post', {}, preview)).toThrow();
  });

  it('refuses previews from before a confirmed mutation or session transition', (): void => {
    const preview = {
      post: { ...post, reply_preview: { items: [reply], next_cursor: 'stale' } },
      ticket: reads.capture(),
    };
    const seededBeforeMutation = api.replies(post.id, {}, preview);
    reads.confirmMutation(session.generation());
    expect(api.replies(post.id, {}, preview).seed).toBeUndefined();
    const replies = create(seededBeforeMutation);
    expect(replies.state().ids).toEqual([]);
    http
      .expectOne(`/api/v1/posts/${post.id}/replies?limit=20&sort=oldest`)
      .flush({ items: [], total_count: 0, next_cursor: null });
    const oldDefinition = api.replies(post.id, {}, { post, ticket: reads.capture() });
    session.clear();
    expect(replies.select(oldDefinition)).toBe(false);
    expect(replies.state().nextCursor).toBeNull();
  });

  it('invalidates concurrent reads globally before confirmed entity updates, without automatic replay', (): void => {
    const feed = create(api.feed());
    const bookmarks = create(api.bookmarks());
    const first = http.expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest');
    const second = http.expectOne('/api/v1/me/bookmarks?limit=20');
    const generation = session.generation();
    reads.confirmMutation(generation);
    entities.putPost({ ...post, body: 'Confirmed' }, generation);
    expect(first.cancelled).toBe(true);
    expect(second.cancelled).toBe(true);
    expect(feed.state().stale).toBe(true);
    expect(bookmarks.state().canRetry).toBe(true);
    expect(entities.post(post.id)?.body).toBe('Confirmed');
  });

  it('rejects unsupported sorts and invalid query/page sizes before starting HTTP', (): void => {
    const invalid = { sort: 'liked' };
    // @ts-expect-error Presentation sort is not a supported API sort.
    expect((): CollectionDefinition<FeedPage> => api.feed(invalid)).toThrow();
    expect((): CollectionDefinition<SearchPage> => api.search({ q: 'x' })).toThrow();
    expect((): CollectionDefinition<SearchPage> => api.search({ q: 'ok', limit: 21 })).toThrow();
    expect((): CollectionDefinition<PostPage> => api.bookmarks({ limit: 0 })).toThrow();
  });
});
