import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { artifact, gitSnapshot, verifyArtifact, taskDigest } from '../../../../../../../scripts/lib/redesign-task-state.mjs';
const root=process.cwd(), out=path.dirname(fileURLToPath(import.meta.url));
const base='docs/06-design/v2-980plus/redesign/';
const index=JSON.parse(fs.readFileSync(base+'dev-plan-R1.tasks.json'));
const state=JSON.parse(fs.readFileSync(base+'dev-plan-R1.status.json'));
const task=index.tasks.find(t=>t.id==='R1-001');
const delivery=JSON.parse(fs.readFileSync(task.evidenceDirectory+'delivery-2.json'));
const matches=items=>items.map(a=>{try{verifyArtifact(root,a);return{path:a.path,match:true}}catch(e){return{path:a.path,match:false,error:e.message}}});
const current=gitSnapshot(root,task);
const old=JSON.parse(fs.readFileSync(task.evidenceDirectory+'delivery-1.json'));
const hashes={checkedAt:new Date().toISOString(),revision:state.revision,state:state.tasks.find(t=>t.id===task.id).state,specMatch:taskDigest(task)===delivery.specSha256,receiptMatch:artifact(root,task.evidenceDirectory+'delivery-2.json').sha256===state.tasks.find(t=>t.id===task.id).submission.receipt.sha256,scopeMatch:current.dirtyDiffSha256===delivery.dirtyDiffSha256&&current.sourceCommit===delivery.sourceCommit,artifacts:matches(delivery.artifacts),evidence:matches(delivery.evidence),historicalEvidence:matches(old.evidence),current};
fs.writeFileSync(path.join(out,'hashes.json'),JSON.stringify(hashes,null,2));
const runs=[];
function run(label,args){const startedAt=new Date().toISOString();const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true});fs.writeFileSync(path.join(out,label+'.log'),(r.stdout||'')+(r.stderr||''));runs.push({command:['node',...args].join(' '),startedAt,finishedAt:new Date().toISOString(),exitCode:r.status,logPath:task.evidenceDirectory+'reviewer-2/'+label+'.log'});return r;}
const unit=run('unit-rerun',['--test','apps/official-site/tests/public-projection-bff.test.mjs','apps/official-site/tests/b13-official-site.test.mjs','apps/official-site/tests/b14-fe-005.test.mjs','apps/official-site/tests/website-entry.test.mjs']);
const prefix=fs.readFileSync('apps/official-site/tests/public-projection-bff.test.mjs','utf8').split('\ntest("')[0].replace('const siteRoot = join(import.meta.dirname, "..");','const siteRoot = '+JSON.stringify(path.join(root,'apps/official-site'))+';');
fs.writeFileSync(path.join(out,'semantic-probe.mjs'),prefix+`
const results={scope:'synthetic VM execution of current BFF, not actual Gateway integration'};
for(const state of ['maintenance','permission','error']){const app=harness();app.setFetch(async url=>ok(url.includes('/commerce/')?{plans:[]}:{state,data:{courses:[]}}));const r=await app.request();results[state]={state:r.body.state,pricing:r.body.facets.pricing.state};assert.equal(r.body.facets.pricing.state,state);}
const app=harness();app.setFetch(async url=>ok(url.includes('/commerce/')?{plans:[]}:{data:{courses:[]}}));const empty=(await app.request()).body;results.empty={state:empty.state,courseFacet:empty.facets.courses.state};assert.equal(empty.facets.courses.state,'empty');
const staleApp=harness();staleApp.setFetch(async url=>ok(url.includes('/commerce/')?{plans:[]}:{state:'recovery',stale:true,errorCode:'PUBLIC_PROJECTION_STALE',data:{generatedAt:'2026-10-03T00:00:00Z',courses:[{id:'synthetic-course',title:'Synthetic course'}]}}));const stale=(await staleApp.request()).body;results.businessRecovery={state:stale.state,stale:stale.stale,errorCode:stale.errorCode,courses:stale.projection.courses.length,updatedAt:stale.projection.generatedAt,courseFacet:stale.facets.courses,pricingFacet:stale.facets.pricing};
const metaApp=harness();metaApp.setFetch(async url=>ok(url.includes('/commerce/')?{plans:[]}:{data:{projectionVersion:'public-v1',contentEpoch:1,generatedAt:'2026-10-03T00:00:00Z',courses:[{contentCode:'synthetic-course',contentType:'COURSE',title:'Synthetic course',summary:'Synthetic',contentLocale:'en-US',targetLevel:'A1',contentVersionId:'version-1',availability:'PUBLISHED'}],pricing:[],downloads:[],announcements:[],compliance:[]},meta:{projectionVersion:'public-v1',contentEpoch:1,generatedAt:'2026-10-03T00:00:00Z',source:'CACHE',stale:true}}));const meta=(await metaApp.request()).body;results.metaStale={state:meta.state,stale:meta.stale,courseFacet:meta.facets.courses,headers:(await metaApp.request()).headers};
const cacheApp=harness();await cacheApp.request();cacheApp.setFetch(async()=>{throw Error('synthetic outage')});const cache=(await cacheApp.request()).body;results.cachedRecovery={state:cache.state,stale:cache.stale,courses:cache.projection.courses.length};assert.equal(cache.stale,true);assert.equal(cache.projection.courses.length,1);
console.log(JSON.stringify(results));
`);
const sem=run('semantic-probe',[path.join(out,'semantic-probe.mjs')]);
const shim=path.join(out,'nuxt-input-shim.d.ts');
fs.writeFileSync(shim,`declare module '#imports' { export function onMounted(fn:()=>void):void; export function onServerPrefetch(fn:()=>Promise<void>):void; export function useRequestFetch():<T>(url:string,options:unknown)=>Promise<T>; export function useState<T>(key:string,init:()=>T):{value:T}; }\ndeclare function useRoute():{query:Record<string,unknown>};\n`);
const target=path.join(root,'apps/official-site/composables/usePublicProjection.ts');
const program=ts.createProgram([target,shim],{strict:true,noEmit:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,baseUrl:path.join(root,'apps/official-site'),paths:{'~/*':['*']},types:[]});
const diagnostics=ts.getPreEmitDiagnostics(program).filter(d=>d.file?.fileName.replaceAll('\\','/').endsWith('/apps/official-site/composables/usePublicProjection.ts')).map(d=>({line:d.file.getLineAndCharacterOfPosition(d.start).line+1,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
const result={checkedAt:new Date().toISOString(),runs,typeScope:'targeted real composable with Nuxt declarations, not full Nuxt typecheck',typeDiagnostics:diagnostics,semantic:sem.status===0?JSON.parse(sem.stdout):{error:sem.stderr}};
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({hashesMatch:hashes.artifacts.every(a=>a.match)&&hashes.evidence.every(a=>a.match)&&hashes.scopeMatch&&hashes.receiptMatch,historicalDrift:hashes.historicalEvidence.filter(a=>!a.match),unitExit:unit.status,typeDiagnostics:diagnostics,semantic:result.semantic}));
