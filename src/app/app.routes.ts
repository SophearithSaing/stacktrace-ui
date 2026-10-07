import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'design-system',
    title: 'Signal — Stacktrace design system',
    loadComponent: loadDesignSystemPage,
  },
  {
    path: '',
    loadComponent: loadAppShell,
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Stacktrace — Follow the conversation',
        loadComponent: loadFeedPage,
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

/**
 * Loads documentation independently from the product shell.
 *
 * @returns Lazy design-system page component.
 */
async function loadDesignSystemPage(): Promise<
  typeof import('./pages/design-system/design-system-page/design-system-page').DesignSystemPage
> {
  const page = await import('./pages/design-system/design-system-page/design-system-page');
  return page.DesignSystemPage;
}

/**
 * Loads the product layout independently from documentation.
 *
 * @returns Lazy product shell component.
 */
async function loadAppShell(): Promise<typeof import('./layout/app-shell/app-shell').AppShell> {
  return (await import('./layout/app-shell/app-shell')).AppShell;
}

/**
 * Loads the conversation page inside the product layout.
 *
 * @returns Lazy feed page component.
 */
async function loadFeedPage(): Promise<typeof import('./pages/feed/feed-page/feed-page').FeedPage> {
  return (await import('./pages/feed/feed-page/feed-page')).FeedPage;
}
