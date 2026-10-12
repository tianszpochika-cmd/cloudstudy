/* 语学星移动端整机交互稿 · 静态数据 · 无后端 */
const S = {
  user: "演示账号", gate: "PASS", birthDate: null, consents: Object.fromEntries(["TERMS", "PRIVACY", "ADULT_LEARNING"].map(key => [key, { agreed: true, version: "b30-consent-v1", source: "演示样例" }])), goal: null, staff: false, quiz: { i: 0, score: 0, sel: null, done: false },
  mistakes: [{ t: "There ___ two books on the desk.", why: "定位：语法待补", kind: "sentence" }, { t: "abandon", why: "定位：词汇待补", kind: "word" }, { t: "Hardly had I arrived when it rained.", why: "定位：阅读待补", kind: "sentence" }], plan: false, today: [{ id: "t1", group: "g1", t: "语法 · There be 句型", min: 5, kind: "grammar", done: false, right: 0, total: 3 }, { id: "t2", group: "r1", t: "阅读 · 图书馆的一天", min: 8, kind: "reading", done: false, right: 0, total: 2 }],
  shelf: ["四级词汇 B1", "零基础 A1", "六级 B2", "商务口语", "雅思备考", "生活英语"],
  lastRead: { book: "四级词汇红宝书", ch: "第二章 核心 1500" },
  msgs: [{ t: "欢迎来到语学星", d: "先定级，3 分钟出报告", read: false }, { t: "今日任务已生成", d: "语法 2 道", read: false }],
  streak: 1, consentV: "b30-consent-v1", minutes: 15,
};
const SET = { study: true, report: true, sys: false, slot: "morning", theme: "follow", uilang: "zh-CN", content: "en-US" };
const STM = { freeze: 2, repaired: [] };
function stmRepair(d) { if (STM.freeze <= 0) { toast("Freeze 用完了（演示）"); return; } if ((WCAL[d] || 0) > 0) return; WCAL[d] = 10; STM.freeze--; STM.repaired.push(d); toast("已补签 " + d + " 日（演示，剩 " + STM.freeze + " Freeze）"); render(); }
/* ---------- 演示数据本机持久化（localStorage，仅原型；会话级开关不存） ---------- */
const DBKEY = "yxx-ui-v2-" + (window.DEMO_SURFACE || "mobile") + "-" + DEMO_CURRENT_PERSONA;
function dbSave() { try {
  lmSavePractice(); lmSaveWriting(); lmSaveWords(); lmSaveListening(); lmSaveTimed();
  const snapshot = { v: 4, learning: LM,
    S: { user: S.user, gate: S.gate, birthDate: S.birthDate, goal: S.goal, minutes: S.minutes, plan: S.plan, consents: S.consents, consentV: S.consentV, mistakes: S.mistakes, today: S.today, streak: S.streak, lastRead: S.lastRead, quick: S.quick, fav: S.fav, quiz: S.quiz },
    SH: {q:SH.q,hist:SH.hist.slice(0,5)}, SET, SRSQ, WCAL, STM, BKpos: BK.pos, BKcur: BK.cur, BKch: BK.ch, PR, SRS, DRb: { ...DR }, BKlv: BK.lv, AX,
    SUPlist: SUP.list, SUPstate: { draft: SUP.draft, cat: SUP.cat, cur: SUP.cur, from: SUP.from }, PV, RF: RF_ORDERS, PAY, GC, TEAM: WD_TEAM.done, CHEST: WD_CHEST.map(c => c.st),
    ACH: WD_ACH.map(a => ({ st: a.st, p: a.p })), MSGS: MSGS.map(m => m.read) };
  localStorage.setItem(demoStorageKey(), JSON.stringify(snapshot));
  window.DEMO_LAST_SNAPSHOT = JSON.parse(JSON.stringify(snapshot)); window.DEMO_STORAGE_FAILED=false; const alert=document.getElementById("storage-alert");if(alert)alert.hidden=true;return true;
} catch (e) { if(window.DEMO_LAST_SNAPSHOT) restoreDemoSnapshot(structuredClone(window.DEMO_LAST_SNAPSHOT)); window.DEMO_STORAGE_FAILED = true; const message = document.getElementById("storage-alert"); if (message) { message.hidden=false; message.textContent="未保存：本机存储不可用，操作已恢复。请允许存储后重试。"; } toast("未保存：本机存储不可用，操作已恢复。请允许存储后重试。");return false; } }
function restoreDemoSnapshot(d) { if (d.learning) Object.assign(LM, d.learning);
  Object.assign(S, { user: d.S.user, gate: d.S.gate, birthDate: d.S.birthDate || null, goal: d.S.goal, minutes: d.S.minutes, plan: d.S.plan, consents: d.S.consents || {}, consentV: d.S.consentV || "b30-consent-v1", mistakes: d.S.mistakes, today: d.S.today, streak: d.S.streak, lastRead: d.S.lastRead, quick: d.S.quick, fav: d.S.fav || [] });
  if (d.S.quiz && Array.isArray(d.S.quiz.answers)) S.quiz = d.S.quiz;
  if (d.PR) Object.assign(PR, d.PR);
  if (d.SRS) Object.assign(SRS, d.SRS);
  Object.assign(SH,d.SH||{q:"",hist:[]});
  Object.assign(SET, d.SET); SRSQ.length = 0; d.SRSQ.forEach(x => SRSQ.push(x));
  Object.keys(WCAL).forEach(k => delete WCAL[k]); Object.assign(WCAL, d.WCAL); Object.assign(STM, d.STM);
  Object.assign(DR, d.DRb); DR.i = d.DRb.i || 0; BK.lv = d.BKlv; if (d.BKpos) BK.pos = d.BKpos; if (d.BKcur) BK.cur = d.BKcur; if (d.BKch != null) BK.ch = d.BKch; Object.assign(AX, d.AX);
  if (Array.isArray(d.SUPlist)) SUP.list = d.SUPlist; if (d.SUPstate) Object.assign(SUP, d.SUPstate);
  if (d.PV) Object.assign(PV, d.PV);
  if (Array.isArray(d.RF)) RF_ORDERS.splice(0, RF_ORDERS.length, ...d.RF.filter(r => r && typeof r.id === "string" && typeof r.t === "string" && Number.isFinite(r.price)));
  if (d.PAY) Object.assign(PAY, d.PAY); if (d.GC) Object.assign(GC, d.GC); auxNormalizeState();
  WD_TEAM.done = d.TEAM; d.CHEST.forEach((st, i) => { if (WD_CHEST[i]) WD_CHEST[i].st = st; });
  d.ACH.forEach((a, i) => { if (WD_ACH[i]) Object.assign(WD_ACH[i], a); });
  if (d.MSGS) d.MSGS.forEach((r, i) => { if (MSGS[i]) MSGS[i].read = r; });
   }

