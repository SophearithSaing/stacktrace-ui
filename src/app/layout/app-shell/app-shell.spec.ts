import { AppShell } from './app-shell';
import { FeedState } from '../../core/state/feed-state';
import { element, render } from '../../shared/ui/testing/component-fixture';

describe('AppShell', (): void => {
  it('coordinates one local state across sidebar, dialogs, and rail', async (): Promise<void> => {
    const fixture = await render(AppShell);
    const state = fixture.debugElement.injector.get(FeedState);
    element<HTMLButtonElement>(fixture, '.sidebar-compose').click();
    fixture.detectChanges();
    expect(state.composerOpen()).toBe(true);
    element<HTMLButtonElement>(fixture, '.product-sidebar [aria-label="Explore"]').click();
    fixture.detectChanges();
    expect(state.view()).toBe('explore');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.mobile-dock')).toHaveLength(1);
  });
  it('gives a documentation shell its own state and disables the global shortcut', async (): Promise<void> => {
    const fixture = await render(AppShell, { id: 'docs-shell', variant: 'specimen' });
    expect(element(fixture, '.product-shell').classList.contains('shell-specimen')).toBe(true);
    expect(element(fixture, '.product-main').getAttribute('role')).toBe('region');
    expect((fixture.nativeElement as HTMLElement).querySelector('kbd')).toBeNull();
  });
});
