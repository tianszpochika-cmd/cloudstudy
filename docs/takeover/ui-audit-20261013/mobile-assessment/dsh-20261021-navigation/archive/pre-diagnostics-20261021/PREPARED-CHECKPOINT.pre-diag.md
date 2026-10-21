# PREPARED-CHECKPOINT — dsh-20261021-navigation（静态修正后）

- **状态：NOT_RUN。** 仅静态修正 + `node --check` + fixture 的 import-only 验证；**本轮没有任何 `chromium.launch` 尝试、没有 valid-env run**。
- 上一轮确有一次被沙箱 `spawn EPERM` 拦截的 launch 尝试（无进程/无页面/无截图），该记录**保留在本文件历史中**；本轮不删除、不辩解、不声称“从未尝试”。
- 范围：仅 `dsh-20261021-navigation/`；未改产品、其他 tests、Git、服务、旧 `risk-leave` 历史脚本或其 FAIL。

## 文件与哈希（本轮，实测）

| 文件 | sha256 | bytes |
| --- | --- | --- |
| `README.md` | `78054402373aa163a02059a7a521d18c0ae99f6a31f760d486eff8b556877e6a` | 8430 |
| `scripts/nav-diagnose.cjs` | `973752047d2c396cf4892ab1322f0bb969269048367c775ff70dbdf925a8c0bd` | 22093 |
| `scripts/fixture.nav.cjs` | `0bcd9cf657c4b32c83d1d8c2ba84aae2ea97176faf6704763b3c912cf48ddbe6` | 11618 |
| `archive/pre-static-fix-20261021/ARCHIVE-MANIFEST.json` | `d38dc6035033ed4bf32e5c0a81141e367c9518fec748cfedd1ee7346dab2b6e4` | 933 |
| `archive/.../nav-diagnose.pre-fix.cjs` | `9616336449ef25a5be11c870f11dcc77c756f427ba89718bd14cc06cf7f687f2` | 18167 |
| `archive/.../fixture.pre-fix.cjs` | `0bcd9cf657c4b32c83d1d8c2ba84aae2ea97176faf6704763b3c912cf48ddbe6` | 11618 |

`fixture.nav.cjs` 本轮未改（与上一轮同 hash）；driver 由 301 行增至 356 行（新增第 4 个 case + 三项守卫，未引入框架）。

## Root 提出的 3 项静态问题 — 修法

1. **依赖基线时点**：`dependenciesBefore` 现在与 `sourceHashesBefore` **同在 browser launch 之前**采集；case 结束后只读 `dependenciesAfter`，与 before **逐项严格比对**（`source-and-dependency-hashes-stable`）。原实现 before/after 都读在 case 之后，不能证明依赖未漂移。
2. **run 目录不可覆盖**：launch 之前 `fs.existsSync(OUT)` 即 **exit 2**（`refusing to overwrite prior results or screenshots`）；launch 成功后先确保 `runs/` 再**非递归** `mkdirSync(OUT)`，失败同样 exit 2（并先 close）。不再用 `mkdir recursive` 静默复用旧目录。
3. **close 受断言**：`closed` 布尔进入 payload；新增 `browser-closed-cleanly` check，close 失败即 FAIL，不可能仍 PASS。异常分类保持：缺页/导航未达 = 测量失败 FAIL(1)；env/守卫/hash/服务/浏览器启动/目录冲突 = setup(2)；**未新增任何宽松路径**。

另外保留：case 抛错统一记 `case-completed-without-exception` FAIL；未知 API 501 仍 FAIL；无广义 200。

## 新增 case `full-reload-recovery`

正常 start → 真实答 1 题（accepted 1，页面无未提交 choice）→ **真 `page.reload()`**（不是 `page.goto` 换 hash）→ 只走应用既有恢复流程（refresh 优先，出现 login 才真实填账号密码提交）→ 断言：

- `reload-reaches-assessment`（回到 question 且 hash 为 assessment）
- `reload-reGETs-same-session`（`placementGet +1` 且 sessionId 不变）
- `reload-accepted-sequence-still-1`
- `reload-clears-page-choice`
- `reload-does-not-start-new-session`（`start` 不增）

不读写 storage/token/store、不造 pointer、不注入 guard；失败保留，不预判产品 vs 测试。

## 静态验证（本轮实测）

| 检查 | 结果 |
| --- | --- |
| `node --check scripts/nav-diagnose.cjs` | exit 0 |
| `node --check scripts/fixture.nav.cjs` | exit 0 |
| 归档两份 `.pre-fix.cjs` 的 `node --check` | exit 0 |
| fixture import-only（require 后断言导出与 8 个 sources） | `IMPORT_ONLY_OK`，exit 0 |
| 新文件中硬编码 page hash（`37bad477…` / `ac8fb8d2…`） | NONE |
| 禁用 token（pushState/replaceState/popstate/storage/navigateBack/cookie/Authorization） | NONE |
| driver 内 chromium/launch 调用点 | 仅经 `f.init()`（fixture 内），本轮未执行 |
| `runs/` 是否存在 | NONE（无 run 产物） |

## page hash 策略

- **只认 Root env** `NAV_EXPECTED_PAGE_SHA`（64 位小写 hex 且与真实文件相等），无默认、无自动接纳；driver 与 README 均不存 page hash。
- Root 当前批准可执行 page 为 C7b `37bad477e4239061972941c42b24468db5994b8afb89feb61f720fbe168c07e5`；执行时由 Root 传入，本目录不冻结、不写入。
- 其余 9 个受控值仍为 C6b（i18n/API/store/session/navigation/uni-runtime/uni.scss/package/lock）；上一轮实测 9/9 MATCH。若 C7 合法改动其中任一项，driver 会在 launch 前 exit 2 并打印 expected/got，需 Root 显式评审后更新，不会静默放宽。

## 交付给 Root

```powershell
$env:MB006_CONFIRM_BROWSER='1'
$env:NAV_EXPECTED_PAGE_SHA='<Root 批准值，例如 C7b 37bad477…>'
$env:NAV_RUN_ID='nav-full-reload-1'   # 可选；已存在则 exit 2
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261021-navigation/scripts/nav-diagnose.cjs --case full-reload-recovery
```

四个 case：`guide-exits` / `cycle-back` / `report-today` / `full-reload-recovery`；一次一个，退出码 0/1/2 语义见 README。

## 未做

- 未跑任何真实浏览器用例；无 PASS 或部分 PASS。
- 未复测 retest、未做完整 relogin 恢复、未判定产品 vs 测试。
- 未删除失败证据（含上一轮 launch 尝试记录与 run 目录删除事实）。
