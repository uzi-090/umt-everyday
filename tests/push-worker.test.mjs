import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function worker(windows = []) {
  const handlers = {}, shown = [], opened = [];
  const self = {
    location: { origin: 'https://example.com' },
    addEventListener(type, handler) { handlers[type] = handler; },
    registration: { async showNotification(title, options) { shown.push({ title, ...options }); } },
    clients: { async matchAll() { return windows; }, async openWindow(url) { opened.push(url); } },
  };
  vm.runInNewContext(readFileSync(new URL('../src/pushWorker.js', import.meta.url), 'utf8'), { self, URL });
  const fire = async (type, properties) => {
    let pending;
    handlers[type]({ ...properties, waitUntil(promise) { pending = promise; } });
    await pending;
  };
  return { fire, shown, opened };
}

test('every push displays visible content, including malformed or empty payloads', async () => {
  const app = worker();
  await app.fire('push', { data: { json: () => ({ title: 'OOP in 10 minutes', body: '12:30 PM · SST1-702', tag: 'one-class', url: '/?view=schedule&day=0' }) } });
  assert.equal(app.shown[0].title, 'OOP in 10 minutes');
  assert.equal(app.shown[0].body, '12:30 PM · SST1-702');
  await app.fire('push', { data: { json: () => null } });
  await app.fire('push', { data: { json: () => { throw new Error('Invalid JSON'); } } });
  assert.equal(app.shown.length, 3);
  assert.equal(app.shown[2].title, 'Class reminder');
});

test('notification taps reuse the app window and preserve the exact session link', async () => {
  let focused = false, navigated = '';
  const app = worker([{ url: 'https://example.com/', async navigate(url) { navigated = url; return { async focus() { focused = true; } }; } }]);
  await app.fire('notificationclick', { notification: { close() {}, data: { url: '/?view=schedule&day=1&subject=oop-lab&start=11%3A00' } } });
  assert.match(navigated, /subject=oop-lab/);
  assert(focused);
  assert.equal(app.opened.length, 0);
});

test('notification links cannot navigate to an external origin or unrelated path', async () => {
  for (const url of ['https://unrelated.example/', 'javascript:alert(1)', '/signin-with-chatgpt']) {
    const app = worker();
    await app.fire('notificationclick', { notification: { close() {}, data: { url } } });
    assert.deepEqual(app.opened, ['https://example.com/?view=schedule']);
  }
});
