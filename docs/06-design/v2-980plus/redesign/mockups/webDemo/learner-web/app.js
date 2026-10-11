/* 语学星学员网页端 · 独立桌面静态 Demo · 假数据 · 不连后端
 * 功能覆盖自 mockups/mobile 全量学习侧路由反推；布局为侧栏桌面范式。
 * 存储键 yxx-web-demo-v1，与移动端 / 管理端隔离。
 */
const TITLES = {
  login:"登录",register:"注册",reset:"重置密码",gate:"身份确认",greject:"门被拒",cupgrade:"同意升级",
  onboard:"学习目标",placement:"定级测评",pfault:"定级恢复",report:"测评报告",pgen:"计划生成中",planexp:"计划解释",
  home:"首页",today:"今日任务",practice:"练题",result:"本题结果",mistakes:"错题本",srs:"复习",reviewqueue:"复习队列",
  words:"词汇",vocab:"词汇详情",wordbook:"单词本",drill:"刷单词",courses:"课程",shelf:"书架",book:"图书详情",
  chapter:"章节正文",collections:"收藏",listening:"听力",speaking:"口语",writing:"写作",phonics:"音标",alphabet:"字母",
  weekly:"学习报告",recap:"今日回顾",history:"学习历史",mastery:"掌握度",achieve:"成就墙",league:"联赛",rewards:"任务奖励",
  calendar:"学习日历",plan:"我的计划",arrears:"补课提醒",celebrate:"完成撒花",firstlearn:"首次学习",session:"会话检查点",
  offlinet:"断网今日",offpkg:"离线包",world:"世界",avatar:"装扮",msgs:"消息",space:"个人空间",games:"小游戏",search:"搜索",
  me:"我的",settings:"设置",devices:"设备",privacy:"隐私",npref:"通知偏好",a11y:"无障碍",support:"客服",tdetail:"工单详情",
  about:"关于",paudio:"音频保留",lab:"演示工具",commerce:"商城",pay:"收银台",refund:"退款开票",subs:"订阅对账",
  ai:"AI 伴学",aigate:"AI 门",aiflow:"AI 链",voice:"语音跟读",vscore:"语音评分",k12:"青少年模式",k12guard:"K12 治理",
  k12course:"K12 课程",native:"原生壳"
};
const NAV = [
  ["主页",["home"]],
  ["学习",["today","practice","mistakes","srs","reviewqueue","drill","arrears"]],
  ["课程",["courses","shelf","words","wordbook","listening","speaking","writing"]],
  ["成长",["weekly","mastery","achieve","league","calendar","plan"]],
  ["世界",["world","avatar","msgs","space","games"]],
  ["账户",["me","settings","support","privacy","commerce"]]
];
const AUTH_FREE = ["login","register","reset"];
const S = {
  user: "演示账号", gate: "PASS", goal: "大学英语 · 四级", budget: 30, level: "B1", score: 71,
  today: [
    {id:"t1", t:"语法 · There be", kind:"语法", done:false, est:8},
    {id:"t2", t:"阅读 · 图书馆的一天", kind:"阅读", done:false, est:12},
    {id:"t3", t:"词汇复习 4 词", kind:"复习", done:true, est:6}
  ],
  mistakes: [
    {id:"m1", stem:"There ___ a book on the desk.", wrong:"is", right:"主谓一致", st:"todo"},
    {id:"m2", stem:"She has lived here ___ 2019.", wrong:"from", right:"since", st:"wait1"}
  ],
  words: [
    {id:"w1", word:"library", gloss:"图书馆", due:true},
    {id:"w2", word:"borrow", gloss:"借", due:true},
    {id:"w3", word:"quiet", gloss:"安静的", due:false},
    {id:"w4", word:"shelf", gloss:"架子", due:true}
  ],
  books: [
    {id:"b1", title:"四级阅读精练", prog:42, ch:"第 3 章 · 校园生活"},
    {id:"b2", title:"语法通关 30 课", prog:18, ch:"第 1 章 · 系动词"}
  ],
  tickets: [{id:"TK-2048", t:"定级第 6 题卡住", st:"处理中"}],
  quiz: {i:0, sel:null, done:false, score:0, answers:[]},
  theme: "light"
};
const BANK = [
  {q:"Choose the best word: I ___ to the library yesterday.", opts:["go","went","gone","going"], a:1, why:"一般过去时用 went。"},
  {q:"There ___ many students in the classroom.", opts:["is","are","be","was"], a:1, why:"复数主语用 are。"},
  {q:"She has lived here ___ 2019.", opts:["for","since","from","at"], a:1, why:"时间点用 since。"},
  {q:"阅读：The library opens at 8. 开馆时间？", opts:["7 点","8 点","9 点","全天"], a:1, why:"文中 opens at 8。"},
  {q:"听力要点（演示）：关键词是？", opts:["borrow","banana","battery","balloon"], a:0, why:"材料围绕借书。"}
];
const KEY = "yxx-web-demo-v1";
function save(){ try{ localStorage.setItem(KEY, JSON.stringify({v:1,S})); }catch(e){} }
function load(){ try{ const d=JSON.parse(localStorage.getItem(KEY)||"null"); if(d&&d.v===1&&d.S) Object.assign(S,d.S);}catch(e){} }
function toast(m){ const el=document.getElementById("toast"); el.textContent=m; el.classList.add("show"); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove("show"),1800); }
function nav(h){ if(location.hash===h) render(); else location.hash=h; }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
function buildNav(active){
  document.getElementById("nav").innerHTML = NAV.map(([sec,items])=>
    `<div class="sec">${sec}</div>`+items.map(id=>{
      const on = active===id || (id==="today" && ["practice","mistakes","srs","result"].includes(active));
      return `<a href="#/${id}" class="${on?"on":""}">${TITLES[id]||id}</a>`;
    }).join("")
  ).join("");
}
function pageFrame(title,desc,body){ return `<div class="card"><h2>${title}</h2><p class="d">${desc}</p>${body}</div>`; }
function bound(title,note){ return pageFrame(title,note,`<div class="empty"><b>演示边界页</b><p class="d">入口已保留，正式能力按产品分期。本页为假数据壳。</p><button class="btn ghost" onclick="nav('#/home')">回首页</button></div>`); }

