# MB006 当前源 H5 视觉矩阵（PREPARED_NOT_RUN）

状态：**PREPARED_NOT_RUN**。本目录只新增准备脚本、说明与断点，没有启动浏览器、没有访问 18183、没有截图、没有 PASS/FAIL 结论，也没有触碰用户已有 tabs、服务、store、tokens、产品源、Git、权限、依赖或数据库。

- 工作区：`C:\Users\Administrator\Desktop\my\cloudstudy`，分支 `dev-redesign`。
- 产品冻结（Root 指定）：`assessment.vue` sha256 `86620ed0…a5312d`；`mobile-experience.ts` sha256 `6ac6800e…247380`。观测时刻 2026-10-20T22:43:03+08:00 用 `Get-FileHash -Algorithm SHA256` 复算，两者与冻结值一致 `[实测]`。
- 固定 18183 的 Root 审核服务为 session 93491 / PID 40996（Root 提供）`[读取]`。脚本不启动、不探测、不重启该服务；浏览器在本 DSH 环境为 EPERM 且无审批通道，未尝试启动 `[读取: 任务约束]`。
- 概念图已接受，本目录不生成新设计、不改产品。

## 1. 交付物

| 文件 | 作用 |
|---|---|
| `scripts/coverage.cjs` | 32+2 contexts、状态、控件期望、标题/文案期望、精确语义 palette、分组与截图预算 |
| `scripts/measure.cjs` | 在冻结页面内只读采集几何/字号/颜色/溢出/裁切/重叠/Range 词内拆行/uni-button host；200% 测试辅助 |
| `scripts/matrix.cjs` | Root 执行入口：源 freeze、runId、分组、逐 case 结果/失败截图、checkpoint、resume、非零退出 |
| `scripts/README.md` | 运行方法、参数、输出结构、判读口径 |
| `checkpoint.md` | 断点与交接：PREPARED_NOT_RUN、计划数、GAP、停工规则 |

脚本均通过 `node --check`（无浏览器）`[实测]`；`matrix.cjs --plan-only` 已跑通并给出 34 contexts / 224 截图预算（无浏览器、无写入）`[实测]`。

## 2. 覆盖计划（计划，不是结果）

固定组合：`zh-CN/en-US × light/dark/high-contrast/system × 320/390/768/1280 = 32 contexts`，每 context 正常登录 → 引导 → 真实开始 → 选 A → 真实 10 次提交 → 报告 → 重测确认（零写）→ 取消。

另加 2 个具名 context（不把 200% 重复到 32 个）：

1. `en-US__dark__320__text200__short`：320×568、200% 文字辅助。
2. `zh-CN__light__390__short`：390×640 短屏。

共 **34 contexts**。每 context 固定 6 张：`01-guide`、`02-question-selected`、`03-report`、`04-report-fullpage`、`05-retest-confirmation`、`06-retest-cancelled`；320 宽的 9 个 context 另加 `01a-guide-fullpage` 与 `02b-question-fullpage`；`en-US__system__768` 另加 `01b-guide-system-dark`；text200 context 另加 `05b-retest-confirmation-fullpage`。**计划 224 张**（不含失败截图）。

分组（可单独跑，也可 `--group all`；组间重叠，不能相加当总量）：

| group | contexts | 计划截图 |
|---|---|---|
| `compact`（≤390，含 2 个追加） | 18 | 127 |
| `wide`（≥768） | 16 | 97 |
| `theme`（high-contrast+system，全宽） | 16 | 105 |
| `all` | 34 | 224 |

系统主题：`zh-CN__system__390` 以 `colorScheme=dark` 进入并核 `data-theme=dark`；`en-US__system__768` 在同一 context 内实际 `emulateMedia` light→dark→light 并逐次核 `data-theme` 与 palette；其余 system contexts 以 light 进入。高对比另核 `--yx-*` 实际 computed palette（与冻结 tokens 精确比对），不是只截一张深色图。

## 3. 每 case 的真实链路与零写

- 正常登录：真实 H5 登录页（合成登录响应），经既有 guard/returnTo 到 assessment；不注入身份、不改 store、不读凭据/cookie/storage/body/header。
- 引导：等待 `#assessment-guide`，点击 `#assessment-start` 产生 1 次真实 `POST /assessment/placement/sessions`。
- 题目：选 A（`#assessment-option-A`，`aria-pressed=true`），再逐题选择并提交 **10 次** `POST .../responses`；每次等 `aria-valuenow` 递增，第 10 次等报告出现。报告必须由这 10 次提交得到，不能注终态。
- 报告事实：从渲染后的 `.assessment-result-facts` 读取等级/分数/题数，与合成响应（A2 / 70 / 7 of 10）核对；不造 0、不造 SKIPPED。
- 重测确认：点击 `#assessment-retest` 只打开确认；记录 `counts.retest` 在打开后与取消后均为 0；不点击确认，避免任何重测写入。

