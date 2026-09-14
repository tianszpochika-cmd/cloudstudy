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

/** The tests append the scratch schema to this URL, so it must end at the slash. */
export function adminUrl(host = '127.0.0.1', port = '13306') {
  return `jdbc:mysql://${host}:${port}/`;
}

/**
 * Every gated test class in the repository, with the property that enables it.
 *
 * The scan covers every directory under services/, not a hardcoded list of service names. An earlier version
 * filtered by a literal array and described itself as annotation-driven and unable to miss a class; when
 * workflow-service was added, its gated class was invisible while uncoveredClasses stayed empty and the
 * harness's coverage check reported PASS. A discovery step that cannot see a class cannot report it missing.
 */
export function discoverGatedClasses(root = repositoryRoot) {
  const found = [];
  const servicesRoot = path.join(root, 'services');
  if (!fs.existsSync(servicesRoot)) return found;
  for (const serviceEntry of fs.readdirSync(servicesRoot, { withFileTypes: true })) {
    if (!serviceEntry.isDirectory()) continue;
    const directory = path.join(servicesRoot, serviceEntry.name, 'src/test/java');
    if (!fs.existsSync(directory)) continue;
    const service = serviceEntry.name.replace(/-service$/u, '');
    const visit = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) { visit(absolute); continue; }
        if (!entry.name.endsWith('.java')) continue;
        const source = fs.readFileSync(absolute, 'utf8');
        const property = /@EnabledIfSystemProperty\([^)]*named\s*=\s*"([^"]+)"/u.exec(source)?.[1];
        if (!property) continue;
        found.push({ service, name: entry.name.replace('.java', ''), property, path: absolute });
      }
    };
    visit(directory);
  }
  return found;
}

/**
 * The environment variables a class needs, as literal names.
 *
 * Two shapes matter here. A class may call required("NAME") and fail loudly when it is absent, and a
 * @SpringBootTest may carry a ${NAME:default} placeholder in its properties, in which case a missing
 * value is not an error but a context that starts against the wrong default. The IAM jdbc classes are
 * the second shape: their placeholder defaults name a runtime user and an empty password, so the
 * context fails to start, and reading only the required() calls missed it.
 */
function requiredVariables(source) {
  const names = new Set();
  for (const match of source.matchAll(/(?:required|requiredEnvironment|requiredEnvironmentAllowEmpty)\("([A-Z][A-Z0-9_]*)"\)/gu)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/\$\{([A-Z][A-Z0-9_]*)(?::([^}]*))?\}/gu)) {
    if (/_(?:URL|USERNAME|USER|PASSWORD|SCHEMA)$/u.test(match[1])) names.add(match[1]);
  }
  // A class may also read a variable directly rather than through a helper, which is how an optional value
  // like a password is usually read: getenv("NAME") or getOrDefault("NAME", ""). Reading only the helper
  // calls missed the password entirely, so the runner supplied none and the connection failed with a message
  // that named no variable.
  for (const match of source.matchAll(/(?:getenv|getOrDefault)\("([A-Z][A-Z0-9_]*)"\s*[,)]/gu)) {
    if (/_(?:URL|USERNAME|USER|PASSWORD|SCHEMA)$/u.test(match[1])) names.add(match[1]);
  }
  return [...names];
}

/** Schema names the sources mention as placeholder defaults, so a URL can point at the right one. */
function placeholderSchema(source) {
  const match = /\$\{[A-Z][A-Z0-9_]*:(jdbc:mysql:\/\/[^}]*)\}/u.exec(source);
  return match === null ? null : (/jdbc:mysql:\/\/[^/]+\/([A-Za-z0-9_]+)/u.exec(match[1])?.[1] ?? null);
}

/**
 * The scratch-schema shape a class insists on.
 *
 * The migration test asserts that the schema it is given matches a regexp and that the JDBC URL
 * selects exactly that schema, so both the name and the URL have to be derived from the same source
 * rather than guessed. A generic generated name failed the regexp, and a URL without a database failed
 * the agreement check.
 */
function scratchSchemaPattern(source) {
  const pattern = /\.matches\("([^"]{3,80})"\)/u.exec(source)?.[1];
  if (pattern === undefined) return null;
  // Turn the regexp into a concrete name by keeping its literal prefix, which ends where the first
  // character class begins.
  const prefix = /^([a-z0-9_]+?)_?\[/u.exec(pattern)?.[1] ?? null;
  return prefix === null ? null : `${prefix}_`;
}

