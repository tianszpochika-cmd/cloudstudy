# 产品路线图

> 三阶段产品边界以 PRD v3.3 和 v2-980plus 为准。后端技术演进以 [v2 微服务目标架构](../02-architecture/v2-microservices-architecture.md) 和 ADR-0010 为准；平台能力建设不等于提前开放 AI/K12 业务。

> 旧 B0–B6/`DEV-*` 台账仅作 v1 历史追溯。下一轮任务必须按 [ADR-0009](../10-decisions/0009-v2-design-baseline-and-task-rebaseline.md)、[平台能力矩阵](../02-architecture/v2-platform-capability-matrix.md) 和 v2 设计单元重新生成；旧状态不能直接代表 Gateway、RBAC 或微服务迁移完成。

## Platform 0：v2 平台与架构基座

目标：让四个前端项目通过统一入口安全访问可演进的后端，同时建立十年运维所需的服务、数据、事件和观测边界。Platform 0 不新增 Phase 1 业务功能，但它是所有新业务任务的前置依赖。

### P0 必须完成的能力

- Java 25 LTS、Spring Boot 4.1/Spring Cloud 对齐的统一 BOM、服务模板和容器构建矩阵。
- `api-gateway`：路由、`/api/v1` 版本、限流、CORS、requestId/traceId、JWT 预校验、直连阻断和回滚路由。
- `iam-service`：通过 ADR 选择的标准 OIDC/OAuth 2.1 IdP 集成、用户/租户/设备/会话、Token 撤销、密钥轮换、RBAC + ABAC 策略和审计；不自研 Token 服务器。
- 服务侧 Spring Security Resource Server/PEP；默认拒绝；正常热路径使用版本化策略包/短时安全缓存，高风险/动态策略才调用 PDP；移除客户端角色头和客户端 owner/tenant 作为权限事实。
- OpenAPI/AsyncAPI/JSON Schema 生成与兼容门禁；MySQL schema owner、Flyway、Redis namespace、`TenantScope` 查询守卫、Outbox 和 Kafka 兼容集成事实事件总线。
- OpenTelemetry、SLO/错误预算、健康探针、超时/重试/熔断、DLQ/回放、备份/PITR、RPO/RTO 和 Kubernetes/GitOps 发布基座。
- `core-api` 兼容接入与 Strangler 迁移适配；旧直接端口只保留本地回滚和迁移用途。

### P0 进入下一阶段的 Gate

- Gateway/IAM/RBAC 的契约、标准 IdP 集成、运行、拒绝、撤销、密钥轮换、PDP fail-closed、跨租户隔离、观测和回滚证据齐全。
- 至少一个学习读链路和一个关键写链路完成“Gateway → 服务侧 PEP → 领域事实 → Outbox → Trace/Audit”回放，且内容/题目、attempt/判分、掌握度/复习分别由唯一 owner 管理。
- 新服务模板能在本地固定端口和 CI 中启动；跨服务直写、共享 ORM entity、客户端角色头扫描为 0。

## B7+ 代码层重塑批次

[v2 B7+ 代码重塑与交互测试任务基线](../../requirements/backlog/v2-B7plus-代码重塑与交互测试任务基线.md) 是本路线图的可认领任务入口。它从 B7 起将 Platform 0、Phase 1 领域服务抽取和四前端（含 `apps/official-site`）拆成 69 项代码与逻辑/交互测试任务：

- B7–B8：服务模板、契约、共享国际化/主题 Token、Gateway、标准 OIDC IdP/IAM、服务侧 PEP 与成人 Gate；
- B9–B13：learner/content、learning/assessment、media/离线、游戏/社群、商业化/Admin/官网公开数据；
- B14：Phase 1 Strangler 收敛、兼容路由与代码级全链路回归；
- B15/B16：分别为 Phase 2/Phase 3 的冻结任务，未经阶段 Gate 不进入开发。

此处的“完成”仅指代码层与逻辑/交互测试完成；真实基础设施、设备、支付、容量、灾备和合规发布仍按本路线图的 Gate 另行验收。

## Phase 1：市场开拓版（在 Platform 0 之上）

目标：18+ 成人与大学生的标准语言学习产品，8 周完成可试学版本。

### P0

- 登录、目标选择、非 AI 水平测评和今日任务。
- 单词/短语 SRS、词根词缀、语法、句子、听力、阅读、口语自练和写作自练。
- 原创 CET 风格练习、规则报告、错题复习和基础打卡。
- 免费/VIP、激活码、内容审核后台、隐私与客服基础能力。
- Web/H5 首发，Android/iOS 包体验证；小程序后置。
- 首批领域服务按依赖逐步抽取：`learner → content → learning/assessment → media → commerce`；未达到数据、权限、SLO 和回滚证据前保留 `core-api` 兼容路由。

### P1

- 扩展游戏矩阵、3D Avatar、学习空间、Study Room 低 UGC、离线同步、Language Clips 和家庭共享。

### 禁止提前交付

- LLM、AI 评分、AI 数字人、实时 AI 语音、RAG。
- 未成年人账号、K12/高中入口、教材同步和学科培训宣传。

## Phase 2：成人 AI 智能增强

前置条件：Phase 1 有连续四周真实使用数据，学习留存、内容审核、成本预算和隐私流程达到预设门槛。

1. AI 基座：FastAPI、Schema、prompt_version、评测、成本和安全开关。
2. AI 学习：课程范围内文字陪练、结构化反馈、RAG、作文和长难句辅助。
3. 语音与数字人：发音评测、商业 RTC、实时角色扮演和数字人。
4. 成人高阶目标：职场、出海、雅思托福、考研和学术英语。

## Phase 3：受监管扩展

前置条件：教材版权、未成年人保护、教育相关专项合规和运营能力完成复核。

- 未成年人账号与家长模式。
- K12/高中课程、教材同步、升学训练和教师/机构生态。
- 更严格的内容审核、时长控制、隐私和数据治理。

## 全阶段 Gate

- 新模块必须有需求、设计、OpenAPI、数据迁移、埋点、测试和验收标准。
- 新后端任务必须同时有业务 `Source Ref` 与 `ARCH-*` 能力、服务 owner、数据 owner、权限策略、事件/幂等、观测和回滚证据。
- 任何 AI 功能必须具备 Schema、失败降级、成本监控、安全审核和可追溯日志。
- 任何 K12/未成年人功能必须在专项合规批准后才可在 UI、营销和注册流程中出现。

## 十年运维与演进节奏

- 每季度进行 Java/Spring/依赖和镜像安全升级；LTS 切换采用双运行时兼容窗口和可回滚发布。
- API、事件和数据库遵循“先兼容、再切换、后删除”；弃用、数据归档、删除请求和审计留存都有期限与责任人。
- 每季度至少一次恢复演练，每半年一次容量/故障注入复盘；SLO、错误预算和成本预算决定是否继续拆分服务。
- 引入新消息总线、服务网格、身份提供方、向量检索、自建 RTC 或改变受监管边界必须新增 ADR。

