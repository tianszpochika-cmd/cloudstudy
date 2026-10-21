# MB006 C3 作者 checkpoint（phaseA 候选，浏览器未验）

日期 2026-10-20（CST）。角色分工：**DSH 作者**负责实现与本文件所列证据；**Codex 仅分发与独立审查**，不是这些源码的作者；**Root** 负责监测/停工并在自己的审核环境独立复验。最新额度停工线为 **95%**（不是旧的 90%），由 Root 监测与发令；本会话未使用/未修改 DSH 配置，不声明任何运行中模型档位。

状态一句话：C3 两源已冻结；`typecheck` 实际 PASS；`build:h5` 因执行环境 **BLOCKED_EXECUTION_BOUNDARY**；作者侧浏览器 **BLOCKED_BROWSER_LAUNCH**；无整页签收、无 Git 写、无提交/推送；完整矩阵与真实后台/native 均 **NOT_RUN**。

## 1. 冻结源（精确 raw / LF）

| 文件 | 阶段 | raw SHA-256 | LF SHA-256 | bytes |
|---|---|---|---|---|
| `apps/mobile/src/pages/assessment/assessment.vue` | C3 当前 | `86620ed0dbc2cb25afb4bbae35734a345b9e8066afa806684f99ccb678a5312d` | `86620ed0dbc2cb25afb4bbae35734a345b9e8066afa806684f99ccb678a5312d` | 31477 |
| `packages/i18n/src/mobile-experience.ts` | C3 当前 | `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380` | `a05811165062a18a1fb246f8867df30ef4c64183363119e31009265c8ac8c8fe` | 32760 |

C2 基线（本次改动前，已留原字节）：page `d1b501e33b313679bd5c90dd8fcda8e9a5a6b790856a444b01e915523827366a`；i18n `44e4c857868f8be2bac17f7da86f43c9ea0d03eaaadd3a3f154414d02f129c64`。更早正式页 `30cfa42c...` 仅作历史，不用于覆盖。`assessment.vue` 为纯 LF；i18n 为 CRLF（raw≠LF，均为 119 行全 CRLF，无混合）。原字节在 `baseline/assessment.vue.raw`、`baseline/mobile-experience.ts.raw`；C3 清单 `runs/c3/source-manifest.json`。

## 2. 改动（仅 page + i18n 的 assessment 键）

- page：新增 `completedText`；题目元信息右侧由 `{{accepted}}/{{total}}` 改为「已完成 N 题」；删除重复可见行 `.assessment-received` 及其 CSS。题序仍来自 `questionCount`（stepIndex），不拿题号充进度。
- i18n assessment 键：新增 `completedCount`（`已完成 {count} 题` / `Completed {count}`）；`received` 改为 `已完成 {count} 题，共 {total} 题` / `Completed {count} of {total}`（仅用于 `aria-valuetext`）；`progress` 改为 `答题进度` / `Answer progress`。
- 保留：`acceptedSequence` clamp 后的 `aria-valuenow`、`aria-valuemax`、`aria-valuetext`、4px track、首题完成数 0、16px 正文、≥44px 目标、AppIcon、语义 token 与四主题；未改 store/API/session/auth/导航/共享 Header/其他页面/合同/后端/依赖锁。
- 精确增量 diff：`runs/c3/diff-page-vs-C2.diff`、`runs/c3/diff-i18n-vs-C2.diff`（相对 C2 原字节，非相对 Git HEAD）。

## 3. 实际跑过的命令与真实 exit

| 检查 | 命令（要点） | 实际结果 | 证据路径 |
|---|---|---|---|
| 语法自检 ×6 | `node --check scripts/*.cjs` | 每个 exit **0** | 见终端；脚本在 `scripts/` |
| typecheck | `pnpm --filter @englishflow/mobile typecheck` | exit **0**，约 11s，`tsc --noEmit` 通过 | `runs/c3/typecheck.log` |
| H5 模板构建 | `pnpm --filter @englishflow/mobile build:h5` | exit **1**，**BLOCKED_EXECUTION_BOUNDARY**：Vite `optimizeSafeRealPathSync` 内 `spawn EPERM`（`[plugin externalize-deps]`）；另有 `estree-walker` resolve 报错。构建未完成；**这不是 C3 产品构建失败结论** | `runs/c3/build-h5.log` |
| 56 保护漂移 | `node scripts/protection-drift.cjs` | 56 MATCH / 14 目录存在 / **drift 0** | `runs/c3/protection-drift.json`、`baseline/protection-drift.json` |
| C2 浏览器复验 | `node scripts/c2-text200.cjs` | exit **1**，Playwright `browserType.launch: spawn EPERM`；未创建 page/context/截图 | `runs/c2-text200/results.json` |

