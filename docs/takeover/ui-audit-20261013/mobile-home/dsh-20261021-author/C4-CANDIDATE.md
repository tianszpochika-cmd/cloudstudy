# MB007 首页 C4 候选（2026-10-21）

状态：`PRIVATE_CANDIDATE_C4 / UI_NOT_SIGNED / BROWSER_NOT_RUN`。只修 C3 真实 H5 暴露的 i18n 结构与 retryPlan 迟到计划问题；未改版式、字体栈或权限。未提交、未 fetch/push、未跑浏览器/服务器/安装依赖，未改全局进度/CHANGELOG 完成数。

## 0. C3 真实结果与证据保留

- Root 独立 H5 受控 ready/search，源/deps stable、closed=true，明确未签：
  - `qa/runs/qa-ready-20261021-053126`：ready 4 FAIL；
  - `qa-search-20261021-053126`：search 6 FAIL。
- Root 独立 H5 build exit0 只作工程证据，不代表 UI PASS。
- C3 四源与报告已归档到 `docs/takeover/ui-audit-20261013/mobile-home/archive/c3-20261021/`，含 `HASHES.md`：
  - home `cc5ff41770cbee776cdf1be293eb20ffb19337add9ea5f95cbc6baf511b7345b`
  - i18n `99ad89ffe73b8493500f97a94207f6dcda5dda1ac3456bdc56795275ad7aac63`
  - store `c4ef9dd83452ea44f6deda55ac0be2dd3e49a810cd82d183d5342fa9b71cec21`
  - runtime `03b21bab8c4121ec289b5633ae9fab79ba0b64c60d0431f7adbf8953115f265a`
- 归档为修改前复制，未删除/覆盖 C1/C2/C3 before 图、报告或私有快照。C3 失败原样保留，不重判。

## 1. P1：i18n 结构错（已修）

**根因**（Root TypeScript AST + 私有 force 服务复核）：`home: homeCopy(false/true)` 实际位于 `auth` 对象末尾，真实路径是

```
zh-CN.mobile.auth.home.h1
en-US.mobile.auth.home.h1
```

而页面 `tr()` 读取 `mobile.home.*`，所以所有可见文案显示裸 key（不是缓存问题）。

**修复**：只动两处 braces，把 `home` 移到 `mobile` 直接子层，与 `auth` / `assessment` / `onboarding` 同层：

```
mobile: { brand..., auth: { login, register, resetPassword }, home: homeCopy(false), assessment: ..., ... }
```

未改 `auth` / `assessment` / `onboarding` / `forbidden` / `pages` 的任何文案或结构。`homeCopy()` 键集合不变。

**静态验证（非 UI PASS）**：

1. `pnpm --filter @englishflow/mobile typecheck` → `PASS_EXIT_0`。
2. TS AST 检查：`zh-CN`/`en-US` 的 `mobile` 下存在 `home`，且 `mobile.auth.home` 不存在。
3. 以 TypeScript `transpileModule` 在内存中求值 `mobileExperienceMessages`（不启动浏览器/服务）验证实际注册形状：
   - `messages['zh-CN'].mobile.home.h1 === '今日学习'`
   - `messages['en-US'].mobile.home.h1 === "Today's learning"`
   - `mobile.auth.home` 为 `undefined`
   - 页面 `tr('…')` 的 **61 个静态 key** 在两种 locale 下全部解析为非空字符串（脚本输出 `LOOKUP_OK locales=2 pageKeys=61`）。
4. 动态 key 另检 `guideLabel.gate|consent|goal|assessment` 与 `stepsText.*`、`empty.noPlan|completed|noContent|noReview.title|description|action`。

**边界**：以上只证明注册结构与 lookup 解析，不证明浏览器渲染、断词、对比度或字体；C3 的 ready/search FAIL 未因此改判，需 Root 复跑。

## 2. P2：retryPlan 迟到计划（已修）

C3 的 `retryPlan()` 调 `store.refreshPlanQueue()` 未传 `stillWanted`；返回本页/新计划读取后，旧 retry 的 `/learning/today` 晚包仍可能写 `planQueue`/`planQueueStatus`。

**修复**：仅本页调用处传入既有可选谓词，不动 store 签名/边界：

```ts
const action = beginAction()
await store.refreshPlanQueue(undefined, () => actionCurrent(action))
```

- `undefined` 沿用 `refreshPlanQueue` 原有的 `owner = scope()` 默认；
- `actionCurrent(action)` 同时要求：本页可见、同一 `pageEpoch`、当前 `actionSeq`、同一 owner（`verifiedSubject + identityRevision`）；
- store 在请求前、响应后、catch 内均已检查该谓词（C2 已加），旧晚包不会写 `planQueue`、`planQueueStatus` 或 `error`；
- 其他调用（`replanAfterGoal`、`ensurePlanFromReport`、页面 `retryHome` 的 `loadHome` 内 plan read）保持原行为；未扩大 store 权限/owner/identity 逻辑。

