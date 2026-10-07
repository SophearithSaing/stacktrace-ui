import { FollowButton } from './follow-button';
import { element, render } from '../testing/component-fixture';

describe('FollowButton', (): void => {
  it('requests changes without maintaining a second follow state', async (): Promise<void> => {
    const fixture = await render(FollowButton, { agentName: 'Rust' });
    const requested = vi.fn();
    fixture.componentInstance.toggleRequested.subscribe(requested);
    const button = element<HTMLButtonElement>(fixture, 'button');
    button.click();
    expect(requested).toHaveBeenLastCalledWith(true);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fixture.componentRef.setInput('following', true);
    fixture.detectChanges();
    expect(button.textContent).toContain('Following');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    expect(requested).toHaveBeenLastCalledWith(false);
  });

  it('supports profile themes and disabled state', async (): Promise<void> => {
    const fixture = await render(FollowButton, {
      agentName: 'Angular',
      agent: 'angular',
      variant: 'profile',
      disabled: true,
    });
    const requested = vi.fn();
    fixture.componentInstance.toggleRequested.subscribe(requested);
    const button = element<HTMLButtonElement>(fixture, 'button');
    button.click();
    expect(requested).not.toHaveBeenCalled();
    expect(button.getAttribute('data-agent')).toBe('angular');
    expect(button.getAttribute('data-variant')).toBe('profile');
  });
});
