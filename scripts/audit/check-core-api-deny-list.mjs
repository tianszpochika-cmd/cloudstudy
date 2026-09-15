// Static guard for the core-api deny-list (P1R-M5-001, Evidence §8.1).
// Fails when any v2 production path references a quarantined v1 symbol.
// Usage: node scripts/audit/check-core-api-deny-list.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const denyList = JSON.parse(fs.readFileSync(path.join(root, 'config', 'core-api-deny-list.v1.json'), 'utf8'));
const symbols = denyList.entries.map((e) => e.symbol);
const violations = [];

const SKIP_DIRS = new Set(['node_modules', 'target', '.git', 'dist', '.nuxt', '.output', '.turbo']);
const SCAN_ROOTS = ['services', 'apps', 'packages'];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // core-api owns the denied symbols; scanning it would only find the definitions.
      if (path.relative(root, abs) === path.join('services', 'core-api')) continue;
      walk(abs);
      continue;
    }
    if (!/\.(java|ts|vue|mjs|js|tsx|jsx)$/u.test(entry.name)) continue;
    let text;
    try {
      text = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    for (const symbol of symbols) {
      if (text.includes(symbol)) {
        violations.push(`${path.relative(root, abs)} references denied symbol ${symbol}`);
      }
    }
  }
}

for (const scope of SCAN_ROOTS) {
  const abs = path.join(root, scope);
  if (fs.existsSync(abs)) walk(abs);
}

const result = { result: violations.length === 0 ? 'PASS' : 'FAIL', violations };
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`core-api deny-list: ${result.result} (${violations.length} violations)`);
  for (const v of violations.slice(0, 20)) console.log(`  FAIL ${v}`);
}
process.exit(violations.length === 0 ? 0 : 1);
