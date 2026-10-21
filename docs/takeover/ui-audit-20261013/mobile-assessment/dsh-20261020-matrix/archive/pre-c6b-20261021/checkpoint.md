# 断点 / PREPARED_NOT_RUN

- 时间：2026-10-20T23:05+08:00（观测；本文件在 2026-10-21 Root 复核后更新）
- preparedBy：DSH
- executionLabel：未设置（Root 执行时用 `--label` 设置）
- 状态：**PREPARED_NOT_RUN**（本次脚本修正未运行）。没有启动浏览器、没有访问 18183、没有新增截图或新 case 结果；没有 PASS/FAIL 签收。所有本次浏览器/实跑状态均为 **NOT_RUN**。
- 实际旧 run 保留：`runs/codex-review-c3-darkhc-1/` 原样未改（HC390 FAILED、text200 ERROR），仅作已保留证据，不是修正后脚本的结果。
- 产品冻结（C5c，Root 批准）：`assessment.vue` `719cc0cef407b492544b1bff39537324b0672126df287bf7d5644a25b6fe81c1`；`mobile-experience.ts` `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380`；`apps/mobile/package.json` `484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078`；`pnpm-lock.yaml` `d57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624`。
- **C5c freeze**：page/i18n/package/lock/tokens 已在跑前与逐 case 校验；任一 expected 不符 exit 2。旧 C3 run `codex-review-c3-darkhc-1` 的 source-freeze 8662 与 ERROR/FAILED 记录原样保留，不改成 C5c。**page 已按 C5c `719cc0ce…fe81c1`（37,049 bytes）重新 freeze；旧 C3 run 保留 8662/ERROR/FAILED。**
- 工作区：`dev-redesign`，HEAD `687af101`。本目录全部为新增文件；未改源/store/tokens/其他脚本/报告/Git/服务/权限/依赖/生产/数据库。
- Root 审核服务：18183，session 93491 / PID 40996（Root 提供）。用户已有 tabs 未触碰。

## 已落盘

| 文件 | 说明 |
|---|---|
| `README.md` | 范围、计划、判读口径、执行方法、传输分类、GAP |
| `scripts/coverage.cjs` | 34 contexts（32 base + en320 text200 short（含 C 探针）+ zh390 short）、5 态期望、控件/文案/palette 常量、分组 |
| `scripts/measure.cjs` | 只读测量 + 200% 测试辅助 + 逐选项整词审计 |
| `scripts/matrix.cjs` | freeze/runId/分组/`--case-id`/传输台账分类/逐 case 证据/失败截图/checkpoint/resume/退出码 |
| `scripts/README.md` | 命令行与输出说明 |
| `archive/pre-review-20261021/` | 改前脚本/README/checkpoint 字节与 SHA256（archive-manifest.json） |

静态验证：仅执行 `node --check`（三个脚本通过，无浏览器）`[实测]`；本次未运行 `--plan-only`。计划数按 coverage 公式与 selection 规则计算，非实跑结果。

改前脚本 hash（archive-manifest.json 记录）：
`matrix.cjs 08bc59f64d443da5962a769a31b7aace18bd37bd45fc9a7b252c3d5550ecfb9e`、
`measure.cjs 3c705d4afe832929840c72f67c97d030cf068bb0637555a12d1eab074e05144b`、
`coverage.cjs a30fd749d56803690706ec2a9f0f6e945d57cfe3b68fe6d5567b894b73ef1d7c`。
改动后脚本 hash 见本文件末尾（Get-FileHash 复算）。

## 计划数（非结果）

- 基础：2 locales × 4 themes × 4 widths = 32；追加 2 → 34 contexts。
- 每 context 6 张（含报告 fullPage）；320 宽的 9 个 context 另加 guide/question fullPage 各 1（+18）；system live-switch 1 张；text200 retest confirmation fullPage 1 张；text200 selected-C 探针 1 张 → **225 张计划**。
- 分组：compact 18/128；wide 16/97；theme 16/105；组间重叠，不能相加当总量。
- 每 context 实际链路：正常登录 → 引导 → 真实开始 1 写 → 选 A → 真实 10 次 submit → 报告（A2/70/7 of 10）→ 重测确认（retest 计数 0）→ 取消（仍 0）；text200 另在提交前用真实指针选 C 截 02c。

## 已保留的实际 bounded run（不改写）

`runs/codex-review-c3-darkhc-1/`（label `Codex independent bounded C3 review`，2 contexts，7 张截图，status FINISHED，summary failed=1/error=1）：

- `zh-CN__high-contrast__390` **FAILED**：实际 result 中 `assessment-start`/`assessment-submit`/`assessment-today` 边框 vs 父底 **2.62:1**，`assessment-retest-confirm` **1.88:1**。Root 已接受为后续页面修复的产品问题；measurement **不放宽 3:1**。
- `en-US__dark__320__text200__short` **ERROR**：旧 `applyTextScale` 把 `textScale=200` 当乘数，产生 16×200=3200px、28×200=5600px，布局/截图失败。属 **harness invalid，不是产品失败**；旧 run 保留 ERROR，不升级为产品结论。
- 旧 run 的两类误报已在脚本修正：A2 `text-outside-box`（85px ink vs 76.8 linebox）降为 info；retest 下方 note 的 844px 视口祖先裁切改为 `viewport-offscreen` info（正常文档滚动可达）。
- 旧 run 的 result/截图/脚本归档均未修改。

## 本次 harness/裁切修正（未运行）

