# 迭代 2（第二轮重设计）当前进度 — dev-redesign

> **本分支唯一当前进度与任务接手入口。** 更新：2026-10-10；本次验收源码基线：`69bea68b44b2c8c6c6dbdcdb38c0b955a458aaf1`。本轮 [IT-1 真实浏览器验收](../../../../evidence/redesign/2026-10-10/station-acceptance/it1/report.md)为 **REJECT / FAIL**：Web 与 Mobile H5 的注册、登录、密码重置实际指向 HTTP Gateway，违反密码直达 IAM TLS 的边界；当前源码缺浏览器认证 CORS 配置，既有 IAM artifact 的 TLS 预检也缺允许响应头（无本轮 fresh-build 绑定）。**IT-2 动态验收 BLOCKED，未执行**；保留已有 R1-018～029 开发与回放事实，不能把它们称为合规出站。独立审查入口为[验收矩阵](../../../../evidence/redesign/2026-10-10/station-acceptance/review/acceptance-matrix.md)与[Luna max 本轮独立终审](../../../../evidence/redesign/2026-10-10/station-acceptance/review/final-review.md)：IT-1 **REJECT / FAIL**、IT-2 **BLOCKED**。
>
> 本轮站级拒绝不撤销 R1-002、003、004、005、006、008 的历史独立卡范围验收；R1-007 保留双端源码交付和单测事实，本轮未找到独立终审。官网本轮 11 页双视口 22/22 与 4 次注册 CTA 通过，只计具名局部范围，不恢复原 R1-001 完整验收或原 114 卡墙。本轮 6 个自有子进程已停止、监督进程 exit 0，8 个相关固定 HTTP 端口均无监听，当前 **SAFELY_PAUSED**；两个新测试 schema、各自单库账号及 Git 外受保护材料保留，详见[收据清单](../../../../evidence/redesign/2026-10-10/station-acceptance/it1/manifest.json)与[退出核对](../../../../evidence/redesign/2026-10-10/station-acceptance/it1/cleanup-verification.json)。未修业务源码，未启动下一站。
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
| R1-001 官网当前源 | [前轮交付](../../../../evidence/redesign/2026-10-07/R1-001-implementation/review-ready.md)获Luna **ACCEPT_SCOPED_DELIVERY / SOURCE_SCOPED_PASS**：注册CTA到学习端 `/register`；价格/下载按各自真实投影显示空/非空与恢复状态。前轮官网源测试26/26、R1 HTTP/SSR与共享fallback 4/4、type/build通过；11原路由双视口22次直接200，CTA实际可达但未注册；两页4次真实空态、40个本地fixture分支、2个无关scope及4张非空fixture视觉检查通过 | 本轮正常独立 content 的 11 页双视口 22/22 HTTP 200、无横向溢出与 pageerror，主页/课程空态 4 次 CTA 到真实注册表单；课程/下载是真实空态，价格依赖未起为诚实错误态，见[本轮收据](../../../../evidence/redesign/2026-10-10/station-acceptance/it1/official-content-result.json)。**SOURCE_SCOPED_PASS_NOT_WORKFLOW_ACCEPTANCE**：仅局部源码交付和当时既有dev运行复验，不是业务卡ACCEPTED。原验收原件未恢复、正式干净库验收未签；mock投影不是后端事实，前轮复验时官网PID9008未重启，不表示它当前仍运行；历史10月8日注册201/受限会话/服务403见独立R1-002行，不回写原R1-001验收 |
| R1-002 注册接口 | [当前运行收据](../../../../evidence/redesign/2026-10-08/R1-002/runtime/runtime-results-925ac824.json)为PASS：新专用IAM库17项正常Flyway成功、最大版本18，注册前六类计数全0；直达IAM TLS注册201、Secure/HttpOnly/SameSite=Lax Cookie，RS256受限令牌无学习权限；账号/主体/设备/会话持久关联、审计3条、幂等成功1条；审计故障503后六类计数不增。Gateway两条真实HTTPS正向均200，独立JWKS错误信任为200/401，SCG错误信任为502/502；独立learner库12项迁移成功，直达服务 `/api/v1/learner/targets` 返回403/CONSENT_REQUIRED | **ACCEPTED_CARD_SCOPE / R1_002_ACCEPTANCE_PASS**：[Luna独立终审](../../../../evidence/redesign/2026-10-08/R1-002/review/final-review.md)与根审签收。 |
| R1-003 注册幂等回放 | [当前运行收据](../../../../evidence/redesign/2026-10-09/R1-IAM-LIFECYCLE/runtime-results-ff793b6aaaa9.json)为PASS：新专用IAM干净库初态全0；首次注册201；同键同请求体重放返回相同sessionId/deviceId，账号总数保持1，完成态幂等记录1；同键不同请求体409拒绝且不建第二账号；缺键400拒绝。12/12项逐条断言全绿 | **ACCEPTED_CARD_SCOPE / R1_003_ACCEPTANCE_PASS**：[Luna独立终审](../../../../evidence/redesign/2026-10-09/R1-IAM-LIFECYCLE/final-review.md)签收。 |
| R1-004 登录/刷新/撤销全套 | [当前运行收据](../../../../evidence/redesign/2026-10-09/R1-IAM-LIFECYCLE/runtime-results-ff793b6aaaa9.json)为PASS：独立新账号登录200下发会话；携带合法Cookie刷新200且新Refresh Token不同（CAS成功）；Cookie严格HttpOnly/Secure/SameSite=Lax且响应体无明文refreshToken；旧Refresh重放401且会话撤销为REVOKED；重新登录后logout 200且会话REVOKED；失效后旧Access与Refresh再用均401。14/14项断言全绿 | **ACCEPTED_CARD_SCOPE / R1_004_ACCEPTANCE_PASS**：[Luna独立终审](../../../../evidence/redesign/2026-10-09/R1-IAM-LIFECYCLE/final-review.md)签收。修正非活跃会话刷新抛SESSION_REVOKED(401)闭环。 |
| R1-005 多设备列表+踢出 | [当前运行收据](../../../../evidence/redesign/2026-10-09/R1-IAM-LIFECYCLE/runtime-results-2adfe7d7cd74.json)为PASS：契约B8Device增补`isCurrent: boolean`（服务端由已验证JWT判定，不接受客户端声明）；双设备登录后设备A与B视角分别恰有1个当前设备匹配主调；A踢出B返回200；被踢设备B旧Access与Refresh再用均401；主调A凭据保持200有效且会话仍ACTIVE。14/14项断言全绿 | **ACCEPTED_CARD_SCOPE / R1_005_ACCEPTANCE_PASS**：[Luna独立终审](../../../../evidence/redesign/2026-10-09/R1-IAM-LIFECYCLE/final-review.md)签收。修正已踢设备刷新抛DEVICE_REVOKED(401)闭环；两端前端优先服务端isCurrent。 |
| R1-006 成人门提交 | [当前运行收据](../../../../evidence/redesign/2026-10-09/R1-IAM-LIFECYCLE/runtime-results-2adfe7d7cd74.json)为PASS：新专用IAM干净库初态全0；成年提交200返回PASSED/ELIGIBLE/SERVER_VERIFIED，DB落库APPROVED/verifiedAt，审计记ALLOW(adult_gate_allowed)；未成年提交200返回REJECTED/RESTRICTED/REJECTED，DB落库REJECTED/verifiedAt=NULL，审计记DENY(ADULT_AGE_BELOW_MINIMUM)；未成年会话保持ACTIVE不误杀，受限访问/me正常200；已决REJECTED幂等重放200一致不再报503；缺confirmed拒403、缺键拒400。19/19项逐条断言全绿 | **ACCEPTED_CARD_SCOPE / R1_006_ACCEPTANCE_PASS**：[Luna独立终审](../../../../evidence/redesign/2026-10-09/R1-IAM-LIFECYCLE/final-review.md)签收。 |
| R1-007 门未过等待态 | Web/Mobile 双端实现：BC-007/IC-005/IC-055 账号设置/支持/平台/受限页正常放行；学习入口解释受限原因（人话对稿“当前版本仅面向 18 岁以上成人开放，暂不能向你开放学习功能。”，不诱导修改年龄）；首页任务与测评主入口置灰禁用；受限页与向导页提供直接退出登录出口；新增针对性单测 4/4 PASS，双端核心单测 54 项全绿，双端类型检查 0 错误 | **SOURCE_DELIVERY_PASS_NOT_INDEPENDENT_ACCEPTANCE**：保留此前 `R1_007_DELIVERY_PASS` 双端交付和单测事实；本轮未找到独立终审，不升级为卡级独立验收。本轮真实浏览器门未过幕受认证前置阻塞。 |
| R1-008 三同意动态版 | [当前运行收据](../../../../evidence/redesign/2026-10-09/R1-IAM-LIFECYCLE/runtime-results-1b88d9e1df09.json) 为 PASS：先读激活版本再签（b30-consent-v1）；动态提交 PRIVACY/TERMS/ADULT_LEARNING 均 200(ACCEPTED)；DB 落库 3 条 GRANTED 且审计记 consent_recorded；学习权限翻转为 ELIGIBLE、账号 ACTIVE；过期版本提交 409 拒绝且不脏写；缺键/非法 decision 拒 400；重放 200 一致。Web/Mobile 双端实现“乐观默认版本 + 409 动态嗅探重试自愈 + 共享 refreshPromise”，双端 6 项针对性单测全绿。17/17 项断言全绿 | **ACCEPTED_CARD_SCOPE / R1_008_ACCEPTANCE_PASS**：[Luna 独立终审](../../../../evidence/redesign/2026-10-09/R1-IAM-LIFECYCLE/final-review.md)签收。全生命周期 76/76 项断言全绿。 |
| R1-009～017 / IT-1 出站 | 历史 R1-009～017 调度审查、R1-014 后端回放与 IT-1 HTTP 链记录保留：撤回后学习口 403、画像落库等属于当时具名范围；R1-014 未覆盖全端，R1-017 没有浏览器走查，不能作为整站全绿。本轮 Web/H5 两视口注册 4 次、登录/重置 8 次实际目标均为 HTTP Gateway；保护性中断前网请求，未向 Gateway 发送密码。当前 IAM 源码缺 CORS 配置；既有 artifact 的 TLS OPTIONS 200 但缺 ACAO/ACAC/ACAM（无本轮 fresh-build 绑定），主链未建立。见[本轮报告与17卡矩阵](../../../../evidence/redesign/2026-10-10/station-acceptance/it1/report.md)。 | **REJECT / FAIL**：AUTH_TRANSPORT（P1）、IAM_AUTH_CORS（P1）。浏览器注册→门→同意→画像→定级链未通过，未获 IT-1 出站签收；历史六卡独立验收不撤销。 |
| R1-018～029 / IT-2 定级 | 已有开发事实保留：R1-018～028 调度审查及 R1-029 单 schema 换 Flyway 历史表的回放 26 PASS、3 NOT_RUN、0 FAIL；不是 content/learner/assessment 三个独立 owner schema/user，不能作为独立服务隔离证据，IAM 未启用而使用临时 JWKS/同意 loop stub，当时未跑浏览器全链。当前静态审查确认公开重测路由未发布、历史 Gateway 观测为 404，双端重测按钮 disabled；旧 submit-step/skip 写口仍外露，契约/事件与 P1 运行形状有缺口，见[本轮矩阵](../../../../evidence/redesign/2026-10-10/station-acceptance/review/acceptance-matrix.md)。这些已知缺陷不能继续按纯未跑项解释。 | **BLOCKED / IT2_DYNAMIC_NOT_RUN**：IT-1 未绿灯，未执行本轮 IT-2 动态验收。历史提前开发不等于已合规开站或出站；公开重测为已知范围 FAIL，不补造 R1-030。 |
| IT-3～IT-7 | 已有计划站点和出站门：计划今日、练错复、报告、双审、收口 | 保留依赖顺序；不从旧 B/DEV/G 或 P1R 台账自动认领下一任务 |
| 本机开发与测试 | 本轮仅启动 IAM18087 TLS、Gateway18070、content18089、Web18180、H5 18183、官网18182 六个自有子进程；两个新独立 schema/单库账号，IAM Flyway17/0、账号始终0，content28/0、公开课程/facet0。learner/assessment 未创建库、未启动。6 个子进程停止、监督进程 exit0，8 个相关固定 HTTP 端口无监听，见[环境](../../../../evidence/redesign/2026-10-10/station-acceptance/it1/environment.json)、[数据库核对](../../../../evidence/redesign/2026-10-10/station-acceptance/it1/database-verification.json)和[退出核对](../../../../evidence/redesign/2026-10-10/station-acceptance/it1/cleanup-verification.json)。 | **SAFELY_PAUSED**。未 down/prune、重启 Docker 或停止其他容器；保留两个新库、账号与 Git 外0700目录/0600材料。JAR 仅为既有 artifact 摘要绑定，无本次 fresh build 回执，不能宣称全部 JVM 字节码已由当前源重建。保留[10月6日历史环境快照](../../../07-operations/local-environment-verification-2026-10-06.md)及[10月8日端口调整](../../../02-architecture/local-development-port-allocation.md)，不声称当前15服务、Windows/原生App或全项目验收全绿。 |

