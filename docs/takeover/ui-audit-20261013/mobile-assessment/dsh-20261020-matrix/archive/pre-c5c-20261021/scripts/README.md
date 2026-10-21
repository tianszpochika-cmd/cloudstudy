# scripts/ 使用说明（PREPARED_NOT_RUN）

本目录脚本只读冻结产品源、只写本矩阵目录的 `runs/<runId>/`。不启动服务、不写产品/store/tokens、不改 Git、不读凭据/cookie/storage/request body/header。artifact 中 URL 只保留 `origin+pathname`，不含 query/fragment/token。

## 文件

- `coverage.cjs`：唯一计划事实源。32 base contexts + 2 追加；含 text200 context 的 selected-C 探针；标题/文案常量来自冻结 `packages/i18n/src/mobile-experience.ts`；palette 常量来自冻结 `packages/design-tokens/src/{mobile,official-site}.ts`。
- `measure.cjs`：`collect(cfg)` 由 Playwright 注入页面执行，返回原始 DOM/几何/颜色/对比/溢出/裁切/重叠/词内拆行/控件清单/逐选项整词审计；`applyTextScale(2)` 只对含直接文本的元素做内联字号 ×2。
- `matrix.cjs`：执行器与证据写入器；含 fixture 传输台账分类与精确 case 选择。

## 静态检查

```powershell
node --check scripts/coverage.cjs
node --check scripts/measure.cjs
node --check scripts/matrix.cjs
node scripts/matrix.cjs --plan-only [--case-id <exact-plan-id>]...
```

`--plan-only` 不 require Playwright、不开浏览器、不写文件；默认打印 34 contexts/225 张预算，给定 `--case-id` 时只打印该 selection。

## 实跑（仅 Root 独立审核环境）

```powershell
node scripts/matrix.cjs --run-id <safe-id> --label "<root-label>" `
  [--group all|compact|wide|theme] [--case-id <exact-plan-id>]... `
  [--max-cases N] [--stop-file <path>] [--resume]
```

- `--case-id` 可重复或逗号分隔，必须精确匹配 plan id；未知 id 在启动浏览器前拒绝；与 `--group` 同时出现时优先。
- 有界复核示例：`--case-id en-US__dark__320__text200__short,zh-CN__high-contrast__390,en-US__high-contrast__768,zh-CN__system__390`。

## fixture 传输分类

应用逻辑 API 可能是 18070/18087；fixture 对任一 origin 的 `/api/v1/*` 都 `route.fulfill`。`matrix.cjs` 只把与本 case 的 fixture `report.requests` 台账精确匹配（id+method+origin+path）的 API 响应（任意 origin）记入 `fixtureFulfilledResponses` 并附 reason；未匹配的 API 响应/失败记 `unclassifiedApiResponses` 并 FAIL；非 API 的非 18183 响应/请求失败记 `externalResources`/`externalAttempts` 并 FAIL；18183 本地资源失败单独记 `localResourceFailures`。未知 501 仍 FAIL。不会宽泛排除所有非 18183 origin。

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
    result.json          五态原始测量 + C 探针 + check 明细 + 10 次 submit 记录 + retest 零写计数
                         + fixtureLedger / fixtureFulfilledResponses / unclassifiedApiResponses
                         + externalResources / externalAttempts / console / errors（URL 已去 query）
    01-guide.png
    [01a-guide-fullpage.png]        320 宽
    02-question-selected.png
    [02b-question-fullpage.png]     320 宽
    [02c-question-selected-C.png]   text200 的 C 探针
    [01b-guide-system-dark.png]     en-US__system__768 的 media 切换
    03-report.png
    04-report-fullpage.png
    05-retest-confirmation.png
    [05b-retest-confirmation-fullpage.png]  text200
    06-retest-cancelled.png
    FAILED-*.png         仅失败时
```

必须：18183 已是 Root 审核服务（session 93491 / PID 40996）；`--label` 非空；`--run-id` 单层安全目录，已存在时除 `--resume` 外拒绝。当前 `assessment.vue` 已被外部改为 `abff80cd…`，脚本仍冻结 `86620ed0…`，preflight 会退出 2；Root 复核后重新 freeze 才能跑。

## 判读

- case 状态：`MEASURED`/`REVIEW`/`INCOMPLETE`/`FAILED`/`ERROR`/`STOPPED`。没有 PASS；`info` check 只记录原始几何，不判失败。
- 空白/空目标不会被当成 ok：`uni-button` 为空、文本样本 <5、无 palette、无 H1 等都会 fail 或 not-measured。
- 200%：只接受 `percent 200`→factor 2；每次调用先 restore、再读所有 baseline、最后统一放大；记录 requestedPercent/effectiveFactor/before/after 与 28→56、16→32、14→28 sanity；invalid 直接 harness invalid（ERROR），不当产品失败。旧 run 的 text200 ERROR 即旧 harness 把 200 当乘数。
- 裁切：只有 hidden/clip/masked 且非视口可滚动的越界进 `clipping`（FAIL）；below-fold 且视口近似祖先 + 文档可滚动时记 `viewport-offscreen` info。`text-outside-box`/`glyph-overflow` 为 info（A2 64px ink 85px vs linebox 76.8 不单独判裁切）；`overlap`/横向 `overflow` 仍是 FAIL。
- 对比：HC 主操作边界 2.62:1、重测确认 1.88:1 保留 FAIL，不因已接受产品问题放宽。
- 实际旧 run `codex-review-c3-darkhc-1` 原样保留（HC390 FAILED、text200 ERROR），不改写其 result/截图；本次只更新脚本供 Root 用新 runId 重跑。
- 退出码 0 只代表全部选中 case 的 check 都为 ok；签收仍需 Root 看原始值与截图。

## 中止

- `SIGINT`/`SIGTERM`：当前 case 标 STOPPED（不记完成），写 checkpoint 后关闭 contexts/browser，退出 130。
- `--stop-file <path>`：每个 case 开始前检查，存在即停。
- `--max-cases N`：跑满 N 个即停。
- 配额 95% 由 Root 外部监控；脚本不读配额。停工后同 runId 用 `--resume` 续跑；STOPPED 的部分 case 会重跑。
