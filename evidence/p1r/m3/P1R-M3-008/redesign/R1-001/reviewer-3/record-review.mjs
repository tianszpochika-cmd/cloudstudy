import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {artifact,taskDigest,REVIEWER_THREAD,verifyArtifact,gitSnapshot} from '../../../../../../../scripts/lib/redesign-task-state.mjs';
const root=process.cwd(),dir=path.dirname(fileURLToPath(import.meta.url)),base='docs/06-design/v2-980plus/redesign/';
const index=JSON.parse(fs.readFileSync(base+'dev-plan-R1.tasks.json'));
const state=JSON.parse(fs.readFileSync(base+'dev-plan-R1.status.json'));
const task=index.tasks.find(t=>t.id==='R1-001'), record=state.tasks.find(t=>t.id===task.id);
const delivery=JSON.parse(fs.readFileSync(task.evidenceDirectory+'delivery-3.json'));
for(const a of [...delivery.artifacts,...delivery.evidence])verifyArtifact(root,a);
const current=gitSnapshot(root,task);
if(current.dirtyDiffSha256!==delivery.dirtyDiffSha256||current.sourceCommit!==delivery.sourceCommit)throw Error('Current delivery scope changed');
if(state.revision!==10||record.state!=='REVIEW')throw Error('Concurrent state change');
const history=[];
for(const h of record.history){verifyArtifact(root,h.receipt);if(h.action==='reject'){const receipt=JSON.parse(fs.readFileSync(h.receipt.path));for(const a of receipt.evidence)verifyArtifact(root,a);history.push({receipt:h.receipt.path,evidenceMatches:receipt.evidence.length});}}
fs.writeFileSync(path.join(dir,'historical-review-integrity.json'),JSON.stringify({checkedAt:new Date().toISOString(),historyReceiptsVerified:record.history.length,reviewEvidence:history},null,2));
const findings=[
{id:'F10',priority:'P2',path:'apps/official-site/server/api/public-projection.get.ts',line:228,problem:'recovery完全跳过缓存作废，保留旧content+commerce。正常响应缓存旧SKU后，recovery+commerce权威空/变更/失败当前已清空或替换价格，但紧接网络故障又从memory-cache复活旧SKU。主审三个顺序组合均复现。',fix:'继续保留F07的合法恢复内容，但按facet更新/作废旧commerce事实，或采用已有模型内保守缓存失效；权威空、方案变化或失败后的网络故障不得复活被清空/替换的旧套餐。不得把recovery当新成功刷新60秒TTL。补ready→recovery+commerce(empty/changed/failed)→outage，以及过期和并发撤回的连续测试。',retestCaseIds:['R1-001-TC02']},
{id:'F11',priority:'P2',path:task.evidenceDirectory+'work/tc3-sweep.cjs',line:22,problem:'扫描脚本const status=200不是实际响应状态，入口/溢出/错误等仅采集，没有assert，异常值仍可exit0；因此其22页200/逐项适用断言已覆盖的表述超出证据。summary最终32与实际35不同，HEAD回退旧BFF18与基线12不同，也缺原始回退日志。',fix:'新建版本化采集脚本，读取真实响应status、等待明确hydration/可见条件，对所声称通过的状态/所有CTA/布局/Console逐项断言，并用受控失败验证脚本会非零退出。新报告summary-4/commands-4纠正35项和HEAD12项，引用主审新证据或补真实原始日志及命令/起止时间，不覆盖已固定旧文件。浏览器套件逐项映射已跑/未跑，不以DONE当PASS。',retestCaseIds:['R1-001-TC01','R1-001-TC03']}
];
const report=`# R1-001 delivery-3 独立审批（2026-10-03）

## 决定

**REWORK；不批准ACCEPTED，不进入R1-002。** F07的单次恢复数据/时间/stale/原因修复通过；F08承认历史summary缺失并改用版本文件，本次没有再次覆盖，不重报旧问题。新缓存连续状态缺陷F10与证据采集/记录问题F11需要整改。当前4项P1交付运行缺口仍不能由构建或模拟关闭。

## 本轮独立检查

- delivery-3的24 artifacts、8 evidence、receipt/spec/限定Git差量全部匹配，revision10 REVIEW。HEAD仍${current.sourceCommit}，dirty=${current.dirtyDiffSha256}。
- 前两轮主审reject收据的全部证据仍匹配，状态history的收据摘要均匹配。delivery-1原summary仍缺，但这次已披露；delivery-2全部证据原字节保留，不能把旧源码artifacts变更误称新证据覆盖。
- 四套件实际35/35（BFF18+其余17），失败0；主审直接构建退出0。定向composable语义检查0诊断，不声称全Nuxt类型检查。
- 独立VM重放原F07：recovery保留1课程、generatedAt、stale=true和恢复原因；正常新鲜commerce仍有独立状态。全局维护/权限/错误优先与网络失败既有负例通过。
- meta.stale候选排除：当前operation使用ApiSuccessEnvelope+data:B9PublicSiteProjection，ApiResponseMeta无stale；另一个响应schema族不能覆盖当前操作。
- 主审独立HTTP实读11页，全部200（不是脚本常量）；只证明路由/错误分支可达。匿名响应有Set-Cookie，不能把“无业务Cookie”写成“无任何Cookie”；本轮未读取用户浏览器凭据或storage值。

证据：[当前收据核对](hashes.json)、[35项原始输出](unit-rerun.log)、[构建真实退出码](build-result.json)、[恢复语义结果](verification.json)、[连续缓存复现与HTTP](cache-and-http.json)。

## 主审补做的注册入口验收

仅启动自己的现有前端进程：18182官网、18180 Web、18183 uni-app H5；不启动/重启共享后台、不写数据库。

- 课程CTA实际点击，桌面与移动均进入现有真实注册页；页面完成加载显示账号和密码表单。未填写密码、提交注册或创建会话。
- 两端浏览器返回均回到官网课程页；两端双击CTA均落到正确注册页。双击手势不是注册API并发提交测试，不能外推幂等或成人Gate已验。
- 4个恶意returnTo×双视口共8次实际CTA导航，均落固定注册目标与安全home返回参数；无外站导航。一次Web DOM首次读取处于会话bootstrap，使用可见注册标题等待后单独补验，不冒充第一次已加载。
- 记录中入口检查Console error/warn为空；真实会话/Token隔离全量检查与完整website-runtime套件未执行，TC03仍局部结论。

见[入口/返回](register-navigation.json)、[8个恶意输入实际导航](negative-entry-browser.json)、[一次加载补验](negative-entry-recheck.json)、[桌面双击](desktop-rapid.json)。注册目标页缺监听是可通过自有前端启动解决的输入，不必等待IAM或全部后台；实际注册写入属于后续卡，本轮没有提前开发它。

![移动注册页实际落地](register-mobile.png)

## 确定发现

${findings.map(f=>`### ${f.id} · ${f.priority}\n\n- 位置：\`${f.path}:${f.line}\`\n- 问题：${f.problem}\n- 整改：${f.fix}\n- 复测：${f.retestCaseIds.join('、')}\n`).join('\n')}

