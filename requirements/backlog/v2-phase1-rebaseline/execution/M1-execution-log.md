# M1 统一执行日志

更新时间：2026-08-31（Asia/Shanghai）。本记录随实际状态推进，不继承旧 B/DEV/G Evidence。

## 当前任务

- `P1R-M1-001` 至 `P1R-M1-014` 均为 `ACCEPTED`；各自原实现源、完成时间、reviewer 与兼容基线保存在 canonical manifest `provenance`。M1-014 已把 M1-001..009、011..013 的共享制品重新绑定到 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d`，并在 C/D 阶段完成 M1-010 的唯一摘要绑定，不重写旧任务实现成果。
- `P1R-M1-010`：`ACCEPTED`；不可变来源检查点 `760621e45b9adc95a6aa40fb1678a8d3ebc87797`，原最终源码 `cd92378bd8ba0c57c920fc6e79db52de717b0b05`，Evidence `evidence/p1r/m1/P1R-M1-010/manifest.json`；post-C D 阶段已把其 current-source manifest 与全部 artifactDigests 绑定至 `36a2103b0dc9497a6421bbbf99627e10c7a88c50`，审计实现源为 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d`；原复审 P1/P2 为 `0/0`。
- `P1R-M1-011`：`ACCEPTED`；不可变来源检查点 `14da16c00add0c2cbcd0cb53ec141b1c4d2b0fe1`，最终源码 `daa543b369c0e369a8f70e2f79278eb934ff9a09`，Evidence `evidence/p1r/m1/P1R-M1-011/manifest.json`；独立 reviewer `agent:m1_011_independent_review:gpt-5.6-luna:max` 最终接受，P1/P2 为 `0/0`。
- `P1R-M1-012`：`ACCEPTED`；不可变来源检查点 `270b0dfbf8dbec1329b8dc7036ee3e7490a8ffb3`，最终源码 `aac5c3462e01f3b3bec34bb13e7cd9f74ff34f72`，Evidence `evidence/p1r/m1/P1R-M1-012/manifest.json`；独立 reviewer `agent:m1_012_independent_review:gpt-5.6-luna:max` 接受，P1/P2 为 `0/0`。
- `P1R-M1-013`：`ACCEPTED`；不可变来源检查点 `a07a58a7d245295c54d39487a6669545d077c513`，原最终源码 `a7f92095323f2afc4e6d28eeaff977e2197fcd0c`，独立 reviewer `agent:m1_013_evidence_plan:gpt-5.6-terra:max` 判定 `ACCEPT`，P1/P2 为 `0/0`；M1-014 已在 aab1 完成 current-source revalidation。
- `P1R-M1-014`：`ACCEPTED`；不可变来源检查点 `e3514c359e6f6be5445cf46a7734325b2835b941`，最终源码 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d`，独立 reviewer `agent:m1_014_final_review:gpt-5.6-luna:max` 判定 `ACCEPT`，P1/P2=`0/0`；冻结可信完成白名单、不可变奖励账本、P0 游戏 catalog、受控社交空间与 lease/focus/leaderboard/moderation 的 D2 契约。
- C/D 阶段 revalidation 保留旧任务原始 provenance/reviewHistory，并追加 M1-014 current-source 链；`P1R-M1-010` 的原 a7 来源已归档为历史，其 post-C binding 已在 `36a2103b0dc9497a6421bbbf99627e10c7a88c50` 完成。
- M1-006 修改了共享契约、CI 与文档制品，因此 `P1R-M0-005`、`P1R-M1-001` 至 `P1R-M1-005` 的 manifest 已在不覆盖原始 provenance 的前提下绑定 `3e4ba856...` 完成 current-source revalidation；原实现源、原完成时间、原 reviewer 和原 compatibility baseline 仍保留在各自 `provenance`。
- M0 供应链阻塞不在 M1-001 显式依赖内，但继续禁止发布与“M0 全绿”声明。

## M1-006 执行与结果摘要

1. 事件治理源：冻结 canonical/historical/deprecated 分类、producer/data owner、consumer group、topic、aggregate partition key、payload schema 与兼容策略；RabbitMQ/Redis Streams 只能保留历史标记。
2. 生成与失败关闭：从同一目录生成 AsyncAPI channel、send/receive operation 与 Kafka binding，并让 merge/generate/validate/compatibility 对治理字段缺失、漂移、重复 owner 和非法 transport 失败关闭。
3. 对抗测试与独立终验：覆盖未知事件、伪造 producer/consumer、无订阅 operation、topic/partition 漂移、UI telemetry 混入领域总线、敏感 payload 和静态结果冒充 runtime 等负例。

统筹 Agent 独占共享生成物、命令入口、状态、Evidence、提交与远程推送。

- 终验结果：`3e4ba856742f28ba9d3fc4a3264c4b24c1cafc5a` 的 dual-baseline compatibility、fragment/payload 完整性、B26 exact binding、generated `schemaVersion` 和 CI guard 由独立 reviewer 接受；P1R `186/186`、B26 `26/26`、merge/generate/validate 与 Git compatibility 均通过。
- D2 边界：输出仍为 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`；B26 为 `static-only`、`runtimeStatus=pending`、`defaultDecision=NO-GO`。Outbox/dedupe/retry/DLQ/replay/Saga 的完整可靠性语义已由 `P1R-M1-007` 另行冻结；真实 owner schema/事务、Kafka 投递与故障回放、Saga/人工恢复运行闭环仍分别由 `P1R-M2-004/005/006` 验收，`P1R-M0-006` 继续 `BLOCKED`。

