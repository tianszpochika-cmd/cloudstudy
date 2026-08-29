# Backlog

把经过确认的需求拆成可交付任务。每个任务应关联用户故事、验收标准、影响目录和优先级。

> **文档分类：当前执行索引**。[Phase 1 开发计划重基线](./v2-phase1-rebaseline/README.md) 是当前唯一新开发入口；B0–B36、`DEV-*` 和 G0–G4 只保留实现/迁移/运行候选证据与历史状态。所有 `P1R-*` 任务仍须引用 v2-980plus、业务运行 ID 与 `ARCH-*`，不能把 980 范围登记或旧静态结果当作完成。

## 当前 Phase 1 执行计划

- [Phase 1 开发计划重基线](./v2-phase1-rebaseline/README.md)：9 个里程碑、108 个 `P1R-*` 任务；包含现状复用策略、依赖图、编号台账、D2–D5 验收/Evidence 标准和全量追溯覆盖矩阵。
- [DoD Gate 与证据包规范](./DoD-Gate与证据包规范.md)：通用 G0–G4 与证据包要求；新计划的更具体成熟度和里程碑 Gate 见 `v2-phase1-rebaseline/03-阶段验收与Evidence标准.md`。

新任务只在 `v2-phase1-rebaseline/02-编号任务台账.md` 认领。初始 108 项全部是 `PLANNED`；旧状态不得自动迁移为 `READY/ACCEPTED`。

## 重基线原则

本目录现有的 14 章、140 个 `DEV-*` 任务和 B0–B36 批次是在旧执行阶段形成的，状态和完成记录保留用于历史审计与资产盘点。新的计划已经依据 [ADR-0009](../../docs/10-decisions/0009-v2-design-baseline-and-task-rebaseline.md)、[ADR-0010](../../docs/10-decisions/0010-java25-microservices-gateway-iam.md)、[v2 设计包](../../docs/06-design/v2-980plus/README.md)、[Phase 1 业务运行设计](../../docs/06-design/v2-980plus/phase1-business-operation/README.md)和 [`ARCH-*` 平台能力矩阵](../../docs/02-architecture/v2-platform-capability-matrix.md)重建为 `P1R-*`。

旧任务的“已完成”只表示旧任务自身的代码/静态证据，不等同于 Gateway、IAM/RBAC、服务数据 owner、事件总线或微服务迁移已验收。

## 历史实现与运行候选（Historical Candidate）

- [v2 B7+ 代码重塑与交互测试任务基线](./v2-B7plus-代码重塑与交互测试任务基线.md)：B7–B22 共 103 项任务；B7–B14 是代码层重塑，B15–B22 是 Phase 1 运行态、测试、发布与上线的静态基础。
- [v2 B23+ Phase 1 登录、真实数据与测试任务基线](./v2-B23plus-Phase1-真实运行与实机测试任务基线.md)：重新设计 B23–B27 共 32 项任务，先完成“自有 IAM 账号密码 + JWT Bearer Access Token + JWKS + IAM 会话”的认证闭环、H5/Web 全局登录门禁和本地 MySQL 真实学习数据，再执行 Kafka/Outbox、浏览器/H5 正式测试、真机、RC 和测试交接；B23–B27 不新增 Phase 2/3 业务。
- [v2 B28+ Phase 1 本机真实全栈与 MCP 浏览器验收任务基线](./v2-B28plus-Phase1-本机真实全栈与MCP浏览器验收任务基线.md)：B28–B36 共 45 项新增任务，只收口本机 Web/H5 目标；依次完成基础设施、14 后端进程、自有 JWT/JWKS、MySQL/API、Kafka/Redis、四前端联调、Codex Browser MCP 真浏览器测试、异常回归和本机交接。
- 历史执行快照（截至 2026-08-28）：B15–B33 留有代码、静态、本机基础设施、API/DB/Kafka/Redis 和四端构建候选证据，但完整 Browser 认证旅程及 B34–B36 未闭合，交接为 `LOCAL-TEST-NO-PASS`；这些结论只供 `P1R-*` 复用审计，不代表当前任务完成。
- G0–G4 旧基线覆盖范围、契约数据、实现交互、测试安全观测和发布回滚，但静态通过不替代 `P1R-*` 的 D2–D5 证据；详见 [`G0-G4-治理门禁任务基线.md`](./G0-G4-治理门禁任务基线.md)。

## 旧 B0–B6 历史基线（Historical / Superseded）

- [开发实施总纲与功能链条任务分解](./开发实施总纲与功能链条任务分解.md)：14 个开发章节、140 个任务、7 个执行批次，包含功能编号、依赖、交付物和验收证据。
- [Agent 开发状态总报表](./Agent开发状态总报表.md)：旧 B0–B6 任务负责人、状态、证据、阻塞与更新日志的历史状态事实源。
- [Phase 1 范围冻结与跨文档基线](./Phase-1范围冻结与跨文档基线.md)：每日时长、音标 manifest、音频变速、SRS、VOC/ASM 所有权、支付开关和 Phase 隔离。
- [Agent 开发 SOP 与状态流转模板](./Agent开发SOP与状态流转模板.md)：认领、进行中、待验收、完成、阻塞、返工、文件边界、证据和回滚模板。

上述历史文件中的“六大游戏”、旧 `uni-app` 项目假设、旧批次状态和旧技术栈只用于回放/迁移核对；当前四项目、学习游戏分期、认证、事件和支付口径见当前权威需求与 v2 执行基线，不得把历史动作直接认领或复制。

执行规则：

1. 新开发只在 `v2-phase1-rebaseline/02-编号任务台账.md` 的 `P1R-*` 行认领；旧 B/DEV/G 台账不得继续接收新开发状态。
2. API、事件或数据结构先更新 packages/contracts/ 与数据库迁移，再实现业务。
3. Agent 只能提交“待验收”，由统筹 Agent/评审人依据证据改为“已完成”。
4. 每次状态变化同步追加更新日志，不删除历史记录。
