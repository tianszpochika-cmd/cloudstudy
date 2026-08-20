import test from 'node:test';
import assert from 'node:assert/strict';

test('performance contract exposes four ordered levels', async () => {
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(new URL('../../packages/performance/src/index.ts', import.meta.url), 'utf8');
  assert.match(content, /export const PERFORMANCE_LEVELS = \['Ultra', 'High', 'Medium', 'Performance'\] as const/);
});

test('performance source contains required state-machine levels', async () => {
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(new URL('../../packages/performance/src/index.ts', import.meta.url), 'utf8');
  for (const level of ['Ultra', 'High', 'Medium', 'Performance']) assert.match(content, new RegExp(`['"]${level}['"]`));
  assert.match(content, /prefers-reduced-motion/);
  assert.match(content, /localStorage/);
});
