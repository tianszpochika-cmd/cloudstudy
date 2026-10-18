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

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|loading|empty|error|forbidden|offline` 直达页面状态；`?mock=done|stopped|legacy|stale|fill|feedback` 演示已完成、内容已下线、旧题组下线、版本失效、填空题（第 5 题）与判分反馈。
- 页面状态 → 工具条「正常 / 加载 / 空 / 错误 / 无权限 / 离线」：正常为当前题目与判分反馈；加载为 `role=status`「正在创建练习会话…」+ 骨架屏（`aria-busy`）；空为「暂时没有可用题目」+「内容准备好后会在这里显示。」+「重新读取 / 返回学习首页」，并保留下方练习灵感入口；错误为「服务暂时不可用 / 练习会话暂时无法创建。」+「重试 / 返回学习首页」；无权限为「当前会话没有访问权限 / 登录后可以继续练习。」+ 单个「去登录」→ `login.html`（不提供重试）；离线为「网络暂时不可用 / 待同步不等于已结算。」+「重试 / 返回学习首页」。切换离开正常态会取消提交中状态并解锁选项。
- 状态恢复 → 空「重新读取」转圈「正在读取…」、错误 / 离线「重试」转圈「正在重试…」→ 1.1s 后回到正常态，不弹成功 Toast；无权限不提供重试，只保留「去登录」。
- 作答（单选题）→ 点击任一选项即提交：该项保持 brand 选中态，其余选项变 mut 且全部不可操作，卡片内显示转圈 `role=status`「正在提交答案…」→ 0.7s 后出现判分反馈；进度按「2 / 5」样式前进一位。不显示正确答案，也不在前端计算分数。
- 作答（填空题）→ 第 5 题切换为输入框「填写空格」，输入后「提交答案」由禁用变可用；回车或点击提交后输入框与按钮锁定为 surface 底 mut 字，反馈同样出现在卡片内。
- 判分反馈 → 答对为 ok 色「规则命中」，答错为 bad 色「需要修复」；随后三行依次为已保存凭证「已保存」、规则文案「正确 / 需要再练」与「下一题：第 n 题」（最后一题为「本次练习已完成」）；反馈标题获得焦点，屏幕阅读器通过 `role=alert` 播报。版本失效时追加 warn 色「当前版本已下线或发生变化，请重新读取。」。
- 下一题 → 次按钮（与「保存断点」同为 `btn--secondary`），仅在出现反馈后显示；主色只留给完成态的「查看错题与报告」。点击后清空反馈、加载下一道未答题并把焦点移回题干；最后一题完成后卡片切换为「本次练习已完成。/ 查看错题与报告」。
- 保存断点 → 点击后按钮转圈「正在保存…」，0.8s 后在按钮下方显示 `role=status`「断点已保存。」，2.4s 后自动消失；不改变题目、进度或判分，不弹 Toast。
- 已完成 → 全部题目答完或 `?mock=done`：隐藏作答卡，只显示「练习完成 / 本次练习已完成。」与主按钮「查看错题与报告」→ `b10-report.html`；不显示副文案、奖励或分数。
- 内容已下线 → `?mock=stopped`：隐藏作答卡，显示「练习状态 / 练习已停止加载。」与真实文案「内容已下线，已停止加载。可以回到可用学习。」+「返回学习首页」。
- 旧题组下线 → `?mock=legacy`：空态说明为「这个旧版练习入口的题组已下线，请从底部「练习」进入今天的练习。」，与真实页 410 分支一致。
- 版本失效 → `?mock=stale`：页头下方显示 warn 色「内容版本已失效 / 当前版本已下线或发生变化，请重新读取。」+「重新读取」；点击转圈「正在读取…」1s 后提示消失，题目与进度保留。
- 画质 → 顶部「画质 · 舒适」打开底部弹层，四档「精致 / 舒适 / 轻量 / 省资源」；当前档带 brand 色对勾与 `aria-pressed`，选择后立即更新顶部文案并关闭弹层，焦点回到画质按钮；遮罩、取消与 Esc 均可关闭。
- 练习灵感 → 三张入口卡：单词复习 → `b2-vocabulary.html`、分级阅读 → `b11-reading.html`、语法结构 → `b3-grammar.html`；正常态与空态均保留，44px 以上命中区与键盘焦点环。
- 导航 → 一级 Tab 页：底部 5 项，「练习」选中并带 `aria-current="page"`，其余跳转 `home.html` / `world.html` / `learn.html` / `profile.html`；右上角设置跳转 `settings.html`。
- 文案边界 → 不显示内部错误码、原始题型枚举或算法版本；题型以「单选题 / 填空题」呈现，进度以「n / 5」文字与进度条同时表达。

### world（成长世界）

对应页面：`pages/world.html`；真实实现参照 `apps/mobile/src/pages/world/world.vue`、`apps/mobile/src/components/b4/B4StatusPanel.vue`、`apps/mobile/src/components/b12/B12RewardsCard.vue`、`apps/mobile/src/domain/b4.ts` 与 `packages/i18n/src/mobile-experience.ts` 的 `pages.world` 文案。真实页由 `useB4Store().loadWorld()` 读取 XP / 星币 / 连续学习 / 星系地图 / 任务 / 赛季，并由 `B12RewardsCard` 读取奖励箱；原型用 mock 数据在同一路由内演示。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|loading|empty|error|forbidden|offline` 直达页面状态；`?mock=risk|broken|streak-empty|quests-empty|season-empty|no-chest|chest-error` 演示连续学习即将中断 / 已中断 / 无记录、任务为空、赛季为空、奖励箱为空与奖励读取失败。
- 页面状态 → 工具条「正常 / 加载 / 空 / 错误 / 无权限 / 离线」：正常为成长概览与各区块；加载为 `role=status`「正在加载成长记录…」+ 骨架屏（`aria-busy`）；空为「还没有成长记录 / 完成今天的学习，就会点亮第一颗星。」+「去学习」跳转 `today.html`；错误为「成长记录暂时无法读取 / 请检查网络后重试。」+「重试」；无权限为「登录后查看成长记录 / 成长记录与你的学习进度一起保存。」+「去登录」跳转 `login.html?returnTo=%2Fpages%2Fworld%2Fworld`（不提供重试）；离线保留已读取的成长记录，并在最上方显示 warn 色 `role=status`「网络暂时不可用 / 本机有 2 条待同步记录，联网后可继续同步。」+「重试」。
- 状态恢复 → 错误与离线「重试」转圈「正在重试…」→ 1.1s 后回到正常态，不弹成功 Toast；无权限只保留「去登录」。
- 切换状态副作用 → 离开正常态会取消未完成的破冰 / 领取 / 开启奖励箱 / 重试计时并恢复按钮，不出现延迟 Toast 或跳转；切回正常态保留已领取的任务与已开启的奖励箱状态。
- 概览 → 等级 Lv.4 · 稳步成长、总 XP 1 280、星币 320；等级进度条 `role=progressbar` 为 64%，说明「距离下一级还需 220 XP。」。
- 连续学习 → 默认 7 天、状态徽标「进行中」（ok），本周七天全部点亮，今天（周日）带 brand 描边；说明「上次有效日 10 月 18 日 · 今天已学习」。`?mock=risk` 为 6 天、徽标「即将中断」（warn）、今天未点亮，说明「上次有效日 10 月 17 日 · 今天还没有学习记录」并出现「请求破冰挑战」；`?mock=broken` 为 0 天、徽标「已中断」（bad）；`?mock=streak-empty` 无连续学习记录，隐藏天数 / 周历 / 状态徽标 / 破冰按钮，只显示「还没有连续学习记录，从今天开始积累吧。」。
- 请求破冰挑战 → 点击 → 按钮保持宽度并显示 16px 转圈「正在提交…」→ 1.1s 后徽标变「已保护」（ok），说明改为「破冰挑战已提交 · 今天完成一次学习即可延续。」，按钮隐藏，不弹 Toast；说明为 `aria-live` 区域。
- 成长地图 → 六个星门按真实顺序展示：起源星门「首次学习」、词汇轨道「词汇与复习」为「已完成」（ok 色 + 对勾）；语法星云 3/5、听力卫星 1/3 为「进行中」并带细进度条（`role=progressbar`）；表达恒星、星系之门为「待解锁」（锁图标 + mut 色，不只依赖颜色）；底部赛季条「秋季赛季 / 320 赛季点 · 进行中」；`?mock=season-empty` 隐藏赛季条，显示「当前暂无赛季活动。」。
- 成长空间 → 四张入口卡：游戏大厅 → `b4-games.html`（用小挑战巩固所学）、虚拟自习室 → `b4-social.html`（专注一刻，一起进步）、我的形象 → `b4-avatar.html`（装扮自己的成长空间）、离线包 → `b4-offline.html`（把学习带在身边）；离线包带 warn 徽标「待同步 2」，指向本机待同步记录。卡片命中区 ≥44px，键盘焦点环可见。
- 成长任务 → 三行：进行中显示「2/3」，可领取行为文字按钮「领取」（`btn--ghost`），已领取行为 ok 徽标「已领取」；右上角计数为任务总数「3 个任务」。点击「领取」按钮转圈「正在领取…」→ 0.7s 后该行变为「已领取」并弹成功 Toast「已领取，星币 +20」；`?mock=quests-empty` 计数变「暂无」，列表显示「暂无成长任务。」。
- 学习奖励箱 · 查看概率 → 点击「查看概率」展开披露面板（档位 A 60% / B 30% / C 10% +「服务端已在领取前披露规则。」），按钮文案变「收起概率」并同步 `aria-expanded`；再次点击收起。领取前即可查看，对应服务端概率快照。
- 学习奖励箱 · 开启 → 点击「开启奖励箱」→ 按钮转圈「正在开启…」→ 1.1s 后标题变「奖励箱已开启」、徽标变「已开启」（ok），两个按钮均进入真实禁用态（surface 底、mut 字、not-allowed）；下方 ok 底 `role=status` 显示「开启结果已由服务端确认。/ 档位 B · 学习徽章 / 记录可在学习奖励箱中查看。」并聚焦标题。
- 奖励箱空 / 读取失败 → `?mock=no-chest` 隐藏奖励箱与操作，只显示「当前没有待开启奖励箱。」；`?mock=chest-error` 显示 bad 色「奖励读取失败。/ 请检查网络后重试。」+「重试」，点击转圈「正在读取…」0.9s 后恢复奖励箱，不弹 Toast。
- 画质 → 顶部「画质 · 舒适」打开底部弹层，四档「精致 / 舒适 / 轻量 / 省资源」；当前档带 brand 色对勾与 `aria-pressed`，选择后立即更新顶部文案并关闭弹层，焦点回到画质按钮；遮罩、取消与 Esc 均可关闭。
- TabBar 与导航 → 一级 Tab 页：底部 5 项，「成长」选中并带 `aria-current="page"`，其余跳转 `home.html` / `b2-practice.html` / `learn.html` / `profile.html`；右上角设置跳转 `settings.html`。
- 文案边界 → 不显示内部错误码、概率版本号或原始状态枚举；连续学习状态用中文徽标与说明同时表达，不只依赖颜色；奖励只说明免费、非现金与非客户端抽取。

### profile（我的账户）

