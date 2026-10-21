# C3 Root 首轮审核记录（2026-10-20）

## 现状

- 运行产物：`runs/c3/results.json`（`at=2026-10-20T14:21:20Z`，label `C3 (page 86620ed0 / i18n 6ac6800e)`，`closed=true`、`sourceStable=true`、`pageErrors=[]`、页面 unknown 0、14 张实图）。
- 结论：23 checks / **5 FAIL**；C3 **未签**，不算整页完成。尚无 Root run2 结果，故不得写“已修/PASS”。
- 运行方：**Root 在其独立审核环境执行**；`results.json` 与截图归属 Root，不是 DSH 作者运行、不是作者 PASS。作者侧仍为 `BLOCKED_BROWSER_LAUNCH`（`spawn EPERM`）。

## 5 FAIL 细分（逐项）

| # | check | 实际 | 分类 |
|---|---|---|---|
| 1 | `first-question-meta-one-line` | meta 文本出现裸 key `mobile.assessment.completedCount` | 旧服务模块 |
| 2 | `second-question-completed-count` | 同上，第 2 题仍为裸 key | 旧服务模块 |
| 3 | `progress-aria-first-question-zero` | 旧 ARIA：「已接收答案进度」「已接收 0 题，共 10 题」 | 旧服务模块 |
| 4 | `aria-tracks-accepted-not-step` | 旧 ARIA：「已接收 1 题，共 10 题」 | 旧服务模块 |
| 5 | `text200-question-h1-readable` | `overflow=true`，`h1Split=[]`（题目区横向溢出） | 布局/200% |

标题项：`text200-guide-h1-readable`、`text200-result-h1-readable` 均 PASS 且 `h1Split=[]`；`Level check` / `Your result` 逐词不拆——**不能**说标题再次失败。第 5 项是横向 overflow，不是拆词。

## 缓存/服务模块证据

- `runs/c3-root-review/served-module-probe.json`（`at=2026-10-20T14:26:12Z`，只读）：18183 实际服务模块 `sha256=81de3f9271161eca579e6b8717b6329fffecd5b33aa413ebcf1c5ad435699a48`，`verdict=FILE_NEW_SERVED_OLD`。
- 同文件 `local`：`packages/i18n/src/mobile-experience.ts` `sha256=6ac6800e…`，`completedCount=true`、`newZhProgress=true`、`oldZhReceived=false`；`served` 侧相反（`completedCount=false`、`oldZhReceived=true`、`newZhProgress=false`）。
- 归因：本地源已含新键，失败与旧服务模块/缓存一致，**不是 C3 源被判产品 FAIL**；Root 现准备只刷新其自己启动的审核服务。刷新后须产生新 run，再据新结果判定。

## 边界

- 本文件不复制 `results.json` 原件、不改脚本、不改 C1/C2 旧证据；截图目录未由本记录新增或覆盖。
- DSH 作者未运行浏览器；本记录依 Root 已核事实与只读 JSON 写为文档，不构成 UI 签收。
