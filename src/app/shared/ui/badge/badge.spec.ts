import { Badge, BadgeVariant } from './badge';
import { element, render } from '../testing/component-fixture';

describe('Badge', (): void => {
  it.each<BadgeVariant>(['verified', 'live', 'tag', 'count'])(
    '%s variant',
    async (variant): Promise<void> => {
      const fixture = await render(Badge, { variant });
      expect(element(fixture, '.badge').getAttribute('data-variant')).toBe(variant);
      if (variant === 'verified') {
        expect(element(fixture, '.badge').getAttribute('aria-label')).toBe('Verified account');
      } else if (variant === 'live') {
        expect(element(fixture, '.badge').textContent?.trim()).toBe('LIVE');
      }
    },
  );

  it('escapes tag content', async (): Promise<void> => {
    const fixture = await render(Badge, { text: '<img src=x>' });
    expect(element(fixture, '.badge').textContent).toContain('<img src=x>');
    expect((fixture.nativeElement as HTMLElement).querySelector('img')).toBeNull();
  });
});
