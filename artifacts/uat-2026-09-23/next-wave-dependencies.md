# Phase 1 下一波共享依赖与任务拆分（2026-09-23）

## 判定口径

本文件保留首轮只读规划快照，不修改运行服务、账号或数据库。它依据当时的 [56 页覆盖台账](./coverage-ledger.md)、[定级](./assessment-gap.md)、[首日](./first-day-gap.md)、[五类技能](./skills-gap.md)、[媒体/学习规则](./media-learning-gap.md)、[管理端](./admin-gap.md)、[契约门禁](./contract-validation-gate.md)，并按 [Phase 1 依赖图](../../requirements/backlog/v2-phase1-rebaseline/01-里程碑与依赖图.md) 和 [运行验收规范](../../docs/06-design/v2-980plus/phase1-business-operation/08-验收与追溯规范.md) 排序。首轮快照为 **PASS 0、PARTIAL 25、BLOCKED 22、NOT_TESTED 9**；后续定级路由、契约门禁和页面实测已有变化，**当前状态以覆盖台账及专项证据为准**。下面的任务是实施依赖提示，不是六项做完即可宣布 56 页通过。

每张实施任务卡应补齐来源 `FEAT/PRD-ATOM/V2-980`、`ARCH`、`JNY/PAGE/RULE/INT/E2E`、operationId、owner、版本、权限和数据迁移映射。最终升为 `PASS` 必须有同一可追踪业务事实的四端适用 UI、Gateway、服务 owner、持久化、事件/审计和失败恢复证据；纯函数、Mock、匿名 401、服务健康、构建成功、全局行数均只能证明局部条件。

## 共享阻断与先后关系

| 共享依赖 | 已确认的断点 | 扩散到的页面族 | 必须产生的运行证据 |
| --- | --- | --- | --- |
| 契约、operation owner、Gateway、幂等 | 聚合契约仍有 13 个写操作缺幂等声明，`contracts:validate` 失败；冻结 Gateway 检查有 14 项漂移。定级 canonical 五路由和五类技能现行入口 404，不能将旧前缀整体转到单一服务。 | 测评、首日、五技能、SRS、治理、客服/恢复等；这是多页公共门禁，本身不使任何页 PASS。 | OpenAPI/事件片段、生成物、路由政策与服务实现一致；每条受保护 operation 走 Gateway→正确 owner 并验证 401/403/404/409 与同键重放。 |
| IAM 成人资格、同意、旧会话及服务侧 PEP | 学习世界种子曾让 104 个未获 IAM 成人批准的主体拥有 learner 侧假成人/同意标志；另有旧 ACTIVE 会话需核对。IAM 新签发权限和 B25 learner 兼容入口的权限检查口径不同，不能据源码单点推断旧会话已经安全或可越权。 | 注册、登录、成人同意、全部受保护学习页、设备/隐私、管理权限。 | 用受控合成主体逐路由验证 IAM→Gateway→领域服务的旧/新会话、Gate 前后、同意撤回、刷新/撤销和跨主体拒绝；核对 owner 无未授权写入。 |
| 已审校内容、媒体字节与正式发布 | 当前公开课程/方案为空；本地旧听读记录含空 segments/blocks，旧占位不能作为学习内容。媒体签名链仍需与真实对象字节、rights、字幕、版本和撤权对应。 | 官网课程/公告、课程架、听读说、定级题单、管理内容/媒体/双审/发布。 | 由独立审核员把有权利证据的版本发布；页面读到同一 `contentVersionId`，媒体实际 200/206 与 hash 对上，撤权/回滚后不可再读旧字节。 |
| Canonical 定级和可信 attempt | 旧 B25 只有词汇/语法两题；canonical 五路由 404。新增十题评分纯规则尚未接 HTTP、冻结题单、报告和事件。旧跳过结果已收束为 `UNVERIFIED`，仍不是定级上线。 | 测评/结果、checkpoint、练习 session、首日计划、错题/报告与后续可信奖励。 | 成人合成账号经 Gateway 完成 3/3/2/2 十题、版本冻结、断点恢复、幂等/冲突、不可变报告及 outbox；跳过不产生测得等级。 |
| Target/placement → planning input → plan/today → 首日投影 | 目标写入可持续化，但缺运行 consumer、唯一 active plan、真实任务和 `READY` 所需 pin；修复后的 503 只避免误报。旧任务完成允许缺练习证据。 | 目标、首页、今日、计划图、首个练习和后续报告。 | `INT-P1-003/004/017` 按版本去重和重放，生成带真实内容引用的至少一项任务；失败显示可查询 `PROCESSING/DEGRADED`，未练习不得完成。 |
| 可信学习反馈和运营写链 | 五技能旧固定词/非空答案判分、SRS 客户端自报、canonical 报告/离线 404；Admin 客服只有列表可读，七态命令 404，审计导出/治理仍断路。 | 五技能、词汇/SRS、错题/掌握、报告、成长/奖励、离线；学习者/管理员客服及管理审计/治理。 | 后续按唯一 attempt→learning 事实推进；客服独立验证同 owner 状态变化和审计，其他管理命令分开建任务。 |

