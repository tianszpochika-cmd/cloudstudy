/* Run from repository root: node docs/06-design/v2-980plus/redesign/mockups/webDemo/mobile/qa-flow.cjs
 * Real DOM actions against an existing static preview. No backend operations.
 * Last run is appended as JS comments so evidence stays within the static-demo file boundary.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const QA_FILES = ['index.html','app.js','learning.js','styles.css','legacy.css','../shared/tokens.css','../shared/components.css','mobile-ui.js','../shared/data.js','../shared/preview-data.js','../shared/product-overrides.js','../shared/demo-ui.js',...(['../shared/preview-workflows.js','../shared/catalog-bridge.js'].filter(p=>fs.existsSync(path.resolve(__dirname,p))))];
const sourceSnapshot = () => Object.fromEntries(QA_FILES.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,p))).digest('hex')]));
const QA_WIDTH = 390;
const QA_THEME = process.env.QA_THEME || 'light';
const QA_URL = process.env.STATIC_DEMO_URL || 'http://127.0.0.1:18283/webDemo/mobile/';
(async () => {
 const browser = await chromium.launch({headless:true});
 const page = await browser.newPage({viewport:{width:QA_WIDTH,height:844},isMobile:true,hasTouch:true});
 page.setDefaultTimeout(5000);
 const report={at:new Date().toISOString(),url:QA_URL,surface:'mobile',viewport:QA_WIDTH,theme:QA_THEME,mode:'real DOM click; synthetic facts',sourceHashes:sourceSnapshot(),steps:[],pageErrors:[],externalRequests:[]};
 const evidenceDir=path.resolve('.git/codex-local-backups/mobile-qa-'+Date.now()+'-'+QA_THEME);fs.mkdirSync(evidenceDir,{recursive:true});report.evidenceDir=evidenceDir;
 page.on('pageerror',e=>report.pageErrors.push({message:e.message,stack:e.stack}));
 page.on('request',r=>{if(!new URL(r.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) report.externalRequests.push(r.url());});
 async function step(name,run){try{const facts=await run();const layout=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert(layout.scroll<=390,'390宽度无横向溢出');const screenshot='step-'+String(report.steps.length+1).padStart(2,'0')+'.png';await page.screenshot({path:path.join(evidenceDir,screenshot),fullPage:true});report.steps.push({name,status:'PASS',facts,layout,screenshot});}catch(e){report.steps.push({name,status:'FAIL',error:e.message,route:await page.locator('#view').getAttribute('data-route'),visibleText:(await page.locator('#view').innerText()).slice(0,1800)});throw e;}}
 async function route(){return page.locator('#view').getAttribute('data-route');}
 async function open(r){await page.getByRole('button',{name:'演示控制',exact:true}).click();await page.locator('#demo-route').selectOption(r);await page.locator('#demo-state').selectOption('normal');await page.locator('#demo-theme').selectOption(QA_THEME);await page.getByRole('button',{name:'应用设置',exact:true}).click();await page.waitForFunction(r=>document.getElementById('view').dataset.route===r,r);await page.waitForTimeout(80);}
 const click = name => page.locator('#view').getByRole('button',{name,exact:true}).click();
 try {
 await page.goto(QA_URL);
 report.loadedScripts=await page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')));
 await open('home');
 await step('注册：错误校验与受限身份',async()=>{await open('register');await page.locator('#ri').fill('mobile-chain@test.invalid');await page.locator('#rp').fill('short1');await click('创建档案并继续');assert.equal(await page.locator('#rp').getAttribute('aria-invalid'),'true');await page.locator('#rp').fill('SyntheticDesk123');await click('创建档案并继续');await page.waitForFunction(()=>document.getElementById('view').dataset.route==='gate');const f=await page.evaluate(()=>({user:S.user,gate:S.gate,consents:Object.values(S.consents).filter(x=>x.agreed).length}));assert.equal(f.gate,'PENDING');assert.equal(f.consents,0);return f;});
 await step('成人门与三项主动同意',async()=>{await page.locator('#by').fill('2000');await page.locator('#cf').check();await click('确认成年人状态');assert.equal(await page.evaluate(()=>S.gate),'PASS');const boxes=page.locator('.ag');assert.equal(await boxes.count(),3);for(let i=0;i<3;i++){assert.equal(await boxes.nth(i).isChecked(),false);await boxes.nth(i).check();}await click('签署并选择学习目标');await page.waitForFunction(()=>document.getElementById('view').dataset.route==='onboard');return {gate:await page.evaluate(()=>S.gate),consents:await page.evaluate(()=>Object.values(S.consents).filter(x=>x.agreed).length)};});
 await step('目标预览与保存',async()=>{await page.locator('#lg').selectOption('college');await page.locator('#lminutes').selectOption('45');await click('预览学习安排');assert.equal(await page.evaluate(()=>!!LM.planPreview),true);await click('保存目标');await page.waitForFunction(()=>document.getElementById('view').dataset.route==='firstlearn');return await page.evaluate(()=>({goal:LM.plan.goal,minutes:LM.plan.minutes}));});
 await step('定级五题实际提交与报告',async()=>{await click('先做样例测评');for(let i=0;i<5;i++){const a=await page.evaluate(()=>BANK[S.quiz.i].a);await page.locator(`#qo button[data-k="${a}"]`).click();await click('提交');await page.waitForFunction(()=>S.quiz.phase==='saved');await page.locator('#view button[onclick="qNext()"]').click();}await page.waitForFunction(()=>document.getElementById('view').dataset.route==='report');const facts=await page.evaluate(()=>({done:S.quiz.done,answers:S.quiz.answers.length,score:S.quiz.score}));assert.equal(facts.answers,5);assert.equal(facts.score,5);assert.equal(facts.done,true);return facts;});
 await step('真实生成今日计划',async()=>{await click('查看我的计划');await click('生成今日计划');await page.waitForFunction(()=>PG.st==='ok');await open('today');const f=await page.evaluate(()=>({plan:S.plan,tasks:S.today.map(t=>({id:t.id,title:t.t,group:t.group}))}));assert.equal(f.plan,true);assert(f.tasks.length>0);return f;});
 let wrongStem;
 await step('练习：首题错答、其余答对、独立结果',async()=>{const task=await page.evaluate(()=>S.today.find(t=>t.group&&GROUPS[t.group]?.kind==='grammar')||S.today.find(t=>t.group));assert(task,'有可练题组');await page.locator(`#view button[onclick="lmOpenTask('${task.id}')"]`).click();const count=await page.evaluate(()=>prGroup().items.length);for(let i=0;i<count;i++){const q=await page.evaluate(()=>({s:prGroup().items[PR.pos].s,a:prGroup().items[PR.pos].a,n:prGroup().items[PR.pos].o.length}));if(i===0)wrongStem=q.s;const selected=i===0?(q.a+1)%q.n:q.a;await page.locator(`#view button[onclick="prPick(${selected})"]`).click();await click('提交答案');await page.waitForFunction(()=>PR.phase==='saved');await page.locator('#view button[onclick="prNext()"]').click();}const f=await page.evaluate(()=>({phase:PR.phase,record:LM.records.find(r=>r.id===PR.resultId),mistakes:S.mistakes.map(m=>({id:m.id,t:m.t,st:m.st}))}));assert.equal(f.phase,'result');assert.equal(f.record.total,count);assert.equal(f.record.right,count-1);assert(f.mistakes.some(m=>m.t===wrongStem));return {phase:f.phase,resultId:f.record.id,right:f.record.right,total:f.record.total,mistakes:f.mistakes.length};});
 await step('错题匹配变式→修复→延期验证',async()=>{await click('错题补救');const m=await page.evaluate(stem=>S.mistakes.find(m=>m.t===stem),wrongStem);await page.locator(`#view button[onclick="lmMistakeOpen('${m.id}')"]`).click();const a=await page.evaluate(()=>lmVariant(S.mistakes.find(m=>m.id===LM.mistakeId)).a);await page.locator(`#view button[onclick="lmMistakePick(${a})"]`).click();await click('检查答案');const f=await page.evaluate(()=>{const m=S.mistakes.find(m=>m.id===LM.mistakeId);return {state:m.st,due:m.due,feedback:LM.mistakeFeedback.ok,repairs:LM.records.filter(r=>r.kind==='repair').length}});assert.equal(f.state,'wait1');assert.equal(f.feedback,true);assert(f.due>await page.evaluate(()=>lmDate()));assert.equal(await page.locator('#view button[onclick="lmMistakeCheck()"]').isDisabled(),true);return f;});
 await step('日报与周报读回实际结果',async()=>{await open('recap');assert((await page.locator('#view').innerText()).includes('学习结果'));const f=await page.evaluate(()=>({date:lmDate(),records:lmStats().count,right:lmStats().right,total:lmStats().total,xp:lmStats().xp}));assert(f.records>=2);assert(f.total>0);await open('weekly');assert((await page.locator('#view').innerText()).includes('本周回顾'));return f;});
 await step('书架→图书→章节：笔记、刷新、完成',async()=>{await open('shelf');await page.locator('#view button[onclick="lmCourseOpen(\'b1\')"]').click();await page.waitForFunction(()=>document.getElementById('view').dataset.route==='book');await page.locator('#view button[onclick="openChapter(\'b1\',0)"]').click();await page.locator('#chapter-note').fill('读完后核对原文证据，不增加原文没有的结论。');await page.reload();assert.equal(await page.locator('#chapter-note').inputValue(),'读完后核对原文证据，不增加原文没有的结论。');await click('完成本节');const f=await page.evaluate(()=>({chapter:LM.chapters['b1:0'],records:LM.records.filter(r=>r.kind==='chapter').length}));assert.equal(f.chapter.done,true);assert(f.records>=1);return f;});

 await step('词汇：搜索、词义答题、加入复习与三词任务',async()=>{await open('words');await page.locator('#word-query').fill('abandon');await click('查找');await page.locator('#view button[onclick="lmWordOpen(\'abandon\')"]').click();const a=await page.evaluate(()=>vcQuizOpts().opts.findIndex(o=>o.ok));await page.locator('#view button[onclick="vcQuiz('+a+')"]').click();assert((await page.locator('#view').innerText()).includes('对了'));await page.locator('#view button[onclick="vcAdd()"]').click();assert(await page.evaluate(()=>SRSQ.some(q=>q.w==='abandon')));await open('today');const task=await page.evaluate(()=>S.today.find(t=>t.kind==='words'&&!t.done));assert(task);await page.locator('#view button[onclick="lmOpenTask(\''+task.id+'\')"]').click();for(let i=0;i<3;i++){await click('点看中文');await page.locator('#view button[onclick^="drNextWord(true,"]').click();}const f=await page.evaluate(()=>({closed:LM.wordClosed,wordRecords:LM.records.filter(r=>r.kind==='words').length,seen:LM.records.filter(r=>r.kind==='words').at(-1)?.answers.length,reviewWords:SRSQ.length}));assert(f.closed);assert(f.wordRecords>=1);assert.equal(f.seen,3);await page.waitForFunction(()=>document.getElementById('view').dataset.route==='result');return f;});
 await step('写作：不足格式反馈→修改草稿→保存结果',async()=>{await open('courses');await page.locator('#view button[onclick="lmOpenWriting()"]').click();await page.locator('#writing-draft').fill('Dear Sam, hello. Best wishes.');await click('检查并提交');await click('确认提交');await page.waitForFunction(()=>LM.writing.phase==='result');assert.equal(await page.evaluate(()=>LM.records.find(r=>r.id===LM.writing.resultId).accepted),false);await click('修改后再提交');await page.locator('#writing-draft').fill('Dear Sam, I would like to study English with you this weekend. We can meet at the library on Saturday morning. I plan to read a short story and learn some new words. After lunch, we can write a letter together and check our sentences. Please tell me if you are free. Best wishes, Alex');await click('检查并提交');await click('确认提交');await page.waitForFunction(()=>LM.writing.phase==='result');const f=await page.evaluate(()=>{const r=LM.records.find(r=>r.id===LM.writing.resultId);return {accepted:r.accepted,count:r.count,writingRecords:LM.records.filter(r=>r.kind==='writing').length}});assert(f.accepted);assert(f.count>=40&&f.count<=100);return f;});
 await step('听力：字幕切换、两道材料理解与记录',async()=>{await open('listening');await click('播放材料');const playback=await page.evaluate(()=>({playing:LSM.playing,status:LSM.status||null}));await page.locator('#view button[onclick="lsub()"]').click();const sub=await page.evaluate(()=>LSM.showSub);await page.locator('#view button[onclick="lsub()"]').click();assert.equal(await page.evaluate(()=>LSM.showSub),!sub);const answers=await page.evaluate(()=>{const m=LSM.mats[LSM.cur];return [m.q.a,m.q2.a]});await page.locator('#view button[onclick="lquizPick('+answers[0]+')"]').click();await page.locator('#view button[onclick="LSM.quizPick2='+answers[1]+';render()"]').click();await click('保存本次理解结果');const f=await page.evaluate(()=>{const r=LM.records.find(r=>r.id===LM.listeningResult);return {id:r.id,right:r.right,total:r.total}});assert.equal(f.right,2);assert.equal(f.total,2);return {...f,playbackAttempt:playback,audibilityVerified:false};});
 await step('设备撤销与刷新保持当前身份',async()=>{await open('devices');await page.locator('#view button[onclick="uiDeviceRevoke(\'phone\')"]').click();await page.locator('dialog[open]').getByRole('button',{name:'确认',exact:true}).click();await page.reload();const f=await page.evaluate(()=>({phone:UI_FACTS.devices.find(d=>d.id==='phone').active,current:UI_FACTS.devices.find(d=>d.current).active,user:S.user}));assert.equal(f.phone,false);assert.equal(f.current,true);assert(f.user);return f;});

 await step('学习世界：加入/退出小组与游戏结算',async()=>{await open('world');await page.locator('#view button').filter({hasText:/^加入$/}).first().click();const joined=await page.evaluate(()=>UI_FACTS.room);assert(joined);await page.locator('#view button').filter({hasText:/^退出$/}).click();assert.equal(await page.evaluate(()=>UI_FACTS.room),null);await click('词义寻宝');await click('开始寻宝');for(let i=0;i<5;i++)await page.locator('#view button[onclick="uiGameAnswer(0)"]').click();const f=await page.evaluate(()=>({...UI_FACTS.game}));assert.equal(f.index,5);assert.equal(f.score,5);return f;});
 await step('设置主题与同意撤回后资格限制',async()=>{await open('settings');await click('深色');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await click('隐私设置 ›');await page.locator('#view button[onclick="uiWithdraw(\'ADULT_LEARNING\')"]').click();await page.locator('dialog[open]').getByRole('button',{name:'确认',exact:true}).click();assert.equal(await page.evaluate(()=>S.consents.ADULT_LEARNING.agreed),false);await page.getByRole('button',{name:'演示控制',exact:true}).click();await page.locator('#demo-route').selectOption('today');await page.getByRole('button',{name:'应用设置',exact:true}).click();await page.waitForFunction(()=>document.getElementById('view').dataset.route==='gate');return {theme:await page.locator('html').getAttribute('data-theme'),revoked:true,learningBlocked:await route()};});
 await step('撤回后仍可提交本人客服工单',async()=>{await open('support');const before=await page.evaluate(()=>SUP.list.length);await page.locator('#sup').fill('请说明撤回学习同意后如何恢复。');await click('提交工单');const f=await page.evaluate(()=>({count:SUP.list.length,ticket:SUP.list[0],draft:SUP.draft}));assert.equal(f.count,before+1);assert.equal(f.draft,'');assert.equal(f.ticket.st,'已提交');return f;});
 await step('退出→再次登录保留撤回事实',async()=>{await open('settings');await click('退出登录');await page.getByRole('button',{name:'再点一次确认',exact:true}).click();await page.waitForFunction(()=>document.getElementById('view').dataset.route==='login');assert.equal(await page.evaluate(()=>S.user),null);await page.locator('#li').fill('mobile-chain@test.invalid');await page.locator('#lp').fill('SyntheticDesk123');await click('进入学习档案');await page.waitForFunction(()=>document.getElementById('view').dataset.route==='gate');const f=await page.evaluate(()=>({user:S.user,withdrawn:!S.consents.ADULT_LEARNING.agreed,records:LM.records.length,tickets:SUP.list.length}));assert.equal(f.withdrawn,true);assert(f.records>0);assert(f.tickets>0);return f;});
 assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.externalRequests,[]);report.status='PASS';
 }catch(e){report.status='FAIL';report.lastError=e.message;}
 report.sourceDrift=Object.entries(sourceSnapshot()).filter(([p,h])=>report.sourceHashes[p]!==h).map(([p])=>p);if(report.sourceDrift.length)report.status='PARTIAL_SOURCE_DRIFT';
 await page.screenshot({path:path.join(evidenceDir,'final-page.png'),fullPage:true});fs.writeFileSync(path.join(evidenceDir,'report.json'),JSON.stringify(report,null,2));report.evidenceDir=evidenceDir;
 await browser.close();const marker='// LAST_RUN_RESULT';let source=fs.readFileSync(__filename,'utf8');source=source.split('\n'+marker)[0];fs.writeFileSync(__filename,source+'\n'+marker+'\n'+JSON.stringify(report,null,2).split('\n').map(l=>'// '+l).join('\n')+'\n');console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

// VERIFIED_LIGHT_RUN_20261011
// {
//   "at": "2026-10-11T09:58:15.348Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "light",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "1e76049f25fd712a44a6b1b9e37d4c52ed3679178fded25ac11a6cbf4863e502",
//     "app.js": "3c549284fff74dac524eee66a0e36225a2f7bb4b3f66880099f60e5491b8f6c5",
//     "learning.js": "59b60a02e05a0206f4f00d68c0cb39107bf5985f209852a494c5f01b1f51a99e",
//     "styles.css": "e404fec537f8bb6522fe15ee8f453e6ab0736fcfafaa0d8e7e5dc10c2426c64f",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "9924d1d3946d672b8b0885a1ce4fff458781faeaed4c0ba504a90559b08e9fc7",
//     "../shared/product-overrides.js": "1e5dfc1ce4db632d7b93caaa5daabf5172e75165c96e623d334a140be47089e5",
//     "../shared/demo-ui.js": "4216335d82bc6fbbaaa519150cc4cb5a396d1533a7a0667389d5c619146a2597",
//     "../shared/preview-workflows.js": "20cec16f7d58229c623c1de48e2b31582073bb9556c6e4c82537e8df9633e31b"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       }
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       }
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       }
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       }
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       }
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       }
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-12",
//         "feedback": true,
//         "repairs": 1
//       }
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-11",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       }
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-11",
//           "recordId": "record-11"
//         },
//         "records": 1
//       }
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       }
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       }
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       }
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       }
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       }
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       }
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       }
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       }
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "status": "PASS",
//   "sourceDrift": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\mobile-qa-1791712719559-light"
// }

// VERIFIED_DARK_BEFORE_PREVIEW_20261011
// {
//   "at": "2026-10-11T09:59:28.998Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "dark",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "1e76049f25fd712a44a6b1b9e37d4c52ed3679178fded25ac11a6cbf4863e502",
//     "app.js": "3c549284fff74dac524eee66a0e36225a2f7bb4b3f66880099f60e5491b8f6c5",
//     "learning.js": "59b60a02e05a0206f4f00d68c0cb39107bf5985f209852a494c5f01b1f51a99e",
//     "styles.css": "e404fec537f8bb6522fe15ee8f453e6ab0736fcfafaa0d8e7e5dc10c2426c64f",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "9924d1d3946d672b8b0885a1ce4fff458781faeaed4c0ba504a90559b08e9fc7",
//     "../shared/product-overrides.js": "1e5dfc1ce4db632d7b93caaa5daabf5172e75165c96e623d334a140be47089e5",
//     "../shared/demo-ui.js": "4216335d82bc6fbbaaa519150cc4cb5a396d1533a7a0667389d5c619146a2597",
//     "../shared/preview-workflows.js": "20cec16f7d58229c623c1de48e2b31582073bb9556c6e4c82537e8df9633e31b"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-01.png"
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-02.png"
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-03.png"
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-04.png"
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-05.png"
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-06.png"
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-12",
//         "feedback": true,
//         "repairs": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-07.png"
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-11",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-08.png"
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-11",
//           "recordId": "record-11"
//         },
//         "records": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-09.png"
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-10.png"
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-13.png"
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-14.png"
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-15.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-16.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-17.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\mobile-qa-1791712769000-dark",
//   "status": "PASS",
//   "sourceDrift": []
// }

// DIAGNOSTIC_PREVIEW_LOAD_20261011
// {
//   "at": "2026-10-11T10:02:33.583Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "light",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "f448ba5bf31d1c19a0d724939b5976ae0e09e67c4a94ae020c2b9c4da0017765",
//     "app.js": "3c549284fff74dac524eee66a0e36225a2f7bb4b3f66880099f60e5491b8f6c5",
//     "learning.js": "59b60a02e05a0206f4f00d68c0cb39107bf5985f209852a494c5f01b1f51a99e",
//     "styles.css": "e404fec537f8bb6522fe15ee8f453e6ab0736fcfafaa0d8e7e5dc10c2426c64f",
//     "legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "9924d1d3946d672b8b0885a1ce4fff458781faeaed4c0ba504a90559b08e9fc7",
//     "../shared/product-overrides.js": "1e5dfc1ce4db632d7b93caaa5daabf5172e75165c96e623d334a140be47089e5",
//     "../shared/demo-ui.js": "7dc23a02508f6116bce1aae046494b0e8af20e44e4500c835aaa204020ae365d",
//     "../shared/preview-workflows.js": "bcc183e85fbbcf9f6bcfa7148da76c44d569ea9a6d6baf89d5c135155455330a"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-01.png"
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-02.png"
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-03.png"
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-04.png"
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-05.png"
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-06.png"
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-12",
//         "feedback": true,
//         "repairs": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-07.png"
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-11",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-08.png"
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-11",
//           "recordId": "record-11"
//         },
//         "records": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-09.png"
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-10.png"
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-13.png"
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-14.png"
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-15.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-16.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-17.png"
//     }
//   ],
//   "pageErrors": [
//     "Invalid or unexpected token",
//     "Invalid or unexpected token"
//   ],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\mobile-qa-1791712953585-light",
//   "loadedScripts": [
//     "../shared/data.js",
//     "app.js",
//     "learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "mobile-ui.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "FAIL",
//   "lastError": "Expected values to be strictly deep-equal:\n+ actual - expected\n\n+ [\n+   'Invalid or unexpected token',\n+   'Invalid or unexpected token'\n+ ]\n- []",
//   "sourceDrift": []
// }

// VERIFIED_LIGHT_WITH_PREVIEW_20261011
// {
//   "at": "2026-10-11T10:03:37.899Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "light",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "f448ba5bf31d1c19a0d724939b5976ae0e09e67c4a94ae020c2b9c4da0017765",
//     "app.js": "3c549284fff74dac524eee66a0e36225a2f7bb4b3f66880099f60e5491b8f6c5",
//     "learning.js": "59b60a02e05a0206f4f00d68c0cb39107bf5985f209852a494c5f01b1f51a99e",
//     "styles.css": "e404fec537f8bb6522fe15ee8f453e6ab0736fcfafaa0d8e7e5dc10c2426c64f",
//     "legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "9924d1d3946d672b8b0885a1ce4fff458781faeaed4c0ba504a90559b08e9fc7",
//     "../shared/product-overrides.js": "1e5dfc1ce4db632d7b93caaa5daabf5172e75165c96e623d334a140be47089e5",
//     "../shared/demo-ui.js": "7dc23a02508f6116bce1aae046494b0e8af20e44e4500c835aaa204020ae365d",
//     "../shared/preview-workflows.js": "2a30567793cf8b1c4259c90ccf2da579e9834458cf89f4269f7e12c3940a0cff",
//     "../shared/catalog-bridge.js": "b21c3de381f94233f8c2846fbde648a4a4863e4a724a305887c5fde1dde78f06"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-01.png"
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-02.png"
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-03.png"
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-04.png"
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-05.png"
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-06.png"
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-12",
//         "feedback": true,
//         "repairs": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-07.png"
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-11",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-08.png"
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-11",
//           "recordId": "record-11"
//         },
//         "records": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-09.png"
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-10.png"
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-13.png"
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-14.png"
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-15.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-16.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-17.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\mobile-qa-1791713017901-light",
//   "loadedScripts": [
//     "../shared/data.js",
//     "app.js",
//     "learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "mobile-ui.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// DIAGNOSTIC_DARK_SOURCE_DRIFT_20261011
// {
//   "at": "2026-10-11T10:04:18.333Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "dark",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "f448ba5bf31d1c19a0d724939b5976ae0e09e67c4a94ae020c2b9c4da0017765",
//     "app.js": "3c549284fff74dac524eee66a0e36225a2f7bb4b3f66880099f60e5491b8f6c5",
//     "learning.js": "59b60a02e05a0206f4f00d68c0cb39107bf5985f209852a494c5f01b1f51a99e",
//     "styles.css": "e404fec537f8bb6522fe15ee8f453e6ab0736fcfafaa0d8e7e5dc10c2426c64f",
//     "legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "9924d1d3946d672b8b0885a1ce4fff458781faeaed4c0ba504a90559b08e9fc7",
//     "../shared/product-overrides.js": "1e5dfc1ce4db632d7b93caaa5daabf5172e75165c96e623d334a140be47089e5",
//     "../shared/demo-ui.js": "7dc23a02508f6116bce1aae046494b0e8af20e44e4500c835aaa204020ae365d",
//     "../shared/preview-workflows.js": "2a30567793cf8b1c4259c90ccf2da579e9834458cf89f4269f7e12c3940a0cff",
//     "../shared/catalog-bridge.js": "b21c3de381f94233f8c2846fbde648a4a4863e4a724a305887c5fde1dde78f06"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-01.png"
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-02.png"
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-03.png"
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-04.png"
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-05.png"
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-06.png"
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-12",
//         "feedback": true,
//         "repairs": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-07.png"
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-11",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-08.png"
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-11",
//           "recordId": "record-11"
//         },
//         "records": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-09.png"
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-10.png"
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-13.png"
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-14.png"
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-15.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-16.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-17.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\mobile-qa-1791713058335-dark",
//   "loadedScripts": [
//     "../shared/data.js",
//     "app.js",
//     "learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "mobile-ui.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PARTIAL_SOURCE_DRIFT",
//   "sourceDrift": [
//     "../shared/preview-workflows.js"
//   ]
// }

// DIAGNOSTIC_DARK_SOURCE_DRIFT2_20261011
// {
//   "at": "2026-10-11T10:05:12.068Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "dark",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "f448ba5bf31d1c19a0d724939b5976ae0e09e67c4a94ae020c2b9c4da0017765",
//     "app.js": "3c549284fff74dac524eee66a0e36225a2f7bb4b3f66880099f60e5491b8f6c5",
//     "learning.js": "59b60a02e05a0206f4f00d68c0cb39107bf5985f209852a494c5f01b1f51a99e",
//     "styles.css": "e404fec537f8bb6522fe15ee8f453e6ab0736fcfafaa0d8e7e5dc10c2426c64f",
//     "legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "9924d1d3946d672b8b0885a1ce4fff458781faeaed4c0ba504a90559b08e9fc7",
//     "../shared/product-overrides.js": "1e5dfc1ce4db632d7b93caaa5daabf5172e75165c96e623d334a140be47089e5",
//     "../shared/demo-ui.js": "7dc23a02508f6116bce1aae046494b0e8af20e44e4500c835aaa204020ae365d",
//     "../shared/preview-workflows.js": "153f0eabd98fccfbeabe9e12efd08b299f1a789d0d2647966f90584426a2876e",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-01.png"
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-02.png"
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-03.png"
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-04.png"
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-05.png"
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-06.png"
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-12",
//         "feedback": true,
//         "repairs": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-07.png"
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-11",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-08.png"
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-11",
//           "recordId": "record-11"
//         },
//         "records": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-09.png"
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-10.png"
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-13.png"
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-14.png"
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-15.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-16.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-17.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\mobile-qa-1791713112070-dark",
//   "loadedScripts": [
//     "../shared/data.js",
//     "app.js",
//     "learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "mobile-ui.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PARTIAL_SOURCE_DRIFT",
//   "sourceDrift": [
//     "../shared/preview-workflows.js"
//   ]
// }

// FINAL_LIGHT_20261011
// {
//   "at": "2026-10-11T10:09:28.662Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "light",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "f448ba5bf31d1c19a0d724939b5976ae0e09e67c4a94ae020c2b9c4da0017765",
//     "app.js": "a97381491928f601bf3f4455232e688cbbb82fd86f8dd69f2778ee8bedaa1f86",
//     "learning.js": "793cbad8afcaa1da1d16835deb573851d196d70ab75ac5a639271f4b436d2465",
//     "styles.css": "506624ff08a6512320bf434a0cc38fea553f941bd60009eae9f7b26341673b62",
//     "legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "8573e3a9e0bb77dcbe30e32168a88bc82f258bdd37d3cb4057184f4dea7a6a6f",
//     "../shared/product-overrides.js": "1e5dfc1ce4db632d7b93caaa5daabf5172e75165c96e623d334a140be47089e5",
//     "../shared/demo-ui.js": "ae66a78d4d53fc394c307012e1ada373b7aaee04a52b1dfe647ce3aa528f5c3c",
//     "../shared/preview-workflows.js": "706e945b6d8f288e4387770a6dd31cdb7f456c6f4be9506923bd52f0abaa5d0a",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-01.png"
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-02.png"
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-03.png"
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-04.png"
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-05.png"
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-06.png"
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-12",
//         "feedback": true,
//         "repairs": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-07.png"
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-11",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-08.png"
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-11",
//           "recordId": "record-11"
//         },
//         "records": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-09.png"
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-10.png"
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-13.png"
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-14.png"
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-15.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-16.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-17.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\mobile-qa-1791713368664-light",
//   "loadedScripts": [
//     "../shared/data.js",
//     "app.js",
//     "learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "mobile-ui.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// PRIOR_FINAL_DARK_20261011
// {
//   "at": "2026-10-11T10:10:04.485Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "dark",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "f448ba5bf31d1c19a0d724939b5976ae0e09e67c4a94ae020c2b9c4da0017765",
//     "app.js": "a97381491928f601bf3f4455232e688cbbb82fd86f8dd69f2778ee8bedaa1f86",
//     "learning.js": "793cbad8afcaa1da1d16835deb573851d196d70ab75ac5a639271f4b436d2465",
//     "styles.css": "506624ff08a6512320bf434a0cc38fea553f941bd60009eae9f7b26341673b62",
//     "legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "8573e3a9e0bb77dcbe30e32168a88bc82f258bdd37d3cb4057184f4dea7a6a6f",
//     "../shared/product-overrides.js": "1e5dfc1ce4db632d7b93caaa5daabf5172e75165c96e623d334a140be47089e5",
//     "../shared/demo-ui.js": "ae66a78d4d53fc394c307012e1ada373b7aaee04a52b1dfe647ce3aa528f5c3c",
//     "../shared/preview-workflows.js": "706e945b6d8f288e4387770a6dd31cdb7f456c6f4be9506923bd52f0abaa5d0a",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-01.png"
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-02.png"
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-03.png"
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-04.png"
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-05.png"
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-06.png"
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-12",
//         "feedback": true,
//         "repairs": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-07.png"
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-11",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-08.png"
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-11",
//           "recordId": "record-11"
//         },
//         "records": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-09.png"
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-10.png"
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-13.png"
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-14.png"
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-15.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-16.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-17.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\mobile-qa-1791713404487-dark",
//   "loadedScripts": [
//     "../shared/data.js",
//     "app.js",
//     "learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "mobile-ui.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// FINAL_FROZEN_LIGHT_20261011
// {
//   "at": "2026-10-11T10:38:20.966Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "light",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "4849fd65fafa81dac04fba35cd5052617c51b49b1f228840d899530f8b08ee17",
//     "app.js": "cd9b9a187bfd692095c54bd76ad6a890fd54621a1ad9352921cd7f8785e33766",
//     "learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "styles.css": "506624ff08a6512320bf434a0cc38fea553f941bd60009eae9f7b26341673b62",
//     "legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "4e6a82f5f3cbe73f825a66ba3c6bc23830b22e487941ba588538a4d96a3a5520",
//     "../shared/product-overrides.js": "12bc186f0321864451be503f78c8c31d2a43c2ab1d6c475ff51f12d10f13aadf",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../shared/preview-workflows.js": "f0855dcccc53a97a31dc9de55510375381a958b29b413c2cc62b4aa24099b4a4",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-01.png"
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-02.png"
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-03.png"
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-04.png"
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-05.png"
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-06.png"
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-12",
//         "feedback": true,
//         "repairs": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-07.png"
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-11",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-08.png"
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-11",
//           "recordId": "record-11"
//         },
//         "records": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-09.png"
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-10.png"
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-13.png"
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-14.png"
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-15.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-16.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-17.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\mobile-qa-1791715100969-light",
//   "loadedScripts": [
//     "../shared/data.js",
//     "app.js",
//     "learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "mobile-ui.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// PRIOR_FROZEN_DARK_20261011
// {
//   "at": "2026-10-11T10:38:57.348Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "dark",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "4849fd65fafa81dac04fba35cd5052617c51b49b1f228840d899530f8b08ee17",
//     "app.js": "cd9b9a187bfd692095c54bd76ad6a890fd54621a1ad9352921cd7f8785e33766",
//     "learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "styles.css": "506624ff08a6512320bf434a0cc38fea553f941bd60009eae9f7b26341673b62",
//     "legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "4e6a82f5f3cbe73f825a66ba3c6bc23830b22e487941ba588538a4d96a3a5520",
//     "../shared/product-overrides.js": "12bc186f0321864451be503f78c8c31d2a43c2ab1d6c475ff51f12d10f13aadf",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../shared/preview-workflows.js": "f0855dcccc53a97a31dc9de55510375381a958b29b413c2cc62b4aa24099b4a4",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-01.png"
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-02.png"
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-03.png"
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-04.png"
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-05.png"
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-06.png"
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-12",
//         "feedback": true,
//         "repairs": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-07.png"
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-11",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-08.png"
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-11",
//           "recordId": "record-11"
//         },
//         "records": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-09.png"
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-10.png"
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-13.png"
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-14.png"
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-15.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-16.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-17.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\mobile-qa-1791715137350-dark",
//   "loadedScripts": [
//     "../shared/data.js",
//     "app.js",
//     "learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "mobile-ui.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// FINAL_DRAFT_LIGHT_20261011
// {
//   "at": "2026-10-11T10:44:52.078Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "light",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "4849fd65fafa81dac04fba35cd5052617c51b49b1f228840d899530f8b08ee17",
//     "app.js": "cd9b9a187bfd692095c54bd76ad6a890fd54621a1ad9352921cd7f8785e33766",
//     "learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "styles.css": "506624ff08a6512320bf434a0cc38fea553f941bd60009eae9f7b26341673b62",
//     "legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "4e6a82f5f3cbe73f825a66ba3c6bc23830b22e487941ba588538a4d96a3a5520",
//     "../shared/product-overrides.js": "eabaadfe7fd43518e63c175a3bc755bccb92a3fef649d32568fb5f00c11eae9a",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../shared/preview-workflows.js": "f0855dcccc53a97a31dc9de55510375381a958b29b413c2cc62b4aa24099b4a4",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-01.png"
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-02.png"
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-03.png"
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-04.png"
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-05.png"
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-06.png"
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-12",
//         "feedback": true,
//         "repairs": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-07.png"
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-11",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-08.png"
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-11",
//           "recordId": "record-11"
//         },
//         "records": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-09.png"
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-10.png"
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-13.png"
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-14.png"
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-15.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-16.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-17.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\mobile-qa-1791715492080-light",
//   "loadedScripts": [
//     "../shared/data.js",
//     "app.js",
//     "learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "mobile-ui.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// PRIOR_DRAFT_DARK_20261011
// {
//   "at": "2026-10-11T10:45:35.961Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "dark",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "4849fd65fafa81dac04fba35cd5052617c51b49b1f228840d899530f8b08ee17",
//     "app.js": "cd9b9a187bfd692095c54bd76ad6a890fd54621a1ad9352921cd7f8785e33766",
//     "learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "styles.css": "506624ff08a6512320bf434a0cc38fea553f941bd60009eae9f7b26341673b62",
//     "legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "4e6a82f5f3cbe73f825a66ba3c6bc23830b22e487941ba588538a4d96a3a5520",
//     "../shared/product-overrides.js": "eabaadfe7fd43518e63c175a3bc755bccb92a3fef649d32568fb5f00c11eae9a",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../shared/preview-workflows.js": "f0855dcccc53a97a31dc9de55510375381a958b29b413c2cc62b4aa24099b4a4",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-01.png"
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-02.png"
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-03.png"
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-04.png"
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-05.png"
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-06.png"
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-12",
//         "feedback": true,
//         "repairs": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-07.png"
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-11",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-08.png"
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-11",
//           "recordId": "record-11"
//         },
//         "records": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-09.png"
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-10.png"
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-13.png"
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-14.png"
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-15.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-16.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-17.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\mobile-qa-1791715535963-dark",
//   "loadedScripts": [
//     "../shared/data.js",
//     "app.js",
//     "learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "mobile-ui.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// FINAL_RELEASE_LIGHT_20261011
// {
//   "at": "2026-10-11T10:52:10.076Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "light",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "4849fd65fafa81dac04fba35cd5052617c51b49b1f228840d899530f8b08ee17",
//     "app.js": "1b9e175d34933ccd82164d89e4fbd2b6901dcfc21d220874987a3bd97c7116f4",
//     "learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "styles.css": "506624ff08a6512320bf434a0cc38fea553f941bd60009eae9f7b26341673b62",
//     "legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "4e6a82f5f3cbe73f825a66ba3c6bc23830b22e487941ba588538a4d96a3a5520",
//     "../shared/product-overrides.js": "eabaadfe7fd43518e63c175a3bc755bccb92a3fef649d32568fb5f00c11eae9a",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../shared/preview-workflows.js": "936eb604e0f75e587c3bc09492adfdbabdd8101a6444c06498fa152e865bf5cf",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-01.png"
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-02.png"
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-03.png"
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-04.png"
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-05.png"
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-06.png"
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-12",
//         "feedback": true,
//         "repairs": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-07.png"
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-11",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-08.png"
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-11",
//           "recordId": "record-11"
//         },
//         "records": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-09.png"
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-10.png"
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-13.png"
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-14.png"
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-15.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-16.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-17.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\mobile-qa-1791715930079-light",
//   "loadedScripts": [
//     "../shared/data.js",
//     "app.js",
//     "learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "mobile-ui.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// PRIOR_RELEASE_DARK_20261011
// {
//   "at": "2026-10-11T10:52:47.030Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "dark",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "4849fd65fafa81dac04fba35cd5052617c51b49b1f228840d899530f8b08ee17",
//     "app.js": "1b9e175d34933ccd82164d89e4fbd2b6901dcfc21d220874987a3bd97c7116f4",
//     "learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "styles.css": "506624ff08a6512320bf434a0cc38fea553f941bd60009eae9f7b26341673b62",
//     "legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "4e6a82f5f3cbe73f825a66ba3c6bc23830b22e487941ba588538a4d96a3a5520",
//     "../shared/product-overrides.js": "eabaadfe7fd43518e63c175a3bc755bccb92a3fef649d32568fb5f00c11eae9a",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../shared/preview-workflows.js": "936eb604e0f75e587c3bc09492adfdbabdd8101a6444c06498fa152e865bf5cf",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-01.png"
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-02.png"
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-03.png"
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-04.png"
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-05.png"
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-06.png"
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-12",
//         "feedback": true,
//         "repairs": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-07.png"
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-11",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-08.png"
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-11",
//           "recordId": "record-11"
//         },
//         "records": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-09.png"
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-10.png"
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-13.png"
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-14.png"
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-15.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-16.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-17.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\mobile-qa-1791715967032-dark",
//   "loadedScripts": [
//     "../shared/data.js",
//     "app.js",
//     "learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "mobile-ui.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// FINAL_SAFE_BODY_LIGHT_20261011
// {
//   "at": "2026-10-11T10:56:00.643Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "light",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "4849fd65fafa81dac04fba35cd5052617c51b49b1f228840d899530f8b08ee17",
//     "app.js": "99df303b7806965d7da5cca99440aef983a8135a9271f2072371809f2b413524",
//     "learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "styles.css": "506624ff08a6512320bf434a0cc38fea553f941bd60009eae9f7b26341673b62",
//     "legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "4e6a82f5f3cbe73f825a66ba3c6bc23830b22e487941ba588538a4d96a3a5520",
//     "../shared/product-overrides.js": "eabaadfe7fd43518e63c175a3bc755bccb92a3fef649d32568fb5f00c11eae9a",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../shared/preview-workflows.js": "936eb604e0f75e587c3bc09492adfdbabdd8101a6444c06498fa152e865bf5cf",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-01.png"
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-02.png"
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-03.png"
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-04.png"
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-05.png"
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-06.png"
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-12",
//         "feedback": true,
//         "repairs": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-07.png"
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-11",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-08.png"
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-11",
//           "recordId": "record-11"
//         },
//         "records": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-09.png"
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-10.png"
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-13.png"
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-14.png"
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-15.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-16.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-17.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\mobile-qa-1791716160645-light",
//   "loadedScripts": [
//     "../shared/data.js",
//     "app.js",
//     "learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "mobile-ui.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// LAST_RUN_RESULT
// {
//   "at": "2026-10-12T06:21:26.354Z",
//   "url": "http://127.0.0.1:18283/webDemo/mobile/",
//   "surface": "mobile",
//   "viewport": 390,
//   "theme": "light",
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "fd207376ea674379aedbb274b998a04d40bfacbb63031dba297d13fa29729d49",
//     "app.js": "99df303b7806965d7da5cca99440aef983a8135a9271f2072371809f2b413524",
//     "learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "styles.css": "506624ff08a6512320bf434a0cc38fea553f941bd60009eae9f7b26341673b62",
//     "legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "mobile-ui.js": "62a92a888eaa7dd14e76bdd595e2aa42502236bdc706612526779ac41f5f1ffe",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "703faa17cc33537ea7cd5df433966c590a7432637d7345cf19a4f45d34f4fe36",
//     "../shared/product-overrides.js": "eabaadfe7fd43518e63c175a3bc755bccb92a3fef649d32568fb5f00c11eae9a",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../shared/preview-workflows.js": "369f1b6a0f5bba22717804acc830c4e48aa782a0cd4116264c4a40e5adfb8613",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-01.png"
//     },
//     {
//       "name": "成人门与三项主动同意",
//       "status": "PASS",
//       "facts": {
//         "gate": "PASS",
//         "consents": 3
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-02.png"
//     },
//     {
//       "name": "目标预览与保存",
//       "status": "PASS",
//       "facts": {
//         "goal": "college",
//         "minutes": 45
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-03.png"
//     },
//     {
//       "name": "定级五题实际提交与报告",
//       "status": "PASS",
//       "facts": {
//         "done": true,
//         "answers": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-04.png"
//     },
//     {
//       "name": "真实生成今日计划",
//       "status": "PASS",
//       "facts": {
//         "plan": true,
//         "tasks": [
//           {
//             "id": "task-1",
//             "title": "语法 · There be 句型",
//             "group": "g1"
//           },
//           {
//             "id": "task-2",
//             "title": "阅读 · 图书馆的一天",
//             "group": "r1"
//           },
//           {
//             "id": "task-3",
//             "title": "写作 · 给朋友的一封信"
//           },
//           {
//             "id": "task-4",
//             "title": "词汇 · 回忆 3 个词"
//           },
//           {
//             "id": "task-5",
//             "title": "阅读 · 完成一个章节"
//           }
//         ]
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-05.png"
//     },
//     {
//       "name": "练习：首题错答、其余答对、独立结果",
//       "status": "PASS",
//       "facts": {
//         "phase": "result",
//         "resultId": "record-9",
//         "right": 2,
//         "total": 3,
//         "mistakes": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-06.png"
//     },
//     {
//       "name": "错题匹配变式→修复→延期验证",
//       "status": "PASS",
//       "facts": {
//         "state": "wait1",
//         "due": "2026-10-13",
//         "feedback": true,
//         "repairs": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-07.png"
//     },
//     {
//       "name": "日报与周报读回实际结果",
//       "status": "PASS",
//       "facts": {
//         "date": "2026-10-12",
//         "records": 2,
//         "right": 3,
//         "total": 4,
//         "xp": 26
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-08.png"
//     },
//     {
//       "name": "书架→图书→章节：笔记、刷新、完成",
//       "status": "PASS",
//       "facts": {
//         "chapter": {
//           "done": true,
//           "note": "读完后核对原文证据，不增加原文没有的结论。",
//           "date": "2026-10-12",
//           "recordId": "record-11"
//         },
//         "records": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-09.png"
//     },
//     {
//       "name": "词汇：搜索、词义答题、加入复习与三词任务",
//       "status": "PASS",
//       "facts": {
//         "closed": true,
//         "wordRecords": 1,
//         "seen": 3,
//         "reviewWords": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-10.png"
//     },
//     {
//       "name": "写作：不足格式反馈→修改草稿→保存结果",
//       "status": "PASS",
//       "facts": {
//         "accepted": true,
//         "count": 55,
//         "writingRecords": 2
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "听力：字幕切换、两道材料理解与记录",
//       "status": "PASS",
//       "facts": {
//         "id": "record-20",
//         "right": 2,
//         "total": 2,
//         "playbackAttempt": {
//           "playing": true,
//           "status": null
//         },
//         "audibilityVerified": false
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "设备撤销与刷新保持当前身份",
//       "status": "PASS",
//       "facts": {
//         "phone": false,
//         "current": true,
//         "user": "mobile-chain@test.invalid"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-13.png"
//     },
//     {
//       "name": "学习世界：加入/退出小组与游戏结算",
//       "status": "PASS",
//       "facts": {
//         "started": true,
//         "index": 5,
//         "score": 5
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-14.png"
//     },
//     {
//       "name": "设置主题与同意撤回后资格限制",
//       "status": "PASS",
//       "facts": {
//         "theme": "dark",
//         "revoked": true,
//         "learningBlocked": "gate"
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-15.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-21",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-16.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "mobile-chain@test.invalid",
//         "withdrawn": true,
//         "records": 7,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 390,
//         "scroll": 390
//       },
//       "screenshot": "step-17.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "/workspace/cs/.git/codex-local-backups/mobile-qa-1791786086357-light",
//   "loadedScripts": [
//     "../shared/data.js",
//     "app.js",
//     "learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "mobile-ui.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }
