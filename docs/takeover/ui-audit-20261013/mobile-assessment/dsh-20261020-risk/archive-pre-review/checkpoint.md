# DSH 断点 — MB006 独立风险 suite（PREPARED / NOT_RUN）

- 时间：2026-10-20T14:35–15:0xZ（本地 22:35 起）；分支 dev-redesign，HEAD `687af1017b8ae93da4f8c247ba12ed974898bb22`。
- 状态：**准备完成即停。没有启动浏览器、没有跑 case、没有 PASS、没有 runs/ 结果。** 不声称已验、不声称整页完成、不认领其他页。
- 写入范围：仅 `docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/`；产品/原 fixture/其他 DSH 的 c3 脚本/服务/依赖/端口/Git 均未动。

## 落盘（10 个文件）

| 文件 | SHA256（本机 2026-10-20 实测） |
|---|---|
| `README.md` | `2e0096f1239cacd4193ad419e48d6dd8f6f8fb1894547b82645d367c4f2c29ac` |
| `source-freeze.json` | `0014b781c3a5656068418d6a76dcccb22c138c94b2fb6a1a77227ee4a2fe81ca` |
| `manifest.template.json` | `1b0a0355e088d673f14a718440f4c90067338e233ade28a8988d1ebf25024144` |
| `fixture.cjs` | `acbcc5c63a1d6c857fe9073c22688980ea9515e55cf832da0ad31aef95349e51` |
| `risk-lib.cjs` | `d4f793bae553d4b74afc20362aa3f9c420b5c294c829667f2f58c484a704d537` |
| `risk-keyboard.cjs` | `9e08fa4049203217037786dbbd79efa238c02986917015e12665dfb80e589076` |
| `risk-pointer.cjs` | `b60464427b3b3058be610dcd318ec46d00b761d3bd28932a3b998f6c3904a7b0` |
| `risk-leave.cjs` | `c5f763f4cbd6139c5397146e506f837e6413ab4ffe2cde016a094244a52e2674` |
| `risk-busy-retest.cjs` | `c68d62c97b318061e24d1ca36ad6278b777ffdaa06ee35c7f432dbe815419ccf` |
| `checkpoint.md` | 本文件 |

`node --check` 对 6 个 `.cjs`（fixture + lib + 4 组）全部通过（2026-10-20 本机，Node v20.19.5）。未执行其他 node 脚本。

## 冻结与运行环境（实测）

- 8 源 SHA256 见 `source-freeze.json`，与任务给定 page `86620ed0…`、i18n `6ac6800e…` 一致。
- `netstat -ano` 显示 `127.0.0.1:18183 LISTENING PID 40996`；`Get-Process 40996` 为 node，StartTime `2026-10-20 22:28:50`（本地）。与给定服务事实一致；本会话未重启/停止/改端口。
- 越界说明（如实记录）：为确认监听，准备期执行过一次只读 `Invoke-WebRequest http://127.0.0.1:18183/`（HTTP 200，非浏览器、非模块探针、未改任何状态）。此外未再探测。

## 四组脚本覆盖

1. `risk-keyboard.cjs`：12 步 Tab 序、Shift+Tab、`:focus-visible`/outline、Enter/Space 选项各一次、未选 submit 禁用、键盘提交单写、busy 重复键不双写、新题清选与焦点事实。
2. `risk-pointer.cjs`：0/160ms 真实 mouse 中心按压、旧中心命中、`|Δy|<=1.01`、drag 出界、CDP `touchEnd` vs `touchCancel`、503 后 pointer 读回、重复提交/选项锁。
3. `risk-leave.cjs`：settings/back 离开确认、取消零导航零写保选择、确认后 actual route、busy 锁背/设置、真实返回同 session 无新 start、无选择 back→home、“重载+合成账号登录”恢复同 checkpoint。
4. `risk-busy-retest.cjs`：hold 时 busy 稳定与真实双击单写、retest 确认/取消/503 保旧报告/重试成功新 session、ensure 503 仍显真实 report + 人话 notice + 无假计划成功、两次 GET 503 不新开 session 后恢复。

## NOT_RUN / GAP（已写进 README，不伪造）

- 同 owner hide/迟到响应：busy 锁死页内导航，唯一 hide 触发是浏览器后退/关页/切后台，H5 无法在文档卸载前观测。
- 跨 owner 迟到响应：assessment 无公开 logout 入口（唯一在 `pages/profile`），退出会中止在途上下文。
- `onBackPress` 物理/浏览器返回拦截：未测；同一 `navigate('back')` 出口已覆盖。
- native/实体设备/真实后台/IAM/DB：固定 NOT_RUN。
- settings/home 自身写功能：只补最小挂载读。
- 视觉/200% 文字/主题/宽度：不在本 suite（既有 C3/文本组）。

## Root 运行命令（DSH 未执行）

```powershell
$env:MB006_CONFIRM_BROWSER='1'
$env:MB006_RISK_RUN='codex-review-kbd-1'
$env:MB006_RISK_EXECUTOR='codex-review'
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/risk-keyboard.cjs
# 其余三组各用新的 MB006_RISK_RUN（或不同 group 目录）：
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/risk-pointer.cjs
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/risk-leave.cjs
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/risk-busy-retest.cjs
```

输出 `runs/<runId>/<group>/`；exit 2=守卫拒绝，1=FAIL/异常/源漂移，0=仅已执行 checks 全 PASS（不代表整页完成）。报告 `label: Codex review`、`preparedBy: DSH`，fixture/native/realBackend 分栏。

## 需要 Root 现场观察的静态风险（[读取]/[推断]）

1. uni-button 只绑定 `onClick`，无键盘激活；Enter/Space 很可能 FAIL（脚本会如实记录并写 fallbacks）。
2. `button:focus-visible`/`button[disabled]`/`button::after` 选择器与 `uni-button` 标签不匹配，可能只剩 UA 默认焦点环。
3. 禁用 submit 仍 `tabindex=0`，可能进入 Tab 序。
4. 全局 1px active 规则限定 `.yx-page button`，本页根为 `.assessment-page` + `uni-button`，实测位移可能为 0；脚本仍强制 ≤1.01 与旧中心命中。
5. 新题清选但无 `focus()`，焦点可能停在已禁用 submit。
6. `ensurePlanFromReport` 失败只写 planNotice；脚本验证 report/notice/不刷新 today。
7. 连续读回失败保留 session 指针；脚本验证不新开 session。

## 暂停

准备线到此为止（约 95%）。Root 发停即不再新增工作；后续只按指示写断点或等待审核结果。不把本断点当验收。
