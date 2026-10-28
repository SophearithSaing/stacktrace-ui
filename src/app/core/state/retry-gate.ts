import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { ApiFailure } from '../api/failure';

@Service()
export class RetryGate {
  private readonly deadline = signal(0);
  private readonly clock = signal(Date.now());
  private timer: ReturnType<typeof setTimeout> | null = null;
  readonly ready = computed(this.isReady.bind(this));

  /** Registers timer cleanup without initiating any requests. */
  constructor() {
    inject(DestroyRef).onDestroy(this.cancelTimer.bind(this));
  }

  /**
   * Checks the real clock even if a background-tab timer has been delayed.
   * @returns Whether an explicit API attempt may begin.
   */
  canStart(): boolean {
    return Date.now() >= this.deadline();
  }

  /**
   * Reports the remaining cooldown without storing request payloads.
   * @returns Nonnegative remaining milliseconds.
   */
  remainingMs(): number {
    this.clock();
    return Math.max(0, this.deadline() - Date.now());
  }

  /**
   * Respects rate/service delays, never shortening an existing cooldown.
   * Missing/invalid 429 hints use a one-second fallback, not an automatic retry.
   * @param failure Safe normalized failure.
   */
  note(failure: ApiFailure): void {
    const delay =
      failure.status === 429
        ? (failure.retryAfterMs ?? 1000)
        : failure.status === 503
          ? (failure.retryAfterMs ?? 0)
          : 0;
    if (delay > 0) {
      this.deadline.set(Math.max(this.deadline(), Date.now() + delay));
      this.clock.set(Date.now());
      this.arm();
    }
  }

  /**
   * Projects reactive readiness; clock wakes only at deadline/chunk boundaries.
   * @returns Whether the global cooldown has expired.
   */
  private isReady(): boolean {
    this.clock();
    return this.canStart();
  }

  /** Schedules one bounded timer chunk, never a network attempt. */
  private arm(): void {
    this.cancelTimer();
    this.timer = setTimeout(this.wake.bind(this), Math.min(this.remainingMs(), 2147483647));
  }

  /** Updates view readiness and handles long delays without truncating them. */
  private wake(): void {
    this.timer = null;
    this.clock.set(Date.now());
    if (!this.canStart()) {
      this.arm();
    }
  }

  /** Clears an owned timer on replacement or injector destruction. */
  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