## M1-007 执行与结果摘要

1. Outbox 与消费可靠性：冻结事务边界、状态迁移、lease/ack、幂等去重、原子 effect/receipt、重试预算、DLQ 原始关联和有序处理。
2. Replay、Saga 与人工恢复：冻结 immutable source、同 consumer path、审批分离、补偿 owner、禁止跨库写、恢复任务和关闭回执。
3. Schema 与失败关闭：建立 canonical D2 policy、JSON Schema/生成物、B26 历史候选交叉检查和对抗变异测试；所有输出保持 `NOT_RUNTIME_VERIFIED`。

- 三轮 REWORK：初始 `64b5f96` 的危险 Saga/recovery 迁移、root/causation、错误路由和 Schema 条件缺口由 `ce3e3bb/12ab943/93d75d7` 收口；随后发现 G1 5↔13 schemas 回归与 event compatibility 未知字段注入，由 `a6cdb51` 修复；最后发现独立 reliability Gate 可绕过 7 类 event governance 字段且 Outbox `PUBLISHED` 可接受 `attempt=0`，由 `6ce98a9` 接入完整治理校验并约束 attempt。中间评审精确时刻未单独持久化，不补造时间。
- 终验结果：专项 reliability `78/78`、`test:p1r` `276/276`、G1 `6/6`（13 schemas），contracts、typecheck、event/Saga audits 均 PASS；最终源码 P1/P2 `0/0`，独立 reviewer 结论 `ACCEPT`。
- D2 边界：canonical manifest 为 `evidence/p1r/m1/P1R-M1-007/manifest.json`；B26 继续 `static-only` / `runtimeStatus=pending` / `defaultDecision=NO-GO`。真实 owner schema/事务/lease 归 M2-004，Kafka/Outbox/consumer/DLQ/replay 归 M2-005，Saga/补偿/审批/人工恢复/审计运行闭环归 M2-006；M0-006 继续 `BLOCKED`，不得放行发布。
- 下一任务：M1-007 Evidence/台账关闭提交 `18d7d38` 已推送并核对，`P1R-M1-008` 已按状态机启动；来源检查点不随工作树移动。

## M1-008 执行轨道

1. 内容 lifecycle 与命令边界：统一 B9 外部 command，关闭旧直连生命周期入口的外部授权语义，固定版本、校验、双审、发布、下线和回滚状态机。
2. 排期与投影：固定带时区的排期任务、取消/失败恢复、幂等与审计关联，并冻结 public/learner allow-list、版本 pin、projectionVersion 与 contentEpoch。
3. 事件与失败关闭：把 content lifecycle 的 canonical 事件、producer/consumer/topic/partition/schema 与 M1-006/007 治理接通，补契约 policy、生成物、兼容和对抗测试。

