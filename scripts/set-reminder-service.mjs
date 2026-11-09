import fs from 'node:fs';
const url = new URL(process.argv[2]);
if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Provide the exact HTTPS origin returned by Cloudflare, with no credentials, path, or query.');
fs.writeFileSync('public/reminder-service.json', JSON.stringify({ apiBase: url.origin }, null, 2) + '\n');
console.log('Reminder service origin saved. Rebuild and publish the PWA to use it.');
