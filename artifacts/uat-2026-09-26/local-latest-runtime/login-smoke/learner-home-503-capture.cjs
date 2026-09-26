const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const out=path.resolve('artifacts/uat-2026-09-26/local-latest-runtime/login-smoke');
const id='codex-'+crypto.randomBytes(10).toString('hex')+'@local.invalid';
const pw='Invalid-'+crypto.randomBytes(18).toString('base64url')+'!';
const result={generatedAt:new Date().toISOString(),credentialsRecorded:false,accountType:'random synthetic @local.invalid',responses:[],learnerHome503:[],webLogout:null};
function extractSafeBody(json){
 const e=json&&typeof json==='object'?(json.error??json):{};
 const safe={};
 for(const k of ['code','errorCode','message','requestId','traceId','timestamp']){
  if(typeof e[k]==='string'||typeof e[k]==='number'){
   let v=String(e[k]).slice(0,300);
   if(k==='message')v=v.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,'[email]');
   safe[k]=v;
  }
 }
 return safe;
}
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--no-sandbox']});let c;try{
 c=await b.newContext({viewport:{width:1280,height:900}});const p=await c.newPage();
 p.on('response',async r=>{const u=new URL(r.url());if(!u.pathname.startsWith('/api/v1/'))return;const x={path:u.pathname,status:r.status()};result.responses.push(x);if(u.pathname==='/api/v1/learner/home'&&r.status()>=500){x.requestIdHeader=r.headers()['x-request-id']??r.headers()['request-id']??null;x.traceIdHeader=r.headers()['x-trace-id']??null;let j=null;try{j=await r.json()}catch{};x.error=extractSafeBody(j);result.learnerHome503.push(x)}});
 await p.goto('http://127.0.0.1:18180/register?redirect=%2Fhome',{waitUntil:'domcontentloaded',timeout:30000});
 await p.locator('input[autocomplete="username"]').fill(id,{timeout:10000});await p.locator('input[name="password"]').fill(pw,{timeout:10000});await p.locator('input[name="confirm"]').fill(pw,{timeout:10000});await p.locator('form button[type="submit"]').click();
 await p.waitForFunction(()=>location.pathname==='/onboarding'||Boolean(document.querySelector('[role="alert"]')),null,{timeout:15000}).catch(()=>{});
 if(!p.url().includes('/onboarding'))throw new Error('registration gate did not appear');
 await p.locator('#adult-birth-year').fill('1990');const checks=p.locator('.consent-list input[type="checkbox"]');for(let i=0;i<await checks.count();i++)await checks.nth(i).check();
 await p.locator('form.setup-card button[type="submit"]').click();
 await p.waitForFunction(()=>document.body.innerText.includes('你想先解决什么？')||Boolean(document.querySelector('[role="alert"]')),null,{timeout:12000}).catch(()=>{});
 if(!((await p.locator('body').innerText()).includes('你想先解决什么？')))throw new Error('adult gate did not advance');
 await p.locator('.choice').first().click();await p.getByRole('button',{name:'保存并开始测评'}).click();
 await p.waitForFunction(()=>location.pathname==='/assessment'||Boolean(document.querySelector('[role="alert"]')),null,{timeout:12000}).catch(()=>{});
 await p.evaluate(()=>{history.pushState({},'','/home');dispatchEvent(new PopStateEvent('popstate'))});
 await p.waitForTimeout(9000);
 result.finalPath=new URL(p.url()).pathname;
 result.homeView=await p.evaluate(()=>({headings:[...document.querySelectorAll('h1,h2')].map(x=>x.innerText.trim()).filter(Boolean).slice(0,5),alert:[...document.querySelectorAll('[role=alert]')].map(x=>x.innerText.trim()).filter(Boolean).join(' ').slice(0,250),bodyText:(document.body?.innerText??'').replace(/\s+/g,' ').trim().slice(0,600)}));
 if(result.finalPath==='/home')await p.screenshot({path:path.join(out,'learner-home-503-response.png'),fullPage:true});
 await p.evaluate(()=>{history.pushState({},'','/settings/profile');dispatchEvent(new PopStateEvent('popstate'))});await p.waitForTimeout(700);
 await p.getByRole('button',{name:/退出登录|登出/}).last().click({timeout:5000}).catch(()=>{});await p.waitForTimeout(700);
 result.webLogout={status:result.responses.findLast(x=>x.path==='/api/v1/auth/logout')?.status??null,finalPath:new URL(p.url()).pathname};
 fs.writeFileSync(path.join(out,'learner-home-503.json'),JSON.stringify(result,null,2),'utf8');
 console.log(JSON.stringify(result,null,2));
 }catch(e){result.testError=String(e.message||e).slice(0,200);fs.writeFileSync(path.join(out,'learner-home-503.json'),JSON.stringify(result,null,2),'utf8');console.log(JSON.stringify(result,null,2))}
 finally{if(c)await c.close().catch(()=>{});await b.close()}})().catch(e=>{console.error(String(e.message||e).slice(0,250));process.exitCode=1});
