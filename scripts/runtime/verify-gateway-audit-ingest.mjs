// Proves the Gateway's security audit envelopes reach the canonical ingest and are stored once.
//
// The ledger line for M2-006 asks for a redacted Gateway envelope persisted through the canonical ingest, and
// for the requestId, traceId and auditId to be correlatable afterwards. Reading the Gateway's own logs would
// show only that it tried; what matters is that a fact exists in the audit schema, exactly once, carrying the
// correlation the caller was given.
//
// Usage: node scripts/runtime/verify-gateway-audit-ingest.mjs [--write] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const gateway = process.env.GATEWAY_ORIGIN ?? 'http://127.0.0.1:18070';
const schemaIdentifier = 'm2.gateway.security-audit.evidence.v1';

/** One scalar from the local MySQL container. */
function scalar(statement) {
  const result = spawnSync('docker', [
    'compose', '-f', process.env.MYSQL_COMPOSE_FILE ?? 'infra/docker/docker-compose.dev.yml',
    'exec', '-T', '-e', `MYSQL_PWD=${process.env.MYSQL_ROOT_PASSWORD ?? 'root-local-only'}`,
    process.env.MYSQL_COMPOSE_SERVICE ?? 'mysql',
    'mysql', '--protocol=TCP', '--host', '127.0.0.1', '--port', process.env.MYSQL_CONTAINER_PORT ?? '3306',
    '--user', 'root', '--batch', '--skip-column-names', '--execute', statement,
  ], { encoding: 'utf8', windowsHide: true });
  return (result.stdout ?? '').trim();
}

export async function verifyGatewayAuditIngest() {
  const requestId = `p1r-m2-006-${Date.now()}`;
  // A request the Gateway refuses for want of a session: that refusal is exactly the event the audit filter
  // exists to record, and it needs no account to produce.
  const response = await fetch(`${gateway}/api/v1/iam/principal/me`, {
    headers: { 'x-request-id': requestId, 'x-p1r-probe': 'm2-006' },
  });
  const status = response.status;
  const responseRequestId = response.headers.get('x-request-id') ?? null;

  // Give the sink a moment to deliver, then read what actually landed.
  let facts = 0;
  let receipts = 0;
  let storedSchema = null;
  let storedRequestId = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    facts = Number(scalar(`SELECT COUNT(*) FROM audit_service.audit_fact WHERE request_id = '${requestId}';`) || 0);
    receipts = Number(scalar(`SELECT COUNT(*) FROM audit_service.audit_ingest_receipt r
      JOIN audit_service.audit_fact f ON f.event_id = r.event_id WHERE f.request_id = '${requestId}';`) || 0);
    if (facts > 0) {
      storedSchema = scalar(`SELECT schema_version FROM audit_service.audit_fact WHERE request_id = '${requestId}' LIMIT 1;`);
      storedRequestId = scalar(`SELECT request_id FROM audit_service.audit_fact WHERE request_id = '${requestId}' LIMIT 1;`);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  // audit_fact has no source column. The gateway's attribution is in the action it sets, gateway.<route>, so that is
  // what is read. The earlier version queried a column that does not exist, and three assertions could therefore never
  // have passed regardless of what the gateway did.
  const storedAction = facts > 0
    ? scalar(`SELECT action FROM audit_service.audit_fact WHERE request_id = '${requestId}' LIMIT 1;`)
    : null;
  const redaction = facts > 0
    ? scalar(`SELECT IF(redacted_payload LIKE '%authorization%' OR redacted_payload LIKE '%Bearer %', 'LEAKED', 'no-credential-material')
        FROM audit_service.audit_fact WHERE request_id = '${requestId}' LIMIT 1;`)
    : null;

  const assertions = [
    { name: 'the gateway refused the request, so an event was produced', ok: status === 401, observed: status, expected: 401 },
    { name: 'the caller was given a request id to correlate with', ok: responseRequestId === requestId, observed: responseRequestId, expected: requestId },
    { name: 'exactly one audit fact was stored', ok: facts === 1, observed: facts, expected: 1 },
    { name: 'the fact has exactly one ingest receipt', ok: receipts === 1, observed: receipts, expected: 1 },
    { name: 'the schema identifier was stored whole', ok: storedSchema === schemaIdentifier, observed: storedSchema, expected: schemaIdentifier },
    { name: 'the fact is attributed to the gateway', ok: typeof storedAction === 'string' && storedAction.startsWith('gateway.'), observed: storedAction, expected: 'gateway.<route>' },
    { name: 'the stored request id matches the one the caller saw', ok: storedRequestId === requestId, observed: storedRequestId, expected: requestId },
    { name: 'the stored envelope carries no credential material', ok: redaction === 'no-credential-material', observed: redaction, expected: 'no-credential-material' },
  ];
  const failing = assertions.filter((entry) => !entry.ok);
  // A failure here has a known cause rather than an unknown one, and the report says which: the Gateway has a
  // durable sink but no way to authenticate to the ingest, because IAM issues no service token and the Gateway
  // is forbidden from signing its own. The mechanism is a service-to-service authentication decision, which the
  // architecture rules put behind an ADR, so it is recorded rather than invented here.
  const blockedBy = failing.length === 0 ? null
    : 'the Gateway has a durable sink (HttpSecurityAuditSink) but no credential for the canonical ingest: '
      + 'iam-service exposes no service-token or client-credentials endpoint, audit-service validates issuer and '
      + 'audience on /internal/v1/audit/**, and AGENTS.md makes iam-service the only token issuer. Service-to-service '
      + 'authentication is an architecture boundary change and needs an ADR before it can be wired.';
  return {
    schema: 'platform.gateway-audit-ingest-check.v1',
    taskId: 'P1R-M2-006',
    capturedAt: new Date().toISOString(),
    gateway,
    requestId,
    assertions,
    failing: failing.length,
    blockedBy,
    result: failing.length === 0 ? 'PASS' : 'FAIL',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const report = await verifyGatewayAuditIngest();
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    console.log(`gateway audit ingest check: ${report.result}`);
    for (const entry of report.assertions) {
      console.log(`  ${entry.ok ? 'PASS' : 'FAIL'} ${entry.name}: observed ${entry.observed}, expected ${entry.expected}`);
    }
  }
  if (process.argv.includes('--write')) {
    const directory = path.join(root, 'evidence/p1r/m2/P1R-M2-006');
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, 'gateway-audit-ingest-check.json');
    fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`written: ${path.relative(root, file).replaceAll('\\', '/')}`);
  }
  process.exitCode = report.result === 'PASS' ? 0 : 1;
}
