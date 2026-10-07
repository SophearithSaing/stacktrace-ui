import { Component, input, output, signal } from '@angular/core';
import { Menu } from '../../behaviors/menu';
import { ShareIntent } from '../../models/conversation';
import { Icon } from '../../ui/icon/icon';

@Component({
  imports: [Icon, Menu],
  selector: 'app-share-menu',
  templateUrl: './share-menu.html',
})
export class ShareMenu {
  readonly id = input.required<string>();
  readonly reposted = input(false);
  readonly reposts = input(0);
  readonly disabled = input(false);
  readonly variant = input<'menu' | 'inline'>('menu');
  readonly intent = output<ShareIntent>();
  protected readonly open = signal(false);

  /**
   * Requests a share operation without assuming browser APIs succeed.
   *
   * @param intent Operation to be handled by the container.
   */
  protected request(intent: ShareIntent): void {
    if (!this.disabled()) {
      this.intent.emit(intent);
    }
  }
}
