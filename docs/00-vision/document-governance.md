# 语学星产品与研发文档治理

> 版本：v1.0
>
> 生效日期：2026-08-20
>
> 适用范围：Phase 1 全部产品、设计、前端、后端、数据库、内容、测试、运营与 Agent 交付

本文件是文档治理地图，不替代任务状态报表。任务的负责人、状态、证据和阻塞以 [`requirements/backlog/Agent开发状态总报表.md`](../../requirements/backlog/Agent开发状态总报表.md) 为准；本文件只规定什么可以作为事实、什么必须先冻结，以及 Agent 如何把变更交给统筹验收。

## 1. 文档事实源与优先级

同一语义出现冲突时，按下面顺序解释；低层文档不能静默覆盖高层基线：

| 优先级 | 文档/目录 | 作用 | 维护边界 |
|---:|---|---|---|
| 1 | `AGENTS.md` | 技术栈、架构边界、隐私与 DoD 总规则 | 关键技术路线变更必须走 ADR |
| 2 | `requirements/product-requirements.md`、`requirements/mvp-scope.md`、`requirements/acceptance-criteria.md` | 产品目标、Phase 边界和验收底线 | 需求变更需产品负责人确认 |
| 3 | `requirements/feature-matrix.md` | `FEAT-*` 功能编号、阶段和终端范围的唯一全景台账 | 不得在设计文档中自造功能编号 |
| 4 | `docs/09-roadmap/roadmap.md` | 分期、优先级与全阶段发布 Gate | 不得因单个 Agent 方便而提前跨期 |
| 5 | `docs/06-design/detailed-specs/01~09` | 交互、状态机、DDL、API 和异常分支施工图 | 发生跨域冲突时以 `09_全站详细设计一致性审计白皮书.md` 的 canonical 约束为准 |
| 6 | `packages/contracts/`、`database/mysql/migrations/`、代码与测试 | 可执行实现与验证证据 | 必须反向链接到需求/设计/任务 |
| 7 | `requirements/backlog/` | 任务拆分、执行 SOP、证据和状态交接 | 状态总报表由统筹 Agent 统一更新 |

有效 ADR 位于 `docs/10-decisions/`。ADR 记录架构、范围、数据所有权和不可逆约束；普通实现细节留在设计文档或代码中，不能用 ADR 代替 API、DDL 或测试。

## 2. Phase 1 范围冻结

Phase 1 的执行基线标识为 `P1-BASELINE-20260820`，详细冻结表见 [`requirements/backlog/Phase-1范围冻结与跨文档基线.md`](../../requirements/backlog/Phase-1范围冻结与跨文档基线.md)，对应决策见 [`ADR-0007`](../10-decisions/0007-phase1-scope-and-development-governance.md)。摘要如下：

| 冻结项 | Phase 1 唯一执行口径 | 禁止的替代口径 |
|---|---|---|
| 用户 | 18 岁以上成人与大学生；规则化自主学习闭环 | 未成年人注册、K12/教材同步入口 |
| 学习闭环 | 学习目标 → 练习 → 规则反馈 → 复习 → 掌握/报告 | 用 AI 结论替代可解释规则 |
| 每日时长 | `5 / 15 / 30 / 45` 分钟 | PRD 旧版 `5 / 10 / 20 / 30` 不得并行实现 |
| 音标清单 | 唯一 `EN_48_PHASE1` manifest，20 个元音 + 28 个辅音 | 客户端、CMS 各自维护一份 48 项列表 |
| 音频变速 | `0.5x~2.0x`，音高保持；墙钟时长与内容时间轴分离 | 只实现某个端的局部倍速范围 |
| 口语 | 跟读、影子跟读、录音回放、音标/口型规则教学；不出 AI 分数 | Phase 1 接入 LLM、ASR、AI 发音评分或 RTC |
| SRS | `lrn_srs_state` 为唯一 SRS 事实；D+1/D+7 使用 `DELAY_VERIFY_D1` / `DELAY_VERIFY_D7`，最终使用 `MASTERED` | 新建第二套 SM-2、Daily Stream 或掌握事实表 |
| 商业化 | 权益和激活码模型可开发；微信/支付宝/Apple IAP 支付开关默认关闭 | 用假回调、客户端成功页或未验资质渠道上线 |
| 分期隔离 | Phase 2 AI/RTC 和 Phase 3 未成年人/K12 只保留显式预留，不进入 Phase 1 UI、路由、营销和注册 | 用隐藏入口提前交付跨期功能 |

### 2.1 冻结后的变更规则

