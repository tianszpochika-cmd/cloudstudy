# 语学星 Phase 2｜AI 成人学习与 AI 服务详细设计（v1 历史草案）

> **状态：历史/迁移参考。** v2 Phase 2 的业务设计、Gate、契约和验收以 [`../v2-980plus/05-Phase2-AI成人高级能力功能设计.md`](../v2-980plus/05-Phase2-AI成人高级能力功能设计.md) 为准；本文件不能单独生成新任务或决定模型/供应商选型。
>
> **历史设计状态**：Phase 2 草案；仅适用于完成 Phase 2 前置合规、成本、隐私、Feature Flag 与灰度 Gate 后的 18+ 成人/大学生。本文不代表功能已上线，也不修改 `requirements/feature-matrix.md`、OpenAPI、数据库迁移或代码。
>
> **唯一模型约束**：所有模型驱动的 AI 决策、文本生成、结构化反馈、内容审核与对话编排统一使用 `modelId=gpt-5.6-luna`，`reasoning_effort=max`。禁止以其他模型作为自动 fallback；失败时只能返回安全降级、缓存结果或规则化能力。ASR/TTS/RTC 的媒体供应商与具体 SDK 未由 PRD 冻结，本文只定义适配边界，不能把未决供应商或型号写成既定事实。
>
> **v2 架构绑定**：外部请求经 `api-gateway`，AI 编排由独立 `services/ai-orchestrator`（Python 3.11+）承载；学习/评测事实分别归 `learning-service`/`assessment-service`，权限由 `iam-service` 与服务侧 PEP 执行。旧 `core-api` 只作迁移兼容，不是模型直连入口。
>
> **本次写入范围**：`docs/06-design/phase-2/AI成人学习与AI服务详细设计.md`。

## 0. 设计定位、事实源与编号口径

### 0.1 事实源与阅读基线

本设计按以下顺序解释需求，发生冲突时保留证据并进入“未决项”，不通过猜测补齐共享矩阵：

1. `AGENTS.md`：四项目冻结、Vue 3 + TypeScript + uni-app、Java 25/Spring Boot 4.1 微服务目标、Gateway/IAM/RBAC、Python FastAPI AI 编排、MySQL/Redis/S3、商业 RTC、四级画质、契约先行、双审和 AI Schema 治理。
2. `requirements/product-requirements.md`：Phase 2 §23～§37 的成人 AI 学习、实时语音、考试、职场、海外、辩论、RAG 与社交升级证据。
3. `requirements/feature-matrix.md`：AI2 领域的 7 个已有主功能编号及“Phase 2 68 项”的现有统计。
4. `docs/06-design/detailed-specs/README.md`、01～09 详细设计、`docs/06-design/design-system.md`、`immersive-frontend-architecture.md` 与追溯校准文档：canonical ID、响应包络、幂等、内容状态、权限、事件和跨端降级基线。
5. `docs/03-ai/current-capability-notes.md`、`docs/02-architecture/data-flow.md`、`docs/02-architecture/system-technical-architecture.md`：Phase 2 AI 数据分层和服务边界。

### 0.2 编号规则

- `FEAT-AI2-001`～`FEAT-AI2-007` 保留为 `requirements/feature-matrix.md` 已存在的 7 个 AI2 主功能编号。
- `SUBFEAT-AI2-*` 是从 PRD 原子能力展开的本设计追溯编号，不自动等同于共享矩阵的新 `FEAT-*` 行；本文件不修改共享矩阵。
- 同一能力的 UI 状态、权限状态、错误态、设备降级和成本配额不另计业务编号。
- 公开考试结果、学习等级、付费、封禁和社交处罚不得只由模型结论决定；AI 结果是可解释的辅助反馈，原始学习事实与规则判定仍由 learning-service、assessment-service、commerce-service 等领域服务保留。

### 0.3 Phase 2 总边界

- 默认用户范围为 18 岁及以上成人与大学生；不进入 K12 同步学科培训、未成年人账号、家长模式或未授权教材 RAG。
- AI 能力默认关闭，必须经过已备案基础模型、生成式 AI 应用/功能登记、AI 标识、服务说明、模型公示、输入输出安全、违规处置、投诉反馈、数据使用授权、成本限额、日志和风控 Gate。
- 客户端只访问 api-gateway / realtime-voice 的受控信令，不直接持有模型供应商密钥，也不直接调用模型供应商。
- 生成文本、音频、数字人动作和模型反馈都必须标识为 AI 生成/AI 辅助；不得宣传“真人教师”“官方评分”“AI 心理医生”。
- 原始输入、脱敏输入、模型请求、结构化输出、用户采纳/重做和失败结果分层保存；日志、埋点和普通运营导出不得带用户原文、原始录音、令牌或密钥。

### 0.4 Phase 2 目标闭环

```text
学习目标/当前任务
      ↓
AI 读取已授权的课程上下文与学习事实
      ↓
前置安全检查 → gpt-5.6-luna(max) / 规则 / 检索编排
      ↓
结构化输出 → 后置安全检查 → AI 标识与解释
      ↓
用户采纳、修改、重做或忽略
      ↓
学习事件、掌握/弱点、复习计划与成本审计可回放
```

## 1. Phase 2 AI 总体架构

### 1.1 服务职责

| 层 | 责任 | 不允许承担的责任 |
|---|---|---|
| `apps/mobile` | uni-app 学习端；移动 H5、iOS、Android、iPad；小程序条件编译 | 不保存模型密钥；不复制模型提示词和评分规则 |
| `apps/learner-web` | PC Web、平板浏览器、PWA 学习工作区 | 不重复承载移动 H5 业务页面 |
| `apps/admin-web` | AI Feature Flag、成本、审核、投诉、来源/版权、评测抽检 | 不把模型输出直接发布为内容；不越权查看原始音频/原文 |
| `apps/official-site` | AI 服务说明、产品/价格/合规公示、下载和导流 | 不承载登录后的 AI 学习会话 |
| api-gateway + iam-service + 领域服务 | Gateway/IAM 负责入口、主体、年龄/权益预检；learning/assessment/commerce 等服务拥有学习、考试、订单事实、幂等、审计和 Outbox | 不在 Gateway 请求线程内直接实现模型编排；不让客户端直连模型 |
| AI Orchestrator | Python 3.11+ FastAPI + LangGraph/LiteLLM；Schema 校验、promptVersion、模型路由、安全前后置、RAG 编排、成本估算 | 不绕过 IAM/服务侧 PEP 的 subject、权限和权益；不写不可追踪的自由文本结果 |
| Realtime Voice | 商业 RTC 接入/信令边界；低延迟双向媒体与 Barge-in | 不用 HTTP 轮询模拟实时通话；具体声网/TRTC 选型待 ADR |
| MySQL/Redis/S3 | MySQL 事实源；Redis 短缓存/锁/队列辅助；S3 音频/媒体/文档对象 | Redis 不作为 AI 审计事实源；S3 URL 不进入普通日志 |
| Kafka-compatible Event Bus | 异步 AI 评测、记忆合并、RAG 索引、成本汇总和死信 | 不丢失原始学习事件；消费者必须按 eventId 去重；RabbitMQ 仅供 `services/core-api` 的 v1 可选兼容使用，Redis Streams 不得作为 v2 事件事实源 |

### 1.2 统一请求与响应包络

REST JSON 采用现有详细设计的 camelCase；SQL 使用 snake_case；成功包为 `{ requestId, data, meta }`，错误包至少为 `{ requestId, error: { errorCode, message, retryable, details } }`。所有写操作使用 `Idempotency-Key`；离线客户端事件额外使用 `clientEventId + clientSeq`。

AI 内部请求必须记录以下结构化上下文，`userId` 由鉴权上下文解析，客户端不得覆盖：

| 字段 | 约束 |
|---|---|
| `featureCode` | `FEAT-AI2-*` 或 `SUBFEAT-AI2-*` |
| `modelId` | 固定 `gpt-5.6-luna` |
| `reasoningEffort` | 固定 `max` |
| `promptVersion` | 版本化、不可空；随结果持久化 |
| `schemaVersion` | 输入和输出各自版本化；解析失败不得猜测 |
| `requestId` / `traceId` | 贯穿 Gateway、IAM、领域服务、AI Orchestrator、RTC/异步任务 |
| `contentVersionId` | 只要引用课程、题目、模板、来源文档就必须带 |
| `consentVersion` | 涉及记忆、原始文本、录音、RAG 上传或社交 UGC 时必须带 |
| `resultStatus` | `READY`、`DEGRADED`、`REJECTED`、`FAILED`、`CANCELED` 等统一枚举 |

### 1.3 统一 AI 请求状态机

```text
CREATED
  → PRECHECKED → ROUTED → RUNNING → STREAMING/PROCESSING
  → POSTCHECK → PERSISTED → DELIVERED

PRECHECKED → REJECTED
RUNNING/STREAMING → CANCELED | TIMED_OUT | RETRY_WAIT
RETRY_WAIT → RUNNING（仅幂等且 retryable=true）
RUNNING/POSTCHECK → DEGRADED（规则、缓存、预制内容或文本替代）
```

- `REJECTED`：安全、权限、年龄、权益、同意、来源或输入 Schema 不通过；不重试。
- `TIMED_OUT`：保留请求和失败原因；返回安全降级，不换模型。
- `DEGRADED`：必须明确显示“AI 暂不可用/已使用规则或预制反馈”，不能伪装成实时 AI 结论。
- 流式结果只允许增量虚拟切片渲染；用户取消后停止继续生成，未完成片段不能写成完整报告。

### 1.4 统一安全与隐私闸门

1. **前置拦截**：鉴权、18+、Feature Flag、权益/配额、输入 Schema、敏感/违规内容、版权/来源、同意版本和速率限制。
2. **模型约束**：所有模型调用显式传入 `gpt-5.6-luna` 与 `reasoning_effort=max`；不得由用户输入改变模型、系统指令或安全策略。
3. **后置核验**：输出 Schema、敏感内容、事实/来源引用、AI 标识、场景边界、医疗/法律/金融/考试官方声明、禁止学术不端等。
4. **人工与用户控制**：投诉、纠错、举报、屏蔽、删除、记忆关闭、录音删除和紧急 Feature Flag 关闭可追溯。
5. **最小化**：能用结构化学习事件的场景不发送原文；能用缓存音频的场景不重复动态 TTS；原始录音默认不用于训练。

### 1.5 统一超时、重试、降级和成本记录

以下为设计候选策略，不是 PRD 已冻结的 SLO；正式数值须在 Phase 2 成本/性能 Gate 和 OpenAPI 契约中冻结。

| 调用类型 | 候选超时 | 重试 | 安全降级 |
|---|---|---|---|
| 短文本结构化反馈 | 8 秒总预算 | 最多 1 次；只重试网络/5xx/429 且请求幂等 | 返回规则解释、历史缓存或“稍后重试”，保留原练习 |
| 长文/路径/RAG | 15 秒同步预算；超出转异步 202 | 最多 1 次；异步任务指数退避并入死信 | 返回已完成分段、规则报告或待处理状态 |
| 流式语音 | 首包候选 2 秒；单轮候选 10 秒 | 不重放已结束媒体；只重连信令/RTC token | 转文字回合、预制脚本或静音练习，绝不 HTTP 轮询 |
| TTS | 缓存命中直接返回；动态合成候选 5 秒 | 同一 `audioRequestId` 幂等 1 次 | 使用固定内容缓存、文字显示或系统音频，不换模型 |
| RAG 检索+回答 | 候选 2 秒检索、8 秒回答 | 只重试检索/暂时性网络；来源不全则不生成断言 | 返回引用检索结果或“无法基于已授权资料回答” |

每次调用写入成本审计：`aiRequestId`、`featureCode`、`modelId`、`reasoningEffort`、`promptVersion`、`schemaVersion`、输入/输出 token（若模型返回）、音频毫秒、TTS 字符/秒数、检索 chunk 数、耗时、重试次数、状态、配额快照、估算成本、实际账单对账键（若可得）。成本日志不保存原文和音频。

### 1.6 统一事件包络

```text
eventId, eventType, schema, occurredAt, actorId, requestId, traceId,
clientEventId?, featureCode, sessionId?, resultStatus, promptVersion,
modelId, reasoningEffort, payload
```

`payload` 只放枚举、ID、长度、计数、哈希、维度分数和脱敏摘要；自由文本、原始录音、完整 prompt、访问令牌、身份证件和模型供应商密钥禁止进入埋点。Outbox 先在本地事务落库，消息投递后按 `eventId` 去重。

### 1.7 统一跨端和性能基线

| 能力 | `apps/mobile` App/H5、iPad | `apps/learner-web` | 微信小程序条件编译 | 四级画质/能力 |
|---|---|---|---|---|
| 结构化文本 | 完整、流式、可取消 | 完整、多栏 | 完整但控制输出长度 | Performance 保留文本和静态卡片 |
| 录音/ASR/发音 | 原生/浏览器权限、RTC | 浏览器麦克风/RTC | 仅在平台能力和审核允许时启用 | 失败时文字或预制脚本 |
| TTS | 系统播放/缓存音频 | Web Audio/HTML 音频 | 基础音频控件 | 动态失败回退固定缓存/文字 |
| 数字人 | Ultra/High 用 Rive；Medium 2.5D；Performance 静态 | 同左 | 2D 帧/静态头像 | Performance 不初始化 WebGL/粒子 |
| X-Ray/图谱 | Vue Flow/WebGL 可选 | Vue Flow/WebGL 可选 | 2D 分层列表 | 低配使用 SVG/静态节点 |
| RTC 角色扮演 | 商业 RTC + Barge-in | 浏览器 RTC | 若不可用转文本/预制回合 | 不用 HTTP 轮询伪造实时 |

所有端均须有加载、空、失败、取消、权限拒绝、弱网、配额耗尽、AI 标识和删除入口；动画、声音、触觉可关闭，非颜色方式表达反馈。

## 2. AI2 主功能与原子需求追溯

| 主编号 | 矩阵名称 | PRD 证据 | 本设计覆盖 |
|---|---|---|---|
| `FEAT-AI2-001` | 智能对话导师（AI Tutor） | §24.1 | 语言问答、语法/单词解释、水平适配、练习、追问、错误反馈、总结；§24.3 路径作为设计追溯子项 |
| `FEAT-AI2-002` | 长期学习记忆画像 | §24.2 | 5 类学习记忆、查看、编辑、删除、关闭 |
| `FEAT-AI2-003` | 动态即时句法 X 光机 | §25.1；弱点图谱 §25.2 | 主干、从句、修饰、词性、语法点、中文解释、AI 标识；弱点节点更新与解释 |
| `FEAT-AI2-004` | 雅思/托福/考研作文多维批改 | §26.1～§26.3 | 成人写作、CET/考研写作、SCI/学术英语的反馈与改写边界 |
| `FEAT-AI2-005` | 音素级流式发音评分（ASR） | §27.1～§27.3 | ASR、音素/重音/流利/停顿/节奏辅助反馈、多口音/语速/角色/情绪 TTS |
| `FEAT-AI2-006` | 跨境商务谈判沙盒 | §31.1～§31.4 | 会议、谈判、邮件、行业术语；法律/金融结论边界 |
| `FEAT-AI2-007` | 雅思口语 Part 1～3 模拟 | §33.1～§33.3 | 训练、AI 诊断、公开趋势/自研练习；非官方评分 |

以下 PRD 章节在矩阵中没有单独主 `FEAT-AI2` 行，按追溯规则采用设计专用 `SUBFEAT-AI2-*`，不宣称共享矩阵已更新：

| 追溯编号 | PRD 原子能力 | 归属/说明 |
|---|---|---|
| `SUBFEAT-AI2-001-09` | §24.3 AI 个性化路径 | 归入 AI 伴学主链；周计划、解释、调节、复习题、学习单元、用户修改 |
| `SUBFEAT-AI2-003-02` | §25.2 AI 弱点图谱 | 归入句法/学习掌握增强；来自错误、写作、AI 对话、模考 |
| `SUBFEAT-AI2-ROLEPLAY-001` | §29 实时角色扮演 | 复用语音、TTS、RTC、AI Tutor 的会话底座 |
| `SUBFEAT-AI2-DIGITALHUMAN-001` | §30 数字人 | 作为实时交互的表现层，不另造教师身份 |
| `SUBFEAT-AI2-EXAM-001` | §30.1 CET-4/CET-6 升级 | 复用既有考试 session/报告，AI 只追加反馈 |
| `SUBFEAT-AI2-EXAM-002` | §30.2 考研英语 | 长难句、手译、自研模拟、复试面试、AI 问答 |
| `SUBFEAT-AI2-EXAM-003` | §30.3 成人学习压力支持 | 节奏、鼓励、复习规划、呼吸/休息提示；不做医疗服务 |
| `SUBFEAT-AI2-OVERSEAS-001` | §32 海外生活沉浸沙盒 | 海关、租房、医疗交流、银行、交通、酒店、报警求助、Small Talk |
| `SUBFEAT-AI2-DEBATE-001` | §35 AI 辩论竞技场 | 选题、正反方、回合、总结、语言/逻辑反馈 |
| `SUBFEAT-AI2-RAG-001` | §36 RAG 知识库 | 来源、版本、分块、检索、引用、溯源、更新和授权边界 |
| `SUBFEAT-AI2-SOCIAL-001` | §37 兴趣小组与社交升级 | 好友、Friend Quest、连续学习、成就、赛季、成人小组、受控 UGC |

