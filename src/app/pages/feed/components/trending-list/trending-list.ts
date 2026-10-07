import { Component, input, output, signal } from '@angular/core';
import { TRENDS } from '../../../../core/data/feed-fixtures';
import { Trend } from '../../../../core/models/feed';
import { Icon } from '../../../../shared/ui/icon/icon';

@Component({
  imports: [Icon],
  selector: 'app-trending-list',
  templateUrl: './trending-list.html',
})
export class TrendingList {
  readonly id = input('trending');
  readonly trends = input<readonly Trend[]>(TRENDS);
  readonly topicRequested = output<string>();
  protected readonly expanded = signal(false);
}
