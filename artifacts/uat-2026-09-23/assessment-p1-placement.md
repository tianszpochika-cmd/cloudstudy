# Phase 1 canonical placement 五路由阶段验收（2026-09-23）

## 结论

**源码纵切已建立，真实端到端仍 BLOCKED。** 五条 canonical 路由已有 Gateway 精确转发和独立 assessment-service owner；B25 两题兼容入口没有被用作十题定级。当前没有可验证的 learner target pin 与已发布、授权、权益允许的十题 content/answer-rule snapshot 来源，因此默认 `P1PlacementSourcePort` 明确返回 503，创建会话和跳过均在写数据库前停止。本文不把合成题单单元测试写成产品运行 PASS。

本次没有构建发布包、重启共享服务、运行 Flyway 迁移或操作现有账号。之前 Gateway 对 canonical 路由的 404 观察属于旧运行实例；本次更改尚未在实际 Gateway、IAM、assessment 三进程及数据库联调复验。

## 代码与契约

- Gateway `assessment-domain` 添加五条仅精确方法/路径的转发，内部目标为 `/internal/v1/assessment/placement`；同步了 `p1r-gateway-boundary.openapi.json` 的唯一执行投影源。
- assessment-service 新控制器独立于 B25，使用五个精确 `assessment.placement.*` 权限，并再次校验已验证 JWT 的平台 tenant、learner 角色、成人 Gate、必需同意与会话/报告 owner。宽泛 `assessment.session.*` 不替代新权限。
- 新 `V8__create_p1_placement_owner_runtime.sql` 建立独立 session、response、checkpoint、immutable result/report、idempotency 表。创建时固定 `P1_PLACEMENT_V1`、3/3/2/2、25/25/25/25 与 target/content/rule pin。原始候选答案只在请求内用于受保护的规则判分，不写普通响应表或完成事件；响应表保存 digest、正确性、耗时。
- 第十题才冻结结果和报告；`SKIPPED` 保留 null 分数/等级、0 覆盖率、`UNVERIFIED`，自选起点只作非权威提示。结果与完成事件经同一 Spring 事务写入；Outbox 发布链路与真实数据库回滚尚未做运行验证。
- IAM 新 learner 账号登记五项窄权限；`V16__grant_canonical_placement_permissions_to_learners.sql` 为已有 ACTIVE learner 账号补齐这五项。签发时原有成人 Gate/必需同意过滤仍会移除未具备资格的全部 `assessment.*` 权限。迁移尚未运行，撤回后的新令牌行为尚未做实际 HTTP 复测。
- B10 placement OpenAPI 片段补齐明确的 503（题单/持久快照不可用）及响应提交的 404。聚合 `packages/contracts/openapi/v1/openapi.json` 尚待统一合并。

## 路由状态口径

| Canonical 路由 | 新代码成功条件与状态 | 当前可实际验收状态 |
| --- | --- | --- |
| `POST /api/v1/assessment/placement/sessions` | 授权 target/content/rule 十题 pin 可用时 201；缺来源 503、无精确权限 403、缺有效 JWT 401、请求不合法 422、同键异体 409 | 新代码/合成题单测试；真实来源缺失，未部署复测 |
| `GET /api/v1/assessment/placement/sessions/{sessionId}` | 本人会话 200；他人 403、不存在 404、损坏快照 503 | 新代码/合成 owner 测试；无真实会话可读 |
| `POST /api/v1/assessment/placement/sessions/{sessionId}/responses` | 本人按序和版本提交 200；他人 403、不存在 404、过期 checkpoint 或同键异体 409、非法答案 422、损坏规则 503 | 合成十题/恢复/重放测试；真实题单仍缺 |
| `POST /api/v1/assessment/placement/baselines/skip` | 授权 pin 可用时 201 `SKIPPED_UNVERIFIED`；缺来源 503，权限/请求/幂等同上 | 默认来源应在写前 503；未部署复测 |
| `GET /api/v1/assessment/placement/reports/{reportId}` | 本人不可变报告 200；他人 403、不存在 404、损坏报告 503 | 合成 owner 测试；无真实报告可读 |

上表为**新代码语义**，不是当前运行实例的逐路由 HTTP 结果。若 assessment persistence 未启用或 `V8` 未迁移，新控制器不会形成可运行入口，不能据此期待 503。

## 验证结果

- `mvn -q -f services/assessment-service/pom.xml '-Dtest=P1PlacementJdbcControllerFlowTest,P1PlacementJdbcControllerSafetyTest,P1PlacementSourcePortTest,P1PlacementScorerTest' test`：全部通过（合成来源和内存 JDBC 桩，不代表真实 MySQL 或跨服务题单）。
- `mvn -q -f services/iam-service/pom.xml -Dtest=IamJwtAuthenticationTest test`：通过。
- `mvn -q -f services/api-gateway/pom.xml -Dtest=GatewayRoutePolicyContractParityTest test` 与 `GatewayPathProjectionProcessTest`、`CanonicalRoutePolicyRouteLocatorIntegrationTest`：通过；五条新路由在进程级转发测试中到达预期 assessment 内部路径。
- 三模块 `mvn ... -DskipTests compile`：通过；两个契约片段可解析为 JSON；`git diff --check` 无空白错误。
- `pnpm contracts:merge:check`：聚合 OpenAPI 尚未合并，预期失败。`pnpm contracts:validate`：首个既有阻断为 admin recovery compensate 缺 `x-idempotency`，与本纵切无关，未宣称全量契约通过。

## 后续必须具备的 owner 事实与运行证据

1. learner-service 提供同一已激活目标的 `targetId/targetVersion/targetSnapshotDigest`，且 `targetVersion` 与 B9 的 `stateVersion` 等价；当前没有由 assessment 实际消费的受保护 target pin 适配器。
2. content-service 提供已发布且版权、权益、Phase 1 资格全部确认的固定十题评测快照，包含 learner-safe 题面与仅供 assessment 评分的 sealed answer rules、content epoch/snapshot hash/rule digest。现有 B10 单题 snapshot 契约与目标十题授权清单尚未形成已验证的 owner 读取链；不能从 B25 两题或客户端自报得分推导。
3. 在上述 owner 契约稳定后实现真实 `P1PlacementSourcePort`，带服务身份和 PEP、缺/脏 pin 失败关闭。随后统一运行 IAM `V16`、assessment `V8` 迁移，构建/重启三进程并用合成成人账号经 Gateway 验证 201→10×200→恢复/报告 200、skip 201、401/403/404/409/422/503、幂等、Outbox 只发一次与数据库回滚。账号与数据须精确清理。
4. 完成事件下游 learning-service planning input、Kafka consumer、重放去重和 Saga 仍属独立运行门禁；本次只验证 assessment owner 的 Outbox 写调用与安全 payload 形状。

当前没有需要产品方立即决策的选项；需要各 owner 补齐已冻结的正式事实和运行集成。
