# MB007 首页 C3 稳定候选（2026-10-21）

状态：`PRIVATE_CANDIDATE_C3 / UI_NOT_SIGNED / BROWSER_NOT_RUN`。仅修 Root C2 指出的入口重入与 token 问题；未改版式。未提交、未 fetch/push、未跑浏览器/服务器/安装依赖。以下为源码候选与静态检查，不宣称 UI 完成，也不把静态 finding 当成 browser PASS。

基线：`dev-redesign`，HEAD `5b3ca5a7`（本会话早前实测）。本地 UI 9 / 远程 7；MB005/MB006 未推。保护 manifest 与 56 文件/14 目录未触碰；未做 Git 写。

## 0. C1/C2 证据与分类

- Root 复核的 **C1 准确版本**：home raw `23b82b039bc3ae17445f21a2dbe1d3d42b8c7cd286c651a96666a5dc16731066`，私有快照 `.git/codex-local-backups/dsh-dispatch-20261021/mb007-c1-root-review`。早期 `CANDIDATE.md` 中的 `b7fb7d70…` 是中间态，已在 C1 文件加更正注记，未删除原记录。
- C2 为 Root 源码复核对象（finding 1/2/3 见 §2）；DSH 未另存 C2 快照。
- 当前工作树 = **C3**。C1/C2 的 before 图、finding 与说明均保留，不覆盖。
- 分类：本次修复是**源码静态 finding 的修复**；是否真实修好必须由 Root 的 browser late/重入用例判定，DSH 不填 PASS。

## 1. 四源清单（C3）

| 文件 | 行数 | raw SHA256 | LF SHA256 | 变更 |
|---|---|---|---|---|
| `apps/mobile/src/pages/home/home.vue` | 737 | `cc5ff41770cbee776cdf1be293eb20ffb19337add9ea5f95cbc6baf511b7345b` | 同 raw | 入口/动作 token、reading、导航、ARIA/focus、文案映射、样式选择器 |
| `packages/i18n/src/mobile-experience.ts` | 237 | `99ad89ffe73b8493500f97a94207f6dcda5dda1ac3456bdc56795275ad7aac63` | `dc3560c81678070709778c2a2fd8806bdef8e18a7e8489a8e0ba9d95864cce33` | 仅 `homeCopy()`/`mobile.home` 键（含 `coursesJumpFailed`）；未改 MB006/auth 文案。工作副本 CRLF（仓库既有），LF 为规范化哈希 |
| `apps/mobile/src/stores/learner-content.ts` | 569 | `c4ef9dd83452ea44f6deda55ac0be2dd3e49a810cd82d183d5342fa9b71cec21` | 同 raw | 本轮未再改；仍为 C2 的 homeGeneration/refreshPlanQueue 窄保护 |
| `apps/mobile/src/platform/uni-runtime.ts` | 207 | `03b21bab8c4121ec289b5633ae9fab79ba0b64c60d0431f7adbf8953115f265a` | 同 raw | 唯一极窄共享 diff：`openUniPage` 返回 `void | Promise<unknown>`，两分支 return 原 runtime 结果，query 机制不变 |

`git diff --stat`：4 文件，816 insertions / 151 deletions（home 807、i18n 121、store 33、runtime 6 行变动）。`git status --porcelain` 仅这 4 个 `M` + `docs/.../mobile-home/` 未跟踪目录。

## 2. Root C2 finding → C3 修复

### Finding 1：`entryRunning` 跨 onHide 保留，旧 GET 阻塞新 onShow

**修法**：删除全局布尔锁。改为

- `pageEpoch`：onShow/onHide/unmount/身份变化统一递增；
- `entrySeq`：每次入口读取递增；`activeEntry = {epoch, seq, owner}` 只代表**当前 epoch 的这次读取**；
- `runEntry()` 的防重仅当 `activeEntry.epoch === pageEpoch && activeEntry.owner === ownerKey()`；新 epoch 不等旧 GET，立即发新读；
- 旧 entry 的 finally 仅当 `entryCurrent(token)` 才清 `reading`/写 `enteredEpoch`；若 `activeEntry.seq` 已被替换则只清自己的空锁，不清新锁；
- 旧 HTTP 不 cancel（满足 Root 要真实 late 回包）；新读取由 store 的 `homeGeneration` supersede，旧响应不能写 home/plan。

