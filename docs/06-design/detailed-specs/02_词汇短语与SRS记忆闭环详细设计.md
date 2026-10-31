# 02｜词汇、短语与 SRS 记忆闭环详细设计

> **Historical / Superseded（历史 v1 设计包）**：仅用于 v1 迁移与审计追溯，不是当前实现指令。当前业务设计、任务、契约与验收以 [v2-980plus/README.md](../v2-980plus/README.md) 为唯一入口；本文的旧数量、时间、架构、认证、事件、支付、版权和项目结构表述不得覆盖现行基线。

> **文档版本**：v2.0  
> **状态**：Phase 1 实施基线（可用于 API、数据库、前端与测试拆分）  
> **基线**：PRD v3.3 第 4.1～5.2、13.9；requirements/feature-matrix.md VOC-001～030  
> **所属域**：com.englishflow.modules.vocabulary、com.englishflow.modules.srs  
> **目标服务承载**：`learning-service`（SRS/学习事实）+ `content-service`（词汇/内容版本），外部请求经 `api-gateway`，权限由 `iam-service`/服务侧 PEP 校验。  
> **迁移兼容**：`services/core-api`（Java 17+ / Spring Boot 3 / MySQL 8 / Redis 7）仅作为 v1 兼容承载。  
> **客户端**：Vue 3 + TypeScript + uni-app（H5、iOS、Android、iPad、微信小程序）；管理端内容由教研域维护  
> **API 单一事实源**：本文件第 8 节 OpenAPI 3 契约，Java DTO 与前端类型由 openapi-generator 生成

---

---

## 0. 设计结论与不可越界边界

### 0.1 本域交付目标

本域把“可发布的词汇/短语内容”变成可追踪、可解释、可恢复的学习闭环：

内容发布 → 词卡或题型呈现 → 主动回忆与信心反馈 → 原子复习事件 → 确定性排程 → 延迟复测 → 掌握/重新巩固。

交付必须同时满足：

1. 同一学习对象在单词、短语、用户挖句、学习流和记忆中心之间使用同一对象标识与 SRS 基础设施。
2. 同一请求重试不会重复增加复习次数、XP、打卡或风控计数。
3. 任意复习结果都能通过 review_event_id、schedule_snapshot_id 和算法版本重放。
4. 用户离线或弱网时可以继续使用已缓存内容；网络恢复后按事件幂等同步，不以客户端状态覆盖服务端状态。
5. 任何“掌握”结论都由结构化事件和规则产生，不使用生成式 AI、向量检索或不可解释模型。

### 0.2 Phase 1 范围

- 用户范围：18 岁以上成人、大学生和职场人士。词书中的某些历史来源词表可作为成人备考资源使用，但不提供 K12 教材同步、未成年人画像、防沉迷或家长端能力。
- 内容范围：CEFR A1～C2、成人零基础/日常高频/核心高频、CET-4、CET-6、考研英语一/二、商务/旅行/阅读/写作高频等已审核资源。矩阵中的“高中核心/新概念”只有在成人资源包完成版权和受众标记后才可展示，不代表 Phase 3 K12 能力。
- 算法范围：确定性改进型 SM-2，q 取 0～3；规则化逾期平滑、延迟复测、反作弊和交错排程。
- 内容范围：教研预制释义、例句、音频、词根关系、易混词和 3D/2D 发音资源；例句不由 AI 实时生成。
- 不在本期：AI 对话、AI 生成例句、Embedding/向量语义检索、AI 发音评分、开放式自由输入的 AI 辨析、K12 同步。

### 0.3 跨域职责

| 能力 | 本域职责 | 依赖/归属 |
| --- | --- | --- |
| 词汇、释义、例句、词块、词根关系 | 只读已发布内容与版本快照 | 教研内容域负责录入、双审和发布 |
| 今日学习流 | 为学习流提供 VOC 学习对象与 SRS 摘要 | learning 域负责 40% 新学、40% 到期复习、20% 错题重练的总编排 |
| SRS 状态与复习事件 | 本域负责 VOC/CHUNK/EXPRESSION 的状态、事件、快照与排程 | learning 域通过统一事件调用；语法等其他对象可复用同一事件协议 |
| 用户目标和每日配额 | 读取当前生效计划、每日新学量和复习上限 | onboarding/learning 域维护 |
| 账号、设备、权限 | 校验身份与资源归属 | auth 域维护 |
| XP、Streak、通知 | 只发出可审计的学习结果事件，不直接改写资产 | gamification/notification 域消费事件 |

### 0.4 设计不变量

1. 一个 LearningItem 只能有一种 itemType 和一个目标 ID：VOCAB 对应 vocab_id，CHUNK 对应 chunk_id，EXPRESSION 对应 expression_id。
2. 已发布内容和用户历史事件不能物理删除；内容通过 ARCHIVED 下架，用户数据通过软删除/匿名化处理。
3. review_event_id 是事实，lrn_srs_state 是当前投影，lrn_schedule_snapshot 是当日排程的不可变输入快照；三者不可互相替代。
4. 任何写接口都要求鉴权、资源归属、输入校验和 Idempotency-Key；GET 不改变学习状态。
5. 服务器时间是排程与反作弊的权威时间；clientOccurredAt 仅用于弱网重排和审计。
6. 客户端不得将标准答案、服务端判定、EF 或排程公式作为可变业务逻辑；客户端只渲染契约、缓存内容并上传事件。

---

---

## 1. 统一术语、标识与状态枚举

### 1.1 核心标识

| 术语 | 数据类型 | 语义与唯一性 |
| --- | --- | --- |
| vocab_id | BIGINT UNSIGNED | 一个词元/词头的稳定 ID；不因释义、词书或内容版本变化 |
| definition_id | BIGINT UNSIGNED | 一个词义（sense）的稳定 ID；一个 vocab_id 可有多个 definition_id |
| example_id | BIGINT UNSIGNED | 一个教研例句 ID；由内容版本固定 |
| chunk_id | BIGINT UNSIGNED | 一个完整短语、固定搭配、句块或句型的独立学习对象 |
| expression_id | BIGINT UNSIGNED | 用户从阅读/听力/场景/例句中挖出的个人表达；归属单一 user_id |
| wordbook_id | BIGINT UNSIGNED | 词书/资源包 ID；同一 vocab_id 可出现在多个 wordbook_id |
| root_id | BIGINT UNSIGNED | 预制词根/前缀/后缀专题 ID |
| learning_item | Discriminated Union | { itemType: VOCAB, vocabId } 或 { itemType: CHUNK, chunkId } 或 { itemType: EXPRESSION, expressionId } |
| srs_state_id | BIGINT UNSIGNED | 用户对一个 learning_item 的当前 SRS 投影；每个 user_id + item_key 至多一行 |
| review_event_id | BIGINT UNSIGNED | 一次用户复习/训练反馈事实；追加写入，不更新历史含义 |
| schedule_snapshot_id | BIGINT UNSIGNED | 某用户某个本地日期生成的排程批次快照 |
| snapshot_item_id | BIGINT UNSIGNED | 批次中的一个待复习/待学习项；固定序号和内容版本 |
| risk_audit_id | BIGINT UNSIGNED | 一次风控判断与证据的不可变审计记录 |

数据库使用 snake_case；JSON/API 使用 camelCase。历史文档中的 cnt_vocabulary.id 在本设计中统一命名为 vocab_id；实现迁移时不得同时维护两个事实字段。

### 1.2 内容状态枚举

- ContentStatus：DRAFT、IN_REVIEW、APPROVED、PUBLISHED、ARCHIVED。
- WordbookCode：ADULT_ZERO_1000、DAILY_HIGH_2000、CORE_HIGH_4000、CET4_CORE、CET6_CORE、POSTGRAD_1、POSTGRAD_2、BUSINESS_BASIC、TRAVEL_LIFE、READING_HIGH、WRITING_HIGH。
- ContentSourceType：EDITORIAL、READING、LISTENING、SCENARIO、VOCAB_EXAMPLE。
- RelationType：DERIVATIVE、SYNONYM、ANTONYM、CONFUSABLE、COLLOCATION_RELATED。

### 1.3 学习、SRS 与批次状态枚举

- ItemType：VOCAB、CHUNK、EXPRESSION。
- MasteryStatus：NEW、LEARNING、SHORT_TERM、CONSOLIDATING、MASTERED、CONSOLIDATED、AT_RISK、SUSPENDED。
- DelayedVerifyStage：NONE、D1_PENDING、D7_PENDING、PASSED、FAILED。
- SnapshotStatus：ACTIVE、PARTIALLY_CONSUMED、CONSUMED、EXPIRED。
- SnapshotItemStatus：PENDING、IN_PROGRESS、COMPLETED、SKIPPED、EXPIRED、RISK_FILTERED。
- ReviewEventStatus：ACCEPTED、DUPLICATE、RISK_FILTERED、CONFLICT、REJECTED、EXPIRED。
- AnswerOutcome：CORRECT、INCORRECT、UNANSWERED、REVEALED_WITHOUT_ANSWER。
- RiskDecision：ALLOW、ACCEPT_NO_REWARD、THROTTLE、REJECT、REVIEW。

### 1.4 前端类型约束

前端使用以下判别联合，不允许使用裸 any：

~~~ts
type LearningItemRef =
  | { itemType: 'VOCAB'; vocabId: number }
  | { itemType: 'CHUNK'; chunkId: number }
  | { itemType: 'EXPRESSION'; expressionId: number };

type ReviewQuality = 0 | 1 | 2 | 3;
type MasteryStatus =
  | 'NEW' | 'LEARNING' | 'SHORT_TERM' | 'CONSOLIDATING'
  | 'MASTERED' | 'CONSOLIDATED' | 'AT_RISK' | 'SUSPENDED';
~~~

所有字段由 OpenAPI 生成；如果契约变更，先更新 OpenAPI，再生成 Java/TypeScript 类型并运行契约测试。

---

---

## 2. 功能树与交付优先级

~~~text
VOC 词汇、短语与 SRS 记忆闭环
├── 词书与分级：VOC-001～003
├── 单词多维档案：VOC-004～010
├── SRS 与主动回忆：VOC-011～015
├── 训练题型：VOC-016～020
├── 个人词库与表达：VOC-021～027
├── 词根与词族：VOC-028～029
└── 风控审计：VOC-030
~~~

所有 30 项为 Phase 1 P0，FEAT-VOC-029 按功能矩阵为 P1；P1 仍使用预制关系和 SVG/Canvas，不引入向量检索。

---

---

## 3. FEAT-VOC-001～030 逐项详细设计

以下每项都必须具备“目标、前置、主流程、异常/边界、验收、埋点”六部分。埋点只记录业务元数据，不上传用户私人笔记原文、完整挖句内容或原始音频。

### FEAT-VOC-001｜权威官方词库矩阵

- **目标**：向成人用户提供可审计来源、可分级、可切换的 Phase 1 词书矩阵，覆盖 CEFR A1～C2、CET-4、CET-6、考研英语一/二及成人场景词书。
- **前置**：用户已登录；词书处于 PUBLISHED；内容版本通过教研双审并带有 license_ref/source_version。
- **主流程**：
  1. 客户端按用户 targetGoal、currentCefrLevel 和可用权益请求词书列表。
  2. 服务端只返回 PUBLISHED 且适用于成人的 wordbook；返回 wordbook_id、code、名称、等级范围、内容版本、词条数和预计天数。
  3. 用户进入词书详情后，服务端按 wordbook_id + sequence_no 提供分页词条，不把未发布资源混入结果。
  4. 当前主计划由 learning 域维护，本域只返回可激活候选及已有 srs 摘要。
- **异常/边界**：无可用词书返回 CONTENT_NOT_PUBLISHED；版权到期的版本立即 ARCHIVED 但保留历史事件引用；同一 vocab_id 出现在多本词书只保留一份 SRS；成人用户不可访问 K12 标记资源。
- **验收**：
  - 列表可稳定返回矩阵中的成人词书及 contentVersion。
  - 未发布、已归档词书不可出现在默认列表。
  - 同一词元跨词书的 srs_state_id 不重复。
  - 词书版本切换可回放到当时的内容版本。
- **埋点**：vocab.wordbook.listed.v1（筛选、返回数量）；vocab.wordbook.viewed.v1（wordbook_id、content_version）；vocab.wordbook.item_opened.v1（sequence_no）。

### FEAT-VOC-002｜词书切换与进度保存

- **目标**：支持多词书并行浏览、仅一套主学习计划生效，并在切换时完整保留历史掌握度、复习事件和个人收藏。
- **前置**：用户已登录；目标词书 PUBLISHED；请求带 Idempotency-Key；当前计划未被风控冻结。
- **主流程**：
  1. 客户端展示当前 active_wordbook_id 与可选词书。
  2. 用户确认切换，调用词书订阅接口；服务端在事务中锁定用户学习计划，关闭旧主计划、激活新计划。
  3. 切换只改变“新学候选来源”和首屏推荐，不重置任何 vocab_id/chunk_id/expression_id 的 SRS。
  4. 返回新的计划版本、待学数量、保留的总体掌握数量和首批排程引用。
- **异常/边界**：重复幂等键返回首次结果；同一用户并发切换按行锁串行；旧词书未完成的批次继续可消费但不再生成新快照；词书版本不兼容返回 CONTENT_VERSION_CONFLICT。
- **验收**：
  - 一个用户同一时刻至多一份 active 词书计划。
  - 切换前后同一 vocab_id 的 stateVersion、reviewCount、masteryStatus 不被重置。
  - 断网重试不会产生第二个 active 计划。
- **埋点**：vocab.wordbook.switch_started.v1、vocab.wordbook.switch_succeeded.v1、vocab.wordbook.switch_failed.v1（失败 errorCode、是否重试）。

### FEAT-VOC-003｜词频与难度/考试热度标记

- **目标**：在词卡、词书列表和筛选器中展示 COCA 词频排名、CEFR 难度、考试近十年考察次数及来源版本。
- **前置**：vocab_id 已发布；频次/考试统计由教研导入并通过版本审核。
- **主流程**：
  1. 详情接口返回 frequencyRank、frequencySourceVersion、examHeat 数组和 cefrLevel。
  2. 客户端按规则显示“高频/中频/低频”和目标考试热度，不将热度解释为掌握概率。
  3. 用户可按 cefrLevel、频次区间或 examCode 过滤词书内容。
- **异常/边界**：无授权频次数据返回 null 和“暂无数据”；统计版本更新不改变 vocab_id；排名不在 1～20000 时拒绝发布；同频次按 vocab_id 稳定排序。
- **验收**：
  - 过滤、排序与接口返回一致，分页跨页无重复。
  - 每个非空数值可追溯 sourceVersion。
  - 没有统计数据时页面不显示虚假 0。
- **埋点**：vocab.frequency.filter_used.v1、vocab.exam_heat.viewed.v1（exam_code、source_version）。

### FEAT-VOC-004｜多模态音标与原声音频

- **目标**：提供 US/UK IPA、常速/慢速合法音频和可访问的文字替代，帮助用户在词卡和详情页完成听辨。
- **前置**：vocab_id 已发布；音频对象通过 OSS/CDN 资源校验并带 mediaVersion。
- **主流程**：
  1. 详情返回 phoneticUs、phoneticUk、audioUsNormal、audioUsSlow、audioUkNormal、audioUkSlow。
  2. 用户选择口音和速度，客户端使用统一播放器播放，显示加载、播放、暂停和失败状态。
  3. 播放失败时按 1s、2s、4s 重试一次资源解析，仍失败则提供文本/下载入口。
- **异常/边界**：禁止自动播放；小程序/移动端受系统静音开关影响时给出提示；CDN 404 不阻塞翻卡；音频版本变化不影响历史复习事件。
- **验收**：
  - 四类音频均可按权限访问或明确显示不可用。
  - 键盘、屏幕阅读器和触控均能操作播放。
  - 断网时已下载音频可播放，未下载音频不显示假成功。
- **埋点**：vocab.audio.played.v1（accent、speed、cacheHit）；vocab.audio.failed.v1（mediaVersion、retryCount）。

### FEAT-VOC-005｜权威双语释义与词性标注

- **目标**：以 definition_id 为粒度展示词性、简明中文释义和已审核英英释义，避免一个词多个义项混淆。
- **前置**：vocab_id 与至少一个 PUBLISHED definition_id 已关联；释义有 source/license 元数据。
- **主流程**：
  1. 服务端按 sense_no 返回释义、词性、使用域、中文解释和英文简释。
  2. 客户端默认展开主释义，支持展开全部义项；词卡背面只显示本批次要求的摘要，详情页显示完整内容。
  3. 训练题通过 definition_id 绑定正确义项和干扰项，避免仅按文本比较。
- **异常/边界**：释义缺失时内容发布校验失败；词性未知使用 OTHER 并要求教研补全；不同版本释义变化时历史 snapshot 保留旧的 contentHash。
- **验收**：
  - 每个 PUBLISHED vocab_id 至少有一个 PUBLISHED definition_id。
  - 词性、义项顺序、题目答案引用完全一致。
  - 详情页不把未审核草稿返回给学习端。
- **埋点**：vocab.definition.expanded.v1（vocab_id、definition_id）；vocab.definition.reported.v1（contentVersion、reportType）。

### FEAT-VOC-006｜语境例句库与划词高亮

- **目标**：每个核心义项提供 2～3 条已审核的分级例句、中文翻译、音频和目标词高亮范围。
- **前置**：example_id 已绑定 vocab_id/definition_id；例句状态 PUBLISHED；highlightSpans 通过文本长度校验。
- **主流程**：
  1. 接口按 difficultyLevel 和 sortOrder 返回例句。
  2. 客户端根据 Unicode code point 约定渲染目标词高亮，不自行猜测字符串位置。
  3. 用户可播放例句音频、查看中文、从例句中选取句块或挖句。
- **异常/边界**：音频不可用不影响文本；例句来源被撤下时该条 ARCHIVED；高亮越界由服务端拒绝发布；用户收藏的表达保存 sourceContentVersion 快照。
- **验收**：
  - 核心词义至少有 2 条例句，且高亮不误标同形非目标词。
  - 例句详情可回链 vocab_id、definition_id、example_id。
  - 从例句挖句后能回到原词义与上下文。
- **埋点**：vocab.example.viewed.v1、vocab.example.audio_played.v1、vocab.example.mined_started.v1（example_id、source_type）。

### FEAT-VOC-007｜3D 口腔侧剖面透视入口

- **目标**：展示预制的舌位、唇形、软腭和气流关键帧；在低算力设备上稳定降级为 2D 静态/关键帧资源。
- **前置**：anatomyCode 已通过资源校验；客户端已初始化 AdaptivePerformanceEngine；用户设备支持对应渲染能力。
- **主流程**：
  1. 用户在详情或卡片背面点击“发音示意”。
  2. H5/App 使用 Three.js 载入预制模型和 Draco 资源；小程序优先使用 2D 帧动画。
  3. 根据 Ultra、High、Medium、Performance 四级画质加载不同资源，允许用户手动关闭动效。
  4. WebGL 上下文丢失时在 50ms 内切换到 2D 备选并保留文字说明。