对应页面：`pages/profile.html`；真实实现参照 `apps/mobile/src/pages/profile/profile.vue`、`apps/mobile/src/components/MobilePageHeader.vue`、`apps/mobile/src/stores/learner-content.ts` 的 account 投影与 `packages/i18n/src/mobile-experience.ts` 的 `pages.profile` 文案。真实页由 `mobileLearnerContentApi.readAccount()` 读取目标 / 每日时长 / 成人核验 / 界面与学习语言，并按 `store.accountStatus` 渲染读取中、读取失败与正常视图；原型用 mock 资料在同一路由内演示。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|loading|error|forbidden|offline` 直达页面状态；`?mock=no-goal|adult-pending|adult-rejected|locale-unknown|nav-failed|logout-failed` 演示目标未设置、成人核验待核验 / 未通过、语言暂未识别、页面打开失败与退出失败；`?view=logout-confirm` 直接打开退出确认对话框。截图：`profile-{loading,error,forbidden,offline,no-goal,adult-pending,adult-rejected,locale-unknown,nav-failed,logout-failed,logout-confirm}-{light,dark}.png`。
- 页面状态 → 工具条「正常 / 加载 / 错误 / 无权限 / 离线」：正常为学习档案、账号与语言、学习与服务、退出登录；加载为 `role=status`「正在读取学习资料…」+ 骨架屏（`aria-busy`，对应真实页「正在读取学习资料…」）；错误为「学习资料暂不可用 / 请稍后重试。」（对齐真实页 `lastError` fallback）+「重试」；无权限为「登录后查看账号资料 / 账号资料与学习记录需要登录后查看。」+「去登录」跳转 `login.html?returnTo=%2Fpages%2Fprofile%2Fprofile`（不提供重试）；离线保留已读取资料，并在顶部显示 warn 色 `role=status`「网络暂时不可用 / 已显示上次读取的账号资料，联网后可继续同步。」+「重试」。
- 状态恢复 → 错误与离线「重试」转圈「正在重试…」→ 1.1s 后回到正常态，不弹成功 Toast；无权限只保留「去登录」。
- 切换状态副作用 → 离开正常态会关闭退出登录对话框，取消未完成的目标跳转 / 退出 / 重试计时并恢复按钮，不出现延迟跳转；离线时保留已读取资料与服务入口，但退出登录不打开确认框，直接提示「网络暂时不可用，请连接网络后再退出登录。」。
- 学习档案 → 头像「学」+「我的学习」，下方为目标与每日时长「四六级备考 · 15 分钟/天」（对齐真实页 `goalLabel` + `dailyGoal`）；`?mock=no-goal` 时目标行改为「尚未设置」（对齐真实页 `goalLabel` 空值 fallback），目标按钮文案变「设置学习目标」。
- 账号与语言 → 三行只读资料：成人核验（已通过 ok 徽标）、界面语言（中文）、学习语言（英语），右上角「前往设置」跳转 `settings.html`。成人核验待核验为 warn 徽标「待核验」+ warn 色说明「完成成人核验后才能开始学习。」+「去核验」跳转 `onboarding.html`；未通过为 bad 徽标「未通过」+「当前版本暂不能向此账号开放学习。」+「查看帮助」跳转 `support.html`；`?mock=locale-unknown` 时两种语言显示 mut 色「暂未识别」。
- 修改学习目标 → 点击 → 按钮保持宽度转圈「正在打开…」，期间服务入口仍可浏览但退出登录不可点 → 0.9s 后跳转 `onboarding.html`；`?mock=nav-failed` 时停留在本页，按钮下方显示 bad 色 `role=alert`「页面未能打开，请重试。」（带参数打开即显示，便于核对），可再次点击，错误在下一次操作开始时清除。
- 学习与服务 → 八行入口（对齐真实页 `servicePages`，`devices` 虽是真实路由但本页不链接，故不列入）：学习报告 → `b10-report.html`、今日任务 → `today.html`、学习权益 → `b5-commerce.html`、离线学习 → `b4-offline.html`、我的形象 → `b4-avatar.html`、设置 → `settings.html`、画质与设备 → `b6-platform.html`、帮助中心 → `support.html`；每行含图标、标题、说明与箭头，命中区 ≥44px，键盘焦点环可见。
- 退出登录 → 点击底部文字按钮打开确认对话框「退出登录？ / 退出后，需要重新登录才能继续学习。本机已下载的内容不会删除。」；「取消」、遮罩与 Esc 均可关闭；「退出登录」为 bad 色危险按钮，确认后关闭对话框、按钮转圈「正在退出…」→ 1.1s 后跳转 `login.html`（真实页退出后回到登录入口，无 Toast）。对话框为设计新增，真实页直接退出，需同步实现。`?mock=logout-failed` 时停留本页，退出按钮上方显示 bad 色 `role=alert`「退出登录未完成，请重试。」（带参数打开即显示，便于核对）并把焦点移回退出按钮；`?view=logout-confirm` 直接打开确认对话框。
- TabBar 与导航 → 一级 Tab 页：底部 5 项，「我的」选中并带 `aria-current="page"`，其余跳转 `home.html` / `b2-practice.html` / `world.html` / `learn.html`；右上角设置跳转 `settings.html`。
- 文案边界 → 不显示内部错误码、账号 ID、原始版本号或账号是否存在；成人核验状态与语言同时用文字表达，不只依赖颜色；退出登录说明只描述影响范围，不做挽留。

### practice（练习中心）

对应页面：`pages/practice.html`；真实实现参照 `apps/mobile/src/pages/practice/practice.vue`、`apps/mobile/src/components/MobileFeatureGrid.vue`、`apps/mobile/src/components/MobilePageHeader.vue`、`apps/mobile/src/auth/navigation.ts` 的 `ensureMobilePageAccess` 与 `packages/i18n/src/mobile-experience.ts` 的 `pages.practice` / `pages.<entry>` / `b10.practice` 文案。真实页是客户端静态入口清单：`onShow` 只做访问校验，不读取练习队列，因此本页没有读取中 / 空 / 读取失败分支。原型在同一路由内用 mock 数据演示正常与无权限。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|forbidden` 直达页面状态。截图：`practice-{light,dark}.png`、`practice-forbidden-{light,dark}.png`。
- 页面状态 → 本页工具条只提供「正常 / 无权限」两个真实分支：正常为练习灵感与 5 个练习入口；无权限为「当前会话没有访问权限 / 登录后可以继续练习。」+ 单个「去登录」→ `login.html?returnTo=%2Fpages%2Fpractice%2Fpractice`，与 `b2-practice` 无权限态一致，不提供重试。访问校验 `ensureMobilePageAccess('/pages/practice/practice')` 的去向：未登录 → 登录页（带 `returnTo`）；同意撤回或账号受限 → `forbidden.html`；学习准备未完成 → `onboarding.html`。入口为客户端静态清单，真实页没有读取中 / 空 / 错误输出，因此不为这些状态造静态占位。
- 页头 → 导航栏标题「练习中心」（`pages.practice.short`）+ 返回：返回上一页；无历史时回首页（真实页 `backMobile`：有历史 `navigateBack`，否则回 `/pages/home/home`）；右上角设置 → `settings.html`；页内 kicker「PRACTICE」（`pages.practice.kicker`）、标题「选择练习」、说明「按技能选择下一项练习。」，与移动端 `pages.practice` 的 kicker / title / description 一致。
- 入口计数 → 顶部「共 5 个练习入口」，对齐真实页 `共 {{ entries.length }} 个练习入口`，数字随入口数量更新，不写死任务名。
- 练习灵感 → 标题「找到今天的练习灵感」、右侧「听 · 说 · 读 · 写」；三张入口卡：单词复习 → `b2-vocabulary.html`、分级阅读 → `b11-reading.html`、语法结构 → `b3-grammar.html`；与真实页 `MobileFeatureGrid` 的 `features` 顺序及 `mobileT('practiceHeading')` / `practiceNote` 文案一致，44px 以上命中区与键盘焦点环。
- 练习入口 → 练习灵感之后直接是一张入口卡（真实页此处没有分区标题），卡内五行，顺序与真实页 `entryPages` 一致：水平测评 → `assessment.html`、学习报告 → `b10-report.html`、阅读练习 → `b3-reading.html`、听力听写 → `b3-listening.html`、发音练习 → `b3-speaking.html`；每行含图标、标题、`pages.<id>.description` 说明与「进入」动作，整行可点击，命中区 ≥44px，键盘焦点环可见。
- 页脚说明 → 「完成题目后查看反馈，让每道题成为下一步的线索。」，取自 `b10.practice.description`；不新增夸大的奖励或分数文案。
- 导航 → 二级页：本页不在 TabBar 中（TabBar「练习」指向 `b2-practice.html`），因此不显示底部导航；返回为上一页，无历史时回 `home.html`，设置指向 `settings.html`。
- 文案边界 → 不显示内部错误码、路由名或原始状态枚举；入口说明全部复用移动端 `pages.*` 文案，不出现英文混排，也不显示算法版本或题量承诺。

### b2-vocabulary（单词复习）

