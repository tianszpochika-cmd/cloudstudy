import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const lib = await import(pathToFileURL(path.join(root, 'scripts/lib/redesign-task-state.mjs')));
const base = 'evidence/p1r/m3/P1R-M3-008/redesign/R1-001/';
const dest = base + 'reviewer-11/';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const write = (p, v) => fs.writeFileSync(p, typeof v === 'string' ? v : JSON.stringify(v, null, 2) + '\n', { flag: 'wx' });
const index = read('docs/06-design/v2-980plus/redesign/dev-plan-R1.tasks.json');
const state = read('docs/06-design/v2-980plus/redesign/dev-plan-R1.status.json');
const task = index.tasks.find(t => t.id === 'R1-001'), record = state.tasks.find(t => t.id === task.id);
assert.equal(state.revision, 26); assert.equal(record.state, 'REVIEW');
for (const item of [record.submission.receipt, ...record.submission.artifacts, ...record.submission.evidence]) lib.verifyArtifact(root, item);
const snapshot = lib.gitSnapshot(root, task);
assert.equal(snapshot.sourceCommit, record.submission.sourceCommit);
assert.equal(snapshot.dirtyDiffSha256, record.submission.dirtyDiffSha256);
const first = read(dest + 'runtime-result.json');
const second = read(base + 'reviewer-11b/runtime-result.json');
const third = read(base + 'reviewer-11c/runtime-result.json');
assert.equal(second.result, 'PASS'); assert.equal(third.result, 'PASS');
for (const attempt of [first, second, third]) assert.ok(attempt.finalPorts.every(p => p.free));
for (const file of [dest+'empty-chain/result.json', dest+'security/result.json', base+'reviewer-11b/retry/result.json', base+'reviewer-11b/normal-chain/result.json', base+'reviewer-11b/website/browser-checks.json', base+'reviewer-11c/all-entry/result.json']) assert.equal(read(file).result, 'PASS', file);
assert.equal(read(base+'reviewer-11c/all-entry/result.json').checks.length,22);
assert.equal(read(dest+'security/result.json').storage.length,6);
assert.equal(read(base+'reviewer-11b/retry/result.json').steps.length,2);
assert.deepEqual(read(dest+'sweep/r1-001-sweep-11.json').failedChecks,[]);
const now = new Date().toISOString();
const report = `# R1-001 delivery-8 独立审批（2026-10-05）

## 结论

**ACCEPTED。** 本次签收仅适用于 R1-001 当前 24 产品文件与 4 准备文件快照、五个步骤和三个 TC。审批前为 REVIEW revision26；正式登记收据后应为 ACCEPTED revision27。R1-002…005仍为 PLANNED，需分别签收输入与依赖；不自动晋升 P1R 父任务、完整 Phase1 或上线 Gate。

## 快照与独立检查

- delivery-8 收据、28 artifacts、53 evidence 全部重算匹配。HEAD ${snapshot.sourceCommit}；限定 dirty ${snapshot.dirtyDiffSha256}。与 delivery-7 相比只有 website-runtime.cjs 的移动定位调整，23 个其他产品文件与 4 个准备输入不变。见 current-snapshot.json。
- 主审独立执行四套件 38/38；同一采集器负例13/13（MOCKED，仅证明采集器）。无新产品代码修改；本轮未重新构建，不能将历史构建日志称为本轮构建。
- Browser plugin 不可用，使用仓库已有 Playwright。空 content 使用专用空 schema r1_001_empty_20261005_t9b 和 SELECT-only reader；正常 content 仅读取既有公开事实。正常实例不是隔离数据库凭据，不能声称共享库身份为只读。启动包装器关闭六项后台/迁移开关；只调用公开 GET，未提交注册或操作共享事实。

## 三项产品验收

| TC | 结论 | 当前独立证据 |
|---|---|---|
| TC01 | PASS | reviewer-11/empty-chain 14项：合法空输入、实际页面 BFF 与 DOM、0课程及“内容准备中”、价格权威空；sweep 46项覆盖375×812/1440×900各11页，可操作菜单入口与真实HTTP。reviewer-11b/normal-chain 14项核对7课程。reviewer-11c/all-entry 实际逐页点击22次、显示对应注册表单并返回官网；未提交注册。 |
| TC02 | PASS | reviewer-11b/retry：移动无缓存真实503/error及桌面 memory-cache/recovery，同一页面/上下文恢复自有 content 后实际点击“重新加载”，实际BFF响应ready、7课程标题逐项对应、更新日期可见、旧横幅和全部重试按钮消失、Console零错误。不以reload/goto替代点击。 |
| TC03 | PASS | reviewer-11/security：8次恶意returnTo输入、两端实际落地/返回及快速双击；精确origin/path/hash/returnTo/locale/theme；外跳前及两次返回后共6次官网origin存储读取成功，local/sessionStorage均0键，Cookie仅yx.public.locale/theme。只记录键名，不输出值；不继承未经固定的device源码历史哈希。 |

官网完整套件主审重跑 **11 checks / 152 layouts / 0 errors / exit0**，包括独立pricing/download、移动菜单、主题与布局。演示练习检查不等于学习业务验收。完整原始输出在 reviewer-11b/website.log 与 website/browser-checks.json。

## F15–F18 与证据口径

- F15关闭：入口可操作门已恢复；移动常驻CTA隐藏时确实打开菜单，再验证可见/可操作项。独立区域截图已目检，手机/桌面空态及手机菜单可读，无横向溢出。采集器注释的“实际点击”原来仅核href，主审22次真实点击另行补齐。
- F16关闭：执行人真实同页点击成立，主审额外验证恢复横幅与重试入口移除，并目检两视口失败/恢复区域截图。
- F17关闭：完整官网原始套件本轮真正跑到底，定位调整保留原有断言。
- F18由主审独立补证关闭：work/tc03-11.cjs:57吞掉双击失败；65–70在可能外跳后的页面读storage并吞掉读取异常，不能据该报告认定官网“0键”。此项原输出保留且不作为审批依据；主审browser-security.cjs先硬断言官网origin，读取失败直接失败，完成真实落地/返回和当前源码安全复验。无需因此再次改动产品或提交delivery-9。

## 保留失败与边界

第一次主审运行 runtime-result.json 为FAIL：独立重试探针在桌面recovery找到两个同名按钮发生strict locator异常，手机步骤已通过；不是被掩盖的产品失败。原脚本/失败日志/截图完整保留。新增browser-retry-v2精确选首个实际按钮，恢复后检查所有可见重试按钮为0；独立续验全部PASS。审批runs只列真实退出0且晚于本次提交的运行，失败尝试仍在固定证据中。

所有当轮自有进程已停止，三次运行末尾六固定端口均FREE。没有停止他组服务、改端口、共享DB写入/清库、既有账号权限变更。测试空schema/reader保留，未擅自清理。仅补父manifest的R1-001局部证据引用，保留原父判定和历史字段。

## 下一步

下一组为 R1-002注册 / R1-003注册幂等 / R1-004登录刷新撤销 / R1-005设备踢出。先交R1-002限定准备包：主owner认领、独立IAM验收schema/最小权限、固定端口与当前Java/Node、契约/生成类型、安全密钥注入与合成fixture、四项Gate逐项scope。主审签READY后才实施002并提交REVIEW；002 ACCEPTED之后才解锁003/004，004 ACCEPTED之后才解锁005。不能把001公开只读环境直接当作IAM写链环境。
`;
write(dest+'review.md',report);
write(dest+'next-group.md',`# 下一组执行提示词：R1-002至R1-005

接续当前Cloudstudy dev-redesign工作。先核对状态墙、主审R1-001/reviewer-11/review.md与approve-8.json；R1-001须为有效ACCEPTED，若漂移先报告，不继承旧父任务完成状态。

本组边界是002注册、003同键回放、004登录/刷新/撤销、005设备列表/踢出。当前只交R1-002开工准备包，不自标READY、不提前开发或启动共享后台、不越至006。按各卡现行来源与filePlan小步复用旧版实现，先报告可复用/缺失，不推翻重做。

1. 精读R1-002执行卡、对应来源和现有IAM实现；核对P1R-M2-002认领及契约父输入，归档HEAD/限定dirty/他人改动边界。
2. 逐项说明G-ENV/G-CONTRACT/G-PLATFORM/G-FRONTEND当前输入证据与适用scope。盘点专用IAM验收schema、owner/最小权限、迁移和可重复合成fixture，数据库写入必须隔离；不复用001空content库或共享IAM事实，不输出任何凭据/Token/私钥。
3. 核对固定端口、Node/pnpm/Java版本、真实register/principal/permissions契约及生成类型、Idempotency-Key、受限JWT/Refresh Cookie、安全密钥注入。201只代表创建账号/受限会话，不授予学习权限；不得引入OIDC、第三方身份、完整生日采集。
4. 给出002三项TC的可执行输入/动作/预期/owner读回/安全拒绝及证据目录；既有实现与卡片若冲突，定位最小差量并交主审裁定，不能改契约绕过。
5. 在R1-002卡指定证据目录新增准备报告与source-and-inputs.json。无法满足的输入逐项列唯一解阻条件；不冒称PASS、不用后置产品TC已通过作为READY前提。

交主审签READY后，才按002步骤实施并交REVIEW；不自行ACCEPTED。002获批才开启003/004各自准备，004获批才开启005。旧证据不可覆盖，保护共享dirty；端口冲突只报告，停止范围仅限当轮已核身份的自有进程。
`);
const parentPath = 'evidence/p1r/m3/P1R-M3-008/manifest.json';
const parentBytes = fs.readFileSync(parentPath), parentOld = lib.artifact(root,parentPath);
write(dest+'parent-manifest-before.json',parentBytes.toString('utf8'));
const review = {taskId:task.id,decision:'ACCEPTED',scope:'R1 child delivery only',reviewedAt:now,sourceCommit:snapshot.sourceCommit,dirtyDiffSha256:snapshot.dirtyDiffSha256,submission:record.submission.receipt,report:dest+'review.md',approvalReceipt:dest+'approve-8.json',canonicalParentPromotion:false,results:task.spec.testCases.map(t=>({id:t.id,result:'PASS'}))};
write(base+'review.json',review);
const parent = JSON.parse(parentBytes.toString('utf8'));
parent.redesignChildReviews ??= [];
assert.ok(!parent.redesignChildReviews.some(r=>r.taskId===task.id&&r.submissionSha256===record.submission.receipt.sha256));
parent.redesignChildReviews.push({taskId:task.id,decision:'ACCEPTED',scope:'R1-001 public read-only slice only; canonical parent status and full gates unchanged',review:lib.artifact(root,base+'review.json'),submissionSha256:record.submission.receipt.sha256,reviewedAt:now});
fs.writeFileSync(parentPath,JSON.stringify(parent,null,2)+'\n');
write(dest+'parent-reference.json',{before:parentOld,after:lib.artifact(root,parentPath),canonicalTaskStatusBefore:JSON.parse(parentBytes).canonicalTaskStatus,canonicalTaskStatusAfter:parent.canonicalTaskStatus,canonicalParentPromotion:false});
const tcPaths = [
 [dest+'empty-chain/result.json',dest+'sweep/r1-001-sweep-11.json',base+'reviewer-11b/normal-chain/result.json',base+'reviewer-11c/all-entry/result.json',base+'reviewer-11b/website/browser-checks.json'],
 [base+'reviewer-11b/retry/result.json'],
 [dest+'security/result.json',base+'reviewer-11c/all-entry/result.json']
];
const evidencePaths = [];
function collect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=dir+entry.name;if(entry.isDirectory())collect(file+'/');else evidencePaths.push(file);}}
for(const dir of [dest,base+'reviewer-11b/',base+'reviewer-11c/'])collect(dir);
evidencePaths.push(base+'review.json');
const runs=[...first.runs.filter(r=>r.exitCode===0),...second.runs,...third.runs];
assert.equal(runs.length,9);
const actuals=['合法空与正常事实、22页可操作入口和实际注册落地/返回、完整官网11/152通过。','真实503及缓存recovery，同页点击恢复，7课程/更新时间/旧提示消失通过。','8恶意输入、真实双击/返回、官网origin六次storage读取及Cookie白名单通过。'];
const receipt={taskId:task.id,action:'approve',expectedRevision:26,specSha256:lib.taskDigest(task),actor:'root-reviewer',role:'reviewer',reviewerThreadId:lib.REVIEWER_THREAD,decision:'ACCEPTED',note:'Independent current-snapshot real browser/upstream acceptance; root supplements storage and actual navigation evidence without another product rework cycle.',evidence:[...new Set(evidencePaths)].sort().map(p=>lib.artifact(root,p)),results:task.spec.testCases.map((t,i)=>({id:t.id,result:'PASS',actual:actuals[i],evidencePaths:tcPaths[i]})),stepChecks:task.spec.steps.map(s=>({order:s.order,result:'PASS',actual:['当前认领/READY、限定快照与专用空输入/固定端口核验。','38/38覆盖全局/facet/缓存/失败与权限边界，真实空/正常/恢复响应对应。','双视口11页、权威空价格/课程、区域截图及完整官网回归。','逐页真实注册点击返回、恶意输入/双击和官网storage/Cookie检查。','主审三个TC独立PASS，局部父manifest证据引用保留原父状态。'][s.order-1],evidencePaths:s.order===1?[dest+'current-snapshot.json']:s.order===2?[dest+'units.log',base+'reviewer-11b/retry/result.json']:s.order===3?tcPaths[0]:s.order===4?tcPaths[2]:[base+'review.json',dest+'parent-reference.json',dest+'review.md']})),runs,findings:[],resolvedEvidenceCaveats:['executor tc03 storage/rapid-click output superseded by independent origin-verified real browser results','first reviewer retry failed due ambiguous locator; preserved; second version successful']};
write(dest+'approve-8.json',receipt);
console.log(JSON.stringify({receipt:dest+'approve-8.json',evidence:receipt.evidence.length,runs:runs.length,decision:receipt.decision}));
