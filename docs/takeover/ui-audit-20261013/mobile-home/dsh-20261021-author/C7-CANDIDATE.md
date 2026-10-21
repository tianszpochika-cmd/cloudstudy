# MB007 首页 C7 候选（2026-10-21）

状态：`PRIVATE_CANDIDATE_C7 / UI_NOT_SIGNED / BROWSER_NOT_RUN`。只优化空态/引导/进度提示与呈现层；不改 domain 枚举、权限、API、计划规则、store/runtime。未提交、未 fetch/push、未跑浏览器/服务/依赖，未改完成数。

## 0. Root C6 空态 finding 与证据保留

Root 对 C6 首页空态独审发现同页提示/动作冲突（私有证据）：

- `.git/codex-local-backups/dsh-dispatch-20261021/root-home-empty-c6.json`
- `.git/codex-local-backups/dsh-dispatch-20261021/root-home-empty-c6.png`

同页同时出现：

1. “目标已保存，下一步进入定级 / 剩余步骤：定级 / 继续设置，开始学习”；
2. “还没有学习计划 / 先完成设置，再开始今天的练习 / 开始设置”；
3. footer “进入测评”。

Root 不接受该重复与前后冲突。C6 四源/报告已归档 `archive/c6-20261021/`（含 `HASHES.md`）：home `593994f2…`、i18n `278b9d03…`、store `c4ef9dd8…`、runtime `03b21bab…`。C6 smoke4 与 retry16 是旧具名 scope，**不自动升级**为 C7 PASS；旧 FAIL、截图、C1–C5 archive 均未覆盖。

## 1. 锁定的 C7 行为

### 1.1 guideStep=assessment 且 guideVisible

- 只显示一句事实：zh `目标已保存，可继续测评。` / en `Your goal is saved. You can take the assessment next.`
- 主动作复用现有 `takeAssessment`：zh `进入测评` / en `Take assessment`；路径 `/pages/assessment/assessment`。
- 不再显示 `剩余步骤：定级`（单步骤不列），也不再显示旧 `目标已保存，下一步进入定级`。
- 其他未完成前置步骤（gate/consent/goal）仍显示真实剩余步骤，动作改为简短 `继续设置` / `Continue setup`，不再承诺“开始学习”。
- UI 用“测评”一致命名；未改 `OnboardingResumeStep` 枚举、`selectOnboardingResumeStep`、路径或 domain 逻辑。

### 1.2 NO_PLAN 空态与 guide 的关系

- `emptyReason=NO_PLAN` 且当前有 guide：保留诚实标题 `还没有学习计划`；**不显示**“先完成设置，再开始今天的练习。”描述，**不显示**第二个“开始设置”按钮；下一步由上方 guide 唯一负责。
- `NO_PLAN` 且无 guide：保持原来的标题 + 描述 + “开始设置”出口。
- `COMPLETED` / `NO_CONTENT` / `NO_DUE_REVIEW` 的空态文案与动作不被 NO_PLAN guide 文案覆写；不新增“测评后一定生成计划”的承诺。
- 旧 SKIPPED/计划契约 GAP 保留，未改计划规则。

### 1.3 footer

- 当 guide 已提供 assessment 动作（`assessmentGuideVisible`）时，footer 不再重复“进入测评”，只保留“修改目标”。
- 其他已就绪态（无 guide、gate/consent/goal guide、普通 ready）footer 原入口保留。

### 1.4 任务计数

- 任务数为 0 时不渲染 `0 项` 装饰计数；任务 5 行时正常显示计数。未改任务数据、排序或状态。

### 1.5 进度区域

- 有确认进度（tasks>0、target>0、非 stale）：保留原“已学 {done} 分钟 · 目标 {target} 分钟”与数学比例/布局。
- `stale=true` 且至少有 1 个任务：只显示简短 `进度待更新` / `Progress needs updating`，不显示 0%，不画进度条。
- 无任务或 target=0 且非 stale：整块进度不渲染（删除无帮助的“今日任务已读取”默认提示与空进度条）；空任务即使 stale 也不显示进度块。
- 不新增百分比、不把未知折算成 0。

### 1.6 去重与内容边界

- 既有 statusMessages 逐字去重保留；`guideVisible` 时不再输出 firstLearning 同义行（避免 guide 之上再堆“继续设置，开始学习”）。
- guide 的 label/steps/action/事实行也加入逐字 skip。
- 未知 `planNotice` 原样显示，不映射成“目标已保存”等虚构事实；服务端 `explanation/summary/unavailableReason` 内容边界不变。
- C6 的 placeholder 选择器（`.uni-input-placeholder` + `.uni-input-input::placeholder`）、语义色、heading、字体、入口 token 均保持，未因文案改色。

## 2. 文案 diff（仅 `mobile.home`）

