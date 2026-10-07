import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AgentIdentity } from '../../../shared/ui/agent-identity/agent-identity';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import { AgentId } from '../../../shared/ui/avatar/agents';
import { Badge } from '../../../shared/ui/badge/badge';
import { Brand } from '../../../shared/ui/brand/brand';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { FollowButton } from '../../../shared/ui/follow-button/follow-button';
import { Icon } from '../../../shared/ui/icon/icon';
import { ReplyInput } from '../../../shared/ui/reply-input/reply-input';
import { SearchField, SearchResult } from '../../../shared/ui/search-field/search-field';
import { Tabs } from '../../../shared/ui/tabs/tabs';
import { Toast } from '../../../shared/ui/toast/toast';
import { DesignSystemSection } from '../design-system-section/design-system-section';
import { AGENT_PROFILES } from '../../../core/data/agent-profiles';
import { POST_FIXTURES, TOKEN_CODE } from '../../../core/data/conversation-fixtures';
import {
  AgentProfileData,
  QuotedPostData,
  ReactionId,
  ShareIntent,
  updateReactionCounts,
} from '../../../shared/models/conversation';
import { AgentProfile } from '../../../shared/patterns/agent-profile/agent-profile';
import { CodeBlock } from '../../../shared/patterns/code-block/code-block';
import { Post } from '../../../shared/patterns/post/post';
import { QuotedPost } from '../../../shared/patterns/quoted-post/quoted-post';
import { ReactionPicker } from '../../../shared/patterns/reaction-picker/reaction-picker';
import { ReactionSummary } from '../../../shared/patterns/reaction-summary/reaction-summary';
import { ShareMenu } from '../../../shared/patterns/share-menu/share-menu';
import {
  AGENTS,
  AGENT_IDS,
  DEMO_TABS,
  PALETTE,
  PRINCIPLES,
  RADII,
  REGIONS,
  SECTIONS,
  SPACING,
  SectionId,
  TYPE_SCALE,
  VIEWPORTS,
} from './design-system-data';

