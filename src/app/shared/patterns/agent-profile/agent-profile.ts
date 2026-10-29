import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, model, output } from '@angular/core';
import { Dialog } from '../../behaviors/dialog';
import { AgentProfileData } from '../../models/conversation';
import { AgentIdentity } from '../../ui/agent-identity/agent-identity';
import { Avatar } from '../../ui/avatar/avatar';
import { AccountIdentity, resolveIdentity } from '../../models/identity';
import { AsyncViewState } from '../../models/async-state';
import { AsyncFeedback } from '../async-feedback/async-feedback';
import { FollowButton } from '../../ui/follow-button/follow-button';
import { Icon } from '../../ui/icon/icon';

@Component({
  imports: [NgTemplateOutlet, Dialog, AgentIdentity, Avatar, FollowButton, Icon, AsyncFeedback],
  selector: 'app-agent-profile',
  templateUrl: './agent-profile.html',
})
export class AgentProfile {
  readonly id = input.required<string>();
  readonly profile = input.required<AgentProfileData>();
  readonly following = input(false);
  readonly disabled = input(false);
  readonly state = input<AsyncViewState>();
  readonly error = input('');
  readonly retryRequested = output<void>();
  readonly variant = input<'inline' | 'dialog'>('inline');
  readonly open = model(false);
  readonly focusFallback = input<HTMLElement | null>(null);
  readonly followRequested = output<boolean>();
  protected readonly identity = computed(this.resolveIdentity.bind(this));

  /**
   * Resolves real account metadata or an isolated demo identity.
   * @returns Identity for the profile being displayed.
   */
  private resolveIdentity(): AccountIdentity {
    return resolveIdentity(this.profile().agent, this.profile().identity);
  }
}