| key | C6 | C7 zh-CN / en-US |
|---|---|---|
| `progressUnknown` | “今日任务已读取” / “Today's tasks loaded” | **删除** |
| `progressStale` | — | `进度待更新` / `Progress needs updating` |
| `guideAction` | “继续设置，开始学习” / “Continue setup to start learning” | **删除** |
| `guideContinueSetup` | — | `继续设置` / `Continue setup` |
| `guideAssessmentReady` | — | `目标已保存，可继续测评。` / `Your goal is saved. You can take the assessment next.` |
| `guideLabel.assessment` | “目标已保存，下一步进入定级” / “Goal saved. Next is placement” | `目标已保存` / `Goal saved` |
| `stepsText.assessment` | “定级” / “Placement” | `测评` / `Assessment` |
| `takeAssessment` | “进入测评” / “Take assessment” | 不变（复用为 guide 主动作） |
| `empty.noPlan.title` | “还没有学习计划” / “No learning plan yet” | 不变 |

未新增任何“测评后一定生成计划”“已测准”类承诺。

## 3. C7 四源冻结哈希

| 文件 | 行数 | raw SHA256 | LF SHA256 |
|---|---|---|---|
| `apps/mobile/src/pages/home/home.vue` | 778 | `044948af7e0fab462f6c8c51f99e9bde2666cb799c9f2d261a37efedcbdcd5af` | 同 raw |
| `packages/i18n/src/mobile-experience.ts` | 239 | `7e2ef7b596eeb15fa60f715a0e00274a7d1290ddf13b1da4c6cc91116311126f` | `0bb9f0d6eda0cf25f45d18615d6ba4749586f19658dd5ef2ef6c21d511af158b` |
| `apps/mobile/src/stores/learner-content.ts` | 569 | `c4ef9dd83452ea44f6deda55ac0be2dd3e49a810cd82d183d5342fa9b71cec21` | 同 raw |
| `apps/mobile/src/platform/uni-runtime.ts` | 207 | `03b21bab8c4121ec289b5633ae9fab79ba0b64c60d0431f7adbf8953115f265a` | 同 raw |

本轮仅 home + i18n 变化；store/runtime 未动，列出以便冻结。i18n 工作副本 CRLF（仓库既有），LF 为规范化哈希。

`git diff --stat`（四源）：home 848 行变动、i18n 123、store 33、runtime 6；总 859 insertions / 151 deletions。`git status` 仅四源 `M` + `mobile-home/` 未跟踪目录。

## 4. 静态验证（不是 browser/UI PASS）

| 项 | 结果 |
|---|---|
| `pnpm --filter @englishflow/mobile typecheck` | `PASS_EXIT_0` |
| SFC script/template + scoped style compile | `C7_TEMPLATE_OK` / `C7_FINAL_OK`：3 个 heading（1×level1 + 2×level2）、C6 的 `.uni-input-input::placeholder` 与 `.uni-input-placeholder` 仍在、stale 仅在有任务时显示 |
| i18n 内存注册 lookup | `C7_LOOKUP_OK pageKeys=62`；zh/en 的 `guideAssessmentReady`、`guideContinueSetup`、`progressStale`、`takeAssessment`、`empty.noPlan.title` 精确匹配；`mobile.auth.home` 不存在 |
| 旧 key 残留 | 源/模板无 `progressUnknown`、`guideAction`、“今日任务已读取” |
| H5 build / 浏览器 / 矩阵 | `NOT_RUN`（不重复 DSH 已知阻塞；Root 全矩阵将冻结 C7 实跑） |
| Git | 无写操作 |

## 5. 需 Root 复验的 C7 交互点

1. C6 空态冲突场景：assessment guide + NO_PLAN + 0 tasks + footer，确认只剩一句测评事实 + 一个“进入测评”、一个“修改目标”，且“还没有学习计划”不重复设置描述/按钮。
2. 无 guide 的 NO_PLAN：原“开始设置”仍在。
3. gate/consent/goal guide：真实剩余步骤 + “继续设置”，不出现“开始学习”。
4. NO_PLAN 之外的 COMPLETED/NO_CONTENT/NO_DUE_REVIEW：文案/动作不被 guide 覆写，无“测评后生成计划”承诺。
5. 0 任务无“0 项”；5 任务计数正常。
6. stale=true 显示“进度待更新”且无 0%/空条；无任务/target=0 无进度块；确认进度数学不变。
7. 未知 planNotice 原文显示；guide 可见时 firstLearning 同义行不重复。
8. C6 placeholder/heading/字体/主题/200% 保持；四主题与全矩阵由 Root 复验。

## 6. 边界

产品仅 `home.vue` + `mobile-experience.ts` 的 `homeCopy` 键；文档新增本文件、C6 archive `HASHES.md`、`DESIGN-SPEC.md` C7 注记。未动 store/runtime/assessment/auth/MB006/56 文件/14 目录/依赖/权限/路由，未 Git。C7 四 hash 冻结交 Root；C6 smoke4/retry16 不升级，签收/构建/浏览器/提交由 Root 决定。
