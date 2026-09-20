# Phase 1 项目完整度梳理日志（2026-09-20）

## 1. 审计范围与冻结基线

- 用户请求：拉取最新提交，分析项目完整度，并记录本次梳理、更新相关文档。
- 审计源码：`dev@2c2cfa2eea2663c406f004ef549b9232a7d0f360`。本轮从 `d6a44927` 执行 `git pull --ff-only`，快进取得 2 个提交；审计开始及结束时工作区干净，`HEAD...origin/dev` 为 `0/0`。
- 时间与环境：2026-09-20，Asia/Shanghai，Windows/PowerShell；Node 20.19.5，默认 Java 21，Maven 3.9.12。未使用默认 Java 冒充 Java 25 验证。
- 方法：台账统计、验收标准与 manifest 阅读、关键代码抽查、计划/契约/文档检查、部分 P1R 回归及 Git HEAD 摘要核对。
- 本日志是上述源码的审计快照，不是新的任务验收、全量独立复审或 canonical runtime Evidence。后续文档改动不自动刷新这次审计的源码基线。
- 文档更新不改变任务状态、manifest 决策或摘要，也未修改业务代码、启动项目全栈或操作其他项目容器。

## 2. 完整度结论

Phase 1 主体功能与服务基础已经形成，台账为 **81 ACCEPTED / 27 DEV_DONE，共 108 项，任务验收比例 75%**。该比例按任务数量计算，未按工作量、业务价值或风险加权；不代表产品可用性、当前源码通过率或上线完成度。

剩余工作同时包含实际实现、跨服务链路、证据复验和发布保障。部分已 ACCEPTED 的任务明确保留局部范围之外的实现缺口。因此不沿用“所有研发已完成、只剩验收”或“本地可推进项已清空”作为本次结论。

当前提交的契约校验已有失败，全量 Evidence Gate 与 P1R 回归没有完成；未取得当前源码 D4 完整链路或 D5 发布证据，不能判定发布 GO。这不撤销历史任务验收，也不把项目重新归零。

Phase 2 AI/RTC、Phase 3 K12/未成年人能力不属于本次 Phase 1 欠账。

| 里程碑 | 范围 | ACCEPTED | DEV_DONE | 总数 | 任务验收率 |
|---|---|---:|---:|---:|---:|
| M0 | 工程、工具链、依赖基线 | 7 | 1 | 8 | 87.5% |
| M1 | API、事件、权限、数据契约 | 18 | 0 | 18 | 100% |
| M2 | Gateway/IAM、安全、事件、恢复、CI | 5 | 5 | 10 | 50% |
| M3 | 内容供应链与后台 | 9 | 1 | 10 | 90% |
| M4 | 注册、测评、计划、首日学习 | 7 | 3 | 10 | 70% |
| M5 | 学习、SRS、错题、报告 | 11 | 3 | 14 | 78.6% |
| M6 | 通知、同步、客服、隐私、恢复 | 11 | 0 | 11 | 100% |
| M7 | 游戏、社交、商业权益 | 8 | 3 | 11 | 72.7% |
| M8 | E2E、质量、部署、发布验收 | 5 | 11 | 16 | 31.3% |
| 合计 | Phase 1 | 81 | 27 | 108 | 75% |

统计入口：[任务台账](../02-编号任务台账.md)。完成标准：[D1–D5 与阶段验收](../03-阶段验收与Evidence标准.md)。

## 3. 本次检查记录