所有 API 由 `20261016-review-prep/fixture.cjs` 严格合成拦截（该 fixture 未改动）：未知 API 501，非 API 只允许 18183 资源，外部 abort；`state.counts` 记录 start/respond/retest/ensure/GET 等原始计数。真实后台、IAM、DB、Gateway、native 均为 **NOT_RUN**。

## 4. 判读口径（由脚本计算原始值，Root 复核）

- 控件以 **`uni-button` host** 为测量对象；`uni-button` 为空 → FAIL，绝不以空 `button` 数组冒充。每状态精确期望：引导 4、题目 7、报告 4、重测确认 6、取消后 4；textarea/input 在测评页期望 0（无则不凑数组）。
- 触达：所有可见控件宽高 ≥44px；`assessment-primary` 高 ≥48px。选项字号 ≥16px、正文 ≥14px、H1 ≥28px（200% 场景按 2× 记录，仍不得缩回）。
- 布局：无横向 overflow；无祖先裁切、无 Range 字形越界；文本不得越出最近的有界容器（如 200% 时固定 32px 的选项键圈，单独记 `text-outside-box`）；控件之间与可见文本之间无重叠；拉丁/数字词不得词内拆行（DOM Range 逐可见 token，CJK 单字换行不判为拆词，见 GAP）；H1 非空 rect 且文本精确等于当前 locale 标题。
- 颜色：全部用实际 `getComputedStyle` 颜色，按祖先背景逐层 alpha 合成后计算；正文 4.5:1、大字 3:1；控件边界与选中态 3:1（只测控件自身边框，不用装饰分隔线替代）；disabled 单独记录并豁免对比判定，不混入 PASS。
- 非纯色状态：选中态同时核 `aria-pressed`、可见“已选/Selected”文案与 SVG 图标；报告完成态、反馈 `role=status` 一并记录。
- 主题：`data-theme` 与 13 个 `--yx-*` computed 值逐项精确比对 light/dark/high-contrast 期望；不一致即 FAIL，不猜对比值。
- 每个 case 还核 route、Vite error overlay、实际 `html lang`、`document.title`、console/pageerror、未知 501、非 18183 响应、源 freeze 前后 hash。测量为空（如文本样本 <5、无控件、无 palette）记为 not-measured → INCOMPLETE，不返回 PASS。

静态推算的待验风险（**不是结果**）：`--yx-action` 在 dark/high-contrast 仍为 `#5937d1`，其与卡片底 `#222638`/`#0d1018` 的填充边界推算约 2.1/2.4:1，可能低于 3:1。脚本会用实际 computed 值判定并保留原始数；Root 需自行决定是否属控件边界豁免。`[推断]`

## 5. Root 执行方法

前置：确认 18183 是 Root 审核服务（session 93491 / PID 40996），浏览器可用；不要在本 DSH 会话运行。

```powershell
# 静态检查（无浏览器）
node --check docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-matrix/scripts/coverage.cjs
node --check docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-matrix/scripts/measure.cjs
node --check docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-matrix/scripts/matrix.cjs
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-matrix/scripts/matrix.cjs --plan-only

# 实跑（Root 设置 label；runId 单层安全目录，不允许覆盖）
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-matrix/scripts/matrix.cjs `
  --run-id r1-20261021-am --label "root-audit-20261021-am" --group all

