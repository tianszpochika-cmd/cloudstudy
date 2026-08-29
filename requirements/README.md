# 需求中心

这里是项目的需求与追溯入口。下一轮开发的唯一全量业务设计与需求落地基线是 `../docs/06-design/v2-980plus/`；本目录提供来源证据、编号、法规边界、验收与任务治理，不以聊天记录、历史 PDF 或旧技术方案为准。

## 需求事实源

- `../docs/06-design/v2-980plus/README.md`：第二版全量业务设计、四端边界、状态、契约和阶段 Gate；新任务以此为准，`V2-EXT-*` 需细化签收后实施。
- `../docs/06-design/v2-980plus/phase1-business-operation/README.md`：Phase 1 角色与业务总图、端到端旅程、逐页功能、学习机制、后台流程、业务联调、异常恢复和 E2E Evidence；运行层 ID 不改变 980 计数，文档存在不等于实现完成。
- product-requirements.md：完整 PRD，提供产品阶段、边界和功能的来源证据。
- mvp-scope.md：Phase 1 可执行范围与优先级。
- user-stories.md：按 Phase 1/2/3 划分的用户故事。
- acceptance-criteria.md：可测试验收标准。
- backlog/：后续拆分任务。
- iterations/：迭代记录。
- `../docs/02-architecture/v2-microservices-architecture.md`：v2 后端服务、Gateway、IAM/RBAC、数据 owner、事件和十年演进目标。
- `../docs/02-architecture/v2-platform-capability-matrix.md`：`ARCH-*` 平台能力与未来任务拆分入口。

## 文档分类与使用规则

本目录的文件分为三类：

| 分类 | 文件 | 使用规则 |
|---|---|---|
| 当前权威 | `product-requirements.md`、`feature-matrix.md`、`mvp-scope.md`、`user-stories.md`、`acceptance-criteria.md` | 需求、范围、用户故事和验收的当前依据；与 v2 设计包冲突时，以 v2 设计包及其追溯口径为准并同步修订。 |
| 当前执行 | `backlog/README.md`、`backlog/v2-B7plus-代码重塑与交互测试任务基线.md`、`backlog/v2-B23plus-Phase1-真实运行与实机测试任务基线.md`、`backlog/v2-B28plus-Phase1-本机真实全栈与MCP浏览器验收任务基线.md`、`backlog/G0-G4-治理门禁任务基线.md`、`backlog/DoD-Gate与证据包规范.md` | 当前任务拆分、运行验收和治理门禁入口；任务仍须绑定 v2 设计单元与 `ARCH-*` 能力，不能只凭文档或静态结果宣称完成。 |
| 历史/迁移参考 | `语学星_PRD_v3.3_记忆与掌握闭环增强版.md`、`backlog/开发实施总纲与功能链条任务分解.md`、`backlog/Agent开发状态总报表.md`、`backlog/Phase-1范围冻结与跨文档基线.md`、`backlog/Agent开发SOP与状态流转模板.md` 中的 B0–B6 部分、`iterations/iteration-00-foundation.md` | 仅用于历史证据、迁移输入和状态回放，不得把其中旧技术、旧数量、旧档位或旧任务动作复制为当前开发命令；当前入口见上两类。 |

当前 v2 登记册固定为 `V2-980-0001..0980`：930 个业务单元 + 50 个跨域扩展登记位。成熟度固定为 184 个显式设计单元、486 个原子证据映射、310 个待细化登记位；这是范围与追溯口径，不等于 980 份可实施详细设计或 980 项已完成实现。

## 当前产品基线

- 产品：语学星，研发代号 EnglishFlow。
- Phase 1：18+ 成人/大学生，标准语言学习，无生成式 AI。
- Phase 2：18+ 成人 AI 学习、口语评测、数字人、职场与留学。
- Phase 3：满足资质、版权和未成年人合规后扩展 K12/高中。

## 开发约束

当前技术路线见 AGENTS.md、docs/02-architecture/stack-recommendation.md、ADR-0009 和 ADR-0010：

前端：四个冻结项目——`apps/mobile` 使用 Vue 3 + TypeScript + uni-app，仅承载移动 H5、iOS、Android、iPad，微信小程序通过条件编译输出；`apps/learner-web` 独立承载 PC Web、平板浏览器和 PWA；`apps/admin-web` 使用 Vue 3 + Element Plus 承载后台；`apps/official-site` 是独立 Vue Web 官网，不承载登录业务或登录后业务。四项目共享契约、API client、领域规则、design token、i18n 和埋点，UI/DOM/页面按平台实现。
新后端：Java 25 LTS + Spring Boot 4.1.x + Spring Cloud Gateway + IAM/RBAC 微服务。  
数据：MySQL 8.x + Redis 7.x + S3 兼容对象存储 + Kafka 兼容事件总线。  
迁移兼容：现有 `services/core-api` 暂时保持 Java 17 + Spring Boot 3，不代表 v2 目标已落地。

认证：四端使用 IAM 自有账号密码登录，由 `iam-service` 直接签发短时 RS256 JWT Bearer Access Token，并通过 JWKS 发布公钥；Refresh Token 为轮换、可撤销的服务端会话凭证。Gateway 与每个领域服务独立验证 issuer、签名、算法、audience、时间窗口、token type 和 scope/permission。Web 端 Access Token 只在内存，Refresh Token 使用 HttpOnly/Secure/SameSite Cookie；移动端使用 Keychain/Keystore；官网不保存业务 Token。禁止 OIDC/OAuth、Keycloak、第三方 IdP、URL Token 和客户端角色/tenant/owner 权限覆盖。详细决策见 [ADR-0013](../docs/10-decisions/0013-self-owned-jwt-authentication-center.md)。

AI 仅在 Phase 2 通过 Python FastAPI 独立服务启用。历史技术方案、历史 PDF 和被标记为 superseded 的 ADR 不属于当前实现依据。

## 任务重基线提示

旧 `requirements/backlog/` 中的 B0–B6/`DEV-*` 台账是 v1 历史执行基线。它们保留用于审计和现状回放；下一轮任务必须基于 v2 设计单元 + `ARCH-*` 能力，并绑定 Phase 1 业务运行设计的 `ACT/JNY/PAGE/RULE/INT/E2E` 重新拆分，不能把旧任务状态直接等同于 Gateway、RBAC 或微服务迁移完成。`CONTRACT-GAP/EVENT-GAP/IMPLEMENTATION-GAP/EVIDENCE-GAP` 未关闭时必须进入任务和风险清单。现有 B7+ 的代码状态事实仍见 [`backlog/v2-B7plus-代码重塑与交互测试任务基线.md`](./backlog/v2-B7plus-代码重塑与交互测试任务基线.md)，但它不直接充当下一台电脑的新开发计划。

