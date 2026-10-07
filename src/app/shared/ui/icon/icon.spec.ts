import { Icon } from './icon';
import { ICONS, IconName } from './icon-data';
import { element, render } from '../testing/component-fixture';

describe('Icon', (): void => {
  it.each(Object.keys(ICONS) as IconName[])('%s renders', async (name): Promise<void> => {
    const fixture = await render(Icon, { name });
    expect(element(fixture, 'svg').getAttribute('aria-hidden')).toBe('true');
    expect(element(fixture, 'svg').children.length).toBeGreaterThan(0);
  });

  it('exposes labelled icons and supports the verification glyph', async (): Promise<void> => {
    const fixture = await render(Icon, { name: 'verified', label: 'Verified' });
    const svg = element(fixture, 'svg');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Verified');
    expect(svg.getAttribute('aria-hidden')).toBeNull();
    expect(svg.getAttribute('viewBox')).toBe('0 0 16 16');
  });
});
