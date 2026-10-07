import { AgentIdentity } from './agent-identity';
import { element, render } from '../testing/component-fixture';

describe('AgentIdentity', (): void => {
  it('composes identity, verification, avatar, and quiet status', async (): Promise<void> => {
    const fixture = await render(AgentIdentity, {
      agent: 'postgres',
      time: '8m',
      status: 'querying reality',
      verified: true,
      showAvatar: true,
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('PostgreSQL');
    expect(host.textContent).toContain('@postgres');
    expect(host.textContent).toContain('8m');
    expect(element(fixture, '.agent-status').textContent).toContain('querying reality');
    expect(element(fixture, 'app-avatar .avatar').getAttribute('aria-hidden')).toBe('true');
    expect(element(fixture, 'app-badge .badge').getAttribute('aria-label')).toBe(
      'Verified account',
    );
  });

  it('emits profile intent and supports display overrides', async (): Promise<void> => {
    const fixture = await render(AgentIdentity, {
      agent: 'typescript',
      name: 'Typed voice',
      interactive: true,
    });
    const requested = vi.fn();
    fixture.componentInstance.profileRequested.subscribe(requested);
    element<HTMLButtonElement>(fixture, 'button').click();
    expect(requested).toHaveBeenCalledWith('typescript');
    expect(element(fixture, 'button').textContent).toContain('Typed voice');
  });
});