## 3. 统一权限、隐私、数据生命周期与成本审计

### 3.1 权限矩阵

| 动作/数据 | 学员本人 | 其他学员 | 教研编辑 | 审核/风控 | 运营/财务 |
|---|:---:|:---:|:---:|:---:|:---:|
| 自己的 AI 请求、反馈、学习记忆 | 读/写/删（按功能） | 否 | 否 | 工单授权后脱敏 | 聚合指标 |
| 其他人的原文、录音、记忆 | 否 | 否 | 否 | 最小必要、reasonCode、ticketId | 否 |
| 已发布课程/题目/模板 | 读 | 读公开内容 | 按既有 CMS 权限 | 审核 | 读摘要 |
| RAG 文档上传与版本 | 否 | 否 | 有版权凭证时写草稿 | 审核/发布 | 只读状态 |
| Prompt、模型密钥、完整安全策略 | 否 | 否 | 否 | 受限运维 | 否 |
| 成本明细 | 本人配额摘要 | 否 | 功能聚合 | 风控/运维受限 | 财务对账受限 |
| 社交举报/禁言/封禁 | 读自己的结果 | 不能越权 | 否 | 风控/社区管理员 | 只读聚合 |

### 3.2 用户控制和删除

- AI 服务首次使用前显示用途、模型/功能说明、AI 标识、数据类别、保留期限、第三方/媒体处理边界和关闭入口；非必要授权可拒绝。
- 长期记忆独立开关；关闭后不再写入新记忆，已有记忆按用户选择保留、删除或匿名化；查看/编辑/删除都写审计，不把审计原文暴露给普通运营。
- 录音上传、ASR、发音评测、RTC 实时媒体和 TTS 缓存分别征得必要同意；实时 RTC 默认不落原始音频，是否落盘必须由独立 ADR、地域和保留策略确认。
- 用户删除 AI 数据时删除索引、派生画像、缓存引用、音频对象和第三方同步副本；法律要求保留的审计仅保留匿名化 ID、时间、动作和哈希。
- AI 输出不得用于模型训练，除非未来新增明确授权、用途说明和退出机制；本设计默认不训练。

### 3.3 成本与权益

- 所有调用先过 `PHASE2_AI_QUOTA` 和功能级限额；额度不足返回 `AI_QUOTA_EXCEEDED`，不自动降级为另一个模型或隐式扣费。
- TTS 按 PRD 的固定内容缓存、动态 TTS 限额、免费层分钟数和 VIP 合理额度治理；实时 RTC 还需记录媒体时长和供应商账单键。
- 文本、RAG、写作、发音、数字人、社交审核分别看板化：请求量、成功率、超时率、重试率、降级率、token/音频量、单位估算成本、配额消耗、投诉和人工复核率。
- 预算达到软阈值时提示用户/运营；达到硬阈值时 Feature Flag 进入只读或规则降级，保留核心学习链路。

### 3.4 统一数据实体建议

以下是待在 `packages/contracts/` 与数据库迁移中冻结的设计实体，不在本次任务中创建：

| 实体 | 关键字段 | 保留/用途 |
|---|---|---|
| `ai_request` | `ai_request_id`、feature、status、model、reasoning、prompt/schema version、request/trace、timestamps | AI 请求事实、可重放索引 |
| `ai_input_snapshot` | 脱敏输入、hash、sourceRefs、consentVersion、retentionClass | 仅必要功能保留；原文分级加密 |
| `ai_output_snapshot` | 结构化输出、schema、safety result、aiLabel、accepted/reworked | 不覆盖原始学习事实 |
| `ai_prompt_version` | promptVersion、modelId、reasoningEffort、发布/回滚状态、评测集版本 | 只读版本，管理员审批 |
| `ai_cost_audit` | token、audioMs、ttsUnits、retrievalUnits、retry、estimate、billingRef | 成本、配额、对账 |
| `ai_consent` | userId、purpose、scope、version、grantedAt、revokedAt | 授权与撤回 |
| `ai_memory` | category、valueRef、sourceEventIds、userEditable、status、deletedAt | 仅学习直接相关记忆 |
| `ai_session` | sessionId、kind、state、scenario/exam/content refs、started/ended | 文字/语音/考试/辩论/社交会话 |
| `ai_audit_log` | actor、action、reasonCode、ticketId、before/after hash | 访问、删除、审核和风控 |

## 4. 公共 Schema、错误码和测试契约

### 4.1 公共输入 Schema

每个功能再定义自己的 `inputSchema`；公共上下文必须包含：

| 字段 | 类型/约束 |
|---|---|
| `schemaVersion` | 固定版本字符串 |
| `featureCode` | 已登记 `FEAT-AI2-*`/`SUBFEAT-AI2-*` |
| `targetLanguage` / `uiLocale` | 受控语言代码，不接受模型自行扩展 |
| `learningContext` | 已发布 `contentVersionId`、lesson/exercise/exam/session 引用；没有引用时显式为空 |
| `learnerProfile` | 仅已授权的水平、目标、偏好、掌握/弱点摘要；不传无关身份资料 |
| `input` | 功能专属结构化对象；禁止未声明的额外字段 |
| `consentVersion` | 需要同意时必填 |
| `idempotencyKey` | 写请求必填 |

### 4.2 公共输出 Schema

| 字段 | 类型/约束 |
|---|---|
| `schemaVersion` | 输出 Schema 版本 |
| `resultStatus` | `READY`/`DEGRADED`/`REJECTED`/`FAILED`/`CANCELED` |
| `aiGenerated` | 生成或模型解释为 `true`；规则/缓存降级如实标记 |
| `aiLabel` | 面向用户的 AI 生成/AI 辅助标识文案键 |
| `promptVersion` | 与请求和成本审计一致 |
| `modelId` / `reasoningEffort` | 固定 `gpt-5.6-luna` / `max` |
| `explanations` | 结构化证据、来源、维度或规则，不写绝对保证 |
| `warnings` | 非官方评分、法律/医疗/金融边界、版权或数据缺失提示 |
| `nextAction` | 受控动作，如 `REVIEW`、`RETRY_LATER`、`PRACTICE`、`OPEN_RULE_FEEDBACK` |

### 4.3 稳定错误码

| 错误码 | HTTP/通道 | 可重试 | 处理 |
|---|---:|:---:|---|
| `AI_FEATURE_DISABLED` | 403 | 否 | Feature Flag 关闭，回到 Phase 1 规则链路 |
| `AI_CONSENT_REQUIRED` | 403 | 否 | 展示用途和同意入口，不发送模型请求 |
| `AGE_GATE_REQUIRED` | 403 | 否 | 不开放 Phase 2 AI |
| `AI_SCHEMA_INVALID` | 502 | 否 | 丢弃模型结果，返回安全降级并告警 |
| `AI_SAFETY_BLOCKED` | 422 | 否 | 不展示原始命中内容，提供投诉/修改入口 |
| `AI_SOURCE_NOT_AUTHORIZED` | 403/422 | 否 | RAG/内容请求拒绝，不检索未授权资料 |
| `AI_QUOTA_EXCEEDED` | 429 | 否 | 显示配额状态；不切换模型 |
| `AI_UPSTREAM_TIMEOUT` | 504 | 是（限幂等） | 缓存/规则/异步降级 |
| `AI_UPSTREAM_UNAVAILABLE` | 503 | 是（限幂等） | 重试一次或安全降级 |
| `RTC_PERMISSION_DENIED` | 403 | 否 | 文字/预制脚本替代 |
| `RTC_SIGNAL_LOST` | 503 | 是 | 重连信令；不重放已消费媒体 |
| `MODEL_POLICY_VIOLATION` | 500 | 否 | 阻断请求并告警；说明未使用其他模型 |
| `OFFICIAL_SCORE_NOT_SUPPORTED` | 422 | 否 | 只展示非官方诊断/反馈 |
| `IDEMPOTENCY_CONFLICT` | 409 | 否 | 同 key 不同请求体拒绝 |

### 4.4 公共测试与上线 Gate

- Schema 正例、缺字段、额外字段、超长/敏感输入、模型输出截断、非法 JSON 和版本不兼容均有测试。
- 每项功能必须有离线评测集、promptVersion 回放、结构化解析通过率、安全拦截准确性、人工抽检、投诉闭环、成本预算、Feature Flag 一键关闭和数据删除测试。
- AI 失败时原始练习、考试、学习事件和社交举报不丢失；不把 `FAILED` 当作用户失败。
- Web/H5、iOS、Android、iPad 和小程序条件编译至少覆盖主要状态；Performance 档仍能完成文本/规则化学习目标。

## 5. FEAT-AI2-001｜AI Tutor 与 AI 个性化路径

### 5.1 主功能统一规格

- **PRD 证据**：§24.1 要求语言问答、语法/单词解释、按水平调整语言、生成练习、追问、错误反馈、学习总结；§24.3 要求 AI 与规则引擎结合制定周计划、解释推荐、调整任务、生成复习题、自动创建学习单元，且推荐可被用户修改。
- **用户目标**：用户在当前学习任务中得到可理解、可行动、与目标和已学内容相关的辅助，不被泛泛的“英语水平评价”替代。
- **前置条件**：18+、AI Tutor Flag/权益已开启、AI 数据使用同意有效、学习上下文可读取；无上下文时只能走通用语言解释，必须声明上下文缺失。
- **流程/状态机**：`OPEN → CONSENT_CHECK → SESSION_CREATED → INPUT_PRECHECK → CONTEXT_BUILD → MODEL_RUNNING → OUTPUT_SCHEMA_CHECK → SAFETY_CHECK → STREAM/DELIVER → USER_ACCEPT/REWORK/IGNORE → LEARNING_EVENT`。
- **终态**：`COMPLETED`、`DEGRADED`、`REJECTED`、`CANCELED`、`FAILED`；模型失败不改变原题答案、掌握度或课程完成状态。
- **API**：外部 api-gateway 提供 `POST /api/v1/ai/tutor/sessions`、`POST /api/v1/ai/tutor/sessions/{sessionId}/messages`、`GET /api/v1/ai/tutor/sessions/{sessionId}`、`POST /api/v1/ai/tutor/sessions/{sessionId}/close`；learning-service/assessment-service 经内部 REST/gRPC 调用 AI Orchestrator，客户端不直连模型。
- **数据**：`ai_session(kind=TUTOR)`、`ai_request`、结构化消息/结果快照、引用的 `contentVersionId`、`learning_event`、`ai_cost_audit`；原始消息与展示摘要分层，删除按用户请求级联。
- **权限/隐私**：本人 `ai:tutor:read/write`；上下文仅读取本人学习事实和已发布内容；不读取联系人、支付、设备敏感标识或未授权职业/健康信息；消息和结果必须有 AI 标识。
- **Schema**：`TutorMessageInputV1` 必须包含 `sessionId、turnId、messageType、message、learningContextRef、requestedMode`；`TutorResponseV1` 必须包含 `answer、teachingPoints[]、followUpQuestion?、exercise?、errorFeedback?、summary?、nextAction、aiGenerated、warnings[]`；消息类型用受控枚举，禁止额外字段。
- **promptVersion**：`ai2.tutor.answer.v1`；语言、解释、练习、总结可使用 `mode` 分支，但不允许客户端传入系统提示词；固定 `gpt-5.6-luna/max`。
- **超时/重试/降级**：采用公共短文本策略；首次流式响应超时或 Schema 失败时返回规则卡片、当前题目已有解析、缓存解释或“稍后重试”；不切换模型；同一 `turnId + idempotencyKey` 只产生一个结果。
- **成本审计**：按会话、turn、输入/输出 token、上下文引用数、重试和配额记录；连续追问设置会话级额度，达到上限只保留已有结果和规则练习。
- **埋点**：`ai.tutor.session_created.v1`、`ai.tutor.turn_submitted.v1`、`ai.tutor.response_delivered.v1`、`ai.tutor.followup_clicked.v1`、`ai.tutor.explanation_accepted.v1`、`ai.tutor.degraded.v1`；payload 只含 mode、contextType、latency、status、长度和 hash。
- **跨端**：Web/移动 H5 支持可取消流式分段；iOS/Android/iPad 支持输入法、朗读入口和断点；小程序采用短文本/分段结果，Performance 关闭复杂动画但保留文字反馈。
- **验收**：每类 PRD 能力至少有结构化正例；水平适配引用当前水平/目标；追问不超出课程上下文；错误反馈可定位原始题/答案；总结写入学习事件；模型失败不阻塞课程；AI 标签、删除、投诉、配额和多端恢复可验证。

#### SUBFEAT-AI2-001-01｜语言问答、语法解释与单词解释

- **PRD证据/用户目标**：§24.1 的“语言问答、解释语法、解释单词”；用户能从当前句子、词汇、语法点获得简明解释和下一步练习。
- **流程/状态机**：`QUESTION_INPUT → PRECHECK → CONTEXT_RESOLVE → ANSWER_GENERATE → STRUCTURED_CHECK → DELIVERED`；无内容引用时进入 `CONTEXT_MISSING` 并展示范围提示。
- **API/数据**：复用 `/ai/tutor/.../messages`，`requestedMode=LANGUAGE_QA|GRAMMAR_EXPLAIN|WORD_EXPLAIN`；结果保存 `grammarPointId/vocabId/sentenceId?`、解释版本和用户采纳事件，不复制词库事实。
- **权限隐私/Schema**：本人学习权限；输入只含当前学习对象和用户问题；输出为 `explanation、examples[]、contrast?、relatedIds[]、nextAction`，不返回内部 prompt/答案密钥。
- **promptVersion/超时重试降级**：`ai2.tutor.explain.v1`；8 秒/最多一次幂等重试；失败时返回已发布规则卡、词典或语法卡片，标记非 AI 降级。
- **成本/埋点/跨端**：按模式和引用对象计费；埋点 `ai.tutor.explain_opened.v1`；Web 多栏、移动抽屉、小程序静态卡片，四档均可用。
- **验收**：同一问题在有/无课程上下文时输出边界不同；解释含目标语言与界面语言；不得把不确定答案写成绝对正确；用户可关闭/删除会话。

#### SUBFEAT-AI2-001-02｜水平自适应与错误反馈

- **PRD证据/用户目标**：§24.1 要求根据用户水平调整语言并提供错误反馈；用户能知道错在哪里、如何重做，而不是只收到分数。
- **流程/状态机**：`ANSWER_OR_ATTEMPT_RECEIVED → MASTERY_CONTEXT_READ → FEEDBACK_GENERATE → EVIDENCE_CHECK → USER_RETRY`；原始规则判分先落库，AI 反馈后写追加记录。
- **API/数据**：`POST /api/v1/ai/tutor/feedback`，输入 `attemptId、ruleFeedbackRef、levelSnapshot`；输出 `errorType、why、correction、retryPrompt、confidenceNote`，与 `attemptId` 一对多版本化。
- **权限隐私/Schema**：只读本人 attempt；不允许 AI 覆盖 `score/masteryStatus`；Schema 要求每条反馈绑定错误证据或 `evidenceUnavailable=true`。
- **promptVersion/超时重试降级**：`ai2.tutor.error-feedback.v1`；短文本预算；失败时展示既有规则错因字典和靶向练习，不生成未经证据支持的原因。
- **成本/埋点/跨端**：按反馈条数与 token 记录；埋点 `ai.tutor.error_feedback_viewed.v1`、`ai.tutor.retry_started.v1`；移动端支持屏幕阅读器和局部更新。
- **验收**：AI 不改变原始得分；反馈能回到错误题/语法点；水平高低改变解释术语和长度但不改变事实；失败仍可完成重做。

#### SUBFEAT-AI2-001-03｜生成练习与追问

