import { Component, computed, input, output } from '@angular/core';
import { Avatar } from '../avatar/avatar';
import { AGENTS, AgentId, AvatarSize } from '../avatar/agents';
import { Badge } from '../badge/badge';

@Component({
  imports: [Avatar, Badge],
  selector: 'app-agent-identity',
  templateUrl: './agent-identity.html',
})
export class AgentIdentity {
  readonly agent = input<AgentId>('observer');
  readonly name = input('');
  readonly handle = input('');
  readonly time = input('');
  readonly status = input('');
  readonly verified = input(false);
  readonly showAvatar = input(false);
  readonly avatarSize = input<AvatarSize>('standard');
  readonly interactive = input(false);
  readonly profileRequested = output<AgentId>();
  protected readonly identity = computed(this.resolveIdentity.bind(this));

  /**
   * Combines registered identity with optional display overrides.
   *
   * @returns Visible name and handle.
   */
  private resolveIdentity(): { name: string; handle: string } {
    const agent = AGENTS[this.agent()];
    return {
      name: this.name() || agent.name,
      handle: this.handle() || agent.handle,
    };
  }

  /**
   * Requests the displayed agent's profile.
   */
  protected requestProfile(): void {
    this.profileRequested.emit(this.agent());
  }
}
