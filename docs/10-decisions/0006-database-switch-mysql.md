# ADR-0006：关系型数据库主线切换为 MySQL 8.x（遵循 PRD v3.2 §1.1）

## 状态

accepted（supersedes 原 PostgreSQL 16 + pgvector 口径，见 ADR-0001/0004 时期文档）

## 背景

PRD v3.2（用户复核版，需求唯一事实源）§1.1 明确技术主线数据层为 **MySQL + Redis**，且容量目标仅 1 万注册 / 1,000–2,000 DAU、单机起步、低成本优先。此前架构文档沿用的是 PostgreSQL 16 + pgvector 口径，与 PRD 冲突。经确认，架构文档按 PRD 字面口径更新。

## 决策

1. **关系型主库**：MySQL 8.x（utf8mb4 / utf8mb4_unicode_ci），ORM 用 MyBatis-Plus，迁移用 Flyway。
2. **缓存**：Redis 7.x 不变（排行榜 ZSet、打卡 BitMap、分布式锁、会话）。
3. **向量检索（Phase 2 预留）**：PRD 同时提到"Phase 2 按需加入 pgvector/向量检索"，pgvector 为 PostgreSQL 专属扩展、与 MySQL 主线不兼容；本决策将向量检索定义为 **Phase 2 独立组件选型问题**（候选：专用向量数据库 / 云厂商向量检索服务 / 独立 PostgreSQL 实例仅承载向量库），届时另记 ADR，Phase 1 不引入。
4. **目录与工程**：`database/postgres/` 改造为 `database/mysql/`，迁移脚本改写为 MySQL 方言；`infra/docker/docker-compose.dev.yml` 切换为 mysql:8.0。

## 代价与接受

- 放弃 PostgreSQL 的行级安全（RLS）与 JSONB 富查询：行级权限改用应用层权限模块实现，JSON 字段使用 MySQL JSON 类型（功能够用、索引能力略弱，可接受）。
- Phase 2 若向量检索需要 pgvector 生态，需额外维护一个 PostgreSQL 实例或改选其他向量组件，成本在 Phase 2 预算内评估。
- 现有 `database/postgres/` 下的迁移与种子脚本需要一次性改写（工作量小，未上生产无历史包袱）。

## 回滚触发条件

出现 MySQL 无法承载的硬性需求（如大规模向量检索与关系查询深度耦合、强 RLS 合规要求），且改写成本低于迁移成本时，可评估切回 PostgreSQL，需新增 ADR。
