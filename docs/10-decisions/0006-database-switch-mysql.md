# ADR-0006：采用 MySQL 8.x + Redis 7.x 作为数据主线

## 状态

accepted

## 决策

1. 关系主库使用 MySQL 8.x，字符集 utf8mb4，ORM 使用 MyBatis-Plus，迁移使用 Flyway。
2. Redis 7.x 用于会话、排行榜、打卡、锁、短期缓存和辅助消息能力。
3. Phase 1 不引入向量检索组件。
4. Phase 2 若需要向量检索，单独评估专用向量服务或独立检索组件，并新增 ADR。
5. 数据目录、容器编排、迁移和种子统一使用 MySQL 口径。

## 原因

- PRD v3.3 明确 MySQL + Redis 为数据基线。
- Phase 1 容量目标为 1 万注册、1,000-2,000 DAU，单机起步、低成本和成熟运维优先。
- MySQL 与 Spring Boot、MyBatis-Plus、Flyway 的集成稳定，适合学习记录、内容、权益、订单和审计数据。

## 约束

- Redis 不承担唯一事实数据。
- 行级权限、审计和数据隔离由应用层权限模块与审计日志实现。
- 数据库替换、向量组件引入或跨库同步必须新增 ADR。

