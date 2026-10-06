# 语学星产品与研发文档治理

> 版本：v2.4（2026-09-10 增补第 6 节「文档文件命名规范」）
>
> 生效日期：2026-08-29
>
> 适用范围：Phase 1 全部产品、设计、前端、后端、数据库、内容、测试、运营与 Agent 交付

本文件是文档治理地图，不替代任务状态报表。在 `dev-redesign` 上，[迭代 2 当前进度](../06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)与[R1 卡计划](../06-design/v2-980plus/redesign/dev-plan-R1.md)是新开发的接手/执行入口；[`v2-phase1-rebaseline/`](../../requirements/backlog/v2-phase1-rebaseline/README.md)保留原计划状态、复用候选和冻结门禁。B7–B36、旧 G0–G4 与 `b36-validation.md` 的 `LOCAL-TEST-NO-PASS` 只保留代码、迁移、历史运行和风险候选证据；必须在当前提交按 `P1R-*` Evidence 重新验证。[`Agent开发状态总报表.md`](../../requirements/backlog/Agent开发状态总报表.md) 只保留 B0–B6 历史状态。本文件只规定什么可以作为事实、什么必须先冻结，以及 Agent 如何把变更交给统筹验收。

v2 业务设计入口为 [`docs/06-design/v2-980plus/README.md`](../06-design/v2-980plus/README.md)，Phase 1 的系统运行入口为 [`phase1-business-operation/README.md`](../06-design/v2-980plus/phase1-business-operation/README.md)，后端技术入口为 [`docs/02-architecture/v2-microservices-architecture.md`](../02-architecture/v2-microservices-architecture.md)；旧 B0–B6 与 `core-api` 记录只保留历史/迁移语义。

## 1. 文档事实源与优先级

同一语义出现冲突时，按下面顺序解释；低层文档不能静默覆盖高层基线：

| 优先级 | 文档/目录 | 作用 | 维护边界 |
|---:|---|---|---|
| 1 | `AGENTS.md` | 技术栈、架构边界、隐私与 DoD 总规则 | 关键技术路线变更必须走 ADR |
| 2 | `docs/06-design/v2-980plus/`（含 `phase1-business-operation/`） | **新一轮开发唯一的全量业务设计与需求落地基线**：范围、用户交互、四项目宿主、业务旅程、逐页功能、学习/后台规则、联调、恢复、阶段与验收 | `V2-EXT-*` 未细化签收不得进入任务；Phase 1 新任务还须绑定 `ACT/JNY/PAGE/RULE/INT/E2E`，并保留未关闭 GAP；冲突时以 v2 为准并同步追溯台账 |
| 3 | `docs/02-architecture/v2-microservices-architecture.md`、`docs/02-architecture/v2-platform-capability-matrix.md`、ADR-0009/0010/0012/0013/0014 | 服务边界、Gateway、自有 IAM/JWT、客服/隐私 owner、数据/事件和平台能力 | `ARCH-*` 不计入业务 Feature；技术冲突必须通过 ADR/v2 变更闭环 |
| 4 | `requirements/product-requirements.md`、`requirements/mvp-scope.md`、`requirements/acceptance-criteria.md`、`requirements/feature-matrix.md` | 来源证据、`FEAT-*` 编号、法规/Phase 底线、统计与可测试验收 | 新需求先更新 v2 与本层追溯；本层不能以旧文案推翻 v2 |
| 5 | `docs/09-roadmap/roadmap.md` | 分期、Platform 0、优先级与全阶段发布 Gate | 不得因单个 Agent 方便而提前跨期 |
| 6 | `docs/06-design/detailed-specs/01~09`、旧 `phase-*`、B0–B6 | 历史实现、术语和迁移参考 | 不作为新任务需求事实源；发生冲突时以 v2 和目标架构为准 |
| 7 | `packages/contracts/`、`database/mysql/migrations/`、代码与测试 | 可执行实现与验证证据 | 必须反向链接到需求/设计/任务 |
| 8 | `docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md`、`dev-plan-R1.md`；原 `requirements/backlog/v2-phase1-rebaseline/` | dev-redesign 当前接手/卡计划与原 P1R 追溯 | 本分支按 `R1-*`、BC/IC 和卡依赖；保留原 P1R canonical Evidence/冻结门禁，不迁移状态；任务须绑定 Source/ARCH/运行层 ID/Service/Data Owner |

有效 ADR 位于 `docs/10-decisions/`。ADR 记录架构、范围、数据所有权和不可逆约束；普通实现细节留在设计文档或代码中，不能用 ADR 代替 API、DDL 或测试。

## 2. Phase 1 范围冻结

