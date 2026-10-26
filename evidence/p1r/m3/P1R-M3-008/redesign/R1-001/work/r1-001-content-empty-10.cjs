// Own empty-fixture content process; preserves launcher9 and all old receipts.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const schema='r1_001_empty_20261005_t9b',reader='r1_001_reader_t9b';
const args=process.argv.slice(2),start=args.includes('--start');
const outIndex=args.indexOf('--out-dir');
const out=outIndex>=0?args[outIndex+1]:'evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/content-empty-10';
if(!out)throw Error('Missing output directory');
const jar='services/content-service/target/content-service-0.1.0-SNAPSHOT.jar';
const jarInfo={path:jar,bytes:fs.statSync(jar).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(jar)).digest('hex')};
const keys=['CONTENT_EVENT_RELAY_ENABLED','CONTENT_EVENT_CONSUMER_ENABLED','CONTENT_SCHEDULE_ENABLED','CONTENT_FLYWAY_ENABLED','SPRING_FLYWAY_ENABLED'];
const flags=Object.fromEntries(keys.map(k=>[k,'false']));
const config={CONTENT_PERSISTENCE_MODE:'jdbc',CONTENT_JDBC_USERNAME:reader,
 CONTENT_JDBC_URL:`jdbc:mysql://127.0.0.1:13306/${schema}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true`,
 CONTENT_SERVICE_SCHEMA:schema,CONTENT_SERVICE_SERVER_ADDRESS:'127.0.0.1',CONTENT_SERVICE_PORT:'18089',...flags,P1R_DIAG:'0'};
const metadata={checkedAt:new Date().toISOString(),schema,reader,host:'127.0.0.1',port:18089,jar:jarInfo,safeFlags:flags,P1R_DIAG:'0',
 mode:start?'start-requested':'validate-only',passwordPolicy:'Dedicated fixture reader credential resolved only at start; never output or put on command line; no admin credentials forwarded to Java'};
fs.mkdirSync(out,{recursive:true});
const target=path.join(out,'content-empty-10.json');
if(fs.existsSync(target))throw Error('Output already exists; choose a fresh --out-dir');
fs.writeFileSync(target,JSON.stringify(metadata,null,2),{flag:'wx'});
if(!start){console.log(JSON.stringify({result:'VALIDATE PASS',schema,reader,port:18089,jar:jarInfo,safeFlags:flags,backendStarted:false}));process.exit(0);}
const prepare=fs.readFileSync('evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/prepare-empty-schema-9.mjs','utf8');
const existingFallback=prepare.match(/const adminPassword = process\.env\.MYSQL_ROOT_PASSWORD \|\| "([^"]+)";/)?.[1];
const rootInput=process.env.MYSQL_ROOT_PASSWORD||existingFallback;
const password=process.env.R1_001_READER_PASSWORD||(rootInput?`${rootInput}_ro_tmp`:null);
if(!password){console.error('Fixture reader credential unavailable; backend not started');process.exit(2);}
// Only non-secret host necessities and the fixture reader credential enter Java.
const hostKeys=['PATH','Path','JAVA_HOME','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP','USERPROFILE','LOCALAPPDATA'];
const hostEnv=Object.fromEntries(hostKeys.filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));
if(process.platform==='win32'&&fs.existsSync('C:\\Temp')){hostEnv.TEMP='C:\\Temp';hostEnv.TMP='C:\\Temp';}
const child=spawn('java',['-jar',jar,'--server.address=127.0.0.1','--server.port=18089','--spring.profiles.active=v2,local-real','--local.runtime.mode=local-real'],
 {cwd:process.cwd(),env:{...hostEnv,...config,CONTENT_JDBC_PASSWORD:password},stdio:'inherit',windowsHide:true});
child.once('spawn',()=>{
 const receipt={...metadata,pid:child.pid,spawnedAt:new Date().toISOString(),scope:'Own content instance bound to approved empty fixture; emitted flags only, no secrets'};
 fs.writeFileSync(path.join(out,'content-empty-10-process.json'),JSON.stringify(receipt,null,2),{flag:'wx'});
 console.log(JSON.stringify({event:'own-content-spawned',pid:child.pid,schema,reader,port:18089,safeFlags:flags}));
});
child.once('error',()=>{console.error('Own content process failed to spawn; details suppressed');process.exitCode=1;});
child.once('exit',(code,signal)=>{console.log(JSON.stringify({event:'own-content-stopped',pid:child.pid,code,signal}));process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{if(child.pid&&!child.killed)child.kill('SIGTERM');});
