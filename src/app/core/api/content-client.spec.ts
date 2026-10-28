import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { ContentClient } from './content-client';
import { account, post, profile, reply, setupApi } from './testing/http';

describe('ContentClient', (): void => {
  let client: ContentClient;
  let http: HttpTestingController;
  beforeEach((): void => {
    ({ http } = setupApi());
    client = TestBed.inject(ContentClient);
  });
  afterEach((): void => http.verify());

  it('covers all read endpoints with GET and unmapped wire responses', (): void => {
    const cases: [Observable<unknown>, string, object][] = [
      [
        client.feed({ view: 'following', sort: 'reacted', tag: 'Go', limit: 10, cursor: 'opaque' }),
        '/api/v1/feed?limit=10&cursor=opaque&view=following&sort=reacted&tag=Go',
        {
          items: [
            {
              id: 'repost:event',
              kind: 'repost',
              occurred_at: post.created_at,
              reposter: account,
              post,
            },
          ],
          next_cursor: null,
        },
      ],
      [client.post(post.id), `/api/v1/posts/${post.id}`, post],
      [
        client.replies(post.id, { sort: 'newest', cursor: 'next', limit: 2 }),
        `/api/v1/posts/${post.id}/replies?limit=2&cursor=next&sort=newest`,
        { items: [reply], next_cursor: 'opaque', total_count: 100 },
      ],
      [
        client.bookmarks({ cursor: 'bookmarks' }),
        '/api/v1/me/bookmarks?cursor=bookmarks',
        { items: [], next_cursor: null },
      ],
      [client.profile(account.id), `/api/v1/accounts/${account.id}`, profile],
      [client.profileByHandle(' Alice '), '/api/v1/accounts/by-handle/%20Alice%20', profile],
      [
        client.accountFeed(account.id, { limit: 1 }),
        `/api/v1/accounts/${account.id}/feed?limit=1`,
        { items: [], next_cursor: null },
      ],
    ];
    for (const [operation, url, response] of cases) {
      let value: unknown;
      operation.subscribe((result: unknown): void => {
        value = result;
      });
      const request = http.expectOne(url);
      expect(request.request.method).toBe('GET');
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.headers.has('X-CSRF-Token')).toBe(false);
      request.flush(response);
      expect(value).toEqual(response);
    }
  });

  it('excludes unsupported queries and preserves opaque cursors', (): void => {
    const selection = { limit: 2, cursor: '+/opaque&=', sort: 'newest', tag: 'not-supported' };
    client.accountFeed(account.id, selection).subscribe();
    const request = http.expectOne(
      `/api/v1/accounts/${account.id}/feed?limit=2&cursor=%2B/opaque%26=`,
    );
    expect(request.request.params.keys()).toEqual(['limit', 'cursor']);
    request.flush({ items: [], next_cursor: null });
  });

  it('propagates HTTP failures without fallback or retry', (): void => {
    let failure: unknown;
    client.post(post.id).subscribe({
      error: (error: unknown): void => {
        failure = error;
      },
    });
    http
      .expectOne(`/api/v1/posts/${post.id}`)
      .flush(
        { error: { code: 'deleted' }, request_id: 'request' },
        { status: 410, statusText: 'Gone' },
      );
    expect(failure).toBeInstanceOf(HttpErrorResponse);
    expect((failure as HttpErrorResponse).status).toBe(410);
    http.expectNone(`/api/v1/posts/${post.id}`);
  });

  it('rejects unsafe path segments and invalid pagination before HTTP', (): void => {
    expect((): Observable<unknown> => client.post('../me')).toThrow();
    expect((): Observable<unknown> => client.profileByHandle('alice?extra=1')).toThrow();
    expect((): Observable<unknown> => client.replies(post.id, { limit: 0 })).toThrow();
  });
});

describe('configured content destination', (): void => {
  it('uses the injected backend origin and encoded dynamic segments', (): void => {
    const { http } = setupApi('https://backend.test');
    TestBed.inject(ContentClient).profileByHandle('ALICE+1').subscribe();
    const request = http.expectOne('https://backend.test/api/v1/accounts/by-handle/ALICE%2B1');
    expect(request.request.withCredentials).toBe(true);
    request.flush(profile);
    http.verify();
  });
});
