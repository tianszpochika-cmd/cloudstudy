const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');
const folder=path.resolve('docs/06-design/v2-980plus/mobile-experience-proposal-2026-09-20');
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:2040,height:1250}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const checks=[];
 const action=(a,to)=>page.locator(`#single-phone [data-action="${a}"]${to===undefined?'':`[data-to="${to}"]`}`).first();
 const go=async n=>page.locator(`#screen-picker [data-to="${n}"]`).click();
 const ensure=(ok,msg)=>{if(!ok)throw new Error(msg);checks.push(msg)};
 await page.goto('http://127.0.0.1:18185/');await page.locator('.phone').first().waitFor();
 const layouts=[];
 for(const theme of ['light','dark']){
  await page.locator(`[data-theme-choice="${theme}"]`).click();
  for(const group of ['community','learning']){
   await page.locator(`[data-group="${group}"]`).click();
   await page.screenshot({path:path.join(folder,`mobile-${group}-${theme}.png`),fullPage:true});
   layouts.push(...await page.locator('.phone').evaluateAll((ps,t)=>ps.map(p=>({theme:t,screen:p.dataset.screen,width:p.clientWidth,overflow:p.scrollWidth>p.clientWidth,contentOverflow:p.querySelector('.screen-scroll').scrollWidth>p.querySelector('.screen-scroll').clientWidth})),theme));
  }
 }
 ensure(layouts.every(l=>!l.overflow&&!l.contentOverflow),'ten-pages-both-themes-no-horizontal-overflow');
 await page.locator('[data-mode="single"]').click();await page.setViewportSize({width:1200,height:1200});
 for(const theme of ['light','dark']){
  await page.locator(`[data-theme-choice="${theme}"]`).click();
  for(const [n,name] of [[0,'home'],[6,'world'],[7,'me']]){await go(n);await page.locator('#single-phone').screenshot({path:path.join(folder,`mobile-${name}-${theme}.png`)});}
 }
 await go(7);await action('goal').click();await action('set-goal',30).click();
 ensure((await page.locator('#single-phone .goal-card').innerText()).includes('30 分钟'),'daily-goal-changes-on-profile');
 await action('nav',0).click();ensure((await page.locator('#single-phone .hero').innerText()).includes('30 分钟'),'daily-goal-propagates-to-home');
 await action('nav',6).click();await action('planet',3).click();await page.locator('[role="dialog"]').waitFor();await action('go',3).click();
 ensure(await page.locator('#single-phone [data-screen="3"]').count()===1,'world-node-links-to-listening');
 await go(5);await action('duration',45).click();await action('start-focus').click();
 await page.waitForTimeout(1100);ensure((await page.locator('#single-phone [data-focus-time]').innerText())!=='45:00','focus-timer-advances');
 await action('encourage','一起加油').click();ensure((await page.locator('#single-phone .encourage').innerText()).includes('你：一起加油'),'preset-encouragement-updates');
 await action('stop-focus').click();await action('dismiss').click();ensure(await action('stop-focus').count()===1,'cancel-early-exit-keeps-session');
 await action('stop-focus').click();await action('end-focus').click();ensure(await action('start-focus').count()===1,'early-exit-resets-seat-without-credit');
 await go(8);ensure(await action('train-check').isDisabled(),'incomplete-sentence-cannot-submit');
 await action('train-word','please').click();await action('remove-word',0).click();ensure(await page.locator('#single-phone .train-answer button').count()===0,'sentence-word-removal');
 for(const word of ['please','Could','I','have','a','latte'])await action('train-word',word).click();await action('train-check').click();
 ensure((await page.locator('#single-phone .answer-feedback').innerText()).includes('再看看'),'incorrect-sentence-feedback');
 await action('train-reset').click();for(const word of ['Could','I','have','a','latte','please'])await action('train-word',word).click();await action('train-check').click();
 ensure(await page.locator('#single-phone .answer-feedback.correct').count()===1,'correct-sentence-explanation');
 await go(7);await action('profile').click();await page.locator('#nickname-input').fill('追光者');await action('save-profile').click();ensure((await page.locator('#single-phone .profile-intro').innerText()).includes('追光者'),'profile-edit-updates');
 await action('avatar').click();await action('set-avatar','moon').click();ensure(await page.locator('#single-phone .avatar-orb.moon').count()===1,'avatar-selection');
 for(const a of ['calendar','wordbook','achievements','benefits','downloads']){await action(a).click();await page.locator('[role="dialog"]').waitFor();await action('dismiss').click();}checks.push('profile-detail-sheets');
 await go(9);await action('theme','light').click();ensure(await page.locator('html').getAttribute('data-theme')==='light','settings-theme-updates-whole-prototype');
 await action('reminder').click();ensure(await page.locator('#single-phone [aria-label="学习提醒"]').getAttribute('aria-checked')==='false','reminder-switch');
 await action('privacy').click();await action('leaderboard').click();ensure(await page.locator('#single-phone [aria-label="参与学习榜"]').getAttribute('aria-checked')==='false','leaderboard-opt-out');
 await action('dismiss').click();await go(6);await action('ranking').click();ensure(!(await page.locator('[role="dialog"]').innerText()).includes('追光者'),'opt-out-removes-demo-profile-from-ranking');await action('dismiss').click();
 for(const a of ['security','privacy','downloads','help']){await go(9);await action(a).click();await page.locator('[role="dialog"]').waitFor();await action('dismiss').click();}checks.push('account-detail-sheets');
 await go(0);await action('review').click();for(let i=0;i<3;i++){await action('reveal').click();await page.locator('#single-phone [data-action="rate"][data-rating="2"]').click();}await action('next-listen').click();await action('translation').click();ensure(await page.locator('#single-phone .translation').count()===0,'learning-translation-toggle');await action('finish').click();await action('home-done').click();ensure((await page.locator('#single-phone .hero').innerText()).includes('今日计划已完成'),'existing-learning-flow-still-completes');
 await page.locator('[data-theme-choice="dark"]').click();await page.reload();ensure(await page.locator('html').getAttribute('data-theme')==='dark','theme-persists-after-reload');
 await page.locator('[data-mode="single"]').click();const narrow=[];
 for(const width of [390,320]){await page.setViewportSize({width,height:1100});for(let n=0;n<10;n++){await go(n);const layout=await page.evaluate(()=>{const p=document.querySelector('#single-phone .phone');const s=p.querySelector('.screen-scroll');return {screen:p.dataset.screen,width:innerWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth,phoneOverflow:p.scrollWidth>p.clientWidth,contentOverflow:s.scrollWidth>s.clientWidth}});narrow.push(layout);}}
 ensure(narrow.every(x=>!x.pageOverflow&&!x.phoneOverflow&&!x.contentOverflow),'all-ten-pages-at-320-and-390-width');
 ensure(!errors.length,'no-browser-script-errors');
 const result={classification:'design-prototype-only-not-product-runtime-evidence',date:'2026-09-20',themes:['light','dark'],screenCount:10,checks,errors,layouts,narrow};fs.writeFileSync(path.join(folder,'preview-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({checks,errors},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
