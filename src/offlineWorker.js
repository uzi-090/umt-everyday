// VERSION, CACHE, FILES and SHELL are supplied by the production build.
const SHELL_URL = '/index.html';
const CACHE_OPTIONS = { ignoreSearch: true, ignoreVary: true };

function shellResponse() {
  // A fresh response has no redirect or request-specific Vary headers. This is
  // the exact HTML built with these assets, not a fetched sign-in/hosting page.
  return new Response(SHELL, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function saveOfflineCopy() {
  const cache = await caches.open(CACHE);
  await Promise.all(FILES.map(async path => {
    if (await cache.match(path, CACHE_OPTIONS)) return;
    const response = await fetch(new Request(path, { cache: 'reload', credentials: 'same-origin' }));
    const type = response.headers.get('content-type') || '';
    // An auth redirect can return 200 HTML for a missing script. Never install
    // that as a successful offline app, even when the hosting gate returns 200.
    if (!response.ok || response.redirected || /text\/html/i.test(type)) throw new Error(`Offline file unavailable: ${path}`);
    await cache.put(path, response);
  }));
  await cache.put(SHELL_URL, shellResponse());
}

async function offlineStatus() {
  const cache = await caches.open(CACHE);
  const paths = [SHELL_URL, ...FILES];
  const saved = await Promise.all(paths.map(async path => Boolean(await cache.match(path, CACHE_OPTIONS))));
  return { type: 'OFFLINE_STATUS', version: VERSION, ready: saved.every(Boolean), saved: saved.filter(Boolean).length, total: paths.length };
}

self.addEventListener('install', event => {
  event.waitUntil(saveOfflineCopy().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Retain one previous build for tabs still displaying that version, including
    // a lazy-loaded 3D chunk. Do not remove push subscriptions or local data.
    const previous = (await caches.keys()).filter(key => key.startsWith('umt-everyday-') && key !== CACHE);
    await Promise.all(previous.slice(0, -1).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (!['OFFLINE_STATUS', 'OFFLINE_PREPARE'].includes(event.data?.type) || !event.ports?.[0]) return;
  event.waitUntil((async () => {
    try {
      if (event.data.type === 'OFFLINE_PREPARE') await saveOfflineCopy();
      event.ports[0].postMessage(await offlineStatus());
    } catch {
      event.ports[0].postMessage({ type: 'OFFLINE_STATUS', version: VERSION, ready: false, error: true });
    }
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && ['/', SHELL_URL].includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      // Start immediately from the verified, matching build. Background worker
      // update checks still run on launch; no network timeout blocks the UI.
      return await cache.match(SHELL_URL, CACHE_OPTIONS) || shellResponse();
    })());
    return;
  }
  if (!FILES.includes(url.pathname) && !url.pathname.startsWith('/assets/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(url.pathname, CACHE_OPTIONS);
    if (saved) return saved;
    // Existing windows may still request a hashed module from the previous build.
    if (!FILES.includes(url.pathname)) {
      for (const key of (await caches.keys()).filter(key => key.startsWith('umt-everyday-') && key !== CACHE)) {
        const older = await (await caches.open(key)).match(url.pathname, CACHE_OPTIONS);
        if (older) return older;
      }
    }
    const response = await fetch(request);
    if (FILES.includes(url.pathname) && response.ok && !response.redirected && !/text\/html/i.test(response.headers.get('content-type') || '')) await cache.put(url.pathname, response.clone());
    return response;
  })());
});
