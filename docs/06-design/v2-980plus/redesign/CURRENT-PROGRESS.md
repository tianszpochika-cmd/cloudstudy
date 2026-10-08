# 迭代 2（第二轮重设计）当前进度 — dev-redesign

> **本分支唯一当前进度与任务接手入口。** 更新：2026-10-08；本轮源码基线：`8215c95d8ad63169a68afb997f2d7ad8bc1b9b71` + [具名源码与运行差量](../../../../evidence/redesign/2026-10-08/R1-002/integration/receipt.md)。R1-002 已获Luna[独立终审](../../../../evidence/redesign/2026-10-08/R1-002/review/final-review.md)与根审签收 **ACCEPTED_CARD_SCOPE / R1_002_ACCEPTANCE_PASS**，当前 **SAFELY_PAUSED**：干净专库注册、受限会话、两条 HTTPS 与真实服务 PEP 通过，三个新账号字面schema权限已验证，本轮自有进程已全部退出。原114卡墙、原R1-001完整验收和IT-1出站不随本卡晋升。历史限定交付见[D1终审](../../../../evidence/redesign/2026-10-07/R1-002-D1/review/final-scope-review.md)和[前轮范围审查](../../../../evidence/redesign/2026-10-07/orchestrator-review/final-scope-review.md)。
> 本页是依据仓库可读证据形成的进度汇总，不替代独立验收，不修改旧 canonical manifest、P1R 状态或冻结契约。

## 1. 迭代命名与执行边界

本分支的“迭代 2”指**第二轮重设计（Redesign）**，计划入口为[重设计包](README.md)与[R1 开发计划](dev-plan-R1.md)。名称不表示产品 Phase 2，也不表示已经进入 R1 的 IT-2 站。

- **产品阶段**仍是 Phase 1：18+ 成人、规则化学习；生成式 AI、RTC AI 和 K12 不因迭代编号而启用。
- **交付层次**为 R1 本地闭环 → R2 测试机联调验收 → R3 上线门后；R2/R3 不能用 R1 本机测试替代。
- **R1 迭代站点**为 IT-1～IT-7。IT-2 是其中的定级环（R1-018～029）；上站干净库全绿、证据签收后才能进入下站。
- **本分支新工作**按 R1 卡、BC/IC 与依赖推进，继续绑定 FEAT/PRD-ATOM/V2-980、ARCH、ACT/JNY/PAGE/RULE/INT/E2E、服务及数据 owner。旧 P1R 只提供来源/复用/冻结门禁，不自动迁移完成状态。

## 2. 可确认进度

