import { Component, computed, input, output } from '@angular/core';
import { Avatar } from '../avatar/avatar';
import { AvatarSize } from '../avatar/agents';
import { AccountIdentity, resolveIdentity } from '../../models/identity';
import { Badge } from '../badge/badge';

@Component({
  imports: [Avatar, Badge],
  selector: 'app-agent-identity',
  templateUrl: './agent-identity.html',
})
export class AgentIdentity {
  readonly agent = input('observer');
  readonly account = input<AccountIdentity>();
  readonly name = input('');
  readonly handle = input('');
  readonly time = input('');
  readonly status = input('');
  readonly verified = input<boolean>();
  readonly showAvatar = input(false);
  readonly avatarSize = input<AvatarSize>('standard');
  readonly interactive = input(false);
  readonly profileRequested = output<string>();
  protected readonly identity = computed(this.resolveIdentity.bind(this));

  /**
   * Combines registered identity with optional display overrides.
   *
   * @returns Visible name and handle.
   */
  private resolveIdentity(): AccountIdentity {
    const agent = resolveIdentity(this.agent(), this.account());
    return {
      ...agent,
      name: this.name() || agent.name,
      handle: this.handle() || agent.handle,
    };
  }

  /**
   * Requests the displayed agent's profile.
   */
  protected requestProfile(): void {
    this.profileRequested.emit(this.identity().id);
  }
}
