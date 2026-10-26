import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync('evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/r1-001-sweep-6.cjs','utf8');
const functions=source.slice(source.indexOf('function expectedEntry('),source.indexOf('if (require.main === module)'));
const context={assert,URL,URLSearchParams};vm.createContext(context);vm.runInContext(functions,context);
const web={target:'web',href:'http://127.0.0.1:18180/register?returnTo=%2Fhome&uiLocale=zh-CN&theme=system',visible:true};
const mobile={target:'mobile',href:'http://127.0.0.1:18183/#/pages/register/register?returnTo=%2Fpages%2Fhome%2Fhome&uiLocale=zh-CN&theme=system',visible:true};
// Unit test double for only the DOM facts consumed by collectFromPage, no browser automation.
const page=entries=>({locator:selector=>selector==='h1'?{first:()=>({waitFor:async()=>{},innerText:async()=>'Test fixture'})}:{first:()=>({waitFor:async()=>{}}),evaluateAll:async()=>entries},evaluate:async()=>false});
const rows=[];
for(const [name,label,entries,expectedAccepted] of [
 ['valid-desktop','1440x900',[web],true],['valid-mobile','375x812',[mobile],true],
 ['mobile-all-web','375x812',[web],false],['desktop-all-mobile','1440x900',[mobile],false],
 ['all-links-hidden','375x812',[{...mobile,visible:false}],false],['no-entries','375x812',[],false]
]){
 let accepted=true,error=null;try{await context.collectFromPage(page(entries),label,'/courses');}catch(e){accepted=false;error=e.message;}
 rows.push({name,label,entries,expectedAccepted,accepted,matchesExpectation:accepted===expectedAccepted,error});
}
const result={checkedAt:new Date().toISOString(),scope:'Exact current collectFromPage function with synthetic DOM-fact test doubles; no real browser run or product defect inferred',rows,falsePasses:rows.filter(r=>r.accepted&&!r.expectedAccepted).length};
fs.writeFileSync(path.join(dir,'collector-probe.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
