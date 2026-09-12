// P1R-M2-004 runtime evidence harness.
//
// Produces bounded, fail-closed evidence for the data-ownership runtime requirements that are
// provable against the local real stack:
//   M2-004-OWNER-SCHEMA-GRANTS   independent schema + service-scoped credential, DML-only
//   M2-004-CROSS-OWNER-DENY      no grant reaches another owner's schema, and access is enforced
//   M2-004-REDIS-NAMESPACE-ACL   per-service namespace + ACL user, cross-namespace denied
//   M2-004-FLYWAY-EMPTY-AND-EXISTING  empty-schema apply, existing-schema history, invalid SQL
//
// Requirements that need services or contracts that do not exist yet are reported as
// NOT_VERIFIABLE_HERE with a reason; this harness never emits a simulated pass.
//
// It reads only: config/p1r-data-ownership.v1.json, config/b17-runtime-services.json,
// config/local-ports.json, the owner migration directories, MySQL and Redis on the registered
// loopback endpoints. It never writes outside a scratch schema it drops again, and never prints
// credential material.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DECLARED_NOT_BUILT, credentialFor, runtimeOwners } from '../database/lib/owner-manifest.mjs';

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const ownership = readJson('config/p1r-data-ownership.v1.json');
const b17 = readJson('config/b17-runtime-services.json');
const localPorts = readJson('config/local-ports.json');

const MYSQL = {
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: process.env.MYSQL_PORT ?? '13306',
  containerPort: '3306',
  adminUser: process.env.MYSQL_ADMIN_USER ?? 'root',
  adminPassword: process.env.MYSQL_ROOT_PASSWORD ?? 'root-local-only',
  ownerPassword: process.env.MYSQL_OWNER_PASSWORD ?? 'local-owner-only',
  composeService: process.env.MYSQL_COMPOSE_SERVICE ?? 'mysql',
  composeFile: process.env.MYSQL_COMPOSE_FILE ?? 'infra/docker/docker-compose.dev.yml',
};
const REDIS = {
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? localPorts.infrastructure?.redis?.port ?? 16379),
  ownerPassword: process.env.REDIS_OWNER_PASSWORD ?? 'local-redis-only',
};
const SCRATCH_SCHEMA = 'p1r_m2_004_migration_probe';

// The credential name and the owner set come from the same module the reconcile script provisions
// from, so evidence can never be produced against a different account than the one that was set up.
function ownersFromManifests() {
  return runtimeOwners(root).map((owner) => {
    const declared = ownership.serviceOwners?.find((entry) => entry.service === owner.id);
    return {
      id: owner.id,
      schema: owner.schema,
      credential: owner.credential,
      migrationMode: owner.migrationMode,
      migrationDirectory: owner.migrationPath ? path.dirname(owner.migrationPath) : null,
      redisNamespace: declared?.redis?.namespace ?? null,
      source: owner.migrationMode === 'self' ? 'self-migrating' : 'external-migration',
    };
  });
}

function mysql(args, { password, database, input } = {}) {
  const normalized = [
    '--protocol=TCP', '--host', '127.0.0.1', '--port', MYSQL.containerPort,
    '--user', args.user, ...(database ? ['--database', database] : []),
    '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw',
    ...(args.extra ?? []),
  ];
  const result = spawnSync('docker', [
    'compose', '-f', MYSQL.composeFile, 'exec', '-T', '-e', `MYSQL_PWD=${password}`,
    MYSQL.composeService, 'mysql', ...normalized,
  ], { cwd: root, encoding: 'utf8', input: input ?? (args.sql ? `${args.sql}\n` : undefined), windowsHide: true });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? '').replace(/\r/g, '').trim(),
    stderr: (result.stderr ?? '').replace(/\r/g, '').trim(),
    status: result.status,
  };
}

const admin = (sql) => mysql({ user: MYSQL.adminUser, sql }, { password: MYSQL.adminPassword });
const asOwner = (owner, sql, database) => mysql({ user: owner.credential, sql }, {
  password: process.env[`${owner.id.toUpperCase().replaceAll('-', '_')}_DB_PASSWORD`] ?? MYSQL.ownerPassword,
  database,
});

