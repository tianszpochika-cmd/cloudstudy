# 内容生产与维护（Content Ops R2）开发记录 · 2026-10-13

分支：`feat/v2-content-ops`（基于 `origin/dev-redesign` 1c6c50b8）。工作树：`/Users/Admin/Desktop/work/cloudstudy-content-ops`。
未部署；等待 Luna 签收后再合并、部署。

## 现状核对（动工前）

- 课程/内容包（`ContentVersion`）：服务端已有驳回 → 回到 DRAFT、编辑者不能审自己（`FOUR_EYES_REQUIRED`）、
  一审/二审不同人（`DUAL_REVIEW_REQUIRED`）、`SAVE_DRAFT` 的 `expectedStateVersion` 乐观锁（409 `VERSION_CONFLICT`）。
  缺口主要在管理端工作台（见能力 1）。
- 单词（`Lexeme`）与题目/条目（`ContentItem`）：只接受“批准”，没有驳回；作者本人只要有审核权限就能一审自己的提交；
  已发布后不能修改；管理端保存时固定发送 `expectedStateVersion: 0`，服务端遇到 0 直接跳过版本校验 → 后保存的人会静默覆盖；
  新建同名单词会静默合并到已有词条。

---

## 能力 2 + 3（先做，服务端基础）：单词/条目的退回返工闭环 + 作者/审核分离

### 状态机（Lexeme 与 ContentItem 相同）

```
DRAFT --送审(记录 submittedBy)--> IN_REVIEW
IN_REVIEW --一审通过--> IN_REVIEW(firstReviewer)
IN_REVIEW --二审通过(≠一审人)--> APPROVED --发布--> PUBLISHED
IN_REVIEW --一审/二审 退回(REJECTED|CHANGES_REQUESTED + 必填原因)--> DRAFT（清空两位审核人，需重新一审+二审）
APPROVED/PUBLISHED --编辑--> DRAFT（修订稿；PUBLISHED 时标记 revisionOfLive，学员仍看旧版，直到重新发布）
DRAFT(修订稿) --下线--> DRAFT（撤下线上旧版，清除 revisionOfLive）
DRAFT(修订稿 of live) --归档--> 409 *_REVISION_LIVE（必须先下线）
IN_REVIEW / ARCHIVED --编辑--> 409 *_STATE_INVALID
```

- 作者/审核分离：送审账号（`submittedBy`）不能一审、二审，也不能退回自己的提交 → 403 `LEXEME_SELF_APPROVAL_DENIED` / `ITEM_SELF_APPROVAL_DENIED`。
  老数据没有 `submittedBy` 时退回到 `updatedBy` 判断。
- 退回原因必填（1–500 字），否则 400 `*_REJECT_REASON_REQUIRED`。
- 审计：每次送审、通过、退回、开修订稿都写入 content Outbox（服务自己的持久事件表 `content_outbox_event`）：
  `content.lexeme.submitted.v1 / review-approved.v1 / review-rejected.v1 / revision-opened.v1`，条目同理 `content.item.*`。
  payload 含 actor、decision、note、stateVersion、revisionOfLive。经核查没有其他服务消费 lexeme/item 事件。
- 管理端读模型新增 `reviewTrail`（submittedBy / lastDecision / lastNote / lastReviewer / lastReviewedAt / revisionOfLive）
  和 `firstReviewer`、`finalReviewer`；修订稿期间 `publicProjection.availability` 仍为 PUBLISHED。

### 乐观锁（能力 4 的单词/条目部分，同一提交）

- `LEXEME_UPSERT` / `ITEM_UPSERT` 现在把请求里的 `expectedStateVersion` 传进服务、在写入同一事务里校验：
  正数且与当前不一致 → 409 `LEXEME_VERSION_CONFLICT` / `ITEM_VERSION_CONFLICT`；
  单词 `expectedStateVersion=0`（新建）但同名已存在 → 409 `LEXEME_DUPLICATE`（不再静默合并）。
