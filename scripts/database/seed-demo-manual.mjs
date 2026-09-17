// Demo seed for human manual testing: one login account with 10-20 lifelike
// rows per learner-visible feature. Local MySQL only (guarded).
// Credentials: demo@local.invalid / DemoLocal123!xQ
import { execFileSync } from 'node:child_process';
import { createHash, createHmac, randomUUID } from 'node:crypto';

const GW = 'http://127.0.0.1:18070';
const CM = 'http://127.0.0.1:18096';
const IAM = 'http://127.0.0.1:18087';
const SECRET = 'change-me-in-test-only';
const IDENTIFIER = 'demo@local.invalid';
const PASSWORD = 'DemoLocal123!xQ';
const DEVICE = { deviceType: 'WEB', clientVersion: 'demo-seed-1', deviceName: 'demo-seed' };
const stamp = Date.now().toString(36);
let idemN = 0;
const idem = (s) => `demo-seed-${stamp}-${++idemN}-${s}`.slice(0, 60);
async function call(base, method, path, { token, body, idemKey } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idemKey) headers['idempotency-key'] = idemKey;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
const data = (r) => r.json?.data ?? r.json ?? {};
function mysql(q) {
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', q], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
}
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const NOW = 'UTC_TIMESTAMP(6)';

// ---- 1. demo account (idempotent: reuse if already registered) ----
let r = await call(GW, 'POST', '/api/v1/auth/register', { body: { identifier: IDENTIFIER, password: PASSWORD, device: DEVICE }, idemKey: idem('reg') });
let token = r.json?.data?.accessToken ?? null;
if (!token) {
  r = await call(GW, 'POST', '/api/v1/auth/login', { body: { identifier: IDENTIFIER, password: PASSWORD, device: DEVICE }, idemKey: idem('login0') });
  token = r.json?.data?.accessToken ?? null;
}
await call(GW, 'POST', '/api/v1/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem('gate') });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await call(GW, 'PUT', '/api/v1/iam/consents', { token, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`c-${t}`) });
}
r = await call(GW, 'POST', '/api/v1/auth/login', { body: { identifier: IDENTIFIER, password: PASSWORD, device: DEVICE }, idemKey: idem('login') });
token = r.json?.data?.accessToken ?? null;
const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
const SUB = claims.sub;
console.log('demo subject:', SUB);
if (!SUB) { console.error('no subject; abort'); process.exit(1); }

// ---- 2. learner target ----
await call(GW, 'PUT', '/api/v1/learner/targets', { token, body: { expectedStateVersion: 0, goalCode: 'CET_4_6', targetLevel: 'B1', dailyQuotaMinutes: 45 }, idemKey: idem('tgt') });

// ---- 3. placement history via API (correct + wrong mix) ----
for (const [tag, keys] of [['pa', ['A', 'A']], ['pb', ['B', 'B']]]) {
  const s = await call(GW, 'POST', '/api/v1/assessment/placement/start', { token, body: { contentCode: 'course-b25-basics' }, idemKey: idem(`${tag}-start`) });
  const sid = data(s).sessionId ?? data(s).session?.sessionId ?? null;
  if (!sid) continue;
  for (const [i, qid] of ['b25-item-001', 'b25-item-002'].entries()) {
    await call(GW, 'POST', '/api/v1/assessment/placement/submit-step', { token, body: { sessionId: sid, questionId: qid, selectedKey: keys[i] }, idemKey: idem(`${tag}-ans-${i}`) });
  }
}

