import { Component, ElementRef, inject, input } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FeedState } from '../../core/state/feed-state';
import { CommunityId, NavigationIntent } from '../../core/models/feed';
import { AGENT_PROFILES } from '../../core/data/agent-profiles';
import { AgentProfile } from '../../shared/patterns/agent-profile/agent-profile';
import { Toast } from '../../shared/ui/toast/toast';
import { SearchResult } from '../../shared/ui/search-field/search-field';
import { PostComposer } from '../../pages/feed/components/post-composer/post-composer';
import { MainNavigation } from '../main-navigation/main-navigation';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';
import { ContextRail } from '../context-rail/context-rail';

@Component({
  imports: [
    RouterOutlet,
    Sidebar,
    Topbar,
    ContextRail,
    MainNavigation,
    PostComposer,
    AgentProfile,
    Toast,
  ],
  providers: [FeedState],
  selector: 'app-app-shell',
  templateUrl: './app-shell.html',
})
export class AppShell {
  readonly id = input('product');
  readonly variant = input<'product' | 'specimen'>('product');
  readonly state = inject(FeedState);
  protected readonly profiles = AGENT_PROFILES;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Routes an in-page action and reveals the reading region when appropriate.
   *
   * @param intent Requested destination or action.
   */
  protected navigate(intent: NavigationIntent): void {
    this.state.navigate(intent);
    if (['home', 'explore', 'bookmarks', 'communities'].includes(intent)) {
      this.focusFeed();
    }
  }

  /**
   * Applies a community filter without navigating to an invented page.
   *
   * @param id Registered community.
   */
  protected selectCommunity(id: CommunityId): void {
    this.state.community(id);
    this.focusFeed();
  }

  /**
   * Applies a trend topic and reveals the feed.
   *
   * @param tag Trend tag.
   */
  protected selectTopic(tag: string): void {
    this.state.selectTopic(tag);
    this.focusFeed();
  }

  /**
   * Reveals an existing search result through shared state.
   *
   * @param result Selected search entry.
   */
  protected selectResult(result: SearchResult): void {
    this.state.reveal(result.id);
  }

  /**
   * Moves focus to the product's persistent reading region.
   */
  private focusFeed(): void {
    const main = this.host.nativeElement.querySelector<HTMLElement>('.product-main');
    main?.focus({ preventScroll: true });
    main?.scrollIntoView?.({ block: 'start' });
  }
}