function dbLoad() { try {
  const d = JSON.parse(localStorage.getItem(demoStorageKey()) || "null"); if (!d || ![3, 4].includes(d.v)) return false;
  if (d.learning) Object.assign(LM, d.learning);
  Object.assign(S, { user: d.S.user, gate: d.S.gate, birthDate: d.S.birthDate || null, goal: d.S.goal, minutes: d.S.minutes, plan: d.S.plan, consents: d.S.consents || {}, consentV: d.S.consentV || "b30-consent-v1", mistakes: d.S.mistakes, today: d.S.today, streak: d.S.streak, lastRead: d.S.lastRead, quick: d.S.quick, fav: d.S.fav || [] });
  if (d.S.quiz && Array.isArray(d.S.quiz.answers)) S.quiz = d.S.quiz;
  if (d.PR) Object.assign(PR, d.PR);
  if (d.SRS) Object.assign(SRS, d.SRS);
  Object.assign(SH,d.SH||{q:"",hist:[]});
  Object.assign(SET, d.SET); SRSQ.length = 0; d.SRSQ.forEach(x => SRSQ.push(x));
  Object.keys(WCAL).forEach(k => delete WCAL[k]); Object.assign(WCAL, d.WCAL); Object.assign(STM, d.STM);
  Object.assign(DR, d.DRb); DR.i = d.DRb.i || 0; BK.lv = d.BKlv; if (d.BKpos) BK.pos = d.BKpos; if (d.BKcur) BK.cur = d.BKcur; if (d.BKch != null) BK.ch = d.BKch; Object.assign(AX, d.AX);
  if (Array.isArray(d.SUPlist)) SUP.list = d.SUPlist; if (d.SUPstate) Object.assign(SUP, d.SUPstate);
  if (d.PV) Object.assign(PV, d.PV);
  if (Array.isArray(d.RF)) RF_ORDERS.splice(0, RF_ORDERS.length, ...d.RF.filter(r => r && typeof r.id === "string" && typeof r.t === "string" && Number.isFinite(r.price)));
  if (d.PAY) Object.assign(PAY, d.PAY); if (d.GC) Object.assign(GC, d.GC); auxNormalizeState();
  WD_TEAM.done = d.TEAM; d.CHEST.forEach((st, i) => { if (WD_CHEST[i]) WD_CHEST[i].st = st; });
  d.ACH.forEach((a, i) => { if (WD_ACH[i]) Object.assign(WD_ACH[i], a); });
  if (d.MSGS) d.MSGS.forEach((r, i) => { if (MSGS[i]) MSGS[i].read = r; });
  return true;
} catch (e) { return false; } }
function normalizeState() {
  if (S.quick == null) S.quick = false;
  if (!S.fav) S.fav = [];
  S.mistakes.forEach(m => { if (!m.st) m.st = "todo"; if (!m.src) m.src = "历史演示"; if (m.hid == null) m.hid = 0; });
  SRSQ.forEach(q => { if (q.done == null) q.done = false; if (q.show == null) q.show = false; if (q.round == null) q.round = 0; });
  S.today.forEach(t => { if (!t.group) { if (t.id === "t1") t.group = "g1"; if (t.id === "t2") t.group = "r1"; } if (t.done == null) t.done = false; if (t.right == null) t.right = 0; if (!t.total) t.total = (t.group && typeof GROUPS !== "undefined" && GROUPS[t.group]) ? GROUPS[t.group].items.length : 1; });
  if (!S.quiz || !S.quiz.answers) S.quiz = { i: 0, sel: null, phase: "answer", answers: [], done: false, score: 0 };
  if (S.quiz.phase === "submitting") { S.quiz.phase = "unknown"; S.quiz.fb = { cls: "wa", msg: "上次提交被中断，选择已保留。先查询本次结果，避免重复提交。" }; }
  S.consents ||= {};
  if (S.user === "演示账号" && S.gate === "PASS" && !Object.keys(S.consents).length) S.consents = Object.fromEntries(CONSENT_KEYS.map(key => [key, { agreed: true, version: S.consentV, source: "演示样例" }]));
  if (typeof PR !== "undefined" && PR.taskId && !S.today.some(t => t.id === PR.taskId) && !LM.freeTasks?.[PR.taskId] && LM.freeTask?.id !== PR.taskId) { PR.taskId = null; PR.phase = "answer"; PR.pos = 0; PR.sel = -1; }
  if (typeof SRS !== "undefined" && SRS.order) { SRS.order = SRS.order.filter(i => SRSQ[i]); SRS.redo = (SRS.redo || []).filter(i => SRSQ[i]); if (!SRS.order.length && SRS.phase === "run") SRS.phase = "idle"; }
}
/* 统一今日任务（写法/阅读两组，稳定标识跨页关联） */
function freshToday() {
  return [
    { id: "t1", group: "g1", t: "语法 · There be 句型", min: 5, kind: "grammar" },
    { id: "t2", group: "r1", t: "阅读 · 图书馆的一天", min: 8, kind: "reading" },
  ].map(b => ({ ...b, done: false, right: 0, total: GROUPS[b.group].items.length }));
}
/* 错题归并写入（同一题面只一张卡） */
function addMistake(t, why, kind, src) {
  if (S.mistakes.some(m => m.t === t)) return false;
  S.mistakes.unshift({ t, why, kind, src: src || "练习", st: "todo", hid: 0 });
  return true;
}
const BANK = structuredClone(DEMO_FIXTURES.BANK);
const TITLES = { login: "登录", register: "注册", reset: "重置密码", gate: "身份确认", onboard: "学习目标", placement: "定级测评", report: "测评报告", home: "首页", today: "今日任务", courses: "分类速览", practice: "练题", mistakes: "错题本", srs: "复习", weekly: "学习报告", world: "世界", avatar: "装扮", msgs: "消息", me: "我的", settings: "设置", devices: "设备", privacy: "隐私", support: "客服", search: "搜索", commerce: "商城", admin: "管理", adraft: "建稿送审", areview: "双签审核", apublish: "发布回滚", agov: "治理风控", aaudit: "审计", aperm: "权限只读", ai: "AI 伴学", voice: "语音跟读", k12: "青少年模式", pay: "收银台", a11y: "无障碍", arrears: "补课提醒", celebrate: "完成撒花", offlinet: "断网今日", pgen: "计划生成中", greject: "门被拒", cupgrade: "同意升级", vocab: "词汇详情", listening: "听力", speaking: "口语", writing: "写作", offpkg: "离线包", refund: "退款开票", phonics: "音标", alphabet: "字母", wordbook: "单词本", drill: "刷单词", shelf: "书架", book: "图书详情", chapter: "章节正文", about: "关于", achieve: "成就墙", league: "联赛", planexp: "计划解释", session: "会话检查点", mastery: "掌握度", pfault: "定级恢复", npref: "通知偏好", firstlearn: "首次学习", alogin: "管理登录", amedia: "媒体上传", acs: "客服后台", ashop: "商城后台", areport: "举报队列", aobs: "观测恢复", games: "小游戏", space: "个人空间", subs: "订阅对账", native: "原生壳", rewards: "任务奖励", aigate: "AI门", aiflow: "AI链", vscore: "语音评分", k12guard: "K12治理", k12course: "K12课程", tdetail: "工单详情", paudio: "音频保留", lab: "演示工具" };
/* 测试脚手架开关：默认关闭，加 ?demo=1 才显示预填账号与状态演示入口 */
const DEMO = /[?&]demo=1/.test(location.search);
const TABS = ["home", "today", "world", "me"];
function toast(m) { if(window.DEMO_STORAGE_FAILED)m="未保存：本机存储不可用，操作已恢复。请允许存储后重试。";const t = document.getElementById("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2200); }
function goBack() { if (history.state?.yxxMobile && history.state.depth > 0) history.back(); else nav(S.user ? "#/home" : "#/login"); }
function nav(h) { syncIdentity(); if (h !== "#/drill") tchPause("已离开限时挑战，返回后可继续"); if (location.hash === h) render(); else location.hash = h; }
/* 人性化：危险动作两步确认（第一下武装，第二下执行，3 秒回落） */
let ARM_SERIAL = 0;
function arm(el, fn) {
  if (!el || !el.isConnected) return;
  if (el.dataset.armed) {
    delete el.dataset.armed; el.classList.remove("danger"); el.textContent = el.dataset.armLabel; delete el.dataset.armLabel; fn();
  } else {
    const token = String(++ARM_SERIAL), label = el.textContent;
    el.dataset.armed = token; el.dataset.armLabel = label; el.classList.add("danger"); el.textContent = "再点一次确认";
    setTimeout(() => { if (el.dataset.armed !== token) return; delete el.dataset.armed; delete el.dataset.armLabel; el.classList.remove("danger"); if (el.isConnected) el.textContent = label; }, 3000);
  }
}
function needAuth() { if (!S.user) { toast("请先登录"); nav("#/login"); return false; } return true; }
const CONSENT_KEYS = ["TERMS", "PRIVACY", "ADULT_LEARNING"];
let IDENTITY_EPOCH = 0;
let ACTIVE_IDENTITY = S.user;
let ROUTE_DEPTH = 0;
function hasConsents() { return CONSENT_KEYS.every(key => S.consents?.[key]?.agreed && S.consents[key].version === S.consentV); }
function needReady() { if (!needAuth()) return false; if (S.gate !== "PASS" || !hasConsents()) { toast(S.gate !== "PASS" ? "请先完成成年人身份确认" : "请先确认当前版本的同意记录"); nav("#/gate"); return false; } return true; }
function syncIdentity() {
  if (ACTIVE_IDENTITY === S.user) { if (!S.user) S.staff = false; return; }
  ACTIVE_IDENTITY = S.user; IDENTITY_EPOCH++; S.staff = false;
  S.quiz.tok = (S.quiz.tok || 0) + 1;
  if (S.quiz.phase === "submitting") { S.quiz.phase = "unknown"; S.quiz.fb = { cls: "wa", msg: "登录状态已改变，本次提交已暂停。重新进入后先查询结果。" }; }
  PR.tok = (PR.tok || 0) + 1;
  if (PR.phase === "submitting") { PR.phase = "answer"; PR.fb = { cls: "wa", msg: "登录状态已改变，选择已保留，可重新提交。" }; }
  PG.tok = (PG.tok || 0) + 1; if (PG.st === "run") PG.st = "idle";
  if (typeof LM !== "undefined" && LM.writing.phase === "submitting") { LM.writing.phase = "draft"; LM.writing.pending = null; LM.writing.feedback = "登录状态已改变，提交已暂停，草稿保留在本机。"; }
}
function identityToken() { return { user: S.user, epoch: IDENTITY_EPOCH }; }
function identityCurrent(token) { return token.user === S.user && token.epoch === IDENTITY_EPOCH && S.gate === "PASS" && hasConsents(); }
function realDate() { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"); }
function birthdayAge(value, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [year, month, day] = value.split("-").map(Number), birth = new Date(0); birth.setFullYear(year, month - 1, day); birth.setHours(0, 0, 0, 0);
  if (year < 1 || birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > now) return null;
  return now.getFullYear() - year - (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day) ? 1 : 0);
}

/* ---------- 屏 ---------- */
const V = {};
V.login = () => `<div class="card"><h2>进入本机演示档案</h2><p class="d">这是静态原型：账号只用于演示身份，不连接认证服务，也不隔离多账号数据。退出后本机草稿和学习记录仍保留；再次进入会使用同一份档案。</p><label class="lb" for="li">演示账号</label><input id="li" value="${lh(DEMO ? "t-learner-01@test.invalid" : "")}" placeholder="输入演示账号"><label class="lb" for="lp">演示密码</label><input id="lp" type="password" value="" placeholder="输入演示密码（不保存）"><button class="btn" onclick="doLogin()">进入演示档案</button><button class="btn ghost" onclick="nav('#/register')">演示注册流程</button><button class="btn ghost" onclick="nav('#/reset')">忘记密码</button></div>`;
V.register = () => `<div class="card"><h2>演示注册流程</h2><p class="d">创建演示身份后仍需成年人确认与主动同意。原型沿用同一本机档案，不创建后台账号或隔离多账号数据；密码不会保存。</p><label class="lb" for="ri">演示账号</label><input id="ri" value="${lh(DEMO ? "new@test.invalid" : "")}" placeholder="输入演示账号"><label class="lb" for="rp">演示密码（≥8 位，字母+数字）</label><input id="rp" type="password" value="" placeholder="密码"><button class="btn" onclick="doRegister()">继续演示注册</button><button class="btn ghost" onclick="nav('#/login')">返回登录</button></div>`;
V.reset = () => `<div class="card"><h2>重置密码</h2><p class="d">如果账号存在，邮件已发出（永远这句，不枚举）。</p><label class="lb">账号</label><input value="new@test.invalid"><button class="btn" onclick="toast('如果账号存在，邮件已发出')">发送重置邮件</button><button class="btn ghost" onclick="goBack()">返回</button></div>`;
V.gate = () => `<div class="card"><h2>确认成年人身份</h2><p class="d">当前学习版本只服务满 18 岁的成年人。原型使用完整出生日期演示判断，日期仅保存在本机，不代表正式身份认证。</p>${S.gate === "REJECTED" ? `<div class="fb no" role="status">根据填写的日期，你尚未满 18 岁，当前不能开放学习。可以查看隐私说明、反馈问题或退出。</div>` : S.gate === "PASS" ? `<div class="fb ok" role="status">${S.birthDate ? "成年人身份已确认（本机演示）" : "当前为成年人通过状态的演示样例"}</div>` : ""}<label class="lb" for="by">出生日期</label><input id="by" type="date" max="${realDate()}" value="${lh(S.birthDate || (DEMO ? "1995-01-01" : ""))}"><label class="lb" style="margin-top:8px"><input type="checkbox" id="cf" style="width:auto"> 我确认出生日期准确且已满 18 岁</label><button class="btn" onclick="doGate()">确认身份</button></div><div class="card"><h2>同意记录</h2><p class="d">当前演示版本 ${lh(S.consentV)}。请逐项阅读并主动确认；尚未通过成年人确认时不能签署进入学习。</p>${[["TERMS", "服务条款"], ["PRIVACY", "隐私说明"], ["ADULT_LEARNING", "成人学习说明"]].map(([key, label]) => `<label class="lb" style="font-weight:400"><input type="checkbox" class="ag" data-consent="${key}" style="width:auto"> 我已阅读并同意${label}</label>`).join("")}<button class="btn" ${S.gate !== "PASS" ? "disabled" : ""} onclick="doConsents()">签署并继续</button></div><div class="actions"><button class="btn sm ghost" onclick="nav('#/privacy')">隐私设置</button><button class="btn sm ghost" onclick="nav('#/support')">帮助与反馈</button><button class="btn sm ghost" onclick="S.user=null;nav('#/login')">退出演示</button></div>`;
V.onboard = () => `<div class="card"><h2>定个小目标</h2><p class="d">先选一个，一周后可换。存完按钮去定级，不回首页。</p><label class="lb">目标</label><select id="g"><option value="CET_4_6">大学英语四级 · B1</option><option value="ZERO_BASIS">零基础 · A1</option><option value="CET_6">六级 · B2</option></select><label class="lb">每天分钟</label><select id="m"><option>15</option><option>30</option><option>45</option></select><button class="btn" onclick="doGoal()">保存，去定级 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`;
V.placement = () => { const q = BANK[S.quiz.i]; const ph = S.quiz.phase || "answer"; return `<div class="meta">第 ${S.quiz.i + 1}/${BANK.length} 题 · ${q.dim} · 答完本轮统一出报告</div><div class="prog"><i style="width:${(S.quiz.i / BANK.length) * 100}%"></i></div><div class="card"><h2>${q.s}</h2><div id="qo">${q.o.map((t, k) => `<button class="opt${S.quiz.sel === k ? " sel" : ""}" data-k="${k}" onclick="pick(${k})">${"ABC"[k]}. ${t}</button>`).join("")}</div>${S.quiz.fb ? `<div class="fb ${S.quiz.fb.cls}" id="qfb" style="display:block">${S.quiz.fb.msg}</div>` : `<div class="fb" id="qfb"></div>`}${ph === "unknown" ? `<button class="btn" onclick="qResolve()">查询结果</button>` : ``}<div class="row" style="display:flex;gap:8px"><button class="btn ghost" style="flex:1"${ph !== "saved" ? " disabled" : ``} onclick="qNext()">${S.quiz.i < BANK.length - 1 ? "下一题" : "出报告"} <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="btn" style="flex:1" onclick="qSubmit()"${ph !== "answer" ? " disabled" : ``}>提交</button><button class="btn ghost" style="flex:1"${ph !== "answer" ? " disabled" : ``} onclick="qSkip()">跳过</button></div><div class="card"><h2>🧰 会话与掌握</h2><p><button class="btn sm" onclick="nav('#/session')">会话检查点 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/mastery')">掌握度 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/pfault')">失败恢复 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div></div>`; };
function repDim() {
  return ["词汇", "语法", "阅读", "听力"].map(d => {
    const samples = BANK.map((q, i) => ({ q, a: S.quiz.answers[i] })).filter(x => x.q.dim === d);
    const qs = samples.filter(x => x.a && !x.a.skip);
    const ok = qs.filter(x => x.a.ok).length;
    return { d, ok, total: qs.length, samples: samples.length, pct: qs.length ? Math.round(ok / qs.length * 100) : null };
  });
}
function repLevel() { if (!S.quiz.answers?.some(a => a && !a.skip)) return "未定级"; const s = S.quiz.score; return s >= 5 ? "B2" : s >= 3 ? "B1" : s >= 1 ? "A2" : "A1"; }
V.report = () => {
  const dims = repDim();
  const answered = dims.filter(d => d.total > 0);
  const weak = answered.length ? answered.slice().sort((a, b) => a.pct - b.pct)[0] : null;
  const skipped = BANK.map((q, i) => ({ q, i })).filter(x => S.quiz.answers[x.i] && S.quiz.answers[x.i].skip);
  const wrong = BANK.map((q, i) => ({ q, i })).filter(x => S.quiz.answers[x.i] && !S.quiz.answers[x.i].skip && !S.quiz.answers[x.i].ok);
  const total = answered.reduce((n, d) => n + d.total, 0);
  const sug = !total ? "本轮没有有效作答。可以补答样例，或按所选目标从基础任务开始。" : weak.pct < 70 ? `本轮${weak.d}样例答对 ${weak.ok}/${weak.total}，可先重看相关讲评；这些少量题目不足以判定正式能力弱项。` : "本轮样例答对较多，可以继续学习，并用后续练习记录检验。";
  return `<div class="card report-summary" style="text-align:center;border:0"><b style="font-size:28px">${total ? "样例测评完成" : "未定级"}</b><p>${total ? `${repLevel()}（样例起步参考）` : "本轮全部跳过，无有效作答"} · 答对 ${S.quiz.score}/${total} · 跳过 ${skipped.length}/${BANK.length}</p><p class="d">五道固定原创样例用于体验测评流程；分档不构成正式 CEFR 等级。听力、口语、写作未测。</p></div><div class="card"><h2>本轮样例维度</h2>${dims.map(({ d, ok, total, samples, pct }) => `<div class="dim"><span class="v">${d} ${samples === 0 ? "未测" : pct == null ? "未答" : `${ok}/${total} · ${pct}%`}</span><span class="bar w"><i style="width:${pct == null ? 0 : pct}%"></i></span></div>`).join("")}</div><div class="card"><h2>💡 学习建议</h2><p class="d">${sug}</p><p class="d">当前计划按学习目标、每日分钟和学习日模板安排，尚未按这份测评自动调课。</p><button class="btn" onclick="nav('#/pgen')">查看我的计划</button></div>` + (wrong.length ? `<div class="card"><h2>本轮讲评</h2>` + wrong.map(({ q }) => `<p class="d"><b>${lh(q.s)}</b><br>→ ${lh(q.why)}</p>`).join("") + `</div>` : ``) + (skipped.length ? `<div class="card"><p class="d">未答 ${skipped.length} 题（跳过不计分）：${skipped.map(({ q }) => lh(q.s.slice(0, 12)) + "…").join(" / ")}</p><p><button class="btn sm ghost" onclick="qResumeSkipped()">回样例测评补答</button></p></div>` : ``); };
function checkinCard() {
  const dots = [3, 4, 5, 6, 7, 8, 9].map(d => (WCAL[d] || 0) > 0);
  return `<section class="card checkin-card"><div class="card-heading"><h2>📅 本周打卡</h2><button class="icon-button" aria-label="查看本周打卡明细" onclick="nav('#/weekly')">${CHEV}</button></div><div class="cal">${["一", "二", "三", "四", "五", "六", "日"].map(d => `<span>${d}</span>`).join("")}${dots.map(hit => `<span class="${hit ? "hit" : ""}">${hit ? "✓" : "·"}</span>`).join("")}</div><p class="d">本周已打卡 ${dots.filter(Boolean).length} 天 · 查看每天的学习明细</p></section>`;
}
V.home = () => {
  const words = S.mistakes.filter(m => m.kind === "word").length, sents = S.mistakes.length - words;
  const doneT = S.today.filter(t => t.done).length, totalT = S.today.length;
  const totalMin = S.today.reduce((a, b) => a + (b.done ? 0 : b.min), 0);
  const srsLeft = SRSQ.filter(q => !q.done).length;
  const firstUndone = S.today.find(t => !t.done);
  const pct = totalT ? Math.round(doneT / totalT * 100) : 100;
  const hr = new Date().getHours(), greet = hr < 6 ? "夜深了" : hr < 12 ? "上午好" : hr < 18 ? "下午好" : "晚上好";
  const wcalWeek = (typeof WCAL !== "undefined") ? [3, 4, 5, 6, 7, 8, 9].map(d => (WCAL[d] || 0) > 0 ? 1 : 0) : [1, 0, 0, 0, 0, 0, 0];
  const planLine = `这周每天 ${S.minutes} 分钟：词汇 ${Math.max(5, Math.round(S.minutes / 3))} + 语法 ${S.minutes - Math.max(5, Math.round(S.minutes / 3))}。`;
  const weakLine = S.quiz.score > 0 ? `定级 ${S.quiz.score}/${BANK.length}，语法待补，所以` : `先按${S.goal || "四级词汇 B1"}来，`;
  return `${S.plan ? `<div class="hero"><p class="eyebrow">本周计划 · ${S.goal || "四级词汇 B1"}</p><p class="hi">${greet}，继续推进 👋</p><p class="sub">${weakLine}${planLine}</p><div class="kpis"><div class="kpi"><b>${totalT - doneT}</b><span>今日待做</span></div><div class="kpi"><b>${S.mistakes.length}</b><span>待补救</span></div><div class="kpi"><b>${srsLeft}</b><span>到期复习</span></div></div><div class="prog"><i style="width:${pct}%"></i></div><p>${firstUndone ? `<button class="btn sm" onclick="enterTask('${firstUndone.id}')">继续：${firstUndone.t} ` : `<button class="btn sm" onclick="resumeChapter()">继续读：${S.lastRead.book} `}<svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/today')">查看今日安排${totalT - doneT > 0 ? `（剩 ${totalT - doneT}）` : ""} <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>` : `<div class="hero"><p class="hi">先定个位，再排计划 🌱</p><p class="sub">定级 3 分钟，生成你的专属计划</p><p><button class="btn sm" onclick="nav('#/placement')">去定级 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`
    }${S.plan ? `<div class="card"><p class="eyebrow">今日</p><h2>📚 今日任务（${doneT}/${totalT}）</h2><p class="d">${totalT ? (doneT === totalT ? "今天全完成了 🎉" : `剩 ${totalT - doneT} 个 · 约 ${totalMin} 分钟`) : "今天没任务啦 🎉"}</p><div class="prog"><i style="width:${pct}%"></i></div><button class="btn" onclick="nav('#/today')">${doneT === totalT ? "去看看" : "开始今日 →"}</button></div>` : `<div class="card empty"><b>还没有计划</b><p class="d">定级 3 分钟出报告，或从基础任务直接开始（今日页同此）</p><p><button class="btn sm" onclick="nav('#/placement')">去定级 →</button> <button class="btn sm ghost" onclick="nav('#/firstlearn')">先看两条路 →</button></p></div>`}<div class="card"><p class="eyebrow">补救</p><h2>❤️ 错题本${S.mistakes.length ? `（${S.mistakes.length}）` : ""}</h2>${S.mistakes.length ? `<div class="stat"><span class="tag">单词 ${words}</span><span class="tag">句子 ${sents}</span><span class="tag">最新 ${S.mistakes[S.mistakes.length - 1].t.slice(0, 10)}…</span></div>` : `<p class="d">做错的题自动进来</p>`}<p><button class="btn sm ghost" onclick="MK.st='all';MK.ty='all';nav('#/mistakes')">进错题本 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="MK.st='all';MK.ty='word';nav('#/mistakes')">看单词 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="MK.st='all';MK.ty='sentence';nav('#/mistakes')">看句子 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div><div class="card"><p class="eyebrow">巩固</p><h2>⚔️ 刷单词</h2><div class="stat"><span class="tag">40 词/轮</span><span class="tag">已斩 ${DR.known}</span><span class="tag">复习 ${srsLeft} 到期</span></div><p><button class="btn sm" onclick="nav('#/wordbook')">选词本开刷 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/drill')">继续刷（${DR.book === "CET4" ? "四级" : "六级"}第 ${Math.min(DR.i + 1, wlist().length)}/${wlist().length}） <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>${(!S.plan || S.quiz.score === 0) ? `<div class="card"><p class="eyebrow">起点</p><h2>🔰 零基础专区</h2><p class="d">从字母和音标开始，不考试</p><button class="btn sm" onclick="nav('#/alphabet')">字母 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm" onclick="nav('#/phonics')">音标 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>` : ``}<div class="card"><p class="eyebrow">阅读</p><h2>📖 书架</h2><div class="bookrow"><div class="cover">📕</div><div><b>${S.lastRead.book}</b><p class="d">${S.lastRead.ch}</p><button class="btn sm ghost" onclick="resumeChapter()">继续读 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div></div>${checkinCard()}`;
};
function homeDone(id) { const t = S.today.find(x => x.id === id); if (t) { t.done = true; toast("已完成（演示）"); render(); } }
V.today = () => {
  const doneT = S.today.filter(t => t.done).length, totalT = S.today.length;
  const leftT = S.today.filter(t => !t.done);
  const srsLeft = SRSQ.filter(q => !q.done);
  const srsShow = srsLeft.slice(0, 2);
  const srsMin = srsLeft.length * 2;
  const leftMin = leftT.reduce((a, b) => a + b.min, 0) + srsMin;
  const over = leftMin > S.minutes;
  const sched = (() => { let acc = srsMin; return leftT.map(t => { const s = acc; acc += t.min; return { id: t.id, over: s >= S.minutes }; }); })();
  const head = `<div class="card"><h2>📚 今日安排</h2><p class="d">今日共约 ${leftMin} 分钟（目标每天 ${S.minutes} 分钟）：已完成 ${doneT} · 剩 ${totalT - doneT + (srsLeft.length ? 1 : 0)} 组${over ? " · 超出部分标顺延，先做前面的" : ""}</p><p class="d">${"●".repeat(doneT)}${"○".repeat(totalT - doneT)}${srsLeft.length ? " ＋复习" : ""}（演示口径：复习 1 个按 2 分钟）</p></div>`;
  if (!S.plan) return `<div class="card empty"><b>还没建计划</b><p class="d">定级 3 分钟，生成你的今日安排</p><button class="btn" onclick="nav('#/placement')">去定级 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`;
  if (totalT > 0 && doneT === totalT && !srsLeft.length) return head + `<div class="card empty"><b>🎉 今天全完成了，明天见！</b><p class="d">已保存，可结束；想再看看也行</p><p><button class="btn sm" onclick="nav('#/srs')">查看回顾 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/mistakes')">错题本 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/celebrate')">撒花 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/home')">回首页</button></p></div>`;
  if (!totalT && !srsLeft.length) return head + `<div class="card empty"><b>今天没任务啦 🎉</b><p class="d">去书架逛逛，或看看复习</p><button class="btn sm" onclick="nav('#/shelf')">去书架</button> <button class="btn sm ghost" onclick="nav('#/srs')">去复习</button></div>`;
  return head
    + `<p class="d" style="margin:4px 0 8px">▶️ 继续上次</p><div class="card"><b>📖 ${S.lastRead.book}</b><p class="d">${S.lastRead.ch}</p><button class="btn sm" onclick="resumeChapter()">继续读 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`
    + (srsLeft.length ? `<p class="d" style="margin:12px 0 8px">🔁 到期复习（${srsLeft.length} 个 · 约 ${srsMin} 分钟）</p>` + srsShow.map(q => `<div class="card"><b>${q.w}</b><p class="d">${q.zh}</p></div>`).join("") + (srsLeft.length > 2 ? `<p class="d">还有 ${srsLeft.length - 2} 个…</p>` : ``) + `<button class="btn sm ghost" onclick="nav('#/srs')">去复习 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ``)
    + (leftT.length ? `<p class="d" style="margin:12px 0 8px">✨ 新学（剩 ${leftT.length} 个）</p>` + leftT.map((t, xi) => `<div class="card"><b>${t.t}</b>${sched[xi].over ? ` <span class="tag">超预算·顺延明天</span>` : ``}<p class="d">${t.min} 分钟 · 练题判分 · 对率单独计，不要求全对</p><p><button class="btn sm" onclick="enterTask('${t.id}')">${PR.taskId === t.id && PR.phase !== "result" ? "继续第 " + (PR.pos + 1) + " 题" : "开始"} <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`).join("") : ``)
    + (doneT ? `<p class="d" style="margin:12px 0 8px">✅ 已完成（${doneT}）</p>` + S.today.filter(t => t.done).map(t => `<div class="card" style="opacity:.65"><b>✓ ${t.t}</b><p class="d">${t.min} 分钟 · 对 ${t.right}/${t.total} · <span class="tag">已完成</span></p><p><button class="btn sm ghost" onclick="enterTask('${t.id}')">查看 / 重练</button></p></div>`).join("") : ``)
    + (DEMO ? `<div class="card"><p class="d">状态演示：</p>${[["arrears", "欠账"], ["celebrate", "撒花"], ["offlinet", "断网"], ["pgen", "生成中"]].map(([r, t]) => `<button class="btn sm ghost" onclick="nav('#/${r}')">${t}</button>`).join(" ")}</div>` : ``);
};
V.courses = () => `<h2 style="margin:0 0 10px">🔖 分类速览</h2><p class="d" style="margin:0 0 10px">按分类快速进练题；整书精读走图书管。</p><p style="margin:0 0 10px"><button class="btn sm ghost" onclick="nav('#/shelf')">进图书管 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p>` + S.shelf.map((c, i) => `<div class="card"><b>${c}</b><p class="d">${i === 0 ? "上次学到第 2 节" : "未开始"}</p><button class="btn sm" onclick="nav('#/practice')">${i === 0 ? "继续 →" : "开始 →"}</button></div>`).join("");
V.practice = () => {
  const t = prTask(), g = prGroup();
  if (!g) return `<div class="card empty"><b>先从今日选一组</b><p class="d">练习按任务组进入，做完自动记到对应任务</p><button class="btn" onclick="nav('#/today')">回今日</button></div>`;
  if (PR.phase === "result") {
    const right = g.items.filter(x => x._ok).length, wrong = g.items.filter(x => !x._ok);
    const next = S.today.find(x => !x.done && x.id !== t.id);
    return `<div class="card" style="text-align:center"><b style="font-size:40px">${right === g.items.length ? "🌟" : "💪"}</b><h2>本组结束 · 对 ${right}/${g.items.length}</h2><p class="d">完成≠掌握：做完即完成；答错的已进错题本，变式通过才算掌握</p></div>` + (wrong.length ? `<div class="card"><h2>再练这些</h2>` + wrong.map(x => `<p class="d">· ${x.s}</p>`).join("") + `<p><button class="btn sm" onclick="nav('#/mistakes')">去错题本</button></p></div>` : `<div class="card"><p class="d">全对，干得漂亮；错题本见。</p></div>`) + `<div class="card"><p>${next ? `<button class="btn" onclick="enterTask('${next.id}')">继续下一项：${next.t}</button> ` : ``}<button class="btn ghost" onclick="nav('#/today')">返回今日</button> <button class="btn ghost" onclick="nav('#/home')">结束学习</button></p></div>`;
  }
  const it = g.items[PR.pos];
  return `<div class="meta">${t.t} · 第 ${PR.pos + 1}/${g.items.length} 题${PR.sel >= 0 && PR.phase === "answer" ? " · 已选未提交（草稿）" : ""}</div>` + (g.passage ? `<div class="card"><p style="font-size:16px">${g.passage}</p></div>` : ``) + `<div class="card"><h2>${it.s}</h2><div id="po">${it.o.map((o, k) => `<button class="opt${PR.sel === k ? " sel" : ""}" onclick="prPick(${k})">${"ABC"[k]}. ${o}</button>`).join("")}</div>${PR.fb ? `<div class="fb ${PR.fb.cls}" id="pfb" style="display:block">${PR.fb.msg}</div>` : `<div class="fb" id="pfb"></div>`}${PR.phase === "unknown" ? `<button class="btn" onclick="prResolve()">查询结果</button>` : ``}<div class="row" style="display:flex;gap:8px"><button class="btn" style="flex:1"${PR.phase !== "answer" ? " disabled" : ``} onclick="prSubmit()">提交</button><button class="btn ghost" style="flex:1"${PR.phase !== "saved" ? " disabled" : ``} onclick="prNext()">${PR.pos < g.items.length - 1 ? "下一题" : "看结果"}</button></div><p><button class="btn sm ghost" onclick="nav('#/today')">回今日（进度保留）</button></p></div>`;
};const LEX = {
  there: { ph: "/ðeə/", zh: "那里；存在", morph: "—", coll: "there be 句型：There is/are …", ex: "There is a book." },
  two: { ph: "/tuː/", zh: "二", morph: "second 第二", coll: "two books 两本书", ex: "Two cats." },
  books: { ph: "/bʊks/", zh: "书（复数）", morph: "book→books；book 书", coll: "read books 读书", ex: "Two books." },
  book: { ph: "/bʊk/", zh: "书；预订", morph: "books 复数；booking 预订", coll: "read a book 读书", ex: "A book." },
  on: { ph: "/ɒn/", zh: "在…上", morph: "—", coll: "on the desk 在桌上", ex: "On the desk." },
  the: { ph: "/ðə/", zh: "这；那（定冠词）", morph: "—", coll: "the books 这些书", ex: "The books." },
  desk: { ph: "/desk/", zh: "书桌", morph: "desks 复数", coll: "at the desk 在书桌旁", ex: "The desk." },
};
function speak(w) { try { const u = new SpeechSynthesisUtterance(w); u.lang = "en-US"; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { toast("朗读不可用（演示）"); } }
const MK = { st: "all", ty: "all", vid: -1, undo: [] };
function mkVariant(i) { MK.vid = i; render(); }
function markDone(i, via) {
  const m = S.mistakes[i]; if (!m || m.st === "done") return;
  MK.undo.push({ i, st: m.st, hid: m.hid }); if (MK.undo.length > 20) MK.undo.shift();
  m.st = "done"; m.via = via; MK.vid = -1; MKPICK = -1;
  toast("已掌握（" + via + "），可撤销（演示）"); render();
}
function mkDone(i) { markDone(i, "自评会了"); }
function mkUndo() {
  const u = MK.undo.pop(); if (!u) { toast("没有可撤销的（演示）"); return; }
  const m = S.mistakes[u.i]; if (m) { m.st = u.st; m.hid = u.hid; delete m.via; }
  toast("已撤销（演示）"); render();
}
function mkVarQuiz() {
  const m = S.mistakes[MK.vid];
  if (!m) return null;
  if (m.kind === "word") {
    const pool = vcAll().filter(x => x.w !== m.t).slice(0, 12);
    const others = [pool[1], pool[5], pool[9]].filter(Boolean);
    const opts = others.map(o => ({ t: o.w, ok: false })).concat([{ t: m.t, ok: true }]);
    const h = m.t.length * 7;
    for (let k = opts.length - 1; k > 0; k--) { const j = (h + k * 3) % (k + 1); const t = opts[k]; opts[k] = opts[j]; opts[j] = t; }
    return { kind: "word", opts };
  }
  return { kind: "sentence", stem: "There ___ two pens on the desk.", opts: [{ t: "is", ok: false }, { t: "are", ok: true }, { t: "am", ok: false }] };
}
let MKPICK = -1;
let MKPACK = null;
function mkPack() { const all = S.mistakes; if (all.length < 2) { toast("错题不够 2 道，先去做题（演示）"); return; } MKPACK = { list: all.slice(0, Math.min(10, all.length)), pos: 0, right: 0, pick: -1 }; MK.vid = -2; render(); }
function mkPackPick(k) { if (!MKPACK) return; MKPACK.pick = k; const m = MKPACK.list[MKPACK.pos]; const ok = (m.kind === "word" && k === 0) || (m.kind !== "word" && k === 1); MKPACK.lastOk = ok; render(); }
function mkPackNext() { if (!MKPACK || MKPACK.pick < 0) { toast("先选一个"); return; } if (MKPACK.lastOk) { MKPACK.right++; const m = MKPACK.list[MKPACK.pos]; const gi = S.mistakes.indexOf(m); if (gi >= 0 && S.mistakes[gi].st !== "done") { MK.undo.push({ i: gi, st: "todo", hid: S.mistakes[gi].hid || 0 }); S.mistakes[gi].st = "done"; S.mistakes[gi].via = "打包练对"; } } MKPACK.pos++; MKPACK.pick = -1; if (MKPACK.pos >= MKPACK.list.length) { const r = MKPACK.right; MKPACK = null; MK.vid = -1; toast("打包练完：对 " + r + "（演示，已销对的）"); render(); } else render(); }
function mkPick(k) { MKPICK = k; render(); }
function mkSubmit() {
  const v = mkVarQuiz();
  if (!v || MKPICK < 0) { toast("先选一个"); return; }
  if (v.opts[MKPICK].ok) { markDone(MK.vid, "变式通过"); }
  else { const m = S.mistakes[MK.vid]; if (m) m.hid = (m.hid || 0) + 1; toast("再想想，答案不在这里（演示）"); render(); }
}
const CHEV = `<svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHEVB = `<svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function mkEmpty() {
  if (!S.mistakes.length) return `<div class="card empty"><b>错题本是空的</b><p class="d">去今日任务做一道，错了会自动进来</p><button class="btn sm" onclick="nav('#/today')">去做题 ${CHEV}</button></div>`;
  if (MK.st === "done") return `<div class="card empty"><b>还没有已掌握的</b><p class="d">去补救几道，通过后在这里查</p><button class="btn sm" onclick="MK.st='todo';render()">看待补救 ${CHEV}</button></div>`;
  if (MK.st === "todo" && S.mistakes.some(m => m.st === "done")) return `<div class="card empty"><b>待补救已清完 🎉</b><p class="d">看看已掌握的记录</p><button class="btn sm" onclick="MK.st='done';render()">看已掌握 ${CHEV}</button></div>`;
  return `<div class="card empty"><b>这类暂无</b><p class="d">换个筛选看看</p><button class="btn sm" onclick="MK.st='all';MK.ty='all';render()">看全部 ${CHEV}</button></div>`;
}
V.mistakes = () => {
  const all = S.mistakes;
  const todo = all.filter(m => m.st !== "done").length, doneN = all.length - todo;
  const words = all.filter(m => m.kind === "word").length, sents = all.length - words;
  const list = all.filter(m => (MK.st === "all" ? true : m.st === MK.st) && (MK.ty === "all" ? true : (MK.ty === "word" ? m.kind === "word" : m.kind !== "word")));
  if (MK.vid === -2 && MKPACK) {
    const m = MKPACK.list[MKPACK.pos];
    return `<div class="card"><button class="btn sm ghost" onclick="MKPACK=null;MK.vid=-1;render()">${CHEVB} 错题本</button><h2>📦 一次 10 题（${MKPACK.pos + 1}/${MKPACK.list.length} · 对 ${MKPACK.right}）</h2><p class="d">原题：${m.t}（${m.why}）· 对了记掌握，可撤销</p>${m.kind === "word" ? `<p class="d">中文“${m.why.replace("定位：", "").replace("待补", "")}”是哪个词？</p><button class="opt${MKPACK.pick === 0 ? " sel" : ""}" onclick="mkPackPick(0)">A. ${m.t}</button><button class="opt${MKPACK.pick === 1 ? " sel" : ""}" onclick="mkPackPick(1)">B. look（干扰）</button>` : `<p><b>${m.t}</b></p><button class="opt${MKPACK.pick === 0 ? " sel" : ""}" onclick="mkPackPick(0)">A. 需要变式</button><button class="opt${MKPACK.pick === 1 ? " sel" : ""}" onclick="mkPackPick(1)">B. 我会了</button>`}${MKPACK.pick >= 0 ? (MKPACK.lastOk ? `<div class="fb ok">✓ 对了</div>` : `<div class="fb no">! 不对</div>`) : ``}<button class="btn" onclick="mkPackNext()">下一题</button></div>`;
  }
  const v = MK.vid >= 0 ? mkVarQuiz() : null;
  if (MK.vid >= 0 && v) {
    const m = S.mistakes[MK.vid];
    return `<div class="card"><button class="btn sm ghost" onclick="MK.vid=-1;MKPICK=-1;render()">${CHEVB} 错题本</button><h2>🔁 变式再练（演示）</h2><p class="d">原题：${m.t}（${m.why}）· 来源：${m.src || "历史演示"}</p>${v.kind === "word" ? `<p class="d">“${m.why.replace("定位：", "").replace("待补", "")}”是哪个词？</p>` : `<p><b>${v.stem}</b></p>`}${v.opts.map((o, k) => `<button class="opt${MKPICK === k ? " sel" : ""}" onclick="mkPick(${k})">${"ABCD"[k]}. ${o.t}</button>`).join("")}${MKPICK >= 0 ? (v.opts[MKPICK].ok ? `<div class="fb ok">✓ 对了，点提交记掌握</div>` : `<div class="fb no">! 不对，再想想</div>`) : ``}<button class="btn" onclick="mkSubmit()">提交（对了记掌握） ${CHEV}</button></div>`;
  }
  const head = `<div class="card"><h2>❤️ 错题本</h2><p class="d">共 ${all.length} · 待补救 ${todo} · 已掌握 ${doneN} · 单词 ${words} · 句子 ${sents}</p><p><button class="btn sm" onclick="mkPack()">📦 一次 10 题 ${CHEV}</button></p><p class="d">状态：<button class="btn sm${MK.st === "all" ? "" : " ghost"}" onclick="MK.st='all';render()">全部</button> <button class="btn sm${MK.st === "todo" ? "" : " ghost"}" onclick="MK.st='todo';render()">待补救</button> <button class="btn sm${MK.st === "done" ? "" : " ghost"}" onclick="MK.st='done';render()">已掌握</button></p><p class="d">题型：<button class="btn sm${MK.ty === "all" ? "" : " ghost"}" onclick="MK.ty='all';render()">全部</button> <button class="btn sm${MK.ty === "word" ? "" : " ghost"}" onclick="MK.ty='word';render()">单词</button> <button class="btn sm${MK.ty === "sentence" ? "" : " ghost"}" onclick="MK.ty='sentence';render()">句子</button></p><p><button class="btn sm ghost" onclick="mkUndo()">撤销上次掌握</button></p></div>`;
  if (!list.length) return head + mkEmpty();
  return head + list.map(m => {
    const gi = S.mistakes.indexOf(m), done = m.st === "done";
    const info = `<p class="d">${m.why} · 来源：${m.src || "历史演示"}${done && m.via ? " · 通过：" + m.via : ""}${m.hid ? " · 补救" + m.hid + "次" : ""}</p>`;
    const back = `<button class="btn sm ghost" onclick="S.mistakes[${gi}].st='todo';delete S.mistakes[${gi}].via;render()">转回待补 ${CHEV}</button>`;
    const wbtns = `<button class="btn sm" onclick="speak('${m.t}')">🔊 跟读</button> <button class="btn sm ghost" onclick="nav('#/drill')">去刷 ${CHEV}</button> <button class="btn sm ghost" onclick="mkVariant(${gi});MKPICK=-1">变式 ${CHEV}</button>`;
    const sbtns = `<button class="btn sm" onclick="mkVariant(${gi});MKPICK=-1">变式再练 ${CHEV}</button> <button class="btn sm ghost" onclick="mkDone(${gi})">会了 ✓</button>`;
    return `<div class="card"><b>${m.t}</b> <span class="tag">${done ? "已掌握" : "待补救"}</span>${info}<p>${done ? back : (m.kind === "word" ? wbtns : sbtns)}</p></div>`;
  }).join("");
};
const SRSQ = structuredClone(DEMO_FIXTURES.SRSQ);
function srsSeed() {
  SRSQ.length = 0;
  [{ w: "abandon", zh: "抛弃" }, { w: "accumulate", zh: "积累" }, { w: "persistence", zh: "坚持" }, { w: "clarify", zh: "澄清" }].forEach(x => SRSQ.push({ ...x, stage: 1, show: false }));
}
function srsResetSession() { SRS.order = []; SRS.pos = 0; SRS.redo = []; SRS.pass = 1; SRS.batch = 0; SRS.done = 0; SRS.again = 0; SRS.remembered = 0; SRS.phase = "idle"; SRS.undo = []; }
/* ---------- 复习会话（原型规则：本批≤4；忘了/想想→本轮稍后再看一次，最多出现两次；想起/熟悉→完成；快照撤销） ---------- */
const SRS = { order: [], pos: 0, redo: [], pass: 1, batch: 0, done: 0, again: 0, remembered: 0, phase: "idle", undo: [] };
function srsEnsure() {
  if (SRS.phase !== "idle") return;
  const batch = SRSQ.map((q, i) => i).filter(i => !SRSQ[i].done).slice(0, 4);
  SRS.order = batch; SRS.pos = 0; SRS.redo = []; SRS.pass = 1; SRS.batch = batch.length;
  SRS.done = 0; SRS.again = 0; SRS.remembered = 0; SRS.undo = [];
  SRS.phase = batch.length ? "run" : "empty";
}
function srsCur() { return SRS.pos < SRS.order.length ? SRS.order[SRS.pos] : -1; }
function srsShow() { const i = srsCur(); if (i < 0) return; SRSQ[i].show = true; render(); }
function srsRate(level) {
  const i = srsCur(); if (i < 0) return;
  SRS.undo.push({ pos: SRS.pos, order: SRS.order.slice(), redo: SRS.redo.slice(), pass: SRS.pass, done: SRS.done, again: SRS.again, remembered: SRS.remembered, phase: SRS.phase, qi: i, qdone: SRSQ[i].done, qshow: SRSQ[i].show });
  if (SRS.undo.length > 20) SRS.undo.shift();
  const q = SRSQ[i];
  if (level >= 2) { q.done = true; SRS.done++; SRS.remembered++; }
  else {
    SRS.again++;
    addMistake(q.w, "定位：复习待固", "word", "复习");
    if (SRS.pass === 1 && !SRS.redo.includes(i)) { SRS.redo.push(i); q.show = false; }
    else { q.done = true; SRS.done++; }
  }
  SRS.pos++;
  if (SRS.pos >= SRS.order.length) {
    if (SRS.redo.length && SRS.pass === 1) { SRS.order = SRS.redo; SRS.redo = []; SRS.pos = 0; SRS.pass = 2; }
    else SRS.phase = "done";
  }
  render();
}
function srsUndo() {
  const s = SRS.undo.pop();
  if (!s) { toast("没有可撤销的（演示）"); return; }
  SRS.pos = s.pos; SRS.order = s.order; SRS.redo = s.redo; SRS.pass = s.pass;
  SRS.done = s.done; SRS.again = s.again; SRS.remembered = s.remembered; SRS.phase = s.phase;
  SRSQ[s.qi].done = s.qdone; SRSQ[s.qi].show = s.qshow;
  toast("已撤销上一次打分（演示）"); render();
}
function srsNew() { SRS.phase = "idle"; SRS.order = []; render(); }
V.srs = () => {
  srsEnsure();
  const remain = (SRS.order.length - SRS.pos) + SRS.redo.length;
  const head = `<div class="card"><h2>🔁 复习</h2><p class="d">先回忆再看答案；忘了的词本轮稍后再看一次，最多出现两次</p><p class="d">本批 ${SRS.batch} · 已处理 ${SRS.done + SRS.again} · 剩余 ${remain} · 待再看 ${SRS.redo.length}（演示口径） <button class="btn sm ghost" onclick="srsUndo()">撤销上次</button></p></div>`;
  if (SRS.phase === "empty") return head + `<div class="card empty"><b>都复习完了 🎉</b><p class="d">新词加进来后点“新一轮”</p><p><button class="btn sm" onclick="srsNew()">新一轮</button> <button class="btn sm ghost" onclick="nav('#/today')">回今日</button></p></div>`;
  if (SRS.phase === "done") return head + `<div class="card" style="text-align:center"><b style="font-size:40px">🎉</b><h2>本轮结束</h2><p class="d">处理 ${SRS.done + SRS.again} 个 · 记得 ${SRS.remembered} · 再看 ${SRS.again}</p><p><button class="btn sm" onclick="srsNew()">新一轮</button> <button class="btn sm ghost" onclick="nav('#/today')">回今日</button> <button class="btn sm ghost" onclick="nav('#/mistakes')">看看错题</button></p></div>`;
  const i = srsCur(), q = SRSQ[i];
  return head + `<div class="card" style="text-align:center;padding:28px 16px"><b style="font-size:34px">${q.w}</b>${q.show ? `<p style="font-size:20px"><b>${q.zh}</b></p><p class="d">凭第一感觉选</p><p>${[["忘了", 0], ["还要想想", 1], ["想起来了", 2], ["很熟悉", 3]].map(([t, lv]) => `<button class="btn sm" onclick="srsRate(${lv})">${t}</button>`).join(" ")}</p>` : `<p><button class="btn sm ghost" onclick="srsShow()">想一下，点看答案</button></p>`}</div>`;
};
V.weekly = () => {
  const wm = WREP.mode;
  const days = WREP.week;
  const total = days.reduce((a, b) => a + b.m, 0);
  const sumN = days.reduce((a, b) => a + b.n, 0), sumR = days.reduce((a, b) => a + b.r, 0);
  const max = Math.max(30, ...days.map(d => d.m));
  const bars = days.map((d, i) => `<div style="flex:1;text-align:center;cursor:pointer" onclick="wrepDay(${i})"><div style="height:90px;display:flex;align-items:flex-end;justify-content:center"><div style="width:70%;border-radius:6px 6px 0 0;background:${WREP.day === i ? "var(--brand)" : d.m > 0 ? "var(--brand2)" : "var(--line)"};height:${Math.max(4, Math.round(d.m / max * 86))}px"></div></div><div style="font-size:11px;color:${WREP.day === i ? "var(--brand)" : "var(--mut)"};font-weight:${WREP.day === i ? "700" : "400"}">${"一二三四五六日"[i]}${d.m > 0 ? "·" + d.m : ""}</div></div>`).join("");
  const dd = days[WREP.day];
  const dimRows = [["词汇", dd.dim[0]], ["语法", dd.dim[1]], ["阅读", dd.dim[2]], ["听力", dd.dim[3]]].map(([t, v]) => `<div class="dim"><span class="v">${t} ${v}</span><span class="bar w"><i style="width:${v}%"></i></span></div>`).join("");
  const sug = dd.m === 0 ? "这天没学：去今日补一节，或看看错题本。" : dd.dim[1] < 65 ? "语法是短板：每天加 5 分钟语法，明天今日里有 2 道。" : "保持手感：明天继续 " + S.minutes + " 分钟，复习优先。";
  return `<div class="card"><h2>📊 学习报告</h2><p class="d">${["周", "月"].map(m => `<button class="btn sm${wm === m ? "" : " ghost"}" onclick="WREP.mode='${m}';WREP.day=0;render()">${m}</button>`).join(" ")} · 演示数据，非服务端报告</p>${wm === "周" ? `<div style="display:flex;gap:4px;margin:8px 0">${bars}</div><div class="card" id="wrepday" style="margin:8px 0 0"><b>周${"一二三四五六日"[WREP.day]} · ${dd.m} 分钟</b><p class="d">新学 ${dd.n} · 复习 ${dd.r}</p>${dimRows}<p class="d">💡 ${sug}</p><p>${dd.m === 0 ? `<button class="btn sm" onclick="nav('#/today')">去今日补 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/mistakes')">看错题 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : `<button class="btn sm" onclick="nav('#/today')">去今日 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/srs')">去复习 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`}</p></div>` : `<div class="card" style="margin:8px 0 0"><h2>📅 本月打卡</h2><div class="cal" id="wcal"></div><div class="card" id="wday" style="margin:10px 0 0"><p class="d">点上面任意一天 👆</p></div></div>`}</div><div class="card"><h2>📈 本周累计</h2><p class="d">${total} 分钟 · 新学 ${sumN} · 复习 ${sumR} · 目标 ${S.goal || "四级词汇 B1"} · 每天 ${S.minutes} 分钟</p><p><button class="btn sm" onclick="nav('#/today')">继续今日 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/mistakes')">错题本 (${S.mistakes.length}) <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/srs')">复习 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p><p class="d">分享只读快照：不带登录态，他人打开看不到你的错题与隐私（演示说明）。 <button class="btn sm ghost" onclick="toast('分享链接已复制（演示，7 天有效）')">复制分享 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
};
const WREP = { mode: "周", day: 3, week: [{ m: 15, n: 10, r: 5, dim: [80, 60, 70, 50] }, { m: 20, n: 12, r: 8, dim: [82, 58, 71, 52] }, { m: 0, n: 0, r: 0, dim: [0, 0, 0, 0] }, { m: 25, n: 15, r: 10, dim: [85, 62, 72, 55] }, { m: 15, n: 9, r: 6, dim: [83, 64, 70, 53] }, { m: 0, n: 0, r: 0, dim: [0, 0, 0, 0] }, { m: 30, n: 18, r: 12, dim: [86, 66, 74, 57] }] };
function wrepDay(i) { WREP.day = i; render(); }
const WCAL = { 3: 15, 4: 20, 5: 0, 6: 25, 7: 15, 8: 0, 9: 30, 10: 12, 11: 18, 12: 0, 13: 22, 14: 15, 15: 28, 16: 10, 17: 0, 18: 20, 19: 15, 20: 25, 21: 0, 22: 18, 23: 15, 24: 30, 25: 12, 26: 0, 27: 20, 28: 15 };
function wcalPaint() {
  const el = document.getElementById("wcal");
  if (!el || el.dataset.p) return;
  el.dataset.p = "1";
  const days = ["一", "二", "三", "四", "五", "六", "日"];
  let h = days.map(d => `<span>${d}</span>`).join("");
  for (let d = 1; d <= 28; d++) { const m = WCAL[d] || 0; h += `<span class="${m > 0 ? "hit" : ""}" style="${m > 0 ? "" : "opacity:.5"}" onclick="wday(${d})">${d}</span>`; }
  el.innerHTML = h;
}
function wday(d) {
  const m = WCAL[d] || 0;
  const wasRepair = STM.repaired.includes(d);
  document.getElementById("wday").innerHTML = m > 0 ? `<b>9 月 ${d} 日</b><p class="d">学习 ${m} 分钟 · 新学 ${Math.round(m * 0.7)} · 复习 ${Math.round(m * 0.3)}${wasRepair ? " · 补签" : ""}</p>` : `<b>9 月 ${d} 日</b><p class="d">这天没学${STM.freeze > 0 ? `，可用 Freeze 补签（剩 ${STM.freeze}，昨日有学才可补演示规则）` : "，Freeze 用完了"}，去补一节？</p><p><button class="btn sm" onclick="stmRepair(${d})">补签 Freeze <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/today')">去今日</button></p>`;
}
V.world = () => {
  const weekMin = [3, 4, 5, 6, 7, 8, 9].reduce((a, d) => a + (WCAL[d] || 0), 0);
  const xp = weekMin * 2 + S.streak * 10;
  const xpNext = 200, pct = Math.min(100, Math.round(xp / xpNext * 100));
  const achGot = WD_ACH.filter(a => a.st === "got").length;
  return `<div class="card summary"><h2>🌍 世界</h2><p class="d">记录学习积累，查看成就、打卡与奖励。</p></div><div class="card"><p class="eyebrow">成长</p><h2>📊 我的成长</h2><p><b>Lv.3 学徒</b> <span class="tag">${xp}/${xpNext} XP</span></p><div class="prog"><i style="width:${pct}%"></i></div><p class="d">本周 ${weekMin} 分钟 · 连续 ${S.streak} 天 · 成就 ${achGot}/${WD_ACH.length} · 联赛：${LG.div} · 宝箱 ${WD_CHEST.filter(c => c.st === "open").length} 可开</p><p><button class="btn sm" onclick="WD.tab='ach';nav('#/achieve')">成就墙 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/weekly')">学习报告 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/league')">联赛 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>${checkinCard()}<div class="card"><p class="eyebrow">空间</p><h2>🏠 我的空间</h2><p class="d">背景：星夜 · 小人：默认卫衣 · 成就陈列 ${achGot} 枚（演示布置）</p><p><button class="btn sm" onclick="nav('#/avatar')">去装扮 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="WD.tab='ach';nav('#/achieve')">看看成就 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div><div class="card"><p class="eyebrow">奖励</p><h2>🎁 宝箱（${WD_CHEST.filter(c => c.st === "open").length} 可开）</h2>${WD_CHEST.map(c => `<p class="d">${c.st === "open" ? "🎁" : "🔒"} ${c.t} · ${c.d} ${c.st === "open" ? `<button class="btn sm" onclick="chestOpen('${c.id}')">开启 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ``}</p>`).join("")}</div><div class="card"><p class="eyebrow">社交</p><h2>👥 组队 5 天（演示）</h2><p class="d">${WD_TEAM.done}/5 天 · 队友：你 + 2 演示伙伴 · 奖：宝石箱（演示规则）</p><div class="prog"><i style="width:${WD_TEAM.done / 5 * 100}%"></i></div><p><button class="btn sm" onclick="teamDay()">今日组队 +1 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/msgs')">动态 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div><div class="card"><p class="eyebrow">社交</p><h2>🏠 自习房间</h2>${WD_ROOMS.map(r => `<div class="card" style="margin:8px 0"><b>${r.t}</b> <span class="tag">${r.seat}/${r.cap} 席</span><p class="d">${r.d}</p><p>${r.joined ? `<span class="tag">已在房</span> <button class="btn sm ghost" onclick="roomLeave('${r.id}')">退出</button>` : `<button class="btn sm" onclick="roomJoin('${r.id}')">加入 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`}</p></div>`).join("")}<p class="d">满员找其他房间；断线先读本人席位再恢复；同一人不占两席（演示规则）。</p></div><div class="card"><p class="eyebrow">竞技</p><h2>🏆 排行榜</h2>${LG.board.map((p, i) => `<p class="d">${i + 1}. ${p.n} · ${p.xp} XP ${p.me ? "（我）" : ""}</p>`).join("")}<p><button class="btn sm ghost" onclick="nav('#/league')">联赛详情 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div><div class="card"><h2>🗓️ 赛季</h2><p class="d">${LG.season} · 结算中与已到账分开（演示说明）。</p></div>`;
};
const LG = { div: "白银联赛", week: 3, board: [{ n: "学徒小语", xp: 320 }, { n: "你", xp: 0, me: true }, { n: "晨读阿甘", xp: 280 }, { n: "夜猫卷王", xp: 250 }, { n: "单词收割机", xp: 210 }], season: "S3 赛季 · 规则已定稿（演示）· 起止 9.1–9.30 · 资格：周学满 60 分钟" };
function lgSync() { const weekMin = [3, 4, 5, 6, 7, 8, 9].reduce((a, d) => a + (WCAL[d] || 0), 0); const me = LG.board.find(p => p.me); if (me) { me.xp = weekMin * 2 + S.streak * 10; LG.board.sort((a, b) => b.xp - a.xp); } }
V.league = () => {
  lgSync();
  return `<div class="card"><button class="btn sm ghost" onclick="nav('#/world')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 世界</button><h2>🏆 ${LG.div} · 第 ${LG.week} 周</h2><p class="d">每周日按 XP 分组；Diamond 前 10 进三阶段淘汰赛；排名可在本屏一键关闭（演示）。</p></div>` + LG.board.map((p, i) => `<div class="card" style="${p.me ? "border-color:var(--brand)" : ""}"><b>${i + 1}. ${p.n}</b> <span class="tag">${p.xp} XP</span>${p.me ? `<p class="d">就是你 · 本周继续学可超车</p>` : ``}</div>`).join("") + `<div class="card"><p class="d">演示榜：4 演示伙伴 + 你（真 XP 同步）；不填机器人冒充真人，上线按许可隐藏实名。</p><p><button class="btn sm ghost" onclick="PV.rankOff=!PV.rankOff;toast(PV.rankOff?'排名已关闭（演示）':'排名已打开（演示）');render()">${PV.rankOff ? "打开排名" : "关闭排名"}</button></p></div><div class="card"><h2>🎮 世界玩法</h2><p><button class="btn sm" onclick="nav('#/games')">小游戏 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/space')">个人空间 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/native')">原生壳 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
};
V.games = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/league')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 联赛</button><h2>🎮 小游戏</h2><p class="d">R2 门：目录可看，对局未开（演示不写开放日期）。</p><p class="d">对局开后：可信开局 → 实时判分 → 奖励自动进成长账（演示说明）。</p></div>` + ["单词消消乐", "听音拼词", "语法跑酷", "口语接龙", "阅读寻宝", "组队答题"].map(t => `<div class="card"><b>${t}</b> <span class="tag">未开放</span><p class="d">可信开局 · 判分防刷 · 奖励走成长账（开门后）</p><button class="btn sm ghost" onclick="toast('未开放：先去今日任务（演示）');nav('#/today')">去学习 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`).join("");
V.space = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/world')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 世界</button><h2>🪞 个人空间</h2><p class="d">只读参观：看布置，不写 UGC（演示）。</p></div><div class="card"><h2>演示伙伴的空间</h2><p class="d">背景：森林 · 陈列 3 枚成就 · 赛季最佳第 4（演示数据）</p><p><button class="btn sm" onclick="nav('#/avatar')">装扮我的 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/achieve')">看看成就 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div><div class="card"><p class="d">社交写链 R3 开；有用户才开榜，不填机器人冒充真人。</p></div>`;
V.subs = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/commerce')">商城</button><h2>🔁 订阅与对账</h2><p class="d">本机沙盒：商品、价格和支付状态来自同一订单。取消续订保留当前权益；退款与票据申请独立保存。</p></div>` + RF_ORDERS.filter(o => o.cat === "会员").map(o => `<div class="card"><b>${lh(o.t)} · ¥${o.price}</b><p class="d">${lh(o.pay)} · 续订${o.renewal === "cancelled" ? "已取消" : "为自动续订样例"}</p><button class="btn sm" onclick="RF.cur='${o.id}';nav('#/refund')">查看本次订阅</button></div>`).join("") + `<div class="card"><p class="d">真实支付回调、扣款、权益发放与三方对账尚未接入。</p><button class="btn sm" onclick="nav('#/commerce')">选购商品</button> <button class="btn sm ghost" onclick="nav('#/refund')">查看全部订单</button></div>`;
V.native = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/league')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 联赛</button><h2>📱 原生与多端壳</h2><p class="d">R3 末尾：稿内只画入口与门，不承诺上架日期（演示）。</p></div><div class="card"><h2>壳矩阵</h2><p class="d">uni-app 小程序目标条件编译 · 微信登录态 · iOS / Android 壳 · Tauri 桌面壳（禁 Electron）· PWA 工作区。</p><p class="d">推送 APNs / FCM；密钥进 Keychain / Keystore，不落普通存储。</p><p><button class="btn sm ghost" onclick="nav('#/about')">关于本稿 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
V.rewards = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/achieve')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 成就</button><h2>🎁 任务奖励</h2><p class="d">可信完成才结算；重放不重结（演示口径）。</p></div><div class="card"><h2>领取规则样例</h2><p class="d">连续 3 天 ＋20 XP <button class="btn sm" onclick="toast('奖励规则预览：连续学习达到条件后由正式服务结算；当前本机没有新增奖励入账')">查看领取规则</button></p><p class="d">成长结算走 Kafka 事件；R2 开榜，当前只看不动账。</p><p><button class="btn sm ghost" onclick="nav('#/world')">回世界 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/weekly')">看报告 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
const WD_CHEST = structuredClone(DEMO_FIXTURES.WD_CHEST);
function chestOpen(id) { const c = WD_CHEST.find(x => x.id === id); if (!c || c.st !== "open") return; c.st = "done"; c.d = "已开启：宝石 +20（演示，不入账）"; toast("宝箱已开（演示，不入账）"); render(); }
const WD_TEAM = { done: 0 };
function teamDay() { if (WD_TEAM.done >= 5) { toast("组队已满 5 天（演示）"); return; } WD_TEAM.done++; const c = WD_CHEST.find(x => x.id === "c2"); if (WD_TEAM.done >= 5 && c && c.st === "lock") { c.st = "open"; c.d = "组队 5 天全满开启（演示）"; } const a = WD_ACH.find(x => x.id === "a16"); if (WD_TEAM.done >= 5 && a && a.st === "lock") { a.st = "got"; a.p = "1/1"; } render(); }
const WD_ROOMS = [
  { id: "r1", t: "晨读房", d: "6:00–8:00 · 专注 25 分钟", seat: 3, cap: 8, joined: false },
  { id: "r2", t: "晚间自习", d: "20:00–22:00 · 断线可恢复", seat: 8, cap: 8, joined: false },
  { id: "r3", t: "周末冲刺", d: "周六 9:00 · 续租 7 天", seat: 2, cap: 6, joined: false },
];
function roomJoin(id) { const r = WD_ROOMS.find(x => x.id === id); if (!r) return; if (r.seat >= r.cap && !r.joined) { toast("满员了，换个房间（演示）"); return; } if (WD_ROOMS.some(x => x.joined && x.id !== id)) { toast("已在别的房，先退出（演示：不占两席）"); return; } r.joined = true; r.seat++; toast("已加入 " + r.t + "（演示）"); render(); }
function roomLeave(id) { const r = WD_ROOMS.find(x => x.id === id); if (!r || !r.joined) return; r.joined = false; r.seat--; render(); }
const WD_ACH = structuredClone(DEMO_FIXTURES.WD_ACH);
const WD = { tab: "ach" };
V.achieve = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/world')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 世界</button><h2>🏅 成就墙（${WD_ACH.filter(a => a.st === "got").length}/${WD_ACH.length}）</h2><p class="d">已获 / 未获 / 未开放分开；规则可查；未开放不挂可领红点（演示）。</p><p><button class="btn sm" onclick="nav('#/rewards')">任务奖励 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/weekly')">学习报告 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>` + WD_ACH.map(a => `<div class="card" style="${a.st === "got" ? "" : "opacity:.75"}"><b>${a.st === "got" ? "🏅 " : a.st === "lock" ? "🔒 " : "⏳ "}${a.t}</b> <span class="tag">${a.st === "got" ? "已获" : a.st === "lock" ? "未获" + (a.p ? "·" + a.p : "") : "未开放"}</span><p class="d">${a.d}</p>${a.st === "got" ? `` : a.st === "lock" ? `<button class="btn sm ghost" onclick="nav('#/today')">去攒 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : `<p class="d">赛季/房间开门后再来（不写日期）。</p>`}</div>`).join("");
V.avatar = () => `<div class="card"><h2>👕 我的背景墙＋小人</h2><p class="d">本机 2D 预览可即时试穿；3D 可用时切换显示。换装保留到本次会话结束，刷新后恢复默认。</p><div id="t3d" style="width:100%;min-height:300px;border-radius:12px;overflow:hidden">${avatarSvg()}</div><p class="d">上衣：<button class="btn sm" onclick="dress('shirt','#5b2fd6')">紫</button> <button class="btn sm" onclick="dress('shirt','#1d9e6b')">绿</button> <button class="btn sm" onclick="dress('shirt','#d64545')">红</button></p><p class="d">发型：<button class="btn sm" onclick="dress('hair','round')">圆寸</button> <button class="btn sm" onclick="dress('hair','cap')">帽子</button>　配饰：<button class="btn sm" onclick="dress('acc','glasses')">眼镜</button> <button class="btn sm" onclick="dress('acc','none')">无</button></p><p class="d">背景墙：<button class="btn sm" onclick="dress('wall','#1c1430')">星夜</button> <button class="btn sm" onclick="dress('wall','#0e3b2e')">森林</button> <button class="btn sm" onclick="dress('wall','#3b1d0e')">沙漠</button></p><button class="btn" onclick="wave()"${AX.m ? "" : " disabled"}>👋 打招呼</button>${AX.m ? "" : `<p class="d">动效已关闭，挥手暂停；仍可静态试穿。</p>`}</div><div class="card"><h2>衣柜</h2><p class="d">目录可看，试穿不落库；兑换需权益（未开放）</p><span class="tag">默认卫衣·试穿中</span><span class="tag">星空外套·未开放</span><br><button class="btn sm" onclick="toast('兑换未开放：先完成学习任务')">兑换</button><p><button class="btn sm" onclick="nav('#/world')">回世界 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/achieve')">看看成就 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/a11y')">动效设置 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
const AVATAR = { shirt: "#5b2fd6", hair: "round", acc: "none", wall: "#1c1430", greeting: false };
const AVATAR_OPTIONS = { shirt: ["#5b2fd6", "#1d9e6b", "#d64545"], hair: ["round", "cap"], acc: ["glasses", "none"], wall: ["#1c1430", "#0e3b2e", "#3b1d0e"] };
let T3 = null, T3_LOADING = null, T3_FAILED = false, AVATAR_GREETING = 0, AVATAR_GREETING_TOKEN = 0;
function avatarSvg() {
  return `<svg viewBox="0 0 320 300" role="img" aria-label="本机2D装扮预览" style="display:block;width:100%;height:300px"><rect width="320" height="300" fill="${AVATAR.wall}"/><circle cx="270" cy="42" r="15" fill="#f2c89b" opacity=".35"/><circle cx="42" cy="64" r="3" fill="#f2c89b"/><circle cx="70" cy="36" r="2" fill="#f2c89b"/><ellipse cx="160" cy="274" rx="85" ry="11" fill="#000" opacity=".2"/><path d="M142 228v35m36-35v35" stroke="#292b3e" stroke-width="24" stroke-linecap="round"/><path d="M116 153q44-31 88 0l-11 82h-66z" fill="${AVATAR.shirt}"/><path d="M121 164l-24 55" stroke="#f2c89b" stroke-width="18" stroke-linecap="round"/><path d="${AVATAR.greeting ? "M199 162l27-32 3-29" : "M199 164l24 55"}" stroke="#f2c89b" stroke-width="18" stroke-linecap="round"/><rect x="147" y="125" width="26" height="27" rx="10" fill="#f2c89b"/><circle cx="160" cy="97" r="42" fill="#f2c89b"/>${AVATAR.hair === "cap" ? `<path d="M116 82q7-40 44-40t44 40z" fill="#d64545"/><path d="M159 76h62" stroke="#d64545" stroke-width="12" stroke-linecap="round"/>` : `<path d="M118 86q2-47 42-43t42 43q-19-22-42-9t-42 9" fill="#2b2118"/>`}<circle cx="146" cy="101" r="3" fill="#292b3e"/><circle cx="175" cy="101" r="3" fill="#292b3e"/><path d="M148 117q13 11 26 0" stroke="#292b3e" stroke-width="3" fill="none" stroke-linecap="round"/>${AVATAR.acc === "glasses" ? `<g stroke="#111" stroke-width="3" fill="none"><rect x="133" y="90" width="26" height="20" rx="6"/><rect x="163" y="90" width="26" height="20" rx="6"/><path d="M159 98h4"/></g>` : ""}${AVATAR.greeting ? `<text x="218" y="80" fill="#f2c89b" font-size="17">Hi!</text>` : ""}</svg>`;
}
function avatarLive() { const el = document.getElementById("t3d"); return el?.isConnected && !document.hidden && location.hash === "#/avatar" ? el : null; }
function avatarFallback(reason = "2D 预览可立即试穿；3D 正在载入。") { const el = avatarLive(); if (el) el.innerHTML = avatarSvg() + `<p class="meta" style="padding:0 12px 10px">${lh(reason)}</p>`; }
function avatarStop() {
  if (T3?.raf) cancelAnimationFrame(T3.raf);
  if (T3) { T3.raf = 0; T3.waving = 0; T3.M.armR.rotation.z = -0.2; T3.M.body.rotation.y = 0; if (avatarLive()) T3.renderer.render(T3.scene, T3.cam); }
  clearTimeout(AVATAR_GREETING); AVATAR_GREETING = 0; AVATAR_GREETING_TOKEN++; AVATAR.greeting = false;
  if (!T3 && avatarLive()) avatarFallback(T3_FAILED ? "3D 不可用，已切换本机 2D；全部试穿控件仍可用。" : "2D 预览可立即试穿；3D 正在载入。");
}
function avatarTick() {
  if (!T3) return; T3.raf = 0;
  if (!AX.m || !avatarLive()) { T3.waving = 0; return; }
  T3.spin += 0.004; const t = performance.now() / 90;
  T3.M.armR.rotation.z = T3.waving > 0 ? (-0.9 + Math.sin(t) * 0.7) : (-0.2 + Math.sin(T3.spin) * 0.06);
  if (T3.waving > 0) T3.waving--; T3.M.body.rotation.y = Math.sin(T3.spin * 0.6) * 0.08;
  T3.renderer.render(T3.scene, T3.cam); T3.raf = requestAnimationFrame(avatarTick);
}
function avatarSync() {
  const el = avatarLive(); if (!el) return;
  if (!T3) { avatarFallback(T3_FAILED ? "3D 不可用，已切换本机 2D；全部试穿控件仍可用。" : "2D 预览可立即试穿；3D 正在载入。"); return; }
  if (!AX.m) avatarStop();
  if (!el.contains(T3.renderer.domElement)) el.replaceChildren(T3.renderer.domElement);
  T3.M.body.material.color.set(AVATAR.shirt); T3.M.cap.visible = AVATAR.hair === "cap"; T3.M.hair.visible = AVATAR.hair !== "cap"; T3.M.glasses.visible = AVATAR.acc === "glasses"; T3.scene.background.set(AVATAR.wall); T3.ground.material.color.set(AVATAR.wall);
  T3.M.armR.rotation.z = -0.2; T3.M.body.rotation.y = 0;
  const width = el.clientWidth || 320; T3.renderer.setSize(width, 300); T3.cam.aspect = width / 300; T3.cam.updateProjectionMatrix(); T3.renderer.render(T3.scene, T3.cam);
  if (AX.m && !T3.raf) T3.tick();
}
function avatarLoadThree() { return Promise.reject(new Error("静态演示只使用本机 2D 预览。")); }
async function stage3d() {
  let el = avatarLive(); if (!el) return;
  if (T3 || T3_FAILED) { avatarSync(); return; }
  avatarFallback();
  let candidate = null;
  try {
    T3_LOADING ||= avatarLoadThree(); const THREE = await T3_LOADING;
    el = avatarLive(); if (!el) return;
    if (T3) { avatarSync(); return; }
    const W = el.clientWidth || 320, H = 300;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    candidate = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    el.replaceChildren(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1c1430");
    const cam = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    cam.position.set(0, 1.6, 4.2); cam.lookAt(0, 1, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(2, 4, 3); scene.add(key);
    const skin = new THREE.MeshStandardMaterial({ color: "#f2c89b" });
    const M = {};
    M.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.7, 6, 14), new THREE.MeshStandardMaterial({ color: "#5b2fd6" }));
    M.body.position.y = 0.85; scene.add(M.body);
    M.head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), skin); M.head.position.y = 1.72; scene.add(M.head);
    M.hair = new THREE.Mesh(new THREE.SphereGeometry(0.31, 20, 12, 0, Math.PI * 2, 0, 1.4), new THREE.MeshStandardMaterial({ color: "#2b2118" }));
    M.hair.position.y = 1.78; scene.add(M.hair);
    M.cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.35, 16), new THREE.MeshStandardMaterial({ color: "#d64545" }));
    M.cap.position.y = 2.0; M.cap.visible = false; scene.add(M.cap);
    const armG = new THREE.CapsuleGeometry(0.09, 0.5, 4, 8);
    M.armL = new THREE.Mesh(armG, skin); M.armL.position.set(-0.46, 1.05, 0); scene.add(M.armL);
    M.armR = new THREE.Mesh(armG, skin); M.armR.position.set(0.46, 1.05, 0); scene.add(M.armR);
    M.glasses = new THREE.Group();
    const gm = new THREE.MeshStandardMaterial({ color: "#111111" });
    const l1 = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 16), gm); l1.position.set(-0.11, 1.74, 0.26);
    const l2 = l1.clone(); l2.position.x = 0.11; M.glasses.add(l1, l2); M.glasses.visible = false; scene.add(M.glasses);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1.4, 28), new THREE.MeshStandardMaterial({ color: "#2c2350" }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    T3 = { THREE, scene, cam, renderer, M, ground, waving: 0, spin: 0, raf: 0, tick: avatarTick };
    avatarSync();
  } catch (e) { avatarStop(); candidate?.dispose(); T3 = null; T3_FAILED = true; avatarFallback("3D 不可用，已切换本机 2D；全部试穿控件仍可用。"); }
}
function dress(part, v) {
  if (!AVATAR_OPTIONS[part]?.includes(v) || !avatarLive()) return;
  AVATAR[part] = v; avatarSync(); dressAck({ shirt: "上衣", hair: "发型", acc: "配饰", wall: "背景墙" }[part]);
}
function wave() {
  if (!AX.m) { toast("动效已关闭，挥手暂停；仍可静态试穿"); return; } if (!avatarLive()) return;
  AVATAR.greeting = true; if (T3) { T3.waving = 40; if (!T3.raf) T3.tick(); } else avatarSync();
  clearTimeout(AVATAR_GREETING); const token = ++AVATAR_GREETING_TOKEN;
  AVATAR_GREETING = setTimeout(() => { if (token !== AVATAR_GREETING_TOKEN) return; AVATAR.greeting = false; AVATAR_GREETING = 0; avatarSync(); }, 900);
}
const MSGS = structuredClone(DEMO_FIXTURES.MSGS);
const MG = { cat: "全部" };
function msgGo(id) { const m = MSGS.find(x => x.id === id); if (!m) return; m.read = true; if (m.go) nav(m.go); else render(); }
V.msgs = () => { const un = MSGS.filter(m => !m.read).length; const list = MSGS.filter(m => MG.cat === "全部" || m.cat === MG.cat); return `<div class="card"><h2>✉️ 消息${un ? `（${un} 未读）` : ""}</h2><p class="d">${["全部", "学习", "系统", "互动"].map(c => `<button class="btn sm${MG.cat === c ? "" : " ghost"}" onclick="MG.cat='${c}';render()">${c}</button>`).join(" ")} <button class="btn sm ghost" onclick="MSGS.forEach(m=>m.read=true);render()">全标已读</button> <button class="btn sm ghost" onclick="nav('#/npref')">通知偏好 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>` + (list.length ? list.map(m => `<article class="card"><p class="d">${m.read ? "已读" : "未读"}</p><b>${m.read ? "" : "● "}${m.t}</b> <span class="tag">${m.cat}</span><p class="d">${m.d}</p><p class="meta">${m.time}</p>${m.go ? `<p><button class="btn sm ghost" onclick="msgGo('${m.id}')">去看看 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p>` : `<button class="btn sm ghost" onclick="msgGo('${m.id}')" ${m.read ? "disabled" : ""}>${m.read ? "已标为已读" : "标为已读"}</button>`}</article>`).join("") : `<div class="card empty"><b>这类没消息</b></div>`); };
V.me = () => `<div class="card summary" style="text-align:center"><div style="font-size:44px">😎</div><b style="font-size:19px">${lh(S.user || "未登录")}</b><p class="d">B1 · 已坚持 ${S.streak} 天 · 错题 ${S.mistakes.length}</p><p><span class="tag">Lv.3 学徒</span> <span class="tag">本周 15 分钟</span></p></div><div class="card"><h2>▶️ 继续学</h2><p class="d">${S.lastRead.book} · ${S.lastRead.ch}</p><p><button class="btn sm" onclick="resumeChapter()">继续读 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/today')">今日任务 (${S.today.length}) <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p>${S.mistakes.length ? `<p class="d">上道错题：${String(S.mistakes[S.mistakes.length - 1].t).slice(0, 18)}… <button class="btn sm ghost" onclick="nav('#/mistakes')">去补救 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p>` : ``}</div><div class="card"><p class="eyebrow">学习工具</p><h2>📚 学习</h2>${[["📚 图书管", "#/shelf", "在读·第二章"], ["⚡ 快速书架", "#/courses", ""], ["❤️ 错题本", "#/mistakes", S.mistakes.length ? S.mistakes.length + " 待补" : ""], ["🔁 复习", "#/srs", SRSQ.filter(q => !q.done).length ? SRSQ.filter(q => !q.done).length + " 到期" : ""], ["📊 学习报告", "#/weekly", ""], ["⚔️ 刷单词", "#/wordbook", "40 词"], ["🔤 音标", "#/phonics", ""], ["🔠 字母", "#/alphabet", ""]].map(([t, h, b]) => `<button class="opt" onclick="nav('${h}')">${t}${b ? ` <span class="tag">${b}</span>` : ""} <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join("")}</div><div class="card"><p class="eyebrow">发现</p><h2>🌍 探索</h2>${[["🌍 世界", "#/world", "联赛·宝箱"], ["👕 装扮", "#/avatar", ""], ["🤖 AI 伴学", "#/ai", "演示"], ["🎤 语音跟读", "#/voice", ""], ["✉️ 消息", "#/msgs", MSGS.filter(m => !m.read).length ? MSGS.filter(m => !m.read).length + " 未读" : ""], ["🔍 搜索", "#/search", ""], ["🛒 商城", "#/commerce", "演示价"], ["🔒 青少年模式", "#/k12", "P3 未开"]].map(([t, h, b]) => `<button class="opt" onclick="nav('${h}')">${t}${b ? ` <span class="tag">${b}</span>` : ""} <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join("")}</div><div class="card"><p class="eyebrow">单项</p><h2>🔤 听说读写</h2>${[["📖 词汇详情", "#/vocab", S.mistakes.filter(m => m.kind === "word").length ? S.mistakes.filter(m => m.kind === "word").length + " 待补" : ""], ["🎧 听力", "#/listening", ""], ["🎙️ 口语", "#/speaking", "语音跟读可用"], ["✍️ 写作", "#/writing", "暂无题"]].map(([t, h, b]) => `<button class="opt" onclick="nav('${h}')">${t}${b ? ` <span class="tag">${b}</span>` : ""} <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join("")}</div><div class="card"><p class="eyebrow">设置与帮助</p><h2>👤 账号与系统</h2>${[["📦 离线包", "#/offpkg", "未开放下载"], ["🧾 退款开票", "#/refund", ""], ["⚙️ 设置", "#/settings", ""], ["♿ 无障碍", "#/a11y", ""], ["ℹ️ 关于", "#/about", ""], ["🧪 演示工具", "#/lab", ""]].map(([t, h, b]) => `<button class="opt" onclick="nav('${h}')">${t}${b ? ` <span class="tag">${b}</span>` : ""} <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join("")}</div><div class="card"><h2>🛠️ 员工</h2><p class="d">需 staff 权限；普通账号只看说明，不进控制台（演示）。</p>${S.staff ? `<button class="opt" onclick="nav('#/admin')">🛠️ 管理控制台 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : `<button class="opt" onclick="S.staff=true;toast('已切 staff 演示身份');render()">🔓 切 staff 演示身份 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`}<button class="opt" onclick="nav('#/support')">💬 客服 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>${DEMO ? `<div class="card"><p class="d">测试：</p>${[["🧪 更多状态屏", "#/arrears"], ["⛔ 门被拒", "#/greject"], ["📄 同意升级", "#/cupgrade"]].map(([t, h]) => `<button class="opt" onclick="nav('${h}')">${t} <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join("")}</div>` : ``}`;
V.about=()=>'<section class="card"><p class="eyebrow">第二版 · 静态产品体验</p><h2>语学星</h2><p class="d">为18岁以上成人与大学生设计，围绕学习目标、练习、反馈、复习与复盘。此演示全部使用原创合成数据，账号、订单和管理操作只存在本机。</p><span class="tag">webDemo v2 · UI/UX 重做</span></section><section class="card"><h2>使用说明与隐私</h2><p class="d">以下是本静态演示的说明，不替代正式服务条款。说明在本页打开，不依赖另外启动的官网。</p><div class="actions"><button class="btn ghost" onclick="uiReadPolicy(\'TERMS\')">演示使用说明</button><button class="btn ghost" onclick="uiReadPolicy(\'PRIVACY\')">本机数据与隐私</button><button class="btn ghost" onclick="uiReadPolicy(\'ADULT_LEARNING\')">成年人学习边界</button></div></section><section class="card"><h2>常见问题</h2><details><summary>如何从头体验注册和学习？</summary><p class="d">在演示控制选择新用户，或创建合成账号。依次确认成年人状态、签署三项说明、设定目标并完成样例测评。</p><button class="btn ghost" onclick="nav(\'#/register\')">创建合成账号</button></details><details><summary>撤回同意后还能做什么？</summary><p class="d">学习入口立即受限，账号设置和本人客服仍可使用。重新主动签署当前说明后可继续。</p><button class="btn ghost" onclick="nav(\'#/privacy\')">管理同意</button></details><details><summary>怎样清理本机演示记录？</summary><p class="d">演示控制中的重置只清除当前端的合成档案。另一个端与真实产品数据均不受影响。</p><button class="btn ghost" onclick="DemoUI.open()">打开演示控制</button></details></section><section class="card"><h2>继续体验</h2><div class="actions"><button class="btn" onclick="nav(\'#/support\')">联系演示客服</button><button class="btn ghost" onclick="nav(\'#/native\')">设备与模拟安装</button><button class="btn ghost" onclick="nav(\'#/commerce\')">查看合成套餐</button></div></section><section class="card"><h2>版本与资源</h2><p class="d">前台使用仓库内自编写的 HTML、CSS、JavaScript 与原创样例。没有远程模型或第三方身份跳转，也不从 CDN 载入 3D 模块。</p></section>';
V.settings = () => `<div class="card"><h2>🎯 学习偏好</h2><p class="d">当前：${S.goal || "四级词汇 B1"} · 每天 ${S.minutes} 分钟</p><label class="lb">目标</label><select id="sg"><option${(S.goal || "").includes("四级") ? " selected" : ""}>大学英语四级 · B1</option><option${(S.goal || "").includes("零基础") ? " selected" : ""}>零基础 · A1</option><option${(S.goal || "").includes("六级") ? " selected" : ""}>六级 · B2</option></select><label class="lb">每天分钟</label><select id="sm">${[5, 15, 30, 45].map(m => `<option${S.minutes === m ? " selected" : ""}>${m}</option>`).join("")}</select><button class="btn" onclick="doSetGoal()">保存偏好</button><p class="d">保存后今日起按新目标重排；已完成记录保留，不抹历史（演示）。</p></div><div class="card"><h2>🔔 通知</h2><p class="d">开关只在通知偏好里管，这里只留入口（演示）。</p><button class="opt" onclick="nav('#/npref')">通知偏好与免打扰 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><div class="card"><h2>🎨 显示与语言</h2><button class="opt" onclick="nav('#/a11y')">♿ 无障碍（对比/字体/动效） <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><p class="d">主题：${["follow", "light", "dark"].map(t => `<button class="btn sm${SET.theme === t ? "" : " ghost"}" onclick="SET.theme='${t}';toast('主题：${{ follow: "跟随系统", light: "浅色", dark: "深色" }[t]}');render()">${{ follow: "跟随系统", light: "浅色", dark: "深色" }[t]}</button>`).join(" ")}</p><p class="d">界面语言：<button class="btn sm" onclick="toast('界面语言：中文（演示）')">中文 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p><p class="d">内容语言：<button class="btn sm" onclick="toast('内容语言：英语（演示）')">英语 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p><p class="d">界面语言只管按钮文案，题目语言不动（locale 分离）。</p></div><div class="card"><h2>📱 设备与隐私</h2><button class="opt" onclick="nav('#/devices')">📱 设备管理 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="opt" onclick="nav('#/privacy')">🔒 隐私（导出/删除） <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="opt" onclick="nav('#/cupgrade')">📄 同意版本 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><div class="card"><h2>👤 账号</h2><p class="d">推送未开：通知开关只记偏好，不代表能收到推送（演示）。</p><button class="btn ghost" onclick="arm(this,function(){S.user=null;toast('已退出');nav('#/login')})">退出登录</button></div>`;
function doSetGoal() { S.goal = document.getElementById("sg").selectedOptions[0].text; S.minutes = parseInt(document.getElementById("sm").value, 10); toast("偏好已保存，今日起重排（演示）"); render(); }
const PV = { exp: null, del: null };
const SUP = { cat: "功能", draft: "", cur: null, from: "support", list: [{ id: "TK-1024", cat: "功能", t: "听力播到一半停了", st: "处理中" }, { id: "TK-1019", cat: "账号", t: "换手机想踢掉旧设备", st: "已回复" }] };
V.devices = () => `<div class="card"><h2>📱 设备</h2><p class="d">设备管理界面预览，没有连接真实会话服务。</p><div class="card" style="margin:0 0 8px;border-color:var(--brand)"><b>本机浏览器</b> <span class="tag">当前演示</span><p class="d">退出会结束当前演示身份和管理预览；本机草稿与学习记录保留。清除数据请使用原型演示工具。</p></div><div class="card" style="margin:0"><b>Android · Pixel（固定样例）</b><p class="d">最后活跃：2 天前（样例） <button class="btn sm" onclick="arm(this,function(){toast('已演示踢出确认；没有连接真实设备')})">预览踢出确认</button></p></div></div>`;
function privacyExport() { PV.exp ||= lmId("demo-export"); toast("导出请求已保存在本机（演示）"); render(); }
function privacyDelete() { PV.del ||= lmId("demo-delete"); toast("删除请求已保存在本机（演示），可撤回"); render(); }
function privacyCancelDelete() { PV.del = null; toast("已撤回本机删除请求（演示）"); render(); }
V.privacy = () => `<div class="card"><h2>🔒 隐私</h2><p class="d">本页保存本机演示请求。正式导出、账号删除和服务清理尚未接入；学习记录与草稿仍保留。</p><p><button class="btn sm" onclick="privacyExport()">申请导出</button> <button class="btn sm" onclick="arm(this,privacyDelete)"${PV.del ? " disabled" : ""}>申请删除</button> <button class="btn sm ghost" onclick="nav('#/paudio')">音频保留</button> <button class="btn sm ghost" onclick="PV.rankOff=!PV.rankOff;toast(PV.rankOff?'排名已关闭（演示）':'排名已打开（演示）');render()">${PV.rankOff ? "打开排名" : "关闭排名"}</button></p>${PV.exp ? `<div class="fb wa" style="display:block">导出 ${lh(PV.exp)} · 本机请求已保存，等待正式服务接入；尚未生成导出文件。</div>` : ``}${PV.del ? `<div class="fb wa" style="display:block">删除 ${lh(PV.del)} · 本机请求已保存，尚未执行账号删除或数据清理。<p><button class="btn sm ghost" onclick="privacyCancelDelete()">撤回删除请求</button></p></div>` : ``}</div>`;
V.support = () => `<div class="card"><h2>💬 客服</h2><p class="d">一句话描述问题，最多 40 字。工单和草稿保存在本机；此原型尚未发送至客服。</p><p class="d">分类：${["功能", "账号", "内容", "支付"].map(c => `<button class="btn sm${SUP.cat === c ? "" : " ghost"}" onclick="SUP.cat='${c}';render()">${c}</button>`).join(" ")}</p><input id="sup" aria-label="问题描述" maxlength="40" value="${lh(SUP.draft)}" oninput="supDraftInput()" placeholder="一句话描述问题（最多40字）"><button class="btn" onclick="supSend()">提交工单</button> <button class="btn ghost" onclick="SUP.cur=null;SUP.from='support';nav('#/tdetail')">查看全部工单</button></div><div class="card"><h2>🧾 我的工单（${SUP.list.length}）</h2>${SUP.list.map(t => `<div class="card" style="margin:8px 0"><b>${lh(t.id)}</b> <span class="tag">${lh(t.cat)}</span> <span class="tag">${lh(t.st)}</span><p class="d">${lh(t.t)}</p><button class="btn sm ghost" onclick="supOpen('${t.id}')">查看这张工单</button></div>`).join("")}</div>`;
function supDraftInput() { const el = document.getElementById("sup"); if (el) SUP.draft = el.value || ""; dbSave(); }
function supOpen(id, from = "support") { if (!SUP.list.some(t => t.id === id)) { toast("未找到这张工单，请返回列表"); return; } SUP.cur = id; SUP.from = from === "acs" ? "acs" : "support"; nav("#/tdetail"); }
function supClose() { SUP.cur = null; nav(SUP.from === "acs" ? "#/acs" : "#/support"); }
function supSend() {
  const el = document.getElementById("sup"), v = (el ? el.value : SUP.draft).trim();
  if (!v) { toast("先写一句话"); return; } if (v.length > 40) { SUP.draft = v; dbSave(); toast("最多 40 字，请缩短描述后提交"); return; }
  const id = lmId("demo-ticket"); SUP.list.unshift({ id, cat: SUP.cat, t: v, st: "已提交" }); SUP.draft = ""; if (el) el.value = "";
  toast("本机工单已保存，编号 " + id + "（演示）"); render();
}
const SH = { q: "", hist: ["四级", "音标"] };
function sidx() {
  const idx = [];
  BOOKS.forEach(b => idx.push({ ty: "课程", t: b.title, d: b.intro, go: "#/shelf" }));
  WB4.concat(WB6).forEach(w => idx.push({ ty: "词汇", t: w[0], d: w[2], go: "#/drill" }));
  [["重置密码", "我的→设置", "#/settings"], ["退款", "我的→退款开票", "#/refund"], ["音标", "首页→零基础专区", "#/phonics"], ["客服", "我的→客服", "#/support"]].forEach(([t, d, go]) => idx.push({ ty: "帮助", t, d, go }));
  return idx;
}
function sgo(t) { if (t && !SH.hist.includes(t)) { SH.hist.unshift(t); SH.hist = SH.hist.slice(0, 5); } }
V.search = () => {
  const q = SH.q.trim().toLowerCase();
  const res = q ? sidx().filter(e => (e.t + e.d).toLowerCase().includes(q)).slice(0, 8) : [];
  const groups = ["课程", "词汇", "帮助"].map(g => ({ g, items: res.filter(e => e.ty === g) })).filter(x => x.items.length);
  return `<div class="card"><h2>搜索</h2><input id="q" placeholder="搜课程/词汇/帮助" value="${lh(SH.q)}" oninput="SH.q=this.value;render2()"><div id="sr"></div><p class="d">词汇结果进详情页（可自测/加复习），课程进图书管。</p></div>` + (!q ? `<div class="card"><p class="d">历史：${SH.hist.map(h => `<button class="btn sm ghost" onclick="SH.q='${h}';render()">${h}</button>`).join(" ")}</p></div>` : groups.length ? groups.map(({ g, items }) => `<div class="card"><b>${g}</b>${items.map(e => `<button class="opt" onclick="sgo('${e.t}');sgo2('${e.t}','${e.ty}')">${e.t} · ${e.d} <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join("")}</div>`).join("") : `<div class="card empty"><b>没搜到“${lh(SH.q)}”</b><p class="d">换个词试试</p></div>`);
};
function sgo2(t, ty) {
  if (ty === "词汇") {
    const a = vcAll().find(x => x.w.toLowerCase() === String(t).toLowerCase());
    if (a) { VC.w = a.w; VC.quizPick = -1; VC.q = ""; nav("#/vocab"); return; }
  }
  const idx = sidx().find(e => e.t === t);
  nav(idx ? idx.go : "#/shelf");
}
function render2() { const v = document.getElementById("q"); const pos = v ? v.selectionStart : 0; render(); const n = document.getElementById("q"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } } }
const GOODS = structuredClone(DEMO_FIXTURES.GOODS);
const GC = { cat: "全部", cur: null };
const PAY = { productId: null, title: "", price: 0, cat: "", intentId: null, orderId: null, phase: "idle", message: "" };
function checkoutOpen(id, fresh = false) {
  const g = GOODS.find(x => x.id === id); if (!g) { toast("商品不存在，请重新选择"); return; }
  if (fresh || PAY.productId !== id || !PAY.intentId) Object.assign(PAY, { productId: g.id, title: g.t, price: g.price, cat: g.cat, intentId: lmId("demo-checkout"), orderId: null, phase: "ready", message: "" });
  GC.cur = id; nav("#/pay");
}
function payStatus(o) { return { paid: "已支付（沙盒）", failed: "支付失败（沙盒）", unknown: "支付结果未知（沙盒）", refunded: "已退款（沙盒）" }[o.paymentPhase] || "待支付（沙盒）"; }
function paySettle(o, phase) {
  o.paymentPhase = phase; o.pay = payStatus(o); o.right = phase === "paid" ? "有效（本机演示）" : "未开通（本机演示）";
  if (PAY.orderId === o.id) { PAY.phase = phase; PAY.message = phase === "paid" ? "沙盒支付已确认，本机订单已保存；不会扣真款或发放真实权益。" : phase === "unknown" ? "本次沙盒结果未知。请查询同一订单，确认前不开放演示权益。" : "本次沙盒支付失败。可重试同一订单，不会另建一笔。"; }
}
function payCommit(intentId) {
  if (!PAY.productId || PAY.intentId !== intentId) { toast("结算商品已变化，请重新确认"); return; }
  let o = RF_ORDERS.find(x => x.id === PAY.orderId);
  if (o && ["paid", "unknown", "refunded"].includes(o.paymentPhase)) { toast(o.paymentPhase === "unknown" ? "请先查询本次订单结果" : "本次订单已完成，可在订单页查看"); return; }
  if (LAB.offline) { PAY.message = "断网模式：选择和价格已保留，本次未提交沙盒支付。"; render(); return; }
  if (!o) {
    o = { id: lmId("demo-order"), productId: PAY.productId, t: PAY.title, price: PAY.price, cat: PAY.cat, paymentPhase: "ready", pay: "待支付（沙盒）", right: "未开通（本机演示）", rf: "无", step: -1, renewal: PAY.cat === "会员" ? "active" : "none", receiptStatus: "未申请", invoiceStatus: "未申请", demo: true };
    RF_ORDERS.unshift(o); PAY.orderId = o.id;
  }
  const phase = LAB.failNext ? "failed" : LAB.unknownNext ? "unknown" : "paid";
  if (LAB.failNext) LAB.failNext = false; else if (LAB.unknownNext) LAB.unknownNext = false;
  paySettle(o, phase); render();
}
function payResolve(id = PAY.orderId) {
  const o = RF_ORDERS.find(x => x.id === id); if (!o || o.paymentPhase !== "unknown") return;
  if (LAB.offline) { toast("断网模式下无法查询，本次订单仍保留"); return; }
  paySettle(o, "paid"); toast("已查询同一订单：沙盒支付已确认"); render();
}
function payRetry(id = PAY.orderId) {
  const o = RF_ORDERS.find(x => x.id === id); if (!o || o.paymentPhase !== "failed") { toast("该单无需重试，请查看当前状态"); return; }
  Object.assign(PAY, { productId: o.productId, title: o.t, price: o.price, cat: o.cat, intentId: PAY.orderId === id && PAY.intentId ? PAY.intentId : lmId("demo-checkout"), orderId: id, phase: "ready", message: "重试原订单，商品与价格保持原快照。" }); nav("#/pay");
}
V.commerce = () => {
  if (GC.cur && GOODS.some(x => x.id === GC.cur)) { const g = GOODS.find(x => x.id === GC.cur); return `<div class="card"><button class="btn sm ghost" onclick="GC.cur=null;render()"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 商城</button><h2>${g.t}</h2><p>${g.tag ? `<span class="tag">${g.tag}</span> ` : ""}<span class="tag">${g.cat}</span></p><p class="d">${g.d}</p><p style="font-size:26px"><b>¥${g.price}</b> <s class="meta">¥${g.oprice}</s></p><p class="d">本机沙盒商品，不发货、不扣款、不承诺考试成绩。</p><button class="btn" onclick="checkoutOpen('${g.id}')">去结算 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`; }
  const cats = ["全部", "会员", "课程", "周边"];
  const list = GOODS.filter(g => GC.cat === "全部" || g.cat === GC.cat);
  return `<div class="card"><h2>🛒 商城（演示价，不扣款）</h2><p class="d">${cats.map(c => `<button class="btn sm${GC.cat === c ? "" : " ghost"}" onclick="GC.cat='${c}';render()">${c}</button>`).join(" ")}</p><p><button class="btn sm ghost" onclick="nav('#/refund')">我的订单 / 退款 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/subs')">订阅对账 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>` + list.map(g => `<div class="card"><b>${g.t}</b> ${g.tag ? `<span class="tag">${g.tag}</span>` : ""}<p class="d">${g.d}</p><p><b>¥${g.price}</b> <s class="meta">¥${g.oprice}</s> <button class="btn sm" style="float:right" onclick="GC.cur='${g.id}';render()">详情 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`).join("");
};
function dressAck(c) { toast("换装：" + c + "（演示，不落库）"); }
const ADM = { pub: 6, pend: 2, users: 128, risk: 1 };
V.admin = () => `<div class="card"><p class="d">staff 视角（test 档）· 双签申请人禁自审</p><h2>📊 今日概览</h2><p><span class="tag">在架 ${ADM.pub}</span> <span class="tag">待审 ${ADM.pend}</span> <span class="tag">学员 ${ADM.users}</span> <span class="tag">风险 ${ADM.risk}</span></p><p class="d">口径：仅统计已发布与已落库，不含草稿（演示）。</p></div><div class="card"><h2>📌 待办（${ADM.pend}）</h2><p class="d">语法课 v3 · 等 L1 <button class="btn sm" onclick="nav('#/areview')">去审 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p><p class="d">RISK-001 · 等建档 <button class="btn sm" onclick="nav('#/agov')">去看 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div><div class="card"><h2>🧭 管理</h2>${[["📝 建稿送审", "#/adraft"], ["✔️ 双签审核", "#/areview"], ["🚀 发布回滚", "#/apublish"], ["🛡️ 治理风控", "#/agov"], ["📜 审计", "#/aaudit"], ["🔑 权限只读", "#/aperm"], ["🔐 管理登录", "#/alogin"], ["🎞️ 媒体上传", "#/amedia"], ["🎧 客服后台", "#/acs"], ["🧾 商城后台", "#/ashop"], ["🚩 举报队列", "#/areport"], ["📡 观测恢复", "#/aobs"]].map(([t, h]) => `<button class="opt" onclick="nav('${h}')">${t} <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join("")}</div>`;
V.aperm = () => `<div class="card"><h2>🔑 权限（只读）</h2><p class="d">role-learner：14 项学员权限</p><p class="d">staff：投影/审计/工单读</p><p class="d">reviewer-l1/l2：初审/终审发布</p><p class="d">改权限走双人审批（演示无入口）。</p><p><button class="btn sm ghost" onclick="nav('#/admin')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 管理</button></p></div>`;
V.adraft = () => `<div class="card"><h2>草稿箱</h2><p class="d">版本锁 · 无权 403 不泄漏存在性</p><div class="card" style="margin:0 0 8px"><b>语法课 · There be 句型（v3）</b><p class="d">版权已绑定 · 报告已绑定 · 缺项：无</p><button class="btn sm" onclick="toast('已送审（演示）')">提交送审</button></div><label class="lb">新建草稿标题</label><input id="dt" value="新课标题"><button class="btn" onclick="toast('草稿已建 202（演示）')">建稿</button><p><button class="btn sm ghost" onclick="nav('#/admin')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 管理</button></p></div>`;
V.areview = () => `<div class="card"><h2>L1 初审</h2><p class="d">reviewer-l1 视角</p><button class="btn" onclick="A.l1=true;toast('L1 通过（演示）');paintRev()">通过</button></div><div class="card"><h2>L2 终审</h2><p class="d">reviewer-l2 视角 · 自动 ACTIVE</p><button class="btn" onclick="A.l2=true;toast('L2 通过，已 ACTIVE（演示）');paintRev()">通过并发布</button></div><div class="card"><h2>状态</h2><p class="d" id="revst">L1 待审 · L2 待审</p><p><button class="btn sm ghost" onclick="nav('#/admin')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 管理</button></p></div>`;
V.apublish = () => `<div class="card"><h2>发布 / 下线 / 回滚</h2><p class="d">目录实时预览</p><button class="btn sm" onclick="toast('已发布，书架可见（演示）')">发布</button> <button class="btn sm" onclick="arm(this,function(){toast('已下架（演示）')})">下架</button> <button class="btn sm" onclick="arm(this,function(){toast('已回滚 v1（演示）')})">回滚 v1</button></div>`;
V.agov = () => `<div class="card"><h2>治理 · 风险区</h2><p class="d">无独立路由，并入治理页</p><div class="card" style="margin:0"><b>RISK-001 · 刷分嫌疑</b><p class="d">待建档</p><p class="d">全链：风险评估 → 分诊 → 隔离 → 升级 → 关闭；处置写链 R3，R1 只读建档（演示）。</p><p><button class="btn sm ghost" onclick="nav('#/areport')">举报队列 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/aobs')">观测恢复 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p><button class="btn sm" onclick="toast('已建档（演示）')">建档</button> <button class="btn sm" onclick="toast('已隔离（演示）')">隔离</button></div></div>`;
V.aaudit = () => `<div class="card"><h2>审计</h2><p class="d">分页 + 脱敏 · 导出 internal-only</p><p class="d">req-9208 · 同意记录 · 允许</p><p class="d">req-6fd9 · 注册门 · 拒绝</p><p><button class="btn sm ghost" onclick="nav('#/admin')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 管理</button> <button class="btn sm ghost" onclick="nav('#/aobs')">观测恢复 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
V.alogin = () => `<div class="card"><h2>管理身份预览</h2><p class="d">后台页面使用固定样例，仅供查看管理动线。开启预览不会创建真实管理会话或授予正式权限；退出、重新进入或刷新后关闭。</p><button class="btn" onclick="S.staff=true;toast('已开启本机会话管理预览');nav('#/admin')">开启管理预览</button><button class="btn ghost" onclick="nav('#/lab')">返回演示工具</button></div>`;
V.amedia = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/admin')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 管理</button><h2>🎞️ 媒体与上传</h2><p class="d">元数据走内容服务，音频字节永不过内容服务（演示说明）。</p></div><div class="card"><h2>上传正链</h2><p class="d">版权绑定 → 审核通过 → 签名 URL 直传对象存储 → 回调登记 manifest。</p><button class="btn sm" onclick="toast('上传凭证已签发（演示）')">获取上传凭证</button></div><div class="card"><h2>边界</h2><p class="d">未绑定版权不可送审；R1 只读已审资源。</p><p><button class="btn sm ghost" onclick="nav('#/adraft')">回建稿 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/apublish')">去发布 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
V.acs = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/admin')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 管理</button><h2>🎧 客服后台</h2><p class="d">R1 只读队列，处置写链 R3；正文受控、一事一号（演示）。</p></div>` + SUP.list.map(t => `<div class="card"><b>${lh(t.id)}</b> <span class="tag">${lh(t.cat)}</span> <span class="tag">${lh(t.st)}</span><p class="d">${lh(t.t)}</p><p><button class="btn sm" onclick="toast('本页只读，未实际接单；正式接单流程后续接入')">查看接单说明</button> <button class="btn sm ghost" onclick="supOpen('${t.id}','acs')">详情 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`).join("");
V.ashop = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/admin')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 管理</button><h2>🧾 商城后台</h2><p class="d">订单 → 订阅 → 对账 → 退款 → 开票，一条线查到底（演示）。</p></div><div class="card"><h2>对账</h2><p class="d">日切：订单＝渠道＝权益；差异进人工复核，不自动改账。</p></div><div class="card"><h2>退款</h2><p class="d">双人审批保留；单人运营方案待定，不虚构第二审批人。</p><p><button class="btn sm" onclick="nav('#/commerce')">看前台 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/refund')">退款开票 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
V.areport = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/agov')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 治理</button><h2>🚩 举报队列</h2><p class="d">R1 只读队列；处置写链 R3 开（演示）。</p></div><div class="card"><b>RPT-301 · 房间刷屏嫌疑</b> <span class="tag">待分诊</span><p class="d">来源：房间巡检（演示）</p><p><button class="btn sm" onclick="toast('已分诊 → 建档（演示）');nav('#/agov')">分诊建档 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
V.aobs = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/aaudit')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 审计</button><h2>📡 观测与恢复</h2><p class="d">发布门三件：健康探针 / 优雅停机 / SBOM（演示说明）。</p></div><div class="card"><h2>链路</h2><p class="d">网关 401 进审计包络；requestId / traceId / auditId 跨服务关联。</p><p class="d">Outbox → Kafka 白名单投递，失败进 DLQ 可回放；跨服务 Saga＋补偿，不用分布式事务。</p></div><div class="card"><h2>发布</h2><p class="d">命名回滚＋恢复点；回滚先停写再切读（演示口径）。</p><p><button class="btn sm ghost" onclick="nav('#/apublish')">去发布回滚 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
const AIPLANS = [
  { id: "chat", t: "💬 自由对话", d: "随便聊，AI 陪你练英语" },
  { id: "essay", t: "📝 作文批改", d: "贴作文，给分＋改法" },
  { id: "speak", t: "🗣️ 口语陪练", d: "情景对话，练张嘴" },
  { id: "plan", t: "📋 制定计划", d: "按水平排一周" },
  { id: "mistake", t: "❤️ 错题讲解", d: "讲透为什么错" },
  { id: "trans", t: "🔄 翻译润色", d: "中英互译＋地道表达" },
  { id: "story", t: "📖 单词故事", d: "一词一故事，好记" },
  { id: "grammar", t: "📏 语法医生", d: "句子哪错一查便知" },
  { id: "mock", t: "🎤 模拟面试", d: "英文面试陪练" },
  { id: "mail", t: "✉️ 邮件助手", d: "英文邮件起草润色" },
];
const AICHAT = [];
V.ai = () => `<div class="card"><h2>🤖 AI 伴学（P2 未开·演示）</h2><p class="d">Gate 未过无 CTA 是设计；下面是快捷方案，开一两个先体验。答不上来可转练题/客服，不硬聊。</p>${AIPLANS.slice(0, 4).map(p => `<button class="opt" onclick="aiopen('${p.id}')">${p.t}<br><span class="meta">${p.d}</span></button>`).join("")}<button class="opt" onclick="document.getElementById('aiMore').style.display='block';this.style.display='none'">更多方案（${AIPLANS.length - 4}） <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div id="aiMore" style="display:none">${AIPLANS.slice(4).map(p => `<button class="opt" onclick="aiopen('${p.id}')">${p.t}<br><span class="meta">${p.d}</span></button>`).join("")}</div></div><div class="card" id="aibox" style="display:none"><div id="aimsgs" style="max-height:220px;overflow-y:auto"></div><div style="display:flex;gap:6px;margin-top:8px"><input id="aiin" placeholder="输入英文试试" style="flex:1"><button class="btn sm" onclick="aisend()">发</button></div><p class="d">聊不下去？ <button class="btn sm ghost" onclick="nav('#/practice')">转练题 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/support')">问客服 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p><p><button class="btn sm ghost" onclick="nav('#/aigate')">AI 门 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/aiflow')">调用链 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
function aiopen(id) {
  const box = document.getElementById("aibox");
  box.style.display = "block";
  const msgs = document.getElementById("aimsgs");
  const plan = AIPLANS.find(p => p.id === id);
  const openers = { essay: "把作文贴进来，我给分＋改法（演示）。", speak: "Hi! What did you do today?（演示）", plan: "说说你的目标和每天分钟，我来排（演示）。", mistake: "把错题贴进来，我讲透它（演示）。", trans: "中英互贴，我来翻＋润色（演示）。", story: "说个单词，我编个故事（演示）。", grammar: "把句子贴进来，我来断病句（演示）。", mock: "Tell me about yourself.（演示）", mail: "说中文，我起草英文邮件（演示）。", chat: "随便聊，我陪你练英语（演示）。" };
  AICHAT.length = 0;
  AICHAT.push({ who: "ai", t: openers[id] || openers.chat });
  apaint();
  box.scrollIntoView();
}
function apaint() { document.getElementById("aimsgs").innerHTML = AICHAT.map(m => `<p class="d" style="text-align:${m.who === "me" ? "right" : "left"}"><b>${m.who === "me" ? "我" : "AI"}：</b>${m.t}</p>`).join(""); }
function aisend() {
  const inp = document.getElementById("aiin"), v = (inp.value || "").trim();
  if (!v) return;
  AICHAT.push({ who: "me", t: v });
  const low = v.toLowerCase();
  let r = "记下了，换个说法再说一遍？（演示）";
  if (/hello|hi|hey/.test(low)) r = "Hello! Nice to see you. What did you learn today?（演示）";
  else if (/[\u4e00-\u9fa5]/.test(v)) r = "英文试试？比如先说一句今天做的事（演示）。";
  else if (v.split(/\s+/).length < 3) r = "再长一点，加个 because 试试？（演示）";
  else r = "Good sentence! 再来一句，用上新学的词（演示）。";
  AICHAT.push({ who: "ai", t: r });
  inp.value = "";
  apaint();
}
const VOI = { scene: "跟读", rec: false, t: 0, hist: [] };
const VOISCENES = { "跟读": ["Good morning.", "How are you?", "See you tomorrow."], "复述": ["The train leaves at nine.", "Practice makes perfect."], "对话": ["What did you do today?", "Tell me about your weekend."], "口头翻译": ["早上好。", "火车九点开。"], "角色扮演": ["Welcome! Table for two?", "Check in, please."] };
function vdemoText() { const t = document.getElementById("votext"); return t ? t.textContent : VOISCENES[VOI.scene][0]; }
function vlisten() { speak(vdemoText()); }
function vreplay(h) { speak(VOI.hist[h].s); }
V.voice = () => `<div class="card"><h2>🎤 语音跟读</h2><p class="d">跟读 / 口头翻译 / 对话 / 角色扮演全画（演示 TTS 示范 + 模拟录音；真评测走服务端，不承诺时间）。</p><p class="d">场景：${Object.keys(VOISCENES).map(s => `<button class="btn sm${VOI.scene === s ? "" : " ghost"}" onclick="VOI.scene='${s}';VOI.rec=false;render()">${s}</button>`).join(" ")}</p><div class="card" style="margin:8px 0"><b id="votext">${VOISCENES[VOI.scene][0]}</b> <button class="btn sm" onclick="vlisten()">🔊 示范</button>${VOI.scene === "口头翻译" ? `<p class="d">看到中文说英文（演示：点示范听英文答案）</p>` : ``}${VOI.scene === "角色扮演" ? `<p class="d">你演客人，我演店员（演示：一人一句轮着来）</p>` : ``}</div>${VOI.rec ? `<div class="card" style="margin:8px 0"><p class="d">● 录音中 <b id="vsec">0</b>s ～～～（演示波形）</p><button class="btn" onclick="vstop()">停止判分</button></div>` : `<button class="btn" onclick="VOI.rec=true;VOI.t=0;render();vtick()">🎤 开始录音</button>`}<p class="d">无麦先说（演示跳过设备检查）；RTC 未接不评真分。</p></div><div class="card"><p><button class="btn sm ghost" onclick="nav('#/vscore')">评分与保留 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div><div class="card"><h2>📝 本轮记录</h2>${VOI.hist.length ? VOI.hist.map((h, i) => `<div class="card" style="margin:8px 0"><p class="d">${h.s}</p><p>发音 <b>${h.p}</b> · 流利 <b>${h.f}</b> · 完整 <b>${h.c}</b></p><div class="prog"><i style="width:${h.p}%"></i></div><p><button class="btn sm" onclick="vreplay(${i})">回听 🔊</button></p></div>`).join("") : `<p class="d">还没有，先录一条 👆</p>`}</div>`;
function vtick() { const el = document.getElementById("vsec"); if (!el || !VOI.rec) return; VOI.t++; el.textContent = VOI.t; setTimeout(vtick, 1000); }
function vstop() {
  VOI.rec = false;
  const base = 70 + ((VOI.t * 7 + VOI.hist.length * 13) % 25);
  VOI.hist.unshift({ s: document.getElementById("votext").textContent, p: base, f: Math.min(99, base + 3), c: Math.min(99, base + 6) });
  render();
  toast("判分完成（演示分，非真评测）");
}
const K12 = { role: null, book: null, anti: false };
V.k12 = () => {
  if (!K12.role) return `<div class="card empty"><b>🎒 青少年模式（P3 未开·演示）</b><p class="d">你是？</p><button class="btn sm" onclick="K12.role='student';render()">我是学生</button> <button class="btn sm" onclick="K12.role='parent';render()">我是家长</button> <button class="btn sm" onclick="K12.role='teacher';render()">我是老师</button><p></p><button class="btn sm ghost" onclick="goBack()">返回成人版</button><p><button class="btn sm ghost" onclick="nav('#/k12guard')">治理规则 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/k12course')">教材课程 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
  if (K12.role === "parent") return `<div class="card"><h2>👪 家长页（演示）</h2><p class="d">绑定孩子：<button class="btn sm" onclick="toast('扫码绑定（演示）')">扫码绑定</button></p><p class="d">本周：学 45 分钟 · 3 天</p><button class="btn sm" onclick="arm(this,function(){toast('已撤回授权，孩子端即刻停用（演示）')})">撤回授权</button> <button class="btn sm ghost" onclick="K12.role=null;render()">换角色</button></div>`;
  if (K12.role === "teacher") return `<div class="card"><h2>👩‍🏫 老师页（演示）</h2><p class="d">班级：初一 3 班 · 40 人</p><p class="d">本周布置：单词 50 · 课文 2 篇 <button class="btn sm" onclick="toast('已布置（演示）')">布置</button></p><button class="btn sm ghost" onclick="K12.role=null;render()">换角色</button></div>`;
  if (!K12.book) return `<div class="card"><h2>📚 选教材（演示）</h2><p class="d">按年级，版权先行（演示全正版）</p>${["人教七上", "人教七下", "外研七上"].map(b => `<button class="opt" onclick="K12.book='${b}';render()">${b} <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join("")}<button class="btn sm ghost" onclick="K12.role=null;render()">换角色</button></div>`;
  if (!K12.anti) return `<div class="card"><h2>${K12.book}</h2><p class="d">第一课：问候 <button class="btn sm" onclick="speak('Good morning class')">🔊</button></p><p>Good morning, class!</p><p class="d">坐下：Sit down, please.</p><button class="btn" onclick="K12.anti=true;render()">下课</button></div>`;
  return `<div class="card empty"><b>⏰ 今天学够 40 分钟啦，明天见！</b><p class="d">防沉迷：到点即停，不突破（演示）</p><button class="btn sm" onclick="K12.anti=false;K12.book=null;render()">明天再来</button></div>`;
};
V.aigate = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/ai')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> AI 伴学</button><h2>🚪 AI 门</h2><p class="d">四件齐了才开：阶段 P2 ＋ 成人 ＋ 同意 ＋ 成本预算（演示说明）。</p></div><div class="card"><h2>当前</h2><p class="d">P1 无 AI 入口是设计；R2 走 stub，不调真模型、不计真成本。</p><p><button class="btn sm" onclick="nav('#/aiflow')">看调用链 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
V.aiflow = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/aigate')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> AI 门</button><h2>🔗 AI 调用链</h2><p class="d">输入 → 预检 → 请求 → 流式 → 核验 → 落库（演示口径）。</p></div><div class="card"><h2>关键件</h2><p class="d">输入授权告知；前置敏感拦截；prompt_version 固定；流式可停止；输出后置合规核验；Schema 校验；结果带来源保存；采纳 / 重做 / 转普通练习。</p><p class="d">超时降级给普通练题；成本进 cost_ledger 台账；审计与用户历史分离存。</p><p><button class="btn sm" onclick="nav('#/ai')">去体验 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/practice')">转练题 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
V.vscore = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/voice')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 语音</button><h2>📊 发音评分与保留</h2><p class="d">结构化评分走服务端，不直连模型；RTC 失败不伪造结果（演示口径）。</p></div><div class="card"><h2>录音</h2><p class="d">原始音频隔离分级存；保留到期即清；导出 / 删除走隐私申请。</p><p class="d">随时打断：你一说话就停播；自建语音方案另立评审（ADR）。</p><p><button class="btn sm" onclick="nav('#/speaking')">回口语 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/privacy')">隐私申请 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
V.k12guard = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/k12')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 青少年模式</button><h2>🛡️ K12 治理</h2><p class="d">P3 上锁：手续不全代码可写、门不开（演示）。</p></div><div class="card"><h2>门与手续</h2><p class="d">K12 Gate 默认关；未成年人识别 → 监护授权；教师 / 机构资质校验；开锁手续清单签完才开。</p></div><div class="card"><h2>在用保护</h2><p class="d">时长 / 时段到点即停；家长一键撤回即刻停用；未成年人隐私另行请求；安全事件进审计。</p><p><button class="btn sm ghost" onclick="nav('#/about')">关于本稿 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
V.k12course = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/k12')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 青少年模式</button><h2>📚 K12 课程</h2><p class="d">教材同步先验版权＋地区；中高考专项标注考纲版本（演示）。</p></div><div class="card"><h2>闭环</h2><p class="d">教材课 → 练习 → 报告 → 家长页同步（只读），与成人链隔离。</p><p><button class="btn sm ghost" onclick="nav('#/k12guard')">治理规则 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
const TD = {cur:null, f:"全部"};
V.tdetail = () => {
  if (SUP.cur) {
    const t = SUP.list.find(t => t.id === SUP.cur);
    return `<div class="card"><button class="btn sm ghost" onclick="supClose()">${SUP.from === "acs" ? "返回客服队列" : "返回我的工单"}</button><h2>🧾 工单详情</h2>${t ? `<b>${lh(t.id)}</b> <span class="tag">${lh(t.cat)}</span> <span class="tag">${lh(t.st)}</span><p class="d">${lh(t.t)}</p><p class="d">本机演示记录；处理与回复为样例状态，尚未发送至客服。</p>` : `<p class="d">工单不存在或已移除，请返回列表重新选择。</p>`}</div>`;
  }
  const rows = SUP.list.filter(t => TD.f === "全部" || t.st === TD.f);
  return `<div class="card"><button class="btn sm ghost" onclick="TD.cur=null;nav('#/support')">客服</button><h2>🧾 工单列表</h2><p class="d">筛选：${["全部", "已提交", "处理中", "已回复"].map(f => `<button class="btn sm${TD.f === f ? "" : " ghost"}" onclick="TD.f='${f}';render()">${f}</button>`).join(" ")}</p></div>` + (rows.length ? rows.map(t => `<div class="card"><b>${lh(t.id)}</b> <span class="tag">${lh(t.cat)}</span> <span class="tag">${lh(t.st)}</span><p class="d">${lh(t.t)}</p><p class="d">本机演示记录；处理与回复为样例状态，尚未发送至客服。</p><button class="btn sm ghost" onclick="supOpen('${t.id}',SUP.from)">查看这张工单</button></div>`).join("") : `<div class="card empty"><b>这类暂无工单</b><p class="d">换个筛选看看</p></div>`);
};
V.paudio = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/privacy')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 隐私</button><h2>🎙️ 音频保留说明</h2><p class="d">跟读录音默认只留评分特征；原始音频另行授权才存（演示口径）。</p></div><div class="card"><h2>到期与删除</h2><p class="d">保留期到自动清；删号时逐服务清理并给回执；处理中显示编号＋进度，不点完即完成。</p><p><button class="btn sm ghost" onclick="nav('#/voice')">回语音 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
function payGo(el) {
  if (!PAY.productId) { toast("请先选择商品"); return; }
  if (!el.dataset.armed) el.dataset.payIntent = PAY.intentId;
  arm(el, () => payCommit(el.dataset.payIntent));
}
V.pay = () => {
  if (!PAY.productId) return `<div class="card empty"><h2>收银台（沙盒）</h2><p class="d">请先在商城选择商品，再确认本机演示价格。</p><button class="btn" onclick="nav('#/commerce')">去选商品</button></div>`;
  const locked = ["paid", "unknown", "refunded"].includes(PAY.phase);
  return `<div class="card"><h2>收银台（沙盒）</h2><p class="d">${lh(PAY.title)} · ¥${PAY.price} · 本机演示，不扣真款</p>${PAY.orderId ? `<p class="meta">订单：${lh(PAY.orderId)}</p>` : ""}${!locked ? `<button class="btn" onclick="payGo(this)">确认沙盒支付 ¥${PAY.price}</button>` : ""}${PAY.phase === "unknown" ? `<button class="btn" onclick="payResolve()">查询本次支付结果</button>` : ""}${PAY.phase === "failed" ? `<button class="btn ghost" onclick="payRetry()">重试原订单</button>` : ""}${PAY.message ? `<div class="fb ${PAY.phase === "paid" ? "ok" : PAY.phase === "failed" ? "no" : "wa"}" id="payr" style="display:block;margin-top:10px">${lh(PAY.message)}</div>` : ""}<p><button class="btn sm" onclick="RF.cur=PAY.orderId;nav('#/refund')">查看订单</button> <button class="btn sm ghost" onclick="nav('#/commerce')">回商城</button>${["paid", "refunded"].includes(PAY.phase) ? ` <button class="btn sm ghost" onclick="checkoutOpen('${PAY.productId}',true)">重新购买</button>` : ""}</p></div>`;
};
V.a11y = () => `<div class="card"><h2>♿ 无障碍</h2><p class="d">跟随系统＋手动档，所见即所得；设置只在本机生效（演示），换设备需重设。</p><button class="opt" onclick="a11y('contrast')">◐ 高对比：<b id="a11yc">${AX.c ? "开" : "关"}</b> <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="opt" onclick="a11y('font')">A 字体：<b id="a11yf">${["标准", "大", "特大"][AX.f]}</b> <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="opt" onclick="a11y('motion')">▶ 动效：<b id="a11ym">${AX.m ? "开" : "关"}</b> <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="opt" onclick="a11y('focus')">◎ 焦点框：<b id="a11yfo">${AX.fo ? "强" : "默认"}</b> <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="opt" onclick="a11y('voice')">🔊 读屏/朗读：<b id="a11yv">${AX.v ? "开" : "关"}</b> <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><p><button class="btn sm ghost" onclick="a11yReset()">恢复默认</button></p></div><div class="card"><h2>👁 预览（真实生效区）</h2><p style="font-size:22px"><b>Good morning.</b></p><p class="d">早上好。今天也要学 15 分钟。</p><p><span class="tag">B1</span> <span class="tag">今日 2 题</span></p><button class="btn sm" onclick="toast('预览：当前对比/字号/动效即你所见（演示）')">示例按钮</button> <button class="btn sm ghost" onclick="a11yDemo()">播报这段 🔊</button><p class="d">状态不用颜色 alone 表达：✓=可做 ♥=待补救 ⌁=待同步，均有文字。</p><div class="fb ok">✓ 保存成功是这种条（文字＋色块）</div><div class="fb no">! 出错是这种条（文字＋色块）</div></div><div class="card"><h2>⌨️ 键盘与焦点自查</h2><p class="d">Tab 走一遍：本页按钮 → 预览 → 下面三链接，焦点框${AX.fo ? "已加强" : "为默认"}；回车可点，焦点不丢。</p><p><button class="btn sm" onclick="nav('#/shelf')">书架 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm" onclick="nav('#/practice')">练题 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm" onclick="nav('#/home')">首页 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p><p class="d">抽验屏（书架/练题）不是全部范围；长题干、320 宽度、横竖屏以真机为准，稿内不认证。</p></div>`;
function a11yDemo() { if (!AX.v) { toast("先打开读屏/朗读（演示）"); return; } speak("Good morning. Time to study fifteen minutes."); }
V.arrears = () => `<div class="card"><h2>📚 今日任务</h2><div class="card" style="margin:0 0 8px;border-color:var(--warn)"><b>昨天有 1 节没学完，今天补吗？</b><p class="d">补上不断签</p><button class="btn sm" onclick="toast('已加入今日（演示）');nav('#/today')">补上 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/today')">跳过</button></div></div>`;
V.celebrate = () => `<div class="card" style="text-align:center"><b style="font-size:40px">🎉</b><h2>今天全完成了，明天见！</h2><p class="d">复习队列见明日今日，保持手感</p><button class="btn" onclick="nav('#/home')">回首页</button></div>`;
V.offlinet = () => `<div class="card"><h2>📚 今日任务</h2><div class="fb wa">⌁ 离线任务已保留，联网后同步</div><div class="card" style="margin:8px 0 0"><b>语法 · There ___ two books.</b><p class="d">本地草稿 · 待同步</p><p><button class="btn sm ghost" onclick="nav('#/offpkg')">离线包说明 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div></div>`;
const PG = { st: "idle", msg: "" };
function pgenStart() {
  if (!needReady()) return;
  PG.st = "run"; PG.msg = ""; render();
  const tok = PG.tok = (PG.tok || 0) + 1;
  const identity = identityToken();
  setTimeout(() => {
    if (!identityCurrent(identity) || PG.tok !== tok || PG.st !== "run") return;
    if (LAB.offline) { PG.st = "fail"; PG.msg = "离线：拼不出计划，联网后重试"; render(); return; }
    if (LAB.failNext) { LAB.failNext = false; PG.st = "fail"; PG.msg = "生成失败：拼装超时，重试不会建出两份计划"; render(); return; }
    PG.st = "ok"; S.plan = true; lmApplyPlan(LM.plan, "keep"); render();
  }, 1400);
}
function quickStart() { if (!needReady()) return; S.quick = true; S.plan = true; lmApplyPlan(LM.plan, "keep"); toast("已准备基础学习任务，可随时调整计划"); nav("#/today"); }
V.pgen = () => {
  const first = S.today.find(t => !t.done);
  if (PG.st === "run") return `<div class="card"><h2>计划生成中…</h2><div class="prog"><i style="width:60%"></i></div><p class="d">按定级报告组装本轮两组任务</p><button class="btn ghost" onclick="PG.st='idle';render()">取消，稍后再说</button></div>`;
  if (PG.st === "ok") return `<div class="card"><h2>计划已生成 ✓</h2><p class="d">${S.goal || "四级词汇 B1"} · 每天 ${S.minutes} 分钟 · 今日 ${S.today.length} 组</p><p><button class="btn" onclick="startGroup('${first ? first.id : ""}')">开始第一组</button> <button class="btn ghost" onclick="nav('#/home')">先回首页</button></p></div>`;
  if (PG.st === "fail") return `<div class="card"><h2>没生成出来</h2><p class="d">${PG.msg}</p><button class="btn" onclick="pgenStart()">重试</button> <button class="btn ghost" onclick="nav('#/planexp')">看看计划解释</button></p></div>`;
  return `<div class="card"><h2>生成今日计划</h2><p class="d">按定级报告组装，失败给重试；成功只建一份</p><button class="btn" onclick="pgenStart()">生成</button><p><button class="btn sm ghost" onclick="nav('#/planexp')">计划解释</button> <button class="btn sm ghost" onclick="nav('#/firstlearn')">首次学习</button></p></div>`;
};
V.planexp = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/pgen')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 生成中</button><h2>📋 计划解释</h2><p class="d">这句话说明计划从哪来（演示口径，不编算法参数）。</p></div><div class="card"><h2>输入来源</h2><p class="d">定级报告 B1（已锁定，不会变）＋ 画像目标（四级词汇 B1）＋ 建计划时的输入快照 ＋ 规则版本。</p><p class="d">一句话：定级语法待补 → 本周每天 15 分钟先补语法 2 道。</p></div><div class="card"><h2>重排规则</h2><p class="d">目标变更走版本锁重排；已完成记录保留不抹；重复点生成不会建出两份计划。</p><p><button class="btn sm" onclick="nav('#/today')">看今日安排 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/home')">回首页 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
V.session = () => `<div class="card"><h2>🔗 会话与检查点</h2><p class="d">练习按会话走，checkpoint 是断点续练的依据（演示）。</p></div><div class="card"><h2>顺序＋版本锁</h2><p class="d">按题序作答；乱序/并发提交会被打回（409），按服务端题号重拉再答；判分规则按版本锁定，老会话不受新规则影响。</p></div><div class="card"><h2>断点续练</h2><p class="d">做到第 3 题退出 → 回来从第 3 题继续；重复提交幂等，不重复计分。</p><p><button class="btn sm" onclick="nav('#/practice')">继续练 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/today')">回今日 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
V.mastery = () => `<div class="card"><h2>📈 掌握度</h2><p class="d">按维度看进步，不拿单次分数定终身（演示口径）。</p></div><div class="card"><h2>维度</h2>${[["词汇", 80], ["语法", 45], ["阅读", 70], ["听力", 50]].map(([t, v]) => `<div class="dim"><span class="v">${t} ${v}</span><span class="bar w"><i style="width:${v}%"></i></span></div>`).join("")}</div><div class="card"><h2>弱点 Top</h2><p class="d">① 语法 There be（错 2）② 听力短对话（错 1）③ 形近词 abandon/absorb</p><p><button class="btn sm" onclick="nav('#/mistakes')">去补救 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/srs')">去复习 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/weekly')">看报告 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
V.pfault = () => `<div class="card"><h2>🛟 定级恢复</h2><p class="d">出错不丢题，失败有出口（演示）。</p></div><div class="card"><h2>409 版本冲突</h2><p class="d">乱序/并发提交会被打回（409）→ 按服务端题号重拉进度再答，不覆盖已答。</p></div><div class="card"><h2>断网续答</h2><p class="d">断网先存本机草稿（只存题号＋选项）；恢复后按 checkpoint 续题号。</p></div><div class="card"><h2>重测</h2><p class="d">重测开新 session，旧报告保留可查，不覆盖。</p><p><button class="btn sm" onclick="nav('#/placement')">回定级 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/report')">看报告 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
V.npref = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/msgs')"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 消息</button><h2>🔔 通知偏好</h2><p class="d">开关只记偏好＋版本号，能否收到看真实渠道（演示：推送未开不开“成功”）。</p></div><div class="card"><h2>渠道</h2><button class="opt" onclick="SET.study=!SET.study;render()">${SET.study ? "✅" : "⬜"} 学习提醒 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="opt" onclick="SET.report=!SET.report;render()">${SET.report ? "✅" : "⬜"} 学习报告 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="opt" onclick="SET.sys=!SET.sys;render()">${SET.sys ? "✅" : "⬜"} 系统公告 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><div class="card"><h2>免打扰</h2><p class="d">时段：<button class="btn sm${SET.slot === "morning" ? "" : " ghost"}" onclick="SET.slot='morning';render()">晨间 8:00</button> <button class="btn sm${SET.slot === "night" ? "" : " ghost"}" onclick="SET.slot='night';render()">睡前 22:00</button></p><p class="d">部分失败自动重试 3 次；真实事件驱动 R2 开，Push / Email / SMS 走 R3（演示不开）。</p><p><button class="btn sm ghost" onclick="nav('#/settings')">回设置 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
V.firstlearn = () => `<div class="card"><h2>🌱 首次学习</h2><p class="d">新号 3 击到达定级：画像 → 定级 / 快速开始 → 今日（演示）。</p></div><div class="card"><h2>两条路</h2><p class="d">① 定级 3 分钟出报告再排计划（推荐）② 快速开始：按画像目标从基础难度起步（SKIPPED 基线），不伪造正式报告。</p><p><button class="btn sm" onclick="nav('#/placement')">去定级 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="quickStart()">快速开始 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div>`;
V.greject = () => `<div class="card empty"><b>暂不能开放学习</b><p class="d">身份未通过，可退出或联系客服</p><button class="btn sm" onclick="arm(this,function(){S.user=null;nav('#/login')})">退出</button> <button class="btn sm" onclick="nav('#/support')">联系客服</button></div>`;
V.cupgrade = () => `<div class="card"><h2>本机同意记录</h2><p class="d">当前演示版本：${lh(S.consentV)}。样例通过状态与本人在原型中的签署分别标明；均不代表服务端授权。</p>${CONSENT_KEYS.map(key => { const record = S.consents[key]; return `<p class="d"><b>${lh(key)}</b> · ${record?.agreed && record.version === S.consentV ? "当前版本已记录" : "尚未确认当前版本"}${record ? `<br>${lh(record.source || "本机演示")} · ${lh(record.version)}${record.at ? " · " + lh(new Date(record.at).toLocaleDateString("zh-CN")) : ""}` : ""}</p>`; }).join("")}<button class="btn" onclick="nav('#/gate')">查看并重新确认</button></div>`;
const VC = { w: "abandon", q: "", quizPick: -1 };
function vcAll() { return WB4.map(w => ({ book: "CET4", w: w[0], ph: w[1], zh: w[2] })).concat(WB6.map(w => ({ book: "CET6", w: w[0], ph: w[1], zh: w[2] }))); }
function vcData() { const a = vcAll(); return a.find(x => x.w === VC.w) || a[0]; }
function vcPick(w) { VC.w = w; VC.quizPick = -1; VC.q = ""; render(); }
function vcPrev() { const a = vcAll(); let i = a.findIndex(x => x.w === VC.w); i = (i - 1 + a.length) % a.length; VC.w = a[i].w; VC.quizPick = -1; render(); }
function vcNext() { const a = vcAll(); let i = a.findIndex(x => x.w === VC.w); i = (i + 1) % a.length; VC.w = a[i].w; VC.quizPick = -1; render(); }
function vclist() {
  const q = VC.q.trim().toLowerCase();
  if (!q) return `<p class="d">输入英文或中文搜 40 词（四级 20＋六级 20）</p>`;
  const res = vcAll().filter(e => e.w.includes(q) || e.zh.includes(q)).slice(0, 6);
  if (!res.length) return `<div class="card empty" style="margin:8px 0 0"><b>没搜到“${lh(VC.q)}”</b><p class="d">换个词试试，或去刷单词</p></div>`;
  return res.map(e => `<button class="opt" onclick="vcPick('${e.w}')"><b>${e.w}</b> <span class="meta">${e.ph}</span> · ${e.zh} <span class="tag">${e.book}</span> <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join("");
}
function vcQuiz(k) { VC.quizPick = k; render(); }
function vcAdd() {
  srsAddWord(vcData().w); render();
}
function vcMark(know) {
  const d = vcData();
  if (know) { const m = S.mistakes.find(x => x.t === d.w); if (m) { lmSelfRate(m.id); return; } toast("本次自评记得，去复习验证；尚未判定掌握（演示）"); }
  else { addMistake(d.w, "定位：词汇待补", "word", "词汇详情"); toast("已记入错题，可在错题本做补救练习（演示）"); }
  render();
}
function vcDrill() { const d = vcData(); DR.book = d.book === "CET4" ? "CET4" : "CET6"; const L = wlist(); const i = L.findIndex(x => x[0] === d.w); DR.i = i >= 0 ? i : 0; DR.known = 0; DR.show = false; DR.quizPick = -1; DR.quizDone = false; DR.mode = "zhan"; nav("#/drill"); }
function vcQuizOpts() {
  const d = vcData();
  const pool = vcAll().filter(x => x.w !== d.w && x.book === d.book).slice(0, 12);
  const others = [pool[(d.w.length) % pool.length], pool[(d.w.length + 4) % pool.length], pool[(d.w.length + 8) % pool.length]];
  const opts = others.map(o => ({ w: o.w, zh: o.zh, ok: false })).concat([{ w: d.w, zh: d.zh, ok: true }]);
  const h = d.w.length * 3 + d.zh.length;
  for (let k = opts.length - 1; k > 0; k--) { const j = (h + k * 5) % (k + 1); const t = opts[k]; opts[k] = opts[j]; opts[j] = t; }
  return { d, opts };
}
V.vocab = () => {
  const d = vcData();
  const f = famOf(d.w);
  const parts = wsplit(d.w);
  const lk = d.w.toLowerCase();
  const lex = (typeof LEX !== "undefined" && LEX[lk]) ? LEX[lk] : null;
  const inSrs = SRSQ.find(x => x.w === d.w);
  const idx = vcAll().findIndex(x => x.w === d.w);
  const qo = vcQuizOpts();
  return `<div class="card"><p class="d">${d.book} · 第 ${idx + 1}/40 · ${wpic(d.w)} ${inSrs ? "· 已在复习" : ""}</p><div style="text-align:center;padding:8px 0"><b style="font-size:36px">${d.w}</b><p class="d">${d.ph} <button class="btn sm" onclick="speak('${d.w}')">🔊 读</button></p><p style="font-size:20px"><b>${d.zh}</b></p></div><p style="display:flex;gap:8px"><button class="btn sm ghost" style="flex:1" onclick="vcPrev()"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 上一词</button><button class="btn sm ghost" style="flex:1" onclick="vcNext()">下一词 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div><div class="card"><h2>🔍 找词</h2><input id="vcq" placeholder="英文 / 中文，如 abandon / 抛弃" value="${lh(VC.q)}" oninput="VC.q=this.value;document.getElementById('vclist').innerHTML=vclist()"><div id="vclist">${vclist()}</div></div><div class="card"><h2>🔀 拆开记</h2><p style="font-size:22px">${parts.join(" + ")}</p><p class="d">形和音对应着记（演示拆分，非权威词源）。</p>${lex ? `<p class="d">搭配：${lex.coll}</p><p class="d">例：${lex.ex}</p>` : `<p class="d">暂无已核对的搭配与例句，可先记词义和读音。</p>`}</div><div class="card"><h2>🔤 变形全家</h2><p>${f.infl.map(x => `<span class="tag">${x}</span>`).join("")}</p></div><div class="card"><h2>🧩 组句（点 🔊 跟读）</h2>${f.sent.length ? f.sent.map((s, k) => `<p class="d">${k + 1}. ${s} <button class="btn sm" onclick="speak('${s.replace(/'/g, "")}')">🔊</button></p>`).join("") : `<p class="d">暂无已核对的例句。</p>`}</div><div class="card"><h2>😎 搭配与记忆提示</h2><p>${f.slang}</p><p class="d">仅为记忆联想，不代表已核对词源：${f.story}</p></div><div class="card"><h2>✅ 自测：中文 → 英文</h2><p class="d">“${d.zh}”是哪个？</p>${qo.opts.map((o, k) => `<button class="opt${VC.quizPick === k ? " sel" : ""}" onclick="vcQuiz(${k})">${wpic(o.w)} ${o.w}</button>`).join("")}${VC.quizPick >= 0 ? (qo.opts[VC.quizPick].ok ? `<div class="fb ok">✓ 对了</div>` : `<div class="fb no">! 选错了：${d.w} 拆开是 ${parts.join(" + ")}，跟读三遍 <button class="btn sm" onclick="speak('${d.w}')">🔊</button></div>`) : ``}</div><div class="card"><h2>📌 行动</h2><p><button class="btn sm" onclick="vcAdd()">${inSrs ? "已在复习 ✓" : "加入复习"}</button> <button class="btn sm ghost" onclick="vcMark(true)">会了 ✓</button> <button class="btn sm ghost" onclick="vcMark(false)">不会，进错题</button></p><p><button class="btn sm ghost" onclick="vcDrill()">去刷这本 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/srs')">去复习 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/mistakes')">错题本 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p><p class="d">缺项写“暂无”，不编发音；演示状态不代表服务端已落库。</p></div>`;
};
const LSM = {
  cur: 0, rate: 1, showSub: true, loop: false, playing: false, quizPick: -1, done: 0, mix: 0,
  hist: [],
  mats: [
    { title: "问候", lv: "A0", en: "Good morning. How are you? See you tomorrow.", zh: "早上好。你好吗？明天见。", mix: "Good morning. 你好吗？See you tomorrow.", q: { s: "早上打招呼说了什么？", o: ["Good morning", "Good night", "Goodbye"], a: 0 }, q2: { s: "播客里“明天见”怎么说？", o: ["See you tomorrow", "Good night", "Bye bye"], a: 0 } },
    { title: "火车站", lv: "A1", en: "Good morning. The train leaves at nine. Please be on time.", zh: "早上好。火车九点开。请准时。", mix: "Good morning. 火车 nine 点开。Please be on time.", q: { s: "火车几点开？", o: ["eight", "nine", "ten"], a: 1 }, q2: { s: "播客提醒你要什么？", o: ["hurry", "be on time", "run"], a: 1 } },
    { title: "机场", lv: "B1", en: "Where is the exit? Please check in early. Keep your boarding pass.", zh: "出口在哪？请提前值机。登机牌拿好。", mix: "Where is the exit? 请提前 check in. Keep your boarding pass.", q: { s: "机场提醒你拿好什么？", o: ["passport", "boarding pass", "ticket"], a: 1 }, q2: { s: "播客里“出口”怎么说？", o: ["exit", "enter", "exist"], a: 0 } },
  ],
};
let LPLAY_SERIAL = 0;
function lcancel() { LPLAY_SERIAL++; LSM.playing = false; try { speechSynthesis.cancel(); } catch (e) { } }
function lsel(i) { if (!LSM.mats[i]) return; lcancel(); LSM.cur = i; LSM.quizPick = -1; LSM.quizPick2 = -1; render(); }
function lrate(r) { LSM.rate = r; toast("语速 " + r + "x（演示）"); render(); }
function lsub() { LSM.showSub = !LSM.showSub; render(); }
function lloop() { LSM.loop = !LSM.loop; toast(LSM.loop ? "单句循环开（演示）" : "单句循环关"); render(); }
function lplay() {
  if (!needReady()) return;
  const m = LSM.mats[LSM.cur];
  const txt = LSM.mix === 1 ? m.mix : m.en;
  lcancel(); const token = LPLAY_SERIAL, identity = identityToken(), material = LSM.cur;
  const current = () => token === LPLAY_SERIAL && identityCurrent(identity) && material === LSM.cur;
  try {
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = LSM.mix === 1 ? "zh-CN" : "en-US"; u.rate = LSM.rate;
    LSM.playing = true; render();
    u.onend = () => {
      if (!current()) return;
      if (LSM.loop) { lplay(); return; }
      LSM.playing = false;
      if (!LSM.hist.includes(m.title)) { LSM.hist.push(m.title); LSM.done++; }
      render(); toast("播完了（演示 TTS，非版权真音）");
    };
    u.onerror = () => { if (!current()) return; LSM.playing = false; render(); };
    speechSynthesis.speak(u);
  } catch (e) { if (current()) { LSM.playing = false; render(); toast("朗读不可用（演示）"); } }
}
function lstop() { lcancel(); render(); }
function ldictCheck() {
  const v = (document.getElementById("ldict").value || "").trim().toLowerCase().replace(/[.,?!]/g, "");
  const m = LSM.mats[LSM.cur];
  const key = m.en.toLowerCase().replace(/[.,?!]/g, "");
  const f = document.getElementById("ldictfb");
  const words = v.split(/\s+/).filter(Boolean).length, total = key.split(/\s+/).length;
  const hit = v && (key.includes(v) || v.split(/\s+/).filter(w => key.includes(w)).length >= Math.max(2, Math.floor(total / 2)));
  f.textContent = !v ? "先在上面播一遍，凭听写一句（演示，不判真分）" : hit ? "✓ 对上 " + words + "/" + total + " 词，意思对了" : "! 差一点，对照字幕再听一遍";
  f.className = "fb " + (!v ? "wa" : hit ? "ok" : "no");
}
function lquizPick(k) { LSM.quizPick = k; render(); }
V.listening = () => {
  const m = LSM.mats[LSM.cur];
  const q = m.q;
  return `<div class="card"><h2>🎧 听力 · 播客</h2><p class="d">演示 TTS 朗读，非版权真音；真音与 0.5x–2.0x 保音高待接，不承诺时间。</p><p class="d">材料：${LSM.mats.map((x, i) => `<button class="btn sm${LSM.cur === i ? "" : " ghost"}" onclick="lsel(${i})">${x.lv} ${x.title}</button>`).join(" ")}</p><p class="d">播客档：<button class="btn sm${LSM.mix === 0 ? "" : " ghost"}" onclick="LSM.mix=0;render()">全英文</button> <button class="btn sm${LSM.mix === 1 ? "" : " ghost"}" onclick="LSM.mix=1;render()">中英混播</button> · 已听完 ${LSM.done} 篇${LSM.hist.length ? "（" + LSM.hist.join("、") + "）" : ""}</p></div><div class="card"><b>${m.lv} · ${m.title}${LSM.mix === 1 ? " · 混播" : ""}</b>${LSM.showSub ? `<p style="font-size:17px">${LSM.mix === 1 ? m.mix : m.en}</p><p class="d">${m.zh}</p>` : `<p class="d">字幕已藏，先盲听一遍再打开</p>`}<p><button class="btn sm" onclick="lsub()">${LSM.showSub ? "藏字幕" : "看字幕"}</button> <button class="btn sm${LSM.loop ? "" : " ghost"}" onclick="lloop()">🔁 循环</button></p><p class="d">语速：${[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => `<button class="btn sm${LSM.rate === r ? "" : " ghost"}" onclick="lrate(${r})">${r}x</button>`).join(" ")}</p>${LSM.playing ? `<button class="btn" onclick="lstop()">⏸ 停止</button><p class="d">▶ 播放中 ${LSM.rate}x${LSM.loop ? " · 循环" : ""}（演示）</p>` : `<button class="btn" onclick="lplay()">🔊 播放</button>`}</div><div class="card"><h2>✍️ 听写一句</h2><p class="d">播完凭印象写，不看字幕；只对意思，不判真分。</p><input id="ldict" placeholder="Type what you hear" oninput="LSM.dict=this.value"><div class="fb wa" id="ldictfb" style="display:block">先播一遍再写 👆</div><button class="btn sm" onclick="ldictCheck()">核对</button></div><div class="card"><h2>❓ 听后两题</h2><p class="d">${q.s}</p>${q.o.map((t, k) => `<button class="opt${LSM.quizPick === k ? " sel" : ""}" onclick="lquizPick(${k})">${"ABC"[k]}. ${t}</button>`).join("")}${LSM.quizPick >= 0 ? (LSM.quizPick === q.a ? `<div class="fb ok">✓ 对了</div>` : `<div class="fb no">! 再听一遍，答案在音频里</div>`) : ``}<p class="d" style="margin-top:10px">${m.q2.s}</p>${m.q2.o.map((t, k) => `<button class="opt${LSM.quizPick2 === k ? " sel" : ""}" onclick="LSM.quizPick2=${k};render()">${"ABC"[k]}. ${t}</button>`).join("")}${LSM.quizPick2 >= 0 ? (LSM.quizPick2 === m.q2.a ? `<div class="fb ok">✓ 对了</div>` : `<div class="fb no">! 再听一遍</div>`) : ``}</div><div class="card"><button class="opt" onclick="nav('#/practice')">去练题 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="opt" onclick="nav('#/voice')">去跟读 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`;
};
V.speaking = () => `<div class="card"><h2>🎙️ 口语</h2><p class="d">跟读 / 口头翻译 / 对话 / 角色扮演四题型（演示；真评测走服务端，不承诺时间）。</p><p>${[["跟读", "跟读"], ["口头翻译", "口头翻译"], ["对话", "对话"], ["角色扮演", "角色扮演"]].map(([t, s]) => `<button class="btn sm" onclick="VOI.scene='${s}';VOI.rec=false;nav('#/voice')">${t} <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join(" ")}</p><p class="d">Video Call / Roleplay 真链（P2 门）：门未开先练上面的演示场景。</p><p><button class="btn sm ghost" onclick="toast('Video Call 未开：P2 门（演示）')">Video Call（未开）</button> <button class="btn sm ghost" onclick="VOI.scene='角色扮演';nav('#/voice')">Roleplay 演示 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p></div><div class="card"><p><button class="btn sm ghost" onclick="nav('#/listening')">先去听力打底 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="goBack()">返回</button></p></div>`;
V.writing = () => `<div class="card empty"><b>✍️ 写作</b><p class="d">暂无可写题目</p><p class="d">题目还在准备（需版权与审核），提交与反馈链也没接好；现在放空白编辑器写了也存不下来，所以没放。</p><p><button class="btn sm" onclick="nav('#/practice')">去练题 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button> <button class="btn sm ghost" onclick="nav('#/mistakes')">去错题本 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></p><p><button class="btn sm ghost" onclick="goBack()">返回</button></p></div><div class="card"><p class="d">将来开了是什么样：审题 → 写作 → 提交 → 规则反馈（演示说明，不承诺时间）。</p></div>`;
const OP_PKGS = [
  { id: "p1", t: "四级词汇包", ver: "v3（演示结构）", size: "—", scope: "四级核心词 + 例句", st: "未开放下载", note: "完整离线未准入（R3），当前请在线学。" },
  { id: "p2", t: "零基础包", ver: "v1（演示结构）", size: "—", scope: "字母 + 音标 + 短句", st: "未开放下载", note: "完整离线未准入（R3），当前请在线学。" },
  { id: "p3", t: "六级阅读包", ver: "v2（演示结构）", size: "—", scope: "长难句 + 精读", st: "未开放下载", note: "完整离线未准入（R3），当前请在线学。" },
];
V.offpkg = () => `<div class="card"><h2>离线包</h2><p class="d">列表可读：版本 / 大小 / 内容范围 / 状态可见。完整离线未准入前不开放下载，不保留可点的必败下载。</p><p class="d">装了 PWA ≠ 离线可学；断网时今日进度处理另见说明。</p><button class="btn sm ghost" onclick="nav('#/offlinet')">断网时怎么办 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>` + OP_PKGS.map(p => `<div class="card"><b>${p.t}</b> <span class="tag">${p.st}</span><p class="d">版本：${p.ver} · 大小：${p.size}</p><p class="d">范围：${p.scope}</p><p class="d">${p.note}</p><button class="btn sm" onclick="nav('#/shelf')">去书架在线学 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`).join("") + `<div class="card"><p class="d">结构为演示占位，非真实可下载字节；大小“—”表示未定，不虚构 MB 数。</p></div>`;
const RF = { cur: null };
const RF_ORDERS = structuredClone(DEMO_FIXTURES.RF_ORDERS);
const RF_STEPS = ["已申请", "L1 通过", "L2 通过", "渠道处理中", "已到账（沙盒）"];
function auxNormalizeState() {
  SUP.draft = String(SUP.draft || ""); if (!["功能", "账号", "内容", "支付"].includes(SUP.cat)) SUP.cat = "功能";
  SUP.cur = typeof SUP.cur === "string" ? SUP.cur : null; SUP.from = SUP.from === "acs" ? "acs" : "support";
  const ids = new Set();
  for (let i = 0; i < RF_ORDERS.length;) {
    const o = RF_ORDERS[i];
    if (!o || typeof o.id !== "string" || ids.has(o.id) || !Number.isFinite(o.price) || o.price < 0) { RF_ORDERS.splice(i, 1); continue; }
    ids.add(o.id);
    const g = GOODS.find(x => x.id === o.productId) || GOODS.find(x => x.t === o.t); o.productId ||= g?.id || null; o.cat ||= g?.cat || "课程";
    if (!["ready", "paid", "failed", "unknown", "refunded"].includes(o.paymentPhase)) o.paymentPhase = String(o.pay).includes("已退款") ? "refunded" : String(o.pay).includes("已支付") ? "paid" : "unknown";
    o.renewal ||= o.cat === "会员" ? (o.paymentPhase === "refunded" ? "cancelled" : "active") : "none";
    const legacyInvoice = String(o.inv || "");
    o.receiptStatus ||= legacyInvoice.includes("电子收据申请") ? "申请中（演示）" : legacyInvoice.includes("收据可看") ? "样例收据可查看" : "未申请";
    o.invoiceStatus ||= legacyInvoice.includes("本地发票申请") ? "申请中（演示）" : legacyInvoice.includes("本地发票待") ? "待渠道确认（样例）" : "未申请";
    o.rf ||= "无"; o.step = Number.isInteger(o.step) ? o.step : -1; o.demo = true; i++;
  }
  const o = RF_ORDERS.find(x => x.id === PAY.orderId);
  if (o) Object.assign(PAY, { productId: o.productId, title: o.t, price: o.price, cat: o.cat, phase: PAY.phase === "ready" && o.paymentPhase === "failed" ? "ready" : o.paymentPhase });
  else if (PAY.orderId) Object.assign(PAY, { orderId: null, phase: "ready", message: "上次订单未找到，请重新确认本机结算。" });
  if (!GOODS.some(g => g.id === PAY.productId)) Object.assign(PAY, { productId: null, title: "", price: 0, cat: "", intentId: null, orderId: null, phase: "idle", message: "" });
  if (!GOODS.some(g => g.id === GC.cur)) GC.cur = null;
}
auxNormalizeState();
function rfApply(id) {
  const o = RF_ORDERS.find(x => x.id === id); if (!o || o.paymentPhase !== "paid") { toast("仅已支付的沙盒订单可申请退款"); return; }
  if (o.rf !== "无") { toast("该单已有退款进度（演示）"); return; }
  o.rf = "已申请·等 L1"; o.step = 0; toast("本机退款申请已保存（演示），尚未到账"); render();
}
function rfCancelRenewal(id) {
  const o = RF_ORDERS.find(x => x.id === id); if (!o || o.cat !== "会员" || o.paymentPhase !== "paid") { toast("该单没有可取消的会员续订"); return; }
  if (o.renewal === "cancelled") { toast("该单续订已取消（演示）"); return; }
  o.renewal = "cancelled"; toast("本机续订已取消（演示），当前权益保持有效"); render();
}
function rfInv(id, kind) {
  const o = RF_ORDERS.find(x => x.id === id); if (!o || !["paid", "refunded"].includes(o.paymentPhase) || !["电子收据", "本地发票"].includes(kind)) { toast("请先确认本次订单的支付结果"); return; }
  const key = kind === "电子收据" ? "receiptStatus" : "invoiceStatus";
  if (o[key] !== "未申请") { toast("该项已有本机申请或样例状态"); return; }
  o[key] = "申请中（演示）"; toast(kind + "请求已保存在本机，尚未签发真实票据"); render();
}
function rfPaymentActions(o) {
  if (o.paymentPhase === "unknown") return `<button class="btn sm" onclick="payResolve('${o.id}')">查询本次支付结果</button>`;
  if (o.paymentPhase === "failed") return `<button class="btn sm" onclick="payRetry('${o.id}')">重试原订单</button>`;
  return "";
}
V.refund = () => {
  const o = RF_ORDERS.find(x => x.id === RF.cur);
  if (o) return `<div class="card"><button class="btn sm ghost" onclick="RF.cur=null;render()">我的订单</button><h2>${lh(o.t)} · ¥${o.price}</h2><p class="meta">订单：${lh(o.id)} · 本机沙盒</p><p class="d">资金：${lh(o.pay)} · 权益：${lh(o.right)}</p>${rfPaymentActions(o)}<p class="d">退款：${lh(o.rf)}</p>${o.step >= 0 ? `<p class="d">${RF_STEPS.map((s, i) => `<span class="tag">${i <= o.step ? "● " : ""}${s}</span>`).join(" ")}</p>` : ""}<p><button class="btn sm" onclick="arm(this,function(){rfApply('${o.id}')})"${o.paymentPhase !== "paid" || o.rf !== "无" ? " disabled" : ""}>申请退款</button></p>${o.cat === "会员" ? `<p class="d">续订：${o.renewal === "cancelled" ? "已取消（本机演示）" : "自动续订样例"}</p><button class="btn sm ghost" onclick="arm(this,function(){rfCancelRenewal('${o.id}')})"${o.paymentPhase !== "paid" || o.renewal === "cancelled" ? " disabled" : ""}>取消续订</button>` : `<p class="d">本商品没有会员续订。</p>`}</div><div class="card"><h2>🧾 票据</h2><p class="d">电子收据：${lh(o.receiptStatus)}</p><p class="d">本地发票：${lh(o.invoiceStatus)}</p><p class="d">两种请求独立保存。真实票据渠道尚未接入，本页不会签发真实收据或发票。</p><button class="btn sm" onclick="rfInv('${o.id}','电子收据')"${!["paid", "refunded"].includes(o.paymentPhase) || o.receiptStatus !== "未申请" ? " disabled" : ""}>申请电子收据</button> <button class="btn sm ghost" onclick="rfInv('${o.id}','本地发票')"${!["paid", "refunded"].includes(o.paymentPhase) || o.invoiceStatus !== "未申请" ? " disabled" : ""}>申请本地发票</button></div><div class="card"><p class="d">取消续订只变更本机续订状态，当前权益保留。退款申请受理后等待审核；本原型不执行真实退款。</p></div>`;
  return `<div class="card"><h2>我的订单 / 退款 / 票据</h2><p class="d">本机沙盒订单；初始三笔为固定样例。新结算保存同一商品与价格，刷新后仍可查看。</p><button class="btn sm ghost" onclick="nav('#/commerce')">回商城</button></div>` + RF_ORDERS.map(x => `<div class="card"><b>${lh(x.t)}</b> <span class="tag">¥${x.price}</span><p class="meta">${lh(x.id)}</p><p class="d">资金：${lh(x.pay)} · 权益：${lh(x.right)}</p><p class="d">退款：${lh(x.rf)}</p><button class="btn sm" onclick="RF.cur='${x.id}';render()">查看订单</button></div>`).join("");
};
const VOWELS = structuredClone(DEMO_FIXTURES.VOWELS);
const CONSS = structuredClone(DEMO_FIXTURES.CONSS);
const PHQ = structuredClone(DEMO_FIXTURES.PHQ);
const ABC = structuredClone(DEMO_FIXTURES.ABC);
const BOOKS = structuredClone(DEMO_FIXTURES.BOOKS);
const BK = { cur: null, ch: 1, lv: "B1", so: 0, pos: {} };
let LASTR = "";
let LASTITEM = "";
const LVN = { A0: 0, A1: 1, A2: 2, B1: 3, B2: 4 };
const POOL = {
  b1: [["Accumulate small wins.", "A2", "积累小胜利。"], ["Accuracy beats speed.", "B1", "准确胜过速度。"], ["Opportunity favors the prepared.", "B2", "机会青睐有准备的人。"], ["Diligence opens doors.", "B2", "勤奋开门。"]],
  b2: [["Thank you.", "A0", "谢谢。"], ["Good night.", "A0", "晚安。"], ["Nice to meet you.", "A1", "很高兴认识你。"], ["Excuse me.", "A1", "打扰一下。"]],
  b3: [["No sooner had she left than he called.", "B2", "她刚走他就来电话了。"], ["Only by working hard can we succeed.", "B2", "唯有努力才能成功。"], ["It is patience that wins.", "B1", "赢的是耐心。"]],
  b4: [["Shall we schedule a call?", "A2", "我们约个电话？"], ["Please find the agenda attached.", "B1", "议程见附件。"], ["Let us close the deal.", "B2", "我们敲定交易吧。"]],
  b5: [["Practice makes perfect.", "A2", "熟能生巧。"], ["Skimming saves time.", "B1", "略读省时间。"], ["Paraphrasing shows understanding.", "B2", "改写体现理解。"]],
  b6: [["A window seat, please.", "A1", "要靠窗位。"], ["How much is this?", "A1", "这个多少钱？"], ["Keep the change.", "A2", "不用找了。"]],
};
const HARD = {
  b1: [["persistence", "/pəˈsɪstəns/", "坚持", "persist→persistence"], ["accumulate", "/əˈkjuːmjəleɪt/", "积累", "ac-+cumul(堆)+-ate"], ["accuracy", "/ˈækjərəsi/", "准确", "ac-+cur(跑准)+-acy"], ["diligence", "/ˈdɪlɪdʒəns/", "勤奋", "di-+lig(选)+-ence"]],
  b2: [["morning", "/ˈmɔːnɪŋ/", "早晨", "morn+ing"], ["excuse", "/ɪkˈskjuːz/", "原谅", "ex-+cuse(因由)"], ["please", "/pliːz/", "请", "pleas(e)+e"], ["night", "/naɪt/", "夜晚", "n+ight"]],
  b3: [["hardly", "/ˈhɑːdli/", "几乎不", "hard+ly"], ["succeed", "/səkˈsiːd/", "成功", "suc-+ceed(走)"], ["patience", "/ˈpeɪʃəns/", "耐心", "pat(i)-(忍)+-ience"], ["matter", "/ˈmætə/", "要紧", "matt+er"]],
  b4: [["schedule", "/ˈʃedjuːl/", "安排", "sched+ule"], ["agenda", "/əˈdʒendə/", "议程", "ag(做)+enda"], ["clarify", "/ˈklærɪfaɪ/", "澄清", "clar(清楚)+-ify"], ["negotiate", "/nɪˈɡəʊʃieɪt/", "谈判", "nego-+ti(松)+-ate"]],
  b5: [["skimming", "/ˈskɪmɪŋ/", "略读", "skim+m+ing"], ["cohesion", "/kəʊˈhiːʒən/", "衔接", "co-+hes(粘)+-ion"], ["paraphrase", "/ˈpærəfreɪz/", "改写", "para-+phrase"], ["management", "/ˈmænɪdʒmənt/", "管理", "manag(e)+-ment"]],
  b6: [["exit", "/ˈeksɪt/", "出口", "ex-+it(走)"], ["window", "/ˈwɪndəʊ/", "窗户", "wind+ow"], ["change", "/tʃeɪndʒ/", "零钱/改变", "chang(e)"], ["check", "/tʃek/", "办理/检查", "check"]],
};
V.shelf = () => `<div class="card"><h2>📚 书架 · 学员水平 ${BK.lv}（演示可切）</h2><p class="d">水平：${["A0", "A1", "A2", "B1", "B2"].map(l => `<button class="btn sm${BK.lv === l ? "" : " ghost"}" onclick="BK.lv='${l}';BK.so=0;render()">${l}</button>`).join(" ")}</p></div>` + BOOKS.map(b => `<div class="card"><b>${b.title}</b><p>${b.tags.map(t => `<span class="tag">${t}</span>`).join("")}</p><p class="d">${b.intro}</p><p class="d">方向：${b.dir}</p><button class="btn sm" onclick="BK.cur='${b.id}';BK.so=0;nav('#/book')">进书 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`).join("") + `<div class="card"><p class="d">想按分类快速练题？</p><button class="btn sm ghost" onclick="nav('#/courses')">分类速览 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`;
V.book = () => { const b = BOOKS.find(x => x.id === BK.cur) || BOOKS[0]; const all = b.sents.concat(POOL[b.id] || []); const fit = all.filter(s => LVN[s[1]] <= LVN[BK.lv]); const batch = fit.slice(BK.so, BK.so + 3); if (!batch.length) BK.so = 0; const show = batch.length ? batch : fit.slice(0, 3); const hard = HARD[b.id] || []; return `<div class="card"><b style="font-size:20px">${b.title}</b><p class="d">作者 ${b.author} · ${b.year} · 目的：${b.purpose}</p><p>${b.tags.map(t => `<span class="tag">${t}</span>`).join("")}</p><p class="d">简介：${b.intro}</p><p class="d">方向：${b.dir}</p></div><div class="card"><h2>📑 目录（点进正文）</h2>${b.toc.map((c, i) => `<button class="opt" onclick="openChapter(BK.cur,${i})">${i + 1}. ${c} <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join("")}</div><div class="card"><h2>✨ 精彩句子（按 ${BK.lv} 及以下）</h2>${show.map(s => `<div class="card" style="margin:8px 0"><b>${s[0]}</b> <span class="tag">${s[1]}</span><p class="d">${s[2]} <button class="btn sm" onclick="speak('${s[0].replace(/'/g, "")}')">🔊</button></p></div>`).join("")}<button class="btn ghost" onclick="BK.so=(BK.so+3)%Math.max(fit.length,1);render()">换一批 ↻</button></div><div class="card"><h2>🔥 高难词汇 / 变形</h2>${hard.map(h => `<div class="card" style="margin:8px 0"><b>${h[0]}</b> <span class="meta">${h[1]}</span> <button class="btn sm" onclick="speak('${h[0]}')">🔊</button><p class="d">中文：${h[2]}</p><p class="d">变形拆分：${h[3]}</p></div>`).join("")}</div>`; };
function mdInline(s) { return s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>").replace(/`(.+?)`/g, "<code>$1</code>"); }
function md(src) {
  const safe=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  return String(src).split('\n').map(line=>{
    if(/^### /.test(line))return '<h4>'+safe(line.slice(4))+'</h4>';
    if(/^## /.test(line))return '<h3>'+safe(line.slice(3))+'</h3>';
    if(/^# /.test(line))return '<h2>'+safe(line.slice(2))+'</h2>';
    if(/^> /.test(line))return '<blockquote>'+safe(line.slice(2))+'</blockquote>';
    if(/^[-*] /.test(line))return '<li>'+mdInline(safe(line.slice(2)))+'</li>';
    if(/^\d+\. /.test(line))return '<li>'+mdInline(safe(line.replace(/^\d+\. /,'')))+'</li>';
    if(/^```/.test(line))return '';
    return line.trim()?'<p>'+mdInline(safe(line))+'</p>':'';
  }).join('').replace(/(<li>.*?<\/li>)+/g,'<ul>$&</ul>');
}
const CHAP = structuredClone(DEMO_FIXTURES.CHAP);
function chapLex() {
  const v = (document.getElementById("chapq").value || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  const box = document.getElementById("chapwd");
  const e = LEX[v];
  const hit = vcAll().find(x => x.w.toLowerCase() === v);
  if (!v) { box.innerHTML = `<p class="d">输入英文查词</p>`; return; }
  box.innerHTML = e ? `<b>${v} <span class="meta">${e.ph}</span></b> <button class="btn sm" onclick="speak('${v}')">朗读</button> <button class="btn sm ghost" onclick="srsAddWord('${v}')">加入复习</button><p class="d">中文：${e.zh}</p><p class="d">搭配：${e.coll}</p>` : (hit ? `<b>${hit.w}</b> <button class="btn sm" onclick="speak('${hit.w}')">朗读</button> <button class="btn sm ghost" onclick="srsAddWord('${hit.w}')">加入复习</button><p class="d">中文：${hit.zh}</p>` : `<p class="d">词库暂无 ${v}，先记下（演示）</p>`);
}
function srsAddWord(w) {
  const hit = vcAll().find(x => x.w.toLowerCase() === String(w).toLowerCase());
  const k = String(w).toLowerCase().replace(/[^a-z]/g, "");
  const zh = hit ? hit.zh : (LEX[k] ? LEX[k].zh : "");
  if (!zh) { toast("词库没有这个词（演示）"); return; }
  if (SRSQ.some(x => x.w === (hit ? hit.w : k))) { toast("已在复习安排中（演示）"); return; }
  SRSQ.push({ w: hit ? hit.w : k, zh, show: false, done: false });
  toast("已加入复习（演示）"); render();
}
function chapFav() {
  if (!S.fav) S.fav = [];
  const key = BK.cur + ":" + BK.ch, i = S.fav.indexOf(key);
  if (i >= 0) { S.fav.splice(i, 1); toast("已取消收藏（演示）"); } else { S.fav.push(key); toast("已收藏本节（演示）"); }
  render();
}
function openChapter(bookId, chIdx) {
  const b = BOOKS.find(x => x.id === bookId) || BOOKS[0];
  BK.cur = b.id; BK.ch = Math.max(0, Math.min(chIdx || 0, b.toc.length - 1));
  S.lastRead = { bookId: b.id, chapter: BK.ch, book: b.title, ch: b.toc[BK.ch] };
  LM.chapters[b.id + ":" + BK.ch] ||= { done: false, note: "" };
  dbSave();
  nav("#/chapter");
  if (LASTR === "chapter") render();
}
function resumeChapter() { const p = lmLastRead(); openChapter(p.bookId, p.chapter); }
let CHSAVE = 0;
function chapSaveNow() { try { if (LASTR === "chapter") { BK.pos[BK.cur + ":" + BK.ch] = document.getElementById("view").scrollTop; dbSave(); } } catch (e) { } }
function chapSaveSoon() { const t = Date.now(); if (t - CHSAVE < 300) return; CHSAVE = t; setTimeout(chapSaveNow, 350); }
V.chapter = () => { const b = BOOKS.find(x => x.id === BK.cur) || BOOKS[0]; const ci = Math.min(BK.ch || 0, (CHAP[b.id] || []).length - 1, b.toc.length - 1); const ch = (CHAP[b.id] || ["# 正文待补充"])[Math.max(0, ci)]; return `<div class="card"><p class="d">${b.title} · ${b.toc[Math.max(0, ci)]}</p><article>${md(ch)}</article></div><div class="card"><h2>🔍 查词收藏</h2><p><input id="chapq" placeholder="输入英文查词"> <button class="btn sm" onclick="chapLex()">查词</button> <button class="btn sm ghost" onclick="chapFav()">${(S.fav || []).includes(BK.cur + ":" + BK.ch) ? "★ 已收藏" : "☆ 收藏本节"}</button></p><div id="chapwd"></div></div><button class="btn ghost" onclick="goBack()"><svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 回目录</button>`; };
const WB4 = structuredClone(DEMO_FIXTURES.WB4);
const WB6 = structuredClone(DEMO_FIXTURES.WB6);
const DR = { book: "CET4", i: 0, known: 0, show: false, mode: "zhan", quizPick: -1, quizDone: false };
const FAM = {
  abandon: { infl: ["abandon", "abandons", "abandoned", "abandoning", "abandonment n.抛弃"], sent: ["Don't abandon hope.", "The ship was abandoned.", "He abandoned the plan."], slang: "abandon ship（开溜，多指散伙）", story: "a-(away 离开)+ban(喊)→喊走→抛弃" },
  accept: { infl: ["accept", "accepts", "accepted", "accepting", "acceptance n.接受"], sent: ["I accept your gift.", "She accepted the offer.", "Accepting change is hard."], slang: "accepted!（中了！表示同意）", story: "ac-(to 朝向)+cept(拿)→拿过来→接受" },
  accuse: { infl: ["accuse", "accuses", "accused", "accusing", "accusation n.指控"], sent: ["He accused her of lying.", "They were accused.", "Stop accusing me!"], slang: "the accused（被告，人）", story: "ac-(to)+cause(因由)→归咎于某因→指控" },
  absorb: { infl: ["absorb", "absorbs", "absorbed", "absorbing", "absorption n.吸收"], sent: ["Plants absorb sunlight.", "He absorbed the news.", "Absorbing is the first step."], slang: "absorbed in…（沉浸于……）", story: "ab-(away 消除)+sorb(吸)→吸掉→吸收" },
  abuse: { infl: ["abuse", "abuses", "abused", "abusing"], sent: ["Don't abuse drugs.", "He abused my trust.", "Abusing power ends badly."], slang: "substance abuse（药物滥用）", story: "ab-(away 偏离)+use(用)→乱用→滥用" },
  access: { infl: ["access", "accesses", "accessed", "accessing", "accessible adj.可进入的"], sent: ["You have access now.", "We accessed the file.", "Accessing data is logged."], slang: "all-access（全通）", story: "ac-(to)+cess(走)→走进去→进入" },
};
function famOf(w) {
  if (FAM[w]) return FAM[w];
  return { infl: ["暂无已核对的变形资料"], sent: [], slang: "暂无已核对的俚语资料。", story: "暂无已核对的词源资料，例句也尚未补齐。" };
}
function wset(book) { DR.book = book; DR.i = 0; DR.known = 0; DR.show = false; DR.quizPick = -1; DR.quizDone = false; nav("#/drill"); }
function wlist() { return DR.book === "CET4" ? WB4 : WB6; }
function dreveal() { DR.show = true; render(); }
function dzhan(know) { const L0 = wlist()[Math.min(DR.i, wlist().length - 1)]; if (know) DR.known++; else if (L0) srsAddWord(L0[0]); DR.i++; DR.show = false; DR.quizPick = -1; DR.quizDone = false; if (DR.i >= wlist().length) { toast(`本轮完：斩 ${DR.known}/${wlist().length}`); nav("#/wordbook"); } else render(); }
function drDetail() { const L = wlist(); const w = DR.mode === "time" && TCH.book === DR.book && TCH.list.length && TCH.pos < TCH.list.length ? tchOpts().w[0] : L[Math.min(DR.i, L.length - 1)][0]; VC.w = w; VC.quizPick = -1; VC.q = ""; nav("#/vocab"); }
const TCH = { on: false, paused: false, sec: 60, right: 0, wrong: 0, timer: 0, list: [], best: null, bests: {}, book: null, pos: 0 };
function tchPause(reason) { if (!TCH.on) return; clearInterval(TCH.timer); TCH.timer = 0; TCH.on = false; TCH.paused = true; TCH.pauseReason = reason; }
function drillLifecycle(route) { if (TCH.on && (route !== "drill" || DR.mode !== "time" || DR.book !== TCH.book || LM.wordClosed || document.hidden || !identityCurrent(TCH.identity))) tchPause("挑战已暂停，回到本页后可继续"); }
function tchRun() {
  TCH.on = true; TCH.paused = false; TCH.identity = identityToken(); clearInterval(TCH.timer);
  TCH.timer = setInterval(() => {
    if (!TCH.on) return;
    if (location.hash !== "#/drill" || DR.mode !== "time" || DR.book !== TCH.book || document.hidden || !identityCurrent(TCH.identity)) { tchPause("挑战已暂停，回到本页后可继续"); return; }
    TCH.sec--; if (TCH.sec <= 0) tchFinish(); else { const el = document.getElementById("tchsec"); if (el) el.textContent = TCH.sec; }
  }, 1000);
}
function tchStart() { if (!needReady() || LM.wordTask || LM.wordClosed) return; const L = wlist(); const pool = L.map((x, i) => i); for (let k = pool.length - 1; k > 0; k--) { const j = (DR.i + k * 3) % (k + 1); const t = pool[k]; pool[k] = pool[j]; pool[j] = t; } TCH.list = pool.slice(0, Math.min(10, pool.length)); TCH.book = DR.book; TCH.sec = 60; TCH.right = 0; TCH.wrong = 0; TCH.pos = 0; TCH.pick = -1; TCH.best = TCH.bests[DR.book] || null; tchRun(); render(); }
function tchResume() { if (!needReady() || LM.wordTask || LM.wordClosed || !TCH.paused || TCH.book !== DR.book || DR.mode !== "time") return; tchRun(); render(); }
function tchOpts() { const L = wlist(); const idx = TCH.list[Math.min(TCH.pos, TCH.list.length - 1)]; const w = L[idx]; const others = L.filter((_, j) => j !== idx).slice(0, 12); const o = [others[(idx + 1) % others.length], others[(idx + 5) % others.length], others[(idx + 9) % others.length]].map(x => ({ zh: x[2], ok: false })).concat([{ zh: w[2], ok: true }]); const h = idx * 5 + TCH.pos; for (let k = o.length - 1; k > 0; k--) { const j = (h + k * 3) % (k + 1); const t = o[k]; o[k] = o[j]; o[j] = t; } return { w, o }; }
function tchPick(k, position = TCH.pos) { if (!TCH.on || position !== TCH.pos || DR.mode !== "time" || DR.book !== TCH.book || LM.wordTask || !identityCurrent(TCH.identity)) return; const { w, o } = tchOpts(); if (!o[k]) return; TCH.pick = k; if (o[k].ok) TCH.right++; else { TCH.wrong++; addMistake(w[0], w[2], "word", "词汇限时练习"); } TCH.pos++; TCH.pick = -1; if (TCH.pos >= TCH.list.length) tchFinish(); else render(); }
function tchFinish() { if (!TCH.on) return; clearInterval(TCH.timer); TCH.timer = 0; TCH.on = false; TCH.paused = false; const score = TCH.right * 10 - TCH.wrong * 2; if (!TCH.best || score > TCH.best.score) TCH.best = { score, right: TCH.right, wrong: TCH.wrong }; TCH.bests[TCH.book] = TCH.best; render(); toast("限时结束：对 " + TCH.right + " / 错 " + TCH.wrong + "（演示，不上榜）"); }
const PIC = { abandon: "🗑️", ability: "💪", absent: "🏫", absolute: "💯", absorb: "🧽", abstract: "🎨", abundant: "🌾", abuse: "🚫", academy: "🏛️", accelerate: "🚀", accent: "🗣️", accept: "🤝", access: "🔑", accommodate: "🏠", accompany: "👥", accomplish: "🏆", account: "👤", accumulate: "📚", accuracy: "🎯", accuse: "⚖️", abolish: "🔨", absurd: "🤪", abundance: "🌾", acclaim: "👏", acquaint: "🤝", adhere: "🧲", adjacent: "🏘️", adjoin: "🧱", administer: "💼", admirable: "⭐", admission: "🎫", adolescent: "🧑", adore: "❤️", adorn: "💎", adverse: "⛈️", advertise: "📢", advocate: "📣", aesthetic: "🌸", affiliate: "🔗", affirm: "✅" };
function wpic(w) { return PIC[w] || "🔤"; }
function wsplit(w) { const m = w.match(/^(.{2,4})(.+?)(ing|ed|tion|sion|ance|ence|ment|ness|ly|ous|ive|al|er|or|ist)?$/); if (!m) return [w]; return [m[1], m[2], m[3] || ""].filter(Boolean); }
function wquiz() { const L = wlist(), idx = Math.min(DR.i, L.length - 1), w = L[idx]; const others = L.filter((_, j) => j !== idx).slice(0, 3); const opts = [...others.map(o => ({ zh: o[2], w: o[0], ok: false })), { zh: w[2], w: w[0], ok: true }]; const h = DR.i * 7 + w[0].length; for (let k = opts.length - 1; k > 0; k--) { const j = (h + k * 3) % (k + 1); const t = opts[k]; opts[k] = opts[j]; opts[j] = t; } return { w, opts }; }
function drWordKey() { return (LM.wordTask || "free") + ":" + DR.book + ":" + DR.i; }
function drMode(mode) { if (!["zhan", "quiz", "fam", "time"].includes(mode) || LM.wordClosed || DR.mode === mode) return; if (mode === "time" && LM.wordTask) { toast("今日词汇任务使用回忆、选项或词形模式"); return; } if (DR.mode === "time") tchPause("已切换学习模式，限时挑战暂停"); DR.mode = mode; render(); }
function qpick(k, key = drWordKey()) { if (!needReady() || LM.wordClosed || DR.mode !== "quiz" || key !== drWordKey() || DR.quizDone || DR.quizPick >= 0) return; const quiz = wquiz(); if (!quiz.opts[k]) return; DR.quizPick = k; DR.quizDone = true; DR.quizSnapshot = { key, w: quiz.w.slice(), opts: quiz.opts.map(o => ({ ...o })), ok: quiz.opts[k].ok }; if (!quiz.opts[k].ok) addMistake(quiz.w[0], quiz.w[2], "word", "词汇选项练习"); render(); }
function drNextWord(know, key) { if (!needReady() || LM.wordClosed || key !== drWordKey() || (DR.mode === "quiz" && DR.quizPick < 0)) return; dzhan(know); }
V.drill = () => {
  if (LM.wordClosed) {
    const result = LM.records.filter(r => r.kind === "words").at(-1);
    return `<div class="card"><h2>本轮词汇已完成</h2><p class="d">查看旧页面不会继续计词或重新提交。本轮记录保留在学习记录中。</p><div class="actions">${result ? `<button class="btn sm" onclick="lmOpenResult('${result.id}')">查看本轮结果</button>` : ""}<button class="btn sm ghost" onclick="nav('#/today')">回今日安排</button><button class="btn sm ghost" onclick="lmStartWords('${DR.book}',0)">开始自由学习新一轮</button></div></div>`;
  }
  const L = wlist(), key = drWordKey();
  const counter = `${LM.wordTask ? (LM.wordSeen || []).length + 1 : Math.min(DR.i + 1, L.length)}/${LM.wordTask ? (S.today.find(t => t.id === LM.wordTask)?.limit || 3) : L.length}`;
  const meta = `${DR.book === "CET4" ? "四级" : "六级"} · 第 ${counter} 词 · 本轮记得 ${DR.known}`;
  const tabs = `<div class="study-toolbar"><div class="toolbar-heading"><span class="meta">学习模式</span><button class="text-link" onclick="drDetail()">词汇详情 ${CHEV}</button></div><div class="mode-switch" style="grid-template-columns:repeat(${LM.wordTask ? 3 : 4},minmax(0,1fr))" role="group" aria-label="刷词模式">${[["zhan", "回忆"], ["quiz", "选项"], ["fam", "词形"], ["time", "限时"]].filter(([mode]) => !LM.wordTask || mode !== "time").map(([mode, label]) => `<button class="mode-button${DR.mode === mode ? " is-active" : ""}" aria-pressed="${DR.mode === mode}" onclick="drMode('${mode}')">${label}</button>`).join("")}</div></div>`;
  if (DR.mode === "time") {
    if (LM.wordTask) return `${tabs}<div class="card"><h2>继续今日词汇任务</h2><p class="d">今日任务不使用限时模式，已学习的词与进度保留。</p><button class="btn" onclick="drMode('zhan')">回到回忆模式</button></div>`;
    if (TCH.book === DR.book && TCH.paused) return `${tabs}<div class="card"><h2>限时挑战已暂停</h2><p class="d">剩余 ${TCH.sec} 秒 · 对 ${TCH.right} · 错 ${TCH.wrong}。离开页面、切换模式或浏览器进入后台时会停表。</p><div class="actions"><button class="btn sm" onclick="tchResume()">继续本轮</button><button class="btn sm ghost" onclick="tchStart()">重新开始一轮</button></div></div>`;
    if (TCH.book !== DR.book || (!TCH.on && !TCH.best && TCH.right === 0 && TCH.wrong === 0)) return `<div class="meta">${DR.book === "CET4" ? "四级" : "六级"} · 限时 60 秒 · 对+10/错-2 · 错题进本（演示，不上榜）</div>${tabs}<div class="card empty"><h2>限时挑战</h2><p class="d">60 秒能对几个？离开页面会暂停，挑战不计入今日三词任务。</p><button class="btn" onclick="tchStart()">开始挑战</button></div>`;
    if (!TCH.on) return `<div class="meta">${DR.book === "CET4" ? "四级" : "六级"} · 限时结算（演示）</div>${tabs}<div class="card" style="text-align:center"><b style="font-size:40px">${TCH.right * 10 - TCH.wrong * 2}</b><p class="d">对 ${TCH.right} · 错 ${TCH.wrong} · 错题已进本</p>${TCH.best ? `<p class="d">本词库个人最佳：${TCH.best.score}（对 ${TCH.best.right}/错 ${TCH.best.wrong}）</p>` : ""}<button class="btn" onclick="tchStart()">再来一轮</button><button class="btn ghost" onclick="nav('#/mistakes')">查看错题</button></div>`;
    const { w, o } = tchOpts();
    return `<div class="meta">${DR.book === "CET4" ? "四级" : "六级"} · 剩 <b id="tchsec">${TCH.sec}</b>s · 对 ${TCH.right} 错 ${TCH.wrong} · 第 ${Math.min(TCH.pos + 1, TCH.list.length)}/${TCH.list.length} 题</div>${tabs}<div class="card word-card"><div class="word-heading"><b class="word-title">${w[0]}</b></div><p class="d">${w[1]}</p></div>` + o.map((x, k) => `<button class="opt" onclick="tchPick(${k},${TCH.pos})">${wpic(w[0])} ${x.zh}</button>`).join("") + `<button class="btn ghost" onclick="tchPause('主动暂停');render()">暂停挑战</button>`;
  }
  const next = know => `drNextWord(${know},'${key}')`;
  if (DR.mode === "fam") {
    const w = L[Math.min(DR.i, L.length - 1)], f = famOf(w[0]);
    return `<div class="meta">${meta} · 词形与例句</div>${tabs}<div class="card word-card"><div class="word-heading"><b class="word-title">${w[0]}</b><button class="icon-button" aria-label="朗读当前单词" onclick="speak('${w[0]}')">🔊</button></div><p class="d">${w[1]}</p><p style="font-size:20px"><b>${w[2]}</b></p></div><div class="card"><h2>变形全家</h2>${f.infl.map(x => `<span class="tag">${x}</span>`).join("")}</div><div class="card"><h2>例句</h2>${f.sent.length ? f.sent.map(s => `<p class="d">${s}<button class="btn sm" onclick="speak('${s.replace(/'/g, "")}')">🔊</button></p>`).join("") : `<p class="d">暂无已核对的例句。</p>`}</div><div class="card"><h2>搭配与记忆提示</h2><p>${f.slang}</p><p class="d">仅为记忆联想，不代表已核对词源：${f.story}</p></div><div class="actions"><button class="btn" onclick="${next(true)}">本次记得，下一词</button><button class="btn ghost" onclick="${next(false)}">加入复习，下一词</button></div>`;
  }
  if (DR.mode === "quiz") {
    const snapshot = DR.quizDone && DR.quizSnapshot?.key === key ? DR.quizSnapshot : wquiz(), { w, opts } = snapshot;
    const selected = Number.isInteger(DR.quizPick) && DR.quizPick >= 0 && DR.quizPick < opts.length;
    let feedback = "";
    if (selected) {
      const right = opts[DR.quizPick].ok;
      feedback = right
        ? `<div class="fb ok" role="status">本次选择正确。查看反馈不会新增作答。</div><button class="btn" onclick="${next(true)}">下一词</button>`
        : `<div class="fb no" role="status">本次选择不正确，已记录到错题本。</div><div class="card"><h2>${w[0]} 的提示</h2><p>${wsplit(w[0]).join(" + ")}</p><p class="d">${w[1]} · ${w[2]}</p><div class="actions"><button class="btn sm ghost" onclick="speak('${w[0]}')">朗读本词</button><button class="btn sm" onclick="${next(false)}">加入复习，下一词</button></div></div>`;
    }
    return `<div class="meta">${meta}</div>${tabs}<div class="card word-card"><div class="word-heading"><b class="word-title">${w[0]}</b><button class="icon-button" aria-label="朗读当前单词" onclick="speak('${w[0]}')">🔊</button></div><p class="d">${w[1]}</p></div>` + opts.map((o, k) => `<button class="opt${DR.quizPick === k ? " sel" : ""}" aria-pressed="${DR.quizPick === k}" ${selected ? "disabled" : ""} onclick="qpick(${k},'${key}')">${wpic(o.w)} ${o.zh}</button>`).join("") + feedback;
  }
  const w = L[Math.min(DR.i, L.length - 1)];
  return `<div class="meta">${meta}</div>${tabs}<div class="card word-card"><div class="word-heading"><b class="word-title">${w[0]}</b></div><p class="d">${w[1]}</p><div class="word-meaning">${DR.show ? `<p><b>${w[2]}</b></p><button class="btn sm ghost" aria-label="朗读当前单词" onclick="speak('${w[0]}')">朗读</button>` : `<button class="btn sm ghost" onclick="dreveal()">点看中文</button>`}</div></div>${DR.show ? `<div class="word-actions"><button class="btn ghost" onclick="${next(false)}">加入复习</button><button class="btn" onclick="${next(true)}">本次记得</button></div>` : ""}`;
};
V.wordbook = () => `<div class="card"><h2>📕 单词本</h2><p class="d">选一本，直接开刷（斩＝会，收＝不会进复习）</p><button class="opt" onclick="wset('CET4')"><b>四级词汇</b> · 20 词 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="opt" onclick="wset('CET6')"><b>六级词汇</b> · 20 词 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`;
const PHG = [
  { t: "单元音 · 12", items: [["iː", "sheep"], ["ɪ", "ship"], ["e", "bed"], ["æ", "cat"], ["ɑː", "car"], ["ɒ", "hot"], ["ɔː", "door"], ["ʊ", "book"], ["uː", "food"], ["ʌ", "cup"], ["ɜː", "bird"], ["ə", "about"]] },
  { t: "双元音 · 8", items: [["eɪ", "day"], ["aɪ", "my"], ["ɔɪ", "boy"], ["əʊ", "go"], ["aʊ", "how"], ["ɪə", "here"], ["eə", "there"], ["ʊə", "tour"]] },
  { t: "爆破音 · 6", items: [["p", "pen"], ["b", "book"], ["t", "tea"], ["d", "dog"], ["k", "key"], ["g", "go"]] },
  { t: "摩擦音 · 9", items: [["f", "fish"], ["v", "van"], ["θ", "think"], ["ð", "this"], ["s", "sun"], ["z", "zoo"], ["ʃ", "ship"], ["ʒ", "vision"], ["h", "hat"]] },
  { t: "鼻/边/滑音 · 7", items: [["m", "man"], ["n", "no"], ["ŋ", "sing"], ["l", "look"], ["r", "red"], ["j", "yes"], ["w", "we"]] },
  { t: "破擦音 · 6", items: [["tʃ", "chair"], ["dʒ", "jump"], ["tr", "tree"], ["dr", "dog"], ["ts", "cats"], ["dz", "beds"]] },
];
const PHO = { open: 0 };
V.phonics = () => `<div class="card" style="background:var(--card)"><h2>🔤 音标</h2><p class="d">点符号听发音，分组慢慢来</p>${PHG.map((g, i) => `<div class="card" style="margin:10px 0;background:var(--surface)"><button class="opt" onclick="PHO.open=${i};render()"><b>${g.t}</b> ${PHO.open === i ? "▾" : "▸"}</button>${PHO.open === i ? `<div style="margin-top:10px">${g.items.map(([s, w]) => `<button class="btn sm" style="margin:4px;padding:12px 14px" onclick="speak('${w}')">${s}<br><span class="meta">${w}</span></button>`).join(" ")}</div>` : ``}</div>`).join("")}</div><div class="card" style="background:var(--card)"><h2>👂 最小对立对辨音</h2>${PHQ.map(([a, b]) => `<p class="d"><button class="btn sm" onclick="speak('${a}')">${a} 🔊</button> <button class="btn sm" onclick="speak('${b}')">${b} 🔊</button></p>`).join("")}<p class="d">听两遍，凭感觉选（演示不判分）</p></div>`;
V.alphabet = () => `<div class="card"><h2>🔠 字母 · 26</h2><p class="d">点字母听发音，看大小写和例词；例词待补的不编，先标出来</p>${ABC.map(c => `<button class="btn sm" style="min-width:44px" onclick="alPick('${c}')">${c}</button>`).join(" ")}</div><div class="card" id="alD"><p class="d">点上面任意字母 👆</p></div><div class="card"><h2>🔗 自然拼读</h2><p class="d">c-a-t → cat（演示：点听整词）</p><button class="btn sm" onclick="speak('cat')">🔊 cat</button> <button class="btn sm" onclick="speak('dog')">🔊 dog</button> <button class="btn sm" onclick="toast('更多拼读课待补充（演示）')">更多 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`;
const AL_EX = { A: "apple 苹果", B: "book 书", C: "cat 猫", D: "dog 狗", E: "egg 鸡蛋", F: "fish 鱼", G: "go 去", H: "hat 帽子", I: "ice 冰", J: "jump 跳", K: "key 钥匙", L: "look 看", M: "man 男人", N: "no 不", O: "open 打开", P: "pen 钢笔", Q: "queen 王后", R: "red 红色", S: "sun 太阳", T: "tea 茶", U: "up 向上", V: "van 厢车", W: "we 我们", X: "box 盒子", Y: "yes 是", Z: "zoo 动物园" };
function alPick(c) { speak(c); const el = document.getElementById("alD"); if (el) el.innerHTML = '<b>' + c + ' ' + c.toLowerCase() + '</b> · 例：' + (AL_EX[c] || '待补'); }

/* ---------- 动作 ---------- */
function doLogin() { const id = document.getElementById("li").value.trim(), password = document.getElementById("lp").value; if (!id || !password) { toast("请填写演示账号和密码"); return; } S.user = id; syncIdentity(); S.staff = false; S.gate = S.gate === "NONE" ? "PENDING" : S.gate; toast("已进入本机演示档案"); nav(S.gate === "PASS" && hasConsents() ? "#/home" : "#/gate"); }
function doRegister() { const id = document.getElementById("ri").value.trim(); if (!id) { toast("先填个账号"); return; } const pw = document.getElementById("rp").value || ""; if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) { toast("密码≥8 位且含字母+数字"); return; } S.user = id; syncIdentity(); S.staff = false; S.gate = "PENDING"; S.birthDate = null; S.consents = {}; toast("演示身份已创建，请确认成年人身份"); nav("#/gate"); }
function doGate() { if (!needAuth()) return; const value = document.getElementById("by").value, age = birthdayAge(value); if (age == null) { toast("请填写有效且不晚于今天的出生日期"); return; } S.birthDate = value; if (age < 18) { S.gate = "REJECTED"; S.consents = {}; toast("尚未满 18 岁，当前不能开放学习"); render(); return; } if (!document.getElementById("cf").checked) { toast("请主动确认出生日期准确且已满 18 岁"); return; } S.gate = "PASS"; toast("成年人身份已确认（本机演示）"); render(); }
function doConsents() { if (!needAuth()) return; if (S.gate !== "PASS") { toast("请先通过成年人身份确认"); return; } const a = [...document.querySelectorAll(".ag")]; if (a.length !== CONSENT_KEYS.length || !a.every(x => x.checked) || !CONSENT_KEYS.every(key => a.some(x => x.dataset.consent === key))) { toast("请逐项阅读并主动确认三项说明"); return; } S.consents = Object.fromEntries(CONSENT_KEYS.map(key => [key, { agreed: true, version: S.consentV, at: new Date().toISOString(), source: "本机演示签署" }])); dbSave(); toast("同意记录已保存到本机"); nav("#/onboard"); }
function doGoal() { S.goal = document.getElementById("g").selectedOptions[0].text; S.minutes = parseInt(document.getElementById("m").value, 10) || 15; S.quick = false; S.plan = false; S.quiz = { i: 0, sel: null, phase: "answer", answers: [], done: false, score: 0 }; toast("目标已保存：每天 " + S.minutes + " 分钟"); nav("#/placement"); }
function pick(k) { if (S.quiz.phase !== "answer") return; S.quiz.sel = k; document.querySelectorAll("#qo .opt").forEach((x, j) => x.classList.toggle("sel", j === k)); dbSave(); }
function qSubmit() {
  if (!needReady()) return;
  const qi = S.quiz.i;
  if (S.quiz.phase === "saved") { toast("本题已记录，去下一题"); return; }
  if (S.quiz.phase !== "answer") return;
  if (LAB.offline) { S.quiz.fb = { msg: "离线：选择已保留，联网后点提交", cls: "wa" }; render(); return; }
  if (S.quiz.sel == null) { toast("先选一个，或点跳过"); return; }
  S.quiz.phase = "submitting"; S.quiz.fb = { msg: "提交中…", cls: "wa" }; render();
  const tok = S.quiz.tok = (S.quiz.tok || 0) + 1;
  const identity = identityToken();
  setTimeout(() => {
    if (!identityCurrent(identity) || S.quiz.tok !== tok || S.quiz.i !== qi || S.quiz.phase !== "submitting") return;
    if (LAB.failNext) { LAB.failNext = false; S.quiz.phase = "answer"; S.quiz.fb = { msg: "提交失败，再点一次提交重试（选择还在）", cls: "no" }; render(); return; }
    if (LAB.unknownNext) { LAB.unknownNext = false; S.quiz.phase = "unknown"; S.quiz.fb = { msg: "结果未知：先别重做，点查询结果（不重复计分）", cls: "wa" }; render(); return; }
    recordQuiz(qi, S.quiz.sel);
  }, 450);
}
function recordQuiz(qi, sel) {
  if (S.quiz.answers[qi] && !S.quiz.answers[qi].skip) { S.quiz.phase = "saved"; render(); return; }
  const q = BANK[qi], ok = sel === q.a;
  S.quiz.answers[qi] = { sel, ok };
  qRecount(); if (!ok) addMistake(q.s, "定位：" + q.dim + "待补", "sentence", "样例测评");
  S.quiz.phase = "saved";
  S.quiz.fb = { msg: `已保存（第 ${qi + 1}/${BANK.length} 题）· 本轮结束统一讲评`, cls: "ok" };
  render();
}
function qResolve() { if (needReady() && S.quiz.phase === "unknown") recordQuiz(S.quiz.i, S.quiz.sel); }
function qSkip() {
  const qi = S.quiz.i;
  if (S.quiz.phase !== "answer") return;
  if (S.quiz.answers[qi] && !S.quiz.answers[qi].skip) return;
  S.quiz.answers[qi] = { skip: true }; S.quiz.phase = "saved";
  qRecount();
  S.quiz.fb = { msg: "已跳过，不计分；报告会单独列出未答题", cls: "wa" }; render();
}
function qRecount() { S.quiz.score = BANK.reduce((n, q, i) => n + (S.quiz.answers[i] && !S.quiz.answers[i].skip && S.quiz.answers[i].ok ? 1 : 0), 0); }
function qLoad(index) {
  S.quiz.i = index; const a = S.quiz.answers[index]; S.quiz.sel = a && !a.skip ? a.sel : null;
  S.quiz.phase = a && !a.skip ? "saved" : "answer"; S.quiz.fb = a && !a.skip ? { msg: "本题已有保存的答案，可直接前往下一题。", cls: "ok" } : a?.skip ? { msg: "本题先前跳过，现在可以补答。", cls: "wa" } : null;
}
function qResumeSkipped() { const i = S.quiz.answers.findIndex(a => a?.skip); if (i < 0) { toast("本轮没有待补答的样例"); return; } S.quiz.done = false; qLoad(i); nav("#/placement"); }
function qNext() { if (S.quiz.phase !== "saved") { toast("先作答提交保存，或点跳过"); return; } if (S.quiz.i < BANK.length - 1) { qLoad(S.quiz.i + 1); render(); } else { qRecount(); S.quiz.done = true; nav("#/report"); } }
/* ---------- 任务题组（稳定标识；语法 g1 / 阅读 r1） ---------- */
const GROUPS = structuredClone(DEMO_FIXTURES.GROUPS);
const PR = { taskId: null, pos: 0, sel: -1, phase: "answer", fb: null };
function prTask() { return S.today.find(x => x.id === PR.taskId); }
function prGroup() { const t = prTask(); return t ? GROUPS[t.group] : null; }
function startGroup(taskId) {
  const t = S.today.find(x => x.id === taskId) || S.today.find(x => !x.done);
  if (!t) { toast("今日没任务了"); nav("#/today"); return; }
  const g = GROUPS[t.group];
  if (g) g.items.forEach(x => { delete x._ok; delete x._sel; });
  PR.taskId = t.id; PR.pos = 0; PR.sel = -1; PR.phase = "answer"; PR.fb = null;
  nav("#/practice");
}
function enterTask(taskId) {
  const t = S.today.find(x => x.id === taskId); if (!t) return;
  if (PR.taskId === taskId && !t.done && PR.phase !== "result") { nav("#/practice"); return; }
  startGroup(taskId);
}
function prPick(k) { if (PR.phase !== "answer") return; PR.sel = k; render(); }
function prSubmit() {
  if (!needReady()) return;
  const g = prGroup(); if (!g || PR.phase !== "answer") return;
  if (LAB.offline) { PR.fb = { msg: "离线：选择已保留为草稿，联网后点提交", cls: "wa" }; render(); return; }
  if (PR.sel < 0) { toast("先选一个"); return; }
  PR.phase = "submitting"; PR.fb = { msg: "提交中…", cls: "wa" }; render();
  const tok = PR.tok = (PR.tok || 0) + 1, pos = PR.pos, tid = PR.taskId;
  const identity = identityToken();
  setTimeout(() => {
    if (!identityCurrent(identity) || PR.tok !== tok || PR.taskId !== tid || PR.pos !== pos || PR.phase !== "submitting") return;
    if (LAB.failNext) { LAB.failNext = false; PR.phase = "answer"; PR.fb = { msg: "提交失败，再点一次提交重试（选择还在）", cls: "no" }; render(); return; }
    if (LAB.unknownNext) { LAB.unknownNext = false; PR.phase = "unknown"; PR.fb = { msg: "结果未知：先别重做，点查询结果（不重复计分）", cls: "wa" }; render(); return; }
    prRecord(pos, PR.sel);
  }, 400);
}
function prRecord(pos, sel) {
  const g = prGroup(); if (!g) return;
  const it = g.items[pos], ok = sel === it.a;
  it._ok = ok; it._sel = sel;
  if (!ok) addMistake(it.s, "定位：" + (g.kind === "grammar" ? "语法" : "阅读") + "待补", "sentence", g.title);
  PR.phase = "saved";
  PR.fb = { msg: ok ? `✓ 对了：${it.why}` : `! 再看一眼：${it.why}（已进错题本）`, cls: ok ? "ok" : "no" };
  render();
}
function prResolve() { if (needReady() && PR.phase === "unknown") prRecord(PR.pos, PR.sel); }
function prNext() {
  const g = prGroup(); if (!g || PR.phase !== "saved") return;
  if (PR.pos < g.items.length - 1) { PR.pos++; PR.sel = -1; PR.phase = "answer"; PR.fb = null; render(); }
  else prFinish();
}
function prFinish() {
  const g = prGroup(), t = prTask();
  if (t && !t.done) { t.done = true; t.right = g.items.filter(x => x._ok).length; t.total = g.items.length; }
  PR.phase = "result"; render();
}
const A = { l1: false, l2: false };
function paintRev() { const el = document.getElementById("revst"); if (el) el.textContent = (A.l1 ? "L1 已过" : "L1 待审") + " · " + (A.l2 ? "L2 已过/ACTIVE" : "L2 待审"); }
const AX = { c: false, f: 0, m: true, fo: false, v: false };
function applyA11y() {
  const root = document.documentElement;
  let sysDark = false;
  try { sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { }
  root.setAttribute("data-theme", (SET.theme === "dark" || (SET.theme === "follow" && sysDark)) ? "dark" : "light");
  root.setAttribute("data-hc", AX.c ? "1" : "0");
  root.setAttribute("data-motion", AX.m ? "1" : "0");
  root.setAttribute("data-fz", String(AX.f));
  const sc = document.getElementById("view");
  if (sc) sc.style.zoom = [1, 1.12, 1.25][AX.f] || 1;
  if (!AX.m) avatarStop();
}
function a11yApply() {
  applyA11y();
  ["a11yc", "a11yf", "a11ym", "a11yfo", "a11yv"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === "a11yc") el.textContent = AX.c ? "开" : "关";
    if (id === "a11yf") el.textContent = ["标准", "大", "特大"][AX.f];
    if (id === "a11ym") el.textContent = AX.m ? "开" : "关";
    if (id === "a11yfo") el.textContent = AX.fo ? "强" : "默认";
    if (id === "a11yv") el.textContent = AX.v ? "开" : "关";
  });
}
function a11y(k) {
  if (k === "contrast") { AX.c = !AX.c; toast(AX.c ? "高对比已开" : "高对比已关"); }
  if (k === "font") { AX.f = (AX.f + 1) % 3; toast("字体：" + ["标准", "大", "特大"][AX.f]); }
  if (k === "motion") { AX.m = !AX.m; toast(AX.m ? "动效已开" : "动效已关：保存/完成/出错仍有文字条，不靠动画"); }
  if (k === "focus") { AX.fo = !AX.fo; toast(AX.fo ? "焦点框已加强（演示）" : "焦点框恢复默认"); }
  if (k === "voice") { AX.v = !AX.v; if (!AX.v) { try { speechSynthesis.cancel(); } catch (e) { } } toast(AX.v ? "朗读已开，点“播报这段”试（演示）" : "朗读已关"); }
  a11yApply(); dbSave();
}
function a11yReset() { AX.c = false; AX.f = 0; AX.m = true; AX.fo = false; AX.v = false; try { speechSynthesis.cancel(); } catch (e) { } a11yApply(); toast("已恢复默认（演示）"); render(); }
function sres(v) { document.getElementById("sr").innerHTML = v ? `<button class="opt" onclick="nav('#/courses')">📖 ${v}相关课程 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="opt" onclick="toast('帮助：重置密码走我的→设置')">❓ ${v}相关帮助 <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ""; }

/* ---------- 演示工具（会话级开关，不持久化；正常学习界面不出现） ---------- */
const LAB = { failNext: false, unknownNext: false, offline: false };
function labReset() { try { localStorage.removeItem(DBKEY); } catch (e) { } location.reload(); }
function labToday(mode) {
  if (mode === "noplan") { S.plan = false; S.today = []; }
  else if (mode === "empty") { S.plan = true; S.today = []; SRSQ.forEach(q => { q.done = true; }); srsResetSession(); }
  else { S.plan = true; S.today = freshToday(); srsSeed(); srsResetSession(); if (mode === "done") { S.today.forEach(t => { t.done = true; t.right = t.total; }); SRSQ.forEach(q => { q.done = true; }); } }
  render();
}
V.lab = () => `<div class="card"><h2>🧪 演示工具</h2><p class="d">集中放测试开关：重置数据、切换场景、注入故障、直接完成。不在正常学习界面出现（演示）。</p></div><div class="card"><h2>数据</h2><p><button class="btn sm" onclick="labReset()">重置全部演示数据</button> <button class="btn sm ghost" onclick="labToday('fresh');toast('今日已恢复两项未完成（演示）')">恢复今日任务</button></p><p class="d">重置清本机保存并重载页面。</p></div><div class="card"><h2>今日场景</h2><p>${[["fresh", "有任务"], ["done", "全完成"], ["empty", "无内容"], ["noplan", "未建计划"]].map(([m, t]) => `<button class="btn sm ghost" onclick="labToday('${m}');toast('场景：${t}（演示）')">${t}</button>`).join(" ")}</p></div><div class="card"><h2>故障注入（下一次提交有效）</h2><p><button class="btn sm${LAB.failNext ? "" : " ghost"}" onclick="LAB.failNext=!LAB.failNext;render()">提交失败 ${LAB.failNext ? "开" : "关"}</button> <button class="btn sm${LAB.unknownNext ? "" : " ghost"}" onclick="LAB.unknownNext=!LAB.unknownNext;render()">结果未知 ${LAB.unknownNext ? "开" : "关"}</button> <button class="btn sm${LAB.offline ? "" : " ghost"}" onclick="LAB.offline=!LAB.offline;render()">断网模式 ${LAB.offline ? "开" : "关"}</button></p><p class="d">影响定级 / 练习 / 计划生成的提交；断网时提交只保留草稿。</p></div><div class="card"><h2>直接完成（演示）</h2>${S.today.length ? S.today.map(t => `<p class="d">${t.t} ${t.done ? "· 已完成" : "· 未完成" + ` <button class="btn sm ghost" onclick="homeDone('${t.id}')">标完成 ✓</button>`}</p>`).join("") : `<p class="d">今日无任务，先恢复今日任务。</p>`}</div><div class="card"><h2>身份与定级</h2><p><button class="btn sm ghost" onclick="S.staff=!S.staff;toast(S.staff?'已切 staff（演示）':'已切回学员');render()">${S.staff ? "切回学员" : "切 staff"}</button> <button class="btn sm ghost" onclick="S.quiz={i:0,sel:null,phase:'answer',answers:[],done:false,score:0};nav('#/placement')">重做定级</button></p></div>`;
/* ---------- 路由 ---------- */
const AUTH_FREE = ["login", "register", "reset"];
const ACCOUNT_ROUTES = ["gate", "greject", "me", "settings", "devices", "privacy", "support", "tdetail", "npref", "a11y", "cupgrade", "paudio", "about", "lab", "alogin"];
const ADMIN_ROUTES = ["admin", "adraft", "areview", "apublish", "agov", "aaudit", "aperm", "amedia", "acs", "ashop", "areport", "aobs"];
function resolveRoute(requested) {
  let route = V[requested] ? requested : "home";
  if (!AUTH_FREE.includes(route) && !S.user) return "login";
  if (ADMIN_ROUTES.includes(route)) return S.staff ? route : "alogin";
  if (!AUTH_FREE.includes(route) && !ACCOUNT_ROUTES.includes(route) && (S.gate !== "PASS" || !hasConsents())) return "gate";
  if (route === "report" && !S.quiz.done) return "placement";
  return route;
}
function layoutContent(view) {
  // Keep labels and actions distinct instead of laying buttons into prose lines.
  view.querySelectorAll("p").forEach(p => {
    if (p.closest("article") || p.querySelector("input,select,textarea")) return;
    const buttons = Array.from(p.children).filter(el => el.matches("button.btn"));
    if (!buttons.length) return;
    const copy = document.createElement("span");
    copy.className = "detail-copy";
    Array.from(p.childNodes).filter(node => !buttons.includes(node)).forEach(node => copy.appendChild(node));
    if (!copy.textContent.trim()) {
      p.classList.add("action-row");
      p.replaceChildren(...buttons);
    } else {
      const actions = document.createElement("span");
      actions.className = "inline-actions";
      actions.append(...buttons);
      p.classList.add("detail-action");
      if (copy.textContent.trim().length > 36 || buttons.length > 1) p.classList.add("stacked");
      p.replaceChildren(copy, actions);
    }
  });
  view.querySelectorAll(".btn,.opt,.text-link,.icon-button").forEach(button => {
    const icons = Array.from(button.children).filter(el => el.matches('svg[viewBox="0 0 12 12"]'));
    if (icons.length && !button.classList.contains("icon-button")) {
      const leading = button.firstElementChild === icons[0] && !button.firstChild.textContent.trim();
      const label = document.createElement("span");
      label.className = "control-label";
      Array.from(button.childNodes).filter(node => !icons.includes(node)).forEach(node => label.appendChild(node));
      button.replaceChildren(...(leading ? [...icons, label] : [label, ...icons]));
    }
    const text = button.textContent.trim();
    if (/^🔊/.test(text) && text.length <= 5 && !button.hasAttribute("aria-label")) button.setAttribute("aria-label", "朗读");
  });
  view.querySelectorAll('svg[viewBox="0 0 12 12"]').forEach(svg => { svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false"); });
}
function render() {
  syncIdentity();
  lmEnsureDay();
  dbSave();
  const requested = (location.hash || "#/home").replace("#/", ""), r = resolveRoute(requested);
  if (LASTR === "listening" && r !== "listening" && LSM.playing) lcancel();
  drillLifecycle(r);
  if (history.state?.yxxMobile && history.state.route === requested) ROUTE_DEPTH = history.state.depth;
  else if (LASTR) ROUTE_DEPTH++;
  const target = ADMIN_ROUTES.includes(requested) ? requested : (r === "alogin" ? (history.state?.route === "alogin" && history.state.target) || "alogin" : r);
  history.replaceState({ ...history.state, yxxMobile: true, route: r, depth: ROUTE_DEPTH, target }, "", "#/" + r);
  if (LASTR === "chapter" && r !== "chapter") { try { BK.pos[BK.cur + ":" + BK.ch] = document.getElementById("view").scrollTop; } catch (e) { } }
  const view = document.getElementById("view");
  const pageChanged = LASTR !== r;
  const focused = !pageChanged && view.contains(document.activeElement) ? { id: document.activeElement.id, handler: document.activeElement.getAttribute("onclick"), tag: document.activeElement.tagName } : null;
  const previousScroll = view.scrollTop;
  document.getElementById("title").textContent = TITLES[r] || "语学星";
  document.getElementById("bk").style.visibility = (["login", "home"].includes(r)) ? "hidden" : "visible";
  const studyRoutes = ["courses", "words", "reviewqueue", "shelf"];
  const mainTab = studyRoutes.includes(r) ? "today" : r;
  document.getElementById("tabs").style.display = TABS.includes(mainTab) ? "flex" : "none";
  document.querySelectorAll("#tabs a").forEach(a => { a.classList.toggle("on", a.dataset.t === mainTab); if (a.dataset.t === mainTab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  applyA11y();
  view.classList.toggle("page-enter", pageChanged);
  view.dataset.route = r;
  view.dataset.target = target;
  view.dataset.tabs = TABS.includes(mainTab) ? "1" : "0";
  view.innerHTML = V[r]();
  layoutContent(view);
  const itemKey = r === "placement" ? `${r}:${S.quiz.i}` : r === "practice" ? `${r}:${PR.taskId}:${PR.pos}` : r === "srs" ? `${r}:${SRS.pass}:${srsCur()}` : r === "drill" ? `${r}:${DR.book}:${DR.i}:${DR.mode === 'time' ? (TCH.pos || 0) : ''}` : r === "chapter" ? `${r}:${BK.cur}:${BK.ch}` : r;
  view.onscroll = chapSaveSoon;
  if (r === "avatar" && typeof stage3d === "function") stage3d();
  if (r !== "avatar") avatarStop();
  view.scrollTop = pageChanged || LASTITEM !== itemKey ? ((r === "chapter" && BK.pos[BK.cur + ":" + BK.ch]) || 0) : previousScroll;
  if (focused && LASTITEM === itemKey) {
    const target = focused.id ? document.getElementById(focused.id) : focused.handler ? [...view.querySelectorAll("button,a,input,select")].find(el => el.tagName === focused.tag && el.getAttribute("onclick") === focused.handler) : null;
    if (target && !target.disabled) target.focus({ preventScroll: true });
  }
  LASTR = r;
  LASTITEM = itemKey;
  dbSave();
}
function bootMock() {
Object.assign(S, DEMO_PERSONA_STATE());
const hasDB = dbLoad(); if(!hasDB) demoSeedLearner(); normalizeState(); lmNormalize();
ACTIVE_IDENTITY = S.user; S.staff = false;
if (!hasDB) { try { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) AX.m = false; } catch (e) { } }
applyA11y();
window.addEventListener("hashchange", () => {if(document.getElementById("view").dataset.route!==(location.hash||"#/home").replace("#/",""))render();});
window.addEventListener("beforeunload", () => { chapSaveNow(); tchPause("已离开页面"); avatarStop(); dbSave(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) { chapSaveNow(); tchPause("浏览器进入后台，挑战已暂停"); avatarStop(); dbSave(); } else if (TCH.paused && LASTR === "drill" && DR.mode === "time") render(); else if (LASTR === "avatar") stage3d(); });
render();
}
