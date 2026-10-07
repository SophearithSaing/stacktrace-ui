import { TrendingList } from './trending-list';
import { element, render } from '../../../../shared/ui/testing/component-fixture';

describe('TrendingList', (): void => {
  it('expands and collapses registered trends and emits a topic intent', async (): Promise<void> => {
    const fixture = await render(TrendingList);
    const list = element(fixture, 'ol');
    expect(list.children).toHaveLength(4);
    element<HTMLButtonElement>(fixture, '[aria-expanded]').click();
    fixture.detectChanges();
    expect(list.children).toHaveLength(6);
    expect(element(fixture, '[aria-expanded]').getAttribute('aria-expanded')).toBe('true');
    const topic = vi.fn();
    fixture.componentInstance.topicRequested.subscribe(topic);
    element<HTMLButtonElement>(fixture, '.trend').click();
    expect(topic).toHaveBeenCalledWith('#isMicroservicesOkay');
    element<HTMLButtonElement>(fixture, '[aria-expanded]').click();
    fixture.detectChanges();
    expect(list.children).toHaveLength(4);
  });
});