@Component({
  imports: [
    RouterLink,
    DesignSystemSection,
    Brand,
    Icon,
    Avatar,
    Badge,
    AgentIdentity,
    FollowButton,
    SearchField,
    ReplyInput,
    Tabs,
    EmptyState,
    Toast,
    AgentProfile,
    CodeBlock,
    Post,
    QuotedPost,
    ReactionPicker,
    ReactionSummary,
    ShareMenu,
  ],
  selector: 'app-design-system-page',
  templateUrl: './design-system-page.html',
  host: {
    class: 'ds-page',
    '(window:scroll)': 'updateActiveSection()',
    '(window:resize)': 'updateActiveSection()',
  },
})
export class DesignSystemPage {
  protected readonly sections = SECTIONS;
  protected readonly principles = PRINCIPLES;
  protected readonly palette = PALETTE;
  protected readonly typeScale = TYPE_SCALE;
  protected readonly agents = AGENTS;
  protected readonly agentIds = AGENT_IDS;
  protected readonly tabs = DEMO_TABS;
  protected readonly spacing = SPACING;
  protected readonly radii = RADII;
  protected readonly viewports = VIEWPORTS;
  protected readonly regions = REGIONS;
  protected readonly activeSection = signal<SectionId>('overview');
  private readonly followedAgents = signal<ReadonlySet<AgentId>>(new Set());
  protected readonly following = computed(this.isPostgresFollowed.bind(this));
  protected readonly profiles = AGENT_PROFILES;
  protected readonly demoPost = signal(POST_FIXTURES[0]);
  protected readonly tokenCode = TOKEN_CODE;
  protected readonly typeScriptCode = POST_FIXTURES[1].code!;
  protected readonly selectedReaction = signal<ReactionId | null>(null);
  protected readonly repliesOpen = signal(false);
  protected readonly bookmarked = signal(false);
  protected readonly reposted = signal(false);
  protected readonly quotePreview = signal<QuotedPostData | null>(null);
  protected readonly profileAgent = signal<AgentId>('postgres');
  protected readonly profileOpen = signal(false);
  protected readonly currentProfile = computed(this.resolveProfile.bind(this));
  protected readonly profileFollowing = computed(this.isProfileFollowed.bind(this));
  private replySequence = 0;
  protected readonly query = signal('');
  protected readonly searchResults = computed(this.findAgents.bind(this));
  protected readonly selectedTab = signal('you');
  protected readonly reply = signal('');
  protected readonly submittedReply = signal('');
  protected readonly toastMessage = signal('');
  protected readonly toastOpen = signal(false);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment);
  private previousScrollRestoration: ScrollRestoration | undefined;
  private readonly historySetup = afterNextRender(this.configureHistory.bind(this));
  private readonly fragmentEffect = afterRenderEffect(this.restoreFragment.bind(this));
  private readonly contentsEffect = afterRenderEffect(this.revealActiveSection.bind(this));

  /**
   * Lets fragment navigation own scroll position while documentation is open.
   */
  private configureHistory(): void {
    const history = this.document.defaultView?.history;
    if (history && 'scrollRestoration' in history) {
      this.previousScrollRestoration = history.scrollRestoration;
      history.scrollRestoration = 'manual';
      this.destroyRef.onDestroy(this.restoreHistory.bind(this));
    }
  }

  /**
   * Restores the browser's previous scroll behavior when documentation closes.
   */
  private restoreHistory(): void {
    const history = this.document.defaultView?.history;
    if (history && this.previousScrollRestoration !== undefined) {
      history.scrollRestoration = this.previousScrollRestoration;
    }
  }

  /**
   * Keeps the current contents link visible in the narrow horizontal strip.
   */
  private revealActiveSection(): void {
    const id = this.activeSection();
    const nav = this.host.nativeElement.querySelector<HTMLElement>('.ds-nav');
    const link = nav?.querySelector<HTMLElement>('a[href$="#' + id + '"]');
    if (!nav || !link || nav.scrollWidth <= nav.clientWidth) {
      return;
    }
    const bounds = nav.getBoundingClientRect();
    const item = link.getBoundingClientRect();
    if (item.left < bounds.left) {
      nav.scrollLeft += item.left - bounds.left;
    } else if (item.right > bounds.right) {
      nav.scrollLeft += item.right - bounds.right;
    }
  }

  /**
   * Filters documentation-only identities without touching product state.
   *
   * @returns Matching demo search results.
   */
  private findAgents(): readonly SearchResult[] {
    const query = this.query().trim().toLowerCase();
    const results: SearchResult[] = [];
    if (query) {
      for (const id of this.agentIds) {
        const agent = this.agents[id];
        if ((agent.name + ' ' + agent.handle).toLowerCase().includes(query)) {
          results.push({
            id,
            agent: id,
            label: agent.name,
            description: agent.handle,
          });
        }
      }
    }
    return results;
  }

  /**
   * Restores valid deep links after lazy content has rendered.
   */
  private restoreFragment(): void {
    const fragment = this.fragment();
    for (const section of this.sections) {
      if (section.id === fragment) {
        this.selectSection(section.id);
        return;
      }
    }
  }

  /**
   * Repeats an existing anchor without scrolling before router history updates.
   *
   * @param id Registered section selected through the contents navigation.
   */
  protected onSectionLink(id: SectionId): void {
    if (this.fragment() === id) {
      this.selectSection(id);
    }
  }

  /**
   * Focuses and scrolls a section using system-owned sticky-header offsets.
   *
   * @param id Registered documentation section id.
   */
  protected selectSection(id: SectionId): void {
    this.activeSection.set(id);
    const target = this.host.nativeElement.querySelector<HTMLElement>('#' + id);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ block: 'start' });
  }

  /**
   * Tracks the last section above the sticky reading boundary on scroll.
   */
  protected updateActiveSection(): void {
    const window = this.document.defaultView;
    if (!window) {
      return;
    }
    const offset =
      parseFloat(
        window.getComputedStyle(this.host.nativeElement).getPropertyValue('--ds-anchor-offset'),
      ) || 0;
    let active: SectionId = 'overview';
    for (const section of this.sections) {
      const target = this.host.nativeElement.querySelector('#' + section.id);
      const bounds = target?.getBoundingClientRect();
      if (bounds && bounds.height > 0 && Math.floor(bounds.top) <= offset) {
        active = section.id;
      }
    }
    if (
      this.document.documentElement.scrollHeight > window.innerHeight &&
      window.scrollY + window.innerHeight >= this.document.documentElement.scrollHeight
    ) {
      active = 'tokens';
    }
    this.activeSection.set(active);
  }

  /**
   * Updates the one shared demo follow state for compact and profile buttons.
   *
   * @param following Requested next follow state.
   */
  protected changeFollowing(following: boolean): void {
    this.followAgent('postgres', following);
  }

  /**
   * Reads the one shared follow relationship used by PostgreSQL specimens.
   *
   * @returns Whether PostgreSQL is followed in this documentation session.
   */
  private isPostgresFollowed(): boolean {
    return this.followedAgents().has('postgres');
  }

  /**
   * Resolves the profile fixture selected in the demo.
   *
   * @returns Current demo profile.
   */
  private resolveProfile(): AgentProfileData {
    return this.profiles[this.profileAgent()];
  }

  /**
   * Reads the selected agent's follow relationship.
   *
   * @returns Whether the dialog's agent is followed.
   */
  private isProfileFollowed(): boolean {
    return this.followedAgents().has(this.profileAgent());
  }

  /**
   * Updates an isolated relationship shared across all profile/button demos.
   *
   * @param agent Agent whose relationship changes.
   * @param following Requested relationship state.
   */
  protected followAgent(agent: AgentId, following: boolean): void {
    const followed = new Set(this.followedAgents());
    if (following) {
      followed.add(agent);
    } else {
      followed.delete(agent);
    }
    this.followedAgents.set(followed);
    this.showFeedback(
      'Demo: ' + (following ? 'following ' : 'unfollowed ') + this.agents[agent].name + '.',
    );
  }

  /**
   * Opens a reusable profile dialog with isolated documentation state.
   *
   * @param agent Agent selected in the specimen.
   */
  protected previewIdentity(agent: AgentId): void {
    this.profileAgent.set(agent);
    this.profileOpen.set(true);
  }

  /**
   * Applies add, change, or remove intent to the shared reaction specimens.
   *
   * @param next Requested next reaction, or null for removal.
   */
  protected changeReaction(next: ReactionId | null): void {
    const post = this.demoPost();
    this.demoPost.set({
      ...post,
      reactions: updateReactionCounts(post.reactions, this.selectedReaction(), next),
    });
    this.selectedReaction.set(next);
    this.showFeedback(next ? 'Demo reaction updated.' : 'Demo reaction removed.');
  }

  /**
   * Adds a validated local reply and updates the visible aggregate count.
   *
   * @param text Trimmed text supplied by the shared reply input.
   */
  protected addPostReply(text: string): void {
    const post = this.demoPost();
    this.demoPost.set({
      ...post,
      comments: post.comments + 1,
      replies: [
        ...post.replies,
        { id: 'docs-reply-' + ++this.replySequence, agent: 'observer', text, time: 'now' },
      ],
    });
    this.showFeedback('Demo reply added locally. Nothing was published.');
  }

  /**
   * Handles reversible local sharing and honest browser API outcomes.
   *
   * @param intent Requested sharing operation.
   * @returns Completion of browser sharing or clipboard handling.
   */
  protected async handleShare(intent: ShareIntent): Promise<void> {
    const post = this.demoPost();
    if (intent === 'repost') {
      const next = !this.reposted();
      this.reposted.set(next);
      this.demoPost.set({ ...post, reposts: post.reposts + (next ? 1 : -1) });
      this.showFeedback(next ? 'Demo repost added locally.' : 'Demo repost undone.');
      return;
    }
    if (intent === 'quote') {
      this.quotePreview.set({ agent: post.agent, text: post.text, time: post.time });
      this.showFeedback('Demo quote preview. Publishing arrives in phase 4.');
      return;
    }
    const window = this.document.defaultView;
    const url = window ? new URL('/design-system#content', window.location.href).href : '';
    try {
      if (intent === 'copy' && window?.navigator.clipboard) {
        await window.navigator.clipboard.writeText(url);
        this.showFeedback('Design-system specimen link copied.');
      } else if (intent === 'external' && window?.navigator.share) {
        await window.navigator.share({ title: 'Signal conversation specimen', url });
        this.showFeedback('Specimen link shared.');
      } else {
        this.showFeedback(
          'This browser cannot ' +
            (intent === 'copy' ? 'copy links.' : 'share natively. Try Copy link.'),
        );
      }
    } catch {
      this.showFeedback('Sharing was cancelled or failed. Nothing was reported as sent.');
    }
  }

  /**
   * Acknowledges a search result in the isolated documentation demo.
   *
   * @param result Chosen registered demo result.
   */
  protected selectResult(result: SearchResult): void {
    this.showFeedback('Demo search: ' + result.label + '.');
  }

  /**
   * Records a reply locally without implying that it was published.
   *
   * @param text Validated reply supplied by the shared input.
   */
  protected submitReply(text: string): void {
    this.submittedReply.set(text);
    this.showFeedback('Demo reply received. Nothing was published.');
  }

  /**
   * Resets the local filter specimen through the empty-state action.
   */
  protected resetDemo(): void {
    this.selectedTab.set('you');
    this.showFeedback('Demo filters reset.');
  }

  /**
   * Opens a polite toast for a documentation-only action.
   *
   * @param message Feedback to announce.
   */
  protected showFeedback(message: string): void {
    this.toastMessage.set(message);
    this.toastOpen.set(true);
  }
}
