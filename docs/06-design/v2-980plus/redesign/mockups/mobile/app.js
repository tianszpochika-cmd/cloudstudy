/* 语学星移动端整机交互稿 · 静态数据 · 无后端 */
const S = {
  user: null, gate: "NONE", consents: {}, goal: null, quiz: { i: 0, score: 0, sel: null, done: false },
  mistakes: [], plan: false, today: [{ id: "t1", t: "语法 · There ___ two books.", min: 5, kind: "grammar" }, { id: "t2", t: "阅读 · 图书馆", min: 5, kind: "reading" }],
  shelf: ["四级词汇 B1", "零基础 A1", "六级 B2", "商务口语", "雅思备考", "生活英语"],
  msgs: [{ t: "欢迎来到语学星", d: "先定级，3 分钟出报告", read: false }, { t: "今日任务已生成", d: "语法 2 道", read: false }],
  streak: 1, consentV: "b30-consent-v1",
};
const BANK = [
  { s: "Choose the word closest in meaning to 'happy'.", o: ["glad", "angry", "tired"], a: 0, dim: "词汇" },
  { s: "She ___ to school every day.", o: ["go", "goes", "going"], a: 1, dim: "语法" },
  { s: "There ___ two books on the desk.", o: ["is", "are", "am"], a: 1, dim: "语法" },
  { s: "Li Lei gets up at six thirty. What time does he get up?", o: ["six thirty", "seven", "eight"], a: 0, dim: "阅读" },
  { s: "读下面这段并作答：It is sunny today. What do they do after school?", o: ["swim", "play football", "read"], a: 1, dim: "听力" },
];
const TITLES = { login: "登录", register: "注册", reset: "重置密码", gate: "身份确认", onboard: "学习目标", placement: "定级测评", report: "测评报告", home: "首页", today: "今日任务", courses: "书架", practice: "练题", mistakes: "错题本", srs: "复习", weekly: "学习报告", world: "世界", avatar: "装扮", msgs: "消息", me: "我的", settings: "设置", devices: "设备", privacy: "隐私", support: "客服", search: "搜索", commerce: "商城", admin: "管理", adraft: "建稿送审", areview: "双签审核", apublish: "发布回滚", agov: "治理风控", aaudit: "审计", ai: "AI 伴学", voice: "语音跟读", k12: "青少年模式", pay: "收银台" };
const TABS = ["home", "today", "world", "me"];
function toast(m) { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2200); }
function goBack() { if (history.length > 1) history.back(); else location.hash = "#/home"; }
function nav(h) { location.hash = h; }
function needAuth() { if (!S.user) { toast("请先登录"); nav("#/login"); return false; } return true; }
function needReady() { if (!needAuth()) return false; if (S.gate !== "PASS") { toast("身份确认中，先逛逛"); nav("#/gate"); return false; } return true; }

