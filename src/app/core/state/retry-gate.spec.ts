import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { normalizeFailure } from '../api/failure';
import { RetryGate } from './retry-gate';

describe('RetryGate', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
  });
  afterEach((): void => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('opens only after the supplied cooldown without scheduling requests', (): void => {
    const gate = TestBed.inject(RetryGate);
    gate.note(
      normalizeFailure(
        new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': '3' }) }),
      ),
    );
    expect(gate.ready()).toBe(false);
    vi.advanceTimersByTime(2999);
    expect(gate.canStart()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(gate.ready()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses a bounded fallback for missing/invalid 429 hints and respects 503 hints', (): void => {
    const gate = TestBed.inject(RetryGate);
    for (const hint of ['', 'bad']) {
      gate.note(
        normalizeFailure(
          new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': hint }) }),
        ),
      );
      expect(gate.remainingMs()).toBe(1000);
      vi.advanceTimersByTime(1000);
      expect(gate.ready()).toBe(true);
    }
    gate.note(
      normalizeFailure(
        new HttpErrorResponse({ status: 503, headers: new HttpHeaders({ 'Retry-After': '1' }) }),
      ),
    );
    expect(gate.canStart()).toBe(false);
    vi.advanceTimersByTime(1000);
    gate.note(normalizeFailure(new HttpErrorResponse({ status: 503 })));
    expect(gate.canStart()).toBe(true);
  });

  it('never shortens a longer delay and chunks values beyond timer limits', (): void => {
    const gate = TestBed.inject(RetryGate);
    gate.note(
      normalizeFailure(
        new HttpErrorResponse({
          status: 429,
          headers: new HttpHeaders({ 'Retry-After': '3000000' }),
        }),
      ),
    );
    gate.note(
      normalizeFailure(
        new HttpErrorResponse({ status: 503, headers: new HttpHeaders({ 'Retry-After': '1' }) }),
      ),
    );
    vi.advanceTimersByTime(2147483647);
    expect(gate.canStart()).toBe(false);
    vi.advanceTimersByTime(3000000000 - 2147483647);
    expect(gate.canStart()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
