# B3 学员 360° 与排期执行交付

> 日期：2026-09-21。方向见 [单租户直营 README](README.md) §7（B3）。
> 状态：实现 + 契约 + 网关接线 + 单测 + 管理前端完成；真实 DB/网关/浏览器运行与 P1R 验收未做，不改变任何 P1R 任务状态。

## 1. 做了什么

- **学员 360°（读 + 受控写）**：
  - `learner-service`：`LearnerAdminController`（`/internal/v1/learner/admin`：search/profile/commands），`LearnerAdminService`（目标/偏好代管，走同一幂等+版本+Outbox 语义并打 admin 审计标记），`LearnerProfileStore.search`（JDBC/Memory/FailClosed），`PROFILE_NOT_FOUND→404`。
  - `learning-service`：`LearningAdminController`（plans/srs 读 + `RESET_SRS_ITEM`：SM2 一致的初始态重置，幂等键重放）。
  - `assessment-service`：`AssessmentAdminController`（sessions/reports/mistakes 摘要；答案/证据原文永不过界；只读）。
  - 全部要求租户管理 JWT（`platform-admin`/`tenant-admin` 角色或 `admin.<domain>.read/write` 权限），目标 subject 只取路径。
- **网关接线（7 条真实路由）**：6 条学员 360 + `admin-content-publish-tasks` 翻转（B2 已备好的 owner 端点）。Java `GatewayRoutePolicy` 硬编码规则表、`GatewayRouteExecutionPolicy` 绑定与 evidence、`p1r-gateway-boundary` fragment 三方一致，`GatewayRoutePolicyContractParityTest 4/4` 通过。另修复 `EXACT` 模板段匹配（此前无带变量 EXACT 规则，属 latent 缺陷；存量行为零变化）。
- **PACK 定时执行**：执行器解析最新 APPROVED 包版本并发布，pin 过期则任务 FAILED；`cohort` 灰度标签落 V18（任务 + 回执 + 契约 + UI），学员侧强制留给 B4（契约明写）。
- **管理前端**：`/learners` 360° 页（检索→画像/计划/SRS/测评四 tab，目标/偏好代管，SRS 重置）；排期面板加 cohort 输入与灰度列。
- **验证**：gateway 94/94；content 161+/schedule 4；learner 全套；learning/assessment 全套；admin-web 类型+构建；契约门禁 21 条（7 个新操作零新增）；网关 22 条（见 §2）；`diff --check` + `stale-claims` PASS。

## 2. 网关重冻包（待独立复核，禁止自行改门禁数字）

本次有意变更冻结基线，全部有真实实现对应，需独立方复核后重冻（不得直接改 `EXPECTED_*` 消警）：

| 断言 | 变化 | 实现对应 |
|---|---|---|
| routeRule / execution plan count 56 | 63（+6 学员 360 EXACT 规则） | 三服务真实控制器 + Java 绑定 + fragment 投影，parity 测试全绿 |
| available execution operations 170→202 | +7 投影可用（含 publish-tasks 翻转） | 同上 |
| public operations 365→393 | +7 新操作 | 新契约 fragment，门禁合规 |
| target plan digest | 漂移 | 同上 |
| publish-tasks unavailable reason | 旧理由已 stale（映射真实存在） | B2 owner 端点 + 本次绑定，`FAIL_CLOSED_REASONS` 旧条目已删 |

## 3. 未做（B4）

- 灰度学员侧强制（cohort 在读取链路生效）、SRS/掌握度深干预、客服/商业/通知的学员级代操作、真实运行验收、P1R 状态变更。
