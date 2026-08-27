import { runMysql } from './lib/mysql-client.mjs';

const mysqlBin = process.env.MYSQL_BIN || 'mysql';
const root = process.cwd();
const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = process.env.MYSQL_PORT || '13306';
const user = process.env.MYSQL_ADMIN_USER || 'root';
const password = process.env.MYSQL_ROOT_PASSWORD || 'root-local-only';

function args() {
  return [
    '--protocol=TCP', '--host', host, '--port', String(port), '--user', user,
    '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw',
  ];
}

// This is a repeatable local fixture, not a production catalog migration. It
// gives the authenticated learner a server-owned product to read and order.
const sql = `
INSERT INTO commerce_service.commerce_sku
  (tenant_id, sku_id, version, title, entitlement_code, currency, amount_minor, status, effective_from, created_at)
VALUES
  ('platform', 'phase1-foundations', 1, 'Phase 1 Foundations', 'LEARNER_PHASE1', 'CNY', 9900, 'ACTIVE', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  entitlement_code = VALUES(entitlement_code),
  currency = VALUES(currency),
  amount_minor = VALUES(amount_minor),
  status = VALUES(status),
  effective_from = VALUES(effective_from);
SELECT COUNT(*) FROM commerce_service.commerce_sku WHERE tenant_id = 'platform' AND status = 'ACTIVE';
`;

const output = runMysql({ mysqlBin, mysqlArgs: args(), password, cwd: root, input: `${sql.trim()}\n` });
const activeCount = Number(output.split(/\r?\n/).filter(Boolean).at(-1));
if (!Number.isFinite(activeCount) || activeCount < 1) throw new Error('local commerce fixture was not persisted');
console.log(`local commerce fixture ready: ${activeCount} active SKU(s)`);
