/* 语学星管理后台交互稿 · 静态数据 · 无后端
 * 范围：L8 内容双审 / 管理登录仪表盘权限媒体 / L9 治理举报 / 客服后台 / 商城后台 / 审计 / 观测发布门
 * 对应 BC-071…084/085…094/168/171…175/185…187/200/204…208，IC-040…051。只定交互，不定真相。
 * 存储键 yxx-admin-v1，与学习端 yxx-demo-v3 隔离，互不覆盖。
 */
const A = {
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
const A_TITLES = { alogin: "管理登录", dash: "工作台", draft: "内容列表", review: "送审与审核", publish: "发布管理", media: "媒体与上传", perm: "权限只读", audit: "审计列表", gov: "治理风控", report: "举报队列", cs: "客服后台", csdetail: "工单详情", shop: "商城后台", refund: "退款开票", ops: "观测与发布门", me: "我的" };
const A_TABS = ["dash", "draft", "gov", "me"];
function atoast(m) { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2200); }
function agoBack() { if (history.length > 1) history.back(); else location.hash = "#/dash"; }
function anav(h) { location.hash = h; }
function aarm(el, fn) { if (el.dataset.armed) { delete el.dataset.armed; el.classList.remove("danger"); fn(); } else { el.dataset.armed = "1"; el.classList.add("danger"); const t = el.textContent; el.textContent = "再点一次确认"; setTimeout(() => { delete el.dataset.armed; el.classList.remove("danger"); if (el.isConnected) el.textContent = t; }, 3000); } }
const DST = { draft: "草稿", review: "待审", l1pass: "L1 已过·待 L2", active: "已发布", off: "已下架" };
function adraft() { return A.drafts.find(d => d.id === A.cur) || A.drafts[0]; }
function amissing(d) { const m = []; if (!d.copy) m.push("版权未绑定"); if (!d.report) m.push("审核报告版本不一致"); if (d.mediaHave < d.mediaNeed) m.push("必要媒体缺 " + (d.mediaNeed - d.mediaHave) + " 项"); return m; }

