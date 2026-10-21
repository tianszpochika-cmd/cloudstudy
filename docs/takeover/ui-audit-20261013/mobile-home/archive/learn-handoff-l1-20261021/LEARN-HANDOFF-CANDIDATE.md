# MB007 learn handoff 窄补修候选（2026-10-21）

状态：`PRIVATE_CANDIDATE / UI_NOT_SIGNED / BROWSER_NOT_RUN`。只补 learn 页导航/读模型生命周期；不重做 learn 整页、不改布局/文案/复习写口/门/接口，也不称 learn 整页重设计完成。未提交、未 fetch/push、未跑浏览器/服务/依赖，未改全局完成数。

## 0. 触发与原始证据

- Root C7 navigation 实际失败（`codex-20261021-c7-navigation-1`，三个 FAIL）：从首页进入**第二门不同课程**时，新 contentCode 没有 GET，DOM 仍显示第一门课；sourceStable/closed、unknown=0。
- Root 已定位：`apps/mobile/src/pages/learn/learn.vue` 只在 `onLoad`/`onMounted` initializeContent 消费 pending query；uni tab 常驻后第二次 `switchTab` 不再触发 `onLoad`，`onShow` 只 `learning.load()`，新 contentCode/taskId 留在 handoff 未读。旧 `loadContent` 在 await 前写 `loadedCode`、无 owner/请求序号，晚包可覆盖新课；同 code 失败重试可能被 cache 短路。
- 原始 learn 已归档 `mobile-home/archive/learn-handoff-before-20261021/`（含 `HASHES.md`）：raw/LF `83b0756b84bbd2e34a4c4bdee196b02bb63403ca64b032034a16ffd7187d17c1`，213 split 行 / 212 编辑器行；归档前 tracked clean，未在 56 保护 manifest，未覆盖原差量。
- C7 四源冻结不变：home `044948af7e0fab462f6c8c51f99e9bde2666cb799c9f2d261a37efedcbdcd5af`、i18n `7e2ef7b596eeb15fa60f715a0e00274a7d1290ddf13b1da4c6cc91116311126f`、store `c4ef9dd83452ea44f6deda55ac0be2dd3e49a810cd82d183d5342fa9b71cec21`、runtime `03b21bab8c4121ec289b5633ae9fab79ba0b64c60d0431f7adbf8953115f265a`。旧 FAIL/截图全部保留。

## 1. 新源与最小 diff

| 项 | 值 |
|---|---|
| 文件 | `apps/mobile/src/pages/learn/learn.vue` |
| 新 raw SHA256 | `52091366379e3a00771df9c8bf01a56ee4de08078c2e728fcce456beeb9e8c56` |
| 新 LF SHA256 | 同 raw（LF 工作副本） |
| 行数 | 303（split） |
| diff | `+108 / -18`（仅该文件；`git status` 无其他新增产品文件） |

改动只在 `<script setup>` 与两处呈现条件/重试参数：

1. **生命周期**（`:184-206`）：`onLoad` 只记录初次 intent，不再 load；删除 `onMounted` 的 initializeContent（避免空 intent 覆写 taskId/重复请求）；`onShow` 每次在既有 `session.restore()` + `isAuthenticated` 门通过后调用 `syncPage()`；`onHide`/`onBeforeUnmount` 使 epoch/read token 失效。
2. **intent 消费**（`takeIntent` `:102`）：每次真实 onShow 在门通过后 `consumePendingNavigationQuery('/pages/learn/learn')`；pending 优先，其次初次 onLoad options，再次 H5 hash query；只消费一次。新课程 intent 即使 same code 也 force 读取；新课程不带 task 时清旧 taskId。
3. **读模型 token**（`loadContent` `:118`）：`loadedContentCode` 只在成功且仍当前时记录；`readSeq + pageEpoch + owner{verifiedSubject,identityRevision}` 组成独立 read token；旧回包不写当前 `content/error/loading`；失败清 `loadedCode`，重试同 code 可真实发 GET；不主动 abort 旧 HTTP。
4. **owner**（`invalidateOwner` `:172`）：`watch(identityRevision,{flush:'sync'})` 清 content/task/loaded、遮旧内容并重跑 gate；新 owner 不会把旧课当新课。
5. **重显恢复**（`syncPage` `:149`）：无新 intent 时保留 ready 课程；若上次 loading 被离页打断或上次 error，onShow 重新读取同一 contentCode，避免永久 loading/旧错误壳。
6. **呈现**：仅把 loading 条件改为 `!gateReady || contentState==='loading'`（门未通过时遮旧内容），error 重试改 `loadContent(contentCode, true)`；无 copy/布局改动。

未改：API、store、shared 模块、路由/storage key、权限/门、learning.load 复习写口、contentLocale 与 uiLocale 分离、401/403 既有分流。

## 2. 权限 / owner / 晚响应 / 重试测试计划（Root browser）

| # | 场景 | 断言 |
|---|---|---|
| L1 | 课程 A→首页→课程 B（不同 contentCode） | B 发出新 `GET /content/learner/{B}`；DOM 标题/内容为 B；不残留 A |
| L2 | A→首页→A（同 code 明确新 intent） | 仍发新 GET，不只显示旧缓存 |
| L3 | A→首页→B（B 无 taskId） | 旧 taskId 被清；不显示旧任务完成提示 |
| L4 | B 加载中快速返回 A 或再进 B | 仅最后一个 intent 写 content/loading/error；旧回包不覆盖 |
| L5 | B 加载中离开，再返回且无新 intent | 重新读取 B（同 code），不永久“正在读取课程” |
| L6 | A ready 后离开/返回且无新 intent | 保留 A，不重复 GET |
| L7 | 身份切换/退出期间 B 在途 | 旧 B 回包不写；内容清空；新 owner 重新 gate；不把 A/B 旧课显示给新 owner |
| L8 | 401/403 | 保持既有 API 分流/登录/无权限行为；不把错误当成功内容 |
| L9 | B 失败后点重试 | 真实重试同 code（force），不被 cache 短路 |
| L10 | 直接深链 `#/pages/learn/learn?contentCode=X` | 初次 onLoad/hash intent 读取 X；onMounted 不覆写 |
| L11 | 只有 pending、无 onLoad options（tab 二次进入） | pending 被消费且只一次；后续 onShow 不重复消费 |
| L12 | 权限/门未通过 | 不读业务内容；遮旧内容；按既有 login/forbidden/onboarding 分流 |

## 3. 静态验证

| 项 | 结果 |
|---|---|
| `pnpm --filter @englishflow/mobile typecheck` | `PASS_EXIT_0` |
| SFC parse/compile（script + template） | `LEARN_SFC_OK code=14556` |
| 源码断言 | 无 `onMounted`/`initializeContent` 残留；存在每次 onShow 的 pending 消费、`readSeq/pageEpoch/activeSync`、owner、`loadContent(contentCode, true)` |
| H5 build / 浏览器 / late 回归 | `NOT_RUN`（不重复 DSH 已知阻塞；Root 将跑 A→首页→B、late/owner 与共享 C8 出口） |
| Git | 无写操作 |

## 4. 边界

产品仅改 `apps/mobile/src/pages/learn/learn.vue`；文档新增本文件与 archive `HASHES.md`。C7 四源字节未变；未动 MB006/56 文件/14 目录/依赖/权限/路由/完成数。Root 审后执行真实课程 A→B、late/owner 窄回归与共享 C8 出口；C7 navigation FAIL 在真实复跑前不升级。
