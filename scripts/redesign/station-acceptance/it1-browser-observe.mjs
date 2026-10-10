import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import https from 'node:https';
import {join} from 'node:path';
const root=process.cwd(),evidence=join(root,'evidence/redesign/2026-10-10/station-acceptance/it1');
const environment=JSON.parse(readFileSync(join(evidence,'environment.json')));
const result={kind:'IT1_REAL_BROWSER_BLOCKED_TRANSPORT',at:new Date().toISOString(),sourceHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:null,observations:[],protectedRequests:[],cors:[],failures:[]};
const screenshotDir=join(evidence,'screenshots');mkdirSync(screenshotDir,{recursive:true});
async function preflight(origin) {
 return await new Promise((resolve,reject)=>{const request=https.request('https://127.0.0.1:18087/api/v1/auth/register',{method:'OPTIONS',ca:readFileSync(join(environment.directory,'test-ca.pem')),rejectUnauthorized:true,headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,idempotency-key,x-auth-transport'}},response=>{response.resume();resolve({origin,destination:'https://127.0.0.1:18087/api/v1/auth/register',status:response.statusCode,allowOrigin:response.headers['access-control-allow-origin']??null,allowCredentials:response.headers['access-control-allow-credentials']??null,allowMethods:response.headers['access-control-allow-methods']??null});});request.on('error',reject);request.end();});
}
for(const origin of ['http://127.0.0.1:18180','http://127.0.0.1:18183']) result.cors.push(await preflight(origin));
const browser=await chromium.launch({headless:true,channel:'chrome'});result.browser=browser.version();
try {
 for(const [name,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]) {
  for(const [app,url] of [['web','http://127.0.0.1:18180/register'],['h5','http://127.0.0.1:18183/#/pages/register/register']]) {
   const context=await browser.newContext({viewport,locale:'zh-CN',reducedMotion:'reduce'});
   // Protective abort: no credential body is read, logged, or delivered to Gateway.
   await context.route('**/api/v1/auth/**',async route=>{const request=route.request(),destination=new URL(request.url());if(request.method()==='POST'&&destination.pathname.match(/\/(register|login|password-reset\/(request|confirm))$/)){result.protectedRequests.push({app,viewport:name,method:request.method(),destination:destination.origin+destination.pathname,action:'ABORT_BEFORE_NETWORK',reason:'PASSWORD_AUTH_MUST_BE_DIRECT_IAM_TLS'});await route.abort('blockedbyclient');}else await route.continue();});
   const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
   const response=await page.goto(url,{waitUntil:'networkidle'});
   const before={url:page.url(),status:response.status(),body:await page.locator('body').innerText(),inputs:await page.locator('input').evaluateAll(nodes=>nodes.map(node=>({type:node.type,label:node.getAttribute('aria-label'),placeholder:node.placeholder}))),buttons:await page.getByRole('button').allTextContents()};
   await page.screenshot({path:join(screenshotDir,`${app}-${name}-register-before.png`)});
   const inputs=page.locator('input');
   if(await inputs.count()!==3) throw new Error('Registration inputs missing '+app+' '+name);
   const identifier='synthetic-'+randomBytes(4).toString('hex')+'@example.invalid',password='Aa1!'+randomBytes(16).toString('hex');
   await inputs.nth(0).fill(identifier);await inputs.nth(1).fill(password);await inputs.nth(2).fill(password);
   const submit=page.getByRole('button',{name:'注册并继续',exact:true});
   await submit.click();await page.waitForTimeout(1200);
   const after={url:page.url(),body:await page.locator('body').innerText(),errors};
   await page.screenshot({path:join(screenshotDir,`${app}-${name}-transport-fail.png`),mask:[inputs.nth(0),inputs.nth(1),inputs.nth(2)]});
   result.observations.push({app,viewport:name,before,after,credentialTransmission:'aborted before network',flowResult:'FAIL_AUTH_TRANSPORT',screenshot:`screenshots/${app}-${name}-transport-fail.png`});
   console.log(app,name,'FAIL_AUTH_TRANSPORT',result.protectedRequests.at(-1)?.destination);
   await context.close();
  }
 }
} catch(error) {result.failures.push(error.message);process.exitCode=1;}
finally {await browser.close();const files=['apps/learner-web/src/stores/session.ts','apps/learner-web/src/auth/gateway-auth.ts','apps/learner-web/src/platform/gateway.ts','apps/mobile/src/auth/gateway-auth.ts','apps/mobile/src/api/client.ts','apps/mobile/src/platform/gateway.ts','services/iam-service/src/main/java/com/englishflow/iam/config/IamSecurityConfiguration.java','config/local-ports.json'];result.sources=files.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));writeFileSync(join(evidence,'browser-auth-result.json'),JSON.stringify(result,null,2)+'\n');console.log('CORS',JSON.stringify(result.cors));console.log('WROTE browser-auth-result.json');}
