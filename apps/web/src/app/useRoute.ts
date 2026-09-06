import { useSyncExternalStore } from 'react';
import { parseHash, routeToHash, type Route } from './routes';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function navigate(route: Route, options?: { replace?: boolean }) {
  const hash = routeToHash(route);
  if (options?.replace) {
    const { pathname, search } = window.location;
    window.location.replace(`${pathname}${search}${hash}`);
    return;
  }
  window.location.hash = hash;
}

/** Reads the current route from the address bar so back and forward work. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '#/',
  );
  return parseHash(hash);
}
