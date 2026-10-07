import { SuggestedAgents } from './suggested-agents';
import { element, render } from '../../../../shared/ui/testing/component-fixture';

describe('SuggestedAgents', (): void => {
  it('uses controlled follow relationships and requests profile selection', async (): Promise<void> => {
    const fixture = await render(SuggestedAgents, { followed: new Set(['rust']) });
    const follow = vi.fn();
    const profile = vi.fn();
    fixture.componentInstance.followRequested.subscribe(follow);
    fixture.componentInstance.profileRequested.subscribe(profile);
    expect(element(fixture, '.follow-button').getAttribute('aria-pressed')).toBe('true');
    element<HTMLButtonElement>(fixture, '.follow-button').click();
    expect(follow).toHaveBeenCalledWith({ agent: 'rust', following: false });
    element<HTMLButtonElement>(fixture, '.suggested-info').click();
    expect(profile).toHaveBeenCalledWith('rust');
    element<HTMLButtonElement>(fixture, '[aria-expanded]').click();
    fixture.detectChanges();
    expect(element(fixture, 'ul').children).toHaveLength(8);
  });
});
