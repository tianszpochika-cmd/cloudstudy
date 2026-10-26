const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const base='evidence/p1r/m3/P1R-M3-008/redesign/R1-001/',out=process.argv[2];
fs.mkdirSync(out,{recursive:true});
const report={startedAt:new Date().toISOString(),mocked:false,steps:[],processes:[],screenshots:[]};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function stop(p){if(!p||p.stopped)return;const r=spawnSync('powershell.exe',['-NoProfile','-Command','Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress'],{encoding:'utf8',windowsHide:true,maxBuffer:4000000});assert.equal(r.status,0);const all=JSON.parse(r.stdout),ids=new Set([p.pid]);let changed=true;while(changed){changed=false;for(const item of all)if(ids.has(item.ParentProcessId)&&!ids.has(item.ProcessId)){ids.add(item.ProcessId);changed=true;}}
 spawnSync('powershell.exe',['-NoProfile','-Command','Stop-Process -Id '+[...ids].reverse().join(',')+' -Force -ErrorAction SilentlyContinue'],{encoding:'utf8',windowsHide:true});p.stopped=true;
}
async function start(){
 const child=spawn(process.execPath,[base+'work/r1-001-safe-run-10.cjs','--service','content-service'],{stdio:['ignore','pipe','pipe'],windowsHide:true,env:{...process.env,P1R_DIAG:'0'}});
 const p={pid:child.pid,child},meta={pid:child.pid,startedAt:new Date().toISOString(),safeFlags:'relay/consumer/schedule/content-Flyway/commerce-Flyway/SPRING-Flyway=false, P1R_DIAG=0'};report.processes.push(meta);
 child.stdout.on('data',d=>{const m=d.toString().match(/started content-service pid=(\d+) port=18089/);if(m)meta.javaPid=Number(m[1]);});child.stderr.on('data',()=>{});
 const until=Date.now()+150000;while(Date.now()<until){try{const response=await fetch('http://127.0.0.1:18089/actuator/health/readiness',{signal:AbortSignal.timeout(2500)});if(response.ok){meta.healthyAt=new Date().toISOString();return p;}}catch{}await pause(1000);}stop(p);throw Error('Own content restore did not become healthy');
}
(async()=>{let browser,content;try{
 browser=await chromium.launch({headless:true});
 for(const [label,viewport,mode] of [['375x812',{width:375,height:812},'error'],['1440x900',{width:1440,height:900},'recovery']]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/public-projection'&&r.request().method()==='GET');
  const navigation=await page.goto('http://127.0.0.1:18182/courses',{waitUntil:'domcontentloaded'});assert.equal(navigation.status(),200);
  const initialResponse=await pending,initial=await initialResponse.json();assert.equal(initial.state,mode);
  const gw=await fetch('http://127.0.0.1:18070/api/v1/public/site/projection?uiLocale=zh-CN'),gwBody=await gw.json();assert.equal(gw.status,503);
  const region=page.locator('.published-courses'),retry=region.getByRole('button',{name:'重新加载',exact:true});
  await retry.waitFor({state:'visible'});assert.equal(await retry.isEnabled(),true);
  const text=await region.innerText(),beforeCards=await region.locator('.public-course-card').count();
  if(mode==='error'){assert.equal(beforeCards,0);assert.ok(text.includes('公开内容暂时无法加载'));}
  else{assert.ok(beforeCards>0);assert.equal(initial.stale,true);assert.equal(initial.source,'memory-cache');assert.ok(text.includes('正在恢复'));}
  const before=path.join(out,'before-'+label+'.png');await region.screenshot({path:before});report.screenshots.push(before);
  content=await start();
  assert.equal(new URL(page.url()).pathname,'/courses');assert.equal(await retry.isVisible(),true,'Same failure page must remain before retry');
  const afterPending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/public-projection'&&r.request().method()==='GET');
  await retry.click();const afterResponse=await afterPending,after=await afterResponse.json();assert.equal(afterResponse.status(),200);assert.equal(after.state,'ready');assert.equal(after.stale,false);
  await region.locator('.public-course-card').first().waitFor({state:'visible'});
  await page.waitForFunction(expected=>document.querySelectorAll('.published-courses .public-course-card').length===expected,after.projection.courses.length);
  assert.deepEqual((await region.locator('.public-course-card h3').allTextContents()).map(t=>t.trim()),after.projection.courses.map(c=>c.title.trim()));
  await retry.waitFor({state:'hidden'});assert.equal(await region.locator('.facet-recovery').count(),0,'Recovery banner must disappear');
  const date=String(after.facets.courses.updatedAt||after.projection.generatedAt||'').slice(0,10);assert.match(date,/^\d{4}-\d{2}-\d{2}$/);assert.ok((await region.innerText()).includes(date));
  const shot=path.join(out,'after-'+label+'.png');await region.screenshot({path:shot});report.screenshots.push(shot);assert.deepEqual(errors,[]);
  report.steps.push({label,mode,result:'PASS',samePage:true,action:'button.click',gateway:{status:gw.status,errorCode:gwBody.error?.errorCode,requestId:gw.headers.get('x-request-id'),traceId:gw.headers.get('x-trace-id')},initialResponse:initial,clickedResponse:after,responseStatus:afterResponse.status(),bannerRemoved:true,retryHidden:true,errors});
  stop(content);content=null;await pause(1500);await context.close();
 }
 report.result='PASS';
}catch(e){report.result='FAIL';report.failure=String(e.message).slice(0,500);process.exitCode=1;}
finally{stop(content);if(browser)await browser.close();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({result:report.result,steps:report.steps.length,failure:report.failure}));}})();
