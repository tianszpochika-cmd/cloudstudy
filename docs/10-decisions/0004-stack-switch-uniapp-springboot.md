# ADR-0004：采用 Vue 3 + uni-app + Spring Boot 3 作为产品主线

> **历史决策说明**：前端四项目和跨端边界继续有效；Java 17/Spring Boot 3 的新后端主线已由 ADR-0010 取代，旧版本只作为 `core-api` 迁移兼容运行时。

## 状态

superseded（后端部分由 ADR-0010 取代；前端部分保留）

## 决策

项目采用以下主线：

1. 学习端使用 Vue 3 + TypeScript + uni-app，统一输出 Web、H5、iOS、Android、iPad 和后续微信小程序。
2. 管理后台使用 Vue 3 + Vite + Element Plus。
3. 核心业务后端使用 Java 17 + Spring Boot 3 模块化单体。
4. 异步任务使用 RabbitMQ 或 Redis Streams。
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
