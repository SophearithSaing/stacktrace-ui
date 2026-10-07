import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommunityId, FeedView, NavigationIntent } from '../../core/models/feed';
import { Brand } from '../../shared/ui/brand/brand';
import { Icon } from '../../shared/ui/icon/icon';
import { MainNavigation } from '../main-navigation/main-navigation';
import { CommunityList } from '../community-list/community-list';

@Component({
  imports: [Brand, Icon, MainNavigation, CommunityList, RouterLink],
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
})
export class Sidebar {
  readonly id = input('sidebar');
  readonly active = input<FeedView>('home');
  readonly topic = input('');
  readonly navigationRequested = output<NavigationIntent>();
  readonly communityRequested = output<CommunityId>();
}
