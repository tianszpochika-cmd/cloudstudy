// Unpublish local acceptance probes through content-service's reviewed command
// boundary. Dry-run by default; never accepts a remote Gateway or database.
import { randomBytes } from 'node:crypto';
import { runMysql } from '../database/lib/mysql-client.mjs';

const gateway = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'local-acceptance-cleanup', deviceName: 'local-cleanup' };
const allowed = [
  [/^LIVE-PUB-[A-Z0-9]+$/i, /^Live publish proof$/],
  [/^T5-PACK-[A-Z0-9]+$/i, /^T5 pack$/],
  [/^b31-live-[a-z0-9]+$/i, /^B31 本地真实内容$/],
  [/^wct-m3005-[a-z0-9]+$/i, /^m3003 trail probe$/],
  [/^wct-rb-[a-z0-9]+$/i, /^rollback probe(?: v\d+)?$/],
];

let sequence = 0;
async function call(method, path, { token, body } = {}) {
  const headers = {
    accept: 'application/json',
    'x-client-platform': 'web',
    'idempotency-key': `local-probe-cleanup-${stamp}-${++sequence}`,
  };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers['content-type'] = 'application/json';
  const response = await fetch(`${gateway}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual',
  });
  const payload = await response.json().catch(() => null);
  return {
    status: response.status,
    data: payload?.data,
    errorCode: payload?.error?.code ?? payload?.code ?? null,
  };
}

async function probes() {
  const result = await call('GET', '/api/v1/public/content/catalog');
  if (result.status !== 200 || !Array.isArray(result.data?.items)) {
    throw new Error(`public catalog unavailable: HTTP ${result.status}`);
  }
  return result.data.items.filter((item) => {
    const code = String(item.contentCode ?? '');
    const title = String(item.title ?? '');
    return allowed.some(([codePattern, titlePattern]) => codePattern.test(code) && titlePattern.test(title));
  }).map((item) => ({ code: item.contentCode, title: item.title }));
}

const selected = await probes();
console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'dry-run', count: selected.length, probes: selected }, null, 2));
if (!process.argv.includes('--apply') || selected.length === 0) process.exit(0);

if (process.env.MYSQL_HOST && process.env.MYSQL_HOST !== '127.0.0.1') throw new Error('local MySQL only');
if (process.env.MYSQL_PORT && process.env.MYSQL_PORT !== '13306') throw new Error('local MySQL only');
function mysql(input) {
  return runMysql({
    mysqlBin: process.env.MYSQL_BIN || 'mysql',
    mysqlArgs: ['--protocol=TCP', '--host', '127.0.0.1', '--port', '13306', '--user', 'root', '--default-character-set=utf8mb4'],
    password: process.env.MYSQL_ROOT_PASSWORD || 'root-local-only', cwd: process.cwd(), input,
  });
}
const identifier = `local-probe-cleanup-${stamp}@local.invalid`;
const password = `L0cal!${randomBytes(20).toString('base64url')}`;
const registered = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device } });
if (registered.status !== 201) throw new Error(`staff fixture registration failed: HTTP ${registered.status}`);
try {
  mysql(`UPDATE iam_service.iam_account SET roles = 'staff,content-publisher', permissions = 'content:publish' WHERE identifier = '${identifier}';\n`);
  const login = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device } });
  const token = login.data?.accessToken;
  if (login.status !== 200 || typeof token !== 'string' || !token) throw new Error(`staff fixture login failed: HTTP ${login.status}`);

  const results = [];
  for (const probe of selected) {
    const result = await call('POST', '/api/v1/admin/content-commands', {
      // Existing rollback probes were restored to v1 while the old running
      // controller defaults UNPUBLISH to the latest version (v2).
      token, body: {
        command: 'UNPUBLISH', contentCode: probe.code,
        ...(probe.code.startsWith('wct-rb-') ? { targetVersionNumber: 1 } : {}),
      },
    });
    results.push({ code: probe.code, status: result.status, errorCode: result.errorCode });
  }
  const remaining = await probes();
  console.log(JSON.stringify({ unpublished: results, remaining }, null, 2));
  if (results.some((result) => result.status !== 202) || remaining.length) process.exitCode = 1;
} finally {
  // The narrowly privileged local account must never remain active after the run.
  mysql(`START TRANSACTION;
UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
   SET s.status='REVOKED', s.revoked_at=UTC_TIMESTAMP(6), s.revoke_reason='LOCAL_FIXTURE_CLEANUP'
 WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
UPDATE iam_service.iam_account SET status='DISABLED', roles='', permissions='' WHERE identifier='${identifier}';
COMMIT;\n`);
}
