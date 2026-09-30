/* Pure data regression. No browser, DOM rendering, network, or backend claims. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const dir = 'docs/06-design/v2-980plus/redesign/mockups/mobile/';
function scenario(code) {
  const context = vm.createContext({ location: { search: '', hash: '' }, Date, console, setTimeout, clearTimeout, setInterval, clearInterval, performance: { now: () => 0 }, window: { addEventListener() {} }, document: {} });
  vm.runInContext(fs.readFileSync(dir + 'app.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync(dir + 'learning.js', 'utf8').replace(/bootMock\(\);\s*$/, ''), context);
  vm.runInContext('render=()=>{}; toast=()=>{}; dbSave=()=>{}; nav=()=>{}; LASTR="";', context);
  return JSON.parse(vm.runInContext('JSON.stringify((()=>{' + code + '})())', context));
}
let count = 0;
function check(name, code, expected) { assert.deepEqual(scenario(code), expected, name); count++; console.log('PASS ' + name); }
check('all goal/budget templates fit declared budgets', `return Object.keys(LGOALS).every(goal => [5,15,30,45].every(minutes => lmTemplate({goal,minutes,variant:'cet4'}).reduce((n,t)=>n+t.min,0)<=minutes));`, true);
check('five minutes is one five-minute task', `S.today=[];lmApplyPlan({goal:'foundation',variant:'cet4',minutes:5,days:[0,1,2,3,4,5,6]});return S.today.map(t=>[t.min,t.group]);`, [[5, 'foundation']]);
check('all target families select relevant core content', `return Object.keys(LGOALS).map(goal=>lmTemplate({goal,minutes:5,variant:'cet4'})[0].group);`, ['foundation', 'g1', 'graduate', 'workplace']);
check('CET6 selects advanced core sample', `return lmTemplate({goal:'college',variant:'cet6',minutes:5})[0].group;`, 'graduate');
check('completed and in-progress survive reduction', `S.today=[{id:'a',key:'core',min:5,done:true},{id:'b',key:'readquiz',min:8,started:true,done:false}];lmApplyPlan({...LM.plan,minutes:5});return S.today.map(t=>t.id);`, ['a', 'b']);
check('rest day adds no new tasks', `S.today=[];lmApplyPlan({...LM.plan,days:[]});return S.today.length;`, 0);
check('defer preserves answer snapshot', `S.today=[{id:'a',min:5,started:true,done:false}];Object.assign(PR,{taskId:'a',answers:[{ok:false,sel:2}]});lmApplyPlan({...LM.plan,minutes:5},'defer');return [LM.deferred[0].resume.answers,PR.taskId];`, [[{ ok: false, sel: 2 }], null]);
check('browse directory does not change resume identity', `S.lastRead={bookId:'b1',chapter:1,book:BOOKS[0].title,ch:BOOKS[0].toc[1]};BK.cur='b4';BK.ch=0;return [lmLastRead().bookId,lmLastRead().chapter];`, ['b1', 1]);
check('legacy completed aggregates remain visible but not scored', `S.today[0].done=true;S.today[0].right=2;S.today[0].total=3;lmNormalize();const s=lmStats();return [s.rows.length,s.right,s.total,s.xp,s.rows[0].imported];`, [1, 0, 0, 0, true]);
check('practice refresh restores answers without duplicate submission', `S.today=[{id:'a',group:'g1',t:'grammar',min:5,done:false}];Object.assign(PR,{taskId:'a',phase:'answer',answers:[{ok:true,sel:1}]});lmNormalize();prRecord(0,0);return [GROUPS.g1.items[0]._sel,PR.answers[0].sel];`, [1, 1]);
check('retry keeps prior round', `S.today=[{id:'a',group:'foundation',t:'basic',min:5,done:false}];startGroup('a');prRecord(0,0);PR.pos=1;prRecord(1,2);prFinish();const old=LM.records[0].id;startGroup('a');prRecord(0,1);PR.pos=1;prRecord(1,2);prFinish();return [LM.records.length,LM.records[0].id===old,LM.records.map(r=>r.right)];`, [2, true, [2, 1]]);
check('self rating does not verify mastery', `lmNormalize();const m=S.mistakes[0];lmSelfRate(m.id);return m.st;`, 'self');
check('third person mistake matches third person variant', `return lmVariant({t:'She ___ to school every day.',kind:'sentence',skill:lmSkill('She ___ to school every day.'),st:'todo'}).s;`, 'Tom ___ English every evening.');
check('word variant uses actual word meaning', `return lmVariant({t:'abandon',kind:'word',st:'todo'}).o[0];`, '抛弃');
check('unknown knowledge item stays unavailable', `return lmVariant({t:'Unknown exercise',kind:'sentence',st:'todo',skill:null});`, null);
check('future validation cannot be submitted', `lmNormalize();const m=S.mistakes[0];Object.assign(m,{st:'wait1',repaired:lmDate(),due:lmAddDate(lmDate(),1)});LM.mistakeId=m.id;LM.mistakePick=1;lmMistakeCheck();return [m.st,LM.records.length];`, ['wait1', 0]);
check('repair then next-day and seven-day validation', `lmNormalize();const m=S.mistakes[0];LM.mistakeId=m.id;LM.mistakePick=lmVariant(m).a;lmMistakeCheck();const a=m.st;LM.offset=1;LM.mistakeFeedback=null;LM.mistakePick=lmVariant(m).a;lmMistakeCheck();const b=m.st;LM.offset=7;LM.mistakeFeedback=null;LM.mistakePick=lmVariant(m).a;lmMistakeCheck();return [a,b,m.st,LM.records.length];`, ['wait1', 'wait7', 'verified', 3]);
check('failed verification reopens same item', `lmNormalize();const m=S.mistakes[0];Object.assign(m,{st:'wait7',due:lmDate(),repaired:lmAddDate(lmDate(),-7)});LM.mistakeId=m.id;LM.mistakePick=(lmVariant(m).a+1)%3;lmMistakeCheck();return [m.st,m.due];`, ['todo', null]);
check('review forgotten round is finite and separates operations', `SRSQ.splice(0,SRSQ.length,{w:'abandon',zh:'抛弃',due:lmDate(),source:'test'});SRS.phase='idle';srsEnsure();srsShow();srsRate(0);srsShow();srsRate(0);return [SRS.phase,SRS.batch,SRS.operations,SRSQ[0].due===lmAddDate(lmDate(),1)];`, ['done', 1, 2, true]);
check('review undo restores date and removes completion record', `SRSQ.splice(0,SRSQ.length,{w:'abandon',zh:'抛弃',due:lmDate(),source:'test'});SRS.phase='idle';srsEnsure();srsShow();srsRate(2);srsUndo();return [SRS.phase,SRSQ[0].due===lmDate(),LM.records.length];`, ['run', true, 0]);
check('writing rule feedback does not invent full scoring', `const r=lmWritingRules(LWRITE_REFERENCE);return [r.accepted,r.checks.length,r.summary.includes('不评价完整语法')];`, [true, 3, true]);
check('short writing requires revision', `return lmWritingRules('Dear Sam, study this weekend. Best wishes, Alex').accepted;`, false);
check('unknown writing resolves exactly once and keeps draft', `LM.writing.text=LWRITE_REFERENCE;LM.writing.phase='unknown';LM.writing.pending={id:'w1',text:LWRITE_REFERENCE};lmWritingResolve();lmWritingResolve();return [LM.records.length,LM.writes.length,LM.writing.text===LWRITE_REFERENCE];`, [1, 1, true]);
check('record identity makes repeat completion idempotent', `lmRecord({key:'same',title:'x'});lmRecord({key:'same',title:'x'});return LM.records.length;`, 1);
check('self-rated words excluded from question accuracy', `lmRecord({kind:'words',right:3,total:3});lmRecord({kind:'practice',right:1,total:2});return [lmStats().right,lmStats().total];`, [1, 2]);
check('completed repair keeps the answered stem on feedback', `lmNormalize();const m=S.mistakes[0];LM.mistakeId=m.id;LM.mistakePick=lmVariant(m).a;const stem=lmVariant(m).s;lmMistakeCheck();return [lmVariant(m).s===stem,lmVariantTitle(m),m.st];`, [true, '同知识点变式', 'wait1']);
check('retrying old record does not inflate today task count', `S.today=[];const r=lmRecord({group:'foundation',kind:'practice',title:'old',taskId:'old'});lmRetryRecord(r.id);return [S.today.length,prGroup().title];`, [0, '基础 · 日常表达']);
check('fully read book and no due queue do not create blocked tasks', `SRSQ.forEach(q=>q.due=lmAddDate(lmDate(),1));BOOKS[0].toc.forEach((_,i)=>LM.chapters['b1:'+i]={done:true});return lmTemplate({goal:'college',variant:'cet4',minutes:45}).map(t=>t.key);`, ['core', 'readquiz', 'write', 'words']);
console.log('Pure model checks: ' + count + '/' + count);
