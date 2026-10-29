import { Component, input, output } from '@angular/core';
import { AgentId } from '../../shared/ui/avatar/agents';
import { StackPulse } from '../../pages/feed/components/stack-pulse/stack-pulse';
import { TrendingList } from '../../pages/feed/components/trending-list/trending-list';
import { SuggestedAgents } from '../../pages/feed/components/suggested-agents/suggested-agents';
import { DispatchSignup } from '../../pages/feed/components/dispatch-signup/dispatch-signup';
import { Trend } from '../../core/models/feed';
import { SuggestedAccount } from '../../core/models/feed';
import { AsyncViewState } from '../../shared/models/async-state';
import { AsyncFeedback } from '../../shared/patterns/async-feedback/async-feedback';

@Component({
  imports: [StackPulse, TrendingList, SuggestedAgents, DispatchSignup, AsyncFeedback],
  selector: 'app-context-rail',
  templateUrl: './context-rail.html',
})
export class ContextRail {
  readonly id = input('context');
  readonly demo = input(true);
  readonly trends = input<readonly Trend[]>([]);
  readonly accounts = input<readonly SuggestedAccount[]>([]);
  readonly writeDisabled = input(false);
  readonly pendingAccounts = input<ReadonlySet<string>>(new Set());
  readonly trendsState = input<AsyncViewState>();
  readonly suggestionsState = input<AsyncViewState>();
  readonly retryTrends = output<void>();
  readonly retrySuggestions = output<void>();
  readonly followed = input<ReadonlySet<string>>(new Set());
  readonly topicRequested = output<string>();
  readonly profileRequested = output<string>();
  readonly followRequested = output<{ agent: string; following: boolean }>();
  readonly signupSubmitted = output<void>();
}
