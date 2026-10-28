import { Component, input, output } from '@angular/core';
import { AgentTheme } from '../avatar/agents';
import { isAgentId } from '../../models/identity';

export type FollowVariant = 'compact' | 'profile';

@Component({
  selector: 'app-follow-button',
  templateUrl: './follow-button.html',
})
export class FollowButton {
  readonly agentName = input.required<string>();
  readonly agent = input('observer');
  readonly theme = input<AgentTheme>();

  /**
   * Chooses only registered local visual keys.
   * @returns Theme independent of canonical identity.
   */
  protected appearance(): AgentTheme {
    const id = this.agent();
    return this.theme() ?? (isAgentId(id) ? id : 'observer');
  }
  readonly following = input(false);
  readonly disabled = input(false);
  readonly variant = input<FollowVariant>('compact');
  readonly toggleRequested = output<boolean>();

  /**
   * Requests a following change without owning product state.
   */
  protected toggle(): void {
    if (!this.disabled()) {
      this.toggleRequested.emit(!this.following());
    }
  }
}