**当前不发布整体完成百分比。** 计划覆盖、原型屏数、环境检查、旧 P1R 任务比例和本轮正式业务验收是不同指标，不能相互换算。

## 3. Agent 接手顺序

1. 核对 `git branch --show-current` 为 `dev-redesign`、源码提交与工作区差量；保留已有未提交文件。先读[根交接](../../../../CURRENT-HANDOFF.md)、本页、[R1 卡计划](dev-plan-R1.md)、[业务链](business-chains.md)和[交互链](interaction-chains.md)。
2. 使用[固定来源29卡导航](recovery-20261007/README.md)核对现有定义与依赖，保留原114卡墙/状态工具与R1-001完整验收缺口。后续取得可信原件再按来源提交、owner、测试与证据核对；不能凭计数造卡或从旧台账迁移状态。
3. 保留六卡历史独立验收与 R1-007 源码/单测交付，不把本轮 IT-1 拒绝回写为历史验收撤销。历史 R1-009～029 的调度审查/回放仅按原范围使用；原 114 卡墙、R1-001 完整产品/独立验收 GAP 仍 OPEN。
4. 本轮 IT-1 **REJECT / FAIL**、IT-2 动态验收 **BLOCKED**。下一轮先修独立 IAM TLS 认证 transport、证书校验与精确 CORS/credential/preflight，并以真实 Web/H5 两视口重走注册/登录/重置及门→同意→画像→定级链；补契约 `If-Match`、停 learner 再启画像读回及其余17卡正负例。独立签收 IT-1 后才可动态验 IT-2；再核旧写口退役、P1 契约/事件、IAM 真签用户/服务令牌、公开重测/按钮和真实断网恢复。此处是修复清单，不是本轮已启动修复或下一站授权。重新运行先复核固定端口、容器身份及 Git 外材料，只管理新一轮自有进程，不收养或擅停其他进程；不补造 R1-030。
5. 每次进度变化只更新本页的相应行及该卡证据：来源提交、执行环境、状态迁移、验收者、PASS/FAIL/跳过、开放 GAP 与下一步；其他入口保持链接，不再维护第二套当前完成率。

## 4. 历史数据与验收规则

- [P1R 编号台账](../../../../requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md)、旧 B/DEV/G 和 56 PAGE-P1 台账仅供历史验收与复用审计；不得作为本分支新开发队列。历史事实和 canonical Evidence 保留原样。
- 原九月交接已归档至[历史交接](../../../../CURRENT-HANDOFF-ARCHIVE-2026-09-28.md)，其中“当前”“下一步”均只指当时日期与环境。
- 准备检查通过、类型/构建通过、健康探针通过、Git 推送成功和原型演示通过，都不能单独把 R1 卡晋升为 ACCEPTED；需当前提交、干净库、API/数据/事件、前端读回及独立验收证据。
- 架构、安全、DoD、固定端口及 contract-first 规则仍以[AGENTS](../../../../AGENTS.md)及有效 ADR 为准。旧 P1R 的冻结契约与兼容检查仍有效；本次入口校正不豁免测试或改变 canonical 状态。
