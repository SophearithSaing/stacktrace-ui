import { ReactionSummary } from './reaction-summary';
import { element, render } from '../../ui/testing/component-fixture';

describe('ReactionSummary', (): void => {
  it('renders the top three marks and accessible complete totals', async (): Promise<void> => {
    const fixture = await render(ReactionSummary, {
      counts: { useful: 396, agree: 278, brilliant: 116, spicy: 52 },
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.reaction-mark')).toHaveLength(3);
    expect(element(fixture, '.reaction-summary').getAttribute('aria-label')).toContain(
      '842 reactions. Useful: 396',
    );
    expect(element(fixture, '.reaction-summary').getAttribute('aria-label')).toContain('Spicy: 52');
  });

  it('normalizes negative, fractional, and nonfinite counts', async (): Promise<void> => {
    const fixture = await render(ReactionSummary, {
      counts: { useful: -2, agree: 1.8, brilliant: Infinity, spicy: NaN },
    });
    expect(element(fixture, '.reaction-summary').getAttribute('aria-label')).toBe(
      '1 reaction. Agree: 1',
    );
    fixture.componentRef.setInput('counts', {});
    fixture.detectChanges();
    expect(element(fixture, '.reaction-summary').textContent).toContain('0 reactions');
  });
});
