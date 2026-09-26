const { chromium } = require('playwright');
(async () => {
 const b = await chromium.launch({ headless: true, executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe', args: ['--no-sandbox'] });
 try {
  for (const [name, url] of [['learner','http://127.0.0.1:18180/login'],['admin','http://127.0.0.1:18181/login'],['official','http://127.0.0.1:18182/'],['mobile','http://127.0.0.1:18183/#/pages/login/login']]) {
   const p = await b.newPage({ viewport: { width: 1280, height: 844 } });
   const events = [];
   p.on('console', m => { if (m.type() === 'error') events.push({type:'console', text:m.text().slice(0,200), location:m.location()}); });
   p.on('request', req => { if (/favicon|\.ico|\.png|\.svg/i.test(req.url())) events.push({type:'request', url:req.url().split('?')[0]}); });
   p.on('response', r => { if (r.status() >= 400) events.push({type:'response', status:r.status(), url:r.url().split('?')[0]}); });
   p.on('requestfailed', req => events.push({type:'failed', url:req.url().split('?')[0], error:req.failure()?.errorText}));
   await p.goto(url, { waitUntil:'domcontentloaded', timeout:30000 }).catch(()=>{});
   await p.waitForTimeout(2500);
   process.stdout.write(JSON.stringify({name, events}) + '\n');
   await p.close();
  }
 } finally { await b.close(); }
})().catch(e => { process.stderr.write(String(e.stack||e)+'\n'); process.exitCode=1; });
