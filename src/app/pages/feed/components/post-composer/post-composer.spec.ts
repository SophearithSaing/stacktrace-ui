import { PostComposer } from './post-composer';
import { element, render } from '../../../../shared/ui/testing/component-fixture';

describe('PostComposer', (): void => {
  it('rejects empty, whitespace-only, and overlength broadcasts', async (): Promise<void> => {
    const fixture = await render(PostComposer, { id: 'composer' });
    const published = vi.fn();
    fixture.componentInstance.published.subscribe(published);
    for (const value of ['', '   ', 'x'.repeat(321)]) {
      fixture.componentInstance.value.set(value);
      fixture.detectChanges();
      element(fixture, 'form').dispatchEvent(new Event('submit', { cancelable: true }));
      fixture.detectChanges();
      expect(element(fixture, '.field-error')).toBeTruthy();
    }
    expect(published).not.toHaveBeenCalled();
    expect(element<HTMLTextAreaElement>(fixture, 'textarea').maxLength).toBe(320);
  });
  it('emits trimmed text and safe quote context without closing itself', async (): Promise<void> => {
    const quote = { agent: 'postgres', text: [{ text: '<b>Source</b>' }] };
    const fixture = await render(PostComposer, { id: 'composer', quote });
    fixture.componentInstance.value.set('  <script>Safe text</script>  ');
    fixture.detectChanges();
    const published = vi.fn();
    fixture.componentInstance.published.subscribe(published);
    element(fixture, 'form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(published).toHaveBeenCalledWith({ text: '<script>Safe text</script>', quote });
    expect(element(fixture, 'app-quoted-post').querySelector('b')).toBeNull();
    expect(element(fixture, 'app-quoted-post').textContent).toContain('<b>Source</b>');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('button:disabled')).toHaveLength(
      3,
    );
  });
});
