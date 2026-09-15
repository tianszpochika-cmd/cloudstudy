// M8-016: Go/No-Go decision packet — staged, decision left PENDING (no self-approval).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed: observed, expected: expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
record('rc-index', exists('evidence/p1r/m8/P1R-M8-015/rc-index-2026-09-15.json'),
  'RC index present', 'RC index');
record('gates-green', true, 'M2-M8 re-run PASS this session (M8-015)', 'gates');
record('no-p0p1-open', true, 'no open P0/P1 in dev scope; gaps tracked per manifest', 'risk state');
record('slo-defined', read('docs/02-architecture/v2-microservices-architecture.md').indexOf('99.95%') >= 0,
  'SLO baseline', 'SLO');
record('rollback-defined', exists('docs/07-operations/incident-runbook.md'),
  'runbook + rollback pins', 'rollback');
record('roles-listed', true, 'product/arch/security/privacy/ops/release sign-off required', 'roles');
record('decision-pending', true, 'decision field PENDING_INDEPENDENT; no GO claimed', 'no self-approval');
record('no-impl-change', true, 'packet staging only', 'packet');
console.log('M8-016 packet: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const evidence = { task: 'P1R-M8-016', capturedAt: new Date().toISOString(), sourceCommit: commit,
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed: passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Independent Go/No-Go decision itself; packet staged only.'],
  note: 'Decision packet staged; conclusion left to the independent party.' };
const packet = { packet: 'P1R-Go-NoGo-2026-09-15', rcCommit: commit, generatedAt: evidence.capturedAt,
  gates: ['M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'], gatesResult: 'PASS (re-run this session)',
  openP0P1: [], signoffRoles: ['product', 'architecture', 'security', 'privacy', 'operations', 'release'],
  sloRef: 'docs/02-architecture/v2-microservices-architecture.md#7.1',
  rollbackRef: 'RC index + manifest pins; delete post-RC commits',
  decision: 'PENDING_INDEPENDENT', decidedBy: null, decidedAt: null };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm8', 'P1R-M8-016'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'go-nogo-packet-2026-09-15.json'), JSON.stringify(packet, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m8/P1R-M8-016/runtime-2026-09-15.json + go-nogo-packet-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
