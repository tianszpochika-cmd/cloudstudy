# 分级测评与首日任务运行核查（2026-09-23）

> 本文前半记录第五批部署前的旧 404 现场。**当前** Gateway、IAM 和 assessment 已集中部署新五路由与 V16/V8；[真实请求矩阵](p1-placement-live/report.md)证实匿名/准入/权限拒绝与缺正式题源时 503 零写入。正式目标 pin、已授权十题内容/答案规则和正向定级→报告→计划仍缺，页面族依然 BLOCKED。下文的“尚未接入”“继续 404”属于历史观察，不能用于描述 14:20 CST 后本地运行栈。

## 结论与范围

本次检查覆盖本地 Gateway `127.0.0.1:18070`、assessment-service 当前源码、本地 MySQL owner schema、Web/移动端调用与 Phase 1 设计契约。`P1_PLACEMENT_V1` 的五条 canonical 路由尚未接入现行 Gateway/assessment-service。两端当前进入的是 B25 历史测评流程；其默认题库只有两题，不能满足四维十题、不可变版本钉、独立结果和首日计划联动的验收要求。当前判定：**Phase 1 分级测评及其首日闭环未通过运行验收**。

这里的 HTTP 探针未使用账号或令牌，仅验证路由是否存在及旧路由是否受到认证保护；没有把 401/404 解释成登录后的业务结果。MySQL 计数是全局存量，不代表当前浏览器用户的完成证据。

## 可复现证据

| 检查 | 观察 | 证据位置 |
| --- | --- | --- |
| 本地 Gateway 路由 | 用契约指定方法、无令牌调用 canonical 五条路径：POST `/placement/sessions`、GET `/placement/sessions/no-such-session`、POST `/placement/sessions/no-such-session/responses`、POST `/placement/baselines/skip`、GET `/placement/reports/no-such-report`，全部 **404**；旧 POST `/placement/start` 为 **401** | `services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.java:555-559` 只定义四条 B25 placement 路由 |
| assessment-service 控制器 | B10 控制器有通用 `/sessions`、attempt/checkpoint/report，没有 canonical `/placement/sessions`、`/responses`、`/baselines/skip`、`/reports/{reportId}` | `services/assessment-service/src/main/java/com/englishflow/assessment/web/B10AssessmentJdbcController.java:45-132`、`:416-455`；B25 路由在 `B25AssessmentJdbcController.java:98-186` |
| 默认测评题库 | 本地 `assessment_service.b25_assessment_item_rule` 中 `course-b25-basics` 仅 **VOCABULARY 1、GRAMMAR 1**；没有该课程的 READING/LISTENING 题 | SQL `SELECT content_code,dimension,COUNT(*) ... GROUP BY content_code,dimension`；`database/mysql/seeds/dev/V0023__b25-service-schemas.sql:43-45` |
| 题目内容 | 两题为 “Choose the greeting.” 和 “Choose the correct answer.”；内容种子使用音频占位路径 | `database/mysql/seeds/dev/V0023__b25-service-schemas.sql:30-31` |
| 旧评分与跳过 | B25 以当前题目答对比例映射等级；跳过把用户选的等级保存为 `cefr_level`，同时写 `score=0`。报告响应还输出估计词汇量 | `B25AssessmentJdbcController.java:166-185`、`:193-253`、`:285-315` |
| 版本恢复 | B25 session 只保存 `content_code`；读会话和判分重新查询活动规则，未冻结题单与答案规则版本 | `B25AssessmentJdbcController.java:98-164`、`:252-263`；`V3__create_b25_assessment_runtime.sql:20-42` |
| Web/移动端 | 两端仍请求旧 `/assessment/placement/start` 和 `/submit-step`；移动页显示 `totalSteps` 与 B25 报告分数 | `apps/learner-web/src/api/learner-content.ts:44-46`；`apps/mobile/src/api/learner-content.ts:282-294`；`apps/mobile/src/pages/assessment/assessment.vue:17-18,52-61` |
| 首日任务完成 | learner-service 仅按已验证 owner 找任务并更新为 `COMPLETED`，没有要求 assessment attempt、课程学习项、必需测验或版本化完成规则证据 | `services/learner-service/src/main/java/com/englishflow/learner/web/B25LearnerJdbcController.java:388-408`；设计规则 `docs/06-design/v2-980plus/phase1-business-operation/04-学习机制与学习引擎规则.md` §5.4 |

本地 B25 共有 464 条 session；通用 B10 表有 101 条 session、100 条 attempt、100 条 report。这些数字主要包含合成夹具，且通用 B10 控制器使用固定 `course-b25-basics`/`25001`/占位 snapshot hash 与可由请求选择的 `mode`（`B10AssessmentJdbcController.java:49-121`），不能据此判定 canonical placement 已运行。

`node scripts/runtime/p1r-m4-005-runtime.mjs` 当前输出 `7/7`，脚本实际检查的是契约/源码中的文本片段，生命周期引用 B25 路径，未发 HTTP 请求，也未验证十题四维评分、版本恢复或事件投递。`config/p1r-placement-contract.v1.json:7,45-57` 明确标记 `NOT_RUNTIME_VERIFIED`、`staticContractOnly=true` 和 `NO-GO`；该 7/7 只能作为旧静态检查输出使用。