- **PRD证据/用户目标**：§24.1 的“生成练习、追问”；用户可在当前薄弱点上继续做一小步练习。
- **流程/状态机**：`REQUEST_EXERCISE → PRECHECK_SCOPE → GENERATE → CONTENT_SAFETY → SCHEMA_VALIDATE → USER_PREVIEW → START/DECLINE`；未通过审核的题目不进入学习事实。
- **API/数据**：`POST /api/v1/ai/tutor/exercises`、`POST /api/v1/ai/tutor/exercises/{exerciseId}/attempts`；AI 题目使用独立 `aiGeneratedContentId`，引用 `grammarPointId/vocabId`，不会覆盖教研题库。
- **权限隐私/Schema**：本人学习上下文和配额；输入限定目标、难度、题型、数量；输出 `exerciseType、prompt、options?、answerProtectionRef、explanation、sourceContext、aiLabel`，标准答案只在服务端保存。
- **promptVersion/超时重试降级**：`ai2.tutor.exercise.v1`；异步生成可返回 202；超时改为既有规则题包/错题包；不得以模型题目更新官方题库。
- **成本/埋点/跨端**：按生成题数、输出 token 和用户实际开始数计费；埋点 `ai.tutor.exercise_generated.v1`、`ai.tutor.exercise_started.v1`、`ai.tutor.exercise_abandoned.v1`；Performance 使用静态题型组件。
- **验收**：题目与目标弱点绑定；答案保护有效；生成题安全审核、AI 标识、可举报；用户未开始/放弃不计入掌握；失败使用合法预制题。

#### SUBFEAT-AI2-001-04｜学习总结与用户采纳

- **PRD证据/用户目标**：§24.1 的“学习总结”；用户在会话/任务结束时看到已完成内容、仍需复习内容和下一步。
- **流程/状态机**：`SESSION_CLOSE_REQUEST → FACTS_AGGREGATED → SUMMARY_GENERATE → POSTCHECK → DISPLAYED → ACCEPTED/IGNORED`；总结只能引用已落库学习事件。
- **API/数据**：`POST /api/v1/ai/tutor/sessions/{sessionId}/summary`；保存 `sourceEventIds、summaryVersion、acceptedAt?`，不把摘要当作掌握事实。
- **权限隐私/Schema**：本人会话；输出 `completedItems[]、weakItems[]、reviewActions[]、whatNext、limitations[]`，所有结论绑定证据 ID。
- **promptVersion/超时重试降级**：`ai2.tutor.summary.v1`；超时返回规则日报/待复习列表；重试不重复计费或产生第二份默认总结。
- **成本/埋点/跨端**：会话关闭才生成，控制重复成本；埋点 `ai.tutor.summary_opened.v1`、`ai.tutor.summary_action_clicked.v1`；Web 可导出结构化摘要，移动/小程序显示卡片。
- **验收**：总结不声称官方等级；没有学习事实时显示“数据不足”；用户采纳只产生学习计划建议事件，不直接改掌握度；删除会话后摘要不可再展示。

#### SUBFEAT-AI2-001-09｜AI 个性化路径

- **PRD证据/用户目标**：§24.3；用户希望得到周计划、推荐理由、调整任务、自动复习题和学习单元，同时保有修改权。
- **流程/状态机**：`PATH_REQUESTED → RULE_BASELINE_BUILT → AI_RECOMMENDED → SAFETY/SCHEMA_CHECK → DRAFT → USER_EDITED/ACCEPTED → ACTIVE → PAUSED/COMPLETED`；规则引擎是基线，AI 只解释和补充。
- **API/数据**：`GET /api/v1/ai/learning-paths/current`、`POST /api/v1/ai/learning-paths/drafts`、`PATCH /api/v1/ai/learning-paths/{pathId}`、`POST /api/v1/ai/learning-paths/{pathId}/activate`；复用既有 `study_plan/task` 实体，写 `source=AI_ASSISTED`、`ruleSnapshot`、`userEditDiff`。
- **权限隐私/Schema**：本人读写；输入为目标、时长、水平、SRS/弱点摘要；输出 `weekPlan、reason[]、tasks[]、generatedReviewRefs[]、generatedUnitDraft?、editable=true`；不得将职业背景作为默认输入。
- **promptVersion/超时重试降级**：`ai2.learning-path.plan.v1`；候选 15 秒，超时返回规则计划；重试使用同一 `planRequestId`；推荐不自动生效。
- **成本/埋点/跨端**：按计划生成/改写和任务数计费；埋点 `ai.path_draft_created.v1`、`ai.path_reason_opened.v1`、`ai.path_edited.v1`、`ai.path_activated.v1`；iPad/Web 支持拖拽，移动/小程序支持列表编辑。
- **验收**：用户可逐项改时间、任务和顺序；AI 解释与目标/历史事实一致；规则基线不足时仍有可用计划；AI 失败不影响既有计划；激活前显示 AI 辅助标识。

## 6. FEAT-AI2-002｜长期学习记忆画像（Long Memory）

### 6.1 主功能统一规格

- **PRD 证据**：§24.2 仅记录与学习直接相关的信息：已掌握词汇、薄弱语法、学习目标、常见错误、喜欢的学习方式；用户可查看、编辑、删除、关闭长期记忆。矩阵还写有“职业背景”，与 PRD 明列范围不完全一致，见 §21.2 未决项。
- **用户目标**：用户清楚知道 AI 记住了哪些学习信息，并能控制这些信息是否用于后续 AI 学习。
- **流程/状态机**：`SIGNAL_COLLECTED → LEARNING_RELEVANCE_FILTER → MEMORY_CANDIDATE → CONSENT/FLAG_CHECK → ACTIVE → VIEWED/EDITED → DELETED`；关闭后新信号只保留短期会话上下文，不生成长期记忆。
- **API**：`GET /api/v1/ai/memories`、`PATCH /api/v1/ai/memories/{memoryId}`、`DELETE /api/v1/ai/memories/{memoryId}`、`POST /api/v1/ai/memories/disable`、`POST /api/v1/ai/memories/enable`；iam-service/learner-service 承担用户隔离、审计和删除，AI Orchestrator 只接收必要摘要。
- **数据**：`ai_memory` 存类别、规范化值引用、来源事件、版本、状态、用户编辑、创建/更新时间和删除时间；原始对话/作文不直接作为长期记忆值；引用的 `grammarPointId/vocabId/learningGoalId` 使用 canonical ID。
- **权限/隐私**：本人可见/改/删/关；管理员默认不可见原值，工单授权后查看脱敏摘要；不记录健康、财务、家庭、联系人、政治/宗教等无关资料；职业背景暂不落库。
- **Schema**：`MemoryRecordV1` 的 `category` 限定 `MASTERED_VOCAB、WEAK_GRAMMAR、LEARNING_GOAL、COMMON_ERROR、PREFERRED_STYLE`；包含 `valueRef/valueSummary、sourceEventIds、status、userEditable、consentVersion`；写入请求不接受未声明 category。
- **promptVersion**：`ai2.memory.extract.v1`、`ai2.memory.context-project.v1`；模型只提出候选和学习解释，最终落库由 iam-service/learner-service 的规则与权限决定；固定 `gpt-5.6-luna/max`。
- **超时/重试/降级**：记忆提取异步化优先；超时/Schema 失败丢弃候选，不影响学习事件；关闭或撤回同意时立即停止向模型发送长期记忆，重试按 eventId 幂等。
- **成本审计**：按候选提取、上下文注入 token、删除/重建任务计费；看板区分“提取请求”和“实际被 Tutor 使用”，避免重复计费。
- **埋点**：`ai.memory.candidate_created.v1`、`ai.memory.viewed.v1`、`ai.memory.edited.v1`、`ai.memory.deleted.v1`、`ai.memory.disabled.v1`、`ai.memory.context_used.v1`；不带记忆原值。
- **跨端**：四端个人中心/隐私中心提供统一入口；移动/小程序使用分页卡片和批量关闭，Web/iPad 提供筛选和逐条编辑；Performance 不影响记忆管理，只关闭复杂动画。
- **验收**：开关关闭后无新长期记忆；删除后 Tutor 不再读取；查看显示来源和更新时间；编辑限制在学习类别；同一事件重复消费不产生重复记忆；数据导出/注销覆盖记忆和派生缓存。

#### SUBFEAT-AI2-002-01｜学习记忆类别与来源归并

- **PRD证据/用户目标**：§24.2 的五类学习信息；用户可以把“我会什么、哪里弱、为何学习、常错什么、喜欢怎样学”看成可解释条目。
- **流程/状态机**：规则事件先生成 `SIGNAL`，模型只做候选归类和简短解释；`SIGNAL → CANDIDATE → MERGED/REJECTED`，相同 canonical ID 使用版本化合并。
- **API/数据**：内部消费 `learning.mastery.changed`、`grammar.weakness.changed`、`ai.tutor.feedback.created` 等事件；对外 `GET /ai/memories` 返回 `sourceEventIds` 和 `lastObservedAt`。
- **权限隐私/Schema**：只接收学习事件摘要；输出必须是五类枚举之一，`valueRef` 优先于自由文本；拒绝无学习来源的候选。
- **promptVersion/超时重试降级**：`ai2.memory.extract.v1`；异步候选超时丢弃；规则分类可作为降级，不标为模型记忆。
- **成本/埋点/跨端**：按事件批量归并降低 token；`ai.memory.merge_completed.v1` 只上报类别/数量；所有端显示“来源学习记录”。
- **验收**：同一词汇/语法点合并可回放；来源被删除时记忆进入 `SOURCE_REMOVED` 或删除；不能从闲聊推断非学习隐私。

#### SUBFEAT-AI2-002-02｜记忆查看、编辑与删除

- **PRD证据/用户目标**：§24.2 明确用户可查看、编辑、删除；控制台行为必须是可确认、可回滚（编辑）或不可逆（删除）提示。
- **流程/状态机**：`VIEW → EDIT_DRAFT → VALIDATE → UPDATED`；删除 `DELETE_REQUESTED → HIDDEN → PURGE_QUEUED → PURGED/RETRY`；同一操作幂等。
- **API/数据**：复用 `GET/PATCH/DELETE /api/v1/ai/memories/{memoryId}`，删除使用 `Idempotency-Key`；记录 before/after hash，不在审计写原值。
- **权限隐私/Schema**：本人和已授权数据导出；编辑只能改变允许字段/类别；`MemoryPatchV1` 需要 `expectedVersion` 防并发覆盖。
- **promptVersion/超时重试降级**：用户管理动作不调用模型；删除任务失败可重试，页面显示删除中；不以模型状态作为删除完成凭证。
- **成本/埋点/跨端**：删除/编辑不扣 AI 生成额度；埋点记录动作结果和耗时；移动/小程序提供清晰不可逆确认，Web 支持批量。
- **验收**：越权 memoryId 返回 404/403；并发编辑返回版本冲突；删除后上下文投影、缓存、索引不再命中；审计可证但不泄露原值。

#### SUBFEAT-AI2-002-03｜长期记忆开关与同意撤回

- **PRD证据/用户目标**：§24.2 的“关闭长期记忆”和 Phase 2 前置条件“AI 数据使用授权”。
- **流程/状态机**：`ENABLED → DISABLE_REQUESTED → DISABLED`；关闭即时阻断新写入和上下文注入，已有记录按用户选择保留或清除；重新开启不自动恢复已删数据。
- **API/数据**：`POST /api/v1/ai/memories/disable|enable`、`GET /api/v1/ai/consents`；保存 scope、version、revokedAt 和客户端确认。
- **权限隐私/Schema**：必须是本人会话；`MemoryControlRequestV1` 只允许 `scope=LONG_TERM_LEARNING_MEMORY`；不得用模糊“全部 AI”替代具体用途说明。
- **promptVersion/超时重试降级**：开关变更不调用模型；状态写入失败时 fail-closed，AI Tutor 只用当前回合输入和规则上下文。
- **成本/埋点/跨端**：撤回后停止记忆 token 成本；埋点 `ai.memory.consent_changed.v1`；所有端状态最终一致但本地 UI 先显示已关闭。
- **验收**：关闭后并发到达的事件不写长期记忆；跨设备读取一致；撤回/重新授权版本可追踪；删除/导出符合用户选择。

#### SUBFEAT-AI2-002-10｜“职业背景”范围冲突记录（不作为已实现需求）

- **PRD证据/用户目标**：`requirements/feature-matrix.md` FEAT-AI2-002 描述“职业背景”，但 PRD §24.2 的可记录清单未列职业背景；本节只记录冲突，不新增需求。
- **流程/状态机**：任何职业背景输入进入 `UNRESOLVED_SCOPE → NOT_PERSISTED`；可在当前会话临时使用仅当用户主动提供且功能目的明确，回合结束清除。
- **API/数据**：当前 API 不接受 `professionalBackground` 长期字段；如未来确认，必须先补 PRD、隐私目的/同意、字段字典、删除策略和矩阵映射。
- **权限隐私/Schema**：Schema `additionalProperties=false`，遇到该字段返回 `MEMORY_SCOPE_UNSUPPORTED`，不得静默保存。
- **promptVersion/超时重试降级**：不调用模型进行职业推断；降级为目标/水平/学习任务上下文。
- **成本/埋点/跨端**：记录 `scopeConflict=true` 的匿名计数；端上显示“当前长期记忆仅包含学习信息”。
- **验收**：扫描数据库和输出确认无职业背景长期字段；矩阵冲突在审计报告可定位；后续决策有新增 ADR/PRD 证据。

## 7. FEAT-AI2-003｜AI 长难句、即时句法 X-Ray 与弱点图谱

### 7.1 主功能统一规格

- **PRD 证据**：§25.1 要求任意英文输入自动划分主干、从句、修饰、词性、语法点和中文解释，并标识“AI生成”；§25.2 要求基于用户错误、自由写作、AI 对话、模考更新弱项节点。
- **用户目标**：用户能看懂任意输入句子的结构，并知道重复错误如何影响自己的弱点图谱；图谱是学习解释，不是官方诊断。
- **流程/状态机**：X-Ray `INPUT → PRECHECK → TOKENIZE/ANALYZE → DAG_VALIDATE → POSTCHECK → RENDER → SAVE/DELETE`；弱点 `SIGNAL_EVENT → NORMALIZE → AI_ENRICH → MERGE → EXPLAIN → RECOMMEND`。
- **API**：`POST /api/v1/ai/syntax/xray`、`GET /api/v1/ai/syntax/xray/{analysisId}`、`GET /api/v1/ai/weaknesses`、`GET /api/v1/ai/weaknesses/{grammarPointId}`；弱点更新由 learning-service/assessment-service 事件驱动，不由客户端直接改节点。
- **数据**：X-Ray 使用 `analysisId、sentenceHash、token/slice/node/edge、grammarPointId、contentVersionId?`；弱点使用既有 `grammar_point_id` 和掌握模型扩展投影，记录 `signalSource、evidenceRef、weaknessRuleVersion`。
- **权限/隐私**：用户只能看本人自由输入分析和弱点；输入句子原文按短期/用户删除策略保存；公开课程 X-Ray 必须绑定已发布内容；敏感/个人信息先拦截或脱敏。
- **Schema**：`SentenceXrayInputV1` 为 `text、uiLocale、targetLanguage、contextRef?`；`SentenceXrayOutputV1` 为 `tokens[]、slices[]、nodes[]、edges[]、translationCn?、grammarPoints[]、aiGenerated=true、warnings[]`；DAG 无环、范围合法、节点引用存在。
- **promptVersion**：`ai2.syntax.xray.v1`、`ai2.weakness.enrich.v1`；固定 `gpt-5.6-luna/max`；输出必须通过 Pydantic/Zod 等价 Schema 后再进入 Vue Flow/图谱。
- **超时/重试/降级**：X-Ray 候选 8 秒、复杂句转异步；解析失败返回 token 化/既有预制 X-Ray 或规则语法卡，不伪造完整 DAG；弱点 AI 失败沿用规则版节点。
- **成本审计**：按字符/token、图节点边数和弱点重算次数；重复 sentenceHash 可缓存但必须记录缓存命中与内容版本。
- **埋点**：`ai.syntax.analysis_started.v1`、`ai.syntax.analysis_ready.v1`、`ai.syntax.node_expanded.v1`、`ai.weakness.signal_merged.v1`、`ai.weakness.explanation_opened.v1`、`ai.syntax.degraded.v1`。
- **跨端**：Web/iPad 可用 Vue Flow/WebGL；移动采用可折叠树；小程序/Performance 用 2D 列表/SVG；不因图形加载失败阻塞原句阅读和规则练习。
- **验收**：任意英文句能返回结构化或明确失败；主干/从句/修饰/词性/语法点/中文解释有独立字段；AI 标识始终存在；DAG 无环；弱点每个节点可追溯到四类来源；删除自由输入不影响匿名聚合指标。

#### SUBFEAT-AI2-003-01｜动态即时句法 X-Ray