const V = {};
V.login = () => `<div class="auth-shell"><div class="card"><span class="tag wa">静态演示 / 假数据</span><h2>登录</h2><p class="d">任意非空邮箱即可进入演示账号。</p>
<label class="lb">邮箱</label><input id="em" value="qa.demo@example.com"><label class="lb">密码</label><input id="pw" type="password" value="demo-pass">
<button class="btn block" onclick="doLogin()">登录</button>
<p class="row" style="margin-top:12px"><button class="ghost" onclick="nav('#/register')">注册</button><button class="ghost" onclick="nav('#/reset')">忘记密码</button></p></div></div>`;
V.register = () => `<div class="auth-shell"><div class="card"><h2>注册</h2><p class="d">注册后进入成人门。</p>
<label class="lb">邮箱</label><input id="em" placeholder="new@example.com"><label class="lb">密码</label><input id="pw" type="password">
<button class="btn block" onclick="S.user=(document.getElementById('em').value||'新用户').trim();S.gate='';S.quiz={i:0,sel:null,done:false,score:0,answers:[]};save();toast('注册成功（演示）');nav('#/gate')">注册并继续</button>
<button class="btn ghost block" onclick="nav('#/login')">已有账号</button></div></div>`;
V.reset = () => pageFrame("重置密码","演示只提示，不发信。",`<label class="lb">邮箱</label><input placeholder="you@example.com"><button class="btn" onclick="toast('已发送重置链接（演示）')">发送链接</button>`);
V.gate = () => pageFrame("身份确认","请确认已满 18 岁。",`<div class="row"><button class="btn" onclick="S.gate='PASS';save();toast('已确认成年');nav('#/onboard')">我已满 18 岁</button><button class="btn ghost" onclick="S.gate='REJECT';save();nav('#/greject')">未满 18 岁</button></div>`);
V.greject = () => pageFrame("无法继续","未通过成人门。",`<button class="btn" onclick="nav('#/gate')">返回重新确认</button>`);
V.cupgrade = () => pageFrame("同意书升级","新版本需重新勾选。",`<label><input type="checkbox" id="c1"> 我已阅读并同意最新条款</label><br><br><button class="btn" onclick="if(!document.getElementById('c1').checked)return toast('请先勾选');toast('已更新同意');nav('#/home')">确认</button>`);
V.onboard = () => pageFrame("学习目标","目标与每日预算影响今日任务。",`
<label class="lb">目标</label><select id="goal"><option>大学英语 · 四级</option><option>大学英语 · 六级</option><option>考研</option><option>职场</option><option>基础</option></select>
<label class="lb">每日预算（分钟）</label><select id="bud"><option>15</option><option selected>30</option><option>45</option><option>5</option></select>
<button class="btn" onclick="S.goal=document.getElementById('goal').value;S.budget=+document.getElementById('bud').value;save();nav('#/placement')">去定级</button>
<button class="btn ghost" onclick="S.goal=document.getElementById('goal').value;S.budget=+document.getElementById('bud').value;save();nav('#/pgen')">跳过定级，生成计划</button>`);
V.placement = () => {
  if (S.quiz.done) return V.report();
  const i=S.quiz.i, q=BANK[i];
  return `<div class="grid 2"><div class="card"><h2>定级测评 · ${i+1}/${BANK.length}</h2><p class="d">密封卷演示</p><div class="prog"><i style="width:${(i/BANK.length)*100}%"></i></div>
  <p style="margin:16px 0;font-size:16px">${esc(q.q)}</p>
  ${q.opts.map((o,idx)=>`<button class="opt ${S.quiz.sel===idx?"sel":""}" onclick="S.quiz.sel=${idx};render()">${esc(o)}</button>`).join("")}
  <div class="row" style="margin-top:12px"><button class="btn" onclick="placeNext()">确认</button></div></div>
  <div class="card"><h2>说明</h2><p class="d">正式 10 题；Demo 用 5 题样例。</p><p class="d">目标：${esc(S.goal)} · ${S.budget} 分钟</p></div></div>`;
};
V.pfault = () => pageFrame("定级结果未知","可查询回执（演示幂等）。",`<button class="btn" onclick="S.quiz.done=true;S.quiz.score=71;save();nav('#/report')">查询结果</button>`);
V.report = () => `<div class="grid 2"><div class="card hero"><h2>定级报告</h2><p class="d">B1 · ${S.quiz.score||S.score} 分（演示）</p>
<div class="kpis"><div class="kpi"><b>72</b><span>词汇</span></div><div class="kpi"><b>70</b><span>语法</span></div><div class="kpi"><b>74</b><span>阅读</span></div><div class="kpi"><b>68</b><span>听力</span></div></div>
<button class="btn" style="background:#fff;color:var(--brand)" onclick="nav('#/pgen')">生成今日计划</button></div>
<div class="card"><h2>教练建议</h2><p class="d">先稳住语法与高频词。建议每日 ${S.budget} 分钟。</p><button class="btn ghost" onclick="nav('#/home')">进入首页</button></div></div>`;
V.pgen = () => { clearTimeout(V._pg); V._pg=setTimeout(()=>{ if(location.hash==="#/pgen"){ S.today=[{id:"t1",t:"语法 · There be",kind:"语法",done:false,est:8},{id:"t2",t:"阅读 · 图书馆的一天",kind:"阅读",done:false,est:12},{id:"t3",t:"词汇复习 4 词",kind:"复习",done:false,est:6}]; save(); toast("计划已生成（演示）"); nav("#/today"); } },700);
  return pageFrame("计划生成中","正在编排今日任务…",`<div class="prog"><i style="width:66%"></i></div><p class="d">${esc(S.goal)} · ${S.budget} 分钟</p>`); };
