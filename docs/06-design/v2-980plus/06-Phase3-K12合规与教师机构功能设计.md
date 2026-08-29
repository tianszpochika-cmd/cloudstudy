# Phase 3 K12 合规与教师机构功能设计

Phase 3 是隔离的受监管扩展，不改变 Phase 1/2 默认产品边界。所有未成年人、监护、教师、机构、教材和防沉迷能力均由 Gate 控制。

> **v2 架构绑定**：本阶段通过 `api-gateway` 访问目标领域服务；每个域的契约、数据、权限和事件以本文件的“契约与事实源”及 [v2 微服务技术架构](../../02-architecture/v2-microservices-architecture.md) 为准。现有 `services/core-api` 只承担迁移兼容，不是本版目标事实源。

## 1. 本阶段的共同交互约束

- 先判断阶段、年龄/主体、内容版本、权限和可用性，再渲染核心 CTA。
- 所有学习动作都必须回到“目标 → 练习 → 反馈 → 复习 → 复盘”；社交、游戏和商业模块只能作为辅助出口。
- 所有写操作具备自动保存、幂等、失败恢复和可回放证据；不让客户端直接修改跨域事实。
- 所有登录后 API 请求使用 IAM 签发的 JWT Bearer（Access Token）；Refresh Token 轮换、重放检测、撤销和设备下线由 IAM 会话边界统一处理。
- 登录/注册页面提交密码只能到 IAM；业务客户端不能自行签发或解析 JWT。401、403、过期、撤销和刷新失败必须分别呈现可理解的恢复动作。
- 移动端、iPad、learner-web 的业务状态相同，页面组件按平台分别实现；admin-web 和 official-site 不复用学习者导航。

## 2. 域级设计

### K12 · Phase 3 中小学教材同步、中高考与防沉迷

**本版单元**：62；Phase 1 0 / Phase 2 0 / Phase 3 62  
**设计入口**：[06-Phase3-K12合规与教师机构功能设计.md](06-Phase3-K12合规与教师机构功能设计.md)  
**路由宿主**：k12/*；parent/*；teacher/*；org/*；textbook/*；exam/high-school；safety/*  
**终端**：apps/mobile + apps/learner-web + apps/admin-web；按未成年人、监护人、教师和机构主体分层

**交互意图**：在资质、版权、分类鉴别、监护授权和专项合规完成后，提供隔离的 K12 学习与教务能力。

**主流程**：阶段 Gate → 主体识别 → 监护/机构授权 → 内容权利校验 → 学习/管理 → 防沉迷与隐私控制 → 审计/撤回

**动作与反馈**：Gate → 授权 → 学习/管理 → 受限状态或审计回放。成功后 回到今日任务、复习或下一步学习；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：K12 gate + 主体/监护/版权/资质状态机；默认关闭；PENDING/APPROVED/REVOKED/EXPIRED/RESTRICTED。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → guardian-service + institution-service + curriculum-rights-service；minor_account、guardian_consent、content_rights、textbook_unit、class_report、privacy_request、safety_event。未成年人、监护人、教师、机构和平台管理员主体分离；最小化采集；版权和地区范围先于内容展示；撤回后不可继续使用受限内容。

**事件**：k12.gate_evaluated.v1、guardian.consent_recorded.v1、content_rights.checked.v1、safety.restricted.v1。所有事件沿 requestId、traceId、eventId/clientEventId 关联到领域事实。

**验收**：Gate 未通过时默认关闭且有解释；家长撤回、版权失效、防沉迷限制和隐私请求均可回放；租户和主体数据绝不串读。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 K12；每一条需保留来源、状态、设计锚点和 review 结论。


## 3. 评审顺序

1. 先评审域级流程和边界；
2. 再按登记册逐条确认来源、独立验收和是否需要 SUBFEAT；
3. 再生成 OpenAPI、迁移、事件和页面任务；
4. 最后用真实设备/浏览器检查加载、空、错误、离线、权限、恢复和性能降级。
