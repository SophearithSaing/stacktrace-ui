import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { AsyncViewState } from '../../shared/models/async-state';
import {
  PostData,
  QuotedPostData,
  ReactionId,
  ShareIntent,
  ReplyData,
} from '../../shared/models/conversation';
import { AccountIdentity } from '../../shared/models/identity';
import { SearchResult } from '../../shared/ui/search-field/search-field';
import { toIdentity, toPost, toProfile, toReply } from '../adapters/conversation';
import { AuthClient } from '../api/auth-client';
import { ContentClient } from '../api/content-client';
import { DiscoveryClient } from '../api/discovery-client';
import { ApiFailure, normalizeFailure } from '../api/failure';
import {
  AccountProfile,
  FeedPage,
  Post,
  PostPage,
  ReplyCreated,
  ReplyPage,
  SuggestedAgents,
  Trends,
  Trend as WireTrend,
} from '../api/models';
import {
  BroadcastDraft,
  CommunityId,
  FeedFilter,
  FeedSort,
  FeedView,
  NavigationIntent,
  PostInteraction,
  Trend,
  SuggestedAccount,
} from '../models/feed';
import { SessionContext } from '../session/session-context';
import { ApiCollections } from './api-collections';
import { CommandResult } from './command-executor';
import { CursorCollection } from './cursor-collection';
import { EntityStore } from './entity-store';
import { Mutations } from './mutations';
import { ReadBoundary, ReadTicket } from './read-boundary';
import { RemoteRead } from './remote-read';
import { RetryGate } from './retry-gate';

export interface ProductRow {
  readonly rowId: string;
  readonly postId: string;
  readonly post: PostData;
}

interface Submission<T> {
  readonly signature: string;
  readonly operation: Observable<CommandResult<T>>;
}

const IDLE: AsyncViewState = {
  phase: 'idle',
  hasContent: false,
  empty: false,
  stale: false,
  error: null,
  canRetry: false,
  canLoadMore: false,
};

/** Product-only scope. Documentation never provides or injects this facade. */
@Injectable()
export class ProductState {
  private readonly document = inject(DOCUMENT);
  private readonly session = inject(SessionContext);
  private readonly auth = inject(AuthClient);
  private readonly content = inject(ContentClient);
  private readonly discovery = inject(DiscoveryClient);
  private readonly api = inject(ApiCollections);
  private readonly entities = inject(EntityStore);
  private readonly reads = inject(ReadBoundary);
  private readonly gate = inject(RetryGate);
  private readonly mutations = inject(Mutations);
  private readonly lifetime = new Subscription();
  private restore: Subscription | null = null;
  private readonly started = signal(false);
  private readonly main = signal<CursorCollection<FeedPage> | CursorCollection<PostPage> | null>(
    null,
  );
  private mainKind: 'events' | 'posts' = 'events';
  private readonly searchList = signal<CursorCollection<import('../api/models').SearchPage> | null>(
    null,
  );
  private readonly threads = signal<ReadonlyMap<string, CursorCollection<ReplyPage>>>(new Map());
  private readonly replyValues = signal<ReadonlyMap<string, string>>(new Map());
  private readonly openThreads = signal<ReadonlySet<string>>(new Set());
  private readonly submissions = new Map<string, Submission<ReplyCreated>>();
  private postSubmission: Submission<Post> | null = null;
  private readonly detail = new RemoteRead<Post, string>(this.reads, this.gate);
  private readonly profileRead = new RemoteRead<AccountProfile, string>(this.reads, this.gate);
  private readonly trendRead = new RemoteRead<Trends, readonly WireTrend[]>(this.reads, this.gate);
  private readonly suggestionRead = new RemoteRead<SuggestedAgents, boolean>(this.reads, this.gate);
  readonly filter = signal<FeedFilter>('for-you');
  readonly sort = signal<FeedSort>('newest');
  readonly view = signal<FeedView>('home');
  readonly topic = signal('');
  readonly search = signal('');
  readonly composerOpen = signal(false);
  readonly draftText = signal('');
  private readonly quoteId = signal<string | null>(null);
  readonly quote = computed(this.composerQuote.bind(this));
  readonly profileAgent = signal('');
  readonly profileOpen = signal(false);
  readonly focusedPost = signal('');
  readonly revealedId = signal<string | null>(null);
  readonly linkError = signal('');
  readonly modalRevision = signal(0);
  readonly toastMessage = signal('');
  readonly toastOpen = signal(false);
  readonly authenticated = computed(this.isAuthenticated.bind(this));
  readonly viewer = computed(this.viewerIdentity.bind(this));
  readonly writeReady = computed(this.canWrite.bind(this));
  readonly rows = computed(this.projectRows.bind(this));
  readonly searchResults = computed(this.projectSearch.bind(this));
  readonly profile = computed(this.projectProfile.bind(this));
  readonly trends = computed(this.projectTrends.bind(this));
  readonly suggestions = computed(this.projectSuggestions.bind(this));
  readonly sessionView = computed(this.sessionFeedback.bind(this));
  readonly feedView = computed(this.feedFeedback.bind(this));
  readonly searchView = computed(this.searchFeedback.bind(this));
  readonly detailView = computed(this.detailFeedback.bind(this));
  readonly profileView = computed(this.profileFeedback.bind(this));
  readonly trendsView = computed(this.trendFeedback.bind(this));
  readonly suggestionsView = computed(this.suggestionFeedback.bind(this));

