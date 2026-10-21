# MB006 C8 checkpoint — 首页 switchTab/forward 旧 prompt/401 旧题闪显（候选，未验收）

日期 2026-10-21。仅 `apps/mobile/src/pages/assessment/assessment.vue` + 本目录证据。未改 i18n/API/store/session/nav/runtime/deps/vite/Git/tests；浏览器由 Root 执行，DSH 未 launch。不宣称修复或整页 PASS。

## 1. 因果分析（基于已装公共源码 + Root 实测）

1. **首页 FAIL**：uni-h5 `switchTab`（`uni-h5.es.js` 5935）先 `removeNonTabBarPages()`，再由 `navigate()` 调 `router.replace({path})`；`createNormalizeUrl`（4902）对 entry 页执行 `url.replace(routeOptions.alias, "/")`。home 是 `pages.json` 首 entry，故 guard 实际收到 `to.path === "/"`，与 permit 的 `/pages/home/home` exact target 不匹配；此时 `pending='navigate'` 使 `busy` 为 true，guard 返回 false → `navigate()` 的 `switchTab` promise reject → 本页 `errorKey='navigationFailed'`（"页面未能打开，请重试。"），URL 仍 assessment、0 write，符合实测。
2. **forward 后 fresh back 失效**：旧 guard Promise 在 forward 已被取代后若 resolve `false`，vue-router 以 ABORTED 结束并在 addPopStateListener 失败处理里 `routerHistory.go(-info.delta, false)` 回滚旧 delta，可能吞掉下一次 history 监听；因此地址到 login 但页面仍旧。
3. **401 旧题闪显**：onShow 重新校验期间，模板仍先渲染缓存的 `report/question/skipped`；Root 35 rAF 中 33 帧可见旧 question。需要在重新校验期间只显示准备态。
4. **标题 unhandled**：`setNavigationBarTitle` 在页面已被替换/移除后仍被 watch/ready 触发，异步失败未处理，产生 `errMsg='setNavigationBarTitle:fail page not found'`。

## 2. 实际修正

1. permit 增加 `aliases`：仅当目标为 home（含 H5 back→home）时接受框架已声明的 entry alias `"/"`；settings/today/native 前页 intent 不接受 `"/"`。仍校验 op/revision/active 与 one-use。并加 **仅 DEV** 最小诊断 `[assessment-nav-guard]`，输出 public `to.path`、`to.meta.route/isEntry`、`active`、`busy`、permit destination/target/aliases/operationCurrent（无 owner/token/headers）。
2. afterEach 仅在公开事实确认 supersede 时（返回本页 success/duplicated，或成功离开本页）以 `settleRouteLeave(true)` 让框架 canceled 检查（CANCELLED，不 go(-delta)）结束旧 Promise；手动 cancel/owner 变化/hide/unmount 仍 false。
3. 新增 `entryRevalidating`：onShow 先置 true、onHide/owner 也置 true；模板 `skipped/report/question/guide` 分支均加 `!entryRevalidating`，重校验期间只显示既有 pending 准备态；校验成功且 active 才清除。提交/重测 busy 不受影响。
4. `syncTitle` 只在 `active && navigationReady && pageVisible && isAuthenticated` 时调用，并捕获 Promise/异常失败；不修改其他页面。

## 3. 仅记录，不修

- 6 条 `Do not nest other components in text` warning 来自 settings 既有 text 内 AppIcon（401/408 等），本次不改 settings，也不全量豁免 warnings。
- 旧 risk hash-goto 两恢复 FAIL 非真实刷新失败：同场景 `today-1 10/10`、`full-reload-recovery 11/11` PASS，旧 `page.goto(hash)` 非 full-document；保留旧 FAIL 原样。
- 旧 4.6.4 服务运行证据保留原环境 scope，不称 4.4.4 PASS；新 18183 已由 Root 确认 4.4.4。

## 4. 冻结/执行

- C7b 原字节 `37bad477e4239061972941c42b24468db5994b8afb89feb61f720fbe168c07e5`（42425 bytes）：首次归档误在编辑后执行，已从 `dsh-20261021-c7/assessment.vue.c7b.raw` 原样纠正到 `c8/baseline/`，并写入 `baseline/c7b-baseline.json`；C7/C7b 原目录未改。
- C8 page raw=LF=`41e1670146621e532921a8916b2c81ea4954d880b2373c7bcc9945d6576d7e86`（44989 bytes）；四哈希 `c8-source-hashes.json`：i18n `6ac6800e…`、package `484382c7…`、lock `d57a87ca…`（后三未变）。
- `pnpm --filter @englishflow/mobile typecheck`：exit **0**。
- Browser/Native/小程序/partial-runtime/构建：**NOT_RUN**（本任务未执行；不引用旧构建阻塞作当前事实）。

## 5. 待 Root 实测

guide 两按钮到 home 且无 pageerror；forward 自动取消旧 prompt、A 保留、下一次 fresh back 重新确认且确认真正可离开；onShow 401 期间无旧题帧；标题无 unhandled；busy/native beforeunload 不回归。开发诊断可收 guard 的 `to.path/meta` 值。未声明任何分支 PASS。

## 6. Root 最终审签（2026-10-21）

- 状态：**UI_ACCEPTED_LOCAL / PUBLISH_BLOCKED**（本页实际 H5 受控 UI 具名范围，不是后台/native/整页业务，也不签 R1/IT READY）。
- 通过：backguard 95/95（6 cases）、author 32/32、keyboard 31/pointer 30/busy 31、matrix 34 MEASURED/226 PNG、owner submit-2 22/22 与 read-2 23/23（latePacket.received=true）、auth3 15/15、fonts 21、nav 15/17/12 + reload 11、Root build exit 0。
- 保留：states 全 suite 仍 FAIL（read/skip/restore 各唯一 no-console-warnings，12/9/6 条关联 route 警告）；settings-baseline 9、today 2、owner-read 14 条 warnings 原样保留，属未重排页面 follow-up；旧 run1 脚本 exit2 保留为 script 缺陷。
- 计数：本地已签 8→9，远程仍 7；发布 blocked（Git helper 子进程权限阻塞，不重试/不探凭据）。下一页 MB007 首页。
