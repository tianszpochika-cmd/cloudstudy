/* Static prototype shell regressions. Runs the actual page scripts in isolated memory;
 * does not open browsers, touch user storage, or assert backend authentication. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mobile = path.resolve(__dirname, '../docs/06-design/v2-980plus/redesign/mockups/mobile');
const app = fs.readFileSync(path.join(mobile, 'app.js'), 'utf8');
const learning = fs.readFileSync(path.join(mobile, 'learning.js'), 'utf8').replace(/\nbootMock\(\);\s*$/, '\n');

function runtime(storage = new Map()) {
  const timers = [], intervals = new Map(), messages = [], nodes = new Map(), checks = ['TERMS', 'PRIVACY', 'ADULT_LEARNING'].map(key => ({ checked: false, dataset: { consent: key } }));
  let intervalSerial = 0;
  const element = id => { if (!nodes.has(id)) nodes.set(id, { value: '', checked: false, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} } }); return nodes.get(id); };
  const location = { search: '', hash: '#/home' };
  const history = { state: null, length: 1, backCalls: 0, back() { this.backCalls++; }, replaceState(state, unused, hash) { this.state = state; if (hash) location.hash = hash; } };
  const context = vm.createContext({
    console, location, history, Date, JSON, Math, Object, Array, Number, String, RegExp,
    localStorage: { setItem(k, v) { storage.set(k, v); }, getItem(k) { return storage.get(k) || null; }, removeItem(k) { storage.delete(k); } },
    document: { getElementById: element, querySelectorAll(selector) { return selector === '.ag' ? checks : []; }, addEventListener() {}, hidden: false },
    window: { addEventListener() {}, matchMedia() { return { matches: false }; } },
    setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval(fn) { const id = ++intervalSerial; intervals.set(id, fn); return id; }, clearInterval(id) { intervals.delete(id); },
  });
  vm.runInContext(app, context, { filename: 'app.js' });
  vm.runInContext(learning, context, { filename: 'learning.js' });
  context.auditToast = message => messages.push(message);
  vm.runInContext('toast = auditToast; render = function () { syncIdentity(); dbSave(); }; normalizeState(); lmNormalize(); ACTIVE_IDENTITY = S.user;', context);
  return { run: code => vm.runInContext(code, context), node: element, checks, storage, history, location, messages, document: context.document, flush() { while (timers.length) timers.shift()(); }, tick() { [...intervals.values()].forEach(fn => fn()); } };
}
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { console.error('FAIL ' + name); throw e; } }

test('birthday boundaries use full calendar dates', () => {
  const r = runtime();
  assert.equal(r.run("birthdayAge('2008-10-01', new Date(2026,9,1))"), 18);
  assert.equal(r.run("birthdayAge('2008-10-02', new Date(2026,9,1))"), 17);
  assert.equal(r.run("birthdayAge('2008-02-29', new Date(2026,1,28))"), 17);
  assert.equal(r.run("birthdayAge('2008-02-29', new Date(2026,2,1))"), 18);
  for (const date of ['2026-10-02', '2008-02-30', '2008-13-01', '2008', '0000-01-01']) assert.equal(r.run(`birthdayAge(${JSON.stringify(date)}, new Date(2026,9,1))`), null);
});
test('minor date rejects learning and clears prior consents', () => {
  const r = runtime(); r.node('by').value = String(new Date().getFullYear() - 10) + '-01-01'; r.node('cf').checked = true; r.run('doGate()');
  assert.equal(r.run('S.gate'), 'REJECTED'); assert.equal(r.run('hasConsents()'), false); assert.equal(r.run("resolveRoute('placement')"), 'gate');
});
test('adult confirmation requires an explicit checkbox', () => {
  const r = runtime(); r.run("S.gate='PENDING';S.consents={}"); r.node('by').value = '1990-01-01'; r.run('doGate()'); assert.equal(r.run('S.gate'), 'PENDING');
  r.node('cf').checked = true; r.run('doGate()'); assert.equal(r.run('S.gate'), 'PASS');
  assert.doesNotMatch(r.run('V.gate()'), /class="ag"[^>]*checked/);
});
test('confirmed birthday survives storage round trip', () => {
  const r = runtime(); r.node('by').value = '1990-01-01'; r.node('cf').checked = true; r.run('doGate()');
  const reload = runtime(r.storage); reload.run('dbLoad();normalizeState()'); assert.equal(reload.run('S.birthDate'), '1990-01-01');
});
test('consent cannot bypass a pending adult gate', () => {
  const r = runtime(); r.run("S.gate='PENDING';S.consents={}"); r.checks.forEach(x => { x.checked = true; }); r.run('doConsents()');
  assert.equal(r.run('hasConsents()'), false); assert.notEqual(r.location.hash, '#/onboard');
});
test('consent records all three current versions and survives reload', () => {
  const r = runtime(); r.run('S.consents={}'); r.checks[0].checked = true; r.run('doConsents()'); assert.equal(r.run('hasConsents()'), false);
  r.checks.forEach(x => { x.checked = true; }); r.run('doConsents()'); assert.equal(r.run('hasConsents()'), true); assert.equal(r.location.hash, '#/onboard');
  const reload = runtime(r.storage); reload.run('dbLoad();normalizeState()'); assert.equal(reload.run('hasConsents()'), true);
  reload.run("S.consentV='new-version'"); assert.equal(reload.run("resolveRoute('today')"), 'gate');
});
test('routes protect learning, reports and administration', () => {
  const r = runtime(); assert.equal(r.run("resolveRoute('report')"), 'placement'); assert.equal(r.run("resolveRoute('admin')"), 'alogin');
  r.run('S.staff=true'); assert.equal(r.run("resolveRoute('admin')"), 'admin');
  r.run("S.gate='REJECTED'"); for (const route of ['home', 'today', 'practice', 'srs', 'chapter', 'writing', 'placement']) assert.equal(r.run(`resolveRoute('${route}')`), 'gate');
  for (const route of ['support', 'privacy', 'settings']) assert.equal(r.run(`resolveRoute('${route}')`), route);
  r.run('S.user=null'); assert.equal(r.run("resolveRoute('admin')"), 'login');
});
test('unfinished placement submissions reload with a query action', () => {
  const r = runtime(); r.run('S.quiz.sel=0;qSubmit()'); assert.equal(r.run('S.quiz.phase'), 'submitting');
  const reload = runtime(r.storage); reload.run('dbLoad();normalizeState();lmNormalize()'); assert.equal(reload.run('S.quiz.phase'), 'unknown');
  assert.equal(reload.run('S.quiz.sel'), 0); assert.match(reload.run('V.placement()'), /qResolve\(\)/); reload.run('qResolve();qResolve()');
  assert.equal(reload.run('S.quiz.answers.filter(Boolean).length'), 1);
});
test('placement selections save before submission', () => {
  const r = runtime(); r.run('pick(2)'); const reload = runtime(r.storage); reload.run('dbLoad();normalizeState()'); assert.equal(reload.run('S.quiz.sel'), 2);
});
test('logout cancels deferred placement writes and staff preview', () => {
  const r = runtime(); r.run('S.staff=true;S.quiz.sel=0;qSubmit();S.user=null;nav("#/login")'); r.flush();
  assert.equal(r.run('S.quiz.answers.filter(Boolean).length'), 0); assert.equal(r.run('S.staff'), false); assert.equal(r.run('S.quiz.phase'), 'unknown');
});
test('identity switches cancel practice and plan callbacks', () => {
  const r = runtime(); r.run("startGroup(S.today[0].id);PR.sel=0;prSubmit();pgenStart();S.user='另一演示身份';syncIdentity()"); r.flush();
  assert.equal(r.run('PR.answers.filter(Boolean).length'), 0); assert.notEqual(r.run('PG.st'), 'ok'); assert.equal(r.run('LM.records.length'), 0);
});
test('logout retains writing drafts and cancels their pending callbacks', () => {
  const r = runtime(); r.run("LM.writing.text='Dear Sam, study this weekend. Best wishes.';LM.writing.phase='confirm';lmWritingSubmit();S.user=null;nav('#/login')"); r.flush();
  assert.equal(r.run('LM.writes.length'), 0); assert.equal(r.run('LM.writing.phase'), 'draft'); assert.match(r.run('LM.writing.text'), /Dear Sam/);
});
test('free course practice survives shell normalization', () => {
  const r = runtime(); r.run("LM.freeTasks ||= {};LM.freeTasks['free-a']={id:'free-a',group:'g1'};PR.taskId='free-a';PR.pos=1;normalizeState()");
  assert.equal(r.run('PR.taskId'), 'free-a'); assert.equal(r.run('PR.pos'), 1);
});
test('back fallback never exits a direct entry page', () => {
  const r = runtime(); r.history.length = 5; r.run('goBack()'); assert.equal(r.history.backCalls, 0); assert.equal(r.location.hash, '#/home');
  r.history.state = { yxxMobile: true, depth: 1 }; r.run('goBack()'); assert.equal(r.history.backCalls, 1);
});
test('blank credentials do not claim login and identity text is escaped', () => {
  const r = runtime(); r.run('S.user=null;S.staff=true'); r.run('doLogin()'); assert.equal(r.run('S.user'), null);
  r.node('li').value = '<img src=x onerror=alert(1)>'; r.node('lp').value = 'demo-only'; r.run('doLogin()'); assert.equal(r.run('S.staff'), false);
  assert.match(r.run('V.me()'), /&lt;img/); assert.doesNotMatch(r.run('V.me()'), /<img src=x/); assert.match(r.run('V.login()'), /不隔离多账号数据/);
});
test('vocabulary paint and repeated clicks cannot reopen a repaired mistake', () => {
  const r = runtime(); r.run("DR.mode='quiz';DR.quizPick=-1;DR.quizDone=false;const wrong=wquiz().opts.findIndex(o=>!o.ok);qpick(wrong);const repaired=S.mistakes.find(m=>m.t==='abandon');repaired.st='wait1';repaired.due=lmAddDate(lmDate(),1);dbSave()");
  const before = r.run('JSON.stringify(S.mistakes)');
  r.run('V.drill();V.drill();qpick(wrong);drMode("fam");drMode("quiz");V.drill()');
  assert.equal(r.run('JSON.stringify(S.mistakes)'), before); assert.equal(r.run('DR.quizDone'), true);
  assert.match(r.run('V.drill()'), /aria-pressed="true" disabled onclick="qpick/);
  const reload = runtime(r.storage); reload.run('dbLoad();normalizeState();lmNormalize();V.drill()');
  assert.equal(reload.run("S.mistakes.find(m=>m.t==='abandon').st"), 'wait1'); assert.equal(reload.run('DR.quizDone'), true);
});
test('mode switches preserve the three-word task and old next buttons are rejected', () => {
  const r = runtime(); r.run("S.plan=true;S.today=[{id:'task-words',kind:'words',t:'今日三词',min:3,limit:3,done:false,book:'CET4'}];LM.wordTask='task-words';LM.wordSeen=[];LM.wordClosed=false;Object.assign(DR,{book:'CET4',i:0,known:0,mode:'quiz',quizPick:-1,quizDone:false})");
  r.run('qpick(wquiz().opts.findIndex(o=>o.ok));const oldKey=drWordKey();drMode("fam");drMode("quiz");drNextWord(true,oldKey);drNextWord(true,oldKey)');
  assert.equal(r.run('LM.wordSeen.length'), 1); assert.equal(r.run('DR.i'), 1); assert.equal(r.run('LM.wordTask'), 'task-words');
  r.run('drMode("time")'); assert.equal(r.run('DR.mode'), 'quiz');
  for (let i = 0; i < 2; i++) r.run('qpick(wquiz().opts.findIndex(o=>o.ok));drNextWord(true,drWordKey())');
  assert.equal(r.run('S.today[0].done'), true); assert.equal(r.run('LM.records.filter(x=>x.kind==="words").length'), 1);
  const before = r.run('JSON.stringify(LM.records)'); r.run('V.drill();V.drill();qpick(0);drNextWord(true,drWordKey())');
  assert.equal(r.run('JSON.stringify(LM.records)'), before); assert.match(r.run('V.drill()'), /本轮词汇已完成/); assert.match(r.run('V.drill()'), /查看本轮结果/);
});
test('free vocabulary browsing does not overwrite a daily task snapshot', () => {
  const r = runtime(); r.run("S.plan=true;S.today=[{id:'task-words',kind:'words',t:'今日三词',min:3,limit:3,done:false,book:'CET4'}];LM.wordTask='task-words';LM.wordSeen=[];LM.wordClosed=false;Object.assign(DR,{book:'CET4',i:0,known:0,mode:'zhan',quizPick:-1,quizDone:false});drNextWord(true,drWordKey());lmStartWords('CET6');drNextWord(false,drWordKey());lmOpenTask('task-words')");
  assert.equal(r.run('LM.wordTask'), 'task-words'); assert.equal(r.run('DR.book'), 'CET4'); assert.equal(r.run('DR.i'), 1); assert.equal(r.run('LM.wordSeen.length'), 1); assert.equal(r.run('S.today[0].done'), false);
});
test('timed vocabulary pauses on navigation and resumes only by explicit action', () => {
  const r = runtime(); r.location.hash = '#/drill'; r.run("DR.mode='time';tchStart()"); r.tick(); assert.equal(r.run('TCH.sec'), 59);
  r.run('nav("#/history")'); r.tick(); assert.equal(r.run('TCH.sec'), 59); assert.equal(r.run('TCH.on'), false);
  r.run('nav("#/drill")'); assert.match(r.run('V.drill()'), /限时挑战已暂停/); assert.equal(r.run('TCH.on'), false);
  r.run('tchResume()'); r.tick(); assert.equal(r.run('TCH.sec'), 58);
  r.run('drMode("quiz")'); r.tick(); assert.equal(r.run('TCH.sec'), 58); assert.equal(r.run('TCH.on'), false);
});
test('timed vocabulary pauses when hidden and on native route changes', () => {
  const r = runtime(); r.location.hash = '#/drill'; r.run("DR.mode='time';tchStart()"); r.document.hidden = true; r.tick(); assert.equal(r.run('TCH.sec'), 60); assert.equal(r.run('TCH.paused'), true);
  r.document.hidden = false; r.run('tchResume();drillLifecycle("today")'); r.tick(); assert.equal(r.run('TCH.sec'), 60); assert.equal(r.run('TCH.on'), false);
});
test('timed stale answer buttons cannot answer the next question', () => {
  const r = runtime(); r.location.hash = '#/drill'; r.run("DR.mode='time';tchStart();const oldPosition=TCH.pos;const answer=tchOpts().o.findIndex(o=>o.ok);tchPick(answer,oldPosition);tchPick(answer,oldPosition)");
  assert.equal(r.run('TCH.pos'), 1); assert.equal(r.run('TCH.right'), 1); assert.equal(r.run('TCH.wrong'), 0);
});
test('daily vocabulary cannot start a timed challenge', () => {
  const r = runtime(); r.run("LM.wordTask='task-words';DR.mode='zhan';drMode('time');tchStart()"); assert.equal(r.run('DR.mode'), 'zhan'); assert.equal(r.run('TCH.on'), false);
});
test('unknown word families do not fabricate inflections or examples', () => {
  const r = runtime();
  for (const word of ['ability', 'accuracy', 'absent']) {
    assert.match(r.run(`famOf('${word}').infl.join(' ')`), /暂无/); assert.equal(r.run(`famOf('${word}').sent.length`), 0);
    assert.doesNotMatch(r.run(`JSON.stringify(famOf('${word}'))`), new RegExp(word + '(?:s|ed|ing)'));
  }
  assert.match(r.run("famOf('accept').infl.join(' ')"), /acceptance/);
});
console.log(`\n${passed} shell regression groups passed. Static model only; browser verification remains separate.`);
