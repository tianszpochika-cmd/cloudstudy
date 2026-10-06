// R1-002 prep-4 政策 fixture 复查（只读复用，不重插）。
// policy-fixture-3 已记录三项政策完整读回 + 用户五表零基线（本卡复用，不重跑写入）。
// 本脚本统一使用 DPAPI 受控 vault 经 stdin 注入 runner 口令做只读复查；
// 秘密不出现在 argv/日志/证据；只记录存在性与复查结果。
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vaultLib = require('./r1-002-vault-4.cjs');

const dir = __dirname;
const root = path.resolve(dir, '..', '..', '..', '..', '..', '..');
const outDir = path.join(dir, 'policy-fixture-4');
fs.mkdirSync(outDir, { recursive: true });
const SCHEMA = 'r1_002_iam_t3g';
const RUNNER = 'r1_002_runner_t3g';

function mysqlAs(user, password, input, database) {
  const args = ['exec', '-i', 'yuxuexing-local-mysql-1', 'sh', '-c',
    'IFS= read -r MYSQL_PWD; export MYSQL_PWD; exec mysql "$@"', 'sh',
    '--protocol=TCP', '--host', '127.0.0.1', '--port', '3306', '--user', user,
    ...(database ? ['--database', database] : []),
    '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw'];
  const r = spawnSync('docker', args, {
    input: password + '\n' + input + '\n', encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) throw new Error('mysql 启动失败: ' + r.error.message);
  if (r.status !== 0) throw new Error('mysql exit ' + r.status + ': ' + (r.stderr || r.stdout || '').trim().slice(0, 500));
  return (r.stdout || '').trim();
}

const log = { checkedAt: new Date().toISOString(), schema: SCHEMA, runner: RUNNER, policySource: 'control-plane', purpose: '本地合成测试用途，不冒充正式法务签收', reuse: 'policy-fixture-3', steps: [], failedChecks: [] };
function step(name, ok, detail) {
  log.steps.push({ step: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error('STEP-FAIL:' + name + ' ' + JSON.stringify(detail || null).slice(0, 400)); }
  else console.log('STEP-PASS:' + name);
}
try {
  const { vault } = vaultLib.loadOrCreate();
  const m = vaultLib.meta();
  step('vault-controlled', m.exists && m.independent, { store: m.store, independent: m.independent });
  const rows = mysqlAs(RUNNER, vault.runnerPassword,
    "SELECT consent_type, document_version, document_digest, DATE_FORMAT(published_at,'%Y-%m-%d %H:%i:%s'), policy_version, policy_digest, requirement, capabilities, policy_ref, lifecycle_status FROM `" + SCHEMA + "`.iam_consent_document_version WHERE tenant_id='platform' ORDER BY consent_type;", SCHEMA);
  log.readback = rows.split('\n');
  step('fixture-readback-full', rows.split('\n').length === 3 && rows.split('\n').every((r) => r.endsWith('\tACTIVE')), { rows: log.readback.map((r) => r.slice(0, 60) + '...') });
  const users = mysqlAs(RUNNER, vault.runnerPassword,
    'SELECT COUNT(*) FROM `' + SCHEMA + '`.iam_account; SELECT COUNT(*) FROM `' + SCHEMA + '`.iam_consent; SELECT COUNT(*) FROM `' + SCHEMA + '`.iam_session; SELECT COUNT(*) FROM `' + SCHEMA + '`.iam_device; SELECT COUNT(*) FROM `' + SCHEMA + '`.iam_principal;', SCHEMA);
  log.userBaseline = users.split('\n').map(Number);
  step('user-baseline-zero', log.userBaseline.every((n) => n === 0), { counts: log.userBaseline });
} catch (e) {
  step('aborted', false, { error: String(e.message || e).slice(0, 400) });
}
log.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(outDir, 'policy-fixture-4.json'), JSON.stringify(log, null, 2));
if (log.failedChecks.length) { console.error('POLICY-FIXTURE-4: FAIL ' + log.failedChecks.length); process.exit(1); }
console.log('POLICY-FIXTURE-4: PASS docs=3 users-zero=true');
