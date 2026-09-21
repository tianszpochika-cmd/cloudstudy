# B4 单词 fields 规范（TENANT-B4-04）

> 状态：规范文档（`DESIGNED`）。契约事实源：`b9-content.openapi.json` 的 `LexemeUpsertInput`/`LexemeRecord`；实现：`Lexeme.validatedFields`。

## 1. 顶层键（节选 B4 相关）

| 键 | 类型 | 规则 |
|---|---|---|
| `headword` | string 1..128 | 必填，身份 |
| `language` | BCP-47（`B9Locale` 子集） | 缺省 `en-US`；创建后不可变 |
| `pos` | string[] ≤5 | 受控词表（§2）；法语名词/动词触发形态必填（§3） |
| `gender` | `MASCULINE/FEMININE/NEUTER` | 法语名词必填；其他语言可选 |
| `number` | `SINGULAR/PLURAL` | 法语名词必填（引文形单数，复数专用词用复数） |
| `grammaticalCase` | 六格枚举 | 法语行省略；德语变格名词携带 |
| `conjugation` | `{verbGroup: string≤32, irregular?: boolean}` | 法语动词必填 `verbGroup`（`FR-ER/FR-IR/FR-RE/FR-IRREGULAR`） |
| `senses[]` | ≤12 | 每条至少 `meaningCn`/`meaningLocal` 之一；`pos` 受控 |
| `tags[]` | ≤20，每项 1..64 | 见 `B4/tags-taxonomy.md` |
| `phoneticUS/phoneticUK` | string | legacy（保留）；新语言走发音行 |
| `meaningCn`（sense 内） | string 1..512 | legacy 兼容位 |
| `meaningLocal`（sense 内） | string 1..512 | 通用释义位（非中文语种用此位） |

## 2. 词性受控词表

历史九值 `NOUN VERB ADJ ADV PRON PREP CONJ INTERJ PHRASE` + 收敛长式
`ARTICLE PRONOUN DETERMINER PREPOSITION CONJUNCTION INTERJECTION NUMERAL PARTICLE`
（sense 级另兼容 `PREFIX SUFFIX`）。历史缩写永不删除。

## 3. 语言条件规则（当前仅法语）

- `language ∈ {fr, fr-FR}` 且 `pos ∋ NOUN` → `gender`、`number` 必填。
- `language ∈ {fr, fr-FR}` 且 `pos ∋ VERB` → `conjugation.verbGroup` 必填非空。
- 其他语言（含 `en-US`、`de-DE`）：形态键可选填、填则必须合法；不触发必填。
- 德语形态必填留待德语全量批次（B4-07 仅 5 词走通，不设门槛）。

## 4. 示例（摘录）

```json
{
  "headword": "parler",
  "language": "fr-FR",
  "pos": ["VERB"],
  "conjugation": {"verbGroup": "FR-ER", "irregular": false},
  "cefr": "A1",
  "senses": [{"pos": "VERB", "meaningLocal": "parler（说话）"}],
  "tags": ["fr:pos-verb", "fr:conj-er", "fr:cefr-a1"]
}
```
