import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyArtifact} from '../../../../../../../scripts/lib/redesign-task-state.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const base='evidence/p1r/m3/P1R-M3-008/redesign/R1-001/';
const historical=[];
for(let i=1;i<=5;i++){
 const receipt=JSON.parse(fs.readFileSync(base+`reviewer-${i}/reject-${i}.json`,'utf8'));
 for(const artifact of receipt.evidence){verifyArtifact(process.cwd(),artifact);}
 historical.push({reviewer:i,evidenceCount:receipt.evidence.length,result:'all pinned review evidence unchanged'});
}
const delivery=JSON.parse(fs.readFileSync(base+'delivery-6.json','utf8'));
const paths=['work/r1-001-sweep-6.cjs','work/real-upstream-6.cjs',
 'work/real-upstream-6/courses-success-375x812.png','work/real-upstream-6/courses-success-1440x900.png'];
const pinning=paths.map(p=>({path:base+p,exists:fs.existsSync(base+p),sha256:crypto.createHash('sha256').update(fs.readFileSync(base+p)).digest('hex'),inReceipt:delivery.evidence.some(a=>a.path===base+p)}));
const ports=await Promise.all([18070,18089,18096,18182,18180,18183].map(port=>new Promise(resolve=>{
 const socket=net.connect({port,host:'127.0.0.1'}); let done=false;
 const finish=state=>{if(done)return;done=true;socket.destroy();resolve({port,state});};
 socket.on('connect',()=>finish('LISTENING'));socket.on('error',()=>finish('CLOSED'));socket.setTimeout(1500,()=>finish('TIMEOUT'));
})));
const result={checkedAt:new Date().toISOString(),historical,pinning,ports,scope:'receipt pinning and loopback availability only; no backend launch or database access'};
fs.writeFileSync(path.join(dir,'evidence-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
