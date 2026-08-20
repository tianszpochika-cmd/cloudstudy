import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const flagPath = path.join(rootDir, 'config', 'feature-flags.json');
const envExamplePath = path.join(rootDir, '.env.example');
const flags = JSON.parse(fs.readFileSync(flagPath, 'utf8'));
const envExample = fs.readFileSync(envExamplePath, 'utf8');

if (flags.schemaVersion !== 'feature-flags.v1' || flags.audit?.defaultMode !== 'closed') {
  throw new Error('feature flag schema/default mode must be feature-flags.v1/closed');
}
for (const [key, value] of Object.entries(flags.defaults ?? {})) {
  if (!key || typeof value !== 'boolean') throw new Error(`invalid feature flag: ${key}`);
}
for (const flag of ['phase2.aiOrchestrator', 'phase2.realtimeVoice', 'phase3.k12', 'commerce.payments']) {
  if (flags.defaults[flag] !== false) throw new Error(`${flag} must be disabled in Phase 1`);
}
if (/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-[A-Za-z0-9]{20,}/.test(envExample)) {
  throw new Error('.env.example contains a high-confidence credential');
}
console.log(`Runtime configuration passed: ${Object.keys(flags.defaults).length} flags, Phase 1 safety switches closed.`);