/* ---------- 屏 ---------- */
const AV = {};
AV.alogin = () => `<div class="card"><h2>管理登录</h2><p class="d">staff 账号＋密码。失败不说明是账号错还是密码错。</p><label class="lb">账号</label><input id="au" value="teach-li" placeholder="staff 账号"><label class="lb">密码</label><input id="ap" type="password" value="" placeholder="密码"><button class="btn" onclick="adoLogin()">登录</button><p class="d">演示：reviewer-l1 王芳 / reviewer-l2 赵磊 / admin 运营-陈晨，任意密码可进（演示）。登录后只能看自己有权的页。</p></div>`;
AV.dash = () => `<div class="card"><p class="d">staff 视角 · ${A.user}（${A.role}）· 演示数据非真实业务</p><h2>📊 今日概览</h2><div class="kpis"><div><b>3</b><span>在架</span></div><div><b>2</b><span>待审</span></div><div><b>1</b><span>风险待建档</span></div></div><p class="d">口径：仅统计已落库稿件与案件，不含草稿 · 更新 09-30 23:00 · 来源：内容库/治理库演示快照</p></div><div class="card"><h2>📌 待办</h2><div class="rowline"><div><b>语法课 v3 等 L2</b><p class="d">L1 王芳已过 · 等 reviewer-l2</p></div><button class="btn sm" onclick="A.cur='d1';anav('#/review')">去审 →</button></div><div class="rowline"><div><b>RISK-001 待建档</b><p class="d">刷分嫌疑 · 有来源记录</p></div><button class="btn sm" onclick="anav('#/gov')">去看 →</button></div><div class="rowline"><div><b>RF-301 待第二审批</b><p class="d">¥19 · 已有 1 人审批</p></div><button class="btn sm" onclick="anav('#/refund')">去看 →</button></div></div><div class="card"><h2>🧭 管理</h2>${[["📝 内容列表", "#/draft"], ["✔️ 送审与审核", "#/review"], ["🚀 发布管理", "#/publish"], ["🎬 媒体与上传", "#/media"], ["🛡️ 治理风控", "#/gov"], ["🚩 举报队列", "#/report"], ["💬 客服后台", "#/cs"], ["🛒 商城后台", "#/shop"], ["🧾 退款开票", "#/refund"], ["📜 审计列表", "#/audit"], ["🔑 权限只读", "#/perm"], ["🖥️ 观测与发布门", "#/ops"]].map(([t, h]) => `<button class="opt" onclick="anav('${h}')">${t} ›</button>`).join("")}</div>`;
AV.draft = () => {
  const list = A.drafts.filter(d => !A.q || (d.title + d.id).includes(A.q));
  return `<div class="card"><h2>📝 内容列表</h2><p class="d">草稿 / 待审 / 已发布分开展示。无权建稿先解释，不给空白页。</p><input id="aq" placeholder="搜标题/编号" value="${A.q.replace(/"/g, "")}" oninput="A.q=this.value;arender2()"><p class="d">当前审核模式：<b>${A.mode === "simple" ? "简审（1 人可发）" : "双签（L1＋L2）"}</b> <button class="btn sm" onclick="A.mode=A.mode==='simple'?'dual':'simple';adbSave();arender()">切换演示</button></p>${list.length ? list.map(d => `<div class="rowline"><div><b>${d.title}</b> <span class="tag">${DST[d.st] || d.st}</span><p class="d">${d.id} · v${d.v} · 更新 ${d.updated}</p></div><button class="btn sm" onclick="A.cur='${d.id}';anav('#/review')">打开 →</button></div>`).join("") : `<div class="card empty"><b>没有符合的稿件</b><p class="d">换个关键词，或新建草稿</p></div>`}<button class="btn" onclick="anewDraft()">＋ 新建草稿</button></div>`;
};
AV.review = () => {
  const d = adraft(), miss = amissing(d);
  const simple = A.mode === "simple";
  return `<div class="card"><button class="btn sm ghost" onclick="anav('#/draft')">← 内容列表</button><h2>${d.title}</h2><p class="d">${d.id} · v${d.v} · ${DST[d.st] || d.st} · 更新 ${d.updated}</p><p><span class="tag ${d.copy ? "ok" : "no"}">版权${d.copy ? "已绑定" : "未绑定"}</span> <span class="tag ${d.report ? "ok" : "no"}">报告${d.report ? "一致" : "不一致"}</span> <span class="tag ${d.mediaHave >= d.mediaNeed ? "ok" : "wa"}">媒体 ${d.mediaHave}/${d.mediaNeed}</span></p></div>`
  + (miss.length ? `<div class="card"><h2>⛔ 送审缺项（一次列齐）</h2>${miss.map(m => `<p class="d">· ${m}</p>`).join("")}<p class="d">按 BC-074：409 一次返回全部缺项，不让用户跑三趟。缺项补齐前送审按钮不可点。</p><button class="btn" disabled>送审（缺 ${miss.length} 项）</button><button class="btn ghost" onclick="d.copy=true;d.report=true;d.mediaHave=d.mediaNeed;adbSave();arender()">演示：一键补齐 →</button></div>`
  : `<div class="card"><h2>${simple ? "简审" : "双签"}送审</h2><p class="d">${simple ? "小团队简审：1 人可发，留痕可撤（BC-084）。" : "双签：L1 初审＋L2 终审，申请人禁自审（BC-075/076）。"}</p>${simple
    ? `<button class="btn" onclick="d.st='active';A.pubSync='发布中…';adbSave();arender();setTimeout(()=>{A.pubSync='已同步';arender()},1500)">简审通过并发布</button>`
    : `<p class="d">L1：${d.l1by || "待审"}${d.l1by && d.l1by === A.user ? "（就是你，不能自审 L2）" : ""}</p><button class="btn" onclick="al1()">L1 通过</button><p class="d">L2：${d.l2by || "待审"}</p><button class="btn" onclick="al2()">L2 通过并发布</button>`}</div>`)
  + `<div class="card"><h2>📜 版本与记录</h2><p class="d">v${d.v} · L1 ${d.l1by || "—"} · L2 ${d.l2by || "—"} · 草稿编辑走版本锁，多人同时改保留对比（演示）。</p><label class="lb">改标题（演示版本锁）</label><input id="dt" value="${d.title}"><button class="btn sm" onclick="d.title=document.getElementById('dt').value;d.v++;adbSave();arender()">保存新版本 v${d.v + 1}</button></div>`;
};
AV.publish = () => {
  const lives = A.drafts.filter(d => d.st === "active"), offs = A.drafts.filter(d => d.st === "off");
  return `<div class="card"><h2>🚀 发布 / 下线 / 回滚</h2><p class="d">目录同步：<b>${A.pubSync}</b> · ACTIVE ≠ 各端已可见，目录异步刷新（演示 1.5s）。</p></div>`
  + (lives.length ? lives.map(d => `<div class="card"><b>${d.title}</b> <span class="tag ok">已发布 v${d.v}</span><p class="d">${d.id} · 在架可学</p><button class="btn sm" onclick="aarm(this,function(){d.st='off';adbSave();arender()})">普通下架</button> <button class="btn sm" onclick="aarm(this,function(){d.st='off';atoast('已强制停止分发：旧会话/媒体同时阻断（演示）');adbSave();arender()})">强制停止分发</button></div>`).join("") : `<div class="card empty"><b>当前无在架内容</b><p class="d">去内容列表送审发布</p></div>`)
  + `<div class="card"><h2>📦 已下架与回滚</h2>${offs.length ? offs.map(d => `<div class="rowline"><div><b>${d.title}</b><p class="d">${d.id} · v${d.v} · 回滚前先校验旧版仍可供给</p></div><button class="btn sm" onclick="aarm(this,function(){d.st='active';A.pubSync='发布中…';adbSave();arender()})">回滚上架</button></div>`).join("") : `<p class="d">无已下架稿件。</p>`}</div>`;
};
AV.media = () => `<div class="card"><h2>🎬 媒体与上传</h2><p class="d">R2 门：对象字节未接通时只显示边界，不伪造可上传（BC-207）。演示开关：</p><p class="d"><button class="btn sm${A.mediaOpen ? "" : " pri"}" onclick="A.mediaOpen=false;adbSave();arender()">未接通</button> <button class="btn sm${A.mediaOpen ? " pri" : ""}" onclick="A.mediaOpen=true;adbSave();arender()">已接通（演示）</button></p></div>`
  + (A.mediaOpen ? `<div class="card"><h2>⬆️ 上传（演示进度）</h2><button class="btn" onclick="amUpload()">传一个音频 →</button><div id="mup"></div></div><div class="card"><h2>📚 资产</h2>${A.media.map(m => `<div class="rowline"><div><b>${m.t}</b><p class="d">${m.size} · ${m.st}</p></div></div>`).join("")}</div>`
  : `<div class="card empty"><b>媒体服务未接通</b><p class="d">上传、校验、绑定都不可用。发布所需媒体缺项会卡住送审，不显示可发布。</p><button class="btn sm" onclick="anav('#/review')">回送审页</button></div>`);
