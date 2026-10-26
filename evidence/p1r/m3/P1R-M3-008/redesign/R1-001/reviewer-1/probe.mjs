import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const out = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const testPath = 'apps/official-site/tests/public-projection-bff.test.mjs';
const prefix = fs.readFileSync(testPath, 'utf8').split('\ntest("')[0]
  .replace('const siteRoot = join(import.meta.dirname, "..");', 'const siteRoot = ' + JSON.stringify(path.join(root,'apps/official-site')) + ';');
const runPath = path.join(out,'semantic-probe.mjs');
fs.writeFileSync(runPath, prefix + `
const app = harness();
app.setFetch(async url => ok(url.includes('/public/commerce/catalog') ? {plans:[]} : {data:{uiLocale:'zh-CN',generatedAt:'2026-10-03T00:00:00Z',courses:[]}}));
const empty = (await app.request()).body;
const courseSource = await read('pages/courses/index.vue');
const homepageSource = await read('pages/index.vue');
const pricingSource = await read('pages/pricing.vue');
const downloadSource = await read('pages/download.vue');
const maintenanceApp = harness();
maintenanceApp.setFetch(async url => ok(url.includes('/public/commerce/catalog') ? {plans:[]} : {state:'maintenance',data:{courses:[]}}));
const maintenance=(await maintenanceApp.request()).body;
app.setFetch(async url => ok(url.includes('/public/commerce/catalog') ? {plans:[]} : {data:{uiLocale:'zh-CN',generatedAt:'2026-10-03T00:00:00Z',courses:[{id:'synthetic-c1',title:'Synthetic course'}],downloads:[{id:'synthetic-d1',name:'Synthetic download',platform:'web',href:'https://example.invalid/download',availability:'available'}]}}));
await app.request();
app.setFetch(async ()=> {throw new Error('synthetic outage');});
const recovered = (await app.request()).body;
console.log(JSON.stringify({scope:'VM semantic reproduction with synthetic fetch; NOT actual upstream integration',maintenance:{global:maintenance.state,pricingFacet:maintenance.facets.pricing.state,pricingCount:maintenance.projection.pricingPlans.length},empty:{global:empty.state,courseFacet:empty.facets.courses.state,courseCount:empty.projection.courses.length,updatedAt:empty.facets.courses.updatedAt,courseTitleConditionReadyOnly:courseSource.includes(':title="coursesFacet.state === \\'ready\\' ? t(\\'official.c52c0deec1\\') : undefined"'),homeEmptyConditionReadyOnly:homepageSource.includes("homeCoursesFacet.state === 'ready' && !loadState.projection.courses.length")},recovery:{global:recovered.state,downloadFacet:recovered.facets.download.state,stale:recovered.facets.download.stale,downloadCount:recovered.projection.downloadChannels.length,downloadPageShowsOldCards:downloadSource.includes("['ready', 'recovery'].includes(downloadFacet.state) && channels.length"),downloadRecoveryNoticePresent:/PublicStatus[\\s\\S]*?v-if.*recovery/.test(downloadSource),pricingRecoveryNoticePresent:/PublicStatus[\\s\\S]*?v-if.*recovery/.test(pricingSource)}}));
`);
const runs=[];
function run(label,args) {
 const startedAt=new Date().toISOString();const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true});
 fs.writeFileSync(path.join(out,label+'.log'),(r.stdout||'')+(r.stderr||''));
 runs.push({command:[process.execPath,...args].join(' '),startedAt,finishedAt:new Date().toISOString(),exitCode:r.status,log:label+'.log'});return r;
}
const semantic=run('semantic-probe',[runPath]);
const unit=run('unit-rerun',['--test','apps/official-site/tests/public-projection-bff.test.mjs','apps/official-site/tests/b13-official-site.test.mjs','apps/official-site/tests/b14-fe-005.test.mjs','apps/official-site/tests/website-entry.test.mjs']);
const shimPath=path.join(out,'nuxt-input-shim.d.ts');
fs.writeFileSync(shimPath,`declare module '#imports' {
 export function onMounted(fn:()=>void):void;
 export function onServerPrefetch(fn:()=>Promise<void>):void;
 export function useRequestFetch():<T>(url:string,options:unknown)=>Promise<T>;
 export function useState<T>(key:string,init:()=>T):{value:T};
}
declare function useRoute():{query:Record<string,unknown>};
`);
const target=path.join(root,'apps/official-site/composables/usePublicProjection.ts');
const program=ts.createProgram([target,shimPath],{strict:true,noEmit:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,baseUrl:path.join(root,'apps/official-site'),paths:{'~/*':['*']},types:[]});
const diagnostics=ts.getPreEmitDiagnostics(program).filter(d=>d.file?.fileName.replaceAll('\\','/').endsWith('/apps/official-site/composables/usePublicProjection.ts')).map(d=>({file:'apps/official-site/composables/usePublicProjection.ts',line:d.file.getLineAndCharacterOfPosition(d.start).line+1,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
fs.writeFileSync(path.join(out,'type-probe.json'),JSON.stringify({scope:'targeted semantic TS check of real composable using explicit Nuxt API declaration shim, NOT full Nuxt typecheck',diagnostics},null,2));
const http=[];
for(const route of ['/','/courses','/pricing','/download','/announcements','/about','/compliance','/status','/privacy','/terms','/minors']) {
 const r=await fetch('http://127.0.0.1:18182'+route);http.push({route,status:r.status});
}
const p=await fetch('http://127.0.0.1:18182/api/public-projection');
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),runs,semanticExit:semantic.status,unitExit:unit.status,semantic:semantic.status===0?JSON.parse(semantic.stdout):null,http,actualLocalBff:await p.json(),typeDiagnostics:diagnostics,scope:'independent code/unit/VM/HTTP evidence; real domain upstream still absent'},null,2));
console.log(JSON.stringify({unitExit:unit.status,semanticExit:semantic.status,semantic:semantic.stdout,typeDiagnostics:diagnostics,httpCount:http.length}));
