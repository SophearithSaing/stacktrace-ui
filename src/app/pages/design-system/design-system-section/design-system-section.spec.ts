import { Component } from '@angular/core';
import { DesignSystemSection } from './design-system-section';
import { element, render } from '../../../shared/ui/testing/component-fixture';

@Component({
  imports: [DesignSystemSection],
  template: `
    <app-design-system-section
      [id]="'sample'"
      number="01"
      title="Color palette"
      description="Quiet neutrals."
    >
      <p data-specimen>Projected live specimen</p>
    </app-design-system-section>
  `,
})
class SectionHost {}

describe('DesignSystemSection', (): void => {
  it('renders a numbered, labelled section with projected content', async (): Promise<void> => {
    const fixture = await render(SectionHost);
    expect(element(fixture, 'section').getAttribute('id')).toBe('sample');
    expect(element(fixture, 'section').getAttribute('aria-labelledby')).toBe('sample-heading');
    expect(element(fixture, 'h2').textContent).toBe('Color palette');
    expect(element(fixture, '.ds-label').textContent).toContain('01 / Foundations');
    expect(element(fixture, '[data-specimen]').textContent).toBe('Projected live specimen');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('#sample')).toHaveLength(1);
  });

  it('supports pattern headings and optional descriptions', async (): Promise<void> => {
    const fixture = await render(DesignSystemSection, {
      id: 'patterns',
      number: '05',
      title: 'Patterns',
      category: 'Patterns',
    });
    expect(element(fixture, '.ds-label').textContent).toBe('05 / Patterns');
    expect((fixture.nativeElement as HTMLElement).querySelector('.ds-section-head p')).toBeNull();
  });
});
