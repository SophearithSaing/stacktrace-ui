import { MainNavigation } from './main-navigation';
import { element, render } from '../../shared/ui/testing/component-fixture';

describe('MainNavigation', (): void => {
  it('marks one active item and emits typed in-page intents', async (): Promise<void> => {
    const fixture = await render(MainNavigation, { active: 'bookmarks' });
    const intent = vi.fn();
    fixture.componentInstance.navigationRequested.subscribe(intent);
    expect(element(fixture, '[aria-current]').textContent).toContain('Bookmarks');
    element<HTMLButtonElement>(fixture, 'button').click();
    expect(intent).toHaveBeenCalledWith('home');
  });
  it('retains creation and profile access in the five-item mobile model', async (): Promise<void> => {
    const fixture = await render(MainNavigation, { variant: 'mobile' });
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('button')).toHaveLength(5);
    const intent = vi.fn();
    fixture.componentInstance.navigationRequested.subscribe(intent);
    element<HTMLButtonElement>(fixture, '.nav-compose').click();
    expect(intent).toHaveBeenCalledWith('compose');
  });
});
