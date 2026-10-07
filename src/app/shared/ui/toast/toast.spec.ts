import { Toast, TOAST_DURATION } from './toast';
import { element, render } from '../testing/component-fixture';

describe('Toast', (): void => {
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('uses polite feedback without announcing closed messages', async (): Promise<void> => {
    const fixture = await render(Toast, { message: 'Saved' });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('role')).toBe('status');
    expect(host.getAttribute('aria-live')).toBe('polite');
    expect(element(fixture, '.toast').textContent?.trim()).toBe('');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(element(fixture, '.toast').textContent).toContain('Saved');
  });

  it('restarts timers on updates and emits dismissal', async (): Promise<void> => {
    const fixture = await render(Toast);
    vi.useFakeTimers();
    const dismissed = vi.fn();
    fixture.componentInstance.dismissed.subscribe(dismissed);
    fixture.componentRef.setInput('message', 'Saved');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    vi.advanceTimersByTime(TOAST_DURATION - 1);
    fixture.componentRef.setInput('message', 'Updated');
    fixture.detectChanges();
    vi.advanceTimersByTime(1);
    expect(fixture.componentInstance.open()).toBe(true);
    vi.advanceTimersByTime(TOAST_DURATION - 1);
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(dismissed).toHaveBeenCalledOnce();
    expect(element(fixture, '.toast').textContent?.trim()).toBe('');
  });

  it('supports persistent messages and cleans up timers on destruction', async (): Promise<void> => {
    const fixture = await render(Toast);
    vi.useFakeTimers();
    fixture.componentRef.setInput('message', 'Saved');
    fixture.componentRef.setInput('duration', 0);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(vi.getTimerCount()).toBe(0);
    fixture.componentRef.setInput('duration', TOAST_DURATION);
    fixture.detectChanges();
    expect(vi.getTimerCount()).toBe(1);
    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
