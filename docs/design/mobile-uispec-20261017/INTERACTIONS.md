# 移动端交互说明（逐页追加）

本文件记录各原型页与共享层的交互契约。页面侧的条目按 PAGES.md 顺序追加；共享约定优先于页面局部说明。

## 0. 共享层约定（shared.css / shared.js）

### 0.1 主题
- 入口：手机框外工具条「浅色 / 深色」按钮（`[data-theme-set]`）。
- 优先级：URL `?theme=light|dark` → `localStorage['uispec-theme']` → 浅色。
- 行为：切换 `html[data-theme]`，同步 `aria-pressed`，触发 `uispec:theme` 事件；截图脚本通过 `?theme=` 固定主题。
- 页面不得自建主题按钮或硬编码品牌色。

### 0.2 页面状态
- 工具条「状态」按钮（`[data-state-set]`）切换 `html[data-screen-state]`，取值 normal / loading / empty / error / forbidden / offline。
- 页面把每个状态块标记为 `[data-state-block="…"]`；共享 CSS 只显示与当前状态匹配的块。`data-states` 属性决定工具条显示哪些状态。
- 切换时触发 `uispec:state` 事件，供页面做进入态副作用（如聚焦、重新计时）。
- 状态必须是本页真实存在的状态；不得为不存在的状态造静态占位。

### 0.3 外框组件
- `<div data-ui="statusbar">` → 44px 状态栏（9:41 + 信号 / Wi-Fi / 电池，内联 SVG）。
- `<div data-ui="navbar" data-title="…" data-back="…" data-action="…">` → 48px 导航栏；返回命中区 44×44；`data-back="none"` 隐藏返回；未给链接时点击返回上一页（无历史则回 `home.html`）。
- `<div data-ui="tabbar" data-active="home|practice|world|learn|profile" data-prefix="">` → 5 项 TabBar；一级页固定高 56 + 安全区；二级页不带 TabBar。
- 图标：`<span data-icon="home" data-icon-size="24">` 由 shared.js 注入内联 SVG（24 栅格、1.75 描边、currentColor）。

### 0.4 按钮
- 主按钮 48 高、brand 底 inverse 字；次按钮 surface 底 ink 字；文字按钮 brand 字；危险按钮 bad-soft 底 bad 字。
- 禁用：`disabled` 或 `.is-disabled` → surface 底 + mut 字 + 无阴影 + `cursor:not-allowed`，不只靠透明度。
- 提交中：`UISpec.setBusy(btn, true, '正在登录…')` 或 `data-busy-demo`；显示 16px 转圈，保持原宽度，`aria-busy="true"` 并阻止重复点击。
- 命中区不小于 44×44；键盘焦点使用 `--v2-focus` 双环。

### 0.5 表单
- 输入框 48 高、12 圆角、1px line 边框；聚焦 brand 边框 + 3px soft 焦点环。
- 逐字段报错：`.field.is-invalid` + `.field__error` 文案；首个错误自动聚焦（`UISpec.validateForm` / `focusFirstInvalid`）。
- 输入内容后该字段错误自动清除；错误文案 13px bad 色，不使用全局横幅替代字段级反馈。
- 密码眼睛按钮 44×44 命中区，切换 `type` 并同步 `aria-label` 与图标。
- 占位符使用 mut 色（≥3:1）；标签为 14px/500。

### 0.6 反馈组件
- 底部弹层：`data-open-overlay="id"` 打开；遮罩、取消按钮、Esc 均可关闭；带 36×4 拖拽条；顶角 20px。
- 对话框：标题 + 说明 + 最多两个按钮；危险操作用 bad 色；确认后关闭并 Toast。
- Toast：顶部居中、2s 自动消失；成功 / 错误 / 普通三种图标与底色；通过 `UISpec.toast(message, 'ok'|'bad'|'info')` 或 `data-toast` 触发。
- 骨架屏仅用于首屏加载；局部加载用 16–20px 转圈。

### 0.7 状态块
- 空：一句说明 + 一个可执行动作；错误：中文原因 + 「重试」；无权限：明确原因 + 下一步（查看权益 / 继续学习）。
- 不显示错误码、版本号、堆栈或英文原始信息；网络与服务不可用分别说清楚。
- 所有状态块在深色下重新复验：文字 ≥4.5:1，图标有底色不透明。

### 0.8 可访问性与深色
- 交互元素均可用键盘聚焦；焦点环 `0 0 0 3px card, 0 0 0 6px brand`。
- 颜色不是唯一状态信号：开关、进度、错误均配文字或图标。
- `prefers-reduced-motion` 时关闭骨架屏动画与过渡；深色下阴影减弱、无白底块。

## 1. gallery（组件总览）
- 主题切换 → 顶部工具条「浅色 / 深色」 → `html[data-theme]` 切换并写入 localStorage，色卡数值同步刷新。
- 主按钮 → 点击 → 转圈 +「正在登录…」、保持宽度并禁用重复点击，1.5s 后恢复并弹出成功 Toast。
- 次按钮 / 文字按钮 → 点击 → Toast 反馈。
- 表单「提交」 → 逐字段标红（昵称 / 邮箱 / 密码）并聚焦首个错误；输入后该字段错误消失；补全后提交进入「正在保存…」并在 1.2s 后成功 Toast。
- 密码眼睛 → 点击 → 切换明文 / 密文，图标与 aria-label 同步。
- Chip / 分段控件 → 点击 → 同组单选互斥或多选切换；禁用 chip 不可点。
- 开关 → 点击 / 空格 / 回车 → `aria-checked` 切换；禁用开关不可操作。
- 底部弹层 → 点击「打开底部弹层」 → 遮罩淡入 + 面板上滑；点遮罩 / 取消 / Esc 关闭；选项关闭并 Toast。
- 对话框 → 点击「打开对话框」或「危险操作」 → 居中弹入；危险按钮 bad 色，取消 / 确认均关闭，确认后 Toast。
- Toast → 点击成功 / 错误 / 普通按钮 → 顶部显示 2s。
- 错误状态「重试」 → 点击 → 按钮进入「正在重试…」，1.1s 后恢复并成功 Toast。
- TabBar → 点击任一项 → 跳转对应原型页（home / b2-practice / world / learn / profile）。

## 2. 页面追加区

（后续任务按 PAGES.md 编号在此追加逐页交互说明。）

### login（登录）

对应页面：`pages/login.html`；真实实现参照 `apps/mobile/src/pages/login/login.vue` 与 `packages/i18n/src/mobile-experience.ts` 的 `auth.login.*` 文案。