对应页面：`pages/b2-vocabulary.html`；真实实现参照 `apps/mobile/src/pages/b2-vocabulary/b2-vocabulary.vue`、`apps/mobile/src/components/b10/B10StatusPanel.vue`、`apps/mobile/src/stores/b10-learning.ts`、`apps/mobile/src/platform/b10-foundation.ts` 的 `b10.vocab` / `b10.status` 文案与 `packages/i18n/src/mobile-experience.ts` 的 `pages.b2-vocabulary` 文案。真实页由 `store.loadSrs()` 读取学习服务下发的复习批次，按 `currentCard` / `completed` / `status` 渲染正面、背面、今日完成与各失败分支；原型用 mock 词卡在同一路由内演示。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|loading|empty|error|forbidden|offline` 直达页面状态；`?mock=idle|revealed|rating|rate-error|done|stale|stale-recovery|queued|sync-partial|sync-done|no-audio|back-error` 演示空闲、已揭晓背面、评分中、评分失败、今日完成、版本失效、待核验、待同步、同步部分失败、同步完成提示、没有发音与背面读取失败。截图：`b2-vocabulary-{light,dark}.png` 与 `b2-vocabulary-{loading,empty,error,forbidden,offline,revealed,rating,done,stale,queued,no-audio,back-error,rate-error,idle,sync-partial,sync-done}-{light,dark}.png`。
- 页面状态 → 工具条「正常 / 加载 / 空 / 错误 / 无权限 / 离线」：正常为复习词卡、空闲或今日完成；加载为 `role=status`「正在加载学习内容…」+ 骨架屏（`aria-busy`）；空对齐 `b10.vocab.empty`「今天没有到期词卡」+ `b10.status.noSample`「内容准备好后会在这里显示。」+ 单个「重试」；错误为「词汇批次暂时不可用 / 请根据上方状态重试；未确认的复习不会被显示为已完成。」+「重试」；无权限为「当前会话没有访问权限 / 登录后可以继续复习。」+ 单个「去登录」→ `login.html?returnTo=%2Fpages%2Fb2-vocabulary%2Fb2-vocabulary`（不提供重试）；离线为「网络暂时不可用 / 待同步不等于已结算。」+「重试」，有队列时队列行显示「n · 待同步不等于已结算。」+「同步待处理记录」。所有状态下页面下方「基础练习 / 错题与报告」两个出口照常保留。
- 状态恢复 → 空、错误与离线「重试」转圈「正在读取…／正在重试…」→ 1.1s 后回到正常态，不弹成功 Toast；无权限只保留「去登录」。
- 切换状态副作用 → 离开正常态会关闭画质弹层，取消未完成的背面读取 / 评分 / 播放 / 重试计时并恢复按钮，不出现延迟跳转或 Toast；切回正常态回到卡片正面。
- 页头与批内进度 → 导航栏「单词复习」+ 返回（`backMobile`：返回上一页；无历史时回首页，原型 `data-back="home.html"`），右上角设置 → `settings.html`；页内 kicker「单词花园」、标题「让每个单词，留下来。」、说明「先回想，再揭晓。用适合你的节奏巩固记忆。」（`pages.b2-vocabulary`）。顶部「已完成 n / 5」与细进度条同步，评完一张前进一位；今日完成与空闲时进度区隐藏。
- 空闲 → `?mock=idle`（对齐 `store.status === 'idle'`）：显示「等待读取词汇批次 / 身份与页面初始化完成后，将从学习服务读取当前复习队列。」，无按钮、无骨架屏。
- 词卡正面 → 左上来源徽标「复习 / 新学」、右上掌握度「学习中 / 新词」，单词 36px、音标、提示行，以及 `b10.vocab.description` 对应的隐私说明「正面不展示释义、例句或标准答案。」；不提前显示释义或答案。
- 播放发音 → 仅当服务端返回音频地址时显示「播放发音」；点击后文案变「正在播放…」并禁用 1.2s，随后恢复；没有音频时显示说明「没有发音，不能播放。」（对齐 `vocabPlayable` 与真实页 `v2-vocab-silent`），不提供空按钮。`?mock=no-audio` 演示该分支。
- 显示答案 → 点击主按钮「显示答案」→ 按钮转圈「正在读取答案…」（对齐 `b10.vocab.revealing`）→ 0.8s 后在同一张卡内展开中文释义、英文释义、例句与「下次复习：日期」，记忆信心按钮出现；焦点移到释义。释义缺失时按真实页回退为「服务端未返回受保护释义。」。`?mock=revealed` 直接显示背面与四档记忆信心；`?mock=rating` 显示评分中的真实禁用态（surface 底、mut 字、虚线边框、not-allowed）与「正在记录…」。
- 背面读取失败 → `?mock=back-error` 在卡内显示 bad 色 `role=alert`「词卡背面暂时无法加载，答案未被伪造。可以再试一次。」（对齐 store 的 `词卡背面暂时无法加载，答案未被伪造。`，带参数打开即显示，便于核对），不伪造释义；再次点击「显示答案」可正常展开。
- 记忆信心 → 背面四档「忘了 / 模糊 / 记得 / 很熟」以 bad / warn / ok / ok 柔和底色区分，同时保留文字标签；选择后四档立即进入真实禁用态（surface 底、mut 字、虚线边框、not-allowed），转圈「正在记录…」→ 0.7s 后前进到下一张并在卡下显示 `role=status`「复习已记录。」（`b10.vocab.accepted`）2.4s 后自动消失。
- 评分失败 → `?mock=rate-error`（对齐 `rateCard` 未获确认分支）：选择记忆信心后卡片不前进，卡内显示 bad 色 `role=alert`「服务端未确认本次复习，当前卡片未推进。」，四档按钮恢复可点，可再次评分；错误在下一次评分开始时清除。
- 版本失效 → `?mock=stale` 显示 warn 色横幅「内容版本已失效 / 当前版本已下线或发生变化，请重新读取。」+「重试」（`b10.status.stale` / `b10.common.stale`），记忆信心全部禁用；点击转圈「正在读取…」1s 后横幅消失、评分恢复可用。`?mock=stale-recovery` 演示同一面板的第二种来源（`RECOVERY_REQUIRED`）：说明改为「复习记录待核验，暂不可结算。」。
- 待同步 → `?mock=queued` 显示 warn 色横幅「网络暂时不可用 / 本次复习已排队待同步，服务端尚未确认掌握变化。」+ 队列行「1 · 待同步不等于已结算。」+ 横幅按钮组「同步待处理记录 / 重试」——对齐 `B10StatusPanel` 在 `status=offline` 时同时给出 `status.retry`「重试」与有队列时的 `status.sync`「同步待处理记录」。「重试」转圈「正在重试…」1.1s 后网络恢复、状态回到 ready（横幅改为 surface 底「已准备好，可以开始」+ 队列行保留、重试按钮隐藏），不弹 Toast。「同步待处理记录」转圈「正在同步…」0.9s 后横幅消失，进度区上方显示 ok 色 `role=status` 提示行「已准备好，可以开始 / 待同步复习已提交。」——对齐 `store.syncSrs` 成功后 `status='ready'` + `message='待同步复习已提交。'` 显示在状态面板而非 Toast；提示行保留 2.4s 后淡出，下一次操作也会清除。同步成功时队列与 ready 面板一并复位——「重试」先留下的 ready 横幅不会在成功提示出现时重新显示，最终页面上只剩成功提示行；切换工具条页面状态或点「刷新复习队列」重新读取时同样丢弃 ready 面板。离线态内的「同步待处理记录」走同一流程：回到正常态并显示同一条页内提示，不弹 Toast。`?mock=sync-partial` 演示部分失败：同步后仍保留队列，说明改为「部分复习未获服务端确认，队列仍保留。」（不发成功提示）。`?mock=sync-done` 直达同步成功后的页内提示态。
- 今日复习已完成 → 全部评完后或 `?mock=done`：隐藏进度与词卡，显示 ok 图标、「今日复习已完成」与服务端确认说明 +「刷新复习队列」；点击转圈「正在刷新…」0.9s 后重新读取：先回到加载态，再回到正常 / 完成态，不弹 Toast。
- 出口 → 卡下两个次按钮：基础练习 → `assessment.html`、错题与报告 → `b10-report.html`（对齐真实页 `b10-links`），所有状态下保留；真实页没有页脚说明，原型同样不显示。
- 画质 → 顶部「画质 · 舒适」打开底部弹层，四档「精致 / 舒适 / 轻量 / 省资源」；当前档带 brand 对勾与 `aria-pressed`，选择后更新顶部文案并关闭弹层，焦点回到画质按钮；遮罩、取消与 Esc 均可关闭（对齐 `B10StatusPanel` 的画质选择）。
- 导航 → 二级页：导航栏返回按 `backMobile`——返回上一页，无历史时回 `home.html`，右上角设置 → `settings.html`，不显示底部 TabBar（TabBar「练习」指向 `b2-practice.html`）。
- 文案边界 → 不显示内部错误码、算法版本、批次 ID 或原始状态枚举；来源与掌握度用中文徽标表达，待同步与失效状态同时用文字说明，不只依赖颜色。

### b3-grammar（语法结构）

对应页面：`pages/b3-grammar.html`；真实实现参照 `apps/mobile/src/pages/b3-grammar/b3-grammar.vue`、`apps/mobile/src/components/b10/B10StatusPanel.vue`、`B10ExerciseCard.vue`、`B10FeedbackCard.vue`、`apps/mobile/src/domain/b10.ts`、`apps/mobile/src/platform/b10-foundation.ts` 的 `b10.grammar` 文案与 `packages/i18n/src/mobile-experience.ts` 的 `pages.b3-grammar` 文案。真实页由 `b10LearningApi.listGrammarPoints` 读取语法知识树，再按选中知识点读取长难句结构图、创建语法会话，提交顺序 / 仿写 / 病句改错后由服务端规则返回反馈；原型用 mock 知识点与句法结构在同一路由内演示。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|loading|empty|error|forbidden|offline` 直达页面状态；`?mock=degraded|feedback-ok|feedback-bad|stale|no-graph|submit-error|exercise` 演示线性句法、提交命中 / 需要修复、版本失效、无可解析长难句、提交失败与已作答的会话练习。截图：`b3-grammar-{light,dark}.png`、`b3-grammar-{loading,empty,error,forbidden,offline,degraded,feedback-ok,feedback-bad,stale,no-graph,submit-error,exercise}-{light,dark}.png`。
- 页面状态 → 工具条「正常 / 加载 / 空 / 错误 / 无权限 / 离线」：正常为语法知识树、长难句 X 光机、会话练习与规则练习；加载为 `role=status`「正在加载学习内容…」+ 骨架屏（`aria-busy`）；空对齐 `b10.status.empty` / `b10.grammar.noGraph`「暂时没有可用的句法结构。」+ `b10.status.noSample`「内容准备好后会在这里显示。」+「重试」；错误为「语法知识树暂时不可用 / 请检查网络后重试；当前顺序与草稿不会被清空。」+「重试」；无权限为「当前会话没有访问权限 / 内容准备好后会在这里显示。」（说明取 `b10.status.noSample`，对齐 `B10StatusPanel` 在 message 为空时的默认）+ 单个「去登录」→ `login.html?returnTo=%2Fpages%2Fb3-grammar%2Fb3-grammar`（不提供重试）；离线为「网络暂时不可用 / 待同步不等于已结算。」+「重试」。
- 状态恢复 → 空、错误与离线「重试」转圈「正在读取…／正在重试…」→ 1.1s 后回到正常态，不弹成功 Toast；无权限只保留「去登录」。
- 切换状态副作用 → 离开正常态会关闭画质弹层、取消未完成的提交计时并恢复按钮，不出现延迟反馈；切回正常态保留当前知识点、积木顺序与已填槽位。
- 页头 → 导航栏「语法结构」+ 返回（`backMobile`：返回上一页；无历史时回首页，原型 `data-back="home.html"`），右上角设置 → `settings.html`；页内 kicker「句子实验室」、标题「读懂句子的秘密。」、说明「拆解结构、调整语序，把语法变成表达的底气。」（`pages.b3-grammar`）；不显示底部 TabBar。
- 语法知识树 → 顶部「语法知识树 · 3 个知识点」与「画质 · 舒适」同排；三个知识点 chip 单选，选中项 brand 描边与 `aria-pressed`，命中区 44px；下方展示当前知识点代码、标题、中文说明、结构公式、前置知识点与掌握投影。切换知识点时显示 `role=status`「正在读取语法结构…」、chip 短暂禁用，600ms 后更新内容并重置积木顺序、槽位、会话练习作答与反馈（对齐真实页 `loadPoint` 的选择上下文重置）。
- 长难句 X 光机 → 展示原句 20px、中文翻译与按角色拆分的结构行（主语 / 定语从句 / 谓语 / 状语），角色用文字标注；下方「依存关系 n 条」列出修饰、宾语、地点状语等关系（对齐真实页 `graph.edges`）；右上徽标标明「结构图 / 线性句法」。
- 画质降级 → 顶部「画质 · 舒适」打开底部弹层，四档「精致 / 舒适 / 轻量 / 省资源」；选择「省资源」后句子卡切换为线性句法：隐藏依存关系、显示「线性切片」与 warn 说明「结构图加载失败，已降级为线性句法。」（取 `b10.grammar.degraded` 原文；真实页在 `performanceLevel === 'Performance'` 或 `graphStatus === 'DEGRADED'` 时都用这条），徽标改为「线性句法」；选回其他档位恢复结构图。`?mock=degraded` 直接以省资源档打开。遮罩、取消与 Esc 均可关闭，选择后焦点回到画质按钮。
- 调整句子积木顺序 → 每行积木带序号、文本与上移 / 下移 44px 按钮；首行上移、末行下移为真实禁用态（透明底、mut 字、虚线边框、not-allowed）；移动后立即重排并把焦点移回相邻按钮（对齐真实页 `moveBlock` 与 `B10ExerciseCard` 的无拖拽兼容按钮）。
- 提交句子积木 → 主按钮「提交规则练习」（取 `b10.grammar.submit`，与结构仿写同文案）→ 转圈「正在提交…」→ 0.9s 后出现规则反馈卡：顺序与参考一致为 ok 底「规则命中」，否则为 bad 底「需要修复」并给出原因；反馈卡包含「答案已保存，记录可在学习报告中查看。」、规则依据（标签 / 解释 / 原句）与下一步，来源徽标「句子积木」，焦点移到反馈标题（对齐 `B10FeedbackCard` 的 `savedReceipt` / `feedbackText` / `nextQuestion` / `evidence`）。
- 提交失败 → `?mock=submit-error`（对齐 `submitBlocks` 的 catch 分支）：积木区显示 bad 色 `role=alert`「句子积木提交失败，当前顺序已保留。」，顺序不变，可再次提交；错误在下一次提交开始时清除。
- 按结构槽位仿写 → 两个槽位（主语 / 定语从句）带占位提示；未填满时「提交规则练习」为真实禁用态（surface 底、mut 字、虚线边框、not-allowed），填满后可提交，转圈「正在提交…」0.9s 后显示「规则命中」反馈，来源徽标「结构仿写」（对齐 `b10.grammar.imitate` 与 `submitImitation`）。
- 病句改错 → 固定病句「The book what you lent me is on the desk.」；输入为空时「提交改错」为真实禁用态；提交转圈 0.8s 后按改法给出反馈：包含 that 为「规则命中」，否则为「需要修复」并提示「还需要指出错误位置：what 不能引导定语从句。」，来源徽标「病句改错」（对齐 `b10.grammar.correction`、`submitCorrection` 与真实页「规则反馈与自评」说明）。
- 版本失效 → `?mock=stale`（对齐 `contentVersionStale` → `status='stale'`）：显示 warn 横幅「内容版本已失效 / 当前版本已下线或发生变化，请重新读取。」+「重试」，两个「提交规则练习」、会话练习选项与「提交改错」全部禁用，知识点 chip 禁用；点击转圈「正在读取…」0.9s 后横幅消失、提交恢复，顶部显示 ok 色 `role=status`「已准备好，可以开始 / 语法结构已更新。」（对齐 `b10.status.ready`），2.4s 后淡出，不弹 Toast。
- 无可解析长难句 → `?mock=no-graph`（对齐 `loadPoint` 的「当前知识点还没有发布可解析的长难句。」分支）：隐藏句子卡与反馈卡，显示 info 横幅「当前知识点还没有发布可解析的长难句。/ 可以先在下方完成病句改错，或切换其他知识点。」，病句改错仍可用。
- 直接演示反馈 → `?mock=feedback-ok` 直接显示顺序正确的「规则命中」反馈；`?mock=feedback-bad` 显示「需要修复」反馈与规则依据，便于核对深色对比度与禁用态。
- 练习数量 → 会话练习区上方显示「本次语法练习 2 道」（对齐 `packNotice('GRAMMAR', n)`；2 道 = 引导词选择 + 已内联为句子积木的排序题）；没有练习数时不显示该行。
- 会话练习卡 → 对齐真实页 `B10ExerciseCard` 的 CHOICE 分支：题干「选择正确的引导词补全句子：The book ____ you lent me is on the desk.」+ 三个选项（A that / B what / C who）+「本题由服务端规则判分，不使用生成式 AI。」；点击选项即按服务端规则反馈（that 为「练习正确：that 在从句中作宾语，修饰 The book。」，其余为「练习需要修复：what 不能引导定语从句，who 只指人。」），选中项保持 `aria-pressed` 与 brand 描边，反馈用 ok / bad 色并配文字；版本失效或提交中所有选项真实禁用；`?mock=exercise` 直接演示已答对状态。真实页的 `DRAG_SORTER` 由本页「调整句子积木顺序」内联承载，不重复 `ExerciseCard`；本原型不覆盖全部题型。
- 出口 → 页尾两个次按钮：错题与报告 → `b10-report.html`、写作练习 → `b3-writing.html`；正常态下始终保留。
- 文案边界 → 不显示内部错误码、反馈代码、规则版本号或原始题型枚举；知识点只以小字标注 CEFR 级别；反馈用「规则命中 / 需要修复」与规则依据表达，不只依赖颜色。

### b3-reading（阅读精练）

