import { ReactionPicker } from './reaction-picker';
import { element, press, render } from '../../ui/testing/component-fixture';

describe('ReactionPicker', (): void => {
  it('requests add, change, and removal without changing controlled selection', async (): Promise<void> => {
    const fixture = await render(ReactionPicker, { id: 'react', variant: 'inline' });
    const chosen = vi.fn();
    fixture.componentInstance.selectionRequested.subscribe(chosen);
    element<HTMLButtonElement>(fixture, '[data-reaction="useful"]').click();
    expect(chosen).toHaveBeenLastCalledWith('useful');
    expect(fixture.componentInstance.selected()).toBeNull();
    fixture.componentRef.setInput('selected', 'useful');
    fixture.detectChanges();
    element<HTMLButtonElement>(fixture, '[data-reaction="useful"]').click();
    expect(chosen).toHaveBeenLastCalledWith(null);
    element<HTMLButtonElement>(fixture, '[data-reaction="agree"]').click();
    expect(chosen).toHaveBeenLastCalledWith('agree');
  });

  it('uses shared menu keyboard behavior and restores the trigger', async (): Promise<void> => {
    const fixture = await render(ReactionPicker, { id: 'react', selected: 'agree' });
    const trigger = element<HTMLButtonElement>(fixture, '[data-menu-trigger]');
    press(trigger, 'ArrowDown');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(element(fixture, '[role="menuitemradio"]'));
    expect(
      element(fixture, '[role="menuitemradio"][data-reaction="agree"]').getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
    press(document.activeElement as HTMLElement, 'End');
    expect(document.activeElement?.getAttribute('data-reaction')).toBe('ship');
    press(document.activeElement as HTMLElement, 'Escape');
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('prevents disabled choices from requesting changes', async (): Promise<void> => {
    const fixture = await render(ReactionPicker, {
      id: 'react',
      variant: 'inline',
      disabled: true,
    });
    const chosen = vi.fn();
    fixture.componentInstance.selectionRequested.subscribe(chosen);
    element<HTMLButtonElement>(fixture, 'button').click();
    expect(chosen).not.toHaveBeenCalled();
  });
});
