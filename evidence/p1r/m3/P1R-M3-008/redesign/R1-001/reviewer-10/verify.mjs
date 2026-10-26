import fs from 'node:fs';
import crypto from 'node:crypto';
import net from 'node:net';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {artifact,gitSnapshot} from '../../../../../../../scripts/lib/redesign-task-state.mjs';
const require=createRequire(import.meta.url),root=process.cwd();
const base='evidence/p1r/m3/P1R-M3-008/redesign/R1-001/',out=base+'reviewer-10/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const delivery=read(base+'delivery-7.json'),previous=read(base+'delivery-6.json');
const index=read('docs/06-design/v2-980plus/redesign/dev-plan-R1.tasks.json');
const state=read('docs/06-design/v2-980plus/redesign/dev-plan-R1.status.json');
if(state.revision!==23||state.tasks[0].state!=='REVIEW')throw Error('state changed');
const snapshot=gitSnapshot(root,index.tasks[0]);
if(delivery.sourceCommit!==snapshot.sourceCommit||delivery.dirtyDiffSha256!==snapshot.dirtyDiffSha256)throw Error('snapshot drift');
for(const entry of [...delivery.artifacts,...delivery.evidence])if(hash(entry.path)!==entry.sha256)throw Error('artifact drift '+entry.path);
for(const entry of previous.artifacts)if(hash(entry.path)!==entry.sha256)throw Error('product drift '+entry.path);
const r=spawnSync(process.execPath,['--test','apps/official-site/tests/public-projection-bff.test.mjs','apps/official-site/tests/b13-official-site.test.mjs','apps/official-site/tests/b14-fe-005.test.mjs','apps/official-site/tests/website-entry.test.mjs'],{encoding:'utf8',maxBuffer:8000000,windowsHide:true});
fs.writeFileSync(out+'units.log',(r.stdout||'')+(r.stderr||''),{flag:'wx'});
if(r.status!==0||!/pass 38/.test(r.stdout))throw Error('units failed');
const {collectFromPage}=require('../work/r1-001-sweep-7.cjs');
const href='http://127.0.0.1:18180/register?returnTo=%2Fhome&uiLocale=zh-CN&theme=system';
const fake=entries=>({__r1Status:200,locator:selector=>selector==='h1'?{first:()=>({waitFor:async()=>{},innerText:async()=>'Fixture'})}:{evaluateAll:async()=>entries},evaluate:async()=>false});
const probes=[];
for(const [name,entries] of [['hidden',[{href,target:'web',visible:false,actionable:true}]],['disabled',[{href,target:'web',visible:true,actionable:false}]]]){
 let accepted=true,result,error;try{result=await collectFromPage(fake(entries),'1440x900','/fixture');}catch(e){accepted=false;error=e.message;}
 probes.push({name,mocked:true,expectedAccepted:false,actualAccepted:accepted,result,error:error||null});
}
const sweep=read(base+'work/tc10/sweep-empty-10/r1-001-sweep-7.json');
const falsePassPages=sweep.viewports.filter(x=>x.check.startsWith('375x812 r1-001')&&x.ok&&x.detail?.operable===0).map(x=>x.check);
const ready=read(base+'reviewer-9-prep/ready-9.json');
const replacedPreparationSources=ready.sourceArtifacts.filter(e=>hash(e.path)!==e.sha256).map(e=>({path:e.path,original:e.sha256,current:hash(e.path),includedInDelivery:delivery.artifacts.some(a=>a.path===e.path)}));
const screenshots=delivery.evidence.filter(e=>e.path.endsWith('.png')).map(e=>({path:e.path,sha256:e.sha256}));
const ports=await Promise.all([18070,18089,18096,18182,18180,18183].map(port=>new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port});let done=false;const finish=state=>{if(done)return;done=true;s.destroy();resolve({port,state});};s.setTimeout(800,()=>finish('UNKNOWN'));s.on('connect',()=>finish('BUSY'));s.on('error',e=>finish(e.code==='ECONNREFUSED'?'CLOSED':'UNKNOWN'));})));
const result={checkedAt:new Date().toISOString(),state:{revision:23,state:'REVIEW'},receipt:artifact(root,base+'delivery-7.json'),verified:{artifacts:28,evidence:33,productFilesUnchanged:24,units:38,unitExit:r.status},probes,falsePassPages,replacedPreparationSources,screenshots,ports,scope:'Independent receipt/snapshot/source review and synthetic collector probes; no service/database/browser started. Screenshot inspection performed separately.'};
fs.writeFileSync(out+'verification.json',JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({verified:result.verified,probes,falsePassPages,replacedPreparationSources:replacedPreparationSources.length,ports}));
