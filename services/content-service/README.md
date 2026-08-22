# content-service

`content-service` 是语学星 v2 的独立内容事实与发布供应链边界，目标运行时为 Java 25、Spring Boot 4.1.1 和 Spring Framework 7.x。B9 已完成代码层切片：内容定义/版本、版权、双审、发布指针、公开/学习者投影、答案规则隔离、幂等、Outbox 和缓存失效端口均在本服务边界内。

## 本轮实现

- `domain/`：课程、词汇、短语、语法、句子和题目定义的版本化模型；草稿→提交审核→一级审核→二级审核→发布/下线/回滚状态机。
- `application/ContentCommandService`：所有内容事实只通过命令端口写入；发布、下线和回滚同时更新投影、缓存失效事实和 Outbox 事件。Outbox 仅发 B9 登记的 `content.version.*.v1` 与 `content.public_projection.invalidated.v1`，aggregate/schema/version/actor/correlation 使用统一 envelope。
- `application/ContentReadService`：公开/学习者只读投影；草稿不可读，学习者可按已发布 pin 恢复，assessment 才能取得含 opaque answer-rule version 的内部快照。
- `ContentProjectionPolicy`：公开和学习者字段 allow-list + answer/teacher/reviewer/private/copyright evidence deny guard，答案规则正文不进入学习端或官网投影。
- `ContentVersionId` 与 B9 OpenAPI/MySQL `BIGINT` 对齐；投影事件携带服务内递增 `contentEpoch/projectionVersion`，缓存失效事件不代替事实写入。
- `src/main/resources/application.yml` 默认固定端口 `127.0.0.1:18089`；服务独占 Flyway schema、Resource Server/JWKS fail-closed seam、Actuator health/liveness/readiness 和 OTel 配置已登记。

## Admin 与官网边界

- Admin 只经 Gateway 的 `/api/v1/admin/content-commands` 发送意图命令，并读取后台状态投影；不直写内容表。
- 官网只消费 `/api/v1/public/site/projection` 的公开字段；不调用登录后学习、Admin 或 IAM API。
- 真实 controller、MySQL durable repository、Kafka Outbox consumer 和跨进程 Gateway 路由仍属于后续运行态接线，不在 B9 代码层完成声明中冒充已完成。

## 验证

目标环境执行：

```powershell
mvn -f services/content-service/pom.xml test
```

当前仓库环境只有 Java 24 且没有 Maven；本轮已使用 `javac --release 24` 编译纯 Java 主源码并运行 `ContentDomainSmoke`。该结果不能替代 Java 25 + Maven + Spring Boot、MySQL/Kafka 或真实 Gateway 运行态验证。
