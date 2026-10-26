import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// Static-demo model and VM checks: no browser, network requests, or real storage writes.
const modelPath = new URL('../docs/06-design/v2-980plus/redesign/mockups/admin/model.js', import.meta.url);
const context = vm.createContext({ Date, JSON });
vm.runInContext(fs.readFileSync(modelPath, 'utf8') + '\nthis.model = AdminModel;', context, { filename: 'admin/model.js' });
const M = context.model;
const appPath = new URL('../docs/06-design/v2-980plus/redesign/mockups/admin/app.js', import.meta.url);
const appSource = fs.readFileSync(appPath, 'utf8');
const seedEnd = appSource.indexOf('\nconst M =');
assert.ok(seedEnd > 0, 'the app must expose its sample seed before model setup');
vm.runInContext(appSource.slice(0, seedEnd) + '\nthis.actualSeed = ASEED;', context);
const actualSeed = context.actualSeed;
function uiFixture({ route = '#/media', account } = {}) {
  const nodes = new Map(), children = new Set(), timers = new Map(), intervals = new Map(), storage = new Map(), events = new Map();
  let timerId = 0, storageFails = false, storageWrites = 0, clock = Date.UTC(2026, 0, 1);
  class FixtureDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const decode = value => value.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  function makeNode(id) {
    let html = '';
    const node = { value: '', textContent: '', scrollTop: 0, selectionStart: 0, dataset: {}, style: {},
      classList: { add() {}, remove() {}, toggle() {} }, focus() {}, setSelectionRange() {} };
    // Minimal form stubs use the evaluated HTML to retain the actual input value.
    // This supports source wiring assertions; it does not simulate browser behavior.
    Object.defineProperty(node, 'innerHTML', { get: () => html, set: value => {
      html = value;
      if (id !== 'view') return;
      for (const child of children) nodes.delete(child);
      children.clear();
      for (const match of value.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        const [full, tag, attrs, childId] = match, child = makeNode(childId);
        const input = attrs.match(/\bvalue="([^"]*)"/);
        if (input) child.value = decode(input[1]);
        if (tag === 'textarea') {
          const start = match.index + full.length, end = value.indexOf('</textarea>', start);
          child.value = decode(value.slice(start, end));
        }
        nodes.set(childId, child); children.add(childId);
      }
    }});
    return node;
  }
  for (const id of ['view', 'title', 'bk', 'tabs', 'toast']) nodes.set(id, makeNode(id));
  const node = id => nodes.get(id) || null;
  const c = vm.createContext({
    Date: FixtureDate, JSON, document: { getElementById: node, querySelectorAll: () => [] },
    location: { hash: route }, window: { addEventListener(type, fn) { if (!events.has(type)) events.set(type, []); events.get(type).push(fn); } },
    localStorage: { getItem: key => storage.get(key) || null, setItem(key, value) {
      storageWrites++; if (storageFails) throw new Error('injected VM storage failure'); storage.set(key, value);
    } },
    setTimeout(fn, delay) { timers.set(++timerId, { fn, delay }); return timerId; }, clearTimeout: id => timers.delete(id),
    setInterval(fn, delay) { intervals.set(++timerId, { fn, delay }); return timerId; }, clearInterval: id => intervals.delete(id),
  });
  vm.runInContext(fs.readFileSync(modelPath, 'utf8'), c);
  vm.runInContext(appSource, c);
  const run = code => vm.runInContext(code, c);
  if (account) run('M.identity(A,' + JSON.stringify(account) + '); arender();');
  return {
    run, node, html: () => node('view').innerHTML,
    event: (type, value) => { for (const fn of events.get(type) || []) fn(value); },
    failWrites: value => { storageFails = value; }, writes: () => storageWrites,
    persistedRaw: () => storage.get('yxx-admin-v1') || null,
    persisted: () => JSON.parse(storage.get('yxx-admin-v1') || 'null'),
    advance: ms => { clock += ms; },
    interval: (delay = 500) => { for (const timer of intervals.values()) if (timer.delay === delay) timer.fn(); },
    fire: delay => {
      for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.fn(); }
    },
    remote: expression => {
      const newValue = run('(()=>{const remote=JSON.parse(JSON.stringify(A));' + expression + ';return JSON.stringify({v:2,A:remote});})()');
      // Represent the other window's completed write before delivering its event.
      storage.set('yxx-admin-v1', newValue);
      for (const fn of events.get('storage') || []) fn({ key: 'yxx-admin-v1', newValue });
    },
  };
}
const copy = value => JSON.parse(JSON.stringify(value));
const seed = () => ({
  user: '教研-小李', role: 'reviewer-l1', mode: 'simple', seq: 1000, cur: 'd1',
  drafts: [
    { id: 'd1', title: '待审课', v: 1, st: 'draft', copy: false, report: false, mediaNeed: 1, mediaHave: 0, updated: '样例', l1by: '', l2by: '' },
    { id: 'd2', title: '已发布课', v: 2, st: 'active', copy: true, report: true, mediaNeed: 1, mediaHave: 1, updated: '样例', l1by: '王芳', l2by: '赵磊' },
    { id: 'd3', title: '已下架课', v: 1, st: 'off', copy: true, report: true, mediaNeed: 0, mediaHave: 0, updated: '样例', l1by: '王芳', l2by: '赵磊' },
  ],
  tickets: [
    { id: 'hash', st: '待接单', body: 'hash-only · 信息不足', cat: '学习' },
    { id: 'body', st: '待接单', body: '用户主动提交的演示问题', cat: '学习' },
  ],
  refunds: [{ id: 'rf1', st: '待第二审批', firstBy: '张三', ok1: '张三 样例时间', ok2: '', inv: '未申请', applicant: '学习者-样例' }],
  gov: [{ id: 'risk1', st: '待建档' }], audit: [], orders: [], reports: [], media: [],
});
const fresh = () => M.normalize(seed());
const draft = (a, id = 'd1') => M.draft(a, id);
const denied = (fn, expected) => assert.throws(fn, expected);
function dualReady() {
  const a = fresh(); M.mode(a); M.submit(a, 'd1'); return a;
}
function publishSimple() {
  const a = fresh(); M.submit(a, 'd1'); M.approve(a, 'd1', 'simple'); return a;
}

