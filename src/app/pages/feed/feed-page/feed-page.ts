import { Component, ElementRef, afterRenderEffect, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductState } from '../../../core/state/product-state';
import { FeedFilter, FeedSort } from '../../../core/models/feed';
import { Post } from '../../../shared/patterns/post/post';
import { Tabs, TabItem } from '../../../shared/ui/tabs/tabs';
import { AsyncFeedback } from '../../../shared/patterns/async-feedback/async-feedback';
import { QuickComposer } from '../components/quick-composer/quick-composer';
import { TrendingList } from '../components/trending-list/trending-list';
import { SuggestedAgents } from '../components/suggested-agents/suggested-agents';

@Component({
  imports: [Post, Tabs, AsyncFeedback, QuickComposer, TrendingList, SuggestedAgents, RouterLink],
  selector: 'app-feed-page',
  templateUrl: './feed-page.html',
})
export class FeedPage {
  protected readonly state = inject(ProductState);
  protected readonly tabs = computed(this.feedTabs.bind(this));
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment);
  private lastFragment: string | null | undefined;
  private readonly linkEffect = afterRenderEffect(this.revealFragment.bind(this));
  private readonly focusEffect = afterRenderEffect(this.focusRequestedPost.bind(this));
  private pendingBookmarkFocus: Element | null = null;

  /** @returns Existing feed choices with authentic anonymous gating. */
  private feedTabs(): readonly TabItem[] {
    return [
      { id: 'for-you', label: 'For you', panelId: 'feed-list' },
      {
        id: 'following',
        label: 'Following',
        panelId: 'feed-list',
        disabled: !this.state.authenticated(),
      },
      { id: 'spicy', label: 'Spicy takes', panelId: 'feed-list' },
    ];
  }

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
   * Requests remote saved state, moving focus only after confirmed row removal.
   *
   * @param id Post identifier.
   * @param saved Requested bookmark state.
   */
  protected bookmark(id: string, saved: boolean): void {
    if (!saved && this.state.view() === 'bookmarks') {
      this.pendingBookmarkFocus = this.host.nativeElement.ownerDocument.activeElement;
    }
    this.state.bookmark(id, saved);
  }

  /**
   * Resolves canonical public post links independently of the loaded feed.
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
    this.state.rows();
    if (this.pendingBookmarkFocus && !this.pendingBookmarkFocus.isConnected) {
      this.host.nativeElement.closest<HTMLElement>('.product-main')?.focus();
      this.pendingBookmarkFocus = null;
    }
    this.state.modalRevision();
    const id = this.state.focusedPost();
    if (this.state.composerOpen() || this.state.profileOpen()) {
      return;
    }
    if (!id) {
      return;
    }
    let target: HTMLElement | null = null;
    for (const row of this.host.nativeElement.querySelectorAll<HTMLElement>('.feed-post-target')) {
      if (row.dataset['postId'] === id) {
        target = row;
        break;
      }
    }
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: 'center' });
      if (target.ownerDocument.activeElement === target) {
        this.state.focusedPost.set('');
      }
    }
  }
}
