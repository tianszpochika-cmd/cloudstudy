import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {artifact,taskDigest,REVIEWER_THREAD,verifyArtifact,gitSnapshot} from '../../../../../../../scripts/lib/redesign-task-state.mjs';
const root=process.cwd(),dir=path.dirname(fileURLToPath(import.meta.url)),base='docs/06-design/v2-980plus/redesign/';
const index=JSON.parse(fs.readFileSync(base+'dev-plan-R1.tasks.json')),state=JSON.parse(fs.readFileSync(base+'dev-plan-R1.status.json'));
const task=index.tasks.find(t=>t.id==='R1-001'),record=state.tasks.find(t=>t.id===task.id),delivery=JSON.parse(fs.readFileSync(task.evidenceDirectory+'delivery-6.json'));
if(state.revision!==19||record.state!=='REVIEW')throw Error('Concurrent state change');
for(const a of [...delivery.artifacts,...delivery.evidence])verifyArtifact(root,a);
const snapshot=gitSnapshot(root,task);
if(snapshot.sourceCommit!==delivery.sourceCommit||snapshot.dirtyDiffSha256!==delivery.dirtyDiffSha256)throw Error('Scope drift');
const findings=[
 {id:'F11',priority:'P2',path:task.evidenceDirectory+'work/r1-001-sweep-6.cjs',line:61,problem:'按DOM自身target选期望，未校验可见性；真实collectFromPage三个错设备/全隐藏样本误通过。URL严格路径已修，不重报。',fix:'设备/可见性/HTTP共享事实断言，实际采集和测试替身同调；等待hydration及可操作设备入口，菜单先打开。',retestCaseIds:['R1-001-TC01','R1-001-TC03']},
 {id:'F13',priority:'P2',path:task.evidenceDirectory+'work/real-upstream-6.cjs',line:61,problem:'Gateway/BFF存档ID时间匹配，但DOM仅比数量、emptyNote未入PASS，报告Cookie0无代码/字段，截图未固定。',fix:'可见空说明/状态与真实链DOM对应作为PASS；Cookie真实补采或改未执行；固定当轮脚本输入日志截图。',retestCaseIds:['R1-001-TC01','R1-001-TC03']},
 {id:'F14',priority:'P1',path:task.evidenceDirectory+'delivery-6.json',line:1,problem:'继续以relay/consumer=true连接共享owner schema，安全只读运行输入未满足；未确认实际写库。',fix:'先提交禁用写后台任务/迁移seed的安全启动配置和预检，owner合法空输入与恢复步骤，主审签READY前不再启动后台。',retestCaseIds:['R1-001-TC01','R1-001-TC02']}
];
fs.writeFileSync(path.join(dir,'findings.json'),JSON.stringify({findings},null,2)+'\n',{flag:'wx'});
const files=['precheck.mjs','precheck.json','unit.log','facet.json','state-boundary.mjs','facet-probe.mjs','collector-probe.mjs','collector-probe.json','real-evidence-check.mjs','real-evidence-check.json','evidence-check.mjs','evidence-check.json','negative/negative-6.json','findings.json','review.md','record.mjs'];
const rel=task.evidenceDirectory+'reviewer-6/';
const receipt={taskId:task.id,action:'block',expectedRevision:state.revision,specSha256:taskDigest(task),actor:'root-reviewer',role:'reviewer',reviewerThreadId:REVIEWER_THREAD,
 note:'delivery-6严格URL已修，24+14一致、38/38；运行仍开启共享写后台任务，先BLOCKED并提交解阻准备包，不放行002。',
 condition:'安全只读运行Gate未满足：relay/consumer=true连接共享owner schema；合法空事实/真实503恢复尚缺，采集器设备可见性和报告证据仍需补。禁止按默认配置继续启后台。',
 unblockEvidence:'提交禁用写后台任务/迁移seed的本卡启动配置与可验证有效配置/owner输入，合法空事实和Gateway恢复策略；补共享采集断言与真实链/可见空态/Cookie口径，固定脚本日志截图；主审核对并登记READY后再运行终验。',
 findings,evidence:files.map(n=>artifact(root,rel+n))};
fs.writeFileSync(path.join(dir,'block-6.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(rel+'block-6.json');
