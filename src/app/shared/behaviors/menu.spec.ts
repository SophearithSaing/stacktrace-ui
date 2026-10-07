import { Component, signal } from '@angular/core';
import { Menu } from './menu';
import { element, press, render } from '../ui/testing/component-fixture';

@Component({
  imports: [Menu],
  template: `
    <div [(appMenu)]="open">
      <button data-menu-trigger aria-haspopup="menu" [attr.aria-expanded]="open()">Open</button>
      @if (open()) {
        <div role="menu" aria-label="Test menu">
          <button role="menuitem" tabindex="-1">First</button>
          <button role="menuitem" tabindex="-1" disabled>Unavailable</button>
          <button role="menuitem" tabindex="-1">Last</button>
        </div>
      }
    </div>
  `,
})
class MenuHost {
  readonly open = signal(false);
}

describe('Menu behavior', (): void => {
  it('wraps arrows, skips disabled choices, and supports Home/End', async (): Promise<void> => {
    const fixture = await render(MenuHost);
    press(element(fixture, '[data-menu-trigger]'), 'ArrowUp');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement?.textContent).toBe('Last');
    press(document.activeElement as HTMLElement, 'ArrowDown');
    expect(document.activeElement?.textContent).toBe('First');
    press(document.activeElement as HTMLElement, 'ArrowRight');
    expect(document.activeElement?.textContent).toBe('Last');
    press(document.activeElement as HTMLElement, 'Home');
    expect(document.activeElement?.textContent).toBe('First');
    press(document.activeElement as HTMLElement, 'End');
    expect(document.activeElement?.textContent).toBe('Last');
  });

  it('dismisses on Escape, Tab, and outside pointer interaction', async (): Promise<void> => {
    const fixture = await render(MenuHost);
    const trigger = element<HTMLButtonElement>(fixture, '[data-menu-trigger]');
    for (const key of ['Escape', 'Tab']) {
      trigger.click();
      fixture.detectChanges();
      await fixture.whenStable();
      press(document.activeElement as HTMLElement, key);
      fixture.detectChanges();
      expect(fixture.componentInstance.open()).toBe(false);
      expect(document.activeElement).toBe(trigger);
    }
    trigger.click();
    fixture.detectChanges();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('repositions overflowing panels and limits height to available viewport space', async (): Promise<void> => {
    const fixture = await render(MenuHost);
    element<HTMLButtonElement>(fixture, '[data-menu-trigger]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = element(fixture, '[role="menu"]');
    vi.spyOn(element(fixture, 'div'), 'getBoundingClientRect').mockReturnValue({
      top: 80,
      bottom: 112,
    } as DOMRect);
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      left: -20,
      right: 250,
      top: -60,
      bottom: 73,
      height: 133,
    } as DOMRect);
    window.dispatchEvent(new Event('resize'));
    expect(panel.style.getPropertyValue('--menu-shift')).toBe('20px');
    expect(panel.style.getPropertyValue('--menu-bottom')).toBe('auto');
    expect(panel.style.getPropertyValue('--menu-available-height')).toBe(
      window.innerHeight - 119 + 'px',
    );
    vi.restoreAllMocks();
  });
});