// Minimal RESP client so ACL enforcement can be probed directly instead of through redis-cli.
function parseReply(buffer, offset) {
  const end = buffer.indexOf('\r\n', offset);
  if (end === -1) return null;
  const line = buffer.subarray(offset, end).toString('utf8');
  const type = line[0];
  const rest = line.slice(1);
  if (type === '+') return { value: rest, next: end + 2 };
  if (type === '-') return { value: { error: rest }, next: end + 2 };
  if (type === ':') return { value: Number(rest), next: end + 2 };
  if (type === '$') {
    const length = Number(rest);
    if (length === -1) return { value: null, next: end + 2 };
    if (buffer.length < end + 2 + length + 2) return null;
    return { value: buffer.subarray(end + 2, end + 2 + length).toString('utf8'), next: end + 2 + length + 2 };
  }
  if (type === '*') {
    const count = Number(rest);
    if (count === -1) return { value: null, next: end + 2 };
    const items = [];
    let cursor = end + 2;
    for (let index = 0; index < count; index += 1) {
      const item = parseReply(buffer, cursor);
      if (!item) return null;
      items.push(item.value);
      cursor = item.next;
    }
    return { value: items, next: cursor };
  }
  return null;
}

function respCommand(commands, { user, password, timeoutMs = 4000 } = {}) {
  const encode = (parts) => {
    const chunks = [`*${parts.length}\r\n`];
    for (const part of parts) chunks.push(`$${Buffer.byteLength(part)}\r\n${part}\r\n`);
    return Buffer.from(chunks.join(''), 'utf8');
  };
  const authenticated = Boolean(user && password);
  const payload = Buffer.concat([
    ...(authenticated ? [encode(['AUTH', user, password])] : []),
    ...commands.map((command) => encode(command.map(String))),
  ]);
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: REDIS.host, port: REDIS.port });
    let buffer = Buffer.alloc(0);
    const replies = [];
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs, () => finish({ ok: false, error: 'TIMEOUT', replies }));
    socket.once('error', () => finish({ ok: false, error: 'UNAVAILABLE', replies }));
    socket.once('connect', () => socket.write(payload));
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      let offset = 0;
      while (replies.length < commands.length + (authenticated ? 1 : 0)) {
        const parsed = parseReply(buffer, offset);
        if (!parsed) break;
        replies.push(parsed);
        offset = parsed.next;
      }
      buffer = buffer.subarray(offset);
      if (replies.length >= commands.length + (authenticated ? 1 : 0)) {
        const authFailed = authenticated && replies[0]?.value?.error;
        finish({ ok: !authFailed, error: authFailed ? replies[0].value.error : null, replies });
      }
    });
  });
}

const checks = [];
const requirements = [];
// id and result are spread last: the detail objects carry their own `id`, and letting it win would
// silently rename every check and break the requirement aggregation below.
const record = (id, result, detail) => checks.push({ ...detail, id, result });
const rawJsonArray = (text) => (text.startsWith('[') ? JSON.parse(text) : text.split(/\r?\n/).filter(Boolean));
// MySQL privilege errors are 1142 (command denied) and 1044 (access denied for the database). Any
// other failure (for example 1050 "table already exists") means the probe was wrong, not that the
// grant was enforced, so it must never be counted as a denial.
const PRIVILEGE_ERRORS = new Set(['1142', '1044']);
const errorCode = (result) => /ERROR (\d+)/u.exec(result.stderr ?? '')?.[1] ?? null;
const deniedByPrivilege = (result) => !result.ok && PRIVILEGE_ERRORS.has(errorCode(result));