Phase 1 的成人、安全和阶段约束仍然必须遵守，但新任务的执行基线在 `v2-980plus/`。`P1-BASELINE-20260820` 与 [`requirements/backlog/Phase-1范围冻结与跨文档基线.md`](../../requirements/backlog/Phase-1范围冻结与跨文档基线.md) 是 v1 历史冻结记录，只可用于迁移核对，不能覆盖 v2；对应历史决策见 [`ADR-0007`](../10-decisions/0007-phase1-scope-and-development-governance.md)。摘要如下：

| 冻结项 | Phase 1 唯一执行口径 | 禁止的替代口径 |
|---|---|---|
| 用户 | 18 岁以上成人与大学生；规则化自主学习闭环 | 未成年人注册、K12/教材同步入口 |
| 学习闭环 | 学习目标 → 练习 → 规则反馈 → 复习 → 掌握/报告 | 用 AI 结论替代可解释规则 |
| 前端项目 | 只维护 `apps/mobile`、`apps/learner-web`、`apps/admin-web`、`apps/official-site` 四个业务项目；小程序由 mobile 条件编译 | 新建独立 H5、iPad 或小程序业务项目 |
| 认证 | 平台自有 IAM 账号密码登录；Phase 1 固定 RS256 JWT/RSA JWKS；IAM 是唯一 Token 签发方 | OIDC/OAuth、Keycloak、第三方 IdP、客户端或领域服务自行签 Token |
| 事件 | Kafka + transactional Outbox + AsyncAPI 是 v2 事件事实源；RabbitMQ 仅作 `core-api` v1 可选兼容 | RabbitMQ/Redis Streams 作为 v2 事件主线或 Kafka RPC |
| 范围登记 | `V2-980-0001..0980` = 930 个业务单元 + 50 个跨域登记位；成熟度 184/486/310 | 把 980 解释为 980 份可实施设计或已完成功能 |
| 每日时长 | `5 / 15 / 30 / 45` 分钟 | PRD 旧版 `5 / 10 / 20 / 30` 不得并行实现 |
| 音标清单 | 唯一 `EN_48_PHASE1` manifest，20 个元音 + 28 个辅音 | 客户端、CMS 各自维护一份 48 项列表 |
| 音频变速 | `0.5x~2.0x`，音高保持；墙钟时长与内容时间轴分离 | 只实现某个端的局部倍速范围 |
| 口语 | 跟读、影子跟读、录音回放、音标/口型规则教学；不出 AI 分数 | Phase 1 接入 LLM、ASR、AI 发音评分或 RTC |
| SRS | `lrn_srs_state` 为唯一 SRS 事实；Phase 1 固定版本化改进型 SM-2，记录 `algorithmVersion`；D+1/D+7 使用 `DELAY_VERIFY_D1` / `DELAY_VERIFY_D7`，最终使用 `MASTERED` | 并行启用 FSRS、新建第二套 SM-2、Daily Stream 或掌握事实表 |
| 学习游戏 | P0 仅启用 Sentence Train；P1 扩展到总计 4 款；6–8 款仅是长期 registry/路线目标 | 因枚举中存在 6 个 gameCode 就宣称六款均已上线 |
| 商业化 | SKU、订单、权益、激活码、渠道适配、回调验签与沙盒可开发；微信/支付宝/Apple IAP 支付开关默认关闭，且不得自动续费 | 用假回调、客户端成功页或未验资质渠道上线 |
| 内容版权 | 仅发布自有、开放许可或已取得有效授权且在范围/期限内的内容与媒体 | 把品牌、词典释义、教材、真题、统计资料或第三方媒体视为默认可用 |
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
| `content-service` | `vocab_id`、`chunk_id`、`expression_id`、课程/内容版本、`question_id`、`exercise_id`、答案规则版本、版权与发布状态 | 向学习和测评提供版本化只读内容/题目快照 | `assessment` 维护题库主表、前端持有答案密钥或任何服务越权发布内容 |
| `learning-service` | `lrn_srs_state`、复习事件/排程、学习计划、进度、`mastery_projection` | 向练习、报告、游戏提供事件或只读投影 | `assessment` 或客户端直接改 SRS/掌握度/复习状态 |
| `assessment-service` | `attempt_id`、草稿/checkpoint、判分、错因、模考会话与报告快照 | 向 learning 发出可信已提交/已评分事实 | 自己维护另一套掌握度/SRS，或改 content 的题目/答案规则 |
| `iam-service` / `learner-service` | IAM：principal、成人年龄 Gate、tenant、会话、角色和同意；learner：目标、偏好、学习档案 | Home、计划和内容编排按权限读取 | 创建儿童/家长/监护主体作为 Phase 1 功能，或让客户端覆盖 tenant/owner |
| `commerce-service` / `admin-ops-service` | commerce：SKU、订单、支付验证、权益、退款与对账；admin：只读聚合、命令发起和审计关联 | 向学习端提供已发布内容和权益投影 | BFF/工作流跨域写领域事实，把渠道回调原文、客户端状态或运营指标当作事实 |
| `media-service` / `assessment-service` | media：录音/媒体元数据、转码与短期授权 URL；assessment：规则化口语 attempt/反馈 | 学习报告可消费脱敏结果 | Phase 1 创建 RTC/ASR/AI 发音评分事实或将原始音频写入日志/事件 |

