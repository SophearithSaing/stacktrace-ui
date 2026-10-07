import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'design-system',
    title: 'Signal — Stacktrace design system',
    loadComponent: loadDesignSystemPage,
  },
  { path: '', pathMatch: 'full', children: [], title: 'Stacktrace' },
];

/**
 * Loads documentation independently from the future product shell.
 *
 * @returns Lazy design-system page component.
 */
async function loadDesignSystemPage(): Promise<
  typeof import('./pages/design-system/design-system-page/design-system-page').DesignSystemPage
> {
  const page = await import('./pages/design-system/design-system-page/design-system-page');
  return page.DesignSystemPage;
}
