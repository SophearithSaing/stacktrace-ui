import { Service, inject, linkedSignal } from '@angular/core';
import {
  AccountProfile,
  AccountSummary,
  FeedEntry,
  Post,
  PostViewer,
  Reply,
  ReplyPage,
  ReplyCreated,
  RepostResult,
} from '../api/models';
import { SessionContext } from '../session/session-context';
import { ReadBoundary, ReadTicket } from './read-boundary';

type AccountEntity = AccountSummary | Omit<AccountProfile, 'viewer'>;
type PostEntity = Omit<Post, 'author' | 'viewer' | 'reply_preview'> & {
  authorId: string;
  replyPreview: { ids: string[]; next_cursor: string | null };
};
type ReplyEntity = Omit<Reply, 'author'> & { authorId: string };
type EventEntity = Omit<FeedEntry, 'post' | 'reposter'> & {
  postId: string;
  reposterId: string | null;
};

export interface EntityMembership {
  readonly kind: 'events' | 'posts' | 'replies' | 'accounts';
  readonly purpose?: 'bookmarks' | 'suggestions';
  readonly ids: readonly string[];
  readonly private: boolean;
  readonly snippets?: Readonly<Record<string, string>>;
}

interface EntitySnapshot {
  deletedPosts: Set<string>;
  deletedReplies: Set<string>;
  accounts: Record<string, AccountEntity>;
  posts: Record<string, PostEntity>;
  replies: Record<string, ReplyEntity>;
  events: Record<string, EventEntity>;
  postViewers: Record<string, PostViewer | null>;
  follows: Record<string, AccountProfile['viewer']>;
  memberships: Record<string, EntityMembership>;
}

@Service()
export class EntityStore {
  private readonly session = inject(SessionContext);
  private readonly reads = inject(ReadBoundary);
  private readonly data = linkedSignal(this.resetForSession.bind(this));

  /**
   * Captures session ownership for commands. Reads use ReadBoundary.capture.
   * @returns Command session generation, not a read/mutation ticket.
   */
  captureGeneration(): number {
    return this.session.generation();
  }

  /**
   * Stores a complete post, never a quote preview as a canonical post.
   * @param post Complete server representation.
   * @param generation Session ticket from request initiation.
   * @returns Whether the commit was accepted.
   */
  putPost(post: Post, generation: number | ReadTicket): boolean {
    return this.putPosts([post], generation);
  }

  /**
   * Atomically commits complete posts from bookmarks or search results.
   * @param posts Complete server representations.
   * @param generation Session generation for commands, or guarded read ticket.
   * @returns Whether the commit was accepted.
   */
  putPosts(posts: readonly Post[], generation: number | ReadTicket): boolean {
    if (!this.accepts(generation)) {
      return false;
    }
    const next = copySnapshot(this.data());
    for (const post of posts) {
      this.ingestPost(next, post);
    }
    this.data.set(next);
    return true;
  }

  /**
   * Stores event identity and canonical content separately from list membership.
   * @param events Server event representations.
   * @param generation Session ticket from request initiation.
   * @returns Whether the commit was accepted.
   */
  putEvents(events: readonly FeedEntry[], generation: number | ReadTicket): boolean {
    if (!this.accepts(generation)) {
      return false;
    }
    const next = copySnapshot(this.data());
    for (const event of events) {
      if (next.deletedPosts.has(event.post.id)) {
        continue;
      }
      this.ingestPost(next, event.post);
      if (event.reposter) {
        this.ingestAccount(next, event.reposter);
      }
      next.events[event.id] = {
        id: event.id,
        kind: event.kind,
        occurred_at: event.occurred_at,
        postId: event.post.id,
        reposterId: event.reposter?.id ?? null,
      };
    }
    this.data.set(next);
    return true;
  }

  /**
   * Stores a full profile and separates viewer-bound relationship data.
   * @param profile Complete server profile.
   * @param generation Session ticket from request initiation.
   * @returns Whether the commit was accepted.
   */
  putProfile(profile: AccountProfile, generation: number | ReadTicket): boolean {
    if (!this.accepts(generation)) {
      return false;
    }
    const next = copySnapshot(this.data());
    const { viewer, ...account } = profile;
    this.ingestAccount(next, account);
    next.follows[profile.id] = viewer ? { ...viewer } : null;
    if (viewer?.following) {
      this.removeReferences(next, 'accounts', new Set([profile.id]), 'suggestions');
    }
    this.data.set(next);
    return true;
  }

