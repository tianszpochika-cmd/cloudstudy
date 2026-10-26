/* 语学星管理后台交互稿 · 静态数据 · 无后端
 * 范围：L8 内容双审 / 管理登录仪表盘权限媒体 / L9 治理举报 / 客服后台 / 商城后台 / 审计 / 观测发布门
 * 对应 BC-071…084/085…094/168/171…175/185…187/200/204…208，IC-040…051。静态演示不代替正式业务事实。
 * 存储键 yxx-admin-v1（对象 v2），与学习端 yxx-demo-v3 隔离，互不覆盖。
 */
const ASEED = {
  user: "教研-小李", role: "reviewer-l1", mode: "simple",
  drafts: [
    { id: "d1", title: "语法课 · There be 句型", v: 3, st: "l1pass", copy: true, report: true, mediaNeed: 0, mediaHave: 1, updated: "09-30 18:20", l1by: "王芳", l2by: "" },
    { id: "d2", title: "四级阅读 · 图书馆的一天", v: 1, st: "draft", copy: false, report: true, mediaNeed: 1, mediaHave: 0, updated: "09-30 15:02", l1by: "", l2by: "" },
    { id: "d3", title: "零基础 · 问候告别", v: 2, st: "active", copy: true, report: true, mediaNeed: 0, mediaHave: 2, updated: "09-29 11:40", l1by: "王芳", l2by: "赵磊" },
    { id: "d4", title: "商务口语 · 会议", v: 1, st: "off", copy: true, report: true, mediaNeed: 0, mediaHave: 1, updated: "09-28 09:12", l1by: "王芳", l2by: "赵磊" },
  ],
  cur: "d1", pubSync: "已同步",
  gov: [
    { id: "RISK-001", t: "刷分嫌疑 · 账号 t-learner-07", st: "待建档", src: "行为模型 v2", time: "09-30 22:11" },
    { id: "RISK-002", t: "恶意房间名 · room-118", st: "已隔离", src: "用户举报 JB-101", time: "09-29 16:44" },
  ],
  reports: [
    { id: "JB-101", t: "房间名含违规词", st: "已看", who: "匿***12", time: "09-29 16:40" },
    { id: "JB-102", t: "评论区广告", st: "待看", who: "匿***88", time: "09-30 08:15" },
  ],
  tickets: [
    { id: "TK-1024", t: "定级做到第 6 题闪退", st: "待接单", cat: "学习", body: "hash-only · 信息不足（演示：仅留痕，客服看不到正文）", time: "09-30 19:02" },
    { id: "TK-1023", t: "想退掉昨日误购", st: "处理中", cat: "付费", body: "用户写：昨日 21:04 误点月卡，未使用，求退。", time: "09-30 10:26" },
  ],
  curTk: "TK-1024",
  orders: [
    { id: "OD-2001", sku: "月度会员", money: "¥19 · 沙盒", equity: "待开通", diff: "无差异", time: "09-30 21:04" },
    { id: "OD-2002", sku: "四级冲刺包", money: "¥49 · 沙盒", equity: "已开通", diff: "无差异", time: "09-29 14:33" },
  ],
  refunds: [
    { id: "RF-301", order: "OD-2001", money: "¥19", ok1: "张三 09-30", ok2: "", st: "待第二审批", inv: "未申请" },
  ],
  media: [
    { id: "m1", t: "there-be 例句音频.mp3", size: "1.2MB", st: "已绑定 d1" },
    { id: "m2", t: "图书馆课文配图.png", size: "480KB", st: "未绑定" },
  ],
  audit: [
    { id: "req-9208", act: "同意记录签署", who: "t-learner-01", time: "09-30 20:11", r: "允许" },
    { id: "req-6fd9", act: "注册门检查", who: "new-0901", time: "09-30 19:58", r: "拒绝" },
    { id: "req-6f01", act: "草稿送审 d1 v3", who: "教研-小李", time: "09-30 18:20", r: "允许" },
  ],
  af: "全部", gf: "全部", cf: "全部", q: "",
};

