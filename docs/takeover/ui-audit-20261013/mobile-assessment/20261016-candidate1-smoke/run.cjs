const f = require('../20261016-review-prep/fixture.cjs');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const OUT = __dirname;
const report = { at: new Date().toISOString(), scope: 'MB006_CANDIDATE1_NARROW_SYNTHETIC_H5_SMOKE', quotaBefore: { fiveHour: 82, week: 44, ordinaryUsageAllowed: true }, sourceHashesBefore: f.hashes(), checks: [], states: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ ...report, transport: f.report }, null, 2));
let current;
async function record(name) {
  f.frozen();
  const page=current.page;
  const facts = await page.evaluate(async () => {
    const root=document.getElementById('assessment-page'), api=await import('/src/platform/v2-foundation.ts');
    return { route:location.hash.split('?')[0], title:document.title, locale:api.mobileI18n.locale, theme:api.mobileThemeController.resolvedTheme, heading:document.getElementById('assessment-title')?.textContent, text:root?.innerText, busy:root?.getAttribute('aria-busy'), error:document.getElementById('assessment-error')?.textContent, reportVisible:!!document.getElementById('assessment-report'), questionVisible:!!document.getElementById('assessment-question'), retestConfirmation:!!document.getElementById('assessment-retest-confirmation'), options:[...root.querySelectorAll('.assessment-option')].map(n=>({id:n.id,pressed:n.getAttribute('aria-pressed'),disabled:n.hasAttribute('disabled'),text:n.innerText})), progress:root.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow'), controls:[...root.querySelectorAll('uni-button')].map(n=>({id:n.id,text:n.innerText,disabled:n.hasAttribute('disabled')})), overlay:!!document.querySelector('vite-error-overlay'), overflow:document.documentElement.scrollWidth>innerWidth+1, rawKey:/mobile\.assessment\.|assessment\.[a-zA-Z]+|\{(?:count|total|current|score|full)\}/.test(root?.innerText||'') };
  });
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:path.join(OUT,name+'.png'),fullPage:true});
  report.states.push({name,facts,counts:{...current.state.counts}});save();
}
const check = (name) => {report.checks.push({name,result:'PASS'});save()};
(async()=>{
 try{
  assert.equal(report.sourceHashesBefore['apps/mobile/src/pages/assessment/assessment.vue'],'d1b501e33b313679bd5c90dd8fcda8e9a5a6b790856a444b01e915523827366a');
  assert.equal(report.sourceHashesBefore['packages/i18n/src/mobile-experience.ts'],'d55f74003bdbe9eae58858ab51bc52d806d2b07e5b06a05e68a183768291249d');
  f.freeze(report.sourceHashesBefore);save();await f.init();
  current=await f.fresh(); const p=current.page;
  await p.locator('#assessment-guide').waitFor();await p.locator('#assessment-page[aria-busy=false]').waitFor();
  await record('01-guide-zh-light-390');check('normal-login-guard-guide-zero-start');assert.equal(current.state.counts.start,0);
  await p.locator('#assessment-start').click();await p.locator('#assessment-question').waitFor();await p.locator('#assessment-page[aria-busy=false]').waitFor();
  await p.locator('#assessment-option-A').click();assert.equal(await p.locator('#assessment-option-A').getAttribute('aria-pressed'),'true');assert.match(await p.locator('#assessment-option-A').innerText(),/已选/);
  await record('02-selected-zh-light-390');check('real-option-A-selected-readable-and-pressed');
  current.state.responseError=true;await p.locator('#assessment-submit').click();await p.locator('#assessment-error').waitFor();await p.locator('#assessment-page[aria-busy=false]').waitFor();
  assert.equal(await p.locator('#assessment-option-A').getAttribute('aria-pressed'),'true');assert.equal(current.state.counts.respond,1);assert.equal(current.state.projection?.sequence,undefined);
  await record('03-submit503-retained-choice');check('response503-preserves-A-with-visible-local-error');
  current.state.responseError=false;const getBefore=current.state.counts.placementGet;await p.locator('#assessment-reload-answer').click();await p.locator('#assessment-submit').waitFor();await p.locator('#assessment-page[aria-busy=false]').waitFor();
  assert.equal(await p.locator('#assessment-option-A').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('[role=progressbar]').getAttribute('aria-valuenow'),'0');assert.equal(current.state.counts.placementGet,getBefore+1);assert.equal(current.state.counts.start,1);
  await record('04-readback-same-question-retained-choice');check('same-session-GET-preserves-choice-no-new-start');
  for(let n=1;n<=10;n++){
   if(n>1)await p.locator('#assessment-option-A').click();
   await p.locator('#assessment-submit').click();
   if(n<10){await p.getByText(`第 ${n+1} 题，共 10 题`,{exact:true}).waitFor();await p.locator('#assessment-page[aria-busy=false]').waitFor();}
   else {await p.locator('#assessment-report').waitFor();await p.locator('#assessment-page[aria-busy=false]').waitFor();}
  }
  assert.equal(current.state.counts.start,1);assert.equal(current.state.counts.respond,11);assert.equal(current.state.counts.ensure,1);assert.match(await p.locator('#assessment-report').innerText(),/A2/);
  await record('05-assessed-after-ten-real-submits');check('ten-successful-submits-assessed-report-one-ensure');
  await p.locator('#assessment-retest').click();await p.locator('#assessment-retest-confirmation').waitFor();assert.equal(current.state.counts.retest,0);
  await record('06-retest-confirm-zero-write');await p.locator('#assessment-retest-cancel').click();assert.equal(await p.locator('#assessment-retest-confirmation').count(),0);assert.equal(current.state.counts.retest,0);check('ask-and-cancel-retest-zero-write');
  await p.locator('#assessment-retest').click();await p.locator('#assessment-retest-confirmation').waitFor();current.state.retestError=true;await p.locator('#assessment-retest-confirm').click();await p.locator('#assessment-error').waitFor();await p.locator('#assessment-page[aria-busy=false]').waitFor();
  assert.equal(current.state.counts.retest,1);assert.equal(await p.locator('#assessment-report').count(),1);assert.match(await p.locator('#assessment-report').innerText(),/A2/);assert.match(await p.locator('#assessment-error').innerText(),/重测没有开出新题/);
  await record('07-retest503-old-report-visible');await p.locator('#assessment-retest-cancel').click();assert.equal(current.state.counts.retest,1);check('retest503-shows-error-keeps-old-report-cancel-unlocks');
  await current.close();current=await f.fresh({locale:'en-US',theme:'dark',width:390,height:844});await current.page.locator('#assessment-guide').waitFor();await current.page.locator('#assessment-page[aria-busy=false]').waitFor();
  await record('08-guide-en-dark-390');const en=report.states.at(-1).facts;assert.equal(en.locale,'en-US');assert.equal(en.theme,'dark');assert.equal(en.rawKey,false);assert.equal(/[\u3400-\u9fff]/.test(en.text),false);check('en-dark-guide-no-Chinese-body-or-raw-keys');
  assert.equal(f.report.unexpected.length,0);assert.equal(f.report.pageErrors.length,0);f.frozen();report.completed=true;
 }catch(error){report.failure={message:error.message,stack:error.stack};try{if(current)await record('FAIL-original');}catch(capture){report.captureFailure=capture.message;}process.exitCode=1;}
 finally{await f.close();report.closed=true;report.sourceHashesAfter=f.hashes();report.sourceStable=JSON.stringify(report.sourceHashesBefore)===JSON.stringify(report.sourceHashesAfter);save();}
})();