  /** Registers scoped selection watchers without performing work in documentation. */
  constructor() {
    effect(this.watchFeed.bind(this));
    effect(this.watchSearch.bind(this));
    effect(this.watchDetail.bind(this));
    effect(this.watchDiscovery.bind(this));
    effect(this.watchProfileVisibility.bind(this));
    this.lifetime.add(this.session.generationChanges.subscribe(this.clearViewerContext.bind(this)));
    inject(DestroyRef).onDestroy(this.destroy.bind(this));
  }

  /** Begins optional session restoration once the real product shell mounts. */
  start(): void {
    if (!this.started()) {
      this.started.set(true);
      this.restoreSession();
    }
  }

  /** Restores the optional cookie session explicitly, never turning failure into anonymous success. */
  restoreSession(): void {
    if (!this.gate.canStart()) {
      this.notify('Please wait before restoring your session.');
      return;
    }
    this.restore?.unsubscribe();
    this.restore = this.auth.me().subscribe({
      /**
       * Reports safe session feedback and cooldown without exposing raw bodies.
       * @param error Original session read failure.
       */
      error: (error: unknown): void => {
        const failure = normalizeFailure(error);
        this.gate.note(failure);
        this.notify(failure.message);
      },
    });
  }

  /**
   * Handles existing navigation without inventing unsupported destinations.
   * @param intent Existing in-page intent.
   */
  navigate(intent: NavigationIntent): void {
    if (intent === 'compose') {
      this.compose();
      return;
    }
    if (intent === 'profile') {
      const viewer = this.viewer();
      if (viewer) {
        this.openProfile(viewer.id);
      } else {
        this.notify('No active account. Restore your session to continue.');
      }
      return;
    }
    if (intent === 'notifications' || intent === 'communities') {
      this.notify('This feature is not available from the API.');
      return;
    }
    this.view.set(intent);
    this.topic.set('');
    this.filter.set('for-you');
    this.revealedId.set(null);
    this.detail.clear();
    this.linkError.set('');
  }

  /**
   * Rejects unsupported multi-tag community filtering honestly.
   * @param _id Existing community control's reference key.
   */
  community(_id: CommunityId): void {
    this.notify('Community filtering is not supported. Choose one trend topic instead.');
  }

  /**
   * Chooses exactly one documented API tag.
   * @param slug Server trend slug.
   */
  selectTopic(slug: string): void {
    const topic = slug.replace(/^#/, '');
    if (!/^[A-Za-z0-9_]{1,64}$/.test(topic)) {
      this.notify('This topic cannot be filtered by the API.');
      return;
    }
    this.resetFeed();
    this.topic.set(topic);
  }

  /** Returns to the public first-page feed, leaving drafts intact. */
  resetFeed(): void {
    this.view.set('home');
    this.filter.set('for-you');
    this.topic.set('');
    this.revealedId.set(null);
    this.detail.clear();
    this.linkError.set('');
  }

  /**
   * Resolves canonical post links even when the current feed has never loaded them.
   * @param id UUID from a link or selected remote search result.
   */
  reveal(id: string): void {
    this.resetFeed();
    this.search.set('');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      this.linkError.set('This post link is invalid.');
      return;
    }
    this.revealedId.set(id.toLowerCase());
  }

  /**
   * Opens composition with canonical quote identity, preserving an existing draft.
   * @param source Optional complete source post from the canonical store.
   */
  compose(source?: PostData): void {
    if (!this.requireWrite()) {
      return;
    }
    if (this.creationPending()) {
      this.notify('Your previous submission is still pending.');
      return;
    }
    this.profileOpen.set(false);
    if (source) {
      this.quoteId.set(source.id);
    }
    this.composerOpen.set(true);
  }

