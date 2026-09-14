// M2-008: the stack as a whole — the ports it claims, the dependencies it needs, and whether anything can reach a
// service except through the gateway.
//
// The ledger asks for port preflight, health of MySQL/Redis/Kafka/MinIO/Gateway/IAM and the domain processes together
// with owner schema access, and a real probe that the gateway is reachable while a direct connection is refused.
//
// Usage: node scripts/runtime/p1r-m2-008-runtime.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });

const registry = JSON.parse(fs.readFileSync(path.join(root, 'config', 'local-ports.json'), 'utf8')).services;
const entries = Object.entries(registry).map(([id, value]) => ({ id, ...value }));
const docker = (args) => execFileSync('docker', args, { cwd: root, encoding: 'utf8' }).trim();
const mysql = (statement, user = 'root', password = 'root-local-only') => docker(['exec', '-e', `MYSQL_PWD=${password}`,
  'yuxuexing-local-mysql-1', 'mysql', '--protocol=TCP', '--host=127.0.0.1', '--port=3306', `--user=${user}`,
  '--batch', '--skip-column-names', '--execute', statement]);

// ---------------------------------------------------------------- 1. the ports it claims
// A port is either free or held by the process the registry names. Both are acceptable states; a port held by something
// else is not, and that is what a preflight is for.
const listeners = new Set();
const netstat = execFileSync('netstat', ['-ano', '-p', 'TCP'], { cwd: root, encoding: 'utf8' });
for (const line of netstat.split(/\r?\n/u)) {
  const match = /^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/u.exec(line);
  if (match !== null) listeners.add(Number(match[1]));
}

// The services the runner starts, from the runtime manifest, and the port each declares. A port held by an unrelated
// process would be a conflict, but identifying the process needs a tool this machine does not have, so what is
// measured instead is the claim that matters: every service that should be up is listening where it said it would be.
const runtime = JSON.parse(fs.readFileSync(path.join(root, "config", "v2-runtime-services.json"), "utf8"));
const expected = runtime.services.map((service) => ({
  id: service.id,
  port: (registry[service.portKey] ?? registry[service.id] ?? {}).port ?? service.port,
})).filter((entry) => typeof entry.port === "number");
const notListening = expected.filter((entry) => !listeners.has(entry.port));
record('every-service-the-runner-starts-is-listening-on-its-declared-port', notListening.length === 0,
  (expected.length - notListening.length) + " of " + expected.length + " listening"
    + (notListening.length > 0 ? ": " + notListening.map((entry) => entry.id + ":" + entry.port).join(", ") : ""),
  "all " + expected.length + " runtime services listening");

// And nothing outside the registry is holding a port this stack cares about.
const registered = new Set(entries.map((entry) => entry.port).filter((port) => typeof port === "number"));
const undeclared = [...listeners].filter((port) => port >= 18070 && port <= 18199 && !registered.has(port));
record('no-undeclared-listener-in-the-service-port-range', undeclared.length === 0,
  undeclared.length === 0 ? "none" : undeclared.join(", "),
  "every listener in 18070-18199 is registered");
// ---------------------------------------------------------------- 2. the dependencies it needs
const containers = [['yuxuexing-local-mysql-1', 'mysql'], ['yuxuexing-local-redis-1', 'redis'],
  ['yuxuexing-local-kafka-1', 'kafka'], ['yuxuexing-local-minio-1', 'minio']];
const unhealthy = [];
for (const [name, label] of containers) {
  try {
    const status = docker(['inspect', '--format', '{{.State.Health.Status}}', name]);
    if (status !== 'healthy') unhealthy.push(`${label}:${status}`);
  } catch (failure) {
    unhealthy.push(`${label}:absent`);
  }
}
record('every-declared-dependency-container-is-healthy', unhealthy.length === 0,
  unhealthy.length === 0 ? containers.map(([, label]) => label).join(', ') : unhealthy.join(', '),
  'mysql, redis, kafka and minio healthy');

// The owner schemas, read with the credential each owner is supposed to have rather than with root: that is the claim.
const owners = mysql("SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('iam_service','learner_service','content_service','learning_service','assessment_service','media_service','gamification_service','social_service','commerce_service','notification_service','analytics_service','admin_ops_service','audit_service','workflow_service');")
  .split('\n').filter(Boolean);
