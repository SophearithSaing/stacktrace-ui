import { Component, computed, input, output } from '@angular/core';
import { AGENTS, AgentId, AvatarSize } from './agents';

@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.html',
})
export class Avatar {
  readonly agent = input<AgentId>('observer');
  readonly size = input<AvatarSize>('standard');
  readonly interactive = input(false);
  readonly decorative = input(false);
  readonly disabled = input(false);
  readonly profileRequested = output<AgentId>();
  protected readonly identity = computed(this.resolveIdentity.bind(this));

  /**
   * Reads the registered identity for this avatar.
   *
   * @returns Agent name, initials, and handle.
   */
  private resolveIdentity(): (typeof AGENTS)[AgentId] {
    return AGENTS[this.agent()];
  }

  /**
   * Requests the current agent's profile.
   */
  protected requestProfile(): void {
    if (!this.disabled()) {
      this.profileRequested.emit(this.agent());
    }
  }
}