  /**
   * Captures/reuses the exact logical text/quote submission without resetting failed drafts.
   * @param draft Existing composer output.
   */
  publish(draft: BroadcastDraft): void {
    if (!this.requireWrite() || this.creationPending()) {
      return;
    }
    const quoteId = draft.quote?.id;
    const signature = JSON.stringify([draft.text, quoteId ?? null]);
    if (this.postSubmission?.signature !== signature) {
      this.postSubmission = {
        signature,
        operation: this.mutations.createPost(
          { body: draft.text, ...(quoteId ? { quoted_post_id: quoteId } : {}) },
          this.newKey(),
        ),
      };
    }
    this.lifetime.add(
      this.postSubmission.operation.subscribe({
        /**
         * Clears only the confirmed draft and focuses the canonical saved post.
         * @param result Guarded creation outcome.
         */
        next: (result: CommandResult<Post>): void => {
          if (result.status !== 'confirmed') {
            this.reportOutcome(result);
            return;
          }
          if (JSON.stringify([this.draftText(), this.quote()?.id ?? null]) === signature) {
            this.draftText.set('');
            this.quoteId.set(null);
            this.composerOpen.set(false);
            this.postSubmission = null;
          }
          this.sort.set('newest');
          this.reveal(result.value.id);
          this.focusedPost.set(result.value.id);
          this.notify('Post saved.');
        },
      }),
    );
  }

  /**
   * Reads controlled viewer state from the authoritative canonical post.
   * @param postId Canonical post ID, never a feed event ID.
   * @returns Current viewer interaction and local thread visibility.
   */
  interaction(postId: string): PostInteraction {
    const viewer = this.entities.post(postId)?.viewer;
    return {
      reaction: viewer?.reaction ?? null,
      bookmarked: viewer?.bookmarked ?? false,
      reposted: viewer?.reposted ?? false,
      repliesOpen: this.openThreads().has(postId),
    };
  }

  /**
   * Opens a fresh reply-order chain instead of minting provenance for an old preview.
   * @param postId Canonical parent post ID.
   * @param open Desired expansion.
   */
  openReplies(postId: string, open: boolean): void {
    const opened = new Set(this.openThreads());
    if (open) {
      opened.add(postId);
      if (!this.threads().has(postId)) {
        const next = new Map(this.threads());
        next.set(postId, this.api.create(this.api.replies(postId)));
        this.threads.set(next);
      }
    } else {
      opened.delete(postId);
      this.threads().get(postId)?.dispose();
      const next = new Map(this.threads());
      next.delete(postId);
      this.threads.set(next);
    }
    this.openThreads.set(opened);
  }

  /**
   * Reads the session-bound draft independently of thread rendering.
   * @param postId Parent post ID.
   * @returns Current unsent reply text.
   */
  replyDraft(postId: string): string {
    return this.replyValues().get(postId) ?? '';
  }

  /**
   * Stores a caller-owned draft without changing a captured uncertain submission.
   * @param postId Parent post ID.
   * @param value Edited reply text.
   */
  setReplyDraft(postId: string, value: string): void {
    const next = new Map(this.replyValues());
    next.set(postId, value);
    this.replyValues.set(next);
  }

  /**
   * Sends a guarded reply with a stable logical retry key and preserved text.
   * @param postId Parent post ID.
   * @param text Exact draft text.
   */
  reply(postId: string, text: string): void {
    if (!this.requireWrite() || this.postPending(postId)) {
      return;
    }
    let submission = this.submissions.get(postId);
    if (submission?.signature !== text) {
      submission = {
        signature: text,
        operation: this.mutations.createReply(postId, { body: text }, this.newKey()),
      };
      this.submissions.set(postId, submission);
    }
    this.lifetime.add(
      submission.operation.subscribe({
        /**
         * Clears only the exact confirmed reply draft; failures preserve it.
         * @param result Guarded reply outcome.
         */
        next: (result: CommandResult<ReplyCreated>): void => {
          if (result.status === 'confirmed') {
            if (this.replyDraft(postId) === text) {
              this.setReplyDraft(postId, '');
            }
            this.submissions.delete(postId);
            this.notify('Reply saved.');
          } else {
            this.reportOutcome(result);
          }
        },
      }),
    );
  }

