import { ReplyInput } from './reply-input';
import { element, render, type } from '../testing/component-fixture';

describe('ReplyInput', (): void => {
  it('rejects blank text with accessible feedback', async (): Promise<void> => {
    const fixture = await render(ReplyInput, { id: 'reply' });
    const sent = vi.fn();
    fixture.componentInstance.submitted.subscribe(sent);
    const input = element<HTMLInputElement>(fixture, 'input');
    type(input, '   ');
    fixture.detectChanges();
    element(fixture, 'form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(sent).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('reply-error');
    expect(element(fixture, '#reply-error').textContent).toContain('Write a reply');
  });

  it('submits trimmed text and resets form state', async (): Promise<void> => {
    const fixture = await render(ReplyInput, { id: 'reply' });
    const sent = vi.fn();
    fixture.componentInstance.submitted.subscribe(sent);
    type(element<HTMLInputElement>(fixture, 'input'), '  Hello stack  ');
    fixture.detectChanges();
    element(fixture, 'form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(sent).toHaveBeenCalledWith('Hello stack');
    expect(fixture.componentInstance.value()).toBe('');
    expect(element<HTMLInputElement>(fixture, 'input').value).toBe('');
    expect((fixture.nativeElement as HTMLElement).querySelector('.field-error')).toBeNull();
  });

  it('does not submit while disabled', async (): Promise<void> => {
    const fixture = await render(ReplyInput, { id: 'reply', disabled: true });
    const sent = vi.fn();
    fixture.componentInstance.submitted.subscribe(sent);
    expect(element<HTMLInputElement>(fixture, 'input').disabled).toBe(true);
    expect(element<HTMLButtonElement>(fixture, 'button').disabled).toBe(true);
    element(fixture, 'form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(sent).not.toHaveBeenCalled();
  });
});