test('fresh samples have explicit qualified snapshots and separate working drafts', () => {
  const a = fresh(), d = draft(a, 'd2'), live = M.live(d);
  assert.equal(live.v, 2); assert.equal(live.sample, true); assert.equal(M.qualified(live), true);
  assert.equal(d.st, 'draft'); assert.equal(d.reportStamp, null); assert.equal(Object.keys(d.approvals).length, 0);
});
test('legacy cached names and booleans do not become valid signatures', () => {
  const old = seed(), a = M.normalize(seed(), old), d = draft(a, 'd2');
  assert.equal(d.legacyState, 'active'); assert.equal(d.legacyEvidence.l1by, '王芳');
  assert.equal(d.snapshots.length, 0); assert.equal(M.live(d), undefined);
  assert.equal(d.st, 'draft'); assert.equal(d.reportStamp, null); assert.equal(Object.keys(d.approvals).length, 0);
});
test('only listed identities are selectable', () => {
  const a = fresh(); M.identity(a, 'liucai'); assert.equal(a.user, '财务-刘敏'); assert.equal(a.role, 'finance');
  const before = copy(a); denied(() => M.identity(a, 'unlisted'), /账号或密码/); assert.deepEqual(copy(a), before);
});
test('unknown or forged identity-role combinations have no grant', () => {
  const a = fresh(); a.user = '陌生人'; assert.equal(M.can(a, 'content.read'), false);
  a.user = '教研-小李'; a.role = 'admin'; assert.equal(M.can(a, 'refund'), false);
  a.user = null; assert.equal(M.can(a, 'content.read'), false);
});
test('reviewer routes cannot reach finance or support actions', () => {
  const a = fresh(); assert.equal(M.page(a, 'review'), true); assert.equal(M.page(a, 'refund'), false); assert.equal(M.page(a, 'csdetail'), false);
  denied(() => M.refund(a, 'rf1'), /无此权限/); denied(() => M.ticketAction(a, 'body', 'claim'), /无此权限/);
});
test('finance and admin roles cannot create or approve content', () => {
  for (const account of ['liucai', 'chenchen']) {
    const a = fresh(); M.identity(a, account); assert.equal(M.page(a, 'review'), false);
    denied(() => M.create(a), /无此权限/); denied(() => M.approve(a, 'd1', 'simple'), /无此权限/);
  }
});
test('creating drafts preserves stable author and unique identifiers', () => {
  const a = fresh(), id1 = M.create(a), id2 = M.create(a);
  assert.notEqual(id1, id2); assert.equal(draft(a, id1).createdBy, a.user); assert.equal(draft(a, id1).submittedBy, a.user);
  assert.equal(draft(a, id1).v, 1); assert.equal(draft(a, id1).st, 'draft'); assert.equal(draft(a, id1).snapshots.length, 0);
});
test('edit invalidates work signatures but preserves the live snapshot', () => {
  const a = fresh(), d = draft(a, 'd2'), oldLive = copy(M.live(d));
  M.edit(a, 'd2', '新标题', 2);
  assert.equal(d.v, 3); assert.equal(d.st, 'draft'); assert.equal(d.reportStamp, null); assert.equal(Object.keys(d.approvals).length, 0);
  assert.deepEqual(copy(M.live(d)), oldLive); assert.equal(M.live(d).title, '已发布课');
});
test('version conflicts and empty or unchanged titles preserve work', () => {
  const a = fresh(), before = copy(draft(a));
  denied(() => M.edit(a, 'd1', '别人的新标题', 0), /版本已变化/);
  denied(() => M.edit(a, 'd1', '  ', 1), /不能为空/); denied(() => M.edit(a, 'd1', '待审课', 1), /未变化/);
  assert.deepEqual(copy(draft(a)), before);
});
test('mode switches invalidate working reports while keeping released copies', () => {
  const a = fresh(); M.submit(a, 'd1'); const published = copy(M.live(draft(a, 'd2')));
  M.mode(a); assert.equal(a.mode, 'dual'); assert.equal(draft(a).reportStamp, null); assert.equal(draft(a).st, 'draft');
  assert.deepEqual(copy(M.live(draft(a, 'd2'))), published);
});
test('explicit sample submission binds report to current version and mode', () => {
  const a = fresh(); assert.equal(M.missing(a, draft(a)).length, 3);
  denied(() => M.approve(a, 'd1', 'simple'), /缺项/); M.submit(a, 'd1');
  assert.equal(M.missing(a, draft(a)).length, 0); assert.equal(draft(a).reportStamp.version, 1);
  assert.equal(draft(a).reportStamp.mode, 'simple'); assert.equal(draft(a).reportStamp.sample, true); assert.equal(draft(a).st, 'review');
});
test('simple review permits the authorized applicant and releases once', () => {
  const a = publishSimple(), d = draft(a); assert.equal(M.live(d).submittedBy, a.user); assert.equal(M.qualified(M.live(d)), true);
  const before = copy(d); denied(() => M.approve(a, 'd1', 'simple'), /发布快照/); assert.deepEqual(copy(d), before);
});
test('same-version republishing failure preserves the prior live release and signatures', () => {
  const a = fresh(), before = copy(draft(a, 'd2'));
  denied(() => M.submit(a, 'd2'), /版本不能重复|保存新版本/);
  denied(() => M.approve(a, 'd2', 'simple'), /发布快照|版本已发布|保存新版本|重复/);
  assert.deepEqual(copy(draft(a, 'd2')), before); assert.equal(M.live(draft(a, 'd2')).v, 2);
});
test('dual applicant cannot approve its own L1', () => {
  const a = dualReady(), before = copy(draft(a));
  denied(() => M.approve(a, 'd1', 'l1'), /申请人/); assert.deepEqual(copy(draft(a)), before);
});
test('reviewer-l1 cannot perform L2 even when another person approved L1', () => {
  const a = dualReady(); M.identity(a, 'wangfang'); M.approve(a, 'd1', 'l1'); M.identity(a, 'teach-li');
  denied(() => M.approve(a, 'd1', 'l2'), /无此权限/); assert.equal(M.live(draft(a)), undefined);
});
test('reviewer-l2 cannot perform L1 or publish before L1', () => {
  const a = dualReady(); M.identity(a, 'zhaolei'); denied(() => M.approve(a, 'd1', 'l1'), /无此权限/);
  denied(() => M.approve(a, 'd1', 'l2'), /先由 L1/); assert.equal(M.live(draft(a)), undefined);
});
test('dual applicant cannot perform L2 with an otherwise matching report', () => {
  const a = dualReady(); M.identity(a, 'wangfang'); M.approve(a, 'd1', 'l1');
  // Fixture for a version submitted by an L2 identity, e.g. an imported review.
  draft(a).submittedBy = '赵磊'; M.identity(a, 'zhaolei'); denied(() => M.approve(a, 'd1', 'l2'), /申请人/);
});
test('three distinct identities complete dual review with version-bound evidence', () => {
  const a = dualReady(); M.identity(a, 'wangfang'); M.approve(a, 'd1', 'l1'); M.identity(a, 'zhaolei'); M.approve(a, 'd1', 'l2');
  const s = M.live(draft(a)); assert.equal(M.qualified(s), true); assert.equal(s.approvals.l1.who, '王芳'); assert.equal(s.approvals.l2.who, '赵磊');
  assert.equal(s.submittedBy, '教研-小李'); assert.equal(s.approvals.l1.version, s.v); assert.equal(s.approvals.l2.version, s.v);
  const before = copy(draft(a)); denied(() => M.approve(a, 'd1', 'l2'), /发布快照/); assert.deepEqual(copy(draft(a)), before);
});
test('editing approved L1 invalidates both report and sign-off', () => {
  const a = dualReady(); M.identity(a, 'wangfang'); M.approve(a, 'd1', 'l1'); M.identity(a, 'teach-li'); M.edit(a, 'd1', 'v2 标题', 1);
  assert.equal(draft(a).v, 2); assert.equal(draft(a).l1by, ''); assert.equal(draft(a).reportStamp, null);
  M.identity(a, 'zhaolei'); denied(() => M.approve(a, 'd1', 'l2'), /缺项/);
});
test('mode changes cannot reuse an old report or approval', () => {
  const a = fresh(); M.submit(a, 'd1'); M.mode(a); M.identity(a, 'wangfang');
  denied(() => M.approve(a, 'd1', 'l1'), /缺项/); assert.equal(draft(a).reportStamp, null);
});
test('ordinary stop may restore the qualified same snapshot', () => {
  const a = publishSimple(); M.identity(a, 'zhaolei'); M.stop(a, 'd1', false); assert.equal(M.live(draft(a)), undefined);
  assert.equal(M.qualified(draft(a).snapshots[0]), true); M.restore(a, 'd1', 1); assert.equal(M.live(draft(a)).v, 1);
});
test('force-stopped snapshot cannot be revived by restore', () => {
  const a = publishSimple(); M.identity(a, 'zhaolei'); M.stop(a, 'd1', true, '样例风险处置'); const before = copy(draft(a));
  assert.equal(M.qualified(draft(a).snapshots[0]), false); denied(() => M.restore(a, 'd1', 1), /强停/);
  assert.deepEqual(copy(draft(a)), before); assert.equal(M.live(draft(a)), undefined);
});
test('rights-revoked snapshot cannot be restored', () => {
  const a = fresh(); M.identity(a, 'zhaolei'); M.revoke(a, 'd2', 2);
  assert.equal(M.live(draft(a, 'd2')), undefined); denied(() => M.restore(a, 'd2', 2), /版权/);
  assert.equal(draft(a, 'd2').snapshots[0].copy, false);
});
test('rollback selects a qualified prior version and preserves newer work', () => {
  const a = publishSimple(); M.edit(a, 'd1', '第二版', 1); M.submit(a, 'd1'); M.approve(a, 'd1', 'simple');
  assert.equal(M.live(draft(a)).v, 2); M.identity(a, 'zhaolei'); M.restore(a, 'd1', 1);
  assert.equal(M.live(draft(a)).v, 1); assert.equal(draft(a).v, 2); assert.equal(draft(a).title, '第二版');
  assert.equal(draft(a).snapshots.find(s => s.v === 2).status, 'superseded'); assert.equal(draft(a).restorePoint.targetVersion, 1);
});
test('sync completion survives serialization and is scoped per operation', () => {
  const a = publishSimple(), op = draft(a).sync[0], future = Date.now() + 100000; op.due = future;
  const restored = M.normalize(seed(), copy(a)); assert.equal(draft(restored).sync[0].status, 'pending');
  assert.equal(M.settle(restored, future - 1), false); assert.equal(M.settle(restored, future), true);
  assert.equal(draft(restored).sync[0].status, 'done'); assert.equal(M.settle(restored, future + 1), false);
});
test('settling an earlier publish never reactivates a subsequently forced version', () => {
  const a = publishSimple(); M.identity(a, 'zhaolei'); M.stop(a, 'd1', true, '样例风险处置');
  M.settle(a, Date.now() + 100000); assert.equal(M.live(draft(a)), undefined); assert.equal(draft(a).snapshots[0].status, 'forced');
  assert.equal(draft(a).sync.length, 2); assert.equal(draft(a).sync.every(op => op.status === 'done'), true);
});
test('hash-only tickets cannot close even with a typed reply', () => {
  const a = fresh(); M.identity(a, 'chenchen'); M.ticketAction(a, 'hash', 'claim');
  denied(() => M.ticketAction(a, 'hash', 'close', '已经处理'), /信息不足/);
  M.ticketAction(a, 'hash', 'upgrade', '', { recipient: 'support-wu', reason: '样例：请二线指导补充' }); const t = a.tickets.find(t => t.id === 'hash');
  assert.equal(t.st, '待二线接收'); assert.equal(t.replies.length, 0); assert.equal(t.events.at(-1).action, 'upgrade');
  denied(() => M.ticketAction(a, 'hash', 'upgrade', '', { recipient: 'support-wu', reason: '重复升级' }), /不能重复/);
});
test('clarification creates a persistent pending-information ticket status', () => {
  const a = fresh(); M.identity(a, 'chenchen'); M.ticketAction(a, 'hash', 'claim'); M.ticketAction(a, 'hash', 'clarify');
  const restored = M.normalize(seed(), copy(a)), t = restored.tickets.find(t => t.id === 'hash');
  assert.equal(t.st, '待补充'); assert.equal(t.events.at(-1).action, 'clarify'); denied(() => M.ticketAction(restored, 'hash', 'close', '回复'), /信息不足/);
});
test('empty support replies preserve draft and do not close', () => {
  const a = fresh(); M.identity(a, 'chenchen'); M.ticketAction(a, 'body', 'claim'); const t = a.tickets.find(t => t.id === 'body'); t.replyDraft = '待完成草稿';
  const before = copy(t); denied(() => M.ticketAction(a, 'body', 'close', '   '), /有效回复/); assert.deepEqual(copy(t), before);
});
test('support closing saves actual reply and cannot repeat or upgrade afterwards', () => {
  const a = fresh(); M.identity(a, 'chenchen'); M.ticketAction(a, 'body', 'claim'); M.ticketAction(a, 'body', 'close', ' 已检查并提供解决方法 ');
  const restored = M.normalize(seed(), copy(a)), t = restored.tickets.find(t => t.id === 'body');
  assert.equal(t.st, '已关闭'); assert.equal(t.replies[0].text, '已检查并提供解决方法'); assert.equal(t.replies[0].who, '运营-陈晨');
  const before = copy(t); denied(() => M.ticketAction(restored, 'body', 'close', '重复'), /已关闭/); denied(() => M.ticketAction(restored, 'body', 'upgrade'), /已关闭/);
  assert.deepEqual(copy(t), before);
});
test('unassigned support ticket must be claimed before reply', () => {
  const a = fresh(); M.identity(a, 'chenchen'); denied(() => M.ticketAction(a, 'body', 'close', '回复'), /先由当前客服接单/);
  M.ticketAction(a, 'body', 'claim'); denied(() => M.ticketAction(a, 'body', 'claim'), /已接单/);
});
test('legacy hash-only falsely closed tickets are visibly reopened for clarification', () => {
  const old = seed(); old.tickets[0].st = '已关闭'; const a = M.normalize(seed(), old), t = a.tickets[0];
  assert.equal(t.legacyState, '已关闭'); assert.equal(t.st, '待补充'); assert.equal(t.replies.length, 0);
});
test('refund first approver cannot act as second approver', () => {
  const a = fresh(); M.identity(a, 'zhangsan'); const before = copy(a.refunds[0]);
  denied(() => M.refund(a, 'rf1'), /第一审批/); assert.deepEqual(copy(a.refunds[0]), before);
});
test('refund applicant cannot approve its own second step', () => {
  const a = fresh(); a.refunds[0].applicant = '财务-刘敏'; M.identity(a, 'liucai'); denied(() => M.refund(a, 'rf1'), /申请人/);
});
test('refund second distinct approver is persisted once without changing invoice', () => {
  const a = fresh(); M.identity(a, 'liucai'); M.refund(a, 'rf1'); const restored = M.normalize(seed(), copy(a)), r = restored.refunds[0];
  assert.match(r.ok2, /^财务-刘敏 /); assert.equal(r.st, '通过·待开票'); assert.equal(r.inv, '未申请');
  const before = copy(r); denied(() => M.refund(restored, 'rf1'), /第二审批状态/); assert.deepEqual(copy(r), before);
});
test('dashboard metrics derive from current release and work facts', () => {
  const a = fresh(); assert.deepEqual(copy(M.metrics(a)), { active: 1, pending: 0, risk: null });
  M.submit(a, 'd1'); assert.equal(M.metrics(a).pending, 1); M.approve(a, 'd1', 'simple'); assert.equal(M.metrics(a).active, 2);
  M.identity(a, 'zhaolei'); M.stop(a, 'd1', false); assert.equal(M.metrics(a).active, 1);
});
test('allowed mutations leave local audit records for actor and version', () => {
  const a = publishSimple(); assert.match(a.audit[0].act, /发布 d1 v1/); assert.equal(a.audit[0].who, '教研-小李');
  M.identity(a, 'zhaolei'); M.stop(a, 'd1', false); assert.match(a.audit[0].act, /下架 d1 v1/); assert.equal(a.audit[0].who, '赵磊');
});
test('actual app samples use qualified released snapshots', () => {
  const a = M.normalize(actualSeed), released = a.drafts.flatMap(d => d.snapshots);
  assert.ok(released.length >= 2); assert.equal(released.every(s => M.qualified(s)), true);
});
test('actual processed body-ticket sample has an explicit staff assignee and can close', () => {
  const a = M.normalize(actualSeed); M.identity(a, 'chenchen');
  const t = a.tickets.find(t => !t.hashOnly && t.st === '处理中'); assert.ok(t);
  assert.equal(t.assignee, a.user); M.ticketAction(a, t.id, 'close', '本机样例回复');
  assert.equal(t.st, '已关闭'); assert.equal(t.replies[0].text, '本机样例回复');
});
test('legacy processed ticket without an assignee becomes claimable rather than stuck', () => {
  const old = seed(); old.tickets[1].st = '处理中';
  const a = M.normalize(seed(), old), t = a.tickets[1];
  assert.equal(t.legacyState, '处理中'); assert.equal(t.st, '待接单'); assert.ok(!t.assignee);
  M.identity(a, 'chenchen'); M.ticketAction(a, t.id, 'claim'); M.ticketAction(a, t.id, 'close', '迁移后实际回复');
  assert.equal(t.st, '已关闭'); assert.equal(t.replies.length, 1);
});
test('another person resubmitting cannot enable the original editor to approve L1', () => {
  const a = dualReady(); M.identity(a, 'wangfang'); M.submit(a, 'd1');
  assert.equal(draft(a).submittedBy, '王芳'); assert.equal(draft(a).editorBy, '教研-小李');
  M.identity(a, 'teach-li'); const before = copy(draft(a));
  denied(() => M.approve(a, 'd1', 'l1'), /编辑人/); assert.deepEqual(copy(draft(a)), before);
});
test('an L2 editor is rejected and cannot make a qualified dual snapshot', () => {
  const a = dualReady(); draft(a).editorBy = '赵磊'; M.identity(a, 'wangfang'); M.approve(a, 'd1', 'l1');
  M.identity(a, 'zhaolei'); const before = copy(draft(a));
  denied(() => M.approve(a, 'd1', 'l2'), /编辑人/); assert.deepEqual(copy(draft(a)), before);
  const s = { v: 1, mode: 'dual', copy: true, mediaNeed: 0, mediaHave: 0, status: 'off', submittedBy: '教研-小李', editorBy: '赵磊',
    reportStamp: { version: 1, mode: 'dual' }, approvals: { l1: { version: 1, mode: 'dual', who: '王芳' }, l2: { version: 1, mode: 'dual', who: '赵磊' } } };
  assert.equal(M.qualified(s), false);
});
test('a late media callback cannot write after switching to an unauthorized identity', () => {
  const ui = uiFixture(); ui.run('amedia(true); amUpload();'); const before = ui.run('A.media.length');
  ui.run('aidentity("liucai");'); assert.equal(ui.run('M.can(A,"media")'), false);
  ui.fire(1200); assert.equal(ui.run('A.media.length'), before);
});
test('same-authorized-identity media completion appends one local sample', () => {
  const ui = uiFixture(), before = ui.run('A.media.length'); ui.run('amedia(true); amUpload();');
  ui.fire(1200); assert.equal(ui.run('A.media.length'), before + 1); assert.equal(ui.run('A.uploading'), false);
  ui.fire(1200); assert.equal(ui.run('A.media.length'), before + 1);
});
test('switching to another media-authorized actor cancels the prior upload', () => {
  const ui = uiFixture(), before = ui.run('A.media.length'); ui.run('amedia(true); amUpload(); aidentity("zhaolei");');
  assert.equal(ui.run('M.can(A,"media")'), true); ui.fire(1200); assert.equal(ui.run('A.media.length'), before);
});
test('switching away and back cannot revive an older upload token', () => {
  const ui = uiFixture(), before = ui.run('A.media.length'); ui.run('amedia(true); amUpload(); aidentity("zhaolei"); aidentity("teach-li");');
  ui.fire(1200); assert.equal(ui.run('A.media.length'), before); assert.equal(ui.run('A.uploading'), false);
});
test('logging out prevents delayed media mutations', () => {
  const ui = uiFixture(), before = ui.run('A.media.length'); ui.run('amedia(true); amUpload(); alogout();');
  ui.fire(1200); assert.equal(ui.run('A.media.length'), before); assert.equal(ui.run('A.user'), null);
});
test('closing the media switch cancels the pending sample', () => {
  const ui = uiFixture(), before = ui.run('A.media.length'); ui.run('amedia(true); amUpload(); amedia(false);');
  ui.fire(1200); assert.equal(ui.run('A.media.length'), before); assert.equal(ui.run('A.uploading'), false);
});
test('cross-window state replacement invalidates old media callbacks', () => {
  const ui = uiFixture(), before = ui.run('A.media.length'); ui.run('amedia(true); amUpload();');
  const envelope = ui.run('JSON.stringify({v:2,A})'); ui.event('storage', { key: 'yxx-admin-v1', newValue: envelope });
  assert.equal(ui.run('A.uploading'), false); ui.fire(1200); assert.equal(ui.run('A.media.length'), before);
});
test('L1 may ordinarily withdraw its own simple release but cannot restore it', () => {
  const a = publishSimple(); M.stop(a, 'd1', false); assert.equal(M.live(draft(a)), undefined); assert.equal(draft(a).snapshots[0].status, 'off');
  denied(() => M.restore(a, 'd1', 1), /无此权限/);
});
test('L1 cannot ordinarily withdraw another persons simple release', () => {
  const a = publishSimple(); M.identity(a, 'wangfang'); const before = copy(draft(a));
  denied(() => M.stop(a, 'd1', false), /本人简审/); assert.deepEqual(copy(draft(a)), before);
});
test('L1 cannot ordinarily withdraw a dual-approved release', () => {
  const a = fresh(), before = copy(draft(a, 'd2'));
  denied(() => M.stop(a, 'd2', false), /本人简审/); assert.deepEqual(copy(draft(a, 'd2')), before);
});
test('L1 cannot force-stop even its own simple release', () => {
  const a = publishSimple(), before = copy(draft(a));
  denied(() => M.stop(a, 'd1', true), /无此权限/); assert.deepEqual(copy(draft(a)), before);
});
test('reviewer and admin metrics expose only their authorized domain facts', () => {
  const a = fresh(); assert.deepEqual(copy(M.metrics(a)), { active: 1, pending: 0, risk: null });
  M.identity(a, 'chenchen'); assert.deepEqual(copy(M.metrics(a)), { active: null, pending: null, risk: 1 });
});
test('finance metrics distinguish lack of authorization from zero facts', () => {
  const a = fresh(); M.identity(a, 'liucai');
  assert.deepEqual(copy(M.metrics(a)), { active: null, pending: null, risk: null });
});
test('dashboard UI omits unauthorized metrics and explains a wholly restricted scope', () => {
  const ui = uiFixture(); let html = ui.run('AV.dash()');
  assert.match(html, /<span>在架内容<\/span>/); assert.match(html, /<span>待审工作版<\/span>/); assert.doesNotMatch(html, /<span>风险待建档<\/span>/);
  ui.run('aidentity("chenchen");'); html = ui.run('AV.dash()');
  assert.doesNotMatch(html, /<span>在架内容<\/span>|<span>待审工作版<\/span>/); assert.match(html, /<span>风险待建档<\/span>/);
  ui.run('aidentity("liucai");'); html = ui.run('AV.dash()');
  assert.doesNotMatch(html, /<span>在架内容<\/span>|<span>待审工作版<\/span>|<span>风险待建档<\/span>/); assert.match(html, /当前身份无此类指标权限/);
});

