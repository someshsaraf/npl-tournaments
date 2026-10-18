#!/usr/bin/env node
/**
 * Local development: the API/realtime server (auto-restarts on change) and
 * the Vite dev server (hot reload), side by side. Vite proxies /api, /ws and
 * /media to the server — see vite.config.ts.
 */
import { spawn } from 'node:child_process';

const procs = [
  // --include .env: restart the server when .env changes (it's only read at startup).
  spawn('npx', ['tsx', 'watch', '--clear-screen=false', '--include', '.env', 'server/index.ts'], { stdio: 'inherit' }),
  spawn('npx', ['vite'], { stdio: 'inherit' })
];

const stop = () => {
  for (const p of procs) p.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => code && stop());
