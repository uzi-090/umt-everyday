import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import webpush from 'web-push';

const cli = 'node_modules/wrangler/bin/wrangler.js';
const config = 'server/wrangler.jsonc';
function run(args, input) {
  const result = spawnSync(process.execPath, [cli, ...args, '--config', config], { input, encoding: 'utf8', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  if (result.status !== 0) throw new Error(result.stderr || 'Cloudflare setup failed. Check that you are signed in.');
  return result.stdout;
}
try {
  const existing = run(['secret', 'list']);
  if (['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'PAIRING_CODE'].some(key => existing.includes(key))) throw new Error('Reminder secrets already exist. They were preserved; no keys were rotated.');
  const keys = webpush.generateVAPIDKeys();
  const code = randomBytes(12).toString('base64url');
  run(['secret', 'bulk'], JSON.stringify({ VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, PAIRING_CODE: code }));
  fs.mkdirSync('.openai', { recursive: true });
  fs.writeFileSync('.openai/reminder-connection.local.json', JSON.stringify({ deviceConnectionCode: code }, null, 2), { mode: 0o600 });
  console.log('Cloudflare secrets configured. The private device code is saved in .openai/reminder-connection.local.json (ignored by Git).');
} catch (error) { console.error(error.message); process.exitCode = 1; }
