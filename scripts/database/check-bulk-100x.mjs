import { runMysql } from './lib/mysql-client.mjs';
import { assertLocalDatabaseTarget } from './local-real-10x-fixture.mjs';

const mysqlBin = process.env.MYSQL_BIN || 'mysql';
const root = process.cwd();
const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = process.env.MYSQL_PORT || '13306';
const user = process.env.MYSQL_ADMIN_USER || 'root';
const password = process.env.MYSQL_ROOT_PASSWORD || 'root-local-only';
const args = [
  '--protocol=TCP',
  '--host', host,
  '--port', String(port),
  '--user', user,
  '--default-character-set=utf8mb4',
  '--batch',
  '--skip-column-names',
  '--raw',
];

const MIN_ROWS = 100;
const ALLOWLIST = new Map([
  ['iam_service.iam_policy_active_slot', 1],
]);

assertLocalDatabaseTarget();

const tablesOutput = runMysql({
  mysqlBin, mysqlArgs: args, password, cwd: root,
  input: [
    "SELECT CONCAT(TABLE_SCHEMA, '.', TABLE_NAME) FROM information_schema.TABLES",
    "WHERE TABLE_SCHEMA NOT IN ('mysql','information_schema','performance_schema','sys','yuxuexing')",
    "AND TABLE_TYPE = 'BASE TABLE'",
    "AND TABLE_NAME NOT IN ('flyway_schema_history','p1r_schema_history','schema_version')",
    'ORDER BY 1;',
  ].join('\n'),
});
const tables = tablesOutput.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
if (!tables.length) throw new Error('未发现业务表，拒绝空跑通过');

const query = `${tables.map((name) => `SELECT '${name}', COUNT(*) FROM ${name}`).join(' UNION ALL ')};\n`;
const output = runMysql({ mysqlBin, mysqlArgs: args, password, cwd: root, input: query });
const lines = output ? output.split(/\r?\n/).filter(Boolean) : [];
const counts = {};
const failures = [];
lines.forEach((line, index) => {
  const [reportedName, rawCount] = line.split('\t');
  const value = Number(rawCount);
  counts[reportedName] = Number.isFinite(value) ? value : null;
  const minimum = ALLOWLIST.get(tables[index]) ?? MIN_ROWS;
  if (reportedName !== tables[index] || !Number.isFinite(value) || value < minimum) {
    failures.push(`${tables[index]}=${Number.isFinite(value) ? value : 'NaN'} < ${minimum}`);
  }
});

const result = { status: failures.length ? 'FAIL' : 'PASS', tables: tables.length, minimum: MIN_ROWS, counts };
if (failures.length) {
  result.failures = failures;
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: result.status, tables: result.tables, minimum: result.minimum }));
}