  /**
   * Requests server-confirmed reaction state.
   * @param id Canonical post ID.
   * @param kind Desired reaction, or removal.
   */
  react(id: string, kind: ReactionId | null): void {
    if (this.requireWrite()) {
      this.observe(this.mutations.reaction(id, kind));
    }
  }

  /**
   * Requests server-confirmed private bookmark state.
   * @param id Canonical post ID.
   * @param saved Desired bookmark presence.
   */
  bookmark(id: string, saved: boolean): void {
    if (this.requireWrite()) {
      this.observe(this.mutations.bookmark(id, saved));
    }
  }

  /**
   * Requests server-confirmed follow state by canonical account ID.
   * @param id Account ID, never a visual key.
   * @param following Desired relationship.
   */
  follow(id: string, following: boolean): void {
    if (this.requireWrite()) {
      this.observe(this.mutations.follow(id, following));
    }
  }

  /**
   * Opens a guarded remote profile, including identities absent from the feed.
   * @param id Canonical account ID.
   */
  openProfile(id: string): void {
    if (!this.sessionReady()) {
      this.notify('Restore your session before opening profiles.');
      return;
    }
    this.composerOpen.set(false);
    this.profileAgent.set(id);
    this.profileOpen.set(true);
    this.profileRead.select({
      key: id,
      /** @returns Full server profile. */
      load: (): Observable<AccountProfile> => this.content.profile(id),
      /**
       * Stores complete metadata once and projects by canonical ID.
       * @param profile Server profile.
       * @param ticket Read ownership.
       * @returns Canonical account ID.
       */
      commit: (profile: AccountProfile, ticket: ReadTicket): string => {
        this.entities.putProfile(profile, ticket);
        return profile.id;
      },
    });
  }

  /**
   * Handles writes separately from browser sharing, with truthful outcomes.
   * @param id Canonical post ID.
   * @param intent Existing share-menu action.
   * @returns Completion of native share/clipboard handling.
   */
  async share(id: string, intent: ShareIntent): Promise<void> {
    if (intent === 'quote') {
      const post = this.entities.post(id);
      if (post) {
        this.compose(toPost(post));
      }
      return;
    }
    if (intent === 'repost') {
      if (this.requireWrite()) {
        this.observe(this.mutations.repost(id, !this.interaction(id).reposted));
      }
      return;
    }
    const url = new URL(this.document.baseURI);
    url.hash = 'post-' + id;
    const navigator = this.document.defaultView?.navigator;
    try {
      if (intent === 'copy' && navigator?.clipboard) {
        await navigator.clipboard.writeText(url.href);
        this.notify('Post link copied.');
      } else if (intent === 'external' && navigator?.share) {
        await navigator.share({ title: 'Stacktrace conversation', url: url.href });
        this.notify('Post link shared.');
      } else {
        this.notify('Sharing is unavailable in this browser.');
      }
    } catch {
      this.notify('Sharing was cancelled or failed.');
    }
  }

  /**
   * Announces honest outcomes without exposing private response payloads.
   * @param message Safe presentation message.
   */
  notify(message: string): void {
    this.toastMessage.set(message);
    this.toastOpen.set(true);
  }

