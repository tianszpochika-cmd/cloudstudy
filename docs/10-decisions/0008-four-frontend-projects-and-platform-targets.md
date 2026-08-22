# ADR-0008：四个前端项目与平台目标归属

- **状态**：accepted
- **日期**：2026-08-22
- **决策范围**：Phase 1 及后续平台演进

## 背景

需求和 UI/UX 设计同时覆盖移动 H5、iOS、Android、iPad、PC Web、微信小程序、管理后台和官网。如果按每个终端单独建项目，容易产生重复页面、重复状态管理、重复 API 适配和交付口径漂移。Phase 1 需要保留多端能力，但不应把“平台数量”误化为“业务项目数量”。

## 决策

前端冻结为四个独立业务项目：

| 项目 | 技术与职责 | 平台输出 |
|---|---|---|
| `apps/mobile` | Vue 3 + TypeScript + uni-app；唯一的跨端学习端 | 移动 H5、iOS、Android、iPad；微信小程序作为 P1.5 条件编译目标 |
| `apps/learner-web` | Vue 3 + TypeScript + Vite；独立的学习 Web 工作台 | PC Web、平板浏览器、PWA |
| `apps/admin-web` | Vue 3 + TypeScript + Vite + Element Plus；独立后台信息架构 | 教研、审核、运营、商业化、客服和审计后台 |
| `apps/official-site` | Vue 3 + Nuxt 3；独立公开站点 | 品牌、课程介绍、价格、下载、SEO 和合规公示 |

### 平台归属规则

1. 移动 H5、原生 App 和 iPad 共用 `apps/mobile` 的学习业务实现；平台差异通过响应式布局、条件编译和能力适配处理。
2. PC Web / 平板浏览器 / PWA 属于 `apps/learner-web`。它可以复用学习者信息架构和领域规则，但不要求复用 `apps/mobile` 的页面 DOM 或导航壳。
3. 微信小程序从 `apps/mobile` 输出；`apps/miniapp-wechat` 仅保留迁移说明、资源占位或必要兼容记录，不得形成第二套页面、状态或 API 层。
4. 管理后台与官网保持独立路由、权限和发布边界；它们不承载登录后的学习者业务页面。

### 共享规则

四个项目可以共享：

- `packages/contracts/` 中的 API 契约与生成类型；
- API 客户端、纯领域规则和数据模型映射；
- 设计 Token、埋点、国际化资源和通用基础设施；
- 错误码、状态命名、权限语义和验收契约。

共享不等于强行共用页面。跨 `uni-app` 与 Web 的 UI 组件应在保持相同设计语义的前提下分别实现。

## 后果

### 正向影响

- 项目边界清晰，移动端和 Web 端可以并行开发与发布；
- 避免移动 H5、iPad 和微信小程序出现三套学习业务实现；
- 管理后台、官网和学习端的权限、性能与发布节奏互不污染；
- 共享契约和领域规则仍能保持核心业务一致性。

### 需要承担的成本

- Web 和 uni-app 的页面布局、组件实现和端到端测试需要分别维护；
- 设计系统必须维护跨项目 Token 映射与 Design QA；
- 新增独立前端项目前必须补充 ADR，并说明为什么现有四项目无法承载。

## 相关事实源

- `AGENTS.md` §2.1
- `README.md` 前端工程矩阵
- `requirements/mvp-scope.md` 平台范围
- `requirements/product-requirements.md` §1.3 终端阶段划分
- `docs/06-design/phase-1/uiux-specs/23_跨端设计系统与基础设施页面规范.md`
- `docs/06-design/phase-1/uiux-specs/24_完整UIUX页面地图与交付蓝图.md`