// ---- 4. commerce via API: orders in every state + activation redeem ----
const orderIds = [];
for (let i = 1; i <= 3; i++) {
  const o = await call(GW, 'POST', '/api/v1/commerce/orders', { token, body: { skuId: `local-10x-sku-0${i}` }, idemKey: idem(`order-${i}`) });
  if (data(o).orderId) orderIds.push(data(o).orderId);
}
let paidOrder = null, refundedOrder = null;
if (orderIds[0]) {
  await call(GW, 'POST', `/api/v1/commerce/orders/${orderIds[0]}/payment-intents`, { token, body: { provider: 'SANDBOX' }, idemKey: idem('pay-0') });
}
const svc = data(await call(IAM, 'POST', '/internal/v1/iam/service-token', { body: { clientId: 'api-gateway', clientSecret: 'local-gateway-service-secret' } })).accessToken ?? null;
const sign = (p) => 'sha256=' + createHmac('sha256', SECRET).update(p, 'utf8').digest('hex');
async function payCallback(orderId, tag) {
  const snap = mysql(`SELECT amount_minor, currency FROM commerce_service.commerce_order WHERE order_id = '${orderId}'`).split(/\s+/);
  const ev = `demo-${stamp}-${tag}`;
  const payload = `${ev}|${orderId}|${snap[0]}|${snap[1]}|SUCCESS`;
  return call(CM, 'POST', '/internal/v1/commerce/providers/SANDBOX/callbacks', { token: svc, body: { providerEventId: ev, orderId, amountMinor: Number(snap[0]), currency: snap[1], payload, signature: sign(payload), resultCode: 'SUCCESS' }, idemKey: idem(`cb-${tag}`) });
}
if (orderIds[1]) {
  await call(GW, 'POST', `/api/v1/commerce/orders/${orderIds[1]}/payment-intents`, { token, body: { provider: 'SANDBOX' }, idemKey: idem('pay-1') });
  const c = await payCallback(orderIds[1], 'paid');
  if ([200, 201].includes(c.status)) paidOrder = orderIds[1];
}
if (orderIds[2]) {
  await call(GW, 'POST', `/api/v1/commerce/orders/${orderIds[2]}/payment-intents`, { token, body: { provider: 'SANDBOX' }, idemKey: idem('pay-2') });
  await payCallback(orderIds[2], 'topay');
  const f = await call(GW, 'POST', `/api/v1/commerce/orders/${orderIds[2]}/refunds`, { token, body: { reasonCode: 'E2E_TEST' }, idemKey: idem('refund-2') });
  const refundId = data(f).refundId ?? data(f).id ?? null;
  if (refundId) {
    const snap = mysql(`SELECT amount_minor, currency FROM commerce_service.commerce_order WHERE order_id = '${orderIds[2]}'`).split(/\s+/);
    const ev = `demo-${stamp}-rfd`;
    const payload = `${ev}|${refundId}|${snap[0]}|${snap[1]}|SUCCESS`;
    await call(CM, 'POST', '/internal/v1/commerce/refunds/callbacks', { token: svc, body: { providerEventId: ev, refundId, provider: 'SANDBOX', amountMinor: Number(snap[0]), currency: snap[1], payload, signature: sign(payload), resultCode: 'SUCCESS' }, idemKey: idem('cb-rfd') });
    refundedOrder = orderIds[2];
  }
}
console.log('orders:', orderIds.length, 'paid:', paidOrder, 'refunded:', refundedOrder);

// ---- 5. social via API: join rooms + focus ----
{
  const rooms = data(await call(GW, 'GET', '/api/v1/social/rooms', { token })).items ?? [];
  let n = 0;
  for (const room of rooms.slice(0, 4)) {
    const j = await call(GW, 'POST', `/api/v1/social/rooms/${room.roomId}/join`, { token, body: {}, idemKey: idem(`join-${n}`) });
    if ([200, 201].includes(j.status)) {
      n++;
      await call(GW, 'POST', `/api/v1/social/rooms/${room.roomId}/focus`, { token, body: { durationMinutes: 25, focusTagCode: 'VOCABULARY' }, idemKey: idem(`focus-${n}`) });
    }
  }
  console.log('rooms joined:', n);
}

