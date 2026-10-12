/* Run from repository root: node docs/06-design/v2-980plus/redesign/mockups/webDemo/learner-web/qa-flow.js
 * Real DOM actions against an existing static preview. No backend operations.
 * Last run is appended as JS comments so evidence stays within the static-demo file boundary.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const QA_FILES = ['index.html','desktop.js','desktop.css','../shared/data.js','../shared/preview-data.js','../shared/product-overrides.js','../shared/demo-ui.js','../mobile/app.js','../mobile/learning.js','../mobile/legacy.css','../shared/tokens.css','../shared/components.css','../shared/preview-workflows.js','../shared/catalog-bridge.js'];
const sourceSnapshot = () => Object.fromEntries(QA_FILES.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,p))).digest('hex')]));
const QA_WIDTH = Number(process.env.QA_WIDTH || 1440);
const QA_URL = process.env.STATIC_DEMO_URL || 'http://127.0.0.1:18283/webDemo/learner-web/';
(async () => {
 const browser = await chromium.launch({headless:true});
 const page = await browser.newPage({viewport:{width:QA_WIDTH,height:1000}});
 page.setDefaultTimeout(5000);
 const report={at:new Date().toISOString(),url:QA_URL,surface:'learner-web',viewport:QA_WIDTH,mode:'real DOM click; synthetic facts',sourceHashes:sourceSnapshot(),steps:[],pageErrors:[],externalRequests:[]};
 const evidenceDir=path.resolve('.git/codex-local-backups/desktop-qa-'+Date.now()+'-'+QA_WIDTH);fs.mkdirSync(evidenceDir,{recursive:true});report.evidenceDir=evidenceDir;
 page.on('pageerror',e=>report.pageErrors.push({message:e.message,stack:e.stack}));
 page.on('request',r=>{if(!new URL(r.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) report.externalRequests.push(r.url());});
 async function step(name,run){try{const facts=await run();const layout=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert(layout.scroll<=QA_WIDTH,'桌面无横向溢出');const screenshot='step-'+String(report.steps.length+1).padStart(2,'0')+'.png';await page.screenshot({path:path.join(evidenceDir,screenshot),fullPage:true});report.steps.push({name,status:'PASS',facts,layout,screenshot});}catch(e){report.steps.push({name,status:'FAIL',error:e.message,route:await page.locator('#view').getAttribute('data-route'),visibleText:(await page.locator('#view').innerText()).slice(0,1800)});throw e;}}
 async function route(){return page.locator('#view').getAttribute('data-route');}
 async function open(r){await page.keyboard.press('Control+k');await page.locator('#desktop-command-query').fill(r);await page.locator(`#desktop-command-results a[href="#/${r}"]`).click();await page.waitForFunction(r=>document.getElementById('view').dataset.route===r,r);}
 const click = name => page.locator('#view').getByRole('button',{name,exact:true}).click();
 try {
 await page.goto(QA_URL);
 report.loadedScripts=await page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')));
 await step('注册：错误校验与受限身份',async()=>{await open('register');await page.locator('#ri').fill('desktop-chain@test.invalid');await page.locator('#rp').fill('short1');await click('创建档案并继续');assert.equal(await page.locator('#rp').getAttribute('aria-invalid'),'true');await page.locator('#rp').fill('SyntheticDesk123');await click('创建档案并继续');await page.waitForFunction(()=>document.getElementById('view').dataset.route==='gate');const f=await page.evaluate(()=>({user:S.user,gate:S.gate,consents:Object.values(S.consents).filter(x=>x.agreed).length}));assert.equal(f.gate,'PENDING');assert.equal(f.consents,0);return f;});
 await step('成人门与三项主动同意',async()=>{await page.locator('#by').fill('2000');await page.locator('#cf').check();await click('确认成年人状态');assert.equal(await page.evaluate(()=>S.gate),'PASS');const boxes=page.locator('.ag');assert.equal(await boxes.count(),3);for(let i=0;i<3;i++){assert.equal(await boxes.nth(i).isChecked(),false);await boxes.nth(i).check();}await click('签署并选择学习目标');await page.waitForFunction(()=>document.getElementById('view').dataset.route==='onboard');return {gate:await page.evaluate(()=>S.gate),consents:await page.evaluate(()=>Object.values(S.consents).filter(x=>x.agreed).length)};});
 await step('目标预览与保存',async()=>{await page.locator('#lg').selectOption('college');await page.locator('#lminutes').selectOption('45');await click('预览学习安排');assert.equal(await page.evaluate(()=>!!LM.planPreview),true);await click('保存目标');await page.waitForFunction(()=>document.getElementById('view').dataset.route==='firstlearn');return await page.evaluate(()=>({goal:LM.plan.goal,minutes:LM.plan.minutes}));});
 await step('定级五题实际提交与报告',async()=>{await click('先做样例测评');for(let i=0;i<5;i++){const a=await page.evaluate(()=>BANK[S.quiz.i].a);await page.locator(`#qo button[data-k="${a}"]`).click();await click('提交');await page.waitForFunction(()=>S.quiz.phase==='saved');await page.locator('#view button[onclick="qNext()"]').click();}await page.waitForFunction(()=>document.getElementById('view').dataset.route==='report');const facts=await page.evaluate(()=>({done:S.quiz.done,answers:S.quiz.answers.length,score:S.quiz.score}));assert.equal(facts.answers,5);assert.equal(facts.score,5);assert.equal(facts.done,true);return facts;});
 await step('真实生成今日计划',async()=>{await click('查看我的计划');await click('生成今日计划');await page.waitForFunction(()=>PG.st==='ok');await open('today');const f=await page.evaluate(()=>({plan:S.plan,tasks:S.today.map(t=>({id:t.id,title:t.t,group:t.group}))}));assert.equal(f.plan,true);assert(f.tasks.length>0);return f;});
 let wrongStem;
 await step('练习：首题错答、其余答对、独立结果',async()=>{const task=await page.evaluate(()=>S.today.find(t=>t.group&&GROUPS[t.group]?.kind==='grammar')||S.today.find(t=>t.group));assert(task,'有可练题组');await page.locator(`#view button[onclick="lmOpenTask('${task.id}')"]`).click();const count=await page.evaluate(()=>prGroup().items.length);for(let i=0;i<count;i++){const q=await page.evaluate(()=>({s:prGroup().items[PR.pos].s,a:prGroup().items[PR.pos].a,n:prGroup().items[PR.pos].o.length}));if(i===0)wrongStem=q.s;const selected=i===0?(q.a+1)%q.n:q.a;await page.locator(`#view button[onclick="prPick(${selected})"]`).click();await click('提交答案');await page.waitForFunction(()=>PR.phase==='saved');await page.locator('#view button[onclick="prNext()"]').click();}const f=await page.evaluate(()=>({phase:PR.phase,record:LM.records.find(r=>r.id===PR.resultId),mistakes:S.mistakes.map(m=>({id:m.id,t:m.t,st:m.st}))}));assert.equal(f.phase,'result');assert.equal(f.record.total,count);assert.equal(f.record.right,count-1);assert(f.mistakes.some(m=>m.t===wrongStem));return {phase:f.phase,resultId:f.record.id,right:f.record.right,total:f.record.total,mistakes:f.mistakes.length};});
 await step('错题匹配变式→修复→延期验证',async()=>{await click('错题补救');const m=await page.evaluate(stem=>S.mistakes.find(m=>m.t===stem),wrongStem);await page.locator(`#view button[onclick="lmMistakeOpen('${m.id}')"]`).click();const a=await page.evaluate(()=>lmVariant(S.mistakes.find(m=>m.id===LM.mistakeId)).a);await page.locator(`#view button[onclick="lmMistakePick(${a})"]`).click();await click('检查答案');const f=await page.evaluate(()=>{const m=S.mistakes.find(m=>m.id===LM.mistakeId);return {state:m.st,due:m.due,feedback:LM.mistakeFeedback.ok,repairs:LM.records.filter(r=>r.kind==='repair').length}});assert.equal(f.state,'wait1');assert.equal(f.feedback,true);assert(f.due>await page.evaluate(()=>lmDate()));assert.equal(await page.locator('#view button[onclick="lmMistakeCheck()"]').isDisabled(),true);return f;});
 await step('日报与周报读回实际结果',async()=>{await open('recap');assert((await page.locator('#view').innerText()).includes('学习结果'));const f=await page.evaluate(()=>({date:lmDate(),records:lmStats().count,right:lmStats().right,total:lmStats().total,xp:lmStats().xp}));assert(f.records>=2);assert(f.total>0);await open('weekly');assert.equal(await page.locator('.desktop-report-chart').count(),1);return f;});
 await step('书架→图书→章节：笔记、刷新、完成',async()=>{await open('shelf');await page.locator('#view button[onclick="lmCourseOpen(\'b1\')"]').click();await page.waitForFunction(()=>document.getElementById('view').dataset.route==='book');await page.locator('#view button[onclick="openChapter(\'b1\',0)"]').click();await page.locator('#chapter-note').fill('读完后核对原文证据，不增加原文没有的结论。');await page.reload();assert.equal(await page.locator('#chapter-note').inputValue(),'读完后核对原文证据，不增加原文没有的结论。');await click('完成本节');const f=await page.evaluate(()=>({chapter:LM.chapters['b1:0'],records:LM.records.filter(r=>r.kind==='chapter').length}));assert.equal(f.chapter.done,true);assert(f.records>=1);return f;});
 await step('学习世界：加入/退出小组与游戏结算',async()=>{await open('world');await page.locator('#view button').filter({hasText:/^加入$/}).first().click();const joined=await page.evaluate(()=>UI_FACTS.room);assert(joined);await page.locator('#view button').filter({hasText:/^退出$/}).click();assert.equal(await page.evaluate(()=>UI_FACTS.room),null);await click('词义寻宝');await click('开始寻宝');for(let i=0;i<5;i++)await page.locator('#view button[onclick="uiGameAnswer(0)"]').click();const f=await page.evaluate(()=>({...UI_FACTS.game}));assert.equal(f.index,5);assert.equal(f.score,5);return f;});
 await step('设置主题与同意撤回后资格限制',async()=>{await open('settings');await click('深色');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await click('隐私设置 ›');await page.locator('#view button[onclick="uiWithdraw(\'ADULT_LEARNING\')"]').click();await page.locator('dialog[open]').getByRole('button',{name:'确认',exact:true}).click();assert.equal(await page.evaluate(()=>S.consents.ADULT_LEARNING.agreed),false);await page.keyboard.press('Control+k');await page.locator('#desktop-command-query').fill('today');await page.locator('#desktop-command-results a[href="#/today"]').click();await page.waitForFunction(()=>document.getElementById('view').dataset.route==='gate');return {theme:await page.locator('html').getAttribute('data-theme'),revoked:true,learningBlocked:await route()};});
 await step('撤回后仍可提交本人客服工单',async()=>{await open('support');const before=await page.evaluate(()=>SUP.list.length);await page.locator('#sup').fill('请说明撤回学习同意后如何恢复。');await click('提交工单');const f=await page.evaluate(()=>({count:SUP.list.length,ticket:SUP.list[0],draft:SUP.draft}));assert.equal(f.count,before+1);assert.equal(f.draft,'');assert.equal(f.ticket.st,'已提交');return f;});
 await step('退出→再次登录保留撤回事实',async()=>{await open('settings');await click('退出登录');await page.getByRole('button',{name:'再点一次确认',exact:true}).click();await page.waitForFunction(()=>document.getElementById('view').dataset.route==='login');assert.equal(await page.evaluate(()=>S.user),null);await page.locator('#li').fill('desktop-chain@test.invalid');await page.locator('#lp').fill('SyntheticDesk123');await click('进入学习档案');await page.waitForFunction(()=>document.getElementById('view').dataset.route==='gate');const f=await page.evaluate(()=>({user:S.user,withdrawn:!S.consents.ADULT_LEARNING.agreed,records:LM.records.length,tickets:SUP.list.length}));assert.equal(f.withdrawn,true);assert(f.records>0);assert(f.tickets>0);return f;});
 assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.externalRequests,[]);report.status='PASS';
 }catch(e){report.status='FAIL';report.lastError=e.message;}
 report.sourceDrift=Object.entries(sourceSnapshot()).filter(([p,h])=>report.sourceHashes[p]!==h).map(([p])=>p);if(report.sourceDrift.length)report.status='PARTIAL_SOURCE_DRIFT';
 await page.screenshot({path:path.join(evidenceDir,'final-page.png'),fullPage:true});fs.writeFileSync(path.join(evidenceDir,'report.json'),JSON.stringify(report,null,2));
 await browser.close();const marker='// LAST_RUN_RESULT';let source=fs.readFileSync(__filename,'utf8');source=source.split('\n'+marker)[0];fs.writeFileSync(__filename,source+'\n'+marker+'\n'+JSON.stringify(report,null,2).split('\n').map(l=>'// '+l).join('\n')+'\n');console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

// VERIFIED_1280_RUN_20261011
// {
//   "at": "2026-10-11T09:42:44.268Z",
//   "url": "http://127.0.0.1:18283/webDemo/learner-web/",
//   "surface": "learner-web",
//   "viewport": 1280,
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "6e72880c9adc10d51020321f5103a2d144099c371e46c00845b683cba0317588",
//     "desktop.js": "9a9e27f949710b5f474ae8e8d4c31fa61b617a7f29b0ec61588f417408c69cbd",
//     "desktop.css": "f3a40717347fb5bd7cea80f652a2dbdf4f838d447785717199a98748f6a294c8",
//     "../shared/data.js": "4e344f3130d2f9b615dd93c4e280889307a909be6a7c5f1482668d23898bae4f",
//     "../shared/product-overrides.js": "1e5dfc1ce4db632d7b93caaa5daabf5172e75165c96e623d334a140be47089e5",
//     "../shared/demo-ui.js": "0628f0cfc51811bc7416094b573e7cbb08fb3552dc9f0354f333faf56b486cb2",
//     "../mobile/app.js": "fb4248dd4c51843f3afc3e896cbfe8b70d2b023d43e0645ce2945045078d3c92",
//     "../mobile/learning.js": "c714402346c458b15f504ee741c35b65c68d333289b29e57792edbdb834cb550"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
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
//           "id": "demo-ticket-13",
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
//         "user": "desktop-chain@test.invalid",
//         "withdrawn": true,
//         "records": 3,
//         "tickets": 1
//       }
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "status": "PASS",
//   "sourceDrift": []
// }


// VERIFIED_1440_BEFORE_FINAL_20261011
// {
//   "at": "2026-10-11T09:43:28.645Z",
//   "url": "http://127.0.0.1:18283/webDemo/learner-web/",
//   "surface": "learner-web",
//   "viewport": 1440,
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "6e72880c9adc10d51020321f5103a2d144099c371e46c00845b683cba0317588",
//     "desktop.js": "9a9e27f949710b5f474ae8e8d4c31fa61b617a7f29b0ec61588f417408c69cbd",
//     "desktop.css": "f3a40717347fb5bd7cea80f652a2dbdf4f838d447785717199a98748f6a294c8",
//     "../shared/data.js": "4e344f3130d2f9b615dd93c4e280889307a909be6a7c5f1482668d23898bae4f",
//     "../shared/product-overrides.js": "1e5dfc1ce4db632d7b93caaa5daabf5172e75165c96e623d334a140be47089e5",
//     "../shared/demo-ui.js": "0628f0cfc51811bc7416094b573e7cbb08fb3552dc9f0354f333faf56b486cb2",
//     "../mobile/app.js": "fb4248dd4c51843f3afc3e896cbfe8b70d2b023d43e0645ce2945045078d3c92",
//     "../mobile/learning.js": "c714402346c458b15f504ee741c35b65c68d333289b29e57792edbdb834cb550"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
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
//           "id": "demo-ticket-13",
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
//         "user": "desktop-chain@test.invalid",
//         "withdrawn": true,
//         "records": 3,
//         "tickets": 1
//       }
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "status": "PASS",
//   "sourceDrift": []
// }

// FINAL_1280_20261011
// {
//   "at": "2026-10-11T10:09:28.884Z",
//   "url": "http://127.0.0.1:18283/webDemo/learner-web/",
//   "surface": "learner-web",
//   "viewport": 1280,
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "0118d3fa3410837f41939cb87cbcaeaf2918b1c42b69c574925f71086ded85d9",
//     "desktop.js": "9a9e27f949710b5f474ae8e8d4c31fa61b617a7f29b0ec61588f417408c69cbd",
//     "desktop.css": "488acd5bf3aae6e5bd7bdc8c464da6b54f6f31e46f2f5578d2dc4e92e5ac8081",
//     "../shared/data.js": "8573e3a9e0bb77dcbe30e32168a88bc82f258bdd37d3cb4057184f4dea7a6a6f",
//     "../shared/product-overrides.js": "1e5dfc1ce4db632d7b93caaa5daabf5172e75165c96e623d334a140be47089e5",
//     "../shared/demo-ui.js": "ae66a78d4d53fc394c307012e1ada373b7aaee04a52b1dfe647ce3aa528f5c3c",
//     "../mobile/app.js": "a97381491928f601bf3f4455232e688cbbb82fd86f8dd69f2778ee8bedaa1f86",
//     "../mobile/learning.js": "793cbad8afcaa1da1d16835deb573851d196d70ab75ac5a639271f4b436d2465",
//     "../mobile/legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "../shared/preview-workflows.js": "706e945b6d8f288e4387770a6dd31cdb7f456c6f4be9506923bd52f0abaa5d0a",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-09.png"
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
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-10.png"
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
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-13",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "withdrawn": true,
//         "records": 3,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-13.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\desktop-qa-1791713368886-1280",
//   "loadedScripts": [
//     "../shared/data.js",
//     "../mobile/app.js",
//     "../mobile/learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "desktop.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// PRIOR_FINAL_1440_20261011
// {
//   "at": "2026-10-11T10:10:04.753Z",
//   "url": "http://127.0.0.1:18283/webDemo/learner-web/",
//   "surface": "learner-web",
//   "viewport": 1440,
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "0118d3fa3410837f41939cb87cbcaeaf2918b1c42b69c574925f71086ded85d9",
//     "desktop.js": "9a9e27f949710b5f474ae8e8d4c31fa61b617a7f29b0ec61588f417408c69cbd",
//     "desktop.css": "488acd5bf3aae6e5bd7bdc8c464da6b54f6f31e46f2f5578d2dc4e92e5ac8081",
//     "../shared/data.js": "8573e3a9e0bb77dcbe30e32168a88bc82f258bdd37d3cb4057184f4dea7a6a6f",
//     "../shared/product-overrides.js": "1e5dfc1ce4db632d7b93caaa5daabf5172e75165c96e623d334a140be47089e5",
//     "../shared/demo-ui.js": "ae66a78d4d53fc394c307012e1ada373b7aaee04a52b1dfe647ce3aa528f5c3c",
//     "../mobile/app.js": "a97381491928f601bf3f4455232e688cbbb82fd86f8dd69f2778ee8bedaa1f86",
//     "../mobile/learning.js": "793cbad8afcaa1da1d16835deb573851d196d70ab75ac5a639271f4b436d2465",
//     "../mobile/legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "../shared/preview-workflows.js": "706e945b6d8f288e4387770a6dd31cdb7f456c6f4be9506923bd52f0abaa5d0a",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-09.png"
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
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-10.png"
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
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-13",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "withdrawn": true,
//         "records": 3,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-13.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\desktop-qa-1791713404755-1440",
//   "loadedScripts": [
//     "../shared/data.js",
//     "../mobile/app.js",
//     "../mobile/learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "desktop.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// FINAL_FROZEN_1280_20261011
// {
//   "at": "2026-10-11T10:38:20.966Z",
//   "url": "http://127.0.0.1:18283/webDemo/learner-web/",
//   "surface": "learner-web",
//   "viewport": 1280,
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "e7f0ef74778bd5fb64ff713e8dc9c731b24f557ef2c5bdeb3d254ebaa260e919",
//     "desktop.js": "9a9e27f949710b5f474ae8e8d4c31fa61b617a7f29b0ec61588f417408c69cbd",
//     "desktop.css": "488acd5bf3aae6e5bd7bdc8c464da6b54f6f31e46f2f5578d2dc4e92e5ac8081",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "4e6a82f5f3cbe73f825a66ba3c6bc23830b22e487941ba588538a4d96a3a5520",
//     "../shared/product-overrides.js": "12bc186f0321864451be503f78c8c31d2a43c2ab1d6c475ff51f12d10f13aadf",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../mobile/app.js": "cd9b9a187bfd692095c54bd76ad6a890fd54621a1ad9352921cd7f8785e33766",
//     "../mobile/learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "../mobile/legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "../shared/preview-workflows.js": "f0855dcccc53a97a31dc9de55510375381a958b29b413c2cc62b4aa24099b4a4",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-09.png"
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
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-10.png"
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
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-13",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "withdrawn": true,
//         "records": 3,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-13.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\desktop-qa-1791715100969-1280",
//   "loadedScripts": [
//     "../shared/data.js",
//     "../mobile/app.js",
//     "../mobile/learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "desktop.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// PRIOR_FROZEN_1440_20261011
// {
//   "at": "2026-10-11T10:38:57.348Z",
//   "url": "http://127.0.0.1:18283/webDemo/learner-web/",
//   "surface": "learner-web",
//   "viewport": 1440,
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "e7f0ef74778bd5fb64ff713e8dc9c731b24f557ef2c5bdeb3d254ebaa260e919",
//     "desktop.js": "9a9e27f949710b5f474ae8e8d4c31fa61b617a7f29b0ec61588f417408c69cbd",
//     "desktop.css": "488acd5bf3aae6e5bd7bdc8c464da6b54f6f31e46f2f5578d2dc4e92e5ac8081",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "4e6a82f5f3cbe73f825a66ba3c6bc23830b22e487941ba588538a4d96a3a5520",
//     "../shared/product-overrides.js": "12bc186f0321864451be503f78c8c31d2a43c2ab1d6c475ff51f12d10f13aadf",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../mobile/app.js": "cd9b9a187bfd692095c54bd76ad6a890fd54621a1ad9352921cd7f8785e33766",
//     "../mobile/learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "../mobile/legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "../shared/preview-workflows.js": "f0855dcccc53a97a31dc9de55510375381a958b29b413c2cc62b4aa24099b4a4",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-09.png"
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
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-10.png"
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
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-13",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "withdrawn": true,
//         "records": 3,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-13.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\desktop-qa-1791715137350-1440",
//   "loadedScripts": [
//     "../shared/data.js",
//     "../mobile/app.js",
//     "../mobile/learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "desktop.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// FINAL_DRAFT_1280_20261011
// {
//   "at": "2026-10-11T10:44:52.077Z",
//   "url": "http://127.0.0.1:18283/webDemo/learner-web/",
//   "surface": "learner-web",
//   "viewport": 1280,
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "672619ec08a7345ea087b2cf8965ce37130a01eba95f26896d97d39921888e0a",
//     "desktop.js": "9a9e27f949710b5f474ae8e8d4c31fa61b617a7f29b0ec61588f417408c69cbd",
//     "desktop.css": "488acd5bf3aae6e5bd7bdc8c464da6b54f6f31e46f2f5578d2dc4e92e5ac8081",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "4e6a82f5f3cbe73f825a66ba3c6bc23830b22e487941ba588538a4d96a3a5520",
//     "../shared/product-overrides.js": "eabaadfe7fd43518e63c175a3bc755bccb92a3fef649d32568fb5f00c11eae9a",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../mobile/app.js": "cd9b9a187bfd692095c54bd76ad6a890fd54621a1ad9352921cd7f8785e33766",
//     "../mobile/learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "../mobile/legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "../shared/preview-workflows.js": "f0855dcccc53a97a31dc9de55510375381a958b29b413c2cc62b4aa24099b4a4",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-09.png"
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
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-10.png"
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
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-13",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "withdrawn": true,
//         "records": 3,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-13.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\desktop-qa-1791715492080-1280",
//   "loadedScripts": [
//     "../shared/data.js",
//     "../mobile/app.js",
//     "../mobile/learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "desktop.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// PRIOR_DRAFT_1440_20261011
// {
//   "at": "2026-10-11T10:45:35.952Z",
//   "url": "http://127.0.0.1:18283/webDemo/learner-web/",
//   "surface": "learner-web",
//   "viewport": 1440,
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "672619ec08a7345ea087b2cf8965ce37130a01eba95f26896d97d39921888e0a",
//     "desktop.js": "9a9e27f949710b5f474ae8e8d4c31fa61b617a7f29b0ec61588f417408c69cbd",
//     "desktop.css": "488acd5bf3aae6e5bd7bdc8c464da6b54f6f31e46f2f5578d2dc4e92e5ac8081",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "4e6a82f5f3cbe73f825a66ba3c6bc23830b22e487941ba588538a4d96a3a5520",
//     "../shared/product-overrides.js": "eabaadfe7fd43518e63c175a3bc755bccb92a3fef649d32568fb5f00c11eae9a",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../mobile/app.js": "cd9b9a187bfd692095c54bd76ad6a890fd54621a1ad9352921cd7f8785e33766",
//     "../mobile/learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "../mobile/legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "../shared/preview-workflows.js": "f0855dcccc53a97a31dc9de55510375381a958b29b413c2cc62b4aa24099b4a4",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-09.png"
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
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-10.png"
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
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-13",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "withdrawn": true,
//         "records": 3,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-13.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\desktop-qa-1791715535954-1440",
//   "loadedScripts": [
//     "../shared/data.js",
//     "../mobile/app.js",
//     "../mobile/learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "desktop.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// FINAL_RELEASE_1280_20261011
// {
//   "at": "2026-10-11T10:52:10.078Z",
//   "url": "http://127.0.0.1:18283/webDemo/learner-web/",
//   "surface": "learner-web",
//   "viewport": 1280,
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "672619ec08a7345ea087b2cf8965ce37130a01eba95f26896d97d39921888e0a",
//     "desktop.js": "9a9e27f949710b5f474ae8e8d4c31fa61b617a7f29b0ec61588f417408c69cbd",
//     "desktop.css": "488acd5bf3aae6e5bd7bdc8c464da6b54f6f31e46f2f5578d2dc4e92e5ac8081",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "4e6a82f5f3cbe73f825a66ba3c6bc23830b22e487941ba588538a4d96a3a5520",
//     "../shared/product-overrides.js": "eabaadfe7fd43518e63c175a3bc755bccb92a3fef649d32568fb5f00c11eae9a",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../mobile/app.js": "1b9e175d34933ccd82164d89e4fbd2b6901dcfc21d220874987a3bd97c7116f4",
//     "../mobile/learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "../mobile/legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "../shared/preview-workflows.js": "936eb604e0f75e587c3bc09492adfdbabdd8101a6444c06498fa152e865bf5cf",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-09.png"
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
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-10.png"
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
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-13",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "withdrawn": true,
//         "records": 3,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-13.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\desktop-qa-1791715930080-1280",
//   "loadedScripts": [
//     "../shared/data.js",
//     "../mobile/app.js",
//     "../mobile/learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "desktop.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// PRIOR_RELEASE_1440_20261011
// {
//   "at": "2026-10-11T10:52:47.022Z",
//   "url": "http://127.0.0.1:18283/webDemo/learner-web/",
//   "surface": "learner-web",
//   "viewport": 1440,
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "672619ec08a7345ea087b2cf8965ce37130a01eba95f26896d97d39921888e0a",
//     "desktop.js": "9a9e27f949710b5f474ae8e8d4c31fa61b617a7f29b0ec61588f417408c69cbd",
//     "desktop.css": "488acd5bf3aae6e5bd7bdc8c464da6b54f6f31e46f2f5578d2dc4e92e5ac8081",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "4e6a82f5f3cbe73f825a66ba3c6bc23830b22e487941ba588538a4d96a3a5520",
//     "../shared/product-overrides.js": "eabaadfe7fd43518e63c175a3bc755bccb92a3fef649d32568fb5f00c11eae9a",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../mobile/app.js": "1b9e175d34933ccd82164d89e4fbd2b6901dcfc21d220874987a3bd97c7116f4",
//     "../mobile/learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "../mobile/legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "../shared/preview-workflows.js": "936eb604e0f75e587c3bc09492adfdbabdd8101a6444c06498fa152e865bf5cf",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-09.png"
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
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-10.png"
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
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-13",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "withdrawn": true,
//         "records": 3,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-13.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\desktop-qa-1791715967025-1440",
//   "loadedScripts": [
//     "../shared/data.js",
//     "../mobile/app.js",
//     "../mobile/learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "desktop.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// FINAL_SAFE_BODY_1280_20261011
// {
//   "at": "2026-10-11T10:56:00.643Z",
//   "url": "http://127.0.0.1:18283/webDemo/learner-web/",
//   "surface": "learner-web",
//   "viewport": 1280,
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "672619ec08a7345ea087b2cf8965ce37130a01eba95f26896d97d39921888e0a",
//     "desktop.js": "9a9e27f949710b5f474ae8e8d4c31fa61b617a7f29b0ec61588f417408c69cbd",
//     "desktop.css": "488acd5bf3aae6e5bd7bdc8c464da6b54f6f31e46f2f5578d2dc4e92e5ac8081",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "4e6a82f5f3cbe73f825a66ba3c6bc23830b22e487941ba588538a4d96a3a5520",
//     "../shared/product-overrides.js": "eabaadfe7fd43518e63c175a3bc755bccb92a3fef649d32568fb5f00c11eae9a",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../mobile/app.js": "99df303b7806965d7da5cca99440aef983a8135a9271f2072371809f2b413524",
//     "../mobile/learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "../mobile/legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "../shared/preview-workflows.js": "936eb604e0f75e587c3bc09492adfdbabdd8101a6444c06498fa152e865bf5cf",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
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
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-09.png"
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
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-10.png"
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
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-13",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "withdrawn": true,
//         "records": 3,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 1280,
//         "scroll": 1280
//       },
//       "screenshot": "step-13.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\.git\\codex-local-backups\\desktop-qa-1791716160645-1280",
//   "loadedScripts": [
//     "../shared/data.js",
//     "../mobile/app.js",
//     "../mobile/learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "desktop.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }

// LAST_RUN_RESULT
// {
//   "at": "2026-10-12T07:02:26.566Z",
//   "url": "http://127.0.0.1:18283/webDemo/learner-web/",
//   "surface": "learner-web",
//   "viewport": 1440,
//   "mode": "real DOM click; synthetic facts",
//   "sourceHashes": {
//     "index.html": "df7d1b60ac6def0790a5b0db013393ced09af923c7169b6bbbf46576984481a9",
//     "desktop.js": "d34831338c4d3d3ac7dd4f93b454cd3033f68aac251b4be4fe415dc184b18e0b",
//     "desktop.css": "356b8eb696b4fe1e8832a35c6607b07a762ac4e4c84fb01e145a2eee69bd403d",
//     "../shared/data.js": "37a257521ad60beb443aec03c06729063435210652deee30fff1779910050877",
//     "../shared/preview-data.js": "703faa17cc33537ea7cd5df433966c590a7432637d7345cf19a4f45d34f4fe36",
//     "../shared/product-overrides.js": "eabaadfe7fd43518e63c175a3bc755bccb92a3fef649d32568fb5f00c11eae9a",
//     "../shared/demo-ui.js": "5e3a23ef8bb68afd86baf4d1fae0d1e2567c6734b21d1518d69eb0833214bc0a",
//     "../mobile/app.js": "99df303b7806965d7da5cca99440aef983a8135a9271f2072371809f2b413524",
//     "../mobile/learning.js": "4863003b4aa6082a4d1577a44c097e0d554fe3dd784536617bc24059ec8be0f6",
//     "../mobile/legacy.css": "778dc02de0d7c0cdf410cae76bc4b0f88c0717026eaa5c83c64a1218604e5456",
//     "../shared/tokens.css": "82eb54043fa4a26f1341284a562819fabef85e50bc978bb33ce07a67389fc5f9",
//     "../shared/components.css": "81e6fc1ee75b7b15708fba12f5742ac9db0a43793e3fb1b663893f4f4c6d4ee6",
//     "../shared/preview-workflows.js": "369f1b6a0f5bba22717804acc830c4e48aa782a0cd4116264c4a40e5adfb8613",
//     "../shared/catalog-bridge.js": "7c86085b12ead74903b1705b01bf7d03326a9852174e690d226125e2a14bdaa1"
//   },
//   "steps": [
//     {
//       "name": "注册：错误校验与受限身份",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "gate": "PENDING",
//         "consents": 0
//       },
//       "layout": {
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
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
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-09.png"
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
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-10.png"
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
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-11.png"
//     },
//     {
//       "name": "撤回后仍可提交本人客服工单",
//       "status": "PASS",
//       "facts": {
//         "count": 1,
//         "ticket": {
//           "id": "demo-ticket-13",
//           "cat": "功能",
//           "t": "请说明撤回学习同意后如何恢复。",
//           "st": "已提交"
//         },
//         "draft": ""
//       },
//       "layout": {
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-12.png"
//     },
//     {
//       "name": "退出→再次登录保留撤回事实",
//       "status": "PASS",
//       "facts": {
//         "user": "desktop-chain@test.invalid",
//         "withdrawn": true,
//         "records": 3,
//         "tickets": 1
//       },
//       "layout": {
//         "client": 1440,
//         "scroll": 1440
//       },
//       "screenshot": "step-13.png"
//     }
//   ],
//   "pageErrors": [],
//   "externalRequests": [],
//   "evidenceDir": "/workspace/cs/.git/codex-local-backups/desktop-qa-1791788546569-1440",
//   "loadedScripts": [
//     "../shared/data.js",
//     "../mobile/app.js",
//     "../mobile/learning.js",
//     "../shared/product-overrides.js",
//     "../shared/preview-data.js",
//     "../shared/preview-workflows.js",
//     "../shared/catalog-bridge.js",
//     "desktop.js",
//     "../shared/demo-ui.js"
//   ],
//   "status": "PASS",
//   "sourceDrift": []
// }