AV.perm = () => {
  const rows = [["teach-li", "reviewer-l1", "内容初审/草稿读写"], ["wangfang", "reviewer-l1", "内容初审/草稿读写"], ["zhaolei", "reviewer-l2", "终审发布/回滚"], ["chenchen", "admin", "订单对账读/工单处理"], ["t-learner-01", "learner", "学习（14 项）"]];
  const list = rows.filter(r => !A.q || (r[0] + r[1] + r[2]).includes(A.q));
  return `<div class="card"><h2>🔑 权限（只读）</h2><p class="d">iam.policy.read · 只看不动。改权限走双人审批（演示无入口）。</p><input placeholder="搜账号/角色" value="${A.q.replace(/"/g, "")}" oninput="A.q=this.value;arender2()">${list.length ? list.map(r => `<div class="rowline"><div><b>${r[0]}</b><p class="d">${r[1]} · ${r[2]}</p></div><span class="tag">只读</span></div>`).join("") : `<div class="card empty"><b>无匹配账号</b></div>`}</div>`;
};
AV.audit = () => {
  const list = A.audit.filter(a => (A.af === "全部" || (A.af === "允许" ? a.r === "允许" : a.r === "拒绝")) && (!A.q || (a.act + a.who + a.id).includes(A.q)));
  return `<div class="card"><h2>📜 审计</h2><p class="d">分页＋脱敏 · 导出 internal-only（演示只说明，不真导出文件）。</p><p class="d">${["全部", "允许", "拒绝"].map(f => `<button class="btn sm${A.af === f ? " pri" : ""}" onclick="A.af='${f}';adbSave();arender()">${f}</button>`).join(" ")} <input placeholder="搜动作/账号/编号" value="${A.q.replace(/"/g, "")}" oninput="A.q=this.value;arender2()"></p>${list.length ? list.map(a => `<div class="rowline"><div><b>${a.act}</b><p class="d">${a.id} · ${a.who.slice(0, 3)}*** · ${a.time}</p></div><span class="tag ${a.r === "允许" ? "ok" : "no"}">${a.r}</span></div>`).join("") : `<div class="card empty"><b>这类暂无记录</b></div>`}<button class="btn ghost" onclick="atoast('导出：internal-only，需单独鉴权（演示）')">申请导出</button></div>`;
};
AV.gov = () => {
  const list = A.gov.filter(g => A.gf === "全部" || g.st === A.gf);
  return `<div class="card"><h2>🛡️ 治理 · 风险区</h2><p class="d">R1 只读建档；R3 处置写链未开，处置按钮隐藏（BC-085…094，DEC-01 待定）。</p><p class="d">${["全部", "待建档", "已隔离"].map(f => `<button class="btn sm${A.gf === f ? " pri" : ""}" onclick="A.gf='${f}';adbSave();arender()">${f}</button>`).join(" ")}</p></div>`
  + (list.length ? list.map(g => `<div class="card"><b>${g.id} · ${g.t}</b> <span class="tag ${g.st === "待建档" ? "wa" : "ok"}">${g.st}</span><p class="d">来源：${g.src} · ${g.time}</p>${g.st === "待建档" ? `<button class="btn sm" onclick="g.st='已建档';adbSave();arender()">建档（只读记录）</button>` : `<p class="d">处置（隔离/升级/关闭）属 R3 写链，未开：按钮隐藏，服务端同样拒绝写入。</p>`}</div>`).join("") : `<div class="card empty"><b>这类暂无案件</b><p class="d">加载失败不会显示“无风险”，会显示失败重试。</p></div>`);
};
AV.report = () => `<div class="card"><h2>🚩 举报队列</h2><p class="d">R1 只读；只读阶段无处置按钮（BC-093/094）。隐私字段已脱敏。</p></div>`
  + A.reports.map(r => `<div class="rowline"><div><b>${r.id} · ${r.t}</b><p class="d">${r.who} · ${r.time}</p></div><span class="tag ${r.st === "待看" ? "wa" : ""}">${r.st}</span></div>`).join("")
  + `<div class="card"><p class="d">R3 处置（删除/处罚）未启用：此处无按钮。启用条件待 DEC-01。</p></div>`;