- 主题切换 → 工具条「浅色 / 深色」 → 整页 token 切换并写入 `localStorage['uispec-theme']`。
- 页面状态 → 工具条「正常 / 加载 / 错误 / 离线」 → 显示对应状态块：正常为登录表单，加载为恢复会话骨架屏（`aria-busy`），错误为登录服务不可用，离线为网络不可用。切换离开正常态会取消未完成的模拟登录，不再出现延迟跳转或 Toast。
- 加载态 → 品牌行、入口标题与字段位显示骨架屏 → 不出现「等待登录」类静态框；骨架使用 surface/line token，深色下无白底。
- 错误态「重试」 → 按钮转圈并显示「正在重试…」→ 1.1s 后回到正常态并 Toast「登录服务已恢复」；「帮助中心」跳转 `support.html`。
- 离线态「重新连接」 → 按钮转圈「正在重新连接…」→ 1.1s 后回到正常态并 Toast「网络连接已恢复」。
- 账号 / 密码输入 → 聚焦时 brand 边框 + soft 焦点环 → 输入即清除本字段错误与表单级错误。
- 提交校验 → 点击「登录」或按回车 → 账号为空在字段下方标红「请输入账号」、密码为空标红「请输入密码」，并聚焦首个错误；修正后对应错误自动消失。
- 密码可见 → 点击眼睛（44×44 命中区） → 切换明文 / 密文，图标与 `aria-label`（显示密码 / 隐藏密码）同步；提交中不可切换。
- 忘记密码？ → 点击 → 跳转 `reset-password.html`；提交中链接变为不可用（mut 色、`aria-disabled`）。
- 注册 → 点击底部「注册」 → 跳转 `register.html`；提交中不可点。
- 提交中 → 校验通过后 → 主按钮保持宽度并显示 16px 转圈与「正在登录…」，账号 / 密码 / 眼睛 / 忘记密码 / 注册全部不可操作，防止重复提交。
- 登录失败（Mock）→ 账号 `error@yuxuexing.com` → 1.4s 后表单内 bad 色提示「账号或密码不正确，请重试。」；`locked@yuxuexing.com` → 「账号暂时锁定，请稍后重试。」；`rate@yuxuexing.com` → 「请求过于频繁，请稍后再试。」。失败保留已填内容、恢复表单并把焦点移回密码框，不跳转。
- 登录成功（Mock）→ 其他任意账号 + 任意密码 → 1.4s 后清空密码、顶部 Toast「登录成功，正在进入学习首页」，1.2s 后跳转 `home.html`。

### register（注册）

对应页面：`pages/register.html`；真实实现参照 `apps/mobile/src/pages/register/register.vue` 与 `packages/i18n/src/mobile-experience.ts` 的 `auth.register.*` 文案。

- 主题切换 → 工具条「浅色 / 深色」 → 整页 token 切换并写入 `localStorage['uispec-theme']`。
- 页面状态 → 工具条「正常 / 加载 / 错误 / 离线」 → 显示对应状态块：正常为注册表单，加载为入口骨架屏（`aria-busy`），错误为注册服务不可用，离线为网络不可用。切换离开正常态会取消未完成的模拟注册，不再出现延迟跳转或 Toast。
- 加载态 → 品牌行与三段字段位显示骨架屏 → 不出现「等待注册」类静态框；骨架使用 surface/line token，深色下无白底。
- 错误态「重试」 → 按钮转圈并显示「正在重试…」→ 1.1s 后回到正常态并 Toast「注册服务已恢复」；「去登录」跳转 `login.html`。错误标题「注册暂未开放」，正文「注册暂未开放，请查看服务公告。已有账号仍可正常登录。」（对应 `auth.register.temporarilyUnavailable`）。
- 离线态「重新连接」 → 按钮转圈「正在重新连接…」→ 1.1s 后回到正常态并 Toast「网络连接已恢复」。
- 账号 / 密码 / 确认密码输入 → 聚焦时 brand 边框 + soft 焦点环 → 首次提交后，输入时仅在本字段已合法时清除该字段错误，错误行保留高度（`visibility:hidden`）不引起布局跳动；表单级错误在输入时清除。
- 失焦校验 → 首次提交后，字段失焦时按当前值重新校验并显示当前错误；密码失焦时若确认密码已填，同步复核「两次输入的密码不一致。」。
- 提交校验 → 点击「创建账号」或按回车 → 逐字段标红并聚焦首个错误：账号为空「请输入账号。」、长度不在 3–128 位（含少于 3 位与超过 128 位）「账号长度需为 3 至 128 位。」；密码为空「请输入密码。」、少于 12 位「密码至少 12 位。」、超过 128 位「密码最多 128 位。」；确认密码为空「请再输入一次密码。」、与密码不一致「两次输入的密码不一致。」。修正后对应错误文字隐藏，但保留错误行高度。
- 密码可见 → 点击密码 / 确认密码各自的眼睛（44×44 命中区） → 分别切换明文 / 密文，图标与 `aria-label`（显示密码 / 隐藏密码、显示确认密码 / 隐藏确认密码）同步；提交中不可切换。
- 登录 → 点击底部「登录」 → 跳转 `login.html`；提交中链接变为不可用（mut 色、`aria-disabled`）。真实页会把当前 `returnTo` 带在登录链接上；原型链接保持 `login.html`。
- 提交中 → 校验通过后 → 主按钮保持宽度并显示 16px 转圈与「正在创建账号…」，三个字段 / 两个眼睛 / 登录链接全部不可操作，防止重复提交。
- 注册失败（Mock）→ 账号 `exists@yuxuexing.com` → 1.4s 后表单内 bad 色提示「注册没有完成。请尝试登录或找回密码。」；`rate@yuxuexing.com` → 「操作过于频繁，请稍后再试。」；`closed@yuxuexing.com` → 「注册暂未开放，请查看服务公告。」（`auth.register.temporarilyUnavailable`，`iam.consent.version_unavailable`）；`fail@yuxuexing.com` → 「注册没有完成，请稍后再试。」（`auth.register.failed`，`UNKNOWN_AUTH_ERROR`）。失败保留已填内容、恢复表单并把焦点移回密码框，不跳转。
- 注册成功（Mock）→ 其他任意账号 + 至少 12 位且两次一致的密码 → 1.4s 后清空密码与确认密码、顶部 Toast「账号已创建，正在完成设置」，1.2s 后跳转 `onboarding.html`。真实页注册成功后走 `continueAfterLogin(returnTo)`：新账号进入开始引导，原型以 `onboarding.html` 表示。

### reset-password（找回密码）

对应页面：`pages/reset-password.html`；真实实现参照 `apps/mobile/src/pages/reset-password/reset-password.vue` 与 `packages/i18n/src/mobile-experience.ts` 的 `auth.resetPassword.*` / `resetSent` / `resetComplete` 文案。真实页为两步：申请重置指引与凭口令设置新密码。

