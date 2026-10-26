/* 静态原型规则；不是 IAM、内容服务或客服服务实现。无网络、无真实资金操作。 */
const AdminModel = (() => {
  const identities = {
    'teach-li': ['教研-小李', 'reviewer-l1'], wangfang: ['王芳', 'reviewer-l1'],
    zhaolei: ['赵磊', 'reviewer-l2'], chenchen: ['运营-陈晨', 'admin'],
    zhangsan: ['张三', 'finance'], liucai: ['财务-刘敏', 'finance'],
    'support-wu': ['二线-吴晴', 'support-l2'],
  };
  const grants = {
    'reviewer-l1': ['content.read', 'content.edit', 'content.l1', 'content.simple', 'content.withdraw', 'content.mode', 'media', 'audit'],
    'reviewer-l2': ['content.read', 'content.l2', 'content.simple', 'content.publish', 'content.mode', 'media', 'audit'],
    admin: ['gov', 'cs', 'shop', 'refund', 'policy', 'audit', 'ops'],
    finance: ['shop', 'refund', 'audit'],
    'support-l2': ['cs', 'audit'],
  };
  const routes = { draft: 'content.read', review: 'content.read', publish: 'content.read', media: 'media',
    gov: 'gov', report: 'gov', cs: 'cs', csdetail: 'cs', shop: 'shop', refund: 'refund', perm: 'policy', audit: 'audit', ops: 'ops' };
  const clone = x => JSON.parse(JSON.stringify(x));
  const now = () => new Date().toISOString();
  function can(a, p) { return !!a.user && Object.values(identities).some(([u, r]) => u === a.user && r === a.role) && (grants[a.role] || []).includes(p); }
  function page(a, r) { return ['alogin', 'dash', 'me'].includes(r) || can(a, routes[r]); }
  function require(a, p) { if (!can(a, p)) throw new Error('当前身份无此权限，请在“我的”切换授权演示身份'); }
  function draft(a, id) { const d = a.drafts.find(x => x.id === id); if (!d) throw new Error('稿件不存在'); return d; }
  function log(a, act, r = '允许') { a.audit.unshift({ id: 'demo-' + (a.seq++), act, who: a.user || '未登录', time: now(), r }); }
  function stamp(a, d) { return { who: a.user, version: d.v, mode: a.mode, time: now() }; }
  function matches(s, d, mode) { return !!s && s.version === d.v && s.mode === mode; }
  function missing(a, d) {
    const m = [];
    if (!d.copy) m.push('版权未绑定');
    if (!matches(d.reportStamp, d, a.mode)) m.push('审核报告版本或模式不一致');
    if (d.mediaHave < d.mediaNeed) m.push('必要媒体缺 ' + (d.mediaNeed - d.mediaHave) + ' 项');
    return m;
  }
  function invalidate(d) { d.reportStamp = null; d.approvals = {}; d.l1by = ''; d.l2by = ''; d.report = false; d.st = 'draft'; }
  function qualified(s) {
    if (!s || s.legacy || !s.copy || s.mediaHave < s.mediaNeed || s.status === 'forced') return false;
    if (!matches(s.reportStamp, { v: s.v }, s.mode)) return false;
    const p = s.approvals || {};
    if (s.mode === 'simple') return matches(p.simple, { v: s.v }, 'simple');
    return matches(p.l1, { v: s.v }, 'dual') && matches(p.l2, { v: s.v }, 'dual') &&
      p.l1.who !== p.l2.who && p.l1.who !== s.submittedBy && p.l2.who !== s.submittedBy &&
      p.l1.who !== s.editorBy && p.l2.who !== s.editorBy;
  }
  function live(d) { return d.snapshots.find(s => s.v === d.publishedVersion && s.status === 'active'); }
  function sync(a, d, s, operation, time = Date.now()) {
    const op = { id: 'sync-' + (a.seq++), version: s.v, operation, status: 'pending', due: time + 1500, time: now() };
    d.sync.push(op); return op;
  }
  function settle(a, time = Date.now()) {
    let changed = false;
    for (const d of a.drafts) for (const op of d.sync) if (op.status === 'pending' && time >= op.due) { op.status = 'done'; op.completed = now(); changed = true; }
    return changed;
  }
  function normalize(seed, stored) {
    const a = clone(stored || seed); a.seq = Number.isSafeInteger(a.seq) ? a.seq : 1000;
    a.mode = a.mode === 'dual' ? 'dual' : 'simple'; a.q = a.q || '';
    for (const d of a.drafts) {
      d.createdBy = d.createdBy || '教研-小李'; d.editorBy = d.editorBy || d.createdBy; d.submittedBy = d.submittedBy || d.createdBy;
      if (!Array.isArray(d.snapshots)) {
        d.snapshots = []; d.sync = []; d.approvals = {};
        const oldState = d.st; d.legacyState = stored ? oldState : null;
        // 旧缓存只有姓名/布尔值，无法补造合规签核。保留旧值供核对，工作副本必须重新送审。
        if (stored) { d.legacyEvidence = { l1by: d.l1by, l2by: d.l2by, report: d.report, pubSync: a.pubSync }; invalidate(d); }
        else {
          d.reportStamp = d.report ? { version: d.v, mode: a.mode, sample: true } : null;
          if (['active', 'off'].includes(oldState)) {
            const mode = 'dual';
            const s = { v: d.v, title: d.title, copy: d.copy, mediaHave: d.mediaHave, mediaNeed: d.mediaNeed,
              reportStamp: { version: d.v, mode, sample: true }, mode, submittedBy: d.submittedBy, editorBy: d.editorBy,
              approvals: { l1: { who: d.l1by, version: d.v, mode }, l2: { who: d.l2by, version: d.v, mode } },
              status: oldState === 'active' ? 'active' : 'off', time: d.updated, sample: true };
            d.snapshots.push(s); d.publishedVersion = d.v;
            invalidate(d);
          } else { d.st = d.report ? 'review' : 'draft'; d.l1by = ''; d.l2by = ''; }
        }
      }
      d.sync = Array.isArray(d.sync) ? d.sync : [];
      d.approvals = d.approvals || {};
      d.reviewDecisions = Array.isArray(d.reviewDecisions) ? d.reviewDecisions : [];
    }
    for (const t of a.tickets) {
      t.hashOnly = typeof t.hashOnly === 'boolean' ? t.hashOnly : t.body.startsWith('hash-only');
      t.events = t.events || []; t.replies = t.replies || []; t.replyDraft = t.replyDraft || '';
      if (!stored && t.st === '处理中') t.assignee = '运营-陈晨';
      if (stored && t.st === '处理中' && !t.assignee) { t.legacyState = t.st; t.st = '待接单'; }
      if (stored && t.hashOnly && t.st === '已关闭' && !t.replies.length) { t.legacyState = t.st; t.st = '待补充'; }
      if (stored && t.st === '已升级' && !t.transfer) { t.legacyState = t.st; t.st = '升级信息待补全'; }
    }
    settle(a); return a;
  }
  function identity(a, account) { const x = Object.hasOwn(identities, account) ? identities[account] : null; if (!x) throw new Error('账号或密码不正确（演示只接受已列出的账号）'); [a.user, a.role] = x; }
  function mode(a) { require(a, 'content.mode'); a.mode = a.mode === 'simple' ? 'dual' : 'simple'; a.drafts.forEach(invalidate); log(a, '切换审核模式为 ' + a.mode + '，工作副本需重新送审；已发布快照保留'); }
  function create(a) {
    require(a, 'content.edit'); const id = 'd' + (a.seq++);
    a.drafts.unshift({ id, title: '新草稿 ' + (a.drafts.length + 1), v: 1, st: 'draft', copy: false, mediaNeed: 1,
      mediaHave: 0, updated: now(), createdBy: a.user, editorBy: a.user, submittedBy: a.user, reportStamp: null, approvals: {}, reviewDecisions: [], snapshots: [], sync: [], l1by: '', l2by: '' });
    a.cur = id; log(a, '新建 ' + id + ' v1'); return id;
  }
  function edit(a, id, title, expected) {
    require(a, 'content.edit'); const d = draft(a, id);
    if (d.v !== expected) throw new Error('版本已变化，请刷新后对比再保存');
    title = title.trim(); if (!title) throw new Error('标题不能为空');
    if (title === d.title) throw new Error('标题未变化，无需创建新版本');
    d.v++; d.title = title; d.updated = now(); d.editorBy = a.user; d.submittedBy = a.user; d.needsRevision = false; invalidate(d); log(a, '保存 ' + id + ' v' + d.v + '，旧签核失效');
  }
  function submit(a, id) {
    require(a, 'content.edit'); const d = draft(a, id);
    if (d.needsRevision) throw new Error('请先保存整改修改，再补齐材料重新送审');
    if (d.snapshots.some(s => s.v === d.v)) throw new Error('已发布工作版本不能重复送审，请保存新版本');
    d.copy = true; d.mediaHave = Math.max(d.mediaHave, d.mediaNeed); d.report = true;
    d.reportStamp = { version: d.v, mode: a.mode, sample: true, time: now() };
    d.approvals = {}; d.l1by = ''; d.l2by = ''; d.submittedBy = a.user; d.st = 'review'; log(a, '演示补齐并送审 ' + id + ' v' + d.v);
  }
  function publish(a, d) {
    if (d.snapshots.some(x => x.v === d.v)) throw new Error('该版本已发布，请用合格快照恢复或保存新版本');
    const previous = live(d); if (previous) previous.status = 'superseded';
    const s = { v: d.v, title: d.title, copy: d.copy, mediaHave: d.mediaHave, mediaNeed: d.mediaNeed,
      reportStamp: clone(d.reportStamp), mode: a.mode, submittedBy: d.submittedBy, editorBy: d.editorBy, approvals: clone(d.approvals), status: 'active', time: now() };
    d.snapshots.push(s); d.publishedVersion = s.v; d.st = 'active'; sync(a, d, s, '发布'); log(a, '发布 ' + d.id + ' v' + s.v + ' ' + a.mode);
  }
  function approve(a, id, level, expected) {
    require(a, 'content.' + level); const d = draft(a, id);
    if (expected !== undefined && d.v !== expected) throw new Error('版本已变化，请核对最新稿件后再审核');
    if (d.snapshots.some(s => s.v === d.v)) throw new Error('该版本已有发布快照，请保存新版本');
    if (missing(a, d).length) throw new Error('请先补齐当前版本全部缺项并送审');
    if (level === 'simple') {
      if (a.mode !== 'simple' || d.st !== 'review') throw new Error('当前版本不在简审待审状态');
      d.approvals.simple = stamp(a, d); publish(a, d); return;
    }
    if (a.mode !== 'dual') throw new Error('双签操作仅在双签模式可用');
    if (d.submittedBy === a.user || d.editorBy === a.user) throw new Error('申请人及编辑人禁止审核自己的送审版本');
    if (level === 'l1') {
      if (d.st !== 'review') throw new Error('仅待审版本可进行 L1');
      d.approvals.l1 = stamp(a, d); d.l1by = a.user; d.st = 'l1pass'; log(a, 'L1 通过 ' + id + ' v' + d.v);
    } else {
      if (d.st !== 'l1pass' || !matches(d.approvals.l1, d, 'dual')) throw new Error('当前版本需先由 L1 通过');
      if (d.approvals.l1.who === a.user) throw new Error('L1 与 L2 必须是不同人员');
      d.approvals.l2 = stamp(a, d); d.l2by = a.user; publish(a, d);
    }
  }
  function decide(a, id, level, decision, reason, expected) {
    require(a, 'content.' + level); const d = draft(a, id);
    if (d.v !== expected) throw new Error('版本已变化，请核对最新稿件后再审核');
    if (!['REJECTED', 'CHANGES_REQUESTED'].includes(decision)) throw new Error('未知审核决定');
    reason = String(reason || '').trim(); if (!reason) throw new Error('请填写审核理由');
    if (d.snapshots.some(s => s.v === d.v)) throw new Error('该版本已发布，不能重新审核');
    if (level === 'simple') {
      if (a.mode !== 'simple' || d.st !== 'review') throw new Error('当前不在简审待审状态');
    } else {
      if (a.mode !== 'dual' || !['l1', 'l2'].includes(level)) throw new Error('当前审核模式不匹配');
      if (d.submittedBy === a.user || d.editorBy === a.user) throw new Error('申请人及编辑人不能审核自己的版本');
      if (level === 'l1' && d.st !== 'review') throw new Error('当前不在 L1 待审状态');
      if (level === 'l2' && (d.st !== 'l1pass' || !matches(d.approvals.l1, d, 'dual') || d.approvals.l1.who === a.user)) throw new Error('当前不具备 L2 审核资格');
    }
    const item = { id: 'review-' + (a.seq++), version: d.v, mode: a.mode, level, decision, reason, who: a.user, time: now(), recipient: d.editorBy, acknowledged: false };
    d.reviewDecisions = d.reviewDecisions || []; d.reviewDecisions.push(item);
    d.revisionFrom = d.v; d.v++; d.needsRevision = true; d.updated = now(); invalidate(d);
    log(a, decision + ' ' + id + ' v' + item.version + '：' + reason + '；退回新草稿 v' + d.v);
  }
  function acknowledge(a, id, decisionId) {
    require(a, 'content.edit'); const d = draft(a, id), item = (d.reviewDecisions || []).find(x => x.id === decisionId);
    if (!item || item.recipient !== a.user || item.acknowledged) throw new Error('当前没有可确认的整改意见');
    item.acknowledged = true; item.acknowledgedAt = now(); log(a, '作者确认整改意见 ' + item.id);
  }
  function stop(a, id, force, reason = '', expectedVersion) {
    const d = draft(a, id), s = live(d); if (!s) throw new Error('当前无在架版本');
    if (expectedVersion !== undefined && s.v !== expectedVersion) throw new Error('在架版本已变化，请核对最新版本后重新确认处置');
    if (force || !can(a, 'content.publish')) {
      if (force) require(a, 'content.publish');
      else { require(a, 'content.withdraw'); if (s.mode !== 'simple' || s.approvals.simple.who !== a.user) throw new Error('仅可撤下本人简审发布的版本'); }
    }
    reason = String(reason || '').trim(); if (force && !reason) throw new Error('请填写强制停止的处置原因');
    s.status = force ? 'forced' : 'off'; s.stoppedBy = a.user; s.stoppedAt = now();
    if (force) s.stopReason = reason;
    d.restorePoint = { version: s.v, time: now(), operation: force ? '强停' : '普通下架', reason };
    sync(a, d, s, force ? '强制停止分发' : '普通下架'); log(a, (force ? '强停' : '下架') + ' ' + id + ' v' + s.v + (reason ? '：' + reason : ''));
  }
  function restore(a, id, version) {
    require(a, 'content.publish'); const d = draft(a, id), s = d.snapshots.find(x => x.v === version);
    if (!qualified(s)) throw new Error('该旧版不具备恢复资格：强停、版权、媒体或签核不合格');
    if (live(d)?.v === version) throw new Error('该版本已经在架');
    const previous = live(d); const from = previous?.v ?? d.publishedVersion;
    if (previous) previous.status = 'superseded';
    d.restorePoint = { version: from, targetVersion: version, time: now(), operation: '恢复/回滚' };
    s.status = 'active'; d.publishedVersion = version; sync(a, d, s, '恢复/回滚'); log(a, '恢复/回滚 ' + id + ' v' + from + ' → v' + version);
  }
  function revoke(a, id, version) {
    require(a, 'content.publish'); const d = draft(a, id), s = d.snapshots.find(x => x.v === version);
    if (!s) throw new Error('版本不存在'); s.copy = false;
    if (s.status === 'active') { s.status = 'forced'; s.stopReason = '版权失效'; s.stoppedBy = a.user; s.stoppedAt = now(); sync(a, d, s, '版权失效强停'); }
    if (d.v === version) { d.copy = false; invalidate(d); }
    log(a, '版权失效 ' + id + ' v' + version + '，禁止恢复');
  }
  function ticket(a, id) { require(a, 'cs'); const t = a.tickets.find(x => x.id === id); if (!t) throw new Error('工单不存在'); return t; }
  function ticketAction(a, id, action, text = '', details = {}) {
    const t = ticket(a, id); if (t.st === '已关闭') throw new Error('工单已关闭，不能重复处理');
    let eventDetails = {};
    if (action === 'accept') {
      if (t.st !== '待二线接收' || !t.transfer || t.transfer.recipient !== a.user || t.transfer.status !== '待接收') throw new Error('仅指定接收人可以接收此升级工单');
      t.transfer.status = '已接收'; t.transfer.acceptedAt = now(); t.assignee = a.user; t.st = '处理中';
      eventDetails = { recipient: a.user, reason: t.transfer.reason };
    } else if (action === 'claim') {
      if (t.st !== '待接单') throw new Error('该单已接单'); t.assignee = a.user; t.st = '处理中';
    } else {
      if (!t.assignee || t.assignee !== a.user) throw new Error('先由当前客服接单');
      if (action === 'close') {
        if (t.hashOnly) throw new Error('信息不足，仅可请求补充或升级，不能回复关闭');
        if (t.st !== '处理中') throw new Error('该单已转二线或待补充，不能直接关闭');
        text = text.trim(); if (!text) throw new Error('请先填写有效回复');
        t.replies.push({ who: a.user, text, time: now() }); t.replyDraft = ''; t.st = '已关闭';
      } else if (action === 'upgrade') {
        if (!['处理中', '升级信息待补全'].includes(t.st)) throw new Error('已升级或待补充，不能重复处理');
        const account = Object.hasOwn(identities, details.recipient) ? identities[details.recipient] : null;
        const reason = String(details.reason || '').trim();
        if (!account || !(grants[account[1]] || []).includes('cs') || account[0] === a.user) throw new Error('请选择另一位有客服权限的接收人');
        if (!reason) throw new Error('请填写升级原因');
        t.transfer = { from: a.user, recipient: account[0], account: details.recipient, reason, status: '待接收', time: now() };
        t.st = '待二线接收'; eventDetails = { recipient: account[0], reason };
      } else if (action === 'clarify') {
        if (t.st !== '处理中') throw new Error('已升级或待补充，不能重复处理');
        t.st = '待补充';
      } else throw new Error('未知工单操作');
    }
    t.events.push({ action, who: a.user, time: now(), status: t.st, ...eventDetails }); log(a, '工单 ' + id + ' ' + action + ' → ' + t.st + (eventDetails.recipient ? '；接收人 ' + eventDetails.recipient + '；原因 ' + eventDetails.reason : ''));
  }
  function refund(a, id) {
    require(a, 'refund'); const r = a.refunds.find(x => x.id === id); if (!r) throw new Error('退款不存在');
    if (r.st !== '待第二审批') throw new Error('当前不在第二审批状态');
    const first = r.firstBy || (r.ok1 || '').split(' ')[0];
    if (!first || first === a.user || r.applicant === a.user) throw new Error('第二审批须与第一审批及申请人不同');
    r.ok2 = a.user + ' ' + now(); r.st = '通过·待开票'; log(a, '退款第二审批 ' + id + '（沙盒）');
  }
  function metrics(a) { return {
    active: can(a, 'content.read') ? a.drafts.filter(live).length : null,
    pending: can(a, 'content.read') ? a.drafts.filter(d => ['review', 'l1pass'].includes(d.st)).length : null,
    risk: can(a, 'gov') ? a.gov.filter(g => g.st === '待建档').length : null,
  }; }
  return { identities, grants, routes, normalize, can, page, require, draft, log, missing, qualified, live, settle,
    identity, mode, create, edit, submit, approve, decide, acknowledge, stop, restore, revoke, ticket, ticketAction, refund, metrics };
})();
