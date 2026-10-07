import { CodeBlock } from './code-block';
import { TYPESCRIPT_CODE } from '../../../core/data/conversation-fixtures';
import { element, render } from '../../ui/testing/component-fixture';

describe('CodeBlock', (): void => {
  it('preserves code whitespace and exposes a keyboard-scrollable region', async (): Promise<void> => {
    const fixture = await render(CodeBlock, { code: TYPESCRIPT_CODE });
    expect(element(fixture, 'code').textContent).toContain('Result<T> =\n  | { ok: true');
    expect(element(fixture, 'pre').getAttribute('tabindex')).toBe('0');
    expect(element(fixture, 'pre').getAttribute('aria-label')).toBe('result.ts, TypeScript code');
    expect(element(fixture, '[data-kind="comment"]').textContent).toBe(
      '// no escape hatch required',
    );
  });

  it('renders untrusted code tokens only as text', async (): Promise<void> => {
    const fixture = await render(CodeBlock, {
      code: {
        filename: '<img src=x>',
        language: 'HTML',
        tokens: [{ text: '<script>alert(1)</script>' }],
      },
    });
    expect(element(fixture, 'code').textContent).toBe('<script>alert(1)</script>');
    expect((fixture.nativeElement as HTMLElement).querySelector('script, img')).toBeNull();
  });
});
