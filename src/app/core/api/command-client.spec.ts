import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { CommandClient } from './command-client';
import { CreatePostRequest, RepostResult } from './models';
import { account, authenticate, post, profile, reply, setupApi } from './testing/http';

describe('CommandClient', (): void => {
  let client: CommandClient;
  let http: HttpTestingController;
  beforeEach((): void => {
    const setup = setupApi();
    http = setup.http;
    authenticate(setup.session);
    client = TestBed.inject(CommandClient);
  });
  afterEach((): void => http.verify());

  it('creates exact JSON posts/code/quotes and replies with one caller key', (): void => {
    const input = {
      body: '  body  ',
      quoted_post_id: post.id,
      code: { language: 'ts', filename: 'x.ts', source: '\n  <code>😀\t\n', extra: true },
      extra: 'exclude',
    };
    let result: unknown;
    client.createPost(input, 'caller:key-1').subscribe((value: unknown): void => {
      result = value;
    });
    const request = http.expectOne('/api/v1/posts');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Content-Type')).toBe('application/json');
    expect(request.request.headers.getAll('Idempotency-Key')).toEqual(['caller:key-1']);
    expect(request.request.headers.getAll('X-CSRF-Token')).toEqual(['current-token']);
    expect(JSON.parse(request.request.body)).toEqual({
      body: input.body,
      quoted_post_id: post.id,
      code: { language: 'ts', filename: 'x.ts', source: input.code.source },
    });
    request.flush(post, { status: 201, statusText: 'Created' });
    expect(result).toEqual(post);
    client
      .createReply(post.id, { body: ' reply ' }, 'caller:key-2')
      .subscribe((value: unknown): void => {
        result = value;
      });
    const created = http.expectOne(`/api/v1/posts/${post.id}/replies`);
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toBe('{"body":" reply "}');
    expect(created.request.headers.getAll('Idempotency-Key')).toEqual(['caller:key-2']);
    created.flush({ reply, reply_total: 99 }, { status: 201, statusText: 'Created' });
    expect(result).toEqual({ reply, reply_total: 99 });
  });

  it('preserves a submission payload/key for explicit retries but never retries automatically', (): void => {
    const input: CreatePostRequest = {
      body: 'original',
      code: { language: 'ts', filename: 'x', source: 'exact' },
    };
    const operation = client.createPost(input, 'logical-key');
    operation.subscribe({ error: (): void => undefined });
    const first = http.expectOne('/api/v1/posts');
    const body = first.request.body;
    first.error(new ProgressEvent('error'));
    http.expectNone('/api/v1/posts');
    input.body = 'changed';
    if (input.code) {
      input.code.source = 'changed';
    }
    operation.subscribe();
    const second = http.expectOne('/api/v1/posts');
    expect(second.request.body).toBe(body);
    expect(second.request.headers.getAll('Idempotency-Key')).toEqual(['logical-key']);
    second.flush(post);
  });

  it.each(['', 'bad key', 'x'.repeat(129), 'a,b', 'a\n'])(
    'rejects invalid creation key %s before HTTP',
    (key: string): void => {
      expect((): Observable<unknown> => client.createPost({ body: 'body' }, key)).toThrow();
      expect((): Observable<unknown> =>
        client.createReply(post.id, { body: 'body' }, key),
      ).toThrow();
    },
  );

  it('uses PUT/DELETE desired-state operations and returns authoritative JSON', (): void => {
    const repost: RepostResult = {
      post,
      repost_entry_id: `repost:${reply.id}`,
      repost_occurred_at: reply.created_at,
    };
    const removed: RepostResult = { post, repost_entry_id: null, repost_occurred_at: null };
    const cases: [Observable<unknown>, string, string, object][] = [
      [client.reaction(post.id, 'brilliant'), `posts/${post.id}/reaction`, 'PUT', post],
      [client.reaction(post.id, null), `posts/${post.id}/reaction`, 'DELETE', post],
      [client.repost(post.id, true), `posts/${post.id}/repost`, 'PUT', repost],
      [client.repost(post.id, false), `posts/${post.id}/repost`, 'DELETE', removed],
      [client.bookmark(post.id, true), `posts/${post.id}/bookmark`, 'PUT', post],
      [client.bookmark(post.id, false), `posts/${post.id}/bookmark`, 'DELETE', post],
      [client.follow(account.id, true), `accounts/${account.id}/follow`, 'PUT', profile],
      [client.follow(account.id, false), `accounts/${account.id}/follow`, 'DELETE', profile],
    ];
    for (const [operation, path, method, response] of cases) {
      let value: unknown;
      operation.subscribe((result: unknown): void => {
        value = result;
      });
      const request = http.expectOne(`/api/v1/${path}`);
      expect(request.request.method).toBe(method);
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.headers.getAll('X-CSRF-Token')).toEqual(['current-token']);
      expect(request.request.headers.has('Idempotency-Key')).toBe(false);
      expect(request.request.body).toBe(
        path.endsWith('/reaction') && method === 'PUT' ? '{"kind":"brilliant"}' : null,
      );
      request.flush(response);
      expect(value).toEqual(response);
    }
  });

  it('accepts author deletion 204 responses without trying to parse JSON', (): void => {
    for (const [operation, path] of [
      [client.deletePost(post.id), `posts/${post.id}`],
      [client.deleteReply(reply.id), `replies/${reply.id}`],
    ] as const) {
      let complete = false;
      operation.subscribe({
        complete: (): void => {
          complete = true;
        },
      });
      const request = http.expectOne(`/api/v1/${path}`);
      expect(request.request.method).toBe('DELETE');
      request.flush(null, { status: 204, statusText: 'No Content' });
      expect(complete).toBe(true);
    }
  });
});