# 分组/分批；停工文件；续跑
node .../matrix.cjs --run-id r1-20261021-pm --label "root-audit-20261021-pm" --group compact
node .../matrix.cjs --run-id r1-20261021-pm --label "root-audit-20261021-pm" --group compact --resume
node .../matrix.cjs --run-id r1-20261021-pm --label "root-audit-20261021-pm" --group all --stop-file C:\temp\dsh-stop
```

- `--label` 必填，记录为 `executionLabel`；`preparedBy` 恒为 `DSH`。
- `--run-id` 只允许单层 `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`；目录已存在且非 `--resume` 时拒绝，不覆盖原结果。
- `--resume` 只跳过已有结果文件的 case；STOPPED 的部分 case 不记完成，会在同 runId 下重跑；已 FAILED 的 case 要重测请用新 runId，避免覆盖原证据。
- 退出码：`0` 全部选中 case 为 MEASURED（所有 check ok）；`1` 存在 fail/review/incomplete；`2` 前置或源漂移拒绝；`3` 浏览器启动失败；`130` 收到停工/达到 max-cases 并保存断点。
- 输出：`runs/<runId>/` 下 `manifest.json`、`source-freeze.json`、`plan.json`、`results.json`、`checkpoint.json`、`run-status.json`、`cases/<context>/result.json` 与截图。所有原始值（rect、字号、颜色、对比值、计数、console、请求）写 JSON，**不写 PASS 结论**。

## 6. GAP 与不能实测项（必须随证据一起交接）

1. **未运行**：本目录没有浏览器执行、没有截图、没有 case 结果；`PREPARED_NOT_RUN`，不得据计划行数推导完成率或 PASS。
2. **浏览器**：DSH 环境 EPERM 且无审批通道，未启动/探针/提升；需 Root 在独立审核环境执行。
3. **真实后端/native**：合成 API 只验证 H5 渲染与真实 store/guard 交互；真实 IAM/DB/Gateway/审计、真机安全区/状态栏/native 全部 NOT_RUN。
4. **system 跟随**：以 Chromium `emulateMedia` 证明 `data-theme` 跟随，不是 OS/系统设置；只有 1 个具名 dark 进入 + 1 个 live switch context，其余 system contexts 固定 light。
5. **高对比**：验证产品 CSS high-contrast palette，不是 Windows 强制颜色/forced-colors 或屏幕阅读器模式。
6. **200%**：以测试辅助将每个含直接文本元素的 computed font-size ×2（仅内联样式，不改文案/不隐藏/不写 store），不等于浏览器文字缩放或原生字体缩放；只覆盖声明的 en-US dark 320 短屏。
7. **短屏**：仅 en 320×568 与 zh 390×640 两个具名；桌面 Chromium 的 `env(safe-area-inset-*)` 为 0，不能代表刘海/手势区。
8. **focus/pointer/键盘/drag/owner 晚响应/503 恢复**：属并行风险/指针 suite，本矩阵不重复；本目录**不测 true focus 可见性**（静态样式里有 `:focus-visible`，但未实测）。
9. **CJK 拆词**：Range 分词把 CJK 单字视为允许换行单位，只对拉丁/数字 token 判“词内拆行”；中文两字词被拆开的语义问题不在本判据内。
10. **字体**：审核机若无 PingFang SC/微软雅黑，fallback 会改变换行与几何；截图不能冒充 native 渲染。
11. **served bundle**：脚本冻结源文件 hash，但无法证明 18183 正在服务的 dist 由该源构建（无 build 元数据读取）；Root 签收前应自行确认服务 build。
12. **图标/装饰**：只核 SVG 存在与 currentColor 继承，不单独计算图标图形对比；装饰分隔线不参与控件边界判定。
13. **状态范围**：本矩阵只覆盖正常路径五态；错误/离线/leave-confirmation/SKIPPED/权限拒绝不在本组截图内。
14. **概念图**：已接受，但本目录不做 concept 与截图的像素 diff；差异需 Root 逐张复核。
15. **配额**：脚本不读配额/用量，95% 阈值由 Root 外部监控；收到停工只落 `checkpoint.json`（每 case 更新，STOPPED 不记完成），下一次 `--resume` 续跑。

## 7. 冻结与仓库状态

- `git rev-parse --short HEAD` = `687af101`（观测时刻工作区有既有未提交改动；本目录全部为新增文件）`[实测]`。
- 支撑源（记录进 `source-freeze.json`，用于发现 palette 漂移）：`packages/design-tokens/src/mobile.ts` `5b3aac64…2281d9`；`packages/design-tokens/src/official-site.ts` `9d6af42d…d03d62` `[实测]`。
- 共享 fixture 的 6 个源文件 hash 也在运行时写入 `source-freeze-fixture.json`，每 case 前后复算，漂移即 FAIL。

## 8. 交接

请 Root 在独立审核环境执行，按 `cases/<context>/result.json` 的原始值逐项复核，再决定签收；不要把本 README 的计划数、组数或脚本存在当成验证证据。若配额达到 95% 或收到停工指令，立即只保留断点，不继续截图。
