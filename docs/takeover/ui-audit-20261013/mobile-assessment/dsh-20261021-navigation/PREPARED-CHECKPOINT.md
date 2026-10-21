# PREPARED-CHECKPOINT — dsh-20261021-navigation（C8 验收修正）

- **状态：NOT_RUN。** 本轮仅静态修改 + `node --check` + fixture 的 import/纯函数验证；**没有 browser 尝试、没有有效 env probe、没有执行任何 case**。
- 只改 `dsh-20261021-navigation/`；未改产品、其他 tests、Git、服务；未删任何旧 FAIL 证据。
- 上一轮 `spawn EPERM` 的 launch 尝试仍保留在历史记录中（不声称“从未尝试”）。

## 文件与哈希（本轮，实测）

| 文件 | sha256 | bytes |
| --- | --- | --- |
| `README.md` | `3f011b22ead9c771314ceed68f8965592cae02a8446a89db861aa5fcafbd6334` | 11525 |
| `scripts/nav-diagnose.cjs` | `d6d5671fb72da3591d253c6ce34ced44bc8b4d4f79d0863e6b569af5769f87e7` | 29121 |
| `scripts/fixture.nav.cjs` | `6fb4d9208a59a3bae46b2409eb6d7f80d46637f101c6b5be4af41c738d05a17c` | 14994 |
| `archive/pre-c8-acceptance-20261021/ARCHIVE-MANIFEST.json` | `84b01910e57eff93a44cf062a698ffd5aea87e938a5d8c7084725bb2719c1a30` | 1229 |

改前版本原样归档于 `archive/pre-c8-acceptance-20261021/`（driver/fixture/README/checkpoint + manifest），**未删除任何证据**。

## 1. home 验收（guide-back / guide-home / cycle-back 共用一个 helper）

`waitHomeReady(page, id, label)` 必须**同时**满足才返回，随后才 `snap`（采集 counts/stack/截图）：

- 去 query 后**精确匹配** `#/`（H5 首 entry canonical alias）或 `#/pages/home/home`；
- `.v2-home-body` **可见**（`getClientRects().length > 0` 且 `offsetWidth/Height > 0`）；
- `.v2-home-greet-title` **已出现且文本非空**；
- `document.body.innerText` 非空；
- `#assessment-page` **不可见**；
- 该 fixture id 已发出 `GET /api/v1/learner/home`（读取完成）。

`back-button-exits-to-home` / `home-button-exits-to-home` / `back-target-is-home` 都要求 URL alias + DOM 就绪；另有 `back-home-ready`、`back-home-reads-completed`（`home-home-ready`、`home-home-reads-completed`）独立成 check。**只凭 URL 不会通过，异步空白截图不计为导航完成。**

### 事实（源码/证据）

- `apps/mobile/src/auth/navigation.ts:28` `normalizeMobilePagePath`：`'/'` 归一为 `HOME_PATH`（`/pages/home/home`），即页面路径语义下 `#/` 与 home 等价。
- **`createNormalizeUrl` 在本仓库及 `@dcloudio/uni-h5`、`uni-shared`（有界搜索）中均未找到**；checkpoint **不声称**该函数存在。可证事实是：H5 hash router 对首 entry 在地址栏呈现 `#/`，而页面 route 为 `pages/home/home`；验收因此按“两个精确别名 + DOM/读取就绪”实现。
- C8 旧 FAIL（`runs/codex-20261021-c8-nav-guide-1`）实测：`01-guide` hash `#/pages/assessment/assessment`，`02-after-back` 与 `04-after-home` hash 均为 `#/`；失败仅 `back-button-exits-to-home`、`home-button-exits-to-home` → **URL 断言不兼容 + 未等 DOM**，不是没离开。该旧 FAIL **保留原样，不升级 PASS**。
- C7b 旧 FAIL（`runs/codex-20261021-c7b-*`）中 guide 的 after-back 仍停在 assessment → **旧 C7b 是真没离开**；两者不可混为一谈。

## 2. today 验收

