# ADR-0007：Phase 1 范围与 Agent/DoD 治理基线

## 状态

accepted

> v2 架构与任务重基线注记（2026-08-29）：本 ADR 的 Phase 1 范围、canonical 状态和算法约束继续有效；其关于服务/数据库 owner 的旧域级表述由 ADR-0010 与 `v2-microservices-architecture.md` 细化。`VOC`/`ASM` 在这里表示业务语义域，不表示 v2 目标服务可以双写同一事实。B0–B36、`DEV-*` 与 G0–G4 状态只作历史/候选证据；Phase 1 当前任务、状态、证据和阻塞统一由 [`v2-phase1-rebaseline`](../../requirements/backlog/v2-phase1-rebaseline/README.md) 的 `P1R-*` 台账维护。

## 日期

2026-08-20

## 背景

语学星已经拥有 PRD、功能矩阵、路线图和 01~09 详细设计，但不同文档曾出现每日时长、音频变速、SRS 状态和 Phase 分期描述不完全一致的情况。B0 开发需要一个可以被前端、后端、数据库、内容、测试和自动 Agent 同时执行的基线，否则每个 Agent 都可能在本地做出一套“看起来合理但无法拼接”的实现。

现有有效 ADR 最高编号为 `ADR-0006`；历史 `0002/0003` 已从工作目录清理，本决策使用下一个可用编号 `ADR-0007`，不覆盖历史文件。

## 决策

### 1. 冻结 Phase 1

Phase 1 只面向 18 岁以上成人与大学生，交付规则化学习闭环：

`学习目标 → 练习 → 规则反馈 → 复习 → 掌握/报告`

固定口径：

- 每日学习时长为 `5/15/30/45` 分钟；PRD 旧版 `5/10/20/30` 仅作为冲突记录，不并行实现。
- 48 国际音标使用唯一内容 manifest `EN_48_PHASE1`，由内容/CMS 版本化，组成固定为 20 个元音和 28 个辅音；客户端不得内置第二份清单。
- 音频速度允许 `0.5x~2.0x`，必须保持音高，并区分内容时间轴毫秒值与变速后的墙钟时长。
- 口语只实现跟读、影子跟读、录音回放、音标/口型规则教学和预编情景会话；Phase 1 不启用 LLM、ASR、AI 发音评分或 RTC。
- 支付渠道默认关闭。权益、免费层和激活码可先实现；微信/支付宝/Apple IAP 只有资质、沙盒、验签、退款、对账、回滚和审计证据齐全后才能通过独立 Gate 打开。
- Phase 2 AI/RTC 与 Phase 3 未成年人/K12 必须隔离在独立的需求、设计、契约、Feature Flag、成本和合规 Gate 之后，不得出现在 Phase 1 UI、注册、营销或默认路由中。

### 2. 统一 SRS 与掌握事实

- `lrn_srs_state` 是用户学习对象 SRS 的唯一事实表；`vocab_id`、`chunk_id`、`expression_id` 是对应 canonical ID。
- `VOC` 负责词汇/短语业务语义；v2 中内容定义和版本归 `content-service`，用户 SRS 算法状态、复习事件、排程快照、算法版本、信心度和 SRS 状态迁移归 `learning-service`。
- `ASM` 负责练习实例、作答、判分、错因、错题 cycle，以及 D+1/D+7 的验证证据；题目/答案规则版本归 `content-service`，`ASM` 使用版本化题目快照并将“已评分事实”事件交给 `learning-service`，不能复制 SRS 主表或直接改写掌握度。
- 对外跨域掌握状态统一为 `NEW`、`LEARNING`、`MASTERED`、`CONSOLIDATED`；VOC 内部可以保留 `SHORT_TERM`、`CONSOLIDATING`、`AT_RISK`、`SUSPENDED` 等解释状态，但必须通过 mapper 输出 canonical 状态。
- 错题验证状态统一使用 `PENDING_RETRY`、`DELAY_VERIFY_D1`、`DELAY_VERIFY_D7`、`MASTERED`、`REOPENED`。历史别名 `PENDING_DELAY_VERIFY_D1/D7`、`RESOLVED` 只能用于兼容迁移映射，不得进入新 API 或新表。

### 3. 采用可审计 Agent 状态流

标准状态为：

`未开始 → 已认领 → 进行中 → 待验收 → 已完成`

`P1R-*` 台账为便于自动校验，使用一一对应的机器别名：`PLANNED → READY → IN_PROGRESS → REVIEW → ACCEPTED`；这不是第二套业务状态。

异常状态为：

`进行中/待验收 → 阻塞`、`待验收/已完成 → 返工 → 进行中`；机器别名分别为 `BLOCKED` 和 `REWORK`。

Agent 必须携带任务 ID、文件边界、契约/迁移/测试证据、回滚方式和未覆盖事项；没有证据只能停留在“待验收”。新开发的状态事实源是 `requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md`；旧 B/`DEV-*`/G 台账只保留历史状态，由主编排器在复用时按当前提交重新验证，不自动迁移完成结论。

### 4. 以 DoD Gate 作为发布条件

每个任务至少经过范围/ADR、契约/数据、实现/客户端、测试/安全/观测和发布/回滚五类 Gate。Gate 细则与证据模板见 `requirements/backlog/DoD-Gate与证据包规范.md`。`scripts/check-dod.mjs` 只做无外部依赖的结构化预检，不能替代人工验收或业务测试。

## 后果

### 正面

- 下游 Agent 可以从相同的时长、音标、SRS、所有权和 Phase 边界开始编码。
- `VOC` 与 `ASM` 不会因为各自实现而产生两套掌握度事实。
- 支付和 Phase 2/3 能力在证据不足时保持关闭，降低误上线和合规风险。
- 状态、证据和回滚路径可以被报表和 CI 复用。

### 成本与限制

- 旧 PRD 的 5/10/20/30 与 0.75x/1.0x/1.25x/1.5x 描述不能直接照抄，Agent 需要引用冻结基线。
- `EN_48_PHASE1` 的 48 条内容 manifest、契约 YAML、Flyway migration 和测试仍需由后续任务完成；本 ADR 不伪造这些实现证据。
- 支付渠道在证据齐全前不可用，学习主链必须能够在免费/激活码路径下独立运行。

## 回滚与变更

本 ADR 本身只新增治理约束，回滚方式是新增 superseding ADR 并保留本文件，不删除历史决策。任何放宽 Phase 1 红线、改变 canonical 状态或切换数据所有权的提议，都必须同时提供：影响矩阵、兼容迁移、API/事件版本、数据回滚或补偿方案、测试证据、隐私/合规评估和产品负责人批准。

## 关联文件

- `AGENTS.md`
- `requirements/product-requirements.md`
- `requirements/feature-matrix.md`
- `requirements/mvp-scope.md`
- `requirements/acceptance-criteria.md`
- `docs/09-roadmap/roadmap.md`
- `docs/06-design/detailed-specs/09_全站详细设计一致性审计白皮书.md`
- `requirements/backlog/Phase-1范围冻结与跨文档基线.md`
- `requirements/backlog/Agent开发SOP与状态流转模板.md`
- `requirements/backlog/v2-B7plus-代码重塑与交互测试任务基线.md`
- `requirements/backlog/v2-phase1-rebaseline/README.md`
- `requirements/backlog/DoD-Gate与证据包规范.md`