AV.cs = () => {
  const list = A.tickets.filter(t => A.cf === "全部" || t.cat === A.cf);
  return `<div class="card"><h2>💬 客服后台</h2><p class="d">hash-only 旧记录标“信息不足”，不伪造已解决（BC-185）。</p><p class="d">${["全部", "学习", "付费"].map(f => `<button class="btn sm${A.cf === f ? " pri" : ""}" onclick="A.cf='${f}';adbSave();arender()">${f}</button>`).join(" ")}</p></div>`
  + (list.length ? list.map(t => `<div class="card"><b>${t.id} · ${t.t}</b> <span class="tag">${t.cat}</span> <span class="tag ${t.st === "待接单" ? "wa" : ""}">${t.st}</span><p class="d">${t.body}</p><p class="d">${t.time}</p><button class="btn sm" onclick="A.curTk='${t.id}';anav('#/csdetail')">打开 →</button></div>`).join("") : `<div class="card empty"><b>这类暂无工单</b></div>`);
};
AV.csdetail = () => {
  const t = A.tickets.find(x => x.id === A.curTk) || A.tickets[0];
  return `<div class="card"><button class="btn sm ghost" onclick="anav('#/cs')">← 客服后台</button><h2>${t.id} · ${t.t}</h2><p class="d">${t.cat} · ${t.st} · ${t.time}</p><p>${t.body}</p></div><div class="card"><h2>处理</h2>${t.st === "待接单" ? `<button class="btn" onclick="t.st='处理中';adbSave();arender()">接单</button>` : `<label class="lb">回复（演示：只记文本）</label><textarea id="crep" placeholder="写回复…"></textarea><button class="btn" onclick="t.st='已关闭';adbSave();atoast('已回复并关闭（演示）');arender()">回复并关闭</button> <button class="btn ghost" onclick="atoast('已升级：转二线（演示）')">升级转二线</button>`}</div>`;
};
AV.shop = () => `<div class="card"><h2>🛒 商城后台</h2><p class="d">订单资金 / 权益 / 差异三列；沙盒显著标记；对账以订单/渠道/权益为准（BC-173）。</p></div>`
  + A.orders.map(o => `<div class="card"><b>${o.id} · ${o.sku}</b> <span class="tag wa">沙盒</span><p class="d">资金：${o.money}</p><p class="d">权益：${o.equity}</p><p class="d">差异：${o.diff} · ${o.time}</p></div>`).join("")
  + `<div class="card"><h2>📊 日切对账（演示）</h2><p class="d">订单 2 · 渠道 2 · 权益 2 · 差异 0。先补发/纠错再关单，不让用户再付一次。</p><button class="btn sm" onclick="atoast('对账完成：差异 0（演示）')">跑一次对账</button></div>`;