依赖主线与设计中的 M1→M2→M3→M4→M5 一致：**契约/安全可验证 → 可发布内容 → 定级事实 → 首日计划 → 技能/复习/报告**。客服是可并行的运营链。任务可以在契约冻结后按不同 owner 同时实现，但不能提前用假内容或 Mock 宣告下游联调通过。

## 下一批六个边界明确的任务

| ID / 优先级 | 负责边界与交付 | 可并行条件及依赖 | 最小验收证据 |
| --- | --- | --- | --- |
| **NW-01 / P0：契约与路由门禁** | `packages/contracts`、生成客户端及 `api-gateway`。逐 operation 明确 B3 内容读、assessment 判分、learning 写入的 owner；处理 13 个幂等缺口的真实语义，收敛 14 项 Gateway 基线漂移，补 canonical 定级/技能/客服所需的精确方法和路径。不得给无重放语义的写入只补注解。 | 先冻结接口供 NW-03～06 开发；网关改动由本任务独占。其他任务可并行准备领域实现与测试，路由发布待其 owner PEP 就绪。 | `contracts:merge:check`、`contracts:validate`、`contracts:generate:check`、Gateway 契约检查全 PASS；每条新路由有 owner、权限、同键/异载荷和匿名负例，真实请求不再误入另一服务或无故 404。对应 `ARCH-GW-001`；事件传输的运行验证留给 NW-04/05。 |
| **NW-02 / P0：成人资格和旧会话授权回归** | `iam-service` 与 `learner-service` 的成人 Gate、同意和服务侧权限；制定受控合成账号矩阵，检查旧 JWT/refresh 与新 JWT，必要时修复 B25 兼容入口只认 learner role/非空权限的判断。仅本任务改 learner 的共同安全守卫。 | 可与 NW-01、03、04、06 并行；NW-05 改 learner 首日投影时避开共同守卫，合并后做一轮安全回归。不要把假 learner 同意列当 IAM 事实。 | `E2E-P1-AUTH-LIFECYCLE`、`E2E-P1-ADULT-CONSENT`：Gate 未批、必要同意缺失/撤回、旧会话、跨主体请求在 Gateway **和 owner** 都拒绝受保护读写；通过后有正确权限，撤销/重放失效；DB/审计证明无拒绝后的业务写入。旧会话安全性由实测得出，不预设结论。 |
| **NW-03 / P0：一套可发布教学内容与真实媒体** | `content-service`、`media-service` 和 Admin 的内容/媒体/审核/发布页面；限定一套 Phase 1 成人课程样本，内含四维十题定级所需内容、可学的语法/听读素材与版权、字幕/文本替代及对象完整性。不扩成批量“拟真”占位。 | 可与 NW-02、04、05、06 并行准备；使用 NW-01 冻结的内容/媒体 API。NW-04/05 的真实 E2E 依赖其正式发布与版本 pin。 | `E2E-P1-CONTENT-PUBLISH`、`E2E-P1-PUBLIC-ENTRY`：草稿→两个独立审核员→发布→官网与学习端投影→下线/回滚；服务端 rights/资格验证；浏览器实际播放、Range 206、SHA/size、字幕与撤权；未批准版本不出现在课程架。覆盖 `PAGE-P1-ADMIN-CONTENT/MEDIA/REVIEW/PUBLISH-ROLLBACK` 与官网课程/公告的适用动作。 |
| **NW-04 / P0：定级 owner 的完整会话与报告** | `assessment-service` 的 `P1_PLACEMENT_V1` 持久化、判分、checkpoint、不可变 report 和 outbox；学习 Web/移动端仅改 assessment 路径，使用生成类型。保留旧 B25 的明确迁移边界。 | 可按 NW-01 的契约与 NW-03 的题目/媒体接口并行实现；真实十题和联调等待 NW-03 发布。不得让 NW-05/奖励消费旧两题结果。 | `E2E-P1-FIRST-DAY` 的定级段与 `E2E-P1-TODAY-SESSION` 的恢复负例：3/3/2/2、8/10 覆盖/四维置信、全题 `ASSESSED`、跳过 `UNVERIFIED`、同会话版本 pin、重复/异摘要、断网恢复、跨账号拒绝；Gateway→assessment DB→outbox 与报告 ID 可对账。 |
| **NW-05 / P0：目标到首日任务的 owner 编排** | `learning-service` 规划输入/唯一 active plan/today、`workflow-service` 重试与恢复、`learner-service` 首日只读投影；前端只改首页、计划图、今日任务与恢复入口。任务内容必须来自 content owner，任务完成只吃经 owner 确认的活动/attempt 事实。 | 可在 NW-04 事件契约冻结后并行写 consumer 和 read model；需与 NW-02 约定 learner 文件边界。真实 E2E 待 NW-02、03、04 跑通。 | `INT-P1-003/004/017` + `E2E-P1-FIRST-DAY`：目标→定级/跳过→不可变 input→plan/today→`READY` 且至少一项有内容引用；重复/乱序事件只建一份计划，失败保留目标/报告并给 `DEGRADED` 恢复引用；没作答时任务完成被拒，Web/移动端显示相同状态。 |
| **NW-06 / P1：客服七态操作纵切** | 仅 `admin-ops-service.support`、Admin 客服页和学习者客服页，依 M1-016 实现 ticket/message/assignment/SLA/retention 的单 owner CAS 写链。先解决“只有脱敏列表、无处理命令”的断口；审计导出、治理/风险/权限另列后续任务，避免把多个 owner 强塞进此卡。 | 与 NW-02～05 并行；公共路由登记交 NW-01，领域 owner 只实现受保护内部/公开契约及状态机。 | `E2E-P1-SUPPORT`、`INT-P1-012`：学习者提交→管理员接单/回复/升级/解决→学习者查看/确认或超时关闭→重开；同键重放、过期 `expectedVersion` 409、跨租户 403、附件 CLEAN、脱敏预览、SLA 和审计 receipt 对账；同一工单在两端状态一致。 |