/* ---------- 屏 ---------- */
const V = {};
V.login = () => `<div class="card"><h2>欢迎回来</h2><p class="d">账号密码登录，失败不枚举。</p><label class="lb">账号</label><input id="li" value="t-learner-01@test.invalid"><label class="lb">密码</label><input id="lp" type="password" value="••••••••"><button class="btn" onclick="doLogin()">登录</button><button class="btn ghost" onclick="nav('#/register')">去注册</button><button class="btn ghost" onclick="nav('#/reset')">忘记密码</button></div>`;
V.register = () => `<div class="card"><h2>注册</h2><p class="d">201 即成功，只建账号，不开学习能力。</p><label class="lb">账号（邮箱）</label><input id="ri" value="new@test.invalid"><label class="lb">密码（≥8 位，字母+数字）</label><input id="rp" type="password" value="Test1234!xQ"><button class="btn" onclick="doRegister()">注册</button><button class="btn ghost" onclick="nav('#/login')">已有账号登录</button></div>`;
V.reset = () => `<div class="card"><h2>重置密码</h2><p class="d">如果账号存在，邮件已发出（永远这句，不枚举）。</p><label class="lb">账号</label><input value="new@test.invalid"><button class="btn" onclick="toast('如果账号存在，邮件已发出')">发送重置邮件</button><button class="btn ghost" onclick="goBack()">返回</button></div>`;
V.gate = () => `<div class="card"><h2>先讲一句：为什么要生日</h2><p class="d">语学星只服务成年人，确认一下就放行。</p><label class="lb">出生年份</label><input id="by" type="number" value="1995"><label class="lb" style="margin-top:8px"><input type="checkbox" id="cf" checked style="width:auto"> 我已满 18 岁</label><button class="btn" onclick="doGate()">确认身份</button></div><div class="card"><h2>三项同意</h2><p class="d">版本动态读取（演示 ${S.consentV}）。可选项不预勾。</p>${["TERMS 服务条款", "PRIVACY 隐私说明", "ADULT_LEARNING 成人学习"].map((t, i) => `<label class="lb" style="font-weight:400"><input type="checkbox" class="ag" checked style="width:auto"> ${t}</label>`).join("")}<button class="btn" onclick="doConsents()">签署并继续</button></div>`;
V.onboard = () => `<div class="card"><h2>定个小目标</h2><p class="d">先选一个，一周后可换。存完按钮去定级，不回首页。</p><label class="lb">目标</label><select id="g"><option value="CET_4_6">大学英语四级 · B1</option><option value="ZERO_BASIS">零基础 · A1</option><option value="CET_6">六级 · B2</option></select><label class="lb">每天分钟</label><select id="m"><option>15</option><option>30</option><option>45</option></select><button class="btn" onclick="doGoal()">保存，去定级 →</button></div>`;
V.placement = () => { const q = BANK[S.quiz.i]; return `<div class="meta">第 ${S.quiz.i + 1}/${BANK.length} 题 · ${q.dim} · 提交中禁用 · 断网存本地</div><div class="prog"><i style="width:${(S.quiz.i / BANK.length) * 100}%"></i></div><div class="card"><h2>${q.s}</h2><div id="qo">${q.o.map((t, k) => `<button class="opt" data-k="${k}" onclick="pick(${k})">${"ABC"[k]}. ${t}</button>`).join("")}</div><div class="fb" id="qfb"></div><div class="row" style="display:flex;gap:8px"><button class="btn ghost" style="flex:1" onclick="qNext()">下一题 →</button><button class="btn" style="flex:1" onclick="qSubmit()">提交</button></div></div>`; };
V.report = () => `<div class="card" style="text-align:center;background:linear-gradient(135deg,#5b2fd6,#8b5cf6);color:#fff;border:0"><b style="font-size:44px">B1</b><div>定级完成 · ${S.quiz.score}/${BANK.length}</div></div><div class="card"><h2>维度</h2>${[["词汇", 80], ["语法", 60], ["阅读", 70], ["听力", 50]].map(([t, v]) => `<div class="dim"><span class="v">${t} ${v}</span><span class="bar w"><i style="width:${v}%"></i></span></div>`).join("")}</div><div class="card"><h2>💡 教练建议</h2><p class="d">词汇不错，语法补两周，每天 10 分钟，今日任务已排好。</p><button class="btn" onclick="S.plan=true;toast('计划已生成');nav('#/home')">生成我的计划 →</button></div>`;
V.home = () => `${S.plan ? `<div class="banner"><b>📋 本周计划：${S.goal || "四级词汇 B1"}</b><p>因为你定级词汇不错、语法待补，所以这周每天 15 分钟：词汇 5 + 语法 10。</p></div>` : `<div class="card empty"><b>还没有计划</b><p class="d">定级 3 分钟，生成你的计划</p><button class="btn" onclick="nav('#/placement')">去定级 →</button></div>`}<div class="card"><h2>📚 今日任务（${S.today.length}）</h2><p class="d">${S.today.length ? "语法阅读 · 预计 10 分钟" : "今天没任务啦 🎉"}</p><button class="btn" onclick="nav('#/today')">${S.today.length ? "开始今日 →" : "去看看"}</button></div><div class="card"><h2>📖 书架</h2><p class="d">${S.shelf.length} 门演示课 · 上次学到第 2 节</p><button class="btn ghost" onclick="nav('#/courses')">继续学习 →</button></div><div class="card"><h2>🎯 打卡</h2><div class="cal">${["一", "二", "三", "四", "五", "六", "日"].map(d => `<span>${d}</span>`).join("")}${[1, 0, 0, 0, 0, 0, 0].map(h => `<span class="${h ? "hit" : ""}">${h ? "✓" : "·"}</span>`).join("")}</div></div>`;
V.today = () => S.today.length ? `<h2 style="margin:0 0 10px">📚 今日任务</h2>` + S.today.map(t => `<div class="card"><b>${t.t}</b><p class="d">${t.min} 分钟 · 练题判分</p><button class="btn sm" onclick="nav('#/practice')">开始 →</button></div>`).join("") : `<div class="card empty"><b>今天没任务啦 🎉</b><p class="d">去书架逛逛，或再测一次</p><button class="btn sm" onclick="nav('#/courses')">去书架</button> <button class="btn sm" onclick="nav('#/placement')">再测一次</button></div>`;
V.courses = () => `<h2 style="margin:0 0 10px">📖 书架</h2>` + S.shelf.map((c, i) => `<div class="card"><b>${c}</b><p class="d">${i === 0 ? "上次学到第 2 节" : "未开始"}</p><button class="btn sm" onclick="nav('#/practice')">${i === 0 ? "继续 →" : "开始 →"}</button></div>`).join("");
V.practice = () => `<div class="meta">语法 · 行内判分不跳页</div><div class="card"><h2>There ___ two books on the desk.</h2><div id="po"><button class="opt" onclick="ppick(0,this)">A. is</button><button class="opt" onclick="ppick(1,this)">B. are</button><button class="opt" onclick="ppick(2,this)">C. am</button></div><div class="fb" id="pfb"></div><button class="btn" onclick="psubmit()">提交判分</button></div>`;
V.mistakes = () => (S.mistakes.length ? S.mistakes.map(m => `<div class="card"><b>${m.t}</b><p class="d">${m.why}</p><button class="btn sm" onclick="toast('变式题稍后见（演示）')">变式再练 →</button></div>`).join("") : `<div class="card empty"><b>错题本是空的 🎉</b><p class="d">去今日任务做一道，错了会自动进来</p><button class="btn sm" onclick="nav('#/today')">去做题</button></div>`);
V.srs = () => `<div class="card"><h2>复习</h2><p class="d">到期 0 个 · 直写入口已关闭（设计如此）</p><button class="btn ghost" onclick="nav('#/today')">回今日看看</button></div>`;
V.weekly = () => `<div class="card"><h2>学习报告</h2><p class="d">本周 15 分钟 · 新学 10 · 复习 5</p><p class="d">💡 教练建议：保持每天 15 分钟，语法是重点。</p></div>`;
V.world = () => `<div class="card empty"><b>🌍 世界（R2 开放）</b><p class="d">房间、排行、赛季还没开，先好好学习</p><button class="btn sm" onclick="nav('#/avatar')">看看装扮</button></div><div class="card"><h2>🏆 排行榜</h2><p class="d">赛季未开始</p></div>`;
V.avatar = () => `<div class="card"><h2>👕 装扮</h2><p class="d">目录可看，试穿不落库；兑换需权益（未开放）</p><span class="tag">默认卫衣·试穿中</span><span class="tag">星空外套·未开放</span><br><button class="btn sm" onclick="toast('兑换未开放：先完成学习任务')">兑换</button></div>`;
V.msgs = () => `<h2 style="margin:0 0 10px">消息</h2>` + S.msgs.map(m => `<div class="card"><b>${m.t}</b><p class="d">${m.d}</p></div>`).join("");
V.me = () => `<div class="card" style="text-align:center"><b style="font-size:18px">${S.user || "未登录"}</b><p class="d">B1 · 已坚持 1 天</p></div><div class="card">${[["📖 书架", "#/courses"], ["❤️ 错题本", "#/mistakes"], ["🔁 复习", "#/srs"], ["📊 学习报告", "#/weekly"], ["✉️ 消息", "#/msgs"], ["🔍 搜索", "#/search"], ["🛒 商城（空目录）", "#/commerce"], ["🤖 AI 伴学（演示）", "#/ai"], ["🎤 语音跟读", "#/voice"], ["🔒 青少年模式", "#/k12"], ["🛠️ 管理（staff 演示）", "#/admin"], ["⚙️ 设置", "#/settings"]].map(([t, h]) => `<button class="opt" onclick="nav('${h}')">${t} ›</button>`).join("")}</div>`;
V.settings = () => `<div class="card"><h2>设置</h2><p class="d">偏好版本写回读 · 高对比/字体/动效见无障碍</p><button class="opt" onclick="nav('#/devices')">📱 设备 ›</button><button class="opt" onclick="nav('#/privacy')">🔒 隐私 ›</button><button class="opt" onclick="toast('主题已切换（演示）')">🌗 深色模式 ›</button><button class="btn ghost" onclick="S.user=null;toast('已退出');nav('#/login')">退出登录</button></div>`;
V.devices = () => `<div class="card"><h2>设备</h2><p class="d">当前设备：本机浏览器</p><p class="d">另一台 Android · 2 天前 <button class="btn sm" onclick="toast('已踢出（演示）')">踢出</button></p></div>`;
V.privacy = () => `<div class="card"><h2>隐私</h2><p class="d">导出/删除入口（M6）：申请后按进度展示</p><button class="btn sm" onclick="toast('导出申请已提交（演示）')">申请导出</button></div>`;
V.support = () => `<div class="card"><h2>客服</h2><p class="d">提交后只显示编号，客服按编号处理</p><input id="sup" placeholder="一句话描述问题"><button class="btn" onclick="toast('工单已提交，编号 TK-1024（演示）')">提交工单</button></div>`;
V.search = () => `<div class="card"><h2>搜索</h2><input id="q" placeholder="搜课程/帮助" oninput="sres(this.value)"><div id="sr"></div></div>`;
V.commerce = () => `<div class="card empty"><b>🛒 商城</b><p class="d">课程准备中，暂无可购。先去书架学习。</p><button class="btn sm" onclick="nav('#/courses')">去书架</button> <button class="btn sm" onclick="nav('#/pay')">沙盒收银台演示 →</button></div>`;
V.admin = () => `<div class="card"><p class="d">演示：staff 视角（test 档）。双签：申请人禁自审。</p>${[["📝 建稿送审", "#/adraft"], ["✔️ 双签审核", "#/areview"], ["🚀 发布回滚", "#/apublish"], ["🛡️ 治理风控", "#/agov"], ["📜 审计", "#/aaudit"]].map(([t, h]) => `<button class="opt" onclick="nav('${h}')">${t} ›</button>`).join("")}</div>`;
V.adraft = () => `<div class="card"><h2>草稿箱</h2><p class="d">版本锁 · 无权 403 不泄漏存在性</p><div class="card" style="margin:0 0 8px"><b>语法课 · There be 句型（v3）</b><p class="d">版权已绑定 · 报告已绑定 · 缺项：无</p><button class="btn sm" onclick="toast('已送审（演示）')">提交送审</button></div><label class="lb">新建草稿标题</label><input id="dt" value="新课标题"><button class="btn" onclick="toast('草稿已建 202（演示）')">建稿</button></div>`;
V.areview = () => `<div class="card"><h2>L1 初审</h2><p class="d">reviewer-l1 视角</p><button class="btn" onclick="A.l1=true;toast('L1 通过（演示）');paintRev()">通过</button></div><div class="card"><h2>L2 终审</h2><p class="d">reviewer-l2 视角 · 自动 ACTIVE</p><button class="btn" onclick="A.l2=true;toast('L2 通过，已 ACTIVE（演示）');paintRev()">通过并发布</button></div><div class="card"><h2>状态</h2><p class="d" id="revst">L1 待审 · L2 待审</p></div>`;
V.apublish = () => `<div class="card"><h2>发布 / 下线 / 回滚</h2><p class="d">目录实时预览</p><button class="btn sm" onclick="toast('已发布，书架可见（演示）')">发布</button> <button class="btn sm" onclick="toast('已下架（演示）')">下架</button> <button class="btn sm" onclick="toast('已回滚 v1（演示）')">回滚 v1</button></div>`;
V.agov = () => `<div class="card"><h2>治理 · 风险区</h2><p class="d">无独立路由，并入治理页</p><div class="card" style="margin:0"><b>RISK-001 · 刷分嫌疑</b><p class="d">待建档</p><button class="btn sm" onclick="toast('已建档（演示）')">建档</button> <button class="btn sm" onclick="toast('已隔离（演示）')">隔离</button></div></div>`;
V.aaudit = () => `<div class="card"><h2>审计</h2><p class="d">分页 + 脱敏 · 导出 internal-only</p><p class="d">req-9208 · 同意记录 · 允许</p><p class="d">req-6fd9 · 注册门 · 拒绝</p></div>`;
V.ai = () => `<div class="card"><h2>AI 伴学（P2 未开）</h2><p class="d">Gate 未过无 CTA 是设计。演示一次问答：</p><input id="aiq" value="are 和 is 怎么分？"><button class="btn" onclick="document.getElementById('aia').style.display='block'">问</button><div class="card" id="aia" style="display:none;margin:10px 0 0"><b>AI：</b>主语复数用 are。<p class="d">来源：规则库（演示）· 可采纳/重做/降级</p><button class="btn sm" onclick="toast('已采纳（演示）')">采纳</button> <button class="btn sm" onclick="toast('已降级回规则路（演示）')">降级</button></div></div>`;
V.voice = () => `<div class="card"><h2>语音跟读</h2><p class="d">无麦先说，不直接开。RTC 未接，先练跟读：</p><b>“Good morning.”</b><br><button class="btn sm" style="margin-top:8px" onclick="toast('录音 3 秒… 评分 85（演示）')">🎤 跟读评分</button></div>`;
V.k12 = () => `<div class="card empty"><b>青少年模式（上锁）</b><p class="d">该版本仅服务成人。P3 资质齐了再开。</p><button class="btn sm" onclick="goBack()">返回</button></div>`;
V.pay = () => `<div class="card"><h2>收银台（沙盒）</h2><p class="d">Phase 1 基金 · ¥99 · 不扣真款</p><button class="btn" onclick="document.getElementById('payr').style.display='block'">支付 ¥99</button><div class="fb ok" id="payr" style="margin-top:10px">✓ 支付成功（沙盒）· 权益待开通演示</div></div>`;

