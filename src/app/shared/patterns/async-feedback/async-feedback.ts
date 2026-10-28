import { Component, input, output } from '@angular/core';
import { AsyncViewState } from '../../models/async-state';
import { EmptyState } from '../../ui/empty-state/empty-state';

@Component({
  imports: [EmptyState],
  selector: 'app-async-feedback',
  templateUrl: './async-feedback.html',
})
export class AsyncFeedback {
  readonly state = input.required<AsyncViewState>();
  readonly retryRequested = output<void>();
  readonly moreRequested = output<void>();
}