## 4. 浏览器结论（不得写成 UI PASS/FAIL）

- 作者侧为 **BLOCKED_BROWSER_LAUNCH**：Playwright 启动 `spawn EPERM`；外部 headless shell 也在 `mojo platform_channel.cc:108` 因 Win32 命名管道“拒绝访问”退出；`danger-full-access` 一次性升级被 `no approval channel` 拒绝。详见 `runs/c2-text200/BLOCKED_BROWSER_LAUNCH.md`、`STATUS.json`。
- 因此：C2 的 `Level check` / `Your result` **未获浏览器标题 PASS**，也**不是 C2 产品 FAIL**；C1 的真实 200% 拆词 FAIL（`Level / assessmen / t`）继续有效。C3 的 200% 三态、8 项 smoke、进度语义全部 **NOT_RUN**，作者未生成任何 C3 截图。
- `runs/c3/` 下**没有** `results.json`（c3 suite 未运行）；Root 可另审脚本后独立执行，届时产生的新证据归 Root，不预写 PASS。**（上句为作者时点历史记录；2026-10-20 Root 首轮运行后已产生 `runs/c3/results.json`，归属 Root，见 §10 与 `runs/c3/ROOT-RUN1-REVIEW.md`；原文保留不改。）**

## 5. 56 保护与工作区

- 保护清单只读自 `.git/codex-local-backups/ui-audit-20261013/preexisting-work.json`：56 个具名文件全部 MATCH，14 个目录存在，**0 漂移**（C3 改动不在该清单内）。
- 未改 Git/主进度/CHANGELOG/其他产品文件；未提交、未推送、未停/重启 18183/18180，未改端口。
- 探针进程：本会话曾以 `$p.Id` 启动 3 个临时 headless shell（PIDs 7856、33836、27680），均使用一次性临时 profile；其中 7856/27680 由本会话发出 `Stop-Process`，33836 自行退出。复查时无 `chrome-headless-shell.exe`、无 9333–9335 监听、无保留 `mb006-*` 临时目录；**未捕获到 OS 级 commandline/creation，PID 归属仅由本会话启动命令确认，严格说 UNVERIFIED 到 OS 级**。未关闭任何其他浏览器/服务/用户标签。
- 作者侧 Playwright context 数：**0**（launch 失败，未到 newContext）。

## 6. 旧结果保留（不升级）

- C1（page d1 / i18n d55）：typecheck 与 8 项 H5 smoke 曾 PASS；en 320×568 CSS200 两态真实 FAIL 保留。C2：仅静态确认 18183 实际服务模块含 `Level check`/`Your result`，未获布局 PASS。上述旧结果**不**升级为 C3/当前 hash 结论。

## 7. 待验矩阵（全部未签）

引导/题目/结果三态中英与四主题；320/390/768/1280；200% 文字与长词/长选项/多行错误；FULL/ZERO 反馈；提交失败/读回保留；重测确认成功路径与失败恢复；owner/hide 晚响应；0/160ms pointer、drag/cancel、键盘；plan ensure 失败提示；真实后台/IAM/Gateway 与 native/实体设备（分别 NOT_RUN）；wide/theme/pointer/keyboard/race 留给 Root 下一独立任务。

## 8. 未变边界

ADR-0027 正式 ASSESSED 自动 ensure、`planNotice`/pending 诚实、canonical skip 无 reportId 的 `GAP_CONTRACT_OWNER_WIRING`、retest helper body 兼容未测、unknown-start 无 pointer 的 `Retry start` 语义，均保持原状；未造报告/等级/自动签署/改开关。

## 9. 交接

Root 先审 `scripts/c3-verify.cjs` 与 `scripts/README.md`，再在可运行浏览器的独立审核环境执行；作者不声称整页完成或产品业务通过。

