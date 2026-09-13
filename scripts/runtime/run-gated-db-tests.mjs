// Runs the data-ownership tests that are gated behind system properties, and writes the evidence.
//
// A gated class carries @EnabledIfSystemProperty, so a plain `mvn test` neither passes nor fails it:
// it does not run, and "Tests run: 1, Skipped: 1" with BUILD SUCCESS and exit code 0 is the only
// trace. Treating exit code 0 as a pass therefore reports a whole class as green while nothing in it
// ran, and that verdict propagates into the harness, into VERIFIED and into the gate. This runner is
// fail-closed instead: a class counts as passing only when the run reports at least one test, no
// failures, no errors and no skips.
//
// Classes are discovered from their own annotations rather than from a hardcoded list, so a new gated
// class cannot be silently left out, and the discovered set is asserted against the set that was
// actually executed.
//
// Usage: node scripts/runtime/run-gated-db-tests.mjs [--kind all|tenant|migration|iam] [--json] [--write]
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

/** Every gated test class in the repository, with the property that enables it. */
export function discoverGatedClasses(root = repositoryRoot) {
  const found = [];
  for (const service of SERVICES) {
    const directory = path.join(root, `services/${service}-service/src/test/java`);
    if (!fs.existsSync(directory)) continue;
    const visit = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) { visit(absolute); continue; }
        if (!entry.name.endsWith('.java')) continue;
        const source = fs.readFileSync(absolute, 'utf8');
        const property = /@EnabledIfSystemProperty\([^)]*named\s*=\s*"([^"]+)"/u.exec(source)?.[1];
        if (!property) continue;
        found.push({ service, name: entry.name.replace('.java', ''), property });
      }
    };
    visit(directory);
  }
  return found;
}

/**
 * The environment variables a class declares it needs, as literal names.
 *
 * Taking the names straight from the source is deliberate: an earlier attempt derived a family from a
 * pattern and produced nothing for classes that name their variables differently, which made every
 * previously passing group fail. There is nothing to infer here.
 */
function requiredVariables(source) {
  const names = new Set();
  for (const match of source.matchAll(/(?:required|requiredEnvironment|requiredEnvironmentAllowEmpty)\("([A-Z][A-Z0-9_]*)"\)/gu)) {
    names.add(match[1]);
  }
  return [...names];
}

/** Values for whatever connection variables a group's classes asked for. */
function connectionEnvironment(variables, url, password) {
  const environment = {};
  for (const name of variables) {
    if (name.endsWith('_URL') || name.endsWith('_JDBC_URL')) environment[name] = url;
    else if (name.endsWith('_USERNAME') || name.endsWith('_USER')) environment[name] = 'root';
    else if (name.endsWith('_PASSWORD')) environment[name] = password;
  }
  return environment;
}