对应页面：`pages/b3-reading.html`；真实实现参照 `apps/mobile/src/pages/b3-reading/b3-reading.vue`、`apps/mobile/src/components/b10/B10StatusPanel.vue`、`apps/mobile/src/api/b10.ts` 的阅读接口、`apps/mobile/src/domain/practice-loop.ts` 的 `practiceFeedback`、`apps/mobile/src/domain/grammar-reading-pack.ts` 的 `packNotice('READING', n)`、`apps/mobile/src/platform/b10-foundation.ts` 的 `b10.reading` 文案与 `packages/i18n/src/mobile-experience.ts` 的 `pages.b3-reading` 文案。真实页先 `listReadingArticles` 读取授权文章，再读取段落与理解检查；阅读位置与文章版本 / epoch 绑定，保存失败保留最后位置并进入待同步；挖掘失败不伪造入库结果。原型用 mock 文章与两道理解检查在同一路由内演示。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|loading|empty|error|forbidden|offline` 直达页面状态；`?mock=translation|saved|queued|save-error|stale|mined|mine-error|closed|answered-ok|answered-bad|answer-stale|submit-error|revoked` 演示译文展开、已保存、待同步、保存失败、版本失效、已挖掘、挖掘失败、题组关闭、已作答正确 / 需再练、提交时版本失效、提交失败与授权撤回。截图：`b3-reading-{light,dark}.png` 与 `b3-reading-{loading,empty,error,forbidden,offline,translation,saved,queued,save-error,stale,mined,mine-error,closed,answered-ok,answered-bad,answer-stale,submit-error}-{light,dark}.png`（`revoked` 复用无权限截图）。
- 页面状态 → 工具条「正常 / 加载 / 空 / 错误 / 无权限 / 离线」：正常为文章卡、阅读位置与理解检查；加载为 `role=status`「正在加载学习内容…」+ 骨架屏（`aria-busy`）；空为「暂时没有可用的授权文章 / 内容准备好后会在这里显示。」（对齐 `b10.reading.noArticle` 与 `b10.status.noSample`）+「重试」；错误为「阅读服务暂时不可用 / 请检查网络后重试；最后保存的位置不会被清空。」+「重试」；无权限对齐 `rightsStatus === 'REVOKED'` → 「当前文章版权状态不允许阅读 / 内容准备好后会在这里显示。」（说明取 `b10.status.noSample`，对齐 `B10StatusPanel` 在 message 为空时的默认，与 b3-grammar / b2-vocabulary 一致）+ 单个「去登录」→ `login.html?returnTo=%2Fpages%2Fb3-reading%2Fb3-reading`（不提供重试）；离线为「网络暂时不可用 / 待同步不等于已结算。」+「重试」+ 待同步队列行「1 · 待同步不等于已结算。/ 阅读进度 · 等待联网后提交」+「同步待处理记录」。
- 状态恢复 → 空、错误与离线「重试」转圈「正在读取…／正在重试…」→ 1.1s 后回到正常态，不弹成功 Toast；离线队列与待同步横幅的「同步待处理记录」转圈「正在同步…」→ 0.9s（离线队列 1.1s）后回到正常态、徽标改为「已保存」并显示页内提示「待同步阅读记录已提交。」，不弹 Toast；无权限只保留「去登录」。
- 登录门禁 → 对齐真实页 `onMounted`：先 `session.restore()`，未登录直接跳转 `login.html?returnTo=%2Fpages%2Fb3-reading%2Fb3-reading`，不渲染阅读内容；已登录且会话身份变化时清空文章、位置、作答与待同步记录。原型以无权限态承载未登录 / 授权撤回分支，登录页回跳地址与真实页一致。
- 切换状态副作用 → 离开正常态会关闭画质弹层、作废未完成的保存 / 挖掘 / 提交计时并恢复按钮，不出现延迟反馈；切回正常态保留阅读位置与已选答案。
- 页头与导航 → 导航栏「阅读精练」（`pages.json` 标题）+ 返回（`backMobile`：返回上一页；无历史时回首页，原型 `data-back="home.html"`），右上角设置 → `settings.html`；页内 kicker「阅读角」、标题「在阅读里，遇见世界。」、说明「读懂一段文字，收藏值得反复回味的表达。」（`pages.b3-reading`）；不显示底部 TabBar（TabBar「练习」指向 `b2-practice.html`）。
- 文章信息 → 顶部「授权文章 · 1 篇」与「画质 · 舒适」同排；文章卡显示 CEFR 级别、词数、预计时长（「B2 · 726 词 · 约 6 分钟」）与标题，右上徽标「未保存（mut）/ 已保存（ok）」；标题带 `tabindex="-1"` 供保存后聚焦。
- 正文字号 → A− / A＋ 每次 10%，范围 85%–135%，中间显示当前百分比；到达上下限时对应按钮进入真实禁用态（surface 底、mut 字、not-allowed），不只靠透明度；字号只作用于英文正文，译文保持 14px，135% 下无横向溢出。
- 显示译文 → 工具按钮在「显示译文 / 隐藏译文」间切换，`aria-pressed` 同步；译文以 surface 底色块出现在对应段落后并带「译文」小标题；没有译文的分段不显示空块。`?mock=translation` 直接展开。
- 挖掘为表达 → 每段下方按钮「挖掘为表达」（对齐 `b10.reading.mining`）→ 转圈「正在挖掘…」→ 0.8s 后变为「已加入复习信号」（`b10.reading.mined`）并进入真实禁用态（ok-soft 底、ok 字），同时弹成功 Toast；`?mock=mine-error` 带参数打开即显示 bad 色 `role=alert`「表达挖掘失败，未伪造入库结果。」（便于核对），再次点击复现一次失败，之后点击成功且最后保存的阅读位置不变；`?mock=mined` 直接演示已挖掘状态（第一段）。
- 阅读位置 → 拖动滑块实时更新百分比与 `aria-valuetext`；拖动即把保存徽标改回「未保存」、清除待同步横幅；`?mock=queued` 直接显示 warn 横幅「阅读进度保存失败，最后位置已保留。」+ 队列行 +「同步待处理记录」，点击转圈「正在同步…」0.9s 后清除横幅、徽标改为「已保存」并显示页内提示。
- 保存阅读进度 → 主按钮「保存阅读进度」（`b10.reading.save`）→ 转圈「正在保存…」，同时滑块与挖掘按钮真实禁用，防止重复提交 → 1s 后徽标改为「已保存」，顶部出现 ok 色 `role=status`「已准备好，可以开始 / 阅读进度已保存。」（`b10.status.ready`），2.4s 后淡出，不弹 Toast；`?mock=save-error` 首次保存进入上述待同步横幅，保留最后位置。
- 版本失效 → `?mock=stale`（对齐 `contentVersionStale` → `status='stale'`）显示 warn 横幅「内容版本已失效 / 当前版本已下线或发生变化，请重新读取。」；滑块、保存、挖掘与全部「提交答案」进入真实禁用态（surface 底、mut 字、虚线边框、not-allowed）；「重试」转圈「正在读取…」0.9s 后横幅消失、功能恢复，顶部提示「阅读内容已更新。」。`?mock=answer-stale` 在提交答案时进入同一横幅，当前答案保留。
- 理解检查 → 题干 + 三个选项（A / B / C），选项为单选：点击后 brand 描边、soft 底、圆形字母标记反色，`aria-checked` 同步；未选择时「提交答案」为真实禁用态，选择后可提交；题干与选项在提交中或版本失效时不可改。
- 提交答案 → 转圈「正在提交…」→ 0.9s 后卡内出现反馈块：ok 底「已保存 / 正确」或 bad 底「已保存 / 需要再练」，并给出「本次练习已完成」或「下一题：第 2 题」（对齐 `practiceFeedback` 的 `savedReceipt` / `feedbackText` / `nextQuestion`）；反馈出现后焦点移到反馈块，选项保持已选并可重新选择、再次提交；`?mock=answered-ok|answered-bad` 直接演示两种结果。
- 提交失败 → `?mock=submit-error`（对齐 `submitQuestion` 的 catch 分支）：带参数打开即呈现首次提交后的失败态，第 1 题卡内显示 bad 色 `role=alert`「阅读理解提交失败，当前答案仍保留。」，已选答案与滑动位置都不变；错误在下一次提交开始时清除，再次提交（重试）可正常给出「已保存 / 正确」反馈。
- 练习数量与关闭 → 文章卡下方显示「本次阅读练习 2 道」（对齐 `packNotice('READING', n)` 的「本次阅读练习 n 道」）；`?mock=closed` 改为 warn 色「这组题还没备齐，本次练习已关闭。」（`PACK_CLOSED_COPY`）并隐藏理解检查，阅读、译文与挖掘照常可用。
- 画质 → 顶部「画质 · 舒适」打开底部弹层，四档「精致 / 舒适 / 轻量 / 省资源」，当前档带 brand 对勾与 `aria-pressed`；选择后更新顶部文案并关闭弹层，焦点回到画质按钮；遮罩、取消与 Esc 均可关闭（对齐 `B10StatusPanel` 的画质选择）。
- 出口 → 页尾两个次按钮：单词复习 → `b2-vocabulary.html`（挖掘的表达会在复习信号中出现）、错题与报告 → `b10-report.html`；正常态下始终保留。
- 文案边界 → 不显示文章 ID、内容版本号、反馈代码或原始状态枚举；CEFR 级别只作小字标识；同步与失效状态同时用文字说明，不只依赖颜色。

### b11-reading（分级阅读）

对应页面：`pages/b11-reading.html`；真实实现参照 `apps/mobile/src/pages/b11-reading/b11-reading.vue`、`apps/mobile/src/stores/b11-learning.ts`（`loadReading` / `setReadingBlock` / `saveReadingPosition` / `submitReadingAnswer` / `syncOffline`）、`apps/mobile/src/components/b11/B11StatusPanel.vue`、`apps/mobile/src/api/b11.ts` 的阅读接口、`apps/mobile/src/platform/b11-foundation.ts` 的 `b11.status` / `b11.reading` / `b11.common` 文案与 `packages/i18n/src/mobile-experience.ts` 的 `pages.b11-reading` 文案。真实页先 `session.restore()`，再 `loadB11ReadingWorkspace` 读取授权文章、段落与理解题；阅读位置按段落进度保存并由服务端确认，401/403 → forbidden、404/410 → expired、网络失败 → offline；离线答案进入待同步队列，服务端确认前不判定对错。原型用 mock 文章、三段正文与两道理解题在同一路由内演示。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|loading|empty|error|forbidden|offline` 直达页面状态；`?mock=queued|save-error|expired|answered-ok|answered-bad|submit-error|submit-offline|revoked|motion-off` 演示待同步、保存失败、版本失效、已答对 / 已记录、提交失败、离线提交、授权撤回与关闭动效。截图：`b11-reading-{light,dark}.png` 与 `b11-reading-{loading,empty,error,forbidden,offline,queued,save-error,expired,answered-ok,answered-bad,submit-error,submit-offline}-{light,dark}.png`（`revoked` 复用无权限截图）。
- 页面状态 → 工具条「正常 / 加载 / 空 / 错误 / 无权限 / 离线」：正常为文章卡、段落与理解检查；加载为 `role=status`「正在加载内容」+ 骨架屏（`aria-busy`，取 `b11.status.loading`）；空为「当前没有可用内容 / 服务端未返回可阅读文章。」+「重试」（title 取 `b11.status.empty`，正文对齐 `loadReading` 的 empty 分支 `readingMessage`，不拼接 `noArticle` + `noSample`）；错误为「服务暂时不可用 / 阅读服务暂时不可用；最后位置仍保留。」+「重试」；无权限为「当前会话没有访问权限 / 当前文章版权状态不允许阅读。」（`b11.status.forbidden` + `REVOKED` 原文）+ 唯一「去登录」→ `login.html?returnTo=%2Fpages%2Fb11-reading%2Fb11-reading`；离线为「暂时无法连接服务」（`b11.status.offline`，不写泛化网络说明，对齐 `B11StatusPanel` 剥离泛化离线句）+「重试」+ 待同步队列行「待同步 1 / 阅读位置 · 等待联网后提交」+「恢复同步」。
- 状态恢复 → 空、错误与离线「重试」转圈「正在读取…／正在重试…」→ 1.1s 后回到正常态，不弹成功 Toast；离线队列「恢复同步」转圈「正在同步…」→ 1.1s 后回到正常态、清除队列与离线作答标记，并显示页内提示「待同步操作已由服务端确认。」（`syncOffline` 成功文案）；无权限只保留「去登录」。
- 登录门禁 → 对齐真实页 `onMounted`：先 `session.restore()`，未登录跳转登录页、不渲染阅读内容；`loadReading` 在无会话时把状态置为 forbidden。原型以无权限态承载未登录 / 授权撤回分支，回跳地址与真实页一致。
- 切换状态副作用 → 离开正常态会关闭画质弹层、作废未完成的保存 / 同步 / 提交计时并恢复按钮，不出现延迟反馈；切回正常态保留当前段落、作答与待同步记录。
- 页头与导航 → 导航栏「分级阅读」（`pages.json` 标题）+ 返回（无历史时回 `home.html`，原型 `data-back="home.html"`），右上角设置 → `settings.html`；页内 kicker「阅读角」（`ZH_KICKERS`）、标题「翻开属于你的新一页。」、说明「选择适合的阅读难度，把好表达收入日常。」（`pages.b11-reading`）；不显示底部 TabBar。
- 文章信息与段落 → 顶部「授权文章 · 1 篇」与「画质 · 舒适」「动效」同排；文章卡显示 CEFR 级别、词数、预计时长（「B1 · 486 词 · 约 4 分钟」）与标题，不显示文章 ID 或内容版本号（真实页的 `内容版本` 行在本稿以「不泄露原始版本字符串」规则省略）；正文逐段呈现，英文下方固定显示「译文」与中文翻译（真实页 `blockTranslation` 有值即显示），并标注「第 n 段 · 共 3 段」；进度条同步「33% · 第 1 / 3 段」（`readingProgress` 按已读段落计算）。
- 上一段 / 下一段 → 切换段落时进度条、百分比与段号同步更新并隐藏已保存提示；第一段「上一段」、最后一段「下一段」为真实禁用态（surface 底、mut 字、虚线边框、not-allowed），点击不改变段落。
- 保存进度 → 主按钮「保存进度」（`b11.reading.save`）转圈「正在保存…」，段落切换按钮同时禁用防止重复提交 → 1s 后显示 ok 色单行 `role=status`「阅读进度已由服务端确认。」（`saveReadingPosition` 成功文案，不自造「阅读位置已保存」标题），提示保留到下一次切换段落或离开正常态，不弹 Toast；`?mock=save-error` 首次保存失败改为 warn 横幅「阅读位置未确认；最后位置已保留。」+「待同步 1」+「恢复同步」，阅读与理解题仍可继续。
- 恢复同步 → 待同步横幅「恢复同步」转圈「正在同步…」0.9s 后清除横幅并显示「待同步操作已由服务端确认。」（`syncOffline` 成功文案，不硬套保存语境）；`syncOffline` 失败时不静默覆盖本地位置，队列与本地进度保留。
- 版本失效 → `?mock=expired`（对齐 404 / 410 → `status='expired'`）：warn 横幅「播放授权已过期」（`b11.status.expired`，不另加说明句）；段落切换、保存、选项与「提交答案」全部真实禁用；「重试」转圈「正在读取…」0.9s 后横幅消失、功能恢复，不弹成功提示。
- 理解检查 → 题干 + 三个选项的单选组：点击后 brand 描边、soft 底、圆形标记填充，`aria-checked` 同步；未选择时「提交答案」为真实禁用态（surface 底、mut 字、虚线边框）；已作答的题目选项与按钮进入禁用态并保留已选标记，按钮文案改为「已提交」。
- 提交答案 → 转圈「正在提交…」→ 0.9s 后卡内出现 `role=status` 反馈块：答对为 ok 底「回答正确」，答错为 surface 底「服务端已记录本次练习」（对齐真实页 `attempt.correct` 分支，不显示 `feedbackCode`、不附加建议句），焦点移到反馈块；`?mock=answered-ok|answered-bad` 直接演示两种结果。
- 提交失败 / 离线提交 → `?mock=submit-error` 对齐 `submitReadingAnswer` 的 catch 分支：第 1 题卡内 bad 色 `role=alert`「理解题提交失败，答案仍保留。」，已选答案不变，再次提交可正常判分；`?mock=submit-offline` 对齐 `isB11OfflineError` 分支：卡内 warn 色「理解题答案已保留，服务端尚未判定。」，待同步横幅使用同一条离线提交文案（不复用「阅读位置未确认…」）并显示「待同步 1」，答案与当前段落保留，恢复同步后清除离线标记。
- 动效开关 → 顶部「关闭动效 / 开启动效」按钮（对齐 `B11StatusPanel` 的 `status.motionOff` / `status.motionOn`）切换文案，关闭后本页提示与进度过渡立即停止（`.is-motion-off`），不弹 Toast；`?mock=motion-off` 直接以关闭状态打开；不改动全局主题。
- 画质 → 顶部「画质 · 舒适」打开底部弹层，四档「精致 / 舒适 / 轻量 / 省资源」（`b11.status.quality*`），当前档带 brand 对勾与 `aria-pressed`；选择后更新顶部文案并关闭弹层，焦点回到画质按钮；遮罩、取消与 Esc 均可关闭（对齐 `B11StatusPanel` 的 picker）。
- 出口 → 无页尾出口：真实 `b11-reading.vue` 不含「学习报告」「单词复习」入口，原型不新增设计增量出口。
- 文案边界 → 不显示反馈代码、内容版本号、文章 ID 或原始状态枚举；待同步与失效状态同时用文字说明，不只依赖颜色。