| 检查命令/方式 | 本次结果 | 解释与限制 |
|---|---|---|
| `git status --short --branch`、`git rev-list --left-right --count HEAD...origin/dev` | CLEAN / 0、0 | 文档更新前的源码审计状态 |
| `node scripts/audit/verify-phase1-rebaseline-plan.mjs` | PASS | 108 项；81 ACCEPTED / 27 DEV_DONE；13 actors、15 journeys、56 pages、8 rules、18 integrations、16 E2E 的追溯统计，不代表逐项运行通过 |
| `node scripts/audit/p1r-stale-claims-check.mjs` | PASS | 扫描 1395 files；仅说明现有措辞规则未报错，不保证文档语义一致 |
| `node scripts/audit/doc-audit.mjs` | PASS | 扫描 583 文档、1662 内部链接；0 死链、52 孤儿文档提示、0 缺 README 目录 |
| `node scripts/audit/p1r-gateway-contract-check.mjs` | FAIL | 18 条错误；接口基线、执行目标及账号删除身份/授权声明等不一致 |
| `node scripts/contracts/validate-contracts.mjs` | FAIL | 首个报错：`POST /api/v1/iam/account-deletions needs x-idempotency declaration` |
| `node scripts/dev/run-node-tests.mjs tests/p1r` | INCOMPLETE_WITH_FAILURES | 已输出至少 2 项失败（第 62、65 项），最终日志输出到第 180 项；长时间运行后仅停止本次审计启动的测试进程树。180 不是通过数，也不是总用例数 |
| `node scripts/audit/p1r-evidence-gate.mjs --json` | TIMEOUT / NOT_COMPLETED | 180 秒未完成后停止，无最终报告，不判 PASS，也不把超时本身当成语义失败 |
| manifest 摘要候选与 Git HEAD blob 比对 | CONFIRMED_DRIFT | 确认 18 个任务的 19 条摘要引用与 HEAD 不一致，涉及 3 个文件；方法和明细见本日志附件 |
| 本机监听端口、Docker 只读盘点 | 未见所查项目核心端口监听 | 检查 18070、18087、18180–18183、13306、16379、19092、19000；这不是所有服务的逐项健康检查 |
| Java 25 构建、真实 DB、浏览器/真机、staging | NOT_RUN | 本轮未启动全栈，未重跑历史运行证据；其他项目容器未操作 |

P1R 两项失败名称：`canonical external API fixture passes the P1R governance gate`、`canonical oneOf success/page envelope extensions remain valid`，见 [测试定义](../../../../tests/p1r/p1r-api-contract.test.mjs)。报错包括账号删除/撤回、恢复操作、批量导入、媒体写入接口缺少幂等声明，以及未完成 Saga、错题列表缺少标准分页声明。声明缺失不等于已证实运行实现没有幂等或分页，后续须逐项核对。

## 4. 发现、承接范围与关闭条件

以下编号仅用于本次审计跟踪，不新增或替代 P1R 任务。承接范围是建议映射，未自行更改任务依赖、状态或验收责任。

| 审计项 | 发现与证据层级 | 建议承接 | 关闭条件 |
|---|---|---|---|
| AUDIT-0920-01 | 当前总契约与网关契约检查失败；运行检查事实 | M1-001/004/017 及新增接口 owner，M2-001 | 逐接口对齐契约、生成物、路由与实现；相关回归及契约门禁通过，不能仅改预期计数消除告警 |
| AUDIT-0920-02 | 补偿适配器只写 ATTEMPTED 并正常返回；上层将正常返回记作成功，存储写 APPLIED。属于源码发现，未做运行复现 | M2-006、M8-011/012 | 补齐 owner 调用与真实回执；未执行不得进入成功态；真实依赖下验证失败、重试、幂等和恢复 |
| AUDIT-0920-03 | M5-005 已 ACCEPTED，但 knownGaps 仍注明口语网关 owner 冲突、直连 18090 活测；当前契约仍保留关闭原因 | M5-005、M2-001、相关领域 owner | 按既定架构确定 owner，修复网关与实现对应关系；Browser→Gateway→owner 的权限正负例与录音/自评链路通过 |
| AUDIT-0920-04 | M6-007/008 已 ACCEPTED，但 manifest 明确导出/删号缺跨 owner worker；局部生命周期证据不能证明全域完成 | M6-007/008、M2-006 | 实现片段收集、匿名化/合法保留、回执对账、部分失败重试与恢复，取得跨服务运行证据 |
| AUDIT-0920-05 | 18 个任务的 19 条证据摘要引用与 HEAD 不一致；Git blob 核对事实 | M1-003…018、M2-009、M4-001 | 审核源码差异、完成适用回归与复核后更新绑定；保留历史 provenance，不能只刷新摘要 |
| AUDIT-0920-06 | 事件传输、集群隔离、trace/告警、真实 CI、真机、staging/容灾/制品签名等仍未完整验收 | M2-005…009、M0-006、M8 未验收任务 | 区分缺实现与缺环境证据，逐 owner 核查；在实际可用环境取得运行证据后再验收 |
| AUDIT-0920-07 | 交接“本地队列清空”“M2 闭合”和官网四页缺失等表述与当前资产不完全一致；多份 manifest 仍混有历史状态文字 | 根交接、计划入口、原任务维护者 | 本轮修正当前入口；其余历史文字按语境复核，不批量改写历史审查记录或验收结论 |

直接代码/证据入口：

