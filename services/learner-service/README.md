# learner-service

`learner-service` 是语学星 v2 的独立学习者领域边界，目标运行时为 Java 25、Spring Boot 4.1.1 和 Spring Framework 7.x。B9 已完成代码层切片：档案、目标、偏好、首日投影、幂等写入、Outbox 事实和旧 `core-api` 只读影子适配均不共享 `core-api` 的 ORM 或表写权限。

## 本轮实现

- `domain/`：Phase 1 成人学习者档案、目标、每日投入、偏好、首日投影、状态版本、tenant/owner 和默认拒绝授权事实。
- `application/`：profile/goal/preferences 的命令与查询端口；写请求使用期望状态版本和幂等键，事实提交与 Outbox 事件由 `LearnerProfileStore` 原子端口承载。Outbox 事件使用 B9 登记的 profile/target event name、server-generated target id、`learner.event.v1` envelope 和强制 request/trace correlation。
- `adapter/shadow/`：旧用户资料只读映射；没有向 `core-api` 回写，也不会把 legacy shadow 当作新的领域事实。
- `src/main/resources/db/migration/V1__create_learner_service_schema.sql`：服务独占 schema 的 Flyway 基线，含 profile/goal/preferences/first-day/idempotency/outbox 表。
- 默认固定端口 `127.0.0.1:18088`，Actuator health/liveness/readiness、优雅停机和 W3C/OTel 配置已登记。

## 安全与阶段边界

- 请求必须来自已验证的 IAM principal；tenant、owner、role、permission 和 consent 不接受客户端覆盖。
- Resource Server/JWKS 配置默认关闭并 fail-closed，真实 G-IDP、issuer、JWKS、PDP/PEP 和 durable adapter 通过后才可启用。
- 当前没有把 Spring HTTP controller、MySQL repository 或 Kafka consumer 误报为完成；本轮交付的是可编译的领域/应用代码、契约和测试边界。

## 验证

目标环境执行：

```powershell
mvn -f services/learner-service/pom.xml test
```

当前仓库环境只有 Java 24 且没有 Maven，因此本轮使用 `javac --release 24` 编译纯 Java 领域/应用主源码；这不能替代 Java 25 + Maven + Spring Boot 运行态验证。
