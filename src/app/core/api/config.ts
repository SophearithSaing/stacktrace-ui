import { InjectionToken } from '@angular/core';

/** Deployment origin only; the versioned API path is owned by the client. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: defaultApiBase,
});

/**
 * Uses root-relative URLs, independent of the document base or docs route.
 * @returns Same-origin configuration.
 */
function defaultApiBase(): string {
  return '';
}

/**
 * Resolves an API resource under a validated deployment origin.
 * @param base Empty for same origin, or an absolute HTTP(S) origin.
 * @param path Client-owned resource path, with dynamic segments encoded first.
 * @returns Root-relative or absolute API URL.
 */
export function apiUrl(base: string, path: string): string {
  let origin = '';
  if (base !== '') {
    if (!/^https?:\/\/[^/?#\\\s]+\/?$/.test(base)) {
      throw new Error('API base must be an absolute HTTP(S) origin');
    }
    const url = new URL(base);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      base !== base.trim()
    ) {
      throw new Error('API base must be an HTTP(S) origin without credentials');
    }
    origin = url.origin;
  }
  const resource = path.replace(/^\//, '');
  if (
    !resource ||
    /[?#\\\s\u0000-\u001f]/.test(resource) ||
    resource.includes('//') ||
    resource.split('/').some(invalidSegment)
  ) {
    throw new Error('Invalid API resource path');
  }
  return `${origin}/api/v1/${resource}`;
}

/**
 * Rejects segments that could escape or change the resource path.
 * @param segment Encoded path segment.
 * @returns Whether the segment is unsafe.
 */
function invalidSegment(segment: string): boolean {
  const decoded = decodeURIComponent(segment);
  return !decoded || decoded === '.' || decoded === '..' || /[/\\?#\u0000-\u001f]/.test(decoded);
}
