# B4-04 词汇类别扩展机制交付（TENANT-B4-04）

> 日期：2026-09-21。规划见 [B4-multilingual-plan](B4-multilingual-plan.md) §2 TENANT-B4-04。
> 状态：实现 + 契约 + 单测 + 管理前端 + 规范文档完成；运行（真实 DB/网关/浏览器）与 P1R 验收未做，不改变任何 P1R 任务状态。

## 1. 做了什么

- **契约先行**（零新增路径；只增枚举值/可选字段与描述）：
  - `LexemeUpsertInput.pos` 加 8 个收敛长式（`ARTICLE PRONOUN DETERMINER PREPOSITION CONJUNCTION INTERJECTION NUMERAL PARTICLE`；历史缩写保留，`maxItems 5` 不变）；`LexemeSense.pos` 同步加 8 个。
  - `LexemeUpsertInput`/`LexemeRecord` 加形态字段：`gender`（三性）、`number`（单复数）、`grammaticalCase`（六格）、`conjugation`（`{verbGroup≤32, irregular?}`），全部可选。
- **content-service**（owner 不变；形态进 `fields_json`，无 DDL——三件套的 DB 腿在此项为“无表结构变更”，见 §3）：
  - `Lexeme.validatedFields(raw, language)`：词性受控词表（word/sense 两级；sense 级另兼容 `PREFIX/SUFFIX`）、形态枚举合法性（填则必合法）、法语条件必填（`fr/fr-FR` 名词要性数、动词要 `conjugation.verbGroup`；德语/英语只做合法性检查，不触发必填）、tags 形状收紧（非空、≤64）。
  - `LexemeCommandService.upsert` 先归一化语言再校验（非法语言仍早拒；法语规则对 B4-01 的 FR 固件生效——其单测固件已同步补性数字段）。
- **规范文档**：`B4/tags-taxonomy.md`（语言前缀铁律 `{lang}:{facet}-{value}` + 八分面 + 示例）、`B4/lexeme-fields-spec.md`（顶层键表、词性表、法语条件规则、JSON 示例）。
- **管理前端**：单词对话框加词性多选（17 值）、性/数/格下拉、`conjugation.verbGroup` 输入；保存时剔除清空的形态键（空串≠省略，服务端会拒）；新建默认 `pos=['NOUN']`。
- **验证**：content-service `186/0/0`（新增 `LexemeMorphologyTest 6/6`：12 名词 + 10 动词服务级完整建档≥20、缺性数/缺变位/非法词性-性-tags 三类负例、英语兼容、ARTICLE 长式）；learner 59、learning 142、assessment 57 全绿；admin-web `vue-tsc` + `vite build` 通过；合并 424 路由；`validate-contracts` 唯一旧失败；`p1r-api-contract` 7/2；网关 63/393/202；`diff --check` + `stale-claims` PASS。

## 2. 三件套说明（本项无枚举 CHECK 变更）

| 变更 | 契约 | Java | DB |
|---|---|---|---|
| 词性 +8 长式 | pos 枚举（upsert+sense） | `Lexeme.POS` 白名单 + 两级校验 | 无（`fields_json` 内；`lexeme` 表无 pos CHECK） |
| 形态四字段 | gender/number/case/conjugation 可选字段 | 枚举合法性 + 法语条件必填 | 无（`fields_json` 内；B4-01 的 V19 已是最后一次单词表 DDL） |

DB 腿“无变更”是有意为之：词性/形态从 B1 起即设计为 `fields_json` 可扩展位，加 CHECK 反而违背“新字段免 DDL”原则；审批时请按 Bingo 的实质（契约+实现+持久化一致）而非形式计数核验。

## 3. 设计取舍

1. **德语不触发形态必填**：B4-07 仅 5 词走通管线，不设门槛；德语全量批次再议（`case` 枚举已预置六格）。
2. **tags 成员归属为建议**：服务端只硬校验形状；把成员硬校验留给后续批次（收紧前需同步契约与本表，避免把历史 `daily-life` 误杀——本批形状校验已验证其通过）。
3. **`case` 键名用 `grammaticalCase`**：避开生成器/保留字风险；契约 record 与 input 同名。
4. **B4-01 法语固件同步补性数**：新法语必填规则生效后，旧固件（无性数）会被拒——已补齐，属“只增不断旧链”（英语链零改动，`englishNounWithoutMorphologyStillAccepted` 为证）。

## 4. 未做（后续 B4 任务）

- 听写/跟读种类（B4-05）；任务类型/SRS（B4-06）；50 法语种子 + 德语 5 词（B4-07，直接复用本任务的建档机制与词表）；网关重冻；P1R 状态变更。
