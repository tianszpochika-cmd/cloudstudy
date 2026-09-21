# B1 单词主数据交付：行级单词/音标/发音总控

> 日期：2026-09-21。方向见 [单租户直营 README](README.md) §4.1/§7（B1）。
> 状态：实现 + 契约 + 单测 + 管理前端页面完成；运行（真实 DB/网关/浏览器）与 P1R 验收未做，不改变任何 P1R 任务状态。

## 1. 做了什么

- **契约先行**（零新增路径，网关零漂移）：`packages/contracts/fragments/b9/b9-content.openapi.json` 新增 `LexemeExample/LexemeSense/LexemePronunciationInput/LexemePronunciation/LexemeUpsertInput/LexemeRecord` 6 个 schema；`B9ContentCommandRequest` 的 command 枚举 +9（`LEXEME_UPSERT/SUBMIT_REVIEW/REVIEW_FIRST/REVIEW_FINAL/PUBLISH/UNPUBLISH/ARCHIVE/PRONUNCIATION_UPSERT/PRONUNCIATION_QC`）并同步 `x-command-field-policy/oneOf`；`B9ContentCommandAccepted` 枚举 +9 并加可选 `lexemeId/lexemeStateVersion`；`B9AdminContentState` 加可选 `lexeme` 投影；`GET list` 加 `kind/q/cefr/availability/packCode` 可选查询参数（Cursor/PageSize 原样保留）。合并后仍 417 路由。
- **content-service**（owner 不变）：
  - `V16__create_lexeme_master.sql`：`lexeme`（身份+生命周期+查询维列，`fields_json` 承载全部可扩展富配置）与 `lexeme_pronunciation`（口音/IPA/音频资产引用/质检）。
  - 领域：`Lexeme`（DRAFT→IN_REVIEW→APPROVED→PUBLISHED/ARCHIVED 状态机，作者不能自审终审，`validatedFields` 结构校验）、`LexemePronunciation`、`LexemeAvailability`。
  - 仓储：`LexemeRepository` 端口 + JDBC/Memory/FailClosed 三适配。
  - 应用：`LexemeCommandService`（幂等键、expectedStateVersion 409、pack 自动建 `VOCABULARY` 包、PUBLISH/UNPUBLISH 写 Outbox `content.lexeme.published/unpublished.v1`）。
  - 接线：`ContentServiceConfiguration` 3 个 Bean；`B9ContentAdminController` 9 个命令分支 + `kind=LEXEME` 列表投影（`contentCode=lex:{id}`，`contentType=VOCABULARY`，另附完整 `lexeme` 记录）。
- **管理前端**：`apps/admin-web/src/api/lexeme.ts`（列表/生命周期/双审/发音登记/质检，全部经 Gateway 既有路由 + Idempotency-Key），`views/AdminLexemeView.vue`（搜索/CEFR/状态筛选、新建/编辑草稿、一审/二审/发布/下线/归档、发音登记与 READY/CLEAN/FAILED 质检），路由 `/lexemes`（复用 `admin.content.read` 门）。
- **验证**：content-service 全套 `155/0/0`（含新增 `LexemeCommandServiceTest 7/7`）；admin-web `vue-tsc` 干净 + `vite build` 通过（含 `AdminLexemeView` chunk）；契约 `validate-contracts` 与 `p1r-api-contract` 保持改造前结论（同一 2 项旧失败，无新增）；网关检查 19 条与改造前逐条一致（此前误记 18，实为 19），无新增漂移。

## 2. 设计取舍（诚实记录）

1. **为什么不用新网关路径**：新路径会扩大冻结基线漂移（当前已 FAIL），B1 的 9 个命令复用既有 `POST /api/v1/admin/content-commands`（已有 `x-idempotency`），列表复用既有 GET（已有 `x-pagination`），网关/校验零新增。
2. **为什么列表项复用 B9AdminContentState**：保持响应契约字节兼容；单词身份编码在 `contentCode=lex:{id}`，完整记录附在可选 `lexeme` 字段。pack 切换（多词包）留给 B2。
3. **音频字节永不过内容服务**：发音行只存 `audio_asset_id` 引用 + 技术元数据 + QC 结论；试听走 media 短时 URL（B2 补行内试听）。
4. **REJECTED 语义**：一审/终审只接受 APPROVED；打回 = 在 DRAFT 期改字段重新送审（`stateVersion` 递增留痕），不设驳回态。

## 3. 未做（后续批次）

- 真实 MySQL V16 迁移演练、Gateway→content 真实链路、浏览器八态、学员分群灰度、pack 切换器、行内音频试听/波形、批量导入模板——见 README §7 的 B2/B3。
- 生成式客户端（`contracts:generate`）因既有 `account-deletions` 门禁失败未重跑；管理前端沿用手写 adapter（与既有 B9 adapter 一致）。
- P1R 任务状态、manifest、证据绑定均未动。
