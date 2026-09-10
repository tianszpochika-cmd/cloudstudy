# ADR-0002：移动端 App 采用 Tauri 2.0 主线，React Native 为备选

## 状态

superseded by ADR-0004（前后端主线整体切换为 Vue3 + uni-app + Spring Boot 3，移动端随之采用 uni-app 原生渲染编译；本决策中的 Tauri/RN 路线分析保留作为历史参考）

## 背景

产品核心诉求之一是"App 效果出众"：3D 口腔发音解剖、Rive 数字人情绪状态机、React Flow 语法树、Phaser/Pixi 游戏化玩法与粒子特效。移动端存在两条路线：

- **Tauri 2.0（WebView）**：Web 端全部视觉资产（R3F/Rive/React Flow/Phaser/Pixi）100% 直接复用，一套特效代码五端通吃；渲染上限约 60fps。
- **React Native（原生渲染）**：可达 120Hz 高刷、Skia 级原生绘图，但无 DOM，R3F/React Flow/Pixi 均不可用，视觉资产需重写一遍。

## 决策

移动端主线采用 **Tauri 2.0**，最大化复用 Web 端视觉资产，保证 App 与 PC Web 体验一致；麦克风、Taptic 震动、本地预载与推送通过 Tauri 2.0 插件层接入。不追求 120Hz 高刷指标，60fps 配合四级画质自适应已满足流畅标准。

## 备选触发条件

出现以下情况时重新评估并新增 ADR：

- 需要系统级语音常驻、后台长时间录音等 WebView 无法胜任的原生能力。
- 真机实测 WebView 渲染在中端安卓机上无法稳定 30fps（Performance 档降级后仍不达标）。
- 小程序与 App 的分发策略变化导致包体或审核受限。

## 结果

- 移动端视觉特效研发投入减半（复用而非重写）。
- 小程序端仍需独立降级路径（Lottie 小程序版 / 帧动画），Rive 无小程序运行时。
- Phaser 3 作为游戏化小游戏引擎纳入技术栈，受四级画质开关统一管控。
