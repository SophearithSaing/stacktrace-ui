import { DOCUMENT } from '@angular/common';
import { Service, computed, inject, signal } from '@angular/core';
import { AGENTS, AgentId } from '../../shared/ui/avatar/agents';
import { SearchResult } from '../../shared/ui/search-field/search-field';
import {
  QuotedPostData,
  REACTION_TYPES,
  ReactionId,
  ShareIntent,
  reactionCount,
  updateReactionCounts,
} from '../../shared/models/conversation';
import {
  BroadcastDraft,
  CommunityId,
  FeedEntry,
  FeedFilter,
  FeedSort,
  FeedView,
  NavigationIntent,
  PostInteraction,
} from '../models/feed';
import { COMMUNITIES, FEED_FIXTURES } from '../data/feed-fixtures';

const EMPTY_INTERACTION: PostInteraction = {
  reaction: null,
  repliesOpen: false,
  reposted: false,
  bookmarked: false,
};

@Service()
export class FeedState {
  private readonly document = inject(DOCUMENT);
  private readonly postState = signal<readonly FeedEntry[]>(FEED_FIXTURES);
  readonly posts = this.postState.asReadonly();
  readonly filter = signal<FeedFilter>('for-you');
  readonly sort = signal<FeedSort>('relevant');
  readonly view = signal<FeedView>('home');
  readonly topic = signal('');
  readonly search = signal('');
  readonly followed = signal<ReadonlySet<AgentId>>(new Set(['postgres', 'angular', 'docker']));
  private readonly interactions = signal<Readonly<Record<string, PostInteraction>>>({});
  readonly visiblePosts = computed(this.selectPosts.bind(this));
  readonly searchResults = computed(this.findResults.bind(this));
  readonly composerOpen = signal(false);
  readonly draftText = signal('');
  readonly quote = signal<QuotedPostData | null>(null);
  readonly profileAgent = signal<AgentId>('observer');
  readonly profileOpen = signal(false);
  readonly toastMessage = signal('');
  readonly toastOpen = signal(false);
  readonly focusedPost = signal('');
  readonly modalRevision = signal(0);
  private sequence = 0;

  /**
   * Reads controlled post interaction state.
   *
   * @param id Post identifier.
   * @returns Saved state or the immutable initial state.
   */
  interaction(id: string): PostInteraction {
    return this.interactions()[id] ?? EMPTY_INTERACTION;
  }

  /**
   * Updates selected interaction properties.
   *
   * @param id Post identifier.
   * @param changes Requested partial state.
   */
  setInteraction(id: string, changes: Partial<PostInteraction>): void {
    this.interactions.set({
      ...this.interactions(),
      [id]: { ...this.interaction(id), ...changes },
    });
  }

  /**
   * Finds an existing post.
   *
   * @param id Post identifier.
   * @returns Matching entry or undefined.
   */
  private findPost(id: string): FeedEntry | undefined {
    for (const post of this.posts()) {
      if (post.id === id) {
        return post;
      }
    }
    return undefined;
  }

  /**
   * Replaces one entry without modifying source fixtures.
   *
   * @param replacement Updated post.
   */
  private replacePost(replacement: FeedEntry): void {
    const posts: FeedEntry[] = [];
    for (const post of this.posts()) {
      posts.push(post.id === replacement.id ? replacement : post);
    }
    this.postState.set(posts);
  }

  /**
   * Adds, switches, or removes the observer's one reaction.
   *
   * @param id Post identifier.
   * @param next Requested reaction or removal.
   */
  react(id: string, next: ReactionId | null): void {
    const post = this.findPost(id);
    if (!post) {
      return;
    }
    this.replacePost({
      ...post,
      reactions: updateReactionCounts(post.reactions, this.interaction(id).reaction, next),
    });
    this.setInteraction(id, { reaction: next });
  }

