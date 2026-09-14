#!/usr/bin/env node
/**
 * Refresh bundled dashboard JSON from Clubforce.
 * Usage:
 *   node scripts/refresh-data.mjs           # current season only
 *   node scripts/refresh-data.mjs --all     # current + completed seasons
 *   node scripts/refresh-data.mjs --completed
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const runCompleted = args.has('--all') || args.has('--completed');
const runCurrent = !args.has('--completed') || args.has('--all') || args.size === 0;

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(ROOT, 'scripts', script)], {
      stdio: 'inherit',
      cwd: ROOT,
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

if (runCurrent) {
  await run('fetch-current-season.mjs');
}

if (runCompleted) {
  await run('fetch-completed-seasons.mjs');
}