- **异常/边界**：模型下载失败使用 SVG/PNG；Reduced Motion 时不播放循环动画；不在 Phase 1 实时推断用户发音；不引入 Lottie 大资源。
- **验收**：
  - 四级画质均有可用资源和关闭入口。
  - WebGL 丢失、横竖屏切换、返回后台不白屏、不阻塞评分和翻卡。
  - 低端设备首帧在预算内完成，2D 方案具备等价信息。
- **埋点**：vocab.anatomy.opened.v1（qualityLevel、renderMode）；vocab.anatomy.degraded.v1（from、to、reason）。

### FEAT-VOC-008｜派生词与同反义词族网

- **目标**：通过教研预制关系展示 derivative、synonym、antonym 和使用差异，支持从关系节点预览并加入待学。
- **前置**：关系表两端 vocab_id 均为 PUBLISHED；relationType 和 relationVersion 有效。
- **主流程**：
  1. 详情接口返回按 relationType 分组的关系节点。
  2. 用户点击节点，底部抽屉展示单词、词性、主释义和当前熟练度摘要。
  3. 用户选择加入待学时创建用户收藏或 SRS NEW 状态，写操作携带幂等键。
- **异常/边界**：关系形成环时只按 visited vocab_id 去重；目标词已归档时隐藏并记录内容缺失；Phase 1 不根据向量相似度补关系。
- **验收**：
  - 关系方向、类型和排序可回放到 relationVersion。
  - 加入待学不改变已有 SRS 的 interval/EF。
  - 关系抽屉不泄露未发布释义。
- **埋点**：vocab.relation.opened.v1、vocab.relation.item_queued.v1（from_vocab_id、to_vocab_id、relation_type）。

### FEAT-VOC-009｜词根词缀图解拆解

- **目标**：以 root_id、prefix、suffix 和 morphemeOrder 展示可解释的构词拆解，并链接词族课程。
- **前置**：词根/词缀关系由教研审核；vocab_id 的拆解区间不越界。
- **主流程**：
  1. 详情返回 morpheme tree 和 root topic 摘要。
  2. 用户点击前缀/词根/后缀节点查看含义、例词和课程入口。
  3. 用户可将例词加入待学，仍复用同一 SRS。
- **异常/边界**：无可靠词源的词显示“暂无拆解”，不强行编造；一个词可关联多个 root_id，但页面保持有序；词源解释与语义近似不得当作精确词源证明。
- **验收**：
  - 每个展示节点可定位词内区间或明确为语义关联。
  - 课程和例词数量、排序与发布数据一致。
  - 低视力用户可用线性列表访问图解信息。
- **埋点**：vocab.morpheme.opened.v1、vocab.root.lesson_clicked.v1（root_id、vocab_id）。

### FEAT-VOC-010｜易混淆词陷阱对照

- **目标**：对形近、音近、义近词提供差异字母/音素、核心释义和最小对比例句。
- **前置**：confusable pair 两端均发布；教研填写 differenceNote、examples 和 compareVersion。
- **主流程**：
  1. 详情页展示对照卡，服务端提供差异区间，不由前端自行 diff。
  2. 用户切换两词或进入对比训练，完成选择/填空后可分别提交 q。
  3. 错误项进入对应 vocab_id 的错题与 SRS，不把两个词合并为一个状态。
- **异常/边界**：同一词对多个混淆词按 priority 展示；任一端归档则对照不在学习端展示；无差异标注不可发布。
- **验收**：
  - accept/except 等最小对照能准确标红差异。
  - 两个 vocab_id 的复习事件、状态和统计相互独立。
  - 对比题答案不通过客户端传入的正确文本决定。
- **埋点**：vocab.confusable.viewed.v1、vocab.confusable.answered.v1（pair_id、correct、response_time_ms）。

### FEAT-VOC-011｜改进型 SuperMemo SM-2 算法

- **目标**：使用确定性 q=0～3 规则计算 EF、连续成功次数、间隔、状态和下次复习时间。
- **前置**：已存在或可创建 srs_state_id；复习事件通过鉴权、幂等和风控校验；服务端锁定状态行。
- **主流程**：
  1. 读取事件前状态和算法版本 SM2_Q03_V1。
  2. 根据 rawQuality、answerOutcome 和规则得到 effectiveQuality。
  3. 使用第 4 节公式计算 nextState，写入 review_event、lrn_srs_state 和 snapshot_item。
  4. 返回新 stateVersion、下次排程、解释字段和是否重算/风控过滤。
- **异常/边界**：q 非 0～3、item 引用不唯一、状态版本过期、内容未发布或超过离线窗口时拒绝；同一幂等键只返回首次结果；EF 永不低于 1.30、不高于 2.50。
- **验收**：
  - 同一 priorState + q + effectiveAt + algorithmVersion 的输出字节级一致。
  - 并发复习不丢事件、不覆盖较新的 stateVersion。
  - q=0/1 重置连续成功次数，q=2/3 按锚点/公式推进。
- **埋点**：learning.srs.calculated.v1（item_type、effective_q、algorithm_version、state_version_before/after）；不上传 EF 以外的私人内容。

### FEAT-VOC-012｜艾宾浩斯复习排程梯度

- **目标**：把 1、3、7、15、30、90 天作为用户可理解的前六阶排程锚点，并在第七阶起使用 SM-2 公式继续增长。
- **前置**：SRS 状态有效；用户有时区和每日计划；当前日期由服务端转换为用户本地日期。
- **主流程**：
  1. q≥2 时按 n′ 的 1～6 阶使用固定锚点，n′≥7 使用 round(previousInterval × EF′)。
  2. q<2 时 intervalDays=1、n′=0。
  3. 生成 dueAt（UTC）和 dueLocalDate（用户时区），展示“为什么今天复习”说明。
- **异常/边界**：时区变更只影响未来 dueLocalDate，不重算历史事件；日期跨 DST 使用 ZonedDateTime；间隔上限 365 天；不把展示曲线当医学预测。
- **验收**：
  - 新词连续 q=2 的 interval 依次为 1、3、7、15、30、90。
  - n′≥7 的间隔计算包含 EF′、四舍五入规则固定为 HALF_UP。
  - API 与数据库存储的 UTC/本地日期可以互相解释。
- **埋点**：learning.srs.schedule_explained.v1（interval_days、next_review_local_date、reason_code）。

### FEAT-VOC-013｜主动回忆交互卡片

- **目标**：先回忆后揭晓，避免正面直接暴露答案；支持看词回忆义、看义回忆词、听音回忆拼写和句块关键词回忆。
- **前置**：快照项状态 PENDING/IN_PROGRESS；正面内容已缓存；用户未超过本批次租约。
- **主流程**：
  1. 进入 FRONT，只显示学习提示、单词/句块标题、IPA/音频和进度，不显示答案释义。
  2. 用户点击“显示答案”、上滑或按 Space 进入 REVEALING→BACK。
  3. 背面展示受 snapshot contentVersion 固定的释义、例句、关系和训练入口。
  4. 用户选择 q=0/1/2/3，进入 RATING→SUBMITTING；提交成功后进入 NEXT。
- **异常/边界**：用户直接退出生成断点快照但不产生 review_event；无障碍模式使用显式按钮；已提交卡片再次打开只读结果；离线提交显示 PENDING_SYNC，不伪装为已同步。
- **验收**：
  - FRONT DOM/可访问树中没有答案字段。
  - 翻面、评分、返回、键盘和触控路径均可完成。
  - 用户未点击揭晓时不能误触发 q。
- **埋点**：learning.card.front_viewed.v1、learning.card.revealed.v1（reveal_method、elapsed_ms）、learning.card.next_clicked.v1。

### FEAT-VOC-014｜4 级信心度评定

- **目标**：让用户在揭晓后明确选择“完全忘了/模糊/顺利想起/轻而易举”，并把自评作为 SRS 辅助信号而不是考试分数。
- **前置**：卡片已进入 BACK；q 为整数 0～3；按钮文案和无障碍 label 已加载。
- **主流程**：
  1. 展示四个互斥按钮及对应解释。
  2. 记录 rawQuality、选择时间和是否看答案；若题目客观错误，按规则计算 effectiveQuality。
  3. 提交后返回本次 SRS 解释、下一次日期和是否需要 D1/D7 延迟验证。
- **异常/边界**：重复点击由客户端禁用并由服务端幂等兜底；客观错误且 q≥2 时 effectiveQuality 最高为 1；无作答仅揭晓时允许 q，但 answerOutcome 为 REVEALED_WITHOUT_ANSWER。
- **验收**：
  - 四个按钮可被屏幕阅读器区分，选中态不只靠颜色。
  - q=0/1 与 q=2/3 的状态变化符合算法。
  - rawQuality 和 effectiveQuality 均可在审计中追溯。
- **埋点**：learning.confidence.selected.v1（raw_quality、effective_quality、answer_outcome、reveal_elapsed_ms）。

### FEAT-VOC-015｜逾期复习智能平滑

- **目标**：断签后优先处理高遗忘风险和延迟验证项，限制每日复习量并把剩余积压分摊到未来 2～7 天。
- **前置**：用户有 dailyNewTarget 和 maxDailyReview；存在 dueLocalDate≤today 的未暂停状态；生成排程快照时锁定用户日期批次。
- **主流程**：
  1. 计算 overdueDays、priorityScore 和稳定排序键。
  2. 今日最多放入 maxDailyReview；复习优先于新学，余量按 plannedLocalDate 分配。
  3. 对超出部分只在 snapshot_item 中设置 plannedLocalDate，不篡改 SRS 原始 dueAt。
  4. 返回今日数量、未来 2～7 天追赶建议和每项 deferReason。
- **异常/边界**：积压超过 7 天仍保留到期事实并显示“追赶已达上限”；用户可下调新学量但不能绕过安全上限；SUSPENDED、ARCHIVED、RISK_FILTERED 不进入正常复习；优先级同分按 dueAt、itemType、目标 ID 排序。
- **验收**：
  - 任意日期复习数不超过用户上限。
  - 同一批次重复生成结果一致。
  - 高风险项不会被新词挤出，且未来释放日期可解释。
- **埋点**：learning.srs.overdue_detected.v1、learning.srs.backlog_smoothed.v1（backlog_count、today_count、horizon_days、max_daily_review）。

### FEAT-VOC-016｜4 选 1 词义选择题

- **目标**：提供看词选义或看义选词的规则化选择题，干扰项同等级、同词性且不泄露答案。
- **前置**：题包由已发布 definition_id/vocab_id 组成；服务端已固定 questionSeed 和 answerKey；学习端不接收标准答案字段。
- **主流程**：
  1. 服务端按题型和快照返回题干、四个 option、optionKey 和 contentHash。
  2. 用户选择后本地立即显示选中态；提交由服务端判分。
  3. 返回正确/错误、权威解析、错误归因并记录 review_event。
- **异常/边界**：选项不足四个则题包发布失败；重复选项按规范化文本查重；网络断开可使用缓存题包但结果标记待同步；不通过客户端答案字段判分。
- **验收**：
  - 每题恰有四个互不重复选项，正确项来自 definition_id。
  - 错误反馈包含解析但不泄露未来题包答案。
  - 做题结果能关联 vocab_id、definition_id 和 review_event_id。
- **埋点**：practice.vocab.meaning_choice.started.v1、practice.vocab.meaning_choice.submitted.v1（option_key、correct、response_time_ms）。

### FEAT-VOC-017｜听音辨词选择题

- **目标**：只给合法音频和四个候选，训练从声音到词义/拼写的识别。
- **前置**：目标音频可播放；四个候选均已发布；用户设备允许音频交互。
- **主流程**：
  1. 进入题目时不展示目标单词文本，提供播放、重播和进度。
  2. 用户选择释义或词形选项，服务端判分并记录播放次数、首播到作答时间。
  3. 反馈页展示音标、答案释义和可选慢速音频。
- **异常/边界**：音频加载失败提供文字替代并允许跳过；自动播放被浏览器拦截时提示点击播放；重播不改变 q，连续重播只作为辅助分析信号。
- **验收**：
  - 题目首屏不出现目标词文本。
  - 音频失败可继续，不产生错误的已答状态。
  - 结果可在弱网下幂等同步。
- **埋点**：practice.vocab.audio_choice.played.v1、practice.vocab.audio_choice.submitted.v1（play_count、audio_ready_ms、correct）。

### FEAT-VOC-018｜例句挖空选词填空

- **目标**：利用语境选择正确词形，覆盖目标词、词义和搭配使用。
- **前置**：example_id 有合法 blankSpan/targetVocabId；干扰项同等级并通过词性校验。
- **主流程**：
  1. 展示含 [BLANK] 的例句、中文提示（按题型可选）和选项。
  2. 用户选择后即时渲染但以服务端结果为准。
  3. 错误时展开目标义项、搭配和例句音频，并把错误归因设为 CONTEXT_MISUSE。
- **异常/边界**：同一例句不能出现多个未标注空位；目标词多词形时答案匹配由 definition_id/wordForm 规则决定；例句版本变更不影响已生成快照。
- **验收**：
  - 挖空位置、翻译和正确答案引用一致。
  - 正确与错误均能写入复习事件，且可追踪 example_id。
  - 未授权例句不进入题包。
- **埋点**：practice.vocab.cloze.started.v1、practice.vocab.cloze.submitted.v1（example_id、correct、hint_used）。

### FEAT-VOC-019｜字母乱序拼写重组

- **目标**：使用字母气泡训练目标词拼写，支持键盘和触控排序，避免因大小写/标点造成误判。
- **前置**：目标 vocab_id 的 normalizedWord 可用；题目已生成唯一 shuffleSeed；不包含不可处理的连字符规则。
- **主流程**：
  1. 服务端返回字母 token 列表和空槽位，不返回标准答案字段。
  2. 用户点击/拖动 token 组装，客户端只校验格式并提交 tokenId 顺序。
  3. 服务端按 shuffleSeed 还原标准化拼写，返回逐位差异和错误归因。
- **异常/边界**：重复字母 token 必须有独立 tokenId；撤销/重排不重复提交；含空格、多词短语转由 CHUNK 题型处理；无障碍提供线性输入。
- **验收**：
  - 重复字母、大小写和多端拖拽结果一致。
  - 正确顺序唯一且与 vocab_id 绑定。
  - 错误时不在前端源码暴露标准答案。
- **埋点**：practice.vocab.anagram.started.v1、practice.vocab.anagram.completed.v1（move_count、correct、response_time_ms）。

### FEAT-VOC-020｜键盘盲打全拼填空

- **目标**：支持实体键盘和虚拟键盘输入完整拼写，按标准化规则判分并保留用户原始输入的最小审计信息。
- **前置**：题目允许拼写输入；输入框已获得焦点；客户端根据端能力选择键盘。
- **主流程**：
  1. 展示提示、音频和输入框，不展示目标文本。
  2. 用户输入、退格、提交；服务端执行 Unicode 规范化、大小写归一化和允许的连字符规则。
  3. 返回是否正确、差异位置、解析和 SRS 反馈。
- **异常/边界**：输入为空为 UNANSWERED；超长输入截断并返回 VALIDATION_ERROR；用户原始答案只存审计摘要/hash，避免不必要地保存隐私；小程序无实体键盘时使用虚拟键盘。
- **验收**：
  - US/UK 拼写别名规则由内容配置决定，不能由客户端猜测。
  - 物理键盘、虚拟键盘、屏幕阅读器均可提交。
  - 重复请求不增加 reviewCount。
- **埋点**：practice.vocab.spelling.started.v1、practice.vocab.spelling.submitted.v1（input_length、correct、response_time_ms、keyboard_type）。

### FEAT-VOC-021｜生词本管理

- **目标**：支持用户在详情、阅读、听力、做题中收藏 vocab_id/chunk_id，并按来源和添加时间管理。
- **前置**：用户已登录；目标内容 PUBLISHED；用户拥有该资源的学习权限。
- **主流程**：
  1. 用户点击星标，调用 collection entries POST，携带 sourceType 和 Idempotency-Key。
  2. 服务端按 user_id + item_key 去重，创建或恢复软删除记录。
  3. 列表支持 cursor 分页、搜索、标签、来源和 masteryStatus 筛选。
- **异常/边界**：重复收藏返回已有 entry_id；删除只做软删除；内容归档后用户历史收藏仍可查看摘要但不能加入新批次；收藏不自动把 MASTERED 降级。
- **验收**：
  - 收藏、取消、重试、跨端同步结果一致。
  - 列表 cursor 不重复且不因新收藏导致当前页乱序。
  - 来源字段至少可区分 READING、LISTENING、PRACTICE、MANUAL、SYSTEM。
- **埋点**：vocab.collection.added.v1、vocab.collection.removed.v1、vocab.collection.filtered.v1（item_type、source_type、filter_count）。

### FEAT-VOC-022｜已掌握词库

- **目标**：展示通过 D7 延迟验证且满足掌握门槛的学习对象，支持检索和移出生词本，但不删除历史复习事实。
- **前置**：srs_state.masteryStatus 为 MASTERED 或 CONSOLIDATED；D7 验证事件已 ACCEPTED。
- **主流程**：
  1. 服务端按用户返回 mastered 视图，附最近复习、下次复习和稳定性摘要。
  2. 用户查看详情、主动复习或移出生词收藏。
  3. 若再次复习失败，状态转 AT_RISK/CONSOLIDATING，重新进入 SRS。
- **异常/边界**：仅当天答对不得进入已掌握；D7 复测失败立即回到 LEARNING/AT_RISK；移出生词本不影响 SRS；归档内容只显示历史快照。
- **验收**：
  - 只有通过 D7 的对象出现在默认掌握列表。
  - 失败复测不会删除原有事件，并能看到降级原因。
  - 归档/移除操作均有审计和幂等结果。
- **埋点**：learning.mastery.entered.v1、learning.mastery.at_risk.v1、vocab.mastered.removed_from_collection.v1（delayed_stage、reason_code）。

### FEAT-VOC-023｜词库多维熟练度过滤器

- **目标**：按等级、掌握状态、来源、到期/即将遗忘、标签和词书筛选用户词库。
- **前置**：用户已登录；筛选字段在 OpenAPI enum 内；服务端只查询用户自己的数据。
- **主流程**：
  1. 客户端组合 cefrLevel、masteryStatus、dueRange、sourceType、wordbookId、tag 和 cursor。
  2. 服务端通过覆盖索引先筛选 srs_state/library，再回表读取内容摘要。
  3. 返回稳定 sortKey（nextReviewAt、updatedAt、itemKey）和 nextCursor。
