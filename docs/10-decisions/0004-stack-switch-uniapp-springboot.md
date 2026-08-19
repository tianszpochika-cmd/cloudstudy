# ADR-0004：前后端主线整体切换为 Vue3 + uni-app + Spring Boot 3（方案 B 落地）

## 状态

accepted（supersedes ADR-0002、ADR-0003）

## 背景

项目进入实际开发阶段，团队（单人/小规模）现有技能结构为 **Vue 3 + Java**，此前架构主线（React/Next.js + NestJS + Tauri）与团队技能不匹配，从零学习将显著拉长落地周期并放大部署、性能风险。核心诉求明确为：**商用上线、一套前端代码部署 Web / H5 / iOS / Android / iPad / 微信小程序**。

## 决策

1. **前端主线**：Vue 3 + TypeScript + **uni-app**，一套代码条件编译到 Web/H5/iOS/Android/iPad/微信小程序；管理后台 Vue 3 + Element Plus。重型特效（Three.js/Rive/Phaser）通过 H5/App 端 web-view 承载。
2. **后端主线**：Java 17 + Spring Boot 3 模块化单体（替代 NestJS）。
3. **实时语音（P1）**：接入商业 RTC AI 对话服务（声网 / 腾讯云 TRTC，Java SDK），自建 LiveKit 降级为后续降本评估项。
4. **异步任务**：BullMQ 替换为 RabbitMQ 或 Redis Streams（Spring 生态集成）。
5. **桌面端**：Web + PWA 优先，Tauri 2.0 原生壳按需启用。

选择依据：技能匹配度 > 生态先进性；uni-app 是国内"一套代码商用全端"最成熟路径，Java 在国内商用场景（支付、对账、权限、招聘）生态最全。

## 代价与接受

- 放弃前后端 TS 类型全链路共享红利：改用 **OpenAPI 单一事实源 + openapi-generator** 生成 Java DTO 与 TS 类型，契约先行原则不变。
- 顶级表现力（R3F/Rive 原生生态）打折：3D/Rive 经 web-view 承载，小程序端进一步降级，可接受。
- uni-app 的条件编译、页面生命周期与纯 Web Vue 有差异，预留 1-2 周适应期。

## 回滚触发条件

团队扩充为成熟 TypeScript 全栈团队、且 uni-app 出现无法绕过的平台限制（如特定原生能力缺失）时，可按 stack-recommendation.md 方案 B（原 v2.x 路线）评估回切，需新增 ADR。