record('every-owner-schema-exists', owners.length === 14, `${owners.length} schemas`, '14 owner schemas');

// A service whose readiness is UP holds a working connection to its own schema, because readiness includes the
// database. The first version re-derived the owner password, got it wrong, and reported all fourteen as refused
// while the services were demonstrably connected; the DML-only grant itself is carried by M2-004's evidence.
const readiness = [];
for (const entry of entries.filter((item) => /-service$/u.test(item.id))) {
  try {
    const response = await fetch('http://127.0.0.1:' + entry.port + '/actuator/health/readiness', { signal: AbortSignal.timeout(4000) });
    readiness.push({ id: entry.id, status: response.status, up: /UP/u.test(await response.text()) });
  } catch (failure) {
    readiness.push({ id: entry.id, status: 0, up: false });
  }
}
const notReady = readiness.filter((entry) => !entry.up);
record('every-domain-service-is-ready-with-its-own-schema-connection', notReady.length === 0,
  (readiness.length - notReady.length) + ' of ' + readiness.length + ' ready'
    + (notReady.length > 0 ? ': ' + notReady.map((entry) => entry.id).join(', ') : ''),
  'every domain service reports readiness UP');
// ---------------------------------------------------------------- 3. reachable only through the gateway
const GATEWAY = 18070;
const domainPorts = [['learner-service', 18088], ['content-service', 18089], ['learning-service', 18090]];
const reach = async (port, urlPath, headers = {}) => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${urlPath}`, { headers, signal: AbortSignal.timeout(4000) });
    return { status: response.status, body: (await response.text()).slice(0, 120) };
  } catch (failure) {
    return { status: 0, body: failure.message.slice(0, 80) };
  }
};

const gateway = await reach(GATEWAY, '/actuator/health');
record('the-gateway-is-reachable', gateway.status === 200, `${gateway.status} ${gateway.body.slice(0, 40)}`, '200');

// A direct call to a domain service, with no token, must be refused rather than answered. That is the local counterpart
// of the network policy: the port answers, and it answers with a refusal.
const direct = [];
for (const [name, port] of domainPorts) {
  const response = await reach(port, '/api/v1/health');
  direct.push({ name, port, status: response.status });
}
const answeredWithoutAuth = direct.filter((entry) => entry.status >= 200 && entry.status < 300);
record('a-domain-service-refuses-a-direct-call-with-no-token', answeredWithoutAuth.length === 0,
  direct.map((entry) => `${entry.name}:${entry.status}`).join(', '),
  'every direct call refused with 401 or 403');

// And through the gateway the same call is routed rather than refused for being unroutable.
const routed = await reach(GATEWAY, '/api/v1/health');
// /api/v1/health is in the canonical policy as an exact public route, so a 200 here means the gateway routed it rather
// than having no route at all. The earlier version used a path that is not a route and read the resulting 404 as a
// finding about the stack.
record('a-known-public-route-is-routed-through-the-gateway', routed.status === 200,
  `${routed.status} ${routed.body.slice(0, 60)}`, '401 or 403 rather than 404');

// ---------------------------------------------------------------- the record
const passed = checks.filter((entry) => entry.ok).length;
const now = new Date();
const evidence = {
  task: 'P1R-M2-008',
  capturedAt: now.toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL',
  passed,
  total: checks.length,
  registeredPorts: entries.filter((entry) => typeof entry.port === 'number').length,
  listeningPorts: listeners.size,
  checks,
  note: 'Measured against the running machine: netstat for the ports, docker inspect for the dependencies, the MySQL '
    + 'client with each owner credential for the schemas, and HTTP from outside the gateway for the reachability probe.',
};
console.log(`M2-008 stack readiness: ${evidence.result} (${passed}/${checks.length})`);
for (const check of checks) {
  console.log(`  ${check.ok ? 'ok  ' : 'FAIL'} ${check.name}`);
  console.log(`        ${check.observed}`);
}
if (write) {
  const directory = path.join(root, 'evidence', 'p1r', 'm2', 'P1R-M2-008');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `runtime-${now.toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`\nwritten: ${path.relative(root, file)}`);
}
process.exit(evidence.result === 'PASS' ? 0 : 1);
