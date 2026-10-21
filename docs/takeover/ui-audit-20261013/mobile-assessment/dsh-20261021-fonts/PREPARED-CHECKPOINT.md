# PREPARED-CHECKPOINT — dsh-20261021-fonts（评估页真实渲染字体只读审计）

- **状态：NOT_RUN。** 本轮只写脚本 + R1 小修 + `node --check` + 静态 hash 核验；**没有 `chromium.launch`、没有有效 env run、没有截图、没有 PASS**。
- 范围：仅 `docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261021-fonts/`；未改产品、Git、服务、其他 tests/worker 目录。
- 目的：先测 390 中文正文实际用了什么字体，验证“宋体/衬线观感”是否来自真实渲染；**不凭观感改产品**。

## 文件

| 文件 | sha256 | 行 / bytes |
| --- | --- | --- |
| `scripts/font-audit.cjs` | `11c3e12793f9aaa1e32cb949933dcadec28ddb2f6776f30b0be92a7f089c3198` | 183 / 15984 |

未创建 `runs/`、截图或 `results.json`；这些只会在 Root 审核后执行时生成。

## 退修 R1（2026-10-21）

- **问题**：driver 原 `require('../dsh-20261021-navigation/scripts/fixture.nav.cjs')` 从 `scripts/` 解析到 `fonts/dsh-20261021-navigation/...`，但 nav 目录实际在 `fonts/` 同级。
- **修正**：仅把 relative import 改为 `../../dsh-20261021-navigation/scripts/fixture.nav.cjs`；未改其他逻辑、选择器、CDP 或判据。
- **路径验证**：从脚本 dirname 用 `require.resolve` 纯解析，得到 `...\mobile-assessment\dsh-20261021-navigation\scripts\fixture.nav.cjs`，`resolve_exit=0`；未执行 driver、未启动浏览器。
- **证据边界**：上一轮 “fixture import-only” 只证明 **fixture 本身**可导入，不能证明 driver 的 relative import 正确；本轮以 `require.resolve` 单独验证 driver 路径，不把它说成运行验证。

## 静态核验（本轮实测）

| 检查 | 结果 |
| --- | --- |
| `node --check scripts/font-audit.cjs` | exit 0 |
| 7 个 support 源 + `package.json` + `pnpm-lock.yaml` | `checked=9 mismatches=0`，与脚本 `FIXED`/`DEPS` 逐项相等 |
| nav fixture 源数量 | `sources=8`，首项为 `apps/mobile/src/pages/assessment/assessment.vue` |
| 当前 page hash | `41e1670146621e532921a8916b2c81ea4954d880b2373c7bcc9945d6576d7e86`（与 `dsh-20261021-c8/C8-CHECKPOINT.md` 记录一致） |
| 脚本内硬编码 page hash | **0 处**；只认 `MB006_FONT_EXPECTED_PAGE_SHA`，无默认、无自动接纳 |
| driver fixture 路径 | `require.resolve` 从脚本 dirname 解析到 `...\dsh-20261021-navigation\scripts\fixture.nav.cjs`，exit 0；纯 resolve，未执行 |
| fixture import-only（上一轮） | 通过；只证明 fixture 本身可导入，**不证明** driver 的 relative import 正确 |

> 证据：上述 `node --check`、PowerShell `Get-FileHash` 对比、`require.resolve` 纯解析，均在 2026-10-21 本轮执行并核对；未执行 driver。C8 page hash 来自 `dsh-20261021-c8/C8-CHECKPOINT.md` 原文读取。

## 脚本做什么

- 复用 `../../dsh-20261021-navigation/scripts/fixture.nav.cjs`：正常 login、真实页面/按钮、synthetic API transport；**不注入** auth/store/guard/storage，不读 cookie/token/headers。
- 只采三态：`guide`、答题选中（点 A 后 `aria-pressed=true`）、`report`（正常 10 次响应后）。
- 每态 × `zh-CN`/`en-US`，view 390×844、light、`colorScheme:'light'`，共 6 次采集。
- 每态只读 `getComputedStyle` 收：
  - `root` = `#assessment-page`（产品字体声明所在页根）
  - `h1` = `#assessment-title`
  - 正文 `uni-text` 与内层 `span`
  - 按钮 host（`uni-button`）与按钮文本（有 `span` 采 `span`；直写文本则记 `directText:true`）
  - 字段：`fontFamily/fontSize/fontWeight/lineHeight`
  - 父链最多 4 级 computed `fontFamily`，仅用于定位覆盖来源，**不作为真实渲染证据**
- 真实 used font 只来自 Playwright 公共 `context.newCDPSession(page)` + `DOM.enable`/`CSS.enable` + `DOM.getDocument`/`DOM.querySelector` + **`CSS.getPlatformFontsForNode`**；记录 `familyName/postScriptName/glyphCount/isCustomFont`。
- 每态 `fullPage` 截图；记录 URL、`lang`、counts、选择器 presence/visible、截图名。
- `report` 态额外检查 `counts.respond === 10` 且 `acceptedSequence === 10`；不是只凭 report DOM 出现就当作“10 题完成”。
- 捕获并输出 fixture 的 `unexpected`（未知 API）、`pageErrors`、`consoleErrors`、`consoleWarnings`；warnings 单独保留，存在时整体记 `WARN`，不静默丢弃。
- 唯一 run 目录；执行前/关闭后 source/deps hash 严格比对；`closed:true` 才可能 PASS。

## CDP 不可用/证据不足时

- `newCDPSession` 失败、方法报错、节点找不到，或文本样本没有任何 `glyphCount>0`：对应 check 记 **`NOT_RUN`**，整体结果为 `NOT_RUN`，exit 3。
- **不**用 computed `fontFamily` 冒充 used font，不 fallback 成假 PASS。
- `h1`/正文的 used font 查询其真实文本 `span`；按钮为直写文本节点时查询 `uni-button` host（文本节点本身没有独立盒模型），并在记录中注明，不伪造一个 `span`。

## Root 执行门（建议命令）

前置：固定端口 `http://127.0.0.1:18183` 服务已启动；本机 Playwright Chromium 可用；run 目录不存在。

```powershell
$env:MB006_FONT_CONFIRM_BROWSER = '1'
$env:MB006_FONT_EXPECTED_PAGE_SHA = '<Root 审核确认的 64 位小写 hex>'
$env:MB006_FONT_RUN_ID = 'font-c8-1'          # 唯一；已存在则 exit 2
$env:MB006_FONT_EXECUTOR = 'root-review'      # 仅记录

node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261021-fonts/scripts/font-audit.cjs
```

本轮记录到的当前 C8 page hash 为 `41e167…`；脚本**不内置**该值，Root 执行时仍需显式传入并自行确认。

退出码：`0` = 全部 check PASS（含 CDP 证据）；`1` = 真实 FAIL（选择器缺失、页面/console error、未知 API、hash 漂移、流程/close 失败）；`2` = setup 拒绝（env/hash/服务/启动/run 目录冲突）；`3` = `NOT_RUN` 或 `WARN`（**不声称 PASS**）。

## 未做 / 不声称

- 未执行浏览器，未跑任何 case，未生成截图或 `results.json`；**无 PASS、无部分 PASS**。
- 未改产品、未改既有 tests、未动 Git/服务/其他 worker 目录。
- 未下载字体、未引入依赖；未读取大仓历史或搭通用框架。
- 本脚本只回答“实际 used font 是什么”，不判定产品应不应该改字体；是否改产品由 Root 依据执行结果决定。