- 主题切换 → 工具条「浅色 / 深色」 → 整页 token 切换并写入 `localStorage['uispec-theme']`。
- 页面状态 → 工具条「正常 / 加载 / 错误 / 离线」 → 显示对应状态块：正常为找回密码表单，加载为入口骨架屏（`aria-busy`），错误为找回服务不可用，离线为网络不可用。切换离开正常态会取消未完成的模拟请求，不再出现延迟反馈。
- 加载态 → 品牌行与表单位显示骨架屏 → 不出现「等待处理」类静态框；骨架使用 surface/line token，深色下无白底。
- 错误态「重试」 → 按钮转圈并显示「正在重试…」→ 1.1s 后回到正常态并 Toast「找回服务已恢复」；「去登录」跳转 `login.html?returnTo=<returnTo>`（规则同「返回登录」）。
- 离线态「重新连接」 → 按钮转圈「正在重新连接…」→ 1.1s 后回到正常态并 Toast「网络连接已恢复」。
- 第一步 · 申请指引 → 标题「找回密码」，说明「输入账号，获取重置指引。」，账号占位「邮箱或账号」，主按钮「发送重置指引」，次按钮「我已收到口令」。
- 「我已收到口令」 → 点击 → 同一表单切换为「设置新密码」：标题、说明「使用邮件中的口令设置新密码。」、账号占位「注册时使用的账号」同步更新，显示「重置口令」与「新密码」两个字段，主按钮变「设置新密码」，次按钮变「重新申请指引」；账号已填时自动聚焦重置口令，否则聚焦账号。切换会清空口令 / 新密码与全部校验反馈。
- 「重新申请指引」 → 点击 → 回到第一步，清空重置口令与新密码，保留账号，并聚焦账号。
- 字段输入 → 聚焦时 brand 边框 + soft 焦点环；提交后输入时仅在本字段已合法时隐藏该字段错误，错误行保留高度（`visibility:hidden`）不引起布局跳动。
- 失焦校验 → 首次提交后，当前步骤内的字段失焦时按当前值重新校验并显示当前错误。
- 提交校验 · 第一步 → 点击「发送重置指引」或按回车 → 账号为空标红「请输入账号。」、长度不在 3–128 位「账号长度需为 3 至 128 位。」，并聚焦首个错误。
- 提交校验 · 第二步 → 点击「设置新密码」 → 账号规则同上；重置口令为空「请输入重置口令。」、长度不在 32–512 位「重置口令需为 32 至 512 位。」；新密码为空「请输入新密码。」、少于 12 位「新密码至少 12 位。」、超过 128 位「新密码最多 128 位。」；聚焦首个错误。口令字段回车进入新密码字段，新密码字段回车提交。
- 密码可见 → 点击眼睛（44×44 命中区） → 切换新密码明文 / 密文，图标与 `aria-label`（显示新密码 / 隐藏新密码）同步；提交中不可切换。
- 提交中 → 校验通过后 → 主按钮保持宽度并显示 16px 转圈：第一步「正在发送…」、第二步「正在重置…」；字段 / 眼睛 / 步骤切换 / 返回登录全部不可操作，防止重复提交。
- 申请成功（Mock）→ 任意账号 → 1.4s 后在按钮上方显示「申请已受理。若收到重置邮件，请按邮件指引操作。」，不泄露账号是否存在；修改账号时该提示隐藏但保留行高。
- 申请失败（Mock）→ 账号 `rate@yuxuexing.com` → 表单内 bad 色「操作过于频繁，请稍后再试。」；`fail@yuxuexing.com` → 「发送没有完成，请稍后再试。」（`auth.resetPassword.failedRequest`）。失败保留已填内容、恢复表单。
- 重置成功（Mock）→ 第二步且账号、口令、新密码均合法 → 1.4s 后表单替换为行内确认「密码已重置。请返回登录，使用新密码继续学习。」（`resetComplete`），标题保持「设置新密码」，清空输入并隐藏步骤切换；「返回登录」跳转 `login.html?returnTo=<returnTo>`（规则见下）。
- 重置失败（Mock）→ 账号 `rate@yuxuexing.com` → 「操作过于频繁，请稍后再试。」（`auth.resetPassword.rateLimited`）；重置口令以 `expired` 开头且长度 ≥32 → 「重置口令无效或已过期，请重新申请。」（`iam.password_reset.invalid`）；账号 `fail@yuxuexing.com` → 「重置没有完成，请稍后再试。」（`auth.resetPassword.failedConfirm`）。失败保留已填内容、恢复表单。
- 邮件链接直达 → 以 `reset-password.html?token=<口令>` 打开 → 直接进入「设置新密码」并预填重置口令（对应真实页 `onLoad` 的 token 参数），账号仍按「注册时使用的账号」提示填写。
- 返回登录 → 点击底部「返回登录」 → 跳转 `login.html?returnTo=<returnTo>`；`returnTo` 读取 URL 的 `?returnTo=`（对应真实页 `onLoad` 的 `returnTo` / `redirect`），仅保留以 `/` 开头、非 `//`、无 `\` 与控制字符的安全相对路径，缺省或非法时不带参数；提交中链接变为不可用（mut 色、`aria-disabled`）。

### onboarding（新手引导）

对应页面：`pages/onboarding.html`；真实实现参照 `apps/mobile/src/pages/onboarding/onboarding.vue`、`apps/mobile/src/domain/onboarding-resume.ts`、`apps/mobile/src/domain/adult-birth-year.ts` 与 `packages/i18n/src/mobile-experience.ts` 的 `onboarding.*` 文案。原型按「确认身份 → 必要同意 → 学习目标 → 设置已完成」线性演示；真实页会按 IAM 成人校验、同意记录和目标保存情况自动选择起始步骤（已完整同意时可跳过「必要同意」）。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题，`?step=consent|goal|done` 直达步骤，`?records=open` 默认展开来源记录，`?scroll=records` 仅供截图定位到同意记录，`?mock=` 取值见「错误与受限状态」「同意记录」「目标步骤主按钮」。
- 页面状态 → 工具条「正常 / 加载 / 错误 / 离线」 → 正常为引导流程；加载为读取已保存设置的骨架屏（`aria-busy`）；错误为当前步骤标题 + 行内「已保存设置暂时无法读取，请重新读取。」+「重新读取」；离线为网络不可用。切换离开正常态会取消未完成的模拟请求、结束提交中状态并关闭对话框。
- 校验时机 → 首次点击「确认并继续」或按回车提交前，不显示任何年份 / 勾选错误；首次提交后，出生年份失焦与输入、勾选变化都会重新校验；修正后错误文字隐藏但错误行高度保留，布局不跳动。真实页「确认并继续」为原生禁用，首次提交由出生年份输入框回车触发；原型保留禁用外观且可点击，用于演示校验。
- 错误与受限状态 → 全部为步骤内行内 bad 色提示，不使用 Toast：
  - 必要同意不完整（`?mock=consent-blocked`）→ role=status「同意内容暂时无法读取，请稍后重新读取。」；不显示「按已有同意继续」，只保留「重新读取」。
  - 同意记录读取失败（`?mock=records-failed`）→ role=alert「同意记录暂时无法读取，请重新读取。」；记录列表为空，不显示「展开来源记录」。
  - 已保存目标不可读（`?mock=target-unreadable`）→ 目标步骤顶部 role=alert「已保存目标暂时无法读取，请重新读取后再保存。」，主按钮禁用。
  - 保存失败（`?mock=save-failed`）→「学习目标尚未保存，请重新读取或再试一次。」；保存后确认失败（`?mock=saved-read-failed`）→「暂时无法确认已保存目标，请重新读取后再开始定级。」
  - 身份确认失败（`?mock=confirm-failed`）→「身份确认未完成，请重试。」
  - 跳转失败（`?mock=nav-failed`）→「页面未能打开，请重试。」；退出失败（`?mock=exit-failed`）→「退出登录未完成，请重试。」
- 目标步骤主按钮 → 未选目标或目标不可读时直接使用真实原生禁用（surface 底、mut 字、无阴影、not-allowed），不可点击；「请选择学习目标和每日时长。」仅作兜底，正常交互不可达。
- 忙碌文案 → 对齐 `primaryLabel`：步骤一 / 步骤二 / 步骤四提交中显示「正在确认…」，步骤三显示「正在保存…」；重新读取时主按钮不改文案，在描述下方显示 role=status「正在读取已保存设置…」。
- 未满 18 与 Toast → 出生年份晚于「当前年份 − 18」时「正在确认…」1.1s 后直接跳转 `forbidden.html`，不弹 Toast；不显示真实页没有的 Toast（同意记录已更新 / 学习目标已保存 / 已读取已保存的学习目标 / 还没有已保存的学习目标 / 已退出登录 / 已读取已保存的设置）。
- 同意记录 → 每条记录显示标题、必要事项 / 可选事项、已记录 / 已撤回、「已记录版本：…」；点击「展开来源记录」后每条记录下各自展开来源（IAM 服务端同意记录）、记录中的文档时间、记录时间、文档摘要（缩写如 3f9a…c21）、政策引用、决定引用；时间使用可读格式，不出现原始错误码。按钮文案变「收起来源记录」并同步 `aria-expanded`。
- 退出登录 → 真实页直接退出（转圈后跳转 `login.html`，失败显示「退出登录未完成，请重试。」）；原型保留确认对话框「退出登录？」，对话框为设计新增，真实页暂无，需同步实现。
- 错误页面态 → 不显示自造标题；工具条切到「错误」时标题使用当前步骤标题，步骤内行内「已保存设置暂时无法读取，请重新读取。」+「重新读取」。
- 步骤指示 → 确认身份 / 必要同意 / 学习目标 → 已完成显示对勾，当前步骤为 brand 实心数字并带 `aria-current="step"`，待完成为描边数字，同时保留屏幕阅读器状态文字；原型线性演示，真实页必要同意已完整时会跳过该步。
- 步骤一 · 出生年份与成人确认 → 输入仅保留 4 位数字；年份为空或不在 1900–2026 时提交显示「请输入 1900 至 2026 的整数年份。」，未勾选时显示「请确认自己已满 18 周岁。」并聚焦首个错误；通过后「正在确认…」1s 后进入「查看同意事项」。未满 18 分支见「未满 18 与 Toast」。
- 步骤二 · 同意 / 步骤三 · 目标 / 步骤四 · 定级 → 步骤二「按已有同意继续」→「正在确认…」0.9s 后进入学习目标；步骤三四张目标卡 + 5 / 15 / 30 / 45 分钟单选，默认 15 分钟，保存成功进入「设置已完成」，摘要使用已保存目标与时长；步骤四「开始定级」→「正在确认…」0.7s 后跳转 `assessment.html`，「调整目标」回到步骤三并保留当前选择。
- 账号设置 / 提交中 → 「账号设置」跳转 `settings.html`（`?mock=nav-failed` 时显示行内「页面未能打开，请重试。」）；提交中主按钮保持宽度并显示 16px 转圈，输入、勾选、目标卡、时长卡、重新读取、账号设置与退出登录全部不可操作，`aria-busy` 标记在页面容器上。

### assessment（水平测评）

对应页面：`pages/assessment.html`；真实实现参照 `apps/mobile/src/pages/assessment/assessment.vue`、`apps/mobile/src/stores/learner-content.ts` 的 placement 投影与 `packages/i18n/src/mobile-experience.ts` 的 `pages.assessment` / `onboarding.*` 文案。真实页按服务端投影在「开始定级 / 题目 / 报告 / 已跳过 / 断点继续」间切换；原型用 mock 题目在同一路由内演示。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?view=guide|preparing|held|question|report|skipped` 直达对应视图，缺省为「开始定级」。mock 参数：`?mock=progress`（题目示例：已接收 3 题、显示上一题反馈并预选一项）、`?mock=submit-offline|no-receipt|submit-unsaved`（题内未确认）、`?view=report&mock=no-score`（无分数报告）、`?mock=retest-failed`（重测失败）、`?view=skipped&mock=no-level`（没有自选起点）。
- 页面状态 → 工具条「正常 / 加载 / 空 / 错误 / 无权限 / 离线」→ 正常为测评流程；加载为读取测评进度的骨架屏（`aria-busy`），对应真实页「正在准备测评 / 请稍候。」；空为「目前没有可用题目，可以稍后重试。」；错误为「测评暂时不可用，请稍后重试。」；无权限为「当前账号没有测评权限。」；离线为网络不可用。切换离开正常态会取消未完成的准备 / 提交 / 重测，结束提交中状态并解锁选项。
- 开始定级 → 页面标题「从了解自己开始。」、副标题「完成一组小测评，找到适合你的学习起点。」；卡片为「开始定级」与「共 10 道题。用来了解你现在的英语起点，方便安排后面的学习。」；点击「开始」→「正在准备测评 / 请稍候。」1s 后进入第 1 题；「返回学习首页」跳转 `home.html`。
- 选择选项 → 点击任一项 → 该项边框与底色变为选中态、左侧字母变为 brand 实心并显示对勾，「提交答案」由禁用变为可用；再次点击同项保持选中，不可清空。四个选项为单选，点击其他项会切换选中。
- 提交答案 → 点击「提交答案」，或聚焦选项按回车（未选中时先选中、已选中时提交）→ 按钮保持宽度并显示 16px 转圈与「正在记录…」，四个选项不可操作 → 0.9s 后显示本次反馈「刚才提交的这题答对了。」（ok 色）或「刚才提交的这题没有答对。」，进度前进并显示下一题；第 10 题提交后进入报告，报告内同样显示最后一题反馈（`role=status`）。服务端已接收题数在进度条下方以「服务端已接收 n 题。」显示。
- 题内未确认 → `?mock=submit-offline` / `?mock=no-receipt` / `?mock=submit-unsaved`：提交后停留在当前题，题干与选项仍在（可点选，但主按钮为「重新读取」），选项下方显示 `role=alert` 行内提示（依次为「答案状态尚未确认。请先重新读取，不会因此新开一套题。」「这题还没提交成功。进度仍以服务端已接收的检查点为准。」「本题尚未提交成功。未提交的选择不会当成已保存。」），主按钮由「提交答案」换成「重新读取」；`no-receipt` 不显示答对 / 答错反馈。点「重新读取」转圈「正在重新读取…」1.1s 后回到同一题，不前进，服务端已接收题数不变。
- 报告 → 显示「报告已生成」、等级与分数（如 B1 · 70 分）、「答对 7 题，共 10 题。」「这份报告和快照是同一版本。」与「重测会另开一套题，这份报告会保留。是否调整已有计划需要另外确认。」；「查看今日状态」跳转 `today.html`，「重测」按钮转圈「正在准备…」1.2s 后从第 1 题重新开始。
- 报告 · 无分数 → `?view=report&mock=no-score`：不显示「B1 · 70 分」与答对题数，只显示「报告已生成」、快照说明和重测说明。
- 重测失败 → `?mock=retest-failed`：点「重测」转圈「正在准备…」后留在报告，行内 bad 色提示「重测没有开出新题。原来的报告还在。」（设计补充：真实页报告保留，但未显示原因）。
- 已跳过测评 → `?view=skipped`：显示「已跳过测评 / 水平尚未验证」「这次跳过不是正式测评分数。」「你选择了 B1 作为起点；这不是测评等级。」；`?view=skipped&mock=no-level` 改为「自选起点，水平尚未验证。」；只保留「查看今日状态」跳转 `today.html`（真实页此处没有「返回学习首页」）。
- 断点继续 → `?view=held`：显示「定级进度 / 继续上次测评」与「定级进度在服务端。重新读取会从已接收检查点的下一题继续，不会新开一套题。」；mock 已接收 3 题，点「重新读取」转圈 1.1s 后进入第 4 题并显示「服务端已接收 3 题。」。
- 页面级状态恢复 → 空 / 错误 / 无权限 / 离线的「重新读取」转圈 1.1s 后直接回到正常视图，不再出现成功 Toast；错误、无权限与离线均只有「重新读取」与「返回学习首页」两个按钮，不提供购买或权益入口。
- 返回 → 导航栏返回跳转 `home.html`；各视图的「返回学习首页」同样跳转 `home.html`。
- 文案边界 → 不显示内部错误码、原始版本号或「等待测评」类静态占位；跳过结果不展示分数，报告分数只在报告存在时出现。