// Failure injection below is confined to the VM storage stub and frozen clock.
// It supplies model/handler regression evidence, not browser fault-injection evidence.
const vmSnapshot = ui => ({ state: ui.run('JSON.stringify(A)'), persisted: ui.persistedRaw() });
function assertVmUnchanged(ui, before, expectedToast) {
  assert.equal(ui.run('JSON.stringify(A)'), before.state, 'rejected action must preserve model state');
  assert.equal(ui.persistedRaw(), before.persisted, 'rejected action must not change persisted storage');
  if (expectedToast) assert.match(ui.node('toast').textContent, expectedToast);
  assert.doesNotMatch(ui.node('toast').textContent, /已保存|保存成功|操作成功|模拟完成|已同步|模式已切换|登录成功/, 'failed action must not show a success toast');
}
function freshVmPublication(ui) {
  ui.run('M.submit(A,"d1"); M.approve(A,"d1","simple",3); adbSave(); location.hash="#/publish"; arender();');
}
function prepareVmReviewNote(ui, text = '保留这个审核理由') {
  ui.run('anote("d1",' + JSON.stringify(text) + ');'); ui.node('review-note').value = text;
}

test('VM title save failure rolls back model/storage and preserves input until explicit retry', () => {
  const ui = uiFixture({ route: '#/review' }); ui.run('adbSave()'); const before = vmSnapshot(ui);
  ui.node('dt').value = '本地修改标题'; ui.run('atitle("d1","本地修改标题")'); ui.failWrites(true); ui.run('aedit("d1",3)');
  assertVmUnchanged(ui, before, /操作未保存/); assert.equal(ui.node('dt').value, '本地修改标题');
  assert.equal(ui.run('titleEdits.get(localKey("d1")).value'), '本地修改标题'); assert.match(ui.html(), /本机存储写入失败/);
  ui.failWrites(false); ui.run('aretrySave()'); assert.equal(ui.run('JSON.stringify(A)'), before.state);
  ui.run('aedit("d1",3)'); assert.equal(ui.run('adraft().v'), 4); assert.equal(ui.run('adraft().title'), '本地修改标题');
  assert.equal(ui.run('titleEdits.has(localKey("d1"))'), false); assert.equal(ui.persisted().A.drafts.find(d => d.id === 'd1').v, 4);
});

