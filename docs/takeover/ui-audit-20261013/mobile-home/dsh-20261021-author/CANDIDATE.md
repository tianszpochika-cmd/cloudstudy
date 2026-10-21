# MB007 首页私有候选说明（2026-10-21）

状态：`PRIVATE_CANDIDATE / UI_NOT_SIGNED / BROWSER_NOT_RUN`。本轮由 DSH 写产品与文档，Root 独立执行浏览器；**未**提交、未 fetch/push、未 SSH/凭据探测、未启动服务器/浏览器、未安装依赖。没有浏览器 PASS，没有签收，没有改全局进度/CHANGELOG 完成数。

> **C1 哈希更正（2026-10-21，Root 复核）**：Root 快照的 C1 首页 raw SHA256 为 `23b82b039bc3ae17445f21a2dbe1d3d42b8c7cd286c651a96666a5dc16731066`，私有快照在 `.git/codex-local-backups/dsh-dispatch-20261021/mb007-c1-root-review`。本文件下表 `b7fb7d70…` 是 C1 过程中的中间态，**不是 C1 最终版本**；保留此更正，不覆盖原记录。C2 由 Root 源码复核（finding 见 C3 文件），当前工作树为 C3。

基线（本会话早前观测）：`dev-redesign`，HEAD `5b3ca5a7`；本地 UI 9 / 远程 7；MB005/MB006 未推。保护 manifest `.git/codex-local-backups/ui-audit-20261013/preexisting-work.json` 未读写覆盖；56 文件/14 目录未触碰。

## 1. 交付物与哈希

| 文件 | 行数 | SHA256 raw | SHA256 LF | 说明 |
|---|---|---|---|---|
| `apps/mobile/src/pages/home/home.vue` | 541 | `f23b3a1b63acb1a55ac13b96f4128547a3d4b74055229854f822ce53d33d0554` | 同 raw（LF 工作副本） | 整页候选 |
| `packages/i18n/src/mobile-experience.ts` | 234 | `813eb3dc9d60c8e4fb7d391fefc7eac1b4218c29daf6ffa0f323dd29f8cc3fb7` | `ac4ebcd36213e62c44dd93e18bdcd8f57d95e208079a811fbb15beab763637ec` | 仅新增 `homeCopy()` + `mobile.home` 键；工作副本 CRLF（仓库既有约定），LF 为规范化哈希 |
| `apps/mobile/src/stores/learner-content.ts` | 568 | `c4ef9dd83452ea44f6deda55ac0be2dd3e49a810cd82d183d5342fa9b71cec21` | 同 raw（LF 工作副本） | 窄 generation 改动 |
| `docs/takeover/ui-audit-20261013/mobile-home/concept.png` | 951×1654 | `589d4047e6cc81778798b5312e9cf95c81a7a6b0ead550a5109cc8de786fae09` | — | Root 参照图复制（1207143B），非实图 |
| `docs/takeover/ui-audit-20261013/mobile-home/DESIGN-SPEC.md` | — | — | — | 精确规格/文案/状态/映射/差异 |
| `docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-author/CANDIDATE.md` | — | — | — | 本文件 |

`git status --porcelain`（受限路径）确认只有上述三个产品文件为 `M`，`mobile-home/` 为未跟踪新目录；未出现其他产品改动。`git diff --stat`：home 614 行变动、store 33、i18n 119（617 insertions / 149 deletions）。

## 2. 实现摘要

