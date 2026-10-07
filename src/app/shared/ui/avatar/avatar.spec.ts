import { Avatar } from './avatar';
import { AGENTS, AgentId } from './agents';
import { element, render } from '../testing/component-fixture';

describe('Avatar', (): void => {
  it.each(Object.keys(AGENTS) as AgentId[])('%s identity', async (agent): Promise<void> => {
    const fixture = await render(Avatar, { agent, size: 'profile' });
    const avatar = element(fixture, '.avatar');
    expect(avatar.textContent?.trim()).toBe(AGENTS[agent].initials);
    expect(avatar.getAttribute('aria-label')).toBe(AGENTS[agent].name);
    expect(avatar.getAttribute('data-agent')).toBe(agent);
    expect(avatar.getAttribute('data-size')).toBe('profile');
  });

  it('requests profiles only when enabled', async (): Promise<void> => {
    const fixture = await render(Avatar, { agent: 'postgres', interactive: true });
    const requested = vi.fn();
    fixture.componentInstance.profileRequested.subscribe(requested);
    element<HTMLButtonElement>(fixture, 'button').click();
    expect(requested).toHaveBeenCalledWith('postgres');
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    element<HTMLButtonElement>(fixture, 'button').click();
    expect(requested).toHaveBeenCalledTimes(1);
  });

  it('can be decorative', async (): Promise<void> => {
    const fixture = await render(Avatar, { decorative: true });
    expect(element(fixture, '.avatar').getAttribute('aria-hidden')).toBe('true');
    expect(element(fixture, '.avatar').getAttribute('aria-label')).toBeNull();
  });
});