结果（源码层预期，未 browser 验证）：A 旧 GET 持有 → 离开 → 返回（onShow 增 epoch）→ `maybeEnter` 立即启动新 entry 并行发新 GET，不显示永久“正在确认学习状态”；旧 GET 结束后不回写、不清新 reading。

### Finding 2：`pageOp` 被入口读取与导航共用，导航 reject 使 reading 永不清

**修法**：token 域拆分。

- 入口读：`EntryToken {epoch, seq, owner}`，只由 `entrySeq` 递增影响；
- 按钮/导航/重试 busy：`ActionToken {epoch, op, owner}`，只由 `actionSeq` 递增影响；
- `navigate()` 只取 action token，不碰 `entrySeq`；`runEntry`/`loadGuide`/`retryHome` 只取 entry token，不碰 `actionSeq`；
- `reading` 的 finally 只看 entry token；`busy` 的 finally 只看 action token；
- onHide/身份变化同时递增两个 seq，旧 finally 对新 busy/reading 都无效。

结果：loadHome 进行中点 header 设置 → 导航 reject 留本页 → 入口 token 仍有效，reading 按本轮 entry 结束清除；旧 action finally 不会清新导航 busy。

### Finding 3：`pageOwnerKey` 不能作为唯一补跑判断

**修法**：`maybeEnter()` 以“可见 + 同 owner 已认证 + 本 epoch 尚未正确验门/完成读”为准：

```
if (!pageVisible) return
if (!ownerKey) return
if (accessChecked && pageOwnerKey === key && enteredEpoch === pageEpoch && !reading) return
if (activeEntry && activeEntry.epoch === pageEpoch && activeEntry.owner === key) return
runEntry()
```

`enteredEpoch` 只在完整 `loadHome + 必要 guide` 成功后写入；status watcher 与 onShow 同时触发时，同一 epoch 的 `activeEntry` 抑制重复读取；身份未验证（`ownerKey` 空）不读业务。

### Finding 4 / 其它同步修正

- 导航改用 `openUniPage` 并 await 返回；learn 走 `switchTab` + 既有 pending-query 交接；无 400ms 计时器；失败仅在 `pageVisible && 同 owner && currentMobilePagePath()==='/pages/home/home'` 时显示。
- 异步 scroll success/fail 与 `nextTick` 聚焦均校验 `pageEpoch + owner`；motion 非 `on` 时 duration 0、`scrollIntoView behavior:'auto'`；失败显示 `coursesJumpFailed`，不静默 noop。
- 未知 `planNotice` 不再映射“目标已保存”：仅两条已知原文精确映射，未知原样展示（可能是中文，边界见 §5）。
- 课程不可用只有一个错误/重试分支。
- 入口读取期间隐藏进度/任务/课程/解释/空态/次出口，只显示一行 loading；guide 在 reading 结束后再露出。
- 设置按钮在 `reading` 时禁用；导航尝试不使入口读取失效。

## 3. 入口状态机（C3 源码行为）

```
onShow: pageVisible=true; pageEpoch++; entrySeq++; actionSeq++;
        activeEntry=null; enteredEpoch=-1; accessChecked=false; reading=false;
        busy=null; navError=''; courseJumpFailed=false; maybeEnter()

maybeEnter: 可见 + 同 owner 已认证 + 未完成本 epoch 读 → runEntry()

runEntry: token={epoch,seq,owner}
  ensureMobilePageAccess(owner 由 session 校验)
  token 失效/owner 变 → 退场；allowed=false 且仍当前 → 留在 checking（guard 负责分流）
  allowed=true → accessChecked=true, pageOwnerKey=owner, reading=true
  await loadHome(); entry 仍当前 → await loadGuide()
  finally: entry 仍当前 → reading=false, enteredEpoch=epoch, activeEntry=null
           否则只清自己 seq 的空锁
```

