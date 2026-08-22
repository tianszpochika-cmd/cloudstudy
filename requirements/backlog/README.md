# Backlog

把经过确认的需求拆成可交付任务。每个任务应关联用户故事、验收标准、影响目录和优先级。

## v2 重基线提示

本目录现有的 14 章、140 个 `DEV-*` 任务和 B0–B6 批次是在 Java 17 + Spring Boot 3 模块化单体基线上形成的，状态和完成记录保留用于历史审计，不作为 v2 新任务的唯一依据。下一轮任务必须依据 [ADR-0009](../../docs/10-decisions/0009-v2-design-baseline-and-task-rebaseline.md)、[ADR-0010](../../docs/10-decisions/0010-java25-microservices-gateway-iam.md)、[v2 设计包](../../docs/06-design/v2-980plus/README.md) 和 [`ARCH-*` 平台能力矩阵](../../docs/02-architecture/v2-platform-capability-matrix.md) 重新设计。

旧任务的“已完成”只表示旧任务自身的代码/静态证据，不等同于 Gateway、IAM/RBAC、服务数据 owner、事件总线或微服务迁移已验收。

## 当前 v2 执行基线

- [v2 B7+ 代码重塑与交互测试任务基线](./v2-B7plus-代码重塑与交互测试任务基线.md)：从 B7 起的 69 项新任务、依赖、服务/数据 owner、四前端宿主、共享国际化/主题 Token、代码层 DoD 和 Phase 2/3 冻结条件；它是 B7+ 的任务与初始状态事实源。

## 旧 B0–B6 历史基线

- [开发实施总纲与功能链条任务分解](./开发实施总纲与功能链条任务分解.md)：14 个开发章节、140 个任务、7 个执行批次，包含功能编号、依赖、交付物和验收证据。
- [Agent 开发状态总报表](./Agent开发状态总报表.md)：旧 B0–B6 任务负责人、状态、证据、阻塞与更新日志的历史状态事实源。
- [Phase 1 范围冻结与跨文档基线](./Phase-1范围冻结与跨文档基线.md)：每日时长、音标 manifest、音频变速、SRS、VOC/ASM 所有权、支付开关和 Phase 隔离。
- [Agent 开发 SOP 与状态流转模板](./Agent开发SOP与状态流转模板.md)：认领、进行中、待验收、完成、阻塞、返工、文件边界、证据和回滚模板。
- [DoD Gate 与证据包规范](./DoD-Gate与证据包规范.md)：ADR、CHANGELOG、五类 Gate、证据包目录和 `check-dod.mjs` 预检规则。

执行规则：

1. B7+ Agent 先在 `v2-B7plus-代码重塑与交互测试任务基线.md` 的对应任务行认领；旧 B0–B6 才使用旧状态总报表。
2. API、事件或数据结构先更新 packages/contracts/ 与数据库迁移，再实现业务。
3. Agent 只能提交“待验收”，由统筹 Agent/评审人依据证据改为“已完成”。
4. 每次状态变化同步追加更新日志，不删除历史记录。
