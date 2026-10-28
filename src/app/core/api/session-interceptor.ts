import { DOCUMENT } from '@angular/common';
import { HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { SessionContext } from '../session/session-context';
import { API_BASE_URL, apiUrl } from './config';

/**
 * Applies cookie credentials and session CSRF only inside the API destination.
 * @param req Outgoing HTTP request.
 * @param next Remaining HTTP chain.
 * @returns Request events, or a local missing-session failure.
 */
export function sessionInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  const document = inject(DOCUMENT);
  const origin = document.location.origin;
  const base = inject(API_BASE_URL);
  const root = new URL(apiUrl(base, 'me'), origin);
  const target = new URL(req.url, document.baseURI);
  if (
    target.origin !== root.origin ||
    target.username ||
    target.password ||
    !target.pathname.startsWith('/api/v1/')
  ) {
    return next(req);
  }
  const session = inject(SessionContext);
  const write = ['POST', 'PUT', 'DELETE'].includes(req.method);
  const publicAuth =
    req.method === 'POST' &&
    ['/api/v1/auth/login', '/api/v1/auth/register'].includes(target.pathname);
  let headers = req.headers.delete('X-CSRF-Token');
  if (write && !publicAuth) {
    const token = session.csrfToken();
    if (!token) {
      return throwError(missingSession);
    }
    headers = headers.set('X-CSRF-Token', token);
  }
  return next(req.clone({ withCredentials: true, headers }));
}

/**
 * Creates a local failure instead of attempting an unauthenticated write.
 * @returns Missing-session error, without credential details.
 */
function missingSession(): Error {
  return new Error('An authenticated API session is required');
}
