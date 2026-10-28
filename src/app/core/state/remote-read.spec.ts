import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { SessionContext } from '../session/session-context';
import { ReadBoundary, ReadTicket } from './read-boundary';
import { RetryGate } from './retry-gate';
import { RemoteRead } from './remote-read';

describe('RemoteRead', (): void => {
  it('cancels obsolete identity/session reads and retains stale content only for the same resource', (): void => {
    const reads = TestBed.inject(ReadBoundary);
    const session = TestBed.inject(SessionContext);
    const read = new RemoteRead<string, string>(reads, TestBed.inject(RetryGate));
    const first = new Subject<string>();
    const second = new Subject<string>();
    const commit = vi.fn((value: string, _ticket: ReadTicket): string => value);
    read.select({ key: 'A', load: (): Observable<string> => first, commit });
    read.select({ key: 'B', load: (): Observable<string> => second, commit });
    expect(first.observed).toBe(false);
    first.next('late A');
    second.next('B');
    expect(read.value()).toBe('B');
    read.reload();
    expect(read.value()).toBe('B');
    second.error(new HttpErrorResponse({ status: 503 }));
    expect(read.view(true)).toMatchObject({ stale: true, error: 'request', canRetry: true });
    session.clear();
    expect(read.value()).toBeNull();
    expect(read.view(false).phase).toBe('idle');
    read.dispose();
  });

  it('enforces Retry-After and mutation generations without automatic retry', (): void => {
    vi.useFakeTimers();
    const reads = TestBed.inject(ReadBoundary);
    const read = new RemoteRead<string, string>(reads, TestBed.inject(RetryGate));
    let calls = 0;
    const source = new Subject<string>();
    try {
      read.select({
        key: 'A',
        load: (): Observable<string> => {
          calls += 1;
          return source;
        },
        commit: (value: string): string => value,
      });
      source.error(
        new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': '2' }) }),
      );
      expect(read.view(false).canRetry).toBe(false);
      read.reload();
      expect(calls).toBe(1);
      vi.advanceTimersByTime(2000);
      expect(read.view(false).canRetry).toBe(true);
      expect(calls).toBe(1);
      reads.confirmMutation(reads.capture().session);
      expect(read.view(false).stale).toBe(true);
    } finally {
      read.dispose();
      TestBed.resetTestingModule();
      vi.useRealTimers();
    }
  });
});
