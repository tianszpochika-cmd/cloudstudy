import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(read(relativePath));

const b5TaskIds = [
  'DEV-09-011',
  ...Array.from({ length: 10 }, (_, index) => `DEV-10-${String(index + 1).padStart(3, '0')}`),
  ...Array.from({ length: 10 }, (_, index) => `DEV-11-${String(index + 1).padStart(3, '0')}`),
  'DEV-12-002',
];

test('B5 backlog is the expected 22-task code-development slice', () => {
  const backlog = read('requirements/backlog/开发实施总纲与功能链条任务分解.md');
  for (const taskId of b5TaskIds) assert.match(backlog, new RegExp(`^\\| ${taskId} \\|.*\\| B5 \\|`, 'm'), `missing B5 task ${taskId}`);
  assert.equal(b5TaskIds.length, 22);
});

test('B5 historical compatibility fragment is kept out of the active v2 contract', () => {
  const b5Fragment = readJson('packages/contracts/fragments/b5-commerce-admin.openapi.json');
  const openapi = readJson('packages/contracts/openapi/v1/openapi.json');
  assert.equal(b5Fragment['x-contract-status'], 'historical-compatibility');
  assert.equal(b5Fragment['x-canonical-owner'], 'b13');
  for (const route of [
    '/api/v1/commerce/skus',
    '/api/v1/commerce/orders',
    '/api/v1/commerce/orders/{orderId}/payment-intents',
    '/api/v1/commerce/wechat/callback',
    '/api/v1/commerce/alipay/notify',
    '/api/v1/commerce/apple/transactions/verify',
    '/api/v1/commerce/entitlements/me',
    '/api/v1/commerce/activation-codes/redeem',
    '/api/v1/support/tickets',
  ]) assert.ok(openapi.paths[route], `missing B5 route ${route}`);
  for (const retiredRoute of [
    '/api/v1/admin/content',
    '/api/v1/admin/reviews/{reviewTaskId}/decision',
    '/api/v1/admin/dashboard/metrics',
    '/api/v1/admin/reconciliation/batches',
    '/api/v1/admin/feature-flags/{flagKey}',
    '/api/v1/admin/audit-logs/export',
  ]) assert.equal(openapi.paths[retiredRoute], undefined, `legacy B5 route leaked into canonical contract: ${retiredRoute}`);
  // B5's learner commerce fragment is retained for compatibility input, while
  // B13 owns the active commerce/admin-ops routes in the canonical document.
  assert.equal(b5Fragment.paths['/api/v1/commerce/orders'].post.operationId, 'createCommerceOrder');
  assert.equal(openapi.paths['/api/v1/commerce/orders'].get.operationId, 'listB13CommerceOrders');
  assert.equal(openapi.paths['/api/v1/commerce/orders'].post.operationId, 'createB13CommerceOrder');
  assert.equal(openapi.paths['/api/v1/admin/ops/metrics'].get.operationId, 'listB13AdminMetrics');
  for (const schema of ['B5ContentDraftRequest', 'B5ContentSaveRequest', 'B5ReviewDecisionRequest', 'B5ImportJobRequest', 'B5FlagUpdateRequest', 'B5OrderAdjustmentRequest']) {
    assert.equal(openapi.components.schemas[schema], undefined, `historical B5 schema leaked into canonical contract: ${schema}`);
  }
  assert.equal(openapi.tags.some((tag) => tag.name === 'b5-admin-content' || tag.name === 'b5-admin-operations'), false);
});

test('B5 event catalog and migration retain payment, CMS, risk and reconciliation facts', () => {
  const catalog = readJson('packages/contracts/events/v1/catalog.json');
  const eventNames = new Set(catalog.events.map((event) => event.eventName));
  for (const eventName of [
    'commerce.order.created.v1',
    'commerce.payment.callback_received.v1',
    'commerce.refund.completed.v1',
    'cms.import.completed.v1',
    'safety.precheck.blocked.v1',
    'risk.decision.created.v1',
    'finance.reconciliation.discrepancy.v1',
    'ops.flag.updated.v1',
    'support.ticket.created.v1',
  ]) assert.ok(eventNames.has(eventName), `missing B5 event ${eventName}`);

  const migration = read('database/mysql/migrations/V0014__create_commerce_cms_operations_b5.sql');
  for (const table of ['com_order', 'com_payment_callback', 'com_entitlement', 'com_activation_code', 'com_reconciliation_item', 'cms_content', 'cms_content_version', 'cms_review_task', 'cms_sensitive_hit', 'cms_correction_ticket', 'ops_user_risk', 'ops_feature_flag', 'ops_audit_log']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
});

test('B5 payment and admin boundaries are fail-closed and frontend pages exist', () => {
  const commerceService = read('services/core-api/src/main/java/com/englishflow/modules/commerce/b5/B5CommerceService.java');
  assert.match(commerceService, /paymentChannelsEnabled\", false/);
  assert.match(commerceService, /APPLE_PRODUCTION_DISABLED/);
  assert.match(commerceService, /PAYMENT_AMOUNT_MISMATCH/);
  assert.match(commerceService, /PAYMENT_SIGNATURE_INVALID/);
  const adminService = read('services/core-api/src/main/java/com/englishflow/modules/admin/b5/B5AdminService.java');
  assert.match(adminService, /REVIEW_ROLE_CONFLICT/);
  assert.match(adminService, /SENSITIVE_CONTENT_BLOCKED/);
  assert.match(adminService, /defaultOff/);
  for (const file of [
    'apps/learner-web/src/pages/B5CommercePage.vue',
    'apps/mobile/src/pages/b5-commerce/b5-commerce.vue',
    'apps/admin-web/src/App.vue',
    'apps/admin-web/src/views/AdminContentView.vue',
    'apps/admin-web/src/views/AdminDashboardView.vue',
    'apps/admin-web/src/views/AdminAuditView.vue',
  ]) assert.ok(fs.existsSync(path.join(root, file)), `missing B5 frontend file ${file}`);
});
