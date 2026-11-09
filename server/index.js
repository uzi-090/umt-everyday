import webpush from 'web-push';
import { dueReminders, reminderPayload } from '../src/reminderSchedule.js';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const hex = bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
export const hash = async value => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const ready = env => Boolean(env.DB && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.PAIRING_CODE && env.APP_ORIGIN);

export function validSubscription(value) {
  try {
    const url = new URL(value.endpoint);
    const host = url.hostname;
    const allowed = host.endsWith('.push.apple.com') || host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' || host.endsWith('.notify.windows.com');
    return allowed && url.protocol === 'https:' && !url.username && !url.password && !url.port && value.endpoint.length < 2048 && /^[A-Za-z0-9_-]{87}$/.test(value.keys?.p256dh) && /^[A-Za-z0-9_-]{22}$/.test(value.keys?.auth);
  } catch { return false; }
}

async function authenticate(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  const match = /^Bearer ([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(authorization);
  if (!match) return null;
  const device = await env.DB.prepare('SELECT * FROM devices WHERE id = ? AND token_hash = ?').bind(match[1], await hash(match[2])).first();
  return device || null;
}

export async function sendPush(env, subscription, payload, ttl = 60, fetcher = fetch) {
  const details = webpush.generateRequestDetails(subscription, JSON.stringify(payload), {
    TTL: ttl, urgency: 'high', contentEncoding: 'aes128gcm',
    vapidDetails: { subject: env.APP_ORIGIN, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
  });
  // Workers supports manual redirects, not redirect: 'error'. Never forward VAPID credentials to a redirected endpoint.
  return fetcher(details.endpoint, { method: 'POST', headers: details.headers, body: details.body, redirect: 'manual', signal: AbortSignal.timeout(8000) });
}

async function api(request, env) {
  if (!ready(env)) return json({ error: 'The reminder service is not configured yet.' }, 503);
  const path = new URL(request.url).pathname;
  if (path === '/config' && request.method === 'GET') {
    const heartbeat = await env.DB.prepare("SELECT value FROM service_state WHERE key = 'last_cron'").first();
    return json({ publicKey: env.VAPID_PUBLIC_KEY, schedulerReady: !!heartbeat && Date.now() - heartbeat.value < 150000 });
  }
  if (request.method === 'POST' && Number(request.headers.get('Content-Length')) > 8192) return json({ error: 'Request too large.' }, 413);
  if (path === '/devices' && request.method === 'POST') {
    // Pairing code protects this personal app. Bound both per-IP and global guesses.
    const slot = Math.floor(Date.now() / 900000);
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    for (const [key, limit] of [[`${slot}-${await hash(ip)}`, 5], [`${slot}-global`, 50]]) {
      const row = await env.DB.prepare('INSERT INTO pair_attempts (id, attempts) VALUES (?, 1) ON CONFLICT(id) DO UPDATE SET attempts = attempts + 1 RETURNING attempts').bind(key).first();
      if (row.attempts > limit) return json({ error: 'Too many pairing attempts. Try again in 15 minutes.' }, 429);
    }
    const text = await request.text();
    if (text.length > 8192) return json({ error: 'Request too large.' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'Invalid request.' }, 400); }
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request.' }, 400);
    if (typeof body.code !== 'string' || await hash(body.code.trim()) !== await hash(env.PAIRING_CODE)) return json({ error: 'The connection code is incorrect.' }, 401);
    if (!validSubscription(body.subscription)) return json({ error: 'This push subscription is invalid.' }, 400);
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM devices').first();
    const existing = await env.DB.prepare('SELECT id FROM devices WHERE endpoint = ?').bind(body.subscription.endpoint).first();
    if (count.count >= 10 && !existing) return json({ error: 'Device limit reached. Disable reminders on another device first.' }, 409);
    const id = existing?.id || crypto.randomUUID();
    const token = randomToken();
    await env.DB.prepare('INSERT INTO devices (id, token_hash, subscription, endpoint, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT(endpoint) DO UPDATE SET token_hash = excluded.token_hash, subscription = excluded.subscription, enabled = 1').bind(id, await hash(token), JSON.stringify(body.subscription), body.subscription.endpoint, Date.now()).run();
    return json({ credential: `${id}.${token}` }, 201);
  }
  const device = await authenticate(request, env);
  if (!device) return json({ error: 'Reconnect reminders on this device.' }, 401);
  if (path === '/device' && request.method === 'GET') return json({ enabled: Boolean(device.enabled) });
  if (path === '/device' && request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(device.id).run();
    return json({ enabled: false });
  }
  if (path === '/test' && request.method === 'POST') {
    const claimed = await env.DB.prepare('UPDATE devices SET last_test_at = ? WHERE id = ? AND (last_test_at IS NULL OR last_test_at < ?) RETURNING id').bind(Date.now(), device.id, Date.now() - 60000).first();
    if (!claimed) return json({ error: 'Wait one minute before sending another test.' }, 429);
    const response = await sendPush(env, JSON.parse(device.subscription), { title: 'Class reminders are connected', body: 'You’ll get your class time and room 10 minutes before each session.', tag: 'reminder-test', url: '/?view=schedule' });
    if (response.status === 404 || response.status === 410) await env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(device.id).run();
    return response.ok ? json({ accepted: true }) : json({ error: 'The push service did not accept the test. Reconnect and try again.' }, 502);
  }
  return json({ error: 'Not found.' }, 404);
}

export async function runScheduled(env, now = new Date(), send = sendPush, clock = Date.now) {
  if (!ready(env)) return { configured: false, accepted: 0 };
  await env.DB.prepare("INSERT INTO service_state (key, value) VALUES ('last_cron', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(now.getTime()).run();
  const reminders = dueReminders(now);
  if (!reminders.length) return { accepted: 0 };
  const { results: devices } = await env.DB.prepare('SELECT * FROM devices WHERE enabled = 1').all();
  let accepted = 0;
  for (const item of reminders) for (const device of devices) {
    const id = `${item.id}-${device.id}`;
    if (clock() >= item.expiresAt) continue;
    const claim = await env.DB.prepare("INSERT OR IGNORE INTO deliveries (id, due_at, state) VALUES (?, ?, 'claimed')").bind(id, item.dueAt).run();
    if (!claim.meta.changes || clock() >= item.expiresAt) continue;
    try {
      const ttl = Math.min(60, Math.floor((item.expiresAt - clock()) / 1000));
      if (ttl < 1) continue;
      const response = await send(env, JSON.parse(device.subscription), reminderPayload(item), ttl);
      await env.DB.prepare('UPDATE deliveries SET state = ?, status_code = ? WHERE id = ?').bind(response.ok ? 'accepted' : 'failed', response.status, id).run();
      if (response.ok) accepted++;
      if (response.status === 404 || response.status === 410) await env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(device.id).run();
    } catch {
      // A timed-out request may already have been accepted: do not resend it.
      await env.DB.prepare("UPDATE deliveries SET state = 'unknown' WHERE id = ?").bind(id).run();
    }
  }
  return { accepted };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (origin !== env.APP_ORIGIN) return json({ error: 'Origin not allowed.' }, 403);
    const cors = { 'Access-Control-Allow-Origin': env.APP_ORIGIN, 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let response;
    try { response = await api(request, env); } catch (error) {
      const message = String(error.message || '').replace(/https?:\/\/[^\s)]+/g, '[url]').replace(/[A-Za-z0-9_+\/-]{20,}={0,2}/g, '[redacted]').slice(0, 250);
      console.error('reminder-api', { operation: ['/config', '/device', '/devices', '/test'].includes(new URL(request.url).pathname) ? new URL(request.url).pathname : 'unknown', name: error.name, message });
      response = json({ error: 'The reminder service is temporarily unavailable.' }, 503);
    }
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  },
  async scheduled(_controller, env) {
    // Use actual execution time; an overdue invocation never sends a backlog.
    if (!ready(env)) return;
    await runScheduled(env);
    if (new Date().getUTCHours() === 0 && new Date().getUTCMinutes() === 0) {
      const cutoff = Date.now() - 14 * 86400000;
      await env.DB.prepare('DELETE FROM deliveries WHERE due_at < ?').bind(cutoff).run();
      await env.DB.prepare('DELETE FROM pair_attempts WHERE id < ?').bind(String(Math.floor(Date.now() / 900000) - 2)).run();
    }
  },
};
