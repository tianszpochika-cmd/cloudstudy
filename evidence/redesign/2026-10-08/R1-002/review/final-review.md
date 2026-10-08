# R1-002 独立终审

日期：2026-10-08　分支：`dev-redesign`　审查者：Luna max（`/root/r002_review`）

## 结论

**ACCEPTED_CARD_SCOPE / R1_002_ACCEPTANCE_PASS**。此签收只覆盖 [dev-plan-R1 的 R1-002](../../../../../docs/06-design/v2-980plus/redesign/dev-plan-R1.md) 与 [BC-002](../../../../../docs/06-design/v2-980plus/redesign/business-chains.md) 的卡级 AC：干净 owner schema 中 TLS 注册 201、主体/设备/会话与审计持久化，以及成人 Gate/必要同意前无学习能力。它不签收整套身份兼容、全局事件合同、R1-001/IT-1 或全平台 DoD。

最终运行收据 [runtime-results-925ac824.json](../runtime/runtime-results-925ac824.json) 为 `PASS`。新 IAM 库注册前六类计数均为 0，Flyway 17 个成功版本、无失败、最大 V18；独立 learner owner schema 正常执行 12 个迁移。直接向 IAM TLS 注册返回 201 与 `no-store`，同一合成主体的 principal/account/session/device 关联读回 1 组，session 为 ACTIVE。真实 IAM RS256/JWKS 验签通过（RSA 3072），token 标记 `adult_gate=NOT_EVALUATED`、`consent_state=UNKNOWN`、`phase-1/platform`、subject=owner、4 项基础权限、0 学习权限。响应 Cookie 符合 `yuxuexing_refresh`、`Path=/api/v1/auth`、正 `Max-Age`、HttpOnly/Secure/SameSite=Lax，响应 JSON 不包含 refresh token。

持久审计也有运行证据：成功后 IAM audit 计数为 3；独立聚合读回 `action_code=account_registered` 1 条。源码显示注册写入 `ACCOUNT_REGISTERED`，持久模式选择 `JdbcAuditFactPort`；审计 INSERT 故障注入后第二次注册返回 503，主体/账号/session/device/audit/idempotency 计数均与成功后相同。

Gateway 两个 HTTPS 客户端的真实正路径均为 200；错误 JWKS 信任时路由仍 200、认证 401，错误 route CA 时回源 502。受限 token 直接请求 learner-service 固定 18088 路径得到 `403/CONSENT_REQUIRED`，绕过 Gateway。源码中的 `DefaultLearnerProfileQueryService` 先执行 PEP，再访问 store/shadow adapter；未同意时不会到达 JDBC target-pin 查询。

## ACL 与安全暂停

执行时根审批绑定的业务工具 hash 为 `9db3dc4cf3333046633319a109eb020d0163942155acf035d302f42d9c41b0a7`。复核发现该版本初始 GRANT 对 MySQL schema 下划线未转义；本机 `partial_revokes=false`，因此最初的数据库授权按模式解释。根审只对本轮创建的三个测试账号收紧权限，没有更改业务数据、修改密码、重启服务或操作容器。当前读回显示三个账号各自只有全局 `USAGE` 与转义后的单一 literal owner-schema 权限，无 global write、无 `GRANT OPTION`；各自可读取 own `flyway_schema_history`（最终 IAM/learner/首轮 IAM 分别 17/12/17），另一自有 schema 被拒绝且未读到其他数据库行。该修正是运行后 ACL 收紧，不声称执行时从未出现未转义 pattern。

未来工具差量 `business-runtime.mjs` hash `eda7075959c60f4d8a2bd133a123367f4d0e1ead6088f463a125f9966e1af570` 在 `partial_revokes=false` 时转义 `_`，对应测试日志 5/5；它没有被用于本次注册运行。执行来源与运行后收紧分别绑定在 [source-manifest.json](../runtime/source-manifest.json) 和 [source-manifest-post-tightening.json](../runtime/source-manifest-post-tightening.json)。两份清单中的源文件和 [delivery-evidence-manifest.json](../runtime/delivery-evidence-manifest.json) 列出的 21 项公开证据摘要均已独立重算匹配。隐私扫描覆盖 41 个公开文件及 85 个受保护测试值，私钥块、compact JWT、注册 identifier 与已知 secret 的命中均为 0。

最终运行只关闭本次受监督的 IAM/Gateway/learner children；18070、18087、18088 均已释放且无清理错误。Git 外受保护材料与专属测试 schema 保留。没有触碰其他项目 Docker。首轮 [runtime-results-51ca8300.json](../runtime/runtime-results-51ca8300.json) 的 `FAILED/OWNED_CHILD_EARLY_EXIT` 原样保留；它因 learner JDBC 依赖未装配而提前结束，不被最终 PASS 覆盖。

## 保留的 OPEN 项

- `auth.account.registered.v1` 在事件目录仍为 `HISTORICAL_CANDIDATE`；本卡证明 IAM owner 的 `account_registered` 审计，不证明 Kafka 发布或 Outbox 投递。若后续实际发出跨服务事实，仍须按同一 owner 本地事务写 Outbox。
- 历史 PRN/身份兼容与 D3 遗留身份差量未由本次新注册关闭；未有 legacy 证据证明其已迁移，也没有把它扩展成本卡阻塞条件。
- 原 D1 TLS-01～08 矩阵、R1-003 及后续卡、IT-1 出站、IT-2 与 114 卡墙完整度均未在本次签收范围内；物理 FK 元数据也没有单独核验。

验证计数只按各自运行记录报告：Gateway JWK-source 定向测试 24/24；业务工具组合 29/29，后续 literal-GRANT 定向测试 5/5，其中 4 项重叠，不合并虚报为 34 项或全仓回归。