- **PRD证据/用户目标**：§25.1 的任意英文输入和六类结构化结果；用户能按 token、切片、节点查看句法。
- **流程/状态机**：`DRAFT → SUBMITTED → ANALYZING → VALIDATING → READY/DEGRADED`；客户端可取消，服务端仍保存可回放的状态而不保存半截结果为 READY。
- **API/数据**：`POST /ai/syntax/xray` 返回 `analysisId`；`GET` 支持状态和分页/分层读取；存储 `tokenOrdinal、charRange、sliceRange、nodeType、edgeType、grammarPointId`，与现有 X-Ray DAG 语义一致。
- **权限隐私/Schema**：本人自由输入；公开内容必须 `contentVersionId`；输出 `additionalProperties=false`、半开 token 范围、edge 拓扑排序、`aiLabel`。
- **promptVersion/超时重试降级**：`ai2.syntax.xray.v1`；最多一次幂等重试；失败显示规则化词性/预制切片或“结构分析暂不可用”。
- **成本/埋点/跨端**：记录缓存命中、token/node 数、耗时；埋点展开/折叠不带原文；低配设备只渲染当前层级。
- **验收**：长句、标点、嵌套从句和未知词均有合法错误态；无环/越界/孤儿节点被拒绝；颜色不是唯一语义；可复制/删除结果但不默认公开。

#### SUBFEAT-AI2-003-02｜AI 弱点图谱

- **PRD证据/用户目标**：§25.2；来源为用户错误、自由写作、AI 对话、模考，用户需要解释“为什么弱”和下一步复习。
- **流程/状态机**：`SOURCE_SIGNAL_RECEIVED → NORMALIZED → NODE_MATCHED → AI_EXPLAINED → MERGED → RECOMMENDATION_CREATED`；AI 解释失败仍保留规则信号和原始来源。
- **API/数据**：`GET /api/v1/ai/weaknesses` 返回节点/维度/证据；内部消费 `attemptId、writingSubmissionId、aiSessionId、examSessionId`；不创建第二套 `grammarPointId`。
- **权限隐私/Schema**：仅本人；`WeaknessNodeV1` 必须含 `grammarPointId、signalSources[]、scoreBand、evidenceRefs[]、ruleVersion、lastUpdatedAt`；模型不能直接写分数。
- **promptVersion/超时重试降级**：`ai2.weakness.enrich.v1`；按批异步，单节点失败可重试；完全失败使用既有六维规则版解释。
- **成本/埋点/跨端**：按批次和节点数计费；`ai.weakness.updated.v1` 只传节点 ID/来源类型/数量；Web 雷达、移动列表、小程序 2D 分组。
- **验收**：四类来源均可触发；同一来源事件幂等；AI 解释不得宣称医学/官方诊断；用户删除原始自由输入后，节点不再展示可回溯原文。

## 8. FEAT-AI2-004｜AI 成人写作、考试写作与学术英语

### 8.1 主功能统一规格

- **PRD 证据**：§26.1 要求语法检查、用词改进、逻辑建议、句式升级、改写、中式英语提示、多版本对比；§26.2 要求 CET/考研自研题目、AI 反馈、结构分析、词汇建议、参考评分维度；§26.3 要求 SCI/学术措辞、语法、表达精炼、逻辑衔接、风格提示，并明确不代写论文、不伪造数据、不帮助学术不端、用户对最终内容负责。
- **用户目标**：用户得到可定位、可选择、可重做的语言反馈；正式考试/学术场景中，AI 只提供辅助分析和候选改写，不冒充阅卷人、编辑或合作者。
- **前置条件**：写作任务/提交已存在或用户主动输入并同意；内容、题目、模板和素材须是已发布或用户本人有权使用；AI Flag、权益和安全 Gate 已开启。
- **流程/状态机**：`DRAFT → SUBMITTED → PRECHECK → REVIEWING → DIMENSION_CHECK → SAFETY/ACADEMIC_CHECK → READY → USER_ACCEPT/COMPARE/REWORK`；异步长文为 `QUEUED/PROCESSING`，不覆盖原提交。
- **API**：`POST /api/v1/ai/writing/reviews`、`GET /api/v1/ai/writing/reviews/{reviewId}`、`POST /api/v1/ai/writing/reviews/{reviewId}/rewrites`、`POST /api/v1/ai/writing/reviews/{reviewId}/compare`；既有 `/api/v1/writing/submissions` 仍是原始提交事实源。
- **数据**：`writingSubmissionId、taskType、contentVersionId、reviewId、dimensionBreakdown、issue[]、rewriteVariant[]、promptVersion、aiLabel、acceptedVariant?`；原文与 AI 结果分开保留，任何改写都不能替换原文。
- **权限/隐私**：本人写作读写；学术文稿默认私密；管理员仅在投诉/安全/质量工单授权时看脱敏片段；不把用户作文用于训练；涉及论文、实验或个人信息的输入先提示用户自行脱敏。
- **Schema**：`WritingReviewInputV1` 为 `submissionId?、text、taskType、targetLevel、rubricMode、locale、requestedOutputs[]`；`WritingReviewOutputV1` 为 `issues[]、strengths[]、dimensionFeedback[]、rewriteVariants[]、scoreEstimate?、officialScore=false、academicSafetyWarnings[]、aiGenerated=true`；所有 issue 必须含 span/证据或 `spanUnavailable`。
- **promptVersion**：`ai2.writing.adult-review.v1`、`ai2.writing.exam-review.v1`、`ai2.writing.academic-review.v1`；固定 `gpt-5.6-luna/max`；任务类型、评分维度、学术边界作为版本化配置。
- **超时/重试/降级**：短文候选 8 秒，长文 15 秒后转 202；Schema/安全失败返回规则检查、模板采分点和“部分反馈”；同一提交+模式幂等；绝不以另一个模型补齐。
- **成本审计**：记录字符/token、反馈维度、改写版本数、长文异步时长、重试和用户采纳；多版本比较单独计量；配额不足先阻止生成，不偷偷截断关键反馈。
- **埋点**：`ai.writing.review_started.v1`、`ai.writing.review_ready.v1`、`ai.writing.issue_opened.v1`、`ai.writing.rewrite_requested.v1`、`ai.writing.variant_accepted.v1`、`ai.writing.academic_warning.v1`、`ai.writing.degraded.v1`。
- **跨端**：Web/iPad 支持双栏原文/批注/对比；移动使用逐条批注和横向版本切换；小程序/Performance 先显示纯文本与定位标记，不依赖复杂编辑器；键盘、触摸、屏幕阅读器均可操作。
- **验收**：原文不可被覆盖；语法/词汇/逻辑/句式/中式英语/多版本均可定位；CET/考研仅展示参考维度；SCI 场景拦截代写、伪造数据和学术不端请求；结果带 AI 标识、局限说明、重试/删除/投诉入口。

#### SUBFEAT-AI2-004-01｜成人写作助手

- **PRD证据/用户目标**：§26.1；用户希望发现语法、用词、逻辑和中式英语问题，并选择升级句式、改写或多个版本。
- **流程/状态机**：`TEXT_INPUT → ISSUE_DETECT → EVIDENCE_BIND → SUGGESTION_READY → VARIANT_GENERATE? → USER_COMPARE/ACCEPT`；建议和改写分开请求，避免无意替换原文。
- **API/数据**：`POST /ai/writing/reviews` 的 `taskType=ADULT_GENERAL`，`requestedOutputs=GRAMMAR,WORDING,LOGIC,SENTENCE_UPGRADE,REWRITE,CHINGLISH_HINT,VARIANTS`；保存每个 `spanStart/spanEnd`、原句、建议理由和版本。
- **权限隐私/Schema**：本人；不得输出“绝对正确”；`issueType` 受控，`replacement` 可为空并必须附理由/风险提示。
- **promptVersion/超时重试降级**：`ai2.writing.adult-review.v1`；8 秒/一次幂等重试；失败用规则拼写/语法检查、既有模板或只返回问题定位。
- **成本/埋点/跨端**：按 requestedOutputs 计量；埋点区分查看建议和采纳改写；移动端逐句卡片、Web 批注层、小程序文本列表。
- **验收**：同一 span 的原句和改写并列；多版本差异可见；用户未点击采纳不改变提交；“中式英语”显示为学习提示而非身份标签。

#### SUBFEAT-AI2-004-02｜CET-4/CET-6 与考研写作反馈

- **PRD证据/用户目标**：§26.2、§30.1、§30.2；用户需要自研任务中的结构、词汇、翻译/作文反馈和参考维度，不能误认为真题官方阅卷。
- **流程/状态机**：`EXAM_TASK_BOUND → SUBMISSION_SAVED → AI_FEEDBACK → RUBRIC_REFERENCE_CHECK → REPORT_READY`；考试总分/规则分数先由既有考试引擎保存，AI 报告追加。
- **API/数据**：`POST /api/v1/ai/exam-writing/reviews`，输入 `examCode=CET4|CET6|POSTGRAD、examSessionId?、writingSubmissionId、rubricVersion`；输出 `structure、vocabulary、grammar、translation?、referenceDimensions、scoreEstimate?`。
- **权限隐私/Schema**：本人考试/自研题；`officialScore=false`、`referenceOnly=true` 必填；不得返回未授权真题原文或官方评分接口声称。
- **promptVersion/超时重试降级**：`ai2.writing.exam-review.v1`；失败回到既有规则采分点、模板和错误分类；不重算考试事实。
- **成本/埋点/跨端**：按考试代码、文章长度和维度计费；埋点 `ai.exam.writing_feedback_opened.v1`；Web 报告表格、移动雷达卡、小程序分页。
- **验收**：CET/考研报告带参考/非官方说明；考试成绩在 AI 失败时不变；结构/词汇/语法字段可独立验证；考研长难句/手译入口可链接到既有练习。

#### SUBFEAT-AI2-004-03｜SCI/学术英语辅助

- **PRD证据/用户目标**：§26.3；用户希望学术措辞、语法、精炼、逻辑衔接和风格提示，但不让系统代写或制造学术事实。
- **流程/状态机**：`ACADEMIC_INPUT → ACADEMIC_SCOPE_CHECK → LANGUAGE_REVIEW → INTEGRITY_CHECK → READY/REJECTED`；发现代写/伪造数据请求直接拒绝相关输出，但可提供一般语言学习建议。
- **API/数据**：`POST /api/v1/ai/writing/academic-reviews`、`POST /api/v1/ai/writing/academic-reviews/{reviewId}/rewrite`；输入 `purpose=LANGUAGE_EDITING`、引用/数据声明可选但不作为事实来源；存学术安全结果。
- **权限隐私/Schema**：本人私密文稿；输出 `academicStyle、grammar、conciseness、cohesion、register、integrityWarnings`；禁止 `generateFullPaper、fabricateData、inventCitation` 等模式。
- **promptVersion/超时重试降级**：`ai2.writing.academic-review.v1`；失败只返回规则检查/用户已提供文本的局部建议；不可用时不生成整段替代文本。
- **成本/埋点/跨端**：大文档转异步，按段/字符/版本审计；埋点只记录安全结果与操作类型，不记录论文原文；Web 优先，移动/小程序只支持短段落。
- **验收**：代写、伪造数据、伪造引用被阻断并有说明；用户对最终内容负责；改写只对用户选定 span；不宣称同行评审或发表保证；删除后派生版本和缓存均清除。

## 9. FEAT-AI2-005｜ASR、发音辅助评测与 TTS

### 9.1 主功能统一规格

- **PRD 证据**：§27.1 要求实时语音识别、口语转写、错词识别；§27.2 要求音素、重音、流利度、停顿、节奏的辅助反馈，不包装成官方考试评分；§27.3 要求多口音、语速、角色、情绪 TTS，以及固定内容预生成缓存、动态 TTS 限额、免费分钟数和 VIP 合理额度。
- **用户目标**：用户能听见、说出、看见可操作的语言反馈，并在权限、弱网、低配或配额受限时仍能完成不依赖 AI 的学习。
- **媒体架构**：实时语音必须走商业 RTC/信令（声网或腾讯云 TRTC 需新增 ADR 冻结），媒体平面不使用 HTTP 轮询；iam-service/realtime-voice 签发受限 token，AI Orchestrator 消费脱敏音频特征/分段结果。ASR/TTS 具体供应商和模型能力未在 PRD 冻结；在确认 `gpt-5.6-luna` 可提供相应模态前，不能以其他模型代替。
- **流程/状态机**：`CREATE → CONSENT_CHECK → PERMISSION_GRANTED → RTC_JOINED/LOCAL_RECORD → LISTENING → PARTIAL_TRANSCRIPT → FINAL_TRANSCRIPT → EVALUATING → POSTCHECK → FEEDBACK_READY → CLOSE`；中断/断网走 `RECONNECTING`，媒体未完成不伪造完整结果。
- **API/通道**：`POST /api/v1/ai/voice/sessions`、`GET /api/v1/ai/voice/sessions/{sessionId}`、`WSS /api/v1/ai/voice/sessions/{sessionId}/events`（控制/事件，不承载轮询）；`POST /api/v1/ai/voice/evaluations`；`POST /api/v1/ai/voice/tts`；固定内容由内容/媒体 Worker 预生成并缓存。
- **数据**：`ai_voice_session、voice_segment、asr_transcript、pronunciation_feedback、tts_asset_ref、recording_consent、ai_cost_audit`；原始录音对象与分析结果分开；音频只通过短期签名地址访问。
- **权限/隐私**：麦克风权限、录音同意、AI/第三方媒体处理说明分别管理；默认不落盘实时原音；用户可删除录音、转写和发音报告；事件不含音频二进制、原文或密钥。
- **Schema**：`VoiceSessionInputV1` 为 `mode、targetText?、scenarioId?、language、consentVersion、rtcCapability`；`AsrSegmentV1` 为 `segmentId、startMs、endMs、transcript、isFinal、confidence?、wordErrors[]`；`PronunciationFeedbackV1` 为 `phoneme[]、stress[]、fluencyBand、pause[]、rhythmBand、limitations[]`；`TtsRequestV1` 为 `textRef/text、accent、rate、role、emotion、cachePolicy`，均禁止额外字段。
- **promptVersion**：`ai2.voice.asr.v1`、`ai2.voice.pronunciation.v1`、`ai2.voice.tts.v1`；固定模型参数 `gpt-5.6-luna/max`；如某媒体能力不支持该模型，保持 Flag 关闭/返回替代，不路由其他模型。
- **超时/重试/降级**：按公共流式语音/TTS策略；RTC 只重连信令或重新签发 token，不重放已消费音频；ASR/评分失败转文本输入、用户自评、预编台词和基础音频；TTS 失败用固定缓存、系统朗读或文字。
- **成本审计**：记录会话/媒体毫秒、ASR 分段数、评测次数、TTS 字符/分钟、缓存命中、RTC 房间/供应商账单键、重试和配额；免费层与 VIP 分开汇总。
- **埋点**：`ai.voice.permission_result.v1`、`ai.voice.session_created.v1`、`ai.voice.transcript_partial.v1`（只含长度/序号）、`ai.voice.transcript_final.v1`、`ai.voice.pronunciation_ready.v1`、`ai.voice.tts_played.v1`、`ai.voice.degraded.v1`、`ai.voice.recording_deleted.v1`。
- **跨端**：App/H5/Web 按平台权限；iPad 横屏提供波形/文本双栏；小程序只在平台与审核允许时使用能力，不可用则 2D/文字；Performance 不加载 RTC 可视化、波形或数字人，但保留基础音频/文本练习。
- **验收**：权限拒绝不阻塞静音学习；部分/最终转写状态正确；发音反馈明确“辅助”且无官方分数；TTS 口音/语速/角色/情绪字段有效或明确不支持；固定内容缓存可命中；动态 TTS 有额度；删除使 URL/对象/引用失效；不使用 HTTP 轮询。

#### SUBFEAT-AI2-005-01｜实时 ASR 与口语转写

- **PRD证据/用户目标**：§27.1；用户在跟读、角色扮演、考试口语中看到增量转写和错词提示。
- **流程/状态机**：`RTC_JOINED → AUDIO_CHUNKED → PARTIAL → FINAL → WORD_ERROR_RECOGNIZED → DISPLAYED`；Barge-in/静音时保留 segment 序号，不回写重复文本。
- **API/数据**：RTC 媒体走商业服务；事件通道推送 `partial/final`；realtime-voice/assessment-service 以 `sessionId、segmentId、audioHash、targetTextRef` 持久化转写摘要和错误 span。
- **权限隐私/Schema**：需 `recording:write`/`ai:voice` 和同意版本；`AsrSegmentV1` 不允许返回密钥/供应商内部字段；原始音频不进入事件。
- **promptVersion/超时重试降级**：`ai2.voice.asr.v1`；首包/单轮预算按公共策略；断线重连不重放已完成段；失败回退本地输入、预制字幕或用户自评。
- **成本/埋点/跨端**：按音频毫秒/段计量；只上报 segment 数/延迟/状态；H5/App/Web 有权限替代，小程序禁用时显示输入框。
- **验收**：增量结果最终收敛；错词定位与目标文本可比；静音/断网/重复事件幂等；不把 ASR 置信度当作考试分数；删除后转写不可查询。

#### SUBFEAT-AI2-005-02｜音素、重音、流利度、停顿与节奏辅助反馈