统筹 Agent 负责统一模型、共享生成物、状态、Evidence、提交与推送。M1-008 只产生 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED` 结论；真实 owner 数据/Outbox、Kafka 投递和排期/Saga/投影运行验证继续归 M2-004/005/006 与后续内容实现/E2E 任务。

## M1-008 执行与结果摘要

1. 内容命令与审核：冻结 11 个 B9 canonical command、服务端权威 actor/tenant/owner、expected state/version、幂等与审计；reviewRecords 是只读、闭合、绑定 `contentVersionId/contentHash` 的阶段键控集合，只允许 empty、FIRST-only 或 FIRST+FINAL。
2. 排期、投影与版本 pin：冻结 5 个排期状态和到期复核清单，公开/学习投影 allow-list、`projectionVersion/contentEpoch`，以及 B10 active pin、紧急不可用和 future-only fallback。
3. 事件与生成工具：5 个 content lifecycle 事件进入 canonical 事件治理；composed OpenAPI 生成 TypeScript 保留公共字段、root/branch required、必填 discriminator 和可表达的 `not`→`never`，并用编译期负例覆盖 11 个 command 与 B10 pin/recovery。

- 三轮 REWORK：`abcf688` 的 retirement/B1 replay/到期复核/B26 文档问题由 `6e8838d` 修复；`6e8838d` 的审核版本/hash/阶段和 reviewed event 身份缺口由 `6fb785e` 修复；`6fb785e` 的生成类型语义回归由 `e05c774` 修复。中间评审精确时间没有独立持久化，不补造。
- 终验结果：tooling `27/27`、lifecycle `6/6`、P1R `296/296`、workspace typecheck `7/7`，contracts merge/generate/validate、event governance/reliability、Gateway、B26 static、CI/plan/diff 和两组固定 compatibility 均 PASS；三位 reviewer 一致接受，P1/P2 `0/0`。
- D2 边界：B26 仍为 `static-only` / `pending` / `NO-GO`；M2-004 验证真实 owner 数据/事务，M2-005 验证 Kafka/Outbox/consumer，M2-006 验证调度/Saga/人工恢复；M0-006 继续 `BLOCKED`，完整历史 G 仍仅既知 G0/G3 两项失败。

## M1-009 执行轨道

不可变来源检查点：`dev@ca282cd00dabeeb3fafbf6b4570054bd5b9f8549`。

1. 业务与设计边界：映射 SPK `0159…0188`、适用 INF `0405…0460`、`INT-P1-005/006` 和媒体后台/学习旅程，冻结媒体、内容、assessment 的事实 owner 与失败恢复。
2. 契约与工具：收敛历史 B1/B3/B11 媒体/录音候选，冻结 upload intent、处理任务、rendition、字幕、短时访问、录音与规则化跟读 D2 契约，并建立精确兼容投影。
3. 安全与对抗：冻结服务端权威身份/同意/版权、对象完整性、短时 URL、录音隐私、保留策略引用、Phase 1 无 ASR/AI/RTC 和 `0.5x–2.0x` 保音高能力；以失败关闭变异测试验证。

统筹 Agent 负责统一模型、公共生成物、状态、Evidence、提交和推送；三条执行轨道仅使用 Terra Ultra 或 Luna Max。M1-009 只允许形成 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`，不修改或冒充真实对象存储、转码 worker、字幕生成、数据库、Kafka、浏览器/设备和跨进程运行证据。精确保留/删除期限仍由 `P1R-M1-017` 冻结，M2-004/005 继续负责真实 owner 存储与事件运行验证。

## M1-009 执行与结果摘要

1. 媒体与录音契约：冻结 14 个 canonical route、30 个 closed schema、media/content/assessment/IAM owner、upload/complete/task/retry、metadata-only manifest、短时 grant、成人录音 consent 与规则化 Shadowing。
2. 安全与失败关闭：冻结 server-bound identity、CLEAN/rights/publish Gate、exact TEXT+PRACTICE fallback、M1-007 retry/DLQ、M1-017 retention ref/delete receipt，以及 Phase 1 无 ASR/AI scoring/generative AI/digital human/RTC。
3. 兼容与生成：B1/B3/B11 旧入口结构化弃用或原路径收敛；11 个旧事件保持 historical-only；M1-008→M1-009 精确 OpenAPI promotion、生成 TypeScript、Gateway projection 与对抗测试共用同一政策源。

- 终验结果：媒体专项 `45/45`、tooling `31/31`、P1R `345/345`、workspace typecheck `7/7`，contracts merge/generate/validate、IAM/Gateway/data/content/event/reliability、B26 static、CI/plan/diff 与固定 compatibility 均 PASS；独立 Luna Max reviewer 接受 `2e7304a`，P1/P2 `0/0`。
- 已知非本任务问题：完整历史 G 保持 `39/41`；direct API audit 的 B9 content-publish-task envelope 缺口在 `ca282` 已存在。两项均记录但未伪装为全绿。
- D2 边界：B26 继续 `static-only` / `pending` / `NO-GO`；真实对象存储、扫描/转码/字幕 worker、数据库、Kafka、浏览器/设备、精确保留/删除分别归 M1-017、M2-004/005/006 与 M3/M5/M8，M0-006 继续 `BLOCKED`。

## M1-010 执行轨道

不可变来源检查点：`dev@760621e45b9adc95a6aa40fb1678a8d3ebc87797`。

1. 业务与状态边界：映射 ASM `0215…0266`、`JNY-P1-04/06/08/09`、`RULE-P1-SESSION/REPORT` 与 `INT-P1-004/006`，冻结 session/checkpoint/attempt/report 的 assessment owner、不可变内容/规则 pin 和失败恢复语义。
2. 契约与兼容：修复 B10 assessment OpenAPI 与必要的 assessment producer 事件，固定单调 checkpoint、submissionDigest、客观 outcome、幂等 replay/conflict、报告版本与 learner-safe 输出；公共生成物和兼容投影由统筹统一合并。
3. 安全与失败关闭：拒绝客户端 tenant/owner/score/rule authority，禁止答案密钥、原始作答和敏感输入进入事件/日志/普通审计；覆盖旧版本、重复/乱序、自动提交、失败报告、主观输入无 AI 评分和字段注入等对抗用例。