  /**
   * Checks whether a post resource is locked by any overlapping write.
   * @param id Canonical post ID.
   * @returns Resource pending state.
   */
  postPending(id: string): boolean {
    return this.mutations.pending({ type: 'post', id });
  }
  /** @returns Whether a post creation is awaiting confirmation. */
  creationPending(): boolean {
    return this.mutations.pending({ type: 'create-post' });
  }
  /** Removes quote context without discarding the caller's text draft. */
  clearQuote(): void {
    if (!this.creationPending()) {
      this.quoteId.set(null);
    }
  }
  /**
   * Reads profile action ownership.
   * @param id Canonical account ID.
   * @returns Whether follow state is pending.
   */
  accountPending(id: string): boolean {
    return this.mutations.pending({ type: 'account', id });
  }
  /** @returns Canonical account locks for the currently visible suggestion controls. */
  pendingAccounts(): ReadonlySet<string> {
    const pending = new Set<string>();
    for (const account of this.suggestions()) {
      if (this.accountPending(account.identity.id)) {
        pending.add(account.identity.id);
      }
    }
    return pending;
  }
  /** @returns Safe composer field/action feedback. */
  composerError(): string {
    const error = this.mutations.failure({ type: 'create-post' });
    return error?.fields['body'] ?? error?.message ?? '';
  }
  /** @returns A body-field message only, without marking transport failures as invalid text. */
  composerFieldError(): string {
    return this.mutations.failure({ type: 'create-post' })?.fields['body'] ?? '';
  }
  /**
   * Reads reply field validation separately from generic resource/action failures.
   * @param id Canonical parent post ID.
   * @returns Bounded body-field message, or no field error.
   */
  replyError(id: string): string {
    return this.mutations.failure({ type: 'post', id })?.fields['body'] ?? '';
  }
  /**
   * Reads safe per-post action feedback.
   * @param id Canonical post ID.
   * @returns Safe field/action message.
   */
  postError(id: string): string {
    const error = this.mutations.failure({ type: 'post', id });
    return error?.fields['body'] ?? error?.message ?? '';
  }
  /** @returns Safe remote detail failure feedback. */
  detailError(): string {
    return this.detail.failure()?.message ?? this.linkError();
  }
  /** @returns Safe profile read/action feedback. */
  profileError(): string {
    return (
      this.profileRead.failure()?.message ??
      this.mutations.failure({ type: 'account', id: this.profileAgent() })?.message ??
      ''
    );
  }
  /** @returns Whether the current profile is followed by the authenticated viewer. */
  profileFollowing(): boolean {
    return this.entities.profile(this.profileAgent())?.viewer?.following ?? false;
  }
  /**
   * Projects reply read state for a parent without duplicating entities.
   * @param id Parent post ID.
   * @returns Current thread lifecycle, if expanded.
   */
  replyView(id: string): AsyncViewState {
    return this.threads().get(id)?.state() ?? IDLE;
  }
  /**
   * Retries one failed thread page explicitly.
   * @param id Parent post ID.
   */
  retryReplies(id: string): void {
    this.threads().get(id)?.retry();
  }
  /**
   * Continues the current oldest reply chain.
   * @param id Parent post ID.
   */
  moreReplies(id: string): void {
    this.threads().get(id)?.loadMore();
  }
  /** Retries the current feed's failed page. */
  retryFeed(): void {
    this.main()?.retry();
  }
  /** Refreshes the current feed from its first page. */
  refreshFeed(): void {
    this.main()?.refresh();
  }
  /** Continues the current feed/bookmark chain. */
  moreFeed(): void {
    this.main()?.loadMore();
  }
  /** Retries the failed search page without losing loaded results. */
  retrySearch(): void {
    this.searchList()?.retry();
  }
  /** Continues the current normalized search query. */
  moreSearch(): void {
    this.searchList()?.loadMore();
  }
  /** Retries the current canonical post read. */
  retryDetail(): void {
    this.detail.reload();
  }
  /** Retries the current account profile read. */
  retryProfile(): void {
    this.profileRead.reload();
  }
  /** Retries trends without inventing fixture data. */
  retryTrends(): void {
    this.trendRead.reload();
  }
  /** Retries agent suggestions without preset relationships. */
  retrySuggestions(): void {
    this.suggestionRead.reload();
  }

  /** @returns Whether the optional session has resolved to a real account. */
  private isAuthenticated(): boolean {
    return this.session.state().status === 'authenticated';
  }
  /** @returns Current canonical viewer identity, or no account. */
  private viewerIdentity(): AccountIdentity | null {
    const state = this.session.state();
    return state.status === 'authenticated' ? toIdentity(state.account) : null;
  }
  /** @returns Whether authenticated writes are currently permitted. */
  private canWrite(): boolean {
    return this.authenticated() && this.gate.ready();
  }
  /** @returns Whether startup session semantics are known, including true anonymous success. */
  private sessionReady(): boolean {
    return ['anonymous', 'authenticated'].includes(this.session.state().status);
  }
  /** @returns An opaque caller-owned key for one logical submission. */
  private newKey(): string {
    return crypto.randomUUID();
  }

  /** @returns Whether a write may proceed, announcing unsupported anonymous entry honestly. */
  private requireWrite(): boolean {
    if (!this.authenticated()) {
      this.notify('Sign in is required. Authentication screens are not available in this client.');
      return false;
    }
    if (!this.gate.canStart()) {
      this.notify('Please wait before retrying.');
      return false;
    }
    return true;
  }

  /**
   * Observes a guarded command without using returned snapshots as a second store.
   * @param operation Server-confirmed command attempt.
   */
  private observe<T>(operation: Observable<CommandResult<T>>): void {
    this.lifetime.add(operation.subscribe(this.reportOutcome.bind(this)));
  }

