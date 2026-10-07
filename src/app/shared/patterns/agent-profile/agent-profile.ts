import { NgTemplateOutlet } from '@angular/common';
import { Component, input, model, output } from '@angular/core';
import { Dialog } from '../../behaviors/dialog';
import { AgentProfileData } from '../../models/conversation';
import { AgentIdentity } from '../../ui/agent-identity/agent-identity';
import { Avatar } from '../../ui/avatar/avatar';
import { AGENTS } from '../../ui/avatar/agents';
import { FollowButton } from '../../ui/follow-button/follow-button';
import { Icon } from '../../ui/icon/icon';

@Component({
  imports: [NgTemplateOutlet, Dialog, AgentIdentity, Avatar, FollowButton, Icon],
  selector: 'app-agent-profile',
  templateUrl: './agent-profile.html',
})
export class AgentProfile {
  readonly id = input.required<string>();
  readonly profile = input.required<AgentProfileData>();
  readonly following = input(false);
  readonly variant = input<'inline' | 'dialog'>('inline');
  readonly open = model(false);
  readonly focusFallback = input<HTMLElement | null>(null);
  readonly followRequested = output<boolean>();
  protected readonly agents = AGENTS;
}