// ---- 6. DB seeds (owner-scoped, idempotent-ish via DELETE+INSERT per subject) ----
const Q = (s) => `'${String(s).replaceAll("'", "''")}'`;
mysql(`DELETE FROM assessment_service.assessment_mistake WHERE subject_id = '${SUB}'`);
{
  const cats = ['GRAMMAR_TENSE', 'VOCAB_MEANING', 'LISTENING_DETAIL', 'READING_INFERENCE', 'WRITING_COLLOCATION'];
  const mst = ['PENDING_RETRY', 'PENDING_RETRY', 'DELAY_VERIFY_D1', 'DELAY_VERIFY_D7', 'MASTERED'];
  const msv = ['NEW', 'LEARNING', 'LEARNING', 'MASTERED', 'CONSOLIDATED'];
  const vals = [];
  for (let i = 0; i < 15; i++) {
    const k = i % 5;
    vals.push(`(${9100 + i}, ${Q(SUB)}, 'platform', ${8100 + i}, ${7100 + i}, ${Q(cats[k])}, 'v1', '${sha256('demo-mistake-' + i)}', ${(i % 4) + 1}, ${Q(mst[k])}, ${Q(msv[k])}, DATE_SUB(${NOW}, INTERVAL ${20 - i} DAY), DATE_SUB(${NOW}, INTERVAL ${i} HOUR), DATE_ADD(${NOW}, INTERVAL ${i + 1} DAY), '{}')`);
  }
  mysql(`INSERT INTO assessment_service.assessment_mistake (mistake_id, subject_id, tenant_id, item_id, question_id, error_category, rule_version, answer_hash, wrong_count, mistake_status, mastery_status, first_error_at, last_error_at, next_action_at, reason_trace_json) VALUES ${vals.join(',')}`);
  console.log('mistakes: 15');
}
mysql(`DELETE FROM learning_service.learning_runtime_mastery_projection WHERE principal_id = '${SUB}'`);
// NOTE: learning_runtime_* tables need a numeric user_id that no web JWT
// carries, so they are event-populated only; the web reads b25_* tables.
mysql(`DELETE FROM learning_service.b25_learning_plan WHERE principal_id = '${SUB}'; DELETE FROM learning_service.b25_learning_review WHERE principal_id = '${SUB}'; DELETE FROM learning_service.b25_learning_continue_context WHERE principal_id = '${SUB}'`);
{
  // one plan per owner (unique key on tenant+principal).
  mysql(`INSERT INTO learning_service.b25_learning_plan (plan_id, principal_id, tenant_id, status, target_minutes, plan_version, updated_at) VALUES ('${randomUUID()}', '${SUB}', 'platform', 'ACTIVE', 45, 3, ${NOW})`);
  const rvals = [];
  for (let i = 0; i < 12; i++) {
    rvals.push(`('${randomUUID()}', '${SUB}', 'platform', 'srs-item-${(i % 10) + 1}', ${(i % 5) + 1}, 'demo-key-${stamp}-${i}', DATE_SUB(${NOW}, INTERVAL ${i * 5} HOUR))`);
  }
  mysql(`INSERT INTO learning_service.b25_learning_review (review_id, principal_id, tenant_id, item_id, quality, idempotency_key, created_at) VALUES ${rvals.join(',')}`);
  mysql(`INSERT INTO learning_service.b25_learning_continue_context (tenant_id, principal_id, module_id, module_label, lesson_id, lesson_title, step_index, total_steps, elapsed_time_ms, status, last_idempotency_key, updated_at) VALUES ('platform', '${SUB}', 'mod-cet4-core', '四级核心词汇', 'les-cet4-001', '高频 100 词（上）', 37, 60, 452000, 'ACTIVE', 'demo-key-${stamp}-ctx', ${NOW})`);
  console.log('plan: 2, reviews: 12, continue: 1');
}
mysql(`DELETE FROM notification_service.notification_message WHERE subject_id = '${SUB}'; DELETE FROM notification_service.b25_notification_message WHERE principal_id = '${SUB}'`);
{
  const titles = ['每日学习提醒', '错题 D1 验证到期', '订单支付成功', '退款已到账', '自习室有人为你加油', '连续学习 7 天成就', '新内容已发布', '每周学习报告'];
  const vals = [];
  for (let i = 0; i < 12; i++) {
    vals.push(`('demo-msg-${stamp}-${i}', ${Q(SUB)}, 'platform', 'demo.template', ${i < 7 ? Q('SENT') : Q('READ')}, ${Q('k' + stamp + i)}, DATE_SUB(${NOW}, INTERVAL ${i * 3} HOUR), 'general', 'IN_APP', 'v1', ${Q(titles[i % 8])}, ${Q('这是第 ' + (i + 1) + ' 条演示消息正文，用于人工浏览验证。')}, 'v1', 'zh-CN', '{}', DATE_SUB(${NOW}, INTERVAL ${i * 3} HOUR), 0, 1)`);
  }
  mysql(`INSERT INTO notification_service.notification_message (notification_id, subject_id, tenant_id, template_key, notification_status, idempotency_key, created_at, notification_type, channel, template_version, title, safe_body, content_version, locale, structured_attributes_json, not_before, template_only, message_version) VALUES ${vals.join(',')}`);
  const bvals = [];
  for (let i = 0; i < 8; i++) {
    bvals.push(`('demo-bmsg-${stamp}-${i}', ${Q(SUB)}, 'platform', 'demo.template', ${i < 5 ? Q('UNREAD') : Q('READ')}, ${NOW})`);
  }
  mysql(`INSERT INTO notification_service.b25_notification_message (message_id, principal_id, tenant_id, template_code, status, created_at) VALUES ${bvals.join(',')}`);
  console.log('messages: 12 + 8');
}
mysql(`DELETE FROM admin_ops_service.support_ticket WHERE requester_subject = '${SUB}'`);
{
  const cats = ['TECHNICAL', 'CONTENT_CORRECTION', 'BILLING', 'ACCOUNT_ACCESS'];
  const sts = ['OPEN', 'OPEN', 'ACKNOWLEDGED', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];
  const vals = [];
  for (let i = 0; i < 8; i++) {
    vals.push(`('${randomUUID()}', 'platform', ${Q(SUB)}, ${Q(sts[i % 6])}, ${i % 2 ? Q('HIGH') : Q('NORMAL')}, ${Q('演示工单 ' + (i + 1) + '：人工测试用，' + cats[i % 4])}, ${NOW}, ${NOW}, ${Q(cats[i % 4])}, 'local-fixture', '${sha256('demo-ticket-' + stamp + i)}', '[]')`);
  }
  mysql(`INSERT INTO admin_ops_service.support_ticket (ticket_id, tenant_id, requester_subject, ticket_status, priority, redacted_summary, created_at, updated_at, category, resource_ref, description_fingerprint, attachments_json) VALUES ${vals.join(',')}`);
  console.log('tickets: 8');
}
mysql(`DELETE FROM gamification_service.xp_ledger WHERE subject_id = '${SUB}'; DELETE FROM gamification_service.coin_ledger WHERE subject_id = '${SUB}'`);
{
  let bal = 0;
  const xvals = [];
  for (let i = 0; i < 10; i++) {
    bal += 10 + i * 2;
    xvals.push(`('${randomUUID()}', ${Q(SUB)}, 'platform', '${randomUUID()}', ${10 + i * 2}, ${bal}, ${NOW})`);
  }
  mysql(`INSERT INTO gamification_service.xp_ledger (ledger_id, subject_id, tenant_id, source_event_id, delta, balance_after, created_at) VALUES ${xvals.join(',')}`);
  console.log('xp: 10, balance:', bal);
}
mysql(`DELETE FROM learning_service.b25_learning_srs_state WHERE principal_id = '${SUB}'`);
{
  const stages = ['NEW', 'LEARNING', 'REVIEW', 'REVIEW', 'MASTERED'];
  const vals = [];
  for (let i = 0; i < 10; i++) {
    vals.push(`(${Q(SUB)}, ${Q('srs-item-' + (i + 1))}, 'platform', ${Q(stages[i % 5])}, DATE_ADD(${NOW}, INTERVAL ${i - 3} DAY), ${i % 4}, 2.50, ${i * 2}, ${Q('k' + stamp + i)}, ${NOW})`);
  }
  mysql(`INSERT INTO learning_service.b25_learning_srs_state (principal_id, item_id, tenant_id, stage, due_at, interval_days, ease_factor, review_count, last_idempotency_key, updated_at) VALUES ${vals.join(',')}`);
  console.log('srs: 10');
}
mysql(`DELETE FROM learning_service.b3_learning_interaction WHERE principal_id = '${SUB}'`);
{
  const domains = ['VOCABULARY', 'GRAMMAR', 'LISTENING', 'READING'];
  const vals = [];
  for (let i = 0; i < 12; i++) {
    const correct = i % 3 === 2;
    const result = { correct, feedbackCode: correct ? 'CORRECT' : 'RETRY', message: correct ? '答对了' : '再想想', errorCategory: correct ? '' : 'RULE_RETRY', mistakeStatus: correct ? 'CLOSED' : 'OPEN' };
    vals.push(`('${randomUUID()}', 'platform', '${SUB}', '${domains[i % 4]}', 'ANSWER', 'item-${5000 + i}', 'demo-key-${stamp}-bi${i}', '{}', '${JSON.stringify(result)}', 'ACCEPTED', DATE_SUB(${NOW}, INTERVAL ${i * 7} HOUR), ${NOW})`);
  }
  mysql(`INSERT INTO learning_service.b3_learning_interaction (interaction_id, tenant_id, principal_id, domain_code, action_code, resource_key, idempotency_key, payload_json, result_json, status, created_at, updated_at) VALUES ${vals.join(',')}`);
  console.log('interactions: 12 (8 wrong for queue)');
}
console.log('DEMO SEED DONE. login:', IDENTIFIER);
