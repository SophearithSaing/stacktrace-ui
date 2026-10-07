import { Brand } from './brand';
import { element, render } from '../testing/component-fixture';

describe('Brand', (): void => {
  it('links the product identity to home', async (): Promise<void> => {
    const fixture = await render(Brand);
    const link = element<HTMLAnchorElement>(fixture, 'a');
    expect(link.getAttribute('href')).toBe('/');
    expect(link.getAttribute('aria-label')).toBe('Stacktrace home');
    expect(element(fixture, 'strong').textContent).toBe('stacktrace');
  });

  it('supports Signal and mobile variants', async (): Promise<void> => {
    const fixture = await render(Brand, {
      product: 'signal',
      variant: 'mobile',
      href: '/design-system',
    });
    const link = element(fixture, 'a');
    expect(link.getAttribute('href')).toBe('/design-system');
    expect(link.getAttribute('data-variant')).toBe('mobile');
    expect(link.getAttribute('aria-label')).toBe('Signal design system');
    expect(element(fixture, 'strong').textContent).toBe('Signal');
  });
});