统筹 Agent 负责统一模型、共享生成物、状态、Evidence、提交与推送；执行 Agent 只使用 Terra Ultra 或 Luna Max。M1-010 不完成 placement manifest/Saga（M1-012）、learning 的 SRS/mastery/report watermark（M1-013）、真实 owner 数据与 Outbox（M2-004）、Kafka（M2-005）、Saga/runtime（M2-006）或浏览器/E2E；所有结论保持 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`，M0-006 继续 `BLOCKED`。

## M1-010 执行与结果摘要

1. 契约与状态：冻结 5 个 canonical assessment route、8 个 session 状态、4 个 attempt 状态和 4 个 report 状态；session、checkpoint、attempt、outcome 与 report 分层，内容/规则/报告版本和服务端权威字段失败关闭。
2. 安全与恢复：六类答案分支使用单一 discriminator；原始作答仅进入受保护 owner 边界，审计精确脱敏 `responseDigest`、五类 raw 字段与 checkpoint `protectedDraft`；幂等 replay/conflict、单调 checkpoint、自动提交和 learner-safe 报告均有对抗测试。
3. 兼容与生成：B2/B10 历史入口显式 adapter/deprecation，assessment 事件保持 historical-only，不伪造 AsyncAPI/B26 晋升；OpenAPI、API client 和 TypeScript 生成物与两组不可变 compatibility baseline 一致。

- 一轮 REWORK：初始 `3bfc63d` 的 submit/checkpoint 脱敏路径仍引用旧 `.response`，且 `ASSESSED.assessedAt` 可为 null；`cd92378` 用精确 raw 字段清单、旧路径禁止规则、非空终态时间与生成类型 null 负例闭合。独立 Luna Max reviewer 随后接受，P1/P2 `0/0`。
- 终验结果：assessment `83/83`、CLI `77` cases、P1R `433/433`、tooling `35/35`、workspace typecheck `7/7`，contracts merge/generate/validate 与固定 compatibility 均 PASS；canonical 为 386 operations、601 schemas、154 events、104 payload schemas、12 AsyncAPI channels、45 operations、13 JSON Schemas。
- 已知非本任务问题：完整历史 G 保持既知 G0/G3 两项 stale marker 失败；direct API audit 保持既存 B9 content-publish-task 200 envelope 缺口。两项均未由 M1-010 引入，也没有被伪装成全绿。
- D2 边界：`EVENT-GAP-BIND-ASM-001` 仍开放；placement/Saga 归 M1-012，learning SRS/mastery/report watermark 归 M1-013，真实 owner schema/Outbox、Kafka、workflow runtime 分别归 M2-004/005/006；B26 继续 pending/NO-GO，M0-006 继续 `BLOCKED`。

## M1-012 执行轨道

不可变来源检查点：`dev@270b0dfbf8dbec1329b8dc7036ee3e7490a8ffb3`。

1. Placement manifest 与结果：冻结 `P1_PLACEMENT_V1` 的四维题目覆盖、维度权重、计分/等级边界、覆盖与置信度、内容/规则 pin、同 session 恢复、完成后报告不可变和 skip=`UNVERIFIED`，客户端不得提交答案、得分、等级或推荐结论。
2. Canonical completion event：assessment-service 仅在首个持久化完成结果后发布唯一 completion fact；event payload 绑定 learner/session/report、manifest/result/内容版本、置信度与根因关联，消费者、group、topic、partition、schema 和兼容策略由 M1-006 治理失败关闭。
3. Placement→plan Saga：workflow-service 只负责重试、去重、补偿与人工恢复；learning-service 基于同一 placement/target/planning-input pin 幂等生成计划。重复、乱序、回放或计划失败不得创建第二份计划或修改 assessment 报告，客户端不得重算分数或触发跨 owner 写入。

统筹 Agent 负责统一模型、公共生成物、兼容投影、状态、Evidence、提交和推送；执行 Agent 只使用 Terra Ultra 或 Luna Max。M1-012 不实现真实 owner schema/事务/Outbox、Kafka topic/ACL/delivery、workflow Saga runtime、浏览器或 E2E；结论只能是 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`，B26 继续 pending/NO-GO，M0-006 继续 `BLOCKED`。

## M1-012 执行与结果摘要

