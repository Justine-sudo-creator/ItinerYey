// Offline hackathon demo: serves ItinerYey on the laptop's network so phones on
// the same Wi-Fi/hotspot can use it. No internet needed. Usage: npm run demo [-- --dev]
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';

const PORT = process.env.PORT || '3000';
const dev = process.argv.includes('--dev');
const env = {
  ...process.env,
  OFFLINE_MODE: process.env.OFFLINE_MODE ?? '1',
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'offline-demo',
};
const next = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (args) => spawnSync(next, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });

const ollama = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
try {
  const res = await fetch(`${ollama.replace(/\/$/, '')}/api/tags`);
  const { models = [] } = await res.json();
  console.log(`✓ Ollama running with: ${models.map(m => m.name).join(', ') || '(no models — run: ollama pull qwen2.5:3b && ollama pull qwen2.5vl:3b)'}`);
} catch {
  console.warn('! Ollama is not running. Start it with `ollama serve` (the app still plans routes without it).');
}

if (!dev && !existsSync('.next/BUILD_ID')) {
  console.log('Building production bundle (first run only)…');
  if (run(['next', 'build']).status !== 0) process.exit(1);
}

const urls = Object.values(os.networkInterfaces()).flat()
  .filter(i => i && i.family === 'IPv4' && !i.internal)
  .map(i => `http://${i.address}:${PORT}/ask`);
console.log('\nItinerYey offline demo');
console.log(`  Laptop: http://localhost:${PORT}/ask`);
for (const u of urls) console.log(`  Phone (same Wi-Fi/hotspot): ${u}`);
console.log('');

const child = spawn(next, ['next', dev ? 'dev' : 'start', '-H', '0.0.0.0', '-p', PORT], {
  stdio: 'inherit', env, shell: process.platform === 'win32',
});
child.on('exit', code => process.exit(code ?? 0));
