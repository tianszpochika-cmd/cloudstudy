const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const base='evidence/p1r/m3/P1R-M3-008/redesign/R1-001/',out=base+'reviewer-11b/';
fs.mkdirSync(out,{recursive:true});
const report={startedAt:new Date().toISOString(),browserPath:'Browser plugin not available; regular Playwright',runs:[],processes:[],checks:[]},owned=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function descendants(id){
 const r=spawnSync('powershell.exe',['-NoProfile','-Command',"Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true,maxBuffer:4000000});
 if(r.status!==0)throw Error('Cannot verify process ownership');
 const all=JSON.parse(r.stdout),ids=new Set([id]);let changed=true;
 while(changed){changed=false;for(const p of all)if(ids.has(p.ParentProcessId)&&!ids.has(p.ProcessId)){ids.add(p.ProcessId);changed=true;}}
 return [...ids].reverse();
}
function stop(p){if(!p||p.stopped)return;const ids=descendants(p.pid);const r=spawnSync('powershell.exe',['-NoProfile','-Command','Stop-Process -Id '+ids.join(',')+' -Force -ErrorAction SilentlyContinue'],{encoding:'utf8',windowsHide:true});p.stopped=true;report.processes.find(x=>x.pid===p.pid).stopRequestedAt=new Date().toISOString();}
function start(name,args,env={}){
 const child=spawn(process.execPath,args,{cwd:process.cwd(),env:{...process.env,...env},stdio:['ignore','pipe','pipe'],windowsHide:true});
 const entry={name,pid:child.pid,startedAt:new Date().toISOString()};report.processes.push(entry);const p={name,pid:child.pid,child};owned.push(p);
 child.stdout.on('data',d=>{const s=d.toString();for(const m of s.matchAll(/started ([\w-]+) pid=(\d+) port=(\d+)/g))entry.java={service:m[1],pid:Number(m[2]),port:Number(m[3])};});
 child.stderr.on('data',()=>{});child.on('error',()=>{p.error=true;});return p;
}
function front(name,dir,script){
 const child=spawn('powershell.exe',['-NoProfile','-Command','pnpm --dir '+dir+' '+script],{cwd:process.cwd(),env:{...process.env,NUXT_IGNORE_LOCK:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 child.stdout.on('data',()=>{});child.stderr.on('data',()=>{});const p={name,pid:child.pid,child};owned.push(p);report.processes.push({name,pid:p.pid,startedAt:new Date().toISOString()});return p;
}
async function healthy(url,timeout=150000){const until=Date.now()+timeout;while(Date.now()<until){try{const r=await fetch(url,{signal:AbortSignal.timeout(2500)});if(r.ok)return;}catch{}await pause(1000);}throw Error('Not healthy: '+url);}
async function portFree(port){return new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port});s.once('connect',()=>{s.destroy();resolve(false);});s.once('error',e=>resolve(e.code==='ECONNREFUSED'));s.setTimeout(800,()=>{s.destroy();resolve(false);});});}
async function run(name,args,env={}){
 const record={name,command:'node '+args.join(' '),startedAt:new Date().toISOString(),logPath:out+name+'.log'};
 const stream=fs.createWriteStream(record.logPath,{flags:'wx'});
 const child=spawn(process.execPath,args,{cwd:process.cwd(),env:{...process.env,...env},stdio:['ignore','pipe','pipe'],windowsHide:true});
 child.stdout.pipe(stream,{end:false});child.stderr.pipe(stream,{end:false});
 const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
 await new Promise(r=>stream.end(r));record.exitCode=code;record.finishedAt=new Date().toISOString();report.runs.push(record);
 console.log(JSON.stringify({step:name,exitCode:code}));assert.equal(code,0,name+' failed');
}
(async()=>{try{
 const ports=[18070,18089,18096,18182,18180,18183];for(const port of ports)assert.ok(await portFree(port),'Port already occupied '+port);
 const flags={P1R_DIAG:'0',CONTENT_EVENT_RELAY_ENABLED:'false',CONTENT_EVENT_CONSUMER_ENABLED:'false',CONTENT_SCHEDULE_ENABLED:'false',CONTENT_FLYWAY_ENABLED:'false',COMMERCE_FLYWAY_ENABLED:'false',SPRING_FLYWAY_ENABLED:'false'};
 const gw=start('gateway',[base+'work/r1-001-safe-run-10.cjs','--service','api-gateway'],flags);
 const commerce=start('commerce',[base+'work/r1-001-safe-run-10.cjs','--service','commerce-service'],flags);
 const site=front('official-site','apps/official-site','dev');
 let content;await Promise.all([healthy('http://127.0.0.1:18070/actuator/health/readiness'),healthy('http://127.0.0.1:18096/actuator/health/readiness'),healthy('http://127.0.0.1:18182/courses')]);
 await run('retry',[base+'reviewer-11/browser-retry-v2.cjs',out+'retry']);
 content=start('normal-content',[base+'work/r1-001-safe-run-10.cjs','--service','content-service'],flags);await healthy('http://127.0.0.1:18089/actuator/health/readiness');
 await run('normal-chain',[base+'work/real-upstream-10.cjs',out+'normal-chain'],{R1_001_SCENARIO:'nonempty'});
 await run('website',['apps/official-site/tests/browser/website-runtime.cjs'],{OFFICIAL_SITE_EVIDENCE_DIR:out+'website'});
 report.result='PASS';
}catch(e){report.result='FAIL';report.failure=String(e.message).slice(0,500);process.exitCode=1;console.error('Review stopped: '+report.failure);}
finally{for(const p of owned.slice().reverse()){try{stop(p);}catch(e){report.cleanupFailure=String(e.message);process.exitCode=1;}}
 await pause(1000);report.finalPorts=[];for(const port of [18070,18089,18096,18182,18180,18183])report.finalPorts.push({port,free:await portFree(port)});
 if(report.finalPorts.some(p=>!p.free)){report.result='FAIL';report.cleanupFailure='Own runtime did not fully stop';process.exitCode=1;}
 report.finishedAt=new Date().toISOString();fs.writeFileSync(out+'runtime-result.json',JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({result:report.result,failure:report.failure,cleanupFailure:report.cleanupFailure,runs:report.runs.length,ports:report.finalPorts}));}})();