for (const [name, operation] of [['identity', 'aidentity("zhaolei")'], ['media switch', 'amedia(false)']]) {
  test('VM cancelled upload with failed ' + name + ' save restores retryable state without a stale completion', () => {
    const ui = uiFixture(); ui.run('amedia(true); amUpload()'); const count = ui.run('A.media.length'), persisted = ui.persistedRaw();
    assert.equal(ui.run('A.uploading'), true); ui.failWrites(true); ui.run(operation);
    assert.equal(ui.run('A.user'), '教研-小李'); assert.equal(ui.run('A.mediaOpen'), true); assert.equal(ui.run('A.uploading'), false);
    assert.equal(ui.persistedRaw(), persisted); assert.match(ui.node('toast').textContent, /操作未保存/);
    assert.doesNotMatch(ui.node('toast').textContent, /已保存|成功|模拟完成/);
    ui.fire(1200); assert.equal(ui.run('A.media.length'), count); assert.equal(ui.persistedRaw(), persisted);
    ui.failWrites(false); ui.run('aretrySave(); amUpload()'); assert.equal(ui.run('A.uploading'), true);
    ui.fire(1200); assert.equal(ui.run('A.media.length'), count + 1); assert.equal(ui.run('A.uploading'), false);
    assert.equal(ui.persisted().A.media.length, count + 1);
  });
}

