# 系统架构

本目录保存系统级架构、服务边界、数据与事件主线、安全边界和本地开发约定。技术选型或服务边界变更必须走 [ADR](../10-decisions/README.md) 闭环，不得静默修改。

## 文档清单

- [system-overview.md](system-overview.md)：系统总体概览。
- [system-technical-architecture.md](system-technical-architecture.md)：技术架构全貌。
- [v2-microservices-architecture.md](v2-microservices-architecture.md)：**v2 微服务目标架构**，定义各服务边界与数据 owner，是 Phase 1 的技术入口。
- [v2-platform-capability-matrix.md](v2-platform-capability-matrix.md)：v2 平台能力矩阵。
- [stack-recommendation.md](stack-recommendation.md)：技术栈选型评估（含历史候选方案对比）。
- [data-flow.md](data-flow.md)：数据流向与所有权划分。
- [security-and-data-boundaries.md](security-and-data-boundaries.md)：安全与数据边界约束。
- [event-reliability-and-recovery.md](event-reliability-and-recovery.md)：事件可靠性与恢复策略。
- [cross-platform-and-performance-adaptive.md](cross-platform-and-performance-adaptive.md)：跨端渲染与性能自适应。
- [avatar-3d-rendering-pipeline.md](avatar-3d-rendering-pipeline.md)：3D 数字人渲染管线。
- [local-development-port-allocation.md](local-development-port-allocation.md)：本地端口分配说明；唯一事实源为 `config/local-ports.json`。
- [repo-structure.md](repo-structure.md)：仓库结构约定。
