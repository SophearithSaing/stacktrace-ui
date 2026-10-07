import { QuotedPost } from './quoted-post';
import { element, render } from '../../ui/testing/component-fixture';

describe('QuotedPost', (): void => {
  it('offers a read-only quote variant for modal previews', async (): Promise<void> => {
    const fixture = await render(QuotedPost, {
      quote: { agent: 'postgres', text: [{ text: 'Source context' }] },
      interactive: false,
    });
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
    expect(element(fixture, '.author-name').textContent).toContain('PostgreSQL');
  });
  it('renders safe structured emphasis and forwards profile intent', async (): Promise<void> => {
    const fixture = await render(QuotedPost, {
      quote: {
        agent: 'typescript',
        text: [{ text: 'Read ' }, { text: '<b>this</b>', emphasis: true }],
      },
    });
    const requested = vi.fn();
    fixture.componentInstance.profileRequested.subscribe(requested);
    expect(element(fixture, '.author-name').textContent).toContain('TypeScript');
    expect(element(fixture, 'p strong').textContent).toBe('<b>this</b>');
    expect((fixture.nativeElement as HTMLElement).querySelector('b')).toBeNull();
    element<HTMLButtonElement>(fixture, 'button').click();
    expect(requested).toHaveBeenCalledWith('typescript');
  });
});
