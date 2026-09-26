import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildFixtureSql } from '../../scripts/database/local-real-10x-fixture.mjs';

test('local 10x support tickets stay in a fixture tenant without cross-tenant audit pointers', () => {
  const sql = buildFixtureSql();
  const supportInsert = sql.match(/INSERT INTO admin_ops_service\.support_ticket[\s\S]*?;/)?.[0];
  assert.ok(supportInsert, 'support ticket insert is generated');
  assert.equal((supportInsert.match(/'local-support-fixture'/g) ?? []).length, 10);
  assert.doesNotMatch(supportInsert, /'platform'/);
  assert.doesNotMatch(supportInsert, /'local-10x-admin-audit-/);
});

test('admin and manual demo support seeds cannot repopulate platform tickets', () => {
  const admin = readFileSync('scripts/database/seed-local-real-admin-analytics.mjs', 'utf8');
  const demo = readFileSync('scripts/database/seed-demo-manual.mjs', 'utf8');
  assert.match(admin, /\('ticket-local-001', 'local-support-fixture', 'local-fixture'/);
  const start = demo.indexOf('mysql(`DELETE FROM admin_ops_service.support_ticket');
  const end = demo.indexOf('mysql(`DELETE FROM gamification_service', start);
  assert.ok(start >= 0 && end > start, 'manual support seed section exists');
  const supportSection = demo.slice(start, end);
  assert.match(supportSection, /'local-support-fixture', \$\{Q\(SUB\)\}/);
  assert.doesNotMatch(supportSection, /'platform'/);
});