- 身份变化：`watch(identityRevision,{flush:'sync'})` → 增两 seq、清 accessChecked/reading/busy/search/guide/enteredEpoch → `maybeEnter()`；status 变 authenticated 再 `maybeEnter()`。
- onHide/unmount：增两 seq、清可见/reading/busy/accessChecked；旧 promise 之后的 finally 全部失效；成功跳页后旧 catch 不写缓存首页错误。

## 4. 必须由 Root browser 验证的重入/迟到用例

| # | 用例 | 断言 |
|---|---|---|
| 1 | 同 owner：旧 home GET 延迟 800ms，期间离开再返回 | 新 onShow 立即发**新** GET（网络面板可见），不等待旧 GET；页面不永久 checking；旧回包到达后不覆盖新 home/plan、不清新 reading |
| 2 | 同 owner：返回后旧 GET 先失败（500） | 新页面不显示旧的 offline/error；`lastError` 不被旧回包写 |
| 3 | loadHome 进行中点 header 设置并让导航 reject/留本页 | reading 随本轮 entry 结束清除；页面可用；不出现永久 loading |
| 4 | 导航 A 进行中触发身份切换/退出 | 旧 finally 不清新 busy；页面隐藏旧业务；401 由既有 handler 清会话并导航 login |
| 5 | 身份切换后新 owner 已认证且页面可见 | 自动重新 ensure + 新 load；不显示旧任务/旧 plan/旧 guide；搜索已清空 |
| 6 | status watcher 与 onShow 同帧触发 | 同一 epoch 只发一次入口读（防重），不重复 GET |
| 7 | 空态 courses CTA（NO_CONTENT/NO_DUE_REVIEW/COMPLETED） | 真实滚到书架；motion OFF/REDUCED 无动画；scroll 失败显示明确文案；焦点到 `#course-heading` 或搜索框 |
| 8 | 清除搜索 | 44px 清除；焦点回原生 input；aria-label/placeholder 在**原生 input**（`.uni-input-input`）上，不只是 uni host |
| 9 | 英语 200%、320 宽 | 按钮/次入口/任务状态不溢出、不拆成字母列；设置/清除命中区 44×44 |
| 10 | 真实 browser late 分类 | 只有真实回包与真实交互可记 PASS/FAIL；本文件的静态修复不预填 PASS |

## 5. 验证与限制（如实）

| 项 | 结果 |
|---|---|
| `pnpm --filter @englishflow/mobile typecheck` | `PASS_EXIT_0`（C3 最终源复跑，无输出错误） |
| SFC 编译（`@vue/compiler-sfc` parse + compileScript + compileTemplate） | `SFC_OK styles=1 code=28680`（语法/模板可编译，不等于运行/视觉） |
| H5 build | **C3 未重跑**。C2 两次均为 `BUILD_FAILED_ENV`：`[RESOLVE_ERROR] Could not resolve 'estree-walker'`（unimport exports）+ `optimizeSafeRealPathSync` spawn；按 Root 指示不再重复无意义尝试。不能据此判页面 PASS/FAIL |
| 浏览器/截图/真实 H5 | `NOT_RUN`（DSH spawn EPERM 已知，不重试；Root 执行） |
| 测试脚本/真实 late GET | `NOT_RUN`（仅 §4 计划） |
| Git | 无写操作；未 add/commit/push/fetch |

已知 GAP：`learner.home.read` 与客户端 `learning.plan.read` 门不匹配（未改权限）；`planNotice` 依赖两条 store 原文精确匹配；`unavailableReason/explanation/summary` 为服务端内容可能中文；`openUniPage` 在某些平台可能仍返回 void（此时只能发导航，无法 await 确认）；对比度/四主题/200% 未实测；`shelfNote` 仍从 summary 文本探测锁定。

## 6. 下一步

Root 审四源 diff（尤其 runtime 6 行）与 C3 hash；在其环境 build + 真实 H5 跑 §4；通过后再谈签收/提交。本轮不填 browser PASS，不改进度/CHANGELOG 完成数。