const M = AdminModel;
const ADBKEY = "yxx-admin-v1";
let stored = null, storageIssue = '';
try {
    const envelope = JSON.parse(localStorage.getItem(ADBKEY) || 'null');
  if (envelope && [1, 2].includes(envelope.v) && envelope.A) stored = envelope.A;
} catch (e) { storageIssue = '旧演示数据无法读取，已载入样例；原存储未删除。'; }
let A;
try { A = M.normalize(ASEED, stored); }
catch (e) { A = M.normalize(ASEED); storageIssue = '旧演示数据结构异常，已载入样例；原存储未删除。'; }
const A_TITLES = { alogin: "管理登录", dash: "工作台", draft: "内容列表", review: "送审与审核", publish: "发布管理", media: "媒体与上传", perm: "权限只读", audit: "审计列表", gov: "治理风控", report: "举报队列", cs: "客服后台", csdetail: "工单详情", shop: "商城后台", refund: "退款开票", ops: "观测与发布门", me: "我的" };
const A_TABS = ["dash", "draft", "gov", "me"];
const DST = { draft: '草稿', review: '待审', l1pass: 'L1 已过·待 L2', active: '工作版本已发布' };
const SST = { active: '在架', off: '普通下架', forced: '强制停止分发', superseded: '历史发布版' };
const AV = {};
// 未提交字段按当前演示身份与记录隔离，不写入共享模型，不被重绘或另一窗口覆盖。
const titleEdits = new Map(), reviewNotes = new Map(), forceForms = new Map(), transferForms = new Map(), replyEdits = new Map();
let renderedEditor = null;
const localKey = id => (A.user || '') + '|' + id;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 编号只用于动作参数；用户文本从不插入内联脚本。
const arg = s => encodeURIComponent(String(s)).replace(/'/g, '%27');
const card = s => '<div class="card">' + s + '</div>';
function abtn(label, handler, allowed = true, small = false) { return '<button class="btn' + (small ? ' sm' : '') + '" onclick="' + handler + '"' + (allowed ? '' : ' disabled') + '>' + label + '</button>'; }
function atoast(m) { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2500); }
function adbSave() {
  try { localStorage.setItem(ADBKEY, JSON.stringify({ v: 2, A })); storageIssue = ''; return true; }
  catch (e) { storageIssue = '本机存储写入失败。未保存的操作请重试；输入内容仍保留在当前页面，刷新前请妥善保留。'; return false; }
}
function acall(fn, message, saved) {
  captureTitle();
  // 拒绝动作不留下半写入的签核或状态；快照用于当前静态模型的原子恢复。
  const before = JSON.stringify(A);
  const beforeUploadToken = uploadToken;
  const toast = document.getElementById('toast'); clearTimeout(toast._h); toast.classList.remove('show');
  try {
    fn();
    if (!adbSave()) { A = JSON.parse(before); if (uploadToken !== beforeUploadToken) A.uploading = false; arender(true); atoast('操作未保存，请恢复存储后重试；输入已保留'); return false; }
    if (saved) saved(); arender(); if (message) atoast(message); return true;
  }
  catch (e) { A = JSON.parse(before); if (uploadToken !== beforeUploadToken) A.uploading = false; atoast(e.message); return false; }
}
function aretrySave() { const ok = adbSave(); arender(true); atoast(ok ? '本机存储已恢复，请重试尚未保存的操作' : storageIssue); }
function atitle(id, value) {
  id = decodeURIComponent(id); const key = localKey(id), d = M.draft(A,id);
  const edit = titleEdits.get(key) || { baseVersion: d.v, baseTitle: d.title, value: d.title };
  edit.value = value; titleEdits.set(key,edit);
}
function captureTitle() {
  const el = document.getElementById('dt'), old = renderedEditor;
  if (!el || !old || el.value === old.displayTitle) return;
  const edit = titleEdits.get(old.key) || { baseVersion: old.version, baseTitle: old.title, value: old.title };
  edit.value = el.value; titleEdits.set(old.key,edit);
}
function aresolveTitle(id, keep) {
  id = decodeURIComponent(id); const d = M.draft(A,id), key = localKey(id), edit = titleEdits.get(key);
  if (keep && edit) { edit.baseVersion = d.v; edit.baseTitle = d.title; }
  else titleEdits.delete(key);
  renderedEditor = null; arender(true); atoast(keep ? '本地标题已保留，保存时将基于最新版本建立新稿' : '已采用最新标题');
}
function agoBack() {
  const r = (location.hash || '#/dash').slice(2);
  anav(r === 'csdetail' ? '#/cs' : r === 'review' ? '#/draft' : '#/dash');
}
function anav(h) { location.hash = h; }
function aarm(el, fn) {
  if (el.dataset.armed) { clearTimeout(el._confirmTimer); delete el.dataset.armed; el.classList.remove('danger'); el.textContent = el.dataset.label; fn(); return; }
  el.dataset.armed = '1'; el.dataset.label = el.textContent; el.classList.add('danger'); el.textContent = '再点一次确认';
  el._confirmTimer = setTimeout(() => { delete el.dataset.armed; el.classList.remove('danger'); if (el.isConnected) el.textContent = el.dataset.label; }, 3000);
}
function adraft() { return M.draft(A, A.cur); }
function aopen(id) { A.cur = decodeURIComponent(id); adbSave(); anav('#/review'); }
function atopen(id) { A.curTk = decodeURIComponent(id); adbSave(); anav('#/csdetail'); }
function amode() { acall(() => M.mode(A), '模式已切换，工作副本须重新送审；已发布版保留'); }
function anewDraft() { if (acall(() => M.create(A))) anav('#/review'); }
function asubmit(id) { acall(() => M.submit(A, decodeURIComponent(id)), '已补齐当前版本演示材料并送审'); }
function aedit(id, expected) {
  captureTitle(); const rawId = decodeURIComponent(id), edit = titleEdits.get(localKey(rawId)), d = M.draft(A,rawId);
  if (edit && (edit.baseVersion !== d.v || edit.baseTitle !== d.title)) { arender(true); return atoast('先对比另一窗口的最新标题，再选择采用或保留本地修改'); }
  const value = document.getElementById('dt').value;
  acall(() => M.edit(A,rawId,value,expected), '新版本已保存，旧报告和签核失效', () => { titleEdits.delete(localKey(rawId)); renderedEditor = null; });
}
function aapprove(id, level, expected) { acall(() => M.approve(A, decodeURIComponent(id), level,expected), '操作已保存（静态演示）'); }
function anote(id, value) { const rawId = decodeURIComponent(id), key = localKey(rawId); const note = reviewNotes.get(key) || { version: M.draft(A,rawId).v, mode: A.mode }; note.value = value; reviewNotes.set(key,note); }
function areviewRebase(id) { const rawId = decodeURIComponent(id), note = reviewNotes.get(localKey(rawId)); if (note) { note.version = M.draft(A,rawId).v; note.mode = A.mode; } arender(true); }
function adecide(id, level, decision, expected) {
  const rawId = decodeURIComponent(id), el = document.getElementById('review-note');
  const note = reviewNotes.get(localKey(rawId));
  if (note && (note.version !== M.draft(A,rawId).v || note.mode !== A.mode)) return atoast('稿件或模式已变化，请先核对最新内容再确认审核理由');
  const reason = el ? el.value : note?.value;
  acall(() => M.decide(A,rawId,level,decision,reason,expected), '审核意见已保存，已退回新草稿供作者整改（演示）', () => reviewNotes.delete(localKey(rawId)));
}
function aack(id, decisionId) { acall(() => M.acknowledge(A,decodeURIComponent(id),decodeURIComponent(decisionId)),'已确认收到整改意见（演示）'); }
function aforceOpen(id) { const rawId = decodeURIComponent(id), key = localKey(rawId); forceForms.set(key,{ reason: forceForms.get(key)?.reason || '', version: M.live(M.draft(A,rawId))?.v }); arender(true); }
function aforceReason(id, text) { const f = forceForms.get(localKey(decodeURIComponent(id))); if (f) f.reason = text; }
function aforceCancel(id) { forceForms.delete(localKey(decodeURIComponent(id))); arender(true); }
function astop(id, force, version) {
  const rawId = decodeURIComponent(id), f = forceForms.get(localKey(rawId));
  acall(() => M.stop(A,rawId,force,f ? f.reason : '',force ? f?.version : version), force ? '处置原因已保存，当前版本已强停且禁止普通恢复（演示）' : '当前版本已普通下架（演示）', () => forceForms.delete(localKey(rawId)));
}
function arestore(id, version) { acall(() => M.restore(A, decodeURIComponent(id), version), '合格旧版已恢复，目录同步中（演示）'); }
function arevoke(id, version) { acall(() => M.revoke(A, decodeURIComponent(id), version), '版权已标失效，该版本禁止恢复（演示）'); }
function agrecord(id) { acall(() => { M.require(A, 'gov'); const g = A.gov.find(x => x.id === decodeURIComponent(id)); if (!g || g.st !== '待建档') throw new Error('当前案件不能重复建档'); g.st = '已建档'; M.log(A, '风险线索建档 ' + g.id + '，未执行处置'); }); }
function atransfer(id, field, value) {
  const key = localKey(decodeURIComponent(id)), f = transferForms.get(key) || { recipient: '', reason: '' };
  if (['recipient','reason'].includes(field)) f[field] = value; transferForms.set(key,f);
}
function atact(id, action) {
  const reply = document.getElementById('crep'), rawId = decodeURIComponent(id), f = transferForms.get(localKey(rawId)) || {};
  if (reply) replyEdits.set(localKey(rawId),reply.value);
  acall(() => M.ticketAction(A,rawId,action,reply ? reply.value : '',f), action === 'upgrade' ? '升级信息已保存，等待指定接收人接收（演示）' : '工单状态已保存（演示）', () => { if (action === 'upgrade') transferForms.delete(localKey(rawId)); replyEdits.delete(localKey(rawId)); });
}
function atdraft(id, text) { try { const rawId = decodeURIComponent(id), t = M.ticket(A,rawId); if (t.st !== '处理中' || t.hashOnly || t.assignee !== A.user) return; const old = t.replyDraft; replyEdits.set(localKey(rawId),text); t.replyDraft = text; if (adbSave()) replyEdits.delete(localKey(rawId)); else { t.replyDraft = old; atoast(storageIssue); } } catch (e) { atoast(e.message); } }
function arApprove(id) { acall(() => M.refund(A, decodeURIComponent(id)), '第二审批已保存（沙盒）'); }
function ainvoice(id) { acall(() => { M.require(A, 'refund'); const r = A.refunds.find(x => x.id === decodeURIComponent(id)); if (!r || r.st !== '通过·待开票' || r.inv !== '未申请') throw new Error('当前无法重复申请开票'); r.inv = '处理中'; M.log(A, '申请开票 ' + r.id + '（沙盒）'); }); }
let uploadToken = 0;
function acancelUpload() { uploadToken++; A.uploading = false; }
function aidentity(account) { acall(() => { M.identity(A, account); acancelUpload(); }); }
function alogout() { acancelUpload(); A.user = null; A.role = ''; adbSave(); anav('#/alogin'); }
function adoLogin() {
  const user = document.getElementById('au').value.trim();
  const password = document.getElementById('ap').value;
  if (!user || !password.trim()) return atoast('账号或密码不正确');
  acall(() => M.identity(A, user), '登录成功（演示）');
  if (A.user) anav('#/dash');
}
function afilter(field, value) { if (!['af', 'gf', 'cf'].includes(field)) return; A[field] = value; adbSave(); arender(); }
function asearch(value) { A.q = value; arender2(); }
function amedia(open) { acall(() => { M.require(A, 'media'); A.mediaOpen = open; if (!open) acancelUpload(); }); }
function amUpload() {
  const el = document.getElementById('mup');
  if (!el || A.uploading) return;
  try { M.require(A, 'media'); if (!A.mediaOpen) throw new Error('媒体演示开关未开启'); }
  catch (e) { return atoast(e.message); }
  const token = ++uploadToken, actor = A.user;
  A.uploading = true; arender();
  setTimeout(() => {
    if (token !== uploadToken || actor !== A.user || !M.can(A, 'media') || !A.mediaOpen) return;
    A.uploading = false; acall(() => A.media.push({ id: 'm' + (A.seq++), t: '样例音频 ' + (A.media.length + 1) + '.mp3', size: '0.9MB · 样例', st: '未绑定 · 未传输真实字节' }), '模拟完成，未上传真实对象');
  }, 1200);
}
AV.alogin = () => card('<h2>管理登录</h2><p class="d">演示账号＋任意非空密码。不会保存密码，不连接 IAM。</p><label class="lb" for="au">账号</label><input id="au" value="teach-li"><label class="lb" for="ap">密码</label><input id="ap" type="password" autocomplete="off">' + abtn('登录', 'adoLogin()') + '<p class="d">teach-li / wangfang：L1；zhaolei：L2；chenchen：运营；zhangsan / liucai：财务；support-wu：二线客服。未知账号拒绝。</p>');
AV.dash = () => {
  const k = M.metrics(A), pending = A.drafts.filter(d => ['review','l1pass'].includes(d.st));
  const kpi = [[k.active,'在架内容'],[k.pending,'待审工作版'],[k.risk,'风险待建档']].filter(([value])=>value !== null).map(([value,label])=>'<div><b>'+value+'</b><span>'+label+'</span></div>').join('');
  let todo = '';
  if (M.can(A, 'content.read')) todo += pending.map(d => '<div class="rowline"><div><b>' + esc(d.title) + '</b><p class="d">v' + d.v + ' · ' + DST[d.st] + '</p></div>' + abtn('去审 →', "aopen('" + arg(d.id) + "')", true, true) + '</div>').join('');
  if (M.can(A, 'gov')) todo += A.gov.filter(g => g.st === '待建档').map(g => '<div class="rowline"><div><b>' + esc(g.id) + ' 待建档</b></div>' + abtn('去看 →', "anav('#/gov')", true, true) + '</div>').join('');
  if (M.can(A, 'refund')) todo += A.refunds.filter(r => r.st === '待第二审批').map(r => '<div class="rowline"><div><b>' + esc(r.id) + ' 待第二审批</b></div>' + abtn('去看 →', "anav('#/refund')", true, true) + '</div>').join('');
  const entries = Object.entries(A_TITLES).filter(([r]) => M.routes[r] && M.page(A,r) && r !== 'csdetail');
  return card('<p class="d">' + esc(A.user) + '（' + esc(A.role) + '）· 本机样例</p><h2>📊 当前概览</h2><div class="kpis">' + (kpi || '<p class="d">当前身份无此类指标权限。</p>') + '</div><p class="d">口径：授权范围内本机当前状态快照；内容按编号去重，草稿不计待审。非“今日新增”、非线上指标。随操作重算。</p>') + card('<h2>📌 授权待办</h2>' + (todo || '<p class="d">当前身份暂无可处理待办。</p>')) + card('<h2>🧭 管理入口</h2>' + entries.map(([r,t]) => '<button class="opt" onclick="anav(\'#/' + r + '\')">' + esc(t) + ' ›</button>').join(''));
};
AV.draft = () => {
  const list = A.drafts.filter(d => !A.q || (d.title + d.id).includes(A.q));
  return card('<h2>📝 内容列表</h2><input id="aq" aria-label="搜索稿件" placeholder="搜标题/编号" value="' + esc(A.q) + '" oninput="asearch(this.value)"><p class="d">当前模式：<b>' + (A.mode === 'simple' ? '简审演示' : '双签演示') + '</b></p>' + abtn('切换演示模式', 'amode()', M.can(A,'content.mode'), true) + '<p class="d">简审一人可发只用于本机演示。正式四主体分离及模式变更待负责人签收。</p>' + list.map(d => '<div class="rowline"><div><b>' + esc(d.title) + '</b><p class="d">' + esc(d.id) + ' · 工作 v' + d.v + ' ' + DST[d.st] + ' · 在架 ' + (M.live(d) ? 'v' + M.live(d).v : '无') + '</p></div>' + abtn('打开 →', "aopen('" + arg(d.id) + "')", true, true) + '</div>').join('') + (list.length ? '' : '<p class="d">没有符合的稿件。</p>') + abtn('＋ 新建草稿', 'anewDraft()', M.can(A,'content.edit')));
};
AV.review = () => {
  const d = adraft(), id = arg(d.id), miss = M.missing(A,d), s = M.live(d);
  let out = card(abtn('← 内容列表', "anav('#/draft')", true, true) + '<h2>' + esc(d.title) + '</h2><p class="d">' + esc(d.id) + ' · 工作 v' + d.v + ' · ' + DST[d.st] + '</p><p class="d">创建人：' + esc(d.createdBy) + ' · 编辑人：' + esc(d.editorBy) + ' · 申请人：' + esc(d.submittedBy) + '</p><p class="d">在架版本：' + (s ? 'v' + s.v + ' · ' + esc(s.title) : '无') + '</p>' + (d.legacyState ? '<p class="d">旧缓存状态“' + esc(d.legacyState) + '”已留存核对；缺版本签核，不作为已发布事实。</p>' : ''));
  const immutable = d.snapshots.some(x => x.v === d.v);
  out += card('<h2>送审材料</h2><p class="d">' + (miss.length ? miss.map(esc).join('；') : '当前版本版权、报告模式与媒体样例齐全') + '</p>' + abtn('演示：补齐并送审', "asubmit('" + id + "')", M.can(A,'content.edit') && !immutable) + '<p class="d">生成本版本的样例材料；正式版权与审核报告仍须由服务验证。</p>');
  if (A.mode === 'simple') out += card('<h2>简审演示</h2><p class="d">授权人员一人可发，按版本留痕。正式模式变更尚未批准。</p>' + abtn('简审通过并发布', "aapprove('" + id + "','simple',"+d.v+")", M.can(A,'content.simple') && !miss.length && d.st === 'review'));
  else out += card('<h2>双签演示</h2><p class="d">申请人及编辑人不得担任本版本 L1 或 L2；L1/L2 须不同。正式独立 release 流程仍遵循上游设计。</p><p class="d">L1：' + esc(d.l1by || '待审') + '</p>' + abtn('L1 通过', "aapprove('" + id + "','l1',"+d.v+")", M.can(A,'content.l1') && A.user !== d.submittedBy && A.user !== d.editorBy && !miss.length && d.st === 'review') + '<p class="d">L2：' + esc(d.l2by || '待审') + '</p>' + abtn('L2 通过并发布', "aapprove('" + id + "','l2',"+d.v+")", M.can(A,'content.l2') && A.user !== d.submittedBy && A.user !== d.editorBy && A.user !== d.l1by && !miss.length && d.st === 'l1pass'));
  const level = A.mode === 'simple' ? 'simple' : A.role === 'reviewer-l1' ? 'l1' : 'l2';
  const canDecide = M.can(A,'content.'+level) && (level === 'simple' ? d.st === 'review' : A.user !== d.editorBy && A.user !== d.submittedBy && (level === 'l1' ? d.st === 'review' : d.st === 'l1pass' && A.user !== d.l1by));
  const note = reviewNotes.get(localKey(d.id)), noteConflict = note && (note.version !== d.v || note.mode !== A.mode);
  if (canDecide) out += card('<h2>退回整改</h2><label class="lb" for="review-note">审核理由</label><textarea id="review-note" oninput="anote(\''+id+'\',this.value)">'+esc(note?.value || '')+'</textarea>'+(noteConflict ? '<p role="alert">稿件或模式已更新，原审核理由仍保留；核对最新内容后再确认。</p>'+abtn('已核对最新稿件，保留审核理由',"areviewRebase('"+id+"')") : '')+abtn('要求修改',"adecide('"+id+"','"+level+"','CHANGES_REQUESTED',"+d.v+")",!noteConflict)+abtn('驳回',"adecide('"+id+"','"+level+"','REJECTED',"+d.v+")",!noteConflict)+'<p class="d">决定与理由保留在原版本；退回新草稿后需保存整改修改，再重新补齐送审。</p>');
  if (d.reviewDecisions.length) out += card('<h2>审核意见与整改记录</h2>'+d.reviewDecisions.slice().reverse().map(x => '<p><b>v'+x.version+' · '+(x.decision === 'REJECTED' ? '驳回' : '要求修改')+'</b><br>'+esc(x.reason)+'</p><p class="d">'+esc(x.who+' · '+x.time+' · 通知作者 '+x.recipient)+' · '+(x.acknowledged ? '作者已确认' : '待作者确认')+'</p>'+(x.recipient === A.user && !x.acknowledged ? abtn('确认收到整改意见',"aack('"+id+"','"+arg(x.id)+"')") : '')).join(''));
  const edit = titleEdits.get(localKey(d.id)), conflict = edit && (edit.baseVersion !== d.v || edit.baseTitle !== d.title);
  if (conflict) out += card('<h2>另一窗口已更新，请先对比</h2><p>编辑起点 v'+edit.baseVersion+'：'+esc(edit.baseTitle)+'</p><p>我的未保存标题：'+esc(edit.value)+'</p><p>最新 v'+d.v+'：'+esc(d.title)+'</p>'+abtn('采用最新标题',"aresolveTitle('"+id+"',false)")+abtn('保留本地标题，基于最新版本保存',"aresolveTitle('"+id+"',true)"));
  return out + card('<h2>版本与记录</h2><p class="d">编辑新建工作版本，使旧报告和签核失效；已发布快照不随编辑改变。</p>'+(d.needsRevision ? '<p role="status">请先保存整改修改，再重新送审。</p>' : '')+'<label class="lb" for="dt">改标题</label><input id="dt" oninput="atitle(\''+id+'\',this.value)" value="' + esc(edit ? edit.value : d.title) + '"' + (M.can(A,'content.edit') ? '' : ' disabled') + '>' + abtn('保存新版本 v' + (d.v+1), "aedit('" + id + "'," + d.v + ")", M.can(A,'content.edit') && !conflict));
};
AV.publish = () => card('<h2>🚀 发布 / 下线 / 回滚</h2><p class="d">每个内容版本、每次操作各记同步结果；目录异步演示 1.5s，刷新继续恢复。强停或版权失效版本禁止恢复。下列均为本机模拟。</p>') + A.drafts.map(d => {
  const live = M.live(d), id = arg(d.id), allowed = M.can(A,'content.publish');
  let out = '<h2>' + esc(d.id) + ' · ' + esc(live ? live.title : d.title) + '</h2><p class="d">当前在架：' + (live ? 'v'+live.v : '无') + '</p>';
  if (live) out += abtn('普通下架', "aarm(this,()=>astop('" + id + "',false,"+live.v+"))", allowed || (M.can(A,'content.withdraw') && live.mode === 'simple' && live.approvals.simple.who === A.user), true) + abtn('强制停止分发', "aforceOpen('" + id + "')", allowed, true);
  const force = forceForms.get(localKey(d.id));
  if (live && allowed && force) out += '<label class="lb" for="force-'+id+'">强制停止原因 · '+esc(d.id)+' · v'+force.version+'</label><textarea id="force-'+id+'" oninput="aforceReason(\''+id+'\',this.value)">'+esc(force.reason)+'</textarea>'+(force.version !== live.v ? '<p role="alert">在架版本已变化，原原因已保留；请核对最新版本 v'+live.v+'，再重新打开强停确认。</p>' : '')+abtn('确认强停 '+esc(d.id),"aarm(this,()=>astop('"+id+"',true))",force.version === live.v)+abtn('取消强停 '+esc(d.id),"aforceCancel('"+id+"')");
  out += d.snapshots.map(s => '<div class="rowline"><div><b>v' + s.v + ' · ' + esc(s.title) + '</b><p class="d">' + SST[s.status] + ' · ' + (s.copy ? '版权有效' : '版权失效') + '</p>'+(s.status === 'forced' ? '<p>禁供原因：'+esc(s.stopReason || '旧记录未保存原因，待责任人核对；仍禁止普通恢复')+'</p><p class="d">'+esc((s.stoppedBy || '')+' · '+(s.stoppedAt || ''))+'</p>' : '')+'</div></div>' + (s.status !== 'active' ? abtn((s.v < d.publishedVersion ? '回滚旧版 v' : '恢复上架 v') + s.v, "aarm(this,()=>arestore('" + id + "'," + s.v + "))", allowed && M.qualified(s), true) : '') + abtn('版权失效 v'+s.v, "aarm(this,()=>arevoke('" + id + "'," + s.v + "))", allowed && s.copy, true)).join('');
  if (!d.snapshots.length) out += '<p class="d">没有合格发布快照。旧缓存不补造签核。</p>';
  if (d.restorePoint) out += '<p class="d">恢复点：v' + d.restorePoint.version + (d.restorePoint.targetVersion ? ' → v' + d.restorePoint.targetVersion : '') + ' · ' + esc(d.restorePoint.operation) + '</p>';
  out += d.sync.slice(-4).map(op => '<p class="d">v' + op.version + ' ' + esc(op.operation) + '：<b>' + (op.status === 'done' ? '已同步（演示）' : '同步中（演示）') + '</b> · ' + esc(op.id) + '</p>').join('');
  return card(out);
}).join('');
AV.media = () => card('<h2>🎬 媒体与上传</h2><p class="d">R2 对象字节未接通。开关只显示样例进度，不代表真实服务可用。</p>' + abtn('未接通', 'amedia(false)', true, true) + abtn('已接通（演示）', 'amedia(true)', true, true)) + (A.mediaOpen ? card('<h2>模拟上传</h2>' + abtn(A.uploading ? '模拟处理中…' : '传一个音频 →', 'amUpload()', !A.uploading) + '<div id="mup"></div>' + A.media.map(m => '<p><b>' + esc(m.t) + '</b><br>' + esc(m.size) + ' · ' + esc(m.st) + '</p>').join('')) : card('<h2>媒体服务未接通</h2><p class="d">真实上传、校验、绑定未实现；发布材料仅为样例。</p>'));
AV.perm = () => card('<h2>🔑 权限只读</h2><p class="d">仅运营身份可看本机演示矩阵，无角色修改入口。正式 iam.policy.read 尚待实现。</p>' + Object.entries(M.identities).map(([account,[user,role]]) => '<p><b>' + esc(account) + ' · ' + esc(user) + '</b><br>' + esc(role) + '：' + esc(M.grants[role].join(' / ')) + '</p>').join(''));
AV.audit = () => {
  const list = A.audit.filter(a => (A.af === '全部' || a.r === A.af) && (!A.q || (a.act+a.who+a.id).includes(A.q)));
  return card('<h2>📜 审计</h2><p class="d">本机操作记录＋种子样例；非不可篡改审计。导出 internal-only 未接通。</p>' + ['全部','允许','拒绝'].map(f => abtn(f, "afilter('af','" + f + "')", true, true)).join('') + '<input id="aq" aria-label="搜索审计" placeholder="搜动作/账号/编号" value="' + esc(A.q) + '" oninput="asearch(this.value)">' + (list.length ? list.map(a => '<div class="rowline"><div><b>' + esc(a.act) + '</b><p class="d">' + esc(a.id) + ' · ' + esc(a.who.slice(0,3)) + '*** · ' + esc(a.time) + '</p></div><span class="tag">' + esc(a.r) + '</span></div>').join('') : '<p class="d">暂无匹配记录。</p>'));
};
AV.gov = () => card('<h2>🛡️ 治理 · 风险区</h2><p class="d">仅记录线索建档，不执行隔离/处罚；R3 处置待决。</p>' + ['全部','待建档','已建档','已隔离'].map(f => abtn(f, "afilter('gf','" + f + "')", true, true)).join('')) + A.gov.filter(g => A.gf === '全部' || g.st === A.gf).map(g => card('<b>' + esc(g.id + ' · ' + g.t) + '</b><p class="d">' + esc(g.st) + ' · 来源：' + esc(g.src) + '</p>' + (g.st === '待建档' ? abtn('建档（记录线索）', "agrecord('" + arg(g.id) + "')") : '<p class="d">无处置入口；已隔离行是历史样例。</p>'))).join('');
AV.report = () => card('<h2>🚩 举报队列</h2><p class="d">只读样例，脱敏，无 R3 处置入口。</p>' + A.reports.map(r => '<p><b>' + esc(r.id+' · '+r.t) + '</b><br>' + esc(r.who+' · '+r.st+' · '+r.time) + '</p>').join(''));
AV.cs = () => card('<h2>💬 客服后台</h2><p class="d">信息不足的 hash-only 工单只可请求补充或升级，不可回复关闭。</p>' + ['全部','学习','付费'].map(f => abtn(f, "afilter('cf','" + f + "')", true, true)).join('')) + A.tickets.filter(t => A.cf === '全部' || t.cat === A.cf).map(t => card('<h2>' + esc(t.id+' · '+t.t) + '</h2><p class="d">' + esc(t.cat+' · '+t.st) + (t.hashOnly ? ' · 信息不足' : '') + '</p><p>' + esc(t.body) + '</p>' + abtn('打开 →', "atopen('" + arg(t.id) + "')"))).join('');
AV.csdetail = () => {
  const t = M.ticket(A,A.curTk), id=arg(t.id), process=t.st==='处理中' && t.assignee===A.user;
  let controls = '';
  if (t.st === '待接单') controls = abtn('接单', "atact('" + id + "','claim')");
  else if (process || (t.st === '升级信息待补全' && t.assignee === A.user)) {
    if (process) controls = (t.hashOnly ? '<p class="d">信息不足：不能回复或标已解决。</p>' : '<label class="lb" for="crep">回复（本机演示）</label><textarea id="crep" placeholder="写回复…" oninput="atdraft(\'' + id + '\',this.value)">' + esc(replyEdits.get(localKey(t.id)) ?? t.replyDraft) + '</textarea>' + abtn('回复并关闭', "atact('" + id + "','close')")) + abtn('请求补充信息', "atact('" + id + "','clarify')");
    const f = transferForms.get(localKey(t.id)) || { recipient: '', reason: '' };
    controls += '<h3>升级交接</h3><label class="lb" for="upgrade-recipient">接收人</label><select id="upgrade-recipient" onchange="atransfer(\''+id+'\',\'recipient\',this.value)"><option value="">请选择接收人</option>'+Object.entries(M.identities).filter(([, [user,role]])=>user !== A.user && (M.grants[role] || []).includes('cs')).map(([account,[user]])=>'<option value="'+account+'"'+(f.recipient === account ? ' selected' : '')+'>'+esc(user)+'</option>').join('')+'</select><label class="lb" for="upgrade-reason">升级原因</label><textarea id="upgrade-reason" oninput="atransfer(\''+id+'\',\'reason\',this.value)">'+esc(f.reason)+'</textarea>'+abtn('提交升级，等待接收',"atact('"+id+"','upgrade')");
  }
  else if (t.st === '待二线接收' && t.transfer && t.transfer.recipient === A.user) controls = abtn('确认接收升级工单',"atact('"+id+"','accept')");
  else controls = '<p class="d">' + (t.st === '已关闭' ? '工单已关闭，处理入口停用。' : '已转二线/待补充，或由其他客服处理；不能重复完成。') + '</p>';
  return card(abtn('← 客服后台', "anav('#/cs')", true, true) + '<h2>' + esc(t.id+' · '+t.t) + '</h2><p class="d">' + esc(t.st) + ' · 客服：' + esc(t.assignee || '未接单') + '</p><p>' + esc(t.body) + '</p>'+(t.transfer ? '<p>交接：'+esc(t.transfer.from+' → '+t.transfer.recipient)+' · '+esc(t.transfer.status)+'</p><p>升级原因：'+esc(t.transfer.reason)+'</p>' : '')) + card('<h2>处理</h2>' + controls) + card('<h2>处理记录</h2>' + (t.replies.map(r => '<p><b>' + esc(r.who) + ' 回复：</b>' + esc(r.text) + '</p>').join('') || '<p class="d">暂无回复。</p>') + t.events.map(e => '<p class="d">' + esc(e.who+' · '+e.action+' · '+e.status+' · '+e.time+(e.recipient ? ' · 接收人 '+e.recipient+' · '+e.reason : '')) + '</p>').join(''));
};
AV.shop = () => card('<h2>🛒 商城后台</h2><p class="d">全部沙盒样例；不扣款、不发真实权益。对账服务未接通，不宣称对账成功。</p>' + A.orders.map(o => '<p><b>' + esc(o.id+' · '+o.sku) + '</b><br>资金：' + esc(o.money) + '<br>权益：' + esc(o.equity) + '<br>差异：' + esc(o.diff) + '</p>').join(''));
AV.refund = () => A.refunds.map(r => card('<h2>🧾 ' + esc(r.id+' · '+r.order) + '</h2><p class="d">金额 ' + esc(r.money) + ' · 沙盒 · ' + esc(r.st) + '</p><p>第一审批：' + esc(r.ok1 || '—') + '</p><p>第二审批：' + esc(r.ok2 || '—') + '</p>' + (r.st === '待第二审批' ? abtn('作为第二审批人通过', "arApprove('" + arg(r.id) + "')", M.can(A,'refund') && A.user !== (r.firstBy || (r.ok1 || '').split(' ')[0])) : '<p>开票：' + esc(r.inv) + '</p>' + abtn('申请开票', "ainvoice('" + arg(r.id) + "')", r.st === '通过·待开票' && r.inv === '未申请')))).join('');
AV.ops = () => card('<h2>🖥️ 观测与发布门</h2><p class="d">探针、SBOM、依赖扫描、兼容与回滚演练均未接正式证据。不能标可发布。</p><p>当前：未验证 · 不可据此上线</p>');
AV.me = () => card('<h2>' + esc(A.user || '未登录') + '</h2><p class="d">' + esc(A.role) + ' · 演示身份；正式权限由服务端判定。</p>') + card('<h2>切换身份（演示）</h2>' + Object.entries(M.identities).map(([account,[user,role]]) => abtn(esc(user+' · '+role), "aidentity('" + account + "')", true, true)).join('')) + card(abtn('退出登录', 'aarm(this,alogout)'));
function arender(preserve = false) {
  captureTitle();
  let r = (location.hash || '#/dash').replace('#/', '');
  if (!AV[r]) r = 'dash';
  if (!A.user) r = 'alogin';
  const view = document.getElementById('view'), scroll = view.scrollTop;
  document.getElementById('title').textContent = A_TITLES[r];
  document.getElementById('bk').style.visibility = ['alogin','dash'].includes(r) ? 'hidden' : 'visible';
  document.getElementById('tabs').style.display = A_TABS.includes(r) && A.user ? 'flex' : 'none';
  document.querySelectorAll('#tabs a').forEach(a => { a.classList.toggle('on',a.dataset.t === r); a.style.display = M.page(A,a.dataset.t) ? '' : 'none'; });
  let html;
  try { html = M.page(A,r) ? AV[r]() : card('<h2>无权访问</h2><p class="d">当前身份无此页面权限；不会伪装成空数据。</p>' + abtn('切换演示身份', "anav('#/me')")); }
  catch (e) { html = card('<h2>记录暂不可用</h2><p class="d">' + esc(e.message) + '</p>' + abtn('返回工作台', "anav('#/dash')")); }
  view.innerHTML = (storageIssue ? card('<p role="alert">' + esc(storageIssue) + '</p>'+abtn('重试本机保存','aretrySave()')) : '') + html;
  const currentDraft = A.drafts.find(d => d.id === A.cur);
  renderedEditor = r === 'review' && M.page(A,r) && currentDraft ? { key: localKey(A.cur), version: currentDraft.v, title: currentDraft.title, displayTitle: titleEdits.get(localKey(A.cur))?.value ?? currentDraft.title } : null;
  view.scrollTop = preserve ? scroll : 0;
}
function arender2() {
  const old = document.getElementById('aq'), pos = old ? old.selectionStart : 0;
  arender(true);
  const next = document.getElementById('aq');
  if (old && next) { next.focus(); next.setSelectionRange(pos,pos); }
}
window.addEventListener('hashchange', () => arender());
window.addEventListener('storage', e => {
  if (e.key !== ADBKEY || !e.newValue) return;
  try {
    captureTitle(); const envelope = JSON.parse(e.newValue);
    if (![1,2].includes(envelope.v) || !envelope.A) throw new Error('无有效数据');
    const currentView = { user: A.user, role: A.role, cur: A.cur, curTk: A.curTk, q: A.q, af: A.af, gf: A.gf, cf: A.cf };
    const next = M.normalize(ASEED,envelope.A); acancelUpload(); A = Object.assign(next,currentView); A.uploading = false;
    arender(true); atoast('另一窗口已更新；本地未保存标题已保留，请对比最新版本');
  }
  catch (err) { atoast('另一窗口数据不可读，保留当前页面'); }
});
setInterval(() => {
  if (storageIssue) return;
  const before = JSON.stringify(A);
  if (!M.settle(A)) return;
  if (!adbSave()) A = JSON.parse(before);
  // 只更新同步状态所在页，不打断标题输入或客服回复。
  if (location.hash === '#/publish' || location.hash === '#/dash') arender(true);
}, 500);
if (stored && !storageIssue) adbSave();
A.uploading = false;
arender();
