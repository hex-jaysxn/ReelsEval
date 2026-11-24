export type AppRoute = 'main' | 'privacy' | 'terms';

export function parseAppRoute(pathname: string): AppRoute {
  const normalized = (pathname || '/').replace(/\/+$/, '').toLowerCase() || '/';
  if (normalized === '/privacy') return 'privacy';
  if (normalized === '/terms') return 'terms';
  return 'main';
}

export function getRoutePath(route: AppRoute): string {
  if (route === 'privacy') return '/privacy';
  if (route === 'terms') return '/terms';
  return '/';
}
