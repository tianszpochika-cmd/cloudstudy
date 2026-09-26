# Batch22 社交举报接口契约冲突（2026-09-25）

## 已核实事实

- canonical OpenAPI 的 `POST /api/v1/social/rooms/{roomId}/reports` 指向 `M1014ReportCommand`，必填 `targetType`、`targetRef`、`reasonCode`；响应指向 `M1014Report`，并声明 `social.report.create.self` 与 `principal-room-report-key` 幂等策略。其原因枚举包含 `INAPPROPRIATE_BEHAVIOR`、`SAFETY`，与 B12 的 `SENSITIVE_CONTENT`、`OTHER` 也不一致（`packages/contracts/openapi/v1/openapi.json`）。
- 同一 B12 fragment 虽仍保留 `B12ReportCommand`（`targetSeatIndex`、`reasonCode`、`clientEventId`）和 `B12Report` 定义，但**该 active 路径已指向 M1014 请求与响应**；这些 B12 schema 不能再当作该路径的正式契约。移动 H5 与 social-service 的现有房间举报实现却仍使用旧 B12 形状（`packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json`、`apps/mobile/src/api/b12.ts`、`services/social-service/src/main/java/com/englishflow/social/web/SocialLocalRealController.java`）。
- social-service 的 `local-real` 实现此前没有兑现该路径的 `Idempotency-Key` 重放与完整回执；Batch22 正在做针对性运行时修复。此修复保持已存在的 B12 路径语义，**不等于** canonical `M1014` 模型已经落地。

## 验收影响与后续处理

当前无法把房间举报计为满足 canonical API 契约的 PAGE-P1 全功能 PASS。M1014 的 leaderboard entry 目前未提供可供举报的安全 `targetRef`；客户端不能从排名或座位号自行推导。后续以冻结的 M1014 模型为目标，先明确可举报对象引用、理由枚举和不同幂等键重复举报的业务规则，再视需要走 successor 契约门禁，随后同步客户端、两个服务 profile、生成类型、权限、持久化、事件和端到端测试。M1014 的 active operation、组件及投影摘要受 `scripts/contracts/compatibility-diff.mjs` 与 `tests/p1r/p1r-contract-tooling.test.mjs` 冻结检查约束。迁移前，Batch22 只对现有 B12 运行时做防重复与回执真实性修复；保留这一契约 GAP，不改写冻结的 canonical schema，也不据此声称举报业务链完整验收。
