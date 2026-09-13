// Runs the data-ownership tests that are gated behind system properties, and writes the evidence.
//
// Ten *TenantIsolationTest classes and thirteen *FlywayMigrationTest classes each carry
// @EnabledIfSystemProperty, so a plain `mvn test` neither passes nor fails them: they do not run, and
// a suite report that says "2 skipped" is the only trace. Any claim about cross-tenant denial or
// about empty and existing database migration has to run them on purpose, with the admin connection
// and the scratch-schema flags they need. That is what this script does, and it records the outcome
// as evidence rather than leaving it to a summary line in a log.
//
// Usage: node scripts/runtime/run-gated-db-tests.mjs [--kind tenant|migration|both]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const SERVICES = [
  'admin-ops', 'analytics', 'assessment', 'audit', 'commerce', 'content',
  'gamification', 'iam', 'learner', 'learning', 'media', 'notification', 'social',
];

/** The tests append the scratch schema to this URL, so it must end at the slash. */
export function adminUrl(host = '127.0.0.1', port = '13306') {
  return `jdbc:mysql://${host}:${port}/`;
}

function testClasses(root, service, suffix) {
  const directory = path.join(root, `services/${service}-service/src/test/java`);
  if (!fs.existsSync(directory)) return [];
  const found = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.name.endsWith(`${suffix}.java`)) found.push(entry.name.replace('.java', ''));
    }
  };
  visit(directory);
  return found;
}

/**
 * Runs the gated data-ownership tests. Each class is run on its own so a failure names the service
 * rather than an aggregate count.
 */
export function runGatedDatabaseTests(options = {}) {
  const root = options.root ?? repositoryRoot;
  const kind = options.kind ?? 'both';
  const host = options.host ?? process.env.MYSQL_HOST ?? '127.0.0.1';
  const port = options.port ?? process.env.MYSQL_PORT ?? '13306';
  const rootPassword = options.rootPassword ?? process.env.MYSQL_ROOT_PASSWORD ?? 'root-local-only';
  const javaHome = options.javaHome ?? process.env.JAVA_HOME ?? 'C:\\Program Files\\Microsoft\\jdk-25.0.4.101-hotspot';

  const results = [];
  for (const service of SERVICES) {
    for (const [suffix, flag, property, envStem] of [
      ['TenantIsolationTest', 'tenant', 'tenant.integration', 'TENANT'],
      ['FlywayMigrationTest', 'migration', 'migration.integration', 'FLYWAY'],
    ]) {
      if (kind !== 'both' && kind !== flag) continue;
      const classes = testClasses(root, service, suffix);
      if (classes.length === 0) continue;
      const prefix = service.replaceAll('-', '').toUpperCase();
      const result = spawnSync('mvn', ['-f', path.join(root, `services/${service}-service/pom.xml`), '-o',
        `-D${prefix.toLowerCase()}.${property}=true`, `-Dtest=${classes.join(',')}`, '-DfailIfNoTests=false', 'test'],
        {
          cwd: root,
          encoding: 'utf8',
          windowsHide: true,
          shell: true,
          env: {
            ...process.env,
            JAVA_HOME: javaHome,
            [`${prefix}_${envStem}_TEST_ADMIN_URL`]: adminUrl(host, port),
            [`${prefix}_${envStem}_TEST_ADMIN_USER`]: options.rootUser ?? 'root',
            [`${prefix}_${envStem}_TEST_ADMIN_PASSWORD`]: rootPassword,
          },
        });
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
      const summary = /Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)/u.exec(output);
      results.push({
        service,
        kind: flag,
        classes,
        passed: result.status === 0,
        testsRun: summary ? Number(summary[1]) : null,
        failures: summary ? Number(summary[2]) : null,
        errors: summary ? Number(summary[3]) : null,
        skipped: summary ? Number(summary[4]) : null,
        reason: result.status === 0 ? null
          : (output.split(/\r?\n/u).find((line) => /AssertionError|Exception|ERROR\]/.test(line)) ?? '').trim().slice(0, 200),
      });
    }
  }

  const failing = results.filter((entry) => !entry.passed);
  return {
    schema: 'platform.gated-db-tests.v1',
    taskId: 'P1R-M2-004',
    capturedAt: new Date().toISOString(),
    adminUrl: adminUrl(host, port),
    classesRun: results.length,
    testsRun: results.reduce((total, entry) => total + (entry.testsRun ?? 0), 0),
    failing: failing.length,
    passed: failing.length === 0 && results.length > 0,
    results,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const kind = process.argv.includes('--kind') ? process.argv[process.argv.indexOf('--kind') + 1] : 'both';
  const evidence = runGatedDatabaseTests({ kind });

  // --json lets a harness consume the result instead of scraping the human summary.
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  } else {
    for (const entry of evidence.results) {
      const counts = entry.testsRun === null ? 'no summary'
        : `run=${entry.testsRun} failures=${entry.failures} errors=${entry.errors} skipped=${entry.skipped}`;
      console.log(`${entry.passed ? 'PASS' : 'FAIL'} ${entry.service.padEnd(14)} ${entry.kind.padEnd(10)} ${counts}`);
      if (entry.reason) console.log(`     ${entry.reason}`);
    }
    console.log('');
    console.log(`classes=${evidence.classesRun} tests=${evidence.testsRun} failing=${evidence.failing}`);
  }

  if (process.argv.includes('--write')) {
    const directory = path.join(repositoryRoot, 'evidence/p1r/m2/P1R-M2-004');
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, `gated-db-tests-${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`written: ${path.relative(repositoryRoot, file).replaceAll('\\', '/')}`);
  }
  process.exitCode = evidence.passed ? 0 : 1;
}
