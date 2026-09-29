/* 语学星移动端整机交互稿 · 静态数据 · 无后端 */
const S = {
  user: "演示账号", gate: "PASS", consents: {}, goal: null, quiz: { i: 0, score: 0, sel: null, done: false },
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
const TITLES = { login: "登录", register: "注册", reset: "重置密码", gate: "身份确认", onboard: "学习目标", placement: "定级测评", report: "测评报告", home: "首页", today: "今日任务", courses: "书架", practice: "练题", mistakes: "错题本", srs: "复习", weekly: "学习报告", world: "世界", avatar: "装扮", msgs: "消息", me: "我的", settings: "设置", devices: "设备", privacy: "隐私", support: "客服", search: "搜索", commerce: "商城", admin: "管理", adraft: "建稿送审", areview: "双签审核", apublish: "发布回滚", agov: "治理风控", aaudit: "审计", ai: "AI 伴学", voice: "语音跟读", k12: "青少年模式", pay: "收银台", a11y: "无障碍", arrears: "补课提醒", celebrate: "完成撒花", offlinet: "断网今日", pgen: "计划生成中", greject: "门被拒", cupgrade: "同意升级", vocab: "词汇详情", listening: "听力", speaking: "口语", writing: "写作", offpkg: "离线包", refund: "退款开票", phonics: "音标", alphabet: "字母", wordbook: "单词本", drill: "刷单词" };
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
V.placement = () => { const q = BANK[S.quiz.i]; return `<div class="meta">第 ${S.quiz.i + 1}/${BANK.length} 题 · ${q.dim} · 提交中禁用 · 断网存本地</div><div class="prog"><i style="width:${(S.quiz.i / BANK.length) * 100}%"></i></div><div class="card"><h2>${q.s}</h2><div id="qo">${q.o.map((t, k) => `<button class="opt" data-k="${k}" onclick="pick(${k})">${"ABC"[k]}. ${t}</button>`).join("")}</div><div class="fb" id="qfb"></div><div class="row" style="display:flex;gap:8px"><button class="btn ghost" style="flex:1" onclick="qNext()">下一题 →</button><button class="btn" style="flex:1" onclick="qSubmit()">提交</button></div></div>`; };
V.report = () => `<div class="card" style="text-align:center;background:linear-gradient(135deg,#5b2fd6,#8b5cf6);color:#fff;border:0"><b style="font-size:44px">B1</b><div>定级完成 · ${S.quiz.score}/${BANK.length}</div></div><div class="card"><h2>维度</h2>${[["词汇", 80], ["语法", 60], ["阅读", 70], ["听力", 50]].map(([t, v]) => `<div class="dim"><span class="v">${t} ${v}</span><span class="bar w"><i style="width:${v}%"></i></span></div>`).join("")}</div><div class="card"><h2>💡 教练建议</h2><p class="d">词汇不错，语法补两周，每天 10 分钟，今日任务已排好。</p><button class="btn" onclick="S.plan=true;toast('计划已生成');nav('#/home')">生成我的计划 →</button></div>`;
V.home = () => `${S.plan ? `<div class="banner"><b>📋 本周计划：${S.goal || "四级词汇 B1"}</b><p>因为你定级词汇不错、语法待补，所以这周每天 15 分钟：词汇 5 + 语法 10。</p></div>` : `<div class="card empty"><b>还没有计划</b><p class="d">定级 3 分钟，生成你的计划</p><button class="btn" onclick="nav('#/placement')">去定级 →</button></div>`}<div class="card"><h2>⚔️ 刷单词</h2><p class="d">四级/六级词本，进来就刷</p><button class="btn" onclick="nav('#/wordbook')">选词本开刷 →</button></div><div class="card"><h2>🔰 零基础专区</h2><p class="d">从字母和音标开始，不考试</p><button class="btn sm" onclick="nav('#/alphabet')">字母 →</button> <button class="btn sm" onclick="nav('#/phonics')">音标 →</button></div><div class="card"><h2>📚 今日任务（${S.today.length}）</h2><p class="d">${S.today.length ? "语法阅读 · 预计 10 分钟" : "今天没任务啦 🎉"}</p><button class="btn" onclick="nav('#/today')">${S.today.length ? "开始今日 →" : "去看看"}</button></div><div class="card"><h2>📖 书架</h2><p class="d">${S.shelf.length} 门演示课 · 上次学到第 2 节</p><button class="btn ghost" onclick="nav('#/courses')">继续学习 →</button></div><div class="card"><h2>🎯 打卡</h2><div class="cal">${["一", "二", "三", "四", "五", "六", "日"].map(d => `<span>${d}</span>`).join("")}${[1, 0, 0, 0, 0, 0, 0].map(h => `<span class="${h ? "hit" : ""}">${h ? "✓" : "·"}</span>`).join("")}</div></div>`;
V.today = () => (S.today.length ? `<h2 style="margin:0 0 10px">📚 今日任务</h2>` + S.today.map(t => `<div class="card"><b>${t.t}</b><p class="d">${t.min} 分钟 · 练题判分</p><button class="btn sm" onclick="nav('#/practice')">开始 →</button></div>`).join("") : `<div class="card empty"><b>今天没任务啦 🎉</b><p class="d">去书架逛逛，或再测一次</p><button class="btn sm" onclick="nav('#/courses')">去书架</button> <button class="btn sm" onclick="nav('#/placement')">再测一次</button></div>`) + (DEMO ? `<div class="card"><p class="d">状态演示：</p>${[["arrears", "欠账"], ["celebrate", "撒花"], ["offlinet", "断网"], ["pgen", "生成中"]].map(([r, t]) => `<button class="btn sm ghost" onclick="nav('#/${r}')">${t}</button>`).join(" ")}</div>` : ``);
V.courses = () => `<h2 style="margin:0 0 10px">📖 书架</h2>` + S.shelf.map((c, i) => `<div class="card"><b>${c}</b><p class="d">${i === 0 ? "上次学到第 2 节" : "未开始"}</p><button class="btn sm" onclick="nav('#/practice')">${i === 0 ? "继续 →" : "开始 →"}</button></div>`).join("");
V.practice = () => `<div class="meta">语法 · 行内判分不跳页 · 点句子里的单词查词</div><div class="card"><h2 id="pstem">There ___ two books on the desk.</h2><div id="po"><button class="opt" onclick="ppick(0,this)">A. is</button><button class="opt" onclick="ppick(1,this)">B. are</button><button class="opt" onclick="ppick(2,this)">C. am</button></div><div class="fb" id="pfb"></div><button class="btn" onclick="psubmit()">提交判分</button></div><div class="card" id="wd" style="display:none"></div>`;
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
V.mistakes = () => (S.mistakes.length ? S.mistakes.map(m => `<div class="card"><b>${m.t}</b><p class="d">${m.why}</p><button class="btn sm" onclick="toast('变式题稍后见（演示）')">变式再练 →</button></div>`).join("") : `<div class="card empty"><b>错题本是空的 🎉</b><p class="d">去今日任务做一道，错了会自动进来</p><button class="btn sm" onclick="nav('#/today')">去做题</button></div>`);
V.srs = () => `<div class="card"><h2>复习</h2><p class="d">到期 0 个 · 直写入口已关闭（设计如此）</p><button class="btn ghost" onclick="nav('#/today')">回今日看看</button></div>`;
V.weekly = () => `<div class="card"><h2>学习报告</h2><p class="d">本周 15 分钟 · 新学 10 · 复习 5</p><p class="d">💡 教练建议：保持每天 15 分钟，语法是重点。</p></div>`;
V.world = () => `<div class="card empty"><b>🌍 世界（R2 开放）</b><p class="d">房间、排行、赛季还没开，先好好学习</p><button class="btn sm" onclick="nav('#/avatar')">看看装扮</button></div><div class="card"><h2>🏆 排行榜</h2><p class="d">赛季未开始</p></div>`;
V.avatar = () => `<div class="card"><h2>👕 我的背景墙＋小人</h2><p class="d">Three.js 演示：换服装/配饰/发型＋打招呼（低端机自动降画质）</p><div id="t3d" style="width:100%;height:300px;border-radius:12px;overflow:hidden;background:#1c1430"></div><p class="d">上衣：<button class="btn sm" onclick="dress('shirt','#5b2fd6')">紫</button> <button class="btn sm" onclick="dress('shirt','#1d9e6b')">绿</button> <button class="btn sm" onclick="dress('shirt','#d64545')">红</button></p><p class="d">发型：<button class="btn sm" onclick="dress('hair','round')">圆寸</button> <button class="btn sm" onclick="dress('hair','cap')">帽子</button>　配饰：<button class="btn sm" onclick="dress('acc','glasses')">眼镜</button> <button class="btn sm" onclick="dress('acc','none')">无</button></p><p class="d">背景墙：<button class="btn sm" onclick="dress('wall','#1c1430')">星夜</button> <button class="btn sm" onclick="dress('wall','#0e3b2e')">森林</button> <button class="btn sm" onclick="dress('wall','#3b1d0e')">沙漠</button></p><button class="btn" onclick="wave()">👋 打招呼</button></div><div class="card"><h2>衣柜</h2><p class="d">目录可看，试穿不落库；兑换需权益（未开放）</p><span class="tag">默认卫衣·试穿中</span><span class="tag">星空外套·未开放</span><br><button class="btn sm" onclick="toast('兑换未开放：先完成学习任务')">兑换</button></div>`;
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
  if (part === "shirt") T3.M.body.material.color.set(v);
  if (part === "hair") { const cap = v === "cap"; T3.M.cap.visible = cap; T3.M.hair.visible = !cap; }
  if (part === "acc") T3.M.glasses.visible = v === "glasses";
  if (part === "wall") { T3.scene.background.set(v); T3.ground.material.color.set(v); }
}
function wave() { if (T3) T3.waving = 40; else toast("3D 还没加载好"); }
V.msgs = () => `<h2 style="margin:0 0 10px">消息</h2>` + S.msgs.map(m => `<div class="card"><b>${m.t}</b><p class="d">${m.d}</p></div>`).join("");
V.me = () => `<div class="card" style="text-align:center"><b style="font-size:18px">${S.user || "未登录"}</b><p class="d">B1 · 已坚持 1 天</p></div><div class="card">${[["📖 书架", "#/courses"], ["❤️ 错题本", "#/mistakes"], ["🔁 复习", "#/srs"], ["📊 学习报告", "#/weekly"], ["✉️ 消息", "#/msgs"], ["🔍 搜索", "#/search"], ["🛒 商城（空目录）", "#/commerce"], ["🤖 AI 伴学（演示）", "#/ai"], ["🎤 语音跟读", "#/voice"], ["🔒 青少年模式", "#/k12"], ["🛠️ 管理（staff 演示）", "#/admin"], ["♿ 无障碍", "#/a11y"], ["🔤 音标", "#/phonics"], ["🔠 字母", "#/alphabet"], ["📖 词汇详情", "#/vocab"], ["🎧 听力", "#/listening"], ["🎙️ 口语", "#/speaking"], ["✍️ 写作", "#/writing"], ["📦 离线包", "#/offpkg"], ["🧾 退款开票", "#/refund"], ["⚙️ 设置", "#/settings"], ...(DEMO ? [["🧪 更多状态屏", "#/arrears"], ["⛔ 门被拒", "#/greject"], ["📄 同意升级", "#/cupgrade"]] : [])].map(([t, h]) => `<button class="opt" onclick="nav('${h}')">${t} ›</button>`).join("")}</div>`;
V.settings = () => `<div class="card"><h2>设置</h2><p class="d">偏好版本写回读 · 高对比/字体/动效见无障碍</p><button class="opt" onclick="nav('#/devices')">📱 设备 ›</button><button class="opt" onclick="nav('#/privacy')">🔒 隐私 ›</button><button class="opt" onclick="toast('主题已切换（演示）')">🌗 深色模式 ›</button><button class="btn ghost" onclick="arm(this,function(){S.user=null;toast('已退出');nav('#/login')})">退出登录</button></div>`;
V.devices = () => `<div class="card"><h2>设备</h2><p class="d">当前设备：本机浏览器</p><p class="d">另一台 Android · 2 天前 <button class="btn sm" onclick="arm(this,function(){toast('已踢出（演示）')})">踢出</button></p></div>`;
V.privacy = () => `<div class="card"><h2>隐私</h2><p class="d">导出/删除入口（M6）：申请后按进度展示</p><button class="btn sm" onclick="toast('导出申请已提交（演示）')">申请导出</button> <button class="btn sm" onclick="arm(this,function(){document.getElementById('delr').style.display='block'})">申请删除</button><div class="fb wa" id="delr" style="display:none;margin-top:10px">已受理 · 旧 token 即刻失效，数据逐服务清理后给回执（演示）</div></div>`;
V.support = () => `<div class="card"><h2>客服</h2><p class="d">提交后只显示编号，客服按编号处理</p><input id="sup" placeholder="一句话描述问题"><button class="btn" onclick="toast('工单已提交，编号 TK-1024（演示）')">提交工单</button></div>`;
V.search = () => `<div class="card"><h2>搜索</h2><input id="q" placeholder="搜课程/帮助" oninput="sres(this.value)"><div id="sr"></div></div>`;
V.commerce = () => `<div class="card empty"><b>🛒 商城</b><p class="d">课程准备中，暂无可购。先去书架学习。</p><button class="btn sm" onclick="nav('#/courses')">去书架</button> <button class="btn sm" onclick="nav('#/pay')">沙盒收银台演示 →</button></div>`;
V.admin = () => `<div class="card"><p class="d">演示：staff 视角（test 档）。双签：申请人禁自审。</p>${[["📝 建稿送审", "#/adraft"], ["✔️ 双签审核", "#/areview"], ["🚀 发布回滚", "#/apublish"], ["🛡️ 治理风控", "#/agov"], ["📜 审计", "#/aaudit"]].map(([t, h]) => `<button class="opt" onclick="nav('${h}')">${t} ›</button>`).join("")}</div>`;
V.adraft = () => `<div class="card"><h2>草稿箱</h2><p class="d">版本锁 · 无权 403 不泄漏存在性</p><div class="card" style="margin:0 0 8px"><b>语法课 · There be 句型（v3）</b><p class="d">版权已绑定 · 报告已绑定 · 缺项：无</p><button class="btn sm" onclick="toast('已送审（演示）')">提交送审</button></div><label class="lb">新建草稿标题</label><input id="dt" value="新课标题"><button class="btn" onclick="toast('草稿已建 202（演示）')">建稿</button></div>`;
V.areview = () => `<div class="card"><h2>L1 初审</h2><p class="d">reviewer-l1 视角</p><button class="btn" onclick="A.l1=true;toast('L1 通过（演示）');paintRev()">通过</button></div><div class="card"><h2>L2 终审</h2><p class="d">reviewer-l2 视角 · 自动 ACTIVE</p><button class="btn" onclick="A.l2=true;toast('L2 通过，已 ACTIVE（演示）');paintRev()">通过并发布</button></div><div class="card"><h2>状态</h2><p class="d" id="revst">L1 待审 · L2 待审</p></div>`;
V.apublish = () => `<div class="card"><h2>发布 / 下线 / 回滚</h2><p class="d">目录实时预览</p><button class="btn sm" onclick="toast('已发布，书架可见（演示）')">发布</button> <button class="btn sm" onclick="arm(this,function(){toast('已下架（演示）')})">下架</button> <button class="btn sm" onclick="arm(this,function(){toast('已回滚 v1（演示）')})">回滚 v1</button></div>`;
V.agov = () => `<div class="card"><h2>治理 · 风险区</h2><p class="d">无独立路由，并入治理页</p><div class="card" style="margin:0"><b>RISK-001 · 刷分嫌疑</b><p class="d">待建档</p><button class="btn sm" onclick="toast('已建档（演示）')">建档</button> <button class="btn sm" onclick="toast('已隔离（演示）')">隔离</button></div></div>`;
V.aaudit = () => `<div class="card"><h2>审计</h2><p class="d">分页 + 脱敏 · 导出 internal-only</p><p class="d">req-9208 · 同意记录 · 允许</p><p class="d">req-6fd9 · 注册门 · 拒绝</p></div>`;
V.ai = () => `<div class="card"><h2>AI 伴学（P2 未开）</h2><p class="d">Gate 未过无 CTA 是设计。演示一次问答：</p><input id="aiq" value="are 和 is 怎么分？"><button class="btn" onclick="document.getElementById('aia').style.display='block'">问</button><div class="card" id="aia" style="display:none;margin:10px 0 0"><b>AI：</b>主语复数用 are。<p class="d">来源：规则库（演示）· 可采纳/重做/降级</p><button class="btn sm" onclick="toast('已采纳（演示）')">采纳</button> <button class="btn sm" onclick="toast('已降级回规则路（演示）')">降级</button></div></div>`;
V.voice = () => `<div class="card"><h2>语音跟读</h2><p class="d">无麦先说，不直接开。RTC 未接，先练跟读：</p><b>“Good morning.”</b><br><button class="btn sm" style="margin-top:8px" onclick="toast('录音 3 秒… 评分 85（演示）')">🎤 跟读评分</button></div>`;
V.k12 = () => `<div class="card empty"><b>青少年模式（上锁）</b><p class="d">该版本仅服务成人。P3 资质齐了再开。</p><button class="btn sm" onclick="goBack()">返回</button></div>`;
V.pay = () => `<div class="card"><h2>收银台（沙盒）</h2><p class="d">Phase 1 基金 · ¥99 · 不扣真款 · 金额二次确认</p><button class="btn" onclick="arm(this,function(){var r=document.getElementById('payr');r.className='fb ok';r.style.display='block'})">支付 ¥99</button><div class="fb" id="payr" style="display:none;margin-top:10px">✓ 支付成功（沙盒）· 权益待开通演示</div></div>`;
V.a11y = () => `<div class="card"><h2>无障碍</h2><p class="d">跟随系统＋手动档</p><button class="opt" onclick="a11y('contrast')">◐ 高对比：<b id="a11yc">关</b> ›</button><button class="opt" onclick="a11y('font')">A 字体：<b id="a11yf">标准</b> ›</button><button class="opt" onclick="a11y('motion')">▶ 动效：<b id="a11ym">开</b> ›</button></div>`;
V.arrears = () => `<div class="card"><h2>📚 今日任务</h2><div class="card" style="margin:0 0 8px;border-color:var(--warn)"><b>昨天有 1 节没学完，今天补吗？</b><p class="d">补上不断签</p><button class="btn sm" onclick="toast('已加入今日（演示）');nav('#/today')">补上 →</button> <button class="btn sm ghost" onclick="nav('#/today')">跳过</button></div></div>`;
V.celebrate = () => `<div class="card" style="text-align:center"><b style="font-size:40px">🎉</b><h2>今天全完成了，明天见！</h2><p class="d">复习队列见明日今日，保持手感</p><button class="btn" onclick="nav('#/home')">回首页</button></div>`;
V.offlinet = () => `<div class="card"><h2>📚 今日任务</h2><div class="fb wa">⌁ 离线任务已保留，联网后同步</div><div class="card" style="margin:8px 0 0"><b>语法 · There ___ two books.</b><p class="d">本地草稿 · 待同步</p></div></div>`;
V.pgen = () => `<div class="card"><h2>计划生成中…</h2><div class="prog"><i style="width:60%"></i></div><p class="d">按定级报告组装，失败给重试</p><button class="btn ghost" onclick="S.plan=true;toast('计划已生成');nav('#/home')">模拟完成 →</button></div>`;
V.greject = () => `<div class="card empty"><b>暂不能开放学习</b><p class="d">身份未通过，可退出或联系客服</p><button class="btn sm" onclick="arm(this,function(){S.user=null;nav('#/login')})">退出</button> <button class="btn sm" onclick="nav('#/support')">联系客服</button></div>`;
V.cupgrade = () => `<div class="card"><h2>条款更新了</h2><p class="d">看一眼再继续，一键重签</p><button class="btn" onclick="toast('已重签（演示）');goBack()">重签并继续</button></div>`;
V.vocab = () => `<div class="card"><h2>glad <span class="meta">/ɡlæd/</span></h2><p class="d">adj. 高兴的</p><p class="d">例：We are glad to see you.</p><p class="d">缺项写“暂无”，不编发音。</p><button class="btn sm" onclick="toast('已加入复习（演示）')">加入复习</button></div>`;
V.listening = () => `<div class="card"><h2>听力</h2><p class="d">暂无可播内容（无版权），看文本替代：</p><p>Good morning. The train leaves at nine.</p><button class="btn sm" onclick="nav('#/practice')">去练题</button></div>`;
V.speaking = () => `<div class="card empty"><b>口语跟读</b><p class="d">录音跟读 M8 开放，先练听力打底</p><button class="btn sm" onclick="nav('#/listening')">去听力</button></div>`;
V.writing = () => `<div class="card empty"><b>写作</b><p class="d">暂无题目（待 B3 迁正典）</p><button class="btn sm" onclick="goBack()">返回</button></div>`;
V.offpkg = () => `<div class="card"><h2>离线包</h2><p class="d">列表可读 · 下载 404 保留：当前无可下载真实包</p><button class="btn sm" onclick="toast('下载不可用：无真实包（演示）')">下载（不可用）</button></div>`;
V.refund = () => `<div class="card"><h2>退款 / 开票</h2><p class="d">沙盒单 TK-1 · 进度：审核中</p><button class="btn sm" onclick="toast('退款进度：审核中（演示）')">查进度</button></div>`;
const VOWELS = [["iː", "sheep"], ["ɪ", "ship"], ["e", "bed"], ["æ", "cat"], ["ɑː", "car"], ["ɒ", "hot"], ["ɔː", "door"], ["ʊ", "book"], ["uː", "food"], ["ʌ", "cup"], ["ɜː", "bird"], ["ə", "about"], ["eɪ", "day"], ["aɪ", "my"], ["ɔɪ", "boy"], ["əʊ", "go"], ["aʊ", "how"], ["ɪə", "here"], ["eə", "there"], ["ʊə", "tour"]];
const CONSS = [["p", "pen"], ["b", "book"], ["t", "tea"], ["d", "dog"], ["k", "key"], ["g", "go"], ["f", "fish"], ["v", "van"], ["θ", "think"], ["ð", "this"], ["s", "sun"], ["z", "zoo"], ["ʃ", "ship"], ["ʒ", "vision"], ["h", "hat"], ["m", "man"], ["n", "no"], ["ŋ", "sing"], ["l", "look"], ["r", "red"], ["j", "yes"], ["w", "we"], ["tʃ", "chair"], ["dʒ", "jump"], ["tr", "tree"], ["dr", "dog"], ["ts", "cats"], ["dz", "beds"]];
const PHQ = [["sip", "zip"], ["ship", "sheep"], ["cat", "cut"], ["pen", "pan"]];
const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
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
const PIC = { abandon: "🗑️", ability: "💪", absent: "🏫", absolute: "💯", absorb: "🧽", abstract: "🎨", abundant: "🌾", abuse: "🚫", academy: "🏛️", accelerate: "🚀", accent: "🗣️", accept: "🤝", access: "🔑", accommodate: "🏠", accompany: "👥", accomplish: "🏆", account: "👤", accumulate: "📚", accuracy: "🎯", accuse: "⚖️", abolish: "🔨", absurd: "🤪", abundance: "🌾", acclaim: "👏", acquaint: "🤝", adhere: "🧲", adjacent: "🏘️", adjoin: "🧱", administer: "💼", admirable: "⭐", admission: "🎫", adolescent: "🧑", adore: "❤️", adorn: "💎", adverse: "⛈️", advertise: "📢", advocate: "📣", aesthetic: "🌸", affiliate: "🔗", affirm: "✅" };
function wpic(w) { return PIC[w] || "🔤"; }
function wsplit(w) { const m = w.match(/^(.{2,4})(.+?)(ing|ed|tion|sion|ance|ence|ment|ness|ly|ous|ive|al|er|or|ist)?$/); if (!m) return [w]; return [m[1], m[2], m[3] || ""].filter(Boolean); }
function wquiz() { const L = wlist(), idx = Math.min(DR.i, L.length - 1), w = L[idx]; const others = L.filter((_, j) => j !== idx).slice(0, 3); const opts = [...others.map(o => ({ zh: o[2], w: o[0], ok: false })), { zh: w[2], w: w[0], ok: true }]; const h = DR.i * 7 + w[0].length; for (let k = opts.length - 1; k > 0; k--) { const j = (h + k * 3) % (k + 1); const t = opts[k]; opts[k] = opts[j]; opts[j] = t; } return { w, opts }; }
function qpick(k) { DR.quizPick = k; render(); }
V.drill = () => {
  const L = wlist();
  const tabs = `<p class="d">模式：<button class="btn sm${DR.mode === "zhan" ? "" : " ghost"}" onclick="DR.mode='zhan';DR.show=false;render()">斩词</button> <button class="btn sm${DR.mode === "quiz" ? "" : " ghost"}" onclick="DR.mode='quiz';DR.quizPick=-1;DR.quizDone=false;render()">选项</button> <button class="btn sm${DR.mode === "fam" ? "" : " ghost"}" onclick="DR.mode='fam';render()">高效</button></p>`;
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
        if (!S.mistakes.some(m => m.t === w[0])) S.mistakes.push({ t: w[0], why: "定位：词汇待补" });
      }
    }
    return `<div class="meta">${DR.book === "CET4" ? "四级" : "六级"} · 第 ${Math.min(DR.i + 1, L.length)}/${L.length} · 已斩 ${DR.known}</div>${tabs}<div class="card" style="text-align:center"><b style="font-size:34px">${w[0]}</b><p class="d">${w[1]} <button class="btn sm" onclick="speak('${w[0]}')">🔊</button></p></div>` + opts.map((o, k) => `<button class="opt" onclick="qpick(${k})">${wpic(o.w)} ${o.zh}</button>`).join("") + mid;
  }
  const w = L[Math.min(DR.i, L.length - 1)];
  return `<div class="meta">${DR.book === "CET4" ? "四级" : "六级"} · 第 ${Math.min(DR.i + 1, L.length)}/${L.length} · 已斩 ${DR.known}</div>${tabs}<div class="card" style="text-align:center;padding:34px 18px"><b style="font-size:38px">${w[0]}</b><p class="d">${w[1]}</p>${DR.show ? `<p style="font-size:20px"><b>${w[2]}</b></p><button class="btn sm ghost" onclick="speak('${w[0]}')">🔊 读</button>` : `<button class="btn sm ghost" onclick="dreveal()">点看中文</button>`}</div>${DR.show ? `<div class="row" style="display:flex;gap:8px"><button class="btn ghost" style="flex:1" onclick="dzhan(false)">收 ✋</button><button class="btn" style="flex:1" onclick="dzhan(true)">斩 ⚔️</button></div>` : ``}`;
};
V.wordbook = () => `<div class="card"><h2>📕 单词本</h2><p class="d">选一本，直接开刷（斩＝会，收＝不会进复习）</p><button class="opt" onclick="wset('CET4')"><b>四级词汇</b> · 20 词 ›</button><button class="opt" onclick="wset('CET6')"><b>六级词汇</b> · 20 词 ›</button></div>`;
V.phonics = () => `<div class="card"><h2>🔤 音标 · 元音 20</h2><p class="d">点符号听发音（系统语音演示）</p>${VOWELS.map(([s, w]) => `<button class="btn sm" onclick="speak('${w}')">${s} · ${w}</button>`).join(" ")}</div><div class="card"><h2>🔤 音标 · 辅音 28</h2>${CONSS.map(([s, w]) => `<button class="btn sm" onclick="speak('${w}')">${s} · ${w}</button>`).join(" ")}</div><div class="card"><h2>👂 最小对立对辨音</h2>${PHQ.map(([a, b]) => `<p class="d"><button class="btn sm" onclick="speak('${a}')">${a} 🔊</button> <button class="btn sm" onclick="speak('${b}')">${b} 🔊</button></p>`).join("")}<p class="d">听两遍，凭感觉选（演示不判分）</p></div>`;
V.alphabet = () => `<div class="card"><h2>🔠 字母 · 26</h2><p class="d">点字母听发音，看大小写和例词</p>${ABC.map(c => `<button class="btn sm" onclick="speak('${c}');document.getElementById('alD').innerHTML='<b>${c} ${c.toLowerCase()}</b> · 例：${c === 'A' ? 'apple 苹果' : c === 'B' ? 'book 书' : c === 'C' ? 'cat 猫' : '…'}'">${c}</button>`).join(" ")}</div><div class="card" id="alD"><p class="d">点上面任意字母 👆</p></div><div class="card"><h2>🔗 自然拼读</h2><p class="d">c-a-t → cat（演示：点听整词）</p><button class="btn sm" onclick="speak('cat')">🔊 cat</button> <button class="btn sm" onclick="speak('dog')">🔊 dog</button> <button class="btn sm" onclick="toast('更多拼读课待补充（演示）')">更多 →</button></div>`;

