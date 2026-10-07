import { SearchField, SearchResult } from './search-field';
import { element, press, render, type } from '../testing/component-fixture';

const results: readonly SearchResult[] = [
  { id: 'pg', label: 'PostgreSQL', agent: 'postgres' },
  { id: 'ts', label: 'TypeScript', description: 'Narrowing possibilities' },
];

describe('SearchField', (): void => {
  it('selects keyboard results without moving focus out of search', async (): Promise<void> => {
    const fixture = await render(SearchField, { id: 'search', results });
    const chosen = vi.fn();
    fixture.componentInstance.resultSelected.subscribe(chosen);
    const input = element<HTMLInputElement>(fixture, 'input');
    input.focus();
    type(input, 'types');
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('types');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    press(input, 'ArrowUp');
    fixture.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBe('search-result-1');
    press(input, 'ArrowDown');
    fixture.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBe('search-result-0');
    press(input, 'Enter');
    fixture.detectChanges();
    expect(chosen).toHaveBeenCalledWith(results[0]);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(input);
  });

  it('resets selection on new results and supports pointer choices', async (): Promise<void> => {
    const fixture = await render(SearchField, { id: 'search', results });
    const chosen = vi.fn();
    fixture.componentInstance.resultSelected.subscribe(chosen);
    const input = element<HTMLInputElement>(fixture, 'input');
    type(input, 'stack');
    fixture.detectChanges();
    press(input, 'ArrowDown');
    fixture.componentRef.setInput('results', [results[1]]);
    fixture.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    element<HTMLButtonElement>(fixture, '[role="option"]').click();
    fixture.detectChanges();
    expect(chosen).toHaveBeenCalledWith(results[1]);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('handles empty/loading results and dismisses without clearing text', async (): Promise<void> => {
    const fixture = await render(SearchField, { id: 'search' });
    const input = element<HTMLInputElement>(fixture, 'input');
    type(input, 'missing');
    fixture.detectChanges();
    expect(element(fixture, '[role="status"]').textContent).toContain('No stack chatter');
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(element(fixture, '[role="status"]').textContent).toContain('Searching');
    press(input, 'Escape');
    fixture.detectChanges();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.componentInstance.value()).toBe('missing');
    input.focus();
    fixture.detectChanges();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    input.blur();
  });

  it('opts into slash focus without stealing it from editors', async (): Promise<void> => {
    const fixture = await render(SearchField, { id: 'search', shortcut: true });
    const input = element<HTMLInputElement>(fixture, 'input');
    expect(press(document, '/').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(press(input, '/').defaultPrevented).toBe(false);
    input.blur();
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(press(document, '/').defaultPrevented).toBe(false);
    expect(document.activeElement).not.toBe(input);
  });

  it('renders result labels as text', async (): Promise<void> => {
    const fixture = await render(SearchField, {
      id: 'safe',
      results: [{ id: 'x', label: '<img src=x>' }],
    });
    type(element<HTMLInputElement>(fixture, 'input'), 'x');
    fixture.detectChanges();
    expect(element(fixture, 'strong').textContent).toBe('<img src=x>');
    expect((fixture.nativeElement as HTMLElement).querySelector('img')).toBeNull();
  });
});
