# B4 规范文档（多语言字段规范）

> 状态：规范文档目录（`DESIGNED`），不是实现/运行证据。
> 上级入口：[单租户直营方向 README](../README.md) §7/§10；批次交付记录见 [B4-10 closeout](../B4-10-closeout.md)。

本目录存放 B4（多语言内容）中**跨任务复用的字段级规范**：这些规则约束 `content-service` 的单词 `fields_json` 内容，属于契约与实现都要对齐的约束，因此单独成文，而不是塞进某一份批次交付记录。

| 文档 | 约束对象 | 与实现/契约的对应 |
|---|---|---|
| [lexeme-fields-spec.md](lexeme-fields-spec.md) | `lexeme.fields_json` 顶层键、`pos` 受控词表、法语形态必填 | 契约 `b9-content.openapi.json` 的 `LexemeUpsertInput`/`LexemeRecord`；实现 `Lexeme.validatedFields` |
| [tags-taxonomy.md](tags-taxonomy.md) | tags 命名（语言前缀铁律）、分面词表、形状上限 | 实现 `Lexeme.validatedFields` 的 tags 形状校验（1..64 非空、≤20 个）；**成员归属当前为建议（advisory）**，服务端未硬校验 |

## 边界说明

- 两份文档都是**设计规范**：它们描述应当遵守的规则，不证明规则已被运行验证。字段级校验的实际行为以 `content-service` 代码与其单测为准。
- tags 的语言前缀与分面**成员**目前只是文档建议；服务端只硬校验形状。要收紧为硬校验，必须先同步契约与本表，避免误杀历史无前缀 tags（如 `daily-life`）。
- 本目录不含 B4 的批次规划文档：系列规划 `B4-multilingual-plan.md` 未随提交入库，各 B4-* 交付记录已注明该缺失并回指上级 README。