- **PRD证据/用户目标**：§27.2；用户想知道具体发音可改进之处，而不是被包装成官方评分。
- **流程/状态机**：`FINAL_AUDIO → ALIGN_TARGET → EVALUATE → EVIDENCE_CHECK → FEEDBACK_READY`；音频/目标不匹配时 `INSUFFICIENT_EVIDENCE`。
- **API/数据**：`POST /api/v1/ai/voice/evaluations`，输入 `transcriptSegmentIds、targetTextRef、evaluationDimensions[]`；输出音素/重音/流利/停顿/节奏 band 和示例练习，不改考试成绩。
- **权限隐私/Schema**：本人录音/转写；`PronunciationFeedbackV1` 强制 `isAuxiliary=true、officialScore=false、confidence/limitations`；原始音频引用不公开。
- **promptVersion/超时重试降级**：`ai2.voice.pronunciation.v1`；评测失败返回“证据不足”与跟读/音标练习，不猜测发音错误；不切换模型。
- **成本/埋点/跨端**：按评测秒数/维度计量；埋点只记维度和 band；Performance 显示文字/音标，Medium 用静态口腔图，不加载 3D。
- **验收**：五类维度字段齐全或明确 unavailable；用户可查看证据音频片段/删除；结果文案含辅助和局限；不产生“官方分/通过证书”；同一音频重复评测幂等。

#### SUBFEAT-AI2-005-03｜多口音、语速、角色与情绪 TTS

- **PRD证据/用户目标**：§27.3；用户能选择不同口音、语速、角色、情绪，固定学习内容优先缓存，动态内容受额度约束。
- **流程/状态机**：`REQUESTED → QUOTA_CHECK → CACHE_LOOKUP → CACHE_HIT/CACHE_MISS → SYNTHESIZING → SAFETY_CHECK → READY → PLAYED/EXPIRED`。
- **API/数据**：`POST /api/v1/ai/voice/tts`，输入受控 `accent、rate、role、emotion、textRef/text`；输出 `ttsAssetId、durationMs、cacheHit、expiresAt、aiLabel`；固定内容与动态内容分开计费。
- **权限隐私/Schema**：本人额度和已发布文本；用户文本动态合成需同意；不模拟真实人物身份或宣称真人；`TtsRequestV1` 不允许任意 voice provider/model 字段。
- **promptVersion/超时重试降级**：`ai2.voice.tts.v1`；缓存优先，动态失败回固定缓存/系统朗读/文字；不换模型；音频安全检查失败不播放。
- **成本/埋点/跨端**：记录字符、秒数、缓存命中、口音/速率/角色/情绪枚举、免费/VIP配额；`ai.voice.tts_cache_hit.v1`、`ai.voice.tts_quota_blocked.v1`。
- **验收**：四类选项在能力支持时有效；固定内容重复请求命中缓存；免费分钟限制和 VIP 合理额度可审计；音频过期/删除后不能播放；小程序/Performance 可用文字或基础音频。

## 10. SUBFEAT-AI2-ROLEPLAY-001｜AI 实时角色扮演

- **PRD 证据**：§29 要求 AI 根据对话实时回应；场景包括咖啡店、酒店、机场、医院交流、租房、海关、银行、电话、面试、商务会议、客户沟通。
- **用户目标**：在低压力、可打断、可重做的情境中练习听说；用户明确知道角色是 AI，不把模拟结果当成真实服务、法律、医疗、金融或考试结论。
- **流程/状态机**：`SCENARIO_SELECTED → CONSENT/QUOTA_CHECK → RTC_TOKEN_ISSUED → JOINED → USER_TURN_LISTENING → ASR_PARTIAL/FINAL → AI_THINKING → AI_TTS_PLAYING → USER_BARGE_IN? → NEXT_TURN → SUMMARY → CLOSED`；信令断线为 `RECONNECTING`，超过恢复窗口转文字回合/预制脚本。
- **API/通道**：`GET /api/v1/ai/roleplay/scenarios`、`POST /api/v1/ai/roleplay/sessions`、`WSS /api/v1/ai/roleplay/sessions/{sessionId}/events`、`POST /api/v1/ai/roleplay/sessions/{sessionId}/close`；媒体走商业 RTC，控制面不使用 HTTP 轮询。
- **数据**：`ai_session(kind=ROLEPLAY)`、`scenarioVersionId、turn、transcriptRef、feedbackRef、bargeInCount、rtcUsage、ttsUsage、summary`；实时原音默认不落盘，用户明确保存时按独立录音策略。
- **权限/隐私**：18+、`ai:roleplay`、麦克风/音频同意、RTC 地域/第三方说明、AI 配额；场景内容必须 PUBLISHED；医疗/租房/海关/银行等只做语言练习，输出带边界提示。
- **Schema**：`RoleplaySessionInputV1` 为 `scenarioCode、role、targetLevel、language、voicePreset?、avatarMode?、consentVersion`；`RoleplayTurnOutputV1` 为 `turnId、speaker、transcript?、intent、languageFeedback?、nextPrompt、interruptible、aiLabel、warnings[]`；不允许模型自由改变场景边界。
- **promptVersion**：`ai2.roleplay.turn.v1`；场景/角色/安全规则由服务端版本化注入；固定 `gpt-5.6-luna/max`，不支持就关闭该场景而不换模型。
- **超时/重试/降级**：首包/单轮使用公共流式候选预算；只重连 RTC/信令；AI 回应超时转短文本提示、预制应答或结束本回合；Barge-in 取消未播放 TTS，不能重复扣完整回合。
- **成本审计**：按 RTC 在线秒数、用户/AI 回合数、ASR/TTS 单位、Barge-in 取消、降级和重连次数计量；每场景设硬额度和最大时长。
- **埋点**：`ai.roleplay.scenario_opened.v1`、`ai.roleplay.session_started.v1`、`ai.roleplay.turn_completed.v1`、`ai.roleplay.barge_in.v1`、`ai.roleplay.reconnect.v1`、`ai.roleplay.summary_opened.v1`、`ai.roleplay.degraded.v1`；不上传原音/原文。
- **跨端**：App/H5/Web 可用 RTC；iPad 横屏显示角色/字幕/反馈；小程序若不能用商业 RTC 只显示文本/预编分支；Performance 静态场景卡+文字回合，不能假装实时。
- **验收**：11 类场景均能由已发布场景码定位；用户可随时结束/重试；Barge-in 停止 TTS 且不重复计费；断网不丢已完成 turn；AI 失败不阻塞规则化场景学习；不输出法律、医疗、金融建议；实时媒体无 HTTP 轮询。

### 10.1 场景注册表（不扩展为新主 FEAT）

| `scenarioCode` | PRD 场景 | 语言学习边界 |
|---|---|---|
| `COFFEE_SHOP` | 咖啡店 | 点单、确认、礼貌表达 |
| `HOTEL` | 酒店 | 入住、设施、请求澄清 |
| `AIRPORT` | 机场 | 值机、登机、延误问询 |
| `HOSPITAL_COMMUNICATION` | 医院交流 | 描述语言、确认信息；不做诊断/治疗 |
| `RENTAL` | 租房 | 询问条件、预约、澄清；不做合同/法律结论 |
| `CUSTOMS` | 海关 | 申报/问答练习；不替代真实法规 |
| `BANK` | 银行 | 基础业务表达；不做金融建议/交易 |
| `PHONE_CALL` | 电话 | 听辨、确认、留言、转接 |
| `INTERVIEW` | 面试 | 自我介绍、追问、回答结构；不保证录用 |
| `BUSINESS_MEETING` | 商务会议 | 主持、追问、澄清、总结、异议 |
| `CUSTOMER_COMMUNICATION` | 客户沟通 | 需求确认、售后、礼貌升级 |

## 11. SUBFEAT-AI2-DIGITALHUMAN-001｜AI 数字人交互界面

- **PRD 证据**：§30 要求 2D/3D 教师角色、口型同步、TTS、表情、实时对话、场景切换，并明确数字人是语言交互界面，不宣称真人教师。
- **用户目标**：获得可理解的视觉/音频反馈，同时在低配设备、无障碍模式和动效关闭时仍能完成学习。
- **流程/状态机**：数字人不独立生成对话；`SESSION_EVENT_RECEIVED → AVATAR_STATE_VALIDATE → LIPSYNC/EXPRESSION → RENDER → USER_ACTION`；状态由已校验的 `speaking、listening、thinking、corrective、idle、error` 事件驱动。
- **API/数据**：复用 roleplay/Tutor session；`GET /api/v1/ai/digital-human/presets`、`PATCH /api/v1/ai/digital-human/preferences`；保存 `avatarPreset、renderTier、sceneRef、motionVersion`，不保存“真人身份”。
- **权限/隐私**：本人偏好；相机权限默认不需要；麦克风、TTS、RTC 同意仍由基础能力管理；不做人脸识别、不采集生物特征。
- **Schema**：`DigitalHumanEventV1` 为 `eventType、avatarPresetId、motionState、lipSyncRef?、expressionCode?、sceneRef?、renderTier、fallback`；客户端拒绝未注册状态，不执行模型返回的任意脚本。
- **promptVersion**：对话仍使用所属 Tutor/Roleplay promptVersion；表现层动作采用 `ai2.digital-human.motion-map.v1` 配置，不将动作提示当成新模型；LLM 固定 `gpt-5.6-luna/max`。
- **超时/重试/降级**：动作/资源加载失败不重试模型；Rive 状态机超时回 `idle`；Medium 使用 2.5D/SVG，Performance 使用静态头像+字幕，RTC/文本链路独立可用。
- **成本审计**：记录资源版本、加载字节数、Rive/3D 启用时长、分辨率档位、缓存命中，不把动画帧视为 AI token；数字人额度与 RTC/TTS 分开。
- **埋点**：`ai.avatar.preset_selected.v1`、`ai.avatar.render_tier_changed.v1`、`ai.avatar.motion_fallback.v1`、`ai.avatar.lipsync_started.v1`、`ai.avatar.disabled.v1`；不记录摄像头数据。
- **跨端**：Ultra/High 使用 Rive Runtime；Medium 2.5D；Performance 静态图/字幕；小程序 2D 帧动画；所有端提供“关闭数字人/仅字幕/仅音频”。
- **验收**：数字人始终标注 AI；无“真人教师”营销文案；口型/状态与音频事件不明显错位；动作无法加载不影响对话；低配档不初始化 WebGL/粒子；动效关闭立即生效。

## 12. 成人考试与学习压力支持

#### SUBFEAT-AI2-EXAM-001｜CET-4/CET-6 AI 升级

- **PRD证据/用户目标**：§30.1 要求 AI 作文反馈、翻译反馈、听力弱点、个性化训练；用户希望在既有 CET 练习/模考闭环中得到解释。
- **流程/状态机**：`EXAM_SESSION_CREATED → RULE_ATTEMPT_SAVED → AI_FEEDBACK_REQUESTED → REVIEWED → PERSONALIZED_TASK_DRAFT → USER_ACCEPTED`；AI 不能改变考试计分状态。
- **API/数据**：复用 `/api/v1/exam/sessions`、`/api/v1/assessment/attempts`；新增 `POST /api/v1/ai/exams/{examSessionId}/feedback`、`GET /.../diagnosis`；数据绑定 `examSessionId、attemptId、writingSubmissionId、listeningWeaknessRefs`。
- **权限隐私/Schema**：本人自研/已授权内容；输出 `essayFeedback、translationFeedback、listeningWeakness[]、trainingPlan[]、officialScore=false`；不导入未授权真题题库。
- **promptVersion/超时重试降级**：`ai2.exam.cet-feedback.v1`；AI 失败回规则判分、错因字典、既有靶向包；重试按 examSessionId 幂等。
- **成本/埋点/跨端**：按作文/翻译/听力报告计量；`ai.exam.feedback_requested.v1`、`ai.exam.training_started.v1`；Web/移动报告分栏，小程序分页。
- **验收**：作文/翻译/听力三类反馈可单独关闭；AI 失败不影响 CET 规则分；报告显示非官方和数据范围；个性化训练由用户确认后加入任务。

#### SUBFEAT-AI2-EXAM-002｜考研英语与复试英语

- **PRD证据/用户目标**：§30.2 要求长难句、手译本、自研模拟题、复试英语面试、AI 问答；用户希望从阅读/翻译到面试形成成人备考闭环。
- **流程/状态机**：`GOAL_SELECTED → EXISTING_CONTENT_BOUND → RULE_PRACTICE → AI_EXPLANATION/INTERVIEW → REPORT → REVIEW_TASK`；自研题目必须经过内容审核和版本发布。
- **API/数据**：复用 grammar/writing/exam/roleplay 会话；新增 `POST /api/v1/ai/exams/postgrad/feedback`、`POST /api/v1/ai/exams/postgrad/interview-sessions`；不复制 `questionId/exerciseId`。
- **权限隐私/Schema**：本人；输入 `examTrack=ENGLISH_1|ENGLISH_2`、任务引用、面试目标；输出长难句结构、手译反馈、面试回应提示、非官方诊断。
- **promptVersion/超时重试降级**：`ai2.exam.postgrad-feedback.v1`、`ai2.exam.interview.v1`；面试实时能力复用 RTC/Roleplay，失败回文字问答/预编脚本。
- **成本/埋点/跨端**：长难句/手译按提交计量，面试按 RTC/回合；`ai.postgrad.xray_opened.v1`、`ai.postgrad.interview_turn.v1`；Performance 保留文本练习。
- **验收**：长难句可回到 X-Ray；手译原文/译文不覆盖；复试面试有 AI 标识且非招生结论；自研模拟题来源、版本、版权可追溯。

#### SUBFEAT-AI2-EXAM-003｜成人学习压力支持（非医疗）

- **PRD证据/用户目标**：§30.3 允许学习节奏建议、鼓励、复习规划、呼吸/休息提示；禁止心理疾病诊断、治疗、医疗建议和“AI 心理医生”宣传。
- **流程/状态机**：`STUDY_SIGNAL → NON_CLINICAL_CHECK → SUPPORT_RESPONSE → USER_DISMISS/PLAN`；出现自伤、急性危险或疾病求助表达时停止一般鼓励，显示人工/紧急求助提示并按安全流程上报，不作诊断。
- **API/数据**：`POST /api/v1/ai/study-support`；只传学习时长、积压、用户主动表达的学习困难类别；输出 `paceSuggestion、encouragement、reviewPlan、breakPrompt、limitations`，不保存敏感心理画像。
- **权限隐私/Schema**：本人且显式同意；`supportMode=LEARNING_WELLBEING`；禁止 `diagnose、treat、medicalAdvice` 字段和模式。
- **promptVersion/超时重试降级**：`ai2.study-support.v1`；短文本候选；失败只显示确定性休息/任务拆分建议；不换模型。
- **成本/埋点/跨端**：按请求数/文本量计量；埋点只记录 supportMode、风险级别、动作结果，不记录敏感原文；四端都提供关闭与人工帮助入口。
- **验收**：文案没有医疗/心理医生暗示；不根据模型改变账号、权益或学习等级；危险表达进入既定安全处置；用户可忽略/关闭；建议与学习目标和负担数据有关。

## 13. FEAT-AI2-006｜职场商务、出海会议与行业表达

### 13.1 主功能统一规格