- **异常/边界**：非法组合返回 VALIDATION_ERROR；无结果返回空页而不是 404；同时请求 due 和 mastered 时按明确 AND 规则；分页上限 100。
- **验收**：
  - 过滤结果不跨用户、不跨归属。
  - cursor 翻页稳定，状态更新后不会重复返回同一项。
  - 统计数字与列表查询使用同一 snapshotAt。
- **埋点**：vocab.library.filter_used.v1（维度摘要、result_count）；vocab.library.page_loaded.v1（cursor、latency_ms）。

### FEAT-VOC-024｜Phrase & Chunk 句块知识库

- **目标**：提供至少 2000 个教研审核的固定短语、collocation、口语句块、常用句型和完整表达，并使其成为独立 LearningItem。
- **前置**：chunk_id 已发布；具有表达、中文解释、场景、关键词、常见错误、例句和音频/文本替代。
- **主流程**：
  1. 按场景、CEFR、chunkType、wordbook_id 或搜索读取句块。
  2. 详情展示 canonicalText、meaningCn、usageNote、keywords、examples 和错误提示。
  3. 用户可直接加入待学或纳入当前 learning stream。
- **异常/边界**：单个单词与句块不得共享 srs_state；重复规范化表达在同一 contentVersion 内拒绝；例句中的单词关联可为空；句块归档不删除个人 SRS 事件。
- **验收**：
  - PUBLISHED 句块总量和分类统计可审计。
  - 每个可学习句块有独立 chunk_id 和 SRS 状态。
  - “take care of”等多词表达按 CHUNK 处理而不是拆为三个独立复习事件。
- **埋点**：vocab.chunk.listed.v1、vocab.chunk.viewed.v1、vocab.chunk.queued.v1（chunk_id、chunk_type、scenario_code）。

### FEAT-VOC-025｜句块独立 SM-2 排程

- **目标**：句块与单词共享算法、事件和快照表，但拥有独立的 EF、n、interval、masteryStatus 和 q 反馈。
- **前置**：chunk_id 已发布；可创建 itemType=CHUNK 的 srs_state；快照 itemKey 唯一。
- **主流程**：
  1. 句块进入新学或复习批次时创建/读取 CHUNK 状态。
  2. 用户完成看义回忆、挖空、听写、重排、场景选择或跟读后提交 q。
  3. 服务端按同一 SM2_Q03_V1 计算并返回句块专属排程。
- **异常/边界**：句块与其组成 vocab_id 的事件不互相覆盖；句块表达版本变化时使用 contentHash 和新 snapshot；跟读无 AI 评分，Phase 1 只记录是否完成和用户自评。
- **验收**：
  - 同一用户同时拥有 vocab_id=1 和 chunk_id=1 时有两条独立 SRS。
  - 句块失败只调整句块状态，除非题目明确同时记录词汇错误。
  - 断网同步、幂等、并发规则与单词一致。
- **埋点**：learning.chunk.review_submitted.v1、learning.chunk.schedule_updated.v1（chunk_id、effective_q、interval_days）。

### FEAT-VOC-026｜句子挖掘表达库

- **目标**：在阅读、听力、场景课、词汇例句中选中整句或句块，保存来源上下文、用户想会说标记和可选 SRS。
- **前置**：来源内容已发布且用户有访问权；选区位于来源文本范围内；用户已登录。
- **主流程**：
  1. 用户长按/拖选文本，Bottom Sheet 显示收藏整句、收藏句块、我想会说、添加备注、加入 SRS。
  2. 客户端提交 sourceType、sourceRef、contentVersion、textRange、sentenceSnapshot、sourceAudioRef 和 dedupeHash。
  3. 服务端校验范围与来源版本，创建 expression_id；需要复习时再创建 itemType=EXPRESSION 的 SRS 状态。
  4. 详情可回到原文/课程上下文或播放原声。
- **异常/边界**：来源已删除时仍保留用户快照但不可回链；相同用户同一来源/文本重复挖句返回已有 expression_id；privateNote 只对本人可读；不把整句原文写入埋点。
- **验收**：
  - expression_id 永久稳定且归属唯一 user_id。
  - 选区越界、跨段非法、空文本均被拒绝。
  - 句块与整句可分别收藏；删除为软删除且历史事件可审计。
- **埋点**：vocab.expression.mine_started.v1、vocab.expression.created.v1、vocab.expression.added_to_srs.v1（source_type、text_length、has_audio）。

### FEAT-VOC-027｜我的表达库分类标签管理

- **目标**：按场景、来源、口语/写作/商务/旅行等标签管理表达，支持检索、一键进入今日表达复习。
- **前置**：expression_id 属于当前用户且状态 ACTIVE；标签名符合长度、敏感内容和数量限制。
- **主流程**：
  1. 用户创建/选择 tag，给 expression_id 添加或移除标签。
  2. 服务端用 user_id + normalized_tag 唯一约束，标签关系幂等。
  3. 列表按 tag、sourceType、masteryStatus、wantToSay、dueRange 分页。
  4. 用户点击“今日表达复习”时创建/加入当前 schedule snapshot。
- **异常/边界**：标签不可被其他用户搜索；删除标签不删除表达；标签达到上限返回 TAG_LIMIT_EXCEEDED；表达软删除后关系保留但不在默认列表。
- **验收**：
  - 标签增删重试不重复。
  - 过滤结果与 SRS 状态一致。
  - 私人备注、来源和表达内容不出现在公开 Feed 或分析报表。
- **埋点**：vocab.expression.tag_added.v1、vocab.expression.tag_removed.v1、vocab.expression.review_started.v1（tag_id、expression_id、source_type）。

### FEAT-VOC-028｜100+ 核心词根串联课程

- **目标**：以 100+ 个预制 root/affix 专题串联 5～10 个例词，形成“含义—视觉卡—派生树—快测—词族拼图”的成人学习课程。
- **前置**：root_id 专题 PUBLISHED；课程、例词和关系均通过双审；不依赖向量模型。
- **主流程**：
  1. 按 rootCategory、CEFR 或课程进度展示专题。
  2. 用户学习 root meaning 和视觉卡，浏览 5～10 个例词。
  3. 完成规则化快测；错误例词进入对应 vocab_id 的 SRS。
  4. 课程完成状态由学习事件和快测结果记录，不把课程完成直接等同于所有例词掌握。
- **异常/边界**：词源不确定的专题不发布；关系数量不足时课程为 DRAFT；视觉资源失败回退文本；例词归档后课程显示缺失标记。
- **验收**：
  - PUBLISHED 专题数量不低于 100，且每课例词关系可追溯。
  - 快测不调用 AI，题目来自固定题包。
  - 课程完成不会绕过 D1/D7 延迟验证。
- **埋点**：vocab.root_course.started.v1、vocab.root_course.example_opened.v1、vocab.root_course.completed.v1（root_id、example_count、score）。

### FEAT-VOC-029｜交互式词族衍生树拓扑

- **目标**：用 SVG/Canvas 展示 root → derivative → part of speech → meaning → example 的可展开词族图，支持低配和无障碍线性阅读。
- **前置**：词族关系为预制 DAG；节点有稳定 vocab_id/root_id；设备性能档位已确定。
- **主流程**：
  1. 请求 root_id 或 vocab_id 的局部拓扑，默认返回首层和分页子节点，避免一次渲染全图。
  2. 用户点击/键盘聚焦节点，展开下一层，显示词性、释义和例句摘要。
  3. 点击节点进入词汇详情或加入待学。
- **异常/边界**：发现环时服务端拒绝发布并前端防重复访问；大图使用最大深度和节点数限制；WebGL 不可用时使用 SVG/Canvas；Phase 1 不做语义向量扩展。
- **验收**：
  - 1000 节点规模下仍可分页和局部渲染。
  - 图形、线性列表和屏幕阅读器内容等价。
  - 节点跳转始终使用 vocab_id，不使用显示文本作为主键。
- **埋点**：vocab.family.expand.v1、vocab.family.node_opened.v1、vocab.family.degraded.v1（root_id、depth、render_mode）。

### FEAT-VOC-030｜批量刷词行为风控

- **目标**：检测过快停留、重放、离线突发上传、异常并发和设备/时钟异常，过滤无效 XP/打卡，并保留可解释审计。
- **前置**：每个卡片事件带 snapshot_item_id、clientEventId、clientOccurredAt、serverReceivedAt、dwellTimeMs、deviceIdHash 和 requestId；风控规则有 riskRulesVersion。
- **主流程**：
  1. 服务端在写入 review_event 前执行规则：dwellTimeMs<300、重复事件、快照归属、时钟偏差、用户/设备速率和批量上传节奏。
  2. 写 risk_audit；按 decision ALLOW、ACCEPT_NO_REWARD、THROTTLE、REJECT 分类。
  3. ACCEPT_NO_REWARD/RISK_FILTERED 只保留事实和审计，不更新有效 XP、Streak 或 SRS；ALLOW 才进入 SRS 原子事务。
  4. 连续高风险触发限流/人工复核标记，不直接永久封号；管理员在风控域处理。
- **异常/边界**：网络重试造成的重复优先返回 DUPLICATE，不再次计风险；设备时钟偏差不直接判作弊；离线事件最多接收 72 小时，超过返回 OFFLINE_EVENT_EXPIRED；不采集原始 IP/原始音频，设备标识使用轮换哈希。
- **验收**：
  - dwellTimeMs<300 的事件不增加 XP、Streak、有效复习数，且可查询 risk_audit_id。
  - 相同 clientEventId/Idempotency-Key 重放只产生一个有效状态变化。
  - 并发/突发测试不会绕过每日上限。
  - 风控结果可由 rulesVersion、证据摘要和 requestId 回放。
- **埋点**：risk.vocab.flagged.v1、risk.vocab.decision.v1（risk_type、decision、rules_version、risk_score）；不得发送私人文本。

---

---

## 4. 确定性 SRS、排程、幂等与并发设计

### 4.1 事件输入与有效 q

q 是用户揭晓答案后的主观信心，不等同于考试分数。服务端同时记录：

- rawQuality：客户端上传的 0、1、2、3。
- answerOutcome：CORRECT、INCORRECT、UNANSWERED、REVEALED_WITHOUT_ANSWER。
- effectiveQuality：服务端用于 SRS 的最终值。
- responseTimeMs、revealElapsedMs、attemptNo：用于解释和风控，不直接改变公式。

有效质量规则固定为：

1. rawQuality 不在 0～3，返回 VALIDATION_ERROR。
2. answerOutcome=INCORRECT 时，effectiveQuality = min(rawQuality, 1)；答错不能通过自评 q=2/3 拉长排程。
3. answerOutcome=UNANSWERED 时，effectiveQuality=0。
4. answerOutcome=REVEALED_WITHOUT_ANSWER 时，effectiveQuality=rawQuality，但 mastery 不得因一次揭晓直接进入 MASTERED。
5. 风控 decision 不是 ALLOW 时，不计算有效 SRS 状态；事件仍可作为审计事实保存。

### 4.2 SM2_Q03_V1 精确公式

参数和取值：

- EF 初始值 EF₀=2.50，最小值 EFmin=1.30，最大值 EFmax=2.50。
- n 为连续成功复习次数，初始 n=0。
- I 为上一次排程间隔，初始 I=0。
- q 为 effectiveQuality，q∈{0,1,2,3}。
- 四舍五入使用 HALF_UP；所有计算先保留 Decimal，再按字段精度落库。

易度系数：

$$
\Delta(q)=0.10-(3-q)\times(0.08+(3-q)\times0.02)
$$

因此：

| q | 语义 | Δ(q) |
|---:|---|---:|
| 0 | 完全忘了 | -0.32 |
| 1 | 模糊/困难 | -0.14 |
| 2 | 顺利想起 | 0.00 |
| 3 | 轻而易举 | +0.10 |

$$
EF' = \operatorname{clamp}\left(1.30,\ 2.50,\ \operatorname{round2}_{HALF\_UP}(EF+\Delta(q))\right)
$$

连续次数：

$$
n' =
\begin{cases}
0, & q<2 \\
n+1, & q\ge2
\end{cases}
$$

间隔锚点：

| n′ | 1 | 2 | 3 | 4 | 5 | 6 |
|---:|---:|---:|---:|---:|---:|---:|
| I(n′) 天 | 1 | 3 | 7 | 15 | 30 | 90 |

完整间隔：