test('VM upload completion save failure restores sample/sequence and allows a fresh retry', () => {
  const ui = uiFixture(); ui.run('amedia(true)'); const before = vmSnapshot(ui), count = ui.run('A.media.length'), seq = ui.run('A.seq');
  ui.run('amUpload()'); ui.failWrites(true); ui.fire(1200);
  assertVmUnchanged(ui, before, /操作未保存/); assert.equal(ui.run('A.media.length'), count); assert.equal(ui.run('A.seq'), seq); assert.equal(ui.run('A.uploading'), false);
  assert.match(ui.html(), /本机存储写入失败/); ui.failWrites(false); ui.run('aretrySave(); amUpload()'); ui.fire(1200);
  assert.equal(ui.run('A.media.length'), count + 1); assert.equal(ui.persisted().A.media.length, count + 1);
});

test('VM old force form refuses a newer remote release and retains reason until explicit reopen', () => {
  const ui = uiFixture({ route: '#/review' }); freshVmPublication(ui);
  ui.run('aidentity("zhaolei"); aforceOpen("d1"); aforceReason("d1","v3 的处置原因")');
  ui.remote('M.identity(remote,"teach-li"); M.edit(remote,"d1","远端发布新标题",3); M.submit(remote,"d1"); M.approve(remote,"d1","simple",4)');
  const before = vmSnapshot(ui); assert.equal(ui.run('forceForms.get(localKey("d1")).version'), 3); assert.match(ui.html(), /在架版本已变化/);
  assert.match(ui.html(), /onclick="aarm\(this,\(\)=>astop\('d1',true\)\)" disabled/);
  ui.run('astop("d1",true)'); assertVmUnchanged(ui, before, /在架版本已变化/);
  assert.equal(ui.run('forceForms.get(localKey("d1")).reason'), 'v3 的处置原因');
  ui.run('aforceOpen("d1"); astop("d1",true)'); assert.equal(ui.run('M.live(adraft())'), undefined);
  assert.equal(ui.run('adraft().snapshots.find(s=>s.v===4).status'), 'forced'); assert.equal(ui.run('adraft().snapshots.find(s=>s.v===4).stopReason'), 'v3 的处置原因');
  assert.equal(ui.persisted().A.drafts.find(d => d.id === 'd1').snapshots.find(s => s.v === 4).status, 'forced');
});

