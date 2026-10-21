# Root 历史审核证据归档（2026-10-21）

这些文件由 Root 在自有审核环境实际采集，**按原字节复制**自 `.git/codex-local-backups/dsh-dispatch-20261021/`；未修改 JSON/PNG，未做转码。仅归档证据，不代表当前 C8 通过。

## 文件与原始 hash（SHA-256）

| 文件 | 版本/用途 | bytes | SHA-256 |
|---|---|---|---|
| `root-home-font-inspection-c3.json` | C3 字体检查 | 2650 | `6638a8ffbc4aa607…` |
| `root-home-focus-inspection-c4.json` | C4 焦点检查 | 1509 | `b8fcb53ab4b1126a…` |
| `root-home-placeholder-c5.json` | C5 placeholder 检查 | 440 | `5aa3b10ebb251fa6…` |
| `root-home-race-c6.json` | C6 race 诊断 | 2704 | `e0fe22de54c65b39…` |
| `root-home-empty-c6.json` / `.png` | C6 空态 | 684 / 46273 | `aba14bd1f8f6f3cb…` / `368e210aa5bb3778…` |
| `root-home-auth401-l2.json` / `.png` | C7+L2 auth401 真实 FAIL（触发 C8） | 2770 / 14182 | `1b05a5ba488c533f…` / `1a002dd799e0b54c…` |

完整 64 位值见同目录 `HASHES-ROOT-REVIEW-20261021.json`（随本次归档生成）。

## 版本边界

- **C3 字体**：实际 used-font 为 Microsoft YaHei（Bold/Regular）与 Segoe UI（semibold）；用于排除“宋体观感”疑虑，不等于字体风格自动断言。
- **C4 焦点 / C5 placeholder / C6 空态与 race**：均为对应历史版本的诊断事实；C6 race 的 `unknown` 属**诊断 GAP**，不是完整业务验收。
- **C7+L2 auth401**：Root 实读 home 401 + refresh 401 清会话后仍停 `#/`，是**真实产品 FAIL**，并触发 C8 候选修复——**C8 本身未签、浏览器未跑**，本目录不等于 C8 PASS。
- 这些 JSON 只含具名 H5 检查事实、DOM/受控 API 路径状态；**不含请求 headers/token 正文**。已按私钥块/明显 token 模式扫描，命中 0。
- 旧 FAIL、旧矩阵与 RECONSTRUCTED 归档继续保留；不因本归档升级任何页面或业务结论。
