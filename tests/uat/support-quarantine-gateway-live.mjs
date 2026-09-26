// Local-only owner/Gateway read probe. Credentials, JWT and exact ticket IDs stay in memory.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const gateway = 'http://127.0.0.1:18070';
const nonce = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
const identifier = `uat-support-quarantine-${nonce}@local.invalid`;
const password = `Uat!${randomBytes(20).toString('base64url')}a9`;
const device = { deviceType: 'WEB', clientVersion: 'uat-support-quarantine', deviceName: 'local-uat' };
const evidence = { capturedAt: new Date().toISOString(), statuses: {}, counts: {}, cleanup: null };
let principalId;
let registered = false;
let requestNo = 0;

function mysql(sql) {
  return execFileSync('docker', ['exec', '-i', 'yuxuexing-local-mysql-1', 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -B'],
  { input: `${sql.trim()}\n`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function exactIdentifier() {
  if (!/^uat-support-quarantine-[a-z0-9-]+@local\.invalid$/.test(identifier)) {
    throw new Error('synthetic identifier format changed');
  }
  return identifier;
}

function exactPrincipal() {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(principalId ?? '')) {
    throw new Error('synthetic principal format changed');
  }
  return principalId;
}

async function call(method, route, { token, body } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    headers['idempotency-key'] = `uat-support-${nonce}-${++requestNo}`;
  }
  const response = await fetch(gateway + route, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json,
    code: json?.error?.code ?? json?.code ?? json?.title ?? null };
}

function accountPrincipal() {
  const rows = mysql(`SELECT principal_id FROM iam_service.iam_account
    WHERE identifier='${exactIdentifier()}' AND status='ACTIVE';`).split(/\r?\n/).filter(Boolean);
  if (rows.length !== 1) throw new Error('synthetic account lookup was not unique');
  principalId = rows[0];
  return exactPrincipal();
}

function grantReadOnly() {
  const rows = mysql(`UPDATE iam_service.iam_account
    SET roles='staff', permissions=TRIM(BOTH ',' FROM CONCAT_WS(',', NULLIF(permissions,''),
      'support.ticket.read', 'admin.support.read'))
    WHERE identifier='${exactIdentifier()}' AND principal_id='${exactPrincipal()}' AND status='ACTIVE';
    SELECT ROW_COUNT();
    SELECT FIND_IN_SET('support.ticket.read',permissions),
      FIND_IN_SET('admin.support.read',permissions), FIND_IN_SET('staff',roles)
    FROM iam_service.iam_account WHERE identifier='${exactIdentifier()}'
      AND principal_id='${exactPrincipal()}';`).split(/\r?\n/).filter(Boolean);
  if (rows[0] !== '1' || rows.length !== 2 || rows[1].split('\t').some((v) => Number(v) < 1)) {
    throw new Error('read-only permission grant was not exact');
  }
}

function fixtureTicketId() {
  const rows = mysql(`SELECT ticket_id FROM admin_ops_service.support_ticket
    WHERE tenant_id='local-support-fixture' ORDER BY ticket_id LIMIT 1;`).split(/\r?\n/).filter(Boolean);
  if (rows.length !== 1 || !/^[A-Za-z0-9._:-]{8,128}$/.test(rows[0])) {
    throw new Error('fixture ticket lookup is not unique');
  }
  return rows[0];
}

function ownerCounts() {
  const rows = mysql(`SELECT tenant_id, COUNT(*) FROM admin_ops_service.support_ticket
    WHERE tenant_id IN ('platform','local-support-fixture') GROUP BY tenant_id;`)
    .split(/\r?\n/).filter(Boolean);
  return Object.fromEntries(rows.map((row) => {
    const [tenant, count] = row.split('\t');
    return [tenant, Number(count)];
  }));
}

function cleanup() {
  const rows = mysql(`START TRANSACTION;
    UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
       SET s.status='REVOKED', s.revoked_at=UTC_TIMESTAMP(6), s.revoke_reason='LOCAL_UAT_CLEANUP'
     WHERE a.identifier='${exactIdentifier()}' AND a.principal_id='${exactPrincipal()}'
       AND s.status='ACTIVE';
    UPDATE iam_service.iam_account SET status='DISABLED', roles='', permissions=''
     WHERE identifier='${exactIdentifier()}' AND principal_id='${exactPrincipal()}' AND status='ACTIVE';
    SELECT ROW_COUNT();
    SELECT COUNT(*) FROM iam_service.iam_session s JOIN iam_service.iam_account a
      ON a.principal_id=s.principal_id WHERE a.identifier='${exactIdentifier()}' AND s.status='ACTIVE';
    COMMIT;`).split(/\r?\n/).filter(Boolean);
  if (rows.length !== 2 || rows[0] !== '1' || rows[1] !== '0') {
    throw new Error('synthetic account cleanup failed');
  }
  return { disabledAccounts: 1, activeSessions: 0 };
}

try {
  evidence.counts.ownerBefore = ownerCounts();
  if (evidence.counts.ownerBefore.platform !== 27
      || evidence.counts.ownerBefore['local-support-fixture'] !== 74) {
    throw new Error('owner tenant counts changed before Gateway probe');
  }
  const anonymous = await call('GET', '/api/v1/admin/ops/tickets?includeAll=true');
  evidence.statuses.anonymous = anonymous.status;
  if (anonymous.status !== 401) throw new Error(`anonymous list HTTP ${anonymous.status}`);

  const registration = await call('POST', '/api/v1/auth/register', {
    body: { identifier, password, device },
  });
  evidence.statuses.register = registration.status;
  registered = registration.status === 201;
  if (!registered || !registration.json?.data?.accessToken) {
    throw new Error(`synthetic registration HTTP ${registration.status}`);
  }
  accountPrincipal();
  const beforeGrant = await call('GET', '/api/v1/admin/ops/tickets?includeAll=true', {
    token: registration.json.data.accessToken,
  });
  evidence.statuses.beforeGrant = beforeGrant.status;
  if (beforeGrant.status !== 403) throw new Error(`unprivileged list HTTP ${beforeGrant.status}`);

  const initialToken = registration.json.data.accessToken;
  const gate = await call('POST', '/api/v1/iam/adult-gate', {
    token: initialToken,
    body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' },
  });
  evidence.statuses.adultGate = gate.status;
  if (gate.status !== 200) throw new Error(`synthetic adult Gate HTTP ${gate.status}`);
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const consent = await call('PUT', '/api/v1/iam/consents', {
      token: initialToken,
      body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' },
    });
    evidence.statuses[`consent${type}`] = consent.status;
    if (consent.status !== 200) throw new Error(`${type} consent HTTP ${consent.status}`);
  }

  grantReadOnly();
  const login = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device } });
  evidence.statuses.login = login.status;
  if (login.status !== 200 || !login.json?.data?.accessToken) {
    throw new Error(`synthetic login HTTP ${login.status}`);
  }
  const token = login.json.data.accessToken;
  const all = await call('GET', '/api/v1/admin/ops/tickets?limit=50&includeAll=true', { token });
  evidence.statuses.all = all.status;
  const items = all.json?.data?.items;
  if (all.status !== 200 || !Array.isArray(items) || items.length !== 27) {
    throw new Error(`admin list HTTP ${all.status}, code ${all.code}, visible ${items?.length}`);
  }
  evidence.counts.visibleAll = items.length;
  const own = await call('GET', '/api/v1/admin/ops/tickets?includeAll=false', { token });
  evidence.statuses.own = own.status;
  const ownItems = own.json?.data?.items;
  if (own.status !== 200 || !Array.isArray(ownItems) || ownItems.length !== 0) {
    throw new Error(`owner-scoped empty list HTTP ${own.status}, visible ${ownItems?.length}`);
  }
  evidence.counts.visibleOwn = 0;
  const firstId = items[0]?.ticketId;
  if (typeof firstId !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(firstId)) {
    throw new Error('first visible ticket reference invalid');
  }
  const detail = await call('GET', `/api/v1/admin/ops/tickets/${encodeURIComponent(firstId)}`, { token });
  evidence.statuses.platformDetail = detail.status;
  if (detail.status !== 200 || detail.json?.data?.ticketId !== firstId) {
    throw new Error(`platform detail HTTP ${detail.status}`);
  }
  const isolated = await call('GET',
    `/api/v1/admin/ops/tickets/${encodeURIComponent(fixtureTicketId())}`, { token });
  evidence.statuses.fixtureDetail = isolated.status;
  if (![403, 404].includes(isolated.status)) {
    throw new Error(`fixture detail leaked, HTTP ${isolated.status}`);
  }
  evidence.counts.ownerAfter = ownerCounts();
  if (JSON.stringify(evidence.counts.ownerAfter) !== JSON.stringify(evidence.counts.ownerBefore)) {
    throw new Error('read-only Gateway probe changed owner counts');
  }
} catch (error) {
  evidence.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  if (registered) {
    try { evidence.cleanup = cleanup(); }
    catch (error) {
      evidence.cleanup = { failed: error instanceof Error ? error.message : String(error) };
      process.exitCode = 1;
    }
  }
  evidence.result = process.exitCode ? 'FAIL' : 'PASS';
  mkdirSync('artifacts/uat-2026-09-23', { recursive: true });
  writeFileSync('artifacts/uat-2026-09-23/support-quarantine-gateway-live.json',
    `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ result: evidence.result, statuses: evidence.statuses,
    counts: evidence.counts, cleanup: evidence.cleanup }));
}