跨域引用必须带 canonical ID、`contentVersionId`（如适用）、`requestId` 和幂等上下文；SQL 使用 snake_case，REST JSON 使用 camelCase。

## 4. 变更、版本与发布顺序

任何可交付功能都按以下顺序留痕：

`需求/Feature Ref → V2 设计单元 → 业务运行旅程/页面/规则/联调/E2E → 设计与 ADR（如需要）→ OpenAPI/事件 Schema → MySQL migration → 服务与客户端 → 测试/观测 → 证据包 → CHANGELOG → Gate 验收`

规则如下：

- API、事件或数据结构变更不得先写客户端裸类型；先更新 `packages/contracts/`。
- 表结构变更不得直接改线上/存量表；先增加 Flyway migration，并提供空库、存量库、回滚或补偿证据。
- 内容发布、支付、权限、同步、个人数据和学习掌握相关变更必须可审计、可回放、可回滚。
- Agent 只提交“待验收”；统筹 Agent/评审人核验最小证据集后才将任务标为“已完成”。
- `CHANGELOG.md` 的每条记录必须包含可追溯标识（任务 ID、ADR 或审核记录）、影响范围、兼容性/迁移提示、验证命令、回滚方式和未覆盖事项；规则落在 [`requirements/backlog/DoD-Gate与证据包规范.md`](../../requirements/backlog/DoD-Gate与证据包规范.md)。

## 5. 文档交付检查

主编排器在派发和验收前使用 [`scripts/check-dod.mjs`](../../scripts/check-dod.mjs)：

- `node scripts/check-dod.mjs --help`：查看参数和退出码。
- `node scripts/check-dod.mjs --json`：输出可供报表/CI 消费的 JSON。
- `node scripts/check-dod.mjs --strict`：把契约、迁移、测试目录目前的“仅有说明文件”警告提升为 Gate 失败。
- `node scripts/check-dod.mjs --self-test`：无外部依赖地验证脚本自身的端口、占位密钥和参数逻辑。

检查器是治理辅助，不会把文档存在误报为业务完成，也不会修改状态报表、代码、数据库或端口配置。

## 6. 文档文件命名规范

本节自 2026-09-10 起对**新增文档**生效；存量文档渐进整改，不得在无关联改动中批量重命名，以免破坏跨文档链接。

| 项 | 规则 |
|---|---|
| 目录索引 | 一律命名为 `README.md`。禁止 `index.md`、`00_README_*.md`、`README_*.md` 等变体 |
| 文件名主体 | 优先英文 kebab-case（如 `event-reliability-and-recovery.md`） |
| 序号前缀 | 同一目录内统一使用 `NN-` 或 `NN_` 之一，不得混用；跨目录可各自约定 |
| 中文文件名 | 仅当同一目录既有体系为中文时沿用（如设计分册）；不得与英文 kebab-case 在同一目录内混用 |
| 日期 | 需要日期时置于文件名末尾，格式 `-YYYY-MM-DD`（如 `review-baseline-2026-08-19.md`） |
| ADR | 编号自 `0001` 起连续，**不得留空号**；废弃决策保留文件并在文件头部与 [docs/10-decisions/README.md](../10-decisions/README.md) 标注 `superseded`，不得物理删除 |
| 禁止 | 全大写连写、文件名含空格、`-` 与 `_` 混用、无意义前缀 |

自动检查分工：`scripts/check-dod.mjs` 负责必需文档与治理标记；目录索引缺失、命名偏差与断链由文档审计补充检查，方法与当前结果见 [document-audit-2026-09-10.md](document-audit-2026-09-10.md)。

## 7. 相关文件

- 范围冻结：`requirements/backlog/Phase-1范围冻结与跨文档基线.md`
- Agent SOP：`requirements/backlog/Agent开发SOP与状态流转模板.md`
- Gate/证据：`requirements/backlog/DoD-Gate与证据包规范.md`
- 当前 Phase 1 研发任务/状态基线：`requirements/backlog/v2-phase1-rebaseline/README.md`
- B7–B36 历史实现/运行候选：`requirements/backlog/v2-B7plus-*`、`v2-B23plus-*`、`v2-B28plus-*`
- B0–B6 历史任务基线：`requirements/backlog/开发实施总纲与功能链条任务分解.md`
- B0–B6 历史状态事实：`requirements/backlog/Agent开发状态总报表.md`
- 端口唯一事实：`config/local-ports.json`
