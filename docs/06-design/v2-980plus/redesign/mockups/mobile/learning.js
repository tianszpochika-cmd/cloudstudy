/* 六类学习能力：原创静态题、本机事实与页面。仅原型，不代表正式学习规则。 */
const LM = {
  version: 1, offset: 0, day: "", serial: 0,
  plan: { goal: "college", variant: "cet4", minutes: 15, days: [1, 2, 3, 4, 5, 6, 0] },
  records: [], deferred: [], chapters: {}, savedCourses: [], writes: [],
  writing: { text: "", revision: 0, phase: "draft", feedback: "", self: "", taskId: null },
  resultId: null, recapDate: null, discover: { status: "all", goal: "all", level: "all" },
  wordFilter: "all", wordQuery: "", planDraft: null, planPreview: null, wordTask: null,
};
const LEARNING_TITLES = { recap: "今日回顾", history: "学习记录", result: "学习结果", plan: "学习计划", calendar: "学习日历", reviewqueue: "复习安排", words: "词汇学习", collections: "收藏与笔记" };
Object.assign(TITLES, LEARNING_TITLES, { courses: "发现课程", today: "学习", weekly: "本周回顾" });
const LGOALS = { foundation: "基础英语", college: "大学英语", graduate: "考研英语", workplace: "职场英语" };
const LLEVELS = { foundation: "A1", college: "B1", graduate: "B2", workplace: "B1" };
const LDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];
BOOKS.push({ id: "b7", title: "考研阅读 · 研究与生活", intro: "原创短文：从研究材料中寻找证据、识别观点与推断。", toc: ["研究中的细节", "观点与证据", "总结与复盘"], tags: ["考研", "B2"], sents: [] });
CHAP.b7 = ["# 研究中的细节\n\nA small study compared two groups of adult learners. One group reviewed words every evening, while the other reviewed only once a week. After a month, the first group remembered more words. The researchers noted that regular practice may help, but the study was too small to explain every difference.\n\n**阅读提示**：把研究结果和研究限制分别记下来，不把 may 理解成一定。", "# 观点与证据\n\nWhen reading an argument, ask what evidence supports the claim. A personal story can explain an idea, but it does not always show that the idea works for everyone. Compare examples and look for the limits of each conclusion.\n\n**练习**：在笔记中写出一个观点和支持它的一条证据。", "# 总结与复盘\n\nA useful summary keeps the main idea and its limits. Write one sentence about the finding, then one sentence about what remains uncertain. Read your summary again and check it against the original text.\n\n**练习**：用两句英文概括上一节，不增加原文没有的结论。"];
function lh(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function lmId(prefix) { return prefix + "-" + (++LM.serial); }
function lmDate(shift = 0) { const d = new Date(); d.setDate(d.getDate() + LM.offset + shift); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"); }
function lmAddDate(date, shift) { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + shift); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"); }
function lmGoalLabel(p = LM.plan) { return LGOALS[p.goal] + (p.goal === "college" ? (p.variant === "cet6" ? " · 六级" : " · 四级") : ""); }
function lmLevel() { return S.quiz.answers?.some(x => x && !x.skip) ? repLevel() + "（样例测评）" : LLEVELS[LM.plan.goal] + "（起步参考）"; }
function lmLastRead() {
  const r = S.lastRead || {}, b = BOOKS.find(x => x.id === r.bookId) || BOOKS.find(x => x.title === r.book) || BOOKS[0];
  const chapter = Number.isInteger(r.chapter) ? r.chapter : Math.max(0, b.toc.indexOf(r.ch));
  return { bookId: b.id, chapter: Math.min(chapter, b.toc.length - 1), book: b.title, ch: b.toc[Math.min(chapter, b.toc.length - 1)] };
}
function lmNormalize() {
  LM.plan.days ||= [1, 2, 3, 4, 5, 6, 0];
  if (!LM.day) {
    const old = S.goal || "";
    LM.plan.goal = old.includes("零基础") ? "foundation" : old.includes("商务") ? "workplace" : old.includes("考研") ? "graduate" : "college";
    LM.plan.variant = old.includes("六级") ? "cet6" : "cet4"; LM.plan.minutes = S.minutes || 15; LM.day = lmDate();
    S.today.forEach(t => { t.date = LM.day; if (t.done) t.recordId = lmRecord({ kind: "practice", title: t.t, taskId: t.id, right: t.right, total: t.total, estimated: t.min, answers: [], imported: true }).id; });
  }
  S.lastRead = lmLastRead();
  S.today.forEach(t => { t.key ||= t.group ? (GROUPS[t.group]?.kind === "reading" ? "readquiz" : "core") : t.kind; t.goal ||= S.goal || lmGoalLabel(); if (t.done && !t.recordId) t.recordId = LM.records.find(r => r.taskId === t.id)?.id; });
  S.mistakes.forEach(m => {
    m.st ||= "todo";
    if (!m.id) m.id = lmId("mistake");
    if (m.st === "done") { m.st = "wait1"; m.repaired = lmDate(); m.due = lmAddDate(lmDate(), 1); m.via = "旧版自评（待验证）"; }
    m.skill ||= lmSkill(m.t); m.created ||= lmDate();
  });
  SRSQ.forEach(q => { if (!q.due) q.due = lmAddDate(lmDate(), q.done ? 1 : 0); q.source ||= "词汇样例"; q.interval ||= 0; });
  if (PR.phase === "submitting") { PR.phase = "answer"; PR.fb = { cls: "wa", msg: "上次提交被中断，选择已保存，可重试。" }; }
  PR.answers ||= []; PR.answers.forEach((a, i) => { if (a && prGroup()?.items[i]) Object.assign(prGroup().items[i], { _ok: a.ok, _sel: a.sel }); });
  if (!SRS.attempt && SRS.phase !== "run") SRS.phase = "idle";
  SRS.operations ||= (SRS.done || 0) + (SRS.again || 0); SRS.results ||= [];
  if (SRS.phase === "run" && !SRS.attempt) { SRS.attempt = lmId("review"); SRS.imported = true; }
  if (LM.writing.phase === "submitting") { LM.writing.phase = "draft"; LM.writing.feedback = "上次提交被中断，草稿已保留。"; }
  lmEnsureDay();
  S.goal = lmGoalLabel(); S.minutes = LM.plan.minutes;
}
function lmRecord(value) {
  if (value.key && LM.records.some(r => r.key === value.key)) return LM.records.find(r => r.key === value.key);
  const r = { id: lmId("record"), date: lmDate(), time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }), ...value };
  LM.records.push(r); return r;
}
function lmStats(date = lmDate()) {
  const rows = LM.records.filter(r => r.date === date), counted = rows.filter(r => !r.imported);
  const questions = counted.filter(r => ["practice", "repair"].includes(r.kind));
  return { rows, count: rows.length, right: questions.reduce((n, r) => n + (r.right || 0), 0), total: questions.reduce((n, r) => n + (r.total || 0), 0), xp: counted.reduce((n, r) => n + 10 + (["practice", "repair"].includes(r.kind) ? (r.right || 0) * 2 : 0), 0) };
}
function lmEnsureDay() {
  if (LM.day === lmDate()) return;
  S.today.filter(t => !t.done).forEach(t => lmStoreDeferred(t, "前一学习日未完成"));
  LM.day = lmDate(); S.today = []; PR.taskId = null; SRS.phase = "idle";
  if (S.plan) lmApplyPlan(LM.plan, "keep");
}
function lmStoreDeferred(t, reason) { if (LM.deferred.some(x => x.id === t.id)) return; LM.deferred.push({ ...t, reason, resume: PR.taskId === t.id ? JSON.parse(JSON.stringify(PR)) : null, wordState: LM.wordTask === t.id ? { seen: JSON.parse(JSON.stringify(LM.wordSeen || [])), book: DR.book, i: DR.i, known: DR.known } : null }); }
function lmNewGroup(title, kind, items, passage = "") { return { title, kind, items, passage }; }
Object.assign(GROUPS, {
  foundation: lmNewGroup("基础 · 日常表达", "grammar", [
    { s: "I ___ a student.", o: ["am", "is", "are"], a: 0, why: "I 与 am 搭配。", skill: "be" },
    { s: "We ___ friends.", o: ["am", "is", "are"], a: 2, why: "We 是复数主语，使用 are。", skill: "be" }]),
  graduate: lmNewGroup("考研 · 句子结构", "grammar", [
    { s: "The student ___ won the prize thanked her teacher.", o: ["who", "where", "when"], a: 0, why: "关系代词 who 指代人并作主语。", skill: "relative" },
    { s: "Hardly ___ he arrived when the meeting began.", o: ["has", "had", "was"], a: 1, why: "Hardly 置首，过去完成时倒装用 had。", skill: "inversion" }]),
  workplace: lmNewGroup("职场 · 邮件表达", "grammar", [
    { s: "Please find the report ___.", o: ["attached", "attaching", "attach"], a: 0, why: "attached 表示已附上的文件。", skill: "attached" },
    { s: "Could you ___ the meeting time?", o: ["confirm", "confirmed", "confirming"], a: 0, why: "情态动词 could 后用动词原形。", skill: "modal" }]),
  readbasic: lmNewGroup("基础阅读 · 一天的生活", "reading", [
    { s: "Where does May study?", o: ["At home", "At school", "At a hotel"], a: 1, why: "文中说 May studies at school。", skill: "reading-may" },
    { s: "When does May read?", o: ["In the morning", "At noon", "In the evening"], a: 2, why: "文中说 She reads in the evening。", skill: "reading-may" }], "May studies at school. She walks to school with her friend. She reads in the evening."),
  readwork: lmNewGroup("职场阅读 · 会议通知", "reading", [
    { s: "When does the meeting start?", o: ["9:00", "10:00", "11:00"], a: 1, why: "通知明确说 starts at 10:00。", skill: "reading-meeting" },
    { s: "What should people bring?", o: ["A report", "A ticket", "A map"], a: 0, why: "通知要求 bring your report。", skill: "reading-meeting" }], "Our team meeting starts at 10:00 on Friday. Please bring your report. We will discuss the next project."),
  readgraduate: lmNewGroup("考研阅读 · 研究结论", "reading", [
    { s: "Which group remembered more words?", o: ["Daily review", "Weekly review", "Neither group"], a: 0, why: "文中指出每日复习组记住了更多词。", skill: "reading-research" },
    { s: "What limits the conclusion?", o: ["The topic", "The small sample", "The long words"], a: 1, why: "研究样本太小，不能解释所有差异。", skill: "reading-research" }], "A study compared daily and weekly word review. The daily group remembered more words after a month. However, the sample was small, so the researchers did not claim the same result for every learner."),
});
GROUPS.g1.items[0].skill = "there"; GROUPS.g1.items[1].skill = "third"; GROUPS.g1.items[2].skill = "there";
GROUPS.r1.items.forEach((it, i) => it.skill = "reading-li-" + i);
function lmTemplate(p) {
  const group = p.goal === "college" ? (p.variant === "cet6" ? "graduate" : "g1") : p.goal;
  const read = p.goal === "foundation" ? "readbasic" : p.goal === "workplace" ? "readwork" : p.goal === "graduate" || p.variant === "cet6" ? "readgraduate" : "r1";
  const book = p.goal === "foundation" ? "b2" : p.goal === "workplace" ? "b4" : p.goal === "graduate" ? "b7" : p.variant === "cet6" ? "b3" : "b1";
  const list = [{ key: "core", group, t: GROUPS[group].title, min: 5, kind: "grammar" }];
  if (p.minutes >= 15) list.push({ key: "readquiz", group: read, t: GROUPS[read].title, min: 8, kind: "reading" });
  if (p.minutes >= 30) list.push({ key: "write", t: "写作 · 给朋友的一封信", min: 10, kind: "writing" }, { key: "words", t: "词汇 · 回忆 3 个词", min: 5, kind: "words" });
  if (p.minutes >= 45) {
    const b = BOOKS.find(b => b.id === book), ch = b.toc.findIndex((_, i) => !LM.chapters[book + ":" + i]?.done);
    if (ch >= 0) list.push({ key: "chapter", t: "阅读 · 完成一个章节", min: 10, kind: "chapter", book, ch });
    if (lmReviewDue().length) list.push({ key: "review", t: "复习 · 本轮回忆", min: 5, kind: "review" });
  }
  return list;
}
function lmPlanProjection(p, policy = "keep") {
  const done = S.today.filter(t => t.done), active = S.today.filter(t => !t.done && (t.started || PR.taskId === t.id || LM.writing.taskId === t.id || LM.wordTask === t.id));
  const pinned = done.concat(policy === "keep" ? active : []), budget = Math.max(0, p.minutes - pinned.reduce((n, t) => n + t.min, 0));
  const isStudy = p.days.includes(new Date(lmDate() + "T12:00:00").getDay()); let room = budget;
  const planned = isStudy ? lmTemplate(p).filter(t => !pinned.some(x => x.key === t.key)).filter(t => { if (t.min > room) return false; room -= t.min; return true; }) : [];
  const removed = S.today.filter(t => !pinned.includes(t));
  return { pinned, planned, removed, active, used: pinned.reduce((n, t) => n + t.min, 0) + planned.reduce((n, t) => n + t.min, 0), isStudy };
}
function lmApplyPlan(p, policy = "keep") {
  const x = lmPlanProjection(p, policy);
  x.removed.filter(t => t.started).forEach(t => lmStoreDeferred(t, "计划调整后顺延"));
  if (policy === "defer" && x.active.some(t => t.id === PR.taskId)) { PR.taskId = null; PR.answers = []; }
  LM.plan = JSON.parse(JSON.stringify(p)); S.goal = lmGoalLabel(); S.minutes = p.minutes;
  S.today = x.pinned.concat(x.planned.map(t => ({ ...t, id: lmId("task"), date: lmDate(), goal: lmGoalLabel(p), done: false, right: 0, total: GROUPS[t.group]?.items.length || 1 })));
  return x;
}
function lmFinishTask(id, record) { const t = S.today.find(t => t.id === id) || LM.deferred.find(t => t.id === id); if (t && !t.done) { t.done = true; t.recordId = record.id; t.right = record.right || 0; t.total = record.total || 1; } }
function lmOpenTask(id) {
  const t = S.today.find(t => t.id === id); if (!t) return;
  if (t.done) { lmOpenResult(t.recordId); return; }
  t.started = true;
  if (t.kind === "writing") { if (LM.writing.taskId !== t.id) { LM.writing.taskId = t.id; LM.writing.phase = "draft"; LM.writing.feedback = ""; } nav("#/writing"); }
  else if (t.kind === "chapter") { LM.readTask = t.id; openChapter(t.book, t.ch); }
  else if (t.kind === "words") { if (LM.wordTask !== t.id) { LM.wordTask = t.id; LM.wordSeen = []; DR.i = 0; DR.known = 0; DR.mode = "zhan"; DR.book = LM.plan.variant === "cet6" ? "CET6" : "CET4"; } nav("#/drill"); }
  else if (t.kind === "review") { LM.reviewTask = t.id; srsNew(); }
  else enterTask(t.id);
  dbSave();
}
function lmResumeDeferred(id) {
  const i = LM.deferred.findIndex(t => t.id === id); if (i < 0) return;
  const t = LM.deferred.splice(i, 1)[0]; S.today.push({ ...t, date: lmDate() });
  if (t.resume) Object.assign(PR, t.resume);
  if (PR.taskId === t.id && PR.phase === "submitting") { PR.phase = "answer"; PR.fb = { cls: "wa", msg: "提交被中断，原选择已保留，可重试。" }; }
  if (t.wordState) { LM.wordTask = t.id; LM.wordSeen = t.wordState.seen; Object.assign(DR, { book: t.wordState.book, i: t.wordState.i, known: t.wordState.known, mode: "zhan" }); }
  lmOpenTask(t.id);
}
function lmStudyNav(active) { return `<nav class="study-nav" aria-label="学习分区">${[["today", "今日"], ["courses", "课程"], ["words", "词汇"], ["reviewqueue", "复习"]].map(([r, name]) => `<button class="mode-button${r === active ? " is-active" : ""}" aria-current="${r === active ? "page" : "false"}" onclick="nav('#/${r}')">${name}</button>`).join("")}</nav>`; }
function lmEmpty(title, copy, action = "") { return `<div class="card empty"><h2>${title}</h2><p class="d">${copy}</p>${action}</div>`; }
function lmTaskCard(t) { return `<div class="card task-card"><div class="section-heading"><h3>${lh(t.t)}</h3><span class="tag">${t.done ? "✓ 已完成" : t.started ? "进行中" : "待开始"}</span></div><p class="d">预计 ${t.min} 分钟${t.goal && t.goal !== S.goal ? " · 原目标：" + lh(t.goal) : ""}${t.done && t.group ? " · " + t.right + "/" + t.total + " 答对" : ""}</p><div class="actions"><button class="btn sm${t.done ? " ghost" : " primary-action"}" onclick="lmOpenTask('${t.id}')">${t.done ? "查看结果" : t.started ? "继续学习" : "开始学习"}</button>${t.done && t.group ? `<button class="btn sm ghost" onclick="lmRetryTask('${t.id}')">重新练习</button>` : ""}</div></div>`; }
function lmResumeCard() { const p = lmLastRead(); return `<div class="card"><div class="section-heading"><h2>继续阅读</h2><span class="tag">本机记录</span></div><h3>${lh(p.book)}</h3><p class="d">${lh(p.ch)}</p><div class="actions"><button class="btn sm primary-action" onclick="resumeChapter()">继续读</button><button class="btn sm ghost" onclick="nav('#/collections')">收藏与笔记</button></div></div>`; }
V.home = () => {
  lmEnsureDay(); const left = S.today.filter(t => !t.done), active = left.find(t => t.started), first = active || left[0], stats = lmStats();
  const label = !S.plan ? "设置学习目标" : first ? (active ? "继续今日学习" : "开始今日学习") : "查看今日回顾";
  const action = !S.plan ? "nav('#/onboard')" : first ? `lmOpenTask('${first.id}')` : "nav('#/recap')";
  return `<div class="card summary-card"><p class="eyebrow">${lh(S.user)} · 演示数据</p><h2>${S.plan ? "今天，学一点再向前" : "从一个小目标开始"}</h2><p class="d">${lmGoalLabel()} · 每天 ${LM.plan.minutes} 分钟</p><div class="metrics"><div><strong>${S.today.filter(t => t.done).length}/${S.today.length}</strong><span>今日任务</span></div><div><strong>${left.reduce((n, t) => n + t.min, 0)}</strong><span>预计剩余分钟</span></div><div><strong>${stats.xp}</strong><span>今日 XP</span></div></div><button class="btn primary-action" onclick="${action}">${label}</button>${first ? `<p class="d next-line">下一项：${lh(first.t)} · 预计 ${first.min} 分钟</p>` : ""}</div><div class="quick-links"><button class="opt" onclick="nav('#/courses')">发现课程 ›</button><button class="opt" onclick="nav('#/reviewqueue')">复习安排 ›</button></div>${lmResumeCard()}${checkinCard()}<div class="actions"><button class="btn sm ghost" onclick="nav('#/plan')">调整计划</button><button class="btn sm ghost" onclick="nav('#/history')">学习记录</button></div>`;
};
V.today = () => {
  lmEnsureDay(); const left = S.today.filter(t => !t.done), total = S.today.reduce((n, t) => n + t.min, 0);
  return lmStudyNav("today") + (!S.plan ? lmEmpty("还没有学习计划", "选择目标后，可以先定级，也可以直接从基础任务开始。", `<button class="btn primary-action" onclick="nav('#/onboard')">选择目标</button>`) : `<div class="card"><div class="section-heading"><h2>今日安排</h2><button class="text-link" onclick="nav('#/plan')">调整</button></div><p class="d">${lmGoalLabel()} · 目标 ${LM.plan.minutes} 分钟</p><p class="d">今日安排预计 ${total} 分钟 · 剩余预计 ${left.reduce((n, t) => n + t.min, 0)} 分钟</p><p class="d">已完成 ${S.today.length - left.length}/${S.today.length} 项；完成任务与掌握知识分别记录。</p></div>${S.today.map(lmTaskCard).join("")}${!left.length ? lmEmpty(S.today.length ? "今天的计划已完成" : "今天是休息日", S.today.length ? "回顾刚才的结果，看看接下来的复习安排。" : "可以休息，也可以从课程中自由学习。", `<button class="btn primary-action" onclick="lmTodayRecap()">查看今日回顾</button>`) : `<button class="btn ghost" onclick="lmTodayRecap()">查看今日回顾</button>`}`) + (LM.deferred.length ? `<div class="card"><h2>顺延的学习</h2>${LM.deferred.map(t => `<div class="list-row"><div><b>${lh(t.t)}</b><p class="d">${lh(t.reason)} · ${t.date || ""} · 保留进度</p></div><button class="btn sm ghost" onclick="lmResumeDeferred('${t.id}')">接着学</button></div>`).join("")}</div>` : "") + lmResumeCard();
};
function lmOpenResult(id) { const r = LM.records.find(r => r.id === id); if (!r) { toast("旧任务没有题目明细，可在学习记录查看汇总"); nav("#/history"); return; } LM.resultId = id; nav("#/result"); }
function lmTodayRecap() { LM.recapDate = null; nav("#/recap"); }
function lmOutcome(r) { return r.imported ? "旧版汇总" : r.kind === "review" ? r.right + "/" + r.total + " 本次记得" : r.kind === "words" ? r.selfKnown + " 个自评认识" : r.total ? r.right + "/" + r.total + " 答对" : "已保存"; }
function lmAnswerOutcome(r, a) { return r.kind === "words" ? "自评已记录" : r.kind === "review" ? (a.ok ? "本次记得" : "继续巩固") : a.ok ? "✓ 答对" : "需再练"; }
function lmRetryTask(id) { const t = S.today.find(t => t.id === id); if (t?.group) startGroup(id); }
function lmRecordRows(rows) { return rows.length ? rows.slice().reverse().map(r => `<button class="opt record-row" onclick="lmOpenResult('${r.id}')"><span><b>${lh(r.title)}</b><span class="d">${r.time} · ${lmOutcome(r)}${r.estimated ? " · 预计 " + r.estimated + " 分钟" : ""}</span></span><span aria-hidden="true">›</span></button>`).join("") : `<p class="d">这一天暂无学习记录。开始学习后会自动出现在这里。</p>`; }
V.recap = () => { const date = LM.recapDate || lmDate(), s = lmStats(date); return `<div class="card"><p class="eyebrow">${date}${date === lmDate() ? " · 今天" : ""}</p><h2>${s.count ? "每一小步，都有记录" : "还没有完成的学习"}</h2><div class="metrics"><div><strong>${s.count}</strong><span>完成记录</span></div><div><strong>${s.right}/${s.total}</strong><span>本轮答题</span></div><div><strong>${s.xp}</strong><span>获得 XP</span></div></div><p class="d">任务卡用时为预估；这里不把它当作实际学习时长。旧版缺少题目明细的汇总不计入答题与 XP。</p></div><div class="card"><h2>学习结果</h2>${lmRecordRows(s.rows)}</div><div class="card"><h2>接下来的安排</h2><p class="d">${lmReviewDue().length} 个词到期 · ${lmMistakeDue().length} 项验证到期</p><div class="actions"><button class="btn sm" onclick="nav('#/reviewqueue')">查看复习安排</button><button class="btn sm ghost" onclick="nav('#/history')">全部记录</button></div></div><button class="btn primary-action" onclick="LM.recapDate=null;nav('#/home')">结束本次学习</button>`; };
V.history = () => { const dates = [...new Set(LM.records.map(r => r.date))].sort().reverse(); return `<div class="card"><h2>学习记录</h2><p class="d">每轮独立保存。重新练习会新增结果，不覆盖上一轮。</p><div class="actions"><button class="btn sm ghost" onclick="nav('#/weekly')">本周回顾</button><button class="btn sm ghost" onclick="nav('#/calendar')">学习日历</button></div></div>` + (dates.length ? dates.map(d => `<div class="card"><div class="section-heading"><h2>${d}</h2><button class="text-link" onclick="LM.recapDate='${d}';nav('#/recap')">当天回顾</button></div>${lmRecordRows(LM.records.filter(r => r.date === d))}</div>`).join("") : lmEmpty("从第一条记录开始", "完成一道题组、一节阅读或一次写作后，这里会保存结果。", `<button class="btn" onclick="nav('#/today')">去学习</button>`)); };
V.result = () => {
  const r = LM.records.find(r => r.id === LM.resultId); if (!r) return lmEmpty("没有这条记录", "回到学习记录选择一项结果。", `<button class="btn" onclick="nav('#/history')">学习记录</button>`);
  return `<div class="card"><p class="eyebrow">${r.date} ${r.time} · ${r.imported ? "旧版汇总" : "已保存在本机"}</p><h2>${lh(r.title)}</h2><p class="d">${lmOutcome(r)}${r.estimated ? " · 预计 " + r.estimated + " 分钟" : ""}</p>${r.imported ? `<p class="d">旧版仅记录总分，题目选项明细没有保存。</p>` : ""}${r.answers?.map(a => `<div class="answer-detail"><b>${lh(a.stem)}</b><p class="d">你的答案：${lh(a.chosen)} · ${lmAnswerOutcome(r, a)}</p><p class="d">参考：${lh(a.correct)}。${lh(a.why)}</p></div>`).join("") || ""}${r.kind === "writing" ? `<p class="writing-copy">${lh(r.text)}</p><p class="d">${lh(r.summary)}</p><p class="d">自评：${lh(r.self || "还未选择")}</p>` : ""}${r.kind === "chapter" ? `<p class="d">本节已完成，可从课程目录继续下一节。</p>` : ""}<div class="actions">${r.group ? `<button class="btn sm primary-action" onclick="lmRetryRecord('${r.id}')">再练一轮</button>` : ""}<button class="btn sm ghost" onclick="LM.recapDate='${r.date}';nav('#/recap')">回到当天回顾</button></div></div>${r.kind === "practice" && r.right < r.total ? `<button class="btn ghost" onclick="nav('#/mistakes')">查看本轮错题</button>` : ""}`;
};
function lmRetryRecord(id) { const r = LM.records.find(r => r.id === id); if (!r?.group) return; let t = S.today.find(t => t.id === r.taskId); if (!t) { t = { id: lmId("free"), group: r.group, t: r.title, kind: "grammar", min: r.estimated || 5, done: false }; LM.freeTask = t; } startGroup(t.id); }
function lmPlanForm(onboard) {
  const p = LM.planDraft || LM.plan; return `<div class="card"><h2>${onboard ? "定个小目标" : "调整学习计划"}</h2><p class="d">按自己能坚持的节奏来。调整前先看变化，已完成的记录会保留。</p><label class="lb" for="lg">学习目标</label><select id="lg" onchange="lmPlanInput()">${Object.entries(LGOALS).map(([key, t]) => `<option value="${key}"${p.goal === key ? " selected" : ""}>${t}</option>`).join("")}</select>${p.goal === "college" ? `<label class="lb" for="lvariant">大学英语方向</label><select id="lvariant" onchange="lmPlanInput()"><option value="cet4"${p.variant === "cet4" ? " selected" : ""}>四级</option><option value="cet6"${p.variant === "cet6" ? " selected" : ""}>六级</option></select>` : ""}<label class="lb" for="lminutes">每天投入</label><select id="lminutes" onchange="lmPlanInput()">${[5, 15, 30, 45].map(m => `<option value="${m}"${p.minutes === m ? " selected" : ""}>${m} 分钟</option>`).join("")}</select><p class="lb">每周学习日</p><div class="day-picker">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button class="mode-button${p.days.includes(d) ? " is-active" : ""}" aria-pressed="${p.days.includes(d)}" onclick="lmToggleDay(${d})">周${LDAY_NAMES[d]}</button>`).join("")}</div>${!onboard ? `<label class="lb" for="lpolicy">进行中的任务</label><select id="lpolicy" onchange="LM.planPolicy=this.value;LM.planPreview=null;render()"><option value="keep"${(LM.planPolicy || "keep") === "keep" ? " selected" : ""}>保留在今日，接着完成</option><option value="defer"${LM.planPolicy === "defer" ? " selected" : ""}>顺延，保留进度稍后继续</option></select>` : ""}<button class="btn primary-action" onclick="lmPreviewPlan(${onboard})">预览${onboard ? "学习安排" : "计划变化"}</button></div>`;
}
function lmPlanRead() { const base = LM.planDraft || LM.plan; return { goal: document.getElementById("lg").value, variant: document.getElementById("lvariant")?.value || base.variant, minutes: Number(document.getElementById("lminutes").value), days: base.days.slice() }; }
function lmPlanInput() { LM.planDraft = lmPlanRead(); LM.planPreview = null; render(); }
function lmToggleDay(d) { const p = LM.planDraft || JSON.parse(JSON.stringify(LM.plan)); p.days = p.days.includes(d) ? p.days.filter(x => x !== d) : p.days.concat(d); LM.planDraft = p; LM.planPreview = null; render(); }
function lmPreviewPlan(onboard) { const p = lmPlanRead(); if (!p.days.length) { toast("至少选择一个学习日"); return; } LM.planDraft = p; LM.planPreview = { onboard, policy: document.getElementById("lpolicy")?.value || "keep" }; render(); }
function lmPlanPreviewCard() {
  if (!LM.planPreview) return ""; const p = LM.planDraft, v = LM.planPreview, x = lmPlanProjection(p, v.policy);
  return `<div class="card"><p class="eyebrow">确认前预览</p><h2>${lmGoalLabel(p)} · ${p.minutes} 分钟</h2><p class="d">每周 ${p.days.length} 天 · ${x.isStudy ? "今天是学习日" : "今天是休息日"}</p><p class="d">保留 ${x.pinned.filter(t => t.done).length} 个已完成任务，${v.policy === "keep" ? "保留" : "顺延"} ${x.active.length} 个进行中任务。</p>${x.pinned.concat(x.planned).map(t => `<p class="plan-line"><span>${lh(t.t)}</span><b>${t.min} 分钟</b></p>`).join("")}<p class="d">调整后今日预计 ${x.used} 分钟${x.used > p.minutes ? "；已完成和保留的任务超过新预算，今天不再增加任务。" : "。"}</p><p class="d">${x.removed.length} 个原待学任务退出今日安排；已开始的进度保留在“顺延的学习”。未开始的内容可从课程重新找到。</p><button class="btn primary-action" onclick="lmConfirmPlan()">${v.onboard ? "保存目标" : "确认调整"}</button></div>`;
}
function lmConfirmPlan() {
  const v = LM.planPreview; if (!v) return; const p = LM.planDraft;
  if (v.onboard && !S.plan) { LM.plan = JSON.parse(JSON.stringify(p)); S.goal = lmGoalLabel(); S.minutes = p.minutes; LM.planDraft = null; LM.planPreview = null; dbSave(); nav("#/firstlearn"); return; }
  lmApplyPlan(p, v.policy); LM.planDraft = null; LM.planPreview = null; toast("计划已调整，完成记录已保留"); nav("#/today");
}
V.onboard = () => lmPlanForm(true) + lmPlanPreviewCard();
function lmStartPlacement() { S.quiz = { i: 0, sel: null, phase: "answer", answers: [], done: false, score: 0 }; nav("#/placement"); }
V.firstlearn = () => `<div class="card"><h2>选择开始方式</h2><p class="d">${lmGoalLabel()} · 每天 ${LM.plan.minutes} 分钟</p><p class="d">先用五道样例题了解自己的起点，也可以直接做一组基础任务。样例测评不替代正式等级考试。</p><div class="actions"><button class="btn sm primary-action" onclick="lmStartPlacement()">先做样例测评</button><button class="btn sm ghost" onclick="quickStart()">直接开始学习</button></div></div>`;
V.pgen = () => {
  const first = S.today.find(t => !t.done);
  if (PG.st === "run") return `<div class="card"><h2>正在准备你的任务…</h2><p class="d">按目标、时间预算和学习日安排样例内容。</p><button class="btn ghost" onclick="PG.st='idle';PG.tok++;render()">取消，稍后再准备</button></div>`;
  if (PG.st === "ok") return `<div class="card"><h2>学习安排已准备好</h2><p class="d">${lmGoalLabel()} · 每天 ${LM.plan.minutes} 分钟 · 今日 ${S.today.length} 项</p><button class="btn primary-action" onclick="${first ? `lmOpenTask('${first.id}')` : "nav('#/today')"}">${first ? "开始第一项" : "查看今日安排"}</button><button class="btn ghost" onclick="nav('#/plan')">预览调整计划</button></div>`;
  return `<div class="card"><h2>${PG.st === "fail" ? "暂时没准备好" : "生成今日安排"}</h2><p class="d">${PG.st === "fail" ? "你的选择仍在，重试会保留已完成的学习。" : "按目标与时间预算安排固定样例内容，已完成和进行中的任务会保留。"}</p><button class="btn primary-action" onclick="pgenStart()">${PG.st === "fail" ? "重试" : "生成今日计划"}</button><button class="btn ghost" onclick="nav('#/plan')">查看学习计划</button></div>`;
};
V.plan = () => lmPlanForm(false) + lmPlanPreviewCard() + `<div class="actions"><button class="btn sm ghost" onclick="nav('#/calendar')">学习日历</button><button class="btn sm ghost" onclick="nav('#/history')">学习记录</button></div>`;
V.planexp = () => `<div class="card"><h2>你的学习安排</h2><p class="d">${lmGoalLabel()} · 每天 ${LM.plan.minutes} 分钟 · 每周 ${LM.plan.days.length} 天</p><p class="d">先做目标对应的小题组，再按预算加入阅读、写作、词汇和复习。当前内容是固定学习样例；测评结果作为水平参考。</p><p class="d">休息日不增加新任务；未完成内容保留在顺延列表。调整计划前可以选择保留或顺延进行中的任务。</p><button class="btn" onclick="nav('#/plan')">预览计划调整</button></div>`;
V.calendar = () => `<div class="card"><h2>接下来两周</h2><p class="d">学习日安排目标对应的任务；休息日可以自由阅读，未完成进度可以接着学。</p><button class="btn sm ghost" onclick="nav('#/plan')">调整学习日</button></div>` + Array.from({ length: 14 }, (_, i) => { const d = lmAddDate(lmDate(), i), study = LM.plan.days.includes(new Date(d + "T12:00:00").getDay()), rows = LM.records.filter(r => r.date === d), due = S.mistakes.filter(m => m.due === d && m.st !== "verified").length + SRSQ.filter(q => q.due === d).length; return `<div class="card calendar-day"><div class="section-heading"><h3>${d.slice(5)} · 周${LDAY_NAMES[new Date(d + "T12:00:00").getDay()]}</h3><span class="tag">${i === 0 ? "今天 · " : ""}${study ? "学习日" : "休息日"}</span></div><p class="d">${study ? lmGoalLabel() + " · 预计不超过 " + LM.plan.minutes + " 分钟" : "不安排新任务"} · ${due} 项复习/验证</p>${rows.length ? `<button class="btn sm ghost" onclick="LM.recapDate='${d}';nav('#/recap')">查看 ${rows.length} 条学习记录</button>` : ""}</div>`; }).join("");

/* 独立轮次：刷新恢复题目答案，查看与重练分别处理。 */
function startGroup(taskId) {
  const t = S.today.find(t => t.id === taskId) || (LM.freeTask?.id === taskId ? LM.freeTask : null) || S.today.find(t => !t.done && t.group);
  if (!t || !GROUPS[t.group]) { toast("先从学习页选择一个题组"); nav("#/today"); return; }
  GROUPS[t.group].items.forEach(it => { delete it._ok; delete it._sel; });
  Object.assign(PR, { taskId: t.id, pos: 0, sel: -1, phase: "answer", fb: null, answers: [], attempt: lmId("attempt"), startedAt: Date.now(), tok: (PR.tok || 0) + 1 });
  t.started = true; dbSave(); nav("#/practice"); if (LASTR === "practice") render();
}
function prTask() { return S.today.find(t => t.id === PR.taskId) || (LM.freeTask?.id === PR.taskId ? LM.freeTask : null); }
function enterTask(taskId) { const t = S.today.find(t => t.id === taskId); if (!t) return; if (PR.taskId === t.id && PR.phase !== "result") nav("#/practice"); else if (t.done) lmOpenResult(t.recordId); else startGroup(t.id); }
function prRecord(pos, sel) {
  const g = prGroup(), it = g?.items[pos]; if (!it) return;
  PR.answers ||= []; if (PR.answers[pos]) return;
  const ok = sel === it.a; Object.assign(it, { _ok: ok, _sel: sel });
  PR.answers[pos] = { stem: it.s, chosen: it.o[sel], correct: it.o[it.a], why: it.why, ok, sel, skill: it.skill || lmSkill(it.s) };
  if (!ok) addMistake(it.s, it.why, "sentence", g.title, PR.answers[pos].skill);
  PR.phase = "saved"; PR.fb = { cls: ok ? "ok" : "no", msg: (ok ? "✓ 答对。" : "需要再练。已保存到错题本。") + it.why }; render();
}
function prFinish() {
  const g = prGroup(), t = prTask(); if (!g || !t || (PR.answers || []).filter(Boolean).length !== g.items.length) return;
  const r = lmRecord({ key: PR.attempt, kind: "practice", title: g.title, taskId: t.id, group: t.group, estimated: t.min, answers: JSON.parse(JSON.stringify(PR.answers)), right: PR.answers.filter(a => a.ok).length, total: g.items.length });
  lmFinishTask(t.id, r); PR.phase = "result"; PR.resultId = r.id; render();
}
V.practice = () => {
  const t = prTask(), g = prGroup(); if (!g) return lmEmpty("选择一个练习", "从今日任务开始，或在课程中找到想练的内容。", `<button class="btn" onclick="nav('#/today')">返回学习</button>`);
  if (PR.phase === "result") { const r = LM.records.find(r => r.id === PR.resultId); return `<div class="card"><p class="eyebrow">本轮已完成</p><h2>${lh(g.title)}</h2><div class="result-score">${r?.right ?? t.right}<span> / ${g.items.length} 答对</span></div><p class="d">答错的题已加入错题本。完成一轮练习后，还可以通过变式和后续验证巩固。</p><div class="actions"><button class="btn sm primary-action" onclick="nav('#/today')">回到今日安排</button><button class="btn sm ghost" onclick="lmOpenResult('${r?.id || t.recordId}')">本轮详情</button></div></div><div class="actions"><button class="btn sm ghost" onclick="LM.recapDate=null;nav('#/recap')">今日回顾</button><button class="btn sm ghost" onclick="nav('#/mistakes')">错题补救</button></div>`; }
  const it = g.items[PR.pos]; return `<div class="meta">${lh(g.title)} · 第 ${PR.pos + 1}/${g.items.length} 题</div>${g.passage ? `<div class="card"><h3>阅读材料</h3><p class="reading-passage">${lh(g.passage)}</p></div>` : ""}<div class="card"><h2>${lh(it.s)}</h2><div class="choice-list">${it.o.map((o, i) => `<button class="opt${PR.sel === i ? " sel" : ""}" aria-pressed="${PR.sel === i}" ${PR.phase !== "answer" ? "disabled" : ""} onclick="prPick(${i})">${"ABC"[i]}. ${lh(o)}</button>`).join("")}</div>${PR.fb ? `<div class="fb ${PR.fb.cls}" role="status">${lh(PR.fb.msg)}</div>` : ""}<div class="actions">${PR.phase === "unknown" ? `<button class="btn sm primary-action" onclick="prResolve()">查询本次结果</button>` : `<button class="btn sm primary-action" ${PR.phase !== "answer" || PR.sel < 0 ? "disabled" : ""} onclick="prSubmit()">${PR.phase === "submitting" ? "正在提交…" : "提交答案"}</button>`}<button class="btn sm ghost" ${PR.phase !== "saved" ? "disabled" : ""} onclick="prNext()">${PR.pos + 1 === g.items.length ? "查看结果" : "下一题"}</button></div></div><button class="btn ghost" onclick="nav('#/today')">保存进度，稍后继续</button>`;
};
/* 同知识点变式与延迟验证；普通页面不能跳过日期。 */
const LVARIANTS = {
  there: ["There ___ three pens on the table.", ["is", "are", "am"], 1, "three pens 是复数，there be 用 are。"],
  third: ["Tom ___ English every evening.", ["study", "studies", "studying"], 1, "Tom 是第三人称单数，使用 studies。"],
  be: ["They ___ classmates.", ["is", "am", "are"], 2, "They 是复数，使用 are。"],
  relative: ["The teacher ___ helped me is kind.", ["who", "where", "when"], 0, "who 指代人并作从句主语。"],
  inversion: ["Hardly ___ she left when it started to rain.", ["had", "has", "did"], 0, "Hardly 句首触发过去完成时的倒装。"],
  attached: ["Please review the ___ document.", ["attaching", "attached", "attach"], 1, "attached 表示附上的文件。"],
  modal: ["Could you ___ this file?", ["check", "checked", "checking"], 0, "情态动词后使用原形 check。"],
  "reading-li-0": ["May gets up at seven. What time does May get up?", ["Six", "Seven", "Eight"], 1, "原文明确给出 seven。"],
  "reading-li-1": ["May visits the park after school. Where does she go?", ["Library", "School", "Park"], 2, "从原文定位 park。"],
  "reading-may": ["Leo studies at home and reads at night. Where does Leo study?", ["At school", "At home", "At a hotel"], 1, "从原文定位 at home。"],
  "reading-meeting": ["The meeting starts at 9:00. Please bring a notebook. When does it start?", ["9:00", "10:00", "11:00"], 0, "从通知中定位 9:00。"],
  "reading-research": ["A survey involved only ten learners. Why should its conclusion be treated carefully?", ["The sample is small", "The words are short", "The survey is old"], 0, "研究限制来自样本过小，不能直接推广到所有人。"],
  vocabhappy: ["Choose a word close in meaning to 'glad'.", ["Happy", "Angry", "Tired"], 0, "glad 和 happy 都表达高兴。"],
};
const LVERIFY = {
  third: ["My sister ___ to work by bus.", ["go", "goes", "going"], 1, "My sister 是第三人称单数，用 goes。"],
  there: ["There ___ a notebook in my bag.", ["are", "am", "is"], 2, "a notebook 是单数，用 is。"],
  inversion: ["Hardly ___ we begun when the lights went out.", ["had", "have", "are"], 0, "过去完成时倒装用 had。"],
};
function lmSkill(stem) {
  const item = Object.values(GROUPS).flatMap(g => g.items).find(i => i.s === stem); if (item?.skill) return item.skill;
  if (/She ___|every day/.test(stem)) return "third";
  if (/There ___/.test(stem)) return "there";
  if (/Hardly/.test(stem)) return "inversion";
  if (/happy/.test(stem)) return "vocabhappy";
  return null;
}
function addMistake(t, why, kind, src, skill) {
  const old = S.mistakes.find(m => m.t === t);
  if (old) { if (["verified", "wait1", "wait7"].includes(old.st)) { old.st = "todo"; old.due = null; } return false; }
  S.mistakes.unshift({ id: lmId("mistake"), t, why, kind, src: src || "练习", skill: skill || lmSkill(t), st: "todo", created: lmDate(), hid: 0 }); return true;
}
function lmVariant(m) {
  if (LM.mistakeId === m.id && LM.mistakeFeedback?.question) return LM.mistakeFeedback.question;
  if (m.kind === "word") { const hit = vcAll().find(x => x.w === m.t) || LEX[m.t]; if (!hit?.zh) return null; const opts = [hit.zh, "在场的", "订票"].filter((s, i, a) => a.indexOf(s) === i); while (opts.length < 3) opts.push("安静的"); return { s: `“${m.t}” 的意思是？`, o: opts, a: 0, why: hit.zh }; }
  let v = (m.st === "wait1" || m.st === "wait7") && LVERIFY[m.skill] ? LVERIFY[m.skill] : LVARIANTS[m.skill]; if (!v) return null;
  let [s, o, a, why] = v;
  if (m.st === "wait7") { o = o.slice(1).concat(o[0]); a = (a + o.length - 1) % o.length; }
  return { s, o, a, why };
}
function lmMistakeState(m) { return { todo: "待补救", self: "自评认识 · 待验证", wait1: "本次已修复 · 待次日验证", wait7: "次日已通过 · 待七日验证", verified: "✓ 延迟验证已通过" }[m.st] || "待补救"; }
function lmMistakeDue() { return S.mistakes.filter(m => ["wait1", "wait7"].includes(m.st) && m.due <= lmDate()); }
function lmMistakeOpen(id) { LM.mistakeId = id; LM.mistakePick = -1; LM.mistakeFeedback = null; nav("#/mistakes"); render(); }
function lmMistakePick(i) { LM.mistakePick = i; render(); }
function lmSelfRate(id) { const m = S.mistakes.find(m => m.id === id); if (!m) return; LM.mistakeUndo = { id, old: JSON.parse(JSON.stringify(m)), record: null }; m.st = "self"; toast("已记录自评，还需要通过变式验证"); render(); }
function lmMistakeCheck() {
  const m = S.mistakes.find(m => m.id === LM.mistakeId), q = m && lmVariant(m); if (!q || LM.mistakePick < 0 || LM.mistakeFeedback) return;
  if (["wait1", "wait7"].includes(m.st) && m.due > lmDate()) { toast("验证尚未到期"); return; }
  LM.mistakeUndo = { id: m.id, old: JSON.parse(JSON.stringify(m)) }; const before = m.st, ok = LM.mistakePick === q.a;
  if (!ok) { m.st = "todo"; m.due = null; }
  else if (before === "wait7") { m.st = "verified"; m.due = null; }
  else if (before === "wait1") { m.st = "wait7"; m.due = lmAddDate(m.repaired, 7); }
  else { m.st = "wait1"; m.repaired = lmDate(); m.due = lmAddDate(lmDate(), 1); }
  const r = lmRecord({ kind: "repair", title: (before === "wait1" ? "次日验证 · " : before === "wait7" ? "七日验证 · " : "错题补救 · ") + m.t, right: ok ? 1 : 0, total: 1, answers: [{ stem: q.s, chosen: q.o[LM.mistakePick], correct: q.o[q.a], why: q.why, ok }] });
  LM.mistakeUndo.record = r.id; LM.mistakeFeedback = { ok, question: q, stage: before, text: (ok ? "✓ 本次答对。" : "需要再补救。") + q.why }; render();
}
function lmVariantTitle(m) { const stage = LM.mistakeFeedback?.stage || m.st; return stage === "wait1" ? "次日验证" : stage === "wait7" ? "七日验证" : "同知识点变式"; }
function lmMistakeUndo() { const u = LM.mistakeUndo, m = u && S.mistakes.find(m => m.id === u.id); if (!m) return; Object.assign(m, u.old); if (u.record) LM.records = LM.records.filter(r => r.id !== u.record); LM.mistakeUndo = null; LM.mistakeFeedback = null; LM.mistakePick = -1; render(); }
V.mistakes = () => {
  const m = S.mistakes.find(m => m.id === LM.mistakeId), filter = LM.mistakeFilter || "all";
  if (m) { const q = lmVariant(m), waiting = ["wait1", "wait7"].includes(m.st) && m.due > lmDate(); return `<div class="card"><p class="eyebrow">${lh(m.src)} · ${lmMistakeState(m)}</p><h2>${lh(m.t)}</h2><p class="d">原题说明：${lh(m.why)}</p>${m.due ? `<p class="d">下次验证：${m.due}${waiting ? "（尚未到期）" : "（已到期）"}</p>` : ""}</div>${q ? `<div class="card"><h3>${lmVariantTitle(m)}</h3><p class="reading-passage">${lh(q.s)}</p><div class="choice-list">${q.o.map((o, i) => `<button class="opt${LM.mistakePick === i ? " sel" : ""}" aria-pressed="${LM.mistakePick === i}" ${waiting || LM.mistakeFeedback || m.st === "verified" ? "disabled" : ""} onclick="lmMistakePick(${i})">${"ABC"[i]}. ${lh(o)}</button>`).join("")}</div>${LM.mistakeFeedback ? `<div class="fb ${LM.mistakeFeedback.ok ? "ok" : "no"}" role="status">${lh(LM.mistakeFeedback.text)}<p>${lmMistakeState(m)}${m.due ? " · " + m.due : ""}</p></div>` : ""}<button class="btn primary-action" ${waiting || LM.mistakeFeedback || m.st === "verified" || LM.mistakePick < 0 ? "disabled" : ""} onclick="lmMistakeCheck()">${LM.mistakeFeedback ? "本轮已记录" : waiting ? "等待验证日期" : "检查答案"}</button></div>` : lmEmpty("暂缺对应变式", "这道题还没有匹配的样例，保留在待补救列表，不用其他知识点替代。") }<div class="actions"><button class="btn sm ghost" onclick="LM.mistakeId=null;LM.mistakeFeedback=null;nav('#/mistakes');render()">回到错题列表</button>${LM.mistakeUndo ? `<button class="btn sm ghost" onclick="lmMistakeUndo()">撤销上次操作</button>` : ""}</div>`; }
  const list = S.mistakes.filter(m => filter === "all" || (filter === "todo" ? ["todo", "self"].includes(m.st) : filter === "wait" ? ["wait1", "wait7"].includes(m.st) : m.st === "verified"));
  return `<div class="card"><h2>错题与验证</h2><p class="d">自评、当次修复和延迟验证分别记录。通过次日与七日验证后，才归入已验证。</p><div class="filter-grid">${[["all", "全部"], ["todo", "待补救"], ["wait", "待验证"], ["verified", "已验证"]].map(([v, label]) => `<button class="mode-button${filter === v ? " is-active" : ""}" aria-pressed="${filter === v}" onclick="LM.mistakeFilter='${v}';render()">${label}</button>`).join("")}</div></div>${list.length ? list.map(m => `<div class="card"><p class="eyebrow">${lmMistakeState(m)}</p><h3>${lh(m.t)}</h3><p class="d">${lh(m.src)}${m.due ? " · " + m.due + (m.due <= lmDate() ? " 到期" : " 验证") : ""}</p><div class="actions"><button class="btn sm primary-action" onclick="lmMistakeOpen('${m.id}')">${m.st === "verified" ? "查看验证" : ["wait1", "wait7"].includes(m.st) ? "查看验证安排" : "做匹配变式"}</button>${m.st === "todo" ? `<button class="btn sm ghost" onclick="lmSelfRate('${m.id}')">自评认识</button>` : ""}</div></div>`).join("") : lmEmpty("这里暂时没有学习项", "换个筛选看看，或开始一轮练习。")}${LM.mistakeUndo ? `<button class="btn ghost" onclick="lmMistakeUndo()">撤销上次操作</button>` : ""}<button class="btn ghost" onclick="nav('#/reviewqueue')">全部复习安排</button>`;
};
V.mastery = () => `<div class="card"><h2>巩固进度</h2><div class="metrics"><div><strong>${S.mistakes.filter(m => ["todo", "self"].includes(m.st)).length}</strong><span>待补救</span></div><div><strong>${S.mistakes.filter(m => ["wait1", "wait7"].includes(m.st)).length}</strong><span>待验证</span></div><div><strong>${S.mistakes.filter(m => m.st === "verified").length}</strong><span>已验证</span></div></div><p class="d">此处是学习项的验证状态，不是正式等级或能力认证。</p><button class="btn" onclick="nav('#/mistakes')">查看学习项</button></div>`;
function lmReviewDue() { return SRSQ.filter(q => (q.due || lmDate()) <= lmDate()); }
function srsAddWord(w) {
  const hit = vcAll().find(x => x.w === w), e = LEX[w], zh = hit?.zh || e?.zh; if (!zh) { toast("样例词库暂无这个词"); return; }
  if (SRSQ.some(q => q.w === w)) { toast("已在复习安排中，可查看下次日期"); return; }
  SRSQ.push({ w, zh, show: false, done: false, due: lmDate(), interval: 0, source: LASTR === "chapter" ? lmLastRead().book + " · " + lmLastRead().ch : "词汇学习" }); toast("已加入复习安排"); dbSave();
}
function srsEnsure() {
  if (SRS.phase !== "idle") return;
  SRS.order = SRSQ.map((q, i) => ({ q, i })).filter(x => (x.q.due || lmDate()) <= lmDate()).slice(0, 4).map(x => x.i);
  Object.assign(SRS, { pos: 0, pass: 1, redo: [], batch: SRS.order.length, done: 0, again: 0, remembered: 0, phase: SRS.order.length ? "run" : "empty", undo: [], operations: 0, attempt: lmId("review"), results: [], imported: false });
  SRS.order.forEach(i => SRSQ[i].show = false);
}
function srsCur() { return SRS.order[SRS.pos]; }
function srsShow() { const q = SRSQ[srsCur()]; if (q) { q.show = true; render(); } }
function srsRate(level) {
  if (SRS.phase !== "run") return; const idx = srsCur(), q = SRSQ[idx]; if (!q?.show) return;
  SRS.undo.push({ state: JSON.parse(JSON.stringify({ ...SRS, undo: [] })), queue: JSON.parse(JSON.stringify(SRSQ)), mistakes: JSON.parse(JSON.stringify(S.mistakes)), records: LM.records.map(r => r.id), task: JSON.parse(JSON.stringify(S.today)), reviewTask: LM.reviewTask });
  SRS.operations++; q.show = false;
  if (level < 2 && SRS.pass === 1) { SRS.redo.push(idx); SRS.again++; }
  else {
    q.done = true; q.interval = level >= 2 ? (q.interval ? 7 : 1) : 1; q.due = lmAddDate(lmDate(), q.interval); SRS.done++; if (level >= 2) SRS.remembered++;
    SRS.results.push({ stem: q.w, chosen: level >= 2 ? "本次记得" : "还需巩固", correct: q.zh, why: "下次回忆：" + q.due, ok: level >= 2 });
    if (level < 2) addMistake(q.w, q.zh, "word", "词汇复习");
  }
  SRS.pos++;
  if (SRS.pos >= SRS.order.length) {
    if (SRS.pass === 1 && SRS.redo.length) { SRS.order = SRS.redo.slice(); SRS.pos = 0; SRS.pass = 2; SRS.redo = []; }
    else { SRS.phase = "done"; const r = lmRecord({ key: SRS.attempt, kind: "review", title: "词汇复习 · " + SRS.batch + " 个词", right: SRS.remembered, total: SRS.batch, answers: SRS.results.slice() }); lmFinishTask(LM.reviewTask, r); LM.reviewTask = null; }
  }
  render();
}
function srsUndo() {
  const u = SRS.undo.pop(); if (!u) return; const rest = SRS.undo; Object.assign(SRS, u.state, { undo: rest }); SRSQ.splice(0, SRSQ.length, ...u.queue); S.mistakes = u.mistakes; S.today = u.task; LM.reviewTask = u.reviewTask; LM.records = LM.records.filter(r => u.records.includes(r.id)); render();
}
function srsNew() { SRS.phase = "idle"; nav("#/srs"); if (LASTR === "srs") render(); }
V.srs = () => {
  srsEnsure(); if (SRS.phase === "empty") return lmEmpty("今天没有到期的词", "下次日期保留在复习安排中。可以去阅读，或学习新词。", `<button class="btn" onclick="nav('#/reviewqueue')">查看下次安排</button>`);
  if (SRS.phase === "done") return `<div class="card"><h2>本轮复习完成</h2><div class="metrics"><div><strong>${SRS.batch}</strong><span>学习项</span></div><div><strong>${SRS.operations}</strong><span>回忆次数</span></div><div><strong>${SRS.remembered}</strong><span>本次记得</span></div></div><p class="d">忘记的词本轮最多再出现一次。每个词的下次日期已保存；本次记得不等于长期掌握。</p><div class="actions"><button class="btn sm primary-action" onclick="nav('#/reviewqueue')">下次复习安排</button><button class="btn sm ghost" onclick="lmTodayRecap()">今日回顾</button></div>${SRS.undo.length ? `<button class="btn ghost" onclick="srsUndo()">撤销上次评分</button>` : ""}</div>`;
  const q = SRSQ[srsCur()]; return `<div class="meta">本批 ${SRS.batch} 个词 · 第 ${SRS.pos + 1}/${SRS.order.length} 个${SRS.pass === 2 ? " · 再次回忆" : ""}</div><div class="card word-card"><h2>${lh(q.w)}</h2><p class="d">来源：${lh(q.source)}</p><div class="word-meaning">${q.show ? `<p>${lh(q.zh)}</p>` : `<button class="btn sm" onclick="srsShow()">显示释义</button>`}</div></div>${q.show ? `<div class="word-actions">${["忘记了", "有点模糊", "记得", "很熟悉"].map((label, i) => `<button class="btn sm${i >= 2 ? " primary-action" : " ghost"}" onclick="srsRate(${i})">${label}</button>`).join("")}</div>` : ""}<div class="actions">${SRS.undo.length ? `<button class="btn sm ghost" onclick="srsUndo()">撤销上次评分</button>` : ""}<button class="btn sm ghost" onclick="nav('#/reviewqueue')">稍后继续</button></div>`;
};
V.reviewqueue = () => lmStudyNav("reviewqueue") + `<div class="card"><h2>复习安排</h2><p class="d">今天：${lmReviewDue().length} 个词到期 · ${lmMistakeDue().length} 项延迟验证到期</p><div class="actions"><button class="btn sm primary-action" onclick="${SRS.phase === "run" ? "nav('#/srs')" : "srsNew()"}">${SRS.phase === "run" ? "继续本轮复习" : "开始到期复习"}</button><button class="btn sm ghost" onclick="LM.mistakeId=null;nav('#/mistakes')">错题与验证</button></div></div><div class="card"><h2>词汇下次日期</h2>${SRSQ.length ? SRSQ.slice().sort((a, b) => a.due.localeCompare(b.due)).map(q => `<div class="list-row"><div><b>${lh(q.w)}</b><p class="d">${lh(q.source)} · ${q.due}</p></div><span class="tag">${q.due <= lmDate() ? "已到期" : "待复习"}</span></div>`).join("") : `<p class="d">还没有加入复习的词。从词汇或阅读查词中添加。</p>`}</div><div class="card"><h2>延迟验证</h2>${S.mistakes.filter(m => ["wait1", "wait7"].includes(m.st)).map(m => `<button class="opt record-row" onclick="lmMistakeOpen('${m.id}')"><span><b>${lh(m.t)}</b><span class="d">${lmMistakeState(m)} · ${m.due}</span></span><span>›</span></button>`).join("") || `<p class="d">完成一次错题补救后，这里会显示次日和七日验证安排。</p>`}</div>`;

/* 阅读：书与章节身份、完成、下一节、上下文查词与本机笔记。 */
function lmChapterKey() { return BK.cur + ":" + BK.ch; }
function lmNoteInput() { const key = lmChapterKey(), note = document.getElementById("chapter-note").value; LM.chapters[key] ||= { done: false, note: "" }; LM.chapters[key].note = note; dbSave(); const status = document.getElementById("note-save"); if (status) status.textContent = "已保存到本机 · " + note.length + " 字"; }
function lmChapterComplete() {
  const key = lmChapterKey(), c = LM.chapters[key] ||= { note: "", done: false }, b = BOOKS.find(b => b.id === BK.cur); if (!b) return;
  if (!c.done) { c.done = true; c.date = lmDate(); const r = lmRecord({ key: "chapter-" + key, kind: "chapter", title: b.title + " · " + b.toc[BK.ch], bookId: b.id, chapter: BK.ch, estimated: 10 }); c.recordId = r.id; const t = S.today.find(t => t.id === LM.readTask); if (t?.book === b.id && t.ch === BK.ch) lmFinishTask(t.id, r); }
  LM.readTask = null; toast("本节已完成，进度已保存"); render();
}
function lmNextChapter() { const b = BOOKS.find(b => b.id === BK.cur); if (!b || BK.ch + 1 >= b.toc.length) { nav("#/courses"); return; } chapSaveNow(); openChapter(b.id, BK.ch + 1); }
function lmReadContext(word) { const lines = (CHAP[BK.cur]?.[BK.ch] || "").split("\n"); return (lines.find(l => new RegExp("\\b" + word + "\\b", "i").test(l)) || "本节查词").replace(/[*#>]/g, "").trim(); }
function lmLookup(word) { document.getElementById("chapq").value = word; chapLex(); }
function lmLookupMarkup(hit) {
  if (!hit) return ""; return `<div class="lookup-result"><b>${lh(hit.word)}</b><p class="d">${lh(hit.zh)}</p><p class="lookup-context">${lh(hit.context)}</p><div class="actions"><button class="btn sm" onclick="speak('${hit.word}')">朗读</button><button class="btn sm ghost" onclick="srsAddWord('${hit.word}')">加入复习</button></div></div>`;
}
function chapLex() {
  const word = document.getElementById("chapq").value.trim().toLowerCase().replace(/[^a-z]/g, ""), box = document.getElementById("chapwd");
  const hit = vcAll().find(w => w.w === word) || LEX[word]; if (!word) { box.textContent = "请先输入英文单词"; return; }
  if (!hit) { box.textContent = "样例词库暂无这个词，可先记录在本节笔记中。"; return; }
  LM.lookups ||= {}; LM.lookups[lmChapterKey()] = { word, zh: hit.zh, context: lmReadContext(word) }; box.innerHTML = lmLookupMarkup(LM.lookups[lmChapterKey()]); dbSave();
}
V.chapter = () => {
  const b = BOOKS.find(b => b.id === BK.cur) || BOOKS[0]; BK.cur = b.id; BK.ch = Math.max(0, Math.min(BK.ch || 0, b.toc.length - 1));
  const key = lmChapterKey(), c = LM.chapters[key] ||= { done: false, note: "" }, raw = CHAP[b.id]?.[BK.ch] || "# 本节内容准备中", availableWords = [...new Set((raw.match(/[a-zA-Z]{3,}/g) || []).map(w => w.toLowerCase()))].filter(w => LEX[w] || vcAll().some(x => x.w === w)).slice(0, 5);
  return `<div class="card"><div class="section-heading"><p class="eyebrow">第 ${BK.ch + 1}/${b.toc.length} 节</p><span class="tag">${c.done ? "✓ 本节已完成" : "阅读中"}</span></div><p class="d">${lh(b.title)}</p><article>${md(raw)}</article></div><div class="card"><h2>查词与收藏</h2>${availableWords.length ? `<p class="d">本节词汇，点词保留原句：</p><div class="actions">${availableWords.map(w => `<button class="btn sm ghost" onclick="lmLookup('${w}')">${w}</button>`).join("")}</div>` : ""}<label class="lb" for="chapq">英文单词</label><input id="chapq" placeholder="输入要查的单词" value="${lh(LM.lookups?.[key]?.word || "")}"><div class="actions"><button class="btn sm" onclick="chapLex()">查词</button><button class="btn sm ghost" aria-pressed="${S.fav.includes(key)}" onclick="chapFav()">${S.fav.includes(key) ? "★ 已收藏本节" : "☆ 收藏本节"}</button></div><div id="chapwd" role="status">${lmLookupMarkup(LM.lookups?.[key])}</div></div><div class="card"><h2>本节笔记</h2><label class="lb" for="chapter-note">记下一句话或疑问</label><textarea id="chapter-note" maxlength="2000" rows="4" oninput="lmNoteInput()" placeholder="笔记会自动保存到本机">${lh(c.note)}</textarea><p class="d" id="note-save" role="status">${c.note ? "已保存到本机 · " + c.note.length + " 字" : "输入后自动保存"}</p></div><div class="card"><h2>${c.done ? "继续往下读" : "读完这一节了吗？"}</h2><div class="actions"><button class="btn sm primary-action" ${c.done ? "disabled" : ""} onclick="lmChapterComplete()">${c.done ? "✓ 已完成本节" : "完成本节"}</button><button class="btn sm ghost" ${!c.done ? "disabled" : ""} onclick="lmNextChapter()">${BK.ch + 1 === b.toc.length ? "回到课程" : "下一节"}</button></div><button class="text-link" onclick="nav('#/book')">返回本书目录</button></div>`;
};
V.book = () => {
  const b = BOOKS.find(b => b.id === BK.cur) || BOOKS[0], done = b.toc.filter((_, i) => LM.chapters[b.id + ":" + i]?.done).length;
  return `<div class="card"><p class="eyebrow">原创片段与词汇学习样例</p><h2>${lh(b.title)}</h2><p class="d">${lh(b.intro)} · 已完成 ${done}/${b.toc.length} 节</p><div class="prog"><i style="width:${done / b.toc.length * 100}%"></i></div><button class="btn sm ghost" aria-pressed="${LM.savedCourses.includes(b.id)}" onclick="lmSaveCourse('${b.id}')">${LM.savedCourses.includes(b.id) ? "★ 已收藏课程" : "☆ 收藏课程"}</button></div><div class="card"><h2>章节目录</h2>${b.toc.map((title, i) => `<button class="opt record-row" onclick="openChapter('${b.id}',${i})"><span><b>${i + 1}. ${lh(title)}</b><span class="d">${LM.chapters[b.id + ":" + i]?.done ? "✓ 已完成" : LM.chapters[b.id + ":" + i] ? "进行中" : "未开始"}</span></span><span>›</span></button>`).join("")}</div><button class="btn ghost" onclick="nav('#/courses')">返回课程</button>`;
};
V.collections = () => {
  const keys = [...new Set(S.fav.concat(Object.keys(LM.chapters).filter(k => LM.chapters[k].note)))];
  return `<div class="card"><h2>收藏与笔记</h2><p class="d">笔记随输入自动保存；点一项回到原书原章。</p></div>` + (keys.length ? keys.map(k => { const [id, num] = k.split(":"), b = BOOKS.find(b => b.id === id); if (!b) return ""; return `<div class="card"><p class="eyebrow">${S.fav.includes(k) ? "★ 收藏 · " : ""}${lh(b.title)}</p><h3>${lh(b.toc[Number(num)])}</h3>${LM.chapters[k]?.note ? `<p class="note-preview">${lh(LM.chapters[k].note)}</p>` : `<p class="d">本节还没有笔记</p>`}<button class="btn sm primary-action" onclick="openChapter('${id}',${Number(num)})">回到本节</button></div>`; }).join("") : lmEmpty("还没有收藏和笔记", "阅读时收藏一节，或记下自己的想法。", `<button class="btn" onclick="nav('#/courses')">发现课程</button>`));
};
/* 写作：规则检查与自评，无 AI；快照与草稿分开，失败和未知均保留。 */
const LWRITE_REFERENCE = "Dear Sam,\nI would like to study English with you this weekend. We can meet at the library on Saturday morning. I plan to read a short story and learn some new words. After lunch, we can write a letter together and check our sentences. Please tell me if you are free.\nBest wishes,\nAlex";
function lmWritingRules(text) {
  const count = (text.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) || []).length;
  const checks = [{ title: "40–100 个英文单词", ok: count >= 40 && count <= 100 }, { title: "有称呼与结束语", ok: /\b(dear|hi|hello)\b/i.test(text) && /\b(wishes|regards|yours|bye)\b/i.test(text) }, { title: "说明活动和时间", ok: /\b(study|read|write|learn|meet)\b/i.test(text) && /\b(saturday|sunday|weekend|morning|afternoon|evening)\b/i.test(text) }];
  return { count, checks, accepted: checks.every(c => c.ok), summary: checks.filter(c => c.ok).length + "/3 项格式与内容检查通过；不评价完整语法、语义或真实能力。" };
}
function lmWritingInput() {
  LM.writing.text = document.getElementById("writing-draft").value; LM.writing.revision++; LM.writing.phase = "draft"; LM.writing.feedback = ""; dbSave();
  document.getElementById("writing-count").textContent = lmWritingRules(LM.writing.text).count + " 个英文单词 · 草稿已保存到本机";
}
function lmWritingConfirm() { if (!LM.writing.text.trim()) { toast("先写一点内容再提交"); return; } LM.writing.phase = "confirm"; LM.writing.feedback = ""; render(); }
function lmWritingSubmit() {
  const w = LM.writing; if (w.phase !== "confirm") return;
  if (LAB.offline) { w.phase = "draft"; w.feedback = "当前离线，草稿已保存。恢复后再提交。"; render(); return; }
  w.pending = { id: lmId("writing"), text: w.text, taskId: w.taskId }; w.phase = "submitting"; render();
  const id = w.pending.id;
  setTimeout(() => { if (w.pending?.id !== id || w.phase !== "submitting") return; if (LAB.failNext) { LAB.failNext = false; w.phase = "draft"; w.feedback = "提交失败，草稿已保留。可以重试。"; w.pending = null; render(); return; } if (LAB.unknownNext) { LAB.unknownNext = false; w.phase = "unknown"; w.feedback = "本次结果尚未确认。草稿仍在，先查询结果。"; render(); return; } lmWritingResolve(); }, 450);
}
function lmWritingResolve() {
  const w = LM.writing; if (!w.pending || !["unknown", "submitting"].includes(w.phase)) return;
  const p = w.pending, rule = lmWritingRules(p.text), r = lmRecord({ key: p.id, kind: "writing", title: "写作 · 给朋友的一封信", taskId: p.taskId, text: p.text, summary: rule.summary, checks: rule.checks, count: rule.count, self: "", accepted: rule.accepted });
  if (!LM.writes.includes(r.id)) LM.writes.push(r.id); if (rule.accepted) lmFinishTask(p.taskId, r);
  w.resultId = r.id; w.phase = "result"; w.pending = null; w.feedback = ""; render();
}
function lmWritingEdit() { LM.writing.phase = "draft"; LM.writing.pending = null; LM.writing.feedback = ""; render(); }
function lmWritingSelf(value) { const r = LM.records.find(r => r.id === LM.writing.resultId); if (!r) return; r.self = value; LM.writing.self = value; render(); }
V.writing = () => {
  const w = LM.writing, r = LM.records.find(r => r.id === w.resultId);
  if (LM.writingUnavailable) return lmEmpty("写作样例暂不可用", "已保存的草稿与提交记录保留，稍后可继续。", `<button class="btn" onclick="nav('#/history')">查看学习记录</button>`);
  return `<div class="card"><p class="eyebrow">原创练习 · 规则反馈</p><h2>给朋友的一封信</h2><p class="d">邀请 Sam 周末一起学习英语。说明活动、时间，并询问对方是否方便。写 40–100 个英文单词，包含称呼和结束语。</p></div>${w.phase === "result" && r ? `<div class="card"><h2>本次反馈</h2><p class="d">${r.count} 个英文单词 · ${lh(r.summary)}</p><div class="rule-list">${r.checks.map(c => `<p>${c.ok ? "✓" : "待修改："} ${c.title}</p>`).join("")}</div><p class="d">${r.accepted ? "本次提交已完成写作任务。仍可对照参考文本修改表达。" : "请补充未通过的项目，再提交一轮。原提交会保留。"}</p><p class="writing-copy">${lh(r.text)}</p><label class="lb" for="writing-self">我的自评</label><select id="writing-self" onchange="lmWritingSelf(this.value)"><option value="">选择一项</option>${["能独立表达", "还需要参考", "想再修改"].map(v => `<option${r.self === v ? " selected" : ""}>${v}</option>`).join("")}</select><div class="actions"><button class="btn sm primary-action" onclick="lmWritingEdit()">修改后再提交</button><button class="btn sm ghost" onclick="lmTodayRecap()">今日回顾</button></div></div>` : `<div class="card"><label class="lb" for="writing-draft">我的草稿</label><textarea id="writing-draft" rows="10" maxlength="4000" oninput="lmWritingInput()" ${w.phase !== "draft" ? "readonly" : ""} placeholder="Dear Sam,...">${lh(w.text)}</textarea><p class="d" id="writing-count" role="status">${lmWritingRules(w.text).count} 个英文单词 · ${w.text ? "草稿已保存到本机" : "输入后自动保存"}</p>${w.feedback ? `<div class="fb wa" role="status">${lh(w.feedback)}</div>` : ""}${w.phase === "confirm" ? `<p class="d">提交这份草稿并保存一条新记录？只做固定规则检查，你仍可修改。</p><div class="actions"><button class="btn sm primary-action" onclick="lmWritingSubmit()">确认提交</button><button class="btn sm ghost" onclick="lmWritingEdit()">继续修改</button></div>` : w.phase === "unknown" ? `<button class="btn primary-action" onclick="lmWritingResolve()">查询本次结果</button>` : `<button class="btn primary-action" ${w.phase === "submitting" ? "disabled" : ""} onclick="lmWritingConfirm()">${w.phase === "submitting" ? "正在提交…" : "检查并提交"}</button>`}</div>`}<details class="card reference-card"><summary>查看参考文本与检查范围</summary><p class="writing-copy">${lh(LWRITE_REFERENCE)}</p><p class="d">检查单词数、称呼与结束语、活动与时间词。参考文本是固定原创样例，不是自动生成或完整评分。</p></details><div class="card"><h2>历次提交</h2>${lmRecordRows(LM.records.filter(r => LM.writes.includes(r.id)))}</div><button class="btn ghost" onclick="nav('#/today')">保存草稿，返回学习</button>`;
};

/* 课程与词汇发现：按状态、目标、水平筛选，保留明确的内容空态。 */
const LCATALOG = [
  { id: "b1", goal: "college", level: "B1" }, { id: "b2", goal: "foundation", level: "A1" },
  { id: "b3", goal: "college", level: "B2" }, { id: "b4", goal: "workplace", level: "B1" },
  { id: "b5", goal: "college", level: "B2" }, { id: "b6", goal: "foundation", level: "A2" },
  { id: "b7", goal: "graduate", level: "B2" },
  { id: "pending", title: "考研阅读进阶", goal: "graduate", level: "C1", unavailable: true },
];
function lmCourseStatus(c) { if (c.unavailable) return "unavailable"; const b = BOOKS.find(b => b.id === c.id), states = b.toc.map((_, i) => LM.chapters[b.id + ":" + i]); if (states.every(s => s?.done)) return "done"; return states.some(Boolean) ? "active" : "new"; }
function lmDiscoverChange() { LM.discover = { status: document.getElementById("course-status").value, goal: document.getElementById("course-goal").value, level: document.getElementById("course-level").value }; render(); }
function lmSaveCourse(id) { LM.savedCourses = LM.savedCourses.includes(id) ? LM.savedCourses.filter(x => x !== id) : LM.savedCourses.concat(id); render(); }
function lmCourseOpen(id) { if (!BOOKS.some(b => b.id === id)) return; BK.cur = id; nav("#/book"); }
V.courses = () => {
  const f = LM.discover, list = LCATALOG.filter(c => (f.goal === "all" || c.goal === f.goal) && (f.level === "all" || c.level === f.level) && (f.status === "all" || (f.status === "saved" ? LM.savedCourses.includes(c.id) : lmCourseStatus(c) === f.status)));
  return lmStudyNav("courses") + `<div class="card"><h2>发现适合你的内容</h2><p class="d">章节是原创学习片段；书名用于表达学习方向，不提供原书全文。</p><div class="form-grid"><div><label class="lb" for="course-goal">学习目标</label><select id="course-goal" onchange="lmDiscoverChange()"><option value="all">全部目标</option>${Object.entries(LGOALS).map(([v, t]) => `<option value="${v}"${f.goal === v ? " selected" : ""}>${t}</option>`).join("")}</select></div><div><label class="lb" for="course-level">参考水平</label><select id="course-level" onchange="lmDiscoverChange()">${["all", "A1", "A2", "B1", "B2", "C1"].map(l => `<option value="${l}"${f.level === l ? " selected" : ""}>${l === "all" ? "全部水平" : l}</option>`).join("")}</select></div></div><label class="lb" for="course-status">学习状态</label><select id="course-status" onchange="lmDiscoverChange()">${[["all", "全部"], ["active", "在学"], ["saved", "收藏"], ["done", "已完成"], ["new", "未开始"], ["unavailable", "暂无内容"]].map(([v, t]) => `<option value="${v}"${f.status === v ? " selected" : ""}>${t}</option>`).join("")}</select></div>${list.length ? list.map(c => { const b = BOOKS.find(b => b.id === c.id), status = lmCourseStatus(c), done = b?.toc.filter((_, i) => LM.chapters[c.id + ":" + i]?.done).length || 0; return `<div class="card"><div class="section-heading"><h3>${lh(b?.title || c.title)}</h3><span class="tag">${c.level}</span></div><p class="d">${LGOALS[c.goal]} · ${{ active: "在学", done: "已完成", new: "未开始", unavailable: "暂无内容" }[status]}${b ? " · " + done + "/" + b.toc.length + " 节完成" : ""}</p>${c.unavailable ? `<p class="d">此方向暂未提供样例。换一个水平或选择其他课程。</p>` : `<div class="actions"><button class="btn sm primary-action" onclick="lmCourseOpen('${c.id}')">${status === "active" ? "继续课程" : status === "done" ? "查看课程" : "查看章节"}</button><button class="btn sm ghost" aria-pressed="${LM.savedCourses.includes(c.id)}" onclick="lmSaveCourse('${c.id}')">${LM.savedCourses.includes(c.id) ? "★ 已收藏" : "☆ 收藏"}</button></div>`}</div>`; }).join("") : lmEmpty("没有匹配的课程", "试试其他目标、水平或学习状态。", `<button class="btn" onclick="LM.discover={status:'all',goal:'all',level:'all'};render()">清除筛选</button>`)}<div class="card"><h2>技能练习</h2><div class="quick-links"><button class="opt" onclick="nav('#/writing')">写作 ›</button><button class="opt" onclick="nav('#/listening')">听力 ›</button><button class="opt" onclick="nav('#/speaking')">口语 ›</button><button class="opt" onclick="nav('#/collections')">收藏与笔记 ›</button></div></div>`;
};
V.shelf = () => V.courses();
function lmWordSearch() { LM.wordQuery = document.getElementById("word-query").value.trim().toLowerCase(); render(); }
function lmWordOpen(word) { VC.w = word; VC.quizPick = -1; VC.q = ""; nav("#/vocab"); }
V.words = () => {
  const list = vcAll().filter(w => (LM.wordFilter === "all" || (LM.wordFilter === "review" ? SRSQ.some(q => q.w === w.w) : w.book === LM.wordFilter)) && (!LM.wordQuery || w.w.includes(LM.wordQuery) || w.zh.includes(LM.wordQuery)));
  return lmStudyNav("words") + `<div class="card"><h2>词汇学习</h2><p class="d">40 个样例词。认识只是自评，加入复习后可按日期回忆。</p><div class="filter-grid">${[["all", "全部"], ["CET4", "四级"], ["CET6", "六级"], ["review", "已加复习"]].map(([v, t]) => `<button class="mode-button${LM.wordFilter === v ? " is-active" : ""}" aria-pressed="${LM.wordFilter === v}" onclick="LM.wordFilter='${v}';render()">${t}</button>`).join("")}</div><label class="lb" for="word-query">查找单词或释义</label><input id="word-query" value="${lh(LM.wordQuery)}" placeholder="例如 abandon / 抛弃"><div class="actions"><button class="btn sm" onclick="lmWordSearch()">查找</button><button class="btn sm ghost" onclick="nav('#/wordbook')">开始刷词</button></div></div><div class="card"><h2>${list.length} 个匹配词</h2>${list.map(w => `<button class="opt record-row" onclick="lmWordOpen('${w.w}')"><span><b>${w.w}</b><span class="d">${lh(w.zh)} · ${w.book === "CET4" ? "四级" : "六级"}${SRSQ.some(q => q.w === w.w) ? " · 已加复习" : ""}</span></span><span>›</span></button>`).join("") || `<p class="d">没有匹配词，换一个搜索词试试。</p>`}</div><div class="actions"><button class="btn sm ghost" onclick="nav('#/phonics')">音标学习</button><button class="btn sm ghost" onclick="nav('#/alphabet')">字母学习</button></div>`;
};
V.wordbook = () => `<div class="card"><h2>选择一组词汇</h2><p class="d">自评认识，或加入复习。每轮完成后会保存回忆记录。</p><button class="opt" onclick="wset('CET4')">四级词汇 · 20 词 ›</button><button class="opt" onclick="wset('CET6')">六级词汇 · 20 词 ›</button></div><button class="btn ghost" onclick="nav('#/words')">返回词汇学习</button>`;
V.speaking = () => { const modes = { read: ["跟读", "Could you help me check this report?", "你能帮我检查这份报告吗？"], translate: ["口头翻译", "Let's meet at the library on Saturday morning.", "我们周六上午在图书馆见面。"], role: ["角色练习", "Thank you for your time. Could we discuss the next step?", "感谢你抽时间。我们可以讨论下一步吗？"] }, key = LM.speakingMode || "read", m = modes[key]; return `<div class="card"><h2>口语练习</h2><label class="lb" for="speaking-mode">练习方式</label><select id="speaking-mode" onchange="LM.speakingMode=this.value;render()">${Object.entries(modes).map(([v, a]) => `<option value="${v}"${v === key ? " selected" : ""}>${a[0]}</option>`).join("")}</select><p class="reading-passage">${m[1]}</p><p class="d">${m[2]}</p><p class="d">朗读使用系统语音。先自己说一遍，再对照文字；这里不录音、不生成发音分数。</p><div class="actions"><button class="btn sm" onclick="speak('${m[1]}')">听示范</button><button class="btn sm primary-action" onclick="lmSpeakingComplete()">记录本次自练</button></div></div><div class="actions"><button class="btn sm ghost" onclick="nav('#/courses')">返回课程</button><button class="btn sm ghost" onclick="nav('#/history')">练习记录</button></div>`; };
function lmSpeakingComplete() { const titles = { read: "跟读", translate: "口头翻译", role: "角色练习" }; const r = lmRecord({ kind: "speaking", title: "口语自练 · " + titles[LM.speakingMode || "read"] }); LM.resultId = r.id; nav("#/result"); }
function lmListeningSelect() { lstop(); lsel(Number(document.getElementById("listening-material").value)); }
function lmListeningComplete() { const m = LSM.mats[LSM.cur]; if (LSM.quizPick < 0 || LSM.quizPick2 < 0) { toast("先完成两道材料理解题"); return; } const answers = [m.q, m.q2].map((q, i) => { const sel = i ? LSM.quizPick2 : LSM.quizPick; return { stem: q.s, chosen: q.o[sel], correct: q.o[q.a], why: "对照材料中的信息。", ok: sel === q.a }; }); const r = lmRecord({ kind: "listening", title: "听力材料理解 · " + m.title, right: answers.filter(a => a.ok).length, total: 2, answers }); LM.resultId = r.id; lstop(); nav("#/result"); }
V.listening = () => {
  const m = LSM.mats[LSM.cur]; return `<div class="card"><h2>听力练习</h2><p class="d">系统语音朗读样例。完成后保存的是材料理解结果，不是正式听力水平。</p><label class="lb" for="listening-material">材料</label><select id="listening-material" onchange="lmListeningSelect()">${LSM.mats.map((x, i) => `<option value="${i}"${LSM.cur === i ? " selected" : ""}>${x.lv} · ${x.title}</option>`).join("")}</select><label class="lb" for="listening-speed">语速</label><select id="listening-speed" onchange="lrate(Number(this.value))">${[.5, .75, 1, 1.25, 1.5, 2].map(v => `<option value="${v}"${LSM.rate === v ? " selected" : ""}>${v} 倍</option>`).join("")}</select><div class="actions"><button class="btn sm primary-action" onclick="${LSM.playing ? "lstop()" : "lplay()"}">${LSM.playing ? "停止朗读" : "播放材料"}</button><button class="btn sm ghost" aria-pressed="${LSM.showSub}" onclick="lsub()">${LSM.showSub ? "隐藏字幕" : "显示字幕"}</button></div>${LSM.showSub ? `<p class="reading-passage">${lh(m.en)}</p><p class="d">${lh(m.zh)}</p>` : `<p class="d">字幕已隐藏，先听一遍再答题。</p>`}</div><div class="card"><h2>材料理解</h2>${[m.q, m.q2].map((q, i) => `<p class="reading-passage">${q.s}</p><div class="choice-list">${q.o.map((o, k) => `<button class="opt${(i ? LSM.quizPick2 : LSM.quizPick) === k ? " sel" : ""}" aria-pressed="${(i ? LSM.quizPick2 : LSM.quizPick) === k}" onclick="${i ? "LSM.quizPick2=" + k + ";render()" : "lquizPick(" + k + ")"}">${"ABC"[k]}. ${o}</button>`).join("")}</div>`).join("")}<button class="btn primary-action" onclick="lmListeningComplete()">保存本次理解结果</button></div><div class="actions"><button class="btn sm ghost" onclick="nav('#/courses')">返回课程</button><button class="btn sm ghost" onclick="nav('#/history')">练习记录</button></div>`;
};
function dzhan(know) {
  const item = wlist()[DR.i]; if (!item) return; if (know) DR.known++; else srsAddWord(item[0]);
  LM.wordSeen ||= []; LM.wordSeen.push({ stem: item[0], chosen: know ? "自评认识" : "加入复习", correct: item[2], why: "自评不计入答题正确率。", ok: know }); DR.i++; DR.show = false; DR.quizPick = -1; DR.quizDone = false;
  const target = LM.wordTask ? 3 : wlist().length;
  if (LM.wordSeen.length >= target || DR.i >= wlist().length) { const r = lmRecord({ kind: "words", title: "词汇回忆 · " + LM.wordSeen.length + " 个词", answers: LM.wordSeen.slice(), selfKnown: LM.wordSeen.filter(x => x.ok).length }); lmFinishTask(LM.wordTask, r); LM.wordTask = null; LM.wordSeen = []; LM.resultId = r.id; nav("#/result"); }
  else render();
}
function wset(book) { LM.wordTask = null; LM.wordSeen = []; DR.book = book; DR.i = 0; DR.known = 0; DR.show = false; DR.quizPick = -1; DR.quizDone = false; DR.mode = "zhan"; nav("#/drill"); }
/* 同源成长与周报；不再用人工 +1 或固定排行榜成绩替代学习事实。 */
function lmWeekDates() { const today = lmDate(), day = new Date(today + "T12:00:00").getDay(); return Array.from({ length: 7 }, (_, i) => lmAddDate(today, i - ((day + 6) % 7))); }
function checkinCard() { return `<div class="card checkin-card"><div class="card-heading"><h2>本周学习</h2><button class="icon-button" aria-label="查看本周回顾" onclick="nav('#/weekly')">${CHEV}</button></div><div class="week-summary">${lmWeekDates().map(d => `<div><span>${LDAY_NAMES[new Date(d + "T12:00:00").getDay()]}</span><b class="${lmStats(d).count ? "studied" : ""}">${lmStats(d).count ? "✓" : "·"}</b></div>`).join("")}</div><p class="d">完成的学习自动记录；点右上角查看每天的结果。</p></div>`; }
V.weekly = () => { const dates = lmWeekDates(), rows = LM.records.filter(r => dates.includes(r.date)); return `<div class="card"><h2>本周回顾</h2><p class="d">${dates[0]} — ${dates[6]}</p><div class="metrics"><div><strong>${dates.filter(d => lmStats(d).count).length}</strong><span>学习天数</span></div><div><strong>${rows.length}</strong><span>完成记录</span></div><div><strong>${dates.reduce((n, d) => n + lmStats(d).xp, 0)}</strong><span>本周 XP</span></div></div><p class="d">统计来自本机学习记录；没有记录的日期不填入演示成绩。</p></div><div class="card"><h2>每天的学习</h2>${dates.map(d => `<button class="opt record-row" onclick="LM.recapDate='${d}';nav('#/recap')"><span><b>${d.slice(5)} · 周${LDAY_NAMES[new Date(d + "T12:00:00").getDay()]}</b><span class="d">${lmStats(d).count} 条完成记录 · ${lmStats(d).xp} XP</span></span><span>›</span></button>`).join("")}</div><button class="btn ghost" onclick="nav('#/history')">全部学习记录</button>`; };
V.world = () => { const dates = lmWeekDates(), xp = dates.reduce((n, d) => n + lmStats(d).xp, 0), total = [...new Set(LM.records.map(r => r.date))].reduce((n, d) => n + lmStats(d).xp, 0); return `<div class="card"><p class="eyebrow">学习带来的成长</p><h2>每一步都有收获</h2><div class="metrics"><div><strong>${xp}</strong><span>本周 XP</span></div><div><strong>${total}</strong><span>累计 XP</span></div><div><strong>${LM.records.filter(r => !r.imported).length}</strong><span>完成学习</span></div></div><div class="entry-list"><button class="opt" onclick="nav('#/weekly')">本周回顾 ›</button><button class="opt" onclick="nav('#/achieve')">成就样例 ›</button><button class="opt" onclick="nav('#/league')">联赛样例 ›</button></div></div>${checkinCard()}<div class="card"><h2>一起坚持</h2><p class="d">小组目标：本周完成 3 次学习。你的贡献来自学习记录。</p><p class="d">已贡献 ${Math.min(3, LM.records.filter(r => dates.includes(r.date) && !r.imported).length)}/3 次</p><button class="btn sm ghost" onclick="nav('#/space')">我的空间</button></div>`; };
V.league = () => { const xp = lmWeekDates().reduce((n, d) => n + lmStats(d).xp, 0), rows = [{ name: "星河（样例）", xp: 280 }, { name: "小林（样例）", xp: 190 }, { name: S.user, xp }].sort((a, b) => b.xp - a.xp); return `<div class="card"><h2>本周联赛样例</h2><p class="d">其他成员为固定样例，你的本周 XP 来自本机学习记录。</p>${rows.map((r, i) => `<div class="list-row"><b>${i + 1}. ${lh(r.name)}</b><span>${r.xp} XP</span></div>`).join("")}</div>`; };
V.me = () => `<div class="card"><p class="eyebrow">本机演示档案</p><h2>${lh(S.user)}</h2><p class="d">${lmGoalLabel()} · ${lmLevel()}</p><button class="btn sm ghost" onclick="nav('#/onboard')">调整学习目标</button></div><div class="card entry-list"><h2>我的学习</h2><button class="opt" onclick="nav('#/history')">学习记录 ›</button><button class="opt" onclick="nav('#/plan')">学习计划 ›</button><button class="opt" onclick="nav('#/collections')">收藏与笔记 ›</button><button class="opt" onclick="nav('#/mastery')">巩固进度 ›</button></div><div class="card entry-list"><h2>设置与帮助</h2><button class="opt" onclick="nav('#/settings')">设置 ›</button><button class="opt" onclick="nav('#/msgs')">消息 ›</button><button class="opt" onclick="nav('#/support')">帮助与反馈 ›</button><button class="opt" onclick="nav('#/about')">关于与说明 ›</button><button class="opt" onclick="nav('#/lab')">原型演示工具 ›</button></div>`;
V.settings = () => `<div class="card"><h2>学习偏好</h2><p class="d">${lmGoalLabel()} · 每天 ${LM.plan.minutes} 分钟 · 每周 ${LM.plan.days.length} 天</p><button class="btn sm primary-action" onclick="nav('#/plan')">预览计划调整</button></div><div class="card"><h2>显示</h2><div class="filter-grid theme-picker">${[["follow", "跟随系统"], ["light", "浅色"], ["dark", "深色"]].map(([v, t]) => `<button class="mode-button${SET.theme === v ? " is-active" : ""}" aria-pressed="${SET.theme === v}" onclick="SET.theme='${v}';render()">${t}</button>`).join("")}</div><button class="opt" onclick="nav('#/a11y')">字号、对比与动效 ›</button><p class="d">界面语言：中文 · 学习语言：英语</p></div><div class="card entry-list"><h2>通知、账号与隐私</h2><button class="opt" onclick="nav('#/npref')">通知偏好 ›</button><button class="opt" onclick="nav('#/devices')">设备管理 ›</button><button class="opt" onclick="nav('#/privacy')">隐私设置 ›</button><button class="opt" onclick="nav('#/cupgrade')">同意记录 ›</button><button class="btn ghost" onclick="arm(this,function(){S.user=null;nav('#/login')})">退出登录</button></div>`;
/* 故障/时间推进仅在 lab。日期推进保留历史，清楚显示当前演示日期。 */
const LLEGACY_LAB = V.lab;
function lmAdvanceDay(shift) { LM.offset += shift; lmEnsureDay(); SRS.phase = "idle"; LM.mistakeId = null; toast("演示日期：" + lmDate()); render(); }
function labToday(mode) {
  LM.day = lmDate(); PR.taskId = null; SRS.phase = "idle";
  if (mode === "noplan") { S.plan = false; S.today = []; }
  else if (mode === "empty") { S.plan = true; S.today = []; SRSQ.forEach(q => { q.done = true; q.due = lmAddDate(lmDate(), 1); }); }
  else { S.plan = true; S.today = []; lmApplyPlan(LM.plan, "keep"); srsSeed(); SRSQ.forEach(q => { q.due = lmDate(); q.source = "演示工具样例"; q.interval = 0; }); if (mode === "done") S.today.forEach(t => { t.done = true; const r = lmRecord({ kind: "sample", imported: true, title: t.t, estimated: t.min }); t.recordId = r.id; }); }
  render();
}
V.lab = () => `<div class="card"><h2>六能力演示工具</h2><p class="d">当前演示日期 ${lmDate()}${LM.offset ? "（已偏移 " + LM.offset + " 天）" : ""}。普通学习页不能提前通过延迟验证。</p><div class="actions"><button class="btn sm" onclick="lmAdvanceDay(1)">演示日期 +1 天</button><button class="btn sm" onclick="lmAdvanceDay(6)">演示日期 +6 天</button><button class="btn sm ghost" onclick="lmAdvanceDay(-LM.offset)">恢复真实日期</button><button class="btn sm ghost" onclick="LM.writingUnavailable=!LM.writingUnavailable;render()">写作空态：${LM.writingUnavailable ? "开" : "关"}</button></div><button class="opt" onclick="S.staff=!S.staff;render()">管理身份预览：${S.staff ? "开" : "关"}</button><div class="actions"><button class="btn sm ghost" onclick="nav('#/ai')">AI 能力预览</button><button class="btn sm ghost" onclick="nav('#/k12')">青少年阶段说明</button><button class="btn sm ghost" onclick="nav('#/admin')">后台样例</button></div></div>` + LLEGACY_LAB();

bootMock();
