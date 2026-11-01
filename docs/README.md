# 语学星文档中心

本目录是产品与研发文档的**总入口**。文档的事实源优先级、Phase 1 范围冻结、跨域数据所有权与文件命名规范，统一由 [00-vision/document-governance.md](00-vision/document-governance.md) 规定；本索引与治理规则冲突时，以治理规则为准。

## dev 当前入口

本分支执行**迭代 2（第二轮重设计）**。接手先核对[迭代 2 进度入口](06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)、[根交接](../CURRENT-HANDOFF.md)和 [R1 卡计划](06-design/v2-980plus/redesign/dev-plan-R1.md)；[状态总览](STATUS.md)汇总分支、签收记录、UI 与部署快照。历史签收只适用于记录中的候选提交和范围，不能替代当前版本和环境的独立验收。旧台账与带日期报告供追溯和复用。

## 目录地图

| 目录 | 定位 | 索引 |
|---|---|---|
| `00-vision/` | 产品愿景、用户画像、仓库结构、**文档治理规则** | [README](00-vision/README.md) |
| `01-research/` | 市场假设与竞品研究（研究输入，非事实源） | [README](01-research/README.md) |
| `02-architecture/` | 系统架构、微服务边界、数据与事件主线、安全边界、本地端口 | [README](02-architecture/README.md) |
| `03-ai/` | AI 能力设计、评测与提示词治理（Phase 2 预留） | [README](03-ai/README.md) |
| `04-content/` | 内容模型、课程框架与内容质量 | [README](04-content/README.md) |
| `05-api/` | API 通用约定与 OpenAPI 片段 | [README](05-api/README.md) |
| `06-design/` | **设计主干**：设计系统、v2-980plus 全量设计、分阶段设计、追溯矩阵 | [README](06-design/README.md) |
| `07-operations/` | 本地开发、运行手册与带日期的验证快照 | [README](07-operations/README.md) |
| `08-compliance/` | 中国大陆合规、审查基线与首发执行清单 | [README](08-compliance/README.md) |
| `09-roadmap/` | 分期路线、关键指标与首 30 天计划 | [README](09-roadmap/README.md) |
| `10-decisions/` | 架构决策记录（ADR，编号 0001–0014 连续） | [README](10-decisions/README.md) |
| `design/` | 移动端 UI 规格（第 1 轮 / 第 2 轮） | [README](design/README.md) |
| `technical-specs/` | 技术规格与模块级详细设计 | [README](technical-specs/README.md) |

## 按任务的阅读路径

- **接手本分支开发**：[当前进度](06-design/v2-980plus/redesign/CURRENT-PROGRESS.md) → [根交接](../CURRENT-HANDOFF.md) → [R1 卡计划](06-design/v2-980plus/redesign/dev-plan-R1.md) → [文档治理](00-vision/document-governance.md) → [v2 设计](06-design/v2-980plus/README.md) → [目标架构](02-architecture/v2-microservices-architecture.md)。
- **查任务与验收状态**：从[迭代 2 当前进度](06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)进入[状态总览](STATUS.md)和具名 R1 卡证据，核对提交与环境；[P1R 台账](../requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md)只保留原计划状态，不是本分支任务队列。
- **改接口或数据结构**：先看 [05-api/](05-api/README.md) 与 `packages/contracts/`，并判断是否需要新增 ADR。
- **查运行手册与验证结论**：[07-operations/](07-operations/README.md)；带日期的验证记录为对应环境的快照，不代表当前状态。
- **理解选型原因**：[10-decisions/](10-decisions/README.md)，重点 ADR-0009/0010/0012/0013/0014。

## 文档检查

- 门禁命令：`node scripts/check-dod.mjs --json`（`--strict` 将警告提升为失败）。
- 文档链接与索引审计：`node scripts/audit/doc-audit.mjs --json`；该检查器对 `:行号` 等写法和历史证据的判定需人工核对。
- 最近一次体系审计：[00-vision/document-audit-2026-09-10.md](00-vision/document-audit-2026-09-10.md)。