- **PRD 证据**：§31.1 要求商务会议模拟、多口音和主持/追问/澄清/总结/异议训练；§31.2 要求价格、交期、售后、索赔、付款方式谈判沙盒；§31.3 要求正式/委婉/坚定/简洁商务邮件及润色、改写、中英文转换；§31.4 要求外贸、跨境电商、制造、科技、物流、基础金融商务表达行业术语。
- **用户目标**：成人用户在跨境工作中练习表达、澄清和协商语言，理解这是语言模拟，不是法律、金融、合同、税务或商业决策建议。
- **前置条件**：18+、目标行业/语言同意（如需要）、场景和词汇内容版本已发布；会议/谈判实时能力需要 RTC/语音 Gate，邮件/术语可先用文本。
- **流程/状态机**：文本 `TASK_SELECTED → CONTEXT_PRECHECK → AI_FEEDBACK → USER_REWRITE → ACCEPTED`；会议/谈判复用 `ROLEPLAY/RTC`；邮件 `DRAFT → REVIEW → VARIANTS → USER_SELECT`；术语 `LOOKUP → EXAMPLE → PRACTICE → SRS_LINK`。
- **API**：`POST /api/v1/ai/business/sessions`、`WSS /api/v1/ai/business/sessions/{sessionId}/events`、`POST /api/v1/ai/business/negotiation/turns`、`POST /api/v1/ai/business/emails/reviews`、`GET /api/v1/ai/business/terms`、`POST /api/v1/ai/business/terms/practice`。
- **数据**：`businessScenarioVersion、accentCode、industryCode、role、turn、termId/chunkId、emailSubmissionId、feedback`；行业词汇优先绑定教研内容版本，不把模型临时术语写入公共词库。
- **权限/隐私**：本人场景/邮件；商务邮件默认私密；不上传客户姓名、订单号、合同、价格敏感数据等非必要信息；输入提示脱敏；不得提供专业法律/金融结论。
- **Schema**：`BusinessSessionInputV1` 为 `scenarioCode、role、accent、industryCode、goal、targetLevel`；`BusinessFeedbackV1` 为 `communicationMove、languageIssues[]、alternativePhrases[]、riskWarnings[]、nextAction`；`BusinessEmailReviewV1` 为 `tone、issues、variants、translation?`；`BusinessTermV1` 为 `termId、definition、example、sourceVersion`。
- **promptVersion**：`ai2.business.meeting.v1`、`ai2.business.negotiation.v1`、`ai2.business.email.v1`、`ai2.business.terminology.v1`；固定 `gpt-5.6-luna/max`，行业/场景边界由服务端配置。
- **超时/重试/降级**：会议/谈判按实时策略；邮件/术语按短文本策略；超时用模板、规则礼貌等级、已发布术语和预编会议；不输出不确定的法律/金融意见。
- **成本审计**：按会话分钟、回合、邮件字符、版本数、术语查询/练习和 TTS/ASR 计量；多口音和动态 TTS 单独看板。
- **埋点**：`ai.business.session_started.v1`、`ai.business.communication_move.v1`、`ai.business.negotiation_turn.v1`、`ai.business.email_variant_selected.v1`、`ai.business.term_practice_started.v1`、`ai.business.boundary_warning.v1`。
- **跨端**：Web/iPad 多栏会议/邮件对照；移动按回合/段落；小程序文本/预制场景；RTC/数字人无能力时转文本，不展示虚假的“实时”状态。
- **验收**：会议四类训练动作可逐项触发；多口音选项有真实可用状态；谈判场景覆盖五类议题；邮件四种语气与双语转换可对比；六类行业术语可追溯；所有法律/金融/合同结论均被限制或标警告。

#### SUBFEAT-AI2-006-01｜商务会议模拟与多口音

- **PRD证据/用户目标**：§31.1；用户练习主持、追问、澄清、总结、异议，并可接触美式、英式、印度英语、新加坡英语等多口音。
- **流程/状态机**：`MEETING_SETUP → ROLE_ASSIGNED → TURN_LOOP → COMMUNICATION_MOVE_FEEDBACK → SUMMARY`；多口音是已注册 voice preset，未支持时返回不可用，不隐式换口音。
- **API/数据**：复用 `/ai/business/sessions` 与 RTC events；保存 `meetingRole、moveCode、accentCode、turnId`；音频引用按会话生命周期清理。
- **权限隐私/Schema**：本人、麦克风/RTC 同意；`accentCode` 受控枚举；反馈含语言证据和建议，不含商业判断。
- **promptVersion/超时重试降级**：`ai2.business.meeting.v1`；实时预算，断线转文字/预制主持脚本；无其他模型 fallback。
- **成本/埋点/跨端**：RTC/ASR/TTS 分账；埋点 communication move 和口音选择；Performance 文本回合。
- **验收**：五个动作都有反馈；Barge-in/断网符合实时会话规则；口音/AI 标识可见；不会根据模型决定会议成败或职位结果。

#### SUBFEAT-AI2-006-02｜跨境谈判沙盒

- **PRD证据/用户目标**：§31.2 的价格、交期、售后、索赔、付款方式；用户练习让步、确认和澄清语言。
- **流程/状态机**：`NEGOTIATION_BRIEF → COUNTERPARTY_TURN → USER_RESPONSE → LANGUAGE_FEEDBACK → NEXT_ROUND → OUTCOME_SUMMARY`；结果是语言学习状态，不是交易建议。
- **API/数据**：`POST /ai/business/negotiation/sessions`、`POST /.../turns`、`GET /.../summary`；输入只允许教学用抽象数字/条件或预设，不保存真实合同/客户数据。
- **权限隐私/Schema**：本人；`topicCode=PRICE|DELIVERY|AFTER_SALES|CLAIM|PAYMENT`；输出 `phrasing、clarity、politeness、riskWarnings`，禁止 `legalConclusion/financialAdvice`。
- **promptVersion/超时重试降级**：`ai2.business.negotiation.v1`；回合超时转预制反驳/模板；安全边界命中则停在语言表达反馈。
- **成本/埋点/跨端**：按回合与 TTS/ASR 计量；`ai.negotiation.topic_selected.v1`、`ai.negotiation.round_completed.v1`；移动/小程序可文本回合。
- **验收**：五类主题完整；每轮可回看语言证据；不生成合同条款、索赔金额或金融建议；用户可结束并删除会话。

#### SUBFEAT-AI2-006-03｜商务邮件润色、改写与中英文转换

- **PRD证据/用户目标**：§31.3；用户需要正式、委婉、坚定、简洁四种表达以及润色、改写、中英文转换。
- **流程/状态机**：`EMAIL_DRAFT → PRIVACY_PRECHECK → REVIEW → VARIANT_REQUEST → COMPARE → USER_SELECT/EXPORT`；原文永不被覆盖。
- **API/数据**：`POST /ai/business/emails/reviews`、`POST /.../variants`、`POST /.../translate`；保存 `emailDraftId、tone、variantId、selectedAt?`，默认私密。
- **权限隐私/Schema**：本人；输入可要求先脱敏；输出 `tone、grammar、clarity、politeness、firmness、conciseness、variants[]、translation?`；不承诺商务结果。
- **promptVersion/超时重试降级**：`ai2.business.email.v1`；失败回模板、规则语法检查和手动编辑；翻译结果标 AI 辅助并提示用户核对专名/数字。
- **成本/埋点/跨端**：按字符/版本计量；`ai.email.review_started.v1`、`ai.email.variant_selected.v1`；Web 双栏，移动分段，小程序纯文本。
- **验收**：四种语气差异可见；中英文转换不丢数字/专名并提示核对；多版本不覆盖原文；敏感商务资料可删除。

#### SUBFEAT-AI2-006-04｜行业术语与表达训练

- **PRD证据/用户目标**：§31.4 的外贸、跨境电商、制造、科技、物流、基础金融商务表达；用户能查、听、练并回到 SRS。
- **流程/状态机**：`TERM_QUERY → PUBLISHED_SOURCE_CHECK → TERM_DISPLAY → EXAMPLE/PRONUNCIATION → PRACTICE → SRS_EVENT`；未知术语不由模型静默写入权威词库。
- **API/数据**：`GET /ai/business/terms?industryCode=...`、`POST /ai/business/terms/practice`；复用 `vocabId/chunkId/expressionId` 和 `contentVersionId`；AI 例句单独存。
- **权限隐私/Schema**：本人读/练；输出 `termId、meaning、register、example、sourceVersion、aiExample?、warnings`；来源缺失不得标权威。
- **promptVersion/超时重试降级**：`ai2.business.terminology.v1`；优先已发布词库；模型例句失败回官方例句/空状态；不修改 CMS 内容。
- **成本/埋点/跨端**：查询缓存优先，记录词条/例句生成成本；`ai.term_viewed.v1`、`ai.term_added_to_srs.v1`；四端文本音频可用。
- **验收**：六类行业可筛选；词条来源/版本可见；SRS 使用 canonical ID；生成例句带 AI 标识；未授权/不存在术语不被编造。

## 14. SUBFEAT-AI2-OVERSEAS-001｜海外生活沉浸沙盒

- **PRD 证据**：§32 要求海关、租房、医疗交流、银行、交通、酒店、报警求助、Small Talk；强调语言学习，不替代真实法律、医疗、金融专业意见。
- **用户目标**：为出国生活建立语言应对信心，能练习说明、确认、求助和 Small Talk，并识别真实场景中需要专业机构的边界。
- **流程/状态机**：`PACK_OPEN → SCENARIO_SELECT → PRECHECK → ROLEPLAY/TEXT_TURN → FEEDBACK → REPLAY/NEW_SCENARIO → COMPLETE`；复用 `ROLEPLAY-001` 的 RTC 和降级。
- **API/数据**：`GET /api/v1/ai/overseas/scenarios`、`POST /api/v1/ai/overseas/sessions`、`WSS /api/v1/ai/overseas/sessions/{sessionId}/events`；`scenarioPackVersion、scenarioCode、turns、feedback` 版本化。
- **权限/隐私**：本人；场景内容已审核发布；用户不得提交真实护照、医疗记录、银行卡、租赁合同；前置检测提示脱敏，敏感真实请求转边界提示。
- **Schema**：`OverseasScenarioInputV1` 的 `scenarioCode` 限定八类场景和 `SMALL_TALK`；输出 `languageGoal、turn、phraseFeedback、clarificationPrompt、professionalBoundaryWarning`；不包含真实法律/医疗/金融结论字段。
- **promptVersion**：`ai2.overseas.roleplay.v1`；固定 `gpt-5.6-luna/max`；场景规则和本地化说明来自已发布包/RAG 授权资料。
- **超时/重试/降级**：实时场景按 roleplay；弱网/无 RTC 转文字回合/预制分支；AI 失败显示场景词块和规则练习；不使用 HTTP 轮询。
- **成本审计**：按场景时长/回合、ASR/TTS、动态反馈和缓存命中计量；分场景看板识别医疗/银行等高风险内容命中率。
- **埋点**：`ai.overseas.scenario_started.v1`、`ai.overseas.turn_completed.v1`、`ai.overseas.boundary_warning.v1`、`ai.overseas.pack_completed.v1`；仅记录场景码/回合/状态。
- **跨端**：Web/iPad 沉浸沙盒；移动按回合；小程序文本/2D；Performance 静态词块/字幕；所有端可关闭音频和数字人。
- **验收**：八类场景和 Small Talk 可定位；专业边界提醒出现；不提供出入境、医疗、银行、租赁法律结论；场景包/内容版本/反馈可回放；RTC 失败仍可完成语言任务。

## 15. FEAT-AI2-007｜雅思/托福成人训练、诊断与题目趋势

### 15.1 主功能统一规格

- **PRD 证据**：§33.1 要求自研模拟题、听力、阅读、写作、口语；§33.2 要求参考公开评分维度（流利度、词汇、语法、发音、逻辑）做 AI 诊断；§33.3 允许基于公开信息制作主题趋势和自研预测练习，禁止泄题、非法换题库、搬运受版权保护的实时题库。
- **用户目标**：成人用户通过合法自研内容训练四科/口语 Part 1～3，获得带局限说明的诊断和下一步练习，而不是购买或误认官方分数。
- **前置条件**：题目/材料为自研或合法授权并已发布；考试 session、作文/口语提交已保存；公开趋势有来源快照和版权审核；AI/RTC/ASR/TTS Gate 已开启。
- **流程/状态机**：训练复用既有 `exam session`；诊断 `SUBMISSION_SAVED → RULE_FACTS_AGGREGATED → AI_DIAGNOSIS → RUBRIC/COPYRIGHT CHECK → REPORT_READY`；趋势 `PUBLIC_SOURCE_CAPTURED → SOURCE_REVIEW → TOPIC_ABSTRACT → SELF_MADE_PRACTICE → PUBLISHED/ARCHIVED`。
- **API**：复用 `/api/v1/exam/sessions`、`/api/v1/assessment/attempts`；新增 `POST /api/v1/ai/ielts-toefl/diagnoses`、`GET /api/v1/ai/ielts-toefl/diagnoses/{diagnosisId}`、`GET /api/v1/ai/ielts-toefl/trends`、`POST /api/v1/ai/ielts-toefl/practice-drafts`；趋势发布走 Admin 双审。
- **数据**：`examCode=IELTS|TOEFL`、`skillCode`、`taskVersion`、`diagnosisDimension`、`estimatedBand?`、`officialScore=false`、`sourceSnapshotId`、`practiceDraftId`；不保存/分发未授权真题。
- **权限/隐私**：本人考试/提交；教研/审核按 CMS 权限管理趋势来源；管理员不得把用户提交用于题库发布；诊断、预测和估分都带非官方声明。
- **Schema**：`ExamDiagnosisInputV1` 为 `examCode、skillCode、submissionRefs[]、rubricVersion、targetScore?`；`ExamDiagnosisOutputV1` 为 `dimensions{fluency,vocabulary,grammar,pronunciation,logic}、evidence[]、practiceActions[]、estimatedBand?、officialScore=false、limitations[]`；趋势为 `topic、publicSources[]、publishedAt、copyrightStatus、selfMade=true`。
- **promptVersion**：`ai2.exam.ielts-toefl.diagnosis.v1`、`ai2.exam.trend-synthesis.v1`；固定 `gpt-5.6-luna/max`；考试 rubric 仅作为参考维度，不是官方评分实现。
- **超时/重试/降级**：诊断短文同步/长文异步；AI 失败回规则/统计报告和既有练习；趋势来源缺失/引用不全则不生成主题；不以其他模型补全。
- **成本审计**：按科目、技能、提交字符/音频秒数、报告维度、趋势来源/练习 draft 计量；实时口语额外记录 RTC/ASR/TTS；估算 Band 只在 AI 调用成功且证据完整时产生。
- **埋点**：`ai.exam.diagnosis_started.v1`、`ai.exam.diagnosis_ready.v1`、`ai.exam.dimension_opened.v1`、`ai.exam.estimated_band_viewed.v1`、`ai.exam.trend_viewed.v1`、`ai.exam.practice_started.v1`、`ai.exam.copyright_blocked.v1`。
- **跨端**：Web/iPad 显示科目/维度报告和来源；移动显示卡片/趋势；小程序和 Performance 提供文本报告、基础音频和预制题；RTC 不可用时口语转录/文本回合。
- **验收**：听读写说四科、自研模拟和口语 Part 1～3 均可定位；五个参考维度齐全；报告永远非官方；趋势有公开来源/版权状态；禁止泄题/换题库/搬运；AI 失败不影响考试原始结果。

#### SUBFEAT-AI2-007-01｜自研模拟题与四科训练

- **PRD证据/用户目标**：§33.1；用户按听力、阅读、写作、口语使用合法自研题和既有题型完成训练。
- **流程/状态机**：`PACK_SELECTED → CONTENT_VERSION_CHECK → EXAM_SESSION → ATTEMPT → RULE_FEEDBACK → OPTIONAL_AI_FEEDBACK → MASTERY/REVIEW`；模型生成草稿必须走 CMS 双审，不直接给学员。
- **API/数据**：复用 `examCode、questionId、contentVersionId、sessionId`；AI 只扩展 `/ai/.../diagnoses`，不创建第二套题目 ID。
- **权限隐私/Schema**：学员只读 PUBLISHED；输出题目不带隐藏 answerKey；自研内容来源/版权字段必填。
- **promptVersion/超时重试降级**：`ai2.exam.practice-feedback.v1`；失败回既有规则/答案解析；不生成未审核题目进入正式考试。
- **成本/埋点/跨端**：题目静态成本与 AI 反馈成本分开；`exam.practice_started/completed` 事件；四端有题型降级。
- **验收**：四科训练完成；题目版本和版权可追溯；AI 生成练习标 draft/审核状态；AI 失败不丢答题记录。

#### SUBFEAT-AI2-007-02｜公开维度 AI 诊断与非官方估计

- **PRD证据/用户目标**：§33.2；用户希望看到流利度、词汇、语法、发音、逻辑的依据和建议。
- **流程/状态机**：`FACTS_READY → DIMENSION_REVIEW → EVIDENCE_BIND → REPORT → USER_ACTION`；缺少音频/文本证据的维度显示 unavailable。
- **API/数据**：`POST/GET /ai/ielts-toefl/diagnoses`；每个维度保存 `evidenceRefs、diagnosticBand?、limitations`；`officialScore=false` 固定由服务端写入。
- **权限隐私/Schema**：本人；不公开用户报告；模型不得输出“保证达到 X 分”；报告必须带“预估/参考/非官方”标签。
- **promptVersion/超时重试降级**：`ai2.exam.ielts-toefl.diagnosis.v1`；失败显示规则统计/证据不足；不能从缺失音频推断发音。
- **成本/埋点/跨端**：按维度/证据数计量；事件记录维度查看与动作；移动/小程序分层文字报告。
- **验收**：五维字段和局限展示；估计值和官方成绩视觉区分；报告可回放 prompt/schema/version；投诉/删除有效。

#### SUBFEAT-AI2-007-03｜公开趋势与自研预测练习

