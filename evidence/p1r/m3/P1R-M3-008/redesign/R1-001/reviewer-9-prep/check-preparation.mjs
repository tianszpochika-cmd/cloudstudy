import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const base='evidence/p1r/m3/P1R-M3-008/redesign/R1-001/';
const out=base+'reviewer-9-prep/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const run=(name,args)=>{const r=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,maxBuffer:8000000});fs.writeFileSync(out+name+'.log',(r.stdout||'')+(r.stderr||''));if(r.status!==0)throw Error(name+' exit '+r.status);return {name,exitCode:r.status,log:out+name+'.log'};};
const log={startedAt:new Date().toISOString(),checks:[],runs:[],limitations:['No browser or service started; input preparation only']};
const chain=require('../work/real-chain-assert-10.cjs');
const valid={upstream:{status:200,courseIds:[]},commerce:{status:200},bff:{status:200,state:'ready',source:'gateway',courses:[],generatedAt:'2026-10-05T00:00:00Z',coursesFacet:{state:'empty',stale:false,errorCode:null}}};
for(const [name,changes,expected] of [['valid',{},true],['loading',{coursesFacet:{...valid.bff.coursesFacet,state:'loading'}},false],['recovery',{coursesFacet:{...valid.bff.coursesFacet,state:'recovery'}},false],['invalid-time',{generatedAt:'invalid'},false]]){
 let accepted=true;try{chain.assertEmptyChain({...valid,bff:{...valid.bff,...changes}},name);}catch{accepted=false;}
 if(accepted!==expected)throw Error('terminal-probe '+name);
 log.checks.push({name:'terminal-probe '+name,accepted,expected,matched:true,mocked:true});
}
const source=fs.readFileSync('packages/i18n/src/official-site.ts','utf8');
for(const [key,expected] of [['c52c0deec1','内容准备中'],['c7be801719','首期计划免费；实际开放安排以公告为准。']]){
 const match=source.match(new RegExp('\\b'+key+':\\s*"((?:\\\\.|[^"\\\\])*)"'));
 if(!match||JSON.parse('"'+match[1]+'"')!==expected)throw Error('canonical-copy '+key);
 log.checks.push({name:'canonical-copy '+key,result:'PASS'});
}
for(const file of ['r1-001-content-empty-10.cjs','real-chain-assert-10.cjs','real-upstream-10.cjs','r1-001-safe-run-10.cjs'])log.runs.push(run('syntax-'+file,['--check',base+'work/'+file]));
log.runs.push(run('units',['--test','apps/official-site/tests/public-projection-bff.test.mjs','apps/official-site/tests/b13-official-site.test.mjs','apps/official-site/tests/b14-fe-005.test.mjs','apps/official-site/tests/website-entry.test.mjs']));
const unit=fs.readFileSync(out+'units.log','utf8');if(!/tests 38/.test(unit)||!/pass 38/.test(unit)||!/fail 0/.test(unit))throw Error('unit totals');
const delivery=read(base+'delivery-6.json');
log.delivery6={artifacts:delivery.artifacts.length,evidence:delivery.evidence.length,unchanged:true};
for(const item of [...delivery.artifacts,...delivery.evidence])if(hash(item.path)!==item.sha256)throw Error('delivery drift '+item.path);
log.readySources=read(base+'inputs/rework-1/ready-rework-1.json').sourceArtifacts.filter(a=>!delivery.artifacts.some(b=>b.path===a.path)).map(a=>({path:a.path,unchanged:hash(a.path)===a.sha256}));
if(log.readySources.some(a=>!a.unchanged))throw Error('input source drift');
const ports=[18070,18089,18096,18182,18180,18183];
log.ports=await Promise.all(ports.map(port=>new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port});let done=false;const finish=state=>{if(done)return;done=true;s.destroy();resolve({port,state});};s.setTimeout(800,()=>finish('UNKNOWN'));s.on('connect',()=>finish('BUSY'));s.on('error',e=>finish(e.code==='ECONNREFUSED'?'CLOSED':'UNKNOWN'));})));
if(log.ports.some(p=>p.state!=='CLOSED'))throw Error('port unavailable');
const history=read('docs/06-design/v2-980plus/redesign/dev-plan-R1.status.json');
log.state={revision:history.revision,task:history.tasks.find(t=>t.id==='R1-001').state,nextTask:history.tasks.find(t=>t.id==='R1-002').state};
if(log.state.revision!==20||log.state.task!=='BLOCKED'||log.state.nextTask!=='PLANNED')throw Error('state drift');
log.finishedAt=new Date().toISOString();log.result='PASS';
fs.writeFileSync(out+'preparation-check.json',JSON.stringify(log,null,2),{flag:'wx'});
console.log(JSON.stringify({result:log.result,units:'38/38',terminalProbes:4,delivery6:log.delivery6,ports:log.ports,state:log.state}));
