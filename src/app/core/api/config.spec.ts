import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL, apiUrl } from './config';
import { appConfig } from '../../app.config';

describe('API destination', (): void => {
  it('defaults to root-relative same-origin paths', (): void => {
    expect(TestBed.inject(API_BASE_URL)).toBe('');
    expect(apiUrl('', 'feed')).toBe('/api/v1/feed');
    expect(apiUrl('', '/me')).toBe('/api/v1/me');
  });

  it('joins configured origins without duplicate slashes', (): void => {
    expect(apiUrl('https://api.example.test/', '/posts/id/replies')).toBe(
      'https://api.example.test/api/v1/posts/id/replies',
    );
    expect(apiUrl('http://localhost:8080', 'feed')).toBe('http://localhost:8080/api/v1/feed');
  });

  it.each([
    '/design-system',
    '//other.test',
    'javascript:alert(1)',
    'https:example.test',
    'ftp://example.test',
    'https://u:p@example.test',
    'https://example.test/path',
    'https://example.test/docs/..',
    'https://example.test?',
    'https://example.test#',
    'https://example.test\\',
    'https://example.test?q=1',
    'https://example.test#docs',
    ' https://example.test',
  ])('rejects unsafe base %s', (base: string): void => {
    expect((): string => apiUrl(base, 'feed')).toThrow();
  });

  it.each([
    '',
    '//evil.test',
    '../me',
    'posts/%2e%2e/me',
    'posts/%2Fme',
    'posts/\\me',
    'feed?view=spicy',
    'feed#docs',
    'https://evil.test',
    'feed\n',
    'posts/%00',
    'posts/%',
  ])('rejects unsafe path %s', (path: string): void => {
    expect((): string => apiUrl('', path)).toThrow();
  });

  it('supports provider overrides and real HTTP path resolution', (): void => {
    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers,
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.example.test' },
      ],
    });
    const http = TestBed.inject(HttpClient);
    const controller = TestBed.inject(HttpTestingController);
    http.get(apiUrl(TestBed.inject(API_BASE_URL), 'feed')).subscribe();
    const request = controller.expectOne('https://api.example.test/api/v1/feed');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.has('X-CSRF-Token')).toBe(false);
    request.flush({ items: [], next_cursor: null });
    controller.verify();
  });
});