1. 定级规则与不可变结果：冻结四维 `3/3/2/2` 共 10 题、各 25%、正误二值计分、耗时只作解释、覆盖/置信度、rounding 与 A1–C2 六段边界；首次完成 result/report 不可变，skip 只能产生 `SKIPPED + UNVERIFIED`。
2. 契约、事件与 Saga：五条 B10 placement route 为 canonical，五条 B1 route 只作 deprecated adapter；唯一 canonical `assessment.placement.completed.v1` 绑定 assessment owner、workflow/learning consumer、topic/partition/payload，并冻结 placement→plan 去重、乱序、补偿和跨 owner 禁止边界。
3. 生成类型与兼容：B9 READY `tasks` 生成非空 tuple，`degradedReason` 为唯一命名；B10 result/event 分支保持 narrowing。两条固定 baseline 和完整 promotion projection 对额外 route/schema/event/channel/B26 绑定失败关闭。

- 终验结果：placement `141/141`、P1R `746/746`、B26 `27/27`、tooling `46/46`、typecheck `7/7`；contracts merge/generate/validate、两条固定 compatibility、assessment/planning/event/reliability/Gateway/Saga、plan/CI/diff 均 PASS。独立 Luna Max reviewer 接受 `aac5c346...`，P1/P2=`0/0`。
- 已知历史边界：core-api、B25 和 learner-web 仍保留旧 4/3/3、耗时加权、精确词汇量或 FAST_TRACK 候选逻辑；它们没有被本任务晋升为 canonical/runtime，后续实现不得直接复用为 `P1_PLACEMENT_V1`。
- D2 边界：结果只为 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`；真实 owner schema/Outbox、Kafka、Saga/人工恢复分别归 M2-004/005/006，计划算法/SRS/mastery/watermark 归 M1-013，B26 继续 pending/NO-GO，M0-006 继续 `BLOCKED`。

## M1-013 执行轨道

不可变来源检查点：`dev@a07a58a7d245295c54d39487a6669545d077c513`。

1. 规则模型：冻结 `P1_DAILY_PLAN_V1` 候选/稳定排序/预算/积压/解释，`SM2_Q03_V1` 公式与 outcome cap，repair/D1/D7、mastery Gate、report numerator/denominator/watermark 与时区/离线顺序。
2. 契约与事件：盘点 B1/B2/B9/B10 计划、today、SRS、错题、mastery、报告和同步入口，确定单一 canonical 写路径、服务端 authority、owner/event/payload 和历史 adapter/deprecation。
3. 兼容与失败关闭：延续 M1-008..012 source-bound promotion，不移动不可变基线；建立结构化 policy、checker、生成类型和 unknown-field/版本/乱序/DST/双写/runtime-promotion 对抗测试。

三条轨道先只读形成统一设计，再由统筹分配互斥文件实施；执行 Agent 只使用 Terra Ultra 或 Luna Max。M1-013 不实现真实 schema/Outbox/Kafka/worker/Saga、六技能页面、浏览器离线数据库或 E2E；所有结论保持 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`，B26 继续 pending/NO-GO，M0-006 继续 `BLOCKED`。

## M1-013 执行与结果摘要

1. 规则模型：冻结 `P1_DAILY_PLAN_V1` 的稳定排序、预算、积压与解释，`SM2_Q03_V1` 的公式与 outcome cap，repair/D1/D7、mastery Gate、report numerator/denominator/watermark，以及时区、DST 和离线顺序。
2. 契约与事件：冻结 plan/today/task/session owner、版本和 pin，assessment 与 learning 的单一事实边界，唯一 SRS 写入口、历史 adapter/deprecation、服务端 authority、事件治理和恢复引用。
3. 兼容与失败关闭：以 `a07a58a7d245295c54d39487a6669545d077c513` 为 checkpoint、`a7f92095323f2afc4e6d28eeaff977e2197fcd0c` 为最终源码，完成 unknown-field、版本、乱序、DST、双写与 runtime-promotion 失败关闭检查。

