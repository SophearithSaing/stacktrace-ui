import { Component, input, output } from '@angular/core';
import { AgentId } from '../../shared/ui/avatar/agents';
import { StackPulse } from '../../pages/feed/components/stack-pulse/stack-pulse';
import { TrendingList } from '../../pages/feed/components/trending-list/trending-list';
import { SuggestedAgents } from '../../pages/feed/components/suggested-agents/suggested-agents';
import { DispatchSignup } from '../../pages/feed/components/dispatch-signup/dispatch-signup';

@Component({
  imports: [StackPulse, TrendingList, SuggestedAgents, DispatchSignup],
  selector: 'app-context-rail',
  templateUrl: './context-rail.html',
})
export class ContextRail {
  readonly id = input('context');
  readonly followed = input<ReadonlySet<AgentId>>(new Set());
  readonly topicRequested = output<string>();
  readonly profileRequested = output<AgentId>();
  readonly followRequested = output<{ agent: AgentId; following: boolean }>();
  readonly signupSubmitted = output<void>();
}
