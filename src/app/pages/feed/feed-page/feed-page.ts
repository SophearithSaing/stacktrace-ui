import { Component, ElementRef, afterRenderEffect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FeedState } from '../../../core/state/feed-state';
import { FeedFilter, FeedSort } from '../../../core/models/feed';
import { Post } from '../../../shared/patterns/post/post';
import { Tabs, TabItem } from '../../../shared/ui/tabs/tabs';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Badge } from '../../../shared/ui/badge/badge';
import { QuickComposer } from '../components/quick-composer/quick-composer';
import { TrendingList } from '../components/trending-list/trending-list';
import { SuggestedAgents } from '../components/suggested-agents/suggested-agents';
import { CommunityList } from '../../../layout/community-list/community-list';

@Component({
  imports: [
    Post,
    Tabs,
    EmptyState,
    Badge,
    QuickComposer,
    TrendingList,
    SuggestedAgents,
    CommunityList,
    RouterLink,
  ],
  selector: 'app-feed-page',
  templateUrl: './feed-page.html',
})
export class FeedPage {
  protected readonly state = inject(FeedState);
  protected readonly tabs: readonly TabItem[] = [
    { id: 'for-you', label: 'For you', panelId: 'feed-list' },
    { id: 'following', label: 'Following', panelId: 'feed-list' },
    { id: 'spicy', label: 'Spicy takes', panelId: 'feed-list' },
  ];
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment);
  private lastFragment: string | null | undefined;
  private readonly linkEffect = afterRenderEffect(this.revealFragment.bind(this));
  private readonly focusEffect = afterRenderEffect(this.focusRequestedPost.bind(this));

  /**
   * Validates native sorting values before updating shared state.
   *
   * @param event Select change event.
   */
  protected sortFeed(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (['relevant', 'newest', 'liked'].includes(value)) {
      this.state.sort.set(value as FeedSort);
    }
  }

  /**
   * Validates a shared tab's selection before updating the feed.
   *
   * @param value Tab identifier.
   */
  protected filterFeed(value: string): void {
    if (['for-you', 'following', 'spicy'].includes(value)) {
      this.state.filter.set(value as FeedFilter);
    }
  }

  /**
   * Updates local saved state and keeps focus in a shrinking bookmark list.
   *
   * @param id Post identifier.
   * @param saved Requested bookmark state.
   */
  protected bookmark(id: string, saved: boolean): void {
    this.state.setInteraction(id, { bookmarked: saved });
    this.state.notify(saved ? 'Saved to local bookmarks.' : 'Removed from local bookmarks.');
    if (!saved && this.state.view() === 'bookmarks') {
      this.host.nativeElement.closest<HTMLElement>('.product-main')?.focus();
    }
  }

  /**
   * Restores public fixture links after a lazy route has rendered.
   */
  private revealFragment(): void {
    const fragment = this.fragment();
    if (fragment === this.lastFragment) {
      return;
    }
    this.lastFragment = fragment;
    if (fragment?.startsWith('post-')) {
      this.state.reveal(fragment.slice(5));
    }
  }

  /**
   * Focuses and scrolls a requested post only once its view exists.
   */
  private focusRequestedPost(): void {
    this.state.modalRevision();
    const id = this.state.focusedPost();
    if (this.state.composerOpen() || this.state.profileOpen()) {
      return;
    }
    if (!id) {
      return;
    }
    const target = this.host.nativeElement.querySelector<HTMLElement>('[id="post-' + id + '"]');
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: 'center' });
      if (target.ownerDocument.activeElement === target) {
        this.state.focusedPost.set('');
      }
    }
  }
}
