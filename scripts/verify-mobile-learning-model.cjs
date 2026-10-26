/* Pure data regression. No browser, DOM rendering, network, or backend claims. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const dir = 'docs/06-design/v2-980plus/redesign/mockups/mobile/';
const fixedNow = new Date(2026, 9, 2, 12).getTime();
class ModelDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedNow])); }
  static now() { return fixedNow; }
}
function scenario(code) {
  const storage = new Map();
  const context = vm.createContext({ location: { search: '', hash: '' }, Date: ModelDate, console, setTimeout, clearTimeout, setInterval, clearInterval, performance: { now: () => 0 }, window: { addEventListener() {} }, document: {}, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) } });
  vm.runInContext(fs.readFileSync(dir + 'app.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync(dir + 'learning.js', 'utf8').replace(/bootMock\(\);\s*$/, ''), context);
  vm.runInContext(`
    const modelSave = dbSave, modelLoad = dbLoad;
    render=()=>{}; toast=()=>{}; dbSave=()=>{}; nav=()=>{}; LASTR="";
    function cleanLearning() {
      S.today=[]; S.mistakes=[]; S.plan=true; SRSQ.length=0;
      Object.assign(LM,{offset:0,day:"",serial:0,records:[],deferred:[],chapters:{},practiceProgress:{},freeTasks:{},writingProgress:{},wordProgress:{},wordTask:null,wordSeen:[],wordClosed:false,reviewTask:null,emptyTodayDate:null,planDraft:null,planPreview:null});
      LM.plan={goal:'college',variant:'cet4',minutes:15,days:[0,1,2,3,4,5,6]}; LM.day=lmDate();
      LM.writing={text:'',revision:0,phase:'draft',feedback:'',self:'',taskId:null};
      Object.assign(PR,{taskId:null,pos:0,sel:-1,phase:'answer',fb:null,answers:[],attempt:null});
      Object.assign(SRS,{phase:'idle',order:[],results:[],undo:[],redo:[],pos:0,pass:1,attempt:null});
      LM.mistakeFeedback=null; LM.mistakeUndo=null; LM.mistakeId=null; LM.mistakePick=-1;
    }
    function seedDueLearning() {
      SRSQ.push(...['persistence','clarify','abandon','accumulate','resilient','adapt'].map(w=>({w,zh:'样例释义',due:lmDate(),source:'回归夹具',interval:0,show:false,done:false})));
      S.mistakes.push({id:'due-verification',t:'There ___ two books on the desk.',kind:'sentence',skill:'there',st:'wait1',revision:3,created:lmAddDate(lmDate(),-2),repaired:lmAddDate(lmDate(),-2),due:lmAddDate(lmDate(),-1),src:'原语法轮次'},
        {id:'pending-repair',t:'She ___ to school every day.',kind:'sentence',skill:'third',st:'todo',revision:0,created:lmDate(),src:'原练习轮次'});
    }
    function saveAndReloadLearning() {
      modelSave();
      if (!localStorage.getItem(DBKEY)) throw new Error('real dbSave did not persist an envelope');
      cleanLearning();
      if (!modelLoad()) throw new Error('real dbLoad rejected its saved envelope');
      normalizeState(); lmNormalize();
    }
  `, context);
  return JSON.parse(vm.runInContext('JSON.stringify((()=>{' + code + '})())', context));
}
let count = 0, passed = 0;
function check(name, code, expected) {
  count++;
  try { assert.deepEqual(scenario(code), expected, name); passed++; console.log('PASS ' + name); }
  catch (error) { process.exitCode=1; console.error('FAIL ' + name); console.error(error); }
}
// A template is now a shared candidate pool. Budget limits apply to its projection and materialized plan.
for (const [goal, variant] of [['foundation','cet4'],['college','cet4'],['college','cet6'],['graduate','cet4'],['workplace','cet4']]) {
  for (const [minutes, used] of [[5,5],[15,13],[30,28],[45,38]]) {
    check(`${goal}/${variant}/${minutes}: actual new-study projection and plan fit budget`, `cleanLearning();const p={...LM.plan,goal:'${goal}',variant:'${variant}',minutes:${minutes}};const x=lmPlanProjection(p);const sources=x.planned.map(lmTaskSource);lmApplyPlan(p);return [x.used,S.today.reduce((n,t)=>n+t.min,0),JSON.stringify(sources)===JSON.stringify(S.today.map(lmTaskSource)),new Set(S.today.map(lmTaskSource)).size===S.today.length,x.pinned.length];`, [used,used,true,true,0]);
  }
}
check('four budgets share the same content and due candidate pool', `cleanLearning();seedDueLearning();const snapshots=[5,15,30,45].map(minutes=>lmPlanCandidates({...LM.plan,minutes},[],'keep').map(t=>[lmTaskSource(t),t.min,t.priority]));return [snapshots.map(x=>x.length),snapshots.every(x=>JSON.stringify(x)===JSON.stringify(snapshots[0]))];`, [[9,9,9,9],true]);
check('five minutes without existing due work selects one core sample', `cleanLearning();lmApplyPlan({goal:'foundation',variant:'cet4',minutes:5,days:[0,1,2,3,4,5,6]});return S.today.map(t=>[t.min,t.group]);`, [[5, 'foundation']]);
check('all target families select relevant core content', `return Object.keys(LGOALS).map(goal=>lmTemplate({goal,minutes:5,variant:'cet4'})[0].group);`, ['foundation', 'g1', 'graduate', 'workplace']);
check('CET6 selects advanced core sample', `return lmTemplate({goal:'college',variant:'cet6',minutes:5})[0].group;`, 'graduate');
// These direct plan calls require the same seed normalization as the real application boot.
check('completed and in-progress survive reduction', `lmNormalize();S.today=[{id:'a',key:'core',min:5,done:true},{id:'b',key:'readquiz',min:8,started:true,done:false}];lmApplyPlan({...LM.plan,minutes:5});return S.today.map(t=>t.id);`, ['a', 'b']);
check('rest day adds no new tasks', `lmNormalize();S.today=[];lmApplyPlan({...LM.plan,days:[]});return S.today.length;`, 0);
check('defer preserves answer snapshot', `lmNormalize();S.today=[{id:'a',group:'g1',min:5,started:true,done:false}];Object.assign(PR,{taskId:'a',answers:[{ok:false,sel:2}]});lmApplyPlan({...LM.plan,minutes:5},'defer');return [LM.deferred[0].resume.answers,PR.taskId];`, [[{ ok: false, sel: 2 }], null]);
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
for (const [minutes, used, kinds] of [
  [5,4,['verify','repair']],
  [15,14,['verify','review','review','repair']],
  [30,27,['verify','review','review','repair','grammar','reading']],
  [45,42,['verify','review','review','repair','grammar','reading','writing','words']],
]) {
  check(`${minutes}: due work precedes new study and non-fitting items retain explicit reasons`, `
    cleanLearning(); seedDueLearning(); const p={...LM.plan,minutes:${minutes}};
    const before=JSON.stringify([SRSQ.map(q=>[q.w,q.due]),S.mistakes.map(m=>[m.id,m.due])]);
    const x=lmPlanProjection(p); lmApplyPlan(p);
    return [x.used,S.today.reduce((n,t)=>n+t.min,0),x.planned.map(t=>t.kind),
      x.postponed.length>0&&x.postponed.every(t=>/剩余 \\d+ 分钟/.test(t.reason)&&t.reason.includes('顺延且不改原到期日期')),
      before===JSON.stringify([SRSQ.map(q=>[q.w,q.due]),S.mistakes.map(m=>[m.id,m.due])])];
  `, [used,used,kinds,true,true]);
}
check('saved resumption precedes due candidates without duplicating the source', `
  cleanLearning(); seedDueLearning();
  LM.deferred=[{id:'old-grammar',group:'g1',kind:'grammar',min:5,t:GROUPS.g1.title,date:lmAddDate(lmDate(),-1),started:true,done:false}];
  lmApplyPlan({...LM.plan,minutes:15});
  return [S.today[0].id,S.today.map(t=>t.kind),S.today.reduce((n,t)=>n+t.min,0),S.today.filter(t=>t.group==='g1').length,LM.deferred.some(t=>t.id==='old-grammar')];
`, ['old-grammar',['grammar','verify','review','repair'],14,1,false]);
check('repeat apply and same-day ensure reuse all scheduled and postponed identities', `
  cleanLearning();seedDueLearning();lmApplyPlan({...LM.plan,minutes:15});
  const before=S.today.concat(LM.deferred).map(t=>t.id).sort(),serial=LM.serial;
  lmApplyPlan(LM.plan);lmEnsureDay();lmEnsureDay();
  const after=S.today.concat(LM.deferred).map(t=>t.id).sort();
  return [before.length,JSON.stringify(before)===JSON.stringify(after),new Set(after).size===after.length,LM.serial===serial,LM.records.length];
`, [9,true,true,true,0]);
check('preview and cancel leave the effective plan, due dates, progress and records unchanged', `
  cleanLearning();seedDueLearning();lmApplyPlan({...LM.plan,minutes:45});
  const facts=()=>JSON.stringify([LM.plan,S.today,LM.deferred,LM.records,S.mistakes,SRSQ,LM.practiceProgress,LM.writing]);
  const before=facts();LM.planDraft={...LM.plan,minutes:5};LM.planPreview={policy:'defer',onboard:false};
  lmPlanProjection(LM.planDraft,'defer');lmPlanProjection(LM.planDraft,'defer');lmCancelPlan();lmConfirmPlan();
  return [before===facts(),LM.plan.minutes,LM.planDraft,LM.planPreview];
`, [true,45,null,null]);
check('confirmed defer survives real save/load and does not resurrect old same-source rounds', `
  cleanLearning();LM.offset=1;LM.day=lmDate();seedDueLearning();
  const oldDate=lmAddDate(lmDate(),-1);
  S.today=[{id:'current-grammar',group:'g1',kind:'grammar',t:GROUPS.g1.title,min:5,date:lmDate(),started:true,done:false},
    {id:'current-writing',kind:'writing',key:'write',t:'写作 · 给朋友的一封信',min:10,date:lmDate(),started:true,done:false}];
  LM.deferred=[{id:'old-grammar',group:'g1',kind:'grammar',t:GROUPS.g1.title,min:5,date:oldDate,started:true,done:false,reason:'旧日未完成',deferredOn:oldDate},
    {id:'old-writing',kind:'writing',key:'writing',t:'写作 · 给朋友的一封信',min:10,date:oldDate,started:true,done:false,reason:'旧日未完成',deferredOn:oldDate}];
  Object.assign(PR,{taskId:'current-grammar',phase:'answer',pos:1,answers:[{ok:false,sel:2}],attempt:'current-attempt'});
  LM.practiceProgress['old-grammar']={taskId:'old-grammar',phase:'answer',pos:0,answers:[{ok:true,sel:1}],attempt:'old-attempt'};
  LM.writing={...LM.writing,taskId:'current-writing',text:'current draft'};
  LM.writingProgress['old-writing']={...LM.writing,taskId:'old-writing',text:'old draft'};
  lmApplyPlan({...LM.plan,minutes:45});LM.planDraft={...LM.plan,minutes:15};LM.planPreview={policy:'defer',onboard:false};
  const preview=lmPlanProjection(LM.planDraft,'defer');lmConfirmPlan();lmEnsureDay();saveAndReloadLearning();lmEnsureDay();
  const rounds=LM.deferred.filter(t=>['current-grammar','current-writing','old-grammar','old-writing'].includes(t.id));
  return [preview.used,LM.plan.minutes,S.today.reduce((n,t)=>n+t.min,0),S.today.map(t=>t.kind),
    rounds.map(t=>t.id).sort(),rounds.every(t=>t.deferUntilDate===lmDate()),LM.offset,
    LM.practiceProgress['current-grammar'].answers[0].sel,LM.practiceProgress['old-grammar'].answers[0].sel,
    LM.writingProgress['current-writing'].text,LM.writingProgress['old-writing'].text];
`, [14,15,14,['verify','review','review','repair'],['current-grammar','current-writing','old-grammar','old-writing'],true,1,2,1,'current draft','old draft']);
check('same-day defer expires on the next learning day without clearing round progress', `
  cleanLearning();const date=lmDate();
  const task={id:'resume-tomorrow',group:'g1',kind:'grammar',t:GROUPS.g1.title,min:5,date,started:true,done:false,deferUntilDate:date};
  LM.deferred=[task];LM.practiceProgress[task.id]={taskId:task.id,phase:'answer',pos:1,answers:[{ok:true,sel:1}],attempt:'kept'};
  lmApplyPlan({...LM.plan,minutes:5});const absent=!S.today.some(t=>t.id===task.id);LM.offset=1;lmEnsureDay();
  return [absent,S.today.map(t=>t.id),LM.practiceProgress[task.id].answers[0].sel,S.today[0].originDate===date];
`, [true,['resume-tomorrow'],1,true]);
check('same-content practice rounds save latest snapshots and resume only the selected ID', `
  cleanLearning();const date=lmAddDate(lmDate(),-2);
  const a={id:'round-a',group:'g1',kind:'grammar',t:GROUPS.g1.title,min:5,date,started:true,done:false};
  const b={...a,id:'round-b',date:lmAddDate(lmDate(),-1)};S.today=[a,b];
  Object.assign(PR,{taskId:a.id,phase:'answer',pos:0,answers:[{ok:false,sel:2}],attempt:'attempt-a'});
  LM.practiceProgress[b.id]={taskId:b.id,phase:'answer',pos:0,answers:[{ok:false,sel:2}],attempt:'attempt-b'};
  lmStoreDeferred(a,'first save');lmStoreDeferred(b,'other round');
  PR.pos=1;PR.answers=[{ok:true,sel:1},{ok:false,sel:0}];a.date=lmDate();lmStoreDeferred(a,'latest save');
  const stored=LM.deferred.find(t=>t.id===a.id);const snapshot=[LM.deferred.length,stored.resume.pos,stored.resume.answers[0].sel,stored.originDate===date,stored.deferredOn===lmDate()];
  S.today=[];PR.taskId=null;const observed=[];
  lmResumeDeferred(a.id);observed.push([PR.taskId,PR.pos,PR.answers[0].sel]);
  lmResumeDeferred(b.id);observed.push([PR.taskId,PR.pos,PR.answers[0].sel]);
  lmOpenTask(a.id);observed.push([PR.taskId,PR.pos,PR.answers[0].sel]);
  return [snapshot,observed,S.today.length,new Set(S.today.map(t=>t.id)).size,LM.deferred.length];
`, [[2,1,1,true,true],[['round-a',1,1],['round-b',0,2],['round-a',1,1]],2,2,0]);
check('same-content writing rounds retain separate drafts when resumed in either order', `
  cleanLearning();const a={id:'writing-a',kind:'writing',key:'write',t:'写作 · 给朋友的一封信',min:10,date:lmAddDate(lmDate(),-2),started:true,done:false};
  const b={...a,id:'writing-b',key:'writing',date:lmAddDate(lmDate(),-1)};S.today=[a,b];
  LM.writing={...LM.writing,taskId:a.id,text:'draft A'};
  LM.writingProgress[b.id]={...LM.writing,taskId:b.id,text:'draft B'};
  lmStoreDeferred(a,'saved A');lmStoreDeferred(b,'saved B');S.today=[];
  const observed=[];lmResumeDeferred(b.id);observed.push([LM.writing.taskId,LM.writing.text]);
  lmResumeDeferred(a.id);observed.push([LM.writing.taskId,LM.writing.text]);
  lmOpenTask(b.id);observed.push([LM.writing.taskId,LM.writing.text]);
  return [observed,S.today.length,LM.writingProgress[a.id].text,LM.writingProgress[b.id].text,lmTaskSource(a)===lmTaskSource(b)];
`, [[['writing-b','draft B'],['writing-a','draft A'],['writing-b','draft B']],2,'draft A','draft B',true]);
check('same-content word rounds save full current drill state and resume by selected ID', `
  cleanLearning();const a={id:'words-a',kind:'words',key:'words',book:'CET4',limit:3,t:'回忆三个词',min:5,date:lmAddDate(lmDate(),-2),started:true,done:false};
  const b={...a,id:'words-b',date:lmAddDate(lmDate(),-1)};S.today=[a,b];LM.wordTask=a.id;
  Object.assign(DR,{book:'CET4',i:0,known:0,mode:'zhan',show:false,quizPick:-1,quizDone:false});lmStoreDeferred(a,'first save');
  LM.wordProgress[b.id]={seen:[{w:'abandon'},{w:'accumulate'}],dr:{...DR,i:2,mode:'quiz',show:true,quizPick:1}};lmStoreDeferred(b,'other round');
  DR.i=1;DR.known=1;DR.show=true;LM.wordSeen=[{w:'abandon'}];lmStoreDeferred(a,'latest save');
  const latest=LM.deferred.find(t=>t.id===a.id).wordState;
  S.today=[];LM.wordTask=null;const observed=[];
  lmResumeDeferred(b.id);observed.push([LM.wordTask,DR.i,DR.mode,DR.quizPick,LM.wordSeen.length]);
  lmResumeDeferred(a.id);observed.push([LM.wordTask,DR.i,DR.mode,DR.quizPick,LM.wordSeen.length]);
  lmOpenTask(b.id);observed.push([LM.wordTask,DR.i,DR.mode,DR.quizPick,LM.wordSeen.length]);
  return [[latest.dr.i,latest.dr.show,latest.seen.length],observed,LM.deferred.length,S.today.length];
`, [[1,true,1],[['words-b',2,'quiz',1,2],['words-a',1,'zhan',-1,1],['words-b',2,'quiz',1,2]],0,2]);
check('due item without a matching variant stays explicitly postponed with its source unchanged', `
  cleanLearning();const m={id:'unavailable-source',t:'Unsupported knowledge item',kind:'sentence',skill:'unknown',st:'wait1',revision:4,due:lmDate(),repaired:lmAddDate(lmDate(),-1)};S.mistakes=[m];
  const x=lmPlanProjection(LM.plan);lmApplyPlan(LM.plan);const postponed=LM.deferred.find(t=>t.mistakeId===m.id);
  return [S.today.some(t=>t.mistakeId===m.id),postponed.reason,postponed.mistakeStage,postponed.mistakeRevision,postponed.due===m.due,m.st,LM.records.length,x.used];
`, [false,'暂缺匹配变式，保留待处理来源','wait1',4,true,'wait1',0,13]);
check('rest-day postponement preserves due facts and existing progress without inventing completion', `
  cleanLearning();seedDueLearning();S.today=[{id:'saved-on-rest-day',group:'g1',kind:'grammar',t:GROUPS.g1.title,min:5,started:true,done:false}];
  const dates=JSON.stringify([SRSQ.map(q=>q.due),S.mistakes.map(m=>m.due)]);
  const x=lmPlanProjection({...LM.plan,days:[]});lmApplyPlan({...LM.plan,days:[]});
  return [S.today.map(t=>t.id),x.isStudy,x.postponed.length>0&&x.postponed.every(t=>t.reason==='今天是休息日，保留原到期日期与进度'),
    dates===JSON.stringify([SRSQ.map(q=>q.due),S.mistakes.map(m=>m.due)]),LM.records.length,S.today[0].done];
`, [['saved-on-rest-day'],false,true,true,0,false]);
check('verification completion links the original mistake stage and revision only', `
  cleanLearning();const m={id:'mistake-a',t:'There ___ two books on the desk.',kind:'sentence',skill:'there',st:'wait1',revision:2,repaired:lmAddDate(lmDate(),-1),due:lmDate(),src:'original source'};
  const other={...m,id:'mistake-b',st:'todo',revision:8};S.mistakes=[m,other];
  LM.deferred=[{...lmMistakeCandidate(m),id:'stale-source',mistakeRevision:1,started:true,done:false,min:2}];
  lmApplyPlan(LM.plan);const task=S.today.find(t=>t.mistakeId===m.id),otherTask=S.today.find(t=>t.mistakeId===other.id);
  lmOpenTask(task.id);const stem=lmVariant(m).s;LM.mistakePick=lmVariant(m).a;lmMistakeCheck();lmMistakeCheck();
  const record=LM.records[0];return [LM.mistakeId,m.id,m.src,m.st,m.revision,other.st,other.revision,
    task.done,task.recordId===record.id,record.answers[0].stem===stem,otherTask.done,LM.deferred.find(t=>t.id==='stale-source').done,LM.records.length];
`, ['mistake-a','mistake-a','original source','wait7',3,'todo',8,true,true,true,false,false,1]);
check('verification undo reopens its same task identity without a phantom completion', `
  cleanLearning();seedDueLearning();SRSQ.length=0;lmApplyPlan(LM.plan);
  const task=S.today.find(t=>t.kind==='verify'),id=task.id;lmOpenTask(id);LM.mistakePick=lmVariant(S.mistakes[0]).a;lmMistakeCheck();
  lmMistakeUndo();lmApplyPlan(LM.plan);const restored=S.today.find(t=>t.id===id);
  return [LM.records.length,restored.done,!!restored.recordId,restored.mistakeRevision,S.mistakes[0].st,S.today.filter(t=>t.mistakeId==='due-verification').length];
`, [0,false,false,3,'wait1',1]);
check('selected SRS batch uses its own words and cannot hijack a running different batch', `
  cleanLearning();seedDueLearning();S.mistakes=[];lmApplyPlan({...LM.plan,minutes:15});
  const batches=S.today.filter(t=>t.kind==='review');const identities=batches.map(t=>t.id);
  lmOpenTask(batches[1].id);srsEnsure();const selected=SRS.order.map(i=>SRSQ[i].w);
  lmOpenTask(batches[0].id);
  return [batches.map(t=>t.words.length),selected,LM.reviewTask===identities[1],SRS.order.map(i=>SRSQ[i].w),!!batches[0].started];
`, [[4,2],['persistence','resilient'],true,['persistence','resilient'],false]);
check('SRS batch completion and undo preserve other records and restore the same source task', `
  cleanLearning();seedDueLearning();S.mistakes=[];lmApplyPlan({...LM.plan,minutes:15});
  const batches=S.today.filter(t=>t.kind==='review'),first=batches[0],second=batches[1];
  lmOpenTask(first.id);srsEnsure();for(let i=0;i<4;i++){srsShow();srsRate(2);}
  const completion=[first.done,second.done,LM.records.length,SRS.results.length];
  const unrelated=lmRecord({key:'other-domain',kind:'writing',title:'other',text:'keep me'});
  LM.writing.text='keep draft';LM.chapters['b1:0']={done:false,note:'keep note'};
  srsUndo();lmApplyPlan(LM.plan);
  const task=S.today.find(t=>t.id===first.id),remaining=S.today.concat(LM.deferred).filter(t=>t.kind==='review');
  return [completion,task.done,LM.reviewTask===first.id,SRS.phase,LM.records.map(r=>r.key),LM.records[0].id===unrelated.id,
    LM.writing.text,LM.chapters['b1:0'].note,SRSQ.filter(q=>q.due<=lmDate()).length,
    remaining.length,new Set(remaining.flatMap(t=>t.words)).size,remaining.every(t=>[first.id,second.id].includes(t.id))];
`, [[true,false,1,4],false,true,'run',['other-domain'],true,'keep draft','keep note',3,2,6,true]);
console.log('Pure model checks: ' + passed + '/' + count + '; no browser, DOM interaction, network or backend acceptance.');