- 管理端编辑时发送打开时的 `stateVersion`；409 时弹窗：「载入最新版本」或「对比差异 / 保留我的修改」，不会静默覆盖。

### 数据库迁移（仅新增）

- `V31__review_trail_columns.sql`：`lexeme`、`content_item` 各加 6 列
  `submitted_by, last_review_decision, last_review_note, last_reviewer, last_reviewed_at, revision_of_live(默认 0)`。
  不改旧数据。在本机 MySQL 8.4 临时容器上跑过全部 31 个迁移 + 重复执行 + 失败修复测试。

### 管理端

- 单词页、题目页：「一审通过 / 一审退回 / 二审通过 / 二审退回」；退回弹出必填原因输入框。
- 自己提交的内容，审核按钮置灰并提示「你是提交人，不能审核自己的提交」；服务端同样拒绝。
- 新增「审核意见」列：待审显示提交人；被退回时红字显示「一审要求修改（审核人）：原因」。
- 已发布/已批准行的「编辑」变为「修订」，保存后提示「已创建修订稿，线上仍显示旧版」；状态旁显示「修订中」。
- 审核中、已归档行的编辑按钮置灰并说明原因。
- 服务端错误码统一翻译为中文说明（`apps/admin-web/src/platform/content-review.ts`）。

### 测试

- 新增 `RowReviewLoopTest`（14 个）：退回带原因+审计、返工重提重审到发布、退回缺原因、草稿不能审、
  提交人不能通过/退回自己的提交（含同时拥有编辑+审核权限的账号）、发布后修订保留线上副本、修订稿归档被拒、
  下线修订稿的线上副本、审核中冻结、过期保存 409、同名新建 409；条目同样覆盖。
- 新增 `ReviewTrailJdbcRoundTripTest`（真实 MySQL，需 `-Dcontent.migration.integration=true`）：V31 列读写往返。
- content-service 全量：283 run，0 失败，3 跳过（按设计需 MySQL 的集成测试；用临时 MySQL 8.4 单独开启后 Flyway 迁移测试与 V31 往返测试均通过）。
- admin-web：`vue-tsc --noEmit` 0 错误；`node --test tests/*.test.mjs` 47 过 3 失败，与改动前基线完全相同（admin-audit 的 3 个既有失败）。

---

## 能力 1：内容修订稿 + 打开原稿完整回填（并补齐内容包层面的 2/3/4）

### 服务端

- 管理端详情 `GET /admin/content-commands/{contentCode}` 新增 `editorDraft`：最新版本的
  版本号、状态、作者、类型、标题、校验值、来源/版权编码、申报渠道、授权证据引用、学习许可、完整 payload、
  当前已发布版本号；以及 `lastRejection`（最近一次退回的版本、审核阶段、决定、原因、审核人、时间）。
  **这两个字段不在现有契约里，见下方「契约提案」。**
- 修订稿：已发布/已批准内容执行 `SAVE_DRAFT`（targetVersionNumber=最新版本）即生成新的 DRAFT 版本，
  已发布指针不变（学员继续看旧版），重新双审后发布即替换。服务端原本就支持，本次补测试。
- 新增保护：最新版本 `IN_REVIEW` 时 `SAVE_DRAFT` → 409 `CONTENT_IN_REVIEW`（以前会在审核中的版本之上再叠一个草稿，审核对象被悄悄换掉）。
- 退回原因：`REVIEW_FIRST/REVIEW_FINAL` 的 `REJECTED/CHANGES_REQUESTED` 必须带 `reviewNote`（1–500 字），
  否则 400 `CONTENT_REJECT_REASON_REQUIRED`；原因写入新表 `content_review_note`，供作者在工作台看到。
- 作者不能审自己的版本：服务端已有（409 `FOUR_EYES_REQUIRED`），工作台已有置灰提示；本次补了回归测试。
- 乐观锁：`SAVE_DRAFT` 已有 `expectedStateVersion` 校验（409 `VERSION_CONFLICT`），本次补回归测试和前端提示。

