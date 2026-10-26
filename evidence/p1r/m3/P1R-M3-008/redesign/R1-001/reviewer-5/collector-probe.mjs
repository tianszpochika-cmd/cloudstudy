import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const sourcePath='evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/r1-001-sweep-5.cjs';
const source=fs.readFileSync(sourcePath,'utf8');
const functions=source.slice(source.indexOf('function expectedEntry('),source.indexOf('(async () =>'));
const context={assert,URL,URLSearchParams};
vm.createContext(context); vm.runInContext(functions,context);
const cases=[
 ['valid-web','1440x900','http://127.0.0.1:18180/register?returnTo=%2Fhome&uiLocale=zh-CN&theme=system',true],
 ['wrong-web-path','1440x900','http://127.0.0.1:18180/register-incorrect?returnTo=%2Fhome&uiLocale=zh-CN&theme=system',false],
 ['path-only-in-query','1440x900','http://127.0.0.1:18180/incorrect?extra=/register&returnTo=%2Fhome&uiLocale=zh-CN&theme=system',false],
 ['valid-mobile','375x812','http://127.0.0.1:18183/#/pages/register/register?returnTo=%2Fpages%2Fhome%2Fhome&uiLocale=zh-CN&theme=system',true],
 ['wrong-mobile-path','375x812','http://127.0.0.1:18183/#/pages/register/register-incorrect?returnTo=%2Fpages%2Fhome%2Fhome&uiLocale=zh-CN&theme=system',false],
 ['wrong-origin','1440x900','https://evil.invalid/register?returnTo=%2Fhome&uiLocale=zh-CN&theme=system',false]
];
const rows=cases.map(([name,viewport,href,expectedAccepted])=>{
 let accepted=true,error=null;
 try {context.checkHref(href,context.expectedEntry(viewport),name);}catch(e){accepted=false;error=e.message;}
 return {name,href,expectedAccepted,accepted,matchesExpectation:accepted===expectedAccepted,error};
});
const result={checkedAt:new Date().toISOString(),scope:'Exact function extracted from pinned executor collector; synthetic URL inputs; no browser or product defect inferred',sourcePath,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),rows,falsePasses:rows.filter(r=>r.accepted&&!r.expectedAccepted).length};
fs.writeFileSync(path.join(dir,'collector-probe.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
