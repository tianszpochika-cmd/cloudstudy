// Generate planning metadata only; never changes canonical task states or services.
const fs=require('node:fs'); const crypto=require('node:crypto'); const path=require('node:path');
const root=path.resolve(__dirname,'..')+'/';
const base='docs/06-design/v2-980plus/redesign/';
const read=p=>fs.readFileSync(root+p,'utf8');
const plan=read(base+'dev-plan-R1.md'), ledger=read('requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md');
const parents=new Map(ledger.split(/\r?\n/).filter(l=>/^\| `P1R-/.test(l)).map(l=>{const c=l.split('|').slice(1,-1).map(v=>v.trim());return[c[0].replaceAll('`',''),c];}));
const rows=plan.split(/\r?\n/).filter(l=>/^\| R1-\d{3} /.test(l)).map(l=>l.split('|').slice(1,-1).map(v=>v.trim()));
if(rows.length!==114||rows.some(r=>r.length!==6))throw Error('invalid cards');
function expand(text,prefix) { const out=new Set();const add=n=>out.add(prefix+'-'+String(n).padStart(3,'0'));for(const m of text.matchAll(/\b(BC|IC|R1)-(\d{3})((?:(?:[…–—](?:(?:BC|IC|R1)-)?|\/)\d{3})*)/g)){if(m[1]!==prefix)continue;let prev=+m[2];add(prev);for(const tail of m[3].matchAll(/([…–—\/])(?:(?:BC|IC|R1)-)?(\d{3})/g)){const n=+tail[2];if(tail[1]==='/')add(n);else for(let i=prev;i<=n;i++)add(i);prev=n;}}return [...out]; }
const parentMap={};
function assign(a,b,p) {for(let i=a;i<=b;i++)parentMap[i]='P1R-'+p;}
assign(1,1,'M3-008');assign(2,6,'M2-002');assign(7,7,'M4-003');assign(8,9,'M2-002');assign(10,10,'M4-004');assign(11,11,'M4-009');assign(12,13,'M2-002');assign(14,14,'M4-010');assign(15,15,'M4-001');assign(16,16,'M4-003');assign(17,17,'M4-004');assign(18,21,'M4-005');assign(22,22,'M4-006');assign(23,24,'M4-005');assign(25,26,'M3-002');assign(27,27,'M4-005');assign(28,28,'M4-009');assign(29,29,'M4-010');assign(30,30,'M1-013');assign(31,36,'M4-007');assign(37,38,'M4-008');assign(39,39,'M5-001');assign(40,40,'M4-008');assign(41,41,'M4-010');assign(42,42,'M1-010');assign(43,50,'M5-002');assign(51,51,'M5-003');assign(52,52,'M5-005');assign(53,53,'M5-013');assign(54,54,'M5-006');assign(55,55,'M5-014');assign(56,56,'M1-013');assign(57,60,'M5-009');assign(61,61,'M5-010');assign(62,65,'M5-009');assign(66,66,'M5-012');assign(67,67,'M5-014');assign(68,68,'M1-013');assign(69,71,'M5-007');assign(72,73,'M5-008');assign(74,75,'M5-007');assign(76,76,'M5-008');assign(77,77,'M5-014');assign(78,78,'M5-013');assign(79,79,'M5-014');assign(80,80,'M1-013');assign(81,81,'M4-006');assign(82,85,'M5-011');assign(86,86,'M5-012');assign(87,87,'M5-014');assign(88,88,'M1-008');assign(89,89,'M3-002');assign(90,90,'M3-001');assign(91,91,'M3-003');assign(92,92,'M3-005');assign(93,94,'M3-006');assign(95,96,'M3-007');assign(97,97,'M3-002');assign(98,98,'M3-007');assign(99,100,'M3-001');assign(101,102,'M3-009');assign(103,103,'M3-010');assign(104,104,'M1-016');assign(105,106,'M6-009');assign(107,107,'M6-005');assign(108,108,'M6-007');assign(109,109,'M2-007');assign(110,110,'M2-006');assign(111,111,'M8-014');assign(112,112,'M6-009');assign(113,113,'M6-009');assign(114,114,'M8-001');
parentMap[39]='P1R-M4-008';
const contracts=n=>n<=17?['P1R-M1-002','P1R-M1-003','P1R-M1-004','P1R-M1-005','P1R-M1-011']:n<=29?['P1R-M1-008','P1R-M1-010','P1R-M1-012']:n<=41?['P1R-M1-011','P1R-M1-012','P1R-M1-013',...(n===39?['P1R-M1-008']:[])]:n<=55?['P1R-M1-009','P1R-M1-010','P1R-M1-013']:n<=87?['P1R-M1-010','P1R-M1-013']:n<=103?['P1R-M1-003','P1R-M1-008','P1R-M1-009']:['P1R-M1-003','P1R-M1-007','P1R-M1-016','P1R-M1-017'];
const steps=new Map(read(base+'business-chains.md').split(/\r?\n/).filter(l=>/^\| BC-\d{3}\b/.test(l)).map(l=>[l.match(/^\| (BC-\d{3})/)[1],expand(l.split('|').at(-2),'IC')]));
const sourceDoc=read(base+'design-source-traceability.md');
const rtRows=new Map(sourceDoc.split(/\r?\n/).filter(l=>/^\| RT\d{2} /.test(l)).map(l=>[l.split('|')[1].trim(),l]));
const sources=sourceDoc.split(/\r?\n/).filter(l=>/^\| (A\d{2}|M\d{2}) /.test(l)).map(l=>{const c=l.split('|').slice(1,-1).map(v=>v.trim());return {id:c[0].split(' ')[0],bcs:expand(c[1],'BC'),ics:expand(c[1],'IC'),requirements:[...new Set(c[2].match(/(?:FEAT-[A-Z]+-\d+|PRD-ATOM-\d+|V2-980-\d+)/g)||[])],architecture:[...new Set(c[3].match(/ARCH-[A-Z]+-\d+/g)||[])],runtime:[...new Set([...c[4].matchAll(/RT\d{2}/g)].flatMap(m=>(rtRows.get(m[0])||'').match(/(?:ACT|JNY|PAGE|RULE|INT|E2E)-P1-[A-Z0-9-]+/g)||[]))]};});
const reviewCoverage={ 'R2-01':[36,89,102,103], 'R2-02':[104,108,113], 'R2-03':[36,40,102,103,114], 'R2-04':[92,102,103], 'R2-05':[107,113], 'R2-06':[95,98,102,103], 'R2-07':[34,36,40,41,62,70], 'R2-08':[34,60,62,69,70,72,82], 'R2-09':[23,31,33,36,41], 'R2-10':[92,93,103], 'R2-11':[104,107,113], 'R2-12':[99,101,112,113] };
const tasks=rows.map(c=>{
 const n=+c[0].slice(-3),pid=parentMap[n],parent=parents.get(pid);if(!parent)throw Error('parent '+pid);
 const bcs=expand(c[1],'BC'); const ics=new Set(expand(c[1],'IC')); for(const b of bcs)for(const i of steps.get(b)||[])ics.add(i);
 const mapped=sources.filter(x=>x.bcs.some(b=>bcs.includes(b))||x.ics.some(i=>ics.has(i)));
 return {id:c[0],executionParent:pid,relatedParents:n===108?['P1R-M6-008']:n===104?['P1R-M1-017']:n===114?['P1R-M8-002','P1R-M8-003','P1R-M8-004','P1R-M8-006']:[],kind:/契约/.test(c[1])?'contract':/^QA\b/.test(c[4])?'qa':c[1].startsWith('IC-')?'frontend':'implementation',title:c[2],scope:c[1],bc:bcs,ic:[...ics].sort(),owner:c[4],dependsOn:expand(c[5],'R1'),gateInputs:['G-ENV','G-CONTRACT','G-PLATFORM','G-FRONTEND',...(n>=18&&n<=98?['G-CONTENT']:[])],contractInputs:contracts(n),sourceTrace:{canonicalLedger:'requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md',canonicalTrace:parent[2],designRules:mapped.map(x=>x.id),requirements:[...new Set(mapped.flatMap(x=>x.requirements))].sort(),architecture:[...new Set(['ARCH-API-001','ARCH-DATA-001','ARCH-IAM-002','ARCH-REL-001',...mapped.flatMap(x=>x.architecture)])].sort(),runtime:[...new Set(mapped.flatMap(x=>x.runtime))].sort(),resolution:'父任务追溯与适用A/M规则是输入范围；开工前Contract/Data owner展开本卡精确适用项，并排除非本卡范围，未解析不算READY'},acceptance:c[3],delivery:['适用OpenAPI/AsyncAPI/Flyway/policy和生成DTO/TS的当前版本','正式宿主代码/迁移/回滚或QA仅验证的限定交付物','成功/拒绝/重复/并发/失败与中断恢复的可重放证据','owner读回、页面/审计对账及未测边界'],evidenceDirectory:`evidence/p1r/m${pid.match(/M(\d)-/)[1]}/${pid}/redesign/${c[0]}/`,manifest:`evidence/p1r/m${pid.match(/M(\d)-/)[1]}/${pid}/manifest.json`,reviewFindings:Object.entries(reviewCoverage).filter(([,v])=>v.includes(n)).map(([k])=>k)};
});
tasks.find(t=>t.id==='R1-052').relatedParents.push('P1R-M5-004');
tasks.find(t=>t.id==='R1-001').contractInputs.push('P1R-M1-015');
tasks.find(t=>t.id==='R1-039').relatedParents.push('P1R-M3-006');
for(const n of [80,82,83,84,85]) tasks.find(t=>t.id==='R1-'+String(n).padStart(3,'0')).relatedParents.push('P1R-M1-010');
const specFiles=['R1-001-041.json','R1-042-087.json','R1-088-114.json'];
const specifications=new Map();
for(const filename of specFiles){const data=JSON.parse(read(base+'task-specs/'+filename));for(const spec of Array.isArray(data)?data:data.tasks){if(specifications.has(spec.id))throw Error('duplicate detailed spec '+spec.id);specifications.set(spec.id,{spec,filename});}}
if(specifications.size!==114)throw Error('114 detailed specs required, received '+specifications.size);
for(const task of tasks){
 const input=specifications.get(task.id);if(!input)throw Error('Missing detailed spec '+task.id);
 task.spec=input.spec;task.specFile=base+'task-specs/'+input.filename;task.instructionsFile=base+'tasks/'+task.id+'.md';
 task.sourceTrace.requirements=[...new Set(task.spec.requirementBindings.filter(b=>b.applicability!=='EXCLUDED'&&b.applicability!=='NOT_APPLICABLE'&&b.id!=='N/A').map(b=>b.id))].sort();
 task.sourceTrace.architecture=[...new Set(task.spec.architectureBindings.map(b=>b.id))].sort();
 task.sourceTrace.runtime=[...new Set(task.spec.runtimeBindings.map(b=>b.id))].sort();
 task.sourceTrace.resolution='本卡精确适用与排除项已逐项列出；当前运行/签收证据仍需Gate核验，不再留给执行模型推测来源';
 task.delivery=task.spec.deliverables;
}
const index={schemaVersion:2,revision:'CHG-R1-005',date:'2026-10-03',status:'DETAILED-PLANNING / EXECUTION-GATES-PENDING',planFile:base+'dev-plan-R1.md',planSha256:crypto.createHash('sha256').update(plan).digest('hex'),specFiles:specFiles.map(f=>base+'task-specs/'+f),canonicalStateSource:'requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md',scopeNote:'114逐步卡，114唯一BC引用（含只读/历史演示边界）；子交付与审批在status.json，正式认领/父状态仍归P1R；规划完成不表示运行Gate通过',excluded:'R2/R3/P2/P3写能力与BC084正式简审例外无本轮开放授权；全Phase1仍按P1R全范围',tasks};
fs.writeFileSync(root+base+'dev-plan-R1.tasks.json',JSON.stringify(index,null,2)+'\n');console.log('indexed '+tasks.length+' cards; BC='+new Set(tasks.flatMap(t=>t.bc)).size);
require('./lib/render-redesign-task-cards.cjs').render(root,base,index);
