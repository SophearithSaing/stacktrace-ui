import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.html',
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly actionLabel = input('');
  readonly variant = input<'default' | 'compact'>('default');
  readonly actionRequested = output<void>();

  /**
   * Requests the recovery action supplied by the consumer.
   */
  protected requestAction(): void {
    this.actionRequested.emit();
  }
}