/* ---------- 动作 ---------- */
function doLogin() { S.user = document.getElementById("li").value || "t-learner-01@test.invalid"; S.gate = S.gate === "NONE" ? "PENDING" : S.gate; toast("登录成功"); nav(S.gate === "PASS" ? "#/home" : "#/gate"); }
function doRegister() { const id = document.getElementById("ri").value; if (!id || !id.trim()) { toast("先填个账号"); return; } S.user = id; S.gate = "PENDING"; toast("注册成功（201），先过身份确认"); nav("#/gate"); }
function doGate() { const ag = document.getElementById("cf"); if (!document.getElementById("by").value || !ag.checked) { toast("请填写年份并确认已满 18 岁"); return; } S.gate = "PASS"; toast("身份已确认（演示）"); }
function doConsents() { const a = [...document.querySelectorAll(".ag")]; if (!a.every(x => x.checked)) { toast("三项都要签"); return; } toast("三项已签署"); nav("#/onboard"); }
function doGoal() { S.goal = document.getElementById("g").selectedOptions[0].text; S.quiz = { i: 0, score: 0, sel: null, done: false }; toast("目标已保存"); nav("#/placement"); }
function pick(k) { S.quiz.sel = k; document.querySelectorAll("#qo .opt").forEach((x, j) => x.classList.toggle("sel", j === k)); }
function qSubmit() { const q = BANK[S.quiz.i]; if (S.quiz.sel == null) { toast("先选一个"); return; } const f = document.getElementById("qfb"), ok = S.quiz.sel === q.a; if (ok) S.quiz.score++; else S.mistakes.push({ t: q.s, why: "定位：" + q.dim + "待补" }); f.textContent = ok ? "✓ 对了" : "! 记下了，进错题本，变式稍后见"; f.className = "fb " + (ok ? "ok" : "no"); }
function qNext() { if (S.quiz.i < BANK.length - 1) { S.quiz.i++; render(); } else { S.quiz.done = true; nav("#/report"); } }
let PSEL = null;
const A = { l1: false, l2: false };
function paintRev() { const el = document.getElementById("revst"); if (el) el.textContent = (A.l1 ? "L1 已过" : "L1 待审") + " · " + (A.l2 ? "L2 已过/ACTIVE" : "L2 待审"); }
const AX = { c: false, f: 0, m: true };
function a11y(k) { if (k === "contrast") { AX.c = !AX.c; document.body.style.filter = AX.c ? "contrast(1.4)" : ""; document.getElementById("a11yc").textContent = AX.c ? "开" : "关"; } if (k === "font") { AX.f = (AX.f + 1) % 3; const z = [15, 17, 19][AX.f]; document.body.style.fontSize = z + "px"; document.getElementById("a11yf").textContent = ["标准", "大", "特大"][AX.f]; } if (k === "motion") { AX.m = !AX.m; document.getElementById("a11ym").textContent = AX.m ? "开" : "关"; toast(AX.m ? "动效已开" : "动效已关（演示）"); } }
function ppick(k, el) { PSEL = k; document.querySelectorAll("#po .opt").forEach((x, j) => x.classList.toggle("sel", j === k)); }
function psubmit() { if (PSEL == null) { toast("先选一个"); return; } const f = document.getElementById("pfb"), ok = PSEL === 1; if (!ok) S.mistakes.push({ t: "There ___ two books on the desk.", why: "定位：语法待补" }); f.textContent = ok ? "✓ FULL：主语复数用 are" : "! ZERO：已进错题本"; f.className = "fb " + (ok ? "ok" : "no"); }
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
  if (r === "avatar" && typeof stage3d === "function") stage3d();
  if (r !== "avatar" && typeof T3 !== "undefined" && T3 && T3.raf) { cancelAnimationFrame(T3.raf); T3.raf = 0; }
  document.getElementById("view").scrollTop = 0;
  if (r === "placement" && S.quiz.done) { S.quiz.done = false; }
}
window.addEventListener("hashchange", render);
render();