V.planexp = () => pageFrame("计划解释",`按「${esc(S.goal)}」与 ${S.budget} 分钟排布。`,`<ul><li>语法 8 分钟</li><li>阅读 12 分钟</li><li>复习 6 分钟</li></ul><button class="btn" onclick="nav('#/today')">回到今日</button>`);
V.home = () => {
  const left=S.today.filter(t=>!t.done).length, done=S.today.filter(t=>t.done).length;
  return `<div class="grid 2"><div class="card hero"><span class="tag" style="background:rgba(255,255,255,.2);color:#fff">静态演示 / 假数据</span>
  <h2 style="font-size:22px;margin-top:8px">你好，${esc(S.user)}</h2>
  <p class="d">${esc(S.goal)} · ${S.level} · 今日 ${done}/${S.today.length}</p>
  <div class="kpis"><div class="kpi"><b>${left}</b><span>待做</span></div><div class="kpi"><b>${S.budget}</b><span>分钟</span></div><div class="kpi"><b>${S.mistakes.length}</b><span>错题</span></div><div class="kpi"><b>${S.words.filter(w=>w.due).length}</b><span>到期词</span></div></div>
  <div class="row"><button class="btn" style="background:#fff;color:var(--brand)" onclick="nav('#/today')">继续今日</button>
  <button class="btn ghost" style="background:rgba(255,255,255,.18);color:#fff" onclick="nav('#/weekly')">看报告</button></div></div>
  <div class="stack"><div class="card"><h2>快捷入口</h2><div class="row">
  ${[["今日","#/today"],["错题","#/mistakes"],["复习","#/srs"],["书架","#/shelf"],["写作","#/writing"],["客服","#/support"]].map(([t,h])=>`<button class="btn sm ghost" onclick="nav('${h}')">${t}</button>`).join("")}
  </div></div>
  <div class="card"><h2>在学图书</h2>${S.books.map(b=>`<div class="list-item"><div><b>${esc(b.title)}</b><p class="d">${esc(b.ch)} · ${b.prog}%</p></div><button class="btn sm" onclick="nav('#/chapter')">续读</button></div>`).join("")}</div></div></div>`;
};
V.today = () => `<div class="grid 2"><div class="card"><div class="row" style="justify-content:space-between"><h2>今日任务</h2><button class="btn sm ghost" onclick="nav('#/planexp')">为何这样排？</button></div>
<p class="d">${esc(S.goal)} · ${S.budget} 分钟</p>
${S.today.length? S.today.map(t=>`<div class="list-item"><div><b>${esc(t.t)}</b><p class="d">${t.kind} · 约 ${t.est} 分钟</p></div>
${t.done? '<span class="tag ok">完成</span>' : `<button class="btn sm" onclick="nav('${t.kind==="复习"?"#/srs":"#/practice"}')">开始</button>`}</div>`).join("") : `<div class="empty"><b>今日暂无任务</b><button class="btn" onclick="nav('#/pgen')">生成计划</button></div>`}
</div><div class="stack"><div class="card"><h2>状态</h2><p class="d">任务完成 ≠ 错题已验证。</p><button class="btn ghost" onclick="S.today.forEach(t=>t.done=true);save();nav('#/celebrate')">模拟全完成</button></div>
<div class="card"><h2>相关</h2><div class="row"><button class="btn sm ghost" onclick="nav('#/mistakes')">错题本</button><button class="btn sm ghost" onclick="nav('#/weekly')">日回顾</button><button class="btn sm ghost" onclick="nav('#/arrears')">补课</button></div></div></div></div>`;
V.practice = () => { const q=BANK[1]; return `<div class="grid 2"><div class="card"><h2>练题 · 语法</h2><p class="d">行内判分</p><p style="font-size:16px;margin:12px 0">${esc(q.q)}</p>
${q.opts.map((o,i)=>`<button class="opt" onclick="answerPractice(${i},${q.a})">${esc(o)}</button>`).join("")}<div id="fb"></div></div>
<div class="card"><h2>本轮</h2><p class="d">查看结果不重做；再练开新轮次。</p><button class="btn ghost" onclick="nav('#/result')">看结果页</button></div></div>`; };
V.result = () => pageFrame("本题结果","当轮汇总（演示）。",`<p>正确 1 · 错误 0 · 预估 2 分钟</p><div class="row"><button class="btn" onclick="nav('#/today')">回今日</button><button class="btn ghost" onclick="nav('#/practice')">再练</button></div>`);
V.mistakes = () => `<div class="card"><h2>错题本</h2><p class="d">匹配变式；自评不直接通过验证。</p>
<table class="table"><thead><tr><th>题目</th><th>状态</th><th></th></tr></thead><tbody>
${S.mistakes.map(m=>`<tr><td><b>${esc(m.stem)}</b><div class="muted">作答 ${esc(m.wrong)} · ${esc(m.right)}</div></td><td><span class="tag ${m.st==="todo"?"wa":""}">${m.st}</span></td><td><button class="btn sm" onclick="nav('#/practice')">修复</button></td></tr>`).join("")}
</tbody></table></div>`;
V.srs = () => { const due=S.words.filter(w=>w.due); const w=due[0];
  if(!w) return pageFrame("复习","暂无到期词。",`<button class="btn" onclick="nav('#/words')">去词汇</button>`);
  return `<div class="grid 2"><div class="card"><h2>复习 · ${esc(w.word)}</h2><p class="d">本批≤4 · 忘记可再看一次</p>
  <p style="font-size:28px;font-weight:800;margin:18px 0">${esc(w.word)}</p><p class="d">${esc(w.gloss)}</p>
  <div class="row"><button class="btn ghost" onclick="srsMark('${w.id}',false)">忘了</button><button class="btn ghost" onclick="srsMark('${w.id}',false)">还要想想</button><button class="btn" onclick="srsMark('${w.id}',true)">想起来了</button><button class="btn" onclick="srsMark('${w.id}',true)">很熟悉</button></div></div>
  <div class="card"><h2>本批</h2>${due.map(x=>`<div class="list-item"><b>${esc(x.word)}</b><span class="muted">${esc(x.gloss)}</span></div>`).join("")}</div></div>`; };
