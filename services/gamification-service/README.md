# gamification-service

B12-GAM-001 的独立 Java 25 / Spring Boot 4.1.1 游戏化事实服务。服务 owner 是
`gamification-service`，只拥有本域的成长事实：XP ledger、coin ledger、等级投影、
按用户时区的 streak、season facts，以及非现金 reward grant/claim。它不拥有学习任务、
评测结果、用户主数据、tenant/role/owner 事实、现金或支付事实。

## 边界

- `/internal/v1/gamification/trusted-events/completions` 只接受已验证
  `learning-service` / `assessment-service` 身份发来的 allowlisted completion event。
  `sourceService`、`eventId`、`traceId`、`schemaVersion`、`occurredAt`、`subject`/`user`、
  `aggregateId`、`ruleVersion` 和 `eventType` 均为必需 envelope；规则计算只在服务端完成。
- 客户端不能提交 XP、coin、delta、role、tenant 或 owner 字段，也不能通过请求头覆盖安全事实。
  用户查询和领取只从已验证 JWT 的 `sub` 派生 owner；默认拒绝，401/403 不会变成空列表。
- event id 与 Idempotency-Key 都做幂等检查。XP/coin ledger 只追加正向服务端结算项，
  每次写入后校验 ledger sum == balance。重复 event 或 reward claim 不会重复记账。
- reward 是免费的非现金学习奖励。claim 前可读取概率版本和完整概率表；服务端决定结果，
  不接入 AI、Phase 2 实时能力、现金随机奖励或支付。
- 当前默认 adapter 是进程内 memory fact-store，用于本地运行和无外部基础设施 smoke；
  durable adapter 应只写本服务独占 schema，不跨服务读写表。

## 运行

目标工具链为 Java 25 和 Maven：

```powershell
$env:GAMIFICATION_SERVICE_PORT = "18094"
$env:GAMIFICATION_RESOURCE_SERVER_ENABLED = "false"
mvn spring-boot:run
```

默认监听 `127.0.0.1:18094`。健康检查为
`GET /actuator/health`、`/actuator/health/liveness` 和 `/actuator/health/readiness`。
业务路径要求真实 IAM JWT Resource Server 配置；resource server 未启用时没有本地
登录、静态 token 或测试管理员绕过。

纯 Java smoke（不需要 Spring、数据库、Kafka 或 IAM 运行态）可在当前 Java 24 工作站运行：

```powershell
$out = 'services/gamification-service/.compile-check'
New-Item -ItemType Directory -Force $out | Out-Null
$files = @(rg --files services/gamification-service/src/main/java |
  Where-Object { $_ -notmatch 'GamificationServiceApplication\.java|[\\/]config[\\/]|[\\/]adapter[\\/]http[\\/]' })
javac --release 24 -encoding UTF-8 -d $out $files
java -cp $out com.englishflow.gamification.GamificationServiceSmoke
```

Smoke 覆盖 trusted completion、事件重复、拒绝客户端数值/安全覆盖、账本守恒、等级、
用户时区 streak、season facts、概率披露、重复 claim 和 feature flag 关闭时的安全 ack。
