# 新注册学习者首日计划链路核查（2026-09-23）

## 结论

新注册成人保存学习目标后，`/home`、`/today` 没有课程或任务，是当前服务链路尚未闭合的确定性结果，不能以“数据还没刷新”或“今天无任务”判为通过。学习 Web 的真实浏览器验收已观察到此现象；本次独立核对了设计、Gateway 映射、learner/learning 两个 owner 的源码和表结构，没有创建账号、读取凭据或重启服务。

本次只修复了 **B9 首日响应虚报 READY**：源码现在在目标已确认而规划事实缺失时明确返回 503；未完成首日编排。因此首日功能仍为 **FAIL**。

## 链路证据

| 环节 | 当前事实 | 影响 |
| --- | --- | --- |
| 设计 | `J03.2` 要求 target → immutable planning input → learning plan/today → learner first-day projection；`READY` 必须有 plan pin 和至少 1 个任务，失败要有 `PROCESSING`/`DEGRADED` 与查询/恢复引用 | 单独保存目标不能视为首日就绪 |
| 目标写入 | `DefaultLearnerProfileCommandService.setLearningGoal` 写 learner 自己的目标、幂等记录、`learner.target.updated.v1` outbox | 目标事实已可持久化，但只代表 producer |
| 事件消费 | 在 `services/learning-service/src/main/java`、`services/workflow-service/src/main/java` 未找到 `learner.target.updated.v1` 的运行 consumer 或 `planning input` 的处理器；learning 的 `LearnerTargetPort`、`PublishedContentPort` 运行 bean 均为 fail-closed | 无自动计划编排；不能从客户端或跨服务 SQL 补写 |
| 学习 owner | `learning_runtime_plan` / `learning_runtime_task` 表能保存领域事实；`LearningPlanService.createPlan` 存在，但无上述跨服务输入接线。`V2LearningController` 当前只读 B25 plan 和 SRS 表，不读取 `learning_runtime_task` 作为今日任务 | 领域能力与当前 HTTP 读模型之间仍有断点 |
| 学员首页 | Gateway 的 `/api/v1/learner/home` 原样转发到 `LearnerHttpController`；该响应只有 `firstDay`、空 `tasks`，没有 Web 适配器 `parseHome` 所要求的 `dailyStream` | 即使目标保存成功，Web 当前会解析为空首页；不是 UI 刷新问题 |
| B25 兼容读 | `/internal/v1/learner/home` 的 `dailyStream` 仅来自 `b25_learner_daily_task`；目标 PUT 不自动生成任务。`daily-tasks/ensure` 由客户端传内容 code/title，服务端未验证发布/权利 | 旧路径也不能证明真实可学习任务；不应靠客户端造任务 |
| B9 首日投影 | `learner_first_day_projection` 现只有进度计数/nextAction/profileVersion，缺规划 input pin、plan ref、task refs、content epoch、水位和恢复引用；原 public 映射把“owned profile + target”直接标 `READY`，却返回 `taskCount=0`、`tasks=[]` | 违反 `B9FirstDayProjection` 契约，误导页面与验收 |

页面运行观察见 `apps/learner-web/audit-evidence/2026-09-23/learner-web-audit.md` 的首页/今日任务行；分级测评到首日计划的另一条缺链见 `artifacts/uat-2026-09-23/assessment-gap.md`。

## 本次源代码修复

- `LearnerHttpController.toFirstDay` 在 `profileReady && targetReady` 但没有 planning input、plan ref、任务列表时返回 retryable `STORE_FAILURE`（HTTP 503），不再发 `READY + 0 task`。`/home` 共用此映射，也不再误报首页就绪。
- 前置不全时保持 `NOT_READY`，补齐明确的 `PROFILE_INCOMPLETE`/`TARGET_INCOMPLETE` blocker 和由 profile version 派生的水位；不再把此情况误标为依赖故障。当前 `contentEpoch=1` 仍是既有兼容占位，尚未对接内容 owner 的真实 epoch，不能把这项修复称为完整 B9 运行投影。
- 新增 `LearnerFirstDayHttpMappingTest`，覆盖“缺目标必须有 blocker”和“确认目标但无规划事实不得 READY”。

这是边界真实性修复，不会产生课程、计划或今日任务。主 Agent 随后把 learner-service 与 commerce/content 两项修复集中构建并重启 16 个本地服务，健康检查 16/16 通过；由于未代替测试账号完成条款同意，本项仍缺目标已保存后的授权 HTTP 复测。

## 验证与限制

- `mvn -f services/learner-service/pom.xml -Dtest=LearnerFirstDayHttpMappingTest test`：2/2 PASS，编译通过。
- 默认临时目录下首次全测：60 项开始运行，0 断言失败、1 初始化错误、1 跳过。错误为 `LearnerJwtDecoderNegativeTest` 建立临时 JWKS 服务时，Java NIO Pipe 报 `Unable to establish loopback connection`。
- 在同一命令进程把 `TEMP`/`TMP` 指向 `C:\Temp` 后复跑全测：**65 项，0 失败、0 错误、1 跳过，BUILD SUCCESS**；其中 JWT 负向测试 6/6 通过。该回环错误与本机默认临时路径有关，未归因于 learner-service 业务实现。
- 本次未改 owner 数据或四端客户端；集中部署后的 503 页面提示和实际首日任务链仍需授权浏览器验证。

## 后续闭环顺序

1. content owner 提供真实已发布、权利有效的学习项与规则版本，assessment owner 提供定级完成或 `UNVERIFIED` 跳过的独立事实；先解决现有两题 B25 假测评。
2. 按已冻结的 `INT-P1-003` / `INT-P1-004` 契约接通 learner target 和 placement 事件的 consumer，生成不可变 planning input，按 `targetId/targetVersion`、eligibility/content pins 去重。workflow 记录并可查询/重放失败，不能跨 owner 表写入。
3. learning owner 用已验证 input 建唯一 active plan 和至少一个有内容引用的首日任务；重做 today stream 读取与完成证据，不能用客户端 `daily-tasks/ensure` 的标题/code 代替内容和练习事实。
4. learner owner 消费已确认的 plan/task/recovery 事实，持久化符合 `NOT_READY/PROCESSING/READY/DEGRADED` 完整形态的首日投影；Web/移动端读取相同 owner 状态、计划/今日流和恢复引用。
5. 成批部署后用新成人账号经 Gateway 实测：注册 → Gate/同意 → 目标 → 定级/跳过 → 计划 → 首日任务 → 完成证据 → 报告/复习，并验证幂等、重复事件、内容下线、权限与失败恢复。未完成前不得把空首页当正常空态。
