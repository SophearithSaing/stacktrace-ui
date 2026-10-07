import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import axe from 'axe-core';
import { DesignSystemPage } from './design-system-page';
import { SECTIONS } from './design-system-data';
import { element, press, type } from '../../../shared/ui/testing/component-fixture';
import { routes } from '../../../app.routes';

describe('DesignSystemPage', (): void => {
  let fixture: ComponentFixture<DesignSystemPage>;
  let scrollDescriptor: PropertyDescriptor | undefined;
  let clipboardDescriptor: PropertyDescriptor | undefined;
  let shareDescriptor: PropertyDescriptor | undefined;

  beforeEach(async (): Promise<void> => {
    clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    shareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share');
    scrollDescriptor = Object.getOwnPropertyDescriptor(window.history, 'scrollRestoration');
    Object.defineProperty(window.history, 'scrollRestoration', {
      configurable: true,
      writable: true,
      value: 'auto',
    });
    await TestBed.configureTestingModule({
      imports: [DesignSystemPage],
      providers: [provideRouter(routes)],
    }).compileComponents();
    fixture = TestBed.createComponent(DesignSystemPage);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach((): void => {
    fixture.destroy();
    if (scrollDescriptor) {
      Object.defineProperty(window.history, 'scrollRestoration', scrollDescriptor);
    } else {
      Reflect.deleteProperty(window.history, 'scrollRestoration');
    }
    vi.restoreAllMocks();
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
  });

  it('owns scroll restoration only while the documentation page is open', (): void => {
    expect(window.history.scrollRestoration).toBe('manual');
    fixture.destroy();
    expect(window.history.scrollRestoration).toBe('auto');
  });

  it('renders all nine sections, live primitives and patterns, and phase notices', (): void => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.ds-nav nav a')).toHaveLength(9);
    for (const section of SECTIONS) {
      expect(host.querySelectorAll('#' + section.id)).toHaveLength(1);
      expect(host.querySelector('.ds-nav a[href$="#' + section.id + '"]')).not.toBeNull();
    }
    for (const selector of [
      'app-brand',
      'app-icon',
      'app-avatar',
      'app-badge',
      'app-agent-identity',
      'app-follow-button',
      'app-search-field',
      'app-reply-input',
      'app-tabs',
      'app-empty-state',
      'app-toast',
    ]) {
      expect(host.querySelector(selector)).not.toBeNull();
    }
    expect(host.querySelectorAll('.ds-avatar-row app-avatar')).toHaveLength(8);
    expect(host.querySelector('app-post')).not.toBeNull();
    expect(host.querySelector('app-agent-profile')).not.toBeNull();
    expect(host.querySelector('.shell-specimen')).not.toBeNull();
  });

  it('synchronizes both follow specimens without changing product state', (): void => {
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '.follow-button',
    );
    buttons[0].click();
    fixture.detectChanges();
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    buttons[1].click();
    fixture.detectChanges();
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    expect(element(fixture, '.docs-feedback .toast').textContent).toContain('Demo: unfollowed');
  });

  it('shares reaction add/change/remove state and totals across live specimens', async (): Promise<void> => {
    const inline = '#docs-inline-reactions-menu ';
    const summary = 'app-post .reaction-summary';
    element<HTMLButtonElement>(fixture, inline + '[data-reaction="useful"]').click();
    fixture.detectChanges();
    expect(element(fixture, summary).getAttribute('aria-label')).toContain('843 reactions');
    expect(
      element(fixture, 'app-post [data-menu-trigger][data-reaction]').getAttribute('data-reaction'),
    ).toBe('useful');
    element<HTMLButtonElement>(fixture, 'app-post app-reaction-picker [data-menu-trigger]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    element<HTMLButtonElement>(
      fixture,
      'app-post [role="menuitemradio"][data-reaction="ship"]',
    ).click();
    fixture.detectChanges();
    expect(element(fixture, summary).getAttribute('aria-label')).toContain('Ship it: 1');
    expect(element(fixture, inline + '[data-reaction="ship"]').getAttribute('aria-pressed')).toBe(
      'true',
    );
    element<HTMLButtonElement>(fixture, inline + '[data-reaction="ship"]').click();
    fixture.detectChanges();
    expect(element(fixture, summary).getAttribute('aria-label')).toContain('842 reactions');
  });

  it('adds replies safely, updates counts, and keeps bookmarks container-owned', (): void => {
    element<HTMLButtonElement>(fixture, 'app-post [aria-label="Replies, 38"]').click();
    fixture.detectChanges();
    const input = element<HTMLInputElement>(fixture, '#docs-post-replies-input');
    type(input, ' <b>Local reply</b> ');
    fixture.detectChanges();
    element(fixture, 'app-comment-thread form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    fixture.detectChanges();
    expect(element(fixture, '.reply-list').textContent).toContain('<b>Local reply</b>');
    expect(element(fixture, '.reply-list').querySelector('b')).toBeNull();
    expect(element(fixture, 'app-post [aria-label="Replies, 39"]')).toBeTruthy();
    expect(input.value).toBe('');
    element<HTMLButtonElement>(fixture, '.bookmark-action').click();
    fixture.detectChanges();
    expect(element(fixture, '.bookmark-action').getAttribute('aria-pressed')).toBe('true');
    element<HTMLButtonElement>(fixture, 'app-post [aria-label="Replies, 39"]').click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-comment-thread')).toBeNull();
  });

  it('reverses repost counts and renders a local quote without publishing', (): void => {
    const menu = element(fixture, '#docs-inline-share-menu');
    const buttons = menu.querySelectorAll<HTMLButtonElement>('button');
    buttons[0].click();
    fixture.detectChanges();
    expect(buttons[0].textContent).toContain('Undo repost');
    expect(element(fixture, 'app-post app-share-menu [data-menu-trigger]').textContent).toContain(
      '127',
    );
    buttons[0].click();
    fixture.detectChanges();
    expect(element(fixture, 'app-post app-share-menu [data-menu-trigger]').textContent).toContain(
      '126',
    );
    buttons[1].click();
    fixture.detectChanges();
    expect(element(fixture, '#reactions app-quoted-post').textContent).toContain('three sprints');
    expect(element(fixture, '#docs-composer-heading').textContent).toContain('Quote post as You');
  });

  it('reports clipboard success only after completion and handles failures', async (): Promise<void> => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const buttons = element(fixture, '#docs-inline-share-menu').querySelectorAll<HTMLButtonElement>(
      'button',
    );
    buttons[3].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/design-system#content'));
    expect(element(fixture, '.docs-feedback .toast').textContent).toContain('link copied');
    writeText.mockRejectedValue(new Error('Denied'));
    buttons[3].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element(fixture, '.docs-feedback .toast').textContent).toContain('cancelled or failed');
  });

  it('handles unavailable, successful, and cancelled native sharing', async (): Promise<void> => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    const buttons = element(fixture, '#docs-inline-share-menu').querySelectorAll<HTMLButtonElement>(
      'button',
    );
    buttons[2].click();
    fixture.detectChanges();
    expect(element(fixture, '.docs-feedback .toast').textContent).toContain('Try Copy link');
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    buttons[2].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element(fixture, '.docs-feedback .toast').textContent).toContain('Specimen link shared');
    share.mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    buttons[2].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element(fixture, '.docs-feedback .toast').textContent).toContain('cancelled or failed');
  });

  it('filters real search results and exposes empty results', (): void => {
    const input = element<HTMLInputElement>(fixture, '#docs-search');
    type(input, 'angular');
    fixture.detectChanges();
    const options = (fixture.nativeElement as HTMLElement).querySelectorAll('[role="option"]');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('Angular');
    press(input, 'ArrowDown');
    press(input, 'Enter');
    fixture.detectChanges();
    expect(element(fixture, '.docs-feedback .toast').textContent).toContain('Demo search: Angular');
    type(input, 'not-an-agent');
    fixture.detectChanges();
    expect(element(fixture, '.search-results').textContent).toContain('No stack chatter found.');
  });

  it('validates replies, safely echoes text, and states that nothing is published', (): void => {
    const form = element(fixture, 'app-reply-input form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(element(fixture, '#docs-reply').getAttribute('aria-invalid')).toBe('true');
    type(element<HTMLInputElement>(fixture, '#docs-reply'), '  <b>Hello</b>  ');
    fixture.detectChanges();
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(element<HTMLInputElement>(fixture, '#docs-reply').value).toBe('');
    expect(element(fixture, '.docs-feedback .toast').textContent).toContain(
      'Nothing was published',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Demo reply: <b>Hello</b>',
    );
    expect((fixture.nativeElement as HTMLElement).querySelector('b')).toBeNull();
  });

  it('connects tabs to a live panel and resets the empty-state filter', (): void => {
    element<HTMLButtonElement>(fixture, '#docs-tabs-tab-following').click();
    fixture.detectChanges();
    expect(element(fixture, '[role="tabpanel"]').getAttribute('aria-labelledby')).toBe(
      'docs-tabs-tab-following',
    );
    expect(element(fixture, '[role="tabpanel"]').textContent).toContain(
      'No followed conversations yet.',
    );
    element<HTMLButtonElement>(fixture, '[role="tabpanel"] button').click();
    fixture.detectChanges();
    expect(element(fixture, '#docs-tabs-tab-you').getAttribute('aria-selected')).toBe('true');
  });

  it('receives a safe documentation broadcast without altering shell specimens', (): void => {
    const originalPost = element(fixture, '.shell-specimen app-post .post-copy').textContent;
    element<HTMLButtonElement>(fixture, '#reactions .quick-entry').click();
    fixture.detectChanges();
    const text = element<HTMLTextAreaElement>(fixture, '#docs-composer-text');
    text.value = '<b>Documentation only</b>';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    element(fixture, 'app-post-composer[id="docs-composer"] form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    fixture.detectChanges();
    expect(element(fixture, '#reactions [role="status"]').textContent).toContain(
      '<b>Documentation only</b>',
    );
    expect(element(fixture, '#reactions [role="status"]').querySelector('b')).toBeNull();
    expect(element(fixture, '.shell-specimen app-post .post-copy').textContent).toBe(originalPost);
  });

  it('restores fragment targets, focus, and active navigation', async (): Promise<void> => {
    await TestBed.inject(Router).navigateByUrl('/#tokens');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element(fixture, '.ds-nav [aria-current="location"]').textContent).toContain('Tokens');
    expect(document.activeElement).toBe(element(fixture, '#tokens'));
    await TestBed.inject(Router).navigateByUrl('/#not-a-section');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element(fixture, '.ds-nav [aria-current="location"]').textContent).toContain('Tokens');
  });

  it('tracks the section above the sticky boundary when scrolling', (): void => {
    for (const [index, section] of SECTIONS.entries()) {
      vi.spyOn(element(fixture, '#' + section.id), 'getBoundingClientRect').mockReturnValue({
        top: (index - 3) * 100,
        height: 100,
      } as DOMRect);
    }
    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(element(fixture, '.ds-nav [aria-current="location"]').textContent).toContain('Identity');
  });

  it('can revisit the current fragment after focus moves into a demo', async (): Promise<void> => {
    await TestBed.inject(Router).navigateByUrl('/#tokens');
    fixture.detectChanges();
    await fixture.whenStable();
    element<HTMLInputElement>(fixture, '#docs-reply').focus();
    element<HTMLAnchorElement>(fixture, '.ds-nav a[href$="#tokens"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(element(fixture, '#tokens'));
  });

  it('reveals the active link in an overflowing contents strip', async (): Promise<void> => {
    const nav = element(fixture, '.ds-nav');
    const link = element(fixture, '.ds-nav a[href$="#tokens"]');
    vi.spyOn(nav, 'clientWidth', 'get').mockReturnValue(320);
    vi.spyOn(nav, 'scrollWidth', 'get').mockReturnValue(900);
    vi.spyOn(nav, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 320 } as DOMRect);
    vi.spyOn(link, 'getBoundingClientRect').mockReturnValue({ left: 800, right: 900 } as DOMRect);
    await TestBed.inject(Router).navigateByUrl('/#tokens');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(nav.scrollLeft).toBe(580);
  });

  it('has unique IDs and no structural axe violations', async (): Promise<void> => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const host = fixture.nativeElement as HTMLElement;
    const ids = Array.from(host.querySelectorAll('[id]'), (node): string => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    const result = await axe.run(host, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
