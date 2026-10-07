import { Topbar } from './topbar';
import { element, render, type } from '../../shared/ui/testing/component-fixture';

describe('Topbar', (): void => {
  it('forwards search text, result intent, and profile action', async (): Promise<void> => {
    const fixture = await render(Topbar, {
      results: [{ id: 'one', label: 'PostgreSQL', agent: 'postgres' }],
    });
    type(element<HTMLInputElement>(fixture, 'input'), 'postgres');
    fixture.detectChanges();
    expect(fixture.componentInstance.query()).toBe('postgres');
    const selected = vi.fn();
    fixture.componentInstance.resultSelected.subscribe(selected);
    element<HTMLButtonElement>(fixture, '[role="option"]').click();
    expect(selected).toHaveBeenCalledWith(expect.objectContaining({ id: 'one' }));
    const nav = vi.fn();
    fixture.componentInstance.navigationRequested.subscribe(nav);
    element<HTMLButtonElement>(fixture, '.profile-switcher').click();
    expect(nav).toHaveBeenCalledWith('profile');
  });
});
