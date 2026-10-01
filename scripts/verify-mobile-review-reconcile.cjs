/* Review-task reconciliation regressions using the actual static prototype scripts.
 * All state is isolated in memory; no browser, user storage, server, or backend is used. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mobile = path.resolve(__dirname, '../docs/06-design/v2-980plus/redesign/mockups/mobile');
const app = fs.readFileSync(path.join(mobile, 'app.js'), 'utf8');
const learning = fs.readFileSync(path.join(mobile, 'learning.js'), 'utf8').replace(/\nbootMock\(\);\s*$/, '\n');

function runtime(storage = new Map()) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', checked: false, textContent: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } });
    return nodes.get(id);
  };
  const context = vm.createContext({
    console, Date, JSON, Math, Object, Array, Number, String, RegExp,
    location: { search: '', hash: '#/home' }, history: { state: null, replaceState() {}, back() {} },
    document: { getElementById: node, querySelectorAll() { return []; }, addEventListener() {}, hidden: false },
    window: { addEventListener() {}, matchMedia() { return { matches: false }; } },
    localStorage: { setItem(k, v) { storage.set(k, v); }, getItem(k) { return storage.get(k) || null; }, removeItem(k) { storage.delete(k); } },
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
  });
  vm.runInContext(app, context, { filename: 'app.js' });
  vm.runInContext(learning, context, { filename: 'learning.js' });
  vm.runInContext(`
    toast = () => {};
    render = () => { syncIdentity(); dbSave(); };
    normalizeState(); lmNormalize(); ACTIVE_IDENTITY = S.user;
    function auditRateBatch(level = 2) {
      srsEnsure(); let guard = 0;
      while (SRS.phase === 'run' && guard++ < 20) { srsShow(); srsRate(level); }
      if (guard >= 20) throw new Error('Review batch did not terminate');
    }
    function auditFixture() {
      LM.records = []; LM.deferred = []; LM.serial = 0; S.today = []; S.plan = true;
      LM.day = lmDate(); LM.plan = { goal:'college', variant:'cet4', minutes:30, days:[0,1,2,3,4,5,6] };
      SRSQ.length = 0;
      ['abandon','accumulate','persistence','clarify'].forEach(w => SRSQ.push({ w, zh:w, show:false, done:false, due:lmDate(), interval:1, source:'isolated fixture' }));
      SRS.phase = 'idle'; srsEnsure(); srsShow(); srsRate(2);
      srsAddWord('ability'); lmApplyPlan({ ...LM.plan, minutes:45 }, 'keep');
      return S.today.find(t => t.kind === 'review').id;
    }
    function auditTask(id) { return S.today.concat(LM.deferred).find(t => t.id === id); }
    function auditAnswer(stem, ok = true) { return { stem, chosen:ok?'本次记得':'还需巩固', correct:stem, why:'isolated evidence', ok }; }
  `, context);
  return { run: code => vm.runInContext(code, context), storage };
}
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { console.error('FAIL ' + name); throw e; } }

test('a task spanning an active batch and a later batch completes', () => {
  const r = runtime();
  r.run('var taskId = auditFixture(); auditRateBatch()');
  assert.equal(r.run('auditTask(taskId).done'), false);
  r.run('lmOpenTask(taskId); auditRateBatch()');
  assert.equal(r.run('lmReviewDue().length'), 0);
  assert.equal(r.run('auditTask(taskId).done'), true);
  assert.equal(r.run('auditTask(taskId).total'), 4);
  assert.equal(r.run('auditTask(taskId).right'), 4);
  assert.equal(r.run('auditTask(taskId).recordIds.length'), 2);
  assert.equal(r.run('LM.records.filter(x => x.kind === "review").length'), 2);
});

test('task result combines target words without adding records or XP', () => {
  const r = runtime();
  r.run('var taskId = auditFixture(); auditRateBatch(); lmOpenTask(taskId); auditRateBatch(); var before = JSON.stringify(LM.records); var xp = lmStats().xp; lmOpenTask(taskId)');
  const html = r.run('V.result()');
  assert.match(html, /累计复习/);
  assert.match(html, /4\/4 累计记得/);
  assert.equal((html.match(/class="answer-detail"/g) || []).length, 4);
  for (const word of ['accumulate', 'persistence', 'clarify', 'ability']) assert.match(html, new RegExp('<b>' + word + '</b>'));
  assert.doesNotMatch(html, /<b>abandon<\/b>/);
  assert.equal(r.run('JSON.stringify(LM.records)'), r.run('before'));
  assert.equal(r.run('lmStats().xp'), r.run('xp'));
  r.run('lmOpenResult(LM.records[0].id)');
  assert.equal(r.run('LM.resultReviewTask'), null);
  assert.doesNotMatch(r.run('V.result()'), /累计复习/);
});

test('deferred tasks combine evidence across days from their original date', () => {
  const r = runtime();
  r.run('var taskId = auditFixture(); var origin = lmDate(); auditRateBatch(); lmAdvanceDay(1)');
  assert.equal(r.run('LM.deferred.some(t => t.id === taskId)'), true);
  r.run('auditRateBatch(); lmResumeDeferred(taskId)');
  assert.equal(r.run('auditTask(taskId).done'), true);
  assert.equal(r.run('auditTask(taskId).recordIds.length'), 2);
  assert.equal(r.run('new Set(lmReviewEvidence(auditTask(taskId)).records.map(x => x.date)).size'), 2);
  assert.equal(r.run('lmReviewEvidence(auditTask(taskId)).complete'), true);
  assert.equal(r.run('LM.resultReviewTask'), r.run('taskId'));
  assert.match(r.run('V.result()'), /4\/4 累计记得/);
});

test('undo of the only evidence for one target reopens the task', () => {
  const r = runtime();
  r.run('var taskId = auditFixture(); auditRateBatch(); lmOpenTask(taskId); auditRateBatch(); var firstId = LM.records[0].id; srsUndo()');
  assert.equal(r.run('auditTask(taskId).done'), false);
  assert.equal(r.run('lmReviewEvidence(auditTask(taskId)).complete'), false);
  assert.equal(r.run('LM.records.length'), 1);
  assert.equal(r.run('LM.records[0].id'), r.run('firstId'));
  r.run('srsRate(2)');
  assert.equal(r.run('auditTask(taskId).done'), true);
  assert.equal(r.run('LM.records.length'), 2);
});

test('undo preserves completion when another finished review still covers the target', () => {
  const r = runtime();
  r.run(`var taskId = auditFixture(); auditRateBatch(); lmOpenTask(taskId);
    var extra = lmRecord({ key:'independent-covered-round', kind:'review', title:'独立已完成复习', right:1, total:1, answers:[auditAnswer('ability')] });
    auditRateBatch(); var lastId = LM.records.at(-1).id; srsUndo()`);
  assert.equal(r.run('auditTask(taskId).done'), true);
  assert.equal(r.run('auditTask(taskId).total'), 4);
  assert.equal(r.run('lmReviewEvidence(auditTask(taskId)).complete'), true);
  assert.equal(r.run('LM.records.some(x => x.id === lastId)'), false);
  assert.equal(r.run('auditTask(taskId).recordIds.includes(extra.id)'), true);
});

test('later reviews of the same word keep completed tasks covered without double-counting targets', () => {
  const r = runtime();
  r.run(`var taskId = auditFixture(); auditRateBatch(); lmOpenTask(taskId); auditRateBatch();
    lmRecord({ key:'later-same-word', kind:'review', title:'同词后续复习', right:0, total:1, answers:[auditAnswer('ability', false)] });
    lmReconcileReviews()`);
  assert.equal(r.run('auditTask(taskId).done'), true);
  assert.equal(r.run('auditTask(taskId).total'), 4);
  assert.equal(r.run('lmReviewEvidence(auditTask(taskId)).entries.length'), 4);
  assert.equal(r.run('LM.records.length'), 3);
});

test('a later review of the first target supplies the latest result date and record', () => {
  const r = runtime();
  r.run(`var taskId = auditFixture(); auditRateBatch(); lmOpenTask(taskId); auditRateBatch();
    LM.offset += 1;
    var latest = lmRecord({ key:'later-first-target', kind:'review', title:'首个目标词后续复习', right:1, total:1, answers:[auditAnswer('accumulate')] });
    lmReconcileReviews(); lmOpenReviewTask(auditTask(taskId))`);
  assert.equal(r.run('auditTask(taskId).recordId'), r.run('latest.id'));
  assert.equal(r.run('lmReviewEvidence(auditTask(taskId)).records.at(-1).id'), r.run('latest.id'));
  assert.equal(r.run('LM.resultId'), r.run('latest.id'));
  assert.match(r.run('V.result()'), new RegExp(r.run('latest.date')));
  assert.equal(r.run('auditTask(taskId).total'), 4);
});

test('new review batches discard old undo and only undo their current legal score', () => {
  const r = runtime();
  r.run('var taskId = auditFixture(); auditRateBatch(); lmOpenTask(taskId); auditRateBatch()');
  assert.equal(r.run('SRS.undo.length > 0'), true);
  r.run('var count = LM.records.length; lmAdvanceDay(7); srsEnsure()');
  assert.equal(r.run('SRS.undo.length'), 0);
  r.run('var currentWord = SRSQ[srsCur()].w; var prior = JSON.stringify(SRSQ[srsCur()]); srsShow(); srsRate(2)');
  assert.equal(r.run('SRS.undo.length'), 1);
  assert.equal(r.run('SRS.undo[0].word.w'), r.run('currentWord'));
  r.run('srsUndo()');
  assert.equal(r.run('SRS.undo.length'), 0);
  assert.equal(r.run('SRSQ.find(q => q.w === currentWord).due'), r.run('JSON.parse(prior).due'));
  assert.equal(r.run('SRSQ.find(q => q.w === currentWord).interval'), r.run('JSON.parse(prior).interval'));
  assert.equal(r.run('LM.records.length'), r.run('count'));
});

test('older and imported records cannot finish a new task', () => {
  const r = runtime();
  r.run(`S.today = [{ id:'fresh-review', kind:'review', t:'新复习任务', words:['ability'], date:lmDate(), done:false }];
    LM.records = [];
    lmRecord({ key:'old-review', kind:'review', title:'旧轮', date:lmAddDate(lmDate(),-1), answers:[auditAnswer('ability')], right:1, total:1 });
    lmRecord({ key:'import-review', kind:'review', imported:true, title:'导入汇总', answers:[auditAnswer('ability')], right:1, total:1 });
    lmReconcileReviews()`);
  assert.equal(r.run('auditTask("fresh-review").done'), false);
  r.run('lmRecord({key:"current-review",kind:"review",title:"新轮",answers:[auditAnswer("ability")],right:1,total:1}); lmReconcileReviews()');
  assert.equal(r.run('auditTask("fresh-review").done'), true);
});

test('refresh retains evidence and the virtual task result without creating a round', () => {
  const r = runtime();
  r.run('var taskId = auditFixture(); auditRateBatch(); lmOpenTask(taskId); auditRateBatch(); lmOpenTask(taskId); dbSave()');
  const taskId = r.run('taskId'), count = r.run('LM.records.length'), xp = r.run('lmStats().xp');
  const reload = runtime(r.storage);
  reload.run('dbLoad(); normalizeState(); lmNormalize(); lmReconcileReviews()');
  assert.equal(reload.run(`auditTask(${JSON.stringify(taskId)}).done`), true);
  assert.equal(reload.run('LM.records.length'), count);
  assert.equal(reload.run('lmStats().xp'), xp);
  assert.equal(reload.run('LM.resultReviewTask'), taskId);
  assert.match(reload.run('V.result()'), /4\/4 累计记得/);
  assert.equal(reload.run('LM.records.length'), count);
});

console.log(`\n${passed} review reconciliation groups passed. Isolated model evidence; browser verification remains separate.`);
