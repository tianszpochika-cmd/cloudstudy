# MB006 C5b / C5c Root 审核记录（2026-10-20）

归属：实现由 **DSH 作者**完成；证据由 **Root 独立执行/审核**，文件原样复制自 `.git/codex-local-backups/dsh-dispatch-20261020/`（未改字节）。本文件是 DSH 文档转录，不是 DSH 浏览器 PASS，也不是整页签收。

## 源状态

- C5c 当前页：`apps/mobile/src/pages/assessment/assessment.vue` = `719cc0cef407b492544b1bff39537324b0672126df287bf7d5644a25b6fe81c1`；i18n `6ac6800e…`；`apps/mobile/package.json` = `484382c7…`；`pnpm-lock.yaml` = `d57a87ca…`。快照与 hash manifest 见 `.git/codex-local-backups/ui-audit-20261020/c5c-checkpoint/`。
- C5b 证据对应页为 `24281df0…`（历史时点）；C5c 为 `719cc0ce…`，两者不可混为同一 hash 结论。

## C5b：cancel / confirm（scoped PASS）

`root-c5b-cancel-confirm.json`（`closed=true`）：

- cancel：停留 `#/pages/assessment/assessment`，`selected=true`；`counts={start:1, respond:0, retest:0, ensure:0, GET:12}` → 取消不留写、不改选择。
- confirm：到 `#/pages/login/login?...returnTo=%2Fpages%2Fassessment%2Fassessment`，`promptCount=0`，`respond=0`、`ensure=0` → 确认离开后无提交写、无新 start。
- 结论：**scoped PASS**（仅本组取消/确认路径；焦点与 0 写约束成立）。

## C5b：busy repeat（scoped PASS）+ 二次 back UX FAIL

`root-c5b-busy-repeat.json`（`closed=true`）：

- `held="response"`；提交挂起时 `root=1`、`prompt=0`、`choice=true`、`busy=true`、`respond=1` → **真实响应持有**，按钮处于 busy。
- 释放后 `choice=false`、`busy=false`，仍停留 assessment → 一次接受、无重复提交。
- 第一次 back：到 login（`returnTo` 保留），`root=1`、`prompt=1`、`choice=true` → **back 被拦**。
- 第二次 back：**`about:blank`**（`root=0`）→ 这是**未解决的 UX FAIL**，原样保留，不算通过。
- 结论：busy 行为 scoped PASS；二次 back 的 about:blank 为独立 UX 问题。

## C5c：beforeunload（浏览器原生告警，非 native App 验收）

`root-c5c-native-unload.json`（`closed=true`），页 `719cc0ce…`：

- dismiss：二次 back 后停留 login（`root=1`、`prompt=1`、`selected=true`）；随后 custom cancel → 回到 assessment、`selected=true`、`respond=0`、`start=1` → **取消不丢草稿、0 写**。
- accept：显式离开到 **`about:blank`**（`root=0`、`prompt=0`），`respond=0`、`GET=9` → 接受离开且无提交写。
- 这是**浏览器 `beforeunload` 事件**行为，**不是 native App 的离开/返回验收**；native 仍 NOT_RUN。

## 构建

- Root 构建 C5b 与 C5c 均 **exit 0 / DONE Build complete**（`root-c5-build-h5.log`、`root-c5c-build-h5.log`，stderr 仅既有 Sass deprecation）。
- 作者环境的 `build:h5` 执行阻塞为**历史事实**，不是当前 Root 构建 FAIL；也不因构建通过而升级整页 UI/业务 PASS。

## 保留范围

- C4 的 guide 边框 `15.23` 与 selected-C 词未拆，仅为 **C4 自身证据范围**，不外推到 C5。
- C5b 二次 back FAIL 保留；C3/C5 旧 PASS 不得盲目复用。
- pending：C5c 全主题/语言/宽度/200% 矩阵、风险共享回归/onShow/owner/late GET/recovery、独立终审；矩阵与旧套件需 Root 复核后**显式重新 freeze**；back guard 套件 gate 正更新，旧 gate 结果应记 **NOTRUN**，不得当 PASS。

## 状态

- MB006 仍 **IN_REVIEW / 未提交**；本地 UI 8 / 远程 7；无 CHANGELOG 完成条目、无稳定推送、候选未签。
- DSH Git 子进程权限阻塞仍在；不重试 fetch/push/escalation。
- 额度：Root 23:37 实读 90%（周 30%，ordinary=true）；≥95% 停止线，尚未暂停。

## 补记（2026-10-20 23:45，Root 官方 prepared suite）

- cancel-2 21/21、busy-2 18/18、clean-1 14/14 = **53 scoped PASS**，三者 `sourceStable/dependenciesStable/closed=true`；非整页，native/backend NOT_RUN。
- repeat-1（10/10，`UX_FINDING_NOT_PASS`）的 `about:blank` 分类为 **UX finding，不是当前产品 FAIL**：playwright-core 1.63.0 无 dialog 监听时对 beforeunload 默认 accept（`coreBundle.js` L62285-62288；`_close` L13283-13286）；suite 无显式监听，fixture 默认接受。Root 独立 dismiss/accept 两分支已 PASS（`root-c5c-native-unload.json`）。旧 C5b 未告警离开 TRUE FAIL 保留；下一步加显式监听记录 type/action 后复跑 repeat/forward。
- 证据副本：本目录 `root-c5c-suite-{cancel-2,busy-2,clean,repeat}.log`、`root-c5c-suite-{cancel,busy}.log` 与 stderr（旧 gate 拒绝记录）。