  /**
   * Announces only safe normalized command outcomes.
   * @param result Guarded command result.
   */
  private reportOutcome<T>(result: CommandResult<T>): void {
    if (result.status === 'confirmed') {
      this.notify('Saved.');
    } else if (result.status === 'failed') {
      this.notify(result.failure.message);
    } else if (result.status === 'blocked') {
      this.notify(
        result.reason === 'pending'
          ? 'This action is still pending.'
          : 'This action is unavailable right now.',
      );
    }
  }

  /** Watches documented feed selection only, not mutable canonical response data. */
  private watchFeed(): void {
    const ready = this.started() && this.sessionReady();
    const view = this.view();
    const filter = this.filter();
    const sort = this.sort();
    const topic = this.topic();
    this.session.generation();
    untracked(this.selectFeed.bind(this, ready, view, filter, sort, topic));
  }

  /**
   * Starts a fresh endpoint-specific cursor chain for the selected feed view.
   * @param ready Whether session restoration completed.
   * @param view Existing feed view.
   * @param filter Feed selection.
   * @param sort Existing UI sort, mapped explicitly to the API.
   * @param topic One API tag slug.
   */
  private selectFeed(
    ready: boolean,
    view: FeedView,
    filter: FeedFilter,
    sort: FeedSort,
    topic: string,
  ): void {
    if (!ready || (!this.authenticated() && (view === 'bookmarks' || filter === 'following'))) {
      this.main()?.dispose();
      this.main.set(null);
      return;
    }
    if (view === 'bookmarks') {
      const definition = this.api.bookmarks();
      if (this.main()?.state().key !== definition.key) {
        this.main()?.dispose();
        this.mainKind = 'posts';
        this.main.set(this.api.create(definition));
      }
    } else {
      const definition = this.api.feed({
        view: filter,
        sort: sort === 'liked' ? 'reacted' : sort,
        tag: topic || undefined,
      });
      if (this.main()?.state().key !== definition.key) {
        this.main()?.dispose();
        this.mainKind = 'events';
        this.main.set(this.api.create(definition));
      }
    }
  }

  /** Watches normalized search selection with cancellation and no prototype-only parameters. */
  private watchSearch(): void {
    const query = this.search().trim();
    const ready = this.started() && this.sessionReady();
    this.session.generation();
    untracked(this.selectSearch.bind(this, ready, query));
  }

  /**
   * Loads only supported Unicode query lengths; no empty/repeated queries are sent.
   * @param ready Whether viewer semantics are known.
   * @param query Normalized query.
   */
  private selectSearch(ready: boolean, query: string): void {
    if (!ready || [...query].length < 2 || [...query].length > 100 || query.includes('\0')) {
      this.searchList()?.dispose();
      this.searchList.set(null);
      return;
    }
    const definition = this.api.search({ q: query });
    if (this.searchList()?.state().key !== definition.key) {
      this.searchList()?.dispose();
      this.searchList.set(this.api.create(definition));
    }
  }

  /** Watches post-link identity independently of the currently loaded Home page. */
  private watchDetail(): void {
    const id = this.revealedId();
    const ready = this.started() && this.sessionReady();
    this.session.generation();
    untracked(this.selectDetail.bind(this, ready, id));
  }

  /**
   * Fetches a canonical post even if it is absent from every loaded collection.
   * @param ready Whether viewer semantics are known.
   * @param id Requested canonical post UUID.
   */
  private selectDetail(ready: boolean, id: string | null): void {
    if (!ready || !id) {
      return;
    }
    this.detail.select({
      key: id,
      /** @returns Complete remote post representation. */
      load: (): Observable<Post> => this.content.post(id),
      /**
       * Commits current content and requests focus after the row exists.
       * @param post Complete post.
       * @param ticket Read provenance.
       * @returns Canonical post ID.
       */
      commit: (post: Post, ticket: ReadTicket): string => {
        this.entities.putPost(post, ticket);
        this.focusedPost.set(post.id);
        return post.id;
      },
      /**
       * Removes definitive deleted content without inventing author/body placeholders.
       * @param ticket Current failed-read ownership.
       */
      deleted: (ticket: ReadTicket): void => {
        if (this.reads.confirmMutation(ticket.session)) {
          this.entities.deletePost(id, ticket.session);
        }
      },
    });
  }

  /** Watches session ownership for remote rail/Explore discovery. */
  private watchDiscovery(): void {
    const ready = this.started() && this.sessionReady();
    this.session.generation();
    untracked(this.selectDiscovery.bind(this, ready));
  }

