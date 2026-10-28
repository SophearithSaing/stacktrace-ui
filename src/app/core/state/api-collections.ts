import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ContentClient } from '../api/content-client';
import { DiscoveryClient } from '../api/discovery-client';
import { FeedPage, Post, PostPage, ReplyPage, SearchItem, SearchPage } from '../api/models';
import {
  FeedQuery,
  PageQuery,
  RepliesQuery,
  SearchQuery,
  serializeQuery,
} from '../api/serialization';
import { SessionContext } from '../session/session-context';
import {
  CollectionDefinition,
  CursorCollection,
  CursorResult,
  PageReferences,
} from './cursor-collection';
import { EntityStore } from './entity-store';
import { ReadBoundary, ReadTicket } from './read-boundary';
import { RetryGate } from './retry-gate';

@Service()
export class ApiCollections {
  private readonly content = inject(ContentClient);
  private readonly discovery = inject(DiscoveryClient);
  private readonly entities = inject(EntityStore);
  private readonly reads = inject(ReadBoundary);
  private readonly session = inject(SessionContext);
  private readonly retry = inject(RetryGate);

  /**
   * Creates an owned chain; the caller must dispose it when its container closes.
   * @param definition Validated endpoint-specific selection.
   * @returns Collection with its first read or valid preview seed started.
   */
  create<P extends CursorResult>(definition: CollectionDefinition<P>): CursorCollection<P> {
    const collection = new CursorCollection<P>(this.entities, this.reads, this.retry);
    collection.select(definition);
    return collection;
  }

  /**
   * Builds a feed selection without accepting an externally supplied cursor.
   * @param query Documented selection and page size.
   * @returns Viewer/view/sort/tag-bound event definition.
   */
  feed(query: Omit<FeedQuery, 'cursor'> = {}): CollectionDefinition<FeedPage> {
    const selection: FeedQuery = {
      view: query.view || 'for-you',
      sort: query.sort || 'newest',
      tag: query.tag || undefined,
      limit: query.limit ?? 20,
    };
    serializeQuery('feed', selection);
    return {
      ...this.scope('feed', [
        selection.view,
        selection.sort,
        selection.tag ?? null,
        selection.limit,
      ]),
      kind: 'events',
      private: false,
      project: eventReferences,
      /**
       * Requests exactly the selected feed chain.
       * @param cursor Opaque continuation, or null for the first page.
       * @returns Server feed page.
       */
      load: (cursor: string | null): Observable<FeedPage> =>
        this.content.feed({ ...selection, cursor: cursor ?? undefined }),
      /**
       * Commits canonical events under the captured read boundary.
       * @param page Server feed page.
       * @param ticket Request read ticket.
       * @returns Whether entities were accepted.
       */
      commit: (page: FeedPage, ticket: ReadTicket): boolean =>
        this.entities.putEvents(page.items, ticket),
    };
  }

  /**
   * Builds a normalized viewer/query-bound search chain without feed sorts/tags.
   * @param query Search text and page size only.
   * @returns Canonical post references with collection-local plain-text snippets.
   */
  search(query: Omit<SearchQuery, 'cursor'>): CollectionDefinition<SearchPage> {
    const params = serializeQuery('search', { q: query.q, limit: query.limit });
    const selection = { q: params.get('q') ?? '', limit: query.limit ?? 4 };
    return {
      ...this.scope('search', [selection.q, selection.limit]),
      kind: 'posts',
      private: false,
      project: searchReferences,
      /**
       * Requests only search-supported parameters.
       * @param cursor Opaque search continuation.
       * @returns Server search page.
       */
      load: (cursor: string | null): Observable<SearchPage> =>
        this.discovery.search({ ...selection, cursor: cursor ?? undefined }),
      /**
       * Stores complete posts, keeping excerpts out of canonical bodies.
       * @param page Server search page.
       * @param ticket Request read ticket.
       * @returns Whether entities were accepted.
       */
      commit: (page: SearchPage, ticket: ReadTicket): boolean =>
        this.entities.putPosts(page.items.map(searchPost), ticket),
    };
  }

  /**
   * Builds the private viewer-bound bookmark chain.
   * @param query Page size only, never an external continuation.
   * @returns Bookmark selection without unsupported sort/tag queries.
   */
  bookmarks(query: Omit<PageQuery, 'cursor'> = {}): CollectionDefinition<PostPage> {
    const limit = query.limit ?? 20;
    serializeQuery('bookmarks', { limit });
    return {
      ...this.scope('bookmarks', [limit]),
      purpose: 'bookmarks',
      kind: 'posts',
      private: true,
      project: postReferences,
      /**
       * Requests the viewer's bookmark page.
       * @param cursor Viewer-bound opaque continuation.
       * @returns Server post page.
       */
      load: (cursor: string | null): Observable<PostPage> =>
        this.content.bookmarks({ limit, cursor: cursor ?? undefined }),
      /**
       * Commits complete bookmarked posts.
       * @param page Server bookmark page.
       * @param ticket Request read ticket.
       * @returns Whether entities were accepted.
       */
      commit: (page: PostPage, ticket: ReadTicket): boolean =>
        this.entities.putPosts(page.items, ticket),
    };
  }

