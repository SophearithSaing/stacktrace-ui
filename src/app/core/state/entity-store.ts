import { Service, inject, linkedSignal } from '@angular/core';
import {
  AccountProfile,
  AccountSummary,
  FeedEntry,
  Post,
  PostViewer,
  Reply,
  ReplyPage,
} from '../api/models';
import { SessionContext } from '../session/session-context';

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
  readonly kind: 'events' | 'posts' | 'replies';
  readonly ids: readonly string[];
  readonly private: boolean;
}

interface EntitySnapshot {
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
  private readonly data = linkedSignal(this.resetForSession.bind(this));

  /**
   * Captures the session generation before starting viewer-sensitive work.
   * @returns Ticket required by every entity/membership commit.
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
  putPost(post: Post, generation: number): boolean {
    if (generation !== this.session.generation()) {
      return false;
    }
    const next = copySnapshot(this.data());
    this.ingestPost(next, post);
    this.data.set(next);
    return true;
  }

  /**
   * Stores event identity and canonical content separately from list membership.
   * @param events Server event representations.
   * @param generation Session ticket from request initiation.
   * @returns Whether the commit was accepted.
   */
  putEvents(events: readonly FeedEntry[], generation: number): boolean {
    if (generation !== this.session.generation()) {
      return false;
    }
    const next = copySnapshot(this.data());
    for (const event of events) {
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
  putProfile(profile: AccountProfile, generation: number): boolean {
    if (generation !== this.session.generation()) {
      return false;
    }
    const next = copySnapshot(this.data());
    const { viewer, ...account } = profile;
    this.ingestAccount(next, account);
    next.follows[profile.id] = viewer ? { ...viewer } : null;
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
  putReplies(postId: string, page: ReplyPage, generation: number): boolean {
    if (generation !== this.session.generation()) {
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
   * Stores ordered references only; cursor lifecycle belongs to collections.
   * @param key Collection-owned selection key.
   * @param membership Ordered references and privacy classification.
   * @param generation Session ticket from request initiation.
   * @returns Whether the commit was accepted.
   */
  putMembership(key: string, membership: EntityMembership, generation: number): boolean {
    if (generation !== this.session.generation()) {
      return false;
    }
    const next = copySnapshot(this.data());
    next.memberships[key] = { ...membership, ids: [...membership.ids] };
    this.data.set(next);
    return true;
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
   * Invalidates public representations and private data synchronously per epoch.
   * @returns Empty canonical state requiring fresh reads in the new session.
   */
  private resetForSession(): EntitySnapshot {
    this.session.generation();
    return {
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
    const { author, viewer, reply_preview, ...content } = structuredClone(post);
    this.ingestAccount(next, author);
    const ids: string[] = [];
    for (const reply of reply_preview.items) {
      this.ingestReply(next, reply);
      ids.push(reply.id);
    }
    next.posts[post.id] = {
      ...content,
      quote:
        content.quote?.availability === 'deleted'
          ? { id: content.quote.id, availability: 'deleted' }
          : content.quote,
      authorId: author.id,
      replyPreview: { ids, next_cursor: reply_preview.next_cursor },
    };
    next.postViewers[post.id] = viewer;
  }
}

/**
 * Copies map containers so pending normalization never mutates published state.
 * @param source Current canonical snapshot.
 * @returns Mutable containers for one atomic commit.
 */
function copySnapshot(source: EntitySnapshot): EntitySnapshot {
  return {
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
