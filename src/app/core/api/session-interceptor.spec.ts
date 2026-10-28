import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HttpTestingController } from '@angular/common/http/testing';
import { SessionContext } from '../session/session-context';
import { authenticate, setupApi } from './testing/http';

describe('API session interceptor', (): void => {
  let client: HttpClient;
  let http: HttpTestingController;
  let session: SessionContext;
  beforeEach((): void => {
    ({ client, http, session } = setupApi());
  });
  afterEach((): void => http.verify());

  it('uses the browser document base when classifying unrelated relative URLs', (): void => {
    authenticate(session);
    const document = TestBed.inject(DOCUMENT);
    const spy = vi
      .spyOn(document, 'baseURI', 'get')
      .mockReturnValue(`${document.location.origin}/design-system/`);
    try {
      client.post('api/v1/specimen', {}).subscribe();
      const relative = http.expectOne('api/v1/specimen');
      expect(relative.request.withCredentials).toBe(false);
      expect(relative.request.headers.has('X-CSRF-Token')).toBe(false);
      relative.flush({});
      client.post('/api/v1/posts', {}).subscribe();
      const api = http.expectOne('/api/v1/posts');
      expect(api.request.headers.get('X-CSRF-Token')).toBe('current-token');
      api.flush({});
    } finally {
      spy.mockRestore();
    }
  });

  it.each(['POST', 'PUT', 'DELETE'])(
    'sets one current CSRF token on %s',
    (method: string): void => {
      authenticate(session);
      const headers = new HttpHeaders()
        .append('X-CSRF-Token', 'old')
        .append('X-CSRF-Token', 'duplicate');
      client.request(method, '/api/v1/posts/id', { headers }).subscribe();
      const first = http.expectOne('/api/v1/posts/id');
      expect(first.request.withCredentials).toBe(true);
      expect(first.request.headers.getAll('X-CSRF-Token')).toEqual(['current-token']);
      expect(first.request.headers.has('Origin')).toBe(false);
      expect(first.request.headers.has('Cookie')).toBe(false);
      first.flush({});
      authenticate(session, 'rotated');
      client.request(method, '/api/v1/posts/id').subscribe();
      const second = http.expectOne('/api/v1/posts/id');
      expect(second.request.headers.getAll('X-CSRF-Token')).toEqual(['rotated']);
      second.flush({});
    },
  );

  it.each(['/api/v1/feed', '/api/v1/me'])('excludes CSRF on reads of %s', (url: string): void => {
    authenticate(session);
    client.get(url, { headers: { 'X-CSRF-Token': 'stale' } }).subscribe();
    const request = http.expectOne(url);
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('X-CSRF-Token')).toBe(false);
    request.flush({});
  });

  it.each(['login', 'register'])(
    'permits public auth %s without a session or CSRF',
    (path: string): void => {
      const url = `/api/v1/auth/${path}`;
      client.post(url, {}, { headers: { 'X-CSRF-Token': 'stale' } }).subscribe();
      const request = http.expectOne(url);
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.headers.has('X-CSRF-Token')).toBe(false);
      request.flush({});
    },
  );

  it('fails closed on authenticated writes with no current session', (): void => {
    let failure: unknown;
    client.post('/api/v1/posts', {}).subscribe({
      error: (error: unknown): void => {
        failure = error;
      },
    });
    expect(failure).toBeInstanceOf(Error);
    http.expectNone('/api/v1/posts');
  });

  it.each([
    '/assets/icon.svg',
    '/design-system',
    '/api/v10/posts',
    'https://other.test/api/v1/posts',
    'https://example.test/api/v1/posts',
  ])('does not add credentials or CSRF to unrelated %s', (url: string): void => {
    authenticate(session);
    client.post(url, {}).subscribe();
    const request = http.expectOne(url);
    expect(request.request.withCredentials).toBe(false);
    expect(request.request.headers.has('X-CSRF-Token')).toBe(false);
    request.flush({});
  });
});

describe('configured API origin', (): void => {
  it('scopes credentials/CSRF to the configured origin, not the UI origin', (): void => {
    const { client, http, session } = setupApi('https://backend.test');
    authenticate(session);
    client.put('https://backend.test/api/v1/posts/id/bookmark', null).subscribe();
    const api = http.expectOne('https://backend.test/api/v1/posts/id/bookmark');
    expect(api.request.withCredentials).toBe(true);
    expect(api.request.headers.getAll('X-CSRF-Token')).toEqual(['current-token']);
    api.flush({});
    client.put('/api/v1/posts/id/bookmark', null).subscribe();
    const other = http.expectOne('/api/v1/posts/id/bookmark');
    expect(other.request.withCredentials).toBe(false);
    expect(other.request.headers.has('X-CSRF-Token')).toBe(false);
    other.flush({});
    http.verify();
  });
});
