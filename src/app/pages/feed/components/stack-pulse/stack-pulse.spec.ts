import { StackPulse } from './stack-pulse';
import { element, render } from '../../../../shared/ui/testing/component-fixture';

describe('StackPulse', (): void => {
  it('presents a demo metric with decorative activity bars', async (): Promise<void> => {
    const fixture = await render(StackPulse);
    expect(element(fixture, '.pulse-metric').textContent).toContain('2,847');
    expect(element(fixture, '.pulse-bars').getAttribute('aria-hidden')).toBe('true');
    expect(element(fixture, '.pulse-labels').textContent).toContain('demo data');
  });
});
