# PAGE-P1-CHECKPOINT 本地实测边界（2026-09-23）

结果：**PARTIAL_BLOCKED**。正式十题定级和正式 session checkpoint 没有达到可验收状态。`evidence.json` 记录本轮 26 个探针及状态码，`learner-assessment.png` 是新合成成人账号登录后的实际浏览器画面。

## 正式路径

| 路径 | Gateway | assessment owner | 结论 |
| --- | ---: | ---: | --- |
| `POST /api/v1/assessment/placement/sessions` | 503，同键重试仍 503 | 503 | 题源端口为 `UnavailableP1PlacementSourcePort`，没有生成正式十题 session；因此无法验证正式定级的断点、重放、冲突或跨主体读。 |
| `PUT /api/v1/assessment/sessions/{sessionId}/checkpoint` | 404 | 404 | 契约定义了提交前 session 草稿；Gateway 没有该投影，owner 也没有实现该路径。正式 checkpoint 的版本冲突、恢复和受保护草稿持久化不能验收。 |

对应的契约是 `packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json:588-675`；实际 Gateway 只投影 `.../sessions/{sessionId}/attempts/{attemptId}/checkpoint`，owner 也只实现这个旧 attempt 入口。正式定级默认题源在 `services/assessment-service/src/main/java/com/englishflow/assessment/adapter/content/UnavailableP1PlacementSourcePort.java` 明确失败关闭。历史 B25 两题题包不能证明正式十题题源可用。

## 已测的历史兼容路径

两个独立合成成人账号通过 Gateway 完成注册、成人 Gate、三项同意和登录。A 在已有本地 B25 两题规则上创建 B10 练习会话返回 200；同键同请求返回原 session，GET 恢复返回同一 session，B 读取 A 的 session 返回 404。请求不存在的内容版本返回 410，没有伪造题目。**这些仅证明历史本地题包与会话的部分边界。**

同一个 B10 创建键改用不同 `mode` 后曾返回 200 和原 session。这是本轮旧 JAR 的运行态问题；下文记录了随后完成并于 16:57 CST 部署、复测的 owner 修复。

浏览器 `/assessment` 显示 `1/2` 的历史两题练习。截图未见正式四维十题流程；本轮未发现页面脚本错误。

## 清理与复现

运行：`node scripts/runtime/uat-p1-checkpoint-boundary.mjs`。脚本只记录状态码、错误码及会话摘要，不记录密码、JWT 或原始作答。两个本轮合成主体在 12 张 assessment 会话、结果、checkpoint 和幂等表中的残留行均已按精确 principal 核查为 0；活动 IAM 会话均为 0，账号停用并清空角色/权限。IAM 的同意和审计历史按不可逆事实保留。本轮没有重启或打包共享服务。

下一步需要正式十题内容快照与目标 pin 的可用题源、Gateway/owner 的 canonical session checkpoint 实现，以及以新合成主体进行同键重放、异摘要 409、旧版本 409、跨主体拒绝和刷新恢复的端到端复测。

## B10 同键重放的源码修复与运行复测

`services/assessment-service/src/main/java/com/englishflow/assessment/web/B10AssessmentJdbcController.java` 现将新 B10 会话创建请求的规范化 SHA-256 与原始响应存入已有 `assessment_idempotency` 表。同主体同键同请求返回原始响应；同键异请求返回 409。并发重复插入后使用 `FOR SHARE` 读取 claim，避免共享锁升级造成死锁。无需新增或不兼容的 schema migration。

新增 `services/assessment-service/src/test/java/com/englishflow/assessment/web/B10SessionCreationIdempotencyTest.java`。测试在修复前复现“改 mode 仍返回原会话”的失败；修复后覆盖同请求、字段重排、不同 mode/contentVersionId/clientSessionRef/itemIds、跨主体独立创建及并发重放的当前读查询。独立审查复核了共享锁路径。`TEMP=TMP=C:\Temp` 的同一 Maven 进程执行 `mvn -f services/assessment-service/pom.xml test`：18 个 suite、91 项测试、0 failure、0 error、2 skipped，BUILD SUCCESS。测试替身没有验证真实 MySQL 并发锁和事务，因此这部分仍须在集中部署后用真实数据库复测。

旧 V4 会话没有保存原始请求摘要：常规已存 pin/mode/version 的同键重放仍可用；带 `itemIds` 的旧请求被保守拒绝 409，即使可能是原请求；若旧请求曾含 `itemIds` 而重试时省略，旧行也无法证明摘要一致。旧会话的严格同请求语义不能据此宣布验收；已有会话的 GET/后续操作不受此创建入口限制。

16:57 CST 将更新后的 assessment JAR 随本地 16 个服务集中重启。复测见[新一轮证据](../mudvg8nh-1c5e7969/evidence.json)：26 项检查无失败；同键同请求返回 200 且原 sessionId 不变，同键不同 `mode` 返回 409。脚本现将异请求 409 设为断言，两个合成主体的 assessment 残留均为 0、活动 IAM 会话为 0；浏览器仍显示历史两题。真实 MySQL 并发重放、旧 V4 `itemIds` 无摘要行的严格语义尚未验证。正式十题题源和 canonical session checkpoint 的阻断与本项 B10 修复分开判定。