V.reviewqueue = () => pageFrame("复习队列","到期与待验证。",`<table class="table"><thead><tr><th>词</th><th>释义</th><th>到期</th></tr></thead><tbody>
${S.words.map(w=>`<tr><td>${esc(w.word)}</td><td>${esc(w.gloss)}</td><td>${w.due?"是":"否"}</td></tr>`).join("")}</tbody></table><button class="btn" onclick="nav('#/srs')">开始本批</button>`);
V.words = () => `<div class="card"><h2>词汇</h2><table class="table"><thead><tr><th>词</th><th>释义</th><th></th></tr></thead><tbody>
${S.words.map(w=>`<tr><td><b>${esc(w.word)}</b></td><td>${esc(w.gloss)}</td><td><button class="btn sm ghost" onclick="nav('#/vocab')">详情</button></td></tr>`).join("")}</tbody></table></div>`;
V.vocab = () => pageFrame("词汇详情 · library","可自测 / 加复习。",`<p>n. 图书馆</p><div class="row"><button class="btn" onclick="toast('已加入复习（演示）')">加复习</button><button class="btn ghost" onclick="nav('#/drill')">去刷词</button></div>`);
V.wordbook = () => pageFrame("单词本","收藏与自定义词本。",`<div class="list-item"><b>默认词本</b><span class="tag">${S.words.length} 词</span></div>`);
V.drill = () => pageFrame("刷单词","限时 / 普通。",`<div class="row"><button class="btn" onclick="toast('普通刷词（演示）')">普通</button><button class="btn ghost" onclick="toast('限时挑战（演示）')">限时</button></div>`);
V.courses = () => `<div class="card"><h2>课程</h2><p class="d">目标 / 水平 / 在学 / 收藏筛选。</p><div class="grid 3">${S.books.map(b=>`<div class="card" style="box-shadow:none"><b>${esc(b.title)}</b><p class="d">进度 ${b.prog}%</p><button class="btn sm" onclick="nav('#/book')">查看</button></div>`).join("")}<div class="card empty" style="box-shadow:none"><b>暂无更多</b><p class="d">空态示例</p></div></div></div>`;
V.shelf = () => `<div class="card"><h2>书架</h2>${S.books.map(b=>`<div class="list-item"><div><b>${esc(b.title)}</b><p class="d">${esc(b.ch)}</p><div class="prog"><i style="width:${b.prog}%"></i></div></div><button class="btn sm" onclick="nav('#/chapter')">续读</button></div>`).join("")}</div>`;
V.book = () => pageFrame("图书详情","目录与续读。",`<ol><li>第 1 章</li><li>第 2 章</li><li>第 3 章（续读）</li></ol><button class="btn" onclick="nav('#/chapter')">继续第 3 章</button>`);
V.chapter = () => `<div class="two-col"><div class="card"><h2>目录</h2><p class="d">浏览不改续读点</p><button class="btn sm ghost block">第 1 章</button><button class="btn sm block">第 3 章</button></div>
<div class="card"><h2>第 3 章 · 校园生活</h2><p>The library opens at eight. Students borrow books and find a quiet shelf.</p>
<div class="row"><button class="btn sm ghost" onclick="toast('library · 图书馆')">查词</button><button class="btn sm ghost" onclick="toast('笔记已保存')">笔记</button><button class="btn" onclick="toast('本节完成');nav('#/book')">完成本节</button></div></div></div>`;
V.collections = () => pageFrame("收藏","章节与词条。",`<div class="list-item"><b>第 3 章 · 校园生活</b><button class="btn sm ghost" onclick="nav('#/chapter')">打开</button></div>`);
V.listening = () => pageFrame("听力","理解结果保存。",`<button class="btn" onclick="toast('已标记：理解')">我听懂了</button><button class="btn ghost" onclick="toast('需再听')">再听一次</button>`);
V.speaking = () => pageFrame("口语","自练记录（演示）。",`<button class="btn" onclick="toast('已保存自练记录')">完成自练</button>`);
V.writing = () => pageFrame("写作 · 邀请信","草稿本机保存；不调用 AI。",`<label class="lb">正文</label><textarea id="wtxt" rows="8">Dear Sam,
I would like to invite you to our reading club this Friday at 7pm.
Best,
Alex</textarea><div class="row"><button class="btn" onclick="toast('已提交（演示）')">确认提交</button><button class="btn ghost" onclick="toast('草稿已保存')">存草稿</button></div>`);
V.phonics = () => bound("音标","音标练习入口。");
V.alphabet = () => bound("字母","字母认读入口。");
V.weekly = () => `<div class="grid 2"><div class="card"><h2>本周报告</h2><p class="d">用时为预估。</p><div class="kpis"><div class="kpi" style="background:#f3edff;color:var(--ink)"><b>5</b><span>学习日</span></div><div class="kpi" style="background:#f3edff;color:var(--ink)"><b>12</b><span>轮次</span></div><div class="kpi" style="background:#f3edff;color:var(--ink)"><b>86</b><span>正确率%</span></div><div class="kpi" style="background:#f3edff;color:var(--ink)"><b>120</b><span>XP</span></div></div><button class="btn ghost" onclick="nav('#/recap')">今日回顾</button></div>
<div class="card"><h2>下钻</h2><div class="list-item"><b>语法 · There be</b><button class="btn sm ghost" onclick="nav('#/result')">看结果</button></div></div></div>`;
V.recap = () => pageFrame("今日回顾","与周报同一份记录。",`<button class="btn" onclick="nav('#/history')">全部历史</button>`);
V.history = () => pageFrame("学习历史","轮次列表。",`<div class="list-item"><b>定级</b><span class="tag">71 分</span></div><div class="list-item"><b>语法题组</b><span class="tag ok">完成</span></div>`);
V.mastery = () => pageFrame("掌握度","演示趋势。",`<p>词汇 72% · 语法 68% · 阅读 74%</p>`);
V.achieve = () => pageFrame("成就墙","样例，不上正式榜。",`<div class="row"><span class="tag">首日打卡</span><span class="tag">定级完成</span><span class="tag">连续 3 天</span></div>`);
V.league = () => pageFrame("联赛","成员为固定样例。",`<table class="table"><tr><th>#</th><th>昵称</th><th>XP</th></tr><tr><td>1</td><td>示例-A</td><td>900</td></tr><tr><td>2</td><td>演示账号</td><td>120</td></tr></table>`);
V.rewards = () => pageFrame("任务奖励","不入账。",`<div class="list-item"><b>完成今日</b><span class="tag">+30 XP</span></div>`);
V.calendar = () => pageFrame("学习日历","两周学习日 / 休息日。",`<div class="row">${Array.from({length:14},(_,i)=>`<span class="tag ${i%3?".ok":""}">D${i+1}</span>`).join("")}</div>`);
V.plan = () => pageFrame("我的计划",`当前 ${esc(S.goal)} · ${S.budget} 分钟。调整前可预览。`,`<button class="btn" onclick="nav('#/onboard')">调整目标</button>`);
V.arrears = () => pageFrame("补课提醒","漏学任务提醒。",`<div class="list-item"><b>昨日阅读未完成</b><button class="btn sm" onclick="nav('#/practice')">补做</button></div>`);
V.celebrate = () => pageFrame("今日完成 🎉","全部任务已完成（演示）。",`<button class="btn" onclick="nav('#/weekly')">看报告</button>`);
V.firstlearn = () => pageFrame("首次学习","首访引导。",`<button class="btn" onclick="nav('#/today')">开始第一项</button>`);
V.session = () => pageFrame("会话检查点","会话过期 / 续期演示。",`<button class="btn" onclick="toast('已续期（演示）')">续期</button>`);
V.offlinet = () => pageFrame("断网今日","离线只读。",`<p class="d">可查看已缓存任务，提交需联网。</p>`);
V.offpkg = () => bound("离线包","下载包边界。");
V.world = () => pageFrame("世界","活动与动态（演示）。",`<div class="row"><button class="btn ghost" onclick="nav('#/league')">联赛</button><button class="btn ghost" onclick="nav('#/games')">小游戏</button><button class="btn ghost" onclick="nav('#/avatar')">装扮</button></div>`);
V.avatar = () => pageFrame("装扮","2D 预览（演示）。",`<div style="font-size:64px;text-align:center">🧑‍🎓</div><button class="btn" onclick="toast('已保存装扮（演示）')">保存</button>`);
V.msgs = () => pageFrame("消息","系统与活动消息。",`<div class="list-item"><b>定级报告已出</b><span class="muted">今天</span></div><div class="list-item"><b>计划已更新</b><span class="muted">昨天</span></div>`);
V.space = () => pageFrame("个人空间","公开资料卡片。",`<p><b>${esc(S.user)}</b> · ${S.level}</p><p class="d">${esc(S.goal)}</p>`);
V.games = () => bound("小游戏","轻游戏入口。");
V.search = () => pageFrame("搜索","课程 / 词汇 / 帮助。",`<input id="sq" placeholder="输入关键词" oninput="toast('搜索：'+this.value)"><div class="list-item"><b>library</b><button class="btn sm ghost" onclick="nav('#/vocab')">词汇</button></div><div class="list-item"><b>四级阅读精练</b><button class="btn sm ghost" onclick="nav('#/book')">课程</button></div>`);
V.me = () => `<div class="grid 2"><div class="card" style="text-align:center"><div style="font-size:48px">👤</div><b style="font-size:20px">${esc(S.user)}</b><p class="d">${esc(S.goal)} · ${S.level}</p><button class="btn ghost" onclick="nav('#/settings')">设置</button></div>
<div class="card"><h2>入口</h2>${[["学习历史","#/history"],["我的计划","#/plan"],["隐私","#/privacy"],["客服","#/support"],["设备","#/devices"],["关于","#/about"]].map(([t,h])=>`<div class="list-item"><b>${t}</b><button class="btn sm ghost" onclick="nav('${h}')">打开</button></div>`).join("")}
<button class="btn danger block" style="margin-top:12px" onclick="S.user=null;save();nav('#/login')">退出登录</button></div></div>`;
V.settings = () => pageFrame("设置","主题 / 字号 / 动效。",`<div class="row"><button class="btn sm" onclick="toast('浅色')">浅色</button><button class="btn sm ghost" onclick="toast('深色')">深色</button><button class="btn sm ghost" onclick="toast('跟随系统')">跟随系统</button></div>
<p class="d" style="margin-top:12px">字号</p><div class="row"><button class="btn sm ghost" onclick="toast('标准')">标准</button><button class="btn sm ghost" onclick="toast('大')">大</button><button class="btn sm ghost" onclick="toast('特大')">特大</button></div>
<button class="btn ghost" style="margin-top:12px" onclick="nav('#/a11y')">无障碍</button> <button class="btn ghost" onclick="nav('#/lab')">演示工具</button>`);
V.devices = () => pageFrame("设备","登录设备列表。",`<div class="list-item"><b>当前浏览器</b><span class="tag ok">本机</span></div><div class="list-item"><b>iPhone（演示）</b><button class="btn sm ghost" onclick="toast('已移除（演示）')">移除</button></div>`);
V.privacy = () => pageFrame("隐私","同意与撤回。",`<div class="list-item"><b>服务条款 v3</b><span class="tag ok">已同意</span></div><button class="btn ghost" onclick="toast('已提交撤回申请（演示）')">撤回同意</button>`);
V.npref = () => pageFrame("通知偏好","推送与邮件。",`<label><input type="checkbox" checked> 学习提醒</label><br><label><input type="checkbox"> 营销邮件</label>`);
V.a11y = () => pageFrame("无障碍","高对比 / 减少动效。",`<div class="row"><button class="btn sm ghost" onclick="toast('高对比开')">高对比</button><button class="btn sm ghost" onclick="toast('减少动效')">减少动效</button></div>`);
V.support = () => `<div class="card"><h2>客服</h2><p class="d">工单列表（演示）。</p>${S.tickets.map(t=>`<div class="list-item"><div><b>${t.id} · ${esc(t.t)}</b><p class="d">${t.st}</p></div><button class="btn sm" onclick="nav('#/tdetail')">查看</button></div>`).join("")}
<button class="btn" onclick="toast('演示环境工单提交关闭中')">新建工单</button></div>`;
V.tdetail = () => pageFrame("工单详情 · TK-2048","处理中。",`<p>定级第 6 题卡住（演示正文）</p><button class="btn ghost" onclick="nav('#/support')">返回</button>`);
V.about = () => pageFrame("关于","语学星学员网页静态 Demo。",`<p class="d">版本 webDemo-learner · 假数据</p>`);
V.paudio = () => bound("音频保留","音频保留策略说明。");
V.lab = () => pageFrame("演示工具","场景切换与故障注入（不出现在正式学习主路径文案之外的入口说明）。",`
<div class="row"><button class="btn sm" onclick="localStorage.removeItem(KEY);location.reload()">重置全部</button>
<button class="btn sm ghost" onclick="S.today.forEach(t=>t.done=false);save();toast('今日已恢复');render()">恢复今日</button>
<button class="btn sm ghost" onclick="S.today=[];save();toast('无内容');render()">无内容</button>
<button class="btn sm ghost" onclick="nav('#/placement')">重做定级</button></div>
<p class="d">故障：提交失败 / 结果未知 / 断网 — 本桌面 Demo 以 toast 模拟。</p>
<button class="btn ghost" onclick="toast('下一次提交将失败（演示）')">注入提交失败</button>`);
V.commerce = () => pageFrame("商城","沙盒商品，不扣款。",`<div class="list-item"><b>月度会员（沙盒）</b><button class="btn sm" onclick="nav('#/pay')">购买</button></div>`);
V.pay = () => pageFrame("收银台","确认支付（演示不扣款）。",`<p>月度会员 · ¥0（沙盒）</p><button class="btn" onclick="toast('支付成功（演示）');nav('#/subs')">确认</button>`);
V.refund = () => pageFrame("退款开票","进度演示。",`<p><span class="tag wa">处理中</span> 退款申请 RF-01</p>`);
V.subs = () => pageFrame("订阅对账","订阅状态说明。",`<p>当前：沙盒会员 · 权益已标记</p><button class="btn ghost" onclick="nav('#/refund')">退款开票</button>`);
V.ai = () => bound("AI 伴学","P2 边界。");
V.aigate = () => bound("AI 门","能力门控。");
V.aiflow = () => bound("AI 链","对话链边界。");
V.voice = () => bound("语音跟读","未接真评分。");
V.vscore = () => bound("语音评分","评分样例边界。");
V.k12 = () => bound("青少年模式","K12 说明。");
V.k12guard = () => bound("K12 治理","监护与时长。");
V.k12course = () => bound("K12 课程","课程目录样例。");
V.native = () => bound("原生壳","App 壳能力说明。");