### forbidden（访问权限）

对应页面：`pages/forbidden.html`；真实实现参照 `apps/mobile/src/pages/forbidden/forbidden.vue` 与 `packages/i18n/src/mobile-experience.ts` 的 `forbidden.*` 文案。真实页按 IAM 成人 Gate、学习同意状态与身份读取结果选择受限原因，并在「已登录可管理账号 / 未登录返回登录」两套出口间切换；原型用 `?reason` 与 `?auth` 参数演示。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?reason=adult|paused|generic|unknown` 切换受限原因，`?auth=guest` 演示未登录身份，`?state=loading|error|offline` 直达页面状态，`?view=logout-unconfirmed` 直达退出未确认视图，`?mock=nav-failed|nav-unconfirmed|logout-failed|logout-unconfirmed` 演示动作失败。
- 页面标题 → 文档标题跟随当前标题（对应真实页 `setNavigationBarTitle`）：显示为 `<标题> · 语学星移动端 UI 稿`，受限原因或读取失败状态切换时同步更新。
- 页面状态 → 工具条「正常 / 加载 / 错误 / 离线」→ 正常为访问受限说明与可用出口；加载为正在确认账号状态的骨架屏（`aria-busy`），并显示可见的 `role="status"`「正在确认账号状态…」；错误与离线共用真实页的读取失败视图。切换离开正常态会取消未完成的模拟请求与跳转。
- 受限原因 → 默认 `generic`「暂时无法访问这项内容 / 当前账号无法打开这项内容。你仍可管理账号或查看帮助。」；`adult`「暂时无法开始学习 / 当前版本仅向年满18周岁的用户开放学习。你仍可管理账号或查看帮助。」；`paused`「学习访问已暂停 / 当前无法继续打开学习内容。你仍可管理账号或查看帮助。」；`unknown`「暂时无法确认访问状态 / 暂时无法确认账号的访问状态。」。标题与说明同步替换，其他内容不变（对应 `forbidden.<reason>Title/Description`）。
- 身份出口 → 已登录（默认）显示主按钮「管理账号」、次按钮「帮助与反馈」与底部「退出登录」；`?auth=guest` 只显示主按钮「返回登录」。文案对齐真实页 `forbidden.account / help / logout / login`。
- 品牌行 → 只显示品牌图标与「语学星」；真实页没有成人学习说明，页面不再显示「18 岁以上成人学习」。
- 管理账号 / 帮助与反馈 / 返回登录 → 点击 → 按钮保持宽度并显示 16px 转圈「正在打开…」，动作区下方同时显示 `role="status"`「正在打开…」，其他按钮不可操作 → 0.9s 后分别跳转 `settings.html` / `support.html` / `login.html?returnTo=%2Fpages%2Fsettings%2Fsettings`。所有「返回登录」出口（未登录主按钮、退出成功、退出未确认视图、读取失败视图）统一使用该地址，对应真实页 `loginPath`。
- 跳转失败（Mock）→ `?mock=nav-failed` → 转圈结束后停留在本页，动作区下方显示 bad 色 `role="alert"`「页面未能打开，请重试。」；`?mock=nav-unconfirmed` → 「暂未确认页面已打开。你可以重试或使用其他入口。」。可再次点击按钮重试，错误在下一次操作开始时清除。
- 退出登录 → 点击 → 按钮转圈「正在退出…」，动作区下方同时显示 `role="status"`「正在退出…」，其他按钮不可操作 → 1s 后直接跳转 `login.html?returnTo=%2Fpages%2Fsettings%2Fsettings`（真实页 reLaunch 到登录，无 Toast、无额外延时）。
- 退出失败（Mock）→ `?mock=logout-failed` → 停留在已登录视图并显示「退出尚未完成，请重试。」；`?mock=logout-unconfirmed` → 切换到未登录视图（只保留「返回登录」）并显示「此设备已退出登录，但退出请求暂未确认。你可以返回登录。」，对应真实页会话已清除但退出请求未确认的分支；`?view=logout-unconfirmed` 可直接打开该视图用于截图。
- 读取失败（错误 / 离线）→ 标题与说明改为「暂时无法确认访问状态 / 暂时无法确认账号的访问状态。」，动作区下方显示 bad 色 `role="alert"`「账号状态暂时无法读取，请重新读取。」，并出现文字按钮「重新读取状态」；身份出口保持不变（已登录：管理账号 / 帮助与反馈 / 退出登录；`?auth=guest`：返回登录）。对应真实页 `readFailed` 分支，不另造错误状态块。离线额外显示 mut 提示「当前网络不可用，请连接网络后重新读取。」。
- 「重新读取状态」→ 按钮转圈「正在确认账号状态…」，动作区下方显示同名 `role="status"`，所有按钮不可操作 → 1.1s 后回到正常视图并恢复当前受限原因标题与说明，不弹成功 Toast。
- 加载态 → 品牌行与正文显示骨架屏，并显示可见的 `role="status"`「正在确认账号状态…」；不出现「等待确认」类静态框；骨架使用 surface/line token，深色下无白底。
- 文案边界 → 不显示内部错误码、原始版本号或账号是否存在；受限原因只描述当前状态与下一步。

### home（学习首页）

对应页面：`pages/home.html`；真实实现参照 `apps/mobile/src/pages/home/home.vue`、`apps/mobile/src/domain/plan-today.ts`、`apps/mobile/src/domain/onboarding-resume.ts` 与 `packages/i18n/src/mobile-experience.ts` 的 `pages.home` 文案。真实页由 `store.loadHome()` 读取学习投影（今日任务、目标分钟、已用分钟、课程书架），并按 `onboardingResume` 决定是否展示学习引导。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?mock=guide|guide-goal|first-learning|explain|all-done|no-tasks|plan-completed|plan-no-content|plan-no-due|plan-failed|course-empty|course-error|course-unavailable` 演示学习引导、首次学习、计划说明、今日完成、计划空态与课程书架状态，`?auth=guest` 演示未登录。
- 页面状态 → 工具条「正常 / 加载 / 空 / 错误 / 无权限 / 离线」→ 正常为今日学习；加载为读取今日任务的骨架屏（`aria-busy`）；空为整页 NO_PLAN「还没有学习计划」+「开始设置」；错误 / 无权限 / 离线共用真实页同一分支「今日任务暂不可用」+ 说明 + 单个「重试」。切换离开正常态会取消未完成的重试 / 课程重新加载。
- 状态恢复 → 错误 / 无权限 / 离线「重试」转圈「正在重试…」→ 1.1s 后回到正常态，不弹成功 Toast；离线在卡片下方保留 mut 说明「当前网络不可用，连接网络后再试。」。
- 今日学习 → 展示目标 15 分钟、今日进度百分比与进度条（`role=progressbar`）、已完成分钟与任务数；有可继续任务时主按钮「继续课程」跳转 `learn.html?contentCode=…&taskId=…`，全部完成或暂无任务时按钮为真实禁用（surface 底、mut 字、not-allowed）。
- 今日任务 → 每行标题、说明与时长；进行中 / 可学习显示「继续课程 / 查看课程」跳转课程页；已完成、未解锁、暂不可用为禁用按钮，禁用原因写在行内（如「完成上一节后解锁。」）；UNAVAILABLE 行以 warn 色显示「内容暂不可用」。
- 计划空态（卡片内） → 对应 `emptyStateView`，保留问候、今日学习与课程书架：`?mock=plan-completed`「今天的学习已经完成 / 已保存的练习还在。」+「结束学习」；`?mock=plan-no-content`「暂时没有可学习的内容 / 可以先看现在能打开的内容。」+「看可用内容」跳转 `learn.html`；`?mock=plan-no-due`「今天没有到期的复习 / 可以新学一节，或先结束今天。」+「新学或结束」跳转 `learn.html`；`?mock=plan-failed`「今日任务没有加载成功 / 已提交的进度会保留。」+「重试」，重试转圈「正在重试…」后恢复任务列表。工具条「空」仍是整页 NO_PLAN 简化变体。
- 首次学习引导 → `?mock=first-learning` 在问候下方显示 `role=status` 行「继续完成第一次学习」（对应 `firstLearningGuideCopy` 的 INCOMPLETE），与计划说明行相互独立。
- 学习引导 / 计划说明 → `?mock=guide`（定级步骤）显示 soft 底「目标已保存，下一步进入定级 / 剩余步骤：定级」+「继续设置，开始学习」跳转 `assessment.html`；`?mock=guide-goal`（更早的学习目标步骤）显示「还需要保存学习目标 / 剩余步骤：学习目标」，同一 CTA 跳转 `onboarding.html`；`?mock=explain` 显示 `role=status` 计划说明行。
- 错题本 → 点击「进错题本」→ 跳转 `b10-report.html`。
- 课程搜索 → 输入即筛选课程标题与简介（真实页不显示结果计数）；无结果时显示「没有匹配的课程。」与「清空搜索」；输入框右侧出现清空按钮（44×44 命中区），点击清空并聚焦输入框。
- 课程书架 → 每门课程显示标题与简介，点击跳转 `learn.html?contentCode=…`；`?mock=course-empty` 显示「书架里还没有可学习的内容。」，`?mock=course-error` 显示「课程暂时没能加载。」并提供「重新加载」，1s 后恢复列表且不弹 Toast；`?mock=course-unavailable` 在列表下方显示 `role=alert`「课程列表暂不可用。」。
- 今日完成 → `?mock=all-done`：进度 100%，今天任务全部为「已完成」，「继续课程」禁用；`?mock=no-tasks`：进度 0，任务卡显示「今天还没有安排任务。」。
- 未登录 → `?auth=guest`：标题改为「登录后，继续今天的学习」，隐藏今日学习、任务、错题本与课程书架，只保留登录卡「登录后继续」跳转 `login.html` 与「修改目标 / 进入测评」入口。
- TabBar → 底部 5 项，当前「学习」选中并带 `aria-current="page"`；其余跳转 `b2-practice.html` / `world.html` / `learn.html` / `profile.html`。右上角设置入口跳转 `settings.html`。
- 文案边界 → 不显示内部错误码、原始版本号或「等待加载」类静态占位；加载使用骨架屏，进度与任务状态同时用文字表达，不只依赖颜色。