以下任何变更都必须先进入 ADR 或范围变更记录，再修改契约、迁移和代码：

1. 用户年龄边界、Phase 1 禁止能力、支付默认开关或 Phase 2/3 隔离边界。
2. `5/15/30/45`、`EN_48_PHASE1`、`0.5x~2.0x` 或 canonical 状态枚举。
3. `VOC` 与 `ASM` 的数据所有权、跨域 ID、事件 schema、权限角色和错误码。
4. 会破坏已发布内容、已存在学习记录、订单/权益、审计日志或回滚能力的数据库变更。

普通文案、布局和非语义性的视觉微调可以在对应任务中完成，但必须保留截图或回归证据，并在交付时说明未影响冻结项。

## 3. 跨域所有权约束

| 领域 | 权威事实 | 允许被其他域消费的内容 | 明确禁止 |
|---|---|---|---|
| `VOC` | `vocab_id`、`chunk_id`、`expression_id`、学习对象和 `lrn_srs_state`、复习事件、排程与算法版本 | 通过事件/查询提供给练习、报告、游戏和阅读 | `ASM` 或其他域复制 SM-2/SRS 主表 |
| `ASM` | `question_id`、`exercise_id`、`attempt_id`、判分、错因、题目错题 cycle 和 D+1/D+7 验证证据 | 向 `VOC` 发送已验证的学习反馈/复习事实 | 自己维护另一套词汇掌握度或覆盖 `VOC` 的排程 |
| `ONB` | 目标、年龄确认、初始画像与非 AI 测评结果 | `Home`、计划和内容编排读取 | 重新定义用户年龄或另造画像表 |
| `COM/ADM` | SKU、订单、支付验证、权益、内容版本、双审、风控和 Flag | 向学习端提供已发布版本和权益投影 | 把渠道回调原文、客户端状态或运营指标当作业务事实 |
| `SPK` | 规则化口语素材、录音权限和回放元数据 | 学习报告可消费脱敏结果 | Phase 1 创建 RTC/ASR/AI 发音评分事实 |

跨域引用必须带 canonical ID、`contentVersionId`（如适用）、`requestId` 和幂等上下文；SQL 使用 snake_case，REST JSON 使用 camelCase。

## 4. 变更、版本与发布顺序

任何可交付功能都按以下顺序留痕：

`需求/Feature Ref → 设计与 ADR（如需要）→ OpenAPI/事件 Schema → MySQL migration → 服务与客户端 → 测试/观测 → 证据包 → CHANGELOG → Gate 验收`

规则如下：

- API、事件或数据结构变更不得先写客户端裸类型；先更新 `packages/contracts/`。
- 表结构变更不得直接改线上/存量表；先增加 Flyway migration，并提供空库、存量库、回滚或补偿证据。
- 内容发布、支付、权限、同步、个人数据和学习掌握相关变更必须可审计、可回放、可回滚。
- Agent 只提交“待验收”；统筹 Agent/评审人核验最小证据集后才将任务标为“已完成”。
- `CHANGELOG.md` 的每条记录必须包含任务 ID、影响范围、兼容性/迁移提示、验证命令、回滚方式和未覆盖事项；本治理任务不越权修改根 `CHANGELOG.md`，规则落在 [`requirements/backlog/DoD-Gate与证据包规范.md`](../../requirements/backlog/DoD-Gate与证据包规范.md)。

## 5. 文档交付检查

主编排器在派发和验收前使用 [`scripts/check-dod.mjs`](../../scripts/check-dod.mjs)：

- `node scripts/check-dod.mjs --help`：查看参数和退出码。
- `node scripts/check-dod.mjs --json`：输出可供报表/CI 消费的 JSON。
- `node scripts/check-dod.mjs --strict`：把契约、迁移、测试目录目前的“仅有说明文件”警告提升为 Gate 失败。
- `node scripts/check-dod.mjs --self-test`：无外部依赖地验证脚本自身的端口、占位密钥和参数逻辑。

检查器是治理辅助，不会把文档存在误报为业务完成，也不会修改状态报表、代码、数据库或端口配置。

## 6. 相关文件

- 范围冻结：`requirements/backlog/Phase-1范围冻结与跨文档基线.md`
- Agent SOP：`requirements/backlog/Agent开发SOP与状态流转模板.md`
- Gate/证据：`requirements/backlog/DoD-Gate与证据包规范.md`
- 研发任务基线：`requirements/backlog/开发实施总纲与功能链条任务分解.md`
- 状态唯一事实：`requirements/backlog/Agent开发状态总报表.md`
- 端口唯一事实：`config/local-ports.json`
