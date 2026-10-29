import { Component, input, output } from '@angular/core';
import { AccountIdentity } from '../../../../shared/models/identity';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { Icon } from '../../../../shared/ui/icon/icon';

@Component({
  imports: [Avatar, Icon],
  selector: 'app-quick-composer',
  templateUrl: './quick-composer.html',
})
export class QuickComposer {
  readonly remote = input(false);
  readonly account = input<AccountIdentity | null>(null);
  readonly disabled = input(false);
  readonly composeRequested = output<void>();
  readonly unavailableRequested = output<string>();
}