- **PRD证据/用户目标**：§33.3；允许公开信息趋势和自研预测练习，禁止泄题、非法换题库和版权搬运。
- **流程/状态机**：`SOURCE_REGISTERED → COPYRIGHT/SAFETY_REVIEW → SUMMARY_DRAFT → HUMAN_REVIEW → PUBLISHED → EXPIRED/ARCHIVED`；趋势不直接等同未来考试题目。
- **API/数据**：Admin `POST /api/v1/admin/ai/exam-trends/drafts`、`POST /.../submit-review`、`POST /.../publish`；学员 `GET /api/v1/ai/ielts-toefl/trends`；记录 source URL/hash/授权状态/快照版本。
- **权限隐私/Schema**：教研编辑/审核/发布角色分离；`TrendCardV1` 必须有 `publicSources、copyrightStatus、uncertainty、selfMadePracticeRef`；未授权来源拒绝。
- **promptVersion/超时重试降级**：`ai2.exam.trend-synthesis.v1`；来源抓取/模型失败不发布；人工可只发布已核验公开摘要。
- **成本/埋点/跨端**：记录来源/抓取/审核/生成成本和发布状态；`exam.trend_source_blocked.v1`；端上显示来源和不确定性。
- **验收**：未授权实时题库不进系统；每条趋势可溯源；练习题自研且标版本；发布可撤回/下线；不使用“押中/泄题/官方预测”宣传。

## 16. SUBFEAT-AI2-DEBATE-001｜AI 辩论竞技场

- **PRD 证据**：§35 要求用户选题、AI 正方/反方、回合制、观点总结、语言反馈、逻辑反馈；敏感主题进入内容安全策略。
- **用户目标**：用结构化回合练习陈述、追问、反驳和总结，理解逻辑反馈是学习建议，不是政治/事实裁决或对人的评价。
- **前置条件**：用户选择已允许主题或提交主题通过前置安全；AI Flag/配额开启；成人用户；回合数、时长和输出长度受配额限制。
- **流程/状态机**：`TOPIC_INPUT → SAFETY_PRECHECK → SIDE_SELECTED → ROUND_OPEN → USER_ARGUMENT → AI_COUNTER → LANGUAGE/LOGIC_FEEDBACK → NEXT_ROUND → SUMMARY → CLOSED`；敏感主题 `REVIEW_REQUIRED/REJECTED`。
- **API**：`POST /api/v1/ai/debates`、`POST /api/v1/ai/debates/{debateId}/rounds`、`GET /api/v1/ai/debates/{debateId}`、`POST /api/v1/ai/debates/{debateId}/close`；可流式返回文本但不是 RTC 必需能力。
- **数据**：`debateTopic、topicSafetyDecision、side、round、argumentHash、languageFeedback、logicFeedback、summary、aiLabel`；原文按用户删除/保留策略，敏感命中只留脱敏结果。
- **权限/隐私**：本人；主题不公开默认；不得以模型反馈作为封禁唯一依据；敏感内容审核、举报和人工复核沿用安全域。
- **Schema**：`DebateInputV1` 为 `topic、side=FOR|AGAINST|NEUTRAL、roundLimit、languageGoal`；`DebateRoundOutputV1` 为 `aiArgument、languageIssues[]、logicIssues[]、summary?、safetyWarnings[]、aiGenerated=true`；禁止输出人身攻击/违法指导。
- **promptVersion**：`ai2.debate.turn.v1`、`ai2.debate.feedback.v1`；固定 `gpt-5.6-luna/max`；正反方由服务端设定，不能由用户注入系统指令。
- **超时/重试/降级**：短文本策略；回合超时返回上轮总结/规则辩论模板；敏感命中拒绝或转安全的语言练习主题；重试同 round 幂等。
- **成本审计**：按回合、文本量、反馈维度和敏感复核计量；硬性回合额度；报告区分用户/AI token。
- **埋点**：`ai.debate.topic_submitted.v1`、`ai.debate.safety_blocked.v1`、`ai.debate.round_completed.v1`、`ai.debate.feedback_opened.v1`、`ai.debate.summary_viewed.v1`、`ai.debate.reported.v1`。
- **跨端**：Web/iPad 双栏观点/反馈；移动回合卡；小程序/Performance 纯文本/静态回合；无复杂动画依赖。
- **验收**：用户可选正/反；回合有顺序和结束状态；观点/语言/逻辑反馈结构化；敏感主题前置拦截和申诉入口；模型失败不丢已有论点；不把 AI 立场当事实裁决。

## 17. SUBFEAT-AI2-RAG-001｜成人学习 RAG 知识库

- **PRD 证据**：§36 允许自有内容、已授权教材、合法开放资料、用户本人上传且有权使用的资料；要求引用来源、版本管理、文档分块、语义检索、答案溯源、知识更新；Phase 2 默认不得导入未授权 K12 教材。
- **用户目标**：在有权限的课程/资料范围内得到带来源和版本的答案，能判断“资料没有覆盖”而不是收到无依据的模型断言。
- **前置条件**：来源版权/授权凭证、内容状态、数据地域、删除策略和检索组件已审核；向量检索组件必须按既有 ADR 规则单独评估；用户上传必须完成“本人有权使用”确认。
- **流程/状态机**：文档 `DRAFT → RIGHTS_CHECK → PARSED → CHUNKED → EMBEDDED/INDEXED → REVIEWED → PUBLISHED → UPDATED/ARCHIVED/DELETED`；查询 `QUERY → AUTH_SCOPE → RETRIEVE → SOURCE_COVERAGE_CHECK → GENERATE → CITATION_CHECK → DELIVER`。
- **API**：Admin `POST /api/v1/admin/ai/knowledge-bases`、`POST /.../documents`、`POST /.../documents/{documentId}/index`、`POST /.../documents/{documentId}/archive`；学员 `GET /api/v1/ai/knowledge-bases`、`POST /api/v1/ai/knowledge/query`；AI Tutor 只能通过已授权 `knowledgeBaseId` 调用。
- **数据**：`ai_knowledge_base、ai_knowledge_document、ai_knowledge_version、ai_knowledge_chunk、ai_retrieval_log、ai_citation`；每个 chunk 绑定 `sourceDocumentId、version、rightsStatus、charRange/pageRef?、checksum`；用户删除同步删除索引和引用。
- **权限/隐私**：教研编辑只能创建草稿；版权审核/发布分离；学员只读已发布且有权益的知识库；用户上传文档只对本人可见，不能默认加入公共库；管理员访问原文需 reasonCode/ticketId。
- **Schema**：`KnowledgeSourceV1` 为 `sourceType=OWNED|LICENSED|OPEN_LEGAL|USER_OWNED_UPLOAD、rightsStatus、sourceRef、version、checksum`；`KnowledgeChunkV1` 为 `chunkId、documentVersionId、textRef/hash、locator、embeddingRef?`；`RagAnswerV1` 为 `answer、citations[]、retrievedChunkIds[]、coverage=SUPPORTED|INSUFFICIENT|NONE、versionRefs、aiGenerated=true、warnings[]`；没有有效 citation 不得输出确定性答案。
- **promptVersion**：`ai2.rag.answer.v1`、`ai2.rag.query-rewrite.v1`；固定 `gpt-5.6-luna/max`；检索器和向量组件不是模型 fallback，供应商未冻结时只能使用已审核的普通索引/关键词降级。
- **超时/重试/降级**：检索候选 2 秒、回答候选 8 秒；来源不足直接返回检索结果/“没有足够授权资料”，不让模型补全；索引任务异步重试，失败入死信；不可用不切换其他模型。
- **成本审计**：按文档页/字符、chunk 数、索引任务、检索次数、topK、生成 token、缓存命中和用户上传存储量计量；成本按知识库/版权方/用户上传分账。
- **埋点**：`ai.rag.document_uploaded.v1`、`ai.rag.rights_blocked.v1`、`ai.rag.index_completed.v1`、`ai.rag.query_started.v1`、`ai.rag.citations_rendered.v1`、`ai.rag.insufficient_context.v1`、`ai.rag.document_deleted.v1`；不带文档原文。
- **跨端**：Web/iPad 侧栏显示引用定位和版本；移动/小程序使用折叠引用卡；Performance 只展示文本+来源；上传/索引仅在有明确 UI 和权限的端开放。
- **验收**：四类合法来源均可分类；授权/版本/删除可回放；答案每个可验证断言有引用或标为不确定；未授权 K12 教材无法索引；文档更新不覆盖历史版本；RAG 故障回退为有来源检索或安全空结果。

### 17.1 RAG 来源与治理规则

| 来源 | 允许条件 | 处理 |
|---|---|---|
| 自有内容 | 内容作者、版权状态、已发布版本齐全 | 可进入公共成人学习库，经过 CMS 双审 |
| 已授权教材 | 授权范围、地域、期限、版本、删除责任齐全 | 只在授权范围和用户权益内检索 |
| 合法开放资料 | 许可证/来源/快照和再分发条件可记录 | 按许可展示引用和限制 |
| 用户本人上传 | 用户确认有权使用，默认私有 | 不进入公共库，不用于训练；用户删除触发索引删除 |
| 未授权 K12 教材 | Phase 2 默认禁止 | 前置拦截并记录脱敏阻断事件 |

## 18. SUBFEAT-AI2-SOCIAL-001｜成人兴趣小组与社交升级

- **PRD 证据**：§37 允许在 Phase 1 学习室基础上增加好友、Friend Quest、好友连续学习、公开成就、学习室赛季、CET/考研/雅思等成人兴趣小组、自由文本留言板、主题讨论帖、轻量鼓励、小组管理员；开放自由文本 UGC 前置真实身份信息认证、社区规范、举报、屏蔽、内容审核、关键词/模型风控、管理员、禁言/封禁、审核记录、投诉和应急处置。仍不建议陌生人私密聊天、大型开放论坛、公开视频社区、直播社交、金钱打赏。
- **用户目标**：围绕成人学习目标获得低压力的同伴支持和小组任务，不被陌生人私聊、公开流量或金钱激励牵引。
- **前置条件**：Phase 1 Study Room 权威实体、成人身份/认证能力、社区规范、内容审核/举报/屏蔽/管理员/封禁/投诉/应急预案均可用；自由文本 Flag 默认关闭，先灰度小组。
- **流程/状态机**：好友 `REQUESTED → ACCEPTED/BLOCKED/REJECTED`；Friend Quest `DRAFT → ACTIVE → COMPLETED/EXPIRED`；帖子/评论 `DRAFT → PRECHECK → PUBLISHED → REPORTED/UNDER_REVIEW → VISIBLE/HIDDEN/REMOVED`；用户处罚 `WARN → MUTED → SUSPENDED/BANNED → APPEALED/RESTORED`；所有动作留痕。
- **API**：复用 `/api/v1/social` 与既有 WebSocket；新增 `POST /api/v1/social/friends/requests`、`POST /.../accept`、`POST /api/v1/social/quests`、`GET /api/v1/social/seasons`、`POST /api/v1/social/groups/{groupId}/posts`、`POST /.../reports`、`POST /.../blocks`、`POST /api/v1/admin/social/moderation/{caseId}/decision`；自由文本写接口必须 `Idempotency-Key`。
- **数据**：复用 `social room/member/season`；新增/扩展 `social_friend、social_quest、social_post、social_comment、social_report、social_block、social_moderation_case、social_action_audit`；存 `contentHash、moderationVersion、decision、reviewer、reasonCode`，原文按保留策略隔离。
- **权限/隐私**：本人好友/帖子管理；组员可见范围由小组设置；管理员最小权限；风控访问原文需 reasonCode/ticketId；屏蔽后互不可见/不可互动；不开放陌生人私密聊天、直播、视频、打赏。
- **Schema**：`SocialPostInputV1` 为 `groupId、topicRef、text、visibility`；`ModerationResultV1` 为 `precheck、postcheck、riskBand、decision、reasons[]、modelId、promptVersion`；`SocialReportV1` 为 `targetType、targetId、reasonCode、description?`；模型结果不得单独决定永久封禁，需规则/人工组合。
- **promptVersion**：`ai2.social.precheck.v1`、`ai2.social.postcheck.v1`、`ai2.social.report-triage.v1`；固定 `gpt-5.6-luna/max`，关键词规则先行；模型不可用时自由文本 fail-closed，不改用其他模型。
- **超时/重试/降级**：发帖前置审核候选 2 秒；超时不发布并显示“审核中”；异步后置审核可重试，发现风险先隐藏；举报重复幂等；社交升级故障不影响学习室、SRS、考试。
- **成本审计**：按文本字符、审核次数、举报复核、群组/帖子量、通知量计量；管理员操作与模型调用分开；达到预算自动关闭自由文本、保留预设鼓励。
- **埋点**：`social.friend_requested.v1`、`social.friend_quest_started.v1`、`social.streak_shared.v1`、`social.group_joined.v1`、`social.post_submitted.v1`、`social.post_moderated.v1`、`social.report_created.v1`、`social.block_applied.v1`、`social.moderation_action.v1`；不公开用户原文到分析平台。
- **跨端**：Web/iPad 支持主题帖/管理员工作台；移动支持好友/任务/小组；小程序仅开放审核通过的预设/低风险文本能力，视平台审核；Performance 保留列表和静态徽章，不加载复杂社交动效。
- **验收**：所有前置治理能力可操作并有审计；自由文本默认关闭、灰度和紧急关闭有效；举报/屏蔽/禁言/封禁/申诉闭环可回放；风控模型/关键词双审；永久处罚不由模型单独决定；不出现私密聊天、直播、打赏；社交故障不阻塞主学习闭环。

### 18.1 社交原子能力卡片

#### SUBFEAT-AI2-SOCIAL-001-A｜好友、Friend Quest 与连续学习

- **PRD证据/用户目标**：§37 的好友、Friend Quest、好友连续学习、公开成就；让同伴关系只围绕学习行为。
- **流程/状态机**：好友请求状态与 Quest `DRAFT → ACTIVE → COMPLETED/EXPIRED`；连续学习只消费已确认学习事件，不消费点赞/刷屏。
- **API/数据**：`/social/friends`、`/social/quests`、`/social/achievements`；复用 `userId、learningEventId、seasonId`，不复制 Streak 事实。
- **权限隐私/Schema**：双方同意；公开成就只展示用户选择的最小字段；`FriendQuestV1` 只含目标、周期、进度摘要、可见性。
- **promptVersion/超时重试降级**：不必调用模型；若需要个性化鼓励使用 `ai2.social.encouragement.v1`、`gpt-5.6-luna/max`；失败回固定鼓励，不影响 Quest。
- **成本/埋点/跨端**：优先规则化零模型成本；记录请求/接受/完成/退出；四端列表/卡片，Performance 静态徽章。
- **验收**：双方同意、撤销和屏蔽有效；进度只来自真实学习事件；不泄露隐私学习内容；模型失败不影响好友或任务事实。

#### SUBFEAT-AI2-SOCIAL-001-B｜成人兴趣小组、赛季与公开成就

- **PRD证据/用户目标**：§37 的学习室赛季、CET/考研/雅思等成人兴趣小组、轻量鼓励、小组管理员。
- **流程/状态机**：`GROUP_DRAFT → REVIEW → PUBLISHED → ACTIVE → ARCHIVED`；成员 `INVITED → JOINED → MUTED/REMOVED`；赛季使用既有 Learning Season 状态。
- **API/数据**：`GET /social/groups`、`POST /social/groups/{id}/join`、`GET /social/seasons`；管理员创建/审核/归档；内容引用 `examCode`/目标标签，不虚构课程。
- **权限/隐私/Schema**：组管理员与审核角色分离；`GroupProfileV1` 只含成人主题、规则、人数/时间和可见范围；公开成就可关闭。
- **promptVersion/超时重试降级**：组目录/赛季不依赖模型；AI 轻量鼓励 `ai2.social.encouragement.v1` 可选；失败回预设气泡。
- **成本/埋点/跨端**：以规则化数据为主；记录入组/退出/赛季完成/鼓励点击；Web/移动/小程序均可读，复杂动画可关闭。
- **验收**：仅成人主题和已审小组；管理员权限可审计；公开成就按用户设置；组/赛季故障不影响个人学习任务。

#### SUBFEAT-AI2-SOCIAL-001-C｜自由文本帖子、审核、举报与屏蔽

- **PRD证据/用户目标**：§37 自由文本留言板、主题讨论帖和完整 UGC 前置能力；用户能安全发言，也能举报和屏蔽。
- **流程/状态机**：`DRAFT → KEYWORD_PRECHECK → MODEL_PRECHECK → PENDING/PUBLISHED → POSTCHECK → VISIBLE/HIDDEN → REPORT_REVIEW → RESOLVED`；审核员可人工复核，作者/审核角色不能自审。
- **API/数据**：`POST /social/groups/{id}/posts`、`POST /social/posts/{id}/reports`、`POST /social/users/{id}/block`、Admin moderation decision；记录 content hash、规则版本、promptVersion、reviewer。
- **权限/隐私/Schema**：实名/身份认证 Gate 只作为资格，不向其他用户展示真实身份；帖子范围受组权限；模型返回 `riskBand/decision/reasons`，不得直接永久封禁。
- **promptVersion/超时重试降级**：`ai2.social.precheck.v1`/`postcheck.v1`；超时 `PENDING` 或 fail-closed；不切换模型；规则误判支持投诉/人工复核。
- **成本/埋点/跨端**：按字符/审核次数/复核计费；事件不带原文；Web/移动逐帖，Performance 无自动播放媒体，小程序按平台政策。
- **验收**：前后置审核双层、举报/屏蔽、管理员、禁言/封禁、记录和投诉可完整跑通；敏感主题被拦截或人工复核；AI 结果可解释；社交关闭后回到预设互动。

