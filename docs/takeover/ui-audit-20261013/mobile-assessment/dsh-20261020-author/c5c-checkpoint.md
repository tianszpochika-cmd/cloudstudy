# MB006 C5c author checkpoint — H5 beforeunload 文档级保护（候选，未验收）

日期 2026-10-20（CST）。在 C5b 之上仅加标准 H5 `beforeunload`；未宣称修复/PASS。未改依赖、API/store/native/global router/history/popstate，未跑 Git/服务/浏览器。

## 1. Root 已测事实（保留，不抹除）

- `root-c5b-cancel-confirm.json`：普通 cancel/confirm scoped PASS、0 writes、focus 正确。
- `root-c5b-busy-repeat.json`：submit hold 时 back 被阻断、0 prompt、respond 1；release 后 accepted 1 PASS。
- 真实重复 back（guard 提示未决时）：第一次 URL=login 但 root 仍 assessment、prompt 1、A=true；**第二次 back 实际离开到 about:blank（root 0、prompt 0）**。这是文档级离站丢草稿 UX FAIL，本文件不豁免。

## 2. 源冻结

- C5b 原字节/哈希在编辑前保持：`c5-baseline/assessment.vue.c5b.raw` = `24281df0…8c529a`（未覆盖）；package `484382c7…c0078`、lock `d57a87ca…06624` 未变。
- C5c 快照：`assessment.vue.c5c.raw` raw=LF=`719cc0cef407b492544b1bff39537324b0672126df287bf7d5644a25b6fe81c1`（37049 bytes）。见 `c5c-source-hashes.json`。

## 3. 实际改动（仅 page，H5 条件块）

- 在既有 route guard 之外新增标准 `beforeunload`：`event.preventDefault()` + `event.returnValue = ''`，无自定义文案/无 history/popstate。
- 触发条件：`active && session.isAuthenticated`，且（未提交选择且当前题存在）或（`pending === 'submit'|'retest'` 写请求在途）；`routeLeaveBypass`（页面 UI 已确认导航）时不拦。干净/只读状态、纯 read/entry 不拦。
- 注册/清理：`onMounted` 添加、`onBeforeUnmount` 移除（H5 条件内），每实例一次；KeepAlive 隐藏时 `active=false` 不触发；owner 变化经既有 watcher `invalidate()` 清空选择/pending，旧状态不再触发。
- C5b 的 route guard、C4 CSS/导航、`onBackPress` 全部保留；依赖文件未动（C5 的 4.4.4 直依赖仍在）。

## 4. 语义与限制（未验证项显式化）

- SPA 内首次 back 仍走 C5b route guard（确认框）。`beforeunload` 只覆盖真实文档卸载：reload/close/跨文档导航（含第二次 back 离开当前 document），此时浏览器显示原生对话框，页面无法自定义文案。
- Chrome 对 beforeunload 要求 sticky user activation；若在无交互/某些浏览器分支不弹原生框，则本页无法用标准 API 覆盖，**不得**以全局 patch 兜底；需 Root 实测记录实际分支。
- 未验证：Chrome 实际原生框、dismiss 保持页面与选择、accept 允许离开、重复 back 是否被原生框截断；未声明 iOS/Safari 支持。

## 5. 执行

- `pnpm --filter @englishflow/mobile typecheck`：exit **0**（C5c）。
- 构建/浏览器/native：**NOT_RUN**（本任务禁止；C5 阶段的 `build:h5` 仍为预存在 `estree-walker`/EPERM 环境阻塞，见 `c5-baseline/build-h5.c5.log`）。
- 不预签：页面 source、C5b、C5c 均未获 Root 浏览器验收。
