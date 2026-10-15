// Independent interaction assertions using the frozen fixture transport only.
// All credentials are deliberately synthetic; no body/header/token/storage reads.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
process.env.UI_AUDIT_OUTPUT=__dirname;
const fixture=require('./fixture-transport.cjs');
const manifest=JSON.parse(fs.readFileSync(process.env.INDEPENDENT_FREEZE,'utf8').replace(/^\uFEFF/,''));
const hashes=()=>Object.fromEntries(Object.keys(manifest).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(process.cwd(),f))).digest('hex')]));
const result={at:new Date().toISOString(),scope:'INDEPENDENT_MB004_RISK_FIXTURE_UI_ONLY',sourceHashesBefore:hashes(),checks:[]};
const save=()=>fs.writeFileSync(path.join(__dirname,'risk-results.json'),JSON.stringify(result,null,2));
const verify=()=>assert.deepEqual(hashes(),manifest,'Product source drift: stop signing');
async function facts(p){return p.evaluate(()=>{let c=document.querySelector('.yx-onboarding')?.__vueParentComponent;while(c&&!('step'in c.setupState))c=c.parent;const s=c?.setupState;return{route:location.hash.split('?')[0],step:s?.step,busy:s?.busy,adult:s?.session.adultGate,access:s?.session.adultLearningAccess,ready:s?.session.isLearningReady,refreshRequired:s?.store.onboardingResume?.sessionRefreshRequired,consentAccepted:s?.store.onboardingResume?.consent.accepted,focus:document.activeElement.id,alerts:document.querySelectorAll('.onboarding-error[role=alert]').length}})}
async function settled(p){await p.locator('.yx-onboarding[aria-busy=false]').waitFor();}
async function add(name,c,details={}){verify();result.checks.push({name,result:'PASS',facts:await facts(c.page),requests:{...c.state.counts},...details});save();await c.context.close()}
async function gateSubmit(c){await c.page.locator('#mobile-onboarding-year').fill('1990');await c.page.locator('.onboarding-check-row').click();await c.page.locator('.onboarding-primary').click();await settled(c.page)}
(async()=>{verify();await fixture.init();
 for(const [response,access] of [['PASSED','RESTRICTED'],['PASSED','UNKNOWN'],['PASSED',undefined],['UNKNOWN','ELIGIBLE'],['PASSED','ELIGIBLE']]){
  const c=await fixture.open();c.state.adultResponse=response;c.state.adultAccess=access;
  await gateSubmit(c);const f=await facts(c.page);
  assert.equal(c.state.counts.adult,1);assert.equal(c.state.counts.targetPut,0);assert.equal(c.state.counts.consentPut,0);assert.equal(f.ready,false);assert.ok(!c.page.url().includes('/forbidden/'));
  if(response==='PASSED'&&access==='ELIGIBLE'){assert.equal(f.step,'consent');assert.equal(f.adult,'PASSED');assert.equal(f.access,'ELIGIBLE')}else{assert.equal(f.step,'gate');assert.ok(f.alerts>0);assert.notEqual(f.adult,'REJECTED')}
  await add(`gate-${response}-${access??'missing'}-fails-closed-or-explicit-consent-step`,c);
 }
 {const c=await fixture.open();c.state.adultStatus=503;await gateSubmit(c);const f=await facts(c.page);assert.equal(f.step,'gate');assert.notEqual(f.adult,'REJECTED');assert.ok(f.alerts>0);assert.equal(c.state.counts.adult,1);await add('adult503-preserves-gate-visible-error',c)}
 for(const stale of ['transient','persistent']){
  const c=await fixture.open('consent');c.state.accepted=true;c.state.targetClaimsStale=stale;const p=c.page;
  await p.getByRole('button',{name:'重新读取',exact:true}).click();await settled(p);
  assert.equal(c.state.counts.refresh,1);assert.equal(c.state.counts.targetPut,0);assert.equal(c.state.counts.consentPut,0);const f=await facts(p);
  assert.equal(f.step,stale==='transient'?'goal':'consent');assert.equal(f.consentAccepted,true);
  if(stale==='persistent'){assert.equal(f.refreshRequired,true);assert.equal(await p.locator('.onboarding-primary').count(),0);assert.ok(f.alerts>0);await p.screenshot({path:path.join(__dirname,'persistent403-blocked.png'),fullPage:true})}
  await add(`target403-${stale}-one-owner-refresh-no-signing-no-put`,c);
 }
 {const c=await fixture.open('goal'),p=c.page;c.state.accepted=false;await p.locator('[data-goal-code=FOUNDATION]').click();await p.locator('.onboarding-primary').click();await p.getByRole('heading',{name:'查看同意事项'}).waitFor();await settled(p);assert.equal(c.state.counts.targetPut,0);assert.equal(c.state.counts.consentPut,0);await add('revoked-current-consent-before-save-zero-put',c)}
 {const c=await fixture.open('unreadable'),p=c.page;await p.locator('[data-goal-code=FOUNDATION]').click();assert.equal(await p.locator('.onboarding-primary').isDisabled(),true);await p.locator('.onboarding-primary').click({force:true});assert.equal(c.state.counts.targetPut,0);await add('unreadable-target-disabled-and-zero-write',c)}
 {const c=await fixture.open(),p=c.page,y=p.locator('#mobile-onboarding-year'),age=p.getByRole('checkbox');
  await y.fill('1820');await y.press('Enter');await p.locator('#mobile-onboarding-year-error[role=alert]').waitFor();assert.equal(await y.getAttribute('aria-invalid'),'true');assert.equal(await y.getAttribute('aria-describedby'),'mobile-onboarding-year-error');assert.equal((await facts(p)).focus,'mobile-onboarding-year');
  await y.fill('1990');await y.press('Enter');await age.focus();assert.equal(await age.getAttribute('aria-invalid'),'true');assert.equal(await age.getAttribute('aria-describedby'),'mobile-onboarding-age-error');await p.keyboard.press('Space');assert.equal(await age.getAttribute('aria-checked'),'true');await p.keyboard.press('Enter');assert.equal(await age.getAttribute('aria-checked'),'false');assert.equal(c.state.counts.adult,0);await add('input-confirm-error-association-and-checkbox-keyboard',c)}
 for(const key of ['Enter','Space']){
  const c=await fixture.open('goal'),p=c.page;c.state.expectedTarget={goalCode:'WORKPLACE_DAILY',dailyQuotaMinutes:30,targetLevel:'B2',status:'ACTIVE'};
  await p.locator('[data-goal-code=WORKPLACE_DAILY]').focus();await p.keyboard.press(key);assert.equal(await p.locator('[data-goal-code=WORKPLACE_DAILY]').getAttribute('aria-pressed'),'true');await p.getByRole('button',{name:/^30 分钟/}).click();
  c.hold('/api/v1/learner/targets');await p.locator('.onboarding-primary').focus();await p.keyboard.press(key);await p.locator('.yx-onboarding[aria-busy=true]').waitFor();
  assert.equal(await p.locator('.yx-onboarding uni-button:not([disabled])').count(),0);await p.keyboard.press(key);await p.getByRole('button',{name:'退出登录',exact:true}).click({force:true});assert.ok(p.url().includes('/pages/onboarding/'));
  c.release();await p.waitForURL(u=>u.hash.startsWith('#/pages/assessment/assessment'));assert.equal(c.state.counts.targetPut,1);assert.equal(c.state.counts.consentPut,0);assert.equal(c.state.counts.preferencePatch,0);await add(`goal-${key}-single-write-pending-guards`,c);
 }
 {const c=await fixture.open(),p=c.page;await p.locator('#mobile-onboarding-year').fill('1990');await p.locator('.onboarding-check-row').click();c.hold('/api/v1/iam/adult-gate');await p.locator('#mobile-onboarding-year').press('Enter');await p.locator('.yx-onboarding[aria-busy=true]').waitFor();assert.equal(await p.locator('#mobile-onboarding-year').isDisabled(),true);assert.equal(await p.getByRole('checkbox').getAttribute('aria-disabled'),'true');c.release();await p.getByRole('heading',{name:'查看同意事项'}).waitFor();assert.equal(c.state.counts.adult,1);await add('valid-input-confirm-single-adult-request',c)}
 {const c=await fixture.open(),p=c.page;await p.locator('#mobile-onboarding-year').fill('1990');await p.locator('.onboarding-check-row').click();c.hold('/api/v1/iam/adult-gate');await p.locator('.onboarding-primary').click();await p.locator('.yx-onboarding[aria-busy=true]').waitFor();
  await p.evaluate(async()=>{let c=document.querySelector('.yx-onboarding').__vueParentComponent;while(c&&!('birthYear'in c.setupState))c=c.parent;const s=c.setupState;window.__independentHiddenFacts=()=>({yearEmpty:s.birthYear==='',ageEmpty:!s.ageConfirmed,busy:s.busy});const{getUniRuntime}=await import('/src/platform/uni-runtime.ts');await getUniRuntime().navigateTo({url:'/pages/settings/settings'})});await p.waitForURL(u=>u.hash.startsWith('#/pages/settings/settings'));c.release();await p.waitForLoadState('networkidle');const h=await p.evaluate(()=>window.__independentHiddenFacts());assert.deepEqual(h,{yearEmpty:true,ageEmpty:true,busy:false});assert.ok(p.url().includes('/pages/settings/settings'));assert.equal(c.state.counts.targetPut,0);assert.equal(c.state.counts.consentPut,0);await add('actual-hide-clears-draft-late-adult-callback-inert',c,{hidden:h})}
 {const c=await fixture.open(),p=c.page;await p.getByRole('button',{name:'退出登录',exact:true}).click();await p.waitForURL(u=>u.hash.startsWith('#/pages/login/login'));assert.equal(await p.locator('.login-submit').isDisabled(),false);await add('explicit-logout-exit-public-unlocked',c)}
 assert.equal(fixture.report.pageErrors.length,0);result.pageErrors=fixture.report.pageErrors;result.fixtureRequests=fixture.report.fixtureRequests;result.sourceHashesAfter=hashes();verify();result.status='UI_PASS_INDEPENDENT_RISK_FIXTURE_ONLY';save();console.log(JSON.stringify({status:result.status,checks:result.checks.length}));
})().catch(async e=>{result.status='FAIL';result.failure=e.stack;save();console.error(e.stack);process.exitCode=1}).finally(async()=>fixture.close());
