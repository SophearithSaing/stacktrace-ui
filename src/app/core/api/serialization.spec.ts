import { HttpParams } from '@angular/common/http';
import { FeedQuery, serializeBody, serializeQuery } from './serialization';

describe('request body serialization', (): void => {
  it('allowlists every write body and preserves credentials and source', (): void => {
    const login = { username: '  ALICE ', password: '  password  ', extra: true };
    expect(JSON.parse(serializeBody('login', login))).toEqual({
      username: login.username,
      password: login.password,
    });
    expect(JSON.parse(serializeBody('register', { ...login, display_name: ' Alice ' }))).toEqual({
      username: login.username,
      password: login.password,
      display_name: ' Alice ',
    });
    const code = { language: ' ts ', filename: ' x.ts ', source: '\n  <tag>😀\t\n', secret: true };
    const post = { body: '  hello  ', code, quoted_post_id: null, tags: ['fake'] };
    expect(JSON.parse(serializeBody('post', post))).toEqual({
      body: post.body,
      quoted_post_id: null,
      code: { language: code.language, filename: code.filename, source: code.source },
    });
    expect(serializeBody('reply', { body: ' reply\n' })).toBe('{"body":" reply\\n"}');
    expect(serializeBody('reaction', { kind: 'ship' })).toBe('{"kind":"ship"}');
  });

  it('distinguishes omitted optional fields from explicit nulls', (): void => {
    expect(JSON.parse(serializeBody('post', { body: 'x' }))).toEqual({ body: 'x' });
    expect(JSON.parse(serializeBody('post', { body: 'x', code: null }))).toEqual({
      body: 'x',
      code: null,
    });
  });

  it('accepts exactly 64 KiB and rejects one more UTF-8 byte', (): void => {
    const overhead = new TextEncoder().encode(serializeBody('reply', { body: '' })).length;
    const text = '😀'.repeat(16380) + 'a'.repeat(65536 - overhead - 65520);
    const json = serializeBody('reply', { body: text });
    expect(new TextEncoder().encode(json).length).toBe(65536);
    expect((): string => serializeBody('reply', { body: text + 'a' })).toThrow(RangeError);
  });

  it('counts JSON escaping, not only source text', (): void => {
    expect((): string => serializeBody('reply', { body: '\n'.repeat(32768) })).toThrow(RangeError);
  });
});

describe('request query serialization', (): void => {
  it('allowlists endpoint keys and emits one encoded value per key', (): void => {
    const input = {
      limit: 50,
      cursor: 'opaque+/=&',
      sort: 'newest',
      q: 'not allowed',
    } satisfies FeedQuery & { q: string };
    const params = serializeQuery('feed', input);
    expect(params.keys()).toEqual(['limit', 'cursor', 'sort']);
    expect(params.getAll('cursor')).toEqual(['opaque+/=&']);
    expect(params.toString()).toContain('cursor=opaque%2B/=%26');
    expect(serializeQuery('bookmarks', input).keys()).toEqual(['limit', 'cursor']);
    expect(serializeQuery('accountFeed', input).keys()).toEqual(['limit', 'cursor']);
    expect(serializeQuery('suggested', { limit: 20 }).toString()).toBe('limit=20');
    expect(serializeQuery('trends', { limit: 6 }).toString()).toBe('limit=6');
    expect(serializeQuery('replies', { sort: 'oldest' }).toString()).toBe('sort=oldest');
  });

  it('omits optional empty values without inventing defaults', (): void => {
    expect(serializeQuery('feed', { tag: '', cursor: '' }).toString()).toBe('');
    expect(serializeQuery('replies', {}).toString()).toBe('');
  });

  it.each([0, -1, 1.5, NaN, Infinity, 51])(
    'rejects invalid page limit %s',
    (limit: number): void => {
      expect((): HttpParams => serializeQuery('feed', { limit })).toThrow(RangeError);
    },
  );

  it('enforces each endpoint maximum and cursor boundary', (): void => {
    expect((): HttpParams => serializeQuery('search', { q: 'ok', limit: 21 })).toThrow();
    expect((): HttpParams => serializeQuery('suggested', { limit: 21 })).toThrow();
    expect((): HttpParams => serializeQuery('trends', { limit: 7 })).toThrow();
    expect(serializeQuery('feed', { cursor: 'x'.repeat(2048) }).get('cursor')?.length).toBe(2048);
    expect((): HttpParams => serializeQuery('feed', { cursor: 'x'.repeat(2049) })).toThrow();
    expect((): HttpParams => serializeQuery('feed', { tag: '#bad' })).toThrow();
  });

  it('normalizes only search and measures Unicode code points', (): void => {
    expect(serializeQuery('search', { q: '  😀😀  ' }).get('q')).toBe('😀😀');
    for (const q of ['', 'x', 'a\0b', '😀'.repeat(101)]) {
      expect((): HttpParams => serializeQuery('search', { q })).toThrow();
    }
  });

  it('rejects unsupported selections and repeated values at runtime', (): void => {
    const invalidSort = { sort: 'liked' };
    // @ts-expect-error Presentation-only sort is not a wire sort.
    expect((): HttpParams => serializeQuery('feed', invalidSort)).toThrow();
    const repeated = { cursor: ['a', 'b'] };
    // @ts-expect-error Repeated cursor values are not supported.
    expect((): HttpParams => serializeQuery('feed', repeated)).toThrow();
  });
});
