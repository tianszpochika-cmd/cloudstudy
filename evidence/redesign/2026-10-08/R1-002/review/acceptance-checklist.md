# R1-002 独立验收清单

日期：2026-10-08  
分支：`dev-redesign`  
初始审查 HEAD：`8215c95d`  
审查范围：BC-002 / R1-002 的注册接口交付。最终具名结论见 [final-review.md](final-review.md)：仅 R1-002 卡级 AC/BC-002 **CARD_SCOPE_ACCEPTED**。

## 卡级验收

R1-002 的计划定义为“注册接口联调（201+会话，无学习能力）”，验收句为“干净库注册 201，token 无学习权限”，owner 为 `iam-service`，依赖 R1-001。BC-002 说明注册以 identifier、密码、设备经 TLS 直达 IAM；201 只证明账号和会话建立，成人门或必要授权未满足前不得得到学习能力，失败不得泄露账号存在性。

| 检查项 | 需要的独立证据 | 状态 |
|---|---|---|
| 干净且专用的 IAM schema | 新 IAM owner schema：17 个成功迁移、无失败；注册前主体/账号/session/device/audit/completed-idempotency 六计数皆 0。专用 learner schema 另跑 12 个迁移。MySQL 初始 ACL 的下划线 pattern 风险已对本轮三个自建账号做运行后收紧；最终 literal grant、owner 表可读及跨 schema 拒绝均有读回。物理 FK 元数据未单独核查，不作为本卡 AC | 通过 |
| learner PEP 启动依赖 | learner 使用独立新 schema/user 和 12 个标准 Flyway 迁移；未播种学习者或学习事实 | 通过 |
| 注册成功与持久会话 | TLS 直接提交 IAM 注册，HTTP 201；持久读回 principal/account/session/device 同一主体关联 1 组，session ACTIVE | 通过 |
| 受限 access token | 实际 JWKS RS256 验签通过，RSA 3072；`adult_gate=NOT_EVALUATED`、`consent_state=UNKNOWN`、phase-1/platform、subject=owner、4 项基础权限且学习权限数为 0 | 通过 |
| Web refresh Cookie | 实际响应为 `yuxuexing_refresh`、`Path=/api/v1/auth`、正 `Max-Age`、`HttpOnly; Secure; SameSite=Lax`；JSON 不含 refresh token | 通过 |
| 服务侧拒绝 | 同一受限 token 直达 learner-service 18088，绕过 Gateway，得到 `403/CONSENT_REQUIRED`。源码 `DefaultLearnerProfileQueryService` 在读取 store/shadow adapter 前执行 PEP；controller 后续 JDBC target pin 查询也未运行 | 通过 |
| 持久审计与跨服务事实 | IAM 专属表有 3 条注册后的 durable audit；只读聚合按 action code 确认 `account_registered` 1 条。源码将注册 `ACCOUNT_REGISTERED` 送入 JDBC 审计端口。注册没有发布跨服务事件；`auth.account.registered.v1` 仍为 `HISTORICAL_CANDIDATE`，Outbox/Kafka 发布缺口 OPEN，未宣称事件投递 | 通过（本地审计）；跨服务事件仍 OPEN |
| 敏感信息与边界 | 公开证据隐私扫描 41 文件、85 个已知受保护值；私钥块、compact JWT、注册 identifier 和受保护 secret 命中数均 0。密码仅到 IAM TLS 入口，私料仍在 Git 外 | 通过 |
| Child 生命周期 | 最终运行仅启动的 IAM/Gateway/learner children 全部退出；18070/18087/18088 释放，cleanupErrors=[]。没有停止或重启其他容器/进程；首轮失败也保留原始记录 | 通过 |

## 合同约束与范围判定

- [R1 卡计划](../../../../../docs/06-design/v2-980plus/redesign/dev-plan-R1.md) 的 R1-002 行界定本卡的 201、会话和无学习权限。
- [BC-002](../../../../../docs/06-design/v2-980plus/redesign/business-chains.md) 限定注册输入与 TLS→IAM 路径、201 的含义、学习能力门槛及账号存在性保护。
- [OpenAPI v1](../../../../../packages/contracts/openapi/v1/openapi.json) 的 `/api/v1/auth/register` 定义 IAM owner、18+ 公开入口、server-derived adult Gate、幂等键、Web/Native 凭据传输与 required `auth.account.registered.v1` 审计关联；[事件目录](../../../../../packages/contracts/events/v1/catalog.json) 当前将同名事件标为 `HISTORICAL_CANDIDATE`。本卡需证明实际 durable 注册审计；若没有事件发布器，要保留事件交付/Outbox 的契约运行 GAP，不得宣称事件已投递。R1-003 单独验幂等回放，故本卡只核对合同是否被调用路径遵守，不把完整重放回归当作 R1-002 的独立交付。
- [AGENTS.md](../../../../../AGENTS.md) §2.2/§3.2 要求 IAM 唯一签发 Token、服务端成人 Gate、默认拒绝、领域服务侧 PEP 及跨服务集成事实走 Kafka 兼容总线与 Outbox。
- [ADR-0010](../../../../../docs/10-decisions/0010-java25-microservices-gateway-iam.md) §2–4、[ADR-0013](../../../../../docs/10-decisions/0013-self-owned-jwt-authentication-center.md) 安全与传输条款、[ADR-0017](../../../../../docs/10-decisions/0017-access-token-eligibility-claims.md)、[ADR-0019](../../../../../docs/10-decisions/0019-consent-enforcement-on-consumer-side.md) 定义签发及消费侧资格语义；[ADR-0015](../../../../../docs/10-decisions/0015-event-transport-and-outbox-shape.md) 只在实际跨服务事件上约束 Outbox 形状/事务。

## 环境边界

本审查不启动、停止、重启或探测 Docker/Compose；不发信号、不连接数据库、不运行迁移、不读取进程环境/凭据。若负责实现的运行者提供稳定的专用环境证据，独立审查其公开收据和来源链；否则记录未验证并按实际缺口决定是否阻塞本卡。

## 验收绑定

- 最终业务运行：[runtime-results-925ac824.json](../runtime/runtime-results-925ac824.json)，状态 `PASS`；首次失败 [runtime-results-51ca8300.json](../runtime/runtime-results-51ca8300.json) 保留且仍标记 `FAILED`。
- 实际执行源码 hash 为 `9db3dc4cf3333046633319a109eb020d0163942155acf035d302f42d9c41b0a7`。当前修复 literal GRANT 的 future prepare 工具源码 `eda7075959c60f4d8a2bd133a123367f4d0e1ead6088f463a125f9966e1af570` 未作为此次注册运行源码。
- Lifecycle+业务工具运行组合 29/29；后续业务工具 GRANT 字面量测试 5/5，其中与组合重叠 4 项，不相加宣称 34 项。Gateway JWK source 测试 24/24、构建退出 0；不宣称全仓回归。
- `auth.account.registered.v1` 的 publisher/Outbox 运行证据未交付；历史 D1 TLS-01～08 未重跑；R1-003 及全平台事件、IT-1 出站与 IT-2 不属于本卡验收结论。
