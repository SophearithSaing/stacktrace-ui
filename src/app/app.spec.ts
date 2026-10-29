import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { App } from './app';
import { account, post, profile, setupApi } from './core/api/testing/http';
import { element } from './shared/ui/testing/component-fixture';

describe('App', (): void => {
  let http: HttpTestingController;
  beforeEach(async (): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
    ({ http } = setupApi());
  });
  afterEach((): void => http.verify());

  function flushStartup(): void {
    TestBed.tick();
    http.expectOne('/api/v1/me').flush({ account, csrf_token: 'token' });
    TestBed.tick();
    http
      .expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest')
      .flush({ items: [], next_cursor: null });
    flushDiscovery();
  }

  function flushDiscovery(): void {
    http.expectOne('/api/v1/trends?limit=6').flush({ items: [] });
    http.expectOne('/api/v1/agents/suggested').flush({ items: [] });
  }

  it('should create the app', (): void => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('lazy-loads the complete product shell and feed at the root', async (): Promise<void> => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/');
    flushStartup();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent?.trim()).toBe('Follow the conversation.');
    expect(compiled.querySelectorAll('app-post')).toHaveLength(0);
    expect(compiled.querySelector('a[href="/design-system"]')).not.toBeNull();
  });

  it('lazy-loads docs without product chrome and supports returning home', async (): Promise<void> => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/design-system#tokens');
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-design-system-page')).not.toBeNull();
    expect(host.querySelector('.product-shell:not(.shell-specimen)')).toBeNull();
    expect(host.querySelector('.ds-nav [aria-current="location"]')?.textContent).toContain(
      'Tokens',
    );
    expect(document.title).toBe('Signal — Stacktrace design system');
    await router.navigateByUrl('/');
    flushStartup();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('app-design-system-page')).toBeNull();
    expect(host.querySelector('.product-shell')).not.toBeNull();
    expect(host.querySelector('app-feed-page')).not.toBeNull();
  });

  it('returns focus to the conversation when unfollowing removes a profile opener', async (): Promise<void> => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/');
    flushStartup();
    await fixture.whenStable();
    const dialog = element<HTMLDialogElement>(fixture, '.profile-dialog');
    dialog.showModal = (): void => {
      dialog.open = true;
    };
    dialog.close = (): void => {
      dialog.open = false;
      dialog.dispatchEvent(new Event('close'));
    };
    element<HTMLButtonElement>(fixture, '#feed-tabs-tab-following').click();
    fixture.detectChanges();
    const author = { ...account, id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' };
    http.expectOne('/api/v1/feed?limit=20&view=following&sort=newest').flush({
      items: [
        {
          id: 'post:event',
          kind: 'post',
          occurred_at: post.created_at,
          reposter: null,
          post: { ...post, author },
        },
      ],
      next_cursor: null,
    });
    fixture.detectChanges();
    const opener = element<HTMLButtonElement>(fixture, 'app-post .author-name');
    opener.focus();
    opener.click();
    http.expectOne(`/api/v1/accounts/${author.id}`).flush({ ...profile, ...author });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dialog.open).toBe(true);
    element<HTMLButtonElement>(fixture, '.profile-dialog .follow-button').click();
    http
      .expectOne(`/api/v1/accounts/${author.id}/follow`)
      .flush({ ...profile, ...author, viewer: { following: false } });
    flushDiscovery();
    http
      .expectOne(`/api/v1/accounts/${author.id}`)
      .flush({ ...profile, ...author, viewer: { following: false } });
    http
      .expectOne('/api/v1/feed?limit=20&view=following&sort=newest')
      .flush({ items: [], next_cursor: null });
    fixture.detectChanges();
    expect(opener.isConnected).toBe(false);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(element(fixture, '.product-main'));
  });
});
