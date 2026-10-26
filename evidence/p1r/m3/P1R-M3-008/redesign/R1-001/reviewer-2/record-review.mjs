import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifact, taskDigest, REVIEWER_THREAD, verifyArtifact, gitSnapshot } from '../../../../../../../scripts/lib/redesign-task-state.mjs';
const root=process.cwd(),dir=path.dirname(fileURLToPath(import.meta.url));
const base='docs/06-design/v2-980plus/redesign/';
const index=JSON.parse(fs.readFileSync(base+'dev-plan-R1.tasks.json'));
const state=JSON.parse(fs.readFileSync(base+'dev-plan-R1.status.json'));
const task=index.tasks.find(t=>t.id==='R1-001');
const delivery=JSON.parse(fs.readFileSync(task.evidenceDirectory+'delivery-2.json'));
for(const item of [...delivery.artifacts,...delivery.evidence]) verifyArtifact(root,item);
const current=gitSnapshot(root,task);
if(current.sourceCommit!==delivery.sourceCommit||current.dirtyDiffSha256!==delivery.dirtyDiffSha256)throw Error('Delivery-2 source drift: review must restart');
if(state.revision!==7||state.tasks.find(t=>t.id===task.id).state!=='REVIEW')throw Error('Concurrent status change: reload before recording');
const findings=[
{id:'F07',priority:'P2',path:'apps/official-site/server/api/public-projection.get.ts',line:209,problem:'HTTP200业务recovery响应在normalize后仍被替换为空projection，stale强制false，独立commerce成功又清掉全局errorCode。真实执行当前BFF得到state=recovery但courses=0/generatedAt=null/stale=false；facet却保留旧时间和stale=true，恢复内容与页面状态不一致。',fix:'在现有受控状态规则内保留合法可读recovery公开数据、更新时间、stale和原因；继续清空permission/error/maintenance的不可读内容，保持commerce独立新鲜度，不能因本问题把正常新鲜价格误判旧数据。新增走完整BFF的recovery组合断言，不只测normalize；保留401/403/404/410、过期及并发作废安全负例。',retestCaseIds:['R1-001-TC02']},
{id:'F08',priority:'P2',path:task.evidenceDirectory+'summary.md',line:4,problem:'delivery-2覆盖了delivery-1已固定哈希的summary.md（旧ab5ecabc…，当前fc497d6f…），与“不覆盖历史证据”的报告矛盾。当前24 artifacts/8 evidence及scope全部匹配不代表旧证据完整。',fix:'保持现有delivery-1/2、reviewer-1/2及其收据字节不变，新报告使用summary-3.md等版本路径。若有原始summary字节，另存归档并验旧哈希，通过新增历史恢复映射说明原路径漂移；若无原字节，如实登记旧summary无法恢复，以新独立证据补足，不改旧收据哈希掩盖问题。',retestCaseIds:['R1-001-TC01','R1-001-TC02','R1-001-TC03']},
{id:'F09',priority:'P1',path:task.evidenceDirectory+'delivery-2.json',line:1,problem:'提交仍列4项P1阻塞：三个必测产品TC与浏览器套件。当前18070、18180、18183未监听，只能验证官网error分支和生成目标，不能验证成功/空态实际渲染、真实503恢复、注册重复点击与回跳。',fix:'协调隔离的现有公开Gateway/content/commerce只读验收实例与学习端注册页面，保持固定端口/无秘密/不重启共享服务，不伪造发布事实。按TC01-03提交当前截图、Console、请求及回跳证据；VM/HTTP仅标局部检查。复测website-runtime适用断言或交主审用现有浏览器执行对应检查并逐条登记，不把未跑套件标PASS。缺输入时先报告具体缺项，维持阻塞，不开002。',retestCaseIds:['R1-001-TC01','R1-001-TC02','R1-001-TC03']}
];
const report=`# R1-001 delivery-2 独立审批（2026-10-03）

## 决定

**REWORK：继续R1-001，R1-002保持PLANNED；不批准ACCEPTED，不晋升P1R父状态。** 上轮F01-F05的指定源码修改已落实，但恢复数据边界和历史证据仍有确定问题，且4项P1交付缺口没有关闭。执行人这次诚实标记阻塞，值得保留这一口径；32项检查不能代替三项产品TC。

## 当前收据和范围

- 主审逐文件重算：delivery-2的24 artifacts与8 evidence全部匹配；墙内收据摘要、spec与Git限定差量均一致。当前18文件有差量，6文件零diff复用。
- sourceCommit=${current.sourceCommit}；dirtyDiffSha256=${current.dirtyDiffSha256}。
- 审查开始时revision7、R1-001 REVIEW、R1-002 PLANNED。使用正式reject收据转REWORK，审批墙由工具同步；不改业务实现。
- delivery-1五项旧evidence中只有summary不匹配，其余四项保留；reviewer-1历史未由本轮改写。详见[摘要核对](hashes.json)。

## 独立验证

| 检查 | 当前结论 | 边界 |
|---|---|---|
| 四个既有套件 | 32/32通过，退出0 | 单元、源码断言和VM；非产品TC |
| 官网构建 | 主审直接调用pnpm.cmd，实际退出0、Build complete | 不能把历史wrapper退出1推断为依赖警告；本次直接构建已证实，无需因此改依赖 |
| composable定向语义类型检查 | 0条诊断，上轮TS2739已修 | 使用明确Nuxt声明shim；未执行全项目Nuxt typecheck |
| 上轮F01/F02/F03/F05 | empty文案源码分支、全局拒绝/维护/错误优先、三页恢复banner/重试及真实throw已补 | recovery新组合仍失败，见F07 |
| 上轮F04实际入口 | 375×812和1440×900各11页，所有data-learning-entry均正确指向18183 mobile或18180 Web | hydration后DOM；不证明无JS移动首屏或注册目标已运行 |
| 浏览器错误态 | 22次DOM采样无横向溢出、Console error/warn为空；课程重新加载仍诚实error | 当前上游不可用；仅课程局部截图目检，非22页完整视觉签收 |
| 真实上游/注册回跳 | 未通过 | 18070、18180、18183无监听；没有停止或重启共享服务 |

日志：[单元复跑](unit-rerun.log)、[构建及退出码](build-result.json)、[语义与类型结果](verification.json)、[实际浏览器采样](browser-checks.json)。

## 确定发现与整改

${findings.map(f=>`### ${f.id} · ${f.priority}\n\n- 位置：\`${f.path}:${f.line}\`\n- 问题：${f.problem}\n- 整改：${f.fix}\n- 复测：${f.retestCaseIds.join('、')}\n`).join('\n')}

