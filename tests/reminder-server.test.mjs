import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createECDH, randomBytes } from 'node:crypto';
import webpush from 'web-push';
import worker, { runScheduled, sendPush, validSubscription } from '../server/index.js';

const keys = webpush.generateVAPIDKeys();
function environment() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../server/migrations/0001_reminders.sql', import.meta.url), 'utf8'));
  const DB = { prepare(query) {
    let args = [];
    const statement = sql.prepare(query);
    return { bind(...values) { args = values; return this; }, async first() { return statement.get(...args) || null; }, async all() { return { results: statement.all(...args) }; }, async run() { return { meta: statement.run(...args) }; } };
  } };
  return { DB, APP_ORIGIN: 'https://example.com', VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, PAIRING_CODE: 'a-private-test-connection-code', sql };
}
function subscription() {
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  return { endpoint: 'https://web.push.apple.com/test-device', keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } };
}
function request(env, path, { method = 'GET', body, credential, origin = env.APP_ORIGIN } = {}) {
  return new Request(`https://reminders.example.com${path}`, { method, headers: { Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function pair(env) {
  const response = await worker.fetch(request(env, '/devices', { method: 'POST', body: { code: env.PAIRING_CODE, subscription: subscription() } }), env);
  assert.equal(response.status, 201);
  return (await response.json()).credential;
}

test('personal device pairing requires its private code, correct origin, and a known push provider', async () => {
  const env = environment();
  assert.equal((await worker.fetch(request(env, '/config', { origin: 'https://unrelated.example' }), env)).status, 403);
  assert.equal((await worker.fetch(request(env, '/devices', { method: 'POST', body: { code: 'wrong', subscription: subscription() } }), env)).status, 401);
  const local = subscription(); local.endpoint = 'https://127.0.0.1/private';
  assert.equal(validSubscription(local), false);
  local.endpoint = 'https://push.apple.com.attacker.example/private';
  assert.equal(validSubscription(local), false);
  assert.equal((await worker.fetch(request(env, '/device'), env)).status, 401);
  const credential = await pair(env);
  const device = await worker.fetch(request(env, '/device', { credential }), env);
  assert.deepEqual(await device.json(), { enabled: true });
  assert(!env.sql.prepare('SELECT token_hash FROM devices').get().token_hash.includes(credential.split('.')[1]));
  assert.equal((await worker.fetch(request(env, '/device', { method: 'DELETE', credential }), env)).status, 200);
  assert.equal((await worker.fetch(request(env, '/device', { credential }), env)).status, 401);
  env.sql.close();
});

test('scheduler claims a reminder once, uses high urgency, and does not catch up after the expiry', async () => {
  const env = environment(); await pair(env);
  const at = new Date('2026-10-19T07:20:05Z');
  const sent = [];
  const send = async (_env, _sub, payload, ttl) => { sent.push({ payload, ttl }); return new Response(null, { status: 201 }); };
  await Promise.all([runScheduled(env, at, send, () => at.getTime()), runScheduled(env, at, send, () => at.getTime())]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].ttl, 55);
  assert.match(sent[0].payload.body, /SST1-702/);
  assert.equal(env.sql.prepare('SELECT state FROM deliveries').get().state, 'accepted');
  await runScheduled(env, new Date('2026-10-19T07:21:00Z'), send, () => Date.parse('2026-10-19T07:21:00Z'));
  assert.equal(sent.length, 1);
  const config = await worker.fetch(request(env, '/config'), env);
  assert((await config.json()).publicKey === env.VAPID_PUBLIC_KEY);
  env.sql.close();
});

test('expired subscriptions are removed and uncertain sends are never blindly retried', async () => {
  const env = environment(); await pair(env);
  const at = new Date('2026-10-19T07:20:00Z');
  await runScheduled(env, at, async () => new Response(null, { status: 410 }), () => at.getTime());
  assert.equal(env.sql.prepare('SELECT COUNT(*) AS count FROM devices').get().count, 0);
  const another = environment(); await pair(another);
  let calls = 0;
  const uncertain = async () => { calls++; throw new Error('Timeout after possible acceptance'); };
  await runScheduled(another, at, uncertain, () => at.getTime());
  await runScheduled(another, at, uncertain, () => at.getTime());
  assert.equal(calls, 1);
  assert.equal(another.sql.prepare('SELECT state FROM deliveries').get().state, 'unknown');
  env.sql.close(); another.sql.close();
});

test('push transport encrypts the message and sets the promised short lifetime and urgency', async () => {
  const env = environment();
  const payload = { title: 'OOP in 10 minutes', body: '12:30 PM · SST1-702' };
  let captured;
  await sendPush(env, subscription(), payload, 45, async (url, options) => { captured = { url, ...options }; return new Response(null, { status: 201 }); });
  assert.equal(captured.headers.TTL, 45);
  assert.equal(captured.headers.Urgency, 'high');
  assert.equal(captured.headers['Content-Encoding'], 'aes128gcm');
  assert.match(captured.headers.Authorization, /^vapid /);
  assert.equal(captured.redirect, 'manual', 'use the Workers-supported mode without forwarding credentials through redirects');
  assert(!Buffer.from(captured.body).toString().includes('SST1-702'));
  env.sql.close();
});
