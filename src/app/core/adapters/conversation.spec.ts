import { AccountSummary } from '../api/models';
import { account, post, profile, reply } from '../api/testing/http';
import { AgentProfile } from '../../shared/patterns/agent-profile/agent-profile';
import { Post } from '../../shared/patterns/post/post';
import { QuotedPost } from '../../shared/patterns/quoted-post/quoted-post';
import { element, render } from '../../shared/ui/testing/component-fixture';
import { resolveAppearance, toIdentity, toPost, toProfile, toQuote, toReply } from './conversation';

describe('API presentation adapters', (): void => {
  it('uses only registered appearances, independent of canonical IDs and handles', (): void => {
    expect(resolveAppearance('rust').theme).toBe('rust');
    expect(resolveAppearance('rust').motif).toBe('fearless_concurrency::spawn()');
    for (const key of [null, 'unknown', '__proto__', 'red; background:url(evil)']) {
      expect(resolveAppearance(key)).toEqual({ theme: 'observer', motif: '' });
    }
    const identity = toIdentity({ ...account, handle: 'rust', appearance_key: 'angular' });
    expect(identity.id).toBe(account.id);
    expect(identity.theme).toBe('angular');
    expect(identity.name).toBe('Alice');
    expect(toIdentity(account).theme).toBe('observer');
  });

  it('preserves literal text, source whitespace, source IDs and authoritative counts', (): void => {
    const wire = {
      ...post,
      body: '<script>unsafe()</script>\n<strong>literal</strong>',
      code: { filename: 'x.ts', language: 'ts', source: '\n  <tag>😀\t\n' },
      quote: { id: 'source', availability: 'available' as const, author: account, body: '' },
      is_generated: true,
      counts: { ...post.counts, replies: 99 },
      reply_preview: { items: [{ ...reply, is_generated: true }], next_cursor: 'oldest' },
    };
    const view = toPost(wire);
    expect(view.text).toEqual([{ text: wire.body }]);
    expect(view.code?.tokens).toEqual([{ text: wire.code.source, kind: 'plain' }]);
    expect(view.comments).toBe(99);
    expect(view.generated).toBe(true);
    expect(view.quote?.id).toBe('source');
    expect(view.quote?.text).toEqual([{ text: '' }]);
    expect(view.replies[0]).toEqual(toReply(wire.reply_preview.items[0]));
    expect(view.replies[0].generated).toBe(true);
    expect(view.time).toBe(wire.created_at);
    expect(toPost(post).code).toBeUndefined();
    expect(toPost(post).quote).toBeUndefined();
  });

  it.each(['human', 'agent'] as const)(
    'renders an unfamiliar %s with real metadata and canonical intents',
    async (type): Promise<void> => {
      const author: AccountSummary = {
        ...account,
        type,
        id: 'new-account-id',
        handle: 'new_handle',
        display_name: 'An Unfamiliar Account',
        initials: 'UA',
        status_text: 'Actual state',
        appearance_key: type === 'agent' ? 'rust' : null,
        is_verified: type === 'agent',
      };
      const fixture = await render(Post, { id: 'remote-post', post: toPost({ ...post, author }) });
      const host = fixture.nativeElement as HTMLElement;
      expect(element(fixture, '.author-name').textContent).toContain(author.display_name);
      expect(host.textContent).toContain('@new_handle');
      expect(host.textContent).toContain('Actual state');
      expect(element(fixture, '.avatar').textContent?.trim()).toBe('UA');
      expect(element(fixture, '.avatar').getAttribute('data-agent')).toBe(
        type === 'agent' ? 'rust' : 'observer',
      );
      expect(host.querySelectorAll('[data-variant="verified"]')).toHaveLength(
        type === 'agent' ? 1 : 0,
      );
      const requested = vi.fn();
      fixture.componentInstance.profileRequested.subscribe(requested);
      element<HTMLButtonElement>(fixture, '.author-name').click();
      expect(requested).toHaveBeenCalledWith(author.id);
    },
  );

  it('renders literal API bodies/code/replies without creating HTML elements', async (): Promise<void> => {
    const source = '\n  <img src=x onerror=evil()>\t\n';
    const fixture = await render(Post, {
      id: 'safe',
      repliesOpen: true,
      post: toPost({
        ...post,
        body: '<script>evil()</script>',
        is_generated: true,
        code: { filename: '<b>x</b>', language: 'ts', source },
        reply_preview: {
          items: [{ ...reply, body: '<b>literal reply</b>', is_generated: true }],
          next_cursor: null,
        },
      }),
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('script, img, b')).toBeNull();
    expect(element(fixture, 'code').textContent).toBe(source);
    expect(element(fixture, '.post-copy').textContent).toContain('<script>evil()</script>');
    expect(element(fixture, '.reply-list p').textContent).toBe('<b>literal reply</b>');
    expect(host.textContent).toContain('Generated');
  });

  it('discards deleted quote metadata and hides stale content even in a malformed presentation input', async (): Promise<void> => {
    const deleted = toQuote({
      id: post.id,
      availability: 'deleted',
      author: account,
      body: 'stale',
    });
    expect(deleted).toEqual({ id: post.id, availability: 'deleted' });
    const fixture = await render(QuotedPost, {
      quote: { ...deleted, agent: 'postgres', text: [{ text: 'stale body' }] },
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('unavailable');
    expect(host.textContent).not.toContain('stale body');
    expect(host.querySelector('app-agent-identity, button')).toBeNull();
    expect(toQuote({ id: post.id, availability: 'available' }).text).toEqual([]);
  });

  it('renders an actual human profile with neutral styling, status, flags and self-follow suppression', async (): Promise<void> => {
    const view = toProfile(
      {
        ...profile,
        display_name: 'New Human',
        bio: '<em>literal</em>',
        status_text: 'Working',
        follower_count: 42,
      },
      account.id,
    );
    const fixture = await render(AgentProfile, { id: 'remote-profile', profile: view });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('New Human');
    expect(host.textContent).toContain('@alice');
    expect(host.textContent).toContain('Working');
    expect(host.textContent).toContain('42');
    expect(element(fixture, '.profile-bio').textContent).toBe('<em>literal</em>');
    expect(element(fixture, '.profile-sheet').getAttribute('data-agent')).toBe('observer');
    expect(host.querySelector('em, app-follow-button, [data-variant="verified"]')).toBeNull();
  });
});
