// Independent rendered assertions; fixture transport is a frozen copy of the
// author API interceptor only. No request bodies/headers/auth state are read.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
process.env.UI_AUDIT_OUTPUT=__dirname;
const fixture=require('./fixture-transport.cjs');
const result={at:new Date().toISOString(),scope:'MB004_INDEPENDENT_RENDERED_BOUNDARIES_SYNTHETIC_ONLY',cases:[],failures:[]};
const save=()=>fs.writeFileSync(path.join(__dirname,'visual-boundaries-results.json'),JSON.stringify(result,null,2));
async function inspect(p){return p.evaluate(()=>{
 const root=document.querySelector('.yx-onboarding');
 const rgba=c=>{const x=c.match(/[\d.]+/g).map(Number);return[x[0],x[1],x[2],x.length>3?x[3]:1]};
 const composite=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3])).concat(1);
 const effective=n=>{if(!n)return[255,255,255,1];const a=rgba(getComputedStyle(n).backgroundColor);return a[3]<1?composite(a,effective(n.parentElement)):a};
 const lum=a=>a.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 const nodes=[...root.querySelectorAll('.onboarding-input,.uni-checkbox-input,.onboarding-choice:not(.is-selected),.onboarding-quota:not(.is-selected)')];
 return{title:document.querySelector('#mobile-onboarding-title').textContent,description:document.querySelector('.onboarding-description').textContent,blocked:document.querySelector('.onboarding-blocked')?.textContent,rawKeys:/mobile\.onboarding\./.test(root.textContent),overlay:!!document.querySelector('vite-error-overlay'),overflow:document.documentElement.scrollWidth>innerWidth+1,theme:document.documentElement.dataset.theme,boundaries:nodes.map(n=>{const s=getComputedStyle(n),outside=effective(n.parentElement),inside=effective(n),border=composite(rgba(s.borderTopColor),outside),r=n.getBoundingClientRect();return{kind:n.className,border:s.borderTopColor,borderWidth:s.borderTopWidth,fill:s.backgroundColor,effectiveFill:inside,effectiveOutside:outside,againstFill:ratio(border,inside),againstOutside:ratio(border,outside),width:r.width,height:r.height}})}
})}
(async()=>{await fixture.init();
 for(const mode of ['gate','goal'])for(const theme of ['light','dark','high-contrast','system']){
  const c=await fixture.open(mode,390,'en-US',theme),p=c.page;
  const facts=await inspect(p);await p.screenshot({path:path.join(__dirname,`${mode}-390-en-${theme}.png`),fullPage:true});
  const errors=[];if(facts.overlay||facts.rawKeys||facts.overflow)errors.push('overlay/rawKey/overflow');
  for(const edge of facts.boundaries)if(edge.againstFill<3||edge.againstOutside<3||parseFloat(edge.borderWidth)<1)errors.push(`${edge.kind}: ${Math.min(edge.againstFill,edge.againstOutside).toFixed(3)}`);
  result.cases.push({mode,theme,facts,result:errors.length?'FAIL':'PASS',errors});result.failures.push(...errors.map(error=>({mode,theme,error})));save();
  if(mode==='gate'){await p.getByRole('checkbox').click();assert.equal(await p.getByRole('checkbox').getAttribute('aria-checked'),'true');const checked=await inspect(p);await p.screenshot({path:path.join(__dirname,`gate-390-en-${theme}-checked.png`),fullPage:true});const box=checked.boundaries.find(x=>x.kind.includes('uni-checkbox-input'));assert.ok(box.againstOutside>=3,'Checked control visible boundary');result.cases.push({mode,theme,checked:true,facts:checked,result:'PASS'});save()}
  await c.context.close();
 }
 for(const mode of ['consent','assessment']){const c=await fixture.open(mode,390,'zh-CN','light');const facts=await inspect(c.page);await c.page.screenshot({path:path.join(__dirname,`${mode}-390-zh-light.png`),fullPage:true});assert.equal(facts.rawKeys,false);assert.equal(facts.overlay,false);assert.equal(facts.overflow,false);result.cases.push({mode,theme:'light',facts,result:'PASS'});save();await c.context.close()}
 result.status=result.failures.length?'FAIL':'UI_PASS_RENDERED_BOUNDARIES_ONLY';save();console.log(JSON.stringify({status:result.status,cases:result.cases.length,failures:result.failures}));
})().catch(e=>{result.status='HARNESS_OR_UI_FAILURE';result.failure=e.stack;save();console.error(e.stack);process.exitCode=1}).finally(async()=>fixture.close());
