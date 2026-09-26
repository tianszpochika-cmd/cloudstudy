import { runMysql } from './lib/mysql-client.mjs';
import {
  FIXTURE_DATE,
  FIXTURE_ID,
  TABLE_CHECKS,
  assertLocalDatabaseTarget,
} from './local-real-10x-fixture.mjs';

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

if (process.argv.includes('--static-only')) {
  console.log(JSON.stringify({ fixtureId: FIXTURE_ID, fixtureDate: FIXTURE_DATE, checks: TABLE_CHECKS.length, readsDatabase: false }, null, 2));
  process.exit(0);
}

assertLocalDatabaseTarget();

const query = `${TABLE_CHECKS.map(([name, table, predicate]) =>
  `SELECT '${name}', COUNT(*) FROM ${table} WHERE ${predicate}`,
).join(' UNION ALL ')};\n`;
const output = runMysql({ mysqlBin, mysqlArgs: args, password, cwd: root, input: query });
const counts = {};
const failures = [];
const lines = output ? output.split(/\r?\n/).filter(Boolean) : [];

for (let index = 0; index < TABLE_CHECKS.length; index += 1) {
  const [name, , , minimum] = TABLE_CHECKS[index];
  const [reportedName, rawCount] = (lines[index] || '').split('\t');
  const value = Number(rawCount);
  counts[name] = Number.isFinite(value) ? value : null;
  if (reportedName !== name || !Number.isFinite(value) || value < minimum) {
    failures.push(`${name}=${Number.isFinite(value) ? value : 'NaN'} < ${minimum}`);
  }
}

const platformSocialRows = Number(runMysql({
  mysqlBin, mysqlArgs: args, password, cwd: root,
  input: `SELECT
    (SELECT COUNT(*) FROM social_service.soc_study_room WHERE tenant_id='platform'
      AND (room_id LIKE 'bulk-100x-%' OR room_id LIKE 'local-10x-%' OR room_id='room-local-foundations')) +
    (SELECT COUNT(*) FROM social_service.soc_room_member WHERE tenant_id='platform'
      AND (room_id LIKE 'bulk-100x-%' OR room_id LIKE 'local-10x-%' OR room_id='room-local-foundations')) +
    (SELECT COUNT(*) FROM social_service.soc_seat_lease WHERE tenant_id='platform'
      AND (room_id LIKE 'bulk-100x-%' OR room_id LIKE 'local-10x-%' OR room_id='room-local-foundations')) +
    (SELECT COUNT(*) FROM social_service.soc_focus_state WHERE tenant_id='platform'
      AND (room_id LIKE 'bulk-100x-%' OR room_id LIKE 'local-10x-%' OR room_id='room-local-foundations')) +
    (SELECT COUNT(*) FROM social_service.soc_interaction WHERE tenant_id='platform'
      AND (room_id LIKE 'bulk-100x-%' OR room_id LIKE 'local-10x-%' OR room_id='room-local-foundations')) +
    (SELECT COUNT(*) FROM social_service.soc_report WHERE tenant_id='platform'
      AND (room_id LIKE 'bulk-100x-%' OR room_id LIKE 'local-10x-%' OR room_id='room-local-foundations'));\n`,
}));
if (!Number.isFinite(platformSocialRows) || platformSocialRows !== 0) {
  failures.push(`platform-social-fixture-rows=${platformSocialRows} != 0`);
}

const result = {
  status: failures.length ? 'FAIL' : 'PASS',
  fixtureId: FIXTURE_ID,
  fixtureDate: FIXTURE_DATE,
  checks: TABLE_CHECKS.length,
  counts,
  platformSocialRows,
};

if (failures.length) {
  result.failures = failures;
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}