首次 `mvn -f services/assessment-service/pom.xml test` 在桌面默认临时目录下出现 Java 25 NIO Pipe 的 `Unable to establish loopback connection`，JWT 负向测试因此初始化错误；没有断言失败。随后仅对该测试命令设置 `TEMP/TMP=C:\Temp`（与本地服务运行器的 Windows 设置一致）复跑全套，命令 exit 0，Surefire 汇总 **65 项、0 failure、0 error、2 skipped**。这关闭了测试环境误报，但不改变上面的 Gateway 404、题单与闭环缺口。

## 依赖明确的修复顺序

1. 内容 owner 发布真实可授权的四维题单：词汇 3、基础语法 3、阅读 2、听力 2。听力题需可播放的音频与失败降级；题目、选项和规则版本应成为可回放快照。清理学习者可见的占位题。
2. assessment-service 建立 `P1_PLACEMENT_V1` 持久化模型：服务端取得 learner target 与内容/规则 pin，冻结 session 题单；逐题受保护作答、单调 checkpoint、幂等重放、四维权重评分；首次完成时原子保存 immutable result/report 和安全的 outbox 事实。跳过分支固定 `UNVERIFIED`，自选等级只保留非权威提示。严格遵守既有 OpenAPI/事件契约，不复用 B25 `cefr_level` 报告作为结果。
3. Gateway 增加五条 canonical 路由及服务侧权限检查；Web/移动端使用生成类型调用这些路由，处理恢复、冲突、断网和报告深链。B25 只保留兼容 adapter，并明确迁移策略。
4. learning-service 消费 `assessment.placement.completed.v1` 并按 target/planning-input pin 去重生成唯一 active plan；workflow 负责重试和恢复。learner-service 的首日投影与任务完成入口需要读取 owner 的已确认学习证据，按任务版本规则决定是否完成。
5. 执行 Gateway→assessment→Outbox/Kafka→learning/workflow→两端页面的真实 owner E2E。至少覆盖十题四维、评分边界、漏答与覆盖率、同键重放/异载荷冲突、跨账号隔离、版本更新后同 session 恢复、跳过、计划失败后的报告保持、任务未练习不得完成、移动端断网恢复与内容质量审看。

上述步骤需要多个服务和两端协调。只新增一个前端路由或把 B25 两题扩成十题，仍无法满足版本钉、结果事实、计划事件与任务完成规则；因此本次仅记录证据，没有写入半成品 canonical 实现或重启共享服务。

## 本轮后续修复与验证（源码批次，待统一运行复测）

- B25 兼容跳过分支不再把自选起点写成 `cefr_level` 和零分。assessment owner 的 V7 迁移将既有 `SKIPPED` 记录的伪等级保存为 `requested_starting_level`，测得等级与分数改为 `NULL`；新写入也如此。同一幂等键重放精确读取原 session，不会误取该学员最新的另一份测评。
- 学习 Web 和移动端把 `SKIPPED/UNVERIFIED` 作为单独状态显示。历史两题结果明确标为旧版练习参考，页面不再展示由两题推测的词汇量、词汇掌握或听力表现。Web B2 练习页原来把已归一化到 0..100 的分数再次乘以 100，本批修复；移动端仍接收 owner 0..1 比率并仅在页面乘一次。
- 新增 `P1PlacementScorer` 纯规则实现与测试：仅接纳固定 10 题、四维 `3/3/2/2`；服务端已评分作答才计覆盖；8/10 且四维至少一题为 `MEDIUM`，不足为 `LOW`，零覆盖为 `UNVERIFIED`；只允许 10 题全部作答产生 `ASSESSED`，四维百分比及总分采用契约规定的 `ROUND_HALF_UP`，再映射 A1–C2。这个规则尚未接入 HTTP/持久化/发布事件，不构成 canonical 上线证据。
- `mvn -f services/assessment-service/pom.xml test` 在 `TEMP/TMP=C:\Temp` 下退出码 0；Surefire 汇总 **70 项、0 failure、0 error、2 skipped**。Web/mobile TypeScript 类型检查通过；Web 定级链 3/3、Web 与移动端分数单位行为测试各 2/2。`git diff --check` 通过。独立可运行包在 `C:\Temp\cloudstudy-assessment-p1-20260923-0155\target\assessment-service-0.1.0-SNAPSHOT.jar`，SHA-256 为 `64239F5ACAEDCDAFFE0436AAA0CEA16BC3051CDD63F907061DC69329C86C8C04`，由主任务统一部署；本子任务没有重启共享服务。
- canonical 五条路由继续 **404**。当前 IAM learner 默认权限只有 `assessment.session.read/write`，还没有契约中的 `assessment.placement.session.create/read`、`assessment.placement.response.submit`、`assessment.placement.skip` 与报告读取权限；合格发布的四维十题、真实版本 pin、result/report/outbox、placement→plan Saga 也缺失。故本批没有把旧 B25 直接改名成 canonical 或仅放开 Gateway；十题测评、首日计划仍是 **BLOCKED**。