`waitTodayReady`：`#/pages/today/today` + `.v2-today-body` 可见 + `.v2-today-title` 存在非空 + DOM 非空 + `#assessment-page` 不可见 + 已 `GET /api/v1/learner/home`。未知读取仍按**精确 pathname** 匹配，新出现即 `501 + unexpected` → FAIL，**无广义 200 兜底**；`today-button-reaches-today` 不再单凭 URL，另有 `today-dom-ready`、`today-reads-completed`。

## 3. 产品 DEV tag（按 Root 审定字段实现）

产品实际：`assessment.vue:414` `console.info('[assessment-nav-guard]', JSON.stringify({...}))`（`import.meta.env.DEV`）。fixture 只接受文本以 `[assessment-nav-guard]` 精确开头者，`JSON.parse` 后白名单：

`toPath`、`toMetaRoute`、`toMetaIsEntry`、`active`、`busy`、`permitDestination`、`permitTarget`、`permitAliases`（≤2）、`permitOperationCurrent`；path 允许无前导 `/`（`to.meta.route` 实测 `pages/home/home`），enum 仅 `back|home|settings|today`，bool 严格。

- 未知字段/类型不符/enum 越界/>2 alias/非 JSON/超长 → **整条拒绝**，只加 `navigationDiagnosticsRejected` 计数（不存内容）。
- 不记录 `message.args`、整个对象、owner/token/headers；不保存原始消息文本，只存白名单后的 `fields`。
- **旧 `[MB006]` 泛化 token 解析已移除**；纯采集，不改变 error/warn 判据，不扩大豁免。

单测（import-only，无浏览器）：真实 9 字段 payload 通过；8 类坏输入全部拒绝；输出不含 owner/token/JSHandle。

## 4. 新增 `settings-baseline`

- `fresh({ destination: 'settings' })`：fixture **只允许** `assessment`（默认）/ `settings` 两个初始目的，`returnTo` 非自由输入；等 settings hash 后才返回，**不挂载 assessment**。
- 等 `.v2-settings-title` 可见 + DOM 非空 + `learner/preferences`、`notifications/preferences`、`support/tickets` 均已读取。
- 记录 warnings/errors/unknown、source/deps、close、截图；**warnings 原样保留**（不因 AppIcon 警告而删/改 settings 产品）。本 case 仅定位 settings 文本中 AppIcon 来源，**不称 settings UI 通过**。
- checks：`settings-title-visible`、`settings-reads-completed`、`assessment-never-mounted` + 通用 error/unknown/hash/close 判据。

## 静态验证（本轮实测）

| 检查 | 结果 |
| --- | --- |
| `node --check scripts/fixture.nav.cjs` / `nav-diagnose.cjs` | 0 / 0 |
| fixture import + `parseNavigationDiagnostic` 单测 | `PARSER_OK fields=9 rejects=8` |
| 旧 tag / 旧 sanitizer 残留 | 无（README 仅保留“已移除”说明） |
| driver / fixture 行数 | 441 / 177 |
| `runs/` 旧证据 | 9 个目录（C7b 5 + C8 4）原样保留 |
| 支撑常量 | 9/9 MATCH |

## page hash 策略

- **不默认 freeze 当前 page、不把 C8 产物写成常量**：只认 Root env `NAV_EXPECTED_PAGE_SHA`（64hex 且与真实文件相等），无默认/自动接纳。
- 当前实测 page = `41e1670146621e532921a8916b2c81ea4954d880b2373c7bcc9945d6576d7e86`（等于 Root 静态批准的 C8 值）；执行时仍由 Root 显式传入。
- 其余 9 个受控值仍为 C6b 值，任一同漂移即 launch 前 exit 2。

## 交付给 Root

```powershell
$env:MB006_CONFIRM_BROWSER='1'
$env:NAV_EXPECTED_PAGE_SHA='41e1670146621e532921a8916b2c81ea4954d880b2373c7bcc9945d6576d7e86'
$env:NAV_RUN_ID='nav-c8-guide-2'   # 必须唯一；已存在则 exit 2
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261021-navigation/scripts/nav-diagnose.cjs --case guide-exits
# 另四个：cycle-back / report-today / full-reload-recovery / settings-baseline
```

## 未做

- 无 browser、无有效 env probe、无 case 执行；无 PASS 或部分 PASS。
- 未改产品（含 C8 dev tag 与 settings 警告来源）；未删旧 FAIL；未判定产品 vs 测试。
