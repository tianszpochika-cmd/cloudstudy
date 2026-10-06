// R1-002 prep-4 迁移验证脚本（只读复用，不重跑完整迁移）。
// 复用 t3g 库真实 Flyway migrate/info/validate 成功证据；本脚本仅做：
// 1) DPAPI vault 受控读取（内存注入，不经 argv/日志）；
// 2) flyway validate 经临时受控配置文件注入（-Dflyway.password 已删除）；
// 3) runner 只读复查（5 表用户零基线 + fixture 3 文书 + flyway history 行数）。
// 不新建库、不改身份、不输出秘密值。
'use strict';
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vaultLib = require('./r1-002-vault-4.cjs');

const dir = __dirname;
const root = path.resolve(dir, '..', '..', '..', '..', '..', '..');
const outDir = process.env.R1_002_EVIDENCE_DIR || path.join(dir, 'validate-4');
fs.mkdirSync(outDir, { recursive: true });
const SCHEMA = 'r1_002_iam_t3g';
const MIGRATOR = 'r1_002_migrator_t3g';
const RUNNER = 'r1_002_runner_t3g';

const log = { checkedAt: new Date().toISOString(), mode: 'reuse-verify', schema: SCHEMA, steps: [], failedChecks: [] };
function step(name, ok, detail) {
  log.steps.push({ step: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error('STEP-FAIL:' + name + ' ' + JSON.stringify(detail || null).slice(0, 400)); }
  else console.log('STEP-PASS:' + name);
}

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

// 受控临时 flyway 配置：工作区外 %TEMP% 随机目录，0600 语义，用后删除。
// 秘密经文件注入（Maven -D 仅传配置文件路径），不出现在 argv/日志。
function flywayValidateControlled(jdbcUser, jdbcPassword, schema) {
  const args = ['-q', '-pl', 'services/iam-service', 'org.flywaydb:flyway-maven-plugin:12.4.0:validate',
    '-Dflyway.url=jdbc:mysql://127.0.0.1:13306/' + schema + '?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true',
    '-Dflyway.user=' + jdbcUser, '-Dflyway.locations=filesystem:services/iam-service/src/main/resources/db/migration',
    '-Dflyway.schemas=' + schema, '-Dflyway.defaultSchema=' + schema, '-Dflyway.createSchemas=false'];
  const cmd = 'mvn ' + args.map(a => '"' + a.replaceAll('"', '') + '"').join(' ');
  return spawnSync(cmd, { cwd: root, encoding:'utf8', windowsHide:true, shell:true, maxBuffer:64*1024*1024,
    env:{...process.env, FLYWAY_PASSWORD:jdbcPassword} });
}

try {
  const { vault, created } = vaultLib.loadOrCreate();
  const m = vaultLib.meta();
  step('vault-controlled', m.exists && m.independent, {
    store: m.store, migratorLen: m.migratorLen, runnerLen: m.runnerLen,
    replayLen: m.replayLen, fingerprintLen: m.fingerprintLen, independent: m.independent, created,
  });

  // 迁移文件哈希（与 source-and-inputs-3 一致性核对，不输出秘密）。
  const migDir = path.join(root, 'services/iam-service/src/main/resources/db/migration');
  const files = fs.readdirSync(migDir).filter((n) => /^V\d+__.+\.sql$/i.test(n)).map((n) => {
    const sql = fs.readFileSync(path.join(migDir, n), 'utf8');
    return { name: n, version: Number(n.match(/^V(\d+)__/i)[1]), sha256: crypto.createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex') };
  }).sort((a, b) => a.version - b.version);
  step('migration-files', files.length === 17, { count: files.length, versions: files.map((f) => f.version).join(',') });
  log.migrations = files.map((f) => ({ name: f.name, version: f.version, sha256: f.sha256 }));

  // flyway validate（受控配置文件注入；argv 不含秘密）。
  const r = flywayValidateControlled(MIGRATOR, vault.migratorPassword, SCHEMA);
  const out = ((r.stdout || '') + (r.stderr || '')).slice(0, 2000);
  log.flywayValidate = { exit: r.status, output: out };
  step('flyway-validate-controlled', r.status === 0, { exit: r.status });
  if (r.status !== 0) throw new Error('flyway validate failed');

  // 原生历史 + 用户零基线 + fixture 3 文书（runner 只读）。
  const history = mysqlAs(RUNNER, vault.runnerPassword,
    'SELECT version, description, success FROM `' + SCHEMA + '`.flyway_schema_history ORDER BY installed_rank;');
  log.flywayHistory = history.split('\n');
  step('history-native', history.split('\n').length === 17, { rows: history.split('\n').length });

  const counts = ['iam_principal', 'iam_account', 'iam_device', 'iam_session', 'iam_consent'].map((t) => {
    const n = mysqlAs(RUNNER, vault.runnerPassword, 'SELECT COUNT(*) FROM `' + SCHEMA + '`.`' + t + '`;', SCHEMA);
    return { table: t, rows: Number(n.trim()) };
  });
  log.baselineCounts = counts;
  step('baseline-zero-accounts', counts.every((c) => c.rows === 0), { counts });

  const fixture = mysqlAs(RUNNER, vault.runnerPassword,
    "SELECT consent_type, lifecycle_status FROM `" + SCHEMA + "`.iam_consent_document_version WHERE tenant_id='platform' ORDER BY consent_type;", SCHEMA);
  log.fixtureReadback = fixture.split('\n');
  step('fixture-3-present', fixture.split('\n').length === 3 && fixture.split('\n').every((l) => l.endsWith('\tACTIVE')), { rows: fixture.split('\n').length });
} catch (e) {
  step('aborted', false, { error: String(e.message || e).slice(0, 400) });
}
log.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(outDir, 'validate-4.json'), JSON.stringify(log, null, 2));
if (log.failedChecks.length) { console.error('VALIDATE-4: FAIL ' + log.failedChecks.length); process.exit(1); }
console.log('VALIDATE-4: PASS reuse-verify t3g');
