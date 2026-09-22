# B4-01 单词语言缎带交付（TENANT-B4-01）

> 日期：2026-09-21。系列规划文档 `B4-multilingual-plan.md` 未随提交入库（缺失）；系列入口见 [README](README.md) §7/§10（原引用 TENANT-B4-01）。
> 状态：实现 + 契约 + 单测 + 管理前端完成；运行（真实 DB/网关/浏览器）与 P1R 验收未做，不改变任何 P1R 任务状态。

## 1. 做了什么

- **契约先行**（零新增路径，网关零漂移，合并后仍 424 路由——B3 翻转后的基数）：
  - `packages/contracts/fragments/b9/b9-content.openapi.json`：`LexemeUpsertInput`/`LexemeRecord` 新增可选 `language`（`$ref B9Locale`，BCP-47；缺省读 `en-US`；包命名规范 `VOCAB-{LANG}-PHASE1` 写进描述）；`LexemeSense` required 从 `[pos, meaningCn]` 收敛为 `[pos]`，`meaningCn` 标 legacy 兼容并新增 `meaningLocal` 通用释义位（1..512）；`LexemePronunciationInput`/`LexemePronunciation` 的 `accent` 从 `US/UK/SLOW` 枚举开锁为 1..16 开放字符串（美英慢速保留为约定值）；`phoneticUS/phoneticUK`（upsert+record 共 4 处）标 legacy（保留字段）；`GET list` 新增可选 `language` 查询参数（仅 `kind=LEXEME`）。
  - `LexemeUpsertInput.pos` 枚举、`x-command-field-policy`、全部命令枚举、`B9AdminContentState` required 集均未动（`language` 走 `lexeme` 对象内部字段，`accent` 放宽是兼容性 widening）。
- **content-service**（owner 不变）：
  - `V19__lexeme_language.sql`：`lexeme` 加 `language VARCHAR(16) NOT NULL DEFAULT 'en-US'`（老数据默认 `en-US`）+ `idx_lexeme_pack_language` 索引；`lexeme_pronunciation.accent` 扩到 `VARCHAR(16)` 并 `DROP CHECK chk_lexeme_pron_accent`（开锁，无替换约束）。
  - 领域：`Lexeme` 新增 `language` 一等字段（构造/创建/读取，`requireLanguage` 与 `B9Locale` 同 pattern，空输入继承 `en-US`，非法抛 `LEXEME_LANGUAGE_INVALID`；创建后不可变，与 headword 同语义）；`validatedFields` 要求每条 sense 至少携带 `meaningCn`/`meaningLocal` 之一；`LexemePronunciation` 的 `accent` 由三值集合改为 1..16 开放 tag 校验。
  - 仓储：`LexemeRepository.search` 加 `language` 参数（空=全语言），JDBC/Memory/FailClosed 三适配同步；JDBC 读写列 + 语言过滤 + 老行空值回退 `en-US`。
  - 应用：`LexemeCommandService.upsert` 从输入读取 `language`（缺省 `en-US`，进幂等指纹），`ensurePack` 按首词语言透传包 `contentLocale`（`en-US` 默认行为不变）；`search` 透传语言。
  - 接线：`B9ContentAdminController` `GET list` 加 `language` 参数，`lexeme` 投影带 `language`。
- **管理前端**：`api/lexeme.ts`（`LexemeRow.language`、`LexemeFields.language`、`LexemeSense.meaningLocal`、`accent: string` 开锁、`listLexemes` 加 `packCode/language` 参数）；`AdminLexemeView.vue`（语言列 + 词包列 + 语言/词包双筛选、新建/编辑语言下拉、`meaningLocal` 输入、发音口音可自建值下拉，预置 `FR-PARIS`）。
- **验证**：content-service `168/0/0`（`LexemeCommandServiceTest 13/13`，含新增 6 项）；learner 55、learning 142、assessment 57 全绿；admin-web `vue-tsc` 干净 + `vite build` 通过；契约门禁仍 21 条旧失败（iam/recovery/media/assessment 域，零单词域，见 §2）；网关 22 条与 B3 重冻包逐条一致（无新增实现类错误）；`diff --check` + `stale-claims` PASS。

## 2. 门禁 diff（诚实记录）

- `validate-contracts`：1 项（`POST /api/v1/iam/account-deletions needs x-idempotency`），IAM 域，B1 起即有，本任务零触碰。
- `p1r-api-contract`：2 个测试失败、明细 21 条，与 B3 基线逐条一致——`iam*` 2、`recovery*` 8（含 `sagas/unfinished` 分页 3）、`content-commands/validate/auto` 1、`media*` 5、`assessment/mistakes*` 5；无 `kind=LEXEME`、无 `language/accent/meaningLocal` 相关新增项。
- 网关检查 22 条：`routeRule 63 / execution plan 63 / public 393 / available 202 / digest` 五项计数漂移 + `publish-tasks` 翻转 + recovery/iam stale 理由 + M1-017 六项，全部落在 B3 §2 重冻包内，无新增实现类错误。
- 合并路由数 424（B3 翻转后的基数，非本任务新增；本任务 OpenAPI 路径零新增）。

## 3. 三件套 Bingo 证据（B4-01 无枚举新增，逐项说明）

| 变更 | 契约 | Java | DB |
|---|---|---|---|
| `lexeme.language` 一等字段 | `LexemeUpsertInput`/`LexemeRecord.language` + list `language` 参数 | `Lexeme.language` + `requireLanguage` + 三仓储 search/列映射 | V19 加列/索引/默认值 |
| `accent` 开锁 | accent enum→开放字符串（input+record） | `LexemePronunciation` 开放 tag 校验 | V19 扩列 + DROP CHECK |
| `meaningLocal` | `LexemeSense.meaningLocal` + required 收敛 `[pos]` | `validatedFields` 取其一校验 | 无 DDL（`fields_json` 内） |
| `phoneticUS/UK` legacy | 描述标注（字段保留） | 无改动（兼容读取） | 无改动 |

## 4. 设计取舍

1. **语言是固定列而非 fields 内键**：查询维度（筛选/索引/分包）需要它进 SQL；`fields_json` 仍保留调用方回显的 `language` 键以便审计对账。
2. **创建后不可变**：语言与 headword 同属身份，re-upsert 保持原缎带；跨语言迁词走新建+归档旧词（留痕不断链）。
3. **`collocations` 的 `meaningCn` required 未动**：B4-01 只收敛 sense 级（验收只要求 sense 通用释义位）；种子包自带双语 collocation，待 B4-04 tags/词性机制时一并评估。
4. **包 `contentLocale` 跟首词语言**：已存在包不受影响（`ensurePack` 仅在建包时写一次）；`VOCAB-PHASE1` 保持 `en-US`。

## 5. 未做（后续 B4 任务）

- 法语形态字段/词性扩展与 tags 受控词表（B4-04）；听写/跟读种类（B4-05）；法语种子 ≥50 词与德语 5 词（B4-07，本任务的 FR 测试词仅为单测固件）；真实 MySQL V19 迁移演练（`ContentFlywayMigrationTest` 为集成门控，单元管线跳过——SQL 已按 MySQL 8.0 `DROP CHECK` 语法手写复核）；网关重冻（B3 包待独立复核）；P1R 状态变更。
