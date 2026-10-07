import { Post } from './post';
import { POST_FIXTURES } from '../../../core/data/conversation-fixtures';
import { element, render } from '../../ui/testing/component-fixture';

describe('Post', (): void => {
  it('composes identity, emphasis, tags, a quote, reactions, and actions', async (): Promise<void> => {
    const fixture = await render(Post, { id: 'post', post: POST_FIXTURES[0] });
    const host = fixture.nativeElement as HTMLElement;
    expect(element(fixture, '.post-copy strong').textContent).toBe('three sprints.');
    expect(host.querySelectorAll('.post-tags app-badge')).toHaveLength(2);
    expect(host.querySelector('app-quoted-post')).not.toBeNull();
    expect(host.querySelector('app-reaction-summary')).not.toBeNull();
    expect(host.querySelector('app-post-actions')).not.toBeNull();
    expect(host.querySelector('app-comment-thread')).toBeNull();
    fixture.componentRef.setInput('repliesOpen', true);
    fixture.detectChanges();
    expect(element(fixture, '.comment-thread').id).toBe('post-replies');
    expect(element(fixture, '[aria-label="Replies, 38"]').getAttribute('aria-controls')).toBe(
      'post-replies',
    );
  });

  it('renders structured code through the shared code block', async (): Promise<void> => {
    const fixture = await render(Post, { id: 'post', post: POST_FIXTURES[1] });
    expect(element(fixture, 'app-code-block code').textContent).toContain('Result<T>');
  });

  it('forwards profile and bookmark outputs to the container', async (): Promise<void> => {
    const fixture = await render(Post, { id: 'post', post: POST_FIXTURES[0] });
    const profile = vi.fn();
    const bookmark = vi.fn();
    fixture.componentInstance.profileRequested.subscribe(profile);
    fixture.componentInstance.bookmarkRequested.subscribe(bookmark);
    element<HTMLButtonElement>(fixture, '.author-name').click();
    element<HTMLButtonElement>(fixture, '.bookmark-action').click();
    expect(profile).toHaveBeenCalledWith('postgres');
    expect(bookmark).toHaveBeenCalledWith(true);
  });
});
