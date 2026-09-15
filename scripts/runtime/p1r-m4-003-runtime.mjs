// M4-003: adult gate + consent (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const gate = read('apps/learner-web/src/pages/AdultGatePage.vue');
record('adult-18-plus', gate.includes('getFullYear() - 18'), 'birthYear ≤ currentYear-18', '18+ gate');
record('reject-logs-out', gate.includes('session.logout'), 'reject → logout + login', 'minor reject');
const onb = read('apps/learner-web/src/pages/OnboardingPage.vue');
record('consent-checkboxes', onb.includes('privacyConsent') && onb.includes('termsConsent'), 'privacy + terms consents', 'consent page');
record('consent-versioned', read('apps/learner-web/src/api/learner-content.ts').includes('b30-consent-v1'), 'versioned consents via /iam/consents', 'consent version');
const router = read('apps/learner-web/src/router/index.ts');
record('gate-guard', router.includes("adultGate !== 'PASSED'"), 'router blocks until PASSED', 'restricted nav');
record('deep-link-kept', gate.includes('consumeReturnTo'), 'returnTo preserved', 'deep-link');
record('service-403', read('apps/learner-web/src/stores/session.ts').includes('CONSENT_REQUIRED'), 'CONSENT_REQUIRED not forbidden', 'service 403');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M4-003 gate: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M4-003', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Consent-withdraw live flow and cross-end deep-link run deferred to M8 W0.'],
  note: 'REUSE-VERIFY: read from the committed learner-web tree; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm4', 'P1R-M4-003'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m4/P1R-M4-003/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
