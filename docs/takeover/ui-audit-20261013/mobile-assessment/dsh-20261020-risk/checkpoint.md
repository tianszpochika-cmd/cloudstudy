# DSH 断点 — MB006 独立风险 suite（Root executed / r3 test-only fix）

- 时间：2026-10-20T14:35 起准备；r3 修订在 Root 首轮执行之后；分支 dev-redesign，HEAD `687af1017b8ae93da4f8c247ba12ed974898bb22`。
- 执行归属：**DSH 没有启动浏览器；Root 已执行四组**，原始结果在 `runs/` 并已字节归档。r3 只修键盘反向断言与文档，**修订后未重跑**，不能声称新断言通过。
- 写入范围：仅 `docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/`；产品/原 fixture/其他 DSH 的 c3 脚本/服务/依赖/端口/Git 均未动。
- 预审修正（Root review r2）：①按字节归档预审前四文件到 `archive-pre-review/`；②`caseErrors` 改为逐条严格匹配 `report.injectedFailures`（id/method/path/status），保存原 console 文本与排除理由，不再用 `/Failed to load resource|503|401|403|net::ERR_/` 笼统排除；③撤回“uni-button 无键盘激活/样式选择器不匹配”的静态推断，改为实测口径。
- r3 修正（Root 首轮结果后）：键盘旧 FAIL `K1-shift-tab-reverses-without-loss` 是测试假设错误——文档不是模态焦点陷阱，12 次 Tab 后 Shift+Tab 到 `assessment-back` 再到 `body` 属自然边界。改为锚定 `assessment-home` 后用真实 Tab 反向两次，验证 `assessment-start` → `assessment-settings`；边界只写 `focusBoundary` 观察，不计 FAIL。原始 FAIL 输出与预修脚本字节均保留。

## Root 首轮实际结果（原样保留）

| 组 | runId | checks | pass | fail | result |
|---|---|---|---|---|---|
| keyboard | `codex-review-kbd-1` | 30 | 29 | 1 | FAIL（仅旧反向断言） |
| pointer | `codex-review-pointer-1` | 30 | 30 | 0 | PASS_EXECUTED_CHECKS |
| leave | `codex-review-leave-1` | 26 | 23 | 3 | FAIL（Root 分类：#1 assertion→实际回上一页 login，但陈旧登录 UX 风险不豁免；#2 recovery 根因未定位；#3 依赖 #2 的不完整断言。本轮未改 leave） |
| busy-retest | `codex-review-busy-1` | 31 | 31 | 0 | PASS_EXECUTED_CHECKS |

四组 `sourceStable=true`、`closed=true`（读取各自 `results.json`）。原始输出未移动：`runs/codex-review-kbd-1/keyboard/` 等；字节副本在 `archive-pre-review/root-runs/`，`ROOT-RUNS-MANIFEST.json` 记录 27 个文件 hash；预修键盘脚本在 `archive-pre-review/risk-keyboard.pre-r3.cjs`（`58093814…`）。Root 的复核记录 `ROOT-REVIEW-20261020.md` 是 Root 文件，本轮未改、未列入下方 hash 表；leave/back 的分类以它为准。

## 落盘（DSH 10 个文件 + Root 复核记录）

| 文件 | SHA256（本机 2026-10-20 实测） |
|---|---|
| `README.md` | `8f1e6e5291f965053290de9ce225c450907419c6063ca9861b1af68cd1f4a96f` |
| `source-freeze.json` | `0014b781c3a5656068418d6a76dcccb22c138c94b2fb6a1a77227ee4a2fe81ca` |
| `manifest.template.json` | `434e954954783fbd76d283ad6bae7aad1fa94c3a1a639e377ad2332ad02d6389` |
| `fixture.cjs` | `c61daef32fb0e29ee93bff4d6d97900ec06c7d4bdc03d4a75bbce3fbef60a4a6` |
| `risk-lib.cjs` | `8d113500891bd7827b9389be6e1b4a2e4766abbcf4dce144a6e6bb899cfbfd06` |
| `risk-keyboard.cjs` | `e033cd779f54073a68e4ea0b04717b6589e3ff5333c3c23336c9f3c41dbd6151` |
| `risk-pointer.cjs` | `b60464427b3b3058be610dcd318ec46d00b761d3bd28932a3b998f6c3904a7b0` |
| `risk-leave.cjs` | `c5f763f4cbd6139c5397146e506f837e6413ab4ffe2cde016a094244a52e2674` |
| `risk-busy-retest.cjs` | `c68d62c97b318061e24d1ca36ad6278b777ffdaa06ee35c7f432dbe815419ccf` |
| `checkpoint.md` | 本文件 |