### b3-listening（听力精练）

对应页面：`pages/b3-listening.html`；真实实现参照 `apps/mobile/src/pages/b3-listening/b3-listening.vue`、`apps/mobile/src/components/b2/B2StatusPanel.vue`、`apps/mobile/src/api/b3.ts` 的 `listListeningMaterials` / `createListeningSession` / `submitDictation`、`apps/mobile/src/domain/b3.ts` 的 `ListeningMaterial` / `TimelineSegment` / `DictationResult` 与 `packages/i18n/src/mobile-experience.ts` 的 `pages.b3-listening` 文案。真实页 `onMounted` 只校验登录、不发起真实读取，模板顶部固定显示 `data-closed-practice` 关闭说明（音频素材尚未上传到媒体库），材料模板分支在素材上线前不可达；原型默认演示该关闭态，并用 `?mock=` 预览上线后的模板分支。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|loading|empty|error|forbidden|offline` 直达页面状态；`?mock=ready|no-media|no-session|filled|ok|wrong|submit-error|submit-offline|degraded` 演示材料模板分支与提交结果。截图：`b3-listening-{light,dark}.png` 与 `b3-listening-{loading,empty,error,forbidden,offline,ready,no-media,no-session,filled,ok,wrong,submit-error,submit-offline,degraded}-{light,dark}.png`。
- 页面状态 → 工具条「正常 / 加载 / 空 / 错误 / 无权限 / 离线」：加载为「正在读取服务端数据」+ 骨架屏（`aria-busy`，取 `B2StatusPanel` 的 loading 标题）；空为「暂时没有可用的授权听力材料 / 没有使用本地样例填充页面。」+「重新读取」（对齐真实页空材料卡与 `status.empty` 默认说明）；错误为「服务端暂时不可用 / 听力服务暂时不可用，未使用本地音频样例。」+「重试」；无权限为「当前会话没有访问权限 / 登录后可以继续练习。」+ 单个「去登录」→ `login.html?returnTo=%2Fpages%2Fb3-listening%2Fb3-listening`（不提供重试）；离线为「网络暂时不可用 / 断点和待同步事件仍保留；待同步不等于已掌握。」（标题与默认说明均取 `B2StatusPanel` 的 offline 文案）+「重试」。切换离开正常态会关闭画质与速度弹层、停止模拟播放、取消未完成的读取 / 提交计时并恢复按钮。
- 状态恢复 → 空、错误与离线「重新读取 / 重试」转圈 → 1.1s 后回到正常态，不弹成功 Toast；无权限只保留「去登录」。
- 页头与导航 → 导航栏「听力精练」（`pages.json` 标题）+ 返回（`backMobile`：返回上一页；无历史时回 `home.html`，原型 `data-back="home.html"`），右上角设置 → `settings.html`；页内 kicker「用心听」、标题「慢一点，听清每一句。」、说明「分段聆听、循环回放，再写下听到的内容。」（`pages.b3-listening`）；不显示底部 TabBar（TabBar「练习」指向 `b2-practice.html`）。
- 关闭说明 → 对齐真实页 `data-closed-practice`：锁图标 +「听力」+「听力练习」+「即将开放」徽标 +「音频素材尚未上传到媒体库，播放地址无法签发；素材上线后即可在这里播放并听写。」+「回到可用学习」→ `today.html`；正常态默认显示该说明与下方状态条 / 空材料卡，带任一 `?mock=` 打开且材料存在时隐藏关闭说明。
- 状态条 → 等价 `B2StatusPanel`：idle / ready 为「服务状态 / 掌握与判分以服务端结果为准。」（面板默认文案），loading 为「正在读取服务端数据」，empty 为「当前没有可用内容 / 没有使用本地样例填充页面。」，error 为「服务端暂时不可用」，offline 为「网络暂时不可用 / 断点和待同步事件仍保留；待同步不等于已掌握。」（面板默认说明）；error 与 offline 同时出现「重试」。`?mock=no-session` 显示「听力会话尚未建立，答题不会伪造成功。」（真实页 `load` 分支）。
- 材料信息 → 顶部只保留右对齐的「画质 · 高清」（真实页没有材料计数）；材料卡显示 CEFR 级别、时长与段落（「B1 · 32 秒 · 第 1 段 / 共 3 段」）、标题、波形、逐句 token 与时间（`00:00` 格式）以及听写区；不显示媒体 ID、内容版本号或毫秒原始时间。
- 画质 → 点击「画质 · 高清」打开底部弹层，四档取 `B2StatusPanel` 的「极致 / 高清 / 标准 / 省电」，当前档带 brand 对勾与 `aria-pressed`；选择后更新顶部文案并关闭弹层，焦点回到画质按钮；遮罩、取消与 Esc 均可关闭。
- 播放 / 暂停 → 有授权播放地址时「播放」从当前位置推进波形进度与「00:00 / 00:32」，播放到末尾自动停止；「暂停」停在当前时间，不弹 Toast。`?mock=no-media` 时两个按钮使用 native disabled（surface 底、mut 字、透明实线边框、次按钮边框为 `var(--v2-line)` 实线、not-allowed，对齐 `shared.css` 的 `.btn:disabled`），说明改为「当前内容没有授权播放地址；波形、时间轴和听写可检查，但不会伪造播放。」。
- 播放速度 → 点击「1x」打开底部弹层，六档 0.5x / 0.75x / 1x / 1.25x / 1.5x / 2x（对齐真实页 `PLAYBACK_RATES`），当前档带 brand 对勾与 `aria-pressed`；选择后立即生效并关闭弹层，焦点回到速度按钮。`?mock=degraded` 显示「当前平台未声明音高保持能力；速度控制仍可用，已记录降级。」（对齐 `enableUniAudioPitchPreservation` 的降级回调文案）。
- 听写提交 → 输入为空或听力会话未建立时点击「提交听写」，状态条说明改为「请先读取真实听力会话并填写听写答案。」（真实页 `submit` 守卫），不伪造判分；正常提交转圈「正在提交…」→ 0.9s 后出现结果块：答对为 ok 底「得分 92 / 服务端判定正确。」，答错为 bad 底「得分 64 / 服务端已记录本次错题，可按反馈复习。」，状态条同步为对应服务端文案，焦点移到结果块。原型以答案是否包含「coffee cart」模拟规则判分，不显示 `feedbackCodes`。
- 提交失败 / 离线 → `?mock=submit-error` 带参数打开即显示提交失败后的状态条 error「服务端暂时不可用 / 听写提交失败，答案仍保留在当前页面。」；`?mock=submit-offline` 显示 offline「网络暂时不可用 / 断点和待同步事件仍保留；待同步不等于已掌握。」（对齐 `isB3OfflineError` 的 offline 状态，说明用 `B2StatusPanel` 默认文案）；两种情况下已输入的答案与材料卡都保留，点状态条「重试」重新读取材料（清空听写与结果），再次提交可正常判分。
- 暂无材料 / 重新读取 → 正常态没有材料时显示真实页空材料卡「暂无材料 / 暂时没有可用的授权听力材料。」+「重新读取」；点击转圈「正在读取…」1.1s 后重新渲染：有材料则显示材料卡，没有材料则状态条转为「当前没有可用内容」，不弹 Toast。
- 登录门禁 → 对齐真实页 `onMounted`：先 `session.restore()`，未登录直接跳转 `login.html?returnTo=%2Fpages%2Fb3-listening%2Fb3-listening`，不渲染听力内容；原型以无权限态承载该分支，登录页回跳地址与真实页一致。
- 文案边界 → 不显示反馈代码、内容版本号、媒体 ID 或原始状态枚举；时间统一为 `00:00` 格式，CEFR 级别只作小字标识；播放与禁用状态同时用文字说明，不只依赖颜色。真实页没有页尾出口，本稿不新增「学习报告」「单词复习」入口。

### b11-listening（听力与 Language Clips）

对应页面：`pages/b11-listening.html`；真实实现参照 `apps/mobile/src/pages/b11-listening/b11-listening.vue`、`apps/mobile/src/stores/b11-learning.ts`（`loadListening` / `setPlaybackRate` / `setABPoint` / `clearAB` / `selectLanguageClip` / `saveMediaProgress` / `submitDictationAnswer` / `syncOffline`）、`apps/mobile/src/components/b11/B11StatusPanel.vue`、`apps/mobile/src/api/b11.ts` 的听力接口、`apps/mobile/src/platform/b11-foundation.ts` 的 `b11.status` / `b11.listening` / `b11.common` 文案与 `packages/i18n/src/mobile-experience.ts` 的 `pages.b11-listening` 文案。真实页 `onMounted` 为 `closed practice: no live load`，模板顶部固定显示 `data-closed-practice` 关闭说明（音频素材尚未上传到媒体库），材料模板分支在素材上线前不可达；原型默认演示该关闭态，并用 `?mock=` 预览上线后的模板分支。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|loading|empty|error|forbidden|offline` 直达页面状态；`?mock=ready|empty|no-media|revoked|expired|queued|ab|clip|filled|ok|wrong|submit-error|submit-offline|save-error|degraded|motion-off` 演示材料模板与操作结果（`mock=empty` 为正常态内的空面板；`save-error` 需在页面内点「保存播放进度」观察首次失败）。截图：`b11-listening-{light,dark}.png` 与 `b11-listening-{loading,empty,error,forbidden,offline,ready,no-media,revoked,expired,queued,ab,clip,filled,ok,wrong,submit-error,submit-offline,degraded,motion-off}-{light,dark}.png`。
- 页面状态 → 工具条「正常 / 加载 / 空 / 错误 / 无权限 / 离线」：加载为 `role=status`「正在加载内容」+ 骨架屏（`aria-busy`，取 `b11.status.loading`）；空为「当前没有可用内容 / 内容准备好后会在这里显示。」+「重试」（`b11.status.empty` + `b11.common.noSample`）；错误为「服务暂时不可用 / 听力服务暂时不可用；本地进度仍会保留。」+「重试」（`b11.status.error` + `loadListening` catch 兜底说明）；无权限为「当前会话没有访问权限 / 登录后可以继续听力练习。」+ 唯一「去登录」→ `login.html?returnTo=%2Fpages%2Fb11-listening%2Fb11-listening`，不提供重试；离线为「暂时无法连接服务 / 网络暂时不可用；当前页面和待同步队列仍保留。」（`b11.status.offline` + `b11ErrorText` 网络分支）+「重试」+ 待同步队列行「待同步 1 / 播放进度 · 等待联网后提交」+「恢复同步」。
- 状态恢复 → 空、错误与离线「重试」转圈「正在读取…／正在重试…」→ 1.1s 后回到正常态，不弹成功 Toast；离线队列「恢复同步」转圈「正在同步…」→ 1.1s 后回到正常态、清空队列并显示「待同步操作已由服务端确认。」（`syncOffline` 成功文案）；无权限只保留「去登录」。
- 页头与导航 → 导航栏「听力与 Language Clips」（`pages.json` 标题）+ 返回（`backMobile` 语义，无历史时回 `home.html`，原型 `data-back="home.html"`），右上角设置 → `settings.html`；页内 kicker「听力室」（`ZH_KICKERS`）、标题「听见更大的世界。」、说明「逐句精听、循环片段，让耳朵慢慢熟悉语言。」（`pages.b11-listening`）；不显示底部 TabBar。
- 关闭说明 → 对齐真实页 `data-closed-practice`：锁图标 +「听力」+「听力练习」+「即将开放」徽标 +「音频素材尚未上传到媒体库，播放地址无法签发；素材上线后即可在这里播放并听写。」+「回到可用学习」→ `today.html`；正常态默认显示关闭说明与状态面板，带任一 `?mock=` 打开时隐藏关闭说明并渲染材料模板；切换页面状态时始终不显示该说明，避免与空 / 错误态叠加。
- 状态面板 → 等价 `B11StatusPanel`：idle「正在准备内容」、loading「正在加载内容」、ready「内容已就绪」（只保留画质、动效与临时提示行，不再套空卡片）、empty「当前没有可用内容」、offline「暂时无法连接服务」、forbidden「当前会话没有访问权限」、expired「播放授权已过期」、recovering「正在保留本地进度 / 联网后可重试。」、error「服务暂时不可用」；empty / offline / forbidden / expired / error 带「重试」，有队列时同时显示「待同步 n」+「恢复同步」。ready 下的面板消息承载播放授权提示、片段切换提示与同步结果，不重复听写判分。
- 材料信息 → 顶部状态面板下为材料卡：eyebrow 「听力」（对齐 `b11-foundation` 的 `listening.eyebrow`；真实页 kicker 直接复用 `material.title`，不自造分区名）、英文标题、CEFR 级别、时长与段号（「B1 · 2 分 24 秒 · 第 1 段 / 共 4 段」）与中文授权徽标（授权有效 / 已过期 / 已撤销）；不显示媒体 ID、内容版本号或原始状态枚举（真实页 `内容版本` 行按不泄露原始版本字符串规则省略）。
- 画质 → 状态面板「画质：舒适」打开底部弹层，四档「精致 / 舒适 / 轻量 / 省资源」（`b11.status.quality*`），当前档带 brand 对勾与 `aria-pressed`；选择后更新面板文案并关闭弹层，焦点回到画质按钮；选「省资源」时波形切换为静态时间轴。遮罩、取消与 Esc 均可关闭。
- 动效 → 状态面板「关闭动效 / 开启动效」（`b11.status.motionOff` / `status.motionOn`）切换文案与 `.is-motion-off`；关闭后波形改为「静态时间轴 / 已关闭波形动效，播放与进度仍然可用。」，进度过渡停止，播放与 A-B 循环仍可用；`?mock=motion-off` 直接以关闭状态打开；不改动全局主题。
- 播放 / 暂停 → 有授权播放地址时「播放」从当前位置推进波形与「00:00 / 02:24 · 0%」，播放到末尾自动停止；「暂停」停在当前时间，不弹 Toast。`?mock=no-media`、`?mock=revoked`、`?mock=expired` 时播放、暂停、速度、A/B 与「保存播放进度」进入真实禁用态（surface 底、mut 字、无阴影、not-allowed），说明分别改为「当前内容没有授权播放地址；保留字幕与练习，未伪造音频。」「媒体权益已撤销，不能继续播放。」「播放授权已过期；重新读取后可再次授权。」。
- A-B 循环 → 「设为 A 点 / 设为 B 点」（`b11.listening.setA` / `setB`）以当前位置打点，行内显示「A 00:08 · B 00:16 · 仅在 A、B 都有效时循环。」；只设一点时另一端显示「—」；两点都有效且播放越过 B 点时回到 A 点；「清除 A-B」（`listening.clearAB`）在任一点存在时出现，点击后隐藏说明行；时间统一 `00:00` 格式，不显示毫秒。
- 播放速度 → 点击「1x」打开底部弹层，六档 0.5x / 0.75x / 1x / 1.25x / 1.5x / 2x（对齐真实页 `PLAYBACK_RATES`），当前档带 brand 对勾与 `aria-pressed`；选择后立即生效并关闭弹层，焦点回到速度按钮。`?mock=degraded` 显示「当前平台未声明音高保持能力；速度控制仍可用，已记录降级。」（`enableUniAudioPitchPreservation` 降级回调）。
- Language Clips → 片段横向滚动，显示标题与时间范围（「Ordering coffee · 00:08–00:16」）；点击后 chip 变为 brand 描边与 soft 底、`aria-pressed` 同步，面板提示「已切换 Language Clip；播放地址仍需权益清单确认。」（真实页 `selectClip` 文案），不自动跳转播放位置。
- 字幕 / 音变时间轴 → 逐句 token 双列展示英文与 `00:00–00:00` 时间；进入页面即渲染，不依赖播放状态；播放与字幕不伪造未授权的音频。
- 听写提交 → 听写卡 eyebrow 为「听写答案」（`b11.listening.dictation`，不另设字段 label），输入框 placeholder「输入你听到的句子」；未填写答案时点击「提交听写」，听写卡内出现 bad 色「请先读取真实听力会话并填写听写答案。」（`submitDictationAnswer` 守卫）并聚焦输入框；正常提交转圈「正在提交…」→ 0.9s 后出现结果块：答对为 ok 底「规则判定正确」、答错为 bad 底「已记录错题」，第二行固定「已保存」（真实页 `feedbackCodes.join(' · ') || '已保存'` 的回退文案），焦点移到结果块。原型以答案是否包含「coffee」模拟规则判分，不展示 `feedbackCodes`。
- 提交失败 / 离线提交 → `?mock=submit-error` 对齐 `submitDictationAnswer` catch 兜底：卡内 bad 色「听写提交失败，答案仍保留在当前页面。」，答案不变，再次提交可正常判分；`?mock=submit-offline` 对齐 `isB11OfflineError` 分支：卡内 warn 色「听写答案已保留到待同步队列，服务端尚未判定。」，状态面板同步为「暂时无法连接服务」并显示「待同步 1」+「恢复同步」，答案与材料保留；同步后清除离线标记，可再次提交。
- 保存播放进度 → 有授权播放地址时启用；点击转圈「正在保存…」→ 1s 后显示 ok 提示「播放进度已由服务端确认。」（`saveMediaProgress` 成功文案），不弹 Toast；`?mock=save-error` 首次保存失败改为状态面板 recovering「正在保留本地进度 / 进度未确认；联网后可恢复。」+「待同步 1」+「恢复同步」，位置仍在页面保留，同步成功后恢复 ready 并提示「待同步操作已由服务端确认。」。
- 授权失效 → `?mock=expired`（404 / 410 → `expired`）：面板「播放授权已过期」+「重试」，播放相关按钮禁用；「重试」1.1s 后重新获得授权、恢复可播放。`?mock=revoked`（`rightsStatus === 'REVOKED'`）：面板 forbidden「当前会话没有访问权限 / 当前媒体权益已撤销，字幕与历史进度不会伪造为可播放。」，字幕与听写仍可查看，播放相关按钮禁用。
- 登录门禁 → 对齐真实页 `load`：先 `session.restore()`，未登录跳转登录页、不渲染听力内容；原型以无权限态承载该分支，回跳地址与其它 b11 页面一致。
- 切换状态副作用 → 离开正常态会关闭画质与速度弹层、停止模拟播放、作废未完成的读取 / 同步 / 保存 / 提交计时并恢复按钮；切回正常态保留当前位置、A-B、片段与听写内容。
- 文案边界 → 不显示反馈代码、内容版本号、媒体 ID 或原始状态枚举；授权状态同时用中文徽标与文字说明，不只依赖颜色。真实页没有页尾出口，本稿不新增「学习报告」「单词复习」入口。

