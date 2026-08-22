# 跨阶段通用底层核心模块与技术规范

> 本文按 v2 技术路线编写：Vue 3 四项目 + Java 25/Spring Boot 4.1 微服务 + Gateway/IAM/RBAC + MySQL 8.x + Redis 7.x。Phase 1 优先实现规则化学习底座，Phase 2 再接入 AI；旧 `core-api` 仅作迁移兼容。

## 1. 自适应记忆复习引擎

### 1.1 目标

统一管理单词、短语、句型、语法点和错题的复习状态，支持 SM-2 或 FSRS 可配置实现。

### 1.2 核心字段

- learning_item_id
- item_type
- repetition_count
- ease_factor
- interval_days
- stability
- last_reviewed_at
- next_review_due
- source_type
- source_id

### 1.3 规则要求

- 答题质量、响应时间、连续错误和历史遗忘风险参与调度。
- 错题必须回到复习队列，记录来源和触发原因。
- 调度结果可解释、可回放、可重新计算。
- `learning-service` 负责持久化和业务调度；前端只展示结果，不复制算法事实。迁移期间由 `core-api` 兼容承载，但不得成为 v2 新 owner。

## 2. 内容与学习对象模型

统一对象：

- WORD：单词
- PHRASE：短语和搭配
- SENTENCE：句型和表达
- GRAMMAR：语法点
- LISTENING：听力材料
- READING：阅读材料
- WRITING：写作任务
- EXERCISE：练习题
- SCENARIO：场景课程

每个对象必须有：版本、难度、能力标签、内容来源、版权状态、审核状态、发布时间和下线时间。

## 3. 规则化能力与报告

Phase 1 只使用确定性规则：

- 正确率、耗时、完成率和连续错误。
- 词汇掌握度、语法掌握度、听力完成度和阅读表现。
- 阶段报告必须说明数据范围、计算口径和局限性。
- 不宣称官方考试成绩、官方 CEFR 认证或专业诊断。

## 4. 数据与服务边界

- v2 服务：`iam-service`、`learner-service`、`content-service`、`learning-service`、`assessment-service`、`commerce-service` 等按 bounded context 各自拥有事实；Gateway 负责外部入口，`core-api` 仅作迁移兼容。
- MySQL 8.x：唯一关系事实源；Flyway 管理迁移。
- Redis 7.x：会话、排行榜、分布式锁、短期缓存和队列辅助。
- OSS/CDN：音频、视频、图片和离线课程包。
- OpenAPI/AsyncAPI/JSON Schema：前后端和服务间契约单一事实源，生成 Java DTO、TypeScript 类型和事件校验器；跨服务使用 Outbox/幂等消费者，不共享写表。

## 5. Phase 2 AI 插槽

- Python FastAPI 作为独立 AI 编排服务。
- 每项 AI 能力定义 prompt_version、输入/输出 schema、超时、重试、降级和审计字段。
- AI 反馈不能覆盖原始答案，不能直接决定付费、封禁或等级变更。
- 向量检索由 Phase 2 单独评估并新增 ADR。

## 6. 性能与跨端

- 页面和动效由 AdaptivePerformanceEngine 控制 Ultra / High / Medium / Performance 四档。
- Performance 档使用静态图片、SVG、文本反馈和轻量音频。
- H5/App 可使用 Three.js、Rive、Wavesurfer；小程序必须有 2D 降级。
- 所有核心学习任务支持弱网恢复、幂等提交和离线数据安全清理。