test('VM ordinary stop also rejects a stale released version before model/storage mutation', () => {
  const ui = uiFixture({ route: '#/review' }); freshVmPublication(ui); ui.run('aidentity("zhaolei")'); const before = vmSnapshot(ui);
  ui.run('astop("d1",false,2)'); assertVmUnchanged(ui, before, /在架版本已变化/);
});

test('VM force stop failed save preserves reason and released snapshot until explicit retry', () => {
  const ui = uiFixture({ route: '#/review' }); freshVmPublication(ui);
  ui.run('aidentity("zhaolei"); aforceOpen("d1"); aforceReason("d1","需要处置")'); const before = vmSnapshot(ui);
  ui.failWrites(true); ui.run('astop("d1",true)'); assertVmUnchanged(ui, before, /操作未保存/); assert.equal(ui.node('force-d1').value, '需要处置');
  assert.equal(ui.run('forceForms.get(localKey("d1")).version'), 3); ui.failWrites(false); ui.run('aretrySave(); astop("d1",true)');
  assert.equal(ui.run('M.live(adraft())'), undefined); assert.equal(ui.run('forceForms.has(localKey("d1"))'), false);
  assert.equal(ui.persisted().A.drafts.find(d => d.id === 'd1').snapshots.find(s => s.v === 3).status, 'forced');
});