- 单 H1“今日学习”；顶部仅品牌小字 + 44×44 设置按钮（`AppIcon gear`，无字符装饰图标）。
- 真实进度：“已学 {done} 分钟 · 目标 {target} 分钟”；宽度 `min(100, done/target*100)%`；`target=0` 或 `stale` 只显示“今日任务已读取”，不画 0%。
- 今日任务开放列表；首个可执行任务行内 48px 全宽主 CTA，其他可执行任务 44px 次级动作；完成/锁定/不可用保留行、状态文字 + 图标、无死按钮；不可用原因不重复。
- 课程搜索（原生 `@input` 即时值、44px 清除、结果计数）+ 开放课程列表（无卡片框，标题整行换行）。
- 错题本单导航行；底部“修改目标 / 进入测评”安静文字次入口；5 tab 与 `pages.json` 未改。
- 门校验期间隐藏旧业务/次出口，只显示轻量 `checking`；`accessChecked` 每次 onShow 重置；401 仍由既有 handler 清会话并导航 login；403 由既有 handler 分流，不吞 Promise。
- onHide/unmount 递增 `pageEpoch`，使 guide/导航回调失效；身份切换清搜索、错误、busy、guide，store reset 清 home。
- 空态/错误为轻量文本行；计划失败与“今天没任务”分离；计划空态按 `emptyReason` 用 i18n 决定文案，`NO_CONTENT/NO_DUE_REVIEW` 真实滚动到 `#course-shelf`，`COMPLETED` 不再导航自己。
- 服务端 `explanation/title/description/unavailableReason/summary` 原样显示，不翻译、不覆盖 `contentLocale`；UI locale 只走 `mobile.home`。

## 3. store 窄变化逐行说明

改动文件：`apps/mobile/src/stores/learner-content.ts`（+20/-8 左右）。不涉及 API、目标保存、assessment、identity 判定、其他 load。

1. `let homeGeneration = 0`（`:122` 前，`ensuredPlanVersion` 旁）：每个 store 实例一个单调序号，仅用于首页读模型。
2. `reset()` 首行 `homeGeneration += 1`（`:123`）：身份切换、setup、无 owner 的重置都会让所有在途 home/plan 读失效。
3. `loadHome()` 开头 `const generation = ++homeGeneration`：每次 load（onShow、重试、返回）取得最新代号。
4. `const current = () => generation === homeGeneration && stillCurrent(owner)`：同时要求“仍是最新一次首页读”和“仍是同一 owner/revision”；保留原 `stillCurrent` 身份保护。
5. `restore()` 与 `homeStatus='loading'` 仍在取号之后；`ensureContentLocale` 后、`readHome` 后各加 `if (!current()) return`：旧代号不再写 `home`/`homeStatus`/`lastError`/`persist`。
6. `catch` 内同样 `if (!current()) return`：旧请求的失败不能把新请求已成功的页面改成 offline。
7. 成功/失败后仅最新代号调用 `refreshPlanQueue(owner, current)`：旧首页读不再触发/写入 plan 队列。
8. `refreshPlanQueue(owner, stillWanted?)`：请求前、`await readPlanToday()` 后、`catch` 内均检查 `stillCurrent(owner) && (!stillWanted || stillWanted())`。参数可选，`replanAfterGoal` / `ensurePlanFromReport` / 页面重试的既有单参调用不变。

效果与边界：同一 owner 下“后发请求赢”，旧 home/plan 响应不能覆盖新状态；身份重置使旧响应静默丢弃。**未**用测试/浏览器证明，不能称已修 PASS；这是源码层窄保护，不是共享安全层重构。

## 4. 迟到 GET 测试计划（待 Root/测试作者执行）

用可注入延迟的 home/catalog/today 响应（不改产品）：

| 用例 | 步骤 | 断言 |
|---|---|---|
| A 后发赢 | `loadHome` A 延迟 500ms → 立即 `loadHome` B 延迟 50ms | 最终 `home`/`homeStatus` 为 B；A 不得改 offline/ready；不得有两次 plan 写入 |
| B 身份切换 | A 延迟中切换账号/退出（identityRevision+1） | A 返回后 `home` 不写、`planQueue` 不写；store 保持 reset 态 |
| C home/plan 交叉 | A home 成功、A today 延迟；B home 成功、B today 快 | 最终 planQueue 为 B；A 的 today 不覆盖 |
| D 旧失败晚到 | B 成功后 A 以 500 失败 | 不得显示 offline/error；`lastError` 不被 A 写 |
| E 旧 401/403 晚到 | B 成功后 A 返回 401/403 | 旧响应不产生“假空态/假离线”；全局 401/403 行为不被本页吞 |
| F 重试重入 | 连点重试两次 | 只有最后一次进入 plan 刷新；busy 释放正确 |