### 数据库迁移（仅新增）

- `V32__content_review_note.sql`：新表 `content_review_note`（退回原因记录）。MySQL 8.4 临时库验证通过。

### 管理端（内容工作台）

- 在内容库点「编辑」：表单自动载入该版本原稿（标题、类型、校验值、来源/版权、渠道、证据、学习许可、JSON 配置），
  不再是空表单；说明行显示「第 N 版，作者 X」。
- 已发布/已批准的内容出现「基于此版本创建修订稿」按钮：确认后表单可编辑，保存生成新草稿版本，提示「线上版本不变」。
- 审核中的内容：说明行提示「需审核员先退回」，保存被拒时弹窗解释原因。
- 被退回的草稿：编辑页顶部红色提示「第 N 版被一级/二级审核退回（审核人）：原因」。
- 审核任务「退回」改为必填原因的输入框。
- 保存遇到 409（被他人修改 / 审核中）：弹窗「重新载入最新版本 / 留在当前页面」。

### 测试

- 新增 `ContentRevisionWorkbenchJdbcTest`（6 个，H2）：原稿回填字段齐全、已发布内容生成修订稿且发布指针不变、
  审核中禁止保存、过期保存 409、退回缺原因 400 且原因可读回、作者不能审自己的版本。
- `ReviewTrailJdbcRoundTripTest` 增加 `content_review_note` 在 MySQL 上的读写。
- content-service 全量 289 run / 0 失败 / 3 跳过（MySQL 集成，单独开启通过）。
- admin-web：vue-tsc 0 错误；node 测试 47 过 3 失败（与基线相同）。

### 契约提案（未改 packages/contracts，待评审）

`B9AdminContentState`（`additionalProperties: false`）增加两个只读可选字段：

```json
"editorDraft": {
  "type": "object", "readOnly": true,
  "description": "最新版本的可编辑事实，仅管理端详情返回，用于工作台回填与修订稿",
  "properties": {
    "contentVersionId": {"$ref": "#/components/schemas/B9ContentVersionId"},
    "versionNumber": {"type": "integer", "minimum": 1},
    "status": {"type": "string", "enum": ["DRAFT","IN_REVIEW","APPROVED","PUBLISHED","ARCHIVED"]},
    "editor": {"type": "string"}, "contentType": {"$ref": "#/components/schemas/B9ContentType"},
    "title": {"type": "string"}, "contentHash": {"type": "string"}, "releaseNote": {"type": "string"},
    "sourceCode": {"type": "string"}, "licenseCode": {"type": "string"},
    "permittedChannels": {"type": "array", "items": {"type": "string"}},
    "authorizationEvidenceRef": {"type": ["string","null"]}, "allowsLearning": {"type": "boolean"},
    "payload": {"type": "object"}, "publishedVersionNumber": {"type": ["integer","null"]}
  }
},
"lastRejection": {
  "type": "object", "readOnly": true,
  "properties": {
    "contentVersionId": {"type": "integer"}, "versionNumber": {"type": "integer"},
    "reviewStage": {"type": "string", "enum": ["FIRST_REVIEW","FINAL_REVIEW"]},
    "decision": {"type": "string", "enum": ["REJECTED","CHANGES_REQUESTED"]},
    "note": {"type": "string", "maxLength": 512}, "reviewer": {"type": "string"},
    "decidedAt": {"$ref": "#/components/schemas/B9DateTime"}
  }
}
```

同一提案还包括能力 2 加在 `lexeme` / `item` 记录里的 `reviewTrail`、`firstReviewer`、`finalReviewer`，
以及命令错误码 `*_SELF_APPROVAL_DENIED`、`*_REJECT_REASON_REQUIRED`、`*_REVISION_LIVE`、`CONTENT_IN_REVIEW`、
`CONTENT_REJECT_REASON_REQUIRED`。请求体没有新增字段（`reviewNote`、`expectedStateVersion` 契约里本来就有）。
