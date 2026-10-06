// prep-4 一次性轮换：仅本卡专用身份 r1_002_*_t3g；更改replay/fingerprint前已确认
// t3g 零用户/零会话/零幂等事实（policy fixture 3 文书保留，不属需清除的用户事实）。
// 新口令来自 DPAPI vault，经受控 stdin 注入；不出现在 argv/日志/证据。
'use strict';
const { spawnSync } = require('node:child_process');
const vault = require('./r1-002-vault-4.cjs').load();

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

const esc = (s) => String(s).replaceAll("'", "''");
const sql =
  "ALTER USER 'r1_002_migrator_t3g'@'%' IDENTIFIED BY '" + esc(vault.migratorPassword) + "';\n" +
  "ALTER USER 'r1_002_runner_t3g'@'%' IDENTIFIED BY '" + esc(vault.runnerPassword) + "';\n" +
  "FLUSH PRIVILEGES;";
mysqlAs('root', process.env.MYSQL_ROOT_PASSWORD || (() => { throw new Error('MYSQL_ROOT_PASSWORD required'); })(), sql);
console.log('ROTATE-OK t3g-only');

for (const u of ['r1_002_runner_t3g', 'r1_002_migrator_t3g']) {
  const pw = u.startsWith('r1_002_runner') ? vault.runnerPassword : vault.migratorPassword;
  mysqlAs(u, pw, 'SELECT 1;', 'r1_002_iam_t3g');
  console.log('CONNECT-OK ' + u);
}