  /**
   * Stores reply entities and the authoritative total, not preview length.
   * @param postId Parent post UUID.
   * @param page Server reply page.
   * @param generation Session ticket from request initiation.
   * @returns Whether the commit was accepted.
   */
  putReplies(postId: string, page: ReplyPage, generation: number | ReadTicket): boolean {
    if (!this.accepts(generation)) {
      return false;
    }
    const next = copySnapshot(this.data());
    for (const reply of page.items) {
      this.ingestReply(next, reply);
    }
    const post = next.posts[postId];
    if (post) {
      next.posts[postId] = { ...post, counts: { ...post.counts, replies: page.total_count } };
    }
    this.data.set(next);
    return true;
  }

  /**
   * Reconciles a confirmed post and authoritative private bookmark membership.
   * @param post Complete confirmed representation.
   * @param generation Command session ownership.
   */
  reconcilePost(post: Post, generation: number): void {
    if (!this.accepts(generation)) {
      return;
    }
    const next = copySnapshot(this.data());
    this.ingestPost(next, post);
    if (post.viewer && !post.viewer.bookmarked) {
      this.removeReferences(next, 'posts', new Set([post.id]), 'bookmarks');
    }
    this.data.set(next);
  }

  /**
   * Stores a confirmed reply and server total without guessing preview ordering.
   * @param result Created reply and authoritative total.
   * @param generation Command session ownership.
   */
  reconcileReply(result: ReplyCreated, generation: number): void {
    this.putReplies(
      result.reply.post_id,
      {
        items: [result.reply],
        total_count: result.reply_total,
        next_cursor: null,
      },
      generation,
    );
  }

  /**
   * Keeps the returned repost event identity/time, removing only this viewer's old event.
   * @param result Confirmed post and nullable repost event metadata.
   * @param reposter Current account, independent of visual theme.
   * @param generation Command session ownership.
   */
  reconcileRepost(result: RepostResult, reposter: AccountSummary, generation: number): void {
    if (!this.accepts(generation)) {
      return;
    }
    const next = copySnapshot(this.data());
    this.ingestPost(next, result.post);
    if (result.post.viewer && !result.post.viewer.bookmarked) {
      this.removeReferences(next, 'posts', new Set([result.post.id]), 'bookmarks');
    }
    this.ingestAccount(next, reposter);
    const removed = new Set<string>();
    for (const event of Object.values(next.events)) {
      if (
        event.kind === 'repost' &&
        event.postId === result.post.id &&
        event.reposterId === reposter.id &&
        event.id !== result.repost_entry_id
      ) {
        removed.add(event.id);
        delete next.events[event.id];
      }
    }
    this.removeReferences(next, 'events', removed);
    if (
      !next.deletedPosts.has(result.post.id) &&
      result.repost_entry_id &&
      result.repost_occurred_at
    ) {
      next.events[result.repost_entry_id] = {
        id: result.repost_entry_id,
        kind: 'repost',
        occurred_at: result.repost_occurred_at,
        postId: result.post.id,
        reposterId: reposter.id,
      };
    }
    this.data.set(next);
  }

  /**
   * Removes deleted content and every cached quote's author/body immediately.
   * Tombstones prevent overlapping command responses from restoring deleted previews.
   * @param postId Deleted canonical post ID.
   * @param generation Command session ownership.
   */
  deletePost(postId: string, generation: number): void {
    if (!this.accepts(generation)) {
      return;
    }
    const next = copySnapshot(this.data());
    next.deletedPosts.add(postId);
    delete next.posts[postId];
    delete next.postViewers[postId];
    const events = new Set<string>();
    const replies = new Set<string>();
    for (const event of Object.values(next.events)) {
      if (event.postId === postId) {
        events.add(event.id);
        delete next.events[event.id];
      }
    }
    for (const reply of Object.values(next.replies)) {
      if (reply.post_id === postId) {
        replies.add(reply.id);
        delete next.replies[reply.id];
      }
    }
    for (const post of Object.values(next.posts)) {
      if (post.quote?.id === postId) {
        next.posts[post.id] = { ...post, quote: { id: postId, availability: 'deleted' } };
      }
    }
    this.removeReferences(next, 'posts', new Set([postId]));
    this.removeReferences(next, 'events', events);
    this.removeReferences(next, 'replies', replies);
    this.data.set(next);
  }

