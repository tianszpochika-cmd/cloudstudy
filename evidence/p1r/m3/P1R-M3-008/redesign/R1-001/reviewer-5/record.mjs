import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {artifact,taskDigest,REVIEWER_THREAD,verifyArtifact,gitSnapshot} from '../../../../../../../scripts/lib/redesign-task-state.mjs';
const root=process.cwd(),dir=path.dirname(fileURLToPath(import.meta.url)),base='docs/06-design/v2-980plus/redesign/';
const index=JSON.parse(fs.readFileSync(base+'dev-plan-R1.tasks.json')),state=JSON.parse(fs.readFileSync(base+'dev-plan-R1.status.json'));
const task=index.tasks.find(t=>t.id==='R1-001'),record=state.tasks.find(t=>t.id===task.id),delivery=JSON.parse(fs.readFileSync(task.evidenceDirectory+'delivery-5.json'));
if(state.revision!==16||record.state!=='REVIEW')throw Error('Concurrent state change');
for(const a of [...delivery.artifacts,...delivery.evidence])verifyArtifact(root,a);
const snapshot=gitSnapshot(root,task);
if(snapshot.sourceCommit!==delivery.sourceCommit||snapshot.dirtyDiffSha256!==delivery.dirtyDiffSha256)throw Error('Scope drift');
const findings=[
 {id:'F11',priority:'P2',path:task.evidenceDirectory+'work/r1-001-sweep-5.cjs',line:31,
 problem:'checkHref用href.includes放宽路径，主审同函数三个错误path均误通过；negative-sweep只跑不可达origin，bad.html未供采集器使用，缺CTA/错path同入口负例仍缺。',
 fix:'版本6精确解析pathname/hash route并独立比对query；通过相同采集器或同实际校验模块运行合法与非200/缺CTA/错origin/错path/错设备样本，固定退出码与失败项，明确MOCKED只证明采集器。',retestCaseIds:['R1-001-TC01','R1-001-TC03']},
 {id:'F13',priority:'P2',path:task.evidenceDirectory+'work/real-upstream-5.cjs',line:42,
 problem:'pricing-empty只验购买button=0，error页或错误价格链接也可通过；未固定同轮上游到BFF/DOM事实和核心脚本/截图；website映射2true/3PARTIAL/6false与摘要统计不一致。',
 fix:'真实请求回执关联版本/ID/source/trace与DOM，断言合法空facet/空说明/无价格及购买链接，固定脚本输入日志截图哈希；映射按实际子断言计数，缺项保留PARTIAL。',retestCaseIds:['R1-001-TC01','R1-001-TC02']},
 {id:'F14',priority:'P2',path:'scripts/runtime/run-v2-services.mjs',line:197,
 problem:'启动器默认开启有写库能力的relay/consumer并连接既有owner schema，报告自有隔离只读和schemas=[]缺实际运行配置证明；未据此断言本次写库。运行输入Gate仍阻塞。',
 fix:'不修改后台实现；归档无秘密的有效profile/schema/后台开关/实例PID/jar信息并如实更正报告；后续显式停用写库后台任务与迁移seed，合法空事实从owner隔离输入取得，缺输入保持BLOCKED，不清共享库。',retestCaseIds:['R1-001-TC01','R1-001-TC02']}
];
fs.writeFileSync(path.join(dir,'findings.json'),JSON.stringify({findings},null,2)+'\n',{flag:'wx'});
const rel=task.evidenceDirectory+'reviewer-5/';
const receipt={taskId:task.id,action:'reject',expectedRevision:state.revision,specSha256:taskDigest(task),actor:'root-reviewer',role:'reviewer',reviewerThreadId:REVIEWER_THREAD,
 note:'delivery-5定向复核24+12一致，38/38，F12已修；采集器错path误过、真实空态/链路与隔离运行证据需补，下一组仅验收收尾四项，不放行002。',findings,
 evidence:fs.readdirSync(dir).filter(n=>n!=='reject-5.json'&&fs.statSync(path.join(dir,n)).isFile()).map(n=>artifact(root,rel+n))};
fs.writeFileSync(path.join(dir,'reject-5.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(rel+'reject-5.json');
