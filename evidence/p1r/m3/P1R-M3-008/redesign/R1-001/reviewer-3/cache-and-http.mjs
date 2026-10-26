import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const dir=path.dirname(fileURLToPath(import.meta.url));
const prefix=fs.readFileSync('apps/official-site/tests/public-projection-bff.test.mjs','utf8').split('\ntest("')[0].replace('const siteRoot = join(import.meta.dirname, "..");','const siteRoot = '+JSON.stringify(path.resolve('apps/official-site'))+';');
fs.writeFileSync(path.join(dir,'cache-probe.mjs'),prefix+`
const rows=[];
for(const nextCatalog of ['empty','changed','failed']){
 const app=harness();
 const plan={skuId:'withdrawn',title:'Old published plan',currency:'CNY',amountMinor:1299,billingPeriod:'MONTH',availability:'PUBLISHED',entitlementCode:'learn.month',priceSnapshotId:'old-snapshot'};
 app.setFetch(async url=>ok(url.includes('/commerce/')?{plans:[plan]}:readyPayload));
 const first=(await app.request()).body;
 app.setFetch(async url=>url.includes('/commerce/')?(nextCatalog==='failed'?{ok:false,status:503,json:async()=>({})}:ok({plans:nextCatalog==='changed'?[{...plan,skuId:'new-plan',priceSnapshotId:'new-snapshot'}]:[]})):ok({state:'recovery',stale:true,errorCode:'PUBLIC_PROJECTION_STALE',data:{generatedAt:'2026-10-03T00:00:00Z',courses:[{id:'current-course',title:'Current recovery course'}]}}));
 const middle=(await app.request()).body;
 app.setFetch(async()=>{throw Error('synthetic outage')});
 const last=(await app.request()).body;
 const summarize=b=>({state:b.state,source:b.source,pricingFacet:b.facets.pricing.state,skus:b.projection.pricingPlans.map(p=>p.skuId),courses:b.projection.courses.map(c=>c.id)});
 rows.push({nextCatalog,first:summarize(first),afterAuthoritativeRead:summarize(middle),afterOutage:summarize(last),oldSkuRevived:last.projection.pricingPlans.some(p=>p.skuId==='withdrawn')});
}
console.log(JSON.stringify({scope:'synthetic sequential current BFF VM execution, not actual integration',rows}));
`);
const start=new Date().toISOString();const probe=spawnSync(process.execPath,[path.join(dir,'cache-probe.mjs')],{encoding:'utf8',windowsHide:true});
fs.writeFileSync(path.join(dir,'cache-probe.log'),(probe.stdout||'')+(probe.stderr||''));
const http=[];
for(const route of ['/','/courses','/pricing','/download','/announcements','/about','/compliance','/status','/privacy','/terms','/minors']){const r=await fetch('http://127.0.0.1:18182'+route);http.push({route,status:r.status,setCookiePresent:r.headers.has('set-cookie')});await r.text();}
const headTests=spawnSync('git',['show','HEAD:apps/official-site/tests/public-projection-bff.test.mjs'],{encoding:'utf8',windowsHide:true});
const facts={checkedAt:new Date().toISOString(),run:{startedAt:start,finishedAt:new Date().toISOString(),exitCode:probe.status,command:'node reviewer-3/cache-probe.mjs',scope:'VM reproduction run; exits 0 to record observed defect, not acceptance PASS'},cache:probe.status===0?JSON.parse(probe.stdout):probe.stderr,http,headBffTestCount:(headTests.stdout.match(/^test\(/gm)||[]).length,currentBffTestCount:(fs.readFileSync('apps/official-site/tests/public-projection-bff.test.mjs','utf8').match(/^test\(/gm)||[]).length};
fs.writeFileSync(path.join(dir,'cache-and-http.json'),JSON.stringify(facts,null,2));
console.log(JSON.stringify(facts));
