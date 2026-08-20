# 语学星移动端 UI/UX 工作交接记录

> 记录日期：2026-08-20  
> 工作范围：Phase 1 移动端 UI/UX、Figma 设计源文件、设计文档与高保真参考稿  
> 用途：换电脑后继续执行时，作为唯一的续作入口

## 1. 设计源文件

- Figma 文件：[语学星｜移动端 UIUX v1](https://www.figma.com/design/UpcXTamTjwrb5OQg9WJiFu/%E8%AF%AD%E8%A8%80%E6%98%9F%EF%BD%9C%E7%A7%BB%E5%8A%A8%E7%AB%AF-UIUX-v1?node-id=0-1&m=dev&t=HTnobtVsUUvvHU9i-1)
- Figma file key：`UpcXTamTjwrb5OQg9WJiFu`
- 设计源文件归属：Figma
- 本项目仓库不保存完整 `.fig` 文件；仓库保存设计规范、页面/状态清单、资产、HTML 参考稿和续作记录。

## 2. 本次已完成

### Figma

已在 Figma 文件中建立双主题基础令牌，共 6 个变量集合、93 个变量：

| 变量集合 | 状态 |
| --- | --- |
| `Primitives` | 已建立，34 个基础色变量 |
| `Color/Light` | 已建立，20 个浅色语义色变量 |
| `Color/Dark` | 已建立，20 个深色语义色变量 |
| `Spacing` | 已建立，10 个间距变量 |
| `Radius` | 已建立，9 个圆角变量 |
| `Typography` | 集合已建立，具体变量尚未写入 |

### 本地设计资料

- [移动端页面与状态构建清单](./figma-mobile-build-manifest.json)：43 个移动端路由、基础状态、特殊状态和 10 条核心原型流程。
- [移动端组件清单](./figma-mobile-component-manifest.json)：品牌、iPhone 设备壳、图标、组件、页面模板和交付约束。
- [Figma 状态账本](./figma-mobile-state-ledger.json)：已创建对象 ID、进度和限流状态的机器可读记录。
- [极光品牌标记](./assets/aurora-mark.svg) 与 [品牌字标](./assets/aurora-wordmark.svg)。
- `mockups/` 下已有移动端、iPad、Web 和完整功能族 HTML 参考稿，可继续作为视觉和交互基线。
- `uiux-specs/` 下已有 Phase 1 设计总册、信息架构、页面状态、组件规范、动效无障碍和完整页面地图。

## 3. 当前未完成范围

以下内容尚未完整落入 Figma 画布：

- Typography 具体变量、文字样式和阴影/效果样式；
- 移动端页面分组和基础页面画板；
- 可复用组件、组件变体、图标组件和 iPhone 16 Pro Max 设备壳；
- 43 个路由的页面画面与 Loading、Empty、Error、Offline、Completed 等状态；
- 10 条核心用户流程的 Figma Prototype 连接；
- 设计验收、紧凑屏适配、安全区、通知岛和触控尺寸的 Figma 画布级检查。

因此，当前状态应理解为：**设计文档和本地参考稿较完整，Figma 已完成基础令牌，但还不是完整可交付的移动端 Figma UI 稿。**

## 4. Figma 限流情况

本次在写入基础令牌后，Figma MCP 返回了 Starter 计划的工具调用上限。当前状态记录为：

`starter-call-limit-reached`

处理原则：

1. 限额恢复或升级计划前，不要反复重试写入调用。
2. 不要新建第二个 Figma 文件；继续使用上面的 file key。
3. 不要重新创建已经存在的 6 个变量集合和 93 个变量；先读取状态账本并复用对象 ID。
4. 后续写入应按阶段批量执行，减少“一个节点一次调用”的方式。
5. 每个阶段完成后立即把新建节点 ID、组件 ID 和完成状态写回 `figma-mobile-state-ledger.json`，这样即使再次限流也能断点续作。

## 5. 换电脑后的续作顺序

### 第一步：环境确认

- 登录与当前相同的 Figma 账户和团队；
- 打开上面的 Figma 文件，确认文件 key 没有变化；
- 确认 Figma 连接器能读取文件；
- 先读取 `figma-mobile-state-ledger.json`，不要直接创建对象；
- 确认当前 Starter 限额是否已经恢复，或是否已调整套餐。

### 第二步：按低调用次数批量推进

1. 写入 Typography 变量、文字样式和效果样式；
2. 创建页面分组和 iPhone 16 Pro Max 设备壳；
3. 创建最小可复用组件库：导航、按钮、卡片、进度、列表、输入、反馈、Sheet、Toast、状态页；
4. 优先完成 P0 核心流程：首次使用、每日学习、词汇 SRS、错题修复、技能学习、Checkpoint/CET、成长奖励、账户服务、离线恢复；
5. 再补 Study Room、排行榜和其他 P1 页面；
6. 最后连接 Prototype、补充特殊状态并做安全区和触控尺寸检查。

### 第三步：每阶段验收

- 画面是否使用变量而不是散落的硬编码值；
- 浅色和深色主题是否同时可切换；
- iPhone 16 Pro Max 的安全区、通知岛、底部 Home Indicator 是否独立于内容层；
- 页面是否只有一个主滚动容器；
- 重要操作是否达到 44pt 触控尺寸；
- 图标是否有可访问名称或文字辅助；
- 页面和流程是否与 `figma-mobile-build-manifest.json` 一一对应；
- 新增对象 ID 是否同步到账本。

## 6. 续作时的事实边界

- Figma 是 UI 设计源文件；本项目仓库不是 Figma 文件的替代品。
- 本地 HTML 是可运行的高保真参考稿，不等同于已经完成的 Figma 组件和 Prototype。
- 设计文档描述的是产品范围和交互规则；页面是否已经在 Figma 中画出，以状态账本和 Figma 文件实际内容为准。
- Phase 1 不包含 Phase 2 AI Tutor/AI 评分，也不包含 Phase 3 未成年人/K12 流程和 Admin Web 页面。