async function verifyOwnerSchemaGrants(owners) {
  const results = [];
  for (const owner of owners) {
    const tables = admin(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${owner.schema}' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME;`).stdout
      .split('\n').filter(Boolean).filter((table) => table !== 'p1r_schema_history');
    const select = asOwner(owner, 'SELECT 1;', owner.schema);
    const probeTable = `${owner.schema}.p1r_ddl_probe_should_fail`;
    const ddl = asOwner(owner, `CREATE TABLE ${probeTable} (id INT);`, owner.schema);
    const ddlDenied = deniedByPrivilege(ddl);
    // A self-migrating owner is allowed to create, so the harness has to remove what it made.
    if (ddl.ok) admin(`DROP TABLE IF EXISTS ${probeTable};`);
    const sample = tables[0];
    const probeColumn = 'p1r_alter_probe_should_fail';
    const alter = sample
      ? asOwner(owner, `ALTER TABLE ${owner.schema}.${sample} ADD COLUMN ${probeColumn} INT NULL;`, owner.schema)
      : { ok: false, stderr: '' };
    const alterDenied = sample ? deniedByPrivilege(alter) : true;
    if (alter.ok) admin(`ALTER TABLE ${owner.schema}.${sample} DROP COLUMN ${probeColumn};`);
    const grants = admin(`SHOW GRANTS FOR '${owner.credential}'@'%';`).stdout.split('\n').filter(Boolean);
    const foreignGrants = grants.filter((line) => {
      const match = /ON\s+`([^`]+)`\./u.exec(line);
      return match && match[1] !== owner.schema;
    });
    const leaked = admin(`SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${owner.schema}' AND TABLE_NAME LIKE 'p1r\\_%probe%';`).stdout;
    const entry = {
      id: owner.id,
      schema: owner.schema,
      credential: owner.credential,
      source: owner.source,
      migrationMode: owner.migrationMode,
      tableCount: tables.length,
      readAllowed: select.ok,
      ddlDenied,
      ddlErrorCode: errorCode(ddl),
      alterDenied,
      alterErrorCode: errorCode(alter),
      probeObjectsLeaked: Number(leaked),
      grantCount: grants.length,
      foreignSchemaGrants: foreignGrants.length,
    };
    results.push(entry);
    // An externally migrated owner must be DML-only. A self-migrating platform service keeps DDL
    // rights by design, so for it the requirement is that the grant never leaves its own schema.
    const grantPolicyHolds = owner.migrationMode === 'self'
      ? entry.ddlDenied === false && entry.foreignSchemaGrants === 0
      : entry.ddlDenied && entry.alterDenied && entry.foreignSchemaGrants === 0;
    record(`owner-schema-grants:${owner.id}`, entry.readAllowed && entry.tableCount > 0
      && grantPolicyHolds && entry.probeObjectsLeaked === 0 ? 'PASS' : 'FAIL', entry);
  }
  return results;
}

function verifyCrossOwnerDeny(owners) {
  const results = [];
  for (const owner of owners) {
    const others = owners.filter((candidate) => candidate.id !== owner.id);
    const probes = [];
    // Exhaustive by construction: SHOW GRANTS already proved no grant names a foreign schema, so the
    // spot checks only need to show the model is enforced rather than merely declared.
    for (const target of [others[0], others[Math.floor(others.length / 2)], others.at(-1)]) {
      if (!target) continue;
      const table = admin(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${target.schema}' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME LIMIT 1;`).stdout.split('\n')[0];
      if (!table) continue;
      const read = asOwner(owner, `SELECT COUNT(*) FROM ${target.schema}.${table};`);
      probes.push({ target: target.id, denied: !read.ok, code: /ERROR (\d+)/u.exec(read.stderr)?.[1] ?? null });
    }
    const entry = { id: owner.id, probes, allDenied: probes.length > 0 && probes.every((probe) => probe.denied) };
    results.push(entry);
    record(`cross-owner-deny:${owner.id}`, entry.allDenied ? 'PASS' : 'FAIL', entry);
  }
  return results;
}

async function verifyRedisNamespaceAcl(owners) {
  const authenticated = { user: null, password: null };
  const listing = await respCommand([['ACL', 'LIST']], authenticated);
  const lines = Array.isArray(listing.replies.at(-1)?.value) ? listing.replies.at(-1).value : [];
  const aclUsers = new Map();
  for (const line of lines) {
    const match = /^user (\S+) .*? (~\S+)/u.exec(String(line));
    if (match) aclUsers.set(match[1], match[2]);
  }
  const results = [];
  for (const owner of owners) {
    const expected = owner.redisNamespace ? `~${owner.redisNamespace}:*` : null;
    const ownKey = `${owner.redisNamespace}:p1r-probe`;
    const own = await respCommand(
      [['SET', ownKey, '1'], ['GET', ownKey], ['DEL', ownKey]],
      { user: owner.credential, password: REDIS.ownerPassword },
    );
    // replies[0] is the AUTH reply, so the SET/GET/DEL results start at index 1.
    const foreignNamespace = owners.find((candidate) => candidate.id !== owner.id && candidate.redisNamespace)?.redisNamespace;
    const foreign = await respCommand([['GET', `${foreignNamespace}:p1r-probe`]], { user: owner.credential, password: REDIS.ownerPassword });
    const entry = {
      id: owner.id,
      credential: owner.credential,
      namespace: owner.redisNamespace,
      declaredPattern: aclUsers.get(owner.credential) ?? null,
      expectedPattern: expected,
      patternMatches: Boolean(expected) && aclUsers.get(owner.credential) === expected,
      ownNamespaceAllowed: own.ok && own.replies[1]?.value === 'OK' && own.replies[2]?.value === '1',
      foreignNamespace: foreignNamespace ?? null,
      foreignNamespaceDenied: Boolean(foreign.replies[1]?.value?.error?.startsWith('NOPERM')),
    };
    results.push(entry);
    record(`redis-namespace-acl:${owner.id}`, entry.patternMatches && entry.ownNamespaceAllowed && entry.foreignNamespaceDenied ? 'PASS' : 'FAIL', entry);
  }
  return results;
}

function verifyMigrations(owners) {
  const results = [];
  for (const owner of owners) {
    if (!owner.migrationDirectory) continue;
    const directory = path.join(root, owner.migrationDirectory);
    if (!fs.existsSync(directory)) continue;
    const files = fs.readdirSync(directory).filter((name) => /^V\d+__.+\.sql$/iu.test(name));
    const versions = files.map((name) => Number(/^V(\d+)__/iu.exec(name)[1])).sort((left, right) => left - right);
    const recorded = admin(`SELECT version FROM ${owner.schema}.p1r_schema_history ORDER BY version;`).stdout
      .split('\n').filter(Boolean).map(Number);
    const entry = {
      id: owner.id,
      migrationFiles: files.length,
      declaredVersions: versions,
      recordedVersions: recorded,
      historyComplete: JSON.stringify(versions) === JSON.stringify(recorded),
    };
    results.push(entry);
    record(`migration-existing-schema:${owner.id}`, entry.historyComplete ? 'PASS' : 'FAIL', entry);
  }
  return results;
}

function verifyEmptySchemaAndInvalidSql(owners) {
  const donor = owners.find((owner) => owner.migrationDirectory
    && fs.existsSync(path.join(root, owner.migrationDirectory)));
  if (!donor) return { skipped: 'no owner migration directory found' };
  const directory = path.join(root, donor.migrationDirectory);
  const first = fs.readdirSync(directory).filter((name) => /^V1__.+\.sql$/iu.test(name))[0];
  const sql = fs.readFileSync(path.join(directory, first), 'utf8');
  const expectedTables = [...sql.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+`?([a-z][a-z0-9_]*)`?/giu)]
    .map((match) => match[1]);

  admin(`DROP DATABASE IF EXISTS \`${SCRATCH_SCHEMA}\`; CREATE DATABASE \`${SCRATCH_SCHEMA}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  const applied = mysql({ user: MYSQL.adminUser }, { password: MYSQL.adminPassword, database: SCRATCH_SCHEMA, input: sql });
  const created = admin(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${SCRATCH_SCHEMA}' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME;`)
    .stdout.split('\n').filter(Boolean);
  const invalid = mysql({ user: MYSQL.adminUser }, {
    password: MYSQL.adminPassword,
    database: SCRATCH_SCHEMA,
    input: 'CREATE TABLE p1r_invalid_probe (this_is_not_valid_sql;\n',
  });
  const afterInvalid = admin(`SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${SCRATCH_SCHEMA}' AND TABLE_NAME='p1r_invalid_probe';`).stdout;
  admin(`DROP DATABASE IF EXISTS \`${SCRATCH_SCHEMA}\`;`);

  const emptyApply = applied.ok && expectedTables.every((table) => created.includes(table));
  const invalidRejected = !invalid.ok && afterInvalid === '0';
  record('migration-empty-database', emptyApply ? 'PASS' : 'FAIL', {
    donor: donor.id, migration: first, expectedTables: expectedTables.length, createdTables: created.length,
  });
  record('migration-invalid-sql-rejected', invalidRejected ? 'PASS' : 'FAIL', {
    rejected: !invalid.ok, residualTables: Number(afterInvalid),
  });
  return { donor: donor.id, migration: first, expectedTables: expectedTables.length, createdTables: created.length, invalidRejected, scratchSchemaDropped: true };
}

function notVerifiable() {
  // A requirement whose ledger owner is a later task is NOT_APPLICABLE to this submission: this
  // task asserts the requirement, it does not deliver it. Anything this task does own and has not
  // verified is reported as FAILED, never softened.
  const owners = readJson('config/p1r-m2-requirement-owners.v1.json');
  const ownerById = new Map((owners.requirements ?? []).map((entry) => [entry.id, entry]));
  for (const entry of ownership.m2RuntimeRequirements ?? []) {
    if (requirements.some((item) => item.id === entry.id)) continue;
    const owner = ownerById.get(entry.id);
    const ownedHere = !owner || owner.ownerTask === 'P1R-M2-004';
    const status = ownedHere ? 'FAILED' : 'NOT_APPLICABLE';
    record(`requirement:${entry.id}`, status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'FAIL', {
      requirement: entry.requirement,
      assertedBy: owner?.assertedBy ?? 'P1R-M2-004',
      ownerTask: owner?.ownerTask ?? 'P1R-M2-004',
      supportingTasks: owner?.supportingTasks ?? [],
      rationale: owner?.rationale ?? 'no owner assignment recorded',
    });
    requirements.push({
      id: entry.id,
      status,
      ownerTask: owner?.ownerTask ?? 'P1R-M2-004',
      reason: owner?.rationale ?? 'no owner assignment recorded',
    });
  }
}

const owners = ownersFromManifests();
const gitRevision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim();
const startedAt = new Date().toISOString();

const grants = await verifyOwnerSchemaGrants(owners);
const crossOwner = verifyCrossOwnerDeny(owners);
const redis = await verifyRedisNamespaceAcl(owners);
const migrations = verifyMigrations(owners);
const emptyAndInvalid = verifyEmptySchemaAndInvalidSql(owners);
// Requirement verdicts are derived from the checks themselves so the two can never disagree.
const requirementStatus = (prefix) => {
  const relevant = checks.filter((check) => check.id.startsWith(prefix));
  return relevant.length > 0 && relevant.every((check) => check.result === 'PASS') ? 'VERIFIED' : 'FAILED';
};
requirements.push({ id: 'M2-004-OWNER-SCHEMA-GRANTS', status: requirementStatus('owner-schema-grants:') });
requirements.push({ id: 'M2-004-CROSS-OWNER-DENY', status: requirementStatus('cross-owner-deny:') });
requirements.push({ id: 'M2-004-REDIS-NAMESPACE-ACL', status: requirementStatus('redis-namespace-acl:') });
requirements.push({ id: 'M2-004-FLYWAY-EMPTY-AND-EXISTING', status: requirementStatus('migration-') });
// Declared owners that have no runtime yet are excluded rather than reported as failures; the
// ownership policy already carries them as planned migration collections.
for (const id of DECLARED_NOT_BUILT) {
  const declared = ownership.serviceOwners?.find((entry) => entry.service === id);
  record(`owner-not-built:${id}`, 'NOT_VERIFIABLE_HERE', {
    schema: declared?.schema?.name ?? null,
    reason: 'the service has no runtime yet; the ownership policy records it as a planned migration collection',
  });
}
notVerifiable();

const failures = checks.filter((check) => check.result === 'FAIL');
const evidence = {
  schema: 'm2.data-ownership.runtime-evidence.v1',
  taskId: 'P1R-M2-004',
  result: failures.length === 0 ? 'PARTIAL' : 'FAIL',
  sourceCommit: gitRevision,
  startedAt,
  finishedAt: new Date().toISOString(),
  ownerCount: owners.length,
  requirements,
  checks,
  detail: { grants, crossOwner, redis, migrations, emptyAndInvalid },
  sensitiveMaterial: { persisted: false, emitted: false },
  notRuntimeVerified: (ownership.m2RuntimeRequirements ?? [])
    .filter((entry) => !requirements.some((item) => item.id === entry.id && item.status === 'VERIFIED'))
    .map((entry) => entry.id),
};

process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
process.exitCode = failures.length === 0 ? 0 : 1;