### today（今日任务）

对应页面：`pages/today.html`；真实实现参照 `apps/mobile/src/pages/today/today.vue`、`apps/mobile/src/domain/plan-today.ts`、`apps/mobile/src/stores/learner-content.ts` 与 `packages/i18n/src/mobile-experience.ts` 的 `pages.today` 文案。真实页由 `store.loadHome()` 读取学习投影与计划队列，并按 `emptyStateView`、`firstLearningGuideCopy` 渲染计划空态与首次学习提示；原型用 mock 数据在同一路由内演示。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|loading|empty|error|forbidden|offline` 直达页面状态；`?mock=explain|first-learning|first-learning-no-plan|first-learning-no-content|notice|notice-plan-missing|notice-goal|deferred|unavailable|all-done|no-tasks|plan-no-plan|plan-completed|plan-no-content|plan-no-due|plan-failed` 演示计划说明、首次学习、计划提示、顺延、课程目录不可用、今日完成、无任务与计划空态。
- 页面状态 → 工具条「正常 / 加载 / 空 / 错误 / 无权限 / 离线」：正常为进度与任务；加载为可见的 `role=status`「正在读取今日任务…」+ 骨架屏（`aria-busy`）；空复用同一张今日卡与「今日 / 今日任务」标题，进度 0%、「目标 15 分钟，已完成 0 分钟。」，卡片内为 NO_PLAN「还没有学习计划 / 先完成设置，再开始今天的练习。」+「开始设置」；错误 / 无权限 / 离线共用真实页同一分支「今日任务暂时无法读取」+ 原因 + 单个「重试」，错误与离线均为「请检查网络后重试。」，无权限为「当前账号没有查看权限。」。切换离开正常态会取消未完成的重试与重新加载，切换离开「空」会恢复原任务与进度。
- 状态恢复 → 错误 / 无权限 / 离线「重试」统一转圈「正在重试…」→ 1.1s 后回到正常态，不弹成功 Toast。
- 今日进度 → 「目标 15 分钟，已完成 10 分钟。」与进度条（`role=progressbar`），默认 67%；`?mock=all-done` 与 `?mock=plan-completed` 为 100% 且「目标 15 分钟，已完成 15 分钟。」；`?mock=no-tasks`、计划空态与工具条「空」保持 0% 与「目标 15 分钟，已完成 0 分钟。」，说明始终显示。
- 任务行 → 标题与统一元信息「{说明} · {分钟} 分钟」，未解锁行为「完成上一节后解锁 · 5 分钟」；进行中 / 可学习显示「查看课程」跳转 `learn.html?contentCode=…&taskId=…`；已完成、未解锁、暂不可用为真实禁用按钮（surface 底、mut 字、not-allowed）；UNAVAILABLE 行以 warn 色显示「内容暂不可用」，不只依赖颜色。
- 导航 → 非 Tab 页导航栏左侧返回 `home.html`，右侧设置图标（`aria-label="设置"`）跳转 `settings.html`；底部「返回学习首页」同回 `home.html`（真实页 `switchTab`）。
- 计划说明 / 首次学习 / 计划提示 → `?mock=explain` 显示 `role=status`「今天先安排到期复习，再按目标补新内容。」；`?mock=first-learning` 显示「继续完成第一次学习」（INCOMPLETE）；`?mock=first-learning-no-plan` 显示 NO_PLAN「继续设置，开始学习」；`?mock=first-learning-no-content` 显示 NO_CONTENT「第一次学习还没有可完成的任务」；`?mock=notice` 显示「计划版本已变化，请重新读取。」；`?mock=notice-plan-missing` 显示「学习计划还没有生成。定级结果已保存。」；`?mock=notice-goal` 显示「目标已保存。计划还没有按新目标重排。」（对应 store `planNotice` fallback）。均为文字行，不新增按钮。
- 顺延说明 → `?mock=deferred` 按真实页逐项安排标签展示两类：到期项「到期复习」（DUE），顺延项「今天排不下，已顺延，这不是欠账。」（`DEFERRED_COPY`）；以 soft 底平静信息呈现，不写成欠账，不显示算法版本。
- 课程目录不可用 → `?mock=unavailable` 在进度卡上方显示 warn 色 `role=status`「课程列表暂不可用 / 今日任务状态仍可查看。」+「重新加载」；点击后按钮转圈「正在加载…」，0.9s 后横幅消失，任务与进度保持可读，不弹 Toast。
- 计划空态 → 对应 `emptyStateView`，替换任务列表：`?mock=plan-no-plan`「还没有学习计划 / 先完成设置，再开始今天的练习。」+「开始设置」跳转 `onboarding.html`；`?mock=plan-completed`「今天的学习已经完成 / 已保存的练习还在。」+「结束学习」跳转 `home.html`，进度 100%；`?mock=plan-no-content`「暂时没有可学习的内容 / 可以先看现在能打开的内容。」+「看可用内容」；`?mock=plan-no-due`「今天没有到期的复习 / 可以新学一节，或先结束今天。」+「新学或结束」；后两者的出口对应真实页 `openPlanEmpty`，切回学习首页 `home.html`；`?mock=plan-failed`「今日任务没有加载成功 / 已提交的进度会保留。」+「重试」，重试转圈「正在重试…」后恢复任务列表与进度。
- 无任务 → `?mock=no-tasks` 在卡片内显示「今天还没有安排任务。」，不显示空插画。
- 文案边界 → 不显示内部算法版本、错误码或「等待加载」类静态占位；加载使用骨架屏，进度与任务状态同时用文字表达，不只依赖颜色。

### learn（课程与练习）

对应页面：`pages/learn.html`；真实实现参照 `apps/mobile/src/pages/learn/learn.vue`、`apps/mobile/src/components/MobileFeatureGrid.vue`、`apps/mobile/src/domain/review-history.ts`、`apps/mobile/src/domain/mistake-book.ts` 的 `weaknessView` 与 `packages/i18n/src/mobile-experience.ts` 的 `pages.learn` 文案。真实页由 `readContent(contentCode)` 读取课程详情，由 `useB18LearningStore().load()` 读取复习队列与历史；原型用 mock 课程与复习队列在同一路由内演示。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|loading|empty|error|forbidden|offline` 直达页面状态；`?contentCode=…`（兼容 `?content=`）直达课程内容，未知 code 按读取失败显示「课程内容暂时不可用。」。
- 课程直达 → `?contentCode=b2-grammar-present|b1-daily-greetings|b1-listening-campus|b1-reading-city` 打开对应课程；附 `&taskId=…` 时与真实页一致，在单元列表下方显示 `role=status`「可浏览课程，完成记录暂不可用。」。
- Mock 参数 → `?mock=content-loading|content-error|content-empty|review-loading|review-empty|review-no-due|review-deferred|review-error|review-offline|review-permission|review-illegal|review-recovery` 演示课程与复习卡各分支。
- 页面状态 → 工具条映射真实分支：空 = 课程卡空闲（「选择课程 / 从首页选择一门课程。」）与复习空态；错误 / 离线 = 课程卡读取失败与复习读取失败，各自一个「重试」，转圈「正在重试…」，不弹成功 Toast；无权限 = 复习权限分支（无重试）与空闲课程卡；加载 = 课程「正在读取课程…」与复习「正在读取复习安排…」骨架屏。切换状态会取消未完成的读取、复习与重试计时。
- 练习灵感 → 三张入口卡（含说明）：单词复习「先回想，再揭晓。用适合你的节奏巩固记忆。」→ `b2-vocabulary.html`、分级阅读「选择适合的阅读难度，把好表达收入日常。」→ `b11-reading.html`、语法结构「拆解结构、调整语序，把语法变成表达的底气。」→ `b3-grammar.html`；卡片有 44px 以上命中区与键盘焦点环。
- 课程卡 → 无 `contentCode` 时只显示「课程 / 选择课程 / 从首页选择一门课程。」，不列出课程；带 `contentCode` 时标题为「课程内容」并显示课程内容，`?mock=content-loading` 与工具条「加载」演示「正在读取课程…」骨架屏。
- 课程内容 → 课程标题、语言与类型、简介、学习单元（题干 + 四个选项）；无单元时显示「暂无可展示的学习单元。」；带 `taskId` 时显示「可浏览课程，完成记录暂不可用。」。真实页没有「换一门课程」或返回列表的操作，原型同样不提供。
- 内容读取失败 → 课程卡内 bad 色 `role=alert`「课程内容暂时不可用。」（模板兜底「课程暂不可用。」）+ 一个带刷新图标的次要「重试」；转圈「正在重试…」1s 后恢复当前课程，不弹 Toast。
- 练习入口 → 三个纯按钮：「基础练习」为主按钮（brand）→ `assessment.html`（真实页把 b2-practice 指向测评），「分级阅读」→ `b11-reading.html`，「语法练习」→ `b3-grammar.html`；没有说明小字与「更多练习与学习报告」。
- 复习标题与说明 → 有队列时标题「待复习 n 项」，说明「已有复习证据」，随后是首项阶段 `stageLabel`（如「待复习」）；空队列时说明「尚不能判断」（`weaknessView(0)`）；读取中标题「复习安排」并显示 `role=status`「正在读取复习安排…」。
- 复习空态 → `?mock=review-empty`：标题「待复习 0 项」、「暂无待复习内容。」与「还没有复习记录」（`reviewEmpty` 默认）；`?mock=review-no-due` 显示服务端 `emptyCopy`「暂无到期复习」并保留历史「最近已完成 3 项复习」。
- 复习历史 → 只要存在历史就显示：全部完成时「最近已完成 n 项复习」，有延期时「最近已完成 n 项，延期 m 项」（`?mock=review-deferred`）。
- 开始复习 → 点击后按钮禁用并转圈，随后按真实 `store.complete()` 进入恢复分支：标题回落「复习安排」、复习行消失、bad 色 `role=alert`「缺少可核验的答题结果，请从练习进入复习。」且没有「重试」；不改变计数、不写历史、不弹 Toast。
- 复习读取失败 / 离线 / 无权限 → 标题「复习安排」，bad 色 `role=alert`「移动复习队列暂时不可用。」并附带空队列说明「复习列表暂时没有读出来」+「重试」；离线同文案；`?mock=review-permission` 显示「当前账号无法查看复习安排。」且不提供重试。
- 复习不可用操作 → `?mock=review-illegal` 显示纯说明行「这个操作现在不能用」（`reviewFailureCopy`），不出现 `role=alert` 与「重试」；点击「开始复习」同样不弹 Toast。
- TabBar → 底部 5 项，「课程」选中并带 `aria-current="page"`；其余跳转 `home.html` / `b2-practice.html` / `world.html` / `profile.html`。右上角设置入口跳转 `settings.html`。
- 文案边界 → 不显示内部投影版本、错误码或「等待加载」类静态占位；加载使用骨架屏，复习计数与状态同时用文字表达，不只依赖颜色。