### 18.2 明确不实现项（承接 PRD 边界）

本阶段不把以下能力写入默认路由、默认 UI 或营销：陌生人私密聊天作为核心产品、大型开放论坛、用户公开视频社区、直播社交、金钱打赏。若未来要改变，必须新增需求、隐私/内容治理评估、成本 Gate、ADR 和矩阵映射。

## 19. 跨功能 API、事件与状态复用表

### 19.1 API 路由归属

| API 区域 | Gateway/目标服务负责 | AI Orchestrator/RTC 负责 | 前端/管理端边界 |
|---|---|---|---|
| `/api/v1/ai/tutor/*` | Gateway/IAM 做入口与 consent；learning-service/assessment-service 持有会话事实、幂等、审计和结果读取 | 上下文编排、Schema、模型调用、安全前后置 | 学习端文字 Tutor；不直连模型 |
| `/api/v1/ai/memories/*` | IAM/learner-service 负责用户隔离、CRUD、开关、删除和事件消费 | 候选提取和上下文投影 | 学习端/隐私中心可控 |
| `/api/v1/ai/learning-paths/*` | learner-service/learning-service 负责 Study Plan/Task 的版本、激活和编辑 | 规则基线解释和 AI 草案 | 推荐默认草稿，不自动激活 |
| `/api/v1/ai/syntax/*`、`/weaknesses/*` | content-service/learning-service/assessment-service 负责 canonical grammar/mastery 引用和结果读取 | X-Ray/弱点解释 Schema | Web/移动图谱，低端 2D |
| `/api/v1/ai/writing/*` | assessment-service 负责原始 submission、版本、删除和报告读取 | 反馈、改写、学术安全 | 不覆盖原文，不宣称官方 |
| `/api/v1/ai/voice/*` | IAM/commerce/realtime-voice 负责 consent、quota、RTC token、会话和删除 | ASR/发音/TTS 编排；媒体不经 HTTP 轮询 | 权限/回放/降级 |
| `/api/v1/ai/roleplay/*`、`/business/*`、`/overseas/*` | 场景版本、会话、权益、审计 | 实时 turn、Barge-in、TTS/ASR | 商业 RTC 或文字降级 |
| `/api/v1/ai/exams/*`、`/ielts-toefl/*` | assessment-service 负责 exam session/attempt/report 事实 | AI 追加反馈、诊断、趋势摘要 | 非官方报告和自研题 |
| `/api/v1/ai/debates/*` | 主题/回合/删除/举报事实 | 回合论点、语言/逻辑反馈 | 文本流式，可取消 |
| `/api/v1/ai/knowledge/*` | 用户授权、权益、来源版本读取 | 检索、引用、回答结构化 | 学员只读发布库 |
| `/api/v1/social/*` | 好友/组/帖子/举报/处罚事实 | 前后置安全与分流建议 | 自由文本 Flag/小组管理员 |
| `/api/v1/admin/ai/*`、`/admin/social/*` | 角色、双审、Feature Flag、审计和导出 | 评测/成本/安全结果 | `admin-web` 最小权限 |

### 19.2 领域事件目录

| 事件 | 生产者 | 消费者/副作用 |
|---|---|---|
| `learning.attempt.completed.v1` | learning-service/assessment-service | Tutor 反馈、弱点图谱、记忆候选、成本无关 |
| `writing.submission.created.v1` | assessment-service | AI 写作 review、弱点信号、用户删除链路 |
| `exam.session.completed.v1` | assessment-service | CET/考研/IELTS/TOEFL 诊断草稿 |
| `ai.feedback.accepted.v1` | learner-service/learning-service | 复习建议或采纳统计；不得直接改掌握度 |
| `ai.memory.changed.v1` | learner-service/iam-service | Tutor context cache 失效、导出/删除 |
| `ai.voice.segment.finalized.v1` | Voice boundary | 转写/发音评测/报告；不含原始音频 |
| `ai.session.closed.v1` | learning-service/realtime-voice | TTS/RTC 成本结算、总结异步任务 |
| `ai.rag.document.published.v1` | Admin/CMS | 索引任务；版本可回滚 |
| `ai.rag.document.deleted.v1` | Admin/User | 索引、缓存、引用删除 |
| `social.content.submitted.v1` | Social | 关键词/模型前置审核、后置抽检 |
| `social.report.created.v1` | Social | 风控队列、人工处置、投诉回放 |
| `ai.cost.threshold_reached.v1` | Cost worker | 配额/Flag/告警/运营看板 |

### 19.3 事务、幂等与最终一致性

1. learning-service/assessment-service 在各自本地事务中保存原始学习事实、AI 请求索引和 Outbox 事件；模型结果到达后以 `aiRequestId + promptVersion + schemaVersion` 关联，不覆盖源数据。
2. 所有写接口使用 `Idempotency-Key`；流式/RTC 事件使用 `eventId、clientEventId、segmentId、turnId` 去重；同 key 不同 request hash 返回 `IDEMPOTENCY_CONFLICT`。
3. AI 报告、记忆、弱点、成本、RAG 索引和社交审核允许异步最终一致，但页面必须显示 `PROCESSING/STALE/DEGRADED`，不能用 0 或空值伪装成功。
4. 用户删除、关闭记忆、撤回同意和紧急关闭采用 fail-closed：新请求立即阻断，缓存/索引/对象删除异步重试并告警。

## 20. Phase 2 发布 Gate 与验收包

### 20.1 功能级验收

| 范围 | 必须证明 |
|---|---|
| AI Tutor/路径/记忆 | 目标上下文、水平适配、解释/练习/总结、用户修改权、记忆开关/删除、失败不阻塞 |
| 语法/弱点 | 任意输入的合法 Schema、DAG 无环、AI 标识、四类弱点来源、规则降级 |
| 写作/考试 | 原文不可覆盖、span 证据、非官方/参考维度、学术不端边界、既有考试分不变 |
| ASR/发音/TTS | 权限、部分/最终转写、辅助反馈、口音/语速/角色/情绪、缓存/限额、删除 |
| RTC/角色/数字人 | 商业 RTC/ADR、Barge-in、断线恢复、文字替代、Rive/2D/静态降级、AI 身份标识 |
| 商务/海外 | 所有 PRD 场景/议题/行业类别，法律/医疗/金融提示，文本/语音降级 |
| 雅思/托福 | 四科/口语 Part 1～3、自研内容、五维诊断、趋势来源和版权防护 |
| 辩论/RAG/社交 | 敏感主题策略、来源/版本/引用、UGC 前后置审核、举报/屏蔽/处罚/投诉闭环 |

### 20.2 安全、隐私和合规验收

- 生产开关只在 18+、AI 登记/标识/服务说明、数据授权、投诉和违规处置流程已验收后开启。
- 任何模型请求均可证明 `gpt-5.6-luna`、`reasoning_effort=max`、promptVersion、schemaVersion、requestId、结果状态和成本记录；模型失败不产生其他模型调用。
- 敏感输入前置拦截、输出后置核验、人工复核、申诉/投诉和审计记录可按 request/session/user 删除或脱敏回放。
- 原始录音、用户作文、RAG 文档和社交原文不进入普通日志/埋点/成本看板；第三方媒体/对象存储的删除和签名 URL 失效可验证。
- AI 输出不会成为付费、封禁、等级、官方考试分数或医疗/法律/金融结论的唯一依据。

### 20.3 跨端、弱网和性能验收

- Web/H5、iOS、Android、iPad 的文字、写作、考试、记忆、RAG 引用和报告链路可完成；RTC/麦克风按平台权限分别测试。
- 微信小程序由 `apps/mobile` 条件编译输出，不建立第二套页面/API/状态；不能承载 RTC/3D 时使用文本/2D/静态降级。
- Ultra/High/Medium/Performance 四档切换可随时关闭数字人、粒子、WebGL、波形和声音；Performance 档仍能完成规则学习或文字 AI 任务。
- 弱网/断网/恢复下，原始学习事件和已完成 turn 不重复；实时媒体不采用 HTTP 轮询；异步任务有重试、死信、告警和用户可见状态。

### 20.4 成本与运营验收

- 每个 featureCode 有预算、配额、软/硬阈值、日/周/月聚合和一键关闭；免费层/VIP 的 TTS/RTC/AI 权益与 `PHASE2_AI_QUOTA` 统一投影。
- 成本审计能按 request、user、feature、promptVersion、modelId、reasoningEffort、媒体/检索单位和重试回放；供应商账单键对账前不得展示虚假的精确金额。
- 结构化解析率、安全拦截率、降级率、投诉率、人工采纳率、缓存命中、首包/总延迟和删除完成率进入 Admin 看板。

## 21. 覆盖编号清单与未决项

### 21.1 已覆盖编号

**矩阵主功能：**

`FEAT-AI2-001`、`FEAT-AI2-002`、`FEAT-AI2-003`、`FEAT-AI2-004`、`FEAT-AI2-005`、`FEAT-AI2-006`、`FEAT-AI2-007`。

**AI Tutor/记忆/路径：**

`SUBFEAT-AI2-001-01`、`SUBFEAT-AI2-001-02`、`SUBFEAT-AI2-001-03`、`SUBFEAT-AI2-001-04`、`SUBFEAT-AI2-001-09`；`SUBFEAT-AI2-002-01`、`SUBFEAT-AI2-002-02`、`SUBFEAT-AI2-002-03`、`SUBFEAT-AI2-002-10`。

**语法/弱点与写作：**

`SUBFEAT-AI2-003-01`、`SUBFEAT-AI2-003-02`；`SUBFEAT-AI2-004-01`、`SUBFEAT-AI2-004-02`、`SUBFEAT-AI2-004-03`。

**语音/实时/数字人/成人考试：**

`SUBFEAT-AI2-005-01`、`SUBFEAT-AI2-005-02`、`SUBFEAT-AI2-005-03`；`SUBFEAT-AI2-ROLEPLAY-001`；`SUBFEAT-AI2-DIGITALHUMAN-001`；`SUBFEAT-AI2-EXAM-001`、`SUBFEAT-AI2-EXAM-002`、`SUBFEAT-AI2-EXAM-003`。

**商务/出海/考试/辩论/RAG/社交：**

`SUBFEAT-AI2-006-01`、`SUBFEAT-AI2-006-02`、`SUBFEAT-AI2-006-03`、`SUBFEAT-AI2-006-04`；`SUBFEAT-AI2-OVERSEAS-001`；`SUBFEAT-AI2-007-01`、`SUBFEAT-AI2-007-02`、`SUBFEAT-AI2-007-03`；`SUBFEAT-AI2-DEBATE-001`；`SUBFEAT-AI2-RAG-001`；`SUBFEAT-AI2-SOCIAL-001`、`SUBFEAT-AI2-SOCIAL-001-A`、`SUBFEAT-AI2-SOCIAL-001-B`、`SUBFEAT-AI2-SOCIAL-001-C`。

这些编号覆盖 PRD §23.1 前置条件、§24.1～§24.3、§25.1～§25.2、§26.1～§26.3、§27.1～§27.3、§29、§30.1～§30.3、§31.1～§31.4、§32、§33.1～§33.3、§35、§36、§37 的可定位原子能力；§28 的实时语音与发音能力由 `FEAT-AI2-005` 及其子项承接。

### 21.2 已发现的统计/范围冲突（仅记录，不修改共享矩阵）

1. `requirements/feature-matrix.md` 顶部将 AI2 写为 **Phase 2 68 项**，但 AI2 表格目前只有 `FEAT-AI2-001`～`007` 7 条主功能。`docs/06-design/traceability/00-功能总账与统计校准.md` 的扫描也记录 Phase 2 现有 `FEAT-*` 为 7 条；本文用 `SUBFEAT-AI2-*` 展开 PRD 原子能力，不能把 68 视为本文已验证的数量。
2. 矩阵顶部 Phase 2 合计写 **228**，按域分期列直接相加为 **208**；Phase 1/3 也存在顶部总数与分域相加不一致。本文不重算、不改 `feature-matrix.md`。
3. AI2 矩阵领域范围写为 PRD §23～§33，但本任务要求并且 PRD 还包括 §35 辩论、§36 RAG、§37 社交升级；矩阵未为这些章节列独立主功能行，本文以设计专用 `SUBFEAT-AI2-*` 记录。
4. 矩阵 `FEAT-AI2-006` 名称聚焦跨境谈判，但 PRD §31.1～§31.4 还包含商务会议、邮件和行业术语；本文将其作为同一主功能下的 4 个设计子项。
5. 矩阵 `FEAT-AI2-007` 聚焦雅思口语 Part 1～3，PRD §33.1～§33.3 的范围是雅思/托福听力、阅读、写作、口语、五维诊断和题目趋势；本文按 PRD 扩展，但不新增矩阵主编号。
6. 矩阵 `FEAT-AI2-002` 提及职业背景，而 PRD §24.2 的长期记忆清单没有该项；本文明确不持久化职业背景，保留为 `SUBFEAT-AI2-002-10` 范围冲突，等待需求决策。
7. PRD/现有设计只要求商业 RTC、ASR/TTS 能力，没有冻结声网/腾讯云具体选型、媒体模型/供应商、实时音频留存和数据地域；本文不虚构实现，要求新增 ADR 后才能开 RTC/媒体 Flag。
8. PRD 允许 Phase 2 按需加入向量检索，但没有冻结 pgvector 或其他组件；RAG 设计保留检索适配层，组件选择、成本、数据地域和 ADR 未决。
9. 本文的超时、首包、配额和保留期数值是设计候选而非 PRD 证据，必须在成本/性能/隐私 Gate 和 contracts 冻结后才可作为验收阈值。

### 21.3 未决项与关闭条件

| 未决项 | 影响 | 关闭条件 |
|---|---|---|
| `gpt-5.6-luna` 的生产可用性、模态能力和成本单价 | 影响所有 AI/ASR/TTS/审核/RTC 编排 | 完成模型接入评测、Schema/安全评测、成本预算和运行时配置；不满足则保持 Flag 关闭，不使用其他模型 |
| 商业 RTC 供应商、token、Barge-in、录音/地域 | 影响 ASR、角色扮演、数字人、口语考试 | 新增 ADR、隐私/数据地域评估、供应商合同/计费和端到端故障测试 |
| ASR/TTS 是否由同一模型/媒体服务承载 | 影响 `modelId` 与媒体 Schema | 以 `gpt-5.6-luna` 模态能力验证为准；无验证就不开放动态 AI 媒体 |
| 向量检索组件与 embedding/索引成本 | 影响 RAG 数据模型、部署和删除 | 新增 ADR、授权/地域/删除证明、检索评测与成本 Gate |
| Phase 2 68 项与 PRD 原子数的统一统计口径 | 影响矩阵、WBS、验收数量 | 从 PRD 原子需求重新提取，确认主 FEAT/SUBFEAT 是否进入共享矩阵；本文不代改 |
| 职业背景是否属于长期学习记忆 | 影响隐私目的、同意、字段和删除 | PRD/产品决策确认后再补 Schema、数据字典和矩阵映射 |
| 18+ 认证的具体证据和升级流程 | 影响 Phase 2 AI、UGC、考试开放 | 复核现有账号年龄策略、身份认证能力、异常/申诉流程 |
| AI 文本/音频/数字人标识文案与位置 | 影响端 UI、商店/官网说明、合规 | 合规评审冻结组件、文案和全端验收案例 |
| 录音、转写、写作、RAG、社交原文保留期限 | 影响 S3、索引、删除和审计 | 隐私评估按数据类别给出期限、删除 SLA 和法律保留例外 |
| 社交真实身份认证、管理员和应急能力 | 影响自由文本 UGC 是否开启 | 前置能力验收通过；否则只开放预设低 UGC 社交 |
| 题目趋势的公开来源、版权与更新频率 | 影响雅思/托福趋势发布 | CMS 来源/授权/人工审核链路冻结，未满足则只发布自研练习 |

### 21.4 本文完成定义

本文在设计层面完成：每个现有 AI2 主功能与 PRD Phase 2 成人 AI 原子能力均有可定位章节；每项包含 PRD 证据、用户目标、流程/状态机、API、数据、权限隐私、Schema、promptVersion、超时/重试/降级、成本审计、埋点、跨端和验收；统计/范围冲突和未决项单独记录。实现层面的 OpenAPI、迁移、代码、测试和合规 Gate 仍须按 AGENTS.md DoD 在后续任务中闭合。