export function runGatedDatabaseTests(options = {}) {
  const root = options.root ?? repositoryRoot;
  const kind = options.kind ?? 'all';
  const host = options.host ?? process.env.MYSQL_HOST ?? '127.0.0.1';
  const port = options.port ?? process.env.MYSQL_PORT ?? '13306';
  const rootPassword = options.rootPassword ?? process.env.MYSQL_ROOT_PASSWORD ?? 'root-local-only';
  const javaHome = options.javaHome ?? process.env.JAVA_HOME ?? 'C:\\Program Files\\Microsoft\\jdk-25.0.4.101-hotspot';

  const discovered = discoverGatedClasses(root);
  const selected = discovered.filter((entry) => {
    if (kind === 'all') return true;
    if (kind === 'tenant') return entry.property.endsWith('tenant.integration');
    if (kind === 'migration') return entry.property.endsWith('migration.integration');
    if (kind === 'iam') return entry.service === 'iam';
    return true;
  });

  // Group by service and property so one mvn invocation runs one property's classes.
  const groups = new Map();
  for (const entry of selected) {
    const key = `${entry.service}|${entry.property}`;
    if (!groups.has(key)) groups.set(key, { service: entry.service, property: entry.property, classes: [] });
    groups.get(key).classes.push(entry.name);
  }

  const results = [];
  for (const group of groups.values()) {
    const prefix = group.service.replaceAll('-', '').toUpperCase();
    // Whatever connection variables the group's classes declare, read from their own sources rather
    // than guessed from the property name: the IAM classes ask for IAM_V13_TEST_* and the flyway ones
    // for IAM_FLYWAY_TEST_ADMIN_*, and a convention-based guess silently produced neither.
    const variables = new Set();
    for (const name of group.classes) {
      const file = findSource(root, group.service, name);
      if (file === null) continue;
      for (const variable of requiredVariables(file)) variables.add(variable);
    }
    const environment = {
      ...process.env,
      JAVA_HOME: javaHome,
      ...connectionEnvironment([...variables], adminUrl(host, port), rootPassword),
    };

    const result = spawnSync('mvn', ['-f', path.join(root, `services/${group.service}-service/pom.xml`), '-o',
      `-D${group.property}=true`, `-Dtest=${group.classes.join(',')}`, '-DfailIfNoTests=false', 'test'],
      { cwd: root, encoding: 'utf8', windowsHide: true, shell: true, env: environment });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    const summary = /Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)/u.exec(output);
    const testsRun = summary ? Number(summary[1]) : 0;
    const failures = summary ? Number(summary[2]) : 0;
    const errors = summary ? Number(summary[3]) : 0;
    const skipped = summary ? Number(summary[4]) : 0;
    // Fail-closed. Exit code 0 alone is satisfied by an entirely skipped class, which is the defect
    // this runner exists to avoid.
    const passed = result.status === 0 && testsRun >= group.classes.length
      && failures === 0 && errors === 0 && skipped === 0;
    results.push({
      service: group.service,
      property: group.property,
      classes: group.classes,
      exitStatus: result.status,
      passed,
      testsRun: summary ? testsRun : null,
      failures, errors, skipped,
      reason: passed ? null
        : (summary === null
          ? `no surefire summary in the output (exit ${result.status})`
          : `${testsRun} tests run for ${group.classes.length} classes, ${failures} failures, ${errors} errors, ${skipped} skipped (exit ${result.status})`),
    });
  }

  // Every discovered class must appear in exactly one group, or the runner is not covering what the
  // repository contains.
  const covered = new Set(results.flatMap((entry) => entry.classes));
  const uncovered = discovered.filter((entry) => !covered.has(entry.name))
    .map((entry) => ({ service: entry.service, name: entry.name, property: entry.property }));

  const failing = results.filter((entry) => !entry.passed);
  return {
    schema: 'platform.gated-db-tests.v1',
    taskId: 'P1R-M2-004',
    capturedAt: new Date().toISOString(),
    adminUrl: adminUrl(host, port),
    discoveredClasses: discovered.length,
    selectedClasses: selected.length,
    groupsRun: results.length,
    testsRun: results.reduce((total, entry) => total + (entry.testsRun ?? 0), 0),
    uncoveredClasses: uncovered,
    failing: failing.length,
    passed: failing.length === 0 && uncovered.length === 0 && results.length > 0,
    policy: 'fail-closed: exit 0 with zero tests or any skipped test is a failure',
    results,
  };
}

function findSource(root, service, className) {
  const base = path.join(root, `services/${service}-service/src/test/java`);
  let found = null;
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (found !== null) return;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.name === `${className}.java`) found = fs.readFileSync(absolute, 'utf8');
    }
  };
  if (fs.existsSync(base)) visit(base);
  return found;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const kind = process.argv.includes('--kind') ? process.argv[process.argv.indexOf('--kind') + 1] : 'all';
  const evidence = runGatedDatabaseTests({ kind });
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  } else {
    for (const entry of evidence.results) {
      console.log(`${entry.passed ? 'PASS' : 'FAIL'} ${entry.service.padEnd(14)} ${entry.property.padEnd(30)} classes=${entry.classes.length} run=${entry.testsRun} failures=${entry.failures} errors=${entry.errors} skipped=${entry.skipped}`);
      if (entry.reason) console.log(`     ${entry.reason}`);
    }
    if (evidence.uncoveredClasses.length > 0) {
      console.log('');
      console.log('discovered but not run:');
      evidence.uncoveredClasses.forEach((entry) => console.log(`  ${entry.service} ${entry.name} (${entry.property})`));
    }
    console.log('');
    console.log(`discovered=${evidence.discoveredClasses} groups=${evidence.groupsRun} tests=${evidence.testsRun} failing=${evidence.failing} uncovered=${evidence.uncoveredClasses.length}`);
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
