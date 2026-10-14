# Mobile 登录：即时输入补修断点

日期：2026-10-14。状态：**已实现并通过作者 UI 回归；待最终独立复签及逐页提交推送**。额度工具实读已用91%，立即停止设计、修复及新测试，仅回收已启动测试并保存本记录。旧 `20261014-run1` 的报告与证据未修改。

**11:10额度恢复后的收口**：冻结源码哈希一致，独立审者已完成[最终复签](../20261014-final-review/review.md)，`UI_SCOPE_PASS`。6组0.6–1.1ms即时输入、无detail保值、原生语义/busy、初次合法等待无占位、英文精确200%错误高度与超过10秒等待，共13独立分组通过。根Agent实际查看最终390等待与英文200%清理截图，接受本页具名UI范围；推送收据随后记录。以上追加不改暂停时的历史状态或旧FAIL。

## 实际问题与补修

MB-002 发现 uni-h5 原生输入向页面 v-model 的更新节流100ms，随后对已推 MB-001 实际复现同族问题：两个原生 input 事件、blur、提交在1.2ms内完成；登录 action 收到 leading 旧值，未消费最终输入。隔离 action stub 仅记录相等布尔值；同期 uni-form `detail.value.password` 与 blur `detail.value` 均是最新输入。没有读取请求 body、Token、Cookie、认证存储或真实凭据。

本地 uni-h5 源码 `useValueSync` 将 `update:modelValue` 与 input 事件节流100ms；`useFormField("name", state)` 收集即时组件 state；blur 携带即时 state.value，confirm 携带即时字段值。正式页面现在使用具名 form submit detail 以及 blur/confirm detail 同步对应字段，然后校验和调用现有 session action。事件类型有明确 Field/FieldEvent/SubmitEvent，缺少 detail 保留已有 refs，提交期间不同步。没有在正式页面读取 DOM.value，没有等待节流时长，没有改变 IAM/client/store 或共享资源。

另修正反馈消失导致的按钮位移：只有实际出现非空错误后才保存 `lastErrorText`；错误清理时保留该条文案的自然高度并隐藏，移除 id、role 与关联。初始及首次合法 busy 不插入隐藏反馈行。英文换行按真实旧文案高度保留，无固定单行高度。根Agent在最终 `lastErrorText` 修改前已独立复验快清空0请求及纠正click1请求、按钮top稳定；最后源码仍待最终独立复签。

## 当前已取得结果

- 最终 `results.json`：`PASS_UI_SCOPED_NOT_BUSINESS_ACCEPTANCE`；26组原尺寸/语言/主题及文本放大矩阵，6项低于100ms的即时输入用例通过。
- typed password立即清空→click/Enter：零登录调用及零 IAM 请求，缺项焦点到密码且原生 aria-invalid 正确。
- 最后字符及完整替换→click/Enter：隔离 session.login stub 的账号/密码相等判定均为true；不输出具体值，零 IAM 请求。
- 首次合法提交按钮位置：busy前后top均481.265625px，没有隐藏反馈行导致位移。
- 原键盘、ARIA、live locale、busy/重复提交、负向拒绝及慢请求回归通过；两段fixture为5.1s登录响应+5.9s权限503，保持各请求低于8s并在10秒后验证busy。没有真实认证成功或业务验收声明。
- `pnpm --filter @englishflow/mobile typecheck` 与 `build:h5` 通过；构建仍有既有 Vite/Sass/动态导入提示。范围内 `git diff --check` 通过。
- 首轮 `results-first-run-fail.json` 保留：原5.1s+5.1s fixture的10.05s采样断言观察到busy已结束，约150ms的采样余量过窄；第二段fixture改5.9s扩大余量，最终冻结源码重跑通过。首轮不作通过证据。

## 源码快照与未完成边界

`apps/mobile/src/pages/login/login.vue` SHA-256：`da5ad20851a4158ea0e23918adb27f1bcc7047ae67778add321aa8d397bb58be`。

`apps/mobile/tests/ui-login.e2e.cjs` SHA-256：`e7e2d2e125ac25bdb65223a7b90b7dda59a2e9bd95955ecbba2e18653ec0e701`。完整相关资源哈希见 `results.json` 的 sourceHashes。

补修尚未提交或推送。下一周期先核对最终源码/证据哈希，完成独立复签，更新索引/CHANGELOG并作为 MB-001 单页补修提交推送。该补修不修改原有真实 IAM/原生 App/小程序/读屏/物理键盘边界；真实账号成功登录、原生触摸键盘与原生平台构建未验收。

本轮作者没有修改共享 i18n/token/icon、旧 run1 报告、Git 或服务。MB-003 只读缺陷清单已交根Agent，本周期未开工。
