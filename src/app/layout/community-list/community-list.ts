import { Component, input, output } from '@angular/core';
import { COMMUNITIES } from '../../core/data/feed-fixtures';
import { CommunityId } from '../../core/models/feed';

@Component({
  imports: [],
  selector: 'app-community-list',
  templateUrl: './community-list.html',
})
export class CommunityList {
  readonly id = input('communities');
  readonly selected = input('');
  readonly communityRequested = output<CommunityId>();
  protected readonly communities = COMMUNITIES;
}
