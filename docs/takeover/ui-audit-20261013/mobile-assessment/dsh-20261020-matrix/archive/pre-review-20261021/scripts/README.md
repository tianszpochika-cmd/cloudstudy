# scripts/ 使用说明（PREPARED_NOT_RUN）

本目录脚本只读冻结产品源、只写本矩阵目录的 `runs/<runId>/`。不启动服务、不写产品/store/tokens、不改 Git、不读凭据/cookie/storage/request body/header。

## 文件

- `coverage.cjs`：唯一计划事实源。32 base contexts + 2 追加；标题/文案常量来自冻结 `packages/i18n/src/mobile-experience.ts`；palette 常量来自冻结 `packages/design-tokens/src/{mobile,official-site}.ts`。
- `measure.cjs`：`collect(cfg)` 由 Playwright 注入页面执行，返回原始 DOM/几何/颜色/对比/溢出/裁切/重叠/词内拆行/控件清单；`applyTextScale(2)` 只对含直接文本的元素做内联字号 ×2。
- `matrix.cjs`：执行器与证据写入器。

## 静态检查

```powershell
node --check scripts/coverage.cjs
node --check scripts/measure.cjs
node --check scripts/matrix.cjs
node scripts/matrix.cjs --plan-only
```

`--plan-only` 不 require Playwright、不开浏览器、不写文件；只打印 34 contexts、分组与 224 张截图预算。

## 实跑（仅 Root 独立审核环境）

```powershell
node scripts/matrix.cjs --run-id <safe-id> --label "<root-label>" [--group all|compact|wide|theme] `
  [--max-cases N] [--stop-file <path>] [--resume]
```

必须满足：

1. `http://127.0.0.1:18183` 已是 Root 审核服务（session 93491 / PID 40996），且构建与冻结源一致；脚本不会启动它。
2. `--label` 非空（Root 设置）；`preparedBy` 固定 `DSH`。
3. `--run-id` 单层安全目录；已存在时除 `--resume` 外拒绝。

## 输出与证据

```
runs/<runId>/
  manifest.json          执行 label、preparedBy、node/playwright/browser 版本、冻结 hash、渲染器声明（H5/合成 API，非 native）
  source-freeze.json     跑前 page/i18n/支撑 tokens hash 与 frozenAt（resume 保留首次冻结时间）
  source-freeze-fixture.json  共享 fixture 的 6 个源 hash
  plan.json              本次选中 contexts 与截图预算
  results.json           每 case 状态、失败/复核 check id、截图数
  checkpoint.json        每 case 即时更新；completed/pending/lastStatus/screenshots
  run-status.json        结束状态（FINISHED/STOPPED/LAUNCH_FAILED），无 PASS 字样
  cases/<context>/
    result.json          五态原始测量 + check 明细 + 10 次 submit 记录 + retest 零写计数 + 请求/console/错误
    01-guide.png
    [01a-guide-fullpage.png]        320 宽
    02-question-selected.png
    [02b-question-fullpage.png]     320 宽
    [01b-guide-system-dark.png]     en-US__system__768 的 media 切换
    03-report.png
    04-report-fullpage.png
    05-retest-confirmation.png
    [05b-retest-confirmation-fullpage.png]  text200
    06-retest-cancelled.png
    FAILED-*.png         仅失败时
```

## 判读

- case 状态：`MEASURED`（全部 check ok）/`REVIEW`（console 错误等需人看）/`INCOMPLETE`（有 not-measured）/`FAILED`/`ERROR`/`STOPPED`。没有 PASS。
- 空白/空目标不会被当成 ok：`uni-button` 为空、文本样本 <5、无 palette、无 H1 等都会 fail 或 not-measured。
- 退出码 0 只代表全部选中 case 的 check 都为 ok；签收仍需 Root 看原始值与截图。

## 中止

- `SIGINT`/`SIGTERM`：当前 case 标 STOPPED（不记完成），写 checkpoint 后关闭 contexts/browser，退出 130。
- `--stop-file <path>`：每个 case 开始前检查，存在即停。
- `--max-cases N`：跑满 N 个即停。
- 配额 95% 由 Root 外部监控；脚本不读配额。停工后同 runId 用 `--resume` 续跑；STOPPED 的部分 case 会重跑。