  /**
   * Builds an account activity chain bound to the viewer and target account.
   * @param accountId Target canonical account ID.
   * @param query Supported page size only.
   * @returns Account event definition.
   */
  accountFeed(
    accountId: string,
    query: Omit<PageQuery, 'cursor'> = {},
  ): CollectionDefinition<FeedPage> {
    const limit = query.limit ?? 20;
    serializeQuery('accountFeed', { limit });
    return {
      ...this.scope('account-feed', [accountId, limit]),
      kind: 'events',
      private: false,
      project: eventReferences,
      /**
       * Requests the target account's events.
       * @param cursor Endpoint/target/viewer-bound continuation.
       * @returns Server feed event page.
       */
      load: (cursor: string | null): Observable<FeedPage> =>
        this.content.accountFeed(accountId, { limit, cursor: cursor ?? undefined }),
      /**
       * Stores distinct events and their canonical posts.
       * @param page Server event page.
       * @param ticket Request read ticket.
       * @returns Whether entities were accepted.
       */
      commit: (page: FeedPage, ticket: ReadTicket): boolean =>
        this.entities.putEvents(page.items, ticket),
    };
  }

  /**
   * Builds a post/sort-specific reply chain; only oldest may seed a preview.
   * @param postId Parent post ID.
   * @param query Reply sort and page size only.
   * @param preview Optional post preview with its original read provenance.
   * @returns Reply definition with a safe oldest seed, or a fresh read.
   */
  replies(
    postId: string,
    query: Omit<RepliesQuery, 'cursor'> = {},
    preview?: { post: Post; ticket: ReadTicket },
  ): CollectionDefinition<ReplyPage> {
    const sort = query.sort || 'oldest';
    const limit = query.limit ?? 20;
    serializeQuery('replies', { sort, limit });
    if (preview && preview.post.id !== postId) {
      throw new Error('Reply preview belongs to a different post');
    }
    const seed =
      sort === 'oldest' && preview && this.reads.isCurrent(preview.ticket)
        ? {
            page: { ...preview.post.reply_preview, total_count: preview.post.counts.replies },
            ticket: preview.ticket,
          }
        : undefined;
    return {
      ...this.scope('replies', [postId, sort, limit], false),
      kind: 'replies',
      private: false,
      project: replyReferences,
      seed,
      /**
       * Requests replies in the selected ordering, never a foreign preview cursor.
       * @param cursor Reply-order-bound continuation.
       * @returns Authoritative reply page.
       */
      load: (cursor: string | null): Observable<ReplyPage> =>
        this.content.replies(postId, { sort, limit, cursor: cursor ?? undefined }),
      /**
       * Stores complete replies and the authoritative current total.
       * @param page Server reply page.
       * @param ticket Request read ticket.
       * @returns Whether entities were accepted.
       */
      commit: (page: ReplyPage, ticket: ReadTicket): boolean =>
        this.entities.putReplies(postId, page, ticket),
    };
  }

  /**
   * Makes endpoint-specific keys without mixing opaque cursors into selection.
   * @param endpoint Endpoint discriminator.
   * @param selection Canonical documented selection values.
   * @param viewerBound Whether server cursors depend on the viewer.
   * @returns Stable selection key and separate session ownership.
   */
  private scope(
    endpoint: string,
    selection: readonly unknown[],
    viewerBound = true,
  ): { key: string; session: number } {
    const session = this.session.generation();
    const state = this.session.state();
    const viewer = state.status === 'authenticated' ? state.account.id : null;
    return {
      session,
      key: JSON.stringify(
        viewerBound ? [endpoint, session, viewer, ...selection] : [endpoint, ...selection],
      ),
    };
  }
}

/**
 * Extracts canonical item IDs without interpreting their values.
 * @param item Resource or feed event with its own identity.
 * @returns Item's documented identity.
 */
function itemId(item: { id: string }): string {
  return item.id;
}

/**
 * Projects event references, not post IDs.
 * @param page Server feed page.
 * @returns Ordered event IDs.
 */
function eventReferences(page: FeedPage): PageReferences {
  return { ids: page.items.map(itemId) };
}

/**
 * Projects canonical post references.
 * @param page Server post page.
 * @returns Ordered post IDs.
 */
function postReferences(page: PostPage): PageReferences {
  return { ids: page.items.map(itemId) };
}

/**
 * Projects canonical reply references.
 * @param page Server reply page.
 * @returns Ordered reply IDs.
 */
function replyReferences(page: ReplyPage): PageReferences {
  return { ids: page.items.map(itemId) };
}

/**
 * Selects a complete post from a search result, never its excerpt.
 * @param item Server search item.
 * @returns Complete canonical post.
 */
function searchPost(item: SearchItem): Post {
  return item.post;
}

/**
 * Keeps search-specific snippets on membership rather than canonical posts.
 * @param page Server search page.
 * @returns Ordered post IDs and per-query snippets.
 */
function searchReferences(page: SearchPage): PageReferences {
  const snippets: Record<string, string> = {};
  const ids: string[] = [];
  for (const item of page.items) {
    ids.push(item.post.id);
    snippets[item.post.id] = item.snippet;
  }
  return { ids, snippets };
}
