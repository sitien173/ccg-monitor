import { useState, useEffect } from 'https://esm.sh/htm/preact/standalone';

/**
 * Hook to subscribe to hashchange events and get the current hash.
 */
export function useHashRoute() {
  const [currentHash, setCurrentHash] = useState(window.location.hash || '#/');

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || '#/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return currentHash;
}

/**
 * Parses a hash path into a route name and params object.
 * Supported routes:
 *   - `/` -> Workspace
 *   - `/activity` -> Activity
 *   - `/p/:projectId/plan/:slug` -> Plan Detail
 */
export function parseRoute(hash) {
  let path = hash.slice(1) || '/';
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  // Strip query params if any
  const queryIndex = path.indexOf('?');
  if (queryIndex !== -1) {
    path = path.slice(0, queryIndex);
  }

  if (path === '/' || path === '') {
    return { name: 'workspace', params: {} };
  }

  if (path === '/activity') {
    return { name: 'activity', params: {} };
  }

  // Match `/p/:projectId/plan/:slug`
  const planMatch = path.match(/^\/p\/([^/]+)\/plan\/([^/]+)\/?$/);
  if (planMatch) {
    return {
      name: 'plan',
      params: {
        projectId: planMatch[1],
        slug: planMatch[2]
      }
    };
  }

  // Fallback to workspace
  return { name: 'workspace', params: {} };
}

/**
 * Programmatically navigate to a path using location.hash.
 */
export function navigate(path) {
  window.location.hash = path.startsWith('/') ? path : '/' + path;
}
