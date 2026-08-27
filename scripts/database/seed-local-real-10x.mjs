import { runMysql } from './lib/mysql-client.mjs';
import {
  B3_EXPERIENCE_ROW_COUNT,
  FEATURE_STATE_ROW_COUNT,
  FIXTURE_DATE,
  FIXTURE_ID,
  FUNCTION_CHECK_COUNT,
  ROWS_PER_FUNCTION,
  SUBJECTS,
  assertLocalDatabaseTarget,
  buildFixtureSql,
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
  console.log(JSON.stringify({
    fixtureId: FIXTURE_ID,
    fixtureDate: FIXTURE_DATE,
    subjects: SUBJECTS.length,
    rowsPerFunction: ROWS_PER_FUNCTION,
    functionChecks: FUNCTION_CHECK_COUNT,
    b3ExperienceRows: B3_EXPERIENCE_ROW_COUNT,
    gamificationFeatureRows: FEATURE_STATE_ROW_COUNT,
    writesDatabase: false,
  }, null, 2));
  process.exit(0);
}

assertLocalDatabaseTarget();

runMysql({
  mysqlBin,
  mysqlArgs: args,
  password,
  cwd: root,
  input: buildFixtureSql(),
});

console.log(JSON.stringify({
  status: 'SEEDED',
  fixtureId: FIXTURE_ID,
  fixtureDate: FIXTURE_DATE,
  subjects: SUBJECTS.length,
  rowsPerFunction: ROWS_PER_FUNCTION,
  functionChecks: FUNCTION_CHECK_COUNT,
  b3ExperienceRows: B3_EXPERIENCE_ROW_COUNT,
  gamificationFeatureRows: FEATURE_STATE_ROW_COUNT,
  repeatable: true,
  database: `${host}:${port}`,
}, null, 2));
