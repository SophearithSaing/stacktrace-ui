import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { account, post, setupApi } from '../../core/api/testing/http';
import { ProductShell } from './product-shell';
import axe from 'axe-core';

describe('ProductShell route integration', (): void => {
  let http: HttpTestingController;
  beforeEach((): void => {
    ({ http } = setupApi());
  });
  afterEach((): void => http.verify());

  it('routes the real feed through product-only API state and leaves documentation inert', async (): Promise<void> => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', ProductShell);
    http.expectOne('/api/v1/me').flush({ account, csrf_token: 'token' });
    TestBed.tick();
    http.expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest').flush({
      items: [
        { id: 'post:event', kind: 'post', occurred_at: post.created_at, reposter: null, post },
      ],
      next_cursor: null,
    });
    http.expectOne('/api/v1/trends?limit=6').flush({ items: [] });
    http.expectOne('/api/v1/agents/suggested').flush({ items: [] });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Server text');
    expect(harness.routeNativeElement?.textContent).not.toContain('42 agents online');
    const shell = harness.routeDebugElement?.componentInstance as ProductShell;
    shell.state.search.set('inflight');
    TestBed.tick();
    const canceledSearch = http.expectOne('/api/v1/search/posts?limit=4&q=inflight');
    await harness.navigateByUrl('/design-system');
    expect(canceledSearch.cancelled).toBe(true);
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('.shell-specimen')).not.toBeNull();
    harness.routeNativeElement
      ?.querySelector<HTMLAnchorElement>('.shell-specimen .product-sidebar .brand')
      ?.click();
    for (const button of harness.routeNativeElement?.querySelectorAll<HTMLButtonElement>(
      'app-follow-button button',
    ) ?? []) {
      button.click();
    }
    harness.detectChanges();
    http.expectNone((request): boolean => request.url.startsWith('/api/'));
  });

  it('retains the actual composer field and retry key on failures, with pending and field feedback', async (): Promise<void> => {
    const harness = await RouterTestingHarness.create('/');
    http.expectOne('/api/v1/me').flush({ account, csrf_token: 'token' });
    TestBed.tick();
    flushDiscovery();
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
      .flush({ items: [], next_cursor: null });
    harness.detectChanges();
    const host = harness.routeNativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.sidebar-compose')?.click();
    harness.detectChanges();
    const input = host.querySelector<HTMLTextAreaElement>('app-post-composer textarea');
    if (!input) {
      throw new Error('Composer field missing');
    }
    input.value = '  literal 😀 draft  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    harness.detectChanges();
    const form = host.querySelector<HTMLFormElement>('app-post-composer form');
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    harness.detectChanges();
    const first = http.expectOne('/api/v1/posts');
    const key = first.request.headers.get('Idempotency-Key');
    expect(first.request.headers.get('X-CSRF-Token')).toBe('token');
    expect(JSON.parse(first.request.body).body).toBe('  literal 😀 draft  ');
    expect(input.disabled).toBe(true);
    first.error(new ProgressEvent('error'));
    harness.detectChanges();
    expect(input.value).toBe('  literal 😀 draft  ');
    expect(input.disabled).toBe(false);
    expect(input.getAttribute('aria-invalid')).toBe('false');
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const retried = http.expectOne('/api/v1/posts');
    expect(retried.request.headers.get('Idempotency-Key')).toBe(key);
    retried.flush(
      { error: { code: 'validation_failed', fields: { body: 'Review this text' } } },
      { status: 422, statusText: 'Validation' },
    );
    harness.detectChanges();
    expect(input.value).toBe('  literal 😀 draft  ');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(host.textContent).toContain('Review this text');
  });

  it('updates every appearance only after confirmation and rehydrates saved state in a fresh product scope', async (): Promise<void> => {
    const harness = await RouterTestingHarness.create('/');
    http.expectOne('/api/v1/me').flush({ account, csrf_token: 'token' });
    TestBed.tick();
    flushDiscovery();
    const event = {
      id: 'post:event',
      kind: 'post',
      occurred_at: post.created_at,
      reposter: null,
      post,
    };
    http.expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest').flush({
      items: [event, { ...event, id: 'repost:event', kind: 'repost', reposter: account }],
      next_cursor: null,
    });
    harness.detectChanges();
    const buttons =
      harness.routeNativeElement?.querySelectorAll<HTMLButtonElement>('.bookmark-action');
    buttons?.[0].click();
    harness.detectChanges();
    expect(buttons?.[0].disabled).toBe(true);
    expect(buttons?.[1].disabled).toBe(true);
    const saved = { ...post, viewer: { reaction: null, bookmarked: true, reposted: false } };
    http.expectOne(`/api/v1/posts/${post.id}/bookmark`).flush(saved);
    flushDiscovery();
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
      .flush({ items: [{ ...event, post: saved }], next_cursor: null });
    harness.detectChanges();
    expect(
      harness.routeNativeElement?.querySelector('.bookmark-action')?.getAttribute('aria-pressed'),
    ).toBe('true');
    await harness.navigateByUrl('/design-system');
    await harness.navigateByUrl('/', ProductShell);
    http.expectOne('/api/v1/me').flush({ account, csrf_token: 'new-token' });
    TestBed.tick();
    flushDiscovery();
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
      .flush({ items: [{ ...event, post: saved }], next_cursor: null });
    harness.detectChanges();
    expect(
      harness.routeNativeElement?.querySelector('.bookmark-action')?.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('has no structural axe violations in the connected product shell', async (): Promise<void> => {
    const harness = await RouterTestingHarness.create('/');
    http.expectOne('/api/v1/me').flush({ account: null, csrf_token: null });
    TestBed.tick();
    flushDiscovery();
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
      .flush({ items: [], next_cursor: null });
    harness.detectChanges();
    const result = await axe.run(harness.routeNativeElement as HTMLElement, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });

  function flushDiscovery(): void {
    http.expectOne('/api/v1/trends?limit=6').flush({ items: [] });
    http.expectOne('/api/v1/agents/suggested').flush({ items: [] });
  }

  it('keeps read failures visible and permits only explicit retry after cooldown', async (): Promise<void> => {
    const harness = await RouterTestingHarness.create('/');
    http.expectOne('/api/v1/me').flush({ account: null, csrf_token: null });
    TestBed.tick();
    flushDiscovery();
    vi.useFakeTimers();
    try {
      http
        .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
        .flush(
          { error: { code: 'rate_limited' } },
          { status: 429, statusText: 'Rate limited', headers: { 'Retry-After': '2' } },
        );
      harness.detectChanges();
      const host = harness.routeNativeElement as HTMLElement;
      const retry = host.querySelector<HTMLButtonElement>('#feed-list app-async-feedback button');
      expect(retry?.disabled).toBe(true);
      expect(host.textContent).toContain('Please wait before retrying');
      vi.advanceTimersByTime(2000);
      harness.detectChanges();
      expect(retry?.disabled).toBe(false);
      http.expectNone('/api/v1/feed?limit=20&view=for-you&sort=newest');
      retry?.click();
      http
        .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
        .flush({ items: [], next_cursor: null });
      harness.detectChanges();
      expect(host.querySelectorAll('app-post')).toHaveLength(0);
      expect(host.textContent).toContain('No results yet.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves an absent fragment post and focuses its canonical rendered row', async (): Promise<void> => {
    const harness = await RouterTestingHarness.create('/#post-' + post.id);
    http.expectOne('/api/v1/me').flush({ account: null, csrf_token: null });
    TestBed.tick();
    flushDiscovery();
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
      .flush({ items: [], next_cursor: null });
    http.expectOne(`/api/v1/posts/${post.id}`).flush(post);
    harness.detectChanges();
    const target = harness.routeNativeElement?.querySelector('.feed-post-target');
    expect(target?.textContent).toContain('Server text');
    expect(document.activeElement).toBe(target);
  });
});
