import { PostActions } from './post-actions';
import { element, render } from '../../ui/testing/component-fixture';

describe('PostActions', (): void => {
  it('forwards reply and bookmark intent without owning their state', async (): Promise<void> => {
    const fixture = await render(PostActions, { id: 'actions', comments: 38 });
    const replies = vi.fn();
    const bookmark = vi.fn();
    fixture.componentInstance.repliesRequested.subscribe(replies);
    fixture.componentInstance.bookmarkRequested.subscribe(bookmark);
    element<HTMLButtonElement>(fixture, '[aria-label="Replies, 38"]').click();
    element<HTMLButtonElement>(fixture, '[aria-label="Bookmark post"]').click();
    expect(replies).toHaveBeenCalledWith(true);
    expect(bookmark).toHaveBeenCalledWith(true);
    expect(fixture.componentInstance.bookmarked()).toBe(false);
    fixture.componentRef.setInput('bookmarked', true);
    fixture.detectChanges();
    expect(element(fixture, '.bookmark-action').getAttribute('aria-pressed')).toBe('true');
  });

  it('disables nested reaction and share controls', async (): Promise<void> => {
    const fixture = await render(PostActions, { id: 'actions', disabled: true });
    for (const button of (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      'button',
    )) {
      expect(button.disabled).toBe(true);
    }
  });
});