  /**
   * Removes a reply and invalidates parent counts because 204 supplies no total.
   * @param replyId Deleted canonical reply ID.
   * @param generation Command session ownership.
   */
  deleteReply(replyId: string, generation: number): void {
    if (!this.accepts(generation)) {
      return;
    }
    const next = copySnapshot(this.data());
    next.deletedReplies.add(replyId);
    const reply = next.replies[replyId];
    delete next.replies[replyId];
    if (reply) {
      delete next.posts[reply.post_id];
      delete next.postViewers[reply.post_id];
    }
    this.removeReferences(next, 'replies', new Set([replyId]));
    this.data.set(next);
  }

  /**
   * Stores ordered references only; cursor lifecycle belongs to collections.
   * @param key Collection-owned selection key.
   * @param membership Ordered references and privacy classification.
   * @param generation Session ticket from request initiation.
   * @returns Whether the commit was accepted.
   */
  putMembership(
    key: string,
    membership: EntityMembership,
    generation: number | ReadTicket,
  ): boolean {
    if (!this.accepts(generation)) {
      return false;
    }
    const next = copySnapshot(this.data());
    next.memberships[key] = structuredClone(membership);
    this.data.set(next);
    return true;
  }

  /**
   * Releases membership references when their owning collection is replaced.
   * @param key Collection-owned key.
   * @param ticket Current read boundary.
   */
  removeMembership(key: string, ticket: ReadTicket): void {
    if (this.accepts(ticket)) {
      const next = copySnapshot(this.data());
      delete next.memberships[key];
      this.data.set(next);
    }
  }

  /**
   * Reads ordered collection references in the current session only.
   * @param key Collection-owned selection key.
   * @returns Detached membership, if loaded.
   */
  membership(key: string): EntityMembership | undefined {
    const value = this.data().memberships[key];
    return value ? structuredClone(value) : undefined;
  }

  /**
   * Reads canonical account metadata without inventing missing profile fields.
   * @param id Account UUID.
   * @returns Detached account summary or full public profile.
   */
  account(id: string): AccountEntity | undefined {
    const value = this.data().accounts[id];
    return value ? structuredClone(value) : undefined;
  }

  /**
   * Rehydrates a full profile only when it has actually been loaded.
   * @param id Account UUID.
   * @returns Profile with current viewer state, or undefined for a summary.
   */
  profile(id: string): AccountProfile | undefined {
    const value = this.account(id);
    return value && 'bio' in value
      ? structuredClone({ ...value, viewer: this.data().follows[id] ?? null })
      : undefined;
  }

  /**
   * Projects a reply using the latest canonical author metadata.
   * @param id Reply UUID.
   * @returns Detached complete reply when available.
   */
  reply(id: string): Reply | undefined {
    const value = this.data().replies[id];
    if (!value) {
      return undefined;
    }
    const { authorId, ...reply } = value;
    const author = this.account(authorId);
    return author ? { ...reply, author } : undefined;
  }

  /**
   * Projects a post with current viewer data and bounded reply preview references.
   * @param id Post UUID.
   * @returns Detached complete representation, never an upgraded quote preview.
   */
  post(id: string): Post | undefined {
    const value = this.data().posts[id];
    if (!value) {
      return undefined;
    }
    const { authorId, replyPreview, ...post } = value;
    const author = this.account(authorId);
    if (!author) {
      return undefined;
    }
    const items: Reply[] = [];
    for (const replyId of replyPreview.ids) {
      const reply = this.reply(replyId);
      if (reply) {
        items.push(reply);
      }
    }
    return structuredClone({
      ...post,
      author,
      viewer: this.data().postViewers[id] ?? null,
      reply_preview: { items, next_cursor: replyPreview.next_cursor },
    });
  }

  /**
   * Projects an event without collapsing two events that share a post.
   * @param id Feed event ID, not the post UUID.
   * @returns Event with its original metadata and latest canonical post.
   */
  event(id: string): FeedEntry | undefined {
    const value = this.data().events[id];
    if (!value) {
      return undefined;
    }
    const { postId, reposterId, ...event } = value;
    const post = this.post(postId);
    const reposter = reposterId ? this.account(reposterId) : null;
    return post ? { ...event, post, reposter: reposter ?? null } : undefined;
  }

  /**
   * Checks command session tickets and stronger read/mutation tickets.
   * @param ticket Session generation or captured read boundary.
   * @returns Whether the caller can commit in the current epoch.
   */
  private accepts(ticket: number | ReadTicket): boolean {
    return typeof ticket === 'number'
      ? ticket === this.session.generation()
      : this.reads.isCurrent(ticket);
  }

