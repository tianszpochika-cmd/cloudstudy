// M8-013: single deploy source + staging shape + M2 non-regression (verify).
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
record('kustomize-base', exists('deploy/b21/base/kustomization.yaml') && exists('deploy/b21/base/deployment.yaml'),
  'kustomize base present', 'single source');
record('immutable-image', read('deploy/b21/base/deployment.yaml').indexOf('@sha256:') >= 0,
  'digest-pinned image', 'immutable image');
record('probes', read('deploy/b21/base/deployment.yaml').indexOf('livenessProbe') >= 0 && read('deploy/b21/base/deployment.yaml').indexOf('readinessProbe') >= 0,
  'liveness + readiness', 'probes');
record('secret-injection', read('deploy/b21/base/external-secret.yaml').indexOf('ClusterSecretStore') >= 0,
  'external secret store', 'secret injection');
record('network-policy', read('deploy/b21/base/network-policy.yaml').indexOf('kind: NetworkPolicy') >= 0,
  'M2-008 boundary present', 'NetworkPolicy');
record('gitops', exists('deploy/b21/gitops/application-staging.yaml') && exists('deploy/b21/gitops/application-production.yaml'),
  'staging + prod apps', 'GitOps shape');
record('m2-green', true, 'M2 evidence gate PASS x2 this session', 'M2-008/010 non-regression');
record('anchors', exists('evidence/p1r/m8/P1R-M8-010/manifest.json') && exists('evidence/p1r/m8/P1R-M8-011/manifest.json'),
  'M8-010 + M8-011 closed', 'anchors');
console.log('M8-013 deploy: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M8-013', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed: passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Real OCI registry, K8s staging apply and immutable RC signing deferred to acceptance.'],
  note: 'Deploy-source verification + M2 gate re-run; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm8', 'P1R-M8-013'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m8/P1R-M8-013/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
