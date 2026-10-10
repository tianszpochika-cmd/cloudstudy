import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const evidence=join(process.cwd(),'evidence/redesign/2026-10-10/station-acceptance/it1');
const routes=['/','/courses','/pricing','/download','/announcements','/about','/compliance','/status','/privacy','/terms','/minors'];
const result={kind:'IT1_OFFICIAL_REAL_BROWSER',at:new Date().toISOString(),pages:[],cta:[],failures:[]};
const browser=await chromium.launch({headless:true,channel:'chrome'});result.browser=browser.version();
try {
 for(const [name,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]) {
  const context=await browser.newContext({viewport,locale:'zh-CN',reducedMotion:'reduce'});const page=await context.newPage();
  for(const path of routes) {
   const errors=[];const onError=error=>errors.push(error.message);page.on('pageerror',onError);
   const response=await page.goto('http://127.0.0.1:18182'+path,{waitUntil:'networkidle'});
   const text=await page.locator('body').innerText(),filename=`official-${name}-${path.replace(/[^a-z0-9]/gi,'_')||'home'}.png`;
   await page.screenshot({path:join(evidence,'screenshots',filename),fullPage:true});
   result.pages.push({path,viewport:name,status:response.status(),url:page.url(),headings:await page.locator('h1').allTextContents(),body:text,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),frameworkOverlay:await page.locator('vite-error-overlay,#__nuxt_error__').count(),errors,screenshot:'screenshots/'+filename,registerLinks:await page.locator('a').evaluateAll(nodes=>nodes.filter(node=>node.href.includes(':18180/register')).map(node=>({text:node.textContent.trim(),href:node.href}))) });
   page.off('pageerror',onError);console.log('OFFICIAL',name,path,response.status());
  }
  await page.goto('http://127.0.0.1:18182/',{waitUntil:'networkidle'});
  const action=page.locator('.hero-buttons a').first(),label=await action.innerText(),before=await action.getAttribute('href');
  await action.click();await page.waitForURL(url=>url.origin==='http://127.0.0.1:18180'&&url.pathname==='/register');
  await page.locator('input[type=password]').first().waitFor();
  await page.screenshot({path:join(evidence,'screenshots',`official-${name}-cta-register.png`)});
  result.cta.push({viewport:name,label,before,destination:page.url(),registrationVisible:await page.locator('input[type=password]').count()===2,adultCopy:(await page.locator('body').innerText()).includes('18 岁以上'),screenshot:`screenshots/official-${name}-cta-register.png`});
  await context.close();
 }
} catch(error){result.failures.push(error.message);process.exitCode=1;}
finally {await browser.close();writeFileSync(join(evidence,'official-result.json'),JSON.stringify(result,null,2)+'\n');console.log('OFFICIAL_DONE');}
