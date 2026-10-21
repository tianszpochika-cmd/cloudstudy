# MB006 独立风险 suite（DSH prepared / Root executed）

本目录包含**由 DSH 准备、由 Root 在独立审核环境执行的脚本、fixture 副本和证据模板**。DSH 没有启动浏览器；Root 的执行结果保留在 `runs/` 并在 `archive-pre-review/root-runs/` 有字节副本。这里的任何文件都不构成页面验收、远程发布或整页完成声明。

- 允许写目录：`docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/`
- 产品源码、原 fixture、c3 脚本、服务、依赖、store 均未改动。
- 运行报告固定 `label: "Codex review"`、`preparedBy: "DSH (independent risk-test author; ...)"`，并把 `fixture / native / realBackend` 分开记录。

## 1.1 Root 实际执行结果（r3 修订前，原样保留）

下表为 `runs/` 内结果文件的读取值（`[实测]`，读取时刻 2026-10-20；executor 来自各报告）：

| 组 | runId | executor（报告内） | checks | pass | fail | result | 说明 |
|---|---|---|---|---|---|---|---|
| keyboard | `codex-review-kbd-1` | `Codex independent keyboard review` | 30 | 29 | 1 | FAIL | 唯一 FAIL 是旧断言 `K1-shift-tab-reverses-without-loss`；r3 只修该断言，未重跑 |
| pointer | `codex-review-pointer-1` | `Codex independent pointer review` | 30 | 30 | 0 | PASS_EXECUTED_CHECKS | — |
| leave | `codex-review-leave-1` | `Codex independent leave review` | 26 | 23 | 3 | FAIL | Root 分类：#1 `L1-back-without-selection-exits-to-home` 为 assertion（实际回到上一页 login），但陈旧登录 UX 风险不豁免；#2 `L1-relogin-recovery-no-new-start` 为 recovery，根因未定位；#3 依赖 #2 的不完整断言，不能据此称选择丢失。本轮未改 leave。 |
| busy-retest | `codex-review-busy-1` | `Codex independent busy retest review` | 31 | 31 | 0 | PASS_EXECUTED_CHECKS | — |

四组的 `sourceStable` 均为 true、`closed` 均为 true（读取各 `results.json`）。原文件未移动；`archive-pre-review/root-runs/` 为字节副本，`archive-pre-review/ROOT-RUNS-MANIFEST.json` 记录 27 个文件的 hash。

**keyboard FAIL 归因（Root 指出，r3 接受）**：旧断言在做了 12 次前进 Tab 后直接按两次 Shift+Tab，要求两步都留在页内。实际顺序是 `assessment-back` → `body`——文档不是模态焦点陷阱，从第一个控件反向离开页面是自然边界，不构成产品失败。旧证据 `runs/codex-review-kbd-1/keyboard/results.json` 与截图保留；预修脚本字节在 `archive-pre-review/risk-keyboard.pre-r3.cjs`（SHA256 `58093814…`）。

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

原文件 `docs/takeover/ui-audit-20261013/mobile-assessment/20261016-review-prep/fixture.cjs`（SHA256 `6FFB98D4...`）保持原样；本目录副本只做以下**可审计增量**：

1. 新增 `hasTouch` context 选项，用于 CDP 触摸用例；
2. 新增四个**目标页最小读**：`GET /api/v1/notifications/preferences` 与 `GET /api/v1/support/tickets`（settings 挂载读取）、`GET /api/v1/learner/home` 与 `GET /api/v1/content/learner/catalog`（home 挂载读取）。路径与解析形状来自 `apps/mobile/src/api/{b12,learner-content,support}.ts`、`domain/it7-closure.ts` 与页面源码；这些请求单独记入 `report.targetReads`，不混入 assessment 请求；
3. `report.targetReads` 字段；
4. `report.injectedFailures` 字段：当本 case 的 `startError/responseError/retestError/ensureError/getError/principalStatus` 真的产生非 2xx 时，只记录 `id/method/path/status/injection`；资源失败类 console 额外记录 `path`（仅 URL pathname，且仅用于逐条匹配），不读/存 body/header/token。

