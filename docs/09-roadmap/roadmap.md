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

[v2 B7+ 代码重塑与交互测试任务基线](../../requirements/backlog/v2-B7plus-代码重塑与交互测试任务基线.md) 是代码重塑和 B15–B22 静态运行/发布基础的任务入口；[B23+ Phase 1 登录、真实数据与测试任务基线](../../requirements/backlog/v2-B23plus-Phase1-真实运行与实机测试任务基线.md) 是认证、真实数据和原真机/发布门禁入口；[B28+ 本机真实全栈与 MCP 浏览器验收基线](../../requirements/backlog/v2-B28plus-Phase1-本机真实全栈与MCP浏览器验收任务基线.md) 是当前本机 Web/H5 收口入口。当前 Phase 1 共规划 180 项 B7+ 编号任务：原 B7–B27 为 135 项，新增 B28–B36 本机专项 45 项：

- B7–B8：服务模板、契约、共享国际化/主题 Token、Gateway、标准 OIDC IdP/IAM、服务侧 PEP 与成人 Gate；
- B9–B13：learner/content、learning/assessment、media/离线、游戏/社群、商业化/Admin/官网公开数据；
- B14：Phase 1 Strangler 收敛、兼容路由与代码级全链路回归；
- B15：Java 25/Maven/Docker、本地基础设施、独立进程、迁移和观测运行态；
- B16：真实 Gateway、OIDC、IAM/RBAC/ABAC、服务侧 PEP 和权限回归；
- B17：领域服务、数据库、Outbox/Kafka、关键读写链路和 Saga 运行态；
- B18：四端真实 API 联调、国际化/主题、官网公开边界和核心交互闭环；
- B19：契约、集成、E2E、浏览器、真机、弱网、性能和无障碍测试；
- B20：安全、隐私、版权、支付 sandbox、备份恢复和灾备 Gate；
- B21：staging、不可变 RC、SLO/告警、回滚和 Go/No-Go；
- B22：生产小流量上线、迁移对账、观察期和 Phase 1 收口。
- B23：标准 OIDC 测试 IdP、注册/登录、JWKS、IAM 本地事实、Gateway 和服务侧 RBAC/ABAC/PEP。
- B24：Mobile H5/Web 全局登录门禁、OIDC 回调、成人 Gate、onboarding、401/403、国际化/主题和交互边界。
- B25：本地 MySQL 数据 owner、Phase 1 合成 fixture、内容/课程、学习/练习/测评/SRS/报告真实读写。
- B26：Kafka/Outbox/消费者可靠性、跨服务学习闭环、浏览器/H5 真实数据测试、缺陷修复和回归。
- B27：iOS/Android/iPad/PWA/微信小程序真机、专项质量、production-like staging、不可变 RC、回滚、Go/No-Go 和测试交接。
- B28–B29：本机 Java 25/Docker/基础设施、迁移、14 个后端进程、持久化和观测真实运行。
- B30–B32：标准 OIDC 注册登录、IAM/RBAC、MySQL API 读写、完整学习链和 Kafka/Redis 联动。
- B33：learner-web、Mobile H5、admin-web、official-site 与真实 Gateway/API 联调和交互修复。
- B34–B35：Codex Browser MCP 真浏览器功能测试、异常恢复、数据一致性和缺陷回归。
- B36：本机连续冷启动、双端完整旅程、数据/事件对账和 `LOCAL-TEST-PASS/NO-PASS` 交接。
- G0–G4：横切 DoD 治理门禁代码化，覆盖范围、契约数据、实现交互、测试安全观测和发布回滚；它们不替代 B15–B27 的真实运行态 Gate。

截至 2026-08-25，B18–B27 已完成相应代码与静态 Gate 基础，B28–B29 已通过本机基础设施、14 个后端进程、固定端口、Gateway 受保护边界、owner schema、观测和 fail-closed 运行门禁；B30–B33 的自动化/API/DB/Kafka/Redis/四端构建运行切片也已通过。Browser MCP 已验证真实页面、未登录门禁、公开投影、Mobile H5 390x844 登录入口和异常恢复，并进入 Keycloak 登录/注册页，但认证后注册、登录、学习旅程尚未提交，故 B34–B36 当前仍为收口中，交接保持 `LOCAL-TEST-NO-PASS`。原 B27 的 iOS/Android/iPad、微信、远程真机、staging、RC 和生产交接运行 Gate 暂缓，发布结论继续保持 `NO-GO`。

此处 B7–B27 的“代码/静态完成”不代表真实运行完成。当前本机专项在 B28–B33 完成后进入 B34 MCP 浏览器正式测试，B34–B36 通过后只能宣告本机 Web/H5 真实数据功能测试完成。Phase 1 生产上线仍须恢复并通过原 B27 以及 B15–B22 的发布、回滚和观察期 Gate。F2/F3 保留在未来路线图中，不计入当前 Phase 1。

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

### Phase 1 从代码基线到上线的 Gate 顺序

1. **B15 运行环境 Gate**：Java 25/Maven、基础设施、独立服务、迁移、观测和一键 smoke 可重复。
2. **B16 权限运行 Gate**：真实测试 IdP、Gateway、OIDC、RBAC/ABAC、撤销、密钥轮换和默认拒绝可回放。
3. **B17 领域运行 Gate**：关键读写链路、数据库 owner、Outbox/Kafka、幂等、DLQ、补偿和回滚证据齐全。
4. **B18–B22 运行/发布基础 Gate**：四端 API 联调、系统测试矩阵、安全/隐私/灾备、staging/RC 和上线方案具备可执行证据。
5. **B23 认证运行 Gate**：标准 OIDC 注册/登录、JWKS、IAM 本地事实、Gateway/服务侧 PEP、撤销和默认拒绝通过。
6. **B24 前端登录门禁 Gate**：H5/Web 未登录强制登录、回调回跳、成人 Gate、真实 401/403、国际化/主题和交互状态通过。
7. **B25 本地真实数据 Gate**：内容/课程/学习/练习/测评/SRS/报告从本地 MySQL 真实读写，刷新/重启/幂等和 owner 对账通过。
8. **B26 正式测试 Gate**：Kafka/Outbox 跨服务闭环、浏览器/H5 真实数据旅程、弱网/响应式/权限回归和缺陷证据通过。
9. **B27 真机与交接 Gate**：iOS/Android/iPad/PWA/小程序、专项质量、staging/RC、回滚、Go/No-Go 和 Phase 1 测试交接完成。

### 当前本机专项执行顺序

当前先执行 B28–B36，不等待原生端或生产环境：

1. B28–B29：让本机基础设施、迁移和 14 个后端进程可重复真实运行；
2. B30–B32：关闭真实注册登录、MySQL 读写、学习业务和 Kafka/Redis 运行 Gate；
3. B33：完成四前端真实 API 联调和页面交互修复；
4. B34：使用 Codex Browser MCP 执行 learner-web、Mobile H5、Admin 和官网真浏览器验收；
5. B35：完成权限、异常、重启、一致性和缺陷回归；
6. B36：连续两轮冷启动和双端完整旅程通过后，给出本机 `LOCAL-TEST-PASS/NO-PASS`。

本机 `LOCAL-TEST-PASS` 不等于第 9 项 B27 真机与发布 Gate 通过。

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

