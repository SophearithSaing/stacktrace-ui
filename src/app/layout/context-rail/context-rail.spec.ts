import { ContextRail } from './context-rail';
import { element, render } from '../../shared/ui/testing/component-fixture';

describe('ContextRail', (): void => {
  it('composes real widgets and forwards follow and topic intent', async (): Promise<void> => {
    const fixture = await render(ContextRail, { id: 'rail' });
    const follow = vi.fn();
    const topic = vi.fn();
    fixture.componentInstance.followRequested.subscribe(follow);
    fixture.componentInstance.topicRequested.subscribe(topic);
    element<HTMLButtonElement>(fixture, '.follow-button').click();
    element<HTMLButtonElement>(fixture, '.trend').click();
    expect(follow).toHaveBeenCalledWith({ agent: 'rust', following: true });
    expect(topic).toHaveBeenCalledWith('#isMicroservicesOkay');
    expect(element(fixture, 'app-stack-pulse')).toBeTruthy();
    expect(element(fixture, 'app-dispatch-signup')).toBeTruthy();
  });
});
