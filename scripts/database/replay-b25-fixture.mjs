import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFlag, repositoryRoot } from './lib/migration-utils.mjs';
import { runMysql as runMysqlClient } from './lib/mysql-client.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..', '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'config', 'b25-data.json'), 'utf8'));
const seedSql = fs.readFileSync(path.join(root, config.fixture.seedSql), 'utf8');
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const purge = args.includes('--purge');
const mysqlBin = process.env.MYSQL_BIN || 'mysql';
const host = parseFlag(args, '--host', process.env.MYSQL_HOST || '127.0.0.1');
const port = parseFlag(args, '--port', process.env.MYSQL_PORT || '13306');
const user = parseFlag(args, '--user', process.env.MYSQL_USER || 'yuxuexing');
const database = parseFlag(args, '--database', process.env.MYSQL_DATABASE || 'yuxuexing');
const password = process.env.MYSQL_PASSWORD ?? 'yuxuexing';
const seedRunId = config.fixture.seedRunId.replaceAll("'", "''");
const tables = Object.keys(config.expectedRows);

function runNode(script, scriptArgs = []) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...scriptArgs], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    windowsHide: true
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function mysql(sql) {
  return runMysqlClient({
    mysqlBin,
    mysqlArgs: [
      '--protocol=TCP', '--host', host, '--port', String(port), '--user', user,
      '--database', database, '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw'
    ],
    password,
    cwd: repositoryRoot,
    input: `${sql.trim()}\n`
  });
}

function assertTablesExist() {
  const literals = tables.map((table) => `'${table.replaceAll("'", "''")}'`).join(', ');
  const actual = Number(mysql(`SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME IN (${literals});`));
  if (actual !== tables.length) throw new Error(`B25 migration tables are incomplete: expected ${tables.length}, found ${actual}`);
}

function purgeFixture() {
  const statements = tables
    .slice()
    .reverse()
    .map((table) => `DELETE FROM \`${table}\` WHERE fixture_run_id = '${seedRunId}';`)
    .join('\n');
  mysql(`START TRANSACTION;\n${statements}\nCOMMIT;`);
  console.log(`B25 targeted fixture purge completed for ${config.fixture.seedRunId}; no DROP/TRUNCATE was used.`);
}

if (purge && !apply) {
  console.error('Refusing --purge without explicit --apply. Preview is the default.');
  process.exitCode = 1;
} else {
  runNode('scripts/database/validate-b25-data.mjs', ['--mode', 'static']);
  if (!apply) {
    console.log(`B25 fixture replay preview only: ${config.fixture.seedSql}`);
    console.log('No MySQL connection, migration, Redis write or deletion was performed.');
  } else {
    try {
      assertTablesExist();
      if (purge) {
        purgeFixture();
      } else {
        mysql(seedSql);
        console.log(`B25 fixture replay applied to ${database}; this is data setup evidence only, not a formal runtime Gate.`);
      }
    } catch (error) {
      console.error(`B25 fixture replay failed: ${error.message}`);
      process.exitCode = 2;
    }
  }
}
