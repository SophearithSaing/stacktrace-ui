import { Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

export type BadgeVariant = 'verified' | 'live' | 'tag' | 'count';

@Component({
  imports: [Icon],
  selector: 'app-badge',
  templateUrl: './badge.html',
})
export class Badge {
  readonly variant = input<BadgeVariant>('tag');
  readonly text = input('');
  readonly label = input('');
}
