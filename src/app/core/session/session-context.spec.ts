import { TestBed } from '@angular/core/testing';
import { account } from '../api/testing/http';
import { SessionContext } from './session-context';

describe('SessionContext', (): void => {
  let session: SessionContext;
  beforeEach((): void => {
    session = TestBed.inject(SessionContext);
  });

  it('starts uninitialized, loading, then distinguishes anonymous from failed', (): void => {
    expect(session.state().status).toBe('uninitialized');
    const generation = session.begin();
    expect(session.state().status).toBe('loading');
    session.accept({ account: null, csrf_token: null }, generation);
    expect(session.state().status).toBe('anonymous');
    expect(session.csrfToken()).toBeNull();
    const failure = new Error('network');
    session.fail(failure, session.begin());
    expect(session.state()).toEqual({ status: 'failed', error: failure });
  });

  it('accepts and rotates tokens, advances generations and explicitly clears', (): void => {
    const before = session.generation();
    session.accept({ account, csrf_token: 'one' }, session.begin());
    expect(session.state()).toEqual({ status: 'authenticated', account });
    expect(session.csrfToken()).toBe('one');
    expect(session.generation()).toBeGreaterThan(before);
    session.accept({ account, csrf_token: 'two' }, session.begin());
    expect(session.csrfToken()).toBe('two');
    session.clear();
    expect(session.state().status).toBe('uninitialized');
    expect(session.csrfToken()).toBeNull();
  });

  it('rejects late success/failure after a newer operation or clear', (): void => {
    const stale = session.begin();
    session.accept({ account, csrf_token: 'new' }, session.begin());
    session.accept({ account: null, csrf_token: null }, stale);
    session.fail(new Error('late'), stale);
    expect(session.csrfToken()).toBe('new');
    const cleared = session.begin();
    session.clear();
    session.accept({ account, csrf_token: 'late' }, cleared);
    expect(session.csrfToken()).toBeNull();
  });

  it('does not authenticate mismatched account/token pairs', (): void => {
    session.accept({ account, csrf_token: null }, session.begin());
    expect(session.state().status).toBe('failed');
    session.accept({ account: null, csrf_token: 'secret' }, session.begin());
    expect(session.state().status).toBe('failed');
    expect(session.csrfToken()).toBeNull();
  });
});