保留的原语义：真实登录页/guard、合成账号、全部 API 拦截、未知路由 501、非 API 只允许 `http://127.0.0.1:18183`、不读 cookie/storage/header/body、不替换 store/guard/组件行为。fixture 仍只在显式 `init()` 后启动 Chromium。

## 4. 运行方式（Root 审核环境）

服务已由 Root 刷新到固定 18183；脚本不启动/停止服务、不改端口。**Root 已按下面命令执行过四组（首轮结果见 §1.1）；DSH 未执行；r3 修订后未复跑。**复跑必须用新的 `MB006_RISK_RUN`，旧目录会被拒绝。

```powershell
$env:MB006_CONFIRM_BROWSER='1'
$env:MB006_RISK_RUN='codex-review-kbd-2'      # r3 复跑示例；每次新 runId，已存在目录会被拒绝
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
- 控制台：默认不排除任何 console error。只有同时满足以下三条才排除单条：①fixture 在该 case 确实注入了非 2xx（`report.injectedFailures` 记录 `id/method/path/status/injection`）；②该条 console 的原始文本是浏览器 `Failed to load resource` 资源失败；③该条的资源 pathname 与注入 path 完全一致且文本含同一 status。`results.json` 会保存原始 console 文本、path 与逐条排除理由（`excluded`），未知 501、非预期 401/403、`net::ERR_*` 或其他资源失败一律保留并计 FAIL。
- 键盘激活：`platform/experience.ts` 的 `installMobileKeyboard`（`main.ts` 调用）会在 `keydown` Enter/Space 时对 `UNI-BUTTON` 调 `click()`，并跳过 `disabled`/`aria-disabled=true`。因此“无键盘激活”不能预设；脚本只实测，若仍无效果则记 FAIL 并写 `fallbacks`（pointer 仅作 setup），不预写 PASS。CDP touch 若在本机不可用，P2 记 NOT_RUN 并停止，不伪造触摸结论。
- 反向 Tab：先用真实 Tab 锚定到 `assessment-home`，再 Shift+Tab 两次，断言顺序为 `assessment-start` → `assessment-settings` 且每步有可见 indicator；不再要求 12 次前进 Tab 后的未知位置必须留在页内。从第一个控件继续 Shift+Tab 离开页面属自然文档边界，只写入 `results.json` 的 `focusBoundary` 观察，不计 PASS/FAIL（r3 修正）。

## 6. NOT_RUN / GAP（只说明本准备脚本的构造范围）

| 分支 | 状态 | 本准备脚本的范围 |
|---|---|---|
| 同 owner hide/迟到响应 | NOT_RUN | 本准备脚本未构造该场景（hold 时页内导航为 busy 锁定，脚本只覆盖该锁定本身）。未测不等于产品不可测；Root 可另补正常 history/tab-hide 场景。 |
| 跨 owner 迟到响应（正常 logout/login） | NOT_RUN | 本准备脚本未构造该场景，也未声称 assessment 没有其他真实入口。Root 另补正常 logout/login 流程。 |
| `onBackPress`（浏览器/Android 物理返回拦截） | NOT_RUN | 本准备脚本只覆盖页面内 `requestLeave('back')` → `navigate('back')` 出口；物理/浏览器返回未测。Root 指出旧理由中“browser-back 不可能观察”只是旧假设、不是已证事实；生命周期 harness 正用真实 history 准备，native/browser-back 仍 NOT_RUN。 |
| native / 实体设备 / 真实后台 / real IAM / DB | NOT_RUN | 本 suite 只有合成传输；`report.native`、`report.realBackend` 固定 NOT_RUN。 |
| CDP touch 能力缺失时的 P2 剩余项 | NOT_RUN | 首个 `touchEnd` 未激活时脚本记 FAIL 并停止后续触摸项，不补写结论。 |
| settings/home 自身写功能、通知偏好保存 | NOT_RUN | 只为离开确认补了挂载读；未验证目标页自身写入。 |
| 视觉/200% 文字/主题/宽度矩阵 | 不在本 suite 范围 | 已由既有 C3/文本组负责，本组只做交互风险。 |

## 7. 需要 Root 观察的静态风险（[读取]/[未验证]/[推断]，非 PASS/FAIL）

1. `[读取]` 已存在全局键盘桥：`apps/mobile/src/platform/experience.ts:64-75` 的 `installMobileKeyboard` 监听 document `keydown`，对 Enter/Space 的 `UNI-BUTTON` 检查 `disabled`/`aria-disabled` 后 `preventDefault()` 并 `target.click()`；`apps/mobile/src/main.ts:28` 调用它。`[Root 实测]` keyboard run 中 Enter 启动、Enter/Space 选项、键盘提交、busy 重复键等检查均 PASS，桥生效；唯一 FAIL 是反向顺序断言，见 §1.1。
2. `[读取]` `assessment.vue` 的样式里写的是 `button:focus-visible`/`button[disabled]`/`button::after`；`[Root 实测]` 焦点检查记录 `outlineStyle: solid`、`outlineWidth: 2px`、`focusVisible: true`，未见“只剩 UA 默认环”的问题。`[未验证]` 仍不据此断言所有 uni-app 标签映射都一致。
3. `[读取]` `#assessment-submit` 未选时通过组件 `disabled` 阻止 click（`onClick` 内 `stopImmediatePropagation`）；`[推断]` 指针安全，但模板 `tabindex="0"` 是否让禁用按钮进入 Tab 序需实测，脚本会记录焦点序列。
4. `[读取]` 全局 `.yx-page button:active:not([disabled])` 才加 `translateY(1px)`；本页根节点写的是 `.assessment-page`，且 `<button>` 在 H5 的实际元素形态需实测确认；`[Root 实测]` pointer run 30/30 通过（含 0/160ms、旧中心命中、`≤1.01px` 位移），本轮未见该风险。
5. `[读取]` 提交成功后 `watch(questionIdentity)` 清空选择，但源码里只有 `retest`/确认框主动 `focus()`；`[Root 实测]` `K1-new-question-focus-not-on-disabled-submit` PASS，未复现“焦点停在禁用 submit”。
6. `[读取]` `store.submitPlacementAnswer` 在 409 时会 `readPlacement` 对账；若读回也失败，最终 `placementStatus='offline'` 且保留 session 指针；脚本用连续 GET 503 验证“不新开 session”。
7. `[读取]` `ensurePlanFromReport` 失败只写 `planNotice`，不重排计划；脚本断言 report 仍可见、notice 非空、`/learning/today` 不被当作成功刷新。