- 200%：`applyTextScale` 只接受显式 `percent 200`→factor 2；先 restore 旧内联、再统一读 baseline、最后 ×2；新旧节点可重入；记录 requestedPercent/effectiveFactor/before/after 与 28→56、16→32、14→28 sanity；非法输入直接 refuse 并标 harness invalid。
- 裁切：只把 hidden/clip/masked 且非视口可滚动的越界计入 `clipping` FAIL；below-fold 且视口近似 + 文档可滚动记 `viewport-offscreen` info；`text-outside-box`/`glyph-overflow` 记 info（保留 Range 原始几何）；`overlap`/横向 `overflow` 仍 FAIL。
- 传输：非 18183 响应按 fixture `report.requests` 台账（id+method+origin+path）分类；未匹配 API/真实外部响应/请求尝试仍 FAIL；URL 去 query/fragment。

## 执行入口

```powershell
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-matrix/scripts/matrix.cjs `
  --run-id <safe-id> --label "<root-label>" --group all
# 有界复核
node .../matrix.cjs --run-id <safe-id2> --label "<root-label2>" `
  --case-id en-US__dark__320__text200__short,zh-CN__high-contrast__390,en-US__high-contrast__768,zh-CN__system__390
```

`--case-id` 精确匹配 plan id，可重复/逗号分隔，优先于 `--group`；未知 id 在浏览器启动前拒绝；`--plan-only` 使用同一选择。详见 `README.md` §5 与 `scripts/README.md`。

## 停工规则

- 最新 95% 阈值由 Root 外部监控；脚本不读配额。
- 收到停工：立刻停止新 case；每 case 已即时写 `runs/<runId>/checkpoint.json` 与已完成的 `cases/*/result.json`。SIGINT/stop-file 会把当前 case 标 STOPPED（不计完成）后关 contexts/browser。
- 续跑：同 runId `--resume`（label/group 或 caseIds/hash 必须一致）；STOPPED 部分 case 重跑，已完成 case 跳过。失败 case 重测用新 runId，避免覆盖原证据。

## 未覆盖 / 不能实测（GAP）

1. 本次脚本修正未运行：无新浏览器执行、无新截图、无新 case 结果；不得据计划行数推 PASS 或完成率。旧 run `codex-review-c3-darkhc-1` 只是保留证据。
2. 浏览器在 DSH 环境 EPERM、无审批通道；不在本会话启动/探针/提升。
3. 真实 IAM/DB/Gateway/审计、native/真机/安全区 NOT_RUN；只有 H5 + 合成 API。
4. system 跟随用 Chromium emulateMedia，不是 OS；1 个具名 dark + 1 个 live-switch，其余 system 固定 light。
5. 高对比是产品 palette，不是 OS forced-colors。
6. 200% 是测试用内联字号（percent200→factor2），不是浏览器文字缩放/原生字体缩放；仅 en-US dark 320 短屏；旧 run 的 ERROR 是旧 harness invalid。
7. 短屏只有 en 320×568、zh 390×640；桌面 Chromium safe-area 为 0。
8. focus/pointer/键盘/drag/owner 晚响应/503 属并行风险 suite；本组不测 true focus。
9. CJK 单字换行不判词内拆行；只判拉丁/数字 token。
10. 字体 fallback（审核机无 PingFang/雅黑）会改变几何；截图不冒充 native。
11. 无法证明 18183 正在服务的 dist 由冻结源构建；Root 签收前应确认 build。
12. 图标图形对比未单独测；装饰线不参与控件边界。
13. 错误/离线/leave-confirmation/SKIPPED/权限拒绝不在本矩阵五态内。
14. 概念图不做像素 diff。
15. 实际已确认产品问题（旧 run）：HC 主操作边框 2.62:1、重测确认 1.88:1；Root 接受待页面修复，脚本不放宽判据。
16. 传输分类依赖 fixture `report.requests` 台账（id+method+origin+path）；若真实 API origin 变化或 fixture 台账缺失，会记 `unclassifiedApiResponses` 并 FAIL，需 Root 看原始证据，不能据此当外部网络。
17. 无 PASS 预填；本文件计划数/分组/截图数均为准备态计算，未由修正后脚本产生。
18. `text-outside-box`/`glyph-overflow`/`viewport-offscreen` 为 info，需 Root 视觉复核；实际裁切/遮挡/横向溢出仍 FAIL。
19. 修正后脚本需 Root 用新 runId 重跑 dark/text200 才能得到 200% 与 C 选项的真实测量；不得把旧 run 的 ERROR/FAILED 直接当修正后结果。

## 脚本 hash（改动后，Get-FileHash SHA256）

- `scripts/matrix.cjs`：`a300896379f16ca1148c0157a9bcf38d7f7cef7fedc06dfbcba018e7e87786dc`（53,063 bytes）
- `scripts/measure.cjs`：`d337a0bbe0e9291a1ca3a731bbd6478d7fdadabf4bd143a795b255ae67dfc73d`（33,063 bytes）
- `scripts/coverage.cjs`：`2823bfc2c99d96dbd8d4b4796e3b76ee16d27a7649ac318c72f3ff04bbdea249`（7,566 bytes）

归档：`archive/pre-review-20261021/archive-manifest.json`（改前字节 + SHA256，含 README/checkpoint）。

## 交接

Root 在独立审核环境按 `runs/<runId>/cases/<context>/result.json` 原始值逐项复核后签收。本文件与 README 不含任何 PASS 结论；浏览器/实跑状态全部 NOT_RUN。
