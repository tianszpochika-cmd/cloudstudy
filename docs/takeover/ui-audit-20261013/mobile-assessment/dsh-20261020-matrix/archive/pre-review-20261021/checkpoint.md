# 断点 / PREPARED_NOT_RUN

- 时间：2026-10-20T22:43+08:00（观测）
- preparedBy：DSH
- executionLabel：未设置（Root 执行时用 `--label` 设置）
- 状态：**PREPARED_NOT_RUN**。没有启动浏览器、没有访问 18183、没有截图、没有 case 结果；没有 PASS/FAIL 签收。
- 产品冻结：`apps/mobile/src/pages/assessment/assessment.vue` = `86620ed0dbc2cb25afb4bbae35734a345b9e8066afa806684f99ccb678a5312d`；`packages/i18n/src/mobile-experience.ts` = `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380`（Get-FileHash 复算一致）。
- 工作区：`dev-redesign`，HEAD `687af101`。本目录全部为新增文件；未改源/store/tokens/其他脚本/报告/Git/服务/权限/依赖/生产/数据库。
- Root 审核服务：18183，session 93491 / PID 40996（Root 提供）。用户已有 tabs 未触碰。

## 已落盘

| 文件 | 说明 |
|---|---|
| `README.md` | 范围、计划、判读口径、执行方法、GAP |
| `scripts/coverage.cjs` | 34 contexts（32 base + en320 text200 short + zh390 short）、5 态期望、控件/文案/palette 常量、分组 |
| `scripts/measure.cjs` | 只读测量 + 200% 测试辅助 |
| `scripts/matrix.cjs` | freeze/runId/分组/逐 case 证据/失败截图/checkpoint/resume/退出码 |
| `scripts/README.md` | 命令行与输出说明 |

静态验证：三个脚本 `node --check` 通过；`matrix.cjs --plan-only` 通过（无浏览器、无写入），输出 34 contexts / 224 截图。

## 计划数（非结果）

- 基础：2 locales × 4 themes × 4 widths = 32；追加 2 → 34 contexts。
- 每 context 6 张（含报告 fullPage）；320 宽的 9 个 context 另加 guide/question fullPage 各 1（+18）；system live-switch 1 张；text200 retest confirmation fullPage 1 张 → **224 张计划**。
- 分组：compact 18/127；wide 16/97；theme 16/105；组间重叠，不能相加当总量。
- 每 context 实际链路：正常登录 → 引导 → 真实开始 1 写 → 选 A → 真实 10 次 submit → 报告（A2/70/7 of 10）→ 重测确认（retest 计数 0）→ 取消（仍 0）。

## 执行入口

```powershell
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-matrix/scripts/matrix.cjs `
  --run-id <safe-id> --label "<root-label>" --group all
```

详见 `README.md` §5 与 `scripts/README.md`。

## 停工规则

- 最新 95% 阈值由 Root 外部监控；脚本不读配额。
- 收到停工：立刻停止新 case；每 case 已即时写 `runs/<runId>/checkpoint.json` 与已完成的 `cases/*/result.json`。SIGINT/stop-file 会把当前 case 标 STOPPED（不计完成）后关 contexts/browser。
- 续跑：同 runId `--resume`（label/group/hash 必须一致）；STOPPED 部分 case 重跑，已完成 case 跳过。失败 case 重测用新 runId，避免覆盖原证据。

## 未覆盖 / 不能实测（GAP）

1. 未运行：无浏览器、无截图、无原始测量；不得据计划行数推 PASS 或完成率。
2. 浏览器在 DSH 环境 EPERM、无审批通道；不在本会话启动/探针/提升。
3. 真实 IAM/DB/Gateway/审计、native/真机/安全区 NOT_RUN；只有 H5 + 合成 API。
4. system 跟随用 Chromium emulateMedia，不是 OS；1 个具名 dark + 1 个 live-switch，其余 system 固定 light。
5. 高对比是产品 palette，不是 OS forced-colors。
6. 200% 是测试用 computed font ×2 内联样式，不是浏览器文字缩放/原生字体缩放；仅 en-US dark 320 短屏。
7. 短屏只有 en 320×568、zh 390×640；桌面 Chromium safe-area 为 0。
8. focus/pointer/键盘/drag/owner 晚响应/503 属并行风险 suite；本组不测 true focus。
9. CJK 单字换行不判词内拆行；只判拉丁/数字 token。
10. 字体 fallback（审核机无 PingFang/雅黑）会改变几何；截图不冒充 native。
11. 无法证明 18183 正在服务的 dist 由冻结源构建；Root 签收前应确认 build。
12. 图标图形对比未单独测；装饰线不参与控件边界。
13. 错误/离线/leave-confirmation/SKIPPED/权限拒绝不在本矩阵五态内。
14. 概念图不做像素 diff。
15. 静态推算待验风险（非结果）：dark/HC 下 `--yx-action` 填充对卡片底可能 <3:1，由实际 computed 值判定。

## 交接

Root 在独立审核环境按 `runs/<runId>/cases/<context>/result.json` 原始值逐项复核后签收。本文件与 README 不含任何 PASS 结论。
