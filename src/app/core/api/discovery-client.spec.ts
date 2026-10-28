import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { DiscoveryClient } from './discovery-client';
import { post, profile, setupApi } from './testing/http';

describe('DiscoveryClient', (): void => {
  let client: DiscoveryClient;
  let http: HttpTestingController;
  beforeEach((): void => {
    ({ http } = setupApi());
    client = TestBed.inject(DiscoveryClient);
  });
  afterEach((): void => http.verify());

  it('uses distinct queries and preserves snippet/null trend wire data', (): void => {
    const cases: [Observable<unknown>, string, object][] = [
      [
        client.search({ q: '  😀😀 +"exact"  ', limit: 4, cursor: '+/opaque' }),
        '/api/v1/search/posts?limit=4&cursor=%2B/opaque&q=%F0%9F%98%80%F0%9F%98%80%20%2B%22exact%22',
        { items: [{ post, snippet: '<literal>' }], next_cursor: null },
      ],
      [client.suggested(20), '/api/v1/agents/suggested?limit=20', { items: [profile] }],
      [
        client.trends(6),
        '/api/v1/trends?limit=6',
        {
          items: [
            {
              slug: 'go',
              display_name: 'Go',
              post_count: 10,
              previous_post_count: 0,
              change_percent: null,
            },
          ],
        },
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

  it('omits unspecified defaults and unsupported search sort/tag fields', (): void => {
    const query = { q: 'ok', sort: 'liked', tag: 'go' };
    client.search(query).subscribe();
    http.expectOne('/api/v1/search/posts?q=ok').flush({ items: [], next_cursor: null });
    client.suggested().subscribe();
    http.expectOne('/api/v1/agents/suggested').flush({ items: [] });
    client.trends().subscribe();
    http.expectOne('/api/v1/trends').flush({ items: [] });
  });

  it('rejects invalid discovery inputs before creating requests', (): void => {
    for (const q of ['', 'x', 'x\0y', '😀'.repeat(101)]) {
      expect((): Observable<unknown> => client.search({ q })).toThrow();
    }
    expect((): Observable<unknown> => client.search({ q: 'ok', limit: 21 })).toThrow();
    expect((): Observable<unknown> => client.suggested(21)).toThrow();
    expect((): Observable<unknown> => client.trends(7)).toThrow();
  });

  it('propagates rate limiting without retry or fabricated discovery results', (): void => {
    let failure: unknown;
    client.trends().subscribe({
      error: (error: unknown): void => {
        failure = error;
      },
    });
    http
      .expectOne('/api/v1/trends')
      .flush(
        { error: { code: 'rate_limited' } },
        { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '5' } },
      );
    expect(failure).toBeInstanceOf(HttpErrorResponse);
    expect((failure as HttpErrorResponse).headers.get('Retry-After')).toBe('5');
    http.expectNone('/api/v1/trends');
  });
});
