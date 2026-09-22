# B4-05 句子/题目种类扩展交付（TENANT-B4-05）

> 日期：2026-09-21。系列规划文档 `B4-multilingual-plan.md` 未随提交入库（缺失）；系列入口见 [README](README.md) §7/§10（原引用 TENANT-B4-05）。
> 状态：实现 + 契约 + 单测 + 管理前端完成；运行（真实 DB/网关/浏览器）与 P1R 验收未做，不改变任何 P1R 任务状态。

## 1. 做了什么

- **契约先行**（零新增路径；三个 kind 枚举同步 +2）：
  - `ContentItemUpsertInput.kind`、`ContentItemRecord.kind`、`GET list` 的 `itemKind` 参数：`+ DICTATION`（听写）、`+ SHADOWING`（跟读）；upsert 描述与 kind=ITEM 列表描述同步。
- **content-service**（owner 不变）：
  - `ContentItem.KINDS` +2；`ContentItemCommandService` id 前缀 `dc_`/`sh_`（`ew_` 兜底保留给历史 `EXERCISE`）；`B9ContentAdminController.itemContentType` 把两新种映射到 `QUESTION`（`B9ContentType` 七值共享枚举不动——此前不映射会掉进 `COURSE_UNIT` 错误分面，细种类仍由 `item.kind` 七值承载）。
  - `V21__content_item_kinds.sql`：重发 `chk_content_item_kind` 七值 CHECK。`content_definition.kind` 为无 CHECK 的普通 `VARCHAR`——规划中的“`content_definition` 若用”经核验为不适用（V1/V3 无该 CHECK，如实记录）。
- **assessment-service**（`QuestionType` 按需加值——判分 `switch` 穷尽要求必须同步，否则编译失败）：
  - `QuestionType` + `DICTATION`（走文本规则判分，默认原因码 `DICTATION_WRONG`）+ `SHADOWING`（Phase 1 无 ASR，不可规则判分→`PENDING_MANUAL`，与翻译人工复核同形；音频字节永不进入判分）。
  - 评估侧无 DB CHECK（`question_type` 只活在快照 JSON 内，`valueOf` 直通；迁移目录零命中已核验）。
- **管理前端**：条目页类型下拉/批量导入校验/模板提示同步两新种；`content-items.ts` 的 `ItemKind` 联合类型同步。
- **验证**：content-service `188/0/0`（条目 5/5：DICTATION 建→审→发→下全周期 + 前缀/种类断言，SHADOWING 全周期）；assessment `60/0/0`（判分 31/31：听写命中/失分原因码、跟读 pending）；learner 59、learning 142 全绿；admin-web `vue-tsc` + `vite build` 通过；合并 424 路由；`validate-contracts` 唯一旧失败；`p1r-api-contract` 7/2；网关 63/393/202；`diff --check` + `stale-claims` PASS。

## 2. 三件套 Bingo 证据

| 变更 | 契约 | Java | DB |
|---|---|---|---|
| `DICTATION`/`SHADOWING` kinds | upsert/record/`itemKind` 三枚举 | `ContentItem.KINDS` + 前缀 + 投影映射 | V21 七值 CHECK 重发 |
| `QuestionType` 加值 | 不适用（`b2/b3` 旧轴枚举冻结未动；快照内字段） | `QuestionType` + 判分支（穷尽编译约束） | 不适用（无 question_type CHECK，迁移零命中） |

## 3. 设计取舍

1. **投影分面取 `QUESTION` 而非加新分面**：`B9ContentType` 是跨公共/学员/官网的共享枚举，加值会波及冻结面；听写/跟读本质都是“作答→判分”行，`QUESTION` 语义正确，细种类由 `item.kind` 表达。
2. **跟读判分走人工复核而非伪造分数**：Phase 1 无 ASR，任何规则分都是编造；pending 形状与翻译人工复核一致，下游（掌握度/报告）按既有 pending 语义处理。
3. **听写复用文本归一**：`acceptedAnswers/acceptedText` 规则键与拼写题一致（法语重音折叠在 B4-08 落）；原因码独立为 `DICTATION_WRONG` 以便错因归因。
4. **V21 真实迁移演练未做**：同系列原因（集成门控）；语句为单表 `DROP CHECK + ADD CONSTRAINT`，值集为旧五值超集（旧行零影响）。

## 4. 未做（后续 B4 任务）

- 任务类型/SRS（B4-06，本任务的种类是其前置）；法语种子（B4-07，可直接用 DICTATION/SHADOWING 建法语听说行）；判分本地化（B4-08）；网关重冻；P1R 状态变更。
