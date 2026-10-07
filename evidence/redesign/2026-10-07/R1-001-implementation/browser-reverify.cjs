// Read-only current-source observation. No registration submit, backend writes or acceptance promotion.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const evidence = __dirname;
const origin = 'http://127.0.0.1:18182';
const routes = ['/', '/courses', '/pricing', '/download', '/announcements', '/about', '/compliance', '/status', '/privacy', '/terms', '/minors'];
const result = {kind:'R1_001_CURRENT_SOURCE_REDELIVERY_NOT_ACCEPTANCE', sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), at:new Date().toISOString(), origin, taskId:'R1-001', browserAvailability:'Browser plugin not available; existing regular Playwright 1.63.0', runtimeBinding:'PID9008 Nuxt dev in this workspace; no build commit endpoint, source hashes recorded separately', pages:[], interactions:[], registrationDestinations:[], blockedWrites:[], failure:null};
fs.mkdirSync(path.join(evidence,'screenshots'),{recursive:true});
async function observe(page, requested, viewportName, errors, requestedRoute=requested) {
  errors.length=0;
  const response=await page.goto(requested,{waitUntil:'networkidle',timeout:30000});
  const redirects=[];
  let request=response?.request();
  while(request){const res=await request.response();redirects.unshift({url:request.url(),status:res?.status()});request=request.redirectedFrom();}
  const text=await page.locator('body').innerText();
  const name=requestedRoute.replace(/[^a-z0-9]/gi,'_')||'_';
  const screenshot='screenshots/'+viewportName+name+'.png';
  await page.screenshot({path:path.join(evidence,screenshot),fullPage:false});
  const entry={requestedRoute,url:page.url(),title:await page.title(),status:response?.status(),redirects,viewport:page.viewportSize(),h1:await page.locator('h1').allTextContents(),notBlank:text.length>80,frameworkOverlay:await page.locator('vite-error-overlay,#__nuxt_error__').count(),horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),screenshot,errors:[...errors],bodyText:text,links:await page.locator('a').evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim(),href:e.getAttribute('href')})))};
  return entry;
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 result.browserVersion=browser.version();
 try{
  for(const [name,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
   const context=await browser.newContext({viewport,locale:'zh-CN',reducedMotion:'reduce',serviceWorkers:'block'});
   await context.route('**/*',async route=>{const method=route.request().method();if(!['GET','HEAD','OPTIONS'].includes(method)){result.blockedWrites.push({method,url:route.request().url().split('?')[0]});await route.abort();}else await route.continue();});
   const p=await context.newPage(),errors=[];
   p.on('pageerror',e=>errors.push({type:'pageerror',message:e.message}));
   p.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push({type:m.type(),message:m.text()});});
   for(const route of routes){const entry=await observe(p,origin+route,name,errors,route);result.pages.push(entry);console.log(name,route,entry.redirects.map(x=>x.status).join('->'),entry.h1.join(' / '));}
   for(const entry of result.pages.filter(x=>x.viewport.width===viewport.width)) {
    if(entry.redirects.length!==1 || entry.status!==200 || !entry.notBlank || entry.frameworkOverlay || entry.horizontalOverflow || entry.errors.length) throw new Error('R1 route failed '+entry.requestedRoute+' '+name);
   }
   const prefs='?locale=zh-CN&theme=dark&utm_source=r1-audit&returnTo=%2F%2Fevil.test&redirect=https%3A%2F%2Fevil.test&access_token=forbidden';
   await p.goto(origin+'/'+prefs,{waitUntil:'networkidle'});
   const primary=p.locator('.hero-buttons a').first();
   const before={url:p.url(),label:await primary.innerText(),href:await primary.getAttribute('href')};
   await primary.click();await p.waitForURL(u=>u.origin==='http://127.0.0.1:18180'&&u.pathname==='/register');
   await p.locator('input[type=password]').first().waitFor({state:'visible'});
   const registrationUrl=new URL(p.url()), body=await p.locator('body').innerText();
   const parameterProof={returnTo:registrationUrl.searchParams.get('returnTo'),uiLocale:registrationUrl.searchParams.get('uiLocale'),theme:registrationUrl.searchParams.get('theme'),utm_source:registrationUrl.searchParams.get('utm_source'),forbiddenKeys:['access_token','redirect','owner','tenant','role'].filter(k=>registrationUrl.searchParams.has(k))};
   if(parameterProof.returnTo!=='/home'||parameterProof.theme!=='dark'||parameterProof.utm_source!=='r1-audit'||parameterProof.forbiddenKeys.length) throw new Error('unsafe/unpreserved register handoff');
   if(!body.includes('18 岁以上')||await p.locator('input[type=password]').count()!==2) throw new Error('registration page missing identity/adult boundary');
   await p.screenshot({path:path.join(evidence,'screenshots',name+'_registered_destination.png'),fullPage:false});
   result.interactions.push({viewport:name,flow:'homepage primary -> actual learner-web registration page',before,after:p.url(),parameterProof,adultCopyVisible:true,passwordInputs:2,registerSubmitExercised:false,provesRegistrationCTA:true});
   await p.goto(origin+'/start'+prefs,{waitUntil:'networkidle'});
   const startText=await p.locator('body').innerText();
   if(!startText.includes('通过前不开放学习能力')) throw new Error('missing no-learning adult boundary');
   await p.screenshot({path:path.join(evidence,'screenshots',name+'_start.png'),fullPage:false});
   const startRegister=p.locator('.start-action [data-register-entry]');
   await startRegister.click();await p.waitForURL(u=>u.pathname==='/register'&&u.port==='18180');
   result.interactions.push({viewport:name,flow:'start primary -> actual learner registration',after:p.url(),adultNoLearningBoundaryVisible:true,registerSubmitExercised:false});
   await p.goto(origin+'/start',{waitUntil:'networkidle'});
   const sample=p.locator('[data-sample-entry]');await sample.click();await p.waitForURL('**/#practice-example');
   result.interactions.push({viewport:name,flow:'retained secondary sample',after:p.url(),sampleVisible:await p.locator('#practice-example').isVisible()});
   await p.goto(origin+'/courses',{waitUntil:'networkidle'});
   const courses=p.locator('.published-courses');
   if(!(await courses.innerText()).includes('课程准备中')) throw new Error('missing course-specific empty message');
   await courses.screenshot({path:path.join(evidence,'screenshots',name+'_course_empty.png')});
   const courseAction=courses.locator('.public-status a');await courseAction.click();await p.waitForURL(u=>u.pathname==='/register'&&u.port==='18180');
   result.interactions.push({viewport:name,flow:'real empty course projection -> register',after:p.url(),coursePreparingCopyVisible:true,registerSubmitExercised:false});
   // Browser-local simulated failed public read; never changes Gateway or source data.
   const realProjection=JSON.parse(fs.readFileSync(path.join(evidence,'..','R1-001-current-source','public-projection.json'),'utf8'));
   await context.route('**/api/public-projection?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...realProjection,state:'error',source:'empty-fallback',stale:false,errorCode:'PUBLIC_PROJECTION_UNAVAILABLE'})}));
   await p.goto(origin+'/courses',{waitUntil:'networkidle'});
   const retry=p.locator('.published-courses .public-status button');await retry.waitFor({state:'visible'});
   const errorText=await p.locator('.published-courses .public-status').innerText();
   if(errorText.includes('课程准备中')||!errorText.includes('无法加载')) throw new Error('error incorrectly presented as empty');
   await retry.click();
   result.interactions.push({viewport:name,flow:'simulated public read error -> retry retained',simulated:true,errorText,errorIsNotEmpty:true,retryClicked:true});
   await context.close();
  }
 }catch(e){result.failure=String(e.stack||e);process.exitCode=1;}finally{await browser.close();fs.writeFileSync(path.join(evidence,'browser-observation.json'),JSON.stringify(result,null,2)+'\n');}
})();