## 8. 证据等级、归档与不声明

- 本文所有 hash/端口/文件事实为 `[实测]`（命令见 checkpoint）；静态行为为 `[读取]`，未实测的映射/样式/焦点行为标 `[未验证]`/`[推断]`；Root 运行结果标 `[Root 实测]`，以 `runs/` 原文件为准。
- 归档未删除：`archive-pre-review/` 含预审前四文件与 `ARCHIVE-MANIFEST.json`；`archive-pre-review/root-runs/` 含 Root 四组运行输出字节副本与 `ROOT-RUNS-MANIFEST.json`；`archive-pre-review/risk-keyboard.pre-r3.cjs` 是 r3 修订前的键盘脚本。
- 运行归属：DSH 没有启动浏览器；Root 已执行四组（结果见 §1.1）。r3 只改键盘反向断言和文档，**修订后未重跑**，因此不能声称新断言已通过；旧 FAIL 证据保留。
- leave 组现有 3 个 FAIL（§1.1 具名）在本轮范围外，未改脚本；按 Root 审核分类保留：#1 assertion（回到上一页 login）但陈旧登录 UX 风险未豁免、#2 recovery 根因未定位、#3 依赖 #2 的不完整断言。不伪造已解决，也不把它们当已覆盖。
- 不声称已验、不声称整页完成、不认领其他页。NOT_RUN 的语义是“本准备脚本未构造该场景”，不是对产品能力的断言。