### b3-speaking（口语与音标）

对应页面：`pages/b3-speaking.html`；真实实现参照 `apps/mobile/src/pages/b3-speaking/b3-speaking.vue`、`apps/mobile/src/components/b2/B2StatusPanel.vue`、`apps/mobile/src/api/b3.ts` 的 `getPhonetics` / `listListeningMaterials` / `createRecording` / `deleteRecording` / `submitSelfRating` / `createRoleplaySession` / `submitRoleplayTurn`、`apps/mobile/src/domain/b3.ts` 的 `Phoneme` / `MouthProfile` / `SpeakingRecording` / `RoleplaySession`、`apps/mobile/src/platform/uni-runtime.ts` 的录音 / 安全存储适配器与 `packages/i18n/src/mobile-experience.ts` 的 `pages.b3-speaking` 文案。真实页 `onMounted` 只校验登录（`closed practice: no live load`），模板顶部固定显示 `data-closed-practice` 关闭说明（录音上传与发音评分尚未接入），音标 / 录音 / 角色扮演模板分支在服务接入前不可达；原型默认演示该关闭态，并用 `?mock=` 预览上线后的模板分支。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|loading|empty|error|forbidden|offline` 直达页面状态；`?mock=ready|no-audio|revoked|degraded|recording|recorded|saved|roleplay|roleplay-done|register-error|record-error` 演示模板分支与操作结果（`record-error` 需在页面内点「开始录音」触发）。截图：`b3-speaking-{light,dark}.png` 与 `b3-speaking-{loading,empty,error,forbidden,offline,ready,no-audio,revoked,degraded,recording,recorded,saved,roleplay,roleplay-done,register-error,record-error}-{light,dark}.png`。
- 页面状态 → 工具条「正常 / 加载 / 空 / 错误 / 无权限 / 离线」：加载为「正在读取服务端数据」+ 音标与口型骨架屏（`aria-busy`，取 `B2StatusPanel` 的 loading 标题）；空为「暂时没有可用的音标内容 / 音标目录未返回完整的 48 项内容。」+「重新读取」（对齐真实页 `load` 的 48 项校验与 `status.empty`）；错误为「服务端暂时不可用 / 音标服务暂时不可用，未使用本地假数据。」+「重试」；无权限为「当前会话没有访问权限 / 登录后可以继续口语练习。」+ 单个「去登录」→ `login.html?returnTo=%2Fpages%2Fb3-speaking%2Fb3-speaking`（不提供重试）；离线为「网络暂时不可用 / 断点和待同步事件仍保留；待同步不等于已掌握。」（`B2StatusPanel` 默认文案）+「重试」。切换离开正常态会关闭画质与删除弹层、停止模拟录音与所有计时并恢复按钮。
- 状态恢复 → 空、错误与离线「重新读取 / 重试」转圈 → 1.1s 后回到正常态，不弹成功 Toast；无权限只保留「去登录」。
- 页头与导航 → 导航栏「口语与音标」（`pages.json` 标题）+ 返回（`backMobile`：返回上一页；无历史时回 `home.html`，原型 `data-back="home.html"`），右上角设置 → `settings.html`；页内 kicker「自信开口」（`ZH_KICKERS`）、标题「开口，就是新的开始。」、说明「学习发音、录下声音，在回听中找到自己的进步。」（`pages.b3-speaking`）；不显示底部 TabBar（TabBar「练习」指向 `b2-practice.html`）。
- 关闭说明 → 对齐真实页 `data-closed-practice`：锁图标 +「口语」+「跟读练习」+「即将开放」徽标 +「跟读需要录音上传和发音评分服务，目前尚未接入，无法给出真实评分。」+「回到可用学习」→ `today.html`；默认打开即显示关闭说明与状态条，带任一 `?mock=` 打开时隐藏关闭说明并渲染模板分支。
- 状态条 → 等价 `B2StatusPanel`：idle / ready 为「服务状态 / 掌握与判分以服务端结果为准。」，loading 为「正在读取服务端数据」，empty 为「当前没有可用内容 / 没有使用本地样例填充页面。」，error 为「服务端暂时不可用」，offline 为「网络暂时不可用 / 断点和待同步事件仍保留；待同步不等于已掌握。」；error 与 offline 同时出现「重试」。录音失败的 error 分支显示「录音失败，未生成虚假的评测结果。」（真实页 `onError` 文案）。
- 音标目录 → 小字「共 48 个 · 点选后查看口型与示例词」；四列可点按钮展示 48 个音标（元音 / 双元音 / 辅音连续排列，不另设分组标题，对齐真实页单一 `phoneme-grid`），选中项 brand 描边 + soft 底 + `aria-pressed`，同时更新口型卡片的音标、示例词、唇形说明与「下颌 / 舌高 / 唇圆 / 声带」数值；不显示内部 phonemeId 或 mouthProfile 版本号。
- 口型示意 → 录音卡内 2D 口型图按所选音标的下颌开合、舌位高低与唇圆度变化，右侧同时用文字给出同样的数值与「声带振动 / 清音」，不只依赖图形或颜色；明确标注「2D 口型示意 · 不加载 3D 解剖」。
- 示范音频 → 有短时授权时显示「播放示范音频」，点击转圈「正在播放…」→ 1.5s 后显示 ok 色「示范音频播放完毕，可以开始跟读。」；`?mock=no-audio` 隐藏播放按钮并显示 warn 色「示范音频当前没有可播放授权地址；已降级为文本脚本和 2D 口型。」；`?mock=revoked` 为「示范音频权益已撤销；已降级为文本脚本和 2D 口型。」；`?mock=degraded` 保留按钮，点击后显示「示范音频当前无法播放；已降级为文本脚本和 2D 口型。」（对齐真实页 `playDemoAudio` catch）。示范句始终以文本给出，不伪造音频状态。
- 录音 → 「开始录音」进入录音态：按钮变「停止录音」、文案显示红点 +「录音进行中… 00:07 / 最长 60 秒」，计时到 60 秒自动停止；停止后显示「录音文件已返回，点击“加密并登记”前会先计算真实 SHA-256。」并启用「加密并登记」；录音中「安全回放」「加密并登记」「删除录音」为真实禁用态（surface 底、mut 字、实线边框、not-allowed，复用 `.btn:disabled`，不使用虚线）。`?mock=recording` 直接以录音中状态打开，`?mock=recorded` 以已录音待登记状态打开，`?mock=record-error` 点「开始录音」后状态条转 error「录音失败，未生成虚假的评测结果。」。
- 加密并登记 → 已录音且时长不少于 500ms 时点击，按钮转圈「正在加密…」→ 0.9s 后显示 ok 色「录音已由 Keychain/Keystore 适配器加密；服务端只登记哈希和生命周期元数据。」，出现「已登记 · 时长 7 秒 · 自评：未选择」与「删除录音」；时长不足时显示 warn 色「请先完成至少 500ms 的真实录音。」；`?mock=register-error` 以 bad 色「录音加密或登记失败，未标记为成功。」打开，录音仍保留，可再次登记并成功。
- 安全回放 / 自评 → 「安全回放」仅在已登记后可用，点击转圈「正在解密…」→ 0.7s 后显示 ok 色「安全回放已开始；音频只在本机内存中解密。」；三个自评 chip 单选（需要练习 / 基本准确 / 比较流利）；未登记时点击显示 warn 色「请先登记一次真实录音，再提交自评。」，登记后点击保存并显示「自评已保存：基本准确。Phase 1 不生成 AI 分数。」。<code>?mock=saved</code> 以已登记 + 基本准确打开。
- 删除录音 → 已登记时出现「删除录音」→ 打开确认对话框「删除这段录音？/ 录音和本机加密文件会一并清理，学习记录不受影响。」（危险按钮 bad 色）；取消 / 遮罩 / Esc 关闭，确认后清理已登记状态、回放与删除按钮、自评与摘要，并 Toast「录音已删除，原生加密文件已请求清理。」（对齐真实页 `removeRecording`）。
- 角色扮演 → 「开始角色扮演」转圈「正在打开…」→ 0.9s 后显示「预编角色扮演已打开；分支和回合由服务端脚本控制。」与第 1 回合（回合 1 / 共 4 · 店员）；每次选择后提示「回合已保存，继续下一步。」并进入下一回合；第 2 回合带「本回合需要先登记一次真实录音。」，未登记时选择显示 warn 色「当前回合需要先完成并登记真实录音。」；第 4 回合后隐藏回合卡，显示 ok 色「已完成全部预编回合；无 AI 评分。」（对齐真实页完成文案），开始按钮变为「重新打开咖啡店场景」。选择按钮只显示中文意图，不显示内部 choiceCode；不可选时按次按钮禁用态呈现（surface 底、mut 字、`var(--v2-line)` 实线边框、not-allowed），不使用虚线。`?mock=roleplay` 直接打开第 2 回合，`?mock=roleplay-done` 直接打开完成状态。
- 画质 → 点击「画质 · 高清」打开底部弹层，四档取 `B2StatusPanel` 的「极致 / 高清 / 标准 / 省电」，当前档带 brand 对勾与 `aria-pressed`；选择后更新顶部文案并关闭弹层，焦点回到画质按钮；遮罩、取消与 Esc 均可关闭。
- 登录门禁 → 对齐真实页 `onMounted`：先 `session.restore()`，未登录直接跳转 `login.html?returnTo=%2Fpages%2Fb3-speaking%2Fb3-speaking`，不渲染口语内容；原型以无权限态承载该分支，登录页回跳地址与真实页一致。
- 文案边界 → 不显示内部错误码、反馈代码、录音 ID、内容版本号或原始状态枚举；时长统一「7 秒 / 0.5 秒」中文写法；Phase 1 的发音评分与角色扮演均明确「不生成 AI 分数」，不把自评写成自动评分。真实页没有页尾出口，本稿不新增「学习报告」「单词复习」入口。

### b11-speaking（音标与影子跟读）

对应页面：`pages/b11-speaking.html`；真实实现参照 `apps/mobile/src/pages/b11-speaking/b11-speaking.vue`、`apps/mobile/src/components/b11/B11StatusPanel.vue`、`apps/mobile/src/platform/b11-foundation.ts` 的 `speaking.*` 文案、`apps/mobile/src/platform/b11-recording.ts` 的录音 / 加密适配器、`apps/mobile/src/stores/b11-learning.ts` 的 `loadPhonetics` / `registerRecordingDraft` / `saveSelfRating` / `completeShadowing` / `syncOffline` 与 `apps/mobile/src/domain/b3.ts` 的 `Phoneme` / `MouthProfile`。真实页 `onMounted` 为空（`closed practice: no live load`），模板顶部固定显示 `data-closed-practice` 关闭说明（录音上传与发音评分服务尚未接入）；音标、示范音频与录音模板分支在服务接入前不可达，原型默认演示关闭态，并用 `?mock=` 预览模板分支与操作结果。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|loading|empty|error|forbidden|offline` 直达页面状态；`?mock=ready|no-demo|revoked|demo-error|degraded|expired|denied|recording|recorded|saved|rated|shadowing|register-error|register-offline|queued` 演示模板分支与操作结果。截图：`b11-speaking-{light,dark}.png` 与 `b11-speaking-{loading,empty,error,forbidden,offline,ready,recording,recorded,saved,denied,rated,shadowing,register-error,register-offline,queued,no-demo,revoked,demo-error,degraded,expired}-{light,dark}.png`（`?mock=recording`、`rated`、`shadowing`、`register-offline`、`queued` 等分支按本行 `?mock=` 取值以 `?theme=light|dark` 各拍一张）。
- 页面状态 → 工具条「正常 / 加载 / 空 / 错误 / 无权限 / 离线」：加载为「正在加载内容」+ 音标与录音骨架屏（`aria-busy`，取 `b11.status.loading`）；空为「当前没有可用内容 / 服务端未返回音标目录。」+「重试」（`b11.status.empty` + `loadPhonetics` 的空目录文案）；错误为「服务暂时不可用 / 音标服务暂时不可用；录音草稿仍保留。」+「重试」；无权限为「当前会话没有访问权限 / 登录后可以继续音标与跟读练习。」+ 单个「去登录」→ `login.html?returnTo=%2Fpages%2Fb11-speaking%2Fb11-speaking`；离线为「暂时无法连接服务 / 网络暂时不可用；录音与待同步记录仍保留。」+「重试」+「待同步 1 / 录音练习记录 · 等待联网后提交」+「恢复同步」。切换离开正常态会关闭画质与删除弹层、停止录音计时并恢复按钮。
- 状态恢复 → 空、错误、离线「重试」转圈「正在读取…／正在重试…」→ 1.1s 后回到正常态，不弹成功 Toast；无权限只保留「去登录」。
- 页头与导航 → 导航栏「音标与影子跟读」（`pages.json` 标题）+ 返回（无历史时回 `home.html`，原型 `data-back="home.html"`），右上角设置 → `settings.html`；页内 kicker「找到你的声音」（`ZH_KICKERS`）、标题「让表达，更从容一点。」、说明「听示范、练跟读、做自评，每次开口都是积累。」（`pages.b11-speaking`）；不显示底部 TabBar。
- 关闭说明 → 对齐真实页 `data-closed-practice`：锁图标 +「口语」+「跟读练习」+「即将开放」徽标 +「跟读需要录音上传和发音评分服务，目前尚未接入，无法给出真实评分。」+「回到可用学习」→ `today.html`；默认打开即显示关闭说明与状态条，带任一 `?mock=` 打开时隐藏关闭说明并渲染模板分支。
- 卡片标题 → 示范音频卡的 eyebrow 与标题都取真实页「示范音频」；录音卡的 eyebrow 与标题都取「录音与影子跟读」。不自行改写卡片内文案，也不把页面级 `speaking.eyebrow`（发音与跟读）套到录音卡上。
- 状态条 → 等价 `B11StatusPanel`：idle「正在准备内容」、loading「正在加载内容」、ready「内容已就绪」（只保留画质、动效与临时提示行）、empty「当前没有可用内容」、offline「暂时无法连接服务」、forbidden「当前会话没有访问权限」、expired「播放授权已过期」（只显示标题，不追加自造说明）、recovering「正在保留本地进度 / 联网后可重试。」、error「服务暂时不可用」；empty / offline / expired / error 带「重试」，forbidden 不带「重试」（`canRetry` 不含 forbidden），有队列时同时显示「待同步 n」+「恢复同步」。录音与登记的结果改在录音卡内就地反馈，状态条不重复展示。
- 画质与动效 → 「画质：舒适」打开底部弹层，四档「精致 / 舒适 / 轻量 / 省资源」（`b11.status.quality*`），当前档带 brand 对勾与 `aria-pressed`；选择后更新文案并关闭弹层，焦点回到按钮。「关闭动效 / 开启动效」（`status.motionOff` / `motionOn`）切换 `.is-motion-off`，录音红点停止脉动，录音与回放仍可用；不改动全局主题。
- 音标目录 → 标题「英语音标 · 发音图解」，小字「48 / 48 · 练习方式：回听与自评」（`speaking.aiOff`，不使用「AI 评分」字样）；右上角麦克风权限标记「未申请 / 申请中 / 已允许 / 已拒绝 / 不可用」，文字与颜色同时表达。四列可点按钮展示 48 个音标（音标、示例词、元音 / 双元音 / 辅音），选中项 brand 描边 + soft 底 + `aria-pressed`，并同步更新口型卡片。不显示内部音标 ID 或口型配置版本号。
- 口型示意 → 录音卡内 2D 口型图按所选音标的下颌开合、舌位高低、舌位后移与唇圆度变化，右侧同时给出「下颌 / 舌高 / 舌后 / 唇圆」数值与「声带振动 / 清音」，不只依赖图形或颜色；明确标注「2D 口型示意 · 不加载 3D 解剖」。
- 示范音频 → 有短时授权时显示「播放示范音频」，点击转圈「正在播放…」→ 1.2s 后显示 ok 色「示范音频播放完毕，可以开始跟读。」；`?mock=no-demo` 隐藏按钮并显示「暂无可用的跟读片段。」；`?mock=revoked` 显示 warn 色「示范音频已下线。」；`?mock=demo-error` 显示 warn 色「示范音频暂时无法加载。」；`?mock=degraded` 保留按钮，打开即显示 warn 色「示范音频当前无法播放；已降级为文本脚本和 2D 口型。」，再点播放仍给同提示（对齐真实页 `playDemoAudio` catch）；`?mock=expired` 状态条与示范音频行均只显示「播放授权已过期」，状态条带「重试」，重试后恢复可播放。无授权播放地址时录音不可用，录音说明为「暂无可练习的跟读片段。」，不伪造音频。
- 麦克风权限 → 「请求麦克风权限」在无可练习片段时禁用；点击转圈「正在申请…」→ 1.1s 后标记变「已允许」，说明变「麦克风权限已获得；点击开始录音后才会采集声音。」，按钮变为禁用态「麦克风已允许」；`?mock=denied` 以「已拒绝」打开，说明「无需麦克风也能学习音标。」，录音按钮禁用。
- 录音 → 仅在权限已允许且有可练习片段时可用。「开始录音」进入录音态：按钮变「停止录音」、说明显示红点 +「正在录音… 00:07 / 最长 60 秒」，计时到 60 秒自动停止；停止后不足 0.3 秒提示 warn 色「录音太短，请重试。」，否则生成本地录音并提示「录音已保存在此设备，练习记录尚未保存。」（`speaking.localOnly`），保存按钮启用。录音中「本地回放」「重新录音」「保存练习记录」「自评」为真实禁用态（surface 底、mut 字、无阴影、not-allowed）。`?mock=recording` 直接以录音中状态打开，`?mock=recorded` 以已录音未保存状态打开。
- 本地回放 / 重新录音 → 「本地回放」需要已有本地录音，点击转圈「正在解密…」→ 0.7s 后提示「本地回放已开始；音频只在本机内存中解密。」；「重新录音」清理本地录音与自评并提示「已清理当前本地录音，可重新录制。」，不自动开始录音。
- 保存练习记录 → 有本地录音时可用，点击转圈「正在保存…」→ 0.9s 后提示 ok 色「练习记录已保存，录音留在此设备。」，录音状态卡改为「练习记录已保存，录音留在此设备。」并出现「删除录音记录」；`?mock=register-error` 首次保存失败：录音卡内 bad 色「录音未登记；本地副本仍保留。」，本地录音仍可再次保存；`?mock=register-offline` 首次保存转为离线：状态条「暂时无法连接服务」+「待同步 1」+「恢复同步」，录音卡内 warn 色「录音已保存在此设备，联网后重试保存练习记录。」，同步后提示「待同步操作已由服务端确认。」。
- 自评 → 四个 chip 单选「需要练习 / 基本准确 / 比较流利 / 不确定」（对齐真实页 `ratingOptions`），未录音时禁用；已录音但未登记录音时选择提示 warn 色「自评已保留，待录音登记后同步。」；已登记时提示 ok 色「自评已保存。」；未录音时 chip 为原生禁用（`disabled`，surface 底、mut 字、not-allowed），不弹提示。`?mock=rated` 以「基本准确」已选打开。
- 完成影子跟读 → 已登记录音后可用，点击转圈「正在记录…」→ 0.8s 后提示 ok 色「跟读练习已记录。」；未登记时提示 warn 色「请先由服务端登记录音，再完成影子跟读。」（真实页守卫文案）。`?mock=shadowing` 打开即显示完成反馈。
- 删除录音记录 → 录音状态卡「删除录音记录」（危险样式）打开确认对话框「删除这次录音记录？/ 录音仍留在本设备；服务端登记会被删除，学习记录不受影响。」；取消 / 遮罩 / Esc 关闭，确认后清理录音、自评与跟读状态，录音状态卡隐藏，并 Toast「服务端已确认删除录音登记。」（对齐真实页 `removeSavedRecording`）。
- 待同步 → 状态条「待同步 1」+「恢复同步」点击后转圈「正在同步…」→ 1.1s 后队列清空、状态条回「内容已就绪」并提示「待同步操作已由服务端确认。」；离线页的「恢复同步」同样回到正常态。
- 登录门禁 → 对齐真实页 `load`：先 `session.restore()`，未登录跳转登录页、不渲染音标内容；原型以无权限态承载该分支，回跳地址与真实页一致。
- 切换状态副作用 → 离开正常态会关闭画质与删除弹层、停止模拟录音与所有计时、作废未完成的申请 / 播放 / 保存 / 同步计时并恢复按钮；切回正常态保留已选音标、录音与自评。
- 文案边界 → 不显示内部错误码、录音 ID、内容版本号或原始状态枚举；时长统一「7.4 秒 / 0.3 秒」中文写法；Phase 1 的跟读与自评明确「不生成 AI 分数」，不把自评写成自动评分。真实页没有页尾出口，本稿不新增「学习报告」「单词复习」入口。

