# B4 tags 受控词表（TENANT-B4-04）

> 状态：规范文档（`DESIGNED`）。配套实现：`Lexeme.validatedFields` tags 形状校验（1..64 非空、≤20 个）；成员归属本表为建议（advisory），B4-07 种子包起按本表执行。

## 1. 语言前缀规则（铁律）

- 非英语 tags **必须**带语言前缀：`{lang}:{facet}-{value}`，其中 `{lang}` 为 BCP-47 主码小写（`fr`、`de`），`{facet}` 见 §2，`{value}` 为小写 ASCII（`a-z0-9-`）。
- 英语历史 tags 无前缀（`daily-life`、`exam`、`collocation`……）予以保留，**不再新增无前缀 tags**。
- 服务端当前强制形状（`LEXEME_FIELD_INVALID`）：每 tag 非空、≤64 字符、全包 ≤20 个；前缀成员检查为文档建议，硬校验在后续批次按需收紧（收紧前需同步更新契约与本表）。

## 2. 分面（facet）

| 分面 | 含义 | 示例 |
|---|---|---|
| `pos` | 词性（与契约 pos 枚举一致，小写） | `fr:pos-noun`、`fr:pos-verb`、`de:pos-noun` |
| `gender` | 性 | `fr:gender-m`、`fr:gender-f`、`de:gender-n` |
| `number` | 数 | `fr:number-sg`、`fr:number-pl` |
| `case` | 格（德语为主） | `de:case-nom`、`de:case-acc`、`de:case-dat` |
| `conj` | 变位组 | `fr:conj-er`、`fr:conj-irreg` |
| `cefr` | 等级 | `fr:cefr-a1`、`de:cefr-a1` |
| `topic` | 主题 | `fr:topic-daily`、`de:topic-food` |
| `exam` | 考试 | `fr:exam-delf-b2`、`de:exam-goethe-a1` |

## 3. 示例

- 法语名词 `pain`：`["fr:pos-noun", "fr:gender-m", "fr:number-sg", "fr:cefr-a1"]`
- 法语动词 `parler`：`["fr:pos-verb", "fr:conj-er", "fr:cefr-a1"]`
- 德语名词 `Brot`：`["de:pos-noun", "de:gender-n", "de:number-sg", "de:case-nom", "de:cefr-a1"]`
- 英语历史词 `habit`：`["daily-life"]`（祖父条款保留）

## 4. 与契约/实现的对应

- 契约 `LexemeUpsertInput.tags`：`maxItems 20`、`maxLength 64`（本表即其受控词表说明）。
- 实现 `Lexeme.validatedFields`：数量/长度/非空硬校验；`gender/number/grammaticalCase/conjugation` 进契约形态字段（见 `B4/lexeme-fields-spec.md`）。
- 管理端：新建/编辑单词时 tags 以逗号分隔输入；法语包建议按本表打前缀。