真实 H5 侧另需：从 learn/assessment/onboarding 返回触发 onShow，确认旧页数据不闪回；`onHide` 后 pending 导航不写 `navError`；切换账号后搜索词为空。

## 5. 验证结果（如实）

| 项 | 结果 | 说明 |
|---|---|---|
| `pnpm --filter @englishflow/mobile typecheck` | `PASS_EXIT_0` | 本轮执行两次（页面/store/i18n 改动后均通过），无输出错误 |
| SFC 模板编译（`@vue/compiler-sfc` parse + compileScript + compileTemplate） | `SFC_OK` | 输出 `SFC_OK styles=1 code=27593`；只证明模板可编译，不等于运行/视觉通过 |
| `pnpm --filter @englishflow/mobile build:h5` | `BUILD_FAILED_ENV`（exit 1） | `[RESOLVE_ERROR] Could not resolve 'estree-walker' in ../../node_modules/.pnpm/unimport@4.1.1/...`（exports 未定义）+ `optimizeSafeRealPathSync` spawn 错误；发生在依赖解析阶段，未指向本页源码。未安装依赖（禁止），未重试绕过 |
| 浏览器 / 截图 / 真实 H5 | `NOT_RUN` | DSH 浏览器 spawn EPERM 已知，不重试；Root 执行 |
| 测试脚本 / 单测 / 迟到 GET | `NOT_RUN` | 仅给计划，未写测试文件 |
| Git | 无写操作 | 未 add/commit/push/fetch；仅 `git status`/`git diff`/`git log` 只读 |

构建失败与 Root 早前 `build exit0` 的差异属环境/依赖状态不同，不能据此判产品 FAIL，也不能据此判通过；需 Root 在其环境复跑。

## 6. 已知 GAP / 限制（不掩盖）

1. **权限门不匹配**：首页契约要求 `learner.home.read`，客户端 `isLearningReady` 仍用 `learning.plan.read`；本轮按要求未改权限。
2. **`planNotice` 本地化**：store 仍输出中文；页面按已知两条文案识别映射为 `home.planConflict` / `home.planReplanFailed`（字符串匹配）。更稳的做法是 store 暴露 code，属后续窄改。
3. **`shelfNote`**：仍从课程 summary 文本探测“已锁定”，中文/内容语言耦合；未改数据来源。
4. **服务端内容**：`explanation`、任务/课程标题与描述、`unavailableReason`、`summary` 原样显示，可能是中文；这是内容边界，不翻译。
5. **滚动**：`uni.pageScrollTo({selector})` 失败才回退 H5 `scrollIntoView`；原生 selector 支持未验。
6. **导航 await**：`getUniRuntime().navigateTo` 的 Promise 被 await；guard 重定向时以 `currentMobilePagePath()` 变化判定，400ms 级轮询有窗口误差；tab query 交接未使用（本页动作目标均非 tab）。
7. **对比度/200%/四主题**：未实测；token 已按语义选型，控件边界用 `text-secondary`，仍需 Root 浏览器测量。
8. **迟到 GET**：源码保护已加，但未跑测试，不能称 PASS。
9. **FEAT/PRD-ATOM/ARCH**：未闭合，映射见 DESIGN-SPEC 的 GAP。
10. **未接 `completeTask`**：首页不提供完成写口，进度只随学习页/服务端读回变化。

## 7. 建议 Root 审核顺序

1. 核对上述哈希与 `git diff` 范围（仅 3 个产品文件）。
2. 在其环境复跑 typecheck/H5 build；若 build 仍因 `estree-walker` 失败，按环境问题处理，不用来判页面。
3. 真实 H5 逐态走查：门校验、ready、五任务状态、四种空态、计划失败、课程三态、搜索即时输入/IME/清除、错题/次入口、返回恢复与迟到响应。
4. 四主题、zh/en、320/390/768/1280、200% 文字、焦点/对比/命中区。
5. 通过后再决定是否签收与提交；本页未签，禁止把本轮候选称作 UI 完成。
