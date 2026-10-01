/* Regression against the static mobile prototype's actual model functions.
 * Browser rendering, device input, network and backend acceptance are separate.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const dir = path.resolve(__dirname, '../docs/06-design/v2-980plus/redesign/mockups/mobile');
function createModel(storage = new Map()) {
  const pendingTimers = [];
  const elements = new Map();
  const context = vm.createContext({
    location: { search: '', hash: '' }, Date, console,
    setTimeout: (callback, delay) => { const timer = { callback, delay }; pendingTimers.push(timer); return timer; },
    clearTimeout: timer => { if (timer) timer.cancelled = true; },
    setInterval, clearInterval,
    performance: { now: () => 0 },
    window: { addEventListener() {} }, document: { getElementById: id => elements.get(id) || null },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
  });
  vm.runInContext(fs.readFileSync(path.join(dir, 'app.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(dir, 'learning.js'), 'utf8').replace(/bootMock\(\);\s*$/, ''), context);
  // Rendering/navigation persist through the production serializer. No model
  // functions or persistence functions are replaced by alternate implementations.
  vm.runInContext('render=()=>{dbSave();}; toast=()=>{}; nav=(hash)=>{location.hash=hash;dbSave();}; LASTR="";', context);
  return {
    storage,
    run: code => JSON.parse(vm.runInContext('JSON.stringify((()=>{' + code + '})())', context)),
    exec: code => vm.runInContext(code, context),
    setField(id, value = '') { elements.set(id, { value, textContent: '' }); },
    flushTimers() { for (const timer of pendingTimers.splice(0)) if (!timer.cancelled) timer.callback(); },
    reload() {
      this.exec('dbSave();');
      const next = createModel(storage);
      assert.equal(next.run('return dbLoad();'), true, 'production dbLoad must accept saved state');
      next.exec('normalizeState(); lmNormalize();');
      return next;
    },
  };
}
const setupPractice = `
  S.plan=true; LM.day=lmDate(); LM.records=[];
  S.today=[
    {id:'a',key:'core',group:'foundation',kind:'grammar',t:'grammar',min:5,done:false,total:2},
    {id:'b',key:'readquiz',group:'readbasic',kind:'reading',t:'reading',min:8,done:false,total:2},
  ];
`;
function practiceState(m) {
  return m.run('return {id:PR.taskId,pos:PR.pos,sel:PR.sel,phase:PR.phase,attempt:PR.attempt,answers:PR.answers};');
}
let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.message); }
}

check('two groups resume their own answer, position, choice and attempt after switching', () => {
  const m = createModel(); m.exec(setupPractice);
  m.exec("startGroup('a'); prRecord(0,0); prNext(); prPick(1);");
  const a = practiceState(m);
  m.exec("lmOpenTask('b'); prRecord(0,0); prNext(); prPick(2);");
  const b = practiceState(m);
  m.exec("lmOpenTask('a');"); assert.deepEqual(practiceState(m), a);
  m.exec("lmOpenTask('b');"); assert.deepEqual(practiceState(m), b);
});

check('both group snapshots survive production dbSave/dbLoad and normalization', () => {
  let m = createModel(); m.exec(setupPractice);
  m.exec("startGroup('a'); prRecord(0,0); prNext(); prPick(1);");
  const a = practiceState(m);
  m.exec("lmOpenTask('b'); prRecord(0,1); prNext(); prPick(2);");
  const b = practiceState(m);
  m = m.reload(); assert.deepEqual(practiceState(m), b);
  m.exec("lmOpenTask('a');"); assert.deepEqual(practiceState(m), a);
  m = m.reload(); assert.deepEqual(practiceState(m), a);
  m.exec("lmOpenTask('b');"); assert.deepEqual(practiceState(m), b);
});

check('resumed group cannot record the same answered question twice', () => {
  const m = createModel(); m.exec(setupPractice);
  m.exec("startGroup('a'); prRecord(0,1);"); const a = practiceState(m);
  m.exec("lmOpenTask('b'); lmOpenTask('a'); prRecord(0,0);");
  assert.deepEqual(practiceState(m), a);
  assert.equal(m.run('return S.mistakes.filter(x=>x.t===GROUPS.foundation.items[0].s).length;'), 1);
});

check('two tasks sharing a group retain independent rounds and selections', () => {
  const m = createModel(); m.exec(setupPractice + "S.today[1].group='foundation';");
  m.exec("startGroup('a'); prRecord(0,0); prNext(); prPick(2);"); const a = practiceState(m);
  m.exec("lmOpenTask('b'); prRecord(0,1); prNext(); prPick(1);"); const b = practiceState(m);
  m.exec("lmOpenTask('a');"); assert.deepEqual(practiceState(m), a);
  assert.equal(m.run('return prGroup().items[0]._sel;'), 0);
  m.exec("lmOpenTask('b');"); assert.deepEqual(practiceState(m), b);
  assert.equal(m.run('return prGroup().items[0]._sel;'), 1);
});

check('day rollover defers both paused groups without losing either progress', () => {
  let m = createModel(); m.exec(setupPractice);
  m.exec("startGroup('a'); prRecord(0,0); prNext(); prPick(2);"); const a = practiceState(m);
  m.exec("lmOpenTask('b'); prRecord(0,1); prNext(); prPick(2);"); const b = practiceState(m);
  m.exec('LM.offset++; lmEnsureDay();');
  m = m.reload();
  m.exec("lmResumeDeferred('a');"); assert.deepEqual(practiceState(m), a);
  m.exec("lmResumeDeferred('b');"); assert.deepEqual(practiceState(m), b);
});

check('resuming a deferred group preserves the currently active newer group before switching', () => {
  let m=createModel(); m.exec(setupPractice);
  m.exec("startGroup('a'); prRecord(0,0); prNext(); prPick(2);"); const a=practiceState(m);
  m.exec("lmApplyPlan({...LM.plan,minutes:15},'defer'); lmOpenTask(S.today[0].id); prRecord(0,prGroup().items[0].a); prNext(); prPick(1);");
  const b=practiceState(m);
  m.exec("lmResumeDeferred('a');"); assert.deepEqual(practiceState(m),a);
  m=m.reload(); m.exec('lmOpenTask(' + JSON.stringify(b.id) + ');'); assert.deepEqual(practiceState(m),b);
});

check('switching during submission keeps choice and ignores stale callback before retry', () => {
  const m = createModel(); m.exec(setupPractice);
  m.exec("startGroup('a'); prPick(0); prSubmit(); lmOpenTask('b'); lmOpenTask('a');");
  assert.deepEqual(m.run('return [PR.phase,PR.sel,PR.answers.length];'), ['answer',0,0]);
  m.flushTimers();
  assert.deepEqual(m.run('return [PR.phase,PR.sel,PR.answers.length];'), ['answer',0,0]);
  m.exec('prSubmit();'); m.flushTimers();
  assert.deepEqual(m.run('return [PR.phase,PR.answers.length,PR.answers[0].ok];'), ['saved',1,true]);
});

check('unknown submission survives switching and refresh and resolves exactly once', () => {
  let m = createModel(); m.exec(setupPractice);
  m.exec("startGroup('a'); prPick(0); LAB.unknownNext=true; prSubmit();"); m.flushTimers();
  const attempt = m.run('return PR.attempt;');
  m.exec("lmOpenTask('b');"); m = m.reload(); m.exec("lmOpenTask('a');");
  assert.deepEqual(m.run('return [PR.phase,PR.sel,PR.attempt];'), ['unknown',0,attempt]);
  m.exec('prResolve(); prResolve();');
  assert.deepEqual(m.run('return [PR.phase,PR.answers.length,PR.answers[0].ok,LM.records.length];'), ['saved',1,true,0]);
});

check('retry of a completed task resumes after another group without changing original result', () => {
  const m = createModel(); m.exec(setupPractice);
  m.exec("startGroup('a'); prRecord(0,0); prNext(); prRecord(1,2); prFinish();");
  const original = m.run("return {task:S.today.find(t=>t.id==='a'),record:LM.records[0]};");
  m.exec("lmRetryTask('a'); prRecord(0,1); prNext(); prPick(2);");
  const retry = practiceState(m);
  m.exec("lmOpenTask('b');");
  m.exec('enterTask(' + JSON.stringify(retry.id) + ');');
  assert.deepEqual(practiceState(m), retry);
  assert.deepEqual(m.run("return {task:S.today.find(t=>t.id==='a'),record:LM.records[0]};"), original);
});

check('retry of archived record preserves older free-practice resume after opening another old record', () => {
  let m = createModel(); m.exec(setupPractice);
  m.exec(`
    S.today=[];
    lmRecord({kind:'practice',group:'foundation',taskId:'old-a',title:'old-a',right:2,total:2});
    lmRecord({kind:'practice',group:'readbasic',taskId:'old-b',title:'old-b',right:2,total:2});
    lmRetryRecord(LM.records[0].id); prRecord(0,0); prNext(); prPick(2);
  `);
  const a = practiceState(m);
  m.exec('lmRetryRecord(LM.records[1].id); prRecord(0,1); prNext(); prPick(2);');
  const b = practiceState(m);
  m = m.reload(); assert.deepEqual(practiceState(m), b);
  m.exec('enterTask(' + JSON.stringify(a.id) + ');'); assert.deepEqual(practiceState(m), a);
  m.exec('enterTask(' + JSON.stringify(b.id) + ');'); assert.deepEqual(practiceState(m), b);
  assert.equal(m.run('return S.today.length;'), 0);
});

check('review undo preserves later practice, chapter, lookup queue and mistake work', () => {
  const m = createModel(); m.exec(setupPractice);
  m.exec(`
    SRSQ.splice(0,SRSQ.length,{w:'abandon',zh:'抛弃',due:lmDate(),source:'test',interval:0,done:false});
    SRS.phase='idle'; srsEnsure(); srsShow(); srsRate(2);
    startGroup('a'); prRecord(0,1); prNext(); prRecord(1,2); prFinish();
    BK.cur='b1'; BK.ch=0; lmChapterComplete();
    srsAddWord('clarify');
    addMistake('audit-later-mistake','later explanation','sentence','audit',null);
  `);
  const retained = m.run(`return {
    records:LM.records.filter(r=>r.kind!=='review'),
    task:S.today.find(t=>t.id==='a'),
    chapter:LM.chapters['b1:0'],
    queued:SRSQ.find(q=>q.w==='clarify'),
    mistakes:S.mistakes,
  };`);
  m.exec('srsUndo();');
  assert.deepEqual(m.run(`return {
    records:LM.records.filter(r=>r.kind!=='review'),
    task:S.today.find(t=>t.id==='a'),
    chapter:LM.chapters['b1:0'],
    queued:SRSQ.find(q=>q.w==='clarify'),
    mistakes:S.mistakes,
  };`), retained);
  assert.deepEqual(m.run('return [SRS.phase,SRSQ.find(q=>q.w===\'abandon\').due===lmDate(),LM.records.filter(r=>r.kind===\'review\').length];'), ['run', true, 0]);
});

check('review undo survives refresh and only reopens its own completed review task', () => {
  let m = createModel(); m.exec(setupPractice);
  m.exec(`
    S.today.push({id:'review-task',kind:'review',t:'review',min:5,done:false});
    LM.reviewTask='review-task';
    SRSQ.splice(0,SRSQ.length,{w:'abandon',zh:'抛弃',due:lmDate(),source:'test',interval:0,done:false});
    SRS.phase='idle'; srsEnsure(); srsShow(); srsRate(2);
    startGroup('b'); prRecord(0,1); prNext(); prRecord(1,2); prFinish();
  `);
  const record = m.run("return S.today.find(t=>t.id==='b').recordId;");
  m = m.reload(); m.exec('srsUndo();');
  assert.deepEqual(m.run("return [S.today.find(t=>t.id==='review-task').done, S.today.find(t=>t.id==='b').done, S.today.find(t=>t.id==='b').recordId, LM.records.some(r=>r.id===S.today.find(t=>t.id==='b').recordId)];"), [false, true, record, true]);
});

check('review undo preserves a later repair of the same word mistake', () => {
  const m = createModel(); m.exec('LM.day=lmDate(); LM.records=[]; S.mistakes=[];');
  m.exec(`
    SRSQ.splice(0,SRSQ.length,{w:'abandon',zh:'抛弃',due:lmDate(),source:'test',interval:0,done:false});
    SRS.phase='idle'; srsEnsure(); srsShow(); srsRate(0); srsShow(); srsRate(0);
    const mistake=S.mistakes.find(x=>x.t==='abandon');
    lmMistakeOpen(mistake.id); LM.mistakePick=lmVariant(mistake).a; lmMistakeCheck();
  `);
  const retained = m.run("return [S.mistakes.find(x=>x.t==='abandon'),LM.records.filter(r=>r.kind==='repair')];");
  m.exec('srsUndo();');
  assert.deepEqual(m.run("return [S.mistakes.find(x=>x.t==='abandon'),LM.records.filter(r=>r.kind==='repair')];"), retained);
  assert.deepEqual(m.run("return [SRS.phase,LM.records.filter(r=>r.kind==='review').length];"), ['run',0]);
});

check('objective listening answers contribute to same-day question recap', () => {
  const m = createModel(); m.exec('LM.day=lmDate(); LM.records=[];');
  m.exec('lsel(0); LSM.quizPick=0; LSM.quizPick2=1; lmListeningComplete();');
  assert.deepEqual(m.run('const s=lmStats(); return [s.count,s.right,s.total,LM.records[0].kind,LM.records[0].answers.map(a=>a.ok)];'), [1, 1, 2, 'listening', [true, false]]);
});

check('objective listening and practice totals exclude self-rated words and review', () => {
  const m = createModel(); m.exec('LM.day=lmDate(); LM.records=[];');
  m.exec(`
    lmRecord({kind:'practice',right:1,total:2});
    lmRecord({kind:'repair',right:1,total:1});
    lmRecord({kind:'words',right:3,total:3,selfKnown:3});
    lmRecord({kind:'review',right:4,total:4});
    lsel(0); LSM.quizPick=0; LSM.quizPick2=0; lmListeningComplete();
  `);
  assert.deepEqual(m.run('const s=lmStats(); return [s.count,s.right,s.total];'), [5, 4, 5]);
});

check('missing listening answers cannot save a result or change recap totals', () => {
  const m = createModel(); m.exec('LM.day=lmDate(); LM.records=[]; LM.resultId=null;');
  for (const picks of [[-1,-1], [0,-1], [-1,0]]) {
    m.exec('lsel(0); LSM.quizPick=' + picks[0] + '; LSM.quizPick2=' + picks[1] + '; lmListeningComplete();');
    assert.deepEqual(m.run('return [LM.records.length,LM.resultId,lmStats().total];'), [0,null,0]);
  }
});

check('a saved listening round is idempotent and only an explicit new round adds a record', () => {
  const m=createModel(); m.exec('LM.day=lmDate(); LM.records=[];');
  m.exec('lsel(0); LSM.quizPick=0; LSM.quizPick2=0; lmListeningComplete(); lmListeningComplete();');
  assert.deepEqual(m.run('return [LM.records.length,lmStats().right,lmStats().total];'),[1,2,2]);
  m.exec('lmListeningNew(); LSM.quizPick=1; LSM.quizPick2=0; lmListeningComplete();');
  assert.deepEqual(m.run('return [LM.records.length,lmStats().right,lmStats().total];'),[2,3,4]);
});

check('listening material, partial choices and preferences survive production refresh', () => {
  let m=createModel(); m.exec('LM.day=lmDate(); LM.records=[];');
  m.exec('lsel(1); lrate(0.75); lsub(); lquizPick(1);');
  const original=m.run('return [LSM.cur,LSM.rate,LSM.showSub,LSM.quizPick,LSM.quizPick2];');
  m=m.reload();
  assert.deepEqual(m.run('return [LSM.cur,LSM.rate,LSM.showSub,LSM.quizPick,LSM.quizPick2];'),original);
  assert.equal(m.run('return LM.records.length;'),0);
});

check('free chapter completion reconciles matching today and deferred tasks exactly once', () => {
  const m = createModel(); m.exec('LM.day=lmDate(); LM.records=[]; LM.chapters={}; LM.readTask=null;');
  m.exec(`
    S.today=[{id:'chapter-a',kind:'chapter',book:'b1',ch:0,done:false},{id:'chapter-other',kind:'chapter',book:'b1',ch:1,done:false}];
    LM.deferred=[{id:'chapter-old',kind:'chapter',book:'b1',ch:0,done:false}];
    BK.cur='b1'; BK.ch=0; lmChapterComplete(); lmChapterComplete();
  `);
  assert.deepEqual(m.run(`return [LM.records.length,S.today[0].done,LM.deferred[0].done,S.today[1].done,S.today[0].recordId===LM.chapters['b1:0'].recordId,LM.deferred[0].recordId===S.today[0].recordId];`), [1,true,true,false,true,true]);
});

check('a scheduled review task recognizes a completed free round after queue exhaustion', () => {
  const m = createModel(); m.exec('LM.day=lmDate(); LM.records=[]; LM.reviewTask=null;');
  m.exec(`
    S.today=[{id:'scheduled-review',kind:'review',key:'review',min:5,t:'review',done:false}];
    SRSQ.splice(0,SRSQ.length,{w:'abandon',zh:'抛弃',due:lmDate(),source:'test',interval:0,done:false});
    SRS.phase='idle'; srsEnsure(); srsShow(); srsRate(2);
    lmOpenTask('scheduled-review');
  `);
  assert.deepEqual(m.run(`return [lmReviewDue().length,S.today[0].done,LM.records.length,S.today[0].recordId===LM.records[0].id];`), [0,true,1,true]);
});

const setupWriting = `
  S.plan=true; LM.day=lmDate(); LM.records=[];
  S.today=[{id:'w1',key:'write',kind:'writing',t:'write-one',min:10,done:false},{id:'w2',key:'write',kind:'writing',t:'write-two',min:10,done:false}];
`;
function writeDraft(m, taskId, text) {
  m.exec('lmOpenTask(' + JSON.stringify(taskId) + ');');
  m.setField('writing-draft', text); m.setField('writing-count');
  m.exec('lmWritingInput();');
}
function writingState(m) { return m.run('return LM.writing;'); }

check('two writing tasks retain independent drafts and confirmation after switching and refresh', () => {
  let m = createModel(); m.exec(setupWriting);
  writeDraft(m,'w1','Dear Sam, first draft for Saturday. Best wishes, Alex'); m.exec('lmWritingConfirm();');
  const a=writingState(m);
  writeDraft(m,'w2','Dear Sam, second draft for Sunday. Best wishes, Alex'); const b=writingState(m);
  m=m.reload(); assert.deepEqual(writingState(m),b);
  m.exec("lmOpenTask('w1');"); assert.deepEqual(writingState(m),a);
  m.exec("lmOpenTask('w2');"); assert.deepEqual(writingState(m),b);
});

check('two deferred writing drafts survive day rollover and independent resume', () => {
  let m=createModel(); m.exec(setupWriting);
  writeDraft(m,'w1','First writing task, kept across the day.'); const a=writingState(m);
  writeDraft(m,'w2','Second writing task, kept independently.'); const b=writingState(m);
  m.exec('LM.offset++; lmEnsureDay();'); m=m.reload();
  m.exec("lmResumeDeferred('w1');"); assert.deepEqual(writingState(m),a);
  m.exec("lmResumeDeferred('w2');"); assert.deepEqual(writingState(m),b);
});

check('resuming deferred writing preserves the newer active draft as a separate task', () => {
  let m=createModel(); m.exec(setupWriting);
  writeDraft(m,'w1','First draft to defer.'); const a=writingState(m);
  m.exec("lmApplyPlan({...LM.plan,minutes:30},'defer');");
  const newer=m.run("return S.today.find(t=>t.kind==='writing').id;");
  writeDraft(m,newer,'Newer draft must remain available.'); const b=writingState(m);
  m.exec("lmResumeDeferred('w1');"); assert.deepEqual(writingState(m),a);
  m=m.reload(); m.exec('lmOpenTask(' + JSON.stringify(newer) + ');'); assert.deepEqual(writingState(m),b);
});

check('switching away from a submitting writing draft cannot complete the wrong task', () => {
  const m=createModel(); m.exec(setupWriting);
  writeDraft(m,'w1',m.run('return LWRITE_REFERENCE;'));
  m.exec("lmWritingConfirm(); lmWritingSubmit(); lmOpenTask('w2');"); m.flushTimers();
  assert.deepEqual(m.run('return [LM.records.length,S.today[0].done,S.today[1].done,LM.writing.taskId];'),[0,false,false,'w2']);
  m.exec("lmOpenTask('w1');");
  assert.deepEqual(m.run('return [LM.writing.phase,LM.writing.text===LWRITE_REFERENCE,LM.writing.pending];'),['draft',true,null]);
  m.exec('lmWritingConfirm(); lmWritingSubmit();'); m.flushTimers();
  assert.deepEqual(m.run('return [LM.records.length,S.today[0].done,S.today[1].done];'),[1,true,false]);
});

check('two vocabulary tasks keep independent partial rounds after switching and refresh', () => {
  let m=createModel(); m.exec(`
    LM.day=lmDate(); LM.records=[]; LM.wordTask=null; LM.wordSeen=[]; LM.wordProgress={};
    S.today=[{id:'words-one',key:'words',kind:'words',t:'words-one',min:5,done:false},{id:'words-two',key:'words',kind:'words',t:'words-two',min:5,done:false}];
    lmOpenTask('words-one'); dzhan(true);
  `);
  const a=m.run('return [LM.wordTask,LM.wordSeen,DR.i,DR.known,DR.book];');
  m.exec("lmOpenTask('words-two'); dzhan(false); dzhan(true);");
  const b=m.run('return [LM.wordTask,LM.wordSeen,DR.i,DR.known,DR.book];');
  m=m.reload(); assert.deepEqual(m.run('return [LM.wordTask,LM.wordSeen,DR.i,DR.known,DR.book];'),b);
  m.exec("lmOpenTask('words-one');"); assert.deepEqual(m.run('return [LM.wordTask,LM.wordSeen,DR.i,DR.known,DR.book];'),a);
  m.exec("lmOpenTask('words-two');"); assert.deepEqual(m.run('return [LM.wordTask,LM.wordSeen,DR.i,DR.known,DR.book];'),b);
});

check('completed vocabulary task cannot overwrite a paused free round for the same wordbook', () => {
  const m=createModel(); m.exec(`
    LM.day=lmDate(); LM.records=[]; LM.wordTask=null; LM.wordSeen=[]; LM.wordProgress={};
    S.today=[{id:'words-task',key:'words',kind:'words',t:'words-task',min:5,done:false}];
    wset('CET4'); dzhan(true);
  `);
  const free=m.run('return [LM.wordSeen,DR.i,DR.known,DR.book];');
  m.exec("lmOpenTask('words-task'); dzhan(true); dzhan(true); dzhan(true); wset('CET4');");
  assert.deepEqual(m.run('return [LM.wordSeen,DR.i,DR.known,DR.book];'),free);
  assert.deepEqual(m.run('return [S.today[0].done,LM.records.length,LM.records[0].answers.length];'),[true,1,3]);
});

check('resuming deferred words preserves the currently active newer word task', () => {
  let m=createModel(); m.exec(`
    S.plan=true; LM.day=lmDate(); LM.records=[]; LM.wordTask=null; LM.wordSeen=[]; LM.wordProgress={};
    S.today=[{id:'old-words',key:'words',kind:'words',t:'old-words',min:5,done:false}];
    lmOpenTask('old-words'); dzhan(true);
  `);
  const a=m.run('return [LM.wordTask,LM.wordSeen,DR.i,DR.known,DR.book];');
  m.exec("lmApplyPlan({...LM.plan,minutes:30},'defer'); lmOpenTask(S.today.find(t=>t.kind==='words').id); dzhan(false); dzhan(true);");
  const b=m.run('return [LM.wordTask,LM.wordSeen,DR.i,DR.known,DR.book];');
  m.exec("lmResumeDeferred('old-words');"); assert.deepEqual(m.run('return [LM.wordTask,LM.wordSeen,DR.i,DR.known,DR.book];'),a);
  m=m.reload(); m.exec('lmOpenTask(' + JSON.stringify(b[0]) + ');');
  assert.deepEqual(m.run('return [LM.wordTask,LM.wordSeen,DR.i,DR.known,DR.book];'),b);
});

check('confirming a first plan from either entry opens the start-method choice', () => {
  for (const onboard of [false,true]) {
    const m=createModel(); m.exec('S.plan=false; S.today=[]; LM.day=lmDate();');
    m.exec('LM.planDraft={...LM.plan,goal:"foundation",minutes:5}; LM.planPreview={onboard:' + onboard + ',policy:"keep"}; lmConfirmPlan();');
    assert.deepEqual(m.run('return [location.hash,S.plan,S.today.length,LM.plan.goal,LM.planDraft,LM.planPreview];'),['#/firstlearn',false,0,'foundation',null,null]);
  }
});

check('vocabulary-detail free drill cannot complete or replace an active daily vocabulary task', () => {
  const m=createModel(); m.exec(`
    LM.day=lmDate(); LM.records=[]; LM.wordTask=null; LM.wordSeen=[]; LM.wordProgress={};
    S.today=[{id:'daily-words',key:'words',kind:'words',t:'daily-words',min:5,done:false}];
    lmOpenTask('daily-words'); dzhan(true);
  `);
  const daily=m.run('return [LM.wordTask,LM.wordSeen,DR.i,DR.known,DR.book];');
  m.exec("VC.w='ability'; vcDrill(); dzhan(true); dzhan(true); dzhan(true);");
  assert.deepEqual(m.run('return [LM.wordTask,S.today[0].done,LM.records.length];'),[null,false,0]);
  m.exec("lmOpenTask('daily-words');"); assert.deepEqual(m.run('return [LM.wordTask,LM.wordSeen,DR.i,DR.known,DR.book];'),daily);
});

check('a completed free vocabulary round can start a fresh round from the wordbook', () => {
  const m=createModel(); m.exec('LM.day=lmDate(); LM.records=[]; LM.wordProgress={}; LM.wordTask=null; LM.wordSeen=[];');
  m.exec("wset('CET4'); for(let i=0;i<WB4.length;i++)dzhan(true);");
  assert.deepEqual(m.run('return [LM.records.length,LM.records[0].answers.length,LM.wordClosed];'),[1,20,true]);
  m.exec("wset('CET4');");
  assert.deepEqual(m.run('return [DR.i,DR.known,LM.wordSeen.length,LM.wordClosed];'),[0,0,0,false]);
  m.exec('dzhan(true);'); assert.deepEqual(m.run('return [DR.i,LM.wordSeen.length,LM.records.length];'),[1,1,1]);
});

check('speaking saves once per mode and an explicit new round preserves earlier results', () => {
  let m=createModel(); m.exec('LM.day=lmDate(); LM.records=[];');
  m.exec('LM.speakingMode="read"; lmSpeakingComplete(); lmSpeakingComplete();');
  assert.equal(m.run('return LM.records.length;'),1);
  assert.equal(m.run('return V.speaking().includes("lmSpeakingNew()");'),true);
  m.exec('LM.speakingMode="role"; lmSpeakingComplete();');
  const firstRead=m.run('return LM.speakingResults.read;');
  m=m.reload(); m.exec('LM.speakingMode="read"; lmSpeakingComplete();');
  assert.deepEqual(m.run('return [LM.records.length,LM.speakingResults.read];'),[2,firstRead]);
  m.exec('lmSpeakingNew(); lmSpeakingComplete();');
  assert.deepEqual(m.run('return [LM.records.length,LM.speakingResults.read!==LM.records[0].id,LM.records.some(r=>r.id===' + JSON.stringify(firstRead) + ')];'),[3,true,true]);
});

check('mistake undo restores original validation dates and removes only that operation record', () => {
  const m=createModel(); m.exec('LM.day=lmDate(); LM.records=[]; lmNormalize();');
  m.exec(`
    const mistake=S.mistakes[0]; Object.assign(mistake,{st:'wait1',repaired:lmAddDate(lmDate(),-1),due:lmDate()});
    lmMistakeOpen(mistake.id);
  `);
  const original=m.run('return S.mistakes[0];');
  m.exec('LM.mistakePick=lmVariant(S.mistakes[0]).a; lmMistakeCheck();');
  assert.equal(m.run('return S.mistakes[0].st;'),'wait7');
  m.exec('lmRecord({kind:"practice",title:"later unrelated",right:1,total:1}); lmMistakeUndo();');
  assert.deepEqual(m.run('return S.mistakes[0];'),original);
  assert.deepEqual(m.run('return LM.records.map(r=>r.kind);'),['practice']);
});

check('mistake undo cannot overwrite a newer error on the same question', () => {
  const m=createModel(); m.exec('LM.day=lmDate(); LM.records=[]; lmNormalize();');
  m.exec('lmMistakeOpen(S.mistakes[0].id); LM.mistakePick=lmVariant(S.mistakes[0]).a; lmMistakeCheck();');
  m.exec('addMistake(S.mistakes[0].t,"new incorrect answer","sentence","new round",S.mistakes[0].skill);');
  const latest=m.run('return {mistake:S.mistakes[0],records:LM.records};');
  m.exec('lmMistakeUndo();');
  assert.deepEqual(m.run('return {mistake:S.mistakes[0],records:LM.records};'),latest);
});

const setupDailyWords = `
  S.plan=true; LM.day=lmDate(); LM.records=[];
  LM.wordTask=null; LM.wordSeen=[]; LM.wordProgress={}; LM.wordClosed=false;
  S.today=[{id:'daily-words',key:'words',kind:'words',t:'daily words',book:'CET4',limit:3,min:5,done:false}];
  lmOpenTask('daily-words');
`;

check('daily vocabulary options preserve actual meanings and complete practice without claiming mastery', () => {
  const m=createModel(); m.exec(setupDailyWords + 'drMode("quiz");');
  const chosen=[];
  for (let i=0;i<3;i++) {
    chosen.push(m.run('const q=wquiz(); const k=q.opts.findIndex(o=>!o.ok); qpick(k); return q.opts[k].zh;'));
    assert.equal(m.run('return S.today[0].done;'),false, 'choosing alone cannot advance or complete a task');
    m.exec('drNextWord(false,drWordKey());');
    assert.equal(m.run('return S.today[0].done;'),i===2);
  }
  assert.deepEqual(m.run('const r=LM.records[0]; return [r.answers.map(a=>a.chosen),r.answers.map(a=>a.mode),r.answers.map(a=>a.ok),r.quizRight,r.quizTotal,r.selfKnown,r.selfTotal,lmOutcome(r),r.answers.map(a=>lmAnswerOutcome(r,a))];'),
    [chosen,['quiz','quiz','quiz'],[false,false,false],0,3,0,0,'0/3 词义答对',['需再练','需再练','需再练']]);
  assert.deepEqual(m.run('return [LM.records.length,S.today[0].recordId===LM.records[0].id,lmStats().right,lmStats().total,V.today().includes("完成任务与掌握知识分别记录")];'),[1,true,0,0,true]);
  m.exec('drNextWord(true,drWordKey()); dzhan(true);');
  assert.equal(m.run('return LM.records.length;'),1, 'a completed round cannot submit again');
});

check('switching vocabulary mode preserves a wrong option and separates mixed self ratings from answers', () => {
  const m=createModel(); m.exec(setupDailyWords + 'drMode("quiz");');
  const wrong=m.run('const q=wquiz(); const k=q.opts.findIndex(o=>!o.ok); qpick(k); return q.opts[k].zh;');
  m.exec('drMode("fam"); drNextWord(true,drWordKey()); drMode("zhan"); drNextWord(true,drWordKey()); drMode("quiz");');
  const correct=m.run('const q=wquiz(); const k=q.opts.findIndex(o=>o.ok); qpick(k); return q.opts[k].zh;');
  m.exec('drNextWord(false,drWordKey());');
  assert.deepEqual(m.run('const r=LM.records[0]; return [r.answers.map(a=>a.chosen),r.answers.map(a=>a.ok),r.answers.map(a=>a.mode),r.quizRight,r.quizTotal,r.selfKnown,r.selfTotal,lmOutcome(r),r.answers.map(a=>lmAnswerOutcome(r,a)),S.today[0].done];'),
    [[wrong,'自评认识',correct],[false,true,true],['quiz','self','quiz'],1,2,1,1,'1/2 词义答对 · 1 个自评认识',['需再练','自评已记录','✓ 答对'],true]);
  assert.equal(m.run('return SRSQ.some(q=>q.w===WB4[0][0]);'),true, 'wrong option still enters review after changing modes');
});

check('unadvanced vocabulary option survives task switching and refresh and only advances once', () => {
  let m=createModel(); m.exec(setupDailyWords + 'S.today.push({id:"other-words",key:"words",kind:"words",t:"other words",book:"CET6",limit:3,min:5,done:false}); drMode("quiz");');
  const original=m.run('const q=wquiz(); const k=q.opts.findIndex(o=>!o.ok); qpick(k); return {snapshot:DR.quizSnapshot,pick:DR.quizPick,key:drWordKey()};');
  m.exec('lmOpenTask("other-words");'); m=m.reload(); m.exec('lmOpenTask("daily-words");');
  assert.deepEqual(m.run('return {snapshot:DR.quizSnapshot,pick:DR.quizPick,key:drWordKey()};'),original);
  assert.deepEqual(m.run('return [S.today[0].done,LM.wordSeen.length,DR.i,LM.records.length];'),[false,0,0,0]);
  m.exec('qpick(wquiz().opts.findIndex(o=>o.ok)); drMode("zhan"); drNextWord(true,drWordKey());');
  assert.deepEqual(m.run('return [LM.wordSeen.length,LM.wordSeen[0].chosen,LM.wordSeen[0].ok,DR.i,S.today[0].done];'),[1,original.snapshot.opts[original.pick].zh,false,1,false]);
  m.exec('drNextWord(true,' + JSON.stringify(original.key) + ');');
  assert.equal(m.run('return LM.wordSeen.length;'),1, 'stale previous-word action must not advance the current word');
  m.exec('drNextWord(true,drWordKey()); drNextWord(false,drWordKey());');
  assert.deepEqual(m.run('return [S.today[0].done,S.today[1].done,LM.records.length,LM.records[0].answers.length,LM.records[0].quizTotal];'),[true,false,1,3,1]);
});

check('future review evidence cannot complete today or preserve an invalid derived completion', () => {
  const m=createModel(); m.exec(`
    S.plan=true; LM.day=lmDate(); LM.records=[]; LM.deferred=[];
    S.today=[{id:'review-today',key:'review',kind:'review',t:'review today',words:['abandon'],date:lmDate(),done:false}];
    lmRecord({kind:'review',date:lmAddDate(lmDate(),1),right:1,total:1,answers:[{stem:'abandon',ok:true}]});
    lmReconcileReviews();
  `);
  assert.deepEqual(m.run('const p=lmReviewEvidence(S.today[0]); return [p.complete,p.entries.length,S.today[0].done,S.today[0].recordId??null,LM.records.length];'),[false,0,false,null,1]);
  m.exec('Object.assign(S.today[0],{done:true,recordId:LM.records[0].id,recordIds:[LM.records[0].id],right:1,total:1}); lmReconcileReviews();');
  assert.deepEqual(m.run('return [S.today[0].done,S.today[0].recordId??null,S.today[0].recordIds??null,S.today[0].right,LM.records.length];'),[false,null,null,0,1]);
});

check('entering celebrate directly after midnight creates today before checking completion', () => {
  const m=createModel(); m.exec(`
    S.plan=true; LM.day=lmAddDate(lmDate(),-1); LM.records=[];
    LM.plan={goal:'foundation',variant:'cet4',minutes:5,days:[0,1,2,3,4,5,6]};
    S.today=[{id:'completed-yesterday',key:'core',group:'foundation',kind:'grammar',t:'yesterday',date:LM.day,min:5,done:true}];
  `);
  assert.equal(m.run('return V.celebrate().includes("今日计划已完成");'),false);
  assert.deepEqual(m.run('return [LM.day===lmDate(),S.today.length,S.today.every(t=>t.date===lmDate()),S.today.every(t=>!t.done),S.today.some(t=>t.id==="completed-yesterday")];'),[true,1,true,true,false]);
  assert.equal(m.run('return V.celebrate().includes("今日计划已完成");'),false, 'a repeated render cannot mark the newly generated task complete');
});

check('midnight rendering preserves an active free practice even with no unfinished daily tasks', () => {
  const m = createModel();
  m.exec(`S.plan=true; LM.day=lmDate(); S.today=[]; LM.records=[];
    LM.freeTasks['free-midnight']={id:'free-midnight',group:'foundation',kind:'grammar',t:'free practice',done:false,min:5};
    startGroup('free-midnight'); prPick(0);
    render=()=>{lmEnsureDay();dbSave();}; LM.offset++;
    prPick(2);`);
  assert.deepEqual(m.run('return [PR.taskId,PR.sel,LM.practiceProgress["free-midnight"].sel,LM.day===lmDate()];'), ['free-midnight',2,2,true]);
  const restored=m.reload();
  restored.exec("enterTask('free-midnight');");
  assert.equal(restored.run('return PR.sel;'),2);
});

check('saved chapter lookup context follows current material after a content correction', () => {
  const m=createModel();
  m.exec(`S.fav=[];BK.cur='b1';BK.ch=0;LM.lookups={'b1:0':{word:'abandon',zh:'抛弃',context:'abandon 永远排第一，因为它是四级最爱考的动词。'}};`);
  assert.equal(m.run('return V.chapter().includes("最爱考");'),false);
  assert.equal(m.run('return LM.lookups["b1:0"].context.includes("原创词汇学习样例");'),true);
  assert.deepEqual(m.run('return [LM.lookups["b1:0"].word,LM.lookups["b1:0"].zh];'),['abandon','抛弃']);
});

check('midnight and refresh preserve a partly rated SRS batch until all words are recorded', () => {
  let m=createModel();
  m.exec(`normalizeState();lmNormalize();S.plan=true;LM.day=lmDate();LM.records=[];
    srsSeed();SRSQ.forEach(q=>{q.due=lmDate();q.interval=1;});
    S.today=[{id:'review-midnight',kind:'review',key:'review',t:'review',date:lmDate(),min:5,words:SRSQ.map(q=>q.w),done:false}];
    SRS.phase='idle';srsEnsure();srsShow();srsRate(2);
    render=()=>{lmEnsureDay();V.srs();dbSave();};LM.offset++;srsShow();`);
  assert.deepEqual(m.run('return [SRS.phase,SRS.pos,SRS.results.map(a=>a.stem),SRSQ[0].interval];'),['run',1,['abandon'],7]);
  m=m.reload();
  assert.deepEqual(m.run('return [SRS.phase,SRS.pos,SRS.results.map(a=>a.stem)];'),['run',1,['abandon']]);
  m.exec('srsShow();srsRate(2);srsShow();srsRate(2);srsShow();srsRate(2);');
  assert.equal(m.run('return SRS.phase;'),'done');
  assert.equal(m.run('return LM.records.filter(r=>r.kind==="review").length;'),1);
  assert.deepEqual(m.run('return LM.records.find(r=>r.kind==="review").answers.map(a=>a.stem);'),['abandon','accumulate','persistence','clarify']);
  assert.equal(m.run('return LM.deferred.find(t=>t.id==="review-midnight").done;'),true);
});

console.log('Audit model checks: ' + passed + '/' + (passed + failed));
if (failed) process.exitCode = 1;
