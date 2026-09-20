// Exercises the isolated design prototype, not live learner accounts or services.
const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');
const folder=path.resolve('docs/06-design/v2-980plus/mobile-experience-proposal-2026-09-20');
// Windows file preview/indexing may briefly hold an existing PNG open.
async function writeArtifact(destination,buffer){
 for(let attempt=0;;attempt++){
  try{await fs.promises.writeFile(destination,buffer);return;}
  catch(error){if(attempt>=3||!['EBUSY','EPERM','EACCES','UNKNOWN'].includes(error.code))throw error;await new Promise(resolve=>setTimeout(resolve,300));}
 }
}
async function capture(target,options){
 const {path:destination,...screenshotOptions}=options;
 await writeArtifact(destination,await target.screenshot(screenshotOptions));
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
 const page=await browser.newPage({viewport:{width:2040,height:1250}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const checks=[];
 const action=(a,to)=>page.locator(`#single-phone [data-action="${a}"]${to===undefined?'':`[data-to="${to}"]`}`).first();
 const go=async n=>page.locator(`#screen-picker [data-to="${n}"]`).click();
 const screen=async n=>await page.locator(`#single-phone .phone[data-screen="${n}"]`).count()===1;
 const ensure=(ok,msg)=>{if(!ok)throw new Error(msg);checks.push(msg)};
 const rate=async n=>{await action('reveal').click();await page.locator(`#single-phone [data-action="rate"][data-rating="${n}"]`).click()};
 const reset=async()=>page.locator('#reset-demo').click();
 const seek=async seconds=>page.locator('#single-phone [data-audio-seek]').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},seconds);
 await page.goto('http://127.0.0.1:18185/?design=experience-v4');await page.locator('.phone').first().waitFor();
 const layouts=[];
 for(const theme of ['light','dark']){
  await page.locator(`[data-theme-choice="${theme}"]`).click();
  for(const group of ['learning','community']){
   await page.locator(`[data-group="${group}"]`).click();
   await capture(page,{path:path.join(folder,`mobile-${group}-${theme}.png`),fullPage:true});
   layouts.push(...await page.locator('.phone').evaluateAll((ps,t)=>ps.map(p=>({theme:t,screen:p.dataset.screen,width:p.clientWidth,overflow:p.scrollWidth>p.clientWidth,contentOverflow:p.querySelector('.screen-scroll').scrollWidth>p.querySelector('.screen-scroll').clientWidth})),theme));
  }
 }
 ensure(layouts.length===20&&layouts.every(l=>!l.overflow&&!l.contentOverflow),'ten-pages-both-themes-no-horizontal-overflow');
 await page.locator('[data-mode="single"]').click();await page.setViewportSize({width:1200,height:1200});
 for(const theme of ['light','dark']){
  await page.locator(`[data-theme-choice="${theme}"]`).click();
  for(const [n,name] of [[0,'home'],[6,'world'],[7,'me']]){await go(n);await capture(page.locator('#single-phone'),{path:path.join(folder,`mobile-${name}-${theme}.png`)});}
 }
 await reset();await action('start-learning').click();ensure(await screen(2),'home-start-is-one-tap');
 await action('save-word').click();await action('reveal').click();
 await page.locator('[data-theme-choice="light"]').click();
 await capture(page.locator('#single-phone'),{path:path.join(folder,'mobile-v4-vocabulary-revealed.png')});
 await page.locator('#single-phone [data-action="rate"][data-rating="0"]').click();
 ensure((await page.locator('#single-phone .page-title').innerText()).includes('2 / 3'),'rating-advances-to-next-card');
 await action('undo-rating').click();ensure((await page.locator('#single-phone .page-title').innerText()).includes('1 / 3'),'rating-can-be-undone');
 ensure(await action('save-word').getAttribute('aria-pressed')==='true','bookmark-survives-card-undo');
 await action('exit').click();ensure(await screen(0)&&await page.locator('#single-phone [role="dialog"]').count()===0,'exit-is-one-tap-without-confirmation');
 await action('start-learning').click();ensure(await screen(2)&&await action('reveal').count()===0,'resume-keeps-card-and-reveal-state');
 await page.locator('#single-phone [data-action="rate"][data-rating="0"]').click();await rate(2);await rate(3);
 ensure(await screen(3)&&await page.locator('#single-phone [role="dialog"]').count()===0,'final-card-automatically-opens-listening');
 await action('undo-rating').click();ensure((await page.locator('#single-phone .page-title').innerText()).includes('3 / 3'),'last-card-can-be-undone-from-listening');
 await page.locator('#single-phone [data-action="rate"][data-rating="3"]').click();
 await action('seek-sentence',2).click();ensure((await page.locator('#single-phone [data-time]').innerText())==='00:47','tapping-sentence-seeks-directly');
 ensure((await action('play').getAttribute('aria-label')).startsWith('暂停'),'sentence-tap-starts-simulated-player');
 await action('play').click();await seek(30);ensure((await page.locator('#single-phone [data-time]').innerText())==='00:30','scrubber-seeks-to-chosen-time');
 await action('speed').click();await action('audio-speed',1.5).click();ensure((await action('speed').innerText()).includes('1.5×'),'speed-is-directly-selectable');
 await action('translation').click();ensure(await page.locator('#single-phone .translation').count()===0,'translation-toggle');await action('translation').click();
 await action('loop').click();await seek(46);await action('play').click();await page.waitForTimeout(1200);await action('play').click();
 const loopTime=await page.locator('#single-phone [data-time]').innerText();ensure(loopTime==='00:18'||loopTime==='00:19','single-sentence-loop-returns-to-sentence-start');
 await action('loop').click();await seek(32);await action('exit').click();await action('start-learning').click();
 ensure(await screen(3)&&(await page.locator('#single-phone [data-time]').innerText())==='00:32','home-resumes-listening-at-retained-position');
 await capture(page.locator('#single-phone'),{path:path.join(folder,'mobile-v4-listening.png')});
 await action('finish').click();
 ensure((await page.locator('#single-phone .result-stats').innerText()).replace(/\s/g,'')==='3个词汇已复习1段对话已精听1个还需巩固','report-uses-current-session-counts');
 await capture(page.locator('#single-phone'),{path:path.join(folder,'mobile-v4-report-complete.png')});
 await action('review-weak').click();ensure((await page.locator('#single-phone .page-title').innerText()).includes('1 / 1'),'weak-review-only-contains-weak-words');
 await rate(3);ensure(await screen(4),'weak-review-finishes-without-repeating-listening');
 ensure((await page.locator('#single-phone .result-stats').innerText()).replace(/\s/g,'')==='3个词汇已复习1段对话已精听0个还需巩固','weak-review-updates-original-session-without-double-counting');
 await action('home-done').click();ensure((await page.locator('#single-phone .hero').innerText()).includes('今日计划已完成'),'completed-session-returns-to-completed-home');
 await action('go',3).click();ensure(await screen(3),'home-course-shortcut-opens-listening-directly');
 await go(1);await action('go',3).click();ensure(await screen(3),'course-next-unit-opens-listening-directly');
 await reset();await go(3);await action('finish').click();await action('home-done').click();await action('start-learning').click();ensure(await screen(2),'listening-only-completion-resumes-unfinished-vocabulary');
 await rate(2);await rate(2);await rate(2);ensure(await screen(4),'finishing-remaining-vocabulary-does-not-repeat-completed-listening');
 await go(3);await seek(96);await action('play').click();ensure((await page.locator('#single-phone [data-time]').innerText())==='00:00','play-at-track-end-restarts-from-beginning');await action('play').click();
 await go(6);await action('duration',45).click();await action('join-now').click();ensure(await screen(5)&&await action('pause-focus').count()===1,'world-start-joins-and-starts-focus-in-one-tap');
 await page.waitForTimeout(1200);ensure((await page.locator('#single-phone [data-focus-time]').innerText())!=='45:00','focus-timer-advances');
 await action('pause-focus').click();const paused=await page.locator('#single-phone [data-focus-time]').innerText();await page.waitForTimeout(1200);ensure(await page.locator('#single-phone [data-focus-time]').innerText()===paused,'paused-focus-retains-time');
 await go(6);ensure(await action('duration',25).isDisabled(),'running-or-paused-focus-locks-duration');await action('join-now').click();
 ensure(await page.locator('#single-phone [data-focus-time]').innerText()===paused,'world-return-preserves-paused-focus');await action('pause-focus').click();await page.waitForTimeout(1200);ensure(await page.locator('#single-phone [data-focus-time]').innerText()!==paused,'focus-resumes-instead-of-restarting');
 await action('encourage','一起加油').click();ensure((await page.locator('#single-phone .encourage').innerText()).includes('你：一起加油'),'preset-encouragement-updates');
 await action('stop-focus').click();await action('dismiss').click();ensure(await action('pause-focus').count()===1,'cancel-focus-exit-keeps-session');
 await action('stop-focus').click();await action('end-focus').click();ensure(await action('start-focus').count()===1,'confirmed-focus-exit-returns-to-ready-state');
 await go(8);ensure(await action('undo-word').isDisabled(),'empty-puzzle-disables-undo');
 for(const word of ['please','Could','I','have','a','latte'])await action('train-word',word).click();
 ensure(await page.locator('#single-phone .answer-feedback.retry').count()===1,'completed-wrong-sentence-auto-checks-without-submit');
 await action('remove-word',0).click();await action('train-word','please').click();
 ensure(await page.locator('#single-phone .answer-feedback.correct').count()===1,'incorrect-sentence-can-be-corrected-without-reset');
 await action('next-puzzle').click();await action('puzzle-hint').click();ensure(await page.locator('#single-phone .hint-answer').count()===1,'next-puzzle-has-optional-hint');
 await action('train-word','I').click();await action('undo-word').click();ensure(await page.locator('#single-phone .train-answer button').count()===0,'puzzle-undo-removes-last-word');
 for(const word of ['I','would','like','a','tea'])await action('train-word',word).click();await action('next-puzzle').click();ensure(await screen(6),'second-puzzle-finishes-back-at-world');
 await go(7);await action('goal').click();await action('set-goal',30).click();ensure((await page.locator('#single-phone .goal-strip').innerText()).includes('30 分钟'),'goal-changes-directly-on-profile');
 await action('nav',0).click();ensure((await page.locator('#single-phone .hero').innerText()).includes('30 分钟'),'goal-propagates-to-home');
 await go(7);await action('profile').click();await page.locator('#nickname-input').fill('追光者');await action('save-profile').click();ensure((await page.locator('#single-phone .profile-intro').innerText()).includes('追光者'),'profile-edit-updates');
 await action('avatar').click();await action('set-avatar','moon').click();ensure(await page.locator('#single-phone .avatar-orb.moon').count()===1,'avatar-selection');
 for(const a of ['calendar','wordbook','achievements','benefits','downloads']){await action(a).click();await page.locator('#single-phone [role="dialog"]').waitFor();await action('dismiss').click();}checks.push('profile-detail-sheets');
 await go(9);await action('set-accent','英式').click();ensure(await action('set-accent','英式').getAttribute('aria-pressed')==='true','accent-updates-inline-without-dialog');
 await action('reminder').click();ensure(await action('reminder').getAttribute('aria-checked')==='false','reminder-switch');
 await action('privacy').click();await action('leaderboard').click();ensure(await action('leaderboard').getAttribute('aria-checked')==='false','leaderboard-opt-out');
 await action('dismiss').click();await go(6);await action('ranking').click();ensure(!(await page.locator('#single-phone [role="dialog"]').innerText()).includes('追光者'),'opt-out-removes-demo-profile-from-ranking');await page.keyboard.press('Escape');ensure(await page.locator('#single-phone [role="dialog"]').count()===0,'escape-closes-detail-sheet');
 for(const a of ['security','privacy','downloads','help']){await go(9);await action(a).click();await page.locator('#single-phone [role="dialog"]').waitFor();await action('dismiss').click();}checks.push('account-detail-sheets');
 await go(7);await action('quick-theme').click();ensure(await page.locator('html').getAttribute('data-theme')==='dark','profile-theme-switch-is-one-tap');
 await page.reload();ensure(await page.locator('html').getAttribute('data-theme')==='dark','theme-persists-after-reload');
 await page.locator('[data-mode="single"]').click();const narrow=[];
 for(const theme of ['light','dark']){
  await page.locator(`[data-theme-choice="${theme}"]`).click();
  for(const width of [390,320]){await page.setViewportSize({width,height:1000});for(let n=0;n<10;n++){await go(n);const layout=await page.evaluate(()=>{const p=document.querySelector('#single-phone .phone');const s=p.querySelector('.screen-scroll');return {theme:document.documentElement.dataset.theme,screen:p.dataset.screen,width:innerWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth,phoneOverflow:p.scrollWidth>p.clientWidth,contentOverflow:s.scrollWidth>s.clientWidth}});narrow.push(layout);}}
 }
 ensure(narrow.length===40&&narrow.every(x=>!x.pageOverflow&&!x.phoneOverflow&&!x.contentOverflow),'ten-pages-both-themes-at-320-and-390-width');
 ensure(!errors.length,'no-browser-script-errors');
 const result={classification:'design-prototype-only-not-product-runtime-evidence',revision:'experience-v4',date:'2026-09-20',themes:['light','dark'],screenCount:10,checks,errors,layouts,narrow};
 await writeArtifact(path.join(folder,'preview-check.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({revision:result.revision,checkCount:checks.length,checks,errors},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
