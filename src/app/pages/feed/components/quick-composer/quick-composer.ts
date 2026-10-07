import { Component, output } from '@angular/core';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { Icon } from '../../../../shared/ui/icon/icon';

@Component({
  imports: [Avatar, Icon],
  selector: 'app-quick-composer',
  templateUrl: './quick-composer.html',
})
export class QuickComposer {
  readonly composeRequested = output<void>();
  readonly unavailableRequested = output<string>();
}
