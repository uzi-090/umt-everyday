import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const dist = path.resolve('dist');
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name !== 'sw.js' && !entry.name.endsWith('.map')) files.push(file);
  }
}
walk(dist);
const signature = createHash('sha256');
for (const file of files.sort()) signature.update(fs.readFileSync(file));
const pushHandlers = fs.readFileSync(new URL('../src/pushWorker.js', import.meta.url), 'utf8');
signature.update(pushHandlers);
const offlineHandlers = fs.readFileSync(new URL('../src/offlineWorker.js', import.meta.url), 'utf8');
signature.update(offlineHandlers);
const version = signature.digest('hex').slice(0, 12);
const urls = files.filter(file => !['index.html', 'reminder-service.json'].includes(path.basename(file)) && !file.endsWith('.txt')).map(file => '/' + path.relative(dist, file).split(path.sep).join('/'));
const shell = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const worker = `const VERSION = '${version}';
const CACHE = 'umt-everyday-${version}';
const FILES = ${JSON.stringify(urls)};
const SHELL = ${JSON.stringify(shell)};
${offlineHandlers}
${pushHandlers}
`;
fs.writeFileSync(path.join(dist, 'sw.js'), worker);
console.log(`Offline shell ${version}: ${urls.length} local resources cached.`);
