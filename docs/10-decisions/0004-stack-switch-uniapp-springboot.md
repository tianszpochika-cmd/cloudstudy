# ADR-0004：采用 Vue 3 + uni-app + Spring Boot 3 作为产品主线

> **历史决策说明**：本 ADR 仅保留 Vue 3/uni-app 的选型来源和 `core-api` 迁移背景。当前四前端项目边界以 [ADR-0008](0008-four-frontend-projects-and-platform-targets.md) 为准；Java 25 微服务、Kafka/Outbox/AsyncAPI 事件平台和 `core-api` 的兼容边界以 [ADR-0010](0010-java25-microservices-gateway-iam.md) 为准。

## 状态

superseded（当前前端项目矩阵见 [ADR-0008](0008-four-frontend-projects-and-platform-targets.md)，当前后端与事件平台见 [ADR-0010](0010-java25-microservices-gateway-iam.md)）

## 原始决策记录（历史，非当前规范）

以下内容保留用于审计旧实现来源，不能作为新任务、契约、基础设施或运行时的依据。

项目采用以下主线：

1. 学习端使用 Vue 3 + TypeScript + uni-app，统一输出 Web、H5、iOS、Android、iPad 和后续微信小程序。
2. 管理后台使用 Vue 3 + Vite + Element Plus。
3. 核心业务后端使用 Java 17 + Spring Boot 3 模块化单体。
4. 当时的异步任务曾使用 RabbitMQ 或 Redis Streams；这不是 v2 规则。
5. Windows 使用 Web + PWA；只有确需系统能力时才评估原生壳。

## 原因

- 团队技能与国内多端商用交付要求匹配。
- 条件编译可以最大化复用学习业务、状态、设计令牌与埋点。
- Spring 生态适合账号、权限、内容审核、支付、订单、通知和运营后台等商业基础设施。
- 早期使用模块化单体可减少部署和运维复杂度。

## 约束

- OpenAPI 是前后端契约唯一事实源，生成 Java DTO 和 TypeScript 类型。
- 重型视觉能力通过 H5/App 端增强，小程序必须准备 2D 或静态降级。
- 任何更换前端、后端或跨端主线的提议都必须新增 ADR。