/* ---------- 动作 ---------- */
function doLogin() { S.user = document.getElementById("li").value || "t-learner-01@test.invalid"; S.gate = S.gate === "NONE" ? "PENDING" : S.gate; toast("登录成功"); nav(S.gate === "PASS" ? "#/home" : "#/gate"); }
function doRegister() { S.user = document.getElementById("ri").value; S.gate = "PENDING"; toast("注册成功（201），先过身份确认"); nav("#/gate"); }
function doGate() { const ag = document.getElementById("cf"); if (!document.getElementById("by").value || !ag.checked) { toast("请填写年份并确认已满 18 岁"); return; } S.gate = "PASS"; toast("身份已确认（演示）"); }
function doConsents() { const a = [...document.querySelectorAll(".ag")]; if (!a.every(x => x.checked)) { toast("三项都要签"); return; } toast("三项已签署"); nav("#/onboard"); }
function doGoal() { S.goal = document.getElementById("g").selectedOptions[0].text; S.quiz = { i: 0, score: 0, sel: null, done: false }; toast("目标已保存"); nav("#/placement"); }
function pick(k) { S.quiz.sel = k; document.querySelectorAll("#qo .opt").forEach((x, j) => x.classList.toggle("sel", j === k)); }
function qSubmit() { const q = BANK[S.quiz.i]; if (S.quiz.sel == null) { toast("先选一个"); return; } const f = document.getElementById("qfb"), ok = S.quiz.sel === q.a; if (ok) S.quiz.score++; else S.mistakes.push({ t: q.s, why: "定位：" + q.dim + "待补" }); f.textContent = ok ? "✓ 对了" : "! 记下了，进错题本，变式稍后见"; f.className = "fb " + (ok ? "ok" : "no"); }
function qNext() { if (S.quiz.i < BANK.length - 1) { S.quiz.i++; render(); } else { S.quiz.done = true; nav("#/report"); } }
let PSEL = null;
const A = { l1: false, l2: false };
function paintRev() { const el = document.getElementById("revst"); if (el) el.textContent = (A.l1 ? "L1 已过" : "L1 待审") + " · " + (A.l2 ? "L2 已过/ACTIVE" : "L2 待审"); }
function ppick(k, el) { PSEL = k; document.querySelectorAll("#po .opt").forEach((x, j) => x.classList.toggle("sel", j === k)); }
function psubmit() { if (PSEL == null) { toast("先选一个"); return; } const f = document.getElementById("pfb"), ok = PSEL === 1; if (!ok) S.mistakes.push({ t: "There ___ two books on the desk.", why: "定位：语法待补" }); f.textContent = ok ? "✓ FULL：主语复数用 are" : "! ZERO：已进错题本"; f.className = "fb " + (ok ? "ok" : "no"); }
function sres(v) { document.getElementById("sr").innerHTML = v ? `<button class="opt" onclick="nav('#/courses')">📖 ${v}相关课程 ›</button><button class="opt" onclick="toast('帮助：重置密码走我的→设置')">❓ ${v}相关帮助 ›</button>` : ""; }

/* ---------- 路由 ---------- */
const AUTH_FREE = ["login", "register", "reset"];
function render() {
  let r = (location.hash || "#/login").replace("#/", "");
  if (!V[r]) r = "login";
  if (!AUTH_FREE.includes(r) && !S.user) r = "login";
  if (["placement", "report"].includes(r) && S.gate !== "PASS" && !S.user) r = "login";
  document.getElementById("title").textContent = TITLES[r] || "语学星";
  document.getElementById("bk").style.visibility = (["login", "home"].includes(r)) ? "hidden" : "visible";
  document.getElementById("tabs").style.display = TABS.includes(r) ? "flex" : "none";
  document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.t === r));
  document.getElementById("view").innerHTML = V[r]();
  document.getElementById("view").scrollTop = 0;
  if (r === "placement" && S.quiz.done) { S.quiz.done = false; }
}
window.addEventListener("hashchange", render);
render();
