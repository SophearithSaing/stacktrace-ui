import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EMPTY, Observable, Subject, finalize, of } from 'rxjs';
import { PostPage } from '../api/models';
import { account, post } from '../api/testing/http';
import { SessionContext } from '../session/session-context';
import { CollectionDefinition, CursorCollection, PageReferences } from './cursor-collection';
import { EntityStore } from './entity-store';
import { ReadBoundary, ReadTicket } from './read-boundary';

interface PendingRead {
  cursor: string | null;
  source: Subject<PostPage>;
  canceled: boolean;
}

describe('CursorCollection', (): void => {
  let entities: EntityStore;
  let reads: ReadBoundary;
  let session: SessionContext;
  let collection: CursorCollection<PostPage>;
  let pending: PendingRead[];

  beforeEach((): void => {
    entities = TestBed.inject(EntityStore);
    reads = TestBed.inject(ReadBoundary);
    session = TestBed.inject(SessionContext);
    collection = new CursorCollection<PostPage>(entities, reads);
    pending = [];
  });
  afterEach((): void => collection.dispose());

  function definition(key = 'posts'): CollectionDefinition<PostPage> {
    return {
      key,
      session: session.generation(),
      kind: 'posts',
      private: false,
      load: (cursor: string | null): Observable<PostPage> => {
        const request: PendingRead = { cursor, source: new Subject<PostPage>(), canceled: false };
        pending.push(request);
        return request.source.pipe(
          finalize((): void => {
            request.canceled = true;
          }),
        );
      },
      project: (page: PostPage): PageReferences => ({
        ids: page.items.map((item): string => item.id),
      }),
      commit: (page: PostPage, ticket: ReadTicket): boolean =>
        entities.putPosts(page.items, ticket),
    };
  }

  it('distinguishes unread, initial loading and successful empty exhaustion', (): void => {
    expect(collection.state()).toMatchObject({ phase: 'idle', empty: false, exhausted: false });
    collection.select(definition());
    expect(collection.state()).toMatchObject({ phase: 'loading', empty: false, ids: [] });
    expect(pending[0].cursor).toBeNull();
    pending[0].source.next({ items: [], next_cursor: null });
    expect(collection.state()).toMatchObject({ phase: 'ready', empty: true, exhausted: true });
    collection.loadMore();
    expect(pending).toHaveLength(1);
  });

  it('preserves opaque cursors and deduplicates by canonical row identity on append', (): void => {
    collection.select(definition());
    pending[0].source.next({ items: [post, post], next_cursor: '+/opaque=&' });
    expect(collection.state().ids).toEqual([post.id]);
    collection.loadMore();
    collection.loadMore();
    expect(pending).toHaveLength(2);
    expect(pending[1].cursor).toBe('+/opaque=&');
    expect(collection.state().phase).toBe('loading-more');
    pending[1].source.next({ items: [post, { ...post, id: 'second' }], next_cursor: null });
    expect(collection.state().ids).toEqual([post.id, 'second']);
    expect(collection.state().exhausted).toBe(true);
  });

  it('preserves loaded rows and failed page cursor on network failure, retrying once explicitly', (): void => {
    collection.select(definition());
    pending[0].source.next({ items: [post], next_cursor: 'continuation' });
    collection.loadMore();
    const failure = new HttpErrorResponse({ status: 0 });
    pending[1].source.error(failure);
    expect(collection.state()).toMatchObject({
      phase: 'error',
      error: 'network',
      stale: true,
      hasContent: true,
      empty: false,
      canRetry: true,
      ids: [post.id],
      nextCursor: 'continuation',
    });
    expect(collection.failure()).toBe(failure);
    expect(pending).toHaveLength(2);
    collection.retry();
    expect(pending[2].cursor).toBe('continuation');
    pending[2].source.next({ items: [post, { ...post, id: 'next' }], next_cursor: null });
    expect(collection.state().ids).toEqual([post.id, 'next']);
    expect(collection.state().error).toBeNull();
  });

  it('never treats an initial HTTP failure as empty success', (): void => {
    collection.select(definition());
    pending[0].source.error(new HttpErrorResponse({ status: 503 }));
    expect(collection.state()).toMatchObject({
      phase: 'error',
      empty: false,
      error: 'request',
      canRetry: true,
    });
    collection.retry();
    expect(pending[1].cursor).toBeNull();
    pending[1].source.next({ items: [], next_cursor: null });
    expect(collection.state().empty).toBe(true);
  });

  it('cancels obsolete selections and starts fresh chains even when revisiting a key', (): void => {
    collection.select(definition('A'));
    const oldKey = collection.state().membershipKey ?? '';
    collection.select(definition('B'));
    expect(pending[0].canceled).toBe(true);
    pending[0].source.next({ items: [{ ...post, body: 'Late A' }], next_cursor: 'A' });
    expect(entities.post(post.id)).toBeUndefined();
    pending[1].source.next({ items: [post], next_cursor: 'B' });
    expect(collection.state().ids).toEqual([post.id]);
    collection.select(definition('A'));
    expect(collection.state().ids).toEqual([]);
    expect(entities.membership(oldKey)?.ids).toEqual([]);
    expect(pending[2].cursor).toBeNull();
  });

  it('refresh cancels load-more and replaces rather than appends, preserving rows on refresh failure', (): void => {
    collection.select(definition());
    pending[0].source.next({ items: [post], next_cursor: 'old' });
    collection.loadMore();
    collection.refresh();
    expect(pending[1].canceled).toBe(true);
    expect(pending[2].cursor).toBeNull();
    expect(collection.state()).toMatchObject({ phase: 'refreshing', ids: [post.id] });
    pending[1].source.next({ items: [{ ...post, id: 'late-more' }], next_cursor: 'bad' });
    pending[2].source.error(new Error('refresh failed'));
    expect(collection.state()).toMatchObject({
      ids: [post.id],
      canLoadMore: false,
      canRetry: true,
    });
    collection.retry();
    expect(pending[3].cursor).toBeNull();
    pending[3].source.next({ items: [{ ...post, id: 'fresh' }], next_cursor: null });
    expect(collection.state().ids).toEqual(['fresh']);
    expect(entities.post('late-more')).toBeUndefined();
  });

  it('session transitions cancel synchronously, clear private references and reject old definitions', (): void => {
    const old = definition();
    collection.select(old);
    pending[0].source.next({ items: [post], next_cursor: 'viewer-A' });
    collection.loadMore();
    session.accept({ account, csrf_token: 'new' }, session.begin());
    expect(pending[1].canceled).toBe(true);
    expect(collection.state()).toMatchObject({
      phase: 'idle',
      ids: [],
      nextCursor: null,
      key: null,
    });
    expect(collection.select(old)).toBe(false);
    pending[1].source.next({ items: [{ ...post, body: 'Late viewer' }], next_cursor: null });
    expect(entities.post(post.id)).toBeUndefined();
    collection.select(definition());
    expect(pending[2].cursor).toBeNull();
  });

  it('blocks reads started before confirmed writes, invalidates cursors and allows a fresh read afterward', (): void => {
    collection.select(definition());
    pending[0].source.next({ items: [post], next_cursor: 'pre-write' });
    collection.loadMore();
    const before = reads.capture();
    reads.confirmMutation(before.session);
    entities.putPost({ ...post, body: 'Confirmed write' }, before.session);
    expect(pending[1].canceled).toBe(true);
    expect(collection.state()).toMatchObject({
      stale: true,
      ids: [post.id],
      nextCursor: null,
      canLoadMore: false,
      canRetry: true,
    });
    pending[1].source.next({ items: [post], next_cursor: 'stale' });
    expect(entities.putPosts([post], before)).toBe(false);
    expect(entities.post(post.id)?.body).toBe('Confirmed write');
    collection.retry();
    expect(pending[2].cursor).toBeNull();
    pending[2].source.next({ items: [{ ...post, body: 'Fresh after write' }], next_cursor: null });
    expect(entities.post(post.id)?.body).toBe('Fresh after write');
  });

  it('isolates independent owners of the same selection and releases references on disposal', (): void => {
    const other = new CursorCollection<PostPage>(entities, reads);
    try {
      collection.select(definition());
      other.select(definition());
      pending[0].source.next({ items: [post], next_cursor: 'first' });
      pending[1].source.next({ items: [{ ...post, id: 'other' }], next_cursor: 'second' });
      expect(collection.state().ids).toEqual([post.id]);
      expect(other.state().ids).toEqual(['other']);
      const key = other.state().membershipKey ?? '';
      other.dispose();
      expect(entities.membership(key)).toBeUndefined();
      expect(entities.post('other')).toBeDefined();
    } finally {
      other.dispose();
    }
  });

  it('handles synchronous/empty transports and rejects invalid response cursors without restarting', (): void => {
    collection.select({
      ...definition(),
      load: (): Observable<PostPage> => of({ items: [post], next_cursor: null }),
    });
    expect(collection.state().ids).toEqual([post.id]);
    collection.select({ ...definition(), load: (): Observable<PostPage> => EMPTY });
    expect(collection.state().phase).toBe('error');
    collection.select({
      ...definition(),
      load: (): Observable<PostPage> => {
        throw new Error('sync');
      },
    });
    expect(collection.state().phase).toBe('error');
    collection.select(definition());
    pending[0].source.next({ items: [post], next_cursor: '' });
    expect(collection.state().phase).toBe('error');
    expect(collection.state().ids).toEqual([]);
  });
});