AV.refund = () => A.refunds.map(r => `<div class="card"><h2>🧾 ${r.id} · ${r.order}</h2><p><span class="tag">金额 ${r.money}</span> <span class="tag ${r.st === "待第二审批" ? "wa" : "ok"}">${r.st}</span></p><p class="d">第一审批：${r.ok1 || "—"}</p><p class="d">第二审批：${r.ok2 || "—（不能和第一审批是同一人，BC-174 双人约束）"}</p>${r.st === "待第二审批" ? `<button class="btn" onclick="arApprove('${r.id}')">作为第二审批人通过</button>` : `<p class="d">开票：${r.inv}</p><button class="btn sm" onclick="r.inv='处理中';adbSave();arender()">申请开票</button>`}</div>`).join("");
AV.ops = () => `<div class="card"><h2>🖥️ 观测与发布门</h2><p class="d">健康探针 / 优雅停机 / SBOM / 可回滚发布（BC-197/198）。无证据不得标可发布。</p><p class="d">网关 <span class="tag ok">UP</span> · 内容库 <span class="tag ok">UP</span> · 事件总线 <span class="tag ok">UP</span> · 更新 09-30 23:00</p></div><div class="card"><h2>🚦 发布门（演示）</h2><p class="d">SBOM ✅ · 依赖扫描 ✅ · 迁移兼容 ✅ · 回滚演练 ⬜ 未做</p><button class="btn sm" onclick="atoast('回滚演练：命名恢复点 rp-0930（演示）')">做一次回滚演练</button></div>`;
AV.me = () => `<div class="card" style="text-align:center"><div style="font-size:44px">🧑‍💼</div><b style="font-size:19px">${A.user || "未登录"}</b><p class="d">${A.role} · 申请人禁自审 · 演示身份</p></div><div class="card"><h2>切换身份（演示）</h2>${[["教研-小李", "reviewer-l1"], ["王芳", "reviewer-l1"], ["赵磊", "reviewer-l2"], ["运营-陈晨", "admin"]].map(([u, r]) => `<button class="btn sm${A.user === u ? " pri" : ""}" onclick="A.user='${u}';A.role='${r}';adbSave();arender()">${u} · ${r}</button>`).join(" ")}</div><div class="card"><button class="btn ghost" onclick="aarm(this,function(){A.user=null;adbSave();anav('#/alogin')})">退出登录</button></div>`;