/** Values for whatever connection variables a group's classes asked for. */
function connectionEnvironment(variables, url, password, scratchSchema, schema) {
  const environment = {};
  // When a class both names a schema and a JDBC URL, it may require the URL to select that schema.
  const schemaVariable = variables.find((name) => name.endsWith('_SCHEMA')) ?? null;
  for (const name of variables) {
    if (name.endsWith('_SCHEMA')) environment[name] = scratchSchema;
    else if (name.endsWith('_URL') || name.endsWith('_JDBC_URL')) {
      // Keep the schema the placeholder's default named, and only replace credentials and host. When
      // the class pairs the URL with a scratch schema, the URL selects that schema instead.
      const target = schemaVariable !== null
        ? `${url}${scratchSchema}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC`
        : name.endsWith('_JDBC_URL') && schema !== null
          ? `${url}${schema}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC`
          : url;
      environment[name] = target;
    } else if (name.endsWith('_USERNAME') || name.endsWith('_USER')) environment[name] = 'root';
    else if (name.endsWith('_PASSWORD')) environment[name] = password;
  }
  return environment;
}

/** Runs one statement as the administrative user against the local MySQL container. */
function adminStatement(statement, { host, port, password }) {
  const result = spawnSync('docker', [
    'compose', '-f', process.env.MYSQL_COMPOSE_FILE ?? 'infra/docker/docker-compose.dev.yml',
    'exec', '-T', '-e', `MYSQL_PWD=${password}`,
    process.env.MYSQL_COMPOSE_SERVICE ?? 'mysql',
    'mysql', '--protocol=TCP', '--host', host === '127.0.0.1' ? '127.0.0.1' : host,
    '--port', process.env.MYSQL_CONTAINER_PORT ?? '3306',
    '--user', 'root', '--batch', '--skip-column-names', '--execute', statement,
  ], { encoding: 'utf8', windowsHide: true });
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().slice(0, 300) };
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
    let schema = null;
    let schemaPrefix = null;
    for (const name of group.classes) {
      const file = findSource(root, group.service, name);
      if (file === null) continue;
      for (const variable of requiredVariables(file)) variables.add(variable);
      schema = schema ?? placeholderSchema(file);
      schemaPrefix = schemaPrefix ?? scratchSchemaPattern(file);
    }
    const scratchSchema = schemaPrefix === null
      ? `p1r_gated_${group.service.replaceAll('-', '_')}_${group.property.replaceAll('.', '_')}`
      : `${schemaPrefix}p1r_${group.property.replaceAll('.', '_')}`;
    // A class that names a scratch schema expects it to be provisioned and says so in its own
    // documentation; connecting to a schema that does not exist fails with error 1049 rather than
    // creating one. It is provisioned here and dropped after the group finishes.
    const needsSchema = [...variables].some((name) => name.endsWith('_SCHEMA'));
    const provisioned = needsSchema
      ? adminStatement(`CREATE DATABASE IF NOT EXISTS \`${scratchSchema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`,
        { host, port, password: rootPassword })
      : null;
    const environment = {
      ...process.env,
      JAVA_HOME: javaHome,
      ...connectionEnvironment([...variables], adminUrl(host, port), rootPassword, scratchSchema, schema),
    };

    // The counts come from this run's own surefire XML reports, and the directory is cleared first so a
    // report left behind by an earlier run cannot be read as this one's. Parsing the console text was
    // unreliable: Maven wraps long per-class lines, and reading only the first summary took the first
    // class's counts as the whole group's.
    const reports = path.join(root, `services/${group.service}-service/target/surefire-reports`);
    fs.rmSync(reports, { recursive: true, force: true });
    const result = spawnSync('mvn', ['-f', path.join(root, `services/${group.service}-service/pom.xml`), '-o',
      `-D${group.property}=true`, `-Dtest=${group.classes.join(',')}`, '-DfailIfNoTests=false', 'test'],
      { cwd: root, encoding: 'utf8', windowsHide: true, shell: true, env: environment });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    const perClass = [];
    if (fs.existsSync(reports)) {
      for (const name of fs.readdirSync(reports).filter((entry) => entry.startsWith('TEST-') && entry.endsWith('.xml'))) {
        const xml = fs.readFileSync(path.join(reports, name), 'utf8');
        const suite = /<testsuite[^>]*>/u.exec(xml)?.[0] ?? '';
        const attribute = (key) => Number(new RegExp(`${key}="(\\d+)"`, 'u').exec(suite)?.[1] ?? 0);
        // The failure message is taken here rather than from the console, because the reports are
        // cleared before the next group runs and the console wraps long lines. An <error> body carries
        // the exception across several lines, so the first line of the body is kept as well.
        const failure = /<(?:failure|error)[^>]*message="([^"]{0,400})"/u.exec(xml)?.[1] ?? null;
        const body = /<(?:failure|error)[^>]*>([\s\S]{0,600})/u.exec(xml)?.[1] ?? null;
        const firstLine = body === null ? null
          : (body.split(/\r?\n/u).map((line) => line.trim()).find((line) => line.length > 0) ?? null);
        perClass.push({
          className: name.replace(/^TEST-/u, '').replace(/\.xml$/u, ''),
          testsRun: attribute('tests'), failures: attribute('failures'),
          errors: attribute('errors'), skipped: attribute('skipped'),
          failureMessage: failure === null ? null : failure.replace(/&quot;/gu, '"').replace(/&apos;/gu, "'").replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&amp;/gu, '&'),
          failureDetail: firstLine,
        });
      }
    }
    const { testsRun, failures, errors, skipped } = perClass.reduce((accumulator, entry) => ({
      testsRun: accumulator.testsRun + entry.testsRun,
      failures: accumulator.failures + entry.failures,
      errors: accumulator.errors + entry.errors,
      skipped: accumulator.skipped + entry.skipped,
    }), { testsRun: 0, failures: 0, errors: 0, skipped: 0 });
    const dropped = needsSchema
      ? adminStatement(`DROP DATABASE IF EXISTS \`${scratchSchema}\`;`, { host, port, password: rootPassword })
      : null;
    // Fail-closed. Exit code 0 alone is satisfied by an entirely skipped class, and a group whose
    // reports cover fewer classes than it asked for left some of them unrun. A scratch schema that
    // could not be provisioned is a failure of the run, not a reason to skip it.
    const passed = result.status === 0
      && (provisioned === null || provisioned.ok)
      && perClass.length === group.classes.length
      && testsRun >= group.classes.length
      && failures === 0 && errors === 0 && skipped === 0;
    results.push({
      service: group.service,
      property: group.property,
      classes: group.classes,
      classesReporting: perClass.map((entry) => entry.className),
      exitStatus: result.status,
      passed,
      testsRun: perClass.length === 0 ? null : testsRun,
      failures, errors, skipped,
      failureMessages: perClass.filter((entry) => entry.failureMessage !== null || entry.failureDetail !== null)
        .map((entry) => ({ className: entry.className, message: entry.failureMessage, detail: entry.failureDetail })),
      reason: passed ? null
        : (perClass.length === 0
          ? `no surefire report was produced (exit ${result.status})`
          : `${testsRun} tests, ${failures} failures, ${errors} errors, ${skipped} skipped; `
            + `${perClass.length} of ${group.classes.length} classes reported (exit ${result.status}); `
            + (perClass.find((entry) => entry.failureMessage !== null)?.failureMessage ?? 'no failure message recorded')),
    });
  }

  // Every class this run selected must appear in exactly one group. Comparing against the full
  // discovered set would report the classes a --kind filter deliberately excluded as uncovered.
  const covered = new Set(results.flatMap((entry) => entry.classes));
  const uncovered = selected.filter((entry) => !covered.has(entry.name))
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
    // A fixed name, not one derived from today's date. The dated form meant every run wrote a new file and
    // the manifest kept reading whichever name was hardcoded when it was written, so following the recorded
    // commands could never refresh the figures the manifest reported — a re-run produced evidence nothing
    // consumed. One name means the newest run is the evidence.
    const file = path.join(directory, 'gated-db-tests.json');
    fs.writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`written: ${path.relative(repositoryRoot, file).replaceAll('\\', '/')}`);
  }
  process.exitCode = evidence.passed ? 0 : 1;
}
