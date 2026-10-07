import { Tabs, TabItem } from './tabs';
import { element, press, render } from '../testing/component-fixture';

const items: readonly TabItem[] = [
  { id: 'you', label: 'For you', panelId: 'feed' },
  { id: 'disabled', label: 'Unavailable', disabled: true },
  { id: 'following', label: 'Following', panelId: 'feed' },
  { id: 'spicy', label: 'Spicy takes', panelId: 'feed' },
];

describe('Tabs', (): void => {
  it('defaults to the first enabled tab and exposes panel relationships', async (): Promise<void> => {
    const fixture = await render(Tabs, { id: 'filters', items });
    const first = element(fixture, '#filters-tab-you');
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(first.getAttribute('tabindex')).toBe('0');
    expect(first.getAttribute('aria-controls')).toBe('feed');
    expect(element(fixture, '#filters-tab-disabled').getAttribute('tabindex')).toBe('-1');
  });

  it('supports arrows, Home, and End while skipping disabled tabs', async (): Promise<void> => {
    const fixture = await render(Tabs, { id: 'filters', items });
    press(element(fixture, '#filters-tab-you'), 'ArrowRight');
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe('following');
    expect(document.activeElement).toBe(element(fixture, '#filters-tab-following'));
    press(document.activeElement as HTMLElement, 'End');
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe('spicy');
    press(document.activeElement as HTMLElement, 'ArrowRight');
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe('you');
    press(document.activeElement as HTMLElement, 'ArrowLeft');
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe('spicy');
    press(document.activeElement as HTMLElement, 'Home');
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe('you');
  });

  it('handles removed and disabled selections', async (): Promise<void> => {
    const fixture = await render(Tabs, { id: 'filters', items, selected: 'spicy' });
    fixture.componentRef.setInput('items', [items[0], items[1]]);
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe('you');
    expect(element(fixture, '#filters-tab-you').getAttribute('aria-selected')).toBe('true');
    fixture.componentRef.setInput('items', [items[1]]);
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe('');
    expect(element(fixture, 'button').getAttribute('aria-selected')).toBe('false');
    expect(element(fixture, 'button').getAttribute('tabindex')).toBe('-1');
    fixture.componentRef.setInput('items', []);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });
});