### b3-writing（写作练习）

对应页面：`pages/b3-writing.html`；真实实现参照 `apps/mobile/src/pages/b3-writing/b3-writing.vue`、`apps/mobile/src/components/b10/B10StatusPanel.vue`、`apps/mobile/src/components/b10/B10FeedbackCard.vue`、`apps/mobile/src/domain/b10.ts` 的 `B10WritingPrompt` / `B10RuleFeedback`、`apps/mobile/src/api/b10.ts` 的 `listWritingPrompts` / `submitWriting` / `submitCorrection` / `b10ErrorInfo`、`apps/mobile/src/platform/b10-foundation.ts` 的 `writing.*` / `status.*` 文案与 `packages/i18n/src/mobile-experience.ts` 的 `pages.b3-writing` 文案。真实页 `onMounted` 只校验登录（`closed practice: no live load`），模板顶部固定显示 `data-closed-practice` 关闭说明（作文批改服务尚未接入），题目 / 草稿 / 反馈模板分支在服务接入前不可达；原型默认演示该关闭态，并用 `?mock=` 预览上线后的模板分支与操作结果。

- 主题与直达参数 → 工具条「浅色 / 深色」切换整页 token 并写入 `localStorage['uispec-theme']`；`?theme=light|dark` 固定主题；`?state=normal|loading|empty|error|forbidden|offline` 直达页面状态；`?mock=ready|filled|ok|bad|correction|feedback-stale|submit-error|submit-offline|draft-error|empty` 演示题目模板分支与提交结果。截图：`b3-writing-{light,dark}.png` 与 `b3-writing-{loading,empty,error,forbidden,offline,ready,filled,ok,bad,correction,feedback-stale,submit-error,submit-offline,draft-error}-{light,dark}.png`（页面状态用 `?state=`、模板分支用 `?mock=`，均以 `?theme=light|dark` 各拍一张；`?mock=empty` 的页面内空题目卡与页面级空态共用 `b3-writing-empty` 截图）。
- 页面状态 → 工具条「正常 / 加载 / 空 / 错误 / 无权限 / 离线」：加载为「正在加载学习内容」+ 题目与输入框骨架屏（`aria-busy`）；空为「暂时没有可用写作题。 / 内容准备好后会在这里显示。」（`writing.noPrompt` / `status.noSample`）+「重试」；错误为「服务暂时不可用 / 写作服务暂时不可用。」+「重试」；无权限为「当前会话没有访问权限 / 内容准备好后会在这里显示。」（说明取 `status.noSample`）+ 单个「去登录」→ `login.html?returnTo=%2Fpages%2Fb3-writing%2Fb3-writing`（不提供重试）；离线为「网络暂时不可用 / 待同步不等于已结算。」（`status.pending`）+「重试」。切换离开正常态会关闭题目与画质弹层、取消未完成的自动保存 / 读取 / 提交计时并恢复按钮。
- 状态恢复 → 空、错误与离线「重试」转圈 → 1.1s 后回到正常态，不弹成功 Toast；无权限只保留「去登录」。
- 页头与导航 → 导航栏「写作练习」（`pages.json` 标题）+ 返回（`backMobile`：返回上一页；无历史时回 `home.html`，原型 `data-back="home.html"`），右上角设置 → `settings.html`；页内 kicker「写作台」（`ZH_KICKERS`）、标题「把想法，写成文字。」、说明「从一句话开始，在修改中找到更清晰的表达。」（`pages.b3-writing`）；不显示底部 TabBar（TabBar「练习」指向 `b2-practice.html`）。
- 关闭说明 → 对齐真实页 `data-closed-practice`：锁图标 +「写作」+「写作练习」+「即将开放」徽标 +「作文批改服务尚未接入，现在提交只能得到占位分数，不能作为真实反馈。」+「回到可用学习」→ `today.html`；默认打开即显示关闭说明、状态条与暂无题目卡，带任一 `?mock=` 打开时隐藏关闭说明并渲染题目分支。
- 状态条 → 等价 `B10StatusPanel`：idle「准备开始」、loading「正在加载学习内容」、ready「已准备好，可以开始」、empty「当前没有可用内容」、offline「网络暂时不可用 / 待同步不等于已结算。」、stale「内容版本已失效 / 提交结果基于旧版本，反馈中的依据可能已变化。」、error「服务暂时不可用」；error / offline / stale 右侧出现「重试」，其余状态只保留画质按钮。题目读取成功后说明为「题目已读取，草稿会保存在本机。」。
- 画质 → 状态条「画质 · 舒适」打开底部弹层，四档「精致 / 舒适 / 轻量 / 省资源」（`B10StatusPanel` 档位），当前档带 brand 对勾与 `aria-pressed`；选择后更新文案并关闭弹层，焦点回到画质按钮；遮罩、取消与 Esc 均可关闭。
- 切换题目 → 「翻译 · 把这句话翻译成英文」打开底部弹层，三个题目（翻译 / 邮件 / 改错）带类型、标题与一行摘要，当前项带 brand 对勾与 `aria-pressed`；选择后更新类型、标题、原文块、任务说明与要点标签，清空反馈并恢复该题自己的本地草稿，焦点回到题目按钮。
- 本地草稿 → 输入后 260ms 自动保存，行内状态「本地草稿：输入中」→「本地草稿：已保存」（对齐 `draftSavedAt ? 已保存 : 输入中`）；「保存草稿」立即保存，不弹 Toast，只更新行内状态；`?mock=draft-error` 模拟保存失败：行内显示 bad 色「本地草稿：未能保存」，状态条说明「草稿未能保存。」（对齐 `persistDraft` 失败分支），输入内容仍留在页面上。草稿只存在本机，离开页面不清空。
- 提交校验 → 未读取到题目或未填答案点击「提交规则评测」，输入框下方出现 bad 色「请先读取题目并填写答案。」（对齐 `submit()` 的 `!prompt || !text.trim()` 分支）并聚焦输入框，状态条说明同步为同一句；开始输入后错误与说明自动恢复。
- 提交评测 → 主按钮转圈「正在提交…」→ 1.2s 后出现规则反馈卡：答对为 ok 底「规则命中」+ 分数 88，答错为 bad 底「需要修复」+ 分数 55 与错误原因列表；反馈卡同时给出「已保存」、规则依据（标签 / 解释 / 原句）、下一步与「练习方式：规则反馈与自评」，焦点移到反馈标题。改错题按钮为「提交病句改错」（对齐 `writing.correction`）。原型以答案是否命中关键词模拟规则判分，不显示反馈代码或规则版本号。
- 版本失效 → `?mock=feedback-stale` 以提交后的 stale 状态打开：状态条「内容版本已失效 / 提交结果基于旧版本，反馈中的依据可能已变化。」+「重试」，反馈卡底部显示「当前版本已下线或发生变化，请重新读取。」（`common.stale`）；点「重试」转圈「正在读取…」1.1s 后反馈卡清理、状态条回到「已准备好，可以开始」，并显示 ok 色 `role=status`「写作题目已更新。」，2.4s 后淡出，不弹 Toast。
- 提交失败 / 离线 → `?mock=submit-error` 打开即显示状态条 error「服务暂时不可用 / 写作提交失败，草稿仍保留。」；`?mock=submit-offline` 显示 offline「网络暂时不可用 / 待同步不等于已结算。」（对齐 `b10ErrorInfo` 的离线分支与 `status.pending`）；两种情况下题目与答案都保留，点「重试」后恢复 ready，可再次提交。
- 暂无题目 / 重试 → 正常态没有题目时显示真实页空题目卡「暂无题目 / 暂时没有可用写作题。」（`writing.noPrompt`）+「题目还在准备，提交与反馈链也没接好；现在放空白编辑器写了也存不下来，所以没放。」+「重试」（`status.retry`）；点击转圈「正在读取…」1.1s 后重新渲染，没有题目则状态条转为「当前没有可用内容」，不弹 Toast。
- 登录门禁 → 对齐真实页 `onMounted`：先 `session.restore()`，未登录直接跳转 `login.html?returnTo=%2Fpages%2Fb3-writing%2Fb3-writing`，不渲染写作内容；原型以无权限态承载该分支，登录页回跳地址与真实页一致。
- 文案边界 → 不显示反馈代码、内容版本号或原始状态枚举；Phase 1 只给规则反馈与自评，不写成自动批改或 AI 评分。真实页没有页尾出口，本稿不新增「错题与报告」「单词复习」入口。