  /** Cancels profile reads when the existing modal is dismissed. */
  private watchProfileVisibility(): void {
    if (!this.profileOpen()) {
      untracked(this.profileRead.clear.bind(this.profileRead));
    }
  }

  /**
   * Loads server-only trends and profile references, including successful empty lists.
   * @param ready Whether the optional viewer is known.
   */
  private selectDiscovery(ready: boolean): void {
    if (!ready) {
      return;
    }
    this.trendRead.select({
      key: 'trends',
      /** @returns Server tag counts and nullable changes. */
      load: (): Observable<Trends> => this.discovery.trends(6),
      /**
       * Keeps non-entity trend values in their single owned resource.
       * @param result Server trends.
       * @param _ticket Current read ownership, checked by the resource.
       * @returns Wire trends without fabricated pulse/presence metrics.
       */
      commit: (result: Trends, _ticket: ReadTicket): readonly WireTrend[] => result.items,
    });
    this.suggestionRead.select({
      key: 'suggestions',
      /** @returns Server-selected account profiles. */
      load: (): Observable<SuggestedAgents> => this.discovery.suggested(),
      /**
       * Stores canonical profiles and separate suggestion references.
       * @param result Server suggestion profiles.
       * @param ticket Current read ownership.
       * @returns Successful membership commit marker, not duplicate profile data.
       */
      commit: (result: SuggestedAgents, ticket: ReadTicket): boolean => {
        const ids: string[] = [];
        for (const profile of result.items) {
          this.entities.putProfile(profile, ticket);
          ids.push(profile.id);
        }
        return this.entities.putMembership(
          'product-suggestions',
          { kind: 'accounts', purpose: 'suggestions', ids, private: false },
          ticket,
        );
      },
    });
  }

  /** @returns Canonical feed event rows and an independently resolved linked post. */
  private projectRows(): readonly ProductRow[] {
    const rows: ProductRow[] = [];
    const linked = this.revealedId();
    const failure = this.detail.failure()?.kind;
    if (linked && failure !== 'deleted' && failure !== 'not-found') {
      const post = this.entities.post(linked);
      if (post) {
        rows.push(this.row('detail:' + linked, post));
      }
    }
    for (const id of this.main()?.state().ids ?? []) {
      if (this.mainKind === 'events') {
        const event = this.entities.event(id);
        if (event) {
          rows.push(
            this.row(
              event.id,
              event.post,
              event.kind === 'repost' ? event.reposter?.display_name : undefined,
            ),
          );
        }
      } else {
        const post = this.entities.post(id);
        if (post) {
          rows.push(this.row('bookmark:' + id, post));
        }
      }
    }
    return rows;
  }

  /**
   * Composes a row while keeping event and canonical post identities distinct.
   * @param rowId Collection event/reference identity.
   * @param post Canonical complete post.
   * @param reposter Optional actual reposting account label.
   * @returns Safe presentation row with controlled remote replies.
   */
  private row(rowId: string, post: Post, reposter?: string): ProductRow {
    const view = toPost(post);
    const thread = this.threads().get(post.id);
    if (thread) {
      const replies: ReplyData[] = [];
      for (const id of thread.state().ids) {
        const reply = this.entities.reply(id);
        if (reply) {
          replies.push(toReply(reply));
        }
      }
      return { rowId, postId: post.id, post: { ...view, replies, repostedBy: reposter } };
    }
    return { rowId, postId: post.id, post: { ...view, repostedBy: reposter } };
  }

  /** @returns Safe server search results using collection-local excerpts. */
  private projectSearch(): readonly SearchResult[] {
    const results: SearchResult[] = [];
    const state = this.searchList()?.state();
    const snippets = state?.membershipKey
      ? this.entities.membership(state.membershipKey)?.snippets
      : undefined;
    for (const id of state?.ids ?? []) {
      const post = this.entities.post(id);
      if (post) {
        results.push({
          id,
          label: post.author.display_name,
          description: snippets?.[id],
          agent: post.author.id,
          identity: toIdentity(post.author),
        });
      }
    }
    return results;
  }

  /** @returns Complete profile presentation only after a successful remote read. */
  private projectProfile(): ReturnType<typeof toProfile> | null {
    const id = this.profileRead.value();
    const profile = id ? this.entities.profile(id) : undefined;
    return profile ? toProfile(profile, this.viewer()?.id) : null;
  }