function doLogin(){
  const em=(document.getElementById("em")||{}).value||"演示账号";
  S.user=em.trim()||"演示账号"; if(S.gate!=="PASS") S.gate="PASS"; save(); toast("登录成功（演示）"); nav("#/home");
}
function placeNext(){
  if(S.quiz.sel==null) return toast("请先选择");
  S.quiz.answers.push(S.quiz.sel); S.quiz.sel=null; S.quiz.i++;
  if(S.quiz.i>=BANK.length){ S.quiz.done=true; S.quiz.score=71; S.level="B1"; save(); nav("#/report"); return; }
  save(); render();
}
function answerPractice(i,a){
  const ok=i===a; const fb=document.getElementById("fb");
  fb.className="fb "+(ok?"ok":"no"); fb.style.display="block";
  fb.innerHTML = ok ? `<div class="tag ok">正确</div> 已记入本轮` : `<div class="tag no">错误</div> 已进错题本（演示）`;
  if(!ok && !S.mistakes.find(m=>m.id==="m-live")) S.mistakes.unshift({id:"m-live",stem:BANK[1].q,wrong:BANK[1].opts[i],right:BANK[1].why,st:"todo"});
  save();
}
function srsMark(id,ok){ const w=S.words.find(x=>x.id===id); if(w){ w.due=!ok; } save(); toast(ok?"已完成本词（演示）":"本轮稍后再看（演示）"); render(); }

