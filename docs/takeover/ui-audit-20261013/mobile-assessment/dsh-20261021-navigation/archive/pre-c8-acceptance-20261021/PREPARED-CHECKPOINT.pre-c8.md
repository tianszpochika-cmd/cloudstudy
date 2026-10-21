# PREPARED-CHECKPOINT — dsh-20261021-navigation（只读 navigation 诊断准备）

- **状态：NOT_RUN。** 本轮只做静态修改 + `node --check` + fixture `import-only` + sanitizer 单测；**没有任何 `chromium.launch` 尝试、没有 valid-env run**。
- 上一轮确有一次被沙箱 `spawn EPERM` 拦截的 launch 尝试（无进程/无页面/无截图）；该记录**保留**，本轮不删除、不辩解、不声称“从未尝试”。
- 范围：仅 `dsh-20261021-navigation/`；未改产品、其他 tests、Git、服务、旧 `risk-leave` 历史脚本或其 FAIL。

## 文件与哈希（本轮，实测）

| 文件 | sha256 | bytes |
| --- | --- | --- |
| `README.md` | `321787ef8f3f7c7eddfa36e0d04933bc147ecd1ac846c972530dc582c606515b` | 9857 |
| `scripts/nav-diagnose.cjs` | `7a15f194850eaa3d013bcc9d9df0ccc0198a9f5848d0bf6a9381c878fe8c681f` | 22222 |
| `scripts/fixture.nav.cjs` | `0a178ed83c2b45cd0dabcf5e4e07510d7d7d6a7c6b27c9cd5215bd962d0dd707` | 13659 |
| `archive/pre-diagnostics-20261021/ARCHIVE-MANIFEST.json` | `b516b4c851f4b68c56b1a5f6d0348daf20a7d1dcceaec146d7de2bb42957c902` | 1246 |
| `archive/pre-static-fix-20261021/ARCHIVE-MANIFEST.json` | `d38dc6035033ed4bf32e5c0a81141e367c9518fec748cfedd1ee7346dab2b6e4` | 933 |

driver 357 行 / fixture 155 行；无新架构、无通用框架。

## 本轮改动（仅只读诊断）

1. fixture 新增 `report.navigationDiagnostics`，只捕获 `console.debug/log/info` 中**文本精确以 `[MB006` 开头**的消息。每条记录 `{ id, caseId, route, at, tag, text, fieldCount }`。
2. 纯函数 `sanitizeNavigationDiagnostic(text)`：硬上限 400 字符输入 / 200 输出 / 8 token；只保留 tag 与安全字符集的 path/meta/boolean；**拒绝** `{ } " ' , @`、`JSHandle`、object 渲染，**不解析 args 对象**，不读 owner/token/headers。
3. `caseId` 由 driver 的 `--case` 传入（`f.fresh({ case: CASE })`），`route` 取事件发生时 `page.url()`；payload 增加 `navigationDiagnostics`。
4. **未改判据**：`console.warn` 仍只进 `consoleWarnings`；`console.error` 仍只进 `consoleErrors` 且照旧 FAIL；未知 API 仍 501 + `unexpected` → FAIL；**没有 error 豁免扩大**。诊断为空是合法结果。

## 归档（先归档再改）

- `archive/pre-diagnostics-20261021/`：改前的 `nav-diagnose.cjs`、`fixture.nav.cjs`、`README.md`、`PREPARED-CHECKPOINT.md` 原样保存 + manifest。
- `archive/pre-static-fix-20261021/`：上一轮三项静态修正前的 driver/fixture 原样保存 + manifest。
- 两份归档均通过 `node --check`；**没有删除任何历史证据**。

## 静态验证（本轮实测）

| 检查 | 结果 |
| --- | --- |
| `node --check scripts/fixture.nav.cjs` | exit 0 |
| `node --check scripts/nav-diagnose.cjs` | exit 0 |
| fixture import-only | OK（12 导出，含 `sanitizeNavigationDiagnostic`） |
| sanitizer 单测（接受 `[MB006…`、拒绝普通日志/`[MB007]`/超长、objects 内容不泄漏、200 字符上限） | `SANITIZER_OK`，exit 0 |
| 新文件硬编码 page hash | NONE |
| `navigationDiagnostics` 与 error/warning 分支互不改写 | 代码位置独立（133 / 136 / 142 行） |

## page hash / C8 策略

- **不默认 freeze 当前 page**：driver 只认 Root env `NAV_EXPECTED_PAGE_SHA`（64 位小写 hex 且与真实文件相等），无默认、无自动接纳；README/driver/fixture 均不存 page hash。
- **不采用 C8**：本目录没有引入 C8 分支、tooling 或协议；只增加“若产品打 `[MB006` 日志则只读记录”的通道。Root 会先审产品实际 tag 与字段，再决定是否执行。
- 其余 9 个受控值仍为 C6b；如 C8 合法改动任一文件，driver 在 launch 前 exit 2 并打印 expected/got，不会静默放宽。

## Root 执行前的显式 gate

1. 确认批准 hash（当前 page 已不是 C6b 的 `ac8fb8d2…`；执行时实测为 `37bad477…`）。**必须由 Root 显式传入**，driver 不内置。
2. `MB006_CONFIRM_BROWSER=1`；run 目录必须唯一（已存在则 exit 2）。
3. 一次一个 case；`closed:true` + 前后 source/dependency hash 稳定才可能 PASS。

```powershell
$env:MB006_CONFIRM_BROWSER='1'
$env:NAV_EXPECTED_PAGE_SHA='<Root 批准值>'
$env:NAV_RUN_ID='nav-<case>-<n>'   # 唯一；已存在则 exit 2
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261021-navigation/scripts/nav-diagnose.cjs --case <guide-exits|cycle-back|report-today|full-reload-recovery>
```

## 现场事实（不修改）

- `runs/` 下已存在 **Root/Codex 于 2026-10-21 08:25–08:28 执行**的 5 个 run 目录（`codex-20261021-c7b-nav-*` / `-fresh-nav-guide-1`），含 results 与截图；其中 `guide-exits` 已记录 `back-button-exits-to-home`、`home-button-exits-to-home` FAIL。这些是 Root 的证据，本目录**未改动**。
- 上述运行早于本轮诊断捕获，故其 `navigationDiagnostics` 为 0 属预期。

## 未做

- 未跑任何真实浏览器用例；无 PASS 或部分 PASS。
- 未复测 retest、未做完整 relogin 恢复、未判定产品 vs 测试。
- 未删除失败证据。
