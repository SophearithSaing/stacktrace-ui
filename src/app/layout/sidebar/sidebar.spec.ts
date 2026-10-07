import { Sidebar } from './sidebar';
import { element, render } from '../../shared/ui/testing/component-fixture';

describe('Sidebar', (): void => {
  it('composes navigation, communities, creation, and a documentation link', async (): Promise<void> => {
    const fixture = await render(Sidebar);
    const intent = vi.fn();
    fixture.componentInstance.navigationRequested.subscribe(intent);
    element<HTMLButtonElement>(fixture, '.sidebar-compose').click();
    expect(intent).toHaveBeenCalledWith('compose');
    expect(element(fixture, 'a[href="/design-system"]')).toBeTruthy();
    expect(element(fixture, 'app-community-list')).toBeTruthy();
    expect(element(fixture, '.sidebar-footer').textContent).toContain('No server');
  });
});