预审前原字节在 `archive-pre-review/`（4 文件 + `ARCHIVE-MANIFEST.json`）：`fixture.cjs acbcc5c6…`、`risk-lib.cjs d4f793ba…`、`README.md 2e0096f1…`、`checkpoint.md 851dea1a…`。归档不计入上面的 10 个文件。

Root 首轮输出未改动：`runs/` 四组保留；`archive-pre-review/root-runs/` 为字节副本（27 文件），`ROOT-RUNS-MANIFEST.json` 记 hash；`archive-pre-review/risk-keyboard.pre-r3.cjs` 为 r3 前脚本（`58093814…`）。r3 后未重跑。

`node --check` 对 6 个 `.cjs`（fixture + lib + 4 组）全部通过（2026-10-20 本机，Node v20.19.5）。未执行其他 node 脚本，未启动浏览器。

## 冻结与运行环境（实测）

- 8 源 SHA256 见 `source-freeze.json`，与任务给定 page `86620ed0…`、i18n `6ac6800e…` 一致。
- `netstat -ano` 显示 `127.0.0.1:18183 LISTENING PID 40996`；`Get-Process 40996` 为 node，StartTime `2026-10-20 22:28:50`（本地）。与给定服务事实一致；本会话未重启/停止/改端口。
- 越界说明（如实记录）：为确认监听，准备期执行过一次只读 `Invoke-WebRequest http://127.0.0.1:18183/`（HTTP 200，非浏览器、非模块探针、未改任何状态）。此外未再探测。

## 四组脚本覆盖

1. `risk-keyboard.cjs`：12 步 Tab 序、Shift+Tab、`:focus-visible`/outline、Enter/Space 选项各一次、未选 submit 禁用、键盘提交单写、busy 重复键不双写、新题清选与焦点事实。
2. `risk-pointer.cjs`：0/160ms 真实 mouse 中心按压、旧中心命中、`|Δy|<=1.01`、drag 出界、CDP `touchEnd` vs `touchCancel`、503 后 pointer 读回、重复提交/选项锁。
3. `risk-leave.cjs`：settings/back 离开确认、取消零导航零写保选择、确认后 actual route、busy 锁背/设置、真实返回同 session 无新 start、无选择 back→home、“重载+合成账号登录”恢复同 checkpoint。
4. `risk-busy-retest.cjs`：hold 时 busy 稳定与真实双击单写、retest 确认/取消/503 保旧报告/重试成功新 session、ensure 503 仍显真实 report + 人话 notice + 无假计划成功、两次 GET 503 不新开 session 后恢复。

## NOT_RUN / GAP（只说明本准备脚本的构造范围，不断言产品不可测）

- 同 owner hide/迟到响应：本准备脚本未构造该场景（脚本覆盖的是 hold 时页内导航被 busy 锁定这一事实）。Root 可另补正常 history/tab-hide 场景，DSH 不据此推断 H5 不可观测。
- 跨 owner 迟到响应：本准备脚本未构造 logout/login 在途切换，也未声称 assessment 没有其他真实入口。Root 另补正常 owner 场景。
- `onBackPress` 物理/浏览器返回拦截：本准备脚本只覆盖页面内 `requestLeave('back')` → `navigate('back')` 出口；物理/浏览器返回未测。Root 指出旧 `notRun` 理由里“browser-back 不可能观察”只是旧假设、不是已证事实，生命周期 harness 正用真实 history 准备；native/browser-back 仍 NOT_RUN。
- native/实体设备/真实后台/IAM/DB：固定 NOT_RUN。
- settings/home 自身写功能：只补最小挂载读。
- 视觉/200% 文字/主题/宽度：不在本 suite（既有 C3/文本组）。

