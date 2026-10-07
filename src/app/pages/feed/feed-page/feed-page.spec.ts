import { TestBed } from '@angular/core/testing';
import { FeedPage } from './feed-page';
import { FeedState } from '../../../core/state/feed-state';
import axe from 'axe-core';
import { element, render } from '../../../shared/ui/testing/component-fixture';

describe('FeedPage', (): void => {
  beforeEach((): void => {
    TestBed.configureTestingModule({ providers: [FeedState] });
  });
  it('composes all posts and filters through real shared tabs', async (): Promise<void> => {
    const fixture = await render(FeedPage);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-post')).toHaveLength(9);
    element<HTMLButtonElement>(fixture, '#feed-tabs-tab-spicy').click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-post')).toHaveLength(3);
    expect(element(fixture, '[role="tabpanel"]').getAttribute('aria-labelledby')).toBe(
      'feed-tabs-tab-spicy',
    );
  });
  it('renders an actionable empty bookmarks view and local safe broadcasts', async (): Promise<void> => {
    const fixture = await render(FeedPage);
    const state = TestBed.inject(FeedState);
    state.navigate('bookmarks');
    fixture.detectChanges();
    expect(element(fixture, 'app-empty-state')).toBeTruthy();
    element<HTMLButtonElement>(fixture, 'app-empty-state button').click();
    fixture.detectChanges();
    expect(state.view()).toBe('home');
    state.publish({ text: '<img src=x onerror=alert(1)>' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element(fixture, 'app-post .post-copy').textContent).toContain('<img src=x');
    expect(element(fixture, 'app-post').querySelector('img')).toBeNull();
  });

  it.each(['home', 'explore', 'bookmarks', 'communities'] as const)(
    'has no structural accessibility violations in the %s view',
    async (view): Promise<void> => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
      const fixture = await render(FeedPage);
      const state = TestBed.inject(FeedState);
      state.navigate(view);
      fixture.detectChanges();
      const result = await axe.run(fixture.nativeElement as HTMLElement, {
        rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
      });
      expect(result.violations).toEqual([]);
      vi.restoreAllMocks();
    },
  );

  it('retains pending post focus until modal closure has completed', async (): Promise<void> => {
    const fixture = await render(FeedPage);
    const state = TestBed.inject(FeedState);
    state.composerOpen.set(true);
    state.focusedPost.set('typescript-result');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(state.focusedPost()).toBe('typescript-result');
    state.composerOpen.set(false);
    state.modalRevision.set(1);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(element(fixture, '#post-typescript-result'));
    expect(state.focusedPost()).toBe('');
  });
});
