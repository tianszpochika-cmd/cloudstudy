# learn.vue handoff-before archive（2026-10-21）

本目录在 MB007 navigation 窄补修前复制，保留原始 learn 页面源码。不是 PASS。

| 文件 | 字节 | 行数 | SHA256 (raw) | SHA256 (LF) |
|---|---|---|---|---|
| `learn.vue` | 18740 | 213（split）/ 212（编辑器） | `83b0756b84bbd2e34a4c4bdee196b02bb63403ca64b032034a16ffd7187d17c1` | 同 raw |

- 归档前 `git status --porcelain -- apps/mobile/src/pages/learn/learn.vue` 为空、`git diff` 为空，确认该文件此前 tracked clean；Root 已确认不在 56 文件保护 manifest 中。本归档未改 manifest。
- 原始问题（Root C7 navigation 实跑 `codex-20261021-c7-navigation-1`，三个 FAIL）：tab 常驻后第二次 `switchTab` 不再触发 `onLoad`，`onShow` 只调 `learning.load()`，pending query 未消费；旧 `loadContent` 在 await 前写 `loadedContentCode`，无 owner/请求序号，晚包可覆盖新课，同 code 失败重试可被 cache 短路。
- 新候选 `apps/mobile/src/pages/learn/learn.vue` raw `52091366379e3a00771df9c8bf01a56ee4de08078c2e728fcce456beeb9e8c56`，详见 `../../dsh-20261021-author/LEARN-HANDOFF-CANDIDATE.md`。
