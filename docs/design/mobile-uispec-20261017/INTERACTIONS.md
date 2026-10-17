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