- 终验结果：learning `67/67`、tooling `50/50`、P1R `818/818`、workspace typecheck `7/7`；contracts `401 operations/646 schemas/158 events/108 payload schemas/17 AsyncAPI channels/60 operations/13 JSON Schemas`；fixed compatibility、Gateway、event、reliability、B26、plan、CI、diff 均 PASS。
- 独立 reviewer：`agent:m1_013_evidence_plan:gpt-5.6-terra:max` 判定 `ACCEPT`，P1/P2=`0/0`；Evidence：`evidence/p1r/m1/P1R-M1-013/manifest.json`。
- D2 边界：结果仅为 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`；B26 继续 `static-only` / `runtimeStatus=pending` / `defaultDecision=NO-GO`，`P1R-M0-006` 继续 `BLOCKED`，真实 schema/Outbox/Kafka/worker/Saga、浏览器/设备和 E2E 未验证。
- 历史 M1-013 Evidence/台账关闭集成提交：`c9a67577db590b92982571a1aecba6200adcb9cf`。当前台账为 `21 ACCEPTED / 1 BLOCKED / 0 IN_PROGRESS / 86 PLANNED`；M1-014 已接受，下一推荐任务为 `P1R-M1-015`。

## M1-014 执行轨道

不可变来源检查点：`dev@e3514c359e6f6be5445cf46a7734325b2835b941`。

1. policy-model：冻结 `P1_REWARD_POLICY_V1`、source whitelist、不可变 ledger/补偿、P0 `SENTENCE_TRAIN` catalog，以及 `PUBLIC_THEME_ROOM`、`INVITE_STUDY_ROOM`、`CHECKIN_GOAL_GROUP` 三类空间和服务端 authority。
2. contract-event：收敛 B4/B12 历史 route/schema，建立 canonical GAM/SOC OpenAPI 与 v2 事件治理、producer/consumer/topic/partition/lineage；旧 v1 与 notification 继续 historical-only。
3. validation-compat：建立专用 checker、对抗测试、B4/B12 canonical projection 测试、B26 static binding、source-bound compatibility 与 generated TypeScript 边界。

三条实施轨道必须保持文件互斥，公共生成物、catalog projection、compatibility、状态、Evidence、最终提交和推送由统筹 Agent 独占。M1-014 不实现真实数据库、Outbox/Kafka consumer、WebSocket/Redis lease、页面或 E2E；所有结论保持 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`，B26 继续 pending/NO-GO，M0-006 继续 `BLOCKED`。

- 最终验收：`aab1fa24bb7d46e3dd730fe3801ab2e986301e0d` 经 `agent:m1_014_final_review:gpt-5.6-luna:max` 独立终验 `ACCEPT`，P1/P2=`0/0`；Evidence 为 `evidence/p1r/m1/P1R-M1-014/manifest.json`。
- 结果：专项 checker 28/28 canonical routes、10/10 canonical events，定点 contract/generated-types 测试 161/161 通过；三项 GAM/SOC GAP 关闭为 D2 静态治理，不作为 topic、ACL、Outbox、consumer、lease 或 E2E runtime 证据。
- D 阶段：M1-010 全量摘要已在 GAP/Evidence 集成检查点 `36a2103b0dc9497a6421bbbf99627e10c7a88c50` 重算并绑定；aab1 仍是 M1-014 审计实现源。后续全局 Evidence Gate 仅待干净、已提交工作树验证。
- 边界：`D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`；B26=`static-only`/`pending`/`NO-GO`；M2-004/005/006、M5-013、M7、M8-005 与 M0-006 仍保留原 owner 和状态。

## M1-011 执行轨道

不可变来源检查点：`dev@14da16c00add0c2cbcd0cb53ec141b1c4d2b0fe1`。

1. 业务与 owner 边界：映射 ONB `0001…0022`、USR、`JNY-P1-03/05` 与 `INT-P1-003`，冻结 learner-service 的 profile/target/首日只读投影、learning-service 的计划输入/计划 owner、workflow-service 的恢复任务边界。
2. 契约与兼容：收紧 B9 profile/target/first-day 契约，固定 5/15/30/45、target/profile version、CAS/幂等、planning-input pin、水位、失败状态与 learner-safe recovery query；旧 B1 onboarding 只保留结构化 adapter/deprecation。
3. 事件与失败关闭：先消除 `EVENT-GAP-ONB-001` 的文档复用歧义，再按 M1-006 治理要求决定目标/首日 D2 producer-consumer 绑定；任何未形成完整绑定的历史事件继续 historical-only，placement 完成事件归 M1-012。覆盖客户端 authority 注入、版本错配、空任务伪装成功、恢复任务越权与 D2 runtime 冒充。

