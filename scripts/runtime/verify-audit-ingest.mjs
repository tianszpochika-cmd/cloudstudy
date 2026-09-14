// Proves the audit ingest boundary end to end against the orchestrated stack, and writes the result.
//
// The 202 ACCEPTED and 200 DUPLICATE responses this asserts were previously recorded only in the execution
// record's prose, produced by a probe that lived in a scratch directory. A claim about what an endpoint
// returns belongs in a tracked script that fails when it is wrong, so this is that script: it mints a
// short-lived RS256 token mirroring the claim shape IAM issues, adds only the audit.ingest permission,
// ingests one event, replays it, and then reads MySQL to confirm that a replay created no second fact and
// that the 37-character schema identifier was stored whole.
//
// Usage: node scripts/runtime/verify-audit-ingest.mjs [--write] [--json]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const auditOrigin = process.env.AUDIT_ORIGIN ?? 'http://127.0.0.1:18099';
const issuer = 'http://127.0.0.1:18087';
const audience = 'yuxuexing-api';
const kid = process.env.IAM_JWT_KEY_ID ?? 'iam-local-2026-08';
const schemaVersion = 'm2.gateway.security-audit.evidence.v1';

/** Reads one scalar from the local MySQL container. */
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

function mintToken(privateKey) {
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const subject = crypto.randomUUID();
  const header = { kid, typ: 'JWT', alg: 'RS256' };
  const payload = {
    tenant_id: 'platform',
    sub: subject,
    owner_id: subject,
    roles: ['platform-auditor'],
    amr: ['pwd'],
    iss: issuer,
    session_id: crypto.randomUUID(),
    token_type: 'access',
    aud: audience,
    nbf: now - 5,
    permissions: ['audit.ingest'],
    scope: 'audit.ingest',
    exp: now + 300,
    iat: now,
    jti: crypto.createHash('sha256').update(`${subject}:${now}`).digest('hex'),
  };
  const signingInput = `${b64(header)}.${b64(payload)}`;
  return `${signingInput}.${crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url')}`;
}

export async function verifyAuditIngest() {
  const keyPath = path.join(root, 'secrets/iam-rsa-private.pem');
  if (!fs.existsSync(keyPath)) {
    return {
      schema: 'platform.audit-ingest-check.v1',
      capturedAt: new Date().toISOString(),
      result: 'FAIL',
      reason: `no signing key at ${path.relative(root, keyPath).replaceAll('\\', '/')}`,
    };
  }
  const token = mintToken(fs.readFileSync(keyPath, 'utf8'));
  const eventId = crypto.randomUUID();
  const event = {
    eventId,
    sourceService: 'api-gateway',
    schemaVersion,
    tenantId: 'platform',
    actorSubjectHash: crypto.createHash('sha256').update('p1r-m2-004-audit-probe').digest('hex'),
    action: 'p1r.m2-004.audit.ingest.probe',
    decision: 'ALLOW',
    reasonCode: 'M2_004_AUDIT_CHECK',
    occurredAt: new Date().toISOString(),
    requestId: 'p1r-m2-004-request',
    traceId: 'p1r-m2-004-trace',
    redactedPayload: { check: 'm2-004-audit-ingest', run: 'local-real' },
  };

  const send = async () => {
    const response = await fetch(`${auditOrigin}/internal/v1/audit/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(event),
    });
    const body = await response.text();
    return { status: response.status, body: body.slice(0, 300), code: /"code"\s*:\s*"([^"]+)"/u.exec(body)?.[1] ?? null };
  };

  const ingest = await send();
  const replay = await send();
  // The facts are read after both calls, so a replay that created a second row is visible rather than
  // assumed away.
  const receiptCount = Number(scalar(`SELECT COUNT(*) FROM audit_service.audit_ingest_receipt WHERE event_id = '${eventId}';`) || 0);
  const factCount = Number(scalar(`SELECT COUNT(*) FROM audit_service.audit_fact WHERE event_id = '${eventId}';`) || 0);
  const storedSchemaVersion = scalar(`SELECT schema_version FROM audit_service.audit_fact WHERE event_id = '${eventId}' LIMIT 1;`);
  const columnWidth = Number(scalar(`SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.columns
    WHERE table_schema='audit_service' AND table_name='audit_fact' AND column_name='schema_version';`) || 0);

  const assertions = [
    { name: 'first ingest accepted', ok: ingest.status === 202, observed: ingest.status, expected: 202 },
    { name: 'replay is a duplicate', ok: replay.status === 200 && /DUPLICATE/iu.test(replay.body), observed: `${replay.status} ${replay.code ?? ''}`.trim(), expected: '200 DUPLICATE' },
    { name: 'one receipt', ok: receiptCount === 1, observed: receiptCount, expected: 1 },
    { name: 'one fact', ok: factCount === 1, observed: factCount, expected: 1 },
    { name: 'schema identifier stored whole', ok: storedSchemaVersion === schemaVersion, observed: storedSchemaVersion, expected: schemaVersion },
    { name: 'column wide enough', ok: columnWidth >= schemaVersion.length, observed: columnWidth, expected: `>= ${schemaVersion.length}` },
  ];
  const failing = assertions.filter((entry) => !entry.ok);
  return {
    schema: 'platform.audit-ingest-check.v1',
    taskId: 'P1R-M2-004',
    capturedAt: new Date().toISOString(),
    auditOrigin,
    eventId,
    assertions,
    failing: failing.length,
    result: failing.length === 0 ? 'PASS' : 'FAIL',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const report = await verifyAuditIngest();
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    console.log(`audit ingest check: ${report.result}`);
    for (const entry of report.assertions ?? []) {
      console.log(`  ${entry.ok ? 'PASS' : 'FAIL'} ${entry.name}: observed ${entry.observed}, expected ${entry.expected}`);
    }
    if (report.reason) console.log(`  ${report.reason}`);
  }
  if (process.argv.includes('--write')) {
    const file = path.join(root, 'evidence/p1r/m2/P1R-M2-004/audit-ingest-check.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`written: ${path.relative(root, file).replaceAll('\\', '/')}`);
  }
  process.exitCode = report.result === 'PASS' ? 0 : 1;
}
