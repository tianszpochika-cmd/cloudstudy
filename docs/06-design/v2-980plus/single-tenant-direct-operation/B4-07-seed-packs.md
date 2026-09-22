# B4-07 法语种子包 + 德语管线交付（TENANT-B4-07）

> 日期：2026-09-21。系列规划文档 `B4-multilingual-plan.md` 未随提交入库（缺失）；系列入口见 [README](README.md) §7/§10（原引用 TENANT-B4-07）。
> 状态：种子数据 + 全链路单测完成；运行（真实 DB/网关/浏览器）与 P1R 验收未做，不改变任何 P1R 任务状态。

## 1. 做了什么

- **种子数据**（`services/content-service/src/main/resources/seed/`，UTF-8 JSONL，每行 = 一个 `import/batch` 词条 `{contentCode, lexemeId, lexeme}`，可直接投喂 B2 已存在的批量导入面板）：
  - `vocab-fr-phase1.jsonl`：50 法语词（阳性名词 15 / 阴性名词 15，全部带性数；动词 12，ER/IR/RE/规则与不规则全覆盖，全部带 `conjugation.verbGroup`；形容词 5；冠词/感叹/副词 3，含 `ARTICLE` 长式）。每词带法语音标（`phoneticFr`）、法语释义（`meaningLocal`）+ 中文释义（`meaningCn` 双语）、法语例句、发音占位资产 ID（`audioFrAssetId: media-fr-0001…0050`，media-service 真实资产落地前为占位引用，音频字节永不过内容服务）、`fr:` 前缀 tags（词表见 `B4/tags-taxonomy.md`）。
  - `vocab-de-phase1.jsonl`：5 德语名词（Brot/Wasser/Apfel/Milch/Haus，性数齐，另带主格 `grammaticalCase` 做全量示范），德语释义 + 中文释义 + 德语例句 + `media-de-000x` 占位资产。
- **全链路单测**（`LexemeSeedPackTest 3/3`，InMemory 三件套，复用批量导入相同的服务调用序列）：
  - 法语 50 词逐词建→审（一审/二审）→发→发音登记（`FR-PARIS`）→质检 `CLEAN`；断言语言过滤 50/50、已发布 50/50、`content.lexeme.published.v1` 出盒事实 50 条（即学员投影消费的跨服务事实）、`VOCAB-FR-PHASE1` 包自动建为 `VOCABULARY` 且 locale `fr-FR`。
  - 德语 5 词同样端到端（含末词自审负例：同一人终审被拒后换二审通过），`VOCAB-DE-PHASE1` 包 locale `de-DE`，德法串味断言（`fr-FR` 过滤为 0）。
  - 隔离负例（`VOCAB-FR-SCRATCH` 包）：未审批发布被拒且草稿 intact、缺一审的终审被拒；scratch 行不污染法语包计数。
- **验证**：content-service `191/0/0`；learner 59、learning 146、assessment 60 全绿；合并零漂移（无契约变更）；`validate-contracts` 唯一旧失败；`p1r-api-contract` 7/2；网关 63/393/202；`diff --check` + `stale-claims` PASS。前端零改动（复用 B2 导入面板与 B4-01 单词页语言筛选）。

## 2. 学员侧可读说明（诚实记录）

- 本任务验证到内容侧事实边界：50 条 `content.lexeme.published.v1` 出盒事实 + 服务端 `PUBLISHED` 投影状态。Kafka 投递与学员侧消费应用超出单元管线（无 infra），列为运行验收项，未冒充完成。
- 发音占位资产 `media-fr/de-*` 在 media-service 无对应实体前，试听链路返回缺资产（fail-closed 方向正确）；质检 `CLEAN` 结论针对的是登记元数据（音标/引用格式），非音频内容质检。

## 3. 设计取舍

1. **种子放 `src/main/resources/seed/`**：随服务发布物走，便于各环境用同一文件做批量导入；测试从 classpath 读取同一文件（单测即文档即载荷，三位一体）。
2. **法语释义与中文释义双给**：`meaningLocal` 满足新链路，`meaningCn` 照顾现有中文学员释义展示；两者在契约/senses 校验中为“或”关系，双给合法。
3. **德语 5 词同样全形态建档**：虽无德语必填规则，但按全量标准建档，提前验证 `grammaticalCase` 与 `de:` 词表。

## 4. 未做（后续 B4 任务）

- 判分本地化（B4-08，听写题用法语种子验收）；UI 语言包（B4-09）；真实导入演练与学员侧消费验证；网关重冻；P1R 状态变更。