test('VM review reason version conflict retains text and blocks submission until explicit rebase', () => {
  const ui = uiFixture({ route: '#/review' }); ui.run('adbSave()'); prepareVmReviewNote(ui);
  ui.remote('M.edit(remote,"d1","另一窗口的工作新稿",3); M.submit(remote,"d1")'); const before = vmSnapshot(ui);
  assert.equal(ui.node('review-note').value, '保留这个审核理由'); assert.match(ui.html(), /稿件或模式已更新/);
  assert.match(ui.html(), /onclick="adecide\('d1','simple','CHANGES_REQUESTED',4\)" disabled/);
  ui.run('adecide("d1","simple","CHANGES_REQUESTED",4)'); assertVmUnchanged(ui, before, /请先核对/);
  ui.run('areviewRebase("d1"); adecide("d1","simple","CHANGES_REQUESTED",4)');
  assert.equal(ui.run('adraft().v'), 5); assert.equal(ui.run('adraft().needsRevision'), true);
  assert.equal(ui.run('adraft().reviewDecisions[0].version'), 4); assert.equal(ui.run('adraft().reviewDecisions[0].reason'), '保留这个审核理由');
  assert.equal(ui.run('reviewNotes.has(localKey("d1"))'), false); assert.equal(ui.persisted().A.drafts.find(d => d.id === 'd1').v, 5);
});

