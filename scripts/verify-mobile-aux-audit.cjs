/* Auxiliary static-prototype regression against production functions/storage.
 * No real payment, push delivery, export/delete service or backend is invoked.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const dir = path.resolve(__dirname, '../docs/06-design/v2-980plus/redesign/mockups/mobile');
function createModel(storage = new Map()) {
  const elements = new Map(), timers = [], speeches = [], frames = [], cancelledFrames = [];
  const context = vm.createContext({
    Date, console, location: { search: '', hash: '' }, performance: { now: () => 0 },
    history: { state: null, replaceState(state) { this.state = state; } },
    window: { addEventListener() {}, matchMedia: () => ({ matches: false }) },
    document: { getElementById: id => elements.get(id) || null, querySelectorAll: () => [], documentElement: { setAttribute() {} }, addEventListener() {} },
    setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout: () => {},
    setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; }, cancelAnimationFrame: id => cancelledFrames.push(id),
    SpeechSynthesisUtterance: function(text) { this.text = text; },
    speechSynthesis: { cancel() {}, speak: utterance => speeches.push(utterance) },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
  });
  vm.runInContext(fs.readFileSync(path.join(dir, 'app.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(dir, 'learning.js'), 'utf8').replace(/bootMock\(\);\s*$/, ''), context);
  vm.runInContext('var productionAuxRender=render; render=()=>dbSave(); toast=()=>{}; nav=hash=>{location.hash=hash;dbSave();}; LASTR=""; LM.day=lmDate();', context);
  return {
    storage,
    speeches,
    cancelledFrames,
    run: code => JSON.parse(vm.runInContext('JSON.stringify((()=>{' + code + '})())', context)),
    exec: code => vm.runInContext(code, context),
    setField(id, value = '') { const field = { value, style: {}, className: '', textContent: '', isConnected: true, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, querySelectorAll: () => [], contains: () => false, scrollTop: 0 }; elements.set(id, field); return field; },
    button(name, text = '确认') { context[name] = { textContent: text, isConnected: true, dataset: {}, classList: { add() {}, remove() {} } }; },
    fireTimer(index) { timers[index]?.(); },
    fireFrame(index) { frames[index]?.(); },
    renderActual(hash) { for (const id of ['view','title','bk','tabs']) if (!elements.has(id)) this.setField(id); this.exec('location.hash='+JSON.stringify(hash)+'; productionAuxRender();'); },
    reload() { this.exec('dbSave();'); const next = createModel(storage); assert.equal(next.run('return dbLoad();'), true); next.exec('normalizeState(); lmNormalize();'); return next; },
  };
}
let passed = 0, failed = 0;
function check(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.message); } }

check('support draft survives category rendering and production refresh', () => {
  let m = createModel(); m.setField('sup', '描述含有 <b>文字</b>');
  m.exec('supDraftInput(); SUP.cat="支付"; render();');
  assert.equal(m.run('return V.support().includes("描述含有 &lt;b&gt;文字&lt;/b&gt;");'), true);
  m = m.reload();
  assert.deepEqual(m.run('return [SUP.draft,SUP.cat];'), ['描述含有 <b>文字</b>', '支付']);
});

check('support submission stores literal text, clears its draft and does not duplicate on repeat', () => {
  const m = createModel(), before=m.run('return SUP.list.length;');
  m.setField('sup', '<b>probe</b>'); m.exec('supDraftInput(); supSend(); supSend();');
  assert.deepEqual(m.run('return [SUP.list.length,SUP.list[0].t,SUP.draft];'), [before+1,'<b>probe</b>','']);
  for (const route of ['support','tdetail','acs']) {
    assert.equal(m.run('return V.' + route + '().includes("<b>probe</b>");'), false);
    assert.equal(m.run('return V.' + route + '().includes("&lt;b&gt;probe&lt;/b&gt;");'), true);
  }
});

check('an empty support status filter presents its explanatory empty state', () => {
  const m=createModel(); m.exec('TD.f="已提交";');
  assert.equal(m.run('return V.tdetail().includes("这类暂无工单");'),true);
});

check('search renders user query as text in both input and no-result feedback', () => {
  const m=createModel(); m.exec('SH.q="<b>probe</b>";');
  assert.equal(m.run('return V.search().includes("<b>probe</b>");'),false);
  assert.equal(m.run('return V.search().includes("&lt;b&gt;probe&lt;/b&gt;");'),true);
});

check('accessibility preferences save immediately before any navigation', () => {
  const m=createModel(); m.exec('AX.c=false; AX.f=0; AX.m=true; AX.fo=false; AX.v=false; dbSave();');
  m.exec('a11y("contrast"); a11y("font"); a11y("motion"); a11y("focus"); a11y("voice");');
  const expected=m.run('return AX;'); m.exec('dbLoad();'); assert.deepEqual(m.run('return AX;'),expected);
});

check('confirmation button restores its label and an old expiry cannot clear a newer confirmation', () => {
  const m=createModel(); m.button('auditButton','原操作'); m.exec('var confirmations=0; arm(auditButton,()=>confirmations++); arm(auditButton,()=>confirmations++);');
  assert.deepEqual(m.run('return [auditButton.textContent,confirmations,Boolean(auditButton.dataset.armed)];'),['原操作',1,false]);
  m.exec('arm(auditButton,()=>confirmations++);'); m.fireTimer(0);
  assert.deepEqual(m.run('return [auditButton.textContent,Boolean(auditButton.dataset.armed)];'),['再点一次确认',true]);
  m.exec('arm(auditButton,()=>confirmations++);');
  assert.deepEqual(m.run('return [auditButton.textContent,confirmations];'),['原操作',2]);
});

function confirmPayment(m) { m.button('payButton','确认沙盒支付'); m.exec('payGo(payButton); payGo(payButton);'); }
check('checkout uses the selected product snapshot and repeated confirmation creates one local order', () => {
  const m=createModel(), before=m.run('return RF_ORDERS.length;');
  m.exec('checkoutOpen("g1");');
  assert.deepEqual(m.run('return [PAY.productId,PAY.title,PAY.price];'),['g1','月度会员',19]);
  confirmPayment(m); confirmPayment(m);
  assert.deepEqual(m.run('const order=RF_ORDERS.find(o=>o.id===PAY.orderId);return [RF_ORDERS.length,order.productId,order.t,order.price,order.paymentPhase];'),[before+1,'g1','月度会员',19,'paid']);
});

check('paid sandbox order survives refresh as the same product and amount', () => {
  let m=createModel(); m.exec('checkoutOpen("g3");'); confirmPayment(m);
  const original=m.run('return RF_ORDERS.find(o=>o.id===PAY.orderId);'); m=m.reload();
  assert.deepEqual(m.run('return RF_ORDERS.find(o=>o.id===PAY.orderId);'),original);
  assert.equal(m.run('return V.pay().includes("49");'),true);
});

check('unknown payment restores its intent and query resolves exactly once', () => {
  let m=createModel(), before=m.run('return RF_ORDERS.length;');
  m.exec('checkoutOpen("g2"); LAB.unknownNext=true;'); confirmPayment(m);
  const id=m.run('return PAY.orderId;'); assert.equal(m.run('return PAY.phase;'),'unknown');
  m=m.reload(); confirmPayment(m);
  assert.deepEqual(m.run('return [PAY.orderId,PAY.phase,RF_ORDERS.length];'),[id,'unknown',before+1]);
  m.exec('payResolve(); payResolve();');
  assert.deepEqual(m.run('return [PAY.orderId,RF_ORDERS.length,RF_ORDERS.find(o=>o.id===PAY.orderId).paymentPhase];'),[id,before+1,'paid']);
});

check('failed payment retries the original local order after refresh', () => {
  let m=createModel(), before=m.run('return RF_ORDERS.length;');
  m.exec('checkoutOpen("g1"); LAB.failNext=true;'); confirmPayment(m);
  const id=m.run('return PAY.orderId;'); assert.equal(m.run('return RF_ORDERS.find(o=>o.id===PAY.orderId).paymentPhase;'),'failed');
  m=m.reload(); m.exec('payRetry();'); confirmPayment(m);
  assert.deepEqual(m.run('return [PAY.orderId,RF_ORDERS.length,RF_ORDERS.find(o=>o.id===PAY.orderId).paymentPhase];'),[id,before+1,'paid']);
});

check('offline sandbox payment preserves selection without claiming payment or creating an order', () => {
  const m=createModel(), before=m.run('return RF_ORDERS.length;');
  m.exec('checkoutOpen("g4"); LAB.offline=true;'); confirmPayment(m);
  assert.deepEqual(m.run('return [PAY.productId,RF_ORDERS.length,PAY.orderId];'),['g4',before,null]);
});

check('renewal cancellation and two invoice request types have independent persisted states', () => {
  let m=createModel(); m.exec('checkoutOpen("g1");'); confirmPayment(m);
  m.exec('rfCancelRenewal(PAY.orderId); rfInv(PAY.orderId,"电子收据");');
  const receipt=m.run('return RF_ORDERS.find(o=>o.id===PAY.orderId).receiptStatus;');
  m.exec('rfInv(PAY.orderId,"本地发票");'); m=m.reload();
  assert.deepEqual(m.run('const o=RF_ORDERS.find(o=>o.id===PAY.orderId);return [o.renewal,o.receiptStatus,o.invoiceStatus,o.paymentPhase];'),['cancelled',receipt,'申请中（演示）','paid']);
});

check('privacy deletion is a cancellable local request and does not claim a completed service operation', () => {
  let m=createModel(); m.exec('LM.writing.text="kept draft";'); const user=m.run('return S.user;');
  m.exec('privacyDelete();'); assert.equal(m.run('return Boolean(PV.del);'),true);
  assert.deepEqual(m.run('return [S.user,LM.writing.text];'),[user,'kept draft']);
  assert.equal(m.run('return V.privacy().includes("旧 token 即刻失效");'),false);
  m=m.reload(); m.exec('privacyCancelDelete();');
  assert.deepEqual(m.run('return [PV.del,S.user,LM.writing.text];'),[null,user,'kept draft']);
});

check('auxiliary page rendering does not mutate its durable business facts', () => {
  const m=createModel();
  const snapshot=()=>m.run('return {S,SUP,SET,AX,PV,RF_ORDERS,LM,MSGS};'); const original=snapshot();
  for (const route of ['support','tdetail','acs','search','privacy','npref','commerce','pay','refund','subs','achieve','world','league','about']) m.exec('V.' + route + '();');
  assert.deepEqual(snapshot(),original);
});

check('a long support submission retains its complete draft without silently truncating or creating a ticket', () => {
  const m=createModel(), before=m.run('return SUP.list.length;');
  m.setField('sup','长'.repeat(41)); m.exec('supSend();');
  assert.deepEqual(m.run('return [SUP.list.length,SUP.draft.length];'),[before,41]);
});

check('a checkout price snapshot survives catalogue changes and an explicit new purchase is a different order', () => {
  const m=createModel(); m.exec('checkoutOpen("g1"); GOODS[0].price=999;'); confirmPayment(m);
  const first=m.run('return PAY.orderId;'); assert.equal(m.run('return RF_ORDERS.find(o=>o.id===PAY.orderId).price;'),19);
  m.exec('checkoutOpen("g1",true);'); confirmPayment(m);
  assert.notEqual(m.run('return PAY.orderId;'),first);
  assert.equal(m.run('return RF_ORDERS.find(o=>o.id===PAY.orderId).price;'),999);
});

check('a stale confirmation cannot submit a different selected product', () => {
  const m=createModel(), before=m.run('return RF_ORDERS.length;'); m.button('stalePay');
  m.exec('checkoutOpen("g1"); payGo(stalePay); checkoutOpen("g3"); payGo(stalePay);');
  assert.deepEqual(m.run('return [PAY.productId,PAY.orderId,RF_ORDERS.length];'),['g3',null,before]);
});

check('an unknown payment cannot be queried offline or acquire rights, renewal changes or invoices prematurely', () => {
  const m=createModel(); m.exec('checkoutOpen("g1"); LAB.unknownNext=true;'); confirmPayment(m);
  m.exec('LAB.offline=true; payResolve(); rfApply(PAY.orderId); rfCancelRenewal(PAY.orderId); rfInv(PAY.orderId,"本地发票");');
  assert.deepEqual(m.run('const o=RF_ORDERS.find(o=>o.id===PAY.orderId);return [o.paymentPhase,o.right,o.rf,o.renewal,o.invoiceStatus];'),['unknown','未开通（本机演示）','无','active','未申请']);
});

check('vocabulary detail appends a new scheduled word without moving the active review indices', () => {
  const m=createModel(); m.exec('SRSQ.splice(0,SRSQ.length,{w:"abandon",zh:"抛弃",done:false,due:lmDate()}); SRS.phase="run"; SRS.order=[0]; SRS.pos=0; VC.w="ability";');
  m.exec('vcAdd(); vcAdd();');
  assert.deepEqual(m.run('return [SRSQ[srsCur()].w,SRS.order,SRSQ.map(q=>q.w)];'),['abandon',[0],['abandon','ability']]);
  m.exec('SRSQ[1].done=true; SRSQ[1].due=lmAddDate(lmDate(),3); vcAdd();');
  assert.equal(m.run('return SRSQ.length;'),2);
  assert.equal(m.run('return V.vocab().includes("已在复习 ✓");'),true);
});

check('vocabulary detail mistakes use stable repair identities and self rating remains unverified', () => {
  const m=createModel(); m.exec('VC.w="ability"; vcMark(false);');
  const id=m.run('return S.mistakes.find(m=>m.t==="ability").id;'); assert.equal(typeof id,'string');
  m.exec('vcMark(true);');
  assert.equal(m.run('return S.mistakes.find(m=>m.id===' + JSON.stringify(id) + ').st;'),'self');
  assert.equal(m.run('return lmStats().total;'),0);
  m.exec('lmMistakeOpen(' + JSON.stringify(id) + '); LM.mistakePick=lmVariant(S.mistakes.find(m=>m.id===' + JSON.stringify(id) + ')).a; lmMistakeCheck();');
  assert.equal(m.run('return S.mistakes.find(m=>m.id===' + JSON.stringify(id) + ').st;'),'wait1');
  assert.equal(m.run('return lmStats().total;'),1);
});

check('timed drill restores a paused question after refresh without a running timer', () => {
  let m=createModel(); m.exec('DR.mode="time"; tchStart(); tchPick(tchOpts().o.findIndex(o=>o.ok)); TCH.sec=47; tchPause("暂停");');
  const before=m.run('return {book:TCH.book,list:TCH.list,pos:TCH.pos,right:TCH.right,wrong:TCH.wrong,sec:TCH.sec};');
  m=m.reload();
  assert.deepEqual(m.run('return {book:TCH.book,list:TCH.list,pos:TCH.pos,right:TCH.right,wrong:TCH.wrong,sec:TCH.sec};'),before);
  assert.deepEqual(m.run('return [TCH.on,TCH.paused,TCH.timer];'),[false,true,0]);
  assert.equal(m.run('return "identity" in LM.timedDrill || "timer" in LM.timedDrill;'),false);
});

check('timed personal best remains bound to its wordbook after refresh and a fresh round', () => {
  let m=createModel(); m.exec('DR.book="CET4"; DR.mode="time"; tchStart(); while(TCH.on) tchPick(tchOpts().o.findIndex(o=>o.ok));');
  const best=m.run('return TCH.bests.CET4;'); assert.equal(best.score,100);
  m=m.reload(); assert.deepEqual(m.run('return TCH.bests.CET4;'),best);
  m.exec('DR.book="CET6"; tchStart();'); assert.equal(m.run('return TCH.best;'),null);
  m.exec('tchPause("换词书"); DR.book="CET4"; tchStart();'); assert.deepEqual(m.run('return TCH.best;'),best);
});

check('stopped listening callbacks cannot change a later playback or append old history', () => {
  const m=createModel(); m.exec('lplay(); lstop(); lplay();');
  assert.equal(m.speeches.length,2); m.speeches[0].onerror(); m.speeches[0].onend();
  assert.deepEqual(m.run('return [LSM.playing,LSM.done,LSM.hist];'),[true,0,[]]);
  m.speeches[1].onend(); assert.deepEqual(m.run('return [LSM.playing,LSM.done,LSM.hist];'),[false,1,['问候']]);
});

check('changing listening material captures the new selection before a stop rerender replaces the element', () => {
  const m=createModel(); m.setField('listening-material','1');
  m.exec('render=()=>{document.getElementById("listening-material").value=String(LSM.cur);dbSave();}; lmListeningSelect();');
  assert.equal(m.run('return LSM.cur;'),1);
});

check('active identity and vocabulary query are displayed literally without markup', () => {
  const m=createModel(); m.exec('S.user="<b>probe</b>"; VC.q="<b>probe</b>";');
  for (const route of ['home','me','league','vocab']) {
    assert.equal(m.run('return V.'+route+'().includes("<b>probe</b>");'),false);
    assert.equal(m.run('return V.'+route+'().includes("&lt;b&gt;probe&lt;/b&gt;");'),true);
  }
});

check('sample reading material avoids random network images and unsupported exam frequency or grade guarantees', () => {
  const m=createModel();
  assert.equal(m.run('return Object.values(CHAP).flat().some(s=>/picsum|十年真题 9 次|B1` 稳了|四级最爱考/.test(s));'),false);
  assert.equal(m.run('return BOOKS.slice(0,6).every(b=>b.intro.includes("原创")&&b.author==="语学星原创样例");'),true);
  m.exec('VC.w="absent";'); assert.equal(m.run('return V.vocab().includes("暂无已核对的例句。");'),true);
  assert.equal(m.run('return V.vocab().includes("仅为记忆联想，不代表已核对词源");'),true);
});

check('a direct plan route rerender advances the day and defers paused work without first visiting home', () => {
  const m=createModel(); m.exec('S.plan=true; startGroup("t1"); prPick(0); LM.offset=1;');
  const oldDate=m.run('return LM.day;'); m.renderActual('#/plan');
  assert.notEqual(m.run('return LM.day;'),oldDate);
  assert.deepEqual(m.run('const task=LM.deferred.find(t=>t.id==="t1");return [LASTR,task.resume.sel,S.today.some(t=>t.id==="t1"),LM.day===lmDate()];'),['plan',0,false,true]);
});

check('leaving the listening route cancels playback and discards its late callbacks', () => {
  const m=createModel(); m.exec('LASTR="listening"; lplay();'); m.renderActual('#/history');
  assert.equal(m.run('return LSM.playing;'),false); m.speeches[0].onend();
  assert.deepEqual(m.run('return [LSM.done,LSM.hist,LASTR];'),[0,[],'history']);
});

check('read-only support and reward preview buttons explain their rules without claiming or writing completed work', () => {
  const m=createModel(); m.exec('var auxToasts=[]; toast=message=>auxToasts.push(message);');
  const before=m.run('return {SUP,LM,WD_ACH};');
  assert.equal(m.run('return V.acs().includes("已接单")||V.rewards().includes("已领取");'),false);
  const support=m.run('return V.acs().match(/onclick="(toast\([^\"]+\))">查看接单说明/)[1];');
  const reward=m.run('return V.rewards().match(/onclick="(toast\([^\"]+\))">查看领取规则/)[1];');
  m.exec(support+';'+reward+';');
  assert.deepEqual(m.run('return {SUP,LM,WD_ACH};'),before);
  assert.equal(m.run('return auxToasts[0].includes("未实际接单")&&auxToasts[1].includes("没有新增奖励入账");'),true);
});

check('motion off and route exit stop avatar frames and greeting including old queued callbacks', () => {
  const m=createModel(); m.setField('t3d');
  m.exec('location.hash="#/avatar"; LASTR="avatar"; var avatarDraws=0; T3={raf:0,waving:0,spin:0,scene:{},cam:{},renderer:{render:()=>avatarDraws++},M:{armR:{rotation:{z:0}},body:{rotation:{y:0}}},tick:avatarTick}; avatarTick(); wave(); a11y("motion");');
  assert.deepEqual(m.run('return [AX.m,T3.raf,T3.waving,AVATAR.greeting];'),[false,0,0,false]);
  assert.equal(m.cancelledFrames.length,1);
  const draws=m.run('return avatarDraws;'); m.fireFrame(0); m.fireTimer(0); m.exec('wave();');
  assert.equal(m.run('return avatarDraws;'),draws);
  assert.equal(m.run('return V.avatar().includes('+JSON.stringify('onclick="wave()" disabled')+');'),true);
  m.exec('AX.m=true; avatarTick();'); m.renderActual('#/history');
  assert.deepEqual(m.run('return [T3.raf,T3.waving,AVATAR.greeting];'),[0,0,false]);
  const leftDraws=m.run('return avatarDraws;'); m.fireFrame(1); assert.equal(m.run('return avatarDraws;'),leftDraws);
});

check('the fifth placement sample supplies its answer in text and contributes to reading rather than unmeasured listening', () => {
  const m=createModel();
  assert.deepEqual(m.run('return [BANK[4].dim,BANK[4].s.includes("After school, they played football"),BANK[4].o[BANK[4].a]];'),['阅读',true,'play football']);
  m.exec('normalizeState(); recordQuiz(4,1);');
  assert.deepEqual(m.run('const reading=repDim().find(d=>d.d==="阅读"),listening=repDim().find(d=>d.d==="听力");return [reading.ok,reading.total,reading.samples,listening.total,listening.samples,listening.pct];'),[1,1,2,0,0,null]);
  assert.equal(m.run('return V.report().includes("听力 未测");'),true);
});

check('a fully skipped placement report stays ungraded and states the actual plan inputs and sample scope', () => {
  const m=createModel(); m.exec('S.quiz={i:0,sel:null,phase:"answer",answers:[],done:false,score:0}; for(let i=0;i<BANK.length;i++){qSkip();qNext();}');
  assert.deepEqual(m.run('return [S.quiz.done,S.quiz.score,repLevel()];'),[true,0,'未定级']);
  assert.equal(m.run('return V.report().includes("A1");'),false);
  for (const phrase of ['未定级','无有效作答','听力 未测','五道固定原创样例','不构成正式 CEFR 等级','按学习目标、每日分钟和学习日模板安排']) assert.equal(m.run('return V.report().includes('+JSON.stringify(phrase)+');'),true);
  assert.equal(m.run('return V.report().includes("今日任务会按这个排");'),false);
});

check('the actual report retry button replaces skipped answers and restores earlier saved answers without double scoring', () => {
  let m=createModel(); m.exec('S.quiz={i:0,sel:null,phase:"answer",answers:[],done:false,score:0}; recordQuiz(0,0); qNext(); qSkip(); qNext(); recordQuiz(2,1); qNext(); qSkip(); qNext(); recordQuiz(4,1); qNext();');
  assert.deepEqual(m.run('return [S.quiz.done,S.quiz.score];'),[true,3]);
  const first=m.run('return S.quiz.answers[0];');
  const retry=m.run('return V.report().match(/onclick="([^"]+)">回样例测评补答/)[1];'); m.exec(retry);
  assert.deepEqual(m.run('return [S.quiz.i,S.quiz.phase,S.quiz.done,location.hash];'),[1,'answer',false,'#/placement']);
  m.exec('pick(1); qSubmit();'); m.fireTimer(0);
  assert.deepEqual(m.run('return [S.quiz.answers[1],S.quiz.score];'),[{sel:1,ok:true},4]);
  m.exec('qNext();');
  assert.deepEqual(m.run('return [S.quiz.i,S.quiz.phase,S.quiz.sel];'),[2,'saved',1]);
  m.exec('qSubmit();'); assert.equal(m.run('return S.quiz.score;'),4); m.exec('qNext();');
  assert.deepEqual(m.run('return [S.quiz.i,S.quiz.phase];'),[3,'answer']);
  m.exec('pick(2); qSubmit();'); m.fireTimer(1);
  m.exec('qNext(); qNext();'); assert.deepEqual(m.run('return [S.quiz.done,S.quiz.score,S.quiz.answers.filter(a=>a?.skip).length];'),[true,4,0]);
  assert.deepEqual(m.run('return S.quiz.answers[0];'),first);
  m=m.reload(); assert.deepEqual(m.run('return [S.quiz.score,repLevel()];'),[4,'B1']);
  assert.equal(m.run('return V.report().includes("样例起步参考");'),true);
});

check('staff and personal support detail buttons select the clicked ticket and return to their own list after refresh', () => {
  let m=createModel(); m.setField('sup','第三条反馈'); m.exec('supSend();');
  const ids=m.run('return SUP.list.map(t=>t.id);');
  for (const index of [1,2]) {
    const action=m.run('return Array.from(V.acs().matchAll(/onclick="(supOpen[^"]+)">详情/g),m=>m[1])['+index+'];');
    m.exec(action); assert.deepEqual(m.run('return [SUP.cur,SUP.from,location.hash];'),[ids[index],'acs','#/tdetail']);
    assert.equal(m.run('return V.tdetail().includes('+JSON.stringify(ids[index])+');'),true);
    assert.equal(m.run('return V.tdetail().includes('+JSON.stringify(ids[0])+');'),false);
  }
  m=m.reload(); assert.deepEqual(m.run('return [SUP.cur,SUP.from];'),[ids[2],'acs']);
  m.exec('supClose();'); assert.equal(m.run('return location.hash;'),'#/acs');
  const personal=m.run('return Array.from(V.support().matchAll(/onclick="(supOpen[^"]+)">查看这张工单/g),m=>m[1])[1];');
  m.exec(personal); assert.deepEqual(m.run('return [SUP.cur,SUP.from];'),[ids[1],'support']);
  m.exec('supClose();'); assert.equal(m.run('return location.hash;'),'#/support');
});

async function completeAsyncChecks() {
  try {
    const m=createModel(), surface=m.setField('t3d'); m.exec('location.hash="#/avatar"; avatarLoadThree=()=>Promise.reject(new Error("offline"));');
    await m.exec('stage3d();');
    assert.equal(surface.innerHTML.includes('<svg'),true);
    assert.equal(surface.innerHTML.includes('3D 不可用'),true);
    m.exec('dress("shirt","#1d9e6b"); dress("hair","cap"); dress("acc","glasses"); dress("wall","#0e3b2e");');
    assert.deepEqual(m.run('return [AVATAR.shirt,AVATAR.hair,AVATAR.acc,AVATAR.wall,T3];'),['#1d9e6b','cap','glasses','#0e3b2e',null]);
    for (const rendered of ['fill="#1d9e6b"','fill="#0e3b2e"','fill="#d64545"','stroke="#111"']) assert.equal(surface.innerHTML.includes(rendered),true);
    m.exec('wave();'); assert.equal(surface.innerHTML.includes('Hi!'),true); m.fireTimer(0); assert.equal(surface.innerHTML.includes('Hi!'),false);
    const before=m.run('return AVATAR;'); m.exec('V.avatar();'); assert.deepEqual(m.run('return AVATAR;'),before);
    passed++; console.log('PASS failed 3D loading provides a real local SVG with all shared wardrobe and greeting actions');
  } catch (error) { failed++; console.error('FAIL failed 3D loading provides a real local SVG with all shared wardrobe and greeting actions\n'+error.message); }
  console.log('Auxiliary model checks: ' + passed + '/' + (passed+failed));
  if (failed) process.exitCode=1;
}

completeAsyncChecks();
