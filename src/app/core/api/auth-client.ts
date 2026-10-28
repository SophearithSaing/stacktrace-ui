import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, defer, finalize, tap } from 'rxjs';
import { SessionContext } from '../session/session-context';
import { API_BASE_URL, apiUrl } from './config';
import { LoginRequest, Me, RegisterRequest } from './models';
import { serializeBody } from './serialization';

@Service()
export class AuthClient {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly session = inject(SessionContext);

  /**
   * Reads the optional session; stale cookies resolve as anonymous server-side.
   * @returns Session representation, or the original request error.
   */
  me(): Observable<Me> {
    return this.exchange('me');
  }

  /**
   * Registers an account and accepts the returned session.
   * @param input Registration credentials, sent without normalization.
   * @returns Server session representation.
   */
  register(input: RegisterRequest): Observable<Me> {
    return this.exchange('auth/register', serializeBody('register', input));
  }

  /**
   * Logs in and accepts the rotated session token.
   * @param input Login credentials, sent without normalization.
   * @returns Server session representation.
   */
  login(input: LoginRequest): Observable<Me> {
    return this.exchange('auth/login', serializeBody('login', input));
  }

  /**
   * Revokes the current session, clearing only after server confirmation.
   * @returns Completion without a JSON response body.
   */
  logout(): Observable<void> {
    return defer(
      /** @returns Guarded logout operation. */
      (): Observable<void> => {
        const generation = this.session.generation();
        return this.http.post<void>(apiUrl(this.base, 'auth/logout'), null).pipe(
          tap(
            /** Clears only the session that initiated logout. */
            (): void => {
              if (generation === this.session.generation()) {
                this.session.clear();
              }
            },
          ),
        );
      },
    );
  }

  /**
   * Runs a guarded session read or credential exchange on subscription.
   * @param path Client-owned session endpoint.
   * @param body Exact serialized JSON for credential exchanges.
   * @returns Session response without presentation mapping.
   */
  private exchange(path: string, body?: string): Observable<Me> {
    return defer(
      /** @returns Session request with stale-response protection. */
      (): Observable<Me> => {
        const generation = this.session.begin();
        const url = apiUrl(this.base, path);
        const request =
          body === undefined
            ? this.http.get<Me>(url)
            : this.http.post<Me>(url, body, {
                headers: { 'Content-Type': 'application/json' },
              });
        return request.pipe(
          tap({
            /**
             * Accepts a current server response.
             * @param value Account/token pair.
             */
            next: (value: Me): void => this.session.accept(value, generation),
            /**
             * Preserves a current failure as distinct from anonymous.
             * @param error Original HTTP failure.
             */
            error: (error: unknown): void => this.session.fail(error, generation),
          }),
          finalize(
            /** Clears an abandoned loading operation without restoring old credentials. */
            (): void => {
              if (generation === this.session.generation()) {
                this.session.clear();
              }
            },
          ),
        );
      },
    );
  }
}
