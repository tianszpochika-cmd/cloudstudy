# analytics-service

B13-ANL-004 的独立分析 worker 边界。服务只消费 B10/B12 已定义的、脱敏的、版本化集成事件，并在自己的 schema 内维护 receipt、事件 journal、指标 projection 和 recompute job。它不修改领域事实、不读取跨服务表，也不接收客户端提交的 tenant、owner、role 或 metric 事实。

本地默认监听 `127.0.0.1:18083`（固定端口登记名为 `analytics-worker`）；本轮按用户限定只修改本服务目录，未改动仓库级端口登记文件。

## 事件边界

`AnalyticsEventAllowlist` 是唯一事件入口，当前只允许 B10/B12 的 19 个事件：学习/评测、workflow、成长积分、学习社群、通知和榜单刷新事件。订单、支付、原始音频、答案文本、题目文本、自由文本、身份联系方式以及 token/签名等字段会在事件进入 allowlist 之前被拒绝；未知事件和未知字段默认拒绝。

事件必须由受信任的入口提供 `sourceService` 与 `tenantId`，不能从 body 或客户端 header 获取。payload 中如果出现 tenant 标识，必须与入口租户一致。服务保存的 journal 只包含经过 `AnalyticsPrivacyBoundary` 复制和校验的最小聚合字段；不保存 actor identity。

## 可靠性与口径

- receipt 以 `tenant + dedupeKey` 去重，并用 payload hash 检测同键冲突；相同事件重复投递返回 `DUPLICATE_IGNORED`。
- 每个事件映射到固定 `metricId`、维度 allowlist 和 domain metric version，并统一暴露 `analytics.v1` 口径别名。
- projection 的 key 包含 tenant、metric、metric version、日期和受控维度；查询只能使用经过认证的租户范围。
- 查询没有数据时返回 `EMPTY`，存储读写或重算失败时返回 `ERROR`，不会用零值伪装失败。
- recompute/replay 只从 analytics 自有 sanitized journal 重新构建 projection，按租户和日期范围隔离，并保留可替换的持久化 port。

## 代码层入口

- `AnalyticsWorkerService`：严格校验、去重、脱敏 journal 和指标增量投影。
- `AnalyticsQueryPort` / `AnalyticsReplayPort`：为 HTTP、Kafka worker 和后续持久化适配器提供查询与重算 seam。
- `AnalyticsController`：提供受保护的 `/internal/v1/analytics/events`、`/metrics`、`/recompute` 和 `/replay` 边界；JWT 开关默认关闭，接入 IAM JWT 时要求 issuer/JWK 配置。
- `InMemoryAnalyticsProjectionStore`：纯 Java smoke 使用的内存 adapter；生产实现应只替换该 port，不改变领域规则。
- `V1__create_analytics_projection_schema.sql`：仅创建 analytics-owned 表，禁止跨服务 join 或写领域表。

## 验证

在仓库根目录运行纯 Java smoke（需要 JDK 24+；正式 Maven 构建由 Java 25 enforcer 约束）：

```powershell
$out = 'services/analytics-service/.compile-check-b13'
$files = @(rg --files services/analytics-service/src/main/java |
  Where-Object { $_ -notmatch '\\web\\' -and $_ -notmatch '\\security\\' -and
    $_ -notmatch '\\config\\' -and $_ -notmatch 'AnalyticsServiceApplication\.java' })
$files += 'services/analytics-service/tests/smoke/B13AnalyticsSmoke.java'
javac --release 24 -encoding UTF-8 -d $out $files
java -cp $out com.englishflow.analytics.B13AnalyticsSmoke
```

Kafka consumer、真实 MySQL adapter、JWT/JWK、Gateway 路由、OTel exporter 和浏览器/端到端运行验证不在本次代码层 smoke 范围内；它们应在后续集成测试 Gate 中接入，且不得放宽本服务的 allowlist 与隐私边界。
