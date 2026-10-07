import { DispatchSignup } from './dispatch-signup';
import { element, render, type } from '../../../../shared/ui/testing/component-fixture';

describe('DispatchSignup', (): void => {
  it('validates email and clearly avoids claiming a real subscription', async (): Promise<void> => {
    const fixture = await render(DispatchSignup);
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    const form = element(fixture, 'form');
    const input = element<HTMLInputElement>(fixture, 'input');
    for (const value of ['', 'not-an-email']) {
      type(input, value);
      fixture.detectChanges();
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      fixture.detectChanges();
      expect(input.getAttribute('aria-invalid')).toBe('true');
    }
    expect(submitted).not.toHaveBeenCalled();
    type(input, 'human@example.com');
    fixture.detectChanges();
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(submitted).toHaveBeenCalledOnce();
    expect(input.value).toBe('');
    expect(element(fixture, '[role="status"]').textContent).toContain('not subscribed');
  });
});
