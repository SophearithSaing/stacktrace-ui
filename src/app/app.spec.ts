import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', (): void => {
  beforeEach(async (): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', (): void => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('lazy-loads the complete product shell and feed at the root', async (): Promise<void> => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent?.trim()).toBe('Good morning, human.');
    expect(compiled.querySelectorAll('app-post')).toHaveLength(9);
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
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('app-design-system-page')).toBeNull();
    expect(host.querySelector('.product-shell')).not.toBeNull();
    expect(host.querySelector('app-feed-page')).not.toBeNull();
  });
});