function resolveRoute(req){
  let r = V[req] ? req : "home";
  if(!AUTH_FREE.includes(r) && !S.user) return "login";
  if(!AUTH_FREE.includes(r) && !["gate","greject","me","settings","lab","about"].includes(r) && S.gate!=="PASS") return "gate";
  return r;
}
function render(){
  load();
  const req=(location.hash||"#/home").replace("#/","");
  const r=resolveRoute(req);
  if(location.hash!=="#/"+r){ history.replaceState(null,"","#/"+r); }
  document.getElementById("title").textContent = TITLES[r]||"语学星";
  document.getElementById("crumb").textContent = "静态桌面布局 · 假数据 · " + (GROUPS_SAFE(r));
  document.getElementById("userChip").textContent = S.user || "未登录";
  const hideSide = AUTH_FREE.includes(r) && !S.user;
  document.getElementById("app").classList.toggle("hide-side", hideSide);
  buildNav(r);
  document.getElementById("view").innerHTML = V[r]();
  document.getElementById("view").scrollTop = 0;
}
function GROUPS_SAFE(r){
  const map={login:"账户",register:"账户",home:"主页",today:"学习",courses:"课程",weekly:"成长",world:"世界",me:"账户",commerce:"商业",ai:"扩展"};
  return map[r] || "功能页";
}
window.addEventListener("hashchange", render);
load();
if(!S.user && !(location.hash||"").includes("login")) location.hash="#/login";
render();
