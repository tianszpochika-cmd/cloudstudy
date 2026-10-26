import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=process.cwd(),dir=path.dirname(fileURLToPath(import.meta.url));
const delivery=JSON.parse(fs.readFileSync('evidence/p1r/m3/P1R-M3-008/redesign/R1-001/delivery-3.json'));
const paths=delivery.artifacts.map(a=>a.path);
const extra=['apps/official-site/nuxt.config.ts','apps/official-site/utils/gateway.ts','infra/docker/clyunedev/docker-compose.full.yml','infra/docker/clyunedev/clyunedev.full.env.example'];
const temp=fs.mkdtempSync(path.join(dir,'rollback-temp-'));
if(!path.resolve(temp).startsWith(path.resolve(dir)+path.sep+'rollback-temp-'))throw Error('Unexpected temp target');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function git(args,cwd=root){const r=spawnSync('git',args,{cwd,windowsHide:true});if(r.status!==0)throw Error(r.stderr.toString());return r.stdout;}
const patch=git(['diff','--binary',delivery.sourceCommit,'--',...paths]);
fs.writeFileSync(path.join(dir,'scope.patch'),patch);
const baseline=[];
const baselineBytes=new Map();
const startedAt=new Date().toISOString();
try{
 // Isolate Git discovery too: without this, a directory nested in the shared
 // repository can silently skip patch paths outside its relative prefix.
 git(['init','--quiet'],temp);
 for(const p of [...new Set([...paths,...extra])]){const bytes=git(['show',delivery.sourceCommit+':'+p]);const target=path.join(temp,p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);if(paths.includes(p)){baseline.push({path:p,sha256:digest(bytes)});baselineBytes.set(p,bytes);}}
 git(['apply','--check',path.join(dir,'scope.patch')],temp);
 git(['apply',path.join(dir,'scope.patch')],temp);
 const forward=delivery.artifacts.map(a=>{const applied=fs.readFileSync(path.join(temp,a.path));const current=fs.readFileSync(path.join(root,a.path));return{path:a.path,match:digest(applied)===a.sha256,textMatch:applied.toString('utf8').replaceAll('\r\n','\n')===current.toString('utf8').replaceAll('\r\n','\n')};});
 git(['apply','--reverse','--check',path.join(dir,'scope.patch')],temp);
 git(['apply','--reverse',path.join(dir,'scope.patch')],temp);
 const reversePatch=baseline.map(a=>{const applied=fs.readFileSync(path.join(temp,a.path));return{path:a.path,rawMatch:digest(applied)===a.sha256,textMatch:applied.toString('utf8').replaceAll('\r\n','\n')===baselineBytes.get(a.path).toString('utf8').replaceAll('\r\n','\n')};});
 if(reversePatch.some(a=>!a.textMatch))throw Error('Reverse patch changed baseline content');
 // Exact scoped rollback must restore original bytes too, rather than treating
 // normalized Git patch line endings as an exact working-file snapshot.
 for(const [p,bytes]of baselineBytes)fs.writeFileSync(path.join(temp,p),bytes);
 const reversed=baseline.map(a=>({path:a.path,match:digest(fs.readFileSync(path.join(temp,a.path)))===a.sha256}));
 const testFile=path.join(temp,'apps/official-site/tests/public-projection-bff.test.mjs');
 const test=spawnSync(process.execPath,['--test',testFile],{cwd:temp,encoding:'utf8',windowsHide:true});
 fs.writeFileSync(path.join(dir,'rollback-old-bff.log'),(test.stdout||'')+(test.stderr||''));
 const result={startedAt,finishedAt:new Date().toISOString(),scope:'scoped patch apply/reverse plus exact baseline-byte restoration in a unique isolated directory only; shared tree untouched; not restore to delivery-2 or production rollback',lineEndingBoundary:'Git patch normalizes line endings on changed files. Forward and reverse patch text are checked separately, then original Git bytes are explicitly restored for exact rollback hashes.',forward,reversePatch,reversed,baseline,oldBffTestCount:(fs.readFileSync(testFile,'utf8').match(/^test\(/gm)||[]).length,oldBffExitCode:test.status,patchSha256:digest(patch)};
 fs.writeFileSync(path.join(dir,'rollback-result.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({forwardRawMatches:forward.filter(a=>a.match).length,forwardTextMatches:forward.filter(a=>a.textMatch).length,reversedMatches:reversed.filter(a=>a.match).length,oldBffTestCount:result.oldBffTestCount,oldBffExitCode:test.status}));
 if(forward.some(a=>!a.textMatch)||reversed.some(a=>!a.match)||test.status!==0)process.exitCode=1;
}finally{fs.rmSync(temp,{recursive:true,force:true});}