$$
I' =
\begin{cases}
1, & q<2 \\
Anchor[n'], & q\ge2,\ 1\le n'\le6 \\
\operatorname{clamp}\left(1,\ 365,\ \operatorname{round}_{HALF\_UP}(I\times EF')\right), & q\ge2,\ n'\ge7
\end{cases}
$$

示例：

| 事件前 n/I/EF | q | 事件后 n/I/EF |
|---|---:|---|
| 0/0/2.50 | 3 | 1/1/2.50 |
| 1/1/2.50 | 2 | 2/3/2.50 |
| 2/3/2.50 | 2 | 3/7/2.50 |
| 6/90/2.40 | 3 | 7/225/2.50 |
| 6/90/1.30 | 0 | 0/1/1.30 |

dueAt 使用用户 IANA 时区的本地复习时刻加 I′ 天后转 UTC；dueLocalDate 由 dueAt 在同一时区计算。服务端时钟和时区数据库版本记录在 review_event 中。

### 4.3 掌握状态机与延迟复测

~~~text
NEW
 ├─ 首次 q<2 ───────────────> LEARNING
 └─ 首次 q>=2 ──────────────> SHORT_TERM

LEARNING
 ├─ q>=2 且 n>=2 ───────────> CONSOLIDATING
 ├─ q<2 ────────────────────> LEARNING（n=0，D1）
 └─ 触发延迟验证失败 ───────> AT_RISK

SHORT_TERM / CONSOLIDATING
 ├─ D1 通过 ────────────────> CONSOLIDATING（D7_PENDING）
 ├─ D1/D7 失败 ─────────────> AT_RISK（重新排程）
 └─ D7 通过且无待验证 ──────> MASTERED

MASTERED
 ├─ 持续通过 n>=6 且无近期错误 >90d -> CONSOLIDATED
 ├─ 到期或风险升高 ─────────> AT_RISK
 └─ q<2 ────────────────────> AT_RISK

AT_RISK
 ├─ q>=2 ───────────────────> CONSOLIDATING
 └─ q<2 ────────────────────> LEARNING

任意非归档状态 --用户暂停--> SUSPENDED
SUSPENDED --用户恢复--> 原业务状态或 LEARNING
~~~

- 首次错误/即时重练通过不得直接进入 MASTERED。
- 重要对象的延迟验证阶段为 D1_PENDING、D7_PENDING；D1 通过后安排 D7，D7 通过后才允许 MASTERED。
- MASTERED 是“通过 D7 的长期掌握候选”；CONSOLIDATED 是持续稳定后的展示层归档，不表示永久不会遗忘。
- “即将遗忘”是 riskBand=HIGH 或 dueLocalDate 在未来 leadDays 内的展示标签，不是独立事实状态；落库时可将 masteryStatus 标为 AT_RISK，但必须保留前一状态和原因。

### 4.4 记忆风险展示模型

记忆风险只做解释性展示，不宣称医学精确度。对非 SUSPENDED 状态按以下规则计算：

$$
elapsedDays=\max(0,\ floor((now-lastReviewedAt)/86400))
$$

$$
memoryRisk=\operatorname{clamp}\left(0,1,\ 0.7\times\frac{elapsedDays}{\max(1,intervalDays)}
 +0.3\times\frac{2.50-EF}{1.20}\right)
$$

- LOW：risk<0.40；MEDIUM：0.40≤risk<0.70；HIGH：risk≥0.70。
- 延迟验证待办、历史错误次数和快照来源在 explanation 中列出，但不额外改动上述分数。

### 4.5 逾期平滑算法

给定用户本地日期 D，候选为 dueLocalDate≤D 且状态不是 SUSPENDED/ARCHIVED 的 item。

1. overdueDays=max(0, D-dueLocalDate)。
2. priorityScore：

$$
P=\operatorname{round4}\left(
\frac{overdueDays+1}{\max(1,intervalDays)}\times(3.00-EF)
 +0.25\times lapseCount
 +0.50\times isDelayedVerification
\right)
$$

其中 isDelayedVerification 为待 D1/D7 时 1，否则 0。

3. 今日复习上限：

$$
maxDailyReview=\min(200,\ \max(1,\ userMaxDailyReview\ 或\ \lceil2.5\times dailyNewTarget\rceil))
$$

用户设置优先，但不得超过 200；默认 dailyNewTarget 来自 learning plan。

4. 排序：priorityScore DESC、dueAt ASC、itemType 的字典序、目标 ID ASC、srs_state_id ASC。
5. 前 maxDailyReview 个安排到 D；剩余第 r 个按：

$$
plannedLocalDate=D+\min(6,\ floor((r-1)/maxDailyReview))
$$

即最多未来 7 个本地日期。排程快照记录 deferReason=OVERDUE_SMOOTHING；不修改 lrn_srs_state.dueAt。
6. 复习先占用上限，再从剩余名额补新学；当积压存在时，newLimit=max(0, maxDailyReview-selectedReviewCount) 且不超过 dailyNewTarget。
7. 同一用户、同一 localDate、同一 scheduleType 在事务中只产生一个有效快照；重试读取原快照。

### 4.6 批次快照与可重放

- 生成输入：user_id、localDate、timezone、activeWordbookId、dailyNewTarget、maxDailyReview、algorithmVersion、contentVersion、rulesVersion、serverCutoffAt。
- snapshot 内固定 item 顺序、priorityScore、plannedLocalDate、dueAtAtSnapshot、srsStateVersionAtSnapshot、contentHash 和 questionSeed。
- 客户端只使用 snapshot_item_id 提交事件；不允许直接按 word 文本或显示序号更新状态。
- 内容发布新版本不会改写已生成快照；新快照才使用新版本。
- 快照过期后只允许读取历史结果，不接受新 review_event；未完成项由新快照重新排程。

### 4.7 幂等、并发锁与事务边界

复习写入使用 Spring Boot 声明式事务，推荐隔离级别 READ COMMITTED 或项目统一的默认级别，并按以下顺序加锁：

1. 校验认证、item 归属、Idempotency-Key 格式和 body hash。
2. 按 user_id + idempotency_key 查询 review_event；已存在且 body hash 相同则原样返回首次响应，body 不同返回 IDEMPOTENCY_KEY_REUSED。
3. 按 srs_state_id 对 lrn_srs_state 执行 SELECT ... FOR UPDATE；必要时再锁 snapshot_item_id，锁顺序固定为 SRS 状态→快照项。
4. 写 review_event 初始记录和 risk_audit；ALLOW 时计算并更新 lrn_srs_state，增加 state_version；更新 snapshot_item 状态。
5. 写出学习事件 outbox（由 learning/gamification 域消费）并提交；任何一步失败全部回滚。

并发规则：

- MySQL 行锁是最终权威；Redis 锁 learning:srs:{userId}:{itemKey} 只用于降低热点竞争，不能替代 MySQL 锁。
- 同一 item 的不同事件可被串行应用；每次应用都基于锁内最新状态，不覆盖较新 state_version。
- client baseStateVersion 过期时，在线接口返回 CONFLICT 并附当前状态；弱网批量同步可按目标顺序自动 rebase，并在响应中标记 reconciled=true。重复事件仍只应用一次。
- 一个客户端同一 item 只允许一个 in-flight 写请求；服务端不依赖此约束保证正确性。

### 4.8 风控规则基线

| ruleCode | 触发条件 | decision | 状态/奖励影响 |
|---|---|---|---|
| DWELL_TOO_SHORT | dwellTimeMs < 300 | ACCEPT_NO_REWARD | 写审计；不更新 SRS、XP、Streak |
| CLIENT_EVENT_REPLAY | clientEventId 已成功处理 | DUPLICATE | 返回第一次结果 |
| IDEMPOTENCY_REPLAY | 幂等键已处理且 bodyHash 相同 | DUPLICATE | 返回第一次结果 |
| REVIEW_BURST | 同用户/设备 60 秒超过 30 个提交 | THROTTLE | 延迟处理或拒绝奖励 |
| OFFLINE_BURST | 恢复网络 30 秒上传超过 50 个事件 | THROTTLE/REVIEW | 写审计，逐项判定 |
| CLOCK_SKEW | 客户端时间与服务端相差超过 24 小时 | REVIEW | 允许读取，写入需人工/规则复核 |
| SNAPSHOT_SCOPE | snapshot_item 不属于 user 或已过期 | REJECT | 不改变 SRS |
| DAILY_CAP | 超过当日有效复习/新学上限 | REJECT | 返回 DAILY_CAP_EXCEEDED |

风控事件可保留用于申诉和审计，任何封禁由 admin/risk 域执行；本域不做永久封号。

---

---

## 5. 卡片状态机、30 项交互映射与端侧行为

### 5.1 卡片状态机

~~~text
IDLE
  -> PREFETCHING（读取快照项与缓存内容）
  -> FRONT（只显示提示，不显示答案）
  -> REVEALING（记录揭晓方式和耗时）
  -> BACK（显示释义/例句/关系）
  -> RATING（等待 q=0/1/2/3）
  -> SUBMITTING（幂等写入 review_event）
       ├─ 服务端 ACCEPTED -> SYNCED -> NEXT
       ├─ 服务端 DUPLICATE -> SYNCED（复用首次结果）-> NEXT
       ├─ 弱网/离线 -> PENDING_SYNC -> NEXT（角标待同步）
       ├─ CONFLICT -> RECONCILING（读取新状态后重试/放弃）
       ├─ RISK_FILTERED -> SYNCED_NO_REWARD -> NEXT
       └─ 可重试错误 -> ERROR_RETRY（1s/2s/4s）

任意状态 -> PAUSED（切后台/锁屏/用户离开）
PAUSED -> 原状态（本地快照未过期）
任意未提交状态 -> ABANDONED（退出，只保存 continue context）
任意状态 -> EXPIRED（快照/内容版本失效，回到批次刷新）
~~~

状态约束：

1. FRONT 的服务响应模型不得包含 meaningCn、definitionEn、exampleSentence 等答案字段；服务端可返回 answerAvailable=true。
2. REVEALING 到 BACK 只允许一次有效揭晓，revealMethod 为 tap、swipe、keyboard、accessibility。
3. RATING 只接受单选 q；客户端 300ms 内连续点击只保留第一次，服务端仍以 Idempotency-Key 兜底。
4. PENDING_SYNC 只代表本地事件已排队，不代表 SRS/掌握/XP 已完成；首页和掌握页必须显示同步状态。
5. SUBMITTING 的按钮必须显示 loading/disabled；请求超时不能直接判定失败，先查询幂等键结果。
6. 卡片自动进入 NEXT 前必须保存 currentSnapshotItemId、stepIndex、elapsedTimeMs 和 pending event ids。

### 5.2 30 项交互映射

| 编号 | 交互入口 | 用户动作 | 服务端/客户端结果 |
|---:|---|---|---|
| 001 | 词书矩阵 | 浏览、筛选词书 | 返回已发布 wordbook 与版本 |
| 002 | 词书切换 | 确认切换主词书 | 锁计划、保留所有 SRS |
| 003 | 词频热度 | 点击热度/筛选 | 返回 sourceVersion 与稳定排序 |
| 004 | 音标音频 | 选择口音/速度并播放 | 播放资源，失败可重试/文本替代 |
| 005 | 多义项 | 展开词性/释义 | 展开 definition_id |
| 006 | 例句 | 查看、播放、划词 | 高亮 example_id，可挖句 |
| 007 | 发音解剖 | 打开 3D 嘴型 | Three.js 或 2D 降级 |
| 008 | 关系词网 | 点击派生/同反义词 | 抽屉预览，可加入待学 |
| 009 | 词根拆解 | 点击词根/词缀 | 展开 root_id 与例词 |
| 010 | 易混词 | 打开对照训练 | 返回差异区间，独立提交两词状态 |
| 011 | SM-2 | 提交复习反馈 | 事务计算并返回 stateVersion |
| 012 | 复习梯度 | 查看下次日期 | 展示 1/3/7/15/30/90 及解释 |
| 013 | 主动回忆 | 点击翻面/上滑 | FRONT→REVEALING→BACK |
| 014 | 信心评级 | 点击 q=0/1/2/3 | 生成 raw/effective quality |
| 015 | 逾期平滑 | 点击追赶计划 | 查看今日/未来 2～7 日分配 |
| 016 | 词义选择 | 选择 4 个选项之一 | 服务端判分并记录事件 |
| 017 | 听音辨词 | 播放后选择 | 播放状态与选择结果分离 |
| 018 | 例句挖空 | 选择语境词 | 反馈 CONTEXT_MISUSE 或正确 |
| 019 | 字母重组 | 点击/拖动字母 | 提交 tokenId 顺序 |
| 020 | 键盘拼写 | 输入并提交 | 规范化比对，差异反馈 |
| 021 | 生词本 | 点击星标 | 收藏 entry 幂等创建 |
| 022 | 已掌握 | 查看/移出 | 只影响收藏视图，不删事件 |
| 023 | 多维过滤 | 组合筛选条件 | cursor 分页、稳定 sortKey |
| 024 | 句块详情 | 浏览场景/例句 | chunk_id 独立展示 |
| 025 | 句块复习 | 完成句块训练 | itemType=CHUNK 排程 |
| 026 | 句子挖掘 | 长按/拖选句子 | 创建 expression_id |
| 027 | 表达标签 | 添加/移除标签 | user_id 范围内关系幂等 |
| 028 | 词根课程 | 开课、快测、完成 | root 课程事件与词汇事件分离 |
| 029 | 词族拓扑 | 展开/聚焦节点 | 局部渲染或线性列表 |
| 030 | 风控反馈 | 快速/突发/重放提交 | 审计、限流或无奖励，不绕过 SRS |

### 5.3 与 learning 域的学习流衔接

- 首页继续学习沿用 learning 域的 GET /api/v1/learning/stream/today；VOC 项返回 scheduleSnapshotId、snapshotItemId、itemType 和内容引用。
- learning 域的 POST /api/v1/learning/stream/action 与本域 review 写入共用同一事务服务，不得出现两个 SM-2 实现。
- 默认任务配比由 learning 域负责：新学 40%、到期复习 40%、错题/延迟验证 20%；本域只提供可解释的候选、优先级和 SRS 摘要。
- 单个学习流完成时，本域发出 vocab.review.accepted.v1 或 vocab.review.filtered.v1；XP、Streak、通知消费者必须用 review_event_id 去重。

---

---

## 6. 跨端、弱网、离线与无障碍设计

### 6.1 端与布局

| 端/视口 | 主要布局 | 卡片交互 | 3D/图谱策略 |
|---|---|---|---|
| Compact <768px：iOS/Android/H5/小程序 | 单列卡片、底部学习/场景/复习/世界/我的五 Tab | 上滑翻面、底部固定 q 操作区；触控目标不小于 44×44 CSS px | Performance/Medium；2D 帧、SVG、Canvas 兜底 |
| Medium 768～1024px：iPad/平板 | 双列：内容卡+侧栏解释/队列 | 支持触控笔、键盘和双指；不依赖悬停 | Medium/High；局部节点渲染 |
| Expanded >1024px：Web/Tauri | 三列：队列、卡片、详情/关系 | 鼠标、键盘快捷键、屏幕阅读器 | High/Ultra；WebGL 丢失立即降级 |

AdaptivePerformanceEngine 统一输出 Ultra、High、Medium、Performance。任何动效必须订阅全局性能状态机，支持用户关闭和 prefers-reduced-motion。

### 6.2 本地缓存与弱网同步

端侧使用 SQLite（App）或 IndexedDB（H5/小程序可用的持久化封装）保存：

~~~json
{
  "clientEventId": "ce_01J...",
  "idempotencyKey": "idem_01J...",
  "userId": 10001,
  "snapshotId": 9001,
  "snapshotItemId": 9010,
  "itemType": "VOCAB",
  "vocabId": 123,
  "baseStateVersion": 4,
  "rawQuality": 2,
  "answerOutcome": "CORRECT",
  "dwellTimeMs": 1840,
  "clientOccurredAt": "2026-08-20T10:15:30.500+08:00",
  "payloadHash": "sha256:...",
  "attemptCount": 0,
  "status": "PENDING",
  "nextRetryAt": null
}
~~~

规则：

1. 进入学习流前预取当前批次和下一小批内容；只缓存 PUBLISHED、未过期且用户有权限的 contentVersion。
2. 在线请求超时采用 1s、2s、4s 三次前台重试；失败后写本地同步队列并允许用户继续下一卡。
3. 后台同步最多每事件 5 次指数退避（1s、2s、4s、8s、16s），超过后显示“点击重试”，不静默丢弃。
4. 按 itemKey 保序上传；同一 item 的 pending 事件一次只发一个。不同 item 可以并发，但服务端仍以锁和幂等为准。
5. 网络恢复先提交 review events，再刷新 srs states、今日快照和首屏数字；本地乐观进度只显示为 pendingSync。
6. 服务端返回 DUPLICATE 时将本地事件标记 SYNCED_DUPLICATE；RISK_FILTERED 标记 SYNCED_NO_REWARD；CONFLICT 先拉取当前状态再按服务端策略 rebase。
7. 离线事件允许 clientOccurredAt 距 serverReceivedAt 最多 72 小时；超过进入 EXPIRED，不补发 XP、Streak 或有效复习。
8. 内容版本不一致时不覆盖本地已展示答案；卡片进入 STALE_CONTENT，清理待提交的未开始项，已发生事件仍按原 snapshot 处理。

### 6.3 断点续学

退出、切后台或每 500ms 防抖写入本地 context，服务端 PUT /api/v1/learning/continue-context 保存：

- moduleType=FLASHCARD、VOCAB_DETAIL、CHUNK_REVIEW 或 EXPRESSION_REVIEW；
- scheduleSnapshotId、snapshotItemId、stepIndex、totalSteps；
- clientStateSnapshot（不放标准答案、不放完整私人笔记）；
- elapsedTimeMs、pendingEventCount、updatedAt、contextVersion。

服务端保留 7 天；跨端以 updatedAt 最新快照为准。若两个端均有未同步事件，先合并事件队列，再生成新的上下文，不以较旧端的 cardIndex 覆盖服务端。

### 6.4 无障碍

1. 所有卡片、翻面、评分、音频、关系节点和图谱节点均有可见焦点、键盘路径和 aria-label；卡片使用 button/region 语义，不把整张卡做成不可聚焦的手势容器。
2. 快捷键：Space/Enter 揭晓；数字 0～3 选择信心；Esc 返回；移动端提供同等可见按钮。
3. 颜色不是唯一信息：q 按钮同时展示文字和数字；风险用文字、图标和颜色三重表达；高亮内容提供下划线/标签替代。
4. 普通文本对比度不低于 4.5:1，大字不低于 3:1；触控目标不小于 44×44；横屏/竖屏和 200% 字体放大不丢失评分按钮。
5. 音频提供播放/暂停/重播、口音、速度、文本音标和字幕/翻译；自动播放关闭时不影响完成流程。
6. 3D 口腔动画提供 2D 静态图、文字说明和线性步骤；prefers-reduced-motion 或用户关闭动效后不再循环、闪烁或震动。
7. 题型不以拖拽为唯一方式：字母重排、词族拓扑和句块排序同时提供上下移动、列表选择或键盘操作。
8. 错误、同步中、同步成功和风控无奖励均使用可读提示，并把焦点移到提示区域；不依赖 toast 短暂消失来传达关键结果。

---

---

## 7. MySQL 8.x 数据模型与 DDL

### 7.1 建模原则与外键语义

1. 以下 DDL 是 VOC/SRS 域的逻辑基线；user_id 可在同库物理引用 usr_user.user_id。若部署为独立 schema，user_id 采用应用层语义外键并保留同样的 ON DELETE RESTRICT 语义。
2. 教研内容永不物理删除：PUBLISHED→ARCHIVED；历史 review_event、snapshot 和 audit 通过外键 RESTRICT 保留。
3. 用户收藏、挖句和标签使用软删除；账号注销由 auth 域完成匿名化，事件与风控审计保留不可识别的 tombstone_user_id。
4. JSON 仅保存渲染扩展、证据和内容快照；参与唯一性、过滤和并发的字段必须是独立列。
5. 生产迁移按表和索引分批执行；先新增 nullable/默认字段，再回填、校验、加 CHECK/NOT NULL，不在高峰期重建大表。

### 7.2 内容表：词书、词汇、释义、例句、词块与关系

~~~sql
CREATE TABLE IF NOT EXISTS cnt_wordbook (
  wordbook_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  name_cn VARCHAR(128) NOT NULL,
  description VARCHAR(500) NULL,
  audience VARCHAR(16) NOT NULL DEFAULT 'ADULT',
  target_goal VARCHAR(32) NULL,
  min_cefr VARCHAR(8) NULL,
  max_cefr VARCHAR(8) NULL,
  word_count INT UNSIGNED NOT NULL DEFAULT 0,
  estimated_days INT UNSIGNED NULL,
  content_version VARCHAR(32) NOT NULL,
  source_version VARCHAR(64) NOT NULL,
  license_ref VARCHAR(128) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  published_at DATETIME(3) NULL,
  archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (wordbook_id),
  UNIQUE KEY uk_wordbook_code_version (code, content_version),
  KEY idx_wordbook_status_audience (status, audience, code),
  CONSTRAINT chk_wordbook_audience CHECK (audience = 'ADULT'),
  CONSTRAINT chk_wordbook_status CHECK (status IN ('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','ARCHIVED')),
  CONSTRAINT chk_wordbook_count CHECK (word_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='成人 Phase 1 词书与内容版本';

CREATE TABLE IF NOT EXISTS cnt_vocabulary (
  vocab_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  word_normalized VARCHAR(100) NOT NULL,
  word_display VARCHAR(100) NOT NULL,
  lemma_type VARCHAR(16) NOT NULL DEFAULT 'WORD',
  phonetic_us VARCHAR(100) NULL,
  phonetic_uk VARCHAR(100) NULL,
  audio_us_normal_url VARCHAR(512) NULL,
  audio_us_slow_url VARCHAR(512) NULL,
  audio_uk_normal_url VARCHAR(512) NULL,
  audio_uk_slow_url VARCHAR(512) NULL,
  media_version VARCHAR(32) NULL,
  cefr_level VARCHAR(8) NOT NULL,
  frequency_rank INT UNSIGNED NULL,
  frequency_source_version VARCHAR(64) NULL,
  exam_heat_json JSON NULL,
  anatomy_code VARCHAR(64) NULL,
  normalized_content_hash CHAR(64) NOT NULL,
  content_version VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  published_at DATETIME(3) NULL,
  archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (vocab_id),
  UNIQUE KEY uk_vocab_normalized_word (word_normalized),
  KEY idx_vocab_cefr_status (cefr_level, status, vocab_id),
  KEY idx_vocab_frequency (frequency_rank, status, vocab_id),
  CONSTRAINT chk_vocab_word_nonempty CHECK (CHAR_LENGTH(TRIM(word_normalized)) > 0),
  CONSTRAINT chk_vocab_cefr CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  CONSTRAINT chk_vocab_frequency CHECK (frequency_rank IS NULL OR (frequency_rank BETWEEN 1 AND 20000)),
  CONSTRAINT chk_vocab_status CHECK (status IN ('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='词元主表，vocab_id 为稳定业务标识';

CREATE TABLE IF NOT EXISTS cnt_wordbook_item (
  wordbook_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  wordbook_id BIGINT UNSIGNED NOT NULL,
  vocab_id BIGINT UNSIGNED NOT NULL,
  sequence_no INT UNSIGNED NOT NULL,
  item_label VARCHAR(100) NULL,
  is_required TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (wordbook_item_id),
  UNIQUE KEY uk_wordbook_vocab (wordbook_id, vocab_id),
  UNIQUE KEY uk_wordbook_sequence (wordbook_id, sequence_no),
  KEY idx_wordbook_item_vocab (vocab_id, wordbook_id),
  CONSTRAINT fk_wordbook_item_book FOREIGN KEY (wordbook_id) REFERENCES cnt_wordbook(wordbook_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_wordbook_item_vocab FOREIGN KEY (vocab_id) REFERENCES cnt_vocabulary(vocab_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_wordbook_item_required CHECK (is_required IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='词书与词元关系';

CREATE TABLE IF NOT EXISTS cnt_vocab_definition (
  definition_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vocab_id BIGINT UNSIGNED NOT NULL,
  sense_no SMALLINT UNSIGNED NOT NULL,
  part_of_speech VARCHAR(16) NOT NULL,
  register_code VARCHAR(32) NULL,
  meaning_cn VARCHAR(255) NOT NULL,
  definition_en TEXT NULL,
  source_name VARCHAR(64) NULL,
  source_version VARCHAR(64) NOT NULL,
  content_version VARCHAR(32) NOT NULL,
  normalized_content_hash CHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (definition_id),
  UNIQUE KEY uk_vocab_sense_no (vocab_id, sense_no),
  KEY idx_definition_status_vocab (status, vocab_id, sense_no),
  CONSTRAINT fk_definition_vocab FOREIGN KEY (vocab_id) REFERENCES cnt_vocabulary(vocab_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_definition_sense_no CHECK (sense_no >= 1),
  CONSTRAINT chk_definition_meaning CHECK (CHAR_LENGTH(TRIM(meaning_cn)) > 0),
  CONSTRAINT chk_definition_pos CHECK (part_of_speech IN ('N','V','ADJ','ADV','PREP','CONJ','PRON','DET','PHRASAL','OTHER')),
  CONSTRAINT chk_definition_status CHECK (status IN ('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='词义与词性表';

CREATE TABLE IF NOT EXISTS cnt_vocab_example (
  example_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vocab_id BIGINT UNSIGNED NOT NULL,
  definition_id BIGINT UNSIGNED NULL,
  difficulty_level VARCHAR(8) NOT NULL DEFAULT 'B1',
  example_sentence_en TEXT NOT NULL,
  example_sentence_cn TEXT NOT NULL,
  audio_url VARCHAR(512) NULL,
  audio_media_version VARCHAR(32) NULL,
  highlight_spans JSON NOT NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'EDITORIAL',
  source_ref VARCHAR(128) NULL,
  license_ref VARCHAR(128) NULL,
  content_version VARCHAR(32) NOT NULL,
  normalized_content_hash CHAR(64) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (example_id),
  UNIQUE KEY uk_vocab_example_hash (vocab_id, normalized_content_hash),
  KEY idx_example_definition_status (definition_id, status, sort_order),
  KEY idx_example_vocab_status (vocab_id, status, sort_order),
  CONSTRAINT fk_example_vocab FOREIGN KEY (vocab_id) REFERENCES cnt_vocabulary(vocab_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_example_definition FOREIGN KEY (definition_id) REFERENCES cnt_vocab_definition(definition_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_example_difficulty CHECK (difficulty_level IN ('A1','A2','B1','B2','C1','C2')),
  CONSTRAINT chk_example_status CHECK (status IN ('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','ARCHIVED')),
  CONSTRAINT chk_example_sort CHECK (sort_order >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='词汇语境例句与高亮切片';

CREATE TABLE IF NOT EXISTS cnt_chunk (
  chunk_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  canonical_text VARCHAR(255) NOT NULL,
  normalized_text VARCHAR(255) NOT NULL,
  chunk_type VARCHAR(24) NOT NULL,
  meaning_cn VARCHAR(255) NOT NULL,
  usage_note TEXT NULL,
  scenario_code VARCHAR(64) NULL,
  cefr_level VARCHAR(8) NOT NULL,
  keywords_json JSON NULL,
  common_errors_json JSON NULL,
  audio_normal_url VARCHAR(512) NULL,
  audio_slow_url VARCHAR(512) NULL,
  media_version VARCHAR(32) NULL,
  content_version VARCHAR(32) NOT NULL,
  normalized_content_hash CHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  published_at DATETIME(3) NULL,
  archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (chunk_id),
  UNIQUE KEY uk_chunk_normalized_version (normalized_text, content_version),
  KEY idx_chunk_status_type_level (status, chunk_type, cefr_level, chunk_id),
  KEY idx_chunk_scenario (scenario_code, status, chunk_id),
  CONSTRAINT chk_chunk_text_nonempty CHECK (CHAR_LENGTH(TRIM(normalized_text)) > 0),
  CONSTRAINT chk_chunk_type CHECK (chunk_type IN ('PHRASE','COLLOCATION','IDIOM','SPOKEN_CHUNK','SENTENCE_PATTERN')),
  CONSTRAINT chk_chunk_cefr CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  CONSTRAINT chk_chunk_status CHECK (status IN ('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='独立句块学习对象';

CREATE TABLE IF NOT EXISTS cnt_chunk_example (
  chunk_example_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  chunk_id BIGINT UNSIGNED NOT NULL,
  example_sentence_en TEXT NOT NULL,
  example_sentence_cn TEXT NOT NULL,
  audio_url VARCHAR(512) NULL,
  highlight_spans JSON NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'EDITORIAL',
  source_ref VARCHAR(128) NULL,
  content_version VARCHAR(32) NOT NULL,
  normalized_content_hash CHAR(64) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (chunk_example_id),
  UNIQUE KEY uk_chunk_example_hash (chunk_id, normalized_content_hash),
  KEY idx_chunk_example_status (chunk_id, status, sort_order),
  CONSTRAINT fk_chunk_example_chunk FOREIGN KEY (chunk_id) REFERENCES cnt_chunk(chunk_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_chunk_example_status CHECK (status IN ('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='句块例句';

CREATE TABLE IF NOT EXISTS cnt_root_topic (
  root_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  root_code VARCHAR(64) NOT NULL,
  root_kind VARCHAR(16) NOT NULL,
  title_cn VARCHAR(128) NOT NULL,
  meaning_cn VARCHAR(255) NOT NULL,
  category_code VARCHAR(64) NULL,
  lesson_order INT UNSIGNED NOT NULL DEFAULT 0,
  visual_asset_ref VARCHAR(512) NULL,
  content_version VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (root_id),
  UNIQUE KEY uk_root_code_version (root_code, content_version),
  KEY idx_root_status_order (status, lesson_order, root_id),
  CONSTRAINT chk_root_kind CHECK (root_kind IN ('PREFIX','ROOT','SUFFIX')),
  CONSTRAINT chk_root_status CHECK (status IN ('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='预制词根词缀专题';

CREATE TABLE IF NOT EXISTS cnt_root_vocab_link (
  root_vocab_link_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  root_id BIGINT UNSIGNED NOT NULL,
  vocab_id BIGINT UNSIGNED NOT NULL,
  morpheme_text VARCHAR(64) NULL,
  morpheme_start SMALLINT UNSIGNED NULL,
  morpheme_end SMALLINT UNSIGNED NULL,
  link_role VARCHAR(16) NOT NULL DEFAULT 'DERIVATIVE',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  content_version VARCHAR(32) NOT NULL,
  PRIMARY KEY (root_vocab_link_id),
  UNIQUE KEY uk_root_vocab_version (root_id, vocab_id, content_version),
  KEY idx_root_link_vocab (vocab_id, root_id),
  CONSTRAINT fk_root_link_root FOREIGN KEY (root_id) REFERENCES cnt_root_topic(root_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_root_link_vocab FOREIGN KEY (vocab_id) REFERENCES cnt_vocabulary(vocab_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_root_link_range CHECK (morpheme_start IS NULL OR (morpheme_end IS NOT NULL AND morpheme_end > morpheme_start)),
  CONSTRAINT chk_root_link_role CHECK (link_role IN ('PREFIX','ROOT','SUFFIX','DERIVATIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='词根与词元关系';

CREATE TABLE IF NOT EXISTS cnt_vocab_relation (
  relation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  from_vocab_id BIGINT UNSIGNED NOT NULL,
  to_vocab_id BIGINT UNSIGNED NOT NULL,
  relation_type VARCHAR(32) NOT NULL,
  relation_note TEXT NULL,
  relation_version VARCHAR(32) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (relation_id),
  UNIQUE KEY uk_vocab_relation (from_vocab_id, to_vocab_id, relation_type, relation_version),
  KEY idx_relation_from (from_vocab_id, relation_type, status),
  KEY idx_relation_to (to_vocab_id, relation_type, status),
  CONSTRAINT fk_relation_from FOREIGN KEY (from_vocab_id) REFERENCES cnt_vocabulary(vocab_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_relation_to FOREIGN KEY (to_vocab_id) REFERENCES cnt_vocabulary(vocab_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_relation_not_self CHECK (from_vocab_id <> to_vocab_id),
  CONSTRAINT chk_relation_type CHECK (relation_type IN ('DERIVATIVE','SYNONYM','ANTONYM','COLLOCATION_RELATED')),
  CONSTRAINT chk_relation_status CHECK (status IN ('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='预制词汇关系图';

CREATE TABLE IF NOT EXISTS cnt_confusable_pair (
  pair_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vocab_id_a BIGINT UNSIGNED NOT NULL,
  vocab_id_b BIGINT UNSIGNED NOT NULL,
  difference_spans_json JSON NOT NULL,
  compare_note TEXT NOT NULL,
  example_a_id BIGINT UNSIGNED NULL,
  example_b_id BIGINT UNSIGNED NULL,
  compare_version VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (pair_id),
  UNIQUE KEY uk_confusable_pair (vocab_id_a, vocab_id_b, compare_version),
  KEY idx_confusable_a (vocab_id_a, status),
  KEY idx_confusable_b (vocab_id_b, status),
  CONSTRAINT fk_confusable_a FOREIGN KEY (vocab_id_a) REFERENCES cnt_vocabulary(vocab_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_confusable_b FOREIGN KEY (vocab_id_b) REFERENCES cnt_vocabulary(vocab_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_confusable_example_a FOREIGN KEY (example_a_id) REFERENCES cnt_vocab_example(example_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_confusable_example_b FOREIGN KEY (example_b_id) REFERENCES cnt_vocab_example(example_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_confusable_order CHECK (vocab_id_a < vocab_id_b),
  CONSTRAINT chk_confusable_status CHECK (status IN ('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='易混词对照关系';
~~~

### 7.3 内容表约束说明

- 发布前校验：词元至少一个 PUBLISHED definition；每个主释义至少两条 PUBLISHED example；词书中的 vocab_id 必须 PUBLISHED；chunk_id 必须有中文解释和至少一条例句或文本替代。
- 外键采用 ON DELETE RESTRICT，教研通过 status/archived_at 下架；历史用户表达保存的 source_content_version 和 sentence_snapshot 不依赖源内容可用性。
- relation_type 不包含 SYNONYM/ANTONYM 的反向自动补写；反向关系需由教研明确发布，防止一侧修订导致历史快照变化。

---

---

### 7.4 用户收藏、挖句与标签表

~~~sql
CREATE TABLE IF NOT EXISTS lrn_user_library_entry (
  entry_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  item_type VARCHAR(16) NOT NULL,
  vocab_id BIGINT UNSIGNED NULL,
  chunk_id BIGINT UNSIGNED NULL,
  expression_id BIGINT UNSIGNED NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
  collection_status VARCHAR(16) NOT NULL DEFAULT 'NEW_WORD',
  note_id BIGINT UNSIGNED NULL,
  item_key VARCHAR(96) GENERATED ALWAYS AS (
    CASE
      WHEN item_type = 'VOCAB' THEN CONCAT('VOCAB:', vocab_id)
      WHEN item_type = 'CHUNK' THEN CONCAT('CHUNK:', chunk_id)
      WHEN item_type = 'EXPRESSION' THEN CONCAT('EXPRESSION:', expression_id)
      ELSE NULL
    END
  ) STORED,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  PRIMARY KEY (entry_id),
  UNIQUE KEY uk_library_user_item (user_id, item_key),
  KEY idx_library_user_status (user_id, collection_status, deleted_at, updated_at, entry_id),
  KEY idx_library_user_source (user_id, source_type, deleted_at, entry_id),
  CONSTRAINT fk_library_vocab FOREIGN KEY (vocab_id) REFERENCES cnt_vocabulary(vocab_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_library_chunk FOREIGN KEY (chunk_id) REFERENCES cnt_chunk(chunk_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_library_item_type CHECK (item_type IN ('VOCAB','CHUNK','EXPRESSION')),
  CONSTRAINT chk_library_target CHECK (
    (item_type = 'VOCAB' AND vocab_id IS NOT NULL AND chunk_id IS NULL AND expression_id IS NULL)
    OR (item_type = 'CHUNK' AND vocab_id IS NULL AND chunk_id IS NOT NULL AND expression_id IS NULL)
    OR (item_type = 'EXPRESSION' AND vocab_id IS NULL AND chunk_id IS NULL AND expression_id IS NOT NULL)
  ),
  CONSTRAINT chk_library_status CHECK (collection_status IN ('NEW_WORD','SAVED','MASTERED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户词库/收藏，user_id 由 auth 域语义约束';

CREATE TABLE IF NOT EXISTS lrn_mined_expression (
  expression_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  source_ref VARCHAR(128) NULL,
  source_content_version VARCHAR(32) NULL,
  source_audio_ref VARCHAR(512) NULL,
  sentence_text TEXT NOT NULL,
  translation_cn TEXT NULL,
  selected_text VARCHAR(1000) NULL,
  range_start INT UNSIGNED NULL,
  range_end INT UNSIGNED NULL,
  context_snapshot_json JSON NULL,
  private_note TEXT NULL,
  want_to_say TINYINT(1) NOT NULL DEFAULT 0,
  dedupe_hash CHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  PRIMARY KEY (expression_id),
  UNIQUE KEY uk_expression_user_dedupe (user_id, dedupe_hash),
  KEY idx_expression_user_status (user_id, status, deleted_at, updated_at, expression_id),
  KEY idx_expression_user_source (user_id, source_type, source_ref, expression_id),
  CONSTRAINT chk_expression_source CHECK (source_type IN ('READING','LISTENING','SCENARIO','VOCAB_EXAMPLE')),
  CONSTRAINT chk_expression_status CHECK (status IN ('ACTIVE','ARCHIVED','DELETED')),
  CONSTRAINT chk_expression_range CHECK (
    (range_start IS NULL AND range_end IS NULL)
    OR (range_start IS NOT NULL AND range_end IS NOT NULL AND range_end > range_start)
  ),
  CONSTRAINT chk_expression_want_to_say CHECK (want_to_say IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户私有句子挖掘表达';

ALTER TABLE lrn_user_library_entry
  ADD CONSTRAINT fk_library_expression
  FOREIGN KEY (expression_id) REFERENCES lrn_mined_expression(expression_id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE IF NOT EXISTS lrn_expression_tag (
  tag_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  tag_name VARCHAR(32) NOT NULL,
  normalized_tag_name VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  PRIMARY KEY (tag_id),
  UNIQUE KEY uk_expression_tag_user_name (user_id, normalized_tag_name),
  KEY idx_expression_tag_user (user_id, deleted_at, tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户私有表达标签';

CREATE TABLE IF NOT EXISTS lrn_expression_tag_link (
  expression_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (expression_id, tag_id),
  KEY idx_expression_tag_link_user (user_id, tag_id, expression_id),
  CONSTRAINT fk_expression_tag_link_expression FOREIGN KEY (expression_id) REFERENCES lrn_mined_expression(expression_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_expression_tag_link_tag FOREIGN KEY (tag_id) REFERENCES lrn_expression_tag(tag_id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='表达与用户标签关系';

~~~

---

### 7.5 统一 SRS 状态表

~~~sql
CREATE TABLE IF NOT EXISTS lrn_srs_state (
  srs_state_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  item_type VARCHAR(16) NOT NULL,
  vocab_id BIGINT UNSIGNED NULL,
  chunk_id BIGINT UNSIGNED NULL,
  expression_id BIGINT UNSIGNED NULL,
  repetition_count INT UNSIGNED NOT NULL DEFAULT 0,
  ease_factor DECIMAL(4,2) NOT NULL DEFAULT 2.50,
  interval_days INT UNSIGNED NOT NULL DEFAULT 0,
  due_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  due_local_date DATE NOT NULL,
  mastery_status VARCHAR(20) NOT NULL DEFAULT 'NEW',
  delayed_verify_stage VARCHAR(16) NOT NULL DEFAULT 'NONE',
  delayed_verify_due_date DATE NULL,
  consecutive_correct INT UNSIGNED NOT NULL DEFAULT 0,
  total_wrong_count INT UNSIGNED NOT NULL DEFAULT 0,
  lapse_count INT UNSIGNED NOT NULL DEFAULT 0,
  review_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_response_quality TINYINT UNSIGNED NULL,
  last_response_time_ms INT UNSIGNED NULL,
  first_learned_at DATETIME(3) NULL,
  last_reviewed_at DATETIME(3) NULL,
  mastered_at DATETIME(3) NULL,
  suspended_reason VARCHAR(64) NULL,
  algorithm_version VARCHAR(32) NOT NULL DEFAULT 'SM2_Q03_V1',
  state_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  item_key VARCHAR(96) GENERATED ALWAYS AS (
    CASE
      WHEN item_type = 'VOCAB' THEN CONCAT('VOCAB:', vocab_id)
      WHEN item_type = 'CHUNK' THEN CONCAT('CHUNK:', chunk_id)
      WHEN item_type = 'EXPRESSION' THEN CONCAT('EXPRESSION:', expression_id)
      ELSE NULL
    END
  ) STORED,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (srs_state_id),
  UNIQUE KEY uk_srs_user_item (user_id, item_key),
  KEY idx_srs_user_due (user_id, due_local_date, mastery_status, item_type, srs_state_id),
  KEY idx_srs_user_mastery (user_id, mastery_status, updated_at, srs_state_id),
  KEY idx_srs_item (item_type, vocab_id, chunk_id, expression_id),
  CONSTRAINT fk_srs_vocab FOREIGN KEY (vocab_id) REFERENCES cnt_vocabulary(vocab_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_srs_chunk FOREIGN KEY (chunk_id) REFERENCES cnt_chunk(chunk_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_srs_expression FOREIGN KEY (expression_id) REFERENCES lrn_mined_expression(expression_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_srs_item_type CHECK (item_type IN ('VOCAB','CHUNK','EXPRESSION')),
  CONSTRAINT chk_srs_target CHECK (
    (item_type = 'VOCAB' AND vocab_id IS NOT NULL AND chunk_id IS NULL AND expression_id IS NULL)
    OR (item_type = 'CHUNK' AND vocab_id IS NULL AND chunk_id IS NOT NULL AND expression_id IS NULL)
    OR (item_type = 'EXPRESSION' AND vocab_id IS NULL AND chunk_id IS NULL AND expression_id IS NOT NULL)
  ),
  CONSTRAINT chk_srs_ef CHECK (ease_factor BETWEEN 1.30 AND 2.50),
  CONSTRAINT chk_srs_interval CHECK (interval_days BETWEEN 0 AND 365),
  CONSTRAINT chk_srs_quality CHECK (last_response_quality IS NULL OR last_response_quality BETWEEN 0 AND 3),
  CONSTRAINT chk_srs_status CHECK (mastery_status IN ('NEW','LEARNING','SHORT_TERM','CONSOLIDATING','MASTERED','CONSOLIDATED','AT_RISK','SUSPENDED')),
  CONSTRAINT chk_srs_verify CHECK (delayed_verify_stage IN ('NONE','D1_PENDING','D7_PENDING','PASSED','FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户统一 SRS 当前投影；历史 lrn_vocab_progress 映射到 item_type=VOCAB';

---

### 7.6 排程快照与批次项

~~~sql
CREATE TABLE IF NOT EXISTS lrn_schedule_snapshot (
  schedule_snapshot_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  local_date DATE NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
  schedule_type VARCHAR(16) NOT NULL DEFAULT 'DAILY',
  active_wordbook_id BIGINT UNSIGNED NULL,
  daily_new_target INT UNSIGNED NOT NULL DEFAULT 0,
  max_daily_review INT UNSIGNED NOT NULL,
  algorithm_version VARCHAR(32) NOT NULL,
  rules_version VARCHAR(32) NOT NULL,
  content_version VARCHAR(32) NOT NULL,
  server_cutoff_at DATETIME(3) NOT NULL,
  random_seed BIGINT UNSIGNED NOT NULL,
  item_count INT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  generation_idempotency_key VARCHAR(128) NOT NULL,
  generated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  consumed_at DATETIME(3) NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (schedule_snapshot_id),
  UNIQUE KEY uk_snapshot_user_date_type (user_id, local_date, schedule_type),
  UNIQUE KEY uk_snapshot_generation_idem (user_id, generation_idempotency_key),
  KEY idx_snapshot_user_status (user_id, status, local_date),
  CONSTRAINT fk_snapshot_wordbook FOREIGN KEY (active_wordbook_id) REFERENCES cnt_wordbook(wordbook_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_snapshot_type CHECK (schedule_type IN ('DAILY','CATCH_UP','EXPRESSION')),
  CONSTRAINT chk_snapshot_status CHECK (status IN ('ACTIVE','PARTIALLY_CONSUMED','CONSUMED','EXPIRED')),
  CONSTRAINT chk_snapshot_limit CHECK (max_daily_review BETWEEN 1 AND 200)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='不可变的每日/追赶排程输入快照';

CREATE TABLE IF NOT EXISTS lrn_schedule_snapshot_item (
  snapshot_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  schedule_snapshot_id BIGINT UNSIGNED NOT NULL,
  srs_state_id BIGINT UNSIGNED NULL,
  item_type VARCHAR(16) NOT NULL,
  vocab_id BIGINT UNSIGNED NULL,
  chunk_id BIGINT UNSIGNED NULL,
  expression_id BIGINT UNSIGNED NULL,
  sequence_no INT UNSIGNED NOT NULL,
  source_reason VARCHAR(32) NOT NULL,
  planned_local_date DATE NOT NULL,
  due_at_at_snapshot DATETIME(3) NULL,
  state_version_at_snapshot BIGINT UNSIGNED NULL,
  priority_score DECIMAL(10,4) NOT NULL DEFAULT 0,
  content_version VARCHAR(32) NOT NULL,
  content_hash CHAR(64) NOT NULL,
  question_seed BIGINT UNSIGNED NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  started_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  item_key VARCHAR(96) GENERATED ALWAYS AS (
    CASE
      WHEN item_type = 'VOCAB' THEN CONCAT('VOCAB:', vocab_id)
      WHEN item_type = 'CHUNK' THEN CONCAT('CHUNK:', chunk_id)
      WHEN item_type = 'EXPRESSION' THEN CONCAT('EXPRESSION:', expression_id)
      ELSE NULL
    END
  ) STORED,
  PRIMARY KEY (snapshot_item_id),
  UNIQUE KEY uk_snapshot_item_key (schedule_snapshot_id, item_key),
  UNIQUE KEY uk_snapshot_sequence (schedule_snapshot_id, sequence_no),
  KEY idx_snapshot_item_status (schedule_snapshot_id, status, sequence_no),
  KEY idx_snapshot_item_srs (srs_state_id, status),
  CONSTRAINT fk_snapshot_item_snapshot FOREIGN KEY (schedule_snapshot_id) REFERENCES lrn_schedule_snapshot(schedule_snapshot_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_snapshot_item_srs FOREIGN KEY (srs_state_id) REFERENCES lrn_srs_state(srs_state_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_snapshot_item_vocab FOREIGN KEY (vocab_id) REFERENCES cnt_vocabulary(vocab_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_snapshot_item_chunk FOREIGN KEY (chunk_id) REFERENCES cnt_chunk(chunk_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_snapshot_item_expression FOREIGN KEY (expression_id) REFERENCES lrn_mined_expression(expression_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_snapshot_item_type CHECK (item_type IN ('VOCAB','CHUNK','EXPRESSION')),
  CONSTRAINT chk_snapshot_item_target CHECK (
    (item_type = 'VOCAB' AND vocab_id IS NOT NULL AND chunk_id IS NULL AND expression_id IS NULL)
    OR (item_type = 'CHUNK' AND vocab_id IS NULL AND chunk_id IS NOT NULL AND expression_id IS NULL)
    OR (item_type = 'EXPRESSION' AND vocab_id IS NULL AND chunk_id IS NULL AND expression_id IS NOT NULL)
  ),
  CONSTRAINT chk_snapshot_item_status CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','SKIPPED','EXPIRED','RISK_FILTERED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='排程批次中的稳定学习项';

---

---

### 7.7 复习事件、风控审计与事件出站

~~~sql
CREATE TABLE IF NOT EXISTS lrn_review_event (
  review_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  client_event_id VARCHAR(96) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  schedule_snapshot_id BIGINT UNSIGNED NULL,
  snapshot_item_id BIGINT UNSIGNED NULL,
  srs_state_id BIGINT UNSIGNED NULL,
  item_type VARCHAR(16) NOT NULL,
  vocab_id BIGINT UNSIGNED NULL,
  chunk_id BIGINT UNSIGNED NULL,
  expression_id BIGINT UNSIGNED NULL,
  raw_quality TINYINT UNSIGNED NULL,
  effective_quality TINYINT UNSIGNED NULL,
  answer_outcome VARCHAR(32) NOT NULL,
  response_time_ms INT UNSIGNED NULL,
  reveal_elapsed_ms INT UNSIGNED NULL,
  attempt_no SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  client_occurred_at DATETIME(3) NULL,
  client_timezone VARCHAR(64) NULL,
  server_received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  risk_decision VARCHAR(24) NOT NULL DEFAULT 'ALLOW',
  risk_score DECIMAL(6,4) NULL,
  event_status VARCHAR(20) NOT NULL DEFAULT 'ACCEPTED',
  algorithm_version VARCHAR(32) NULL,
  state_version_before BIGINT UNSIGNED NULL,
  state_version_after BIGINT UNSIGNED NULL,
  reconciled TINYINT(1) NOT NULL DEFAULT 0,
  state_before_json JSON NULL,
  state_after_json JSON NULL,
  answer_payload_hash CHAR(64) NULL,
  device_id_hash CHAR(64) NULL,
  rules_version VARCHAR(32) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (review_event_id),
  UNIQUE KEY uk_review_user_idem (user_id, idempotency_key),
  UNIQUE KEY uk_review_user_client_event (user_id, client_event_id),
  KEY idx_review_user_item_time (user_id, item_type, vocab_id, chunk_id, expression_id, server_received_at),
  KEY idx_review_snapshot_item (snapshot_item_id, event_status, review_event_id),
  KEY idx_review_user_status_time (user_id, event_status, server_received_at),
  CONSTRAINT fk_review_snapshot FOREIGN KEY (schedule_snapshot_id) REFERENCES lrn_schedule_snapshot(schedule_snapshot_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_review_snapshot_item FOREIGN KEY (snapshot_item_id) REFERENCES lrn_schedule_snapshot_item(snapshot_item_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_review_srs FOREIGN KEY (srs_state_id) REFERENCES lrn_srs_state(srs_state_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_review_vocab FOREIGN KEY (vocab_id) REFERENCES cnt_vocabulary(vocab_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_review_chunk FOREIGN KEY (chunk_id) REFERENCES cnt_chunk(chunk_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_review_expression FOREIGN KEY (expression_id) REFERENCES lrn_mined_expression(expression_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_review_item_type CHECK (item_type IN ('VOCAB','CHUNK','EXPRESSION')),
  CONSTRAINT chk_review_target CHECK (
    (item_type = 'VOCAB' AND vocab_id IS NOT NULL AND chunk_id IS NULL AND expression_id IS NULL)
    OR (item_type = 'CHUNK' AND vocab_id IS NULL AND chunk_id IS NOT NULL AND expression_id IS NULL)
    OR (item_type = 'EXPRESSION' AND vocab_id IS NULL AND chunk_id IS NULL AND expression_id IS NOT NULL)
  ),
  CONSTRAINT chk_review_raw_quality CHECK (raw_quality IS NULL OR raw_quality BETWEEN 0 AND 3),
  CONSTRAINT chk_review_effective_quality CHECK (effective_quality IS NULL OR effective_quality BETWEEN 0 AND 3),
  CONSTRAINT chk_review_outcome CHECK (answer_outcome IN ('CORRECT','INCORRECT','UNANSWERED','REVEALED_WITHOUT_ANSWER')),
  CONSTRAINT chk_review_risk_decision CHECK (risk_decision IN ('ALLOW','ACCEPT_NO_REWARD','THROTTLE','REJECT','REVIEW')),
  CONSTRAINT chk_review_status CHECK (event_status IN ('ACCEPTED','DUPLICATE','RISK_FILTERED','CONFLICT','REJECTED','EXPIRED')),
  CONSTRAINT chk_review_reconciled CHECK (reconciled IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='追加式复习事实与幂等凭证';

CREATE TABLE IF NOT EXISTS lrn_risk_audit (
  risk_audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  review_event_id BIGINT UNSIGNED NULL,
  request_id VARCHAR(64) NOT NULL,
  snapshot_item_id BIGINT UNSIGNED NULL,
  item_type VARCHAR(16) NULL,
  vocab_id BIGINT UNSIGNED NULL,
  chunk_id BIGINT UNSIGNED NULL,
  expression_id BIGINT UNSIGNED NULL,
  rule_code VARCHAR(64) NOT NULL,
  risk_type VARCHAR(32) NOT NULL,
  risk_score DECIMAL(6,4) NOT NULL DEFAULT 0,
  decision VARCHAR(24) NOT NULL,
  dwell_time_ms INT UNSIGNED NULL,
  batch_size INT UNSIGNED NULL,
  device_id_hash CHAR(64) NULL,
  ip_hash CHAR(64) NULL,
  client_clock_skew_ms BIGINT NULL,
  evidence_json JSON NULL,
  rules_version VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (risk_audit_id),
  KEY idx_risk_user_time (user_id, created_at, decision),
  KEY idx_risk_rule_time (rule_code, created_at),
  KEY idx_risk_event (review_event_id, risk_audit_id),
  CONSTRAINT fk_risk_review_event FOREIGN KEY (review_event_id) REFERENCES lrn_review_event(review_event_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_risk_snapshot_item FOREIGN KEY (snapshot_item_id) REFERENCES lrn_schedule_snapshot_item(snapshot_item_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_risk_item_type CHECK (item_type IS NULL OR item_type IN ('VOCAB','CHUNK','EXPRESSION')),
  CONSTRAINT chk_risk_decision CHECK (decision IN ('ALLOW','ACCEPT_NO_REWARD','THROTTLE','REJECT','REVIEW')),
  CONSTRAINT chk_risk_score CHECK (risk_score BETWEEN 0 AND 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='词汇复习风控规则命中与证据审计';

CREATE TABLE IF NOT EXISTS lrn_learning_outbox (
  outbox_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  aggregate_type VARCHAR(32) NOT NULL,
  aggregate_id BIGINT UNSIGNED NOT NULL,
  event_name VARCHAR(96) NOT NULL,
  event_schema VARCHAR(32) NOT NULL,
  dedupe_key VARCHAR(160) NOT NULL,
  payload_json JSON NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  publish_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME(3) NULL,
  published_at DATETIME(3) NULL,
  last_error_code VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (outbox_id),
  UNIQUE KEY uk_outbox_dedupe (dedupe_key),
  KEY idx_outbox_pending (publish_status, next_attempt_at, outbox_id),
  CONSTRAINT chk_outbox_status CHECK (publish_status IN ('PENDING','PUBLISHED','FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='复习结果事件出站表';
~~~

---

### 7.8 外键、保留和匿名化策略

| 数据 | 删除策略 | 保留目的 |
|---|---|---|
| cnt_wordbook/cnt_vocabulary/cnt_vocab_definition/cnt_vocab_example/cnt_chunk | 仅 ARCHIVED，物理删除 RESTRICT | 保证快照、题目、回放和内容纠错可定位 |
| cnt_relation/cnt_root/confusable | 仅 ARCHIVED，物理删除 RESTRICT | 保留教研关系版本和课程历史 |
| lrn_srs_state | 用户请求暂停或账号匿名化，不物理删除 | 掌握图谱与统计可解释 |
| lrn_review_event | 追加写入，禁止更新业务含义；按合规周期分区归档 | 复习事实、幂等回放、申诉 |
| lrn_schedule_snapshot/item | 过期后只读，禁止删除被引用批次 | 解释当日为什么排到该项 |
| lrn_mined_expression | DELETED + deleted_at；保留脱敏事件 | 用户私有数据生命周期 |
| lrn_risk_audit | 追加写入，原始 IP/设备不保存，只保留哈希 | 风控复核与反作弊申诉 |
| lrn_learning_outbox | PUBLISHED 后按消息留存策略归档 | 保证跨域事件至少一次投递且消费幂等 |

所有跨表外键均使用 ON DELETE RESTRICT/ON UPDATE RESTRICT。user_id 与 auth 域为语义外键；账号注销时由统一匿名化任务将用户身份替换为不可逆 tombstone 标识，不能级联删除学习事实。

---

---

## 8. REST / OpenAPI 3.0 接口契约

### 8.1 通用协议

- Base URL：/api/v1。
- JSON 字段为 camelCase；数据库字段为 snake_case。
- 所有响应都包含 requestId；成功响应为 { requestId, data, meta }，错误响应为 { requestId, error }。
- Authorization: Bearer JWT 必须包含用户身份、设备会话和权限；userId 从 token 解析，客户端不得在 body 中覆盖。
- GET 只读；PUT、POST、PATCH、DELETE 均必须携带 Idempotency-Key（长度 16～128，字符集 ASCII 可打印）。
- 同一个 userId、HTTP 方法、路径和 Idempotency-Key：body hash 相同则返回首次响应，body hash 不同返回 IDEMPOTENCY_KEY_REUSED。
- 复习写操作必须同时携带 X-Device-Id、X-Client-Version、X-Timezone；服务端记录设备哈希而不保存原始设备号。
- 分页使用不透明 cursor；limit 默认 20、最小 1、最大 100。cursor 绑定 userId、查询条件和 snapshotAt，不能跨用户复用。
- 资源权限：LEARNER_SELF 只能访问 token 所属用户的已发布内容、自己的收藏/表达/SRS；CONTENT_READER 只读公开内容；RISK_REVIEW 仅由风控/管理员域访问审计。
- 不允许客户端上传 easeFactor、intervalDays、nextReviewAt、masteryStatus、XP 或 Streak；这些字段由服务端计算。
- 与学习流域既有契约保持兼容：GET /api/v1/learning/stream/today 与 POST /api/v1/learning/stream/action 是总学习流入口，本域 SRS 端点使用同一事务服务。

### 8.2 响应、分页与错误

成功响应示例：

~~~json
{
  "requestId": "req_01J8VOC0001",
  "data": {
    "snapshotId": 9001,
    "items": []
  },
  "meta": {
    "serverTime": "2026-08-20T10:00:00+08:00",
    "snapshotAt": "2026-08-20T10:00:00+08:00",
    "nextCursor": null,
    "hasMore": false
  }
}
~~~

错误响应示例：

~~~json
{
  "requestId": "req_01J8VOC0002",
  "error": {
    "errorCode": "SRS_VERSION_CONFLICT",
    "message": "该卡片已在其他设备更新，请刷新后继续。",
    "retryable": true,
    "details": {
      "currentStateVersion": 5,
      "snapshotItemId": 9010
    }
  }
}
~~~

稳定错误码：

| HTTP | errorCode | 语义 | 客户端处理 |
|---:|---|---|---|
| 400 | VALIDATION_ERROR | 字段、枚举、cursor 或范围非法 | 修正请求，不重试 |
| 401 | UNAUTHENTICATED | token 无效/过期 | 刷新会话后重试一次 |
| 403 | FORBIDDEN | 无资源权限、非本人资源或年龄/阶段不符 | 不重试 |
| 404 | VOCAB_NOT_FOUND / CHUNK_NOT_FOUND / EXPRESSION_NOT_FOUND | 资源不存在或不可见 | 刷新内容/移除入口 |
| 409 | IDEMPOTENCY_KEY_REUSED | 同幂等键 body 不同 | 生成新幂等键并人工确认 |
| 409 | SRS_VERSION_CONFLICT | 在线状态版本过期 | 拉取当前状态后 rebase |
| 409 | SNAPSHOT_EXPIRED | 批次已过期 | 创建/获取新批次 |
| 409 | CONTENT_VERSION_CONFLICT | 内容版本与快照不一致 | 使用服务端快照内容 |
| 422 | INVALID_REVIEW_QUALITY | q 不在 0～3或结果矛盾 | 修正事件 |
| 422 | MINING_OFFSET_INVALID | 挖句范围越界/跨段 | 重新选择文本 |
| 422 | DAILY_CAP_EXCEEDED | 达到当日有效上限 | 展示原因，不重试 |
| 423 | RISK_REVIEW_REQUIRED | 风控要求暂缓 | 保留本地事件，等待结果 |
| 429 | RATE_LIMITED | 速率限制 | 按 Retry-After 退避 |
| 410 | OFFLINE_EVENT_EXPIRED | 离线事件超过 72 小时 | 标记过期，不补奖励 |
| 500 | INTERNAL_ERROR | 服务端异常 | 只对 retryable=true 的请求重试 |

### 8.3 OpenAPI 3.0.3 YAML

~~~yaml
openapi: 3.0.3
info:
  title: PhraseStar Vocabulary and SRS API
  version: 2.0.0
  description: Phase 1 成人词汇、句块、挖句与确定性 SRS 契约；不包含生成式 AI 能力。
servers:
  - url: https://api.example.invalid
security:
  - bearerAuth: []
tags:
  - name: VocabularyContent
  - name: VocabularyLibrary
  - name: Expressions
  - name: LearningStream
  - name: SRS
paths:
  /api/v1/vocab/wordbooks:
    get:
      operationId: listWordbooks
      tags: [VocabularyContent]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/Cursor'
        - $ref: '#/components/parameters/Limit'
        - name: targetGoal
          in: query
          schema: {type: string, maxLength: 32}
        - name: cefrLevel
          in: query
          schema: {$ref: '#/components/schemas/CefrLevel'}
      responses:
        '200':
          description: 已发布成人词书
          content:
            application/json:
              schema: {$ref: '#/components/schemas/WordbookPageResponse'}
        '401': {$ref: '#/components/responses/Unauthenticated'}
  /api/v1/vocab/wordbooks/{wordbookId}/activation:
    put:
      operationId: activateWordbook
      tags: [VocabularyContent]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/WordbookId'
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [active]
              properties:
                active: {type: boolean, enum: [true]}
      responses:
        '200':
          description: 主学习词书已切换
          content:
            application/json:
              schema: {$ref: '#/components/schemas/ActivationResponse'}
        '409': {$ref: '#/components/responses/Conflict'}
  /api/v1/vocab/wordbooks/{wordbookId}/items:
    get:
      operationId: listWordbookItems
      tags: [VocabularyContent]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/WordbookId'
        - $ref: '#/components/parameters/Cursor'
        - $ref: '#/components/parameters/Limit'
        - name: masteryStatus
          in: query
          schema: {$ref: '#/components/schemas/MasteryStatus'}
        - name: dueOnly
          in: query
          schema: {type: boolean, default: false}
      responses:
        '200':
          description: 词书词条和用户摘要
          content:
            application/json:
              schema: {$ref: '#/components/schemas/VocabItemPageResponse'}
  /api/v1/vocab/items/{vocabId}:
    get:
      operationId: getVocabDetail
      tags: [VocabularyContent]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/VocabId'
        - name: contentVersion
          in: query
          schema: {type: string, maxLength: 32}
      responses:
        '200':
          description: 词汇完整档案；标准答案仅在受保护的题目反馈接口返回
          content:
            application/json:
              schema: {$ref: '#/components/schemas/VocabDetailResponse'}
        '404': {$ref: '#/components/responses/NotFound'}
  /api/v1/vocab/chunks/{chunkId}:
    get:
      operationId: getChunkDetail
      tags: [VocabularyContent]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/ChunkId'
      responses:
        '200':
          description: 句块档案
          content:
            application/json:
              schema: {$ref: '#/components/schemas/ChunkDetailResponse'}
        '404': {$ref: '#/components/responses/NotFound'}
  /api/v1/vocab/roots/{rootId}:
    get:
      operationId: getRootTopic
      tags: [VocabularyContent]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/RootId'
        - $ref: '#/components/parameters/Cursor'
        - $ref: '#/components/parameters/Limit'
      responses:
        '200':
          description: 词根专题和局部词族
          content:
            application/json:
              schema: {$ref: '#/components/schemas/RootTopicResponse'}
  /api/v1/vocab/library:
    get:
      operationId: listUserLibrary
      tags: [VocabularyLibrary]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/Cursor'
        - $ref: '#/components/parameters/Limit'
        - name: itemType
          in: query
          schema: {$ref: '#/components/schemas/ItemType'}
        - name: masteryStatus
          in: query
          schema: {$ref: '#/components/schemas/MasteryStatus'}
        - name: collectionStatus
          in: query
          schema: {type: string, enum: [NEW_WORD, SAVED, MASTERED]}
        - name: sourceType
          in: query
          schema: {type: string, enum: [READING, LISTENING, PRACTICE, MANUAL, SYSTEM]}
        - name: cefrLevel
          in: query
          schema: {$ref: '#/components/schemas/CefrLevel'}
        - name: dueRange
          in: query
          schema: {type: string, enum: [TODAY, UPCOMING, OVERDUE]}
      responses:
        '200':
          description: 用户自己的词库
          content:
            application/json:
              schema: {$ref: '#/components/schemas/LibraryPageResponse'}
  /api/v1/vocab/library/entries:
    post:
      operationId: addLibraryEntry
      tags: [VocabularyLibrary]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LibraryEntryCreateRequest'
            example:
              itemType: VOCAB
              vocabId: 123
              sourceType: PRACTICE
              collectionStatus: NEW_WORD
      responses:
        '200':
          description: 收藏成功或幂等重复
          content:
            application/json:
              schema: {$ref: '#/components/schemas/LibraryEntryResponse'}
        '404': {$ref: '#/components/responses/NotFound'}
  /api/v1/vocab/library/entries/{entryId}:
    delete:
      operationId: removeLibraryEntry
      tags: [VocabularyLibrary]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/EntryId'
        - $ref: '#/components/parameters/IdempotencyKey'
      responses:
        '200':
          description: 软删除成功
          content:
            application/json:
              schema: {$ref: '#/components/schemas/EmptyResponse'}
  /api/v1/vocab/expressions:
    get:
      operationId: listExpressions
      tags: [Expressions]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/Cursor'
        - $ref: '#/components/parameters/Limit'
        - name: tagId
          in: query
          schema: {type: integer, format: int64}
        - name: sourceType
          in: query
          schema: {type: string, enum: [READING, LISTENING, SCENARIO, VOCAB_EXAMPLE]}
        - name: wantToSay
          in: query
          schema: {type: boolean}
        - name: masteryStatus
          in: query
          schema: {$ref: '#/components/schemas/MasteryStatus'}
      responses:
        '200':
          description: 用户表达库
          content:
            application/json:
              schema: {$ref: '#/components/schemas/ExpressionPageResponse'}
    post:
      operationId: createMinedExpression
      tags: [Expressions]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema: {$ref: '#/components/schemas/ExpressionCreateRequest'}
            example:
              sourceType: READING
              sourceRef: article_2026_08_01
              sourceContentVersion: v3
              sentenceText: "Please let me know if you need anything else."
              selectedText: "let me know"
              rangeStart: 7
              rangeEnd: 18
              wantToSay: true
              addToSrs: true
      responses:
        '200':
          description: 创建成功或同幂等结果
          content:
            application/json:
              schema: {$ref: '#/components/schemas/ExpressionResponse'}
        '422': {$ref: '#/components/responses/ValidationError'}
  /api/v1/vocab/expressions/{expressionId}:
    patch:
      operationId: updateMinedExpression
      tags: [Expressions]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/ExpressionId'
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema: {$ref: '#/components/schemas/ExpressionUpdateRequest'}
      responses:
        '200':
          description: 更新私人表达属性
          content:
            application/json:
              schema: {$ref: '#/components/schemas/ExpressionResponse'}
    delete:
      operationId: deleteMinedExpression
      tags: [Expressions]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/ExpressionId'
        - $ref: '#/components/parameters/IdempotencyKey'
      responses:
        '200':
          description: 软删除表达
          content:
            application/json:
              schema: {$ref: '#/components/schemas/EmptyResponse'}
  /api/v1/learning/stream/today:
    get:
      operationId: getTodayLearningStream
      tags: [LearningStream]
      security: [{bearerAuth: []}]
      parameters:
        - name: localDate
          in: query
          schema: {type: string, format: date}
        - name: limit
          in: query
          schema: {type: integer, minimum: 1, maximum: 50, default: 20}
      responses:
        '200':
          description: 今日混合学习流；VOC 项包含快照引用
          content:
            application/json:
              schema: {$ref: '#/components/schemas/LearningStreamResponse'}
  /api/v1/learning/stream/action:
    post:
      operationId: submitLearningStreamAction
      tags: [LearningStream]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
        - $ref: '#/components/parameters/DeviceIdHeader'
        - $ref: '#/components/parameters/ClientVersionHeader'
        - $ref: '#/components/parameters/TimezoneHeader'
      requestBody:
        required: true
        content:
          application/json:
            schema: {$ref: '#/components/schemas/ReviewEventRequest'}
      responses:
        '200':
          description: 与 SRS review endpoint 相同的原子结算结果
          content:
            application/json:
              schema: {$ref: '#/components/schemas/ReviewEventResponse'}
        '409': {$ref: '#/components/responses/Conflict'}
  /api/v1/learning/srs/batches:
    post:
      operationId: createSrsBatch
      tags: [SRS]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
        - $ref: '#/components/parameters/DeviceIdHeader'
        - $ref: '#/components/parameters/ClientVersionHeader'
        - $ref: '#/components/parameters/TimezoneHeader'
      requestBody:
        required: true
        content:
          application/json:
            schema: {$ref: '#/components/schemas/SrsBatchCreateRequest'}
            example:
              localDate: "2026-08-20"
              timezone: Asia/Shanghai
              dailyNewTarget: 20
              maxDailyReview: 50
              scheduleType: DAILY
      responses:
        '200':
          description: 返回当天不可变排程快照
          content:
            application/json:
              schema: {$ref: '#/components/schemas/SrsBatchResponse'}
  /api/v1/learning/srs/batches/{snapshotId}:
    get:
      operationId: getSrsBatch
      tags: [SRS]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/SnapshotId'
      responses:
        '200':
          description: 批次和当前消费状态
          content:
            application/json:
              schema: {$ref: '#/components/schemas/SrsBatchResponse'}
        '410': {$ref: '#/components/responses/SnapshotExpired'}
  /api/v1/learning/srs/reviews:
    post:
      operationId: submitReviewEvent
      tags: [SRS]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
        - $ref: '#/components/parameters/DeviceIdHeader'
        - $ref: '#/components/parameters/ClientVersionHeader'
        - $ref: '#/components/parameters/TimezoneHeader'
      requestBody:
        required: true
        content:
          application/json:
            schema: {$ref: '#/components/schemas/ReviewEventRequest'}
            example:
              snapshotId: 9001
              snapshotItemId: 9010
              item:
                itemType: VOCAB
                vocabId: 123
              rawQuality: 2
              answerOutcome: CORRECT
              responseTimeMs: 1840
              revealElapsedMs: 5120
              clientEventId: ce_01J8VOC
              clientOccurredAt: "2026-08-20T10:15:30.500+08:00"
              baseStateVersion: 4
      responses:
        '200':
          description: 接受、重复或无奖励的确定结果
          content:
            application/json:
              schema: {$ref: '#/components/schemas/ReviewEventResponse'}
        '409': {$ref: '#/components/responses/Conflict'}
        '410': {$ref: '#/components/responses/OfflineExpired'}
        '422': {$ref: '#/components/responses/ValidationError'}
  /api/v1/learning/srs/reviews:sync:
    post:
      operationId: syncReviewEvents
      tags: [SRS]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
        - $ref: '#/components/parameters/DeviceIdHeader'
        - $ref: '#/components/parameters/ClientVersionHeader'
        - $ref: '#/components/parameters/TimezoneHeader'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [events]
              properties:
                events:
                  type: array
                  minItems: 1
                  maxItems: 50
                  items: {$ref: '#/components/schemas/ReviewEventRequest'}
      responses:
        '200':
          description: 逐项返回同步结果，单项失败不回滚其他已接受事件
          content:
            application/json:
              schema: {$ref: '#/components/schemas/ReviewSyncResponse'}
  /api/v1/learning/srs/states:
    get:
      operationId: listSrsStates
      tags: [SRS]
      security: [{bearerAuth: []}]
      parameters:
        - $ref: '#/components/parameters/Cursor'
        - $ref: '#/components/parameters/Limit'
        - name: itemType
          in: query
          schema: {$ref: '#/components/schemas/ItemType'}
        - name: masteryStatus
          in: query
          schema: {$ref: '#/components/schemas/MasteryStatus'}
        - name: dueRange
          in: query
          schema: {type: string, enum: [TODAY, UPCOMING, OVERDUE, AT_RISK]}
      responses:
        '200':
          description: 用户 SRS 状态分页
          content:
            application/json:
              schema: {$ref: '#/components/schemas/SrsStatePageResponse'}
  /api/v1/learning/srs/overview:
    get:
      operationId: getSrsOverview
      tags: [SRS]
      security: [{bearerAuth: []}]
      responses:
        '200':
          description: 记忆中心统计
          content:
            application/json:
              schema: {$ref: '#/components/schemas/SrsOverviewResponse'}
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  parameters:
    Cursor:
      name: cursor
      in: query
      required: false
      schema: {type: string, maxLength: 512}
    Limit:
      name: limit
      in: query
      required: false
      schema: {type: integer, minimum: 1, maximum: 100, default: 20}
    IdempotencyKey:
      name: Idempotency-Key
      in: header
      required: true
      schema: {type: string, minLength: 16, maxLength: 128}
    DeviceIdHeader:
      name: X-Device-Id
      in: header
      required: true
      schema: {type: string, minLength: 8, maxLength: 128}
    ClientVersionHeader:
      name: X-Client-Version
      in: header
      required: true
      schema: {type: string, minLength: 1, maxLength: 64}
    TimezoneHeader:
      name: X-Timezone
      in: header
      required: true
      schema: {type: string, minLength: 1, maxLength: 64}
    WordbookId:
      name: wordbookId
      in: path
      required: true
      schema: {type: integer, format: int64, minimum: 1}
    VocabId:
      name: vocabId
      in: path
      required: true
      schema: {type: integer, format: int64, minimum: 1}
    ChunkId:
      name: chunkId
      in: path
      required: true
      schema: {type: integer, format: int64, minimum: 1}
    RootId:
      name: rootId
      in: path
      required: true
      schema: {type: integer, format: int64, minimum: 1}
    EntryId:
      name: entryId
      in: path
      required: true
      schema: {type: integer, format: int64, minimum: 1}
    ExpressionId:
      name: expressionId
      in: path
      required: true
      schema: {type: integer, format: int64, minimum: 1}
    SnapshotId:
      name: snapshotId
      in: path
      required: true
      schema: {type: integer, format: int64, minimum: 1}
  responses:
    Unauthenticated:
      description: 未认证
      content: {application/json: {schema: {$ref: '#/components/schemas/ErrorResponse'}}}
    NotFound:
      description: 资源不存在或不可见
      content: {application/json: {schema: {$ref: '#/components/schemas/ErrorResponse'}}}
    Conflict:
      description: 幂等、版本或快照冲突
      content: {application/json: {schema: {$ref: '#/components/schemas/ErrorResponse'}}}
    ValidationError:
      description: 请求校验失败
      content: {application/json: {schema: {$ref: '#/components/schemas/ErrorResponse'}}}
    SnapshotExpired:
      description: 快照过期
      content: {application/json: {schema: {$ref: '#/components/schemas/ErrorResponse'}}}
    OfflineExpired:
      description: 离线事件超过 72 小时
      content: {application/json: {schema: {$ref: '#/components/schemas/ErrorResponse'}}}
  schemas:
    CefrLevel:
      type: string
      enum: [A1, A2, B1, B2, C1, C2]
    ItemType:
      type: string
      enum: [VOCAB, CHUNK, EXPRESSION]
    MasteryStatus:
      type: string
      enum: [NEW, LEARNING, SHORT_TERM, CONSOLIDATING, MASTERED, CONSOLIDATED, AT_RISK, SUSPENDED]
    ReviewQuality:
      type: integer
      enum: [0, 1, 2, 3]
    AnswerOutcome:
      type: string
      enum: [CORRECT, INCORRECT, UNANSWERED, REVEALED_WITHOUT_ANSWER]
    LearningItemRef:
      oneOf:
        - type: object
          required: [itemType, vocabId]
          properties:
            itemType: {type: string, enum: [VOCAB]}
            vocabId: {type: integer, format: int64}
        - type: object
          required: [itemType, chunkId]
          properties:
            itemType: {type: string, enum: [CHUNK]}
            chunkId: {type: integer, format: int64}
        - type: object
          required: [itemType, expressionId]
          properties:
            itemType: {type: string, enum: [EXPRESSION]}
            expressionId: {type: integer, format: int64}
      discriminator:
        propertyName: itemType
    ErrorResponse:
      type: object
      required: [requestId, error]
      properties:
        requestId: {type: string}
        error:
          type: object
          required: [errorCode, message, retryable]
          properties:
            errorCode: {type: string}
            message: {type: string}
            retryable: {type: boolean}
            details: {type: object, additionalProperties: true}
    PageMeta:
      type: object
      required: [serverTime, hasMore]
      properties:
        serverTime: {type: string, format: date-time}
        snapshotAt: {type: string, format: date-time}
        nextCursor: {type: string, nullable: true}
        hasMore: {type: boolean}
    Wordbook:
      type: object
      required: [wordbookId, code, nameCn, status, contentVersion, wordCount]
      properties:
        wordbookId: {type: integer, format: int64}
        code: {type: string}
        nameCn: {type: string}
        status: {type: string, enum: [PUBLISHED, ARCHIVED]}
        contentVersion: {type: string}
        sourceVersion: {type: string}
        minCefr: {$ref: '#/components/schemas/CefrLevel'}
        maxCefr: {$ref: '#/components/schemas/CefrLevel'}
        wordCount: {type: integer, minimum: 0}
        active: {type: boolean}
    WordbookPageResponse:
      type: object
      required: [requestId, data, meta]
      properties:
        requestId: {type: string}
        data:
          type: object
          required: [items]
          properties:
            items: {type: array, items: {$ref: '#/components/schemas/Wordbook'}}
        meta: {$ref: '#/components/schemas/PageMeta'}
    ActivationResponse:
      type: object
      required: [requestId, data]
      properties:
        requestId: {type: string}
        data:
          type: object
          required: [activeWordbookId, planVersion]
          properties:
            activeWordbookId: {type: integer, format: int64}
            planVersion: {type: integer, format: int64}
            retainedStateCount: {type: integer, minimum: 0}
            firstSnapshotId: {type: integer, format: int64, nullable: true}
    Definition:
      type: object
      required: [definitionId, vocabId, senseNo, partOfSpeech, meaningCn, contentVersion]
      properties:
        definitionId: {type: integer, format: int64}
        vocabId: {type: integer, format: int64}
        senseNo: {type: integer, minimum: 1}
        partOfSpeech: {type: string}
        registerCode: {type: string, nullable: true}
        meaningCn: {type: string}
        definitionEn: {type: string, nullable: true}
        contentVersion: {type: string}
    Example:
      type: object
      required: [exampleId, vocabId, sentenceEn, sentenceCn, contentVersion]
      properties:
        exampleId: {type: integer, format: int64}
        vocabId: {type: integer, format: int64}
        definitionId: {type: integer, format: int64, nullable: true}
        sentenceEn: {type: string}
        sentenceCn: {type: string}
        highlightSpans: {type: array, items: {type: object, additionalProperties: true}}
        audioUrl: {type: string, format: uri, nullable: true}
        contentVersion: {type: string}
    SrsState:
      type: object
      required: [srsStateId, item, repetitionCount, easeFactor, intervalDays, dueAt, dueLocalDate, masteryStatus, stateVersion]
      properties:
        srsStateId: {type: integer, format: int64}
        item: {$ref: '#/components/schemas/LearningItemRef'}
        repetitionCount: {type: integer, minimum: 0}
        easeFactor: {type: number, format: double, minimum: 1.3, maximum: 2.5}
        intervalDays: {type: integer, minimum: 0, maximum: 365}
        dueAt: {type: string, format: date-time}
        dueLocalDate: {type: string, format: date}
        masteryStatus: {$ref: '#/components/schemas/MasteryStatus'}
        delayedVerifyStage: {type: string, enum: [NONE, D1_PENDING, D7_PENDING, PASSED, FAILED]}
        stateVersion: {type: integer, format: int64}
        riskBand: {type: string, enum: [LOW, MEDIUM, HIGH]}
        explanation: {type: array, items: {type: string}}
    VocabItem:
      type: object
      required: [vocabId, word, cefrLevel, contentVersion]
      properties:
        vocabId: {type: integer, format: int64}
        word: {type: string}
        cefrLevel: {$ref: '#/components/schemas/CefrLevel'}
        contentVersion: {type: string}
        srsState: {$ref: '#/components/schemas/SrsState'}
    VocabItemPageResponse:
      type: object
      required: [requestId, data, meta]
      properties:
        requestId: {type: string}
        data: {type: object, properties: {items: {type: array, items: {$ref: '#/components/schemas/VocabItem'}}}}
        meta: {$ref: '#/components/schemas/PageMeta'}
    VocabDetailResponse:
      type: object
      required: [requestId, data]
      properties:
        requestId: {type: string}
        data:
          type: object
          required: [vocabId, word, contentVersion, definitions, examples]
          properties:
            vocabId: {type: integer, format: int64}
            word: {type: string}
            phoneticUs: {type: string, nullable: true}
            phoneticUk: {type: string, nullable: true}
            audio: {type: object, additionalProperties: {type: string, format: uri}}
            cefrLevel: {$ref: '#/components/schemas/CefrLevel'}
            frequencyRank: {type: integer, nullable: true}
            examHeat: {type: array, items: {type: object, additionalProperties: true}}
            definitions: {type: array, items: {$ref: '#/components/schemas/Definition'}}
            examples: {type: array, items: {$ref: '#/components/schemas/Example'}}
            relations: {type: array, items: {type: object, additionalProperties: true}}
            rootTopics: {type: array, items: {type: object, additionalProperties: true}}
            confusablePairs: {type: array, items: {type: object, additionalProperties: true}}
            srsState: {$ref: '#/components/schemas/SrsState'}
            contentVersion: {type: string}
    ChunkDetailResponse:
      type: object
      required: [requestId, data]
      properties:
        requestId: {type: string}
        data:
          type: object
          required: [chunkId, canonicalText, meaningCn, contentVersion]
          properties:
            chunkId: {type: integer, format: int64}
            canonicalText: {type: string}
            chunkType: {type: string}
            meaningCn: {type: string}
            usageNote: {type: string, nullable: true}
            scenarioCode: {type: string, nullable: true}
            examples: {type: array, items: {type: object, additionalProperties: true}}
            srsState: {$ref: '#/components/schemas/SrsState'}
            contentVersion: {type: string}
    RootTopicResponse:
      type: object
      required: [requestId, data]
      properties:
        requestId: {type: string}
        data:
          type: object
          required: [rootId, titleCn, nodes]
          properties:
            rootId: {type: integer, format: int64}
            rootCode: {type: string}
            titleCn: {type: string}
            meaningCn: {type: string}
            nodes: {type: array, items: {type: object, additionalProperties: true}}
    LibraryEntryCreateRequest:
      type: object
      required: [itemType, sourceType]
      properties:
        itemType: {$ref: '#/components/schemas/ItemType'}
        vocabId: {type: integer, format: int64, nullable: true}
        chunkId: {type: integer, format: int64, nullable: true}
        expressionId: {type: integer, format: int64, nullable: true}
        sourceType: {type: string, enum: [READING, LISTENING, PRACTICE, MANUAL, SYSTEM]}
        collectionStatus: {type: string, enum: [NEW_WORD, SAVED, MASTERED], default: NEW_WORD}
    LibraryEntryResponse:
      type: object
      required: [requestId, data]
      properties:
        requestId: {type: string}
        data:
          type: object
          required: [entryId, item]
          properties:
            entryId: {type: integer, format: int64}
            item: {$ref: '#/components/schemas/LearningItemRef'}
            collectionStatus: {type: string}
            createdAt: {type: string, format: date-time}
    LibraryPageResponse:
      type: object
      required: [requestId, data, meta]
      properties:
        requestId: {type: string}
        data: {type: object, properties: {items: {type: array, items: {$ref: '#/components/schemas/LibraryEntryResponse'}}}}
        meta: {$ref: '#/components/schemas/PageMeta'}
    EmptyResponse:
      type: object
      required: [requestId, data]
      properties:
        requestId: {type: string}
        data: {type: object, additionalProperties: true}
    ExpressionCreateRequest:
      type: object
      required: [sourceType, sentenceText]
      properties:
        sourceType: {type: string, enum: [READING, LISTENING, SCENARIO, VOCAB_EXAMPLE]}
        sourceRef: {type: string, maxLength: 128}
        sourceContentVersion: {type: string, maxLength: 32}
        sourceAudioRef: {type: string, maxLength: 512, nullable: true}
        sentenceText: {type: string, minLength: 1, maxLength: 5000}
        translationCn: {type: string, maxLength: 5000, nullable: true}
        selectedText: {type: string, maxLength: 1000, nullable: true}
        rangeStart: {type: integer, minimum: 0, nullable: true}
        rangeEnd: {type: integer, minimum: 1, nullable: true}
        wantToSay: {type: boolean, default: false}
        addToSrs: {type: boolean, default: false}
        privateNote: {type: string, maxLength: 2000, nullable: true}
    ExpressionUpdateRequest:
      type: object
      properties:
        wantToSay: {type: boolean}
        privateNote: {type: string, maxLength: 2000, nullable: true}
        addTagIds: {type: array, maxItems: 20, items: {type: integer, format: int64}}
        removeTagIds: {type: array, maxItems: 20, items: {type: integer, format: int64}}
    ExpressionResponse:
      type: object
      required: [requestId, data]
      properties:
        requestId: {type: string}
        data:
          type: object
          required: [expressionId, sourceType, sentenceText, status]
          properties:
            expressionId: {type: integer, format: int64}
            sourceType: {type: string}
            sourceRef: {type: string, nullable: true}
            sentenceText: {type: string}
            translationCn: {type: string, nullable: true}
            selectedText: {type: string, nullable: true}
            wantToSay: {type: boolean}
            tags: {type: array, items: {type: object, additionalProperties: true}}
            srsState: {$ref: '#/components/schemas/SrsState'}
            status: {type: string, enum: [ACTIVE, ARCHIVED, DELETED]}
    ExpressionPageResponse:
      type: object
      required: [requestId, data, meta]
      properties:
        requestId: {type: string}
        data: {type: object, properties: {items: {type: array, items: {$ref: '#/components/schemas/ExpressionResponse'}}}}
        meta: {$ref: '#/components/schemas/PageMeta'}
    SrsBatchCreateRequest:
      type: object
      required: [localDate, timezone, dailyNewTarget, maxDailyReview, scheduleType]
      properties:
        localDate: {type: string, format: date}
        timezone: {type: string, example: Asia/Shanghai}
        dailyNewTarget: {type: integer, minimum: 0, maximum: 100}
        maxDailyReview: {type: integer, minimum: 1, maximum: 200}
        scheduleType: {type: string, enum: [DAILY, CATCH_UP, EXPRESSION]}
    SrsBatchItem:
      type: object
      required: [snapshotItemId, sequenceNo, item, sourceReason, plannedLocalDate, status]
      properties:
        snapshotItemId: {type: integer, format: int64}
        sequenceNo: {type: integer, minimum: 1}
        item: {$ref: '#/components/schemas/LearningItemRef'}
        sourceReason: {type: string, enum: [NEW, DUE, OVERDUE_SMOOTHING, D1_VERIFY, D7_VERIFY, MISTAKE_REPAIR, EXPRESSION]}
        plannedLocalDate: {type: string, format: date}
        dueAtAtSnapshot: {type: string, format: date-time, nullable: true}
        priorityScore: {type: number}
        status: {type: string, enum: [PENDING, IN_PROGRESS, COMPLETED, SKIPPED, EXPIRED, RISK_FILTERED]}
        contentVersion: {type: string}
    SrsBatchResponse:
      type: object
      required: [requestId, data]
      properties:
        requestId: {type: string}
        data:
          type: object
          required: [snapshotId, localDate, status, items]
          properties:
            snapshotId: {type: integer, format: int64}
            localDate: {type: string, format: date}
            timezone: {type: string}
            status: {type: string, enum: [ACTIVE, PARTIALLY_CONSUMED, CONSUMED, EXPIRED]}
            algorithmVersion: {type: string}
            rulesVersion: {type: string}
            items: {type: array, items: {$ref: '#/components/schemas/SrsBatchItem'}}
    ReviewEventRequest:
      type: object
      required: [snapshotItemId, item, rawQuality, answerOutcome, clientEventId, clientOccurredAt, baseStateVersion]
      properties:
        snapshotId: {type: integer, format: int64}
        snapshotItemId: {type: integer, format: int64}
        item: {$ref: '#/components/schemas/LearningItemRef'}
        rawQuality: {$ref: '#/components/schemas/ReviewQuality'}
        answerOutcome: {$ref: '#/components/schemas/AnswerOutcome'}
        responseTimeMs: {type: integer, minimum: 0, maximum: 3600000}
        revealElapsedMs: {type: integer, minimum: 0, maximum: 3600000}
        attemptNo: {type: integer, minimum: 1, maximum: 100}
        clientEventId: {type: string, minLength: 8, maxLength: 96}
        clientOccurredAt: {type: string, format: date-time}
        baseStateVersion: {type: integer, format: int64, minimum: 0}
        answerPayloadHash: {type: string, pattern: '^sha256:[a-f0-9]{64}$', nullable: true}
    ReviewEventResponse:
      type: object
      required: [requestId, data]
      properties:
        requestId: {type: string}
        data:
          type: object
          required: [reviewEventId, eventStatus, riskDecision, stateVersion]
          properties:
            reviewEventId: {type: integer, format: int64}
            eventStatus: {type: string, enum: [ACCEPTED, DUPLICATE, RISK_FILTERED, CONFLICT, REJECTED, EXPIRED]}
            riskDecision: {type: string, enum: [ALLOW, ACCEPT_NO_REWARD, THROTTLE, REJECT, REVIEW]}
            riskAuditId: {type: integer, format: int64, nullable: true}
            effectiveQuality: {$ref: '#/components/schemas/ReviewQuality'}
            reconciled: {type: boolean}
            stateVersion: {type: integer, format: int64}
            srsState: {$ref: '#/components/schemas/SrsState'}
            rewardSettlementStatus: {type: string, enum: [PENDING, SETTLED, NOT_ELIGIBLE, DUPLICATE]}
            nextSnapshotItemId: {type: integer, format: int64, nullable: true}
    ReviewSyncResponse:
      type: object
      required: [requestId, data]
      properties:
        requestId: {type: string}
        data:
          type: object
          required: [results]
          properties:
            results:
              type: array
              items:
                type: object
                required: [clientEventId, status]
                properties:
                  clientEventId: {type: string}
                  status: {type: string, enum: [ACCEPTED, DUPLICATE, RISK_FILTERED, CONFLICT, REJECTED, EXPIRED]}
                  result: {$ref: '#/components/schemas/ReviewEventResponse'}
        meta: {$ref: '#/components/schemas/PageMeta'}
    LearningStreamResponse:
      type: object
      required: [requestId, data]
      properties:
        requestId: {type: string}
        data:
          type: object
          required: [streamId, snapshotId, items]
          properties:
            streamId: {type: string}
            snapshotId: {type: integer, format: int64}
            items: {type: array, items: {$ref: '#/components/schemas/SrsBatchItem'}}
            proportions: {type: object, additionalProperties: {type: integer}}
    SrsStatePageResponse:
      type: object
      required: [requestId, data, meta]
      properties:
        requestId: {type: string}
        data: {type: object, properties: {items: {type: array, items: {$ref: '#/components/schemas/SrsState'}}}}
        meta: {$ref: '#/components/schemas/PageMeta'}
    SrsOverviewResponse:
      type: object
      required: [requestId, data]
      properties:
        requestId: {type: string}
        data:
          type: object
          required: [todayDue, overdue, atRisk, shortTerm, mastered, consolidated]
          properties:
            todayDue: {type: integer, minimum: 0}
            overdue: {type: integer, minimum: 0}
            atRisk: {type: integer, minimum: 0}
            shortTerm: {type: integer, minimum: 0}
            mastered: {type: integer, minimum: 0}
            consolidated: {type: integer, minimum: 0}
            last7DaysMasteryRate: {type: number, minimum: 0, maximum: 1}
~~~

### 8.4 契约实现约束

- Controller 只负责鉴权、参数校验和调用 application service；SM-2、幂等、锁、风控和事务不能写在 Vue 或 Controller 的分支中。
- OpenAPI 的 LearningItemRef 必须生成 Java sealed interface/record 或等价的 Bean Validation 分支；itemType 与 ID 不一致返回 VALIDATION_ERROR。
- 答案字段只出现在服务端判分结果或签名离线包中；内容详情和学习流不会返回 standardAnswer。
- POST /api/v1/learning/srs/reviews:sync 是逐项幂等，不保证整批全成；响应顺序与请求顺序一致。
- 事件命名与 api-conventions.md 一致：domain.action.vN；payload 必须包含 schema、occurredAt、actorId、requestId，消费端按 reviewEventId/clientEventId 去重。

---

## 9. 事件、审计、性能与测试验收

### 9.1 领域事件

本域在同一事务写 lrn_learning_outbox，出站事件至少包括：

| 事件名 | 触发 | 必备业务字段 | 消费者 |
|---|---|---|---|
| vocabulary.wordbook.activated.v1 | 主词书切换成功 | userId、wordbookId、planVersion、requestId | learning/home |
| learning.srs.batch_created.v1 | 排程快照生成 | userId、scheduleSnapshotId、localDate、rulesVersion | learning |
| vocabulary.review.accepted.v1 | 有效 q 已落库 | reviewEventId、srsStateId、stateVersion、effectiveQuality | learning、gamification、report |
| vocabulary.review.filtered.v1 | 风控无奖励/拒绝 | reviewEventId、riskAuditId、decision、rulesVersion | risk、report |
| vocabulary.srs.state_changed.v1 | SRS 投影更新 | srsStateId、itemType、targetId、before/after、algorithmVersion | mastery |
| vocabulary.expression.mined.v1 | 用户创建挖句 | expressionId、userId、sourceType、contentVersion | expression |
| vocabulary.mastery.changed.v1 | D1/D7/90d 状态变化 | srsStateId、oldStatus、newStatus、verificationStage | learning、report |

事件 outbox 至少一次投递；消费者以事件 ID 幂等。XP/Streak 只有在 vocabulary.review.accepted.v1 且 riskDecision=ALLOW 时结算；重复、风控过滤和 pending 事件不得发奖。

### 9.2 权限、隐私与日志

- LEARNER_SELF：读已发布内容、自己的 SRS/收藏/表达；不能读取他人数据、风控证据或标准答案。
- CONTENT_READER：只读已发布内容；批次内容由学习权限二次校验。
- RISK_REVIEW：读取 risk_audit 和脱敏的事件摘要；查看私人备注需要额外敏感权限并写管理员审计。
- 音频和源上下文使用短时签名 URL；日志不得记录手机号、token、私人备注、完整原始答案、原始 IP 或原始音频。
- source sentence 只在 lrn_mined_expression 私有表保存；埋点只记录 textLength、sourceType、contentVersion、hash。

### 9.3 性能、缓存与降级

| 链路 | 目标 P95 | 降级 |
|---|---:|---|
| 词汇/词块详情 | <250ms（不含媒体下载） | 文本和 SRS 摘要先返回，媒体异步 |
| 今日排程快照 | <500ms | 命中当天未过期快照；生成失败返回可读错误 |
| 单事件提交 | <300ms | 超时转 pendingSync，查询幂等结果后再决定 |
| 批量同步单项 | <500ms | 逐项返回，不阻塞后续 item |
| 词族局部拓扑 | <400ms | 最大深度 3、邻接分页、SVG/Canvas |

Redis 仅缓存和互斥辅助，MySQL 为事实源：

~~~text
cache:vocab:detail:{vocabId}:{contentVersion}
cache:chunk:detail:{chunkId}:{contentVersion}
cache:wordbook:{wordbookId}:{contentVersion}
lock:srs:batch:{userId}:{localDate}
lock:srs:state:{userId}:{itemKey}
idem:srs:{userId}:{route}:{idempotencyKey}
rate:vocab:event:{userId}:{minute}
~~~

缓存失效：内容发布/归档按 contentVersion 失效；SRS 更新只失效用户摘要和当日批次状态，不删除历史事件。

### 9.4 测试与验收矩阵

1. 30 项功能：每项至少有 happy path、未发布/无权限、重复提交、断网恢复、内容版本变化和无障碍用例。
2. 算法：q=0/1/2/3、EF=1.30/2.50、n=0/1/2/6/7、间隔锚点、365 上限、HALF_UP、时区/DST/闰日、断签 7/30 天。
3. 属性测试：相同 priorState、q、effectiveAt、algorithmVersion 必须生成相同 JSON；EF 始终在 1.30～2.50，interval 在 1～365。
4. 事务并发：同一 item 20 个并发请求、同一幂等键 20 次、两个设备不同事件、快照 item 重复消费；验证无丢事件、无重复奖励和 stateVersion 单调递增。
5. 数据安全：跨用户 vocab/chunk/expression/snapshot 访问、伪造 target ID、篡改 nextReviewAt/EF、旧 contentVersion、未发布内容、越界挖句均拒绝。
6. 弱网：离线完成 1/20/50 个事件、乱序重试、网络超时后查询幂等键、72 小时边界、超过窗口、批次过期和内容冲突。
7. 跨端：H5、iOS、Android、iPad、微信小程序；Compact/Medium/Expanded；Ultra/High/Medium/Performance；WebGL 丢失、音频失败和横竖屏。
8. 无障碍：键盘 Space/0～3/Esc、读屏、200% 字体、Reduced Motion、色盲对比、拖拽替代、错误焦点和同步状态读出。
9. 可追溯：任一 masteryStatus=MASTERED/CONSOLIDATED 能追到 D1/D7 review_event、schedule_snapshot、contentVersion、algorithmVersion、risk_audit 和 requestId。

---

## 10. Definition of Done

1. FEAT-VOC-001～030 均有目标、前置、主流程、异常/边界、验收与埋点，且埋点不采集私人内容。
2. OpenAPI 3.0.3 通过解析校验，可生成 Spring Boot 4.1 DTO/Controller 接口与 Vue 3/uni-app TypeScript 类型；无裸 any。
3. MySQL DDL 覆盖词汇、释义、例句、词块、挖句、统一 SRS、复习事件、排程快照、风控审计和出站事件，CHECK/UNIQUE/索引/外键语义已评审。
4. SM2_Q03_V1、逾期平滑、D1/D7 延迟复测、幂等、行锁、弱网和风控有单元、集成和端到端测试。
5. Phase 1 不调用 AI、向量检索或实时发音评分；后续能力必须通过独立服务、版本化 Schema、超时降级和合规审核接入。
6. 迁移上线前同步 requirements、learning 域 API 适配、CHANGELOG 和运行说明；本文件不以“建议”替代可执行契约。
