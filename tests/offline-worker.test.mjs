import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ORIGIN = 'https://attn.example';
const FILES = ['/assets/app.js', '/assets/pass.js', '/assets/app.css', '/fonts/poppins.woff2', '/attendance-pass.png'];
const SHELL = '<!doctype html><div id="root"></div><script src="/assets/app.js"></script>';

function worker() {
  const handlers = {}, stores = new Map(), requests = [];
  let online = true, failedPath = '', loginPath = '', skipped = false, claimed = false;
  const key = input => new URL(typeof input === 'string' ? input : input.url, ORIGIN).pathname;
  const caches = {
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async match(input, options = {}) {
          const result = store.get(key(input));
          // Reproduce the hosting/preview Vary mismatch that can distinguish a
          // precache fetch from a browser navigation or module-preload request.
          if (result?.headers.get('vary') && !options.ignoreVary) return undefined;
          return result?.clone();
        },
        async put(input, response) { store.set(key(input), response.clone()); },
      };
    },
  };
  class WorkerRequest extends Request {
    constructor(input, init) { super(new URL(typeof input === 'string' ? input : input.url, ORIGIN), init); }
  }
  const self = {
    location: { origin: ORIGIN },
    addEventListener(type, callback) { handlers[type] = callback; },
    async skipWaiting() { skipped = true; },
    clients: { async claim() { claimed = true; } },
  };
  const fetch = async input => {
    requests.push(key(input));
    if (!online || key(input) === failedPath) throw new Error('Network unavailable');
    return new Response(key(input) === loginPath ? '<html>Sign in</html>' : `asset:${key(input)}`, {
      headers: { 'Content-Type': key(input) === loginPath ? 'text/html' : 'application/octet-stream', Vary: 'Origin, Accept-Language' },
    });
  };
  const source = readFileSync(new URL('../src/offlineWorker.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, { self, caches, fetch, Request: WorkerRequest, Response, URL, VERSION: 'new', CACHE: 'umt-everyday-new', FILES, SHELL });
  const fire = async (type, properties = {}) => {
    let response, pending;
    handlers[type]({ ...properties, waitUntil(promise) { pending = promise; }, respondWith(promise) { response = promise; } });
    await pending;
    return await response;
  };
  const status = async type => {
    let result;
    await fire('message', { data: { type: type || 'OFFLINE_STATUS' }, ports: [{ postMessage(value) { result = value; } }] });
    return result;
  };
  return { fire, status, caches, stores, requests,
    offline() { online = false; }, online() { online = true; },
    fail(path) { failedPath = path; }, login(path) { loginPath = path; },
    state: () => ({ skipped, claimed }),
    navigate: path => fire('fetch', { request: { method: 'GET', mode: 'navigate', url: ORIGIN + path } }),
    asset: path => fire('fetch', { request: new WorkerRequest(path) }),
  };
}

test('the exact built shell and every asset are saved without fetching a hosting or sign-in page', async () => {
  const app = worker();
  await app.fire('install');
  assert.deepEqual(app.requests.sort(), [...FILES].sort());
  assert(app.state().skipped);
  const status = await app.status();
  assert(status.ready);
  assert.equal(status.saved, FILES.length + 1);
  const response = await app.navigate('/');
  assert.equal(await response.text(), SHELL);
  assert.equal(response.redirected, false);
  assert.equal(response.headers.get('vary'), null);
});

test('cold offline launches and notification deep links need no network, including Vary-sensitive assets', async () => {
  const app = worker();
  await app.fire('install');
  app.offline();
  const requests = app.requests.length;
  for (const path of ['/', '/index.html', '/?view=schedule&day=1&subject=oop-lab&start=11%3A00']) {
    assert.equal(await (await app.navigate(path)).text(), SHELL);
  }
  for (const path of FILES) assert.equal(await (await app.asset(path + '?preload=1')).text(), `asset:${path}`);
  assert.equal(app.requests.length, requests);
  assert((await app.status()).ready);
});

test('an incomplete download cannot activate or report ready and can be repaired online', async () => {
  const app = worker();
  app.fail('/assets/pass.js');
  await assert.rejects(app.fire('install'), /Network unavailable/);
  assert.equal(app.state().skipped, false);
  assert.equal((await app.status()).ready, false);
  app.fail('');
  assert((await app.status('OFFLINE_PREPARE')).ready);
  app.stores.get('umt-everyday-new').delete('/fonts/poppins.woff2');
  assert.equal((await app.status()).ready, false);
  app.offline();
  assert.equal((await app.status('OFFLINE_PREPARE')).ready, false);
  app.online();
  assert((await app.status('OFFLINE_PREPARE')).ready);
});

test('successful HTML login responses are rejected as offline script downloads', async () => {
  const app = worker();
  app.login('/assets/app.js');
  await assert.rejects(app.fire('install'), /Offline file unavailable/);
  assert.equal(app.state().skipped, false);
  assert.equal((await app.status()).ready, false);
});

test('updates keep the previous build usable offline without touching unrelated data or endpoints', async () => {
  const app = worker();
  await (await app.caches.open('unrelated-data')).put('/private.json', new Response('unrelated'));
  await (await app.caches.open('umt-everyday-ancient')).put('/assets/ancient.js', new Response('ancient'));
  await (await app.caches.open('umt-everyday-previous')).put('/assets/old-pass.js', new Response('previous 3D module'));
  await app.fire('install');
  await app.fire('activate');
  assert.deepEqual(await app.caches.keys(), ['unrelated-data', 'umt-everyday-previous', 'umt-everyday-new']);
  assert(app.state().claimed);
  app.offline();
  assert.equal(await (await app.asset('/assets/old-pass.js')).text(), 'previous 3D module');
  assert.equal(await app.asset('/reminder-service.json'), undefined);
  assert.equal(await app.navigate('/signin-with-chatgpt'), undefined);
  assert.equal(await app.fire('fetch', { request: { method: 'POST', mode: 'cors', url: ORIGIN + '/api/device' } }), undefined);
  assert.equal(await app.asset('https://reminders.example/config'), undefined);
});