## 复跑命令（Root 首轮已执行；r3 后未复跑）

```powershell
$env:MB006_CONFIRM_BROWSER='1'
$env:MB006_RISK_RUN='codex-review-kbd-2'   # 必须新 runId；已存在目录会被拒绝
$env:MB006_RISK_EXECUTOR='codex-review'
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/risk-keyboard.cjs
# 其余三组各用新的 MB006_RISK_RUN（或不同 group 目录）：
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/risk-pointer.cjs
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/risk-leave.cjs
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/risk-busy-retest.cjs
```

输出 `runs/<runId>/<group>/`；exit 2=守卫拒绝，1=FAIL/异常/源漂移，0=仅已执行 checks 全 PASS（不代表整页完成）。报告 `label: Codex review`、`preparedBy: DSH`，fixture/native/realBackend 分栏。

## 需要 Root 现场观察的静态风险（[读取]/[Root 实测]/[未验证]，非 PASS/FAIL）

1. `[读取]` 已有全局键盘桥：`platform/experience.ts:64-75` 的 `installMobileKeyboard` 监听 document `keydown`，对 Enter/Space 的 `UNI-BUTTON` 跳过 `disabled`/`aria-disabled` 后 `preventDefault()` + `target.click()`；`main.ts:28` 调用。`[Root 实测]` Enter 启动、Enter/Space 选项、键盘提交与 busy 重复键检查均 PASS，桥生效；旧“无键盘激活”推断已作废。
2. `[读取]` 源样式写 `button:focus-visible` 等；`[Root 实测]` 焦点记录 `outlineStyle=solid`、`outlineWidth=2px`、`focusVisible=true`，未复现“只剩 UA 默认环”。`[未验证]` 不据此外推所有标签映射。
3. `[读取]` 禁用 submit 通过组件 `disabled` 阻止 click；`[推断]` 指针安全，但模板 `tabindex="0"` 是否进入 Tab 序需实测（脚本记录焦点序列）。
4. `[读取]` 全局 1px active 规则是 `.yx-page button:active:not([disabled])`；本页根为 `.assessment-page`；`[Root 实测]` pointer run 30/30 通过（含 0/160ms、旧中心命中、`≤1.01px` 位移），未复现该风险。
5. `[读取]` 新题清选但源码无主动 `focus()`；`[Root 实测]` `K1-new-question-focus-not-on-disabled-submit` PASS，未复现“焦点停在禁用 submit”。
6. `[读取]` `ensurePlanFromReport` 失败只写 planNotice；脚本验证 report/notice/不刷新 today（Root busy run 31/31 PASS）。
7. `[读取]` 连续读回失败保留 session 指针；脚本验证不新开 session（Root busy run 31/31 PASS）。

## 证据口径修正（r2/r3）

- `fixture.cjs` 新增 `report.injectedFailures`：只在本 case 的注入开关真的产生非 2xx 时记录 `id/method/path/status/injection`，不存 body/header/token。
- `risk-lib.cjs` 的 `caseErrors` 只排除“该 case 确有注入 + console 是 `Failed to load resource` + pathname 与注入 path 完全一致 + 文本含同一 status”的单条；保留原始 console 文本、path 与逐条 `reason`。未知 501、非预期 401/403、`net::ERR_*`、其他资源失败一律不排除。
- 预审前四文件原字节在 `archive-pre-review/`，`ARCHIVE-MANIFEST.json` 记录其 hash。
- r3 只改 `risk-keyboard.cjs` 的反向断言与 README/checkpoint/archive；`runs/` 原样保留，未重跑、未改产品。

## 暂停

准备线到此为止（约 95%）。Root 发停即不再新增工作；后续只按指示写断点或等待审核结果。不把本断点当验收。
