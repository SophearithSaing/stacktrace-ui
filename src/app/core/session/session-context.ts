import { Service, signal } from '@angular/core';
import { AccountSummary, Me } from '../api/models';

export type SessionState =
  | { status: 'uninitialized' | 'loading' | 'anonymous' }
  | { status: 'authenticated'; account: AccountSummary }
  | { status: 'failed'; error: unknown };

@Service()
export class SessionContext {
  private readonly current = signal<SessionState>({ status: 'uninitialized' });
  private readonly epoch = signal(0);
  private token: string | null = null;
  readonly state = this.current.asReadonly();
  readonly generation = this.epoch.asReadonly();

  /**
   * Invalidates viewer work and starts a guarded session operation.
   * @returns Generation ticket for this operation.
   */
  begin(): number {
    this.clear();
    this.current.set({ status: 'loading' });
    return this.epoch();
  }

  /**
   * Accepts an account/token pair only for the current operation.
   * @param session Server session representation.
   * @param generation Ticket captured before issuing the request.
   */
  accept(session: Me, generation: number): void {
    if (generation !== this.epoch()) {
      return;
    }
    if (session.account === null && session.csrf_token === null) {
      this.token = null;
      this.current.set({ status: 'anonymous' });
    } else if (session.account !== null && session.csrf_token) {
      this.token = session.csrf_token;
      this.current.set({ status: 'authenticated', account: session.account });
    } else {
      this.fail(new Error('Invalid session account/token pair'), generation);
      return;
    }
    this.epoch.update(increment);
  }

  /**
   * Records a failed read, never disguising it as an anonymous response.
   * @param error Original request failure.
   * @param generation Ticket captured before issuing the request.
   */
  fail(error: unknown, generation: number): void {
    if (generation === this.epoch()) {
      this.token = null;
      this.current.set({ status: 'failed', error });
      this.epoch.update(increment);
    }
  }

  /** Clears credentials and invalidates every outstanding session operation. */
  clear(): void {
    this.token = null;
    this.current.set({ status: 'uninitialized' });
    this.epoch.update(increment);
  }

  /**
   * Returns the current in-memory token only for an authenticated session.
   * @returns Current token, or null while anonymous, loading or failed.
   */
  csrfToken(): string | null {
    return this.token;
  }
}

/**
 * Advances a generation counter.
 * @param value Current generation.
 * @returns Next generation.
 */
function increment(value: number): number {
  return value + 1;
}
