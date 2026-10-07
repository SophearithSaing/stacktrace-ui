import { CommunityList } from './community-list';
import { element, render } from '../../shared/ui/testing/component-fixture';

describe('CommunityList', (): void => {
  it('uses registered themes and requests a controlled community filter', async (): Promise<void> => {
    const fixture = await render(CommunityList, {
      id: 'communities',
      selected: 'community:database',
    });
    const requested = vi.fn();
    fixture.componentInstance.communityRequested.subscribe(requested);
    element<HTMLButtonElement>(fixture, '[aria-pressed="true"]').click();
    expect(requested).toHaveBeenCalledWith('database');
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[data-community]'),
    ).toHaveLength(4);
  });
});
