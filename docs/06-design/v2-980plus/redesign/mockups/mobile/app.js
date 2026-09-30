/* 语学星移动端整机交互稿 · 静态数据 · 无后端 */
const S = {
  user: "演示账号", gate: "PASS", consents: {}, goal: null, staff: false, quiz: { i: 0, score: 0, sel: null, done: false },
  mistakes: [{ t: "There ___ two books on the desk.", why: "定位：语法待补", kind: "sentence" }, { t: "abandon", why: "定位：词汇待补", kind: "word" }, { t: "Hardly had I arrived when it rained.", why: "定位：阅读待补", kind: "sentence" }], plan: false, today: [{ id: "t1", t: "语法 · There ___ two books.", min: 5, kind: "grammar" }, { id: "t2", t: "阅读 · 图书馆", min: 5, kind: "reading" }],
  shelf: ["四级词汇 B1", "零基础 A1", "六级 B2", "商务口语", "雅思备考", "生活英语"],
  lastRead: { book: "四级词汇红宝书", ch: "第二章 核心 1500" },
  msgs: [{ t: "欢迎来到语学星", d: "先定级，3 分钟出报告", read: false }, { t: "今日任务已生成", d: "语法 2 道", read: false }],
  streak: 1, consentV: "b30-consent-v1", minutes: 15,
};
const SET = { study: true, report: true, sys: false, slot: "morning", theme: "follow", uilang: "zh-CN", content: "en-US" };
const STM = { freeze: 2, repaired: [] };
function stmRepair(d) { if (STM.freeze <= 0) { toast("Freeze 用完了（演示）"); return; } if ((WCAL[d] || 0) > 0) return; WCAL[d] = 10; STM.freeze--; STM.repaired.push(d); toast("已补签 " + d + " 日（演示，剩 " + STM.freeze + " Freeze）"); render(); }
const BANK = [
  { s: "Choose the word closest in meaning to 'happy'.", o: ["glad", "angry", "tired"], a: 0, dim: "词汇" },
  { s: "She ___ to school every day.", o: ["go", "goes", "going"], a: 1, dim: "语法" },
  { s: "There ___ two books on the desk.", o: ["is", "are", "am"], a: 1, dim: "语法" },
  { s: "Li Lei gets up at six thirty. What time does he get up?", o: ["six thirty", "seven", "eight"], a: 0, dim: "阅读" },
  { s: "读下面这段并作答：It is sunny today. What do they do after school?", o: ["swim", "play football", "read"], a: 1, dim: "听力" },
];
const TITLES = { login: "登录", register: "注册", reset: "重置密码", gate: "身份确认", onboard: "学习目标", placement: "定级测评", report: "测评报告", home: "首页", today: "今日任务", courses: "分类速览", practice: "练题", mistakes: "错题本", srs: "复习", weekly: "学习报告", world: "世界", avatar: "装扮", msgs: "消息", me: "我的", settings: "设置", devices: "设备", privacy: "隐私", support: "客服", search: "搜索", commerce: "商城", admin: "管理", adraft: "建稿送审", areview: "双签审核", apublish: "发布回滚", agov: "治理风控", aaudit: "审计", aperm: "权限只读", ai: "AI 伴学", voice: "语音跟读", k12: "青少年模式", pay: "收银台", a11y: "无障碍", arrears: "补课提醒", celebrate: "完成撒花", offlinet: "断网今日", pgen: "计划生成中", greject: "门被拒", cupgrade: "同意升级", vocab: "词汇详情", listening: "听力", speaking: "口语", writing: "写作", offpkg: "离线包", refund: "退款开票", phonics: "音标", alphabet: "字母", wordbook: "单词本", drill: "刷单词", shelf: "书架", book: "图书详情", chapter: "章节正文", about: "关于", achieve: "成就墙", league: "联赛", planexp: "计划解释", session: "会话检查点", mastery: "掌握度", pfault: "定级恢复", npref: "通知偏好", firstlearn: "首次学习", alogin: "管理登录", amedia: "媒体上传", acs: "客服后台", ashop: "商城后台", areport: "举报队列", aobs: "观测恢复", games: "小游戏", space: "个人空间", subs: "订阅对账", native: "原生壳", rewards: "任务奖励", aigate: "AI门", aiflow: "AI链", vscore: "语音评分", k12guard: "K12治理", k12course: "K12课程", tdetail: "工单详情", paudio: "音频保留" };
/* 测试脚手架开关：默认关闭，加 ?demo=1 才显示预填账号与状态演示入口 */
const DEMO = /[?&]demo=1/.test(location.search);
const TABS = ["home", "today", "world", "me"];
function toast(m) { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2200); }
function goBack() { if (history.length > 1) history.back(); else location.hash = "#/home"; }
function nav(h) { location.hash = h; }
/* 人性化：危险动作两步确认（第一下武装，第二下执行，3 秒回落） */
function arm(el, fn) { if (el.dataset.armed) { delete el.dataset.armed; el.classList.remove("danger"); fn(); } else { el.dataset.armed = "1"; el.classList.add("danger"); const t = el.textContent; el.textContent = "再点一次确认"; setTimeout(() => { delete el.dataset.armed; el.classList.remove("danger"); if (el.isConnected) el.textContent = t; }, 3000); } }
function needAuth() { if (!S.user) { toast("请先登录"); nav("#/login"); return false; } return true; }
function needReady() { if (!needAuth()) return false; if (S.gate !== "PASS") { toast("身份确认中，先逛逛"); nav("#/gate"); return false; } return true; }

