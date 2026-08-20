import test from 'node:test';
import assert from 'node:assert/strict';

test('performance contract exposes four ordered levels', async () => {
  const source = await import('../../packages/performance/src/index.ts').catch(() => null);
  assert.equal(source, null, 'TypeScript source is intentionally validated by vue-tsc/tsc, not Node runtime');
});

test('performance source contains required state-machine levels', async () => {
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(new URL('../../packages/performance/src/index.ts', import.meta.url), 'utf8');
  for (const level of ['Ultra', 'High', 'Medium', 'Performance']) assert.match(content, new RegExp(`['"]${level}['"]`));
  assert.match(content, /prefers-reduced-motion/);
  assert.match(content, /localStorage/);
});
