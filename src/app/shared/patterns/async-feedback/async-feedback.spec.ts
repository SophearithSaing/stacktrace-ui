import { AsyncViewState } from '../../models/async-state';
import { Component, signal } from '@angular/core';
import axe from 'axe-core';
import { element, render } from '../../ui/testing/component-fixture';
import { AsyncFeedback } from './async-feedback';

const initial: AsyncViewState = {
  phase: 'idle',
  hasContent: false,
  empty: false,
  stale: false,
  error: null,
  canRetry: false,
  canLoadMore: false,
};

@Component({
  imports: [AsyncFeedback],
  template: `
    <label>Draft<textarea [value]="draft" (input)="updateDraft($event)"></textarea></label>
    <p class="loaded-row">Existing row</p>
    <app-async-feedback [state]="state()" (retryRequested)="retry()" />
  `,
})
class FeedbackHarness {
  draft = '';
  retries = 0;
  readonly state = signal<AsyncViewState>({
    ...initial,
    phase: 'error',
    hasContent: true,
    stale: true,
    error: 'request',
    canRetry: true,
  });

  updateDraft(event: Event): void {
    this.draft = (event.target as HTMLTextAreaElement).value;
  }

  retry(): void {
    this.retries += 1;
    this.state.set({ ...this.state(), phase: 'refreshing', canRetry: false });
  }
}

describe('AsyncFeedback', (): void => {
  it.each(['loading', 'refreshing', 'loading-more'] as const)(
    'announces %s politely',
    async (phase): Promise<void> => {
      const fixture = await render(AsyncFeedback, { state: { ...initial, phase } });
      const status = element(fixture, '[role="status"]');
      expect(status.getAttribute('aria-live')).toBe('polite');
      expect(status.textContent?.trim().length).toBeGreaterThan(0);
      expect((fixture.nativeElement as HTMLElement).querySelector('app-empty-state')).toBeNull();
    },
  );

  it('distinguishes empty success from network failure and never displays raw error payloads', async (): Promise<void> => {
    const fixture = await render(AsyncFeedback, {
      state: { ...initial, phase: 'ready', empty: true },
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No results yet.');
    fixture.componentRef.setInput('state', {
      ...initial,
      phase: 'error',
      error: 'network',
      canRetry: true,
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-empty-state')).toBeNull();
    expect(element(fixture, '[role="status"]').textContent).toContain('Could not connect');
    expect(element<HTMLButtonElement>(fixture, 'button').textContent).toContain('Retry');
  });

  it('preserves the caller content and draft while retrying stale-content failures', async (): Promise<void> => {
    const fixture = await render(FeedbackHarness);
    const host = fixture.nativeElement as HTMLElement;
    const draft = element<HTMLTextAreaElement>(fixture, 'textarea');
    draft.value = 'Unsubmitted draft';
    draft.dispatchEvent(new Event('input', { bubbles: true }));
    const rows = element(fixture, '.loaded-row');
    expect(element(fixture, '[role="status"]').textContent).toContain(
      'Previously loaded content remains visible',
    );
    const button = element<HTMLButtonElement>(fixture, 'button');
    button.click();
    expect(fixture.componentInstance.retries).toBe(1);
    fixture.detectChanges();
    expect(element<HTMLButtonElement>(fixture, 'button')).toBe(button);
    expect(button.disabled).toBe(true);
    expect(draft.value).toBe('Unsubmitted draft');
    expect(fixture.componentInstance.draft).toBe('Unsubmitted draft');
    expect(host.contains(rows)).toBe(true);
  });

  it.each(['loading', 'error', 'ready'] as const)(
    'has no structural axe violations in %s state',
    async (phase): Promise<void> => {
      const fixture = await render(AsyncFeedback, {
        state: {
          ...initial,
          phase,
          error: phase === 'error' ? 'network' : null,
          canRetry: phase === 'error',
          empty: phase === 'ready',
        },
      });
      const result = await axe.run(fixture.nativeElement as HTMLElement, {
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(result.violations).toEqual([]);
    },
  );

  it('emits explicit load-more intent and keeps its disabled button stable during work', async (): Promise<void> => {
    const fixture = await render(AsyncFeedback, {
      state: { ...initial, phase: 'ready', hasContent: true, canLoadMore: true },
    });
    const more = vi.fn();
    fixture.componentInstance.moreRequested.subscribe(more);
    const button = element<HTMLButtonElement>(fixture, 'button');
    button.click();
    expect(more).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('state', { ...initial, phase: 'loading-more', hasContent: true });
    fixture.detectChanges();
    expect(element<HTMLButtonElement>(fixture, 'button')).toBe(button);
    expect(button.disabled).toBe(true);
    button.click();
    expect(more).toHaveBeenCalledOnce();
  });
});
