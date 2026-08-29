# Phase 2 AI 成人高级能力功能设计

Phase 2 只面向成人，且必须在模型安全、成本、同意、内容审核、AI 登记和实时通信前置条件通过后启用。

> **v2 架构绑定**：本阶段通过 `api-gateway` 访问目标领域服务；每个域的契约、数据、权限和事件以本文件的“契约与事实源”及 [v2 微服务技术架构](../../02-architecture/v2-microservices-architecture.md) 为准。现有 `services/core-api` 只承担迁移兼容，不是本版目标事实源。

## 1. 本阶段的共同交互约束

- 先判断阶段、年龄/主体、内容版本、权限和可用性，再渲染核心 CTA。
- 所有学习动作都必须回到“目标 → 练习 → 反馈 → 复习 → 复盘”；社交、游戏和商业模块只能作为辅助出口。
- 所有写操作具备自动保存、幂等、失败恢复和可回放证据；不让客户端直接修改跨域事实。
- 所有登录后 API 请求使用 IAM 签发的 JWT Bearer（Access Token）；Refresh Token 轮换、重放检测、撤销和设备下线由 IAM 会话边界统一处理。
- 登录/注册页面提交密码只能到 IAM；业务客户端不能自行签发或解析 JWT。401、403、过期、撤销和刷新失败必须分别呈现可理解的恢复动作。
- 移动端、iPad、learner-web 的业务状态相同，页面组件按平台分别实现；admin-web 和 official-site 不复用学习者导航。

## 2. 域级设计

### AI2 · Phase 2 AI 伴学导师、实时语音与出国专项

**本版单元**：68；Phase 1 0 / Phase 2 68 / Phase 3 0  
**设计入口**：[05-Phase2-AI成人高级能力功能设计.md](05-Phase2-AI成人高级能力功能设计.md)  
**路由宿主**：ai/*；voice/*；roleplay/*；exam/ielts；business/*；overseas/*；ai-governance/*  
**终端**：apps/mobile + apps/learner-web；必要时 apps/admin-web 管理提示词、成本、风控和回放

**交互意图**：在 Phase 2 Gate 通过后，将 AI 生成、实时 RTC、结构化评测和成人专项能力接入学习闭环。

**主流程**：用户输入/授权 → 前置敏感拦截 → AI 请求 → 流式/RTC 交互 → 后置合规核验 → Schema 校验 → 保存结果 → 采纳/重做/降级

**动作与反馈**：输入 → 安全预检 → 流式/实时交互 → 结构化反馈 → 采纳/重做/降级。成功后 回到今日任务、复习或下一步学习；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：AI request CREATED→PRECHECKED→RUNNING→POSTCHECK→PERSISTED→DELIVERED；CANCELLED、TIMEOUT、DEGRADED 可回放。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → ai-orchestrator + assessment-service + learning-service；ai_request、ai_result、prompt_version、consent、cost_ledger、safety_review。成人、地区、同意、成本预算和功能 Gate 全部通过才可用；AI 结果必须有 schema、版本、来源、免责声明、超时降级和审计。

**事件**：ai.request_created.v1、ai.precheck_blocked.v1、ai.result_persisted.v1、rtc.session_ended.v1、ai.degraded.v1。所有事件沿 requestId、traceId、eventId/clientEventId 关联到领域事实。

**验收**：无生成式 AI 的 Phase 1 页面不会出现 AI CTA；AI 超时退回规则化学习路径；实时 RTC 失败不能伪造评测结果；敏感输入和原始音频分级存储。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 AI2；每一条需保留来源、状态、设计锚点和 review 结论。


## 3. 评审顺序

1. 先评审域级流程和边界；
2. 再按登记册逐条确认来源、独立验收和是否需要 SUBFEAT；
3. 再生成 OpenAPI、迁移、事件和页面任务；
4. 最后用真实设备/浏览器检查加载、空、错误、离线、权限、恢复和性能降级。
