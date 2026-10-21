# MB006 独立风险 suite（PREPARED / NOT_RUN）

本目录只包含**可由 Root 在独立审核环境执行的脚本、fixture 副本和证据模板**。DSH 作者没有启动浏览器，没有跑任何 case，也没有预写 PASS。这里的任何文件都不构成页面验收、远程发布或整页完成声明。

- 允许写目录：`docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/`
- 产品源码、原 fixture、c3 脚本、服务、依赖、store 均未改动。
- 运行报告固定 `label: "Codex review"`、`preparedBy: "DSH (independent risk-test author; ...)"`，并把 `fixture / native / realBackend` 分开记录。

## 1. 冻结源（8 个）

`source-freeze.json` 记录准备时刻 `2026-10-20T14:35:51Z`（dev-redesign，HEAD `687af101`）的 SHA256：

| 文件 | SHA256 |
|---|---|
| `apps/mobile/src/pages/assessment/assessment.vue` | `86620ed0dbc2cb25afb4bbae35734a345b9e8066afa806684f99ccb678a5312d` |
| `packages/i18n/src/mobile-experience.ts` | `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380` |
| `apps/mobile/src/api/learner-content.ts` | `43ce2ad5d6519b5fab7e38867d1349b569d08b6153b74c87e5c96f11e24e1ae6` |
| `apps/mobile/src/stores/learner-content.ts` | `95cc92496db996242d91baed3301d76f985e4e3b9134e1e50c2b9ab8d41e4c61` |
| `apps/mobile/src/stores/session.ts` | `d944c9e84617af5ad553d2fbc1fd0c07120ce790411dbe02603f9338333f8931` |
| `apps/mobile/src/auth/navigation.ts` | `7365fec07c55857445fdb1d87b60659734e9e94dc06cfb65afabcb3e8863a4b5` |
| `apps/mobile/src/platform/uni-runtime.ts` | `fcbeba8626d8364af0ae96db64a05fcff9a3bb2b46a7d8fbcba21507ef609751` |
| `apps/mobile/src/uni.scss` | `0bd56842fc5baebd8767e721f2d938986e293d1d87bfc74bb087b3c228f638d7` |

每个脚本启动前重算这 8 个文件；任一漂移即 `REFUSED`（exit 2），不得改 freeze 迎合运行结果。运行结束再算一次，`sourceStable !== true` 时结果强制 FAIL（exit 1）。

## 2. 文件

| 文件 | 作用 |
|---|---|
| `fixture.cjs` | 由不可变原 `20261016-review-prep/fixture.cjs` 复制而来，见 §3。 |
| `risk-lib.cjs` | 守卫、8 源 freeze、run 目录、证据记录、真实 mouse/CDP touch、DOM facts、finally 关闭。 |
| `risk-keyboard.cjs` | 组 1：真实 Tab/Shift+Tab、focus-visible、Enter/Space 选项、键盘主动作单写、新题清选/焦点。 |
| `risk-pointer.cjs` | 组 2：0/160ms 鼠标、旧中心 + ≤1.01px active 位移、drag 出界、CDP touchEnd vs touchCancel、读回。 |
| `risk-leave.cjs` | 组 3：settings/back 离开确认、取消零导航零写、确认后 actual route、busy 锁、返回恢复、重登恢复。 |
| `risk-busy-retest.cjs` | 组 4：hold busy 稳定、真实双击、retest 确认/取消/503/成功新 session、ensure 503 诚实 notice、连续读回失败。 |
| `manifest.template.json` | 每次运行 `manifest.json` 的字段模板（不是结果）。 |

## 3. fixture 来源与增量（原文件未改）

原文件 `docs/takeover/ui-audit-20261013/mobile-assessment/20261016-review-prep/fixture.cjs`（SHA256 `6FFB98D4...`）保持原样；本目录副本只做三处**可审计增量**：