## 10. Root 首轮运行（2026-10-20，证据归 Root）

- 运行产物：`runs/c3/results.json`（`at=2026-10-20T14:21:20Z`，label `C3 (page 86620ed0 / i18n 6ac6800e)`），**由 Root 在其审核环境执行**，不是 DSH 作者运行、不是作者 PASS；`closed=true`、`sourceStable=true`、`pageErrors=[]`、页面 unknown 0，含 14 张实图。
- 总计 23 checks / **5 FAIL**，细分：
  1. `first-question-meta-one-line`：meta 渲染出裸 key `mobile.assessment.completedCount`；
  2. `second-question-completed-count`：同上，裸 key；
  3. `progress-aria-first-question-zero`：仍为旧 ARIA 文案「已接收答案进度」「已接收 0 题，共 10 题」；
  4. `aria-tracks-accepted-not-step`：同旧 ARIA 文案（`已接收 1 题`）；
  5. `text200-question-h1-readable`：`overflow=true`，`h1Split=[]`（题目区横向溢出，**不是标题拆词**）。
- 标题结论：`text200-guide-h1-readable`、`text200-result-h1-readable` 均 PASS 且 `h1Split=[]`，`Level check` / `Your result` 逐词不拆；**不能**表述为标题再次失败。
- 失败归因（Root 已核，DSH 依其只读证据记录）：本地 `packages/i18n/src/mobile-experience.ts`（`6ac6800e…`）确含 `completedCount` 等新键；但 `runs/c3-root-review/served-module-probe.json`（`at=2026-10-20T14:26:12Z`）显示 18183 实际服务模块 `sha256=81de3f9271161eca579e6b8717b6329fffecd5b33aa413ebcf1c5ad435699a48` 仍为旧版，`verdict=FILE_NEW_SERVED_OLD`（`completedCount=false`、`oldZhReceived=true`、`newZhProgress=false`）。故上述 5 FAIL 与“旧服务模块/缓存”一致，**不是 C3 源改动被判定为产品 FAIL**；Root 现准备只刷新其自己启动的审核服务。
- 现阶段**没有** Root run2 结果：不得写“已修”“PASS”或整页签收；C3 仍未签。（本句为 run2 前时点；run2 后事实见 §11，原文保留。）

## 11. Root 后续 run2 / H5 build（2026-10-20，证据归 Root）

- 服务：原 18183 PID 37496 经 Root 核 creation 后，仅结束其 session 32601 并 force 重启固定端口；当前 session 93491 / PID 40996，Creation `2026-10-20 22:28:50.77032`，操作时 QA 无 inflight。产品两源仍 `86620ed0…` / `6ac6800e…`，未变。
- 模块刷新：只读导入模块 `sha256=85b3328be94ed1df68257b3f3e4ddc2afd3242103d0e302289197496627c62b2`，含 `completedCount`/答题进度/已完成数，无旧「已接收进度」（副本 `runs/c3-root-run2/root-served-module-after-refresh.json`）。原 `FILE_NEW_SERVED_OLD` probe 保留，不覆盖、不回改。
- run2：DSH 修正的 `c3-verify.cjs` 由 Root 以 `MB006_REVIEW_RUN=c3-root-run2`、`executor="Codex independent review run2"` 执行，**exit 0、32/32 PASS**，`sourceStable/closed=true`、14 图、`pageErrors=[]`、unknown 0，console 仅两次明确注入 503。证据 `runs/c3-root-run2/results.json` 与本目录 `runs/c3-root-run2/ROOT-REVIEW.md`。
- 历史：run1 的 5 FAIL / 14 图 / 退出码错误**永久保留**在 `runs/c3/results.json`，不得改 PASS；作者 prepared、Root 执行、Root 审核三者分别记录。
- H5 build：Root 独立执行 **exit 0 / DONE Build complete**（`runs/c3-root-run2/root-c3-build-h5.log`、`.stderr.log`）；作者环境此前的 `BLOCKED_EXECUTION_BOUNDARY` 保留，不抹除、不升级为产品构建失败。
- 范围：32 项为局部通过；共享回归/全主题宽度/风险未跑，真实后台与 native 未验，**不签整页**，MB006 仍 IN_REVIEW/未提交，本地 8 / 远程 7 与 95% 阈值不变。