## 合并与验收顺序

1. NW-01 冻结 operation/event 和 owner 后，NW-02～06 可按上表的互斥目录并行开发；对 `learner-service` 共同文件和 Gateway 路由由单一负责人合并，禁止两个 Agent 同时改同一入口。
2. 先验 NW-02 的权限负例和 NW-03 的发布/字节事实，再联调 NW-04 定级，随后 NW-05 首日。NW-06 可独立验收，但必须复用相同 IAM/Gateway 安全口径。每次合并保留一个可回滚批次，集中构建与复测。
3. 首日和学习 E2E 使用隔离的新合成成人账号，不以受旧种子污染的主体作为正确业务样本。为每条目标页补同一追踪 ID 的 UI 操作、Gateway 响应、owner 行/版本、事件/审计与恢复记录；按 56 页重新判定，不以服务级套件的 PASS 数推导页面完成率。

本批之后仍需独立排期：五技能正式判分和媒体/录音真机链、`SM2_Q03_V1`/D+1/D+7/日报周报、离线有序同步、管理审计导出/治理/风险/权限、通知/隐私删除、游戏社交/商业权益，以及 iPad、原生移动和四主题/画质的实机验收。它们仍按现有 `BLOCKED/PARTIAL/NOT_TESTED` 保留，不能因下一批首日链路通过而自动升级。
