import { Component, computed, input, output } from '@angular/core';
import { MOBILE_NAVIGATION, NAVIGATION } from '../../core/data/feed-fixtures';
import { FeedView, NavigationIntent, NavigationItem } from '../../core/models/feed';
import { Badge } from '../../shared/ui/badge/badge';
import { Icon } from '../../shared/ui/icon/icon';

@Component({
  imports: [Badge, Icon],
  selector: 'app-main-navigation',
  templateUrl: './main-navigation.html',
})
export class MainNavigation {
  readonly variant = input<'desktop' | 'mobile'>('desktop');
  readonly active = input<FeedView>('home');
  readonly alerts = input(3);
  readonly navigationRequested = output<NavigationIntent>();
  protected readonly items = computed(this.navigationItems.bind(this));

  /**
   * Selects a presentation of the common navigation model.
   *
   * @returns Entries appropriate to desktop or mobile.
   */
  private navigationItems(): readonly NavigationItem[] {
    return this.variant() === 'mobile' ? MOBILE_NAVIGATION : NAVIGATION;
  }
}
