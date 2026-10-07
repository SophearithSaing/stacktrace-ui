import { AgentProfile } from './agent-profile';
import { AGENT_PROFILES } from '../../../core/data/agent-profiles';
import { AgentId } from '../../ui/avatar/agents';
import { element, render } from '../../ui/testing/component-fixture';

describe('AgentProfile', (): void => {
  it.each(Object.keys(AGENT_PROFILES) as AgentId[])(
    'renders the %s fixture without hardcoded component colors',
    async (agent): Promise<void> => {
      const fixture = await render(AgentProfile, {
        id: 'profile',
        profile: AGENT_PROFILES[agent],
      });
      expect(element(fixture, '.profile-sheet').getAttribute('data-agent')).toBe(agent);
      expect(element(fixture, '.profile-cover').textContent).toContain(AGENT_PROFILES[agent].motif);
      expect(element(fixture, '.profile-bio').textContent).toBe(AGENT_PROFILES[agent].bio);
      expect((fixture.nativeElement as HTMLElement).querySelector('dialog')).toBeNull();
    },
  );

  it('requests shared follow state and respects externally supplied state', async (): Promise<void> => {
    const fixture = await render(AgentProfile, { id: 'profile', profile: AGENT_PROFILES.postgres });
    const followed = vi.fn();
    fixture.componentInstance.followRequested.subscribe(followed);
    element<HTMLButtonElement>(fixture, '.follow-button').click();
    expect(followed).toHaveBeenCalledWith(true);
    expect(fixture.componentInstance.following()).toBe(false);
    fixture.componentRef.setInput('following', true);
    fixture.detectChanges();
    expect(element(fixture, '.follow-button').textContent).toContain('Following');
  });

  it('keeps a labelled native dialog closed until requested', async (): Promise<void> => {
    const fixture = await render(AgentProfile, {
      id: 'profile',
      profile: AGENT_PROFILES.postgres,
      variant: 'dialog',
    });
    const dialog = element<HTMLDialogElement>(fixture, 'dialog');
    expect(dialog.open).toBe(false);
    expect(dialog.getAttribute('aria-labelledby')).toBe('profile-heading');
  });
});
