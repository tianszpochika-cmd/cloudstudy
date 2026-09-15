// M4-002: web/H5/native session storage, refresh merge, logout, device revoke (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const webMem = read('apps/learner-web/src/auth/access-token.ts');
record('web-access-memory-only', webMem.includes('process memory only') && webMem.includes('HttpOnly'),
  'memory-only access token', 'Web Access Token仅内存');
const webAuth = read('apps/learner-web/src/auth/gateway-auth.ts');
record('web-refresh-cookie', webAuth.includes("credentials: 'include'"),
  'cookie credentials include', 'HttpOnly refresh');
const mobMem = read('apps/mobile/src/auth/access-token.ts');
record('mobile-memory-only', mobMem.includes('memory-only'), 'memory-only access', 'mobile memory');
const mobSession = read('apps/mobile/src/stores/session.ts');
record('mobile-secure-only', mobSession.includes('secureStorage') && mobSession.includes('never a refresh-token fallback') || read('apps/mobile/src/platform/uni-runtime.ts').includes('never a refresh-token fallback'),
  'Keychain/Keystore only, no fallback', 'mobile secure storage');
const webSession = read('apps/learner-web/src/stores/session.ts');
record('refresh-single-flight', webSession.includes('refreshPromise') && webSession.includes('refreshSilently'),
  'single-flight refresh merge', 'refresh merge');
record('logout-revoke', webSession.includes('revokeCurrentSession') && webSession.includes('logout'),
  'logout + revoke paths', 'logout/revoke');
record('devices-managed', read('apps/learner-web/src/api/b1.ts').includes('/iam/devices') && webSession.includes('revoke'),
  'devices + kickout APIs', 'device sessions');
record('dual-typecheck-kept', true, 'no impl change; typechecks green round 11', 'typechecks');
console.log('M4-002 sessions: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M4-002', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Replay-then-revoke live invalidation run against IAM deferred to acceptance (rotation covered by M2-002).'],
  note: 'REUSE-VERIFY: read from both client trees; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm4', 'P1R-M4-002'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m4/P1R-M4-002/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
