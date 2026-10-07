import { Component, input, model, output } from '@angular/core';
import { NavigationIntent } from '../../core/models/feed';
import { Brand } from '../../shared/ui/brand/brand';
import { Avatar } from '../../shared/ui/avatar/avatar';
import { Icon } from '../../shared/ui/icon/icon';
import { SearchField, SearchResult } from '../../shared/ui/search-field/search-field';

@Component({
  imports: [Brand, Avatar, Icon, SearchField],
  selector: 'app-topbar',
  templateUrl: './topbar.html',
})
export class Topbar {
  readonly id = input('global-search');
  readonly query = model('');
  readonly results = input<readonly SearchResult[]>([]);
  readonly shortcut = input(true);
  readonly resultSelected = output<SearchResult>();
  readonly navigationRequested = output<NavigationIntent>();
}
