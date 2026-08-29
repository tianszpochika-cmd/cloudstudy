# 统一跨端与性能自适应架构（Historical / Superseded）

> 状态：Historical / Superseded（历史/已被替代）。本文保留四级性能、自适应降级和平台能力的迁移参考；当前项目归属、路由宿主和发布边界以 [v2-980plus 设计基线](../06-design/v2-980plus/README.md)、[四项目信息架构](../06-design/v2-980plus/02-全端信息架构与交互模式.md) 和 ADR-0008 为准。
> 当前固定为四个前端项目：`apps/mobile`、`apps/learner-web`、`apps/admin-web`、`apps/official-site`。微信小程序由 `apps/mobile` 的 uni-app 条件编译输出；不得建立 `apps/miniapp-wechat` 独立业务项目；官网不承载登录后的学习业务。

## 1. v2 当前四项目映射（唯一入口）

| 前端项目 | 实现方式 | 平台目标 | 说明 |
|---|---|---|---|
| `apps/mobile` | Vue 3 + TypeScript + uni-app（Vue3） | 移动 H5、iOS、Android、iPad；微信小程序条件编译目标 | 唯一的 uni-app 学习端项目；不复制第二套业务页面或 API 层 |
| `apps/learner-web` | Vue 3 + TypeScript | PC Web、平板浏览器、PWA、Windows 默认工作区 | 独立学习 Web 项目；不重复承载 `apps/mobile` 的移动 H5 业务页面 |
| `apps/admin-web` | Vue 3 + TypeScript + Element Plus | 教研、审核、运营、商业化、客服和审计后台 | 不复用学习者端导航和业务页面 |
| `apps/official-site` | Vue 3 + TypeScript 的独立官网构建 | 品牌、课程介绍、价格、下载、SEO 和合规公示 | 独立官网项目；不承载登录后的学习业务或业务 Token |

小程序是 `apps/mobile` 的平台输出形态，不是第五个前端项目。桌面端默认使用 `apps/learner-web` 的 Web/PWA；如确需原生壳，只能按 ADR 评估 Tauri 2.0。

## 2. 代码复用原则

- 共享领域模型、OpenAPI 生成类型、设计令牌、埋点和业务规则。
- 使用 uni-app 条件编译隔离平台 API，不复制核心学习业务。
- 四个项目分别维护平台 UI 壳；共享的是契约、领域规则、Token、埋点和国际化资源，不要求跨 Web/uni-app 直接复用 DOM 或页面。
- H5/App 高表现力模块可通过 web-view 承载；小程序必须准备 2D 或静态降级。
- Phase 1 不开发 AI 数字人和 AI 口腔实验室；相关容器仅允许作为 Phase 2 功能开关预留。

## 3. 四级性能档位

| 档位 | 场景 | 允许能力 |
|---|---|---|
| Ultra | 高性能 Web / App | 3D Avatar、完整动效、复杂图表和高质量媒体 |
| High | 主流设备 | 标准动画、轻量 WebGL、音频波形和地图过渡 |
| Medium | 入门设备 | 2.5D/SVG、简化动画、静态图表 |
| Performance | 弱网或低配设备 | 文本、静态图片、基础音频控件，关闭粒子和复杂画布 |

## 4. AdaptivePerformanceEngine

- 冷启动根据设备能力、网络和用户设置选择默认档位。
- 运行中连续低帧率或内存压力时自动降级，不自动提升到更高档。
- 用户可在设置中选择智能、自定义高品质、平衡、省电四种模式。
- 每次降级记录匿名性能事件，不记录不必要设备标识。

## 5. 平台专项

### H5 / App

- Three.js、Rive、Wavesurfer 等仅在对应功能已经进入当前阶段时加载。
- 资源采用分包、懒加载、Draco 压缩和 CDN 缓存。
- 录音、离线包、通知等能力必须先经过权限、失败和恢复流程设计。

### 小程序

- 避免依赖 WebGL、复杂 WASM 和大体积运行时。
- 动效降级为 CSS、帧动画或静态素材。
- 首先保证单词、练习、复习和报告完整可用。

### Windows

- PWA 是默认方案。
- Tauri 只在需离线预载、全局快捷键或本地系统能力时按 ADR 启用。

## 6. 验收

- Web/H5、iOS、Android 核心学习链路在目标设备上可完成。
- Performance 档不会出现无法关闭的 WebGL、粒子或大动画。
- 弱网下练习提交幂等，恢复后不会重复记分或重复扣减权益。
- 所有性能功能均支持 feature flag 和快速关闭。
