import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { account, post, profile, reply, setupApi } from '../api/testing/http';
import { SessionContext } from '../session/session-context';
import { ProductState } from './product-state';

describe('ProductState', (): void => {
  let state: ProductState;
  let http: HttpTestingController;
  let session: SessionContext;
  beforeEach((): void => {
    TestBed.configureTestingModule({ providers: [ProductState] });
    ({ http, session } = setupApi());
    state = TestBed.inject(ProductState);
  });
  afterEach((): void => {
    http.verify();
  });

  function boot(authenticated = true): void {
    state.start();
    http
      .expectOne('/api/v1/me')
      .flush(
        authenticated ? { account, csrf_token: 'token' } : { account: null, csrf_token: null },
      );
    TestBed.tick();
  }

  function discovery(): void {
    http.expectOne('/api/v1/trends?limit=6').flush({ items: [] });
    http.expectOne('/api/v1/agents/suggested').flush({ items: [] });
  }

  it('is inert until product mounting and preserves remote empty success without fixtures', (): void => {
    http.expectNone('/api/v1/me');
    boot();
    discovery();
    const feed = http.expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest');
    feed.flush({ items: [], next_cursor: null });
    expect(state.rows()).toEqual([]);
    expect(state.feedView().empty).toBe(true);
    expect(state.trends()).toEqual([]);
    expect(state.suggestions()).toEqual([]);
  });

  it('keeps failed session reads distinct from anonymous and never starts a fixture feed', (): void => {
    state.start();
    http.expectOne('/api/v1/me').error(new ProgressEvent('error'));
    TestBed.tick();
    expect(state.sessionView()).toMatchObject({ phase: 'error', error: 'network' });
    expect(state.rows()).toEqual([]);
    http.expectNone('/api/v1/feed');
  });

  it('reads arbitrary identity/events and maps existing sort/topic controls to allowed queries', (): void => {
    boot();
    discovery();
    http.expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest').flush({
      items: [
        { id: 'post:event', kind: 'post', occurred_at: post.created_at, reposter: null, post },
        {
          id: 'repost:event',
          kind: 'repost',
          occurred_at: post.created_at,
          reposter: account,
          post,
        },
      ],
      next_cursor: null,
    });
    expect(state.rows()).toHaveLength(2);
    expect(state.rows()[0].post.identity?.id).toBe(account.id);
    state.sort.set('liked');
    state.selectTopic('Go');
    TestBed.tick();
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=reacted&tag=Go')
      .flush({ items: [], next_cursor: null });
  });

  it('gates anonymous writes/private views and keeps public replies readable', (): void => {
    boot(false);
    discovery();
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
      .flush({ items: [], next_cursor: null });
    state.react(post.id, 'ship');
    state.follow(account.id, true);
    state.publish({ text: 'not local' });
    state.navigate('bookmarks');
    TestBed.tick();
    expect(state.rows()).toEqual([]);
    expect(state.authenticated()).toBe(false);
    http.expectNone('/api/v1/me/bookmarks?limit=20');
    state.openReplies(post.id, true);
    http
      .expectOne(`/api/v1/posts/${post.id}/replies?limit=20&sort=oldest`)
      .flush({ items: [], total_count: 0, next_cursor: null });
  });

  it('fetches missing canonical links and keeps unavailable/deleted feedback honest', (): void => {
    state.reveal(post.id);
    boot(false);
    discovery();
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
      .flush({ items: [], next_cursor: null });
    http.expectOne(`/api/v1/posts/${post.id}`).flush(post);
    expect(state.rows()[0].rowId).toBe('detail:' + post.id);
    expect(state.focusedPost()).toBe(post.id);
    state.retryDetail();
    http
      .expectOne(`/api/v1/posts/${post.id}`)
      .flush({ error: { code: 'deleted' } }, { status: 410, statusText: 'Gone' });
    expect(state.rows()).toEqual([]);
    expect(state.detailError()).toContain('deleted');
  });

  it('fetches remote profiles and cancels an obsolete profile request', (): void => {
    boot();
    discovery();
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
      .flush({ items: [], next_cursor: null });
    state.openProfile(account.id);
    const old = http.expectOne(`/api/v1/accounts/${account.id}`);
    state.openProfile('other-account');
    expect(old.cancelled).toBe(true);
    http
      .expectOne('/api/v1/accounts/other-account')
      .flush({ ...profile, id: 'other-account', display_name: 'Unfamiliar' });
    expect(state.profile()?.identity?.name).toBe('Unfamiliar');
  });

  it('clears viewer drafts/retry context/private results synchronously across account transitions', (): void => {
    boot();
    discovery();
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
      .flush({ items: [], next_cursor: null });
    state.draftText.set('private A draft');
    state.setReplyDraft(post.id, 'private reply');
    state.navigate('bookmarks');
    TestBed.tick();
    const old = http.expectOne('/api/v1/me/bookmarks?limit=20');
    session.accept({ account: null, csrf_token: null }, session.begin());
    expect(old.cancelled).toBe(true);
    expect(state.draftText()).toBe('');
    expect(state.replyDraft(post.id)).toBe('');
    expect(state.rows()).toEqual([]);
    TestBed.tick();
    discovery();
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
      .flush({ items: [], next_cursor: null });
  });

  it('preserves composer text and exact retry keys across network failure and modal reopening', (): void => {
    boot();
    discovery();
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
      .flush({ items: [], next_cursor: null });
    state.compose();
    state.draftText.set('  exact 😀 text  ');
    state.publish({ text: state.draftText() });
    const first = http.expectOne('/api/v1/posts');
    const body = first.request.body;
    const key = first.request.headers.get('Idempotency-Key');
    state.publish({ text: state.draftText() });
    http.expectNone('/api/v1/posts');
    first.error(new ProgressEvent('error'));
    expect(state.draftText()).toBe('  exact 😀 text  ');
    expect(state.composerOpen()).toBe(true);
    state.composerOpen.set(false);
    state.compose();
    state.publish({ text: state.draftText() });
    const retried = http.expectOne('/api/v1/posts');
    expect(retried.request.body).toBe(body);
    expect(retried.request.headers.get('Idempotency-Key')).toBe(key);
    retried.flush(post);
    expect(state.draftText()).toBe('');
    expect(state.composerOpen()).toBe(false);
    discovery();
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
      .flush({ items: [], next_cursor: null });
    TestBed.tick();
    http.expectOne(`/api/v1/posts/${post.id}`).flush(post);
    expect(state.rows()[0].postId).toBe(post.id);
  });

  it('sends canonical quote IDs, hides deleted source metadata and preserves text when context is removed', (): void => {
    boot();
    discovery();
    http.expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest').flush({
      items: [
        { id: 'post:event', kind: 'post', occurred_at: post.created_at, reposter: null, post },
      ],
      next_cursor: null,
    });
    void state.share(post.id, 'quote');
    state.draftText.set('quote draft');
    state.publish({ text: state.draftText(), quote: state.quote() ?? undefined });
    const request = http.expectOne('/api/v1/posts');
    expect(JSON.parse(request.request.body)).toEqual({
      body: 'quote draft',
      quoted_post_id: post.id,
    });
    request.flush({ error: { code: 'deleted' } }, { status: 410, statusText: 'Gone' });
    state.reveal(post.id);
    TestBed.tick();
    http
      .expectOne(`/api/v1/posts/${post.id}`)
      .flush({ error: { code: 'deleted' } }, { status: 410, statusText: 'Gone' });
    expect(state.quote()).toEqual({ id: post.id, availability: 'deleted' });
    expect(state.draftText()).toBe('quote draft');
    state.clearQuote();
    expect(state.quote()).toBeNull();
    expect(state.draftText()).toBe('quote draft');
  });

  it('retains controlled reply drafts across 422 and collapse, then uses confirmed totals and refreshed pages', (): void => {
    boot();
    discovery();
    const event = {
      id: 'post:event',
      kind: 'post',
      occurred_at: post.created_at,
      reposter: null,
      post,
    };
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
      .flush({ items: [event], next_cursor: null });
    state.openReplies(post.id, true);
    http
      .expectOne(`/api/v1/posts/${post.id}/replies?limit=20&sort=oldest`)
      .flush({ items: [], total_count: 0, next_cursor: null });
    state.setReplyDraft(post.id, '  exact reply  ');
    state.reply(post.id, state.replyDraft(post.id));
    const first = http.expectOne(`/api/v1/posts/${post.id}/replies`);
    const key = first.request.headers.get('Idempotency-Key');
    first.flush(
      { error: { code: 'validation_failed', fields: { body: 'Review this reply' } } },
      { status: 422, statusText: 'Unprocessable' },
    );
    expect(state.replyDraft(post.id)).toBe('  exact reply  ');
    expect(state.postError(post.id)).toBe('Review this reply');
    state.openReplies(post.id, false);
    state.openReplies(post.id, true);
    http
      .expectOne(`/api/v1/posts/${post.id}/replies?limit=20&sort=oldest`)
      .flush({ items: [], total_count: 0, next_cursor: null });
    state.reply(post.id, state.replyDraft(post.id));
    const retried = http.expectOne(`/api/v1/posts/${post.id}/replies`);
    expect(retried.request.headers.get('Idempotency-Key')).toBe(key);
    retried.flush({ reply, reply_total: 98 });
    expect(state.replyDraft(post.id)).toBe('');
    expect(state.rows()[0].post.comments).toBe(98);
    discovery();
    http.expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest').flush({
      items: [{ ...event, post: { ...post, counts: { ...post.counts, replies: 98 } } }],
      next_cursor: null,
    });
    http
      .expectOne(`/api/v1/posts/${post.id}/replies?limit=20&sort=oldest`)
      .flush({ items: [reply], total_count: 98, next_cursor: null });
    expect(state.rows()[0].post.replies[0].id).toBe(reply.id);
  });

  it('cancels fast query chains, uses server snippets and resolves a selected result remotely', (): void => {
    boot(false);
    discovery();
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
      .flush({ items: [], next_cursor: null });
    state.search.set('first');
    TestBed.tick();
    const old = http.expectOne('/api/v1/search/posts?limit=4&q=first');
    state.search.set('second');
    TestBed.tick();
    expect(old.cancelled).toBe(true);
    http
      .expectOne('/api/v1/search/posts?limit=4&q=second')
      .flush({ items: [{ post, snippet: 'actual excerpt' }], next_cursor: 'search-next' });
    expect(state.searchResults()[0].description).toBe('actual excerpt');
    state.moreSearch();
    http
      .expectOne('/api/v1/search/posts?limit=4&cursor=search-next&q=second')
      .flush({ items: [], next_cursor: null });
    state.reveal(post.id);
    TestBed.tick();
    http.expectOne(`/api/v1/posts/${post.id}`).flush(post);
    expect(state.rows()[0].postId).toBe(post.id);
  });
});