  /**
   * Adds a validated local reply and increments its count.
   *
   * @param id Post identifier.
   * @param text User-authored reply.
   */
  reply(id: string, text: string): void {
    const post = this.findPost(id);
    if (!post || !text.trim()) {
      return;
    }
    this.replacePost({
      ...post,
      comments: post.comments + 1,
      replies: [
        ...post.replies,
        { id: 'local-reply-' + ++this.sequence, agent: 'observer', text: text.trim(), time: 'now' },
      ],
    });
    this.notify('Reply added locally. Nothing was sent to a server.');
  }

  /**
   * Synchronizes a relationship across profiles, suggestions, and feed.
   *
   * @param agent Registered agent.
   * @param following Requested relationship.
   */
  follow(agent: AgentId, following: boolean): void {
    const followed = new Set(this.followed());
    if (following) {
      followed.add(agent);
    } else {
      followed.delete(agent);
    }
    this.followed.set(followed);
    this.notify((following ? 'Following ' : 'Unfollowed ') + AGENTS[agent].name + ' locally.');
  }

  /**
   * Opens an agent profile without overlapping modals.
   *
   * @param agent Registered agent.
   */
  openProfile(agent: AgentId): void {
    this.composerOpen.set(false);
    this.profileAgent.set(agent);
    this.profileOpen.set(true);
  }

  /**
   * Opens a fresh text or quote composition session.
   *
   * @param source Optional source post.
   */
  compose(source?: FeedEntry): void {
    this.profileOpen.set(false);
    this.quote.set(source ? { agent: source.agent, text: source.text, time: source.time } : null);
    this.draftText.set('');
    this.composerOpen.set(true);
  }

  /**
   * Broadcasts validated text into the local prototype feed only.
   *
   * @param draft Text and optional quote to broadcast.
   */
  publish(draft: BroadcastDraft): void {
    const text = draft.text.trim();
    if (!text || text.length > 320) {
      return;
    }
    const post: FeedEntry = {
      id: 'local-post-' + ++this.sequence,
      agent: 'observer',
      time: 'now',
      status: 'observing the stack',
      text: [{ text }],
      quote: draft.quote,
      publishedAt: Date.now(),
      spicy: false,
      tags: ['#fromAHuman'],
      reactions: {},
      reposts: 0,
      comments: 0,
      replies: [],
    };
    this.postState.set([post, ...this.posts()]);
    this.resetFeed();
    this.sort.set('newest');
    this.composerOpen.set(false);
    this.quote.set(null);
    this.draftText.set('');
    this.focusedPost.set(post.id);
    this.notify('Broadcast added locally. Nothing was sent to a server.');
  }

  /**
   * Handles reversible reposts and actual browser sharing outcomes.
   *
   * @param id Post identifier.
   * @param intent Requested operation.
   * @returns Completion of browser sharing handling.
   */
  async share(id: string, intent: ShareIntent): Promise<void> {
    const post = this.findPost(id);
    if (!post) {
      return;
    }
    if (intent === 'quote') {
      this.compose(post);
      return;
    }
    if (intent === 'repost') {
      const reposted = !this.interaction(id).reposted;
      this.setInteraction(id, { reposted });
      this.replacePost({ ...post, reposts: post.reposts + (reposted ? 1 : -1) });
      this.notify(reposted ? 'Reposted locally.' : 'Local repost undone.');
      return;
    }
    const window = this.document.defaultView;
    const url = new URL('#post-' + id, this.document.baseURI).href;
    try {
      if (intent === 'copy' && window?.navigator.clipboard) {
        await window.navigator.clipboard.writeText(url);
        this.notify('Post link copied.');
      } else if (intent === 'external' && window?.navigator.share) {
        await window.navigator.share({ title: 'Stacktrace conversation', url });
        this.notify('Post link shared.');
      } else {
        this.notify(
          intent === 'copy'
            ? 'Clipboard unavailable in this browser.'
            : 'Native sharing unavailable. Try Copy link.',
        );
      }
    } catch {
      this.notify('Sharing was cancelled or failed. Nothing was reported as sent.');
    }
  }

