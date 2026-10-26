import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { artifact, inputArtifacts, gitSnapshot, taskDigest, REVIEWER_THREAD, verifyArtifact } from '../../../scripts/lib/redesign-task-state.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const base = 'docs/06-design/v2-980plus/redesign/';
const dir = 'evidence/p1r/m3/P1R-M3-008/redesign/R1-001/inputs/';
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const write = (p, value) => fs.writeFileSync(path.join(root, p), value);
const save = (p, value) => write(p, JSON.stringify(value, null, 2) + '\n');
const index = json(base + 'dev-plan-R1.tasks.json');
const state = json(base + 'dev-plan-R1.status.json');
const task = index.tasks.find(t => t.id === 'R1-001');
assert.equal(state.tasks.find(t => t.id === task.id).state, 'PLANNED');
assert.equal(task.filePlan, undefined);
assert.equal(task.spec.filePlan.edit.length, 23);
assert.equal(task.spec.testCases.length, 3);
assert.deepEqual(task.dependsOn, []);
const verificationPath = dir + 'resume-20261003/verification.json';
const verification = json(verificationPath);
for (const run of verification.runs) {
  assert.equal(run.exitCode, 0);
  verifyArtifact(root, { path: run.logPath, sha256: run.logSha256 });
}
assert.equal(verification.toolchainStatic.checks, 52);
assert.equal(verification.existingOfficialUnitBaseline.pass, 26);
const canonical = json('packages/contracts/openapi/v1/openapi.json');
const generated = read('packages/contracts/generated/openapi.ts');
const contracts = [];
for (const [fragment, url] of [
  ['packages/contracts/fragments/b9/b9-content.openapi.json', '/api/v1/public/site/projection'],
  ['packages/contracts/fragments/b9/b9-content.openapi.json', '/api/v1/public/content/catalog'],
  ['packages/contracts/fragments/b13/b13-commerce-admin-analytics.openapi.json', '/api/v1/public/commerce/catalog']
]) {
  const op = json(fragment).paths[url].get;
  assert.deepEqual(canonical.paths[url].get, op);
  assert.deepEqual(op.security, []);
  assert(generated.includes(op.operationId + ': { method: "GET"; path: "' + url + '"'));
  contracts.push({ fragment, method: 'GET', path: url, operationId: op.operationId, security: op.security,
    sourceMatchesCanonical: true, generatedTypePresent: true, runtimeVerified: false });
}
const foundationPath = 'apps/official-site/utils/v2-foundation.ts';
const securityPath = 'services/content-service/src/main/java/com/englishflow/content/security/ContentSecurityConfiguration.java';
const controllerPath = 'services/content-service/src/main/java/com/englishflow/content/web/ContentHttpController.java';
const routesPath = 'services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.java';
const bffPath = 'apps/official-site/server/api/public-projection.get.ts';
for (const url of ['/api/v1/public/site/projection', '/api/v1/public/content/catalog']) {
  assert(read(controllerPath).includes('@GetMapping("' + url + '")'));
  assert(read(routesPath).includes('"' + url + '"'));
}
assert(read(securityPath).includes('auth.requestMatchers("/api/v1/public/site/projection").permitAll()'));
assert(read(securityPath).includes('auth.requestMatchers("/api/v1/public/content/**").permitAll()'));
assert(read(bffPath).includes('headers: { Accept: "application/json" }'));
assert(read(bffPath).includes('response.status === 401 || response.status === 403'));
for (const item of ['@englishflow/i18n', '@englishflow/design-tokens', 'contentLocale: "en-US"', 'A fresh instance per Nuxt request']) assert(read(foundationPath).includes(item));
const snapshot = gitSnapshot(root, task);
const dirty = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8', windowsHide: true });
write(dir + 'workspace-protection.txt', dirty);
save(dir + 'current-input-review.json', {
  reviewedAt: new Date().toISOString(), reviewerThreadId: REVIEWER_THREAD,
  branch: execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(),
  sourceCommit: snapshot.sourceCommit, dirtyDiffSha256: snapshot.dirtyDiffSha256,
  contracts, sourceArtifacts: inputArtifacts(root, task),
  supplementalSources: [foundationPath, securityPath, controllerPath, routesPath, bffPath].map(p => artifact(root, p)),
  scope: 'read-only public frontend/BFF implementation preparation; source review plus current static/unit/VM preflight',
  noBusinessImplementationByReviewer: true, noDatabaseWrites: true, noServiceRestart: true,
  productCasesExecuted: [], currentRuntimeUpstreamVerified: false,
  pendingDelivery: task.spec.testCases.map(t => t.id)
});
const owner = 'Muse Spark（用户指定的执行 Agent；仅 R1-001 官网切片）';
save(dir + 'claim-20261003.json', {
  confirmedAt: new Date().toISOString(), reviewerThreadId: REVIEWER_THREAD,
  taskId: 'P1R-M3-008', childTaskId: task.id, owner,
  authority: '用户已交付第一组提示词并要求本聊天主导及审批；执行 Agent 日志主动申请本卡开工。本聊天现确认此限定认领。Git作者配置不是认领依据。',
  childScopeOnly: true, parentCanonicalStateChanged: false,
  canonicalLedger: artifact(root, index.canonicalStateSource),
  childDependencies: [], siblings: 'R1-002…005不获本收据放行，R1-006及第二组不开放'
});
const scopes = {
  'G-ENV': '官网无业务写入准备：当前Node/pnpm、固定端口登记及18182/18180/18183空闲预检、fixture结构验证、共享dirty保护。IAM/Java/DB/Outbox运行不在本准备范围；真实上游实例身份与合成输入在联调前另核。',
  'G-CONTRACT': '仅消费三个既有公开GET；源片段与canonical逐操作相等，生成TS映射存在，security为空；公开价格契约父M1-015已补引用。未声称重新生成Java DTO、完整契约或运行负例通过。正式schema差量需先审查。',
  'G-PLATFORM': '无写入、无官网业务Token、BFF只调用公开Gateway读口。核对内容owner公开Controller/Security及Gateway路由源码，现有BFF权限/失败/缓存负例通过；不将静态源码等同当前真实已验收投影，真实数据/版权与上游恢复在交付时必须核验。',
  'G-FRONTEND': '复用现有Vue/TS、每请求独立共享i18n/token基础、UI locale与contentLocale分离、主题与受控链接helper；现有26项单元/静态/VM基线通过，包含待迁移旧断言。双视口、触达/焦点/主题/Console及TC01…03均为本卡待交付验收。'
};
const details = {
  'G-ENV': '当前工具链静态52/52，端口18182、18180、18183均FREE；fixture仅13条/6类结构预检。端口hash旧值可由移除workflow-service精确复现，修正摘要不改端口。共享资源不删除、不重启。无业务写入，因此本卡实施准备无需IAM专用schema；后续002…005运行证据仍需专用schema/权限/清理确认。',
  'G-CONTRACT': '已核对getB9OfficialSiteProjection、listB9PublicContentCatalog、getB13PublicCommerceCatalog三项GET，security=[]，正式source/canonical操作相等，生成TS映射存在。B9只公开published projection、PUBLIC_V1及服务端owner；B13标记NOT_RUNTIME_VERIFIED，保留该限制。官网不会调用认证IAM/learner/admin接口。若facet状态引出正式schema差量，先提交主审，不能手改generated。',
  'G-PLATFORM': 'ContentHttpController.java:57/88存在公开读口，ContentSecurityConfiguration.java:124–125公开permitAll，GatewayRouteExecutionPolicy.java:69–74引用对应owner控制器。BFF只发Accept头，经Gateway读投影及公开价格，401/403区别于空列表；不转发访客密码/业务凭据。价格失败只写degraded header而返回空价是待修实现缺陷。本Gate只签收公开只读边界，未运行owner数据/发布资格/事件/撤销事实。真实上游、独立facet恢复在交付TC中补验。',
  'G-FRONTEND': 'v2-foundation.ts引用共享i18n/design-tokens及adapter，SSR每请求新实例，locale/contentLocale分离；foundation.ts仅公开locale/theme偏好。public-links.mjs已提供固定Web/mobile注册路径、安全returnTo和协议检查。本卡复用其能力改CTA；pricing/download、课程空文案及旧测试需按当前源规格实现。现有26项并非最终产品TC。'
};
for (const id of task.gateInputs) write(dir + id + '-20261003.md', `# ${id}：R1-001 限定准备签收\n\n- 日期：2026-10-03（北京时间）；主审：${REVIEWER_THREAD}\n- HEAD：${snapshot.sourceCommit}；本卡diff摘要：${snapshot.dirtyDiffSha256}\n- 结果：PASS，仅下列准备scope；完整Gate未关闭。\n- scope：${scopes[id]}\n\n${details[id]}\n\n当前源文件/配置/契约摘要见[current-input-review.json](current-input-review.json)，实测命令/时间/退出码见[恢复后预检](resume-20261003/verification.json)。工作区保护见[清单](workspace-protection.txt)。认领见[本卡限定确认](claim-20261003.json)。\n\n恢复/回退：本轮只更新端口元数据与执行资料，无业务写入或服务操作；实现回退仅撤销本卡允许文件的自身差量，不覆盖共享改动。TC01…03、实际公开上游、双视口及失败恢复待实施后独立审批，不写产品PASS。\n`);
write(dir + 'approval-20261003.md', `# 第一组只读准备日志审批（2026-10-03）\n\n## 审批结论\n\n批准该日志作为只读盘点成果，限定放行 **R1-001 READY（可进入实施）**。用户指定的Muse Spark继续本卡，由本聊天测试审批。日志没有五卡开发交付，本组 **ACCEPTED 0/5**，不进入R1-006/第二组。认领依据是用户安排、本执行日志及本聊天限定确认，非Git作者配置；父台账状态不变。\n\n| 卡 | 本次结论 | 下一步 |\n|---|---|---|\n| R1-001 | READY，仅公开前端/BFF准备范围 | 执行当前23文件范围，提交一张卡的REVIEW |\n| R1-002 | PLANNED | 等001 ACCEPTED，再签收IAM隔离输入 |\n| R1-003/004 | PLANNED | 等002 ACCEPTED |\n| R1-005 | PLANNED | 等004 ACCEPTED |\n\n## 核实并处理的问题\n\n1. 端口指纹：config/toolchain-baseline.json:8漏同步workflow-service:18071登记，历史提交fbcbe2b7的父版本精确复现旧摘要。仅更新摘要为28d84de5a93c65dd3e13b5d5dd99d455f8516975a2257bcb0462024f458c21da，端口保持不变。证据见[历史原因与当前断言](resume-20261003/port-hash-proof.json)。\n2. pricing.vue:3及download.vue:3当前301→/start，不满足11页分别可读，需恢复独立200与诚实空/错误态；不开放收费、订单、下载发布。上位页面登记册03-全端页面功能登记册.md:50–51已有对应页。\n3. SiteStartButton.vue:9及courses/index.vue:103/122仍到/start；start.vue:40–55为示例提示，不是注册分流。使用public-links.mjs:11–47既有buildPublicLearningEntry，经现有composable适配Web/mobile、uiLocale/theme及安全returnTo。start.vue不在本次编辑范围。\n4. 课程空态当前沿用泛公示文案；在共享i18n补“内容准备中”，复用PublicStatus.vue:5–6/33–34已有title/message参数，不改其它公示空态。\n5. 价格失败：public-projection.get.ts:176–194仅写degraded header，仍返回空价且errorCode=null/stale=false；public-projection.ts:102–109是整体状态，不能据12项旧测试认定独立facet已完整。需按步骤2实现前端可解释的各facet状态/更新时间和恢复，成功内容不被独立价格失败抹掉。正式schema差量先审查，不伪造服务端事实。\n6. 旧测试需迁移：b13-official-site.test.mjs:151–156、website-runtime.cjs:324–327、website-entry.test.mjs:68–69及b14-fe-005.test.mjs现有start/301约束，不可用旧PASS替代新验收，不删除安全负例。\n\n本聊天已同步CHG-R1-004、源规格/生成卡、23个编辑文件与公开价格契约父P1R-M1-015。业务实现由执行Agent完成。本轮仅修复配置元数据和开工资料。\n\n## Gate与证据层级\n\n四项准备scope分别见[G-ENV](G-ENV-20261003.md)、[G-CONTRACT](G-CONTRACT-20261003.md)、[G-PLATFORM](G-PLATFORM-20261003.md)、[G-FRONTEND](G-FRONTEND-20261003.md)，依据input-gates.md:9/13的只读输入/输出边界签收。未豁免任何三个必测TC，也不关闭IAM/Java/DB/Outbox完整Gate。\n\n恢复后重跑：工具链静态52/52、现有官网单元/静态/VM26/26、fixture结构13条/6类、三个前端固定端口FREE。[实测日志索引](resume-20261003/verification.json)含命令、时间、退出码与log摘要。[当前输入快照](current-input-review.json)含实际sourceCommit、diff、源契约/生成映射及源码核查摘要。没有真实Gateway上游或双视口浏览器结果，产品TC执行数为0。\n\n## 执行交接\n\n执行Agent读取最新tasks/R1-001.md、状态墙及本报告，核对收据/摘要后记录start；按5步骤实施，只改23个允许文件及本卡证据目录。保留既有安全、权限、来源及范围约束。交付需全部步骤产物、当前完整修改摘要和自测记录；TC01双视口11页+注册、TC02真实上游503恢复、TC03恶意returnTo/重复点击/官网无业务会话须有独立可复测证据。无法提供真实接口证据可先交改造与已有测试，但如实BLOCKED/PARTIAL，不能自标ACCEPTED或转002。启动运行前核实例身份/端口及合成来源，不能重启共享服务、改端口、清库或读取输出凭据。\n\nR1-002…005在依赖满足后再确认IAM专用schema/最小权限/迁移与合成输入/清理边界；本次没有代签这些写入权限。\n`);
const evidencePaths = [
  'current-input-review.json', 'claim-20261003.json', 'workspace-protection.txt', 'approval-20261003.md',
  ...task.gateInputs.map(id => id + '-20261003.md'),
  'resume-20261003/verification.json', 'resume-20261003/port-hash-proof.json',
  ...verification.runs.map(r => r.logPath.slice(dir.length))
].map(p => dir + p);
const receipt = {
  taskId: task.id, action: 'ready', expectedRevision: state.revision, specSha256: taskDigest(task),
  actor: 'root-reviewer', role: 'reviewer', reviewerThreadId: REVIEWER_THREAD,
  note: '第一组只读日志准备审批；仅R1-001公开前端/BFF限定开工，三个产品TC未测，无ACCEPTED。',
  sourceArtifacts: inputArtifacts(root, task),
  parentClaim: { taskId: task.executionParent, confirmed: true, owner, canonicalLedgerSha256: artifact(root, index.canonicalStateSource).sha256 },
  gates: task.gateInputs.map(id => ({ id, result: 'PASS', scope: scopes[id], evidencePaths: [dir + id + '-20261003.md', verificationPath, dir + 'current-input-review.json'] })),
  blockerDecisions: task.spec.blockers.map(b => ({ id: b.id, disposition: 'APPROVED',
    reason: '按input-gates与CHG-R1-004签收本卡公开只读准备必需输入；不排除完整服务运行义务、真实上游及三个产品TC，需在交付后审批。', evidencePaths: [dir + 'approval-20261003.md', dir + 'current-input-review.json'] })),
  evidence: evidencePaths.map(p => artifact(root, p))
};
const receiptPath = dir + 'ready-20261003.json';
assert(!fs.existsSync(path.join(root, receiptPath)), 'Immutable ready receipt already exists');
save(receiptPath, receipt);
console.log(JSON.stringify({ receiptPath, expectedRevision: state.revision, inputArtifacts: receipt.sourceArtifacts.length,
  evidenceFiles: receipt.evidence.length, pendingProductCases: task.spec.testCases.map(t => t.id) }));
