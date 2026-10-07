import { TestBed } from '@angular/core/testing';
import { FeedState } from './feed-state';
import { FEED_FIXTURES } from '../data/feed-fixtures';

describe('FeedState', (): void => {
  let state: FeedState;
  beforeEach((): void => {
    TestBed.configureTestingModule({ providers: [FeedState] });
    state = TestBed.inject(FeedState);
  });
  it('filters by actual relationships, spicy state, bookmarks, and communities', (): void => {
    expect(state.visiblePosts()).toHaveLength(9);
    state.filter.set('following');
    expect(state.visiblePosts().every((post): boolean => state.followed().has(post.agent))).toBe(
      true,
    );
    state.follow('rust', true);
    expect(state.visiblePosts().some((post): boolean => post.agent === 'rust')).toBe(true);
    state.filter.set('spicy');
    expect(state.visiblePosts()).toHaveLength(3);
    state.navigate('bookmarks');
    expect(state.visiblePosts()).toHaveLength(0);
    state.setInteraction('redis-ttl', { bookmarked: true });
    expect(state.visiblePosts()[0].id).toBe('redis-ttl');
    state.community('devops');
    expect(state.visiblePosts()).toHaveLength(2);
    state.selectTopic('#missing');
    expect(state.visiblePosts()).toHaveLength(0);
  });
  it('sorts by real recency and aggregate reactions', (): void => {
    state.sort.set('liked');
    expect(state.visiblePosts()[0].id).toBe('docker-builds');
    state.sort.set('newest');
    expect(state.visiblePosts()[0].id).toBe('postgres-index');
    state.publish({ text: 'Newest broadcast' });
    expect(state.visiblePosts()[0].text[0].text).toBe('Newest broadcast');
  });
  it('adds, changes, and removes reactions without mutating fixtures', (): void => {
    state.react('postgres-index', 'useful');
    expect(state.posts()[0].reactions.useful).toBe(397);
    state.react('postgres-index', 'agree');
    expect(state.posts()[0].reactions).toMatchObject({ useful: 396, agree: 279 });
    state.react('postgres-index', null);
    expect(state.posts()[0].reactions).toEqual(FEED_FIXTURES[0].reactions);
    state.reply('postgres-index', '  <b>Safe reply</b> ');
    expect(state.posts()[0].replies.at(-1)?.text).toBe('<b>Safe reply</b>');
    expect(state.posts()[0].comments).toBe(39);
    expect(FEED_FIXTURES[0].comments).toBe(38);
  });
  it('reverses repost counts and creates a local safe quote broadcast', async (): Promise<void> => {
    await state.share('postgres-index', 'repost');
    expect(state.posts()[0].reposts).toBe(127);
    await state.share('postgres-index', 'repost');
    expect(state.posts()[0].reposts).toBe(126);
    await state.share('postgres-index', 'quote');
    expect(state.composerOpen()).toBe(true);
    state.publish({ text: '<script>Safe</script>', quote: state.quote()! });
    expect(state.posts()[0].quote?.agent).toBe('postgres');
    expect(state.posts()[0].text[0].text).toBe('<script>Safe</script>');
    expect(state.composerOpen()).toBe(false);
    expect(state.toastMessage()).toContain('Nothing was sent');
  });
  it('rejects invalid publishing and isolates state instances', (): void => {
    state.publish({ text: ' ' });
    state.publish({ text: 'x'.repeat(321) });
    expect(state.posts()).toHaveLength(9);
    state.follow('redis', true);
    const other = TestBed.runInInjectionContext((): FeedState => new FeedState());
    expect(other.followed().has('redis')).toBe(false);
    expect(other.posts()).toHaveLength(9);
  });
  it('searches identities and safe content and reveals filtered-out results', (): void => {
    state.search.set('as any');
    expect(state.searchResults()[0].id).toBe('typescript-result');
    state.navigate('bookmarks');
    state.reveal('typescript-result');
    expect(state.view()).toBe('home');
    expect(state.focusedPost()).toBe('typescript-result');
    expect(state.search()).toBe('');
    state.search.set('not-in-the-stack');
    expect(state.searchResults()).toHaveLength(0);
  });

  it('reports real browser share outcomes without false success', async (): Promise<void> => {
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const shareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share');
    try {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
      await state.share('postgres-index', 'copy');
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('#post-postgres-index'));
      expect(state.toastMessage()).toBe('Post link copied.');
      writeText.mockRejectedValue(new Error('Denied'));
      await state.share('postgres-index', 'copy');
      expect(state.toastMessage()).toContain('cancelled or failed');
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      await state.share('postgres-index', 'external');
      expect(state.toastMessage()).toContain('Try Copy link');
      const share = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', { configurable: true, value: share });
      await state.share('postgres-index', 'external');
      expect(state.toastMessage()).toBe('Post link shared.');
      share.mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
      await state.share('postgres-index', 'external');
      expect(state.toastMessage()).toContain('cancelled or failed');
    } finally {
      for (const [key, descriptor] of [
        ['clipboard', clipboardDescriptor],
        ['share', shareDescriptor],
      ] as const) {
        if (descriptor) {
          Object.defineProperty(navigator, key, descriptor);
        } else {
          Reflect.deleteProperty(navigator, key);
        }
      }
    }
  });
});
