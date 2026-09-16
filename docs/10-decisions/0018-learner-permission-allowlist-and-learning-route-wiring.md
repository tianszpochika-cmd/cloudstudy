# ADR-0018：学习者权限 allow-list 补齐与学习域 v2 路由接线（P1-LIVE-002）

- 状态：已接受（人类负责人全权委托执行，2026-09-16）
- 日期：2026-09-16
- 相关任务：`P1R-M2-002`（签发权限集）、`P1R-M2-003`（领域 PEP）、`P1R-M4-004/008`（目标与首日）、`P1R-M2-001`（网关执行表）
- 缺陷：P1-LIVE-002（本地全栈活链路 W1 实测发现，一组三项）
- 合约事实源：`packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json`（`today` 已有）、服务侧 `authorize(...)` 调用点
- 关联决策：[ADR-0017](0017-access-token-eligibility-claims.md)（签发侧资格 claims）

## 背景

ADR-0017 修复后 W0 11/11，但 W1（目标→定级→计划→今日）7/10，三项失败各不相同，全部是"代码写了、链路没接通"的同一物种：

| # | 现象 | 根因 | 证据 |
|---|---|---|---|
| 1 | `PUT /learner/targets` 400→（修 body 后）403 `PERMISSION_DENIED`；`GET /learner/first-day` 403 | IAM `LEARNER_PERMISSIONS` 在 v2 端点出现前冻结，缺 `learner.goal.write` / `learner.preference.write` / `learner.onboarding.read`，而 `LearnerPrincipalContext:40-44` 与 `DefaultLearnerProfile{Query,Command}Service` 明确要求它们 | 活 403 + 域代码 |
| 2 | `GET /api/v1/learning/today` 网关 404 "route not available" | M4-008 的 `V2LearningController`（09-16 新增）从未配网关执行项；网关允许表封闭，缺席即 fail-closed 撤下 | 活 404（网关信封） |
| 3 | 直连 `learning-service` 同样 404 | 运行中的 jar（09-12 构建）根本不含该控制器。全仓扫描：8 个服务的源码比 jar 新，M3–M7 的 DEV_DONE 轮次改了代码没重建 | jar 内容清单 + 时间戳比对 |

## 决策

1. IAM `LEARNER_PERMISSIONS` 补 10 项（3 learner + 7 learning），每一项都有服务侧 `authorize(...)` 调用点为证；`tokenAccount` 的门前剥离规则不变（learning/assessment/content 前缀），同意门仍先于权限检查。
2. 网关 `learning-domain` 加 `today-v2` preserve 执行（`LEARNING_V2` 证据），契约/网关/Java 三处一致 + 冻结计数与摘要重算（`153/170/195`、`FROZEN_…`、`M2001_*`）。
3. `learning-service /api/v1/learning/first-day` **不**进网关与 D2 契约：M1-013 规则模型的 `canonicalRoutes` 是哈希钉死的规则作者冻结物，午夜 E2E 轮次不替规则作者改规则。W1 首日投影走已覆盖的 `learner-service /api/v1/learner/first-day`（同源事实）；缺口记入 `knownGaps`，待规则评审。
4. 8 个过期 jar 全量重建（`mvn -o package`，含各自单测），重启全栈后以活链路为准。

## 有意不做的事
- 不重命名权限词汇：契约片段（`learner.target.write`）与代码（`learner.goal.write`）存在命名漂移，但改名涉及 11 服务已验收安全行为，本轮只记录缺口（P1-LIVE-003），以活链路走代码侧为准。
- 不碰 media 词汇（`media:read` vs `media.asset.read`）：W2 到达媒体链时再实测 slender 定。
- 不扩展 M2-001 三描述符：新增的 `M2001_APPROVED_ADDITIVE_NODES` 只覆盖 P1-LIVE-001 两项；first-day 条目已随决策 3 回退删除。

## 后果

- W1 目标：`targets` 200、`learner/first-day` 200（权限修复已活验证）、`learning/today` 200（待重启后复验）。
- 冻结绑定全部重算且测试钉死：网关契约 38/38、learning-loop PASS、contract-tooling 63/63（待本轮收尾复验）。

## 追补（同轮活链路继续发现的两项，同一批落地）

### P1-LIVE-004：网关签发的 `X-Request-Id` 与全平台字母开头惯例冲突

- 现象：`PUT /learner/targets` 间歇 400 `INVALID_CONTEXT`，与 UUID 首字符是否为数字强相关（约 62% 失败率）。
- 根因：网关 `CorrelationIds.requestId` 回退值为裸 UUID，而 learner/learning/content/core-api 全平台要求字母开头。网关是唯一的例外方。
- 修复：回退值改为 `req-<32hex>`；`CorrelationIdsTest` 加 25 采样回归。
- 验证：网关套件 94/0/0；W1 targets 连续成功（此前从未成功过一次）。

### P1-LIVE-005：learner outbox 写侧停留在旧 12 列，`event_name`/`payload_json` 缺失导致每次提交回滚

- 现象：修复 P1-LIVE-004 后 targets 稳定 503；MySQL general log 显示 ROLLBACK 紧跟 `INSERT INTO learner_outbox_event`。
- 根因：E2 形状标准化加了非空无 default 列，content/notification/learning/admin-ops 写侧都跟进了，只有 learner 没跟。
- 修复：补两列；全仓复核其余 5 家均为新形状。
- 验证：learner 套件 49/0/0；W1 9/9 双绿（`targetId` 递增证明持久化）。