/* ---------- 屏 ---------- */
const V = {};
V.login = () => `<div class="card"><h2>欢迎回来</h2><p class="d">账号密码登录，失败不枚举。</p><label class="lb">账号</label><input id="li" value="${DEMO ? "t-learner-01@test.invalid" : ""}" placeholder="邮箱"><label class="lb">密码</label><input id="lp" type="password" value="" placeholder="密码"><button class="btn" onclick="doLogin()">登录</button><button class="btn ghost" onclick="nav('#/register')">去注册</button><button class="btn ghost" onclick="nav('#/reset')">忘记密码</button></div>`;
V.register = () => `<div class="card"><h2>注册</h2><p class="d">201 即成功，只建账号，不开学习能力。</p><label class="lb">账号（邮箱）</label><input id="ri" value="${DEMO ? "new@test.invalid" : ""}" placeholder="邮箱"><label class="lb">密码（≥8 位，字母+数字）</label><input id="rp" type="password" value="" placeholder="密码"><button class="btn" onclick="doRegister()">注册</button><button class="btn ghost" onclick="nav('#/login')">已有账号登录</button></div>`;
V.reset = () => `<div class="card"><h2>重置密码</h2><p class="d">如果账号存在，邮件已发出（永远这句，不枚举）。</p><label class="lb">账号</label><input value="new@test.invalid"><button class="btn" onclick="toast('如果账号存在，邮件已发出')">发送重置邮件</button><button class="btn ghost" onclick="goBack()">返回</button></div>`;
V.gate = () => `<div class="card"><h2>先讲一句：为什么要生日</h2><p class="d">语学星只服务成年人，确认一下就放行。</p><label class="lb">出生年份</label><input id="by" type="number" value="${DEMO ? "1995" : ""}" placeholder="如 1995"><label class="lb" style="margin-top:8px"><input type="checkbox" id="cf" checked style="width:auto"> 我已满 18 岁</label><button class="btn" onclick="doGate()">确认身份</button></div><div class="card"><h2>三项同意</h2><p class="d">版本动态读取（演示 ${S.consentV}）。可选项不预勾。</p>${["TERMS 服务条款", "PRIVACY 隐私说明", "ADULT_LEARNING 成人学习"].map((t, i) => `<label class="lb" style="font-weight:400"><input type="checkbox" class="ag" checked style="width:auto"> ${t}</label>`).join("")}<button class="btn" onclick="doConsents()">签署并继续</button></div>`;
V.onboard = () => `<div class="card"><h2>定个小目标</h2><p class="d">先选一个，一周后可换。存完按钮去定级，不回首页。</p><label class="lb">目标</label><select id="g"><option value="CET_4_6">大学英语四级 · B1</option><option value="ZERO_BASIS">零基础 · A1</option><option value="CET_6">六级 · B2</option></select><label class="lb">每天分钟</label><select id="m"><option>15</option><option>30</option><option>45</option></select><button class="btn" onclick="doGoal()">保存，去定级 →</button></div>`;
V.placement = () => { const q = BANK[S.quiz.i]; return `<div class="meta">第 ${S.quiz.i + 1}/${BANK.length} 题 · ${q.dim} · 提交中禁用 · 断网存本地</div><div class="prog"><i style="width:${(S.quiz.i / BANK.length) * 100}%"></i></div><div class="card"><h2>${q.s}</h2><div id="qo">${q.o.map((t, k) => `<button class="opt" data-k="${k}" onclick="pick(${k})">${"ABC"[k]}. ${t}</button>`).join("")}</div><div class="fb" id="qfb"></div><div class="row" style="display:flex;gap:8px"><button class="btn ghost" style="flex:1" onclick="qNext()">下一题 →</button><button class="btn" style="flex:1" onclick="qSubmit()">提交</button></div><div class="card"><h2>🧰 会话与掌握</h2><p><button class="btn sm" onclick="nav('#/session')">会话检查点 →</button> <button class="btn sm ghost" onclick="nav('#/mastery')">掌握度 →</button> <button class="btn sm ghost" onclick="nav('#/pfault')">失败恢复 →</button></p></div></div>`; };
V.report = () => `<div class="card" style="text-align:center;background:linear-gradient(135deg,#5b2fd6,#8b5cf6);color:#fff;border:0"><b style="font-size:44px">B1</b><div>定级完成 · ${S.quiz.score}/${BANK.length}</div></div><div class="card"><h2>维度</h2>${[["词汇", 80], ["语法", 60], ["阅读", 70], ["听力", 50]].map(([t, v]) => `<div class="dim"><span class="v">${t} ${v}</span><span class="bar w"><i style="width:${v}%"></i></span></div>`).join("")}</div><div class="card"><h2>💡 教练建议</h2><p class="d">词汇不错，语法补两周，每天 10 分钟，今日任务已排好。</p><button class="btn" onclick="nav('#/pgen')">生成我的计划 →</button></div>`;
V.home = () => {
  const words = S.mistakes.filter(m => m.kind === "word").length, sents = S.mistakes.length - words;
  const doneT = S.today.filter(t => t.done).length, totalT = S.today.length;
  const totalMin = S.today.reduce((a, b) => a + (b.done ? 0 : b.min), 0);
  const wcalWeek = (typeof WCAL !== "undefined") ? [3, 4, 5, 6, 7, 8, 9].map(d => (WCAL[d] || 0) > 0 ? 1 : 0) : [1, 0, 0, 0, 0, 0, 0];
  const planLine = `这周每天 ${S.minutes} 分钟：词汇 ${Math.max(5, Math.round(S.minutes / 3))} + 语法 ${S.minutes - Math.max(5, Math.round(S.minutes / 3))}。`;
  const weakLine = S.quiz.score > 0 ? `定级 ${S.quiz.score}/${BANK.length}，语法待补，所以` : `先按${S.goal || "四级词汇 B1"}来，`;
  return `${S.plan ? `<div class="banner"><b>📋 本周计划：${S.goal || "四级词汇 B1"}</b><p>${weakLine}${planLine}</p><p><button class="btn sm" onclick="BK.cur='b1';BK.ch=1;nav('#/chapter')">继续读：${S.lastRead.book} →</button> <button class="btn sm ghost" onclick="nav('#/today')">开始今日${totalT - doneT > 0 ? `（剩 ${totalT - doneT}）` : ""} →</button></p></div>` : `<div class="card empty"><b>还没有计划</b><p class="d">定级 3 分钟，生成你的计划</p><button class="btn" onclick="nav('#/placement')">去定级 →</button></div>`
    }<div class="card"><h2>📚 今日任务（${doneT}/${totalT}）</h2><p class="d">${totalT ? (doneT === totalT ? "今天全完成了 🎉" : `剩 ${totalT - doneT} 个 · 约 ${totalMin} 分钟`) : "今天没任务啦 🎉"}</p><p class="d">${"●".repeat(doneT)}${"○".repeat(totalT - doneT)}</p><button class="btn" onclick="nav('#/today')">${doneT === totalT ? "去看看" : "开始今日 →"}</button></div><div class="card"><h2>❤️ 错题本${S.mistakes.length ? `（${S.mistakes.length}）` : ""}</h2><p class="d">${S.mistakes.length ? `单词 ${words} · 句子 ${sents} · 最新：${S.mistakes[S.mistakes.length - 1].t.slice(0, 16)}…` : "做错的题自动进来"}</p><p><button class="btn sm ghost" onclick="MK.st='all';MK.ty='all';nav('#/mistakes')">进错题本 →</button> <button class="btn sm ghost" onclick="MK.st='all';MK.ty='word';nav('#/mistakes')">看单词 →</button> <button class="btn sm ghost" onclick="MK.st='all';MK.ty='sentence';nav('#/mistakes')">看句子 →</button></p></div><div class="card"><h2>⚔️ 刷单词</h2><p class="d">四级/六级 40 词 · 本轮已斩 ${DR.known} · 复习 ${SRSQ.filter(q => !q.done).length} 到期</p><p><button class="btn sm" onclick="nav('#/wordbook')">选词本开刷 →</button> <button class="btn sm ghost" onclick="nav('#/drill')">继续刷（${DR.book === "CET4" ? "四级" : "六级"}第 ${Math.min(DR.i + 1, wlist().length)}/${wlist().length}） →</button></p></div>${(!S.plan || S.quiz.score === 0) ? `<div class="card"><h2>🔰 零基础专区</h2><p class="d">从字母和音标开始，不考试</p><button class="btn sm" onclick="nav('#/alphabet')">字母 →</button> <button class="btn sm" onclick="nav('#/phonics')">音标 →</button></div>` : ``}<div class="card"><h2>📖 书架</h2><p class="d">${S.lastRead.book} · ${S.lastRead.ch}</p><button class="btn ghost" onclick="BK.cur='b1';BK.ch=1;nav('#/chapter')">继续读 →</button></div><div class="card" onclick="nav('#/weekly')" style="cursor:pointer"><h2>🎯 打卡</h2><div class="cal">${["一", "二", "三", "四", "五", "六", "日"].map(d => `<span>${d}</span>`).join("")}${wcalWeek.map(h => `<span class="${h ? "hit" : ""}">${h ? "✓" : "·"}</span>`).join("")}</div><p class="d">点进周报看每天明细 →</p></div>`;
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
  const head = `<div class="card"><h2>📚 今日安排</h2><p class="d">今日共约 ${leftMin} 分钟（目标每天 ${S.minutes} 分钟）：已完成 ${doneT} · 剩 ${totalT - doneT + (srsLeft.length ? 1 : 0)} 组${over ? " · 超预算了也没关系，明天顺延" : ""}</p><p class="d">${"●".repeat(doneT)}${"○".repeat(totalT - doneT)}${srsLeft.length ? " ＋复习" : ""}（演示口径：复习 1 个按 2 分钟）</p></div>`;
  if (!S.plan) return head + `<div class="card empty"><b>还没建计划</b><p class="d">定级 3 分钟，生成你的今日安排</p><button class="btn" onclick="nav('#/placement')">去定级 →</button></div>`;
  if (totalT > 0 && doneT === totalT && !srsLeft.length) return head + `<div class="card empty"><b>🎉 今天全完成了，明天见！</b><p class="d">已保存，可结束；想再看看也行</p><p><button class="btn sm" onclick="nav('#/srs')">查看回顾 →</button> <button class="btn sm ghost" onclick="nav('#/mistakes')">错题本 →</button> <button class="btn sm ghost" onclick="nav('#/celebrate')">撒花 →</button> <button class="btn sm ghost" onclick="nav('#/home')">回首页</button></p></div>`;
  if (!totalT && !srsLeft.length) return head + `<div class="card empty"><b>今天没任务啦 🎉</b><p class="d">去书架逛逛，或看看复习</p><button class="btn sm" onclick="nav('#/shelf')">去书架</button> <button class="btn sm ghost" onclick="nav('#/srs')">去复习</button></div>`;
  return head
    + `<p class="d" style="margin:4px 0 8px">▶️ 继续上次</p><div class="card"><b>📖 ${S.lastRead.book}</b><p class="d">${S.lastRead.ch}</p><button class="btn sm" onclick="BK.cur='b1';BK.ch=1;nav('#/chapter')">继续读 →</button></div>`
    + (srsLeft.length ? `<p class="d" style="margin:12px 0 8px">🔁 到期复习（${srsLeft.length} 个 · 约 ${srsMin} 分钟）</p>` + srsShow.map(q => `<div class="card"><b>${q.w}</b> <span class="tag">stage ${q.stage}</span><p class="d">${q.zh}</p></div>`).join("") + (srsLeft.length > 2 ? `<p class="d">还有 ${srsLeft.length - 2} 个…</p>` : ``) + `<button class="btn sm ghost" onclick="nav('#/srs')">去复习 →</button>` : ``)
    + (leftT.length ? `<p class="d" style="margin:12px 0 8px">✨ 新学（剩 ${leftT.length} 个）</p>` + leftT.map(t => `<div class="card"><b>${t.t}</b><p class="d">${t.min} 分钟 · 练题判分</p><p><button class="btn sm" onclick="nav('#/practice')">开始 →</button> <button class="btn sm ghost" onclick="homeDone('${t.id}')">标完成 ✓</button></p></div>`).join("") : ``)
    + (doneT ? `<p class="d" style="margin:12px 0 8px">✅ 已完成（${doneT}）</p>` + S.today.filter(t => t.done).map(t => `<div class="card" style="opacity:.65"><b>✓ ${t.t}</b><p class="d">${t.min} 分钟 · <span class="tag">已完成</span></p></div>`).join("") : ``)
    + (DEMO ? `<div class="card"><p class="d">状态演示：</p>${[["arrears", "欠账"], ["celebrate", "撒花"], ["offlinet", "断网"], ["pgen", "生成中"]].map(([r, t]) => `<button class="btn sm ghost" onclick="nav('#/${r}')">${t}</button>`).join(" ")}</div>` : ``);
};
V.courses = () => `<h2 style="margin:0 0 10px">🔖 分类速览</h2><p class="d" style="margin:0 0 10px">按分类快速进练题；整书精读走图书管。</p><p style="margin:0 0 10px"><button class="btn sm ghost" onclick="nav('#/shelf')">进图书管 →</button></p>` + S.shelf.map((c, i) => `<div class="card"><b>${c}</b><p class="d">${i === 0 ? "上次学到第 2 节" : "未开始"}</p><button class="btn sm" onclick="nav('#/practice')">${i === 0 ? "继续 →" : "开始 →"}</button></div>`).join("");
V.practice = () => `<div class="meta">语法 · 行内判分不跳页 · 点句子里的单词查词</div><div class="card"><h2 id="pstem">There ___ two books on the desk.</h2><div id="po"><button class="opt" onclick="ppick(0,this)">A. is</button><button class="opt" onclick="ppick(1,this)">B. are</button><button class="opt" onclick="ppick(2,this)">C. am</button></div><div class="fb" id="pfb"></div><button class="btn" onclick="psubmit()">提交判分</button><p><button class="btn sm ghost" onclick="nav('#/today')">回今日 →</button> <button class="btn sm ghost" onclick="nav('#/mistakes')">进错题本 →</button> <button class="btn sm ghost" onclick="nav('#/session')">会话说明 →</button></p></div><div class="card" id="wd" style="display:none"></div>`;
const LEX = {
  there: { ph: "/ðeə/", zh: "那里；存在", morph: "—", coll: "there be 句型：There is/are …", ex: "There is a book." },
  two: { ph: "/tuː/", zh: "二", morph: "second 第二", coll: "two books 两本书", ex: "Two cats." },
  books: { ph: "/bʊks/", zh: "书（复数）", morph: "book→books；book 书", coll: "read books 读书", ex: "Two books." },
  book: { ph: "/bʊk/", zh: "书；预订", morph: "books 复数；booking 预订", coll: "read a book 读书", ex: "A book." },
  on: { ph: "/ɒn/", zh: "在…上", morph: "—", coll: "on the desk 在桌上", ex: "On the desk." },
  the: { ph: "/ðə/", zh: "这；那（定冠词）", morph: "—", coll: "the books 这些书", ex: "The books." },
  desk: { ph: "/desk/", zh: "书桌", morph: "desks 复数", coll: "at the desk 在书桌旁", ex: "The desk." },
};
function wlookup(w) {
  const k = w.toLowerCase().replace(/[^a-z]/g, "");
  const e = LEX[k];
  const box = document.getElementById("wd");
  if (!e) { box.style.display = "block"; box.innerHTML = `<b>${w}</b><p class="d">词库暂无，先记下（演示）。</p>`; return; }
  box.style.display = "block";
  box.innerHTML = `<b>${w} <span class="meta">${e.ph}</span></b> <button class="btn sm" onclick="speak('${k}')">🔊 读</button><p class="d">中文：${e.zh}</p><p class="d">变形：${e.morph}</p><p class="d">搭配：${e.coll}</p><p class="d">例：${e.ex}</p>`;
}
function speak(w) { try { const u = new SpeechSynthesisUtterance(w); u.lang = "en-US"; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { toast("朗读不可用（演示）"); } }
function stemWords() { const h = document.getElementById("pstem"); if (!h || h.dataset.w) return; h.dataset.w = "1"; h.innerHTML = h.textContent.split(/(\s+)/).map(p => /[A-Za-z]{2,}/.test(p) ? `<u onclick="wlookup('${p.replace(/[^A-Za-z]/g, '')}')" style="cursor:pointer;text-decoration:underline dotted">${p}</u>` : p).join(""); }
const MK = { st: "all", ty: "all", vid: -1 };
function mkVariant(i) { MK.vid = i; render(); }
function mkDone(i) { const m = S.mistakes[i]; if (!m) return; S.mistakes.splice(i, 1); MK.vid = -1; toast("已掌握，销账（演示）"); render(); }
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
function mkPackNext() { if (!MKPACK || MKPACK.pick < 0) { toast("先选一个"); return; } if (MKPACK.lastOk) { MKPACK.right++; const m = MKPACK.list[MKPACK.pos]; const gi = S.mistakes.indexOf(m); if (gi >= 0) S.mistakes.splice(gi, 1); } MKPACK.pos++; MKPACK.pick = -1; if (MKPACK.pos >= MKPACK.list.length) { const r = MKPACK.right; MKPACK = null; MK.vid = -1; toast("打包练完：对 " + r + "（演示，已销对的）"); render(); } else render(); }
function mkPick(k) { MKPICK = k; render(); }
function mkSubmit() {
  const v = mkVarQuiz();
  if (!v || MKPICK < 0) { toast("先选一个"); return; }
  if (v.opts[MKPICK].ok) { const m = S.mistakes[MK.vid]; S.mistakes.splice(MK.vid, 1); MK.vid = -1; MKPICK = -1; toast("变式通过，已销账（演示）"); render(); }
  else { toast("再想想，答案不在这里（演示）"); render(); }
}
V.mistakes = () => {
  const all = S.mistakes;
  const todo = all.length, words = all.filter(m => m.kind === "word").length, sents = todo - words;
  let list = all.filter(m => (MK.st === "all" ? true : MK.st === "todo") && (MK.ty === "all" ? true : (MK.ty === "word" ? m.kind === "word" : m.kind !== "word")));
  if (MK.st === "done") list = [];
  if (MK.vid === -2 && MKPACK) {
    const m = MKPACK.list[MKPACK.pos];
    return `<div class="card"><button class="btn sm ghost" onclick="MKPACK=null;MK.vid=-1;render()">← 错题本</button><h2>📦 一次 10 题（${MKPACK.pos + 1}/${MKPACK.list.length} · 对 ${MKPACK.right}）</h2><p class="d">原题：${m.t}（${m.why}）· 对了自动销账</p>${m.kind === "word" ? `<p class="d">中文“${m.why.replace("定位：", "").replace("待补", "")}”是哪个词？</p><button class="opt${MKPACK.pick === 0 ? " sel" : ""}" onclick="mkPackPick(0)">A. ${m.t}</button><button class="opt${MKPACK.pick === 1 ? " sel" : ""}" onclick="mkPackPick(1)">B.  look（干扰）</button>` : `<p><b>${m.t}</b></p><button class="opt${MKPACK.pick === 0 ? " sel" : ""}" onclick="mkPackPick(0)">A. 需要变式</button><button class="opt${MKPACK.pick === 1 ? " sel" : ""}" onclick="mkPackPick(1)">B. 我会了</button>`}${MKPACK.pick >= 0 ? (MKPACK.lastOk ? `<div class="fb ok">✓ 对了</div>` : `<div class="fb no">! 不对</div>`) : ``}<button class="btn" onclick="mkPackNext()">下一题 →</button></div>`;
  }
  const v = MK.vid >= 0 ? mkVarQuiz() : null;
  if (MK.vid >= 0 && v) {
    const m = S.mistakes[MK.vid];
    return `<div class="card"><button class="btn sm ghost" onclick="MK.vid=-1;MKPICK=-1;render()">← 错题本</button><h2>🔁 变式再练（演示）</h2><p class="d">原题：${m.t}（${m.why}）</p>${v.kind === "word" ? `<p class="d">“${m.why.replace("定位：", "").replace("待补", "")}”是哪个词？</p>` : `<p><b>${v.stem}</b></p>`}${v.opts.map((o, k) => `<button class="opt${MKPICK === k ? " sel" : ""}" onclick="mkPick(${k})">${"ABCD"[k]}. ${o.t}</button>`).join("")}${MKPICK >= 0 ? (v.opts[MKPICK].ok ? `<div class="fb ok">✓ 对了，点提交销账</div>` : `<div class="fb no">! 不对，再想想</div>`) : ``}<button class="btn" onclick="mkSubmit()">提交（对了就销账）</button></div>`;
  }
  return `<div class="card"><h2>❤️ 错题本</h2><p class="d">共 ${todo} · 待补救 ${todo} · 单词 ${words} · 句子 ${sents}</p><p><button class="btn sm" onclick="mkPack()">📦 一次 10 题 →</button></p><p class="d">状态：<button class="btn sm${MK.st === "all" ? "" : " ghost"}" onclick="MK.st='all';render()">全部</button> <button class="btn sm${MK.st === "todo" ? "" : " ghost"}" onclick="MK.st='todo';render()">待补救</button> <button class="btn sm${MK.st === "done" ? "" : " ghost"}" onclick="MK.st='done';render()">已掌握</button></p><p class="d">题型：<button class="btn sm${MK.ty === "all" ? "" : " ghost"}" onclick="MK.ty='all';render()">全部</button> <button class="btn sm${MK.ty === "word" ? "" : " ghost"}" onclick="MK.ty='word';render()">单词</button> <button class="btn sm${MK.ty === "sentence" ? "" : " ghost"}" onclick="MK.ty='sentence';render()">句子</button></p></div>` + (list.length ? list.map(m => { const gi = S.mistakes.indexOf(m); return `<div class="card"><b>${m.t}</b><p class="d">${m.why}</p>${m.kind === "word" ? `<button class="btn sm" onclick="speak('${m.t}')">🔊 跟读</button> <button class="btn sm ghost" onclick="nav('#/drill')">去刷 →</button> <button class="btn sm ghost" onclick="mkVariant(${gi});MKPICK=-1">变式 →</button>` : `<button class="btn sm" onclick="mkVariant(${gi});MKPICK=-1">变式再练 →</button> <button class="btn sm ghost" onclick="mkDone(${gi})">会了 ✓</button>`}</div>`; }).join("") : `<div class="card empty"><b>${MK.st === "done" ? "已掌握是空的，去补救几道吧" : "没有符合的错题"}</b><p class="d">去今日任务做一道，错了会自动进来</p><button class="btn sm" onclick="nav('#/today')">去做题</button></div>`);
};
const SRSQ = [
  { w: "abandon", zh: "抛弃", stage: 2, show: false },
  { w: "accumulate", zh: "积累", stage: 1, show: false },
  { w: "persistence", zh: "坚持", stage: 3, show: false },
  { w: "clarify", zh: "澄清", stage: 1, show: false },
];
V.srs = () => { const left = SRSQ.filter(q => !q.done); const total = SRSQ.length; const cur = left[0]; const idx = cur ? SRSQ.indexOf(cur) : total; return `<div class="card"><h2>🔁 复习（SM2）</h2><p class="d">到期 ${left.length} 个 · 第 ${left.length ? idx + 1 : total}/${total} · 看词想意，按想起程度打分，直写入口已关闭</p><p class="d">进度：${"●".repeat(total - left.length)}${"○".repeat(left.length)}（演示） <button class="btn sm ghost" onclick="srsUndo()">撤销上次 →</button></p></div>` + (left.length ? `<div class="card" style="text-align:center;padding:28px 16px"><b style="font-size:34px">${left[0].w}</b><p class="d">stage ${left[0].stage}</p>${left[0].show ? `<p style="font-size:20px"><b>${left[0].zh}</b></p><p class="d">想起来了吗？</p>${[["忘了", 0], ["模糊", 2], ["想起", 4], ["秒答", 5]].map(([t, q]) => `<button class="btn sm" onclick="srsrate(${q})">${t} ${q}</button>`).join(" ")}` : `<button class="btn sm ghost" onclick="SRSQ.find(q=>!q.done).show=true;render()">想一下，点看中文</button>`}</div>` : `<div class="card empty"><b>复习完了 🎉</b><p class="d">下次到期自动进来</p><button class="btn sm" onclick="nav('#/today')">回今日</button></div>`); };
function srsrate(q) { const cur = SRSQ.find(x => !x.done); if (!cur) return; if (q >= 4) { cur.done = true; toast("已掌握，stage+1（演示）"); } else { cur.show = false; cur.stage = 1; SRSQ.push({ ...cur }); toast(" stage 回落，明轮再见（演示）"); } render(); }
V.weekly = () => {
  const wm = WREP.mode;
  const days = WREP.week;
  const total = days.reduce((a, b) => a + b.m, 0);
  const sumN = days.reduce((a, b) => a + b.n, 0), sumR = days.reduce((a, b) => a + b.r, 0);
  const max = Math.max(30, ...days.map(d => d.m));
  const bars = days.map((d, i) => `<div style="flex:1;text-align:center;cursor:pointer" onclick="wrepDay(${i})"><div style="height:90px;display:flex;align-items:flex-end;justify-content:center"><div style="width:70%;border-radius:6px 6px 0 0;background:${WREP.day === i ? "#5b2fd6" : d.m > 0 ? "#8b5cf6" : "#e7e1f5"};height:${Math.max(4, Math.round(d.m / max * 86))}px"></div></div><div style="font-size:11px;color:${WREP.day === i ? "#5b2fd6" : "#6f6480"};font-weight:${WREP.day === i ? "700" : "400"}">${"一二三四五六日"[i]}${d.m > 0 ? "·" + d.m : ""}</div></div>`).join("");
  const dd = days[WREP.day];
  const dimRows = [["词汇", dd.dim[0]], ["语法", dd.dim[1]], ["阅读", dd.dim[2]], ["听力", dd.dim[3]]].map(([t, v]) => `<div class="dim"><span class="v">${t} ${v}</span><span class="bar w"><i style="width:${v}%"></i></span></div>`).join("");
  const sug = dd.m === 0 ? "这天没学：去今日补一节，或看看错题本。" : dd.dim[1] < 65 ? "语法是短板：每天加 5 分钟语法，明天今日里有 2 道。" : "保持手感：明天继续 " + S.minutes + " 分钟，复习优先。";
  return `<div class="card"><h2>📊 学习报告</h2><p class="d">${["周", "月"].map(m => `<button class="btn sm${wm === m ? "" : " ghost"}" onclick="WREP.mode='${m}';WREP.day=0;render()">${m}</button>`).join(" ")} · 演示数据，非服务端报告</p>${wm === "周" ? `<div style="display:flex;gap:4px;margin:8px 0">${bars}</div><div class="card" id="wrepday" style="margin:8px 0 0"><b>周${"一二三四五六日"[WREP.day]} · ${dd.m} 分钟</b><p class="d">新学 ${dd.n} · 复习 ${dd.r}</p>${dimRows}<p class="d">💡 ${sug}</p><p>${dd.m === 0 ? `<button class="btn sm" onclick="nav('#/today')">去今日补 →</button> <button class="btn sm ghost" onclick="nav('#/mistakes')">看错题 →</button>` : `<button class="btn sm" onclick="nav('#/today')">去今日 →</button> <button class="btn sm ghost" onclick="nav('#/srs')">去复习 →</button>`}</p></div>` : `<div class="card" style="margin:8px 0 0"><h2>📅 本月打卡</h2><div class="cal" id="wcal"></div><div class="card" id="wday" style="margin:10px 0 0"><p class="d">点上面任意一天 👆</p></div></div>`}</div><div class="card"><h2>📈 本周累计</h2><p class="d">${total} 分钟 · 新学 ${sumN} · 复习 ${sumR} · 目标 ${S.goal || "四级词汇 B1"} · 每天 ${S.minutes} 分钟</p><p><button class="btn sm" onclick="nav('#/today')">继续今日 →</button> <button class="btn sm ghost" onclick="nav('#/mistakes')">错题本 (${S.mistakes.length}) →</button> <button class="btn sm ghost" onclick="nav('#/srs')">复习 →</button></p><p class="d">分享只读快照：不带登录态，他人打开看不到你的错题与隐私（演示说明）。 <button class="btn sm ghost" onclick="toast('分享链接已复制（演示，7 天有效）')">复制分享 →</button></p></div>`;
};
const WREP = { mode: "周", day: 3, week: [{ m: 15, n: 10, r: 5, dim: [80, 60, 70, 50] }, { m: 20, n: 12, r: 8, dim: [82, 58, 71, 52] }, { m: 0, n: 0, r: 0, dim: [0, 0, 0, 0] }, { m: 25, n: 15, r: 10, dim: [85, 62, 72, 55] }, { m: 15, n: 9, r: 6, dim: [83, 64, 70, 53] }, { m: 0, n: 0, r: 0, dim: [0, 0, 0, 0] }, { m: 30, n: 18, r: 12, dim: [86, 66, 74, 57] }] };
function wrepDay(i) { WREP.day = i; render(); }
function srsUndo() { const done = SRSQ.filter(q => q.done); if (!done.length) { toast("没有可撤销的（演示）"); return; } const last = done[done.length - 1]; last.done = false; last.show = true; toast("已撤销上一次打分（演示）"); render(); }
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
  document.getElementById("wday").innerHTML = m > 0 ? `<b>9 月 ${d} 日</b><p class="d">学习 ${m} 分钟 · 新学 ${Math.round(m * 0.7)} · 复习 ${Math.round(m * 0.3)}${wasRepair ? " · 补签" : ""}</p>` : `<b>9 月 ${d} 日</b><p class="d">这天没学${STM.freeze > 0 ? `，可用 Freeze 补签（剩 ${STM.freeze}，昨日有学才可补演示规则）` : "，Freeze 用完了"}，去补一节？</p><p><button class="btn sm" onclick="stmRepair(${d})">补签 Freeze →</button> <button class="btn sm ghost" onclick="nav('#/today')">去今日</button></p>`;
}
V.world = () => {
  const weekMin = [3, 4, 5, 6, 7, 8, 9].reduce((a, d) => a + (WCAL[d] || 0), 0);
  const xp = weekMin * 2 + S.streak * 10;
  const xpNext = 200, pct = Math.min(100, Math.round(xp / xpNext * 100));
  const achGot = WD_ACH.filter(a => a.st === "got").length;
  const weekDots = [3, 4, 5, 6, 7, 8, 9].map(d => (WCAL[d] || 0) > 0 ? 1 : 0);
  return `<div class="card" style="background:linear-gradient(135deg,#f3edff,#e9f7f0);border:0"><h2>🌍 世界</h2><p class="d">成长 / 空间 / 联赛 / 宝箱 / 组队 / 房间 / 排行 / 赛季全画（演示数据；上线按许可隐藏）。</p></div><div class="card"><h2>📊 我的成长</h2><p><b>Lv.3 学徒</b> <span class="tag">${xp}/${xpNext} XP</span></p><div class="prog"><i style="width:${pct}%"></i></div><p class="d">本周 ${weekMin} 分钟 · 连续 ${S.streak} 天 · 成就 ${achGot}/${WD_ACH.length} · 联赛：${LG.div} · 宝箱 ${WD_CHEST.filter(c => c.st === "open").length} 可开</p><p><button class="btn sm" onclick="WD.tab='ach';nav('#/achieve')">成就墙 →</button> <button class="btn sm ghost" onclick="nav('#/weekly')">学习报告 →</button> <button class="btn sm ghost" onclick="nav('#/league')">联赛 →</button></p></div><div class="card" onclick="nav('#/weekly')" style="cursor:pointer"><h2>📅 本周打卡</h2><div class="cal">${["一", "二", "三", "四", "五", "六", "日"].map(d => `<span>${d}</span>`).join("")}${weekDots.map(h => `<span class="${h ? "hit" : ""}">${h ? "✓" : "·"}</span>`).join("")}</div><p class="d">点进周报看每天明细 →</p></div><div class="card"><h2>🏠 我的空间</h2><p class="d">背景：星夜 · 小人：默认卫衣 · 成就陈列 ${achGot} 枚（演示布置）</p><p><button class="btn sm" onclick="nav('#/avatar')">去装扮 →</button> <button class="btn sm ghost" onclick="WD.tab='ach';nav('#/achieve')">看看成就 →</button></p></div><div class="card"><h2>🎁 宝箱（${WD_CHEST.filter(c => c.st === "open").length} 可开）</h2>${WD_CHEST.map(c => `<p class="d">${c.st === "open" ? "🎁" : "🔒"} ${c.t} · ${c.d} ${c.st === "open" ? `<button class="btn sm" onclick="chestOpen('${c.id}')">开启 →</button>` : ``}</p>`).join("")}</div><div class="card"><h2>👥 组队 5 天（演示）</h2><p class="d">${WD_TEAM.done}/5 天 · 队友：你 + 2 演示伙伴 · 奖：宝石箱（演示规则）</p><div class="prog"><i style="width:${WD_TEAM.done / 5 * 100}%"></i></div><p><button class="btn sm" onclick="teamDay()">今日组队 +1 →</button> <button class="btn sm ghost" onclick="nav('#/msgs')">动态 →</button></p></div><div class="card"><h2>🏠 自习房间</h2>${WD_ROOMS.map(r => `<div class="card" style="margin:8px 0"><b>${r.t}</b> <span class="tag">${r.seat}/${r.cap} 席</span><p class="d">${r.d}</p><p>${r.joined ? `<span class="tag">已在房</span> <button class="btn sm ghost" onclick="roomLeave('${r.id}')">退出</button>` : `<button class="btn sm" onclick="roomJoin('${r.id}')">加入 →</button>`}</p></div>`).join("")}<p class="d">满员找其他房间；断线先读本人席位再恢复；同一人不占两席（演示规则）。</p></div><div class="card"><h2>🏆 排行榜</h2>${LG.board.map((p, i) => `<p class="d">${i + 1}. ${p.n} · ${p.xp} XP ${p.me ? "（我）" : ""}</p>`).join("")}<p><button class="btn sm ghost" onclick="nav('#/league')">联赛详情 →</button></p></div><div class="card"><h2>🗓️ 赛季</h2><p class="d">${LG.season} · 结算中与已到账分开（演示说明）。</p></div>`;
};
const LG = { div: "白银联赛", week: 3, board: [{ n: "学徒小语", xp: 320 }, { n: "你", xp: 0, me: true }, { n: "晨读阿甘", xp: 280 }, { n: "夜猫卷王", xp: 250 }, { n: "单词收割机", xp: 210 }], season: "S3 赛季 · 规则已定稿（演示）· 起止 9.1–9.30 · 资格：周学满 60 分钟" };
function lgSync() { const weekMin = [3, 4, 5, 6, 7, 8, 9].reduce((a, d) => a + (WCAL[d] || 0), 0); const me = LG.board.find(p => p.me); if (me) { me.xp = weekMin * 2 + S.streak * 10; LG.board.sort((a, b) => b.xp - a.xp); } }
V.league = () => {
  lgSync();
  return `<div class="card"><button class="btn sm ghost" onclick="nav('#/world')">← 世界</button><h2>🏆 ${LG.div} · 第 ${LG.week} 周</h2><p class="d">每周日按 XP 分组；Diamond 前 10 进三阶段淘汰赛；排名可在本屏一键关闭（演示）。</p></div>` + LG.board.map((p, i) => `<div class="card" style="${p.me ? "border-color:var(--brand)" : ""}"><b>${i + 1}. ${p.n}</b> <span class="tag">${p.xp} XP</span>${p.me ? `<p class="d">就是你 · 本周继续学可超车</p>` : ``}</div>`).join("") + `<div class="card"><p class="d">演示榜：4 演示伙伴 + 你（真 XP 同步）；不填机器人冒充真人，上线按许可隐藏实名。</p><p><button class="btn sm ghost" onclick="PV.rankOff=!PV.rankOff;toast(PV.rankOff?'排名已关闭（演示）':'排名已打开（演示）');render()">${PV.rankOff ? "打开排名" : "关闭排名"}</button></p></div><div class="card"><h2>🎮 世界玩法</h2><p><button class="btn sm" onclick="nav('#/games')">小游戏 →</button> <button class="btn sm ghost" onclick="nav('#/space')">个人空间 →</button> <button class="btn sm ghost" onclick="nav('#/native')">原生壳 →</button></p></div>`;
};
V.games = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/league')">← 联赛</button><h2>🎮 小游戏</h2><p class="d">R2 门：目录可看，对局未开（演示不写开放日期）。</p><p class="d">对局开后：可信开局 → 实时判分 → 奖励自动进成长账（演示说明）。</p></div>` + ["单词消消乐", "听音拼词", "语法跑酷", "口语接龙", "阅读寻宝", "组队答题"].map(t => `<div class="card"><b>${t}</b> <span class="tag">未开放</span><p class="d">可信开局 · 判分防刷 · 奖励走成长账（开门后）</p><button class="btn sm ghost" onclick="toast('未开放：先去今日任务（演示）');nav('#/today')">去学习 →</button></div>`).join("");
V.space = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/world')">← 世界</button><h2>🪞 个人空间</h2><p class="d">只读参观：看布置，不写 UGC（演示）。</p></div><div class="card"><h2>演示伙伴的空间</h2><p class="d">背景：森林 · 陈列 3 枚成就 · 赛季最佳第 4（演示数据）</p><p><button class="btn sm" onclick="nav('#/avatar')">装扮我的 →</button> <button class="btn sm ghost" onclick="nav('#/achieve')">看看成就 →</button></p></div><div class="card"><p class="d">社交写链 R3 开；有用户才开榜，不填机器人冒充真人。</p></div>`;
V.subs = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/commerce')">← 商城</button><h2>🔁 订阅与对账</h2><p class="d">沙盒演示：受理≠已到账；金额以价格快照为准，稿内不列真价。</p></div><div class="card"><h2>生命周期</h2><p class="d">下单防重 → 支付意图 → 回调对暗号 → 交易确认 → 权益发放；自动续费可关，取消续订≠退款。</p></div><div class="card"><h2>对账</h2><p class="d">日切三方对平；沙盒并行对照；真通道 R3 准入后开。</p><p><button class="btn sm" onclick="nav('#/pay')">去收银台 →</button> <button class="btn sm ghost" onclick="nav('#/refund')">退款开票 →</button></p></div>`;
V.native = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/league')">← 联赛</button><h2>📱 原生与多端壳</h2><p class="d">R3 末尾：稿内只画入口与门，不承诺上架日期（演示）。</p></div><div class="card"><h2>壳矩阵</h2><p class="d">uni-app 小程序目标条件编译 · 微信登录态 · iOS / Android 壳 · Tauri 桌面壳（禁 Electron）· PWA 工作区。</p><p class="d">推送 APNs / FCM；密钥进 Keychain / Keystore，不落普通存储。</p><p><button class="btn sm ghost" onclick="nav('#/about')">关于本稿 →</button></p></div>`;
V.rewards = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/achieve')">← 成就</button><h2>🎁 任务奖励</h2><p class="d">可信完成才结算；重放不重结（演示口径）。</p></div><div class="card"><h2>领取</h2><p class="d">连续 3 天 ＋20 XP <button class="btn sm" onclick="toast('已领取 ＋20 XP（演示，不入账）')">领取</button></p><p class="d">成长结算走 Kafka 事件；R2 开榜，当前只看不动账。</p><p><button class="btn sm ghost" onclick="nav('#/world')">回世界 →</button> <button class="btn sm ghost" onclick="nav('#/weekly')">看报告 →</button></p></div>`;
const WD_CHEST = [
  { id: "c1", t: "路径宝箱", d: "定级完成解锁 · 宝石 + 增益（演示）", st: "open" },
  { id: "c2", t: "组队宝箱", d: "组队 5 天全满开启（演示 0/5）", st: "lock" },
  { id: "c3", t: "联赛宝箱", d: "周日结算前 3 开启（演示）", st: "lock" },
];
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
const WD_ACH = [
  { id: "a1", t: "初来乍到", d: "完成注册与身份确认", st: "got" },
  { id: "a2", t: "一战定级", d: "完成一次定级出报告", st: "got" },
  { id: "a3", t: "坚持 3 天", d: "连续学习 3 天（演示 1/3）", st: "lock", p: "1/3" },
  { id: "a4", t: "坚持 7 天", d: "连续学习 7 天（演示 1/7）", st: "lock", p: "1/7" },
  { id: "a5", t: "错题清道夫", d: "变式销账 5 道（演示 0/5）", st: "lock", p: "0/5" },
  { id: "a6", t: "词汇 40", d: "刷完 40 词一轮（演示）", st: "lock", p: "0/40" },
  { id: "a9", t: "限时快手", d: "限时挑战对 8 个（演示，去刷）", st: "lock", p: "0/8" },
  { id: "a10", t: "听力入门", d: "听完 3 篇（演示，去听）", st: "lock", p: "0/3" },
  { id: "a11", t: "跟读首秀", d: "完成 1 次跟读（演示，去语音）", st: "lock", p: "0/1" },
  { id: "a12", t: "打卡分享", d: "分享一次学习报告（演示）", st: "lock", p: "0/1" },
  { id: "a13", t: "联赛新秀", d: "进一次周联赛榜（演示）", st: "lock", p: "0/1" },
  { id: "a14", t: "赛季参与", d: "赛季规则公布后参赛", st: "closed" },
  { id: "a15", t: "宝箱猎人", d: "开 1 个宝箱（演示）", st: "lock", p: "0/1" },
  { id: "a16", t: "组队之星", d: "完成一次 5 天组队（演示）", st: "lock", p: "0/1" },
  { id: "a7", t: "赛季冠军", d: "赛季结算第一", st: "closed" },
  { id: "a8", t: "自习达人", d: "房间专注 10 次", st: "closed" },
];
const WD = { tab: "ach" };
V.achieve = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/world')">← 世界</button><h2>🏅 成就墙（${WD_ACH.filter(a => a.st === "got").length}/${WD_ACH.length}）</h2><p class="d">已获 / 未获 / 未开放分开；规则可查；未开放不挂可领红点（演示）。</p><p><button class="btn sm" onclick="nav('#/rewards')">任务奖励 →</button> <button class="btn sm ghost" onclick="nav('#/weekly')">学习报告 →</button></p></div>` + WD_ACH.map(a => `<div class="card" style="${a.st === "got" ? "" : "opacity:.75"}"><b>${a.st === "got" ? "🏅 " : a.st === "lock" ? "🔒 " : "⏳ "}${a.t}</b> <span class="tag">${a.st === "got" ? "已获" : a.st === "lock" ? "未获" + (a.p ? "·" + a.p : "") : "未开放"}</span><p class="d">${a.d}</p>${a.st === "got" ? `` : a.st === "lock" ? `<button class="btn sm ghost" onclick="nav('#/today')">去攒 →</button>` : `<p class="d">赛季/房间开门后再来（不写日期）。</p>`}</div>`).join("");
V.avatar = () => `<div class="card"><h2>👕 我的背景墙＋小人</h2><p class="d">Three.js 演示：换服装/配饰/发型＋打招呼（低端机自动降画质）</p><div id="t3d" style="width:100%;height:300px;border-radius:12px;overflow:hidden;background:#1c1430"></div><p class="d">上衣：<button class="btn sm" onclick="dress('shirt','#5b2fd6')">紫</button> <button class="btn sm" onclick="dress('shirt','#1d9e6b')">绿</button> <button class="btn sm" onclick="dress('shirt','#d64545')">红</button></p><p class="d">发型：<button class="btn sm" onclick="dress('hair','round')">圆寸</button> <button class="btn sm" onclick="dress('hair','cap')">帽子</button>　配饰：<button class="btn sm" onclick="dress('acc','glasses')">眼镜</button> <button class="btn sm" onclick="dress('acc','none')">无</button></p><p class="d">背景墙：<button class="btn sm" onclick="dress('wall','#1c1430')">星夜</button> <button class="btn sm" onclick="dress('wall','#0e3b2e')">森林</button> <button class="btn sm" onclick="dress('wall','#3b1d0e')">沙漠</button></p><button class="btn" onclick="wave()">👋 打招呼</button></div><div class="card"><h2>衣柜</h2><p class="d">目录可看，试穿不落库；兑换需权益（未开放）</p><span class="tag">默认卫衣·试穿中</span><span class="tag">星空外套·未开放</span><br><button class="btn sm" onclick="toast('兑换未开放：先完成学习任务')">兑换</button><p><button class="btn sm" onclick="nav('#/world')">回世界 →</button> <button class="btn sm ghost" onclick="nav('#/achieve')">看看成就 →</button> <button class="btn sm ghost" onclick="nav('#/a11y')">动效设置 →</button></p></div>`;
let T3 = null;
async function stage3d() {
  const el = document.getElementById("t3d");
  if (!el) return;
  if (T3) { el.appendChild(T3.renderer.domElement); if (!T3.raf) T3.tick(); return; }
  try {
    const THREE = await import("https://unpkg.com/three@0.160.0/build/three.module.js");
    const W = el.clientWidth || 320, H = 300;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);
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
    let waving = 0, spin = 0;
    T3 = { THREE, scene, cam, renderer, M, ground, waving: 0, raf: 0,
      tick() { spin += 0.004; const t = performance.now() / 90; M.armR.rotation.z = T3.waving > 0 ? (-0.9 + Math.sin(t) * 0.7) : (-0.2 + Math.sin(spin) * 0.06); if (T3.waving > 0) T3.waving--; M.body.rotation.y = Math.sin(spin * 0.6) * 0.08; renderer.render(scene, cam); T3.raf = requestAnimationFrame(() => T3.tick()); } };
    const vis = () => { if (document.hidden || !document.getElementById("t3d")) return; };
    document.addEventListener("visibilitychange", vis);
    T3.tick();
    toast("3D 小人已加载（演示）");
  } catch (e) { el.innerHTML = "<p class='d' style='padding:20px'>3D 加载失败（需联网），已降级 2D（演示）。</p>"; }
}
function dress(part, v) {
  if (!T3) { toast("3D 还没加载好"); return; }
  if (part === "shirt") { T3.M.body.material.color.set(v); dressAck("上衣"); }
  if (part === "hair") { const cap = v === "cap"; T3.M.cap.visible = cap; T3.M.hair.visible = !cap; dressAck(cap ? "帽子" : "圆寸"); }
  if (part === "acc") { T3.M.glasses.visible = v === "glasses"; dressAck(v === "glasses" ? "眼镜" : "无配饰"); }
  if (part === "wall") { T3.scene.background.set(v); T3.ground.material.color.set(v); dressAck("背景墙"); }
}
function wave() { if (T3) T3.waving = 40; else toast("3D 还没加载好"); }
const MSGS = [
  { id: "m1", cat: "学习", t: "今日任务已生成", d: "语法 2 道，预计 10 分钟", time: "08:00", read: false, go: "#/today" },
  { id: "m2", cat: "学习", t: "欢迎来到语学星", d: "先定级，3 分钟出报告", time: "昨天", read: false, go: "#/placement" },
  { id: "m3", cat: "系统", t: "条款更新了", d: "看一眼再继续，一键重签", time: "周一", read: true, go: "#/cupgrade" },
  { id: "m4", cat: "互动", t: "有人给你点赞", d: "你的打卡被 3 人点赞（演示）", time: "周一", read: true },
  { id: "m5", cat: "互动", t: "好友本周学了 120 分钟", d: "演示伙伴晨读阿甘 · 去联赛看看（演示数据）", time: "周二", read: false, go: "#/league" },
  { id: "m6", cat: "互动", t: "组队缺 1 天", d: "组队 5 天差 1 天，宝箱等你（演示）", time: "今天", read: false, go: "#/world" },
];
const MG = { cat: "全部" };
function msgGo(id) { const m = MSGS.find(x => x.id === id); if (!m) return; m.read = true; if (m.go) nav(m.go); else render(); }
V.msgs = () => { const un = MSGS.filter(m => !m.read).length; const list = MSGS.filter(m => MG.cat === "全部" || m.cat === MG.cat); return `<div class="card"><h2>✉️ 消息${un ? `（${un} 未读）` : ""}</h2><p class="d">${["全部", "学习", "系统", "互动"].map(c => `<button class="btn sm${MG.cat === c ? "" : " ghost"}" onclick="MG.cat='${c}';render()">${c}</button>`).join(" ")} <button class="btn sm ghost" onclick="MSGS.forEach(m=>m.read=true);render()">全标已读</button> <button class="btn sm ghost" onclick="nav('#/npref')">通知偏好 →</button></p></div>` + (list.length ? list.map(m => `<div class="card" onclick="msgGo('${m.id}')" style="cursor:pointer;${m.read ? "opacity:.65" : ""}"><b>${m.read ? "" : "● "}${m.t}</b> <span class="tag">${m.cat}</span><p class="d">${m.d}</p><p class="meta">${m.time}</p>${m.go ? `<p><button class="btn sm ghost">去看看 →</button></p>` : ``}</div>`).join("") : `<div class="card empty"><b>这类没消息</b></div>`); };
V.me = () => `<div class="card" style="text-align:center;background:linear-gradient(135deg,#f3edff,#e9f7f0);border:0"><div style="font-size:44px">😎</div><b style="font-size:19px">${S.user || "未登录"}</b><p class="d">B1 · 已坚持 ${S.streak} 天 · 错题 ${S.mistakes.length}</p><p><span class="tag">Lv.3 学徒</span> <span class="tag">本周 15 分钟</span></p></div><div class="card"><h2>▶️ 继续学</h2><p class="d">${S.lastRead.book} · ${S.lastRead.ch}</p><p><button class="btn sm" onclick="BK.cur='b1';BK.ch=1;nav('#/chapter')">继续读 →</button> <button class="btn sm ghost" onclick="nav('#/today')">今日任务 (${S.today.length}) →</button></p>${S.mistakes.length ? `<p class="d">上道错题：${String(S.mistakes[S.mistakes.length - 1].t).slice(0, 18)}… <button class="btn sm ghost" onclick="nav('#/mistakes')">去补救 →</button></p>` : ``}</div><div class="card"><h2>📚 学习</h2>${[["📚 图书管", "#/shelf", "在读·第二章"], ["⚡ 快速书架", "#/courses", ""], ["❤️ 错题本", "#/mistakes", S.mistakes.length ? S.mistakes.length + " 待补" : ""], ["🔁 复习", "#/srs", SRSQ.filter(q => !q.done).length ? SRSQ.filter(q => !q.done).length + " 到期" : ""], ["📊 学习报告", "#/weekly", ""], ["⚔️ 刷单词", "#/wordbook", "40 词"], ["🔤 音标", "#/phonics", ""], ["🔠 字母", "#/alphabet", ""]].map(([t, h, b]) => `<button class="opt" onclick="nav('${h}')">${t}${b ? ` <span class="tag">${b}</span>` : ""} ›</button>`).join("")}</div><div class="card"><h2>🌍 探索</h2>${[["🌍 世界", "#/world", "联赛·宝箱"], ["👕 装扮", "#/avatar", ""], ["🤖 AI 伴学", "#/ai", "演示"], ["🎤 语音跟读", "#/voice", ""], ["✉️ 消息", "#/msgs", MSGS.filter(m => !m.read).length ? MSGS.filter(m => !m.read).length + " 未读" : ""], ["🔍 搜索", "#/search", ""], ["🛒 商城", "#/commerce", "演示价"], ["🔒 青少年模式", "#/k12", "P3 未开"]].map(([t, h, b]) => `<button class="opt" onclick="nav('${h}')">${t}${b ? ` <span class="tag">${b}</span>` : ""} ›</button>`).join("")}</div><div class="card"><h2>🔤 听说读写</h2>${[["📖 词汇详情", "#/vocab", S.mistakes.filter(m => m.kind === "word").length ? S.mistakes.filter(m => m.kind === "word").length + " 待补" : ""], ["🎧 听力", "#/listening", ""], ["🎙️ 口语", "#/speaking", "语音跟读可用"], ["✍️ 写作", "#/writing", "暂无题"]].map(([t, h, b]) => `<button class="opt" onclick="nav('${h}')">${t}${b ? ` <span class="tag">${b}</span>` : ""} ›</button>`).join("")}</div><div class="card"><h2>👤 账号与系统</h2>${[["📦 离线包", "#/offpkg", "未开放下载"], ["🧾 退款开票", "#/refund", ""], ["⚙️ 设置", "#/settings", ""], ["♿ 无障碍", "#/a11y", ""], ["ℹ️ 关于", "#/about", ""]].map(([t, h, b]) => `<button class="opt" onclick="nav('${h}')">${t}${b ? ` <span class="tag">${b}</span>` : ""} ›</button>`).join("")}</div><div class="card"><h2>🛠️ 员工</h2><p class="d">需 staff 权限；普通账号只看说明，不进控制台（演示）。</p>${S.staff ? `<button class="opt" onclick="nav('#/admin')">🛠️ 管理控制台 ›</button>` : `<button class="opt" onclick="S.staff=true;toast('已切 staff 演示身份');render()">🔓 切 staff 演示身份 ›</button>`}<button class="opt" onclick="nav('#/support')">💬 客服 ›</button></div>${DEMO ? `<div class="card"><p class="d">测试：</p>${[["🧪 更多状态屏", "#/arrears"], ["⛔ 门被拒", "#/greject"], ["📄 同意升级", "#/cupgrade"]].map(([t, h]) => `<button class="opt" onclick="nav('${h}')">${t} ›</button>`).join("")}</div>` : ``}`;
V.about = () => `<div class="card" style="text-align:center"><b style="font-size:20px">语学星</b><p class="d">版本 1.0.0-demo · 静态交互稿</p><p class="d">学习目标 → 练习 → 反馈 → 复习 → 复盘</p></div><div class="card"><h2>📄 法务与合规</h2><p class="d">正文以官网为准，稿内只看入口结构；官网本地 18182 未启动时外链打不开。</p><a class="opt" href="http://127.0.0.1:18182/terms" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">📝 用户协议 <span class="meta">官网正文为准</span> ›</a><a class="opt" href="http://127.0.0.1:18182/privacy" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">🔒 隐私政策 <span class="meta">官网正文为准</span> ›</a><a class="opt" href="http://127.0.0.1:18182/compliance" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">📋 合规公示 <span class="meta">官网正文为准</span> ›</a><a class="opt" href="http://127.0.0.1:18182/minors" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">🧒 未成年人说明 <span class="meta">仅服务成人</span> ›</a></div><div class="card"><h2>💬 服务与帮助</h2><button class="opt" onclick="nav('#/support')">💬 联系客服 <span class="meta">工作日 9-18</span> ›</button><a class="opt" href="http://127.0.0.1:18182/help" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">❓ 帮助中心 <span class="meta">官网正文为准</span> ›</a><a class="opt" href="http://127.0.0.1:18182/announcements" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">📢 公告 <span class="meta">官网正文为准</span> ›</a><a class="opt" href="http://127.0.0.1:18182/status" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">📡 服务状态 <span class="meta">非实时可用率</span> ›</a></div><div class="card"><h2>✨ 产品</h2><a class="opt" href="http://127.0.0.1:18182/about" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">ℹ️ 关于语学星 <span class="meta">官网正文为准</span> ›</a><a class="opt" href="http://127.0.0.1:18182/download" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">⬇️ 下载 <span class="meta">官网正文为准</span> ›</a><button class="opt" onclick="nav('#/native')">📱 原生壳说明（R3 门） ›</button><a class="opt" href="http://127.0.0.1:18182/pricing" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">💰 价格 <span class="meta">首发免费，官网为准</span> ›</a></div><div class="card"><h2>🧾 开源与版本</h2><p class="d">开源许可：稿内说明，正式文本以官网与仓库为准（演示不虚构条款）。</p><p class="d">版本 1.0.0-demo · 18283 交互稿；法务文本未在稿内复刻，避免与官网不一致。</p></div>`;
V.settings = () => `<div class="card"><h2>🎯 学习偏好</h2><p class="d">当前：${S.goal || "四级词汇 B1"} · 每天 ${S.minutes} 分钟</p><label class="lb">目标</label><select id="sg"><option${(S.goal || "").includes("四级") ? " selected" : ""}>大学英语四级 · B1</option><option${(S.goal || "").includes("零基础") ? " selected" : ""}>零基础 · A1</option><option${(S.goal || "").includes("六级") ? " selected" : ""}>六级 · B2</option></select><label class="lb">每天分钟</label><select id="sm">${[5, 15, 30, 45].map(m => `<option${S.minutes === m ? " selected" : ""}>${m}</option>`).join("")}</select><button class="btn" onclick="doSetGoal()">保存偏好</button><p class="d">保存后今日起按新目标重排；已完成记录保留，不抹历史（演示）。</p></div><div class="card"><h2>🔔 通知</h2><p class="d">开关只在通知偏好里管，这里只留入口（演示）。</p><button class="opt" onclick="nav('#/npref')">通知偏好与免打扰 ›</button></div><div class="card"><h2>🎨 显示与语言</h2><button class="opt" onclick="nav('#/a11y')">♿ 无障碍（对比/字体/动效） ›</button><p class="d">主题：${["follow", "light", "dark"].map(t => `<button class="btn sm${SET.theme === t ? "" : " ghost"}" onclick="SET.theme='${t}';toast('主题：${{ follow: "跟随系统", light: "浅色", dark: "深色" }[t]}（演示）');render()">${{ follow: "跟随系统", light: "浅色", dark: "深色" }[t]}</button>`).join(" ")}</p><p class="d">界面语言：<button class="btn sm" onclick="toast('界面语言：中文（演示）')">中文 ›</button></p><p class="d">内容语言：<button class="btn sm" onclick="toast('内容语言：英语（演示）')">英语 ›</button></p><p class="d">界面语言只管按钮文案，题目语言不动（locale 分离）。</p></div><div class="card"><h2>📱 设备与隐私</h2><button class="opt" onclick="nav('#/devices')">📱 设备管理 ›</button><button class="opt" onclick="nav('#/privacy')">🔒 隐私（导出/删除） ›</button><button class="opt" onclick="nav('#/cupgrade')">📄 同意版本 ›</button></div><div class="card"><h2>👤 账号</h2><p class="d">推送未开：通知开关只记偏好，不代表能收到推送（演示）。</p><button class="btn ghost" onclick="arm(this,function(){S.user=null;toast('已退出');nav('#/login')})">退出登录</button></div>`;
function doSetGoal() { S.goal = document.getElementById("sg").selectedOptions[0].text; S.minutes = parseInt(document.getElementById("sm").value, 10); toast("偏好已保存，今日起重排（演示）"); render(); }
const PV = { exp: null, del: null };
const SUP = { cat: "功能", list: [{ id: "TK-1024", cat: "功能", t: "听力播到一半停了", st: "处理中" }, { id: "TK-1019", cat: "账号", t: "换手机想踢掉旧设备", st: "已回复" }] };
V.devices = () => `<div class="card"><h2>📱 设备</h2><p class="d">踢出二次确认；被踢设备旧会话失效并清该账号本地私有状态（演示说明）。</p><div class="card" style="margin:0 0 8px;border-color:var(--brand)"><b>本机浏览器</b> <span class="tag">当前设备</span><p class="d">最后活跃：刚刚 · 退出登录即清本机该账号状态</p></div><div class="card" style="margin:0"><b>Android · Pixel（演示）</b><p class="d">最后活跃：2 天前 <button class="btn sm" onclick="arm(this,function(){toast('已踢出（演示）：该设备旧会话失效')})">踢出</button></p></div></div>`;
V.privacy = () => `<div class="card"><h2>🔒 隐私</h2><p class="d">撤回先说影响；导出/删除给请求编号与进度，不是点完即完成（演示）。</p><p><button class="btn sm" onclick="PV.exp='REQ-2026-0007';toast('导出申请已提交，编号 REQ-2026-0007（演示）');render()">申请导出</button> <button class="btn sm" onclick="arm(this,function(){PV.del='DEL-2026-0003';render()})">申请删除</button> <button class="btn sm ghost" onclick="nav('#/paudio')">音频保留 →</button> <button class="btn sm ghost" onclick="PV.rankOff=!PV.rankOff;toast(PV.rankOff?'排名已关闭（演示）':'排名已打开（演示）');render()">${PV.rankOff ? "打开排名" : "关闭排名"}</button></p>${PV.exp ? `<div class="fb wa" style="display:block">导出 ${PV.exp} · 处理中：学习档案 ✓ / 错题 ⏳ / 录音 —（演示进度）</div>` : ``}${PV.del ? `<div class="fb wa" style="display:block">删除 ${PV.del} · 已受理：旧 token 即刻失效，数据逐服务清理后给回执（演示）</div>` : ``}</div>`;
V.support = () => `<div class="card"><h2>💬 客服</h2><p class="d">提交后只显示编号，客服按编号处理；正文受控（演示只收一句话）。</p><p class="d">分类：${["功能", "账号", "内容", "支付"].map(c => `<button class="btn sm${SUP.cat === c ? "" : " ghost"}" onclick="SUP.cat='${c}';render()">${c}</button>`).join(" ")}</p><input id="sup" placeholder="一句话描述问题"><button class="btn" onclick="supSend()">提交工单</button> <button class="btn ghost" onclick="nav('#/tdetail')">工单详情 →</button></div><div class="card"><h2>🧾 我的工单（${SUP.list.length}）</h2>${SUP.list.map(t => `<div class="card" style="margin:8px 0"><b>${t.id}</b> <span class="tag">${t.cat}</span> <span class="tag">${t.st}</span><p class="d">${t.t}</p></div>`).join("")}</div>`;
function supSend() { const v = (document.getElementById("sup").value || "").trim(); if (!v) { toast("先写一句话"); return; } const id = "TK-" + (1025 + SUP.list.length); SUP.list.unshift({ id, cat: SUP.cat, t: v.slice(0, 40), st: "已提交" }); toast("工单已提交，编号 " + id + "（演示）"); render(); }
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
  return `<div class="card"><h2>搜索</h2><input id="q" placeholder="搜课程/词汇/帮助" value="${SH.q.replace(/"/g, "")}" oninput="SH.q=this.value;render2()"><div id="sr"></div><p class="d">词汇结果进详情页（可自测/加复习），课程进图书管。</p></div>` + (!q ? `<div class="card"><p class="d">历史：${SH.hist.map(h => `<button class="btn sm ghost" onclick="SH.q='${h}';render()">${h}</button>`).join(" ")}</p></div>` : groups.length ? groups.map(({ g, items }) => `<div class="card"><b>${g}</b>${items.map(e => `<button class="opt" onclick="sgo('${e.t}');sgo2('${e.t}','${e.ty}')">${e.t} · ${e.d} ›</button>`).join("")}</div>`).join("") : `<div class="card empty"><b>没搜到“${SH.q}”</b><p class="d">换个词试试</p></div>`);
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
const GOODS = [
  { id: "g1", cat: "会员", t: "月度会员", d: "全部课程＋AI 伴学", price: 19, oprice: 29, tag: "热卖" },
  { id: "g2", cat: "会员", t: "年度会员", d: "月均 ¥9 · 最划算", price: 108, oprice: 228, tag: "省一半" },
  { id: "g3", cat: "课程", t: "四级冲刺包", d: "真题＋模考＋讲解", price: 49, oprice: 99, tag: "" },
  { id: "g4", cat: "课程", t: "雅思 6.5 全程", d: "听说读写四科", price: 299, oprice: 599, tag: "名师" },
  { id: "g5", cat: "周边", t: "单词卡片盒", d: "500 高频词实物卡", price: 39, oprice: 59, tag: "" },
  { id: "g6", cat: "周边", t: "学习帆布包", d: "装下你的坚持", price: 59, oprice: 79, tag: "新品" },
];
const GC = { cat: "全部", cur: null };
V.commerce = () => {
  if (GC.cur) { const g = GOODS.find(x => x.id === GC.cur); return `<div class="card"><button class="btn sm ghost" onclick="GC.cur=null;render()">← 商城</button><h2>${g.t}</h2><p>${g.tag ? `<span class="tag">${g.tag}</span> ` : ""}<span class="tag">${g.cat}</span></p><p class="d">${g.d}</p><p style="font-size:26px"><b>¥${g.price}</b> <s class="meta">¥${g.oprice}</s></p><button class="btn" onclick="nav('#/pay')">去结算 →</button></div>`; }
  const cats = ["全部", "会员", "课程", "周边"];
  const list = GOODS.filter(g => GC.cat === "全部" || g.cat === GC.cat);
  return `<div class="card"><h2>🛒 商城（演示价，不扣款）</h2><p class="d">${cats.map(c => `<button class="btn sm${GC.cat === c ? "" : " ghost"}" onclick="GC.cat='${c}';render()">${c}</button>`).join(" ")}</p><p><button class="btn sm ghost" onclick="nav('#/refund')">我的订单 / 退款 →</button> <button class="btn sm ghost" onclick="nav('#/subs')">订阅对账 →</button></p></div>` + list.map(g => `<div class="card"><b>${g.t}</b> ${g.tag ? `<span class="tag">${g.tag}</span>` : ""}<p class="d">${g.d}</p><p><b>¥${g.price}</b> <s class="meta">¥${g.oprice}</s> <button class="btn sm" style="float:right" onclick="GC.cur='${g.id}';render()">详情 →</button></p></div>`).join("");
};
function dressAck(c) { toast("换装：" + c + "（演示，不落库）"); }
const ADM = { pub: 6, pend: 2, users: 128, risk: 1 };
V.admin = () => `<div class="card"><p class="d">staff 视角（test 档）· 双签申请人禁自审</p><h2>📊 今日概览</h2><p><span class="tag">在架 ${ADM.pub}</span> <span class="tag">待审 ${ADM.pend}</span> <span class="tag">学员 ${ADM.users}</span> <span class="tag">风险 ${ADM.risk}</span></p><p class="d">口径：仅统计已发布与已落库，不含草稿（演示）。</p></div><div class="card"><h2>📌 待办（${ADM.pend}）</h2><p class="d">语法课 v3 · 等 L1 <button class="btn sm" onclick="nav('#/areview')">去审 →</button></p><p class="d">RISK-001 · 等建档 <button class="btn sm" onclick="nav('#/agov')">去看 →</button></p></div><div class="card"><h2>🧭 管理</h2>${[["📝 建稿送审", "#/adraft"], ["✔️ 双签审核", "#/areview"], ["🚀 发布回滚", "#/apublish"], ["🛡️ 治理风控", "#/agov"], ["📜 审计", "#/aaudit"], ["🔑 权限只读", "#/aperm"], ["🔐 管理登录", "#/alogin"], ["🎞️ 媒体上传", "#/amedia"], ["🎧 客服后台", "#/acs"], ["🧾 商城后台", "#/ashop"], ["🚩 举报队列", "#/areport"], ["📡 观测恢复", "#/aobs"]].map(([t, h]) => `<button class="opt" onclick="nav('${h}')">${t} ›</button>`).join("")}</div>`;
V.aperm = () => `<div class="card"><h2>🔑 权限（只读）</h2><p class="d">role-learner：14 项学员权限</p><p class="d">staff：投影/审计/工单读</p><p class="d">reviewer-l1/l2：初审/终审发布</p><p class="d">改权限走双人审批（演示无入口）。</p><p><button class="btn sm ghost" onclick="nav('#/admin')">← 管理</button></p></div>`;
V.adraft = () => `<div class="card"><h2>草稿箱</h2><p class="d">版本锁 · 无权 403 不泄漏存在性</p><div class="card" style="margin:0 0 8px"><b>语法课 · There be 句型（v3）</b><p class="d">版权已绑定 · 报告已绑定 · 缺项：无</p><button class="btn sm" onclick="toast('已送审（演示）')">提交送审</button></div><label class="lb">新建草稿标题</label><input id="dt" value="新课标题"><button class="btn" onclick="toast('草稿已建 202（演示）')">建稿</button><p><button class="btn sm ghost" onclick="nav('#/admin')">← 管理</button></p></div>`;
V.areview = () => `<div class="card"><h2>L1 初审</h2><p class="d">reviewer-l1 视角</p><button class="btn" onclick="A.l1=true;toast('L1 通过（演示）');paintRev()">通过</button></div><div class="card"><h2>L2 终审</h2><p class="d">reviewer-l2 视角 · 自动 ACTIVE</p><button class="btn" onclick="A.l2=true;toast('L2 通过，已 ACTIVE（演示）');paintRev()">通过并发布</button></div><div class="card"><h2>状态</h2><p class="d" id="revst">L1 待审 · L2 待审</p><p><button class="btn sm ghost" onclick="nav('#/admin')">← 管理</button></p></div>`;
V.apublish = () => `<div class="card"><h2>发布 / 下线 / 回滚</h2><p class="d">目录实时预览</p><button class="btn sm" onclick="toast('已发布，书架可见（演示）')">发布</button> <button class="btn sm" onclick="arm(this,function(){toast('已下架（演示）')})">下架</button> <button class="btn sm" onclick="arm(this,function(){toast('已回滚 v1（演示）')})">回滚 v1</button></div>`;
V.agov = () => `<div class="card"><h2>治理 · 风险区</h2><p class="d">无独立路由，并入治理页</p><div class="card" style="margin:0"><b>RISK-001 · 刷分嫌疑</b><p class="d">待建档</p><p class="d">全链：风险评估 → 分诊 → 隔离 → 升级 → 关闭；处置写链 R3，R1 只读建档（演示）。</p><p><button class="btn sm ghost" onclick="nav('#/areport')">举报队列 →</button> <button class="btn sm ghost" onclick="nav('#/aobs')">观测恢复 →</button></p><button class="btn sm" onclick="toast('已建档（演示）')">建档</button> <button class="btn sm" onclick="toast('已隔离（演示）')">隔离</button></div></div>`;
V.aaudit = () => `<div class="card"><h2>审计</h2><p class="d">分页 + 脱敏 · 导出 internal-only</p><p class="d">req-9208 · 同意记录 · 允许</p><p class="d">req-6fd9 · 注册门 · 拒绝</p><p><button class="btn sm ghost" onclick="nav('#/admin')">← 管理</button> <button class="btn sm ghost" onclick="nav('#/aobs')">观测恢复 →</button></p></div>`;
V.alogin = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/admin')">← 管理</button><h2>🔐 管理登录</h2><p class="d">staff / reviewer 独立登录；登录后回跳原页面；会话恢复无需重登（演示）。</p><label class="lb">工号</label><input value="" placeholder="如 staff-01"><label class="lb">密码</label><input type="password" value="" placeholder="密码"><button class="btn" onclick="S.staff=true;toast('管理登录成功（演示）');nav('#/admin')">登录</button><p class="d">双签申请人禁自审；改权限走双人审批。</p></div>`;
V.amedia = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/admin')">← 管理</button><h2>🎞️ 媒体与上传</h2><p class="d">元数据走内容服务，音频字节永不过内容服务（演示说明）。</p></div><div class="card"><h2>上传正链</h2><p class="d">版权绑定 → 审核通过 → 签名 URL 直传对象存储 → 回调登记 manifest。</p><button class="btn sm" onclick="toast('上传凭证已签发（演示）')">获取上传凭证</button></div><div class="card"><h2>边界</h2><p class="d">未绑定版权不可送审；R1 只读已审资源。</p><p><button class="btn sm ghost" onclick="nav('#/adraft')">回建稿 →</button> <button class="btn sm ghost" onclick="nav('#/apublish')">去发布 →</button></p></div>`;
V.acs = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/admin')">← 管理</button><h2>🎧 客服后台</h2><p class="d">R1 只读队列，处置写链 R3；正文受控、一事一号（演示）。</p></div>` + SUP.list.map(t => `<div class="card"><b>${t.id}</b> <span class="tag">${t.cat}</span> <span class="tag">${t.st}</span><p class="d">${t.t}</p><p><button class="btn sm" onclick="toast('已接单（演示）')">接单</button> <button class="btn sm ghost" onclick="nav('#/tdetail')">详情 →</button></p></div>`).join("");
V.ashop = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/admin')">← 管理</button><h2>🧾 商城后台</h2><p class="d">订单 → 订阅 → 对账 → 退款 → 开票，一条线查到底（演示）。</p></div><div class="card"><h2>对账</h2><p class="d">日切：订单＝渠道＝权益；差异进人工复核，不自动改账。</p></div><div class="card"><h2>退款</h2><p class="d">双人审批保留；单人运营方案待定，不虚构第二审批人。</p><p><button class="btn sm" onclick="nav('#/commerce')">看前台 →</button> <button class="btn sm ghost" onclick="nav('#/refund')">退款开票 →</button></p></div>`;
V.areport = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/agov')">← 治理</button><h2>🚩 举报队列</h2><p class="d">R1 只读队列；处置写链 R3 开（演示）。</p></div><div class="card"><b>RPT-301 · 房间刷屏嫌疑</b> <span class="tag">待分诊</span><p class="d">来源：房间巡检（演示）</p><p><button class="btn sm" onclick="toast('已分诊 → 建档（演示）');nav('#/agov')">分诊建档 →</button></p></div>`;
V.aobs = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/aaudit')">← 审计</button><h2>📡 观测与恢复</h2><p class="d">发布门三件：健康探针 / 优雅停机 / SBOM（演示说明）。</p></div><div class="card"><h2>链路</h2><p class="d">网关 401 进审计包络；requestId / traceId / auditId 跨服务关联。</p><p class="d">Outbox → Kafka 白名单投递，失败进 DLQ 可回放；跨服务 Saga＋补偿，不用分布式事务。</p></div><div class="card"><h2>发布</h2><p class="d">命名回滚＋恢复点；回滚先停写再切读（演示口径）。</p><p><button class="btn sm ghost" onclick="nav('#/apublish')">去发布回滚 →</button></p></div>`;
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
V.ai = () => `<div class="card"><h2>🤖 AI 伴学（P2 未开·演示）</h2><p class="d">Gate 未过无 CTA 是设计；下面是快捷方案，开一两个先体验。答不上来可转练题/客服，不硬聊。</p>${AIPLANS.slice(0, 4).map(p => `<button class="opt" onclick="aiopen('${p.id}')">${p.t}<br><span class="meta">${p.d}</span></button>`).join("")}<button class="opt" onclick="document.getElementById('aiMore').style.display='block';this.style.display='none'">更多方案（${AIPLANS.length - 4}） ›</button><div id="aiMore" style="display:none">${AIPLANS.slice(4).map(p => `<button class="opt" onclick="aiopen('${p.id}')">${p.t}<br><span class="meta">${p.d}</span></button>`).join("")}</div></div><div class="card" id="aibox" style="display:none"><div id="aimsgs" style="max-height:220px;overflow-y:auto"></div><div style="display:flex;gap:6px;margin-top:8px"><input id="aiin" placeholder="输入英文试试" style="flex:1"><button class="btn sm" onclick="aisend()">发</button></div><p class="d">聊不下去？ <button class="btn sm ghost" onclick="nav('#/practice')">转练题 →</button> <button class="btn sm ghost" onclick="nav('#/support')">问客服 →</button></p><p><button class="btn sm ghost" onclick="nav('#/aigate')">AI 门 →</button> <button class="btn sm ghost" onclick="nav('#/aiflow')">调用链 →</button></p></div>`;
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
V.voice = () => `<div class="card"><h2>🎤 语音跟读</h2><p class="d">跟读 / 口头翻译 / 对话 / 角色扮演全画（演示 TTS 示范 + 模拟录音；真评测走服务端，不承诺时间）。</p><p class="d">场景：${Object.keys(VOISCENES).map(s => `<button class="btn sm${VOI.scene === s ? "" : " ghost"}" onclick="VOI.scene='${s}';VOI.rec=false;render()">${s}</button>`).join(" ")}</p><div class="card" style="margin:8px 0"><b id="votext">${VOISCENES[VOI.scene][0]}</b> <button class="btn sm" onclick="vlisten()">🔊 示范</button>${VOI.scene === "口头翻译" ? `<p class="d">看到中文说英文（演示：点示范听英文答案）</p>` : ``}${VOI.scene === "角色扮演" ? `<p class="d">你演客人，我演店员（演示：一人一句轮着来）</p>` : ``}</div>${VOI.rec ? `<div class="card" style="margin:8px 0"><p class="d">● 录音中 <b id="vsec">0</b>s ～～～（演示波形）</p><button class="btn" onclick="vstop()">停止判分</button></div>` : `<button class="btn" onclick="VOI.rec=true;VOI.t=0;render();vtick()">🎤 开始录音</button>`}<p class="d">无麦先说（演示跳过设备检查）；RTC 未接不评真分。</p></div><div class="card"><p><button class="btn sm ghost" onclick="nav('#/vscore')">评分与保留 →</button></p></div><div class="card"><h2>📝 本轮记录</h2>${VOI.hist.length ? VOI.hist.map((h, i) => `<div class="card" style="margin:8px 0"><p class="d">${h.s}</p><p>发音 <b>${h.p}</b> · 流利 <b>${h.f}</b> · 完整 <b>${h.c}</b></p><div class="prog"><i style="width:${h.p}%"></i></div><p><button class="btn sm" onclick="vreplay(${i})">回听 🔊</button></p></div>`).join("") : `<p class="d">还没有，先录一条 👆</p>`}</div>`;
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
  if (!K12.role) return `<div class="card empty"><b>🎒 青少年模式（P3 未开·演示）</b><p class="d">你是？</p><button class="btn sm" onclick="K12.role='student';render()">我是学生</button> <button class="btn sm" onclick="K12.role='parent';render()">我是家长</button> <button class="btn sm" onclick="K12.role='teacher';render()">我是老师</button><p></p><button class="btn sm ghost" onclick="goBack()">返回成人版</button><p><button class="btn sm ghost" onclick="nav('#/k12guard')">治理规则 →</button> <button class="btn sm ghost" onclick="nav('#/k12course')">教材课程 →</button></p></div>`;
  if (K12.role === "parent") return `<div class="card"><h2>👪 家长页（演示）</h2><p class="d">绑定孩子：<button class="btn sm" onclick="toast('扫码绑定（演示）')">扫码绑定</button></p><p class="d">本周：学 45 分钟 · 3 天</p><button class="btn sm" onclick="arm(this,function(){toast('已撤回授权，孩子端即刻停用（演示）')})">撤回授权</button> <button class="btn sm ghost" onclick="K12.role=null;render()">换角色</button></div>`;
  if (K12.role === "teacher") return `<div class="card"><h2>👩‍🏫 老师页（演示）</h2><p class="d">班级：初一 3 班 · 40 人</p><p class="d">本周布置：单词 50 · 课文 2 篇 <button class="btn sm" onclick="toast('已布置（演示）')">布置</button></p><button class="btn sm ghost" onclick="K12.role=null;render()">换角色</button></div>`;
  if (!K12.book) return `<div class="card"><h2>📚 选教材（演示）</h2><p class="d">按年级，版权先行（演示全正版）</p>${["人教七上", "人教七下", "外研七上"].map(b => `<button class="opt" onclick="K12.book='${b}';render()">${b} ›</button>`).join("")}<button class="btn sm ghost" onclick="K12.role=null;render()">换角色</button></div>`;
  if (!K12.anti) return `<div class="card"><h2>${K12.book}</h2><p class="d">第一课：问候 <button class="btn sm" onclick="speak('Good morning class')">🔊</button></p><p>Good morning, class!</p><p class="d">坐下：Sit down, please.</p><button class="btn" onclick="K12.anti=true;render()">下课</button></div>`;
  return `<div class="card empty"><b>⏰ 今天学够 40 分钟啦，明天见！</b><p class="d">防沉迷：到点即停，不突破（演示）</p><button class="btn sm" onclick="K12.anti=false;K12.book=null;render()">明天再来</button></div>`;
};
V.aigate = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/ai')">← AI 伴学</button><h2>🚪 AI 门</h2><p class="d">四件齐了才开：阶段 P2 ＋ 成人 ＋ 同意 ＋ 成本预算（演示说明）。</p></div><div class="card"><h2>当前</h2><p class="d">P1 无 AI 入口是设计；R2 走 stub，不调真模型、不计真成本。</p><p><button class="btn sm" onclick="nav('#/aiflow')">看调用链 →</button></p></div>`;
V.aiflow = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/aigate')">← AI 门</button><h2>🔗 AI 调用链</h2><p class="d">输入 → 预检 → 请求 → 流式 → 核验 → 落库（演示口径）。</p></div><div class="card"><h2>关键件</h2><p class="d">输入授权告知；前置敏感拦截；prompt_version 固定；流式可停止；输出后置合规核验；Schema 校验；结果带来源保存；采纳 / 重做 / 转普通练习。</p><p class="d">超时降级给普通练题；成本进 cost_ledger 台账；审计与用户历史分离存。</p><p><button class="btn sm" onclick="nav('#/ai')">去体验 →</button> <button class="btn sm ghost" onclick="nav('#/practice')">转练题 →</button></p></div>`;
V.vscore = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/voice')">← 语音</button><h2>📊 发音评分与保留</h2><p class="d">结构化评分走服务端，不直连模型；RTC 失败不伪造结果（演示口径）。</p></div><div class="card"><h2>录音</h2><p class="d">原始音频隔离分级存；保留到期即清；导出 / 删除走隐私申请。</p><p class="d">随时打断：你一说话就停播；自建语音方案另立评审（ADR）。</p><p><button class="btn sm" onclick="nav('#/speaking')">回口语 →</button> <button class="btn sm ghost" onclick="nav('#/privacy')">隐私申请 →</button></p></div>`;
V.k12guard = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/k12')">← 青少年模式</button><h2>🛡️ K12 治理</h2><p class="d">P3 上锁：手续不全代码可写、门不开（演示）。</p></div><div class="card"><h2>门与手续</h2><p class="d">K12 Gate 默认关；未成年人识别 → 监护授权；教师 / 机构资质校验；开锁手续清单签完才开。</p></div><div class="card"><h2>在用保护</h2><p class="d">时长 / 时段到点即停；家长一键撤回即刻停用；未成年人隐私另行请求；安全事件进审计。</p><p><button class="btn sm ghost" onclick="nav('#/about')">关于本稿 →</button></p></div>`;
V.k12course = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/k12')">← 青少年模式</button><h2>📚 K12 课程</h2><p class="d">教材同步先验版权＋地区；中高考专项标注考纲版本（演示）。</p></div><div class="card"><h2>闭环</h2><p class="d">教材课 → 练习 → 报告 → 家长页同步（只读），与成人链隔离。</p><p><button class="btn sm ghost" onclick="nav('#/k12guard')">治理规则 →</button></p></div>`;
const TD = {cur:null, f:"全部"};
V.tdetail = () => `<div class="card"><button class="btn sm ghost" onclick="TD.cur=null;nav('#/support')">← 客服</button><h2>🧾 工单详情</h2><p class="d">一事一号；筛选：${["全部", "已提交", "处理中", "已回复"].map(f => `<button class="btn sm${TD.f === f ? "" : " ghost"}" onclick="TD.f='${f}';render()">${f}</button>`).join(" ")}</p></div>` + SUP.list.filter(t => TD.f === "全部" || t.st === TD.f).map(t => `<div class="card"><b>${t.id}</b> <span class="tag">${t.cat}</span> <span class="tag">${t.st}</span><p class="d">${t.t}</p><p class="d">流转：提交 → 接单 → 回复 → 升级 / 关闭；正文受控必要项待批（演示口径）。</p><p><button class="btn sm" onclick="toast('已催单一次（演示）')">催单</button> <button class="btn sm ghost" onclick="nav('#/acs')">后台视角 →</button></p></div>`).join("") || `<div class="card empty"><b>这类暂无工单</b><p class="d">换个筛选看看</p></div>`;
V.paudio = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/privacy')">← 隐私</button><h2>🎙️ 音频保留说明</h2><p class="d">跟读录音默认只留评分特征；原始音频另行授权才存（演示口径）。</p></div><div class="card"><h2>到期与删除</h2><p class="d">保留期到自动清；删号时逐服务清理并给回执；处理中显示编号＋进度，不点完即完成。</p><p><button class="btn sm ghost" onclick="nav('#/voice')">回语音 →</button></p></div>`;
V.pay = () => `<div class="card"><h2>收银台（沙盒）</h2><p class="d">Phase 1 基金 · ¥99 · 不扣真款 · 金额二次确认</p><button class="btn" onclick="arm(this,function(){var r=document.getElementById('payr');r.className='fb ok';r.style.display='block'})">支付 ¥99</button><div class="fb" id="payr" style="display:none;margin-top:10px">✓ 支付成功（沙盒）· 权益待开通演示</div><p><button class="btn sm" onclick="nav('#/refund')">查看订单 →</button> <button class="btn sm ghost" onclick="nav('#/commerce')">回商城 →</button></p></div>`;
V.a11y = () => `<div class="card"><h2>♿ 无障碍</h2><p class="d">跟随系统＋手动档，所见即所得；设置只在本机生效（演示），换设备需重设。</p><button class="opt" onclick="a11y('contrast')">◐ 高对比：<b id="a11yc">${AX.c ? "开" : "关"}</b> ›</button><button class="opt" onclick="a11y('font')">A 字体：<b id="a11yf">${["标准", "大", "特大"][AX.f]}</b> ›</button><button class="opt" onclick="a11y('motion')">▶ 动效：<b id="a11ym">${AX.m ? "开" : "关"}</b> ›</button><button class="opt" onclick="a11y('focus')">◎ 焦点框：<b id="a11yfo">${AX.fo ? "强" : "默认"}</b> ›</button><button class="opt" onclick="a11y('voice')">🔊 读屏/朗读：<b id="a11yv">${AX.v ? "开" : "关"}</b> ›</button><p><button class="btn sm ghost" onclick="a11yReset()">恢复默认</button></p></div><div class="card"><h2>👁 预览（真实生效区）</h2><p style="font-size:22px"><b>Good morning.</b></p><p class="d">早上好。今天也要学 15 分钟。</p><p><span class="tag">B1</span> <span class="tag">今日 2 题</span></p><button class="btn sm" onclick="toast('预览：当前对比/字号/动效即你所见（演示）')">示例按钮</button> <button class="btn sm ghost" onclick="a11yDemo()">播报这段 🔊</button><p class="d">状态不用颜色 alone 表达：✓=可做 ♥=待补救 ⌁=待同步，均有文字。</p><div class="fb ok">✓ 保存成功是这种条（文字＋色块）</div><div class="fb no">! 出错是这种条（文字＋色块）</div></div><div class="card"><h2>⌨️ 键盘与焦点自查</h2><p class="d">Tab 走一遍：本页按钮 → 预览 → 下面三链接，焦点框${AX.fo ? "已加强" : "为默认"}；回车可点，焦点不丢。</p><p><button class="btn sm" onclick="nav('#/shelf')">书架 ›</button> <button class="btn sm" onclick="nav('#/practice')">练题 ›</button> <button class="btn sm" onclick="nav('#/home')">首页 ›</button></p><p class="d">抽验屏（书架/练题）不是全部范围；长题干、320 宽度、横竖屏以真机为准，稿内不认证。</p></div>`;
function a11yDemo() { if (!AX.v) { toast("先打开读屏/朗读（演示）"); return; } speak("Good morning. Time to study fifteen minutes."); }
V.arrears = () => `<div class="card"><h2>📚 今日任务</h2><div class="card" style="margin:0 0 8px;border-color:var(--warn)"><b>昨天有 1 节没学完，今天补吗？</b><p class="d">补上不断签</p><button class="btn sm" onclick="toast('已加入今日（演示）');nav('#/today')">补上 →</button> <button class="btn sm ghost" onclick="nav('#/today')">跳过</button></div></div>`;
V.celebrate = () => `<div class="card" style="text-align:center"><b style="font-size:40px">🎉</b><h2>今天全完成了，明天见！</h2><p class="d">复习队列见明日今日，保持手感</p><button class="btn" onclick="nav('#/home')">回首页</button></div>`;
V.offlinet = () => `<div class="card"><h2>📚 今日任务</h2><div class="fb wa">⌁ 离线任务已保留，联网后同步</div><div class="card" style="margin:8px 0 0"><b>语法 · There ___ two books.</b><p class="d">本地草稿 · 待同步</p><p><button class="btn sm ghost" onclick="nav('#/offpkg')">离线包说明 →</button></p></div></div>`;
V.pgen = () => `<div class="card"><h2>计划生成中…</h2><div class="prog"><i style="width:60%"></i></div><p class="d">按定级报告组装，失败给重试</p><button class="btn ghost" onclick="S.plan=true;toast('计划已生成');nav('#/home')">模拟完成 →</button><p><button class="btn sm ghost" onclick="nav('#/planexp')">计划解释 →</button> <button class="btn sm ghost" onclick="nav('#/firstlearn')">首次学习 →</button></p></div>`;
V.planexp = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/pgen')">← 生成中</button><h2>📋 计划解释</h2><p class="d">这句话说明计划从哪来（演示口径，不编算法参数）。</p></div><div class="card"><h2>输入来源</h2><p class="d">定级报告 B1（已锁定，不会变）＋ 画像目标（四级词汇 B1）＋ 建计划时的输入快照 ＋ 规则版本。</p><p class="d">一句话：定级语法待补 → 本周每天 15 分钟先补语法 2 道。</p></div><div class="card"><h2>重排规则</h2><p class="d">目标变更走版本锁重排；已完成记录保留不抹；重复点生成不会建出两份计划。</p><p><button class="btn sm" onclick="nav('#/today')">看今日安排 →</button> <button class="btn sm ghost" onclick="nav('#/home')">回首页 →</button></p></div>`;
V.session = () => `<div class="card"><h2>🔗 会话与检查点</h2><p class="d">练习按会话走，checkpoint 是断点续练的依据（演示）。</p></div><div class="card"><h2>顺序＋版本锁</h2><p class="d">按题序作答；乱序/并发提交会被打回（409），按服务端题号重拉再答；判分规则按版本锁定，老会话不受新规则影响。</p></div><div class="card"><h2>断点续练</h2><p class="d">做到第 3 题退出 → 回来从第 3 题继续；重复提交幂等，不重复计分。</p><p><button class="btn sm" onclick="nav('#/practice')">继续练 →</button> <button class="btn sm ghost" onclick="nav('#/today')">回今日 →</button></p></div>`;
V.mastery = () => `<div class="card"><h2>📈 掌握度</h2><p class="d">按维度看进步，不拿单次分数定终身（演示口径）。</p></div><div class="card"><h2>维度</h2>${[["词汇", 80], ["语法", 45], ["阅读", 70], ["听力", 50]].map(([t, v]) => `<div class="dim"><span class="v">${t} ${v}</span><span class="bar w"><i style="width:${v}%"></i></span></div>`).join("")}</div><div class="card"><h2>弱点 Top</h2><p class="d">① 语法 There be（错 2）② 听力短对话（错 1）③ 形近词 abandon/absorb</p><p><button class="btn sm" onclick="nav('#/mistakes')">去补救 →</button> <button class="btn sm ghost" onclick="nav('#/srs')">去复习 →</button> <button class="btn sm ghost" onclick="nav('#/weekly')">看报告 →</button></p></div>`;
V.pfault = () => `<div class="card"><h2>🛟 定级恢复</h2><p class="d">出错不丢题，失败有出口（演示）。</p></div><div class="card"><h2>409 版本冲突</h2><p class="d">乱序/并发提交会被打回（409）→ 按服务端题号重拉进度再答，不覆盖已答。</p></div><div class="card"><h2>断网续答</h2><p class="d">断网先存本机草稿（只存题号＋选项）；恢复后按 checkpoint 续题号。</p></div><div class="card"><h2>重测</h2><p class="d">重测开新 session，旧报告保留可查，不覆盖。</p><p><button class="btn sm" onclick="nav('#/placement')">回定级 →</button> <button class="btn sm ghost" onclick="nav('#/report')">看报告 →</button></p></div>`;
V.npref = () => `<div class="card"><button class="btn sm ghost" onclick="nav('#/msgs')">← 消息</button><h2>🔔 通知偏好</h2><p class="d">开关只记偏好＋版本号，能否收到看真实渠道（演示：推送未开不开“成功”）。</p></div><div class="card"><h2>渠道</h2><button class="opt" onclick="SET.study=!SET.study;render()">${SET.study ? "✅" : "⬜"} 学习提醒 ›</button><button class="opt" onclick="SET.report=!SET.report;render()">${SET.report ? "✅" : "⬜"} 学习报告 ›</button><button class="opt" onclick="SET.sys=!SET.sys;render()">${SET.sys ? "✅" : "⬜"} 系统公告 ›</button></div><div class="card"><h2>免打扰</h2><p class="d">时段：<button class="btn sm${SET.slot === "morning" ? "" : " ghost"}" onclick="SET.slot='morning';render()">晨间 8:00</button> <button class="btn sm${SET.slot === "night" ? "" : " ghost"}" onclick="SET.slot='night';render()">睡前 22:00</button></p><p class="d">部分失败自动重试 3 次；真实事件驱动 R2 开，Push / Email / SMS 走 R3（演示不开）。</p><p><button class="btn sm ghost" onclick="nav('#/settings')">回设置 →</button></p></div>`;
V.firstlearn = () => `<div class="card"><h2>🌱 首次学习</h2><p class="d">新号 3 击到达定级：画像 → 定级 / 快速开始 → 今日（演示）。</p></div><div class="card"><h2>两条路</h2><p class="d">① 定级 3 分钟出报告再排计划（推荐）② 快速开始用 SKIPPED 基线先学，不伪造正式报告。</p><p><button class="btn sm" onclick="nav('#/placement')">去定级 →</button> <button class="btn sm ghost" onclick="S.plan=true;toast('快速开始：基线计划已生成（演示）');nav('#/today')">快速开始 →</button></p></div>`;
V.greject = () => `<div class="card empty"><b>暂不能开放学习</b><p class="d">身份未通过，可退出或联系客服</p><button class="btn sm" onclick="arm(this,function(){S.user=null;nav('#/login')})">退出</button> <button class="btn sm" onclick="nav('#/support')">联系客服</button></div>`;
V.cupgrade = () => `<div class="card"><h2>条款更新了</h2><p class="d">看一眼再继续，一键重签</p><button class="btn" onclick="toast('已重签（演示）');goBack()">重签完成</button></div>`;
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
  if (!res.length) return `<div class="card empty" style="margin:8px 0 0"><b>没搜到“${VC.q}”</b><p class="d">换个词试试，或去刷单词</p></div>`;
  return res.map(e => `<button class="opt" onclick="vcPick('${e.w}')"><b>${e.w}</b> <span class="meta">${e.ph}</span> · ${e.zh} <span class="tag">${e.book}</span> ›</button>`).join("");
}
function vcQuiz(k) { VC.quizPick = k; render(); }
function vcAdd() {
  const d = vcData();
  if (SRSQ.some(x => x.w === d.w && !x.done)) { toast("已在复习队列（演示）"); return; }
  SRSQ.unshift({ w: d.w, zh: d.zh, stage: 1, show: false });
  toast("已加入复习（演示）"); render();
}
function vcMark(know) {
  const d = vcData();
  if (know) { toast("记下了，去复习巩固（演示）"); }
  else { if (!S.mistakes.some(m => m.t === d.w)) S.mistakes.push({ t: d.w, why: "定位：词汇待补", kind: "word" }); toast("已进错题本（演示）"); }
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
  const inSrs = SRSQ.find(x => x.w === d.w && !x.done);
  const idx = vcAll().findIndex(x => x.w === d.w);
  const qo = vcQuizOpts();
  return `<div class="card"><p class="d">${d.book} · 第 ${idx + 1}/40 · ${wpic(d.w)} ${inSrs ? "· 已在复习 stage " + inSrs.stage : ""}</p><div style="text-align:center;padding:8px 0"><b style="font-size:36px">${d.w}</b><p class="d">${d.ph} <button class="btn sm" onclick="speak('${d.w}')">🔊 读</button></p><p style="font-size:20px"><b>${d.zh}</b></p></div><p style="display:flex;gap:8px"><button class="btn sm ghost" style="flex:1" onclick="vcPrev()">← 上一词</button><button class="btn sm ghost" style="flex:1" onclick="vcNext()">下一词 →</button></p></div><div class="card"><h2>🔍 找词</h2><input id="vcq" placeholder="英文 / 中文，如 abandon / 抛弃" value="${VC.q.replace(/"/g, "")}" oninput="VC.q=this.value;document.getElementById('vclist').innerHTML=vclist()"><div id="vclist">${vclist()}</div></div><div class="card"><h2>🔀 拆开记</h2><p style="font-size:22px">${parts.join(" + ")}</p><p class="d">形和音对应着记（演示拆分，非权威词源）。</p>${lex ? `<p class="d">搭配：${lex.coll}</p><p class="d">例：${lex.ex}</p>` : `<p class="d">搭配：暂无，先记例句 👇</p>`}</div><div class="card"><h2>🔤 变形全家</h2><p>${f.infl.map(x => `<span class="tag">${x}</span>`).join("")}</p></div><div class="card"><h2>🧩 组句（点 🔊 跟读）</h2>${f.sent.map((s, k) => `<p class="d">${k + 1}. ${s} <button class="btn sm" onclick="speak('${s.replace(/'/g, "")}')">🔊</button></p>`).join("")}</div><div class="card"><h2>😎 俚语</h2><p>${f.slang}</p><h2 style="margin-top:10px">📜 由来</h2><p class="d">${f.story}</p></div><div class="card"><h2>✅ 自测：中文 → 英文</h2><p class="d">“${d.zh}”是哪个？</p>${qo.opts.map((o, k) => `<button class="opt${VC.quizPick === k ? " sel" : ""}" onclick="vcQuiz(${k})">${wpic(o.w)} ${o.w}</button>`).join("")}${VC.quizPick >= 0 ? (qo.opts[VC.quizPick].ok ? `<div class="fb ok">✓ 对了</div>` : `<div class="fb no">! 选错了：${d.w} 拆开是 ${parts.join(" + ")}，跟读三遍 <button class="btn sm" onclick="speak('${d.w}')">🔊</button></div>`) : ``}</div><div class="card"><h2>📌 行动</h2><p><button class="btn sm" onclick="vcAdd()">${inSrs ? "已在复习 ✓" : "加入复习"}</button> <button class="btn sm ghost" onclick="vcMark(true)">会了 ✓</button> <button class="btn sm ghost" onclick="vcMark(false)">不会，进错题</button></p><p><button class="btn sm ghost" onclick="vcDrill()">去刷这本 →</button> <button class="btn sm ghost" onclick="nav('#/srs')">去复习 →</button> <button class="btn sm ghost" onclick="nav('#/mistakes')">错题本 →</button></p><p class="d">缺项写“暂无”，不编发音；演示状态不代表服务端已落库。</p></div>`;
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
function lsel(i) { try { speechSynthesis.cancel(); } catch (e) { } LSM.cur = i; LSM.playing = false; LSM.quizPick = -1; LSM.quizPick2 = -1; render(); }
function lrate(r) { LSM.rate = r; toast("语速 " + r + "x（演示）"); render(); }
function lsub() { LSM.showSub = !LSM.showSub; render(); }
function lloop() { LSM.loop = !LSM.loop; toast(LSM.loop ? "单句循环开（演示）" : "单句循环关"); render(); }
function lplay() {
  const m = LSM.mats[LSM.cur];
  const txt = LSM.mix === 1 ? m.mix : m.en;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = LSM.mix === 1 ? "zh-CN" : "en-US"; u.rate = LSM.rate;
    LSM.playing = true; render();
    u.onend = () => {
      if (LSM.loop) { lplay(); return; }
      LSM.playing = false;
      if (!LSM.hist.includes(m.title)) { LSM.hist.push(m.title); LSM.done++; }
      render(); toast("播完了（演示 TTS，非版权真音）");
    };
    u.onerror = () => { LSM.playing = false; render(); };
    speechSynthesis.speak(u);
  } catch (e) { toast("朗读不可用（演示）"); }
}
function lstop() { try { speechSynthesis.cancel(); } catch (e) { } LSM.playing = false; render(); }
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
  return `<div class="card"><h2>🎧 听力 · 播客</h2><p class="d">演示 TTS 朗读，非版权真音；真音与 0.5x–2.0x 保音高待接，不承诺时间。</p><p class="d">材料：${LSM.mats.map((x, i) => `<button class="btn sm${LSM.cur === i ? "" : " ghost"}" onclick="lsel(${i})">${x.lv} ${x.title}</button>`).join(" ")}</p><p class="d">播客档：<button class="btn sm${LSM.mix === 0 ? "" : " ghost"}" onclick="LSM.mix=0;render()">全英文</button> <button class="btn sm${LSM.mix === 1 ? "" : " ghost"}" onclick="LSM.mix=1;render()">中英混播</button> · 已听完 ${LSM.done} 篇${LSM.hist.length ? "（" + LSM.hist.join("、") + "）" : ""}</p></div><div class="card"><b>${m.lv} · ${m.title}${LSM.mix === 1 ? " · 混播" : ""}</b>${LSM.showSub ? `<p style="font-size:17px">${LSM.mix === 1 ? m.mix : m.en}</p><p class="d">${m.zh}</p>` : `<p class="d">字幕已藏，先盲听一遍再打开</p>`}<p><button class="btn sm" onclick="lsub()">${LSM.showSub ? "藏字幕" : "看字幕"}</button> <button class="btn sm${LSM.loop ? "" : " ghost"}" onclick="lloop()">🔁 循环</button></p><p class="d">语速：${[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => `<button class="btn sm${LSM.rate === r ? "" : " ghost"}" onclick="lrate(${r})">${r}x</button>`).join(" ")}</p>${LSM.playing ? `<button class="btn" onclick="lstop()">⏸ 停止</button><p class="d">▶ 播放中 ${LSM.rate}x${LSM.loop ? " · 循环" : ""}（演示）</p>` : `<button class="btn" onclick="lplay()">🔊 播放</button>`}</div><div class="card"><h2>✍️ 听写一句</h2><p class="d">播完凭印象写，不看字幕；只对意思，不判真分。</p><input id="ldict" placeholder="Type what you hear" oninput="LSM.dict=this.value"><div class="fb wa" id="ldictfb" style="display:block">先播一遍再写 👆</div><button class="btn sm" onclick="ldictCheck()">核对</button></div><div class="card"><h2>❓ 听后两题</h2><p class="d">${q.s}</p>${q.o.map((t, k) => `<button class="opt${LSM.quizPick === k ? " sel" : ""}" onclick="lquizPick(${k})">${"ABC"[k]}. ${t}</button>`).join("")}${LSM.quizPick >= 0 ? (LSM.quizPick === q.a ? `<div class="fb ok">✓ 对了</div>` : `<div class="fb no">! 再听一遍，答案在音频里</div>`) : ``}<p class="d" style="margin-top:10px">${m.q2.s}</p>${m.q2.o.map((t, k) => `<button class="opt${LSM.quizPick2 === k ? " sel" : ""}" onclick="LSM.quizPick2=${k};render()">${"ABC"[k]}. ${t}</button>`).join("")}${LSM.quizPick2 >= 0 ? (LSM.quizPick2 === m.q2.a ? `<div class="fb ok">✓ 对了</div>` : `<div class="fb no">! 再听一遍</div>`) : ``}</div><div class="card"><button class="opt" onclick="nav('#/practice')">去练题 ›</button><button class="opt" onclick="nav('#/voice')">去跟读 ›</button></div>`;
};
V.speaking = () => `<div class="card"><h2>🎙️ 口语</h2><p class="d">跟读 / 口头翻译 / 对话 / 角色扮演四题型（演示；真评测走服务端，不承诺时间）。</p><p>${[["跟读", "跟读"], ["口头翻译", "口头翻译"], ["对话", "对话"], ["角色扮演", "角色扮演"]].map(([t, s]) => `<button class="btn sm" onclick="VOI.scene='${s}';VOI.rec=false;nav('#/voice')">${t} →</button>`).join(" ")}</p><p class="d">Video Call / Roleplay 真链（P2 门）：门未开先练上面的演示场景。</p><p><button class="btn sm ghost" onclick="toast('Video Call 未开：P2 门（演示）')">Video Call（未开）</button> <button class="btn sm ghost" onclick="VOI.scene='角色扮演';nav('#/voice')">Roleplay 演示 →</button></p></div><div class="card"><p><button class="btn sm ghost" onclick="nav('#/listening')">先去听力打底 →</button> <button class="btn sm ghost" onclick="goBack()">返回</button></p></div>`;
V.writing = () => `<div class="card empty"><b>✍️ 写作</b><p class="d">暂无可写题目</p><p class="d">题目还在准备（需版权与审核），提交与反馈链也没接好；现在放空白编辑器写了也存不下来，所以没放。</p><p><button class="btn sm" onclick="nav('#/practice')">去练题 →</button> <button class="btn sm ghost" onclick="nav('#/mistakes')">去错题本 →</button></p><p><button class="btn sm ghost" onclick="goBack()">返回</button></p></div><div class="card"><p class="d">将来开了是什么样：审题 → 写作 → 提交 → 规则反馈（演示说明，不承诺时间）。</p></div>`;
const OP_PKGS = [
  { id: "p1", t: "四级词汇包", ver: "v3（演示结构）", size: "—", scope: "四级核心词 + 例句", st: "未开放下载", note: "完整离线未准入（R3），当前请在线学。" },
  { id: "p2", t: "零基础包", ver: "v1（演示结构）", size: "—", scope: "字母 + 音标 + 短句", st: "未开放下载", note: "完整离线未准入（R3），当前请在线学。" },
  { id: "p3", t: "六级阅读包", ver: "v2（演示结构）", size: "—", scope: "长难句 + 精读", st: "未开放下载", note: "完整离线未准入（R3），当前请在线学。" },
];
V.offpkg = () => `<div class="card"><h2>离线包</h2><p class="d">列表可读：版本 / 大小 / 内容范围 / 状态可见。完整离线未准入前不开放下载，不保留可点的必败下载。</p><p class="d">装了 PWA ≠ 离线可学；断网时今日进度处理另见说明。</p><button class="btn sm ghost" onclick="nav('#/offlinet')">断网时怎么办 →</button></div>` + OP_PKGS.map(p => `<div class="card"><b>${p.t}</b> <span class="tag">${p.st}</span><p class="d">版本：${p.ver} · 大小：${p.size}</p><p class="d">范围：${p.scope}</p><p class="d">${p.note}</p><button class="btn sm" onclick="nav('#/shelf')">去书架在线学 →</button></div>`).join("") + `<div class="card"><p class="d">结构为演示占位，非真实可下载字节；大小“—”表示未定，不虚构 MB 数。</p></div>`;
const RF = { cur: null };
const RF_ORDERS = [
  { id: "tk1", t: "月度会员", price: 19, pay: "已支付（沙盒）", right: "有效", rf: "L1 已过·等 L2", step: 1, inv: "未申请" },
  { id: "tk2", t: "四级冲刺包", price: 49, pay: "已支付（沙盒）", right: "有效", rf: "无", step: -1, inv: "电子收据可看" },
  { id: "tk3", t: "年度会员", price: 108, pay: "已退款（沙盒）", right: "已按政策撤销（演示）", rf: "已到账（沙盒）", step: 4, inv: "商店收据可看·本地发票待渠道确认" },
];
const RF_STEPS = ["已申请", "L1 通过", "L2 通过", "渠道处理中", "已到账（沙盒）"];
function rfApply(id) { const o = RF_ORDERS.find(x => x.id === id); if (!o || o.rf !== "无") { toast("该单已有退款进度（演示）"); return; } o.rf = "已申请·等 L1"; o.step = 0; toast("退款申请已提交（演示）"); render(); }
function rfInv(id, kind) { const o = RF_ORDERS.find(x => x.id === id); if (!o) return; o.inv = kind + "申请中（演示）"; toast(kind + "申请已提交（演示）"); render(); }
V.refund = () => {
  const o = RF_ORDERS.find(x => x.id === RF.cur);
  if (o) return `<div class="card"><button class="btn sm ghost" onclick="RF.cur=null;render()">← 退款/开票</button><h2>${o.t} · ¥${o.price}</h2><p class="d">资金：${o.pay} · 权益：${o.right}</p>${o.step >= 0 ? `<p class="d">退款：${RF_STEPS.map((s, i) => `<span class="tag"${i === o.step ? ` style="border-color:var(--brand);color:var(--brand)"` : ""}>${i <= o.step ? "● " : ""}${s}</span>`).join(" ")}</p><p class="d">当前：${o.rf} · 双人审批保留，单人运营方案待定，不虚构第二审批人。</p>` : `<p class="d">退款：无 · 取消续订≠退款，只停下次扣费，当前权益保留到到期。</p>`}<p><button class="btn sm" onclick="arm(this,function(){rfApply('${o.id}')})">申请退款</button> <button class="btn sm ghost" onclick="arm(this,function(){toast('取消续订：下次不再扣费，当前权益保留到到期（演示）')})">取消续订</button></p></div><div class="card"><h2>🧾 开票</h2><p class="d">当前：${o.inv}</p><p class="d">能开何种票据按渠道确定；商店收据不直接当本地发票（待确认）。</p><button class="btn sm" onclick="rfInv('${o.id}','电子收据')">申请电子收据</button> <button class="btn sm ghost" onclick="rfInv('${o.id}','本地发票')">申请本地发票</button></div><div class="card"><p class="d">到账与权益变化分开：受理≠已到账；退款完成前权益保持有效，完成后按政策撤销（演示）。</p></div>`;
  return `<div class="card"><h2>退款 / 开票</h2><p class="d">沙盒演示，不扣真款不发真权益；受理≠已到账。</p></div>` + RF_ORDERS.map(x => `<div class="card"><b>${x.t}</b> <span class="tag">¥${x.price}</span><p class="d">资金：${x.pay} · 权益：${x.right}</p><p class="d">退款：${x.rf} · 开票：${x.inv}</p><button class="btn sm" onclick="RF.cur='${x.id}';render()">查看进度 →</button></div>`).join("") + `<div class="card"><p class="d">取消续订≠退款；退款双人审批保留；票据种类按渠道确定（待确认，不虚构）。</p></div>`;
};
const VOWELS = [["iː", "sheep"], ["ɪ", "ship"], ["e", "bed"], ["æ", "cat"], ["ɑː", "car"], ["ɒ", "hot"], ["ɔː", "door"], ["ʊ", "book"], ["uː", "food"], ["ʌ", "cup"], ["ɜː", "bird"], ["ə", "about"], ["eɪ", "day"], ["aɪ", "my"], ["ɔɪ", "boy"], ["əʊ", "go"], ["aʊ", "how"], ["ɪə", "here"], ["eə", "there"], ["ʊə", "tour"]];
const CONSS = [["p", "pen"], ["b", "book"], ["t", "tea"], ["d", "dog"], ["k", "key"], ["g", "go"], ["f", "fish"], ["v", "van"], ["θ", "think"], ["ð", "this"], ["s", "sun"], ["z", "zoo"], ["ʃ", "ship"], ["ʒ", "vision"], ["h", "hat"], ["m", "man"], ["n", "no"], ["ŋ", "sing"], ["l", "look"], ["r", "red"], ["j", "yes"], ["w", "we"], ["tʃ", "chair"], ["dʒ", "jump"], ["tr", "tree"], ["dr", "dog"], ["ts", "cats"], ["dz", "beds"]];
const PHQ = [["sip", "zip"], ["ship", "sheep"], ["cat", "cut"], ["pen", "pan"]];
const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const BOOKS = [
  { id: "b1", title: "四级词汇红宝书", author: "俞敏洪", year: "2023", purpose: "四级一次过", tags: ["四级", "词汇", "B1"], dir: "每天 30 词 → 练题 → 复习", intro: "四级核心 3000 词，按频排序，配真题例句。", toc: ["第一章 高频 500", "第二章 核心 1500", "第三章 冲刺 1000"], sents: [["Abandon bad habits.", "A1", "抛掉坏习惯。"], ["Knowledge changes life.", "A2", "知识改变生活。"], ["Persistence pays off.", "B1", "坚持终有回报。"]] },
  { id: "b2", title: "零基础英语", author: "语学星教研", year: "2024", purpose: "开口不害怕", tags: ["零基础", "口语", "A1"], dir: "字母→音标→短句→对话", intro: "从 26 字母到日常 100 句，配音频跟读。", toc: ["第一单元 字母音标", "第二单元 问候告别", "第三单元 吃穿住行"], sents: [["Good morning.", "A0", "早上好。"], ["How are you?", "A0", "你好吗？"], ["See you.", "A0", "再见。"]] },
  { id: "b3", title: "六级长难句", author: "李笑来", year: "2022", purpose: "阅读上 200", tags: ["六级", "阅读", "B2"], dir: "拆句→精读→复述", intro: "100 个真题长难句，拆到主谓宾。", toc: ["第一章 定语从句", "第二章 状语从句", "第三章 综合实战"], sents: [["The man who lives next door is a doctor.", "B1", "住隔壁的男人是医生。"], ["Hardly had I arrived when it rained.", "B2", "我刚到就下雨了。"], ["What matters is not what you say.", "B2", "重要的不是你说什么。"]] },
  { id: "b4", title: "商务口语 100 句", author: "语学星教研", year: "2024", purpose: "开会能张嘴", tags: ["商务", "口语", "B1"], dir: "跟读→角色扮演→实战", intro: "会议邮件谈判全场景 100 句。", toc: ["第一章 会议", "第二章 邮件", "第三章 谈判"], sents: [["Let us get started.", "A1", "我们开始吧。"], ["Could you clarify?", "B1", "能再说清楚点吗？"], ["Win-win matters.", "B1", "双赢很重要。"]] },
  { id: "b5", title: "雅思备考", author: "语学星教研", year: "2023", purpose: "雅思 6.5", tags: ["雅思", "备考", "B2"], dir: "听说读写四科并进", intro: "听说读写四科题型全覆盖。", toc: ["听力篇", "阅读篇", "写作篇", "口语篇"], sents: [["Time management is key.", "B1", "时间管理是关键。"], ["Cohesion improves writing.", "B2", "衔接提升写作。"]] },
  { id: "b6", title: "生活英语", author: "语学星教研", year: "2024", purpose: "出国不抓瞎", tags: ["生活", "口语", "A2"], dir: "场景闯关，一天一关", intro: "机场酒店医院全场景。", toc: ["机场篇", "酒店篇", "医院篇"], sents: [["Where is the exit?", "A1", "出口在哪？"], ["Check in, please.", "A1", "请办理入住。"]] },
];
const BK = { cur: null, lv: "B1", so: 0 };
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
V.shelf = () => `<div class="card"><h2>📚 书架 · 学员水平 ${BK.lv}（演示可切）</h2><p class="d">水平：${["A0", "A1", "A2", "B1", "B2"].map(l => `<button class="btn sm${BK.lv === l ? "" : " ghost"}" onclick="BK.lv='${l}';BK.so=0;render()">${l}</button>`).join(" ")}</p></div>` + BOOKS.map(b => `<div class="card"><b>${b.title}</b><p>${b.tags.map(t => `<span class="tag">${t}</span>`).join("")}</p><p class="d">${b.intro}</p><p class="d">方向：${b.dir}</p><button class="btn sm" onclick="BK.cur='${b.id}';BK.so=0;nav('#/book')">进书 →</button></div>`).join("") + `<div class="card"><p class="d">想按分类快速练题？</p><button class="btn sm ghost" onclick="nav('#/courses')">分类速览 →</button></div>`;
V.book = () => { const b = BOOKS.find(x => x.id === BK.cur) || BOOKS[0]; const all = b.sents.concat(POOL[b.id] || []); const fit = all.filter(s => LVN[s[1]] <= LVN[BK.lv]); const batch = fit.slice(BK.so, BK.so + 3); if (!batch.length) BK.so = 0; const show = batch.length ? batch : fit.slice(0, 3); const hard = HARD[b.id] || []; return `<div class="card"><b style="font-size:20px">${b.title}</b><p class="d">作者 ${b.author} · ${b.year} · 目的：${b.purpose}</p><p>${b.tags.map(t => `<span class="tag">${t}</span>`).join("")}</p><p class="d">简介：${b.intro}</p><p class="d">方向：${b.dir}</p></div><div class="card"><h2>📑 目录（点进正文）</h2>${b.toc.map((c, i) => `<button class="opt" onclick="BK.ch=${i};nav('#/chapter')">${i + 1}. ${c} ›</button>`).join("")}</div><div class="card"><h2>✨ 精彩句子（按 ${BK.lv} 及以下）</h2>${show.map(s => `<div class="card" style="margin:8px 0"><b>${s[0]}</b> <span class="tag">${s[1]}</span><p class="d">${s[2]} <button class="btn sm" onclick="speak('${s[0].replace(/'/g, "")}')">🔊</button></p></div>`).join("")}<button class="btn ghost" onclick="BK.so=(BK.so+3)%Math.max(fit.length,1);render()">换一批 ↻</button></div><div class="card"><h2>🔥 高难词汇 / 变形</h2>${hard.map(h => `<div class="card" style="margin:8px 0"><b>${h[0]}</b> <span class="meta">${h[1]}</span> <button class="btn sm" onclick="speak('${h[0]}')">🔊</button><p class="d">中文：${h[2]}</p><p class="d">变形拆分：${h[3]}</p></div>`).join("")}</div>`; };
function md(src) { return src.split("\n").map(line => { let l = line; if (/^### /.test(l)) return `<h4>${l.slice(4)}</h4>`; if (/^## /.test(l)) return `<h3>${l.slice(3)}</h3>`; if (/^# /.test(l)) return `<h2>${l.slice(2)}</h2>`; if (/^> /.test(l)) return `<blockquote>${l.slice(2)}</blockquote>`; if (/^!\[.*?\]\(.*?\)/.test(l)) { const m = l.match(/!\[(.*?)\]\((.*?)\)/); return `<figure><img src="${m[2]}" alt="${m[1]}" style="max-width:100%;border-radius:10px"><figcaption class="meta">${m[1]}</figcaption></figure>`; } if (/^[-*] /.test(l)) return `<li>${l.slice(2)}</li>`; if (/^\d+\. /.test(l)) return `<li>${l.replace(/^\d+\. /, "")}</li>`; if (/^```/.test(l)) return ""; l = l.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>").replace(/`(.+?)`/g, "<code>$1</code>"); return l.trim() ? `<p>${l}</p>` : ""; }).join("").replace(/(<li>.*?<\/li>)+/g, "<ul>$&</ul>"); }
const CHAP = {
  b1: ["# 第一章 高频 500\n\n**abandon** 永远排第一，因为它是四级最爱考的动词。\n\n> 记住：抛掉坏习惯，留下好分数。\n\n- abandon bad habits.\n- 抛掉坏习惯。\n\n![单词卡](https://picsum.photos/seed/abandon/400/200)\n\n## 为什么先学它\n\n出现频率 *极高*，`CET-4` 十年真题 9 次。", "# 第二章 核心 1500\n\n从 **ability** 到 **accuse**，能力词一网打尽。\n\n- ability 能力\n- accuse 指控\n\n继续加油。", "# 第三章 冲刺 1000\n\n考前 30 天刷完，`B1` 稳了。\n\n> 冲刺不熬夜，复习看错题本。"],
  b2: ["# 第一单元 字母音标\n\n**A a** 苹果 apple，**B b** 书 book。\n\n- 跟读三遍\n- 指认大小写\n\n![字母墙](https://picsum.photos/seed/abc/400/200)", "# 第二单元 问候告别\n\n**Good morning.** 早上好。\n\n> 见面先笑，再开口。", "# 第三单元 吃穿住行\n\n点餐、问路、买单三件套。"],
  b3: ["# 第一章 定语从句\n\n**who/which/that** 三兄弟，修饰名词不含糊。\n\n- The man *who* lives next door.\n- 住隔壁的男人。", "# 第二章 状语从句\n\n时间地点原因让步，一网打尽。", "# 第三章 综合实战\n\n十年真题，拆到主谓宾。"],
  b4: ["# 第一章 会议\n\n**Let's get started.** 我们开始吧。\n\n> 开会三件套：开场、转折、收尾。", "# 第二章 邮件\n\n附件用语：Please find attached.", "# 第三章 谈判\n\nWin-win matters. 双赢很重要。"],
  b5: ["# 听力篇\n\n先抓关键词，再听细节。", "# 阅读篇\n\n略读 + 精读两遍法。", "# 写作篇\n\n开头结尾模板背下来。", "# 口语篇\n\nPart 1 流利度优先。"],
  b6: ["# 机场篇\n\n**Where is the exit?** 出口在哪？\n\n![机场](https://picsum.photos/seed/airport/400/200)", "# 酒店篇\n\n**Check in, please.** 请办理入住。", "# 医院篇\n\n**I need help.** 我需要帮助。"],
};
V.chapter = () => { const b = BOOKS.find(x => x.id === BK.cur) || BOOKS[0]; const ch = (CHAP[b.id] || ["# 正文待补充"])[Math.min(BK.ch, (CHAP[b.id] || []).length - 1)]; return `<div class="card"><p class="d">${b.title} · ${b.toc[Math.min(BK.ch, b.toc.length - 1)]}</p><article>${md(ch)}</article></div><button class="btn ghost" onclick="goBack()">← 回目录</button>`; };
const WB4 = [["abandon", "/əˈbændən/", "抛弃"], ["ability", "/əˈbɪləti/", "能力"], ["absent", "/ˈæbsənt/", "缺席的"], ["absolute", "/ˈæbsəluːt/", "绝对的"], ["absorb", "/əbˈsɔːb/", "吸收"], ["abstract", "/ˈæbstrækt/", "抽象的"], ["abundant", "/əˈbʌndənt/", "丰富的"], ["abuse", "/əˈbjuːz/", "滥用"], ["academy", "/əˈkædəmi/", "学院"], ["accelerate", "/əkˈseləreɪt/", "加速"], ["accent", "/ˈæksənt/", "口音"], ["accept", "/əkˈsept/", "接受"], ["access", "/ˈækses/", "进入"], ["accommodate", "/əˈkɒmədeɪt/", "容纳"], ["accompany", "/əˈkʌmpəni/", "陪伴"], ["accomplish", "/əˈkɒmplɪʃ/", "完成"], ["account", "/əˈkaʊnt/", "账户"], ["accumulate", "/əˈkjuːmjəleɪt/", "积累"], ["accuracy", "/ˈækjərəsi/", "准确"], ["accuse", "/əˈkjuːz/", "指控"]];
const WB6 = [["abolish", "/əˈbɒlɪʃ/", "废除"], ["absurd", "/əbˈsɜːd/", "荒谬的"], ["abundance", "/əˈbʌndəns/", "丰富"], ["acclaim", "/əˈkleɪm/", "赞誉"], ["acquaint", "/əˈkweɪnt/", "使熟悉"], ["adhere", "/ədˈhɪə/", "坚持"], ["adjacent", "/əˈdʒeɪsənt/", "邻近的"], ["adjoin", "/əˈdʒɔɪn/", "毗连"], ["administer", "/ədˈmɪnɪstə/", "管理"], ["admirable", "/ˈædmərəbl/", "令人钦佩的"], ["admission", "/ədˈmɪʃən/", "入学许可"], ["adolescent", "/ˌædəˈlesənt/", "青少年"], ["adore", "/əˈdɔː/", "热爱"], ["adorn", "/əˈdɔːn/", "装饰"], ["adverse", "/ˈædvɜːs/", "不利的"], ["advertise", "/ˈædvətaɪz/", "做广告"], ["advocate", "/ˈædvəkeɪt/", "提倡"], ["aesthetic", "/iːsˈθetɪk/", "美学的"], ["affiliate", "/əˈfɪlieɪt/", "附属"], ["affirm", "/əˈfɜːm/", "断言"]];
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
  return { infl: [w, w + "s", w + "ed", w + "ing"], sent: ["I know " + w + ".", "We use " + w + " every day.", w + " is useful."], slang: "（该词俚语待补充）", story: "（词源待补充，先记形和音）" };
}
function wset(book) { DR.book = book; DR.i = 0; DR.known = 0; DR.show = false; DR.quizPick = -1; DR.quizDone = false; nav("#/drill"); }
function wlist() { return DR.book === "CET4" ? WB4 : WB6; }
function dreveal() { DR.show = true; render(); }
function dzhan(know) { if (know) DR.known++; DR.i++; DR.show = false; DR.quizPick = -1; DR.quizDone = false; if (DR.i >= wlist().length) { toast(`本轮完：斩 ${DR.known}/${wlist().length}`); nav("#/wordbook"); } else render(); }
function drDetail() { const L = wlist(); const w = L[Math.min(DR.i, L.length - 1)][0]; VC.w = w; VC.quizPick = -1; VC.q = ""; nav("#/vocab"); }
const TCH = { on: false, sec: 60, right: 0, wrong: 0, timer: 0, list: [], best: null };
function tchStart() { const L = wlist(); const pool = L.map((x, i) => i); for (let k = pool.length - 1; k > 0; k--) { const j = (DR.i + k * 3) % (k + 1); const t = pool[k]; pool[k] = pool[j]; pool[j] = t; } TCH.list = pool.slice(0, Math.min(10, pool.length)); TCH.on = true; TCH.sec = 60; TCH.right = 0; TCH.wrong = 0; TCH.pos = 0; TCH.pick = -1; clearInterval(TCH.timer); TCH.timer = setInterval(() => { TCH.sec--; if (TCH.sec <= 0) tchFinish(); else { const el = document.getElementById("tchsec"); if (el) el.textContent = TCH.sec; } }, 1000); render(); }
function tchOpts() { const L = wlist(); const idx = TCH.list[Math.min(TCH.pos, TCH.list.length - 1)]; const w = L[idx]; const others = L.filter((_, j) => j !== idx).slice(0, 12); const o = [others[(idx + 1) % others.length], others[(idx + 5) % others.length], others[(idx + 9) % others.length]].map(x => ({ zh: x[2], ok: false })).concat([{ zh: w[2], ok: true }]); const h = idx * 5 + TCH.pos; for (let k = o.length - 1; k > 0; k--) { const j = (h + k * 3) % (k + 1); const t = o[k]; o[k] = o[j]; o[j] = t; } return { w, o }; }
function tchPick(k) { if (!TCH.on) return; TCH.pick = k; const { w, o } = tchOpts(); if (o[k].ok) TCH.right++; else { TCH.wrong++; if (!S.mistakes.some(m => m.t === w[0])) S.mistakes.push({ t: w[0], why: "定位：词汇待补", kind: "word" }); } TCH.pos++; TCH.pick = -1; if (TCH.pos >= TCH.list.length) tchFinish(); else render(); }
function tchFinish() { if (!TCH.on) return; clearInterval(TCH.timer); TCH.on = false; const score = TCH.right * 10 - TCH.wrong * 2; if (!TCH.best || score > TCH.best.score) TCH.best = { score, right: TCH.right, wrong: TCH.wrong }; render(); toast("限时结束：对 " + TCH.right + " / 错 " + TCH.wrong + "（演示，不上榜）"); }
const PIC = { abandon: "🗑️", ability: "💪", absent: "🏫", absolute: "💯", absorb: "🧽", abstract: "🎨", abundant: "🌾", abuse: "🚫", academy: "🏛️", accelerate: "🚀", accent: "🗣️", accept: "🤝", access: "🔑", accommodate: "🏠", accompany: "👥", accomplish: "🏆", account: "👤", accumulate: "📚", accuracy: "🎯", accuse: "⚖️", abolish: "🔨", absurd: "🤪", abundance: "🌾", acclaim: "👏", acquaint: "🤝", adhere: "🧲", adjacent: "🏘️", adjoin: "🧱", administer: "💼", admirable: "⭐", admission: "🎫", adolescent: "🧑", adore: "❤️", adorn: "💎", adverse: "⛈️", advertise: "📢", advocate: "📣", aesthetic: "🌸", affiliate: "🔗", affirm: "✅" };
function wpic(w) { return PIC[w] || "🔤"; }
function wsplit(w) { const m = w.match(/^(.{2,4})(.+?)(ing|ed|tion|sion|ance|ence|ment|ness|ly|ous|ive|al|er|or|ist)?$/); if (!m) return [w]; return [m[1], m[2], m[3] || ""].filter(Boolean); }
function wquiz() { const L = wlist(), idx = Math.min(DR.i, L.length - 1), w = L[idx]; const others = L.filter((_, j) => j !== idx).slice(0, 3); const opts = [...others.map(o => ({ zh: o[2], w: o[0], ok: false })), { zh: w[2], w: w[0], ok: true }]; const h = DR.i * 7 + w[0].length; for (let k = opts.length - 1; k > 0; k--) { const j = (h + k * 3) % (k + 1); const t = opts[k]; opts[k] = opts[j]; opts[j] = t; } return { w, opts }; }
function qpick(k) { DR.quizPick = k; render(); }
V.drill = () => {
  const L = wlist();
  const tabs = `<p class="d">模式：<button class="btn sm${DR.mode === "zhan" ? "" : " ghost"}" onclick="DR.mode='zhan';DR.show=false;render()">斩词</button> <button class="btn sm${DR.mode === "quiz" ? "" : " ghost"}" onclick="DR.mode='quiz';DR.quizPick=-1;DR.quizDone=false;render()">选项</button> <button class="btn sm${DR.mode === "fam" ? "" : " ghost"}" onclick="DR.mode='fam';render()">高效</button> <button class="btn sm${DR.mode === "time" ? "" : " ghost"}" onclick="DR.mode='time';render()">⏱️ 限时</button> <button class="btn sm ghost" onclick="drDetail()">看详情 →</button></p>`;
  if (DR.mode === "time") {
    if (!TCH.on && !TCH.best && TCH.right === 0 && TCH.wrong === 0) return `<div class="meta">${DR.book === "CET4" ? "四级" : "六级"} · 限时 60 秒 · 对+10/错-2 · 错进错题（演示，不上榜）</div>${tabs}<div class="card empty"><b>⏱️ 限时挑战</b><p class="d">60 秒能对几个？错的自动进错题本</p><button class="btn" onclick="tchStart()">开始 →</button></div>`;
    if (!TCH.on && (TCH.right > 0 || TCH.wrong > 0 || TCH.best)) { const b = TCH.best; return `<div class="meta">${DR.book === "CET4" ? "四级" : "六级"} · 限时结算（演示）</div>${tabs}<div class="card" style="text-align:center"><b style="font-size:40px">${TCH.right * 10 - TCH.wrong * 2}</b><p class="d">对 ${TCH.right} · 错 ${TCH.wrong} · 错题已进本</p>${b ? `<p class="d">个人最佳：${b.score}（对 ${b.right}/错 ${b.wrong}）</p>` : ``}<button class="btn" onclick="tchStart()">再来一轮 →</button> <button class="btn ghost" onclick="nav('#/mistakes')">看错题 →</button></div>`; }
    const { w, o } = tchOpts();
    return `<div class="meta">${DR.book === "CET4" ? "四级" : "六级"} · 剩 <b id="tchsec">${TCH.sec}</b>s · 对 ${TCH.right} 错 ${TCH.wrong} · 第 ${Math.min(TCH.pos + 1, TCH.list.length)}/${TCH.list.length}</div>${tabs}<div class="card" style="text-align:center"><b style="font-size:34px">${w[0]}</b><p class="d">${w[1]}</p></div>` + o.map((x, k) => `<button class="opt" onclick="tchPick(${k})">${wpic(w[0])} ${x.zh}</button>`).join("");
  }
  if (DR.mode === "fam") {
    const L = wlist(), w = L[Math.min(DR.i, L.length - 1)], f = famOf(w[0]);
    return `<div class="meta">${DR.book === "CET4" ? "四级" : "六级"} · 第 ${Math.min(DR.i + 1, L.length)}/${L.length} · 高效学一词顶十词</div>${tabs}<div class="card"><b style="font-size:32px">${w[0]}</b> <span class="meta">${w[1]}</span> <button class="btn sm" onclick="speak('${w[0]}')">🔊</button><p style="font-size:20px"><b>${w[2]}</b></p></div><div class="card"><h2>🔀 变形全家</h2>${f.infl.map(x => `<span class="tag">${x}</span>`).join("")}</div><div class="card"><h2>🧩 组句</h2>${f.sent.map((s, k) => `<p class="d">${k + 1}. ${s} <button class="btn sm" onclick="speak('${s.replace(/'/g, "")}')">🔊</button></p>`).join("")}</div><div class="card"><h2>😎 俚语</h2><p>${f.slang}</p></div><div class="card"><h2>📜 由来</h2><p class="d">${f.story}</p></div><button class="btn" onclick="dzhan(true)">学会了，下一词 →</button> <button class="btn ghost" onclick="dzhan(false)">先收着 →</button>`;
  }
  if (DR.mode === "quiz") {
    const { w, opts } = wquiz();
    let mid = "";
    if (DR.quizPick >= 0) {
      const right = opts[DR.quizPick].ok;
      if (right) { mid = `<div class="fb ok">✓ 对了</div><button class="btn" onclick="dzhan(true)">下一词 →</button>`; }
      else {
        const parts = wsplit(w[0]);
        mid = `<div class="fb no">! 选错了，进复习</div><div class="card" style="margin:10px 0 0"><b>🔍 ${w[0]} 拆开看</b><p style="font-size:22px">${parts.join(" + ")}</p><p class="d">读音：${w[1]} · 中文：${w[2]}</p><p class="d">点读跟三遍，记住形和音的对应（演示拆分）。</p><button class="btn sm" onclick="speak('${w[0]}')">🔊 跟读</button> <button class="btn sm ghost" onclick="dzhan(false)">记下了，下一词 →</button></div>`;
        if (!S.mistakes.some(m => m.t === w[0])) S.mistakes.push({ t: w[0], why: "定位：词汇待补", kind: "word" });
      }
    }
    return `<div class="meta">${DR.book === "CET4" ? "四级" : "六级"} · 第 ${Math.min(DR.i + 1, L.length)}/${L.length} · 已斩 ${DR.known}</div>${tabs}<div class="card" style="text-align:center"><b style="font-size:34px">${w[0]}</b><p class="d">${w[1]} <button class="btn sm" onclick="speak('${w[0]}')">🔊</button></p></div>` + opts.map((o, k) => `<button class="opt" onclick="qpick(${k})">${wpic(o.w)} ${o.zh}</button>`).join("") + mid;
  }
  const w = L[Math.min(DR.i, L.length - 1)];
  return `<div class="meta">${DR.book === "CET4" ? "四级" : "六级"} · 第 ${Math.min(DR.i + 1, L.length)}/${L.length} · 已斩 ${DR.known}</div>${tabs}<div class="card" style="text-align:center;padding:34px 18px"><b style="font-size:38px">${w[0]}</b><p class="d">${w[1]}</p>${DR.show ? `<p style="font-size:20px"><b>${w[2]}</b></p><button class="btn sm ghost" onclick="speak('${w[0]}')">🔊 读</button>` : `<button class="btn sm ghost" onclick="dreveal()">点看中文</button>`}</div>${DR.show ? `<div class="row" style="display:flex;gap:8px"><button class="btn ghost" style="flex:1" onclick="dzhan(false)">收 ✋</button><button class="btn" style="flex:1" onclick="dzhan(true)">斩 ⚔️</button></div>` : ``}`;
};
V.wordbook = () => `<div class="card"><h2>📕 单词本</h2><p class="d">选一本，直接开刷（斩＝会，收＝不会进复习）</p><button class="opt" onclick="wset('CET4')"><b>四级词汇</b> · 20 词 ›</button><button class="opt" onclick="wset('CET6')"><b>六级词汇</b> · 20 词 ›</button></div>`;
const PHG = [
  { t: "单元音 · 12", items: [["iː", "sheep"], ["ɪ", "ship"], ["e", "bed"], ["æ", "cat"], ["ɑː", "car"], ["ɒ", "hot"], ["ɔː", "door"], ["ʊ", "book"], ["uː", "food"], ["ʌ", "cup"], ["ɜː", "bird"], ["ə", "about"]] },
  { t: "双元音 · 8", items: [["eɪ", "day"], ["aɪ", "my"], ["ɔɪ", "boy"], ["əʊ", "go"], ["aʊ", "how"], ["ɪə", "here"], ["eə", "there"], ["ʊə", "tour"]] },
  { t: "爆破音 · 6", items: [["p", "pen"], ["b", "book"], ["t", "tea"], ["d", "dog"], ["k", "key"], ["g", "go"]] },
  { t: "摩擦音 · 9", items: [["f", "fish"], ["v", "van"], ["θ", "think"], ["ð", "this"], ["s", "sun"], ["z", "zoo"], ["ʃ", "ship"], ["ʒ", "vision"], ["h", "hat"]] },
  { t: "鼻/边/滑音 · 7", items: [["m", "man"], ["n", "no"], ["ŋ", "sing"], ["l", "look"], ["r", "red"], ["j", "yes"], ["w", "we"]] },
  { t: "破擦音 · 6", items: [["tʃ", "chair"], ["dʒ", "jump"], ["tr", "tree"], ["dr", "dog"], ["ts", "cats"], ["dz", "beds"]] },
];
const PHO = { open: 0 };
V.phonics = () => `<div class="card" style="background:#fbfaff"><h2>🔤 音标</h2><p class="d">点符号听发音，分组慢慢来</p>${PHG.map((g, i) => `<div class="card" style="margin:10px 0;background:#fff"><button class="opt" onclick="PHO.open=${i};render()"><b>${g.t}</b> ${PHO.open === i ? "▾" : "▸"}</button>${PHO.open === i ? `<div style="margin-top:10px">${g.items.map(([s, w]) => `<button class="btn sm" style="margin:4px;padding:12px 14px" onclick="speak('${w}')">${s}<br><span class="meta">${w}</span></button>`).join(" ")}</div>` : ``}</div>`).join("")}</div><div class="card" style="background:#fbfaff"><h2>👂 最小对立对辨音</h2>${PHQ.map(([a, b]) => `<p class="d"><button class="btn sm" onclick="speak('${a}')">${a} 🔊</button> <button class="btn sm" onclick="speak('${b}')">${b} 🔊</button></p>`).join("")}<p class="d">听两遍，凭感觉选（演示不判分）</p></div>`;
V.alphabet = () => `<div class="card"><h2>🔠 字母 · 26</h2><p class="d">点字母听发音，看大小写和例词；例词待补的不编，先标出来</p>${ABC.map(c => `<button class="btn sm" onclick="alPick('${c}')">${c}</button>`).join(" ")}</div><div class="card" id="alD"><p class="d">点上面任意字母 👆</p></div><div class="card"><h2>🔗 自然拼读</h2><p class="d">c-a-t → cat（演示：点听整词）</p><button class="btn sm" onclick="speak('cat')">🔊 cat</button> <button class="btn sm" onclick="speak('dog')">🔊 dog</button> <button class="btn sm" onclick="toast('更多拼读课待补充（演示）')">更多 →</button></div>`;
const AL_EX = { A: "apple 苹果", B: "book 书", C: "cat 猫", D: "dog 狗", E: "egg 鸡蛋", F: "fish 鱼", G: "go 去", H: "hat 帽子", I: "ice 冰", J: "jump 跳", K: "key 钥匙", L: "look 看", M: "man 男人", N: "no 不", O: "open 打开", P: "pen 钢笔", Q: "queen 王后", R: "red 红色", S: "sun 太阳", T: "tea 茶", U: "up 向上", V: "van 厢车", W: "we 我们", X: "box 盒子", Y: "yes 是", Z: "zoo 动物园" };
function alPick(c) { speak(c); const el = document.getElementById("alD"); if (el) el.innerHTML = '<b>' + c + ' ' + c.toLowerCase() + '</b> · 例：' + (AL_EX[c] || '待补'); }

/* ---------- 动作 ---------- */
function doLogin() { S.user = document.getElementById("li").value || "t-learner-01@test.invalid"; S.gate = S.gate === "NONE" ? "PENDING" : S.gate; toast("登录成功"); nav(S.gate === "PASS" ? "#/home" : "#/gate"); }
function doRegister() { const id = document.getElementById("ri").value; if (!id || !id.trim()) { toast("先填个账号"); return; } const pw = document.getElementById("rp").value || ""; if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) { toast("密码≥8 位且含字母+数字"); return; } S.user = id; S.gate = "PENDING"; toast("注册成功（201），先过身份确认"); nav("#/gate"); }
function doGate() { const ag = document.getElementById("cf"); if (!document.getElementById("by").value || !ag.checked) { toast("请填写年份并确认已满 18 岁"); return; } S.gate = "PASS"; toast("身份已确认（演示）"); }
function doConsents() { const a = [...document.querySelectorAll(".ag")]; if (!a.every(x => x.checked)) { toast("三项都要签"); return; } toast("三项已签署"); nav("#/onboard"); }
function doGoal() { S.goal = document.getElementById("g").selectedOptions[0].text; S.quiz = { i: 0, score: 0, sel: null, done: false }; toast("目标已保存"); nav("#/placement"); }
function pick(k) { S.quiz.sel = k; document.querySelectorAll("#qo .opt").forEach((x, j) => x.classList.toggle("sel", j === k)); }
function qSubmit() { const q = BANK[S.quiz.i]; if (S.quiz.sel == null) { toast("先选一个"); return; } const f = document.getElementById("qfb"), ok = S.quiz.sel === q.a; if (ok) S.quiz.score++; else S.mistakes.push({ t: q.s, why: "定位：" + q.dim + "待补", kind: /^[A-Za-z]+$/.test(q.s.split(" ")[0]) && q.s.split(" ").length <= 2 ? "word" : "sentence" }); f.textContent = ok ? "✓ 对了" : "! 记下了，进错题本，变式稍后见"; f.className = "fb " + (ok ? "ok" : "no"); }
function qNext() { if (S.quiz.i < BANK.length - 1) { S.quiz.i++; render(); } else { S.quiz.done = true; nav("#/report"); } }
let PSEL = null;
const A = { l1: false, l2: false };
function paintRev() { const el = document.getElementById("revst"); if (el) el.textContent = (A.l1 ? "L1 已过" : "L1 待审") + " · " + (A.l2 ? "L2 已过/ACTIVE" : "L2 待审"); }
const AX = { c: false, f: 0, m: true, fo: false, v: false };
function a11yApply() {
  document.body.style.filter = AX.c ? "contrast(1.4)" : "";
  document.body.style.fontSize = [15, 17, 19][AX.f] + "px";
  const st = document.getElementById("a11y-focus-style");
  if (AX.fo && !st) { document.head.insertAdjacentHTML("beforeend", '<style id="a11y-focus-style">button:focus,.opt:focus,input:focus,select:focus,a:focus{outline:3px solid #5b2fd6 !important;outline-offset:2px}</style>'); }
  if (!AX.fo && st) st.remove();
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
  if (k === "contrast") { AX.c = !AX.c; toast(AX.c ? "高对比已开（演示）" : "高对比已关"); }
  if (k === "font") { AX.f = (AX.f + 1) % 3; toast("字体：" + ["标准", "大", "特大"][AX.f] + "（演示）"); }
  if (k === "motion") { AX.m = !AX.m; toast(AX.m ? "动效已开" : "动效已关：保存/完成/出错仍有文字条，不靠动画（演示）"); }
  if (k === "focus") { AX.fo = !AX.fo; toast(AX.fo ? "焦点框已加强（演示）" : "焦点框恢复默认"); }
  if (k === "voice") { AX.v = !AX.v; if (!AX.v) { try { speechSynthesis.cancel(); } catch (e) { } } toast(AX.v ? "朗读已开，点“播报这段”试（演示）" : "朗读已关"); }
  a11yApply();
}
function a11yReset() { AX.c = false; AX.f = 0; AX.m = true; AX.fo = false; AX.v = false; try { speechSynthesis.cancel(); } catch (e) { } a11yApply(); toast("已恢复默认（演示）"); render(); }
function ppick(k, el) { PSEL = k; document.querySelectorAll("#po .opt").forEach((x, j) => x.classList.toggle("sel", j === k)); }
function psubmit() { if (PSEL == null) { toast("先选一个"); return; } const f = document.getElementById("pfb"), ok = PSEL === 1; if (!ok) S.mistakes.push({ t: "There ___ two books on the desk.", why: "定位：语法待补", kind: "sentence" }); f.textContent = ok ? "✓ FULL：主语复数用 are" : "! ZERO：已进错题本"; f.className = "fb " + (ok ? "ok" : "no"); }
function sres(v) { document.getElementById("sr").innerHTML = v ? `<button class="opt" onclick="nav('#/courses')">📖 ${v}相关课程 ›</button><button class="opt" onclick="toast('帮助：重置密码走我的→设置')">❓ ${v}相关帮助 ›</button>` : ""; }

/* ---------- 路由 ---------- */
const AUTH_FREE = ["login", "register", "reset"];
function render() {
  let r = (location.hash || "#/home").replace("#/", "");
  if (!V[r]) r = "home";
  if (!AUTH_FREE.includes(r) && !S.user) r = "login";
  if (["placement", "report"].includes(r) && S.gate !== "PASS" && !S.user) r = "login";
  document.getElementById("title").textContent = TITLES[r] || "语学星";
  document.getElementById("bk").style.visibility = (["login", "home"].includes(r)) ? "hidden" : "visible";
  document.getElementById("tabs").style.display = TABS.includes(r) ? "flex" : "none";
  document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.t === r));
  document.getElementById("view").innerHTML = V[r]();
  if (r === "practice" && typeof stemWords === "function") stemWords();
  if (r === "weekly" && typeof wcalPaint === "function") wcalPaint();
  if (r === "avatar" && typeof stage3d === "function") stage3d();
  if (r !== "avatar" && typeof T3 !== "undefined" && T3 && T3.raf) { cancelAnimationFrame(T3.raf); T3.raf = 0; }
  document.getElementById("view").scrollTop = 0;
  if (r === "placement" && S.quiz.done) { S.quiz.done = false; }
}
window.addEventListener("hashchange", render);
render();