test('VM review reason same-version mode conflict also blocks until explicit rebase', () => {
  const ui = uiFixture({ route: '#/review', account: 'wangfang' }); ui.run('adbSave()'); prepareVmReviewNote(ui, '模式切换后核对这个理由');
  ui.remote('M.identity(remote,"teach-li"); M.mode(remote); M.submit(remote,"d1")'); const before = vmSnapshot(ui);
  assert.equal(ui.run('adraft().v'), 3); assert.equal(ui.run('A.mode'), 'dual'); assert.match(ui.html(), /稿件或模式已更新/);
  ui.run('adecide("d1","l1","REJECTED",3)'); assertVmUnchanged(ui, before, /请先核对/);
  ui.run('areviewRebase("d1"); adecide("d1","l1","REJECTED",3)'); assert.equal(ui.run('adraft().v'), 4);
  assert.equal(ui.run('adraft().reviewDecisions[0].mode'), 'dual'); assert.equal(ui.run('adraft().reviewDecisions[0].who'), '王芳');
});

test('VM review decision failed save retains reason buffer and original model/storage for retry', () => {
  const ui = uiFixture({ route: '#/review' }); ui.run('adbSave()'); prepareVmReviewNote(ui, '保存失败也保留理由'); const before = vmSnapshot(ui);
  ui.failWrites(true); ui.run('adecide("d1","simple","REJECTED",3)'); assertVmUnchanged(ui, before, /操作未保存/); assert.equal(ui.node('review-note').value, '保存失败也保留理由');
  assert.equal(ui.run('reviewNotes.get(localKey("d1")).version'), 3); ui.failWrites(false); ui.run('aretrySave(); adecide("d1","simple","REJECTED",3)');
  assert.equal(ui.run('adraft().reviewDecisions.length'), 1); assert.equal(ui.run('adraft().v'), 4); assert.equal(ui.run('reviewNotes.has(localKey("d1"))'), false);
  assert.equal(ui.persisted().A.drafts.find(d => d.id === 'd1').reviewDecisions[0].reason, '保存失败也保留理由');
});

test('VM positive approval stale expected version fails before signatures/audit/snapshot or persisted changes', () => {
  const ui = uiFixture({ route: '#/review' }); ui.run('adbSave()');
  ui.remote('M.edit(remote,"d1","远端新版待审",3); M.submit(remote,"d1")'); const before = vmSnapshot(ui);
  ui.run('aapprove("d1","simple",3)'); assertVmUnchanged(ui, before, /版本已变化/);
  ui.run('aapprove("d1","simple",4)'); assert.equal(ui.run('M.live(adraft()).v'), 4);
});

test('VM background settle pauses on storageIssue and resumes only after a successful explicit retry', () => {
  const ui = uiFixture({ route: '#/review' }); freshVmPublication(ui); const persisted = ui.persistedRaw();
  ui.failWrites(true); ui.run('adbSave()'); ui.advance(2000); const writes = ui.writes();
  ui.interval(); assert.equal(ui.writes(), writes); assert.equal(ui.run('adraft().sync[0].status'), 'pending'); assert.equal(ui.persistedRaw(), persisted);
  ui.failWrites(false); ui.interval(); assert.equal(ui.writes(), writes); assert.equal(ui.run('adraft().sync[0].status'), 'pending'); assert.equal(ui.persistedRaw(), persisted);
  assert.doesNotMatch(ui.node('toast').textContent, /已保存|成功|已同步/);
  ui.run('aretrySave()'); ui.interval(); assert.equal(ui.run('adraft().sync[0].status'), 'done'); assert.equal(ui.persisted().A.drafts.find(d => d.id === 'd1').sync[0].status, 'done');
});

test('VM background settle failed write restores pending model/storage and never renders false completion', () => {
  const ui = uiFixture({ route: '#/review' }); freshVmPublication(ui); ui.advance(2000); ui.failWrites(true); const before = vmSnapshot(ui);
  ui.interval(); assertVmUnchanged(ui, before); assert.match(ui.html(), /同步中（演示）/); assert.doesNotMatch(ui.html(), /已同步（演示）/); assert.match(ui.html(), /本机存储写入失败/);
  const writes = ui.writes(); ui.interval(); assert.equal(ui.writes(), writes); ui.failWrites(false); ui.run('aretrySave()'); ui.interval();
  assert.equal(ui.run('adraft().sync[0].status'), 'done'); assert.match(ui.html(), /已同步（演示）/); assert.equal(ui.persisted().A.drafts.find(d => d.id === 'd1').sync[0].status, 'done');
});

test('model normalization and VM rendering initialize reviewDecisions for both new and cached records', () => {
  const ui = uiFixture({ route: '#/review' }); ui.run('anewDraft(); arender()'); assert.equal(ui.run('adraft().reviewDecisions.length'), 0); assert.doesNotMatch(ui.html(), /记录暂不可用/);
  ui.run('const cached=JSON.parse(JSON.stringify(A)); for(const d of cached.drafts) delete d.reviewDecisions; A=M.normalize(ASEED,cached); arender()');
  assert.equal(ui.run('A.drafts.every(d=>Array.isArray(d.reviewDecisions))'), true); assert.doesNotMatch(ui.html(), /记录暂不可用/);
});
