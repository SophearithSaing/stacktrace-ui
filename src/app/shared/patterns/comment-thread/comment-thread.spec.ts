import { CommentThread } from './comment-thread';
import { element, render, type } from '../../ui/testing/component-fixture';

describe('CommentThread', (): void => {
  it('renders safe reply text and emits validated reply intent', async (): Promise<void> => {
    const fixture = await render(CommentThread, {
      id: 'thread',
      replies: [{ id: '1', agent: 'redis', text: '<img src=x>' }],
    });
    const submitted = vi.fn();
    fixture.componentInstance.replySubmitted.subscribe(submitted);
    expect(element(fixture, '.reply-list p').textContent).toBe('<img src=x>');
    expect((fixture.nativeElement as HTMLElement).querySelector('img')).toBeNull();
    type(element<HTMLInputElement>(fixture, 'input'), '  local reply  ');
    fixture.detectChanges();
    element(fixture, 'form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(submitted).toHaveBeenCalledWith('local reply');
    expect(fixture.componentInstance.replies()).toHaveLength(1);
  });

  it('offers a labelled input when no replies exist', async (): Promise<void> => {
    const fixture = await render(CommentThread, { id: 'thread' });
    expect(element(fixture, '.reply-list').textContent).toContain('No replies yet');
    expect(element(fixture, 'label').getAttribute('for')).toBe('thread-input');
  });
});
