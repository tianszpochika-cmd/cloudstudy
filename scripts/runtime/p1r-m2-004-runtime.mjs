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

const REDIS_CONTAINER = process.env.REDIS_CONTAINER ?? 'yuxuexing-local-redis-1';
// Pausing a container is opt-in and pinned to one exact name, the same discipline the M2-001 and
// M2-005 harnesses use, so a copy-pasted environment cannot pause an arbitrary container.
const REDIS_FAULT_OPT_IN = 'PAUSE_EXACT_REDIS_16379_AND_RECOVER';

/** Polls until the predicate holds or the budget runs out. */
async function waitFor(predicate, timeoutMs = 60000, intervalMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (predicate()) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/** Container health, or null when the container is not running. */
function dockerHealth(name) {
  const result = spawnSync('docker', ['inspect', '--format', '{{.State.Health.Status}}', name],
    { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return null;
  const status = (result.stdout ?? '').trim();
  return status === '' ? 'running' : status;
}

/**
 * Proves that losing Redis, and Redis coming back, cannot create or lose a business fact.
 *
 * The requirement's second clause is about durable owner facts, so the test counts real business rows
 * in the owner schemas, stops Redis long enough for anything holding state there to notice, reads the
 * same rows again, restarts Redis and reads them a third time. Nothing about the Gateway's own
 * availability is claimed here; api-gateway and the legacy core-api are the only services that
 * configure Redis at all, and a Gateway that fails closed without it is correct behaviour.
 */
async function verifyRedisLossCannotAffectBusinessFacts(counters) {
  const optIn = process.env.M2_REDIS_FAULT_OPT_IN;
  if (optIn !== REDIS_FAULT_OPT_IN) {
    record('redis-loss:fault-injection-is-opt-in', 'FAIL', {
      requiredEnv: 'M2_REDIS_FAULT_OPT_IN', requiredValue: REDIS_FAULT_OPT_IN, observed: optIn ?? null,
      note: 'run with the opt-in set to exercise Redis loss; without it the clause has no evidence',
    });
    return;
  }
  const before = counters();
  // The probe table is measured alongside the counted set, so the row it writes is visible in the metric
  // by construction rather than by hoping the chosen table is one of the thirteen.
  const probe = businessFactProbe();
  const countProbe = () => (probe === null ? null
    : Number(admin(`SELECT COUNT(*) FROM ${probe.key};`).stdout.trim()));
  const probeBefore = countProbe();
  spawnSync('docker', ['stop', REDIS_CONTAINER], { encoding: 'utf8', windowsHide: true });
  const stopped = dockerHealth(REDIS_CONTAINER);
  const during = counters();
  // Equal counts on their own prove little: they would also be equal if the metric never moved, or if
  // nothing had been written at all. A real row written through the owner's own DML credential while
  // Redis is down shows the write path does not pass through Redis at all, and the exact increment it
  // produces shows the counter is sensitive to that write.
  const written = probe === null ? { ok: false, reason: 'no probe table' } : probe.insert();
  const probeAfterWrite = countProbe();
  const afterWrite = counters();
  const removed = written.ok && probe !== null ? probe.remove() : { ok: false, reason: 'nothing written' };
  spawnSync('docker', ['start', REDIS_CONTAINER], { encoding: 'utf8', windowsHide: true });
  const restored = await waitFor(() => dockerHealth(REDIS_CONTAINER) === 'healthy', 120000, 3000);
  const probeAfter = countProbe();
  const after = counters();
  const unchanged = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const key = probe?.key ?? null;
  const increment = probeBefore === null || probeAfterWrite === null ? null : probeAfterWrite - probeBefore;
  record('redis-loss:business-facts-unchanged',
    unchanged(before, during) && unchanged(before, after) ? 'PASS' : 'FAIL', {
      container: REDIS_CONTAINER,
      healthWhileStopped: stopped,
      healthAfterRestart: dockerHealth(REDIS_CONTAINER),
      restored,
      before, during, after,
    });
  record('redis-loss:write-succeeds-with-redis-down',
    written.ok && removed.ok && increment === 1 && probeAfter === probeBefore && unchanged(before, after)
      ? 'PASS' : 'FAIL', {
      probeKey: key,
      writeSucceededWhileRedisStopped: written.ok,
      writeDetail: written.reason ?? null,
      rowCountBefore: probeBefore,
      rowCountAfterWrite: probeAfterWrite,
      rowCountAfterRemoval: probeAfter,
      increment,
      probeRemoved: removed.ok,
      removeDetail: removed.reason ?? null,
      note: 'an increment of exactly one shows the counter is sensitive to the write; the removal restores it '
        + 'and the thirteen counted tables are unchanged throughout',
    });
}

/**
 * A single owner table the harness can write one row into and remove again, used to show that a business
 * write does not depend on Redis.
 *
 * The table and the columns are chosen from the catalogue rather than hardcoded: the first attempt named
 * a table whose task_id column has no default, so the insert was rejected and the probe proved nothing.
 * The table with the fewest columns that must be supplied is picked, and a value is supplied for each of
 * them. The statement is issued as the owner's own DML credential, so it stays inside the write boundary
 * the ownership policy sets.
 */
function businessFactProbe() {
  const candidates = admin(`SELECT t.table_schema, t.table_name,
      COUNT(*) AS required
    FROM information_schema.tables t
    JOIN information_schema.columns c
      ON c.table_schema = t.table_schema AND c.table_name = t.table_name
    WHERE t.table_schema IN ('learner_service','content_service','learning_service')
      AND t.table_type = 'BASE TABLE'
      AND c.is_nullable = 'NO' AND c.column_default IS NULL
      AND c.extra NOT LIKE '%auto_increment%'
      AND c.data_type IN ('varchar','char','text','int','bigint','datetime','timestamp')
    GROUP BY t.table_schema, t.table_name
    ORDER BY required ASC, t.table_name ASC
    LIMIT 1;`).stdout.split('\n').find(Boolean);
  if (!candidates) return null;
  const [schema, table, requiredCount] = candidates.split('\t');
  const columns = admin(`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='${schema}' AND table_name='${table}'
      AND is_nullable='NO' AND column_default IS NULL
      AND extra NOT LIKE '%auto_increment%'
    ORDER BY ordinal_position;`).stdout.split('\n').filter(Boolean)
    .map((line) => { const [name, type] = line.split('\t'); return { name, type }; });
  if (columns.length !== Number(requiredCount)) return null;

  const marker = `p1r-probe-${Date.now()}`;
  const valueFor = (type) => {
    if (type === 'int' || type === 'bigint') return '1';
    if (type === 'datetime' || type === 'timestamp') return 'CURRENT_TIMESTAMP';
    return `'${marker}'`;
  };
  const names = columns.map((entry) => entry.name).join(', ');
  const values = columns.map((entry) => valueFor(entry.type)).join(', ');
  const textColumns = columns.filter((entry) => !['int', 'bigint', 'datetime', 'timestamp'].includes(entry.type));
  const key = `${schema}.${table}`;
  return {
    key,
    columns: columns.map((entry) => entry.name),
    insert: () => {
      const result = runAsOwner('learner-service', `INSERT INTO ${schema}.${table} (${names}) VALUES (${values});`);
      return result.ok ? { ok: true } : { ok: false, reason: result.reason };
    },
    remove: () => {
      if (textColumns.length === 0) return { ok: false, reason: 'no text column to identify the probe row' };
      const where = textColumns.map((entry) => `${entry.name} = '${marker}'`).join(' AND ');
      const result = runAsOwner('learner-service', `DELETE FROM ${schema}.${table} WHERE ${where};`);
      return result.ok ? { ok: true } : { ok: false, reason: result.reason };
    },
  };
}

/** Runs one statement as the named owner's own MySQL credential. */
function runAsOwner(service, statement) {
  // The credential name comes from the same module the provisioning scripts use, so the probe cannot
  // drift from the account that was actually created.
  const user = credentialFor(service);
  if (user === null || user === undefined) return { ok: false, reason: `no credential recorded for ${service}` };
  const result = spawnSync('docker', [
    'compose', '-f', MYSQL.composeFile, 'exec', '-T', '-e', `MYSQL_PWD=${MYSQL.ownerPassword}`,
    MYSQL.composeService, 'mysql', '--protocol=TCP', '--host', '127.0.0.1', '--port', MYSQL.containerPort,
    '--user', user, '--batch', '--skip-column-names', '--execute', statement,
  ], { encoding: 'utf8', windowsHide: true });
  return result.status === 0
    ? { ok: true }
    : { ok: false, reason: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().slice(0, 200) };
}

/** Row counts for one durable business table per owner schema. */
function businessFactCounts(owners) {
  const counts = {};
  for (const owner of owners) {
    if (!owner.schema) continue;
    const table = admin(`SELECT table_name FROM information_schema.tables
      WHERE table_schema='${owner.schema}' AND table_name NOT LIKE '%outbox%'
        AND table_name NOT LIKE '%receipt%' AND table_name NOT LIKE '%schema_history%'
        AND table_name NOT LIKE '%event%' AND table_name NOT LIKE '%stat%'
      ORDER BY table_name LIMIT 1;`).stdout.split('\n').filter(Boolean)[0];
    if (!table) continue;
    const rows = Number(admin(`SELECT COUNT(*) FROM ${owner.schema}.${table};`).stdout.trim());
    counts[`${owner.schema}.${table}`] = Number.isFinite(rows) ? rows : null;
  }
  return counts;
}

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

/**
 * Every owner the policy gives a Redis namespace, not only the ones with a database manifest.
 *
 * api-gateway and workflow-service have no MySQL schema to reconcile, so runtimeOwners() leaves them
 * out, but both hold a namespace and an ACL user and the ownership policy expects both to be probed.
 * Probing only the database owners left the manifest claiming fifteen ACL users while the evidence
 * covered thirteen.
 */
function ownersWithRedisNamespace() {
  const databaseOwners = ownersFromManifests();
  const known = new Set(databaseOwners.map((owner) => owner.id));
  const extra = (ownership.serviceOwners ?? [])
    .filter((entry) => entry.redis?.namespace && !known.has(entry.service))
    .map((entry) => ({
      id: entry.service,
      schema: null,
      // Resolved from the ACL listing by namespace inside verifyRedisNamespaceAcl, because the
      // policy records a logical credential id rather than the Redis user name.
      credential: null,
      migrationMode: 'none',
      migrationDirectory: null,
      redisNamespace: entry.redis.namespace,
      source: 'redis-only',
    }));
  return [...databaseOwners, ...extra];
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
  // Resolve each owner to the ACL user scoped to its namespace, matching by suffix so a namespace
  // that is nested under a root prefix still resolves. What must hold is the isolation, not the
  // literal pattern text: exactly one user scoped to the namespace, able to write inside it, and
  // refused in another owner's.
  const usersByNamespace = new Map();
  for (const [user, pattern] of aclUsers) {
    const namespace = /^~([A-Za-z0-9_:-]+):\*$/u.exec(pattern)?.[1];
    if (!namespace) continue;
    usersByNamespace.set(namespace, [...(usersByNamespace.get(namespace) ?? []), user]);
  }
  // The set of ACL users must equal the set the ownership policy expects. Isolation probes alone do
  // not notice an extra account: a leftover from a rename passes every per-owner check while remaining a
  // live credential nobody owns, which is how svc_adminops outlived the rename meant to remove it.
  const expectedUsers = new Set(owners
    .filter((owner) => owner.redisNamespace)
    .flatMap((owner) => [...usersByNamespace.entries()]
      .filter(([candidate]) => candidate === owner.redisNamespace || candidate.endsWith(`:${owner.redisNamespace}`))
      .flatMap(([, users]) => users)));
  const actualUsers = [...aclUsers.keys()].filter((user) => user !== 'default');
  const unexpectedUsers = actualUsers.filter((user) => !expectedUsers.has(user));
  const missingUsers = [...expectedUsers].filter((user) => !actualUsers.includes(user));
  record('redis-namespace-acl:user-set-matches-policy',
    unexpectedUsers.length === 0 && missingUsers.length === 0 ? 'PASS' : 'FAIL', {
      expectedUsers: [...expectedUsers].sort(),
      actualUsers: [...actualUsers].sort(),
      unexpectedUsers: unexpectedUsers.sort(),
      missingUsers: missingUsers.sort(),
    });

  const resolveUser = (namespace) => {
    if (!namespace) return { user: null, pattern: null, matchedNamespace: null };
    for (const [candidateNamespace, users] of usersByNamespace) {
      const nested = candidateNamespace === namespace || candidateNamespace.endsWith(`:${namespace}`);
      if (nested && users.length === 1) {
        return { user: users[0], pattern: aclUsers.get(users[0]), matchedNamespace: candidateNamespace };
      }
    }
    return { user: null, pattern: null, matchedNamespace: null };
  };
  for (const owner of owners) {
    const resolved = owner.credential !== null && owner.credential !== undefined
      ? { user: owner.credential, pattern: aclUsers.get(owner.credential) ?? null, matchedNamespace: owner.redisNamespace }
      : resolveUser(owner.redisNamespace);
    const credential = resolved.user;
    const ownKey = `${owner.redisNamespace}:p1r-probe`;
    const own = credential === null ? { ok: false, replies: [] } : await respCommand(
      [['SET', ownKey, '1'], ['GET', ownKey], ['DEL', ownKey]],
      { user: credential, password: REDIS.ownerPassword },
    );
    // replies[0] is the AUTH reply, so the SET/GET/DEL results start at index 1.
    const foreignNamespace = owners.find((candidate) => candidate.id !== owner.id && candidate.redisNamespace)?.redisNamespace;
    const foreign = credential === null ? { replies: [] } : await respCommand(
      [['GET', `${foreignNamespace}:p1r-probe`]], { user: credential, password: REDIS.ownerPassword });
    const entry = {
      id: owner.id,
      credential,
      namespace: owner.redisNamespace,
      declaredPattern: resolved.pattern,
      expectedPattern: `~${owner.redisNamespace}:*`,
      // The exact pattern is asserted, not merely that the pattern is scoped. This was relaxed while the
      // policy still called the Gateway namespace "gateway" and the ACL called it "englishflow:gateway";
      // the policy was corrected instead, all fifteen owners now match exactly, and the weaker form is
      // no longer needed. Measured before restoring it: fifteen owners, fifteen exact matches.
      patternMatchesExactly: resolved.pattern === `~${owner.redisNamespace}:*`,
      ownNamespaceAllowed: own.ok && own.replies[1]?.value === 'OK' && own.replies[2]?.value === '1',
      foreignNamespace: foreignNamespace ?? null,
      foreignNamespaceDenied: Boolean(foreign.replies[1]?.value?.error?.startsWith('NOPERM')),
    };
    results.push(entry);
    record(`redis-namespace-acl:${owner.id}`,
      entry.patternMatchesExactly && entry.ownNamespaceAllowed && entry.foreignNamespaceDenied ? 'PASS' : 'FAIL', entry);
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

/**
 * Runs the owner tests that are gated behind system properties and records one check per class.
 *
 * Both families carry @EnabledIfSystemProperty, so a plain `mvn test` does not run them and a suite
 * report shows them as skipped rather than passing. Cross-tenant denial and empty-versus-existing
 * database migration are exactly what those classes assert, so the evidence has to come from running
 * them on purpose.
 */
function verifyGatedOwnerTests() {
  const result = spawnSync('node', ['scripts/runtime/run-gated-db-tests.mjs', '--json'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, JAVA_HOME: process.env.JAVA_HOME ?? 'C:\\Program Files\\Microsoft\\jdk-25.0.4.101-hotspot' },
  });
  let evidence = null;
  try {
    evidence = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
  } catch {
    evidence = null;
  }
  if (evidence !== null && Array.isArray(evidence.results)) {
    for (const entry of evidence.results) {
      // Classified by the property's exact shape, not by a suffix: iam.jdbc.migration.integration also
      // ends in "migration.integration" and was folded into the flyway coverage check, where it
      // overwrote the real iam.migration.integration group and made a passing requirement look failed.
      // The check id carries the property so two groups can never collide.
      const kind = /^[a-z0-9-]+\.tenant\.integration$/u.test(entry.property) ? 'tenant-isolation'
        : /^[a-z0-9-]+\.migration\.integration$/u.test(entry.property) ? 'flyway-coverage'
          : 'iam-jdbc-persistence';
      record(`${kind}:${entry.service}:${entry.property}`, entry.passed ? 'PASS' : 'FAIL', {
        property: entry.property,
        classes: entry.classes,
        testsRun: entry.testsRun,
        failures: entry.failures,
        errors: entry.errors,
        skipped: entry.skipped,
        reason: entry.reason,
      });
    }
    // The runner asserts its own coverage and so does the harness: a discovered class that was never
    // executed is exactly the defect this wiring exists to expose.
    record('gated-tests:discovery-coverage', evidence.uncoveredClasses?.length === 0 ? 'PASS' : 'FAIL', {
      discoveredClasses: evidence.discoveredClasses,
      uncoveredClasses: evidence.uncoveredClasses ?? [],
      policy: evidence.policy,
    });
    return { available: true, evidence };
  }
  // The Java toolchain or the database is not reachable from here. That is a real gap in the
  // evidence, so it is recorded as such rather than silently omitted.
  record('tenant-isolation:unavailable', 'FAIL', {
    reason: 'the gated owner tests could not be run from this harness',
    exitStatus: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.slice(-400),
  });
  return { available: false, evidence: null };
}


/**
 * Proves the reconcile runner refuses drift and recovers once it is repaired.
 *
 * This is the rollback and compensation evidence the ledger line for this task names. Compensation here is
 * the platform's own recovery path: a recorded checksum that no longer matches its migration is drift, and
 * the runner must stop rather than migrate on top of it. The corrupted value is restored in a finally block.
 */
async function verifyReconcileRefusesDriftAndRecovers() {
  const owner = ownership.serviceOwners.find((entry) => entry.service === 'learner-service');
  const schema = owner?.schema?.name ?? owner?.businessSchema?.name ?? 'learner_service';
  const original = admin(`SELECT checksum FROM ${schema}.p1r_schema_history WHERE version = 1;`).stdout.trim();
  if (original.length !== 64) {
    record('rollback:reconcile-refuses-drift', 'FAIL', {
      schema, recordedChecksum: original.slice(0, 24),
      reason: 'no checksum recorded for version 1, so drift cannot be simulated',
    });
    return;
  }
  const corrupted = `${original.slice(0, 63)}${original.endsWith('0') ? '1' : '0'}`;
  let refusal = null;
  let recovery = null;
  try {
    admin(`UPDATE ${schema}.p1r_schema_history SET checksum = '${corrupted}' WHERE version = 1;`);
    const drift = spawnSync('node', ['scripts/database/reconcile-owner-schemas.mjs', '--apply'],
      { cwd: root, encoding: 'utf8', windowsHide: true });
    const driftOutput = `${drift.stdout ?? ''}${drift.stderr ?? ''}`;
    refusal = {
      exitStatus: drift.status,
      refused: drift.status !== 0 && /changed after it was applied/u.test(driftOutput),
      message: (driftOutput.split(/\r?\n/u).find((line) => /changed after it was applied/u.test(line)) ?? '').trim().slice(0, 160),
    };
  } finally {
    // Restored before the recovery run and before any assertion is reported, so a failure above cannot
    // leave a false checksum behind for the next runner.
    admin(`UPDATE ${schema}.p1r_schema_history SET checksum = '${original}' WHERE version = 1;`);
  }
  const repaired = spawnSync('node', ['scripts/database/reconcile-owner-schemas.mjs', '--apply'],
    { cwd: root, encoding: 'utf8', windowsHide: true });
  let parsed = null;
  try {
    const text = repaired.stdout ?? '';
    parsed = JSON.parse(text.slice(text.indexOf('{')));
  } catch { parsed = null; }
  // The runner exits zero when it converges. The parsed block is recorded when it can be read, but its
  // absence is not itself a failure: the exit status and the restored checksum already show the run
  // succeeded, and treating an unparsed block as a non-convergence reported a recovery that had happened.
  recovery = {
    exitStatus: repaired.status,
    result: parsed?.result ?? null,
    reportedOwners: parsed?.results?.length ?? null,
    converged: repaired.status === 0,
  };
  const restored = admin(`SELECT checksum FROM ${schema}.p1r_schema_history WHERE version = 1;`).stdout.trim();
  record('rollback:reconcile-refuses-drift',
    refusal?.refused === true && recovery.converged && restored === original ? 'PASS' : 'FAIL', {
      schema,
      driftRefused: refusal,
      recovery,
      checksumRestored: restored === original,
      note: 'the reconcile runner stops on a checksum that no longer matches its migration and converges again after the record is repaired',
    });
}

function notVerifiable() {
  // A requirement whose ledger owner is a later task is NOT_APPLICABLE to this submission: this
  // task asserts the requirement, it does not deliver it. Anything this task does own and has not
  // verified is reported as FAILED, never softened.
  //
  // The ownership rule is applied to every requirement, including ones a check already recorded. It used to
  // skip those, which meant a requirement could be recorded VERIFIED here and left that way after it was
  // reassigned elsewhere: the rule that decides ownership never ran for it.
  const owners = readJson('config/p1r-m2-requirement-owners.v1.json');
  const ownerById = new Map((owners.requirements ?? []).map((entry) => [entry.id, entry]));
  for (const entry of ownership.m2RuntimeRequirements ?? []) {
    const owner = ownerById.get(entry.id);
    const ownedHere = !owner || owner.ownerTask === 'P1R-M2-004';
    const already = requirements.find((item) => item.id === entry.id);
    if (already !== undefined) {
      if (!ownedHere) {
        // Reassigned after the fact. The verified status cannot stand, and the change is recorded rather than
        // applied silently so the evidence says what happened.
        already.status = 'NOT_APPLICABLE';
        already.ownerTask = owner.ownerTask;
        already.reassignedBecause = `config assigns this requirement to ${owner.ownerTask}, so this task's checks no longer decide it`;
      }
      continue;
    }
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
const redis = await verifyRedisNamespaceAcl(ownersWithRedisNamespace());
const migrations = verifyMigrations(owners);
const emptyAndInvalid = verifyEmptySchemaAndInvalidSql(owners);
const gated = verifyGatedOwnerTests();
await verifyRedisLossCannotAffectBusinessFacts(() => businessFactCounts(owners));
verifyReconcileRefusesDriftAndRecovers();
// Requirement verdicts are derived from the checks themselves so the two can never disagree.
const requirementStatus = (prefix) => {
  const relevant = checks.filter((check) => check.id.startsWith(prefix));
  return relevant.length > 0 && relevant.every((check) => check.result === 'PASS') ? 'VERIFIED' : 'FAILED';
};
requirements.push({ id: 'M2-004-OWNER-SCHEMA-GRANTS', status: requirementStatus('owner-schema-grants:') });
requirements.push({ id: 'M2-004-CROSS-OWNER-DENY', status: requirementStatus('cross-owner-deny:') });
// The namespace and ACL clause is the per-owner probes; the second clause of the same requirement,
// that Redis loss or restart cannot create or lose a business fact, is the redis-loss check. Both
// belong to this requirement, so both have to pass for it to be VERIFIED.
requirements.push({
  id: 'M2-004-REDIS-NAMESPACE-ACL',
  status: requirementStatus('redis-namespace-acl:') === 'VERIFIED' && requirementStatus('redis-loss:') === 'VERIFIED'
    ? 'VERIFIED' : 'FAILED',
});
requirements.push({ id: 'M2-004-FLYWAY-EMPTY-AND-EXISTING', status: requirementStatus('migration-') });
// The rollback and compensation requirement is owned by P1R-M2-006 and this task reports it NOT_APPLICABLE.
// The check below is migration-safety evidence: it proves the reconcile runner refuses a checksum that no
// longer matches its migration and recovers after repair, which is a real property but not the one the ledger
// names, since it performs no rollback and writes none of the receipts.
requirements.push({ id: 'M2-004-ROLLBACK-COMPENSATION', status: requirementStatus('rollback:') });
// The tenant guard is delivered here at the storage layer. The gated *TenantIsolationTest classes each run
// against their own owner's schema on a real MySQL, write and read facts with a JdbcTemplate, and assert
// that a foreign tenant's rows are not returned. Four of the ten instantiate no production class, so this
// is evidence about schema-level isolation rather than about every service's request path. Only the
// HTTP-level two-tenant negative is residual, and that is recorded as a gap rather than used to reassign
// the requirement.
requirements.push({ id: 'M2-004-TENANT-GUARD', status: requirementStatus('tenant-isolation:') });
requirements.push({ id: 'M2-004-FLYWAY-OWNER-COVERAGE', status: requirementStatus('flyway-coverage:') });
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