1. 新增 `hasTouch` context 选项，用于 CDP 触摸用例；
2. 新增四个**目标页最小读**：`GET /api/v1/notifications/preferences` 与 `GET /api/v1/support/tickets`（settings 挂载读取）、`GET /api/v1/learner/home` 与 `GET /api/v1/content/learner/catalog`（home 挂载读取）。路径与解析形状来自 `apps/mobile/src/api/{b12,learner-content,support}.ts`、`domain/it7-closure.ts` 与页面源码；这些请求单独记入 `report.targetReads`，不混入 assessment 请求；
3. `report.targetReads` 字段。

保留的原语义：真实登录页/guard、合成账号、全部 API 拦截、未知路由 501、非 API 只允许 `http://127.0.0.1:18183`、不读 cookie/storage/header/body、不替换 store/guard/组件行为。fixture 仍只在显式 `init()` 后启动 Chromium。

## 4. 运行方式（Root 审核环境）

服务已由 Root 刷新到固定 18183；脚本不启动/停止服务、不改端口。**DSH 未执行以下命令。**

```powershell
$env:MB006_CONFIRM_BROWSER='1'
$env:MB006_RISK_RUN='codex-review-kbd-1'      # 每次新 runId；已存在目录会被拒绝
$env:MB006_RISK_EXECUTOR='codex-review'
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/risk-keyboard.cjs
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/risk-pointer.cjs
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/risk-leave.cjs
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/risk-busy-retest.cjs
```

建议每组建一个新 `MB006_RISK_RUN`，或复用同一 runId 但组目录不同；四个组各自独立进程、独立 context、独立 `results.json`/`manifest.json`/截图/源 freeze。

- 输出：`runs/<runId>/<group>/{results.json, manifest.json, *.png}`；同名目录绝不覆盖。
- exit：`2` = 守卫拒绝（未确认浏览器 / runId 非法 / 目录已存在 / 源漂移），`1` = 任一 FAIL、异常或运行中源漂移，`0` 仅表示**已执行 checks 全部 PASS**，不表示整页完成。
- 关闭：每个 case 的 `close()` 释放 hold 并关闭 context；`execute()` 的 `finally` 再 `close()` 全部并复核 `closed`。

## 5. 判定口径（不镜像实现）

- 每个 check 都从**实际 DOM / 实际请求计数 / actual `location.hash`** 取值，没有常量 PASS。
- 选项必须实测 `aria-pressed` 恰好翻转一次；主操作必须实测请求计数恰好 +1；busy 期间再次操作必须不增加计数。
- 1px 位移：`|during.y - before.y| <= 1.01`，且按下前的中心点仍在按下后的 rect 内，且请求/选中结果不变。
- 触摸：只用 `Input.dispatchTouchEvent` 的 `touchEnd` / `touchCancel`，不用 `dispatchEvent`；`touchCancel` 后不得选中/写。
- 页面身份：`#assessment-page` 存在、`location.hash` 精确、`innerText` 非空、无 `vite-error-overlay`；目标页（settings/home）只断言 actual route 与非空/overlay。
- 证据：每 case 至少一张截图；`results.json` 保留完整 facts、routes、counts、fallbacks；`manifest.json` 保留 check 列表与 NOT_RUN。
- 控制台：只把浏览器为**注入的 503** 打印的 `Failed to load resource … 503` 一类网络行从 console error 中排除，并保留 `consoleRaw/consoleExcluded`；其他 console error 与任何 pageerror 仍计 FAIL。
- 若键盘 Enter/Space 在 `uni-button` 上不产生激活，脚本记录 FAIL，并显式写 `fallbacks`（用 pointer 仅作 setup），不会把 fallback 当键盘 PASS。CDP touch 若在本机不可用，P2 记 NOT_RUN 并停止，不伪造触摸结论。

## 6. NOT_RUN / GAP（不伪造原生能力）

