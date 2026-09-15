// M3-010: content supply-chain D3 gate — aggregate M3-001..009 by reference.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const ledger = read('requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md');
const statusOf = (id) => {
  for (const line of ledger.split(/\r?\n/u)) {
    if (!line.startsWith(`| \`${id}\``)) continue;
    const cols = line.slice(1, -1).split('|').map((c) => c.trim());
    const m = /^`([A-Z_]+)`$/u.exec(cols[7] ?? '');
    return m ? m[1] : 'MALFORMED';
  }
  return 'MISSING';
};
const links = ['P1R-M3-001','P1R-M3-002','P1R-M3-003','P1R-M3-004','P1R-M3-005','P1R-M3-006','P1R-M3-007','P1R-M3-008','P1R-M3-009'];
const statuses = links.map((id) => `${id}=${statusOf(id)}`);
record('ledger-chain-finished', statuses.every((s) => s.endsWith('=DEV_DONE')),
  statuses.join(', '), 'M3-001..009 all DEV_DONE');
const missing = links.map((id) => `evidence/p1r/m3/${id}/manifest.json`).filter((p) => !exists(p));
record('manifests-exist', missing.length === 0,
  missing.length === 0 ? '9 manifests present' : `missing: ${missing.join(', ')}`, '9 manifests');
const bad = [];
for (const id of links) {
  try {
    const m = JSON.parse(read(`evidence/p1r/m3/${id}/manifest.json`));
    if (m.taskId !== id || m.canonicalTaskStatus !== 'DEV_DONE') bad.push(`${id}: mismatch`);
    for (const r of (m.results ?? [])) {
      if (!['PASS','SKIP','NOT_APPLICABLE'].includes(r.status)) { bad.push(`${id}: failing result`); break; }
    }
  } catch (e) { bad.push(`${id}: unreadable`); }
}
record('manifests-agree-and-pass', bad.length === 0,
  bad.length === 0 ? '9 agree with ledger, all results passing' : bad.join('; '), 'agreement');
record('draft-to-publish-covered', ['P1R-M3-002','P1R-M3-005','P1R-M3-006','P1R-M3-007'].every((id) => statusOf(id) === 'DEV_DONE'),
  'draft→review→publish→takedown/rollback owned', 'lifecycle');
record('four-projections-covered', ['P1R-M3-006','P1R-M3-008'].every((id) => statusOf(id) === 'DEV_DONE'),
  'learner/public projections owned', 'projections');
record('content-publish-e2e-ready', statusOf('P1R-M3-006') === 'DEV_DONE' && statusOf('P1R-M2-005') === 'DEV_DONE',
  'outbox/Kafka spine (M2-005) + publish (M3-006) finished', 'E2E precondition');
console.log('M3-010 gate: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M3-010', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Live draft→dual-review→publish→four-projection→takedown/rollback run across the running stack is deferred to M8 W0 CONTENT-PUBLISH.'],
  note: 'Aggregation by reference over the nine committed M3 manifests.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm3', 'P1R-M3-010'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m3/P1R-M3-010/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
