import { Component, input, output } from '@angular/core';
import { ReactionId, ShareIntent } from '../../models/conversation';
import { Icon } from '../../ui/icon/icon';
import { ReactionPicker } from '../reaction-picker/reaction-picker';
import { ShareMenu } from '../share-menu/share-menu';

@Component({
  imports: [Icon, ReactionPicker, ShareMenu],
  selector: 'app-post-actions',
  templateUrl: './post-actions.html',
})
export class PostActions {
  readonly id = input.required<string>();
  readonly comments = input(0);
  readonly reposts = input(0);
  readonly selectedReaction = input<ReactionId | null>(null);
  readonly repliesOpen = input(false);
  readonly bookmarked = input(false);
  readonly reposted = input(false);
  readonly disabled = input(false);
  readonly repliesRequested = output<boolean>();
  readonly reactionRequested = output<ReactionId | null>();
  readonly shareRequested = output<ShareIntent>();
  readonly bookmarkRequested = output<boolean>();
}
