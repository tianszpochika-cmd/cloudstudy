// Browser verification of the public design proposal; not production evidence.
const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');
const base='http://127.0.0.1:18185/official/';
async function writeArtifact(file,data){for(let n=0;;n++){try{await fs.promises.writeFile(file,data);return}catch(e){if(n===3||!['UNKNOWN','EBUSY','EPERM','EACCES'].includes(e.code))throw e;await new Promise(r=>setTimeout(r,300))}}}
async function capture(page,file,options={}){await page.locator('#toast.show').waitFor({state:'detached',timeout:4000});await writeArtifact(path.join(__dirname,'screenshots',file),await page.screenshot(options))}
(async()=>{
 await fs.promises.mkdir(path.join(__dirname,'screenshots'),{recursive:true});
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const checks=[],errors=[],failedResponses=[],unexpectedRequests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)failedResponses.push({url:r.url(),status:r.status()})});
 page.on('request',r=>{if(r.method()!=='GET'||!r.url().startsWith('http://127.0.0.1:18185/'))unexpectedRequests.push({url:r.url(),method:r.method()})});
 const ok=(condition,name)=>{if(!condition)throw new Error(name);checks.push(name)};
 const a=(name,scope='body')=>page.locator(`${scope} [data-action="${name}"]`).first();
 const go=async route=>{await page.goto(base+'#'+route);await page.locator('#main h1').waitFor()};
 await go('/');
 ok((await page.title()).includes('语学星'),'home-has-contextual-title');
 ok(await page.locator('#main').evaluate(el=>getComputedStyle(el).outlineStyle)==='none','route-focus-does-not-outline-whole-page');
 ok(await page.locator('#main [data-primary]').getAttribute('href')==='#/start','home-primary-action-is-free-start');
 ok(!(await page.locator('body').innerText()).match(/¥39|¥99|终身免费|万名用户|提分|保过|AI 导师|App Store|Google Play/),'home-has-no-unsupported-pricing-results-or-download-claims');
 await a('word-preview').click();ok(await page.locator('dialog').isVisible(),'hero-word-opens-public-example');
 await a('demo-reveal','dialog').click();ok((await page.locator('dialog').innerText()).includes('拿铁咖啡'),'word-reveal-shows-meaning');
 ok(await page.evaluate(()=>document.activeElement.dataset.action)==='demo-rate','reveal-preserves-keyboard-continuity');
 await a('demo-rate','dialog').click();ok((await page.locator('dialog').innerText()).includes('下次再见'),'self-rating-has-feedback');
 await a('demo-next','dialog').click();await a('phrase','dialog').click();ok((await page.locator('dialog').innerText()).includes('打包带走'),'sentence-expression-can-be-revealed');
 await a('demo-next','dialog').click();ok(await page.locator('dialog .review-list>div').count()===3,'example-continues-to-review');
 await a('demo-reset','dialog').click();ok(await a('demo-reveal','dialog').isVisible(),'example-can-reset');
 await page.keyboard.press('Escape');ok(!await page.locator('dialog').isVisible(),'escape-closes-example');
 ok(await page.evaluate(()=>document.activeElement.dataset.action)==='word-preview','dialog-restores-opening-control-focus');
 await page.locator('.desktop-nav a[href="#/courses"]').click();
 ok(await page.locator('.course-card').count()===6,'catalog-lists-six-phase1-learning-types');
 await page.locator('[data-action="filter"][data-value="understand"]').click();ok(await page.locator('.course-card').count()===2,'catalog-filter-reduces-to-two-reading-listening-types');
 await page.locator('#course-search').fill('听力');ok(await page.locator('.course-card').count()===1,'catalog-search-combines-with-filter');
 await page.locator('.course-card').click();ok((await page.locator('#main h1').innerText()).includes('听力精练'),'catalog-card-opens-corresponding-detail');
 await page.locator('.lesson-list details').nth(1).locator('summary').click();ok(await page.locator('.lesson-list details').nth(1).getAttribute('open')!==null,'detail-unit-expands');
 await page.goBack();await page.locator('#course-search').waitFor();ok(await page.locator('#course-search').inputValue()==='听力'&&await page.locator('.course-card').count()===1,'browser-back-restores-catalog-search-and-filter');
 await page.locator('#course-search').fill('不存在的课程');ok(await page.locator('.empty-state').count()===1,'catalog-empty-state-is-explained');
 await a('clear-filters').click();ok(await page.locator('.course-card').count()===6,'catalog-empty-state-can-reset');
 await page.locator('#course-search').fill('<img src=x onerror=alert(1)>');ok(await page.locator('#course-results img[src="x"]').count()===0,'search-text-is-not-injected-as-markup');await a('clear-search').click();
 await go('/method');
 await page.locator('[role="tab"]').first().focus();await page.keyboard.press('ArrowRight');ok(await page.locator('[role="tab"]').nth(1).getAttribute('aria-selected')==='true','example-tabs-support-arrow-keys');
 await page.keyboard.press('End');ok(await page.locator('[role="tab"]').nth(2).getAttribute('aria-selected')==='true','example-tabs-support-end-key');
 await go('/help');await page.locator('[data-action="help-group"][data-value="device"]').click();ok(await page.locator('#help-results details').count()===3,'help-category-filter');
 await page.locator('#help-search').fill('手机');ok(await page.locator('#help-results details').count()===1,'help-search-combines-with-category');
 await page.locator('#help-results summary').click();ok((await page.locator('#help-results details p').innerText()).includes('不需要'),'faq-expands-concrete-answer');
 await page.locator('#help-search').fill('不存在的问题');ok(await page.locator('.help-empty').count()===1,'help-has-empty-state');await a('clear-help-all').click();ok(await page.locator('#help-results details').count()===10,'help-reset-restores-all-questions');
 await go('/start');ok((await page.locator('.start-action h2').innerText()).includes('浏览器'),'desktop-start-recommends-browser-workspace');
 await a('launch').click();ok((await page.locator('dialog').innerText()).includes('官网 → 学习端'),'free-start-clearly-shows-learning-handoff');
 ok(await page.locator('dialog a[target="_blank"]').getAttribute('href')==='/?design=experience-v4','prototype-handoff-points-to-existing-mobile-proposal');
 ok(await page.locator('dialog input').count()===0,'official-prototype-does-not-collect-account-credentials');await page.keyboard.press('Escape');
 await a('other-device').click();ok((await page.locator('dialog').innerText()).includes('本机设计地址'),'cross-device-preview-does-not-pretend-loopback-is-public');await page.keyboard.press('Escape');
 await go('/status');ok((await page.locator('#main').innerText()).includes('未展示实时监测结果'),'service-status-does-not-claim-live-health');
 await go('/updates');await a('free-notice').click();ok((await page.locator('dialog').innerText()).includes('初期免费')||(await page.locator('dialog').innerText()).includes('免费开放'),'free-opening-notice-opens');await page.keyboard.press('Escape');

 await go('/world');
 ok(await page.locator('.world-widget').count()===1,'world-page-has-interactive-showcase');
 await page.locator('[data-world="turn"][data-value="1"]').click();
 ok((await page.locator('.room-perspective').getAttribute('style')).includes('11deg'),'room-view-can-turn');
 await page.locator('[data-world="turn"][data-value="0"]').click();
 ok((await page.locator('.room-perspective').getAttribute('style')).includes('0deg'),'room-view-can-reset');
 const sceneBox=await page.locator('.room-perspective').boundingBox();await page.mouse.move(sceneBox.x+sceneBox.width/2,sceneBox.y+sceneBox.height/2);await page.mouse.down();await page.mouse.move(sceneBox.x+sceneBox.width/2+70,sceneBox.y+sceneBox.height/2,{steps:5});await page.mouse.up();
 ok((await page.locator('.world-live').innerText()).includes('已调整空间视角'),'room-supports-direct-horizontal-drag');await page.locator('[data-world="turn"][data-value="0"]').click();
 await page.locator('[data-world="view"][data-value="2d"]').click();
 ok(await page.locator('.room-view-controls').count()===0&&await page.locator('.room-composition').evaluate(e=>getComputedStyle(e).transform)==='none','2d-removes-depth-and-rotation-controls');
 await page.locator('[data-world="view"][data-value="3d"]').click();
 ok(await page.locator('.room-avatar').evaluate(e=>getComputedStyle(e).transform)!=='none','3d-adds-layered-depth');
 await page.locator('[data-world="room"][data-value="morning"]').click();
 ok(await page.locator('.room-stage.room-morning').count()===1,'room-atmosphere-can-change');
 await page.locator('[data-world="outfit"][data-value="1"]').click();
 ok(await page.locator('.room-avatar .outfit-1').count()===1,'outfit-choice-changes-avatar');
 ok(await page.evaluate(()=>document.activeElement.dataset.world)==='outfit','outfit-change-retains-keyboard-focus');
 await page.locator('#world-tab-wall').click();
 ok(await page.locator('.character-card').count()===3,'character-wall-has-three-selectable-design-examples');
 await page.locator('[data-world="avatar"][data-value="2"]').click();
 ok(await page.locator('[data-world="avatar"][data-value="2"]').getAttribute('aria-pressed')==='true','character-selection-is-visible');
 await page.locator('[data-world="badge"][data-value="0"]').click();
 ok((await page.locator('.world-live').innerText()).includes('示例'),'badge-explains-sample-without-fake-award');
 await page.locator('#world-tab-room').click();
 ok(await page.locator('.room-avatar .avatar-2.outfit-1').count()===1,'avatar-and-outfit-follow-back-to-room');
 await page.locator('#world-tab-room').focus();await page.keyboard.press('ArrowRight');
 ok(await page.locator('#world-tab-game').getAttribute('aria-selected')==='true','world-tabs-support-keyboard-arrows');
 await page.keyboard.press('End');ok(await page.locator('#world-tab-wall').getAttribute('aria-selected')==='true','world-tabs-support-end');
 await page.locator('#world-tab-game').click();await page.locator('[data-world="hint"]').click();
 ok((await page.locator('.train-play').innerText()).includes('先找到'),'train-hint-is-optional');
 for(const i of [0,1,2,3,4])await page.locator('[data-world="word"][data-value="'+i+'"]').click();
 ok((await page.locator('.world-feedback').innerText()).includes('顺序有一点不同'),'train-wrong-order-offers-recovery');
 await page.locator('[data-world="remove-word"][data-value="0"]').click();
 ok(await page.locator('.train-slots button').count()===4,'train-selected-word-can-be-withdrawn');
 await page.locator('[data-world="reset-train"]').click();
 ok(await page.locator('.train-slots button').count()===0,'train-can-restart-without-reloading');
 for(const i of [2,4,0,1,3])await page.locator('[data-world="word"][data-value="'+i+'"]').click();
 ok((await page.locator('.world-feedback').innerText()).includes('拼好了'),'train-first-sentence-completes');
 ok(await page.evaluate(()=>document.activeElement.dataset.world)==='next-train','completed-train-focuses-next-action');
 await page.locator('[data-world="next-train"]').click();
 for(const i of [1,0,2])await page.locator('[data-world="word"][data-value="'+i+'"]').click();
 ok((await page.locator('.world-feedback').innerText()).includes('拼好了'),'train-second-sentence-completes');
 await page.locator('[data-world="next-train"]').click();
 ok(await page.locator('#world-tab-room').getAttribute('aria-selected')==='true','train-finishes-back-in-personal-space');
 await a('motion').click();ok(await page.locator('html').getAttribute('data-motion')==='off','motion-can-be-paused');
 ok(await page.locator('.room-floating-tag').evaluate(e=>getComputedStyle(e).animationName)==='none','pause-stops-decorative-animation');
 await page.reload();ok(await page.locator('html').getAttribute('data-motion')==='off','motion-preference-survives-reload');
 await a('motion').click();ok(await page.locator('html').getAttribute('data-motion')==='on','motion-can-be-enabled-again');
 await page.evaluate(()=>window.scrollTo({top:document.body.scrollHeight,behavior:'instant'}));
 const footerClear=await page.locator('.footer-bottom').evaluate(el=>{const r=[...el.children].map(x=>x.getBoundingClientRect());return getComputedStyle(el.querySelector('.review-badge')).position==='static'&&r.every((a,i)=>r.every((b,j)=>i===j||a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top))});
 ok(footerClear,'review-badge-is-in-footer-flow-and-does-not-overlap-copyright');
 await a('review-note').click();ok((await page.locator('#dialog-title').innerText()).includes('06'),'footer-design-note-opens-current-revision');await page.keyboard.press('Escape');

 await page.setViewportSize({width:390,height:844});await go('/');
 ok(await a('menu').isVisible()&&!await page.locator('.desktop-nav').isVisible(),'mobile-has-dedicated-navigation');
 await a('menu').click();ok(await page.locator('dialog.nav-dialog').isVisible(),'mobile-menu-opens-full-screen');
 await capture(page,'mobile-menu-light.png');
 await page.locator('dialog a[href="#/courses"]').click();ok(!await page.locator('dialog').isVisible()&&await page.locator('.course-card').count()===6,'mobile-navigation-select-closes-menu-and-routes');
 await a('menu').click();await a('login','dialog').click();ok((await page.locator('#dialog-title').innerText()).includes('登录'),'mobile-menu-offers-direct-login');await page.keyboard.press('Escape');
 await go('/start');ok((await page.locator('.start-action h2').innerText()).includes('这台手机'),'mobile-start-recommends-current-phone');
 ok(await page.locator('.start-action').evaluate(el=>el.getBoundingClientRect().top)<await page.locator('.start-benefits').evaluate(el=>el.getBoundingClientRect().top),'mobile-start-puts-action-before-description');
 ok(await a('launch').evaluate(el=>el.getBoundingClientRect().bottom)<844,'mobile-start-main-button-is-within-first-viewport');
 ok(await page.locator('#mobile-cta').getAttribute('class').then(c=>c.includes('hidden')),'start-page-does-not-duplicate-sticky-start-button');
 await go('/method');await page.locator('[role="tab"]').first().click();ok(await a('demo-reveal','#main').evaluate(el=>el.getBoundingClientRect().bottom)<779,'mobile-method-example-action-is-within-first-viewport');
 await go('/');await page.locator('.faq-grid').evaluate(el=>el.scrollIntoView({behavior:'instant'}));await page.waitForTimeout(150);ok(await page.locator('#mobile-cta').isVisible(),'mobile-sticky-start-appears-after-hero');
 await page.locator('#mobile-cta a').click();ok(page.url().includes('#/start'),'mobile-sticky-start-routes-correctly');
 await a('theme').click();ok(await page.locator('html').getAttribute('data-theme')==='dark','theme-switch-changes-entire-site');await page.reload();ok(await page.locator('html').getAttribute('data-theme')==='dark','theme-preference-persists-after-reload');
 const layouts=[],worldLayouts=[];const routes=['/','/world','/courses','/course/listening','/method','/start','/help','/about','/updates','/status','/privacy','/terms','/minors','/compliance'];
 for(const theme of ['light','dark']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await a('theme').click();
  for(const width of [320,360,390,430,768,1024,1440]){
   await page.setViewportSize({width,height:width<700?844:1000});
   await go('/world');
   for(const tab of ['room','game','wall']){await page.locator('#world-tab-'+tab).click();for(const view of ['2d','3d']){await page.locator('[data-world="view"][data-value="'+view+'"]').click();worldLayouts.push(await page.evaluate(()=>({tab:document.querySelector('.world-widget').dataset.tab,view:document.querySelector('.world-widget').dataset.view,theme:document.documentElement.dataset.theme,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1})))}}
   await page.locator('#world-tab-room').click();
   for(const route of routes){await go(route);layouts.push(await page.evaluate(()=>({route:location.hash,theme:document.documentElement.dataset.theme,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,h1:document.querySelectorAll('main h1').length,missingImages:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).length})));}
  }
 }
 ok(layouts.length===196&&layouts.every(x=>!x.overflow),'fourteen-page-templates-in-two-themes-at-seven-widths-no-overflow');
 ok(worldLayouts.length===84&&worldLayouts.every(x=>!x.overflow),'world-three-panels-two-presentations-two-themes-seven-widths-no-overflow');
 ok(layouts.every(x=>x.h1===1&&x.missingImages===0),'all-layouts-have-one-main-heading-and-no-broken-images');
 for(const id of ['daily-words','clear-grammar','reading','speaking','writing']){await go('/course/'+id);ok(!await page.locator('#main h1').innerText().then(t=>t.includes('找不到')),'detail-variant-'+id)}
 await go('/not-a-page');ok((await page.locator('#main h1').innerText()).includes('找不到'),'unknown-route-has-recovery-page');
 if(await page.locator('html').getAttribute('data-motion')==='on')await a('motion').click();
 for(const theme of ['light','dark']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await a('theme').click();
  await page.setViewportSize({width:1440,height:1000});await go('/');await capture(page,`desktop-home-${theme}.png`,{fullPage:true});await capture(page,`desktop-hero-${theme}.png`);
  await go('/courses');await capture(page,`desktop-content-${theme}.png`,{fullPage:true});
  await go('/world');await page.locator('#world-tab-room').click();await capture(page,`desktop-world-${theme}.png`);await page.locator('#world-tab-wall').click();await capture(page,`desktop-wall-${theme}.png`);await page.locator('#world-tab-room').click();
  await page.locator('#footer').evaluate(el=>el.scrollIntoView({behavior:'instant'}));await capture(page,`footer-${theme}.png`);
  await page.setViewportSize({width:390,height:844});
  await go('/world');await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(100);ok(!await page.locator('#mobile-cta').isVisible(),'world-page-keeps-mobile-controls-uncovered-'+theme);
  for(const tab of ['room','game','wall']){await page.locator('#world-tab-'+tab).click();await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await capture(page,`mobile-world-${tab}-${theme}.png`);await capture(page,`mobile-world-${tab}-${theme}-full.png`,{fullPage:true});}
  await page.locator('#world-tab-room').click();
  for(const [route,name] of [['/','home'],['/courses','content'],['/course/listening','detail'],['/method','method'],['/start','start'],['/help','help']]){await go(route);await capture(page,`mobile-${name}-${theme}.png`);if(route==='/'||route==='/start')await capture(page,`mobile-${name}-${theme}-full.png`,{fullPage:true});}
 }
 await go('/');await page.locator('.world-widget').evaluate(el=>el.scrollIntoView({behavior:'instant'}));await page.waitForTimeout(120);ok(!await page.locator('#mobile-cta').isVisible(),'home-showcase-hides-sticky-cta-during-interaction');
 await a('motion').click();await page.emulateMedia({reducedMotion:'reduce'});await go('/world');ok(await page.locator('html').getAttribute('data-motion')==='off','system-reduced-motion-overrides-animation-preference');ok(await page.locator('.world-widget').getAttribute('data-view')==='2d','system-reduced-motion-selects-lightweight-view');await a('motion').click();ok(await page.locator('html').getAttribute('data-motion')==='off','manual-toggle-does-not-override-system-reduced-motion');
 await page.emulateMedia({reducedMotion:'reduce'});await go('/');ok(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior)==='auto','reduced-motion-disables-smooth-scrolling');
 const mobileReply=await page.request.get('http://127.0.0.1:18185/');ok(mobileReply.ok()&&(await mobileReply.text()).includes('DESIGN STUDY 04'),'shared-server-preserves-existing-mobile-preview');
 ok(!errors.length,'no-browser-script-errors');ok(!failedResponses.length,'no-failed-static-responses');ok(!unexpectedRequests.length,'no-external-requests-or-business-writes');
 const result={classification:'official-site-design-prototype-not-production-evidence',revision:'official-v6',date:'2026-09-21',pageTemplates:14,courseVariants:6,themes:['light','dark'],checkedWidths:[320,360,390,430,768,1024,1440],checks,layouts,worldLayouts,errors,failedResponses,unexpectedRequests};
 await writeArtifact(path.join(__dirname,'preview-check.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({checkCount:checks.length,layoutCount:layouts.length,worldLayoutCount:worldLayouts.length,errors,failedResponses,unexpectedRequests,checks},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
