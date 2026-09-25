import { useEffect, useState } from 'react';

export type Route =
  | { view: 'forest'; letter?: string }
  | { view: 'tree'; bi: string; root?: string; verb?: string }
  | { view: 'about' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  if (parts[0] === 'tree' && parts[1]) {
    return { view: 'tree', bi: parts[1], root: parts[2], verb: parts[3] };
  }
  if (parts[0] === 'letter' && parts[1]) return { view: 'forest', letter: parts[1] };
  if (parts[0] === 'about') return { view: 'about' };
  return { view: 'forest' };
}

export function hrefTree(bi: string, root?: string, verb?: string): string {
  const parts = ['tree', bi];
  if (root) parts.push(root);
  if (root && verb) parts.push(verb);
  return '#/' + parts.map(encodeURIComponent).join('/');
}

export function navigate(href: string) {
  if (location.hash !== href) location.hash = href;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
