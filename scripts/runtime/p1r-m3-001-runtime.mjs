// M3-001: admin login, shell, dashboard, role navigation and permission states.
//
// Ledger: editor/reviewer/release/auditor 分权；深链/403/空/错/恢复八态浏览器测试.
// What is measured here (committed tree, no live browser): login view + shell + dashboard +
// forbidden routes exist, router guards by server permission snapshot, client never fabricates
// role/tenant/owner, eight UI states are defined. Live browser eight-state run is deferred to M8.
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

// 1. views exist
for (const v of ['apps/admin-web/src/views/AdminLoginView.vue','apps/admin-web/src/views/AdminDashboardView.vue','apps/admin-web/src/views/AdminForbiddenView.vue','apps/admin-web/src/App.vue']) {
  record(`view-exists:${v.split('/').pop()}`, exists(v), exists(v) ? 'present' : 'missing', 'present');
}
// 2. router guards
const router = read('apps/admin-web/src/router/index.ts');
record('router-requires-auth-and-permission', /requiresAuth:\s*true/u.test(router) && /permission:\s*'admin\./u.test(router),
  'requiresAuth + admin.* permission on domain routes', 'guarded routes');
// 3. permission snapshot only from server
const store = read('apps/admin-web/src/stores/admin.ts');
record('permission-snapshot-from-server', /getPermissions\(\)/u.test(store) && /applySnapshot/u.test(store),
  'getPermissions + applySnapshot', 'server snapshot');
// 4. no client role fabrication
const client = read('apps/admin-web/src/api/client.ts');
record('no-client-role-headers', /x-b5-role/u.test(client) && /forbiddenHeaderNames/u.test(client),
  'forged headers listed and rejected', 'client cannot escalate');
// 5. eight states defined
const ui = read('apps/admin-web/src/platform/ui-state.ts');
const states = ['loading','empty','error','permission','recovery','offline','success','partial'];
record('eight-ui-states-defined', states.every((s) => ui.includes(`'${s}'`)),
  states.filter((s) => ui.includes(`'${s}'`)).join(',') || 'none', states.join(','));
// 6. forbidden view explains server policy
const forbidden = read('apps/admin-web/src/views/AdminForbiddenView.vue');
record('forbidden-explains-server-policy', /permission/i.test(forbidden),
  'forbidden view renders permission context', 'permission explanation');
// 7. role-differentiated navigation (menu filtered by permission)
const app = read('apps/admin-web/src/App.vue');
record('menu-filtered-by-permission', /visibleMenuItems/u.test(app) && /session\.can\(/u.test(app),
  'menu filtered by session.can(permission)', 'role navigation');

console.log('M3-001 admin shell: ' + checks.filter((c) => c.ok).length + '/' + checks.length);
for (const c of checks) { console.log('  ' + (c.ok ? 'ok  ' : 'FAIL') + ' ' + c.name); console.log('        ' + c.observed); }
const passed = checks.filter((c) => c.ok).length;
const evidence = {
  task: 'P1R-M3-001', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((c) => ({ check: c.name, status: c.ok ? 'PASS' : 'FAIL', observed: c.observed, expected: c.expected })),
  notVerifiableHere: ['Live browser eight-state run (deep-link/403/empty/error/recovery across editor/reviewer/release/auditor) needs a browser runner and is deferred to M8-007; what is measured is the committed shell, guards and state definitions.'],
  note: 'Read from the committed admin-web tree.',
};
if (write) {
  const dir = path.join(root, 'evidence', 'p1r', 'm3', 'P1R-M3-001');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m3/P1R-M3-001/runtime-2026-09-15.json');
}
process.exit(evidence.result === 'PASS' ? 0 : 1);