| 分支 | 状态 | 原因 |
|---|---|---|
| 同 owner hide/迟到响应 | NOT_RUN | 请求 hold 时页面 busy 会禁用页内所有导航；唯一剩余的 hide 触发是浏览器后退/关标签/切后台，H5 Playwright 在文档卸载前无法观测到达响应。需 Root/native 或 devtools 条件。 |
| 跨 owner 迟到响应（正常 logout/login） | NOT_RUN | 唯一的退出登录 UI 在 `pages/profile`，assessment 无公开入口可达；且退出会中止在途上下文。未构造，不声称已覆盖。 |
| `onBackPress`（浏览器/Android 物理返回拦截） | NOT_RUN | 页面控件只覆盖 `requestLeave('back')`；H5 浏览器后退在确认框出现前即卸载文档。脚本已覆盖同一 `navigate('back')` 出口，但物理返回需 native。 |
| native / 实体设备 / 真实后台 / real IAM / DB | NOT_RUN | 本 suite 只有合成传输；`report.native`、`report.realBackend` 固定 NOT_RUN。 |
| CDP touch 能力缺失时的 P2 剩余项 | NOT_RUN | 首个 `touchEnd` 未激活时脚本记 FAIL 并停止后续触摸项，不补写结论。 |
| settings/home 自身写功能、通知偏好保存 | NOT_RUN | 只为离开确认补了挂载读；未验证目标页自身写入。 |
| 视觉/200% 文字/主题/宽度矩阵 | 不在本 suite 范围 | 已由既有 C3/文本组负责，本组只做交互风险。 |

## 7. 需要 Root 观察的静态风险（[读取]/[推断]，非 PASS/FAIL）

1. `[读取]` uni-app H5 的 `<button>` 编译为 `<uni-button>` 自定义元素（`apps/mobile/node_modules/@dcloudio/uni-h5/dist/uni-h5.es.js:1776`），其组件只绑定 `onClick`，没有 keydown/keyup 激活逻辑；`[推断]` 真实 Enter/Space 很可能**不触发**选项或主操作。这正是 `risk-keyboard.cjs` 会如实记录 FAIL 的地方。
2. `[读取]` `assessment.vue` 的 `button:focus-visible`/`button[disabled]`/`button::after` 选择器针对原生 `button` 标签；实际元素是 `uni-button`；`[推断]` 自定义 2px 焦点环与 disabled 样式可能不生效，仅剩 UA 默认焦点环。键盘组会实测 outline。
3. `[读取]` `#assessment-submit` 未选时通过组件 `disabled` 阻止 click（`onClick` 内 `stopImmediatePropagation`）；`[推断]` 指针安全，但 `tabindex="0"` 仍可能让禁用按钮进入 Tab 序。
4. `[读取]` 全局 `.yx-page button:active:not([disabled])` 才加 `translateY(1px)`；assessment 根节点是 `.assessment-page` 且元素为 `uni-button`；`[推断]` 实测位移很可能为 0，脚本仍强制 ≤1.01px 上限与旧中心命中。
5. `[读取]` 提交成功后 `watch(questionIdentity)` 清空选择，但只有 `retest`/确认框会主动 `focus()`；`[推断]` 新题焦点可能停在已禁用的 submit 上，`K1-new-question-focus-not-on-disabled-submit` 会记录。
6. `[读取]` `store.submitPlacementAnswer` 在 409 时会 `readPlacement` 对账；若读回也失败，最终 `placementStatus='offline'` 且保留 session 指针；脚本用连续 GET 503 验证“不新开 session”。
7. `[读取]` `ensurePlanFromReport` 失败只写 `planNotice`，不重排计划；脚本断言 report 仍可见、notice 非空、`/learning/today` 不被当作成功刷新。

## 8. 证据等级与不声明

- 本文所有 hash/端口/文件事实为 `[实测]`（命令见 checkpoint）；静态行为为 `[读取]` 或 `[推断]`。
- 未运行任何 case：本目录没有 PASS、没有截图、没有 `runs/` 结果。
- 不声称已验、不声称整页完成、不认领其他页；准备完成即停。