**必须具名的 late plan/retry 用例（Root browser）**：

| # | 场景 | 断言 |
|---|---|---|
| P1 | retryPlan 发出旧 `/learning/today` 延迟 800ms；期间离开再返回 | 返回后的新计划读取赢；旧晚包不覆盖 planId/explanation/emptyReason/planVersion |
| P2 | 旧 retry 延迟中开始新的 retryPlan（新 action） | 旧谓词 false；旧包不写，新包正常写；busy 只由新 action 清 |
| P3 | 旧 retry 延迟中身份切换/退出 | 旧包不写；无旧计划闪现；401 由既有 handler 清会话 |
| P4 | 旧 retry 最终 500 | 不得把当前已成功计划置为 `planQueueStatus='error'`；不得显示旧错误 |
| P5 | 旧 retry 成功但页面已 onHide | 隐藏期间不写；再次 onShow 重新读取后由新结果决定 |
| P6 | retryPlan 与新 `loadHome` 的计划读取交错 | 仅最新一次写；不出现旧 explanation + 新 tasks 的混合 |

## 3. 字体/200% overflow（不盲改）

- 未改 `--v2-font` 或按钮/输入 font 栈；Root 将用实际 CDP/字体测量给结论后再定。
- C3 的 200% overflow 多数由裸 key（超长 `mobile.home.*`）造成；C4 修订后应先由 Root 复验真实文案下的 200%/320/英文，再判断是否需 CSS；本轮**没有**加 `overflow:hidden` 遮字，也没有截断标题。

## 4. C4 四源冻结哈希

| 文件 | 行数 | raw SHA256 | LF SHA256 |
|---|---|---|---|
| `apps/mobile/src/pages/home/home.vue` | 743 | `e249159d22c007a920ce944e9956be1a061ba24dc589bce7b37266126d65491f` | 同 raw |
| `packages/i18n/src/mobile-experience.ts` | 237 | `278b9d030b02532a872c502b38f62561e41dc94ffdfb7abc35585c4496967ddc` | `e59547d9892f7689e3681b853b258393b096d0745929f3df0d1fb608f589683e` |
| `apps/mobile/src/stores/learner-content.ts` | 569 | `c4ef9dd83452ea44f6deda55ac0be2dd3e49a810cd82d183d5342fa9b71cec21` | 同 raw |
| `apps/mobile/src/platform/uni-runtime.ts` | 207 | `03b21bab8c4121ec289b5633ae9fab79ba0b64c60d0431f7adbf8953115f265a` | 同 raw |

i18n 工作副本为仓库既有 CRLF，LF 为规范化哈希；home/store/runtime 为 LF。`git diff --stat`：4 文件，822 insertions / 151 deletions（home 813、i18n 121、store 33、runtime 6 行变动）。`git status` 仅这 4 个 `M` + `mobile-home/` 未跟踪目录。

## 5. 验证汇总（如实）

| 项 | 结果 |
|---|---|
| mobile typecheck | `PASS_EXIT_0`（C4 最终源） |
| SFC parse/compile | `SFC_OK styles=1 code=28680` |
| i18n AST + 内存注册 lookup | `LOOKUP_OK locales=2 pageKeys=61`；`auth.home` 不存在 |
| H5 build | **未重跑**；DSH 环境已知 `estree-walker`/unimport + spawn 阻塞，按 Root 指示不再消耗；Root 已独立 exit0 |
| 浏览器/真实 H5 | `NOT_RUN`；ready/search FAIL 仍以 Root 原始 run 为准 |
| Git | 无写操作；未 add/commit/push/fetch |

## 6. 仍存 GAP / 限制

- `learner.home.read` 与客户端 `learning.plan.read` 门不匹配（未改权限）。
- `planNotice` 仍依赖两条 store 原文精确匹配；未知原文原样显示，可能为中文。
- `explanation/title/description/unavailableReason/summary` 为服务端内容，可能中文；不在页面翻译。
- `openUniPage` 在部分平台可能返回 void，await 无法确认；已按授权只改返回与 return。
- 对比度、四主题、200%、真实字体、scroll 原生 selector 支持均未实测；等 Root。
- C3 入口 token 已拆，但 Root 尚未完整跑 late；不得写 PASS。

## 7. 交付边界

本轮产品改动仅 4 源（home/i18n/store/runtime，store/runtime 未再改），文档仅本文件、C3 archive 与 `DESIGN-SPEC.md` 的 C4 注记。未动 56 文件/14 目录保护、未动 MB006 源、未改依赖/权限/路由、未 Git。C4 四 hash 冻结后交 Root；是否签收、build、browser、commit 由 Root 决定。
