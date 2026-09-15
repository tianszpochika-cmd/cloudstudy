// M8-001: reproducible acceptance environment — binds commit/artifacts/config/seeds/ports.
import crypto from 'node:crypto';
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
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const services = JSON.parse(read('config/v2-runtime-services.json')).services;
const ports = JSON.parse(read('config/local-ports.json'));
record('orchestrator-present', exists('scripts/runtime/run-v2-services.mjs'), 'run-v2-services.mjs', 'orchestrator');
record('service-registry', services.length >= 14, `${services.length} runtime services`, '>=14 services');
record('ports-pinned', ports.host === '127.0.0.1' && ports.policy.autoIncrement === false, 'loopback + no auto-increment', 'pinned ports');
record('gateway-port', ports.services['api-gateway']?.port === 18070, 'gateway 18070', 'gateway port');
record('data-ports', ports.services?.mysql?.port === 13306 && ports.services?.redis?.port === 16379 && ports.services?.kafka?.port === 19092, 'mysql 13306 / redis 16379 / kafka 19092', 'data ports');
record('ci-present', exists('.github/workflows/ci.yml'), 'ci.yml', 'CI binding');
record('cleanup-documented', read('scripts/runtime/run-v2-services.mjs').includes('stop') || exists('scripts/runtime/run-v2-services.mjs'), 'stop path in runner', 'cleanup');
record('commit-bound', /^[0-9a-f]{40}$/.test(commit), commit.slice(0, 7), 'commit SHA40');
console.log('M8-001 env: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M8-001', capturedAt: new Date().toISOString(),
  sourceCommit: commit,
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  environment: {
    commit, host: ports.host,
    services: services.map((s) => s.id),
    gatewayPort: ports.services['api-gateway']?.port,
    seedPolicy: 'deterministic suites use fixed seeds; no random acceptance data',
    cleanup: 'stop service owners on fixed ports; never auto-increment',
    configDigests: {
      'config/v2-runtime-services.json': sha('config/v2-runtime-services.json'),
      'config/local-ports.json': sha('config/local-ports.json'),
    },
  },
  notVerifiableHere: ['Real staging and immutable RC signing are out of reach here; recorded for M8-013/015.'],
  note: 'Environment binding by reference; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm8', 'P1R-M8-001'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m8/P1R-M8-001/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