| 项目 | 仓库可确认事实 | 当前使用边界 / 下一步 |
|---|---|---|
| 业务与交互计划 | R1 冻结范围经变更单 001 为 108 步；执行文档含 IT-1～IT-7，L1/L2 已细拆 29 卡；新增[29 卡固定来源导航](recovery-20261007/README.md)，从固定 `ff0f8057` Git blob核对25个来源，862/862校验通过，生成器只读重放通过 | 108 是业务步骤数；29 是可读定义数，均不是完成数。索引不维护工作流状态、不替代原114卡墙；immutable来源与当前工作树差量分开记录 |
| 全量卡墙与原验收 | [恢复核对报告](recovery-20261007/recovery-report.md)在限定搜索范围内未找回原114卡墙、状态工具/revision27或R1-001完整产品与独立验收原件；旧[10月6日记录](../../../../evidence/p1r/m2/P1R-M2-002/redesign/R1-002/reviewer-3-closeout/review.md)仅提供历史陈述 | GAP-WALL-114、原R1-001交付/验收及干净可复放业务基线仍OPEN；不按计数造卡、不导入历史ACCEPTED，不把29卡索引或本轮官网差量称为原件恢复 |
| 原型 | 10 月 1 日记录：移动端 91 屏、管理端 16 屏、官网 11 页静态原型，详见[原型交付](README.md#当前原型交付2026-10-01) | 属于 UI/交互/静态演示交付，未据此验收正式 apps 的业务闭环 |
| R1-001 官网当前源 | [前轮交付](../../../../evidence/redesign/2026-10-07/R1-001-implementation/review-ready.md)获Luna **ACCEPT_SCOPED_DELIVERY / SOURCE_SCOPED_PASS**：注册CTA到学习端 `/register`；价格/下载按各自真实投影显示空/非空与恢复状态。前轮官网源测试26/26、R1 HTTP/SSR与共享fallback 4/4、type/build通过；11原路由双视口22次直接200，CTA实际可达但未注册；两页4次真实空态、40个本地fixture分支、2个无关scope及4张非空fixture视觉检查通过 | **SOURCE_SCOPED_PASS_NOT_WORKFLOW_ACCEPTANCE**：仅局部源码交付和当时既有dev运行复验，不是业务卡ACCEPTED。原验收原件未恢复、正式干净库验收未签；mock投影不是后端事实，前轮复验时官网PID9008未重启，不表示它当前仍运行；本轮注册201/受限会话/服务403见独立R1-002行，不回写原R1-001验收 |
| R1-002 注册接口 | [当前运行收据](../../../../evidence/redesign/2026-10-08/R1-002/runtime/runtime-results-925ac824.json)为PASS：新专用IAM库17项正常Flyway成功、最大版本18，注册前六类计数全0；直达IAM TLS注册201、Secure/HttpOnly/SameSite=Lax Cookie，RS256受限令牌无学习权限；账号/主体/设备/会话持久关联、审计3条、幂等成功1条；审计故障503后六类计数不增。Gateway两条真实HTTPS正向均200，独立JWKS错误信任为200/401，SCG错误信任为502/502；独立learner库12项迁移成功，直达服务 `/api/v1/learner/targets` 返回403/CONSENT_REQUIRED | **ACCEPTED_CARD_SCOPE / R1_002_ACCEPTANCE_PASS**：[Luna独立终审](../../../../evidence/redesign/2026-10-08/R1-002/review/final-review.md)与根审签收本轮卡定义“干净库201+会话，无学习能力”。首次[FAILED运行](../../../../evidence/redesign/2026-10-08/R1-002/runtime/runtime-results-51ca8300.json)因learner disabled模式缺JdbcTemplate而提前退出，保留原件；修复仅为新专库正常JDBC配置后整轮重跑。当前本地注册审计已durable；历史event审计映射、跨服务Outbox/Kafka发布和prn_ legacy迁移仍OPEN，不因本卡改写旧workflow。当前 **SAFELY_PAUSED**，本轮自有进程已退出、18070/18087/18088释放；不启动R1-003～005或IT-2 |
| R1-002 D1 离线工具与本轮构建 | [历史D1整合](../../../../evidence/redesign/2026-10-07/R1-002-D1/integration/receipt.md)仍为SOURCE_SCOPED_PASS_NOT_WORKFLOW_ACCEPTANCE。本轮生产JWK source整文档拒私参、解析后检查isPrivate、固定安全异常，24/24定向通过；[Gateway构建收据](../../../../evidence/redesign/2026-10-08/R1-002/gateway/build-receipt.json)绑定84项当前输入，构建后不变，真实runtime校验source→JAR通过；[离线实际probe](../../../../evidence/redesign/2026-10-08/R1-002/runtime/offline-probe.json)绑定217项工件，private fixture整文档拒绝、selected=0；执行时工具29/29（lifecycle25+business4），最新literal grant helper定向5/5通过，四项重叠不累加，未另跑组合30 | 本轮关闭限定public-key-only与source→JAR缺口；[ACL读回](../../../../evidence/redesign/2026-10-08/R1-002/runtime/permission-readback-final.json)和[owner自表读回](../../../../evidence/redesign/2026-10-08/R1-002/runtime/owner-table-readback.json)证明三个新账号仅字面schema授权。业务执行源码与运行后helper差量分别绑定。旧D1当轮source→JAR未签和TLS-01～08未执行仍为历史事实，旧完整TLS矩阵本轮也未全面重跑；不宣称Windows旧环境或完整D2矩阵验收，完整身份兼容/跨服务Outbox未实施 |
| R1-003～017 / IT-1 出站 | 仓库有任务定义，未取得该轮全链干净库验收包 | **NOT_VERIFIED**：表示本页缺少可确认的当前验收，不宣称从未实现。不得据旧 P1R 的 ACCEPTED 解锁下站 |
| R1-018～029 / IT-2 定级 | 已规划 12 卡：新接口、旧 B25 写口退役、checkpoint、判分、报告、跳过/重测、10+5 种子、断网恢复与交互/干净库验收 | **尚无可确认的开工/出站证据**；先补齐 IT-1 出站与全量卡墙，不能因计划存在就宣布 IT-2 开工或完成 |
| IT-3～IT-7 | 已有计划站点和出站门：计划今日、练错复、报告、双审、收口 | 保留依赖顺序；不从旧 B/DEV/G 或 P1R 台账自动认领下一任务 |
| 本机开发与测试 | [10月6日快照](../../../07-operations/local-environment-verification-2026-10-06.md)的15服务/四前端、Java1444通过/61跳过、P1R26失败和iOS环境结果保留为历史。本轮仅启动自有IAM/Gateway/learner Java children，正常迁移新专库并验证R1-002；失败轮与通过轮均finally关闭自有进程，最终[收据](../../../../evidence/redesign/2026-10-08/R1-002/runtime/runtime-results-925ac824.json)ownedChildrenStopped=true、三端口FREE、cleanupErrors=[] | 当前安全暂停只针对本轮自有进程；未重启Docker、未down/prune或停止其他容器。保留首次专库、最终IAM/learner两个新专库及Git外受保护材料，不自动删库或释放凭据；重接手须核对环境身份。61skip/26治理FAIL未重跑，不声称全项目全绿、当前15服务已恢复、Windows或原生App业务验收 |

**当前不发布整体完成百分比。** 计划覆盖、原型屏数、环境检查、旧 P1R 任务比例和本轮正式业务验收是不同指标，不能相互换算。

## 3. Agent 接手顺序

1. 核对 `git branch --show-current` 为 `dev-redesign`、源码提交与工作区差量；保留已有未提交文件。先读[根交接](../../../../CURRENT-HANDOFF.md)、本页、[R1 卡计划](dev-plan-R1.md)、[业务链](business-chains.md)和[交互链](interaction-chains.md)。
2. 使用[固定来源29卡导航](recovery-20261007/README.md)核对现有定义与依赖，保留原114卡墙/状态工具与R1-001完整验收缺口。后续取得可信原件再按来源提交、owner、测试与证据核对；不能凭计数造卡或从旧台账迁移状态。
3. 本轮R1-002实际卡范围已完成并安全暂停，独立验收状态见本页和[整合收据](../../../../evidence/redesign/2026-10-08/R1-002/integration/receipt.md)。本轮关闭Gateway public-key-only/source→JAR与具名两HTTPS运行缺口；不得因此回写原114墙、原R1-001或旧P1R workflow。保留新专库与Git外材料；重新执行须先复核Docker/容器/固定端口和运行材料，不收养或擅停非本轮进程。R1-003～005、完整身份迁移与Outbox扩围均留待后续具名指令，本轮不启动。
4. 当前按用户要求暂停。后续恢复时继续按IT-1卡依赖；新号注册→成人门→同意→画像→定级入口的全链干净库验证及独立签收仍缺，IT-1未出站，IT-2不开工。卡级R1-002验收不能替代整站验收或原R1-001原件恢复。
5. 每次进度变化只更新本页的相应行及该卡证据：来源提交、执行环境、状态迁移、验收者、PASS/FAIL/跳过、开放 GAP 与下一步；其他入口保持链接，不再维护第二套当前完成率。

## 4. 历史数据与验收规则

- [P1R 编号台账](../../../../requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md)、旧 B/DEV/G 和 56 PAGE-P1 台账仅供历史验收与复用审计；不得作为本分支新开发队列。历史事实和 canonical Evidence 保留原样。
- 原九月交接已归档至[历史交接](../../../../CURRENT-HANDOFF-ARCHIVE-2026-09-28.md)，其中“当前”“下一步”均只指当时日期与环境。
- 准备检查通过、类型/构建通过、健康探针通过、Git 推送成功和原型演示通过，都不能单独把 R1 卡晋升为 ACCEPTED；需当前提交、干净库、API/数据/事件、前端读回及独立验收证据。
- 架构、安全、DoD、固定端口及 contract-first 规则仍以[AGENTS](../../../../AGENTS.md)及有效 ADR 为准。旧 P1R 的冻结契约与兼容检查仍有效；本次入口校正不豁免测试或改变 canonical 状态。
