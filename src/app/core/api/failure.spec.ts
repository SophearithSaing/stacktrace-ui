import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { FailureKind, failureDiagnostic, normalizeFailure, retryDelay } from './failure';

describe('failure normalization', (): void => {
  it.each<[number, FailureKind]>([
    [0, 'network'],
    [400, 'bad-request'],
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [409, 'conflict'],
    [410, 'deleted'],
    [413, 'too-large'],
    [415, 'media'],
    [422, 'validation'],
    [429, 'rate-limited'],
    [500, 'server'],
    [503, 'unavailable'],
    [599, 'unexpected'],
  ])('maps HTTP %s explicitly to %s', (status, kind): void => {
    const failure = normalizeFailure(
      new HttpErrorResponse({ status, error: '<html>private text</html>' }),
    );
    expect(failure.kind).toBe(kind);
    expect(failure.message).not.toContain('private text');
    expect(failure.fields).toEqual({});
  });

  it('distinguishes invalid credentials and preserves safe field messages only on 422', (): void => {
    expect(
      normalizeFailure(
        new HttpErrorResponse({ status: 401, error: { error: { code: 'invalid_credentials' } } }),
      ).kind,
    ).toBe('credentials');
    const error = {
      error: {
        code: 'validation_failed',
        message: 'private server message',
        fields: {
          body: 'Must contain 1–320 code points',
          password: 'Must contain 12–1024 bytes',
          'code.source': 'Source is required',
          unrelated: 'private',
          username: '<script>bad</script>',
          display_name: 'a'.repeat(241),
          kind: 'bad\0message',
        },
      },
      request_id: 'body-id',
    };
    const failure = normalizeFailure(new HttpErrorResponse({ status: 422, error }));
    expect(failure.fields).toEqual({
      body: 'Must contain 1–320 code points',
      password: 'Must contain 12–1024 bytes',
      'code.source': 'Source is required',
    });
    expect(normalizeFailure(new HttpErrorResponse({ status: 500, error })).fields).toEqual({});
    expect(failure.message).not.toContain('private');
  });

  it('retains both request IDs while diagnostics exclude headers, fields, messages and raw payloads', (): void => {
    const failure = normalizeFailure(
      new HttpErrorResponse({
        status: 422,
        headers: new HttpHeaders({ 'X-Request-ID': 'header-id', 'Set-Cookie': 'secret-cookie' }),
        error: {
          error: {
            code: 'validation_failed',
            message: 'password=secret',
            fields: { body: 'private draft text' },
          },
          request_id: 'body-id',
          csrf_token: 'secret-token',
          password: 'secret-password',
        },
      }),
    );
    expect(failure.requestIds).toEqual({ body: 'body-id', header: 'header-id' });
    const diagnostic = JSON.stringify(failureDiagnostic(failure));
    expect(diagnostic).toContain('body-id');
    expect(diagnostic).toContain('header-id');
    for (const privateValue of ['secret', 'private draft', 'Set-Cookie', 'fields', 'password']) {
      expect(diagnostic).not.toContain(privateValue);
    }
  });

  it('handles malformed/non-JSON bodies, unknown codes and local errors safely', (): void => {
    for (const error of [
      null,
      [],
      'html',
      { error: null },
      { error: { code: '__proto__' }, request_id: 'bad\nid' },
    ]) {
      const failure = normalizeFailure(new HttpErrorResponse({ status: 503, error }));
      expect(failure.kind).toBe('unavailable');
      expect(failure.code).toBeNull();
      expect(failure.requestIds.body).toBeUndefined();
    }
    expect(normalizeFailure(new Error('private URL/password')).kind).toBe('unexpected');
    expect(normalizeFailure(new Error('private URL/password')).message).not.toContain('private');
  });

  it('parses bounded numeric/HTTP-date hints without interpreting malformed values', (): void => {
    const now = Date.parse('2026-10-28T00:00:00Z');
    expect(retryDelay('2', now)).toBe(2000);
    expect(retryDelay('0', now)).toBe(0);
    expect(retryDelay('Wed, 28 Oct 2026 00:00:05 GMT', now)).toBe(5000);
    for (const value of [
      null,
      '',
      '-1',
      '1.5',
      'Infinity',
      '1,2',
      '99999999999999999999',
      'yesterday',
    ]) {
      expect(retryDelay(value, now)).toBeNull();
    }
    const response = new HttpErrorResponse({
      status: 503,
      headers: new HttpHeaders({ 'Retry-After': '1' }),
    });
    expect(normalizeFailure(response, now).retryAfterMs).toBe(1000);
  });
});