- 补偿：[WorkflowWiringConfiguration](../../../../services/workflow-service/src/main/java/com/englishflow/workflow/config/WorkflowWiringConfiguration.java)、[SagaCompensationExecutor](../../../../services/workflow-service/src/main/java/com/englishflow/workflow/application/SagaCompensationExecutor.java)、[JdbcSagaStore](../../../../services/workflow-service/src/main/java/com/englishflow/workflow/adapter/jdbc/JdbcSagaStore.java)。
- 口语：[M5-005 manifest](../../../../evidence/p1r/m5/P1R-M5-005/manifest.json)、[网关契约](../../../../packages/contracts/fragments/p1r-gateway-boundary.openapi.json)。
- 隐私：[M6-007 manifest](../../../../evidence/p1r/m6/P1R-M6-007/manifest.json)、[M6-008 manifest](../../../../evidence/p1r/m6/P1R-M6-008/manifest.json)。
- 发布：[M8-016 manifest](../../../../evidence/p1r/m8/P1R-M8-016/manifest.json)，只准备评审包，未给出独立发布结论。

## 5. 摘要核对与历史文字的边界

先读取 108 个任务 manifest 的 1155 条 artifactDigests（701 个不同路径），以工作区内容筛选差异候选；工作区初筛 193 条，包含换行差异，**不得作为最终 HEAD 漂移数**。随后用 `git cat-file --batch` 获取候选的 HEAD blob，排除换行因素后确认 19 条，见 [Git HEAD 摘要差异附件](COMPLETENESS-AUDIT-2026-09-20-head-digests.json)。附件保存原始确认结果，文档后续修改不会重写该历史快照。

19 条分布：`package.json` 被 M1-003…018 与 M2-009 引用（17 条）；M4-001 引用 `apps/learner-web/src/stores/session.ts`、`apps/mobile/src/stores/session.ts`（2 条）。此方法是候选复核，不替代完整 Evidence Gate 的 sourceCommit、Git 状态、provenance 和独立评审校验。

另有 39 个 ACCEPTED manifest 的 knownGaps 非空，52 个 ACCEPTED manifest 的 environment.reviewPolicy 含旧的 `not ACCEPTED` 文字。这是字段扫描结果，包含历史说明或已解决事项，不等于 39 项未完成或 52 项验收无效，需结合时间及 statusNote 复核。

官网 [privacy](../../../../apps/official-site/pages/privacy.vue)、[terms](../../../../apps/official-site/pages/terms.vue)、[minors](../../../../apps/official-site/pages/minors.vue)、[status](../../../../apps/official-site/pages/status.vue) 四页源码实际存在，故纠正“缺四页”描述。源码存在不等于页面运行、内容适用性或合规验收通过。批量导入接口也已出现在当前契约测试报错中；本轮未重新证明其完整行为或标准乐观锁，不继续沿用“完全缺失”的推断。

## 6. 后续顺序

1. 优先关闭 AUDIT-0920-01，恢复当前源码的契约和适用回归；明确全量检查耗时和完成条件，再补完整 Evidence Gate。
2. 按现有 P1R 任务补齐 AUDIT-0920-02/03/04；同步核查各 owner 的事件发布、消费、DLQ、回执与故障恢复，不能用单一服务样本代表整个平台。
3. 修复经过验证后再处理 AUDIT-0920-05 的证据绑定；本次不调整 81/27 状态。
4. 完成当前提交的跨端业务闭环，再推进 M8 真机、性能、安全、staging、灾备、回滚、签名制品与独立 Go/No-Go。

## 7. 文档落地记录

本次新增梳理日志与 HEAD 摘要附件；更新根 CURRENT-HANDOFF、根 README、计划 README、台账审计提示、旧交接的历史入口提示及 CHANGELOG。修正当前状态口径，保留历史执行记录与原任务状态。附件与第 3 节是文档修改前的源码快照；这些文档后续若被原 manifest 引用，仍须按适用流程复验，不能用本日志自动重定摘要。

文档更新后的检查：

- 计划检查 PASS：108 项，81 ACCEPTED / 27 DEV_DONE，状态未变。
- 文档健康检查 PASS：584 文档、1690 内部链接、0 死链；52 个孤儿文档提示保留，0 缺 README 目录。
- 陈旧声明检查 PASS：1397 files；不扩大该检查器的语义保证。
- `git diff --check` PASS。
- 本次只做文档与审计附件落地，未再次运行全量 P1R、全量 Evidence Gate 或全栈测试。以上文档检查通过不覆盖第 3 节已有契约失败与未完成状态。