统筹 Agent 负责统一模型、公共生成物、状态、Evidence、提交和推送；执行 Agent 只使用 Terra Ultra 或 Luna Max。M1-011 不完成 placement manifest/结果及 placement→plan Saga（M1-012）、计划算法/SRS/mastery/watermark（M1-013）、真实 owner 数据与 Outbox（M2-004）、Kafka（M2-005）、Saga/runtime（M2-006）或浏览器/E2E；所有结论保持 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`，M0-006 继续 `BLOCKED`。

## M1-011 执行与结果摘要

1. Learner 与并发边界：冻结 10 个 canonical route、四个 goalCode exactly-once、`5/15/30/45`、profile/target/preferences 版本、十进制 `If-Match` 与 expectedStateVersion 精确相等、同键同载荷 replay 和同键异载荷 409。
2. Planning 与首日投影：planning input 使用服务端聚合 eligibility version/digest，不接收 raw adult Gate/consent/policy/rights；first-day 固定 `NOT_READY/PROCESSING/READY/DEGRADED`，READY 非空、DEGRADED 唯一 `degradedReason`，recovery 只读且按主体绑定。
3. 兼容与事件：B1 onboarding 仅为 adapter/deprecation，未知目标或缺失 canonical snapshot 返回 422；`learner.target.updated.v1` 是本任务唯一 canonical D2 事件，其余 learner 事件继续 historical-only。

- 一轮 REWORK：初始 `5b6a3d5` 经独立 Luna Max 复核后补齐 eligibility authority pin、goal exactly-once、If-Match/幂等、目标事件 allow-list 与 legacy mapping；最终 `daa543b` 复审 `ACCEPT`，P1/P2=`0/0`。
- 终验结果：learner planning CLI 10 routes/145 cases、定点 150/150、tooling 40/40、P1R 589/589、typecheck 7/7；contracts merge/generate/validate、固定 compatibility、IAM/Gateway/data/event/reliability/B26 static、plan/CI/diff 均 PASS。
- 类型边界：生成 TypeScript 保留公共/分支 required、discriminator 和可表达的 `not -> never`；READY 数值/数组基数由 OpenAPI/checker 负责，未冒充 TypeScript 编译期完整 JSON Schema 校验。
- D2 边界：B26 继续 `static-only/pending/NO-GO`，真实 owner schema/Outbox、Kafka、placement/Saga、浏览器/E2E 分别归 M1-012/M1-013/M2-004/005/006 与后续任务；M0-006 继续 `BLOCKED`。

## M1-003 执行轨道

1. IAM 权限契约：只修改 B8 OpenAPI 源，冻结 principal、成人 Gate、consent、tenant、RBAC/ABAC、admin policy 生命周期与内部 PEP/PDP 输入输出。
2. 失败关闭校验：只新增 M1-003 结构化审计/测试与命令入口，覆盖客户端伪造 authority、缺失 owner/tenant、默认拒绝、成人/同意限制、双人审批、撤销和缓存失效。
3. 设计一致性：只对齐 ADR-0010、安全边界和契约说明，明确控制面、服务本地 PEP、远程 PDP 触发条件与 fail closed 语义。

统筹 Agent 独占公共生成物、兼容基线、状态、Evidence、提交与远程推送。运行期 IAM、领域服务 PEP、真实数据库与 Gateway 仍分别属于 M2-002/M2-003/M1-004。

实际调度：`m1_003_policy_contract`（Terra Ultra）完成权限契约源；根级线程上限阻止另外两名执行 Agent 启动，因此 `root-coordinator` 在互斥文件边界内接管失败关闭审计和设计一致性；`m1_003_final_review`（Luna Max）只读独立终验。没有调用模型未知的历史 Agent，也没有把未启动轨道记录成已完成。

## M1-002 执行轨道

1. IAM 契约源：只修改认证 OpenAPI 源，拆分 Web Cookie 与原生安全存储请求/响应，并固定 RS256/JWKS、轮换、重放、撤销和错误语义。
2. 失败关闭校验：只修改 P1R 认证审计/测试，拒绝混合凭据、弱化 Cookie、可变算法或不完整错误契约。
3. 设计一致性：只修改 ADR-0013 与契约说明，明确 transport profile、discriminator 和会话终止边界；只读确认生成设计文档已无 OAuth client/redirect 与“禁止密码直登”冲突。

统筹 Agent 独占 canonical 合并、生成物、台账、状态轨迹、Evidence、最终提交和远程推送。三个执行 Agent 分别为 `m1_002_auth_contract`（Terra Ultra）、`m1_002_auth_audit`（Luna Max）和只读终验 `m1_002_final_review`（Terra Ultra）；因根级线程名额和公共合约依赖采用顺序调度，没有使用模型未知的历史 Agent。

## M1-001 结果摘要

- canonical API：367 operations / 486 schemas；317 个 JSON 2xx 与 385 个标准错误响应通过公共语义检查。
- 幂等：165 个外部写，164 个 required，1 个具名 signed-access 例外。
- 分页：58 个 `list*` + 2 个已有 Cursor 操作统一为 cursor；P1R 34/34。
- 兼容：以 `4d7f73a867ff3e1db8582eab7593c173625bc8a3` 为不可变基线，OpenAPI/events/schema 均 0 breaking。

## M1-002 结果摘要

- 认证传输：`WEB_COOKIE` 与 `NATIVE_SECURE_STORAGE` 使用具名请求/响应 schema 和 `data.authTransport` discriminator；生成客户端不再暴露可选 Refresh Token 的混合响应。
- 会话安全：固定短时 RS256、RSA JWKS、`kid`/缓存/轮换/重叠与 unknown-kid fail closed；固定 rotation、reuse/replay、family/session revoke、logout、reset 和清 Cookie 语义。
- 契约工具：新增 `p1r:auth-contract:check` 与 10 个失败关闭测试；canonical 计数为 367 operations / 497 schemas，Git baseline 0 breaking。
- 验证：P1R 44/44、B8 29/29、G1 6/6；完整 G 的 G0/G3 两项旧 source marker 失败经独立评审确认不由本任务引入。

## M1-003 结果摘要

- 权威上下文：principal、tenant、role/permission 由 IAM 派生，resource owner/content rights 由领域 owner 提供；客户端 authority 字段不能放大权限。
- 准入与授权：成人 Gate、required consent、RBAC+ABAC、默认拒绝、本地 PEP/远程 PDP、可信服务身份和异常 fail closed 已形成严格契约。
- 策略治理：新增 8 个控制面操作和 1 个结构化 PDP 操作，覆盖 draft/submit/独立 approve/activate/revoke、职责分离、审计、幂等和缓存失效。
- 契约工具：新增 `p1r:iam-policy-contract:check` 与 13 个失败关闭测试；canonical 计数为 377 operations / 536 schemas，Git baseline 0 breaking。
- 验证：P1R 57/57、B8 29/29、G1 6/6；独立 Luna Max 评审接受最终源。完整 G 仍是既有 39/41，D2 不替代 M2 运行实现。

## M1-004 执行与结果摘要

1. Gateway policy：`root-coordinator` 负责 route/Origin/Cookie/JWT/rate/error/audit/direct-connect 合同源、canonical 合并和设计对齐。
2. 失败关闭校验：`m1_003_policy_contract`（Terra Ultra）负责专项审计和 15 个变异测试；因根级历史线程占用，未启动模型未知的历史 Agent。
3. 独立终验：`m1_003_final_review`（Luna Max）只读复核实现源并给出 `ACCEPT`，范围严格限定在 D2。

- 路由所有权：52 条 rule 唯一覆盖 326/326 public operations；0 未匹配、0 等优先级冲突；51/51 internal operations 外部 `DENY`。
- 安全合同：精确 Origin、credentialed CORS 无 wildcard、Cookie CSRF/Origin/Referer、native secure storage、RS256/JWKS、具名 rate class、429 `Retry-After`、统一错误、关联 ID、脱敏审计和直连阻断均有正反例。
- 验证：Gateway 15/15、P1R 72/72、B7 28/28、B8 29/29、G1 6/6；merge/generate/validate/typecheck PASS；相对 `e5110f2` 的 OpenAPI/events/schema 兼容均 0 breaking。
- 未越界：真实 WebFlux 安全、public-path、Redis 限流、持久审计、网络隔离和跨进程 Evidence 仍归 `P1R-M2-001`；完整 G 保持既有 39/41，M0-006 仍 `BLOCKED`。

## M1-005 执行与结果摘要

1. 数据政策源：新增当前 P1R 机器可读 owner 矩阵，覆盖 Gateway 无业务 schema 边界、IAM、audit/workflow 平台 owner 和 11 个 Phase 1 领域 owner；明确 schema/凭据/Flyway/Redis/tenant/retention/删除与回滚责任。
2. 静态失败关闭：验证 owner/schema/namespace 唯一、Gateway/core-api 禁止新写、迁移命名与责任、跨服务写/join/shared ORM 禁止，以及旧 Redis/B25 候选映射不能被误判为当前运行事实。
3. 设计一致性：只对齐数据所有权、迁移和保留边界；空库、存量库、owner grants、Redis 重建、tenant 负例和回滚仍须由 `P1R-M2-004` 提供真实运行 Evidence。

- 政策基线：15 个服务、14 个 data owner；Gateway 无业务 schema、数据库凭据、Flyway 和领域写权限；12 个现有 migration 候选、2 个 M2-004 计划集合、29 个 Redis 条目、8 个 M2 运行缺口。
- 失败关闭：递归扫描 migration 与 owner SQL，覆盖 executable comments、ANSI_QUOTES、compact USE、dynamic SQL、MySQL 注释/引号/转义模式、backtick、嵌套目录和 Maven/Gradle Gateway persistence dependency；policy/B25/Redis 结构摘要拒绝未知字段、单条缺字段和类型漂移。
- 验证：专项 34/34、P1R 106/106、Redis/B25 static、IAM/Gateway、B7 28/28、B8 29/29、G1 6/6、契约生成/校验/typecheck/兼容、计划与 diff 均 PASS；独立 Luna Max adversarial 终验 ACCEPT。
- 未越界：结果只证明 static/D2，`runtimeStatus=NOT_RUNTIME_VERIFIED`；Java 动态拼接 SQL 是未来静态工具 P2，真实 owner grants、TenantScope、Redis rebuild、回滚与 retention runtime 仍归 M2-004。