F10具体序列：ready旧套餐withdrawn → recovery且commerce空/新套餐/503 → outage。第二步已空/换新/标error，第三步又出现withdrawn（3/3）。新增三个用例各自从空harness进行单次请求，未覆盖连续事实变更。上轮F07并未授权忽视权威commerce更新，不能以“恢复期间保留缓存”为理由保留撤回价格。未发现新的确定权限绕过。

## 回退独立补验及记录限制

本轮在唯一临时目录与独立Git目录中，对当前24文件生成限定patch、应用、反向应用并显式恢复原Git字节。归一化文本应用匹配24/24；恢复开工前原始字节24/24；原始HEAD BFF实际12/12、退出0。普通Git patch会改变部分CRLF行尾，原始字节不能仅靠patch摘要声称一致。详见[回退结果](rollback-result.json)、[旧BFF输出](rollback-old-bff.log)。

保留三次校验脚本诊断快照：前两次发现临时目录继承父Git造成patch跳过，第三次发现行尾差异；最终脚本先建立独立Git、检查文本再恢复baseline字节，通过后才记录上述结论。原始失败快照没有当作PASS。共享工作区没有实际回退。此结果证明整个R1-001回到开工前HEAD的限定回退，不证明delivery-3→delivery-2源码恢复，更不证明生产回滚。