/* ---------- 动作 ---------- */
function adoLogin() { const u = (document.getElementById("au").value || "").trim(); if (!u) { atoast("先填账号"); return; } const known = { "teach-li": ["教研-小李", "reviewer-l1"], "wangfang": ["王芳", "reviewer-l1"], "zhaolei": ["赵磊", "reviewer-l2"], "chenchen": ["运营-陈晨", "admin"] }; const hit = known[u] || [u, "reviewer-l1"]; A.user = hit[0]; A.role = hit[1]; adbSave(); atoast("登录成功（演示）"); anav("#/dash"); }
function anewDraft() { const n = A.drafts.length + 1; A.drafts.unshift({ id: "d" + Date.now() % 100000, title: "新草稿 " + n, v: 1, st: "draft", copy: false, report: false, mediaNeed: 1, mediaHave: 0, updated: "刚刚", l1by: "", l2by: "" }); A.cur = A.drafts[0].id; adbSave(); anav("#/review"); }
function al1() { const d = adraft(); if (A.mode === "simple") { atoast("简审模式无 L1（演示）"); return; } if (d.l1by === A.user) { atoast("你已审过 L1，不能再审"); return; } d.l1by = A.user; d.st = "l1pass"; adbSave(); atoast("L1 通过（演示）"); arender(); }
function al2() { const d = adraft(); if (A.mode === "simple") { atoast("简审模式无 L2（演示）"); return; } if (!d.l1by) { atoast("先过 L1"); return; } if (d.l1by === A.user) { atoast("申请人禁自审：L1 是你，L2 换人（演示拦截）"); return; } d.l2by = A.user; d.st = "active"; A.pubSync = "发布中…"; adbSave(); arender(); setTimeout(() => { A.pubSync = "已同步"; adbSave(); arender(); }, 1500); }
function arApprove(id) { const r = A.refunds.find(x => x.id === id); const first = (r.ok1 || "").split(" ")[0]; if (A.user === first || A.user === "张三") { atoast("双人约束：不能和第一审批是同一人（演示拦截）"); return; } r.ok2 = A.user + " 刚刚"; r.st = "通过·待开票"; adbSave(); arender(); }
function amUpload() { const el = document.getElementById("mup"); if (!el) return; el.innerHTML = `<p class="d">上传中…</p>`; setTimeout(() => { A.media.push({ id: "m" + Date.now() % 100000, t: "新音频 " + (A.media.length + 1) + ".mp3", size: "0.9MB", st: "未绑定" }); adbSave(); arender(); atoast("上传成功：校验通过，已入库未绑定（演示）"); }, 1200); }

/* ---------- 持久化（键 yxx-admin-v1，与学习端隔离） ---------- */
const ADBKEY = "yxx-admin-v1";
function adbSave() { try { localStorage.setItem(ADBKEY, JSON.stringify({ v: 1, A: { user: A.user, role: A.role, mode: A.mode, drafts: A.drafts, cur: A.cur, pubSync: A.pubSync, gov: A.gov, reports: A.reports, tickets: A.tickets, curTk: A.curTk, orders: A.orders, refunds: A.refunds, media: A.media, audit: A.audit, af: A.af, gf: A.gf, cf: A.cf, q: A.q, mediaOpen: !!A.mediaOpen } })); } catch (e) { } }
function adbLoad() { try { const d = JSON.parse(localStorage.getItem(ADBKEY) || "null"); if (!d || d.v !== 1 || !d.A) return false; Object.assign(A, d.A); return true; } catch (e) { return false; } }

/* ---------- 路由 ---------- */
function arender() {
  let r = (location.hash || "#/dash").replace("#/", "");
  if (!AV[r]) r = "dash";
  if (!A.user) r = "alogin";
  document.getElementById("title").textContent = A_TITLES[r] || "管理后台";
  document.getElementById("bk").style.visibility = (["alogin", "dash"].includes(r)) ? "hidden" : "visible";
  document.getElementById("tabs").style.display = A_TABS.includes(r) ? "flex" : "none";
  document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.t === r));
  document.getElementById("view").innerHTML = AV[r]();
  document.getElementById("view").scrollTop = 0;
}
function arender2() { const v = document.getElementById("aq"); const pos = v ? v.selectionStart : 0; arender(); const n = document.querySelector("#view #aq, #view input[placeholder]"); if (n && v) { try { n.focus(); n.setSelectionRange(pos, pos); } catch (e) { } } }
window.addEventListener("hashchange", arender);
adbLoad();
arender();
