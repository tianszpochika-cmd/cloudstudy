# 需求中心

这里是项目的需求与追溯入口。下一轮开发的唯一全量业务设计与需求落地基线是 `../docs/06-design/v2-980plus/`；本目录提供来源证据、编号、法规边界、验收与任务治理，不以聊天记录、历史 PDF 或旧技术方案为准。

## 需求事实源

- `../docs/06-design/v2-980plus/README.md`：第二版全量业务设计、四端边界、状态、契约和阶段 Gate；新任务以此为准，`V2-EXT-*` 需细化签收后实施。
- product-requirements.md：完整 PRD，提供产品阶段、边界和功能的来源证据。
- mvp-scope.md：Phase 1 可执行范围与优先级。
- user-stories.md：按 Phase 1/2/3 划分的用户故事。
- acceptance-criteria.md：可测试验收标准。
- backlog/：后续拆分任务。
- iterations/：迭代记录。
- `../docs/02-architecture/v2-microservices-architecture.md`：v2 后端服务、Gateway、IAM/RBAC、数据 owner、事件和十年演进目标。
- `../docs/02-architecture/v2-platform-capability-matrix.md`：`ARCH-*` 平台能力与未来任务拆分入口。

## 当前产品基线

- 产品：语学星，研发代号 EnglishFlow。
- Phase 1：18+ 成人/大学生，标准语言学习，无生成式 AI。
- Phase 2：18+ 成人 AI 学习、口语评测、数字人、职场与留学。
- Phase 3：满足资质、版权和未成年人合规后扩展 K12/高中。

## 开发约束

当前技术路线见 AGENTS.md、docs/02-architecture/stack-recommendation.md、ADR-0009 和 ADR-0010：

前端：Vue 3 + TypeScript + uni-app（四个冻结项目）。  
新后端：Java 25 LTS + Spring Boot 4.1.x + Spring Cloud Gateway + IAM/RBAC 微服务。  
数据：MySQL 8.x + Redis 7.x + S3 兼容对象存储 + Kafka 兼容事件总线。  
迁移兼容：现有 `services/core-api` 暂时保持 Java 17 + Spring Boot 3，不代表 v2 目标已落地。

认证：四端使用 IAM 自有账号密码登录，由 `iam-service` 直接签发短时 RS256 JWT Bearer Access Token，并通过 JWKS 发布公钥；Refresh Token 为轮换、可撤销的服务端会话凭证。Gateway 与每个领域服务独立验证 issuer、签名、算法、audience、时间窗口、token type 和 scope/permission。Web 端 Access Token 只在内存，Refresh Token 使用 HttpOnly/Secure/SameSite Cookie；移动端使用 Keychain/Keystore；官网不保存业务 Token。禁止 OIDC/OAuth、Keycloak、第三方 IdP、URL Token 和客户端角色/tenant/owner 权限覆盖。详细决策见 [ADR-0013](../docs/10-decisions/0013-self-owned-jwt-authentication-center.md)。

AI 仅在 Phase 2 通过 Python FastAPI 独立服务启用。历史技术方案、历史 PDF 和被标记为 superseded 的 ADR 不属于当前实现依据。

## 任务重基线提示

旧 `requirements/backlog/` 中的 B0–B6/`DEV-*` 台账是 v1 历史执行基线。它们保留用于审计和现状回放；下一轮任务必须基于 v2 设计单元 + `ARCH-*` 能力重新拆分，不能把旧任务状态直接等同于 Gateway、RBAC 或微服务迁移完成。当前 B7+ 的代码层任务入口与状态事实为 [`backlog/v2-B7plus-代码重塑与交互测试任务基线.md`](./backlog/v2-B7plus-代码重塑与交互测试任务基线.md)。