## 恢复状态的复现细节

当前BFF输入HTTP200内容\`state=recovery, stale=true, errorCode=PUBLIC_PROJECTION_STALE\`并带课程和generatedAt，commerce返回plans空数组；输出\`state=recovery, stale=false, errorCode=null, courses=0, projection.generatedAt=null\`，但courses facet仍带旧时间和stale=true。相反，正常ready后的网络throw缓存路径保留课程且stale=true，说明两条恢复路径处理不同。独立成功的价格可保持自身ready；问题在于整个projection被清空，而不是要求所有facet统一恢复态。

另有候选：独立探针输入B9定义过的\`meta.stale=true\`时当前实现仍标ready、stale=false并允许60s公共缓存。当前操作响应主要使用ApiSuccessEnvelope，不能仅凭另一metadata schema假设运行接口必然发送meta；应在真实owner读回时确认实际元数据路径/契约，再确定是否纳入本卡适配，不擅改正式契约。

## 逐步和用例审批

- 步骤1：现有准备和摘要一致；步骤2因F07未通过；步骤3的旧F01/F03源码整改有效，成功/空/恢复渲染未全验；步骤4设备入口局部通过，安全回跳未全验；步骤5因F08/F09未完成。
- TC01：PARTIAL/BLOCKED，仅错误态双视口与设备出口已实测；缺空/成功态及注册点击落地。
- TC02：FAIL/PARTIAL，F07确定复现；真实503→恢复仍BLOCKED。
- TC03：PARTIAL/BLOCKED，静态安全用例通过；目标注册页、快速重复点击与返回未验。
- website-runtime.cjs未执行全套：本轮用CUA完成22页错误态和入口局部复验，不能转记全套PASS。

## 下一次交付的三步

1. 继续当前24文件授权内的小步整改，优先F07并补完整BFF恢复组合测试；不重做已修五项、不扩大架构。
2. 处理F08，所有新证据用版本文件名；生成本卡准确差量/基线快照并在隔离临时目录验证回退（共享树不实际回退）。完整开工前24文件可从Git+READY摘要重建，但仅退到delivery-1未发现对应源码补丁，不能宣称已验证。
3. 具备输入后由主审实际复验TC01-03及适用浏览器断言，提交delivery-3。若真实输入仍缺，单独交明确阻塞清单，不用模拟PASS、已构建或任务数关闭缺口；不进入R1-002。

本次仅启动和停止自己的18182临时构建产物进程，恢复浏览器视口并关闭自建标签。没有改正式业务、数据库、端口、共享服务或读取输出凭据。

![课程错误态重试后的实际截图](courses-retry-desktop.png)
`;
fs.writeFileSync(path.join(dir,'review.md'),report,{flag:'wx'});
fs.writeFileSync(path.join(dir,'findings.json'),JSON.stringify({findings,currentSourceSnapshot:current,delivery2Verified:true},null,2),{flag:'wx'});
const rel=task.evidenceDirectory+'reviewer-2/';
const evidence=fs.readdirSync(dir).filter(n=>n!=='reject-2.json').map(n=>artifact(root,rel+n));
const receipt={taskId:task.id,action:'reject',expectedRevision:state.revision,specSha256:taskDigest(task),actor:'root-reviewer',role:'reviewer',reviewerThreadId:REVIEWER_THREAD,note:'delivery-2上轮五项整改已落实，32项和构建退出0；剩余恢复数据、历史证据及必测阻塞，继续001，不放行002。',evidence,findings};
fs.writeFileSync(path.join(dir,'reject-2.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({decision:'REWORK',findings:findings.length,expectedRevision:state.revision,receipt:rel+'reject-2.json'}));