  /** @returns Live canonical quote context, never a stale copied author/body preview. */
  private composerQuote(): QuotedPostData | null {
    const id = this.quoteId();
    if (!id) {
      return null;
    }
    const source = this.entities.post(id);
    if (!source) {
      return { id, availability: 'deleted' };
    }
    const view = toPost(source);
    return {
      id,
      availability: 'available',
      agent: view.agent,
      identity: view.identity,
      text: view.text,
      time: view.time,
    };
  }

  /** @returns Server counts and honest nullable-baseline trend presentation. */
  private projectTrends(): readonly Trend[] {
    const values: Trend[] = [];
    for (const trend of this.trendRead.value() ?? []) {
      values.push({
        tag: '#' + trend.display_name,
        slug: trend.slug,
        posts: `${trend.post_count} posts`,
        change:
          trend.change_percent === null
            ? 'No prior baseline'
            : `${trend.change_percent > 0 ? '+' : ''}${trend.change_percent}%`,
        hot: trend.change_percent !== null && trend.change_percent < 0,
      });
    }
    return values;
  }

  /** @returns Canonical suggested accounts, never fixed appearance-key identities. */
  private projectSuggestions(): readonly SuggestedAccount[] {
    const accounts: SuggestedAccount[] = [];
    for (const id of this.entities.membership('product-suggestions')?.ids ?? []) {
      const profile = this.entities.profile(id);
      if (profile) {
        accounts.push({
          identity: toIdentity(profile),
          role: profile.role_label,
          following: profile.viewer?.following ?? false,
        });
      }
    }
    return accounts;
  }

  /** @returns Explicit startup/expired-session feedback rather than an anonymous fallback. */
  private sessionFeedback(): AsyncViewState {
    const state = this.session.state();
    if (state.status === 'loading') {
      return { ...IDLE, phase: 'loading' };
    }
    if (state.status === 'failed' || (this.started() && state.status === 'uninitialized')) {
      const failure = state.status === 'failed' ? normalizeFailure(state.error) : null;
      return {
        ...IDLE,
        phase: 'error',
        error: failure?.kind === 'network' ? 'network' : 'request',
        canRetry: this.gate.ready(),
        coolingDown: !this.gate.ready(),
      };
    }
    return IDLE;
  }
  /** @returns Current cursor lifecycle without treating an unread collection as empty. */
  private feedFeedback(): AsyncViewState {
    return this.main()?.state() ?? IDLE;
  }
  /** @returns Remote search lifecycle independently of the feed. */
  private searchFeedback(): AsyncViewState {
    return this.searchList()?.state() ?? IDLE;
  }
  /** @returns Canonical link resolution lifecycle. */
  private detailFeedback(): AsyncViewState {
    const kind = this.detail.failure()?.kind;
    return this.detail.view(
      kind !== 'deleted' &&
        kind !== 'not-found' &&
        !!this.revealedId() &&
        !!this.entities.post(this.revealedId() ?? ''),
    );
  }
  /** @returns Remote profile lifecycle while retaining previously loaded metadata. */
  private profileFeedback(): AsyncViewState {
    return this.profileRead.view(!!this.profile());
  }
  /** @returns Trend lifecycle, with no fixture fallback on errors or empty success. */
  private trendFeedback(): AsyncViewState {
    return this.trendRead.view(this.trends().length > 0);
  }
  /** @returns Suggestion lifecycle based on canonical membership availability. */
  private suggestionFeedback(): AsyncViewState {
    return this.suggestionRead.view(this.suggestions().length > 0);
  }

  /** Clears viewer-bound drafts, retry attempts, private references and modal context per epoch. */
  private clearViewerContext(): void {
    this.search.set('');
    this.view.set('home');
    this.filter.set('for-you');
    this.topic.set('');
    this.profileAgent.set('');
    this.focusedPost.set('');
    this.toastOpen.set(false);
    this.draftText.set('');
    this.quoteId.set(null);
    this.composerOpen.set(false);
    this.profileOpen.set(false);
    this.postSubmission = null;
    this.submissions.clear();
    this.replyValues.set(new Map());
    this.openThreads.set(new Set());
    for (const thread of this.threads().values()) {
      thread.dispose();
    }
    this.threads.set(new Map());
  }

  /** Disposes every owned read when leaving the product, never affecting demo state. */
  private destroy(): void {
    this.lifetime.unsubscribe();
    this.restore?.unsubscribe();
    this.main()?.dispose();
    this.searchList()?.dispose();
    for (const thread of this.threads().values()) {
      thread.dispose();
    }
    this.detail.dispose();
    this.profileRead.dispose();
    this.trendRead.dispose();
    this.suggestionRead.dispose();
  }
}
