import fs from 'node:fs';
import path from 'node:path';
import { artifact, inputArtifacts, gitSnapshot, taskDigest, REVIEWER_THREAD, applyReceipt } from '../../../../../../../scripts/lib/redesign-task-state.mjs';
const root=process.cwd(),base='docs/06-design/v2-980plus/redesign/';
const taskBase='evidence/p1r/m3/P1R-M3-008/redesign/R1-001/';
const dir=taskBase+'reviewer-9-prep/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const index=read(base+'dev-plan-R1.tasks.json'),state=read(base+'dev-plan-R1.status.json');
const task=index.tasks.find(t=>t.id==='R1-001');
if(state.revision!==20||state.tasks.find(t=>t.id===task.id).state!=='BLOCKED')throw Error('Concurrent status change');
const claim=read(taskBase+'inputs/claim-20261003.json');
if(artifact(root,index.canonicalStateSource).sha256!==claim.canonicalLedger.sha256)throw Error('Parent ledger drift');
const snapshot=gitSnapshot(root,task),delivery=read(taskBase+'delivery-6.json');
if(snapshot.sourceCommit!==delivery.sourceCommit||snapshot.dirtyDiffSha256!==delivery.dirtyDiffSha256)throw Error('Product snapshot drift');
fs.writeFileSync(dir+'scope-snapshot.json',JSON.stringify(snapshot,null,2),{flag:'wx'});
const collect=(p)=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?collect(p+e.name+'/'):[p+e.name]);
const evidencePaths=collect(dir).filter(p=>!p.endsWith('/prepare-ready.mjs')&&!p.endsWith('/ready-9.json'));
evidencePaths.push(taskBase+'inputs/claim-20261003.json',taskBase+'inputs/G-CONTRACT-20261003.md',taskBase+'inputs/G-PLATFORM-20261003.md',taskBase+'inputs/G-FRONTEND-20261003.md',taskBase+'reviewer-8-prep/review.md');
const extraSources=['r1-001-content-empty-10.cjs','real-upstream-10.cjs','real-chain-assert-10.cjs','r1-001-safe-run-10.cjs','real-chain-assert-9.cjs','real-chain-assert-8.cjs','prepare-empty-schema-9.mjs','r1-001-sweep-7.cjs'].map(f=>taskBase+'work/'+f);
extraSources.push('scripts/runtime/run-v2-services.mjs','services/content-service/target/content-service-0.1.0-SNAPSHOT.jar','services/commerce-service/target/commerce-service-0.1.0-SNAPSHOT.jar','services/api-gateway/target/api-gateway-0.1.0-SNAPSHOT.jar');
const scopes={
 'G-ENV':'限定只读终验输入：专用空schema八表0行、专用reader SELECT权限及接线已核；固定六端口当前空闲，Java/Node/Maven与jar身份可核，关闭relay/consumer/schedule/Flyway和P1R_DIAG。生效配置/健康/真实恢复为本卡后置验收，不签完整IAM/Outbox运行Gate。',
 'G-CONTRACT':'沿用未漂移的三个公开GET契约与原签收，24产品快照一致，独立38/38。无新增契约或DTO；不把准备签收扩称全服务契约运行PASS。',
 'G-PLATFORM':'Gateway公开读路径及owner输入已有源码与隔离空事实；仅启动当轮自有固定端口实例，非空场景只读共享发布事实并关闭后台任务，不提交注册，不操作他组进程。有效白名单/上游/DOM必须后置实测。',
 'G-FRONTEND':'共享i18n/受控注册链接基础输入未漂移，四套件38/38；10版采集脚本静态与终态负例通过、独立复核无新准备阻塞。双视口/失败重试/主题适用项/TC01至03仍待真实运行，不降级或豁免。'
};
const proof=dir+'review.md';
const receipt={taskId:task.id,action:'ready',expectedRevision:20,specSha256:taskDigest(task),actor:'root-reviewer',role:'reviewer',reviewerThreadId:REVIEWER_THREAD,
 note:'隔离输入已实际读回，主审修正准备接线并限定放行真实终验；不批准产品ACCEPTED，不开放R1-002。旧交付保留历史，下一轮start后提交delivery-7。',
 sourceArtifacts:[...inputArtifacts(root,task),...extraSources.map(p=>artifact(root,p))],
 parentClaim:{taskId:task.executionParent,confirmed:true,owner:claim.owner,canonicalLedgerSha256:artifact(root,index.canonicalStateSource).sha256},
 gates:task.gateInputs.map(id=>({id,result:'PASS',scope:scopes[id]||'ERROR',evidencePaths:[proof,dir+'preparation-check.json',dir+'runtime-preflight.json',dir+'independent-review.md']})),
 blockerDecisions:task.spec.blockers.map(b=>({id:b.id,disposition:'APPROVED',reason:'当前本卡公开只读输入及隔离空事实准备已落实，见限定Gate签收；产品TC、运行effective证明和未测安全项保留后置必测，不构成要求本卡先验完成的循环开工输入。',evidencePaths:[proof,dir+'runtime-preflight.json']})),
 evidence:[...new Set(evidencePaths)].map(p=>artifact(root,p))};
if(receipt.gates.some(g=>g.scope==='ERROR'))throw Error('Unreviewed gate');
const output=dir+'ready-9.json';fs.writeFileSync(output,JSON.stringify(receipt,null,2),{flag:'wx'});
const dry=applyReceipt(index,state,receipt,artifact(root,output),root,new Date().toISOString());
console.log(JSON.stringify({dryRun:true,state:dry.tasks.find(t=>t.id===task.id).state,revision:dry.revision,sourceArtifacts:receipt.sourceArtifacts.length,evidence:receipt.evidence.length,receipt:output}));
