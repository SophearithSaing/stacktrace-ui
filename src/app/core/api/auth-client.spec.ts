import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionContext } from '../session/session-context';
import { AuthClient } from './auth-client';
import { Me } from './models';
import { account, authenticate, setupApi } from './testing/http';

describe('AuthClient', (): void => {
  let auth: AuthClient;
  let http: HttpTestingController;
  let session: SessionContext;
  beforeEach((): void => {
    ({ http, session } = setupApi());
    auth = TestBed.inject(AuthClient);
  });
  afterEach((): void => http.verify());

  it('reads anonymous/stale sessions without converting network failures to anonymous', (): void => {
    auth.me().subscribe();
    expect(session.state().status).toBe('loading');
    const request = http.expectOne('/api/v1/me');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ account: null, csrf_token: null } satisfies Me);
    expect(session.state().status).toBe('anonymous');
    let failure: unknown;
    auth.me().subscribe({
      error: (error: unknown): void => {
        failure = error;
      },
    });
    http.expectOne('/api/v1/me').error(new ProgressEvent('error'));
    expect(failure).toBeInstanceOf(HttpErrorResponse);
    expect(session.state()).toEqual({ status: 'failed', error: failure });
  });

  it('registers/logs in with exact JSON, accepting rotated tokens', (): void => {
    auth
      .register({ username: ' Alice ', password: '  secret  ', display_name: ' Alice ' })
      .subscribe();
    const registered = http.expectOne('/api/v1/auth/register');
    expect(registered.request.method).toBe('POST');
    expect(registered.request.headers.has('X-CSRF-Token')).toBe(false);
    expect(registered.request.headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(registered.request.body)).toEqual({
      username: ' Alice ',
      password: '  secret  ',
      display_name: ' Alice ',
    });
    registered.flush({ account, csrf_token: 'registered' });
    expect(session.csrfToken()).toBe('registered');
    auth.login({ username: 'Alice', password: ' exact ' }).subscribe();
    const login = http.expectOne('/api/v1/auth/login');
    expect(login.request.headers.has('X-CSRF-Token')).toBe(false);
    expect(JSON.parse(login.request.body).password).toBe(' exact ');
    login.flush({ account, csrf_token: 'rotated' });
    expect(session.csrfToken()).toBe('rotated');
  });

  it('guards old /me and login results against newer sessions and explicit clears', (): void => {
    auth.me().subscribe();
    const old = http.expectOne('/api/v1/me');
    auth.login({ username: 'new', password: 'password' }).subscribe();
    http.expectOne('/api/v1/auth/login').flush({ account, csrf_token: 'new' });
    old.flush({ account: null, csrf_token: null });
    expect(session.csrfToken()).toBe('new');
    auth.me().subscribe();
    session.clear();
    http.expectOne('/api/v1/me').flush({ account, csrf_token: 'late' });
    expect(session.csrfToken()).toBeNull();
  });

  it('clears canceled loading and does not initiate traffic on injection', (): void => {
    http.expectNone('/api/v1/me');
    const subscription = auth.me().subscribe();
    const request = http.expectOne('/api/v1/me');
    subscription.unsubscribe();
    expect(request.cancelled).toBe(true);
    expect(session.state().status).toBe('uninitialized');
  });

  it('confirms logout with 204, preserving a newer session against late logout', (): void => {
    authenticate(session);
    auth.logout().subscribe();
    const old = http.expectOne('/api/v1/auth/logout');
    expect(old.request.body).toBeNull();
    expect(old.request.headers.get('X-CSRF-Token')).toBe('current-token');
    authenticate(session, 'new');
    old.flush(null, { status: 204, statusText: 'No Content' });
    expect(session.csrfToken()).toBe('new');
    auth.logout().subscribe();
    http.expectOne('/api/v1/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    expect(session.csrfToken()).toBeNull();
  });

  it('does not clear or replay logout on 403', (): void => {
    authenticate(session);
    auth.logout().subscribe({ error: (): void => undefined });
    http
      .expectOne('/api/v1/auth/logout')
      .flush({ error: { code: 'forbidden' } }, { status: 403, statusText: 'Forbidden' });
    expect(session.csrfToken()).toBe('current-token');
    http.expectNone('/api/v1/auth/logout');
  });
});