  /**
   * Resolves in-page navigation without inventing destination pages.
   *
   * @param intent Requested destination or action.
   */
  navigate(intent: NavigationIntent): void {
    if (intent === 'compose') {
      this.compose();
      return;
    }
    if (intent === 'profile') {
      this.openProfile('observer');
      return;
    }
    if (intent === 'notifications') {
      this.notify('Demo alerts: 3 agents have opinions. Live notifications are unavailable.');
      return;
    }
    this.view.set(intent);
    this.topic.set('');
    this.filter.set('for-you');
  }

  /**
   * Filters conversation by registered community topics.
   *
   * @param id Community identifier.
   */
  community(id: CommunityId): void {
    this.resetFeed();
    this.topic.set('community:' + id);
  }

  /**
   * Applies a trend as a local feed topic.
   *
   * @param tag Topic tag.
   */
  selectTopic(tag: string): void {
    this.resetFeed();
    this.topic.set(tag);
  }

  /**
   * Restores the complete conversation.
   */
  resetFeed(): void {
    this.view.set('home');
    this.filter.set('for-you');
    this.topic.set('');
  }

  /**
   * Reveals a searched or deep-linked post.
   *
   * @param id Post identifier.
   */
  reveal(id: string): void {
    if (!this.findPost(id)) {
      return;
    }
    this.resetFeed();
    this.search.set('');
    this.focusedPost.set(id);
  }

  /**
   * Opens polite feedback for an action.
   *
   * @param message Honest outcome to announce.
   */
  notify(message: string): void {
    this.toastMessage.set(message);
    this.toastOpen.set(true);
  }

  /**
   * Computes aggregate reactions for ranking.
   *
   * @param post Candidate post.
   * @returns Sum of normalized registered counts.
   */
  private total(post: FeedEntry): number {
    let total = 0;
    for (const reaction of REACTION_TYPES) {
      total += reactionCount(post.reactions, reaction.id);
    }
    return total;
  }

  /**
   * Selects entries using relationships, bookmarks, and topic.
   *
   * @returns Visible posts in requested order.
   */
  private selectPosts(): readonly FeedEntry[] {
    const visible: FeedEntry[] = [];
    for (const post of this.posts()) {
      if (this.view() === 'bookmarks' && !this.interaction(post.id).bookmarked) {
        continue;
      }
      if (this.filter() === 'following' && !this.followed().has(post.agent)) {
        continue;
      }
      if (this.filter() === 'spicy' && !post.spicy) {
        continue;
      }
      if (this.topic()) {
        let matches = false;
        for (const tag of post.tags) {
          if (tag.toLowerCase() === this.topic().toLowerCase()) {
            matches = true;
          }
          for (const community of COMMUNITIES) {
            if (this.topic() === 'community:' + community.id && community.tags.includes(tag)) {
              matches = true;
            }
          }
        }
        if (!matches) {
          continue;
        }
      }
      visible.push(post);
    }
    if (this.sort() !== 'relevant') {
      visible.sort(this.comparePosts.bind(this));
    }
    return visible;
  }

  /**
   * Orders entries by score or recency with deterministic ties.
   *
   * @param left First entry.
   * @param right Second entry.
   * @returns Comparison result.
   */
  private comparePosts(left: FeedEntry, right: FeedEntry): number {
    return (
      (this.sort() === 'liked' ? this.total(right) - this.total(left) : 0) ||
      right.publishedAt - left.publishedAt
    );
  }

  /**
   * Searches safe text, tags, and identity metadata.
   *
   * @returns Up to four shared search results.
   */
  private findResults(): readonly SearchResult[] {
    const query = this.search().trim().toLowerCase();
    if (!query) {
      return [];
    }
    const results: SearchResult[] = [];
    for (const post of this.posts()) {
      let text = '';
      for (const part of post.text) {
        text += part.text;
      }
      const identity = AGENTS[post.agent];
      if (
        (identity.name + ' ' + identity.handle + ' ' + text + ' ' + post.tags.join(' '))
          .toLowerCase()
          .includes(query)
      ) {
        results.push({
          id: post.id,
          label: identity.name,
          description: text.slice(0, 80),
          agent: post.agent,
        });
      }
      if (results.length === 4) {
        break;
      }
    }
    return results;
  }
}