## 逐步与TC状态

| 项目 | 当前结论 |
|---|---|
| 步骤1 | 当前认领/收据/源码一致 |
| 步骤2 | F07单次恢复通过；F10连续缓存FAIL |
| 步骤3 | 已修页面源码及error态证据保留；缺成功/空/恢复真实渲染 |
| 步骤4 | 注册落地、返回、双击、恶意输入实际导航局部通过；完整会话隔离未验 |
| 步骤5 | F11证据口径及必测缺口未关闭 |
| TC01 | PARTIAL/BLOCKED：路由与注册落地补验；成功/空态仍缺真实上游 |
| TC02 | FAIL/PARTIAL/BLOCKED：F10复现；真实Gateway 503→恢复未验，模拟不计PASS |
| TC03 | PARTIAL：两端入口/返回/双击及8次负例补验；完整安全/浏览器断言仍待复核 |
| website-runtime | 全套未跑，无逐项适用断言完成映射；保持阻塞 |

## 下一步：三项明确工作

1. 继续R1-001，只修F10缓存回退，并补三条连续测试与缓存期限/并发负例。保留F01-F07已通过能力，不推翻整页或架构。
2. 新建版本证据采集器，真实读取状态并失败即非零；另存summary-4/commands-4纠正记录，保留旧收据/主审证据。可引用本轮注册及回退证据，不需无意义重复已核内容。
3. 协调现有公开验收实例：Gateway18070、content18089、commerce18096，经既有路由取得合法发布事实与空数据输入，并在隔离实例验证503→恢复。使用受控合成发布数据，不修改生产或清空共享库；不得拿core-api旁路或mock代替正式Gateway证据。若需要超出本卡范围的后台接线/seed修改，列出确切缺项交主审/owner安排，不能自行扩大实现范围。18180/18183前端可以按固定端口独立启动做入口测试，不需先完成R1-002。

新增交付用delivery-4，不覆盖delivery-1/2/3及reviewer-1/2/3；缺真实输入时如实列P1 blocking。只有本卡正式验收通过后才放行R1-002。三台自有前端检查进程已停止、视口恢复、自建标签关闭；最终18070/18089/18096/18180/18182/18183未监听。未修改业务实现、父台账、共享服务、数据库或端口。
`;
fs.writeFileSync(path.join(dir,'review.md'),report,{flag:'wx'});
fs.writeFileSync(path.join(dir,'findings.json'),JSON.stringify({findings,currentSourceSnapshot:current,delivery3Verified:true},null,2),{flag:'wx'});
const rel=task.evidenceDirectory+'reviewer-3/';
const evidence=fs.readdirSync(dir).filter(n=>n!=='reject-3.json').map(n=>artifact(root,rel+n));
const receipt={taskId:task.id,action:'reject',expectedRevision:state.revision,specSha256:taskDigest(task),actor:'root-reviewer',role:'reviewer',reviewerThreadId:REVIEWER_THREAD,note:'delivery-3恢复数据修复通过，35项及构建0；补验两端注册/返回/双击。连续故障复活旧价格与证据采集口径需整改，真实上游仍缺，不放行002。',evidence,findings};
fs.writeFileSync(path.join(dir,'reject-3.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({decision:'REWORK',findings:findings.length,expectedRevision:state.revision,receipt:rel+'reject-3.json'}));
