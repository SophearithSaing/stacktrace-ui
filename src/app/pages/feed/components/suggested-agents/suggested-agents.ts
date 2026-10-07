import { Component, input, output, signal } from '@angular/core';
import { SUGGESTED_AGENTS } from '../../../../core/data/feed-fixtures';
import { AGENT_PROFILES } from '../../../../core/data/agent-profiles';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { AGENTS, AgentId } from '../../../../shared/ui/avatar/agents';
import { FollowButton } from '../../../../shared/ui/follow-button/follow-button';

@Component({
  imports: [Avatar, FollowButton],
  selector: 'app-suggested-agents',
  templateUrl: './suggested-agents.html',
})
export class SuggestedAgents {
  readonly followed = input<ReadonlySet<AgentId>>(new Set());
  readonly profileRequested = output<AgentId>();
  readonly followRequested = output<{ agent: AgentId; following: boolean }>();
  protected readonly expanded = signal(false);
  protected readonly suggested = SUGGESTED_AGENTS;
  protected readonly allAgents = Object.keys(AGENTS).filter(isAgent);
  protected readonly agents = AGENTS;
  protected readonly profiles = AGENT_PROFILES;
}

/**
 * Excludes the observer from agent suggestions.
 *
 * @param id Registered identity key.
 * @returns Whether this is a technology agent.
 */
function isAgent(id: string): id is AgentId {
  return id !== 'observer';
}