### b2-practice（练习）

对应页面：`pages/b2-practice.html`；真实实现参照 `apps/mobile/src/pages/b2-practice/b2-practice.vue`、`apps/mobile/src/components/b10/B10ExerciseCard.vue`、`apps/mobile/src/components/b10/B10StatusPanel.vue`、`apps/mobile/src/domain/practice-loop.ts` 与 `packages/i18n/src/mobile-experience.ts` 的 `pages.b2-practice` 文案。原型用 mock 题目演示作答、判分反馈、断点、完成与内容下线分支。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|loading|empty|error|forbidden|offline` 直达页面状态；`?mock=done|stopped|legacy|stale` 演示已完成、内容已下线、旧题组下线与版本失效。
- 页面状态 → 工具条「正常 / 加载 / 空 / 错误 / 无权限 / 离线」：正常为当前题目与判分反馈；加载为 `role=status`「正在创建练习会话…」+ 骨架屏（`aria-busy`）；空为「当前没有可用内容」+「重新读取 / 返回学习首页」并保留下方练习灵感入口；错误为「服务暂时不可用 / 练习会话暂时无法创建。」；无权限为「当前会话没有访问权限 / 登录后可以继续练习。」+「去登录」；离线为「网络暂时不可用 / 待同步不等于已结算。」。切换离开正常态会取消提交中状态并解锁选项。
- 状态恢复 → 空 / 错误 / 无权限 / 离线「重试」转圈「正在读取… / 正在重试…」→ 1.1s 后回到正常态，不弹成功 Toast。
- 作答（单选题）→ 点击任一选项即提交：该项保持 brand 选中态，其余选项变 mut 且全部不可操作，卡片内显示转圈 `role=status`「正在提交答案…」→ 0.7s 后出现判分反馈；进度「已答 n / 5」前进一位。不显示正确答案，也不在前端计算分数。
- 作答（填空题）→ 第 5 题切换为输入框「填写空格」，输入后「提交答案」由禁用变可用；回车或点击提交后输入框与按钮锁定为 surface 底 mut 字，反馈同样出现在卡片内。
- 判分反馈 → 答对为 ok 色「规则命中」，答错为 bad 色「需要修复」；随后三行依次为已保存凭证「已保存」、规则文案「正确 / 需要再练」与「下一题：第 n 题」（最后一题为「本次练习已完成」）；反馈标题获得焦点，屏幕阅读器通过 `role=alert` 播报。版本失效时追加 warn 色「当前版本已下线或发生变化，请重新读取。」。
- 下一题 → 仅在出现反馈后显示的主按钮；点击后清空反馈、加载下一道题并把焦点移回题干；最后一题完成后卡片切换为「本次练习已完成。/ 查看错题与报告」。
- 保存断点 → 点击后按钮转圈「正在保存…」，0.8s 后在按钮下方显示 `role=status`「断点已保存。」，2.4s 后自动消失；不改变题目、进度或判分，不弹 Toast。
- 已完成 → 全部题目答完或 `?mock=done`：隐藏作答卡，显示「练习完成 / 本次练习已完成。」与主按钮「查看错题与报告」→ `b10-report.html`；不显示奖励或分数。
- 内容已下线 → `?mock=stopped`：隐藏作答卡，显示「练习状态 / 练习已停止加载。」与真实文案「内容已下线，已停止加载。可以回到可用学习。」+「返回学习首页」。
- 旧题组下线 → `?mock=legacy`：空态说明为「这个旧版练习入口的题组已下线，请从底部「练习」进入今天的练习。」，与真实页 410 分支一致。
- 版本失效 → `?mock=stale`：页头下方显示 warn 色「内容版本已失效 / 当前版本已下线或发生变化，请重新读取。」+「重新读取」；点击转圈「正在读取…」1s 后提示消失，题目与进度保留。
- 画质 → 顶部「画质 · 舒适」打开底部弹层，四档「精致 / 舒适 / 轻量 / 省资源」；当前档带 brand 色对勾与 `aria-pressed`，选择后立即更新顶部文案并关闭弹层，焦点回到画质按钮；遮罩、取消与 Esc 均可关闭。
- 练习灵感 → 三张入口卡：单词复习 → `b2-vocabulary.html`、分级阅读 → `b11-reading.html`、语法结构 → `b3-grammar.html`；44px 以上命中区与键盘焦点环。
- 导航 → 一级 Tab 页：底部 5 项，「练习」选中并带 `aria-current="page"`，其余跳转 `home.html` / `world.html` / `learn.html` / `profile.html`；右上角设置跳转 `settings.html`。
- 文案边界 → 不显示内部错误码、原始题型枚举或算法版本；题型以「单选题 / 填空题」呈现，进度同时用文字与进度条表达。
