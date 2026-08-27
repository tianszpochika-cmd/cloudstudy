import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const scripts = [
  'seed-local-real-learning-world.mjs',
  'seed-local-real-commerce.mjs',
  'seed-local-real-admin-analytics.mjs',
];

for (const script of scripts) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'database', script)], {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('local real fixture suite ready: learning-world + commerce + admin-analytics');
