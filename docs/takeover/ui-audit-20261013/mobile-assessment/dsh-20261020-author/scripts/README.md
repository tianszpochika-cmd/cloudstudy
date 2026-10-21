# C3 浏览器验收脚本说明（作者准备；作者未运行，Root 首轮已运行）

本目录脚本由 **DSH 作者**准备；**Codex 仅分发/独立审查**。作者环境启动 Chromium 被拒（`BLOCKED_BROWSER_LAUNCH`），因此作者**从未运行** `c3-verify.cjs`。但这不代表 `runs/c3/` 至今无结果：**2026-10-20 Root 已在自建审核环境首轮运行并产生 `runs/c3/results.json`（23 checks / 5 FAIL，归 Root）**，该原件与截图**不可被覆盖**；作者预设的“无 results”只作为作者时点历史保留在 `checkpoint.md`。作者环境阻塞与 Root 独立执行必须分开记录：Root 运行产生的是 Root 的新证据，不是作者 PASS，也不是产品 FAIL 结论。

## 固定源（脚本启动即断言）

| 文件 | raw SHA-256 |
|---|---|
| `apps/mobile/src/pages/assessment/assessment.vue` | `86620ed0dbc2cb25afb4bbae35734a345b9e8066afa806684f99ccb678a5312d` |
| `packages/i18n/src/mobile-experience.ts` | `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380` |

`fixture.cjs` 另 freeze 6 个源（含 learner-content API/store、session、auth/navigation）；任一漂移即失败。

## 准确调用（Root 审核环境）

```powershell
$env:MB006_CONFIRM_BROWSER='1'
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-author/scripts/c3-verify.cjs
```

- 前缀固定 `http://127.0.0.1:18183`，要求 Root 管理的 dev server 在跑；脚本不启动/重启服务，不改端口。
- 依赖既有 Playwright Chromium；所有 API 走 `fixture.cjs` 严格合成拦截，真实登录 UI/guard，不读真实凭据/cookie/storage/header/body，不注入 store/guard。
- **guard**：未设 `MB006_CONFIRM_BROWSER=1` 时，脚本在 require fixture/Playwright 之前打印 `REFUSED` 并 `exit 2`；此行为是代码审阅事实，作者未实际执行该 guard。

## 覆盖与输出

- A 进度语义（zh 390）：首题 meta 恰为「第 1 题，共 10 题」+「已完成 0 题」；无 `0/10`、无“已接收”重复行；`aria-label=答题进度`、`valuenow=0`、`valuemax=10`、`valuetext=已完成 0 题，共 10 题`；track 4px 且 0 宽；提交 1 次后为「第 2 题」+「已完成 1 题」、`valuenow=1`（非题号 2）、新题清选。
- B 原 8 项 smoke：登录 guard 引导 0 写；选项可选可读；同题 503 保留选择；读回保选且不新开；真实 10 次提交→ASSESSED 且 ensure 1；重测确认取消零写；重测 503 保原报告并可取消；en 暗 390 无中文/裸键。
- C 200% 三态（en 暗 320×568）：引导/题目/结果 H1 的 DOMRange 按词拆行检测；CSS 文字 2×，不是浏览器 zoom/native 缩放。
- 输出：`runs/c3/results.json` + 截图 `01/02`、`10`–`17`、`20`–`23`。Root 首轮已实际生成这些结果/实图（归 Root）；后续复跑须用新 run 目录，**不得覆盖** `runs/c3/` 首轮原件。

## 新 run 约定（参数以当前脚本为准）

- 后续 Root/DSH 复跑按当前 `c3-verify.cjs` 的 `MB006_REVIEW_RUN` / `EXECUTOR` 约定写入**新 run 路径**，与首轮 `runs/c3/` 分开；具体取值与校验以脚本现状为准，本说明不代脚本断言实现细节，也不表示另一位 DSH 的脚本修改已完成。

## 其他脚本

- `c2-text200.cjs`：C2 历史复验，已实跑并因 `spawn EPERM` 失败；其 `results.json` 保留原始 EPERM，`STATUS.json` 分类为 `BLOCKED_BROWSER_LAUNCH`。C3 源已变，不应再用它得 C3 结论。
- `fixture.cjs`：20261016-review-prep 的另存副本，仅调整 ROOT 相对层级；旧文件与哈希未改。
- `hash-sources.cjs` / `protection-drift.cjs`：只读取 raw/LF 与 56 保护漂移。