  /**
   * Invalidates public representations and private data synchronously per epoch.
   * @returns Empty canonical state requiring fresh reads in the new session.
   */
  private resetForSession(): EntitySnapshot {
    this.session.generation();
    return {
      deletedPosts: new Set(),
      deletedReplies: new Set(),
      accounts: dictionary<AccountEntity>(),
      posts: dictionary<PostEntity>(),
      replies: dictionary<ReplyEntity>(),
      events: dictionary<EventEntity>(),
      postViewers: dictionary<PostViewer | null>(),
      follows: dictionary<AccountProfile['viewer']>(),
      memberships: dictionary<EntityMembership>(),
    };
  }

  /**
   * Merges a summary without losing previously loaded profile fields.
   * @param next Mutable copy for the pending commit.
   * @param account Public account metadata.
   */
  private ingestAccount(next: EntitySnapshot, account: AccountEntity): void {
    next.accounts[account.id] = { ...next.accounts[account.id], ...account };
  }

  /**
   * Normalizes a complete reply and its account.
   * @param next Mutable copy for the pending commit.
   * @param reply Complete server reply.
   */
  private ingestReply(next: EntitySnapshot, reply: Reply): void {
    if (next.deletedReplies.has(reply.id) || next.deletedPosts.has(reply.post_id)) {
      return;
    }
    const { author, ...content } = reply;
    this.ingestAccount(next, author);
    next.replies[reply.id] = { ...content, authorId: author.id };
  }

  /**
   * Normalizes a complete post; quote content stays bounded and isolated.
   * @param next Mutable copy for the pending commit.
   * @param post Complete server post, not a quote preview.
   */
  private ingestPost(next: EntitySnapshot, post: Post): void {
    if (next.deletedPosts.has(post.id)) {
      return;
    }
    const { author, viewer, reply_preview, ...content } = structuredClone(post);
    this.ingestAccount(next, author);
    const ids: string[] = [];
    for (const reply of reply_preview.items) {
      this.ingestReply(next, reply);
      if (!next.deletedReplies.has(reply.id)) {
        ids.push(reply.id);
      }
    }
    next.posts[post.id] = {
      ...content,
      quote:
        content.quote &&
        (content.quote.availability === 'deleted' || next.deletedPosts.has(content.quote.id))
          ? { id: content.quote.id, availability: 'deleted' }
          : content.quote,
      authorId: author.id,
      replyPreview: { ids, next_cursor: reply_preview.next_cursor },
    };
    next.postViewers[post.id] = viewer;
  }

  /**
   * Removes authoritative membership changes without guessing list ordering.
   * @param next Pending snapshot.
   * @param kind Membership identity kind.
   * @param ids Confirmed removed IDs.
   * @param purpose Optional endpoint classification.
   */
  private removeReferences(
    next: EntitySnapshot,
    kind: EntityMembership['kind'],
    ids: ReadonlySet<string>,
    purpose?: EntityMembership['purpose'],
  ): void {
    for (const [key, membership] of Object.entries(next.memberships)) {
      if (membership.kind !== kind || (purpose && membership.purpose !== purpose)) {
        continue;
      }
      const remaining: string[] = [];
      const snippets: Record<string, string> = {};
      for (const id of membership.ids) {
        if (!ids.has(id)) {
          remaining.push(id);
          if (membership.snippets?.[id] !== undefined) {
            snippets[id] = membership.snippets[id];
          }
        }
      }
      next.memberships[key] = {
        ...membership,
        ids: remaining,
        ...(membership.snippets ? { snippets } : {}),
      };
    }
  }
}

/**
 * Copies map containers so pending normalization never mutates published state.
 * @param source Current canonical snapshot.
 * @returns Mutable containers for one atomic commit.
 */
function copySnapshot(source: EntitySnapshot): EntitySnapshot {
  return {
    deletedPosts: new Set(source.deletedPosts),
    deletedReplies: new Set(source.deletedReplies),
    accounts: dictionary(source.accounts),
    posts: dictionary(source.posts),
    replies: dictionary(source.replies),
    events: dictionary(source.events),
    postViewers: dictionary(source.postViewers),
    follows: dictionary(source.follows),
    memberships: dictionary(source.memberships),
  };
}

/**
 * Builds a dictionary without inherited keys or prototype setters.
 * @param source Optional values to copy.
 * @returns A safe string-keyed map container.
 */
function dictionary<T>(source: Record<string, T> = {}): Record<string, T> {
  const result: Record<string, T> = {};
  Object.setPrototypeOf(result, null);
  return Object.assign(result, source);
}
