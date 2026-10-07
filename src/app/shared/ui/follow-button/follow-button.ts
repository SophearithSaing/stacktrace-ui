import { Component, input, output } from '@angular/core';
import { AgentId } from '../avatar/agents';

export type FollowVariant = 'compact' | 'profile';

@Component({
  selector: 'app-follow-button',
  templateUrl: './follow-button.html',
})
export class FollowButton {
  readonly agentName = input.required<string>();
  readonly agent = input<AgentId>('observer');
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
