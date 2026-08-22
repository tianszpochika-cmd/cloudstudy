# API 约定

> v2 入口：所有外部业务 API 经 `services/api-gateway`；领域服务仍需独立验签和执行 PEP。目标服务、版本和事件边界见 [v2 微服务架构](../02-architecture/v2-microservices-architecture.md)。旧 `core-api` 路由只作迁移兼容。

## 通用规则

- 外部 API 版本从 `/api/v1` 开始，内部 REST 使用 `/internal/v1` 或 gRPC；破坏性变更升级版本。
- JSON 字段使用 camelCase；数据库字段可使用 snake_case。
- 所有请求返回 requestId，错误返回稳定的 errorCode 和用户可理解的 message。
- 写操作支持幂等键；分页使用 cursor 优先。
- 服务端必须校验输入、用户身份、资源归属和操作权限。
- Gateway 负责边界路由、限流、requestId/traceId 和 JWT 预校验；服务端必须再次验证 tenant、owner、phase、contentRights 和业务状态。正常热路径使用已验证 JWT、资源本地事实和版本化策略包/短时安全缓存；高风险或动态策略才调用受控 PDP，PDP 异常/策略过期一律 fail closed。
- 不接受客户端角色、tenantId、ownerId 或权限头作为授权事实；401/403 不能伪装为空数据。

## 领域边界

- iam-service：标准 OIDC IdP 集成、principal 映射、用户/租户/会话/设备、RBAC/ABAC 策略；不自研协议/Token 服务器。
- learner-service：目标、学习档案、偏好和 Onboarding。
- content-service：已发布课程、版权、内容版本、题目/练习定义和答案规则版本；media-service：媒体元数据、转码和短期授权 URL。
- learning-service：学习计划、SRS、复习队列、进度和 mastery_projection。
- assessment-service：测评会话、练习提交、草稿/checkpoint、规则判分和报告快照；使用 content 的版本化题目快照。
- commerce-service：订阅、订单、权益、支付回调和对账。
- admin-ops-service：运营后台聚合、审批编排和审计关联，不复制领域事实。

## 事件

事件名称使用 domain.action.vN，payload 必须有 schema/schemaVersion、occurredAt、eventId、actorId、tenantId、requestId、traceId 和聚合分区键。只把跨服务集成事实写入 Outbox/事件总线；UI 点击、日志、指标和 RPC 不得进入。投递至少一次，消费者要去重、可重试、进 DLQ 并可重放；payload 不得包含原始音频、Token、支付凭证或答案密钥。
