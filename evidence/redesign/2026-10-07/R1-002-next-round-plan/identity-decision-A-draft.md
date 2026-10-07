# 身份候选A最小决议草案（PROPOSED / 未批准）

独立身份review、IAM/learner owner与根审尚未签收。没有修改任何生产代码、API/schema、JWT签发、canonical事件或task-spec。原身份冲突仍OPEN。

## 拟决议条文

1. **稳定身份事实**：IAM内部 `PrincipalId(UUID)`、数据库主体键、B8 `principalId/subject.subjectId` format=uuid、JWT `sub`保持现状。新账号UUID由IAM生成；不改变PrincipalId.toString，不新增必须的JWTclaim，不重签/迁移旧token。nil UUID是审计unresolved sentinel，不得编码成真实主体/owner/bootstrap。
2. **事件表示不是新主体**：新bootstrap的event wire identity=`prn_`+内部UUID的canonical lowercase文本。codec名/版本拟为`IAM_PRINCIPAL_WIRE_V1`；encode从受验证UUID对象输出，decode只接受精确前缀+36位canonical lowercase、标准hyphen、version1～5/IETFvariant、非nil，且`UUID.fromString(s).toString().equals(s)`。新randomUUID为v4；不接受短写、uppercase、双前缀、截断、空白、Unicode近形或任意substring strip。后续v6/v7扩展需单独决议，不能默默扩regex。
3. **envelope等价**：bootstrap `payload.principalId == aggregateId == actorId == encode(createdPrincipalUUID)`；actor候选采用创建完成后的同一主体，须event治理review确认其匿名注册语义。topic/partition/schema/version/eventName保持canonical原值；eventId/occurredAt/auditId在同一本地事务固定，重发不变。`aggregateVersion=1`、PENDING_ELIGIBILITY、SELF_REGISTERED_ADULT_CANDIDATE不变。不会因wire字段兼容而发布B8 legacy事件或扩大其他IAM事件。
4. **HTTP owner唯一**：两个learner HTTP身份入口均调用同一resolver，从Resource Server已经验证的IAM JWT `sub`取得标准owner UUID。可选的 `principal_id/principalId` claim只作一致性证明：若存在，必须能decode/显式映射到同一sub；两claim互相不一致、映射与sub不一致或无可信映射均拒绝。不能一条优先映射claim、另一条直接sub。请求头/JSON/query的tenant/owner不参与resolver。
5. **legacy opaque prn_**：符合旧canonical正则却不能decode的opaque prn_不得自动strip、hash变UUID、按字符串相等跨namespace放行。只有受控、版本化、owner签收的一对一映射事实，才可解析到既有UUID；必须有来源/版本/有效期/撤销状态，不能由客户端提供，也不能依赖另一服务数据库join。最小实现先提供read-only映射port+默认拒绝adapter；本卡不创建映射身份表或新内部API。没有真实legacy映射事实就拒绝并显式记录GAP，不把synthetic测试ID当生产历史事实。
6. **legacy JWT sub/历史owner数据**：IAM当前正式签发UUIDsub，候选A不将opaque prn_改成新的正式JWTsub。若兼容盘点发现合法历史issuer已签opaque sub、或存在以prn_储存的learner owner行，必须单独签收映射/迁移与弃用策略；不能为了统一resolver直接破坏这些历史路径。没有盘点证据前，这部分保持阻断；默认拒绝策略须正式兼容review确认，而非把已有接受prn_的测试删掉。
7. **消费owner**：未来learner bootstrap consumer解析同一wire codec后，以同一UUID owner建立最小投影，并保存原eventId/wire identity/aggregateVersion以去重和审计。不得新建同主体另一份prn_ owner投影，也不得跨服务SQL查询IAM。bootstrap只说明存在待资格主体，不能据此赋学习权限或创建已通过Gate的画像。实际consumer/outbox/Kafka签收另列任务，本决议最多覆盖纯映射/投影边界fixture，不能宣称learner全量联调已验收。
8. **资格与策略边界**：resolver不签Token、不授role/permission、不修改tenant/phase/adult_gate/consent/account_status，不放宽已有服务侧PEP。通过owner等价检查之后仍检查已验证IAM issuer/audience/RS256、server-derived tenant=platform、Phase1、当前撤销/版本化policy、本地资源owner与必要成人/同意事实。任何来源/撤销/政策版本不确定均fail closed；“能映射身份”不能替代PDP或资格判定。既有cookie/native安全存储边界不随codec改变。

## 最小具名代码范围候选

为避免新增共享Java模块/BOM或跨服务依赖，两个服务各保留本地codec实现，通过同一**非秘密 golden vector fixture**约束等价。不得把IAM entity共享给learner。

| 文件 | 拟变化 |
|---|---|
| `services/iam-service/src/main/java/com/englishflow/iam/domain/CanonicalPrincipalWireId.java`（新） | encode/decode严格canonical规则；不修改PrincipalId |
| `services/iam-service/src/test/java/com/englishflow/iam/domain/CanonicalPrincipalWireIdTest.java`（新） | roundtrip/负例/golden vectors |
| `services/iam-service/src/test/java/com/englishflow/iam/auth/JwtTokenServiceTest.java` | 明确sub仍UUID、无新增必须映射claim、资格拒绝claims不变 |
| `services/learner-service/src/main/java/com/englishflow/learner/security/CanonicalPrincipalWireId.java`（新） | 相同wire codec规则，仅服务本地值转换 |
| `services/learner-service/src/main/java/com/englishflow/learner/security/LegacyPrincipalMappingPort.java`（新） | read-only、版本化mapping结果或拒绝；不可提供write或客户端输入mapper |
| `services/learner-service/src/main/java/com/englishflow/learner/security/RejectingLegacyPrincipalMapping.java`（新） | 默认opaque拒绝，无新schema/API |
| `services/learner-service/src/main/java/com/englishflow/learner/security/VerifiedOwnerIdentityResolver.java`（新） | 已验证JWT sub与可选claims的一致性，只返回canonical UUIDowner |
| `services/learner-service/src/main/java/com/englishflow/learner/web/VerifiedLearnerPrincipalFactory.java` | 用resolver取owner；保留既有权限/同意处理并对不一致身份拒绝 |
| `services/learner-service/src/main/java/com/englishflow/learner/web/LearnerHttpPrincipals.java` | 同resolver；提供显式resolver参数的静态overload，不引入mutable全局mapper；保持现有tenant/role/permission/成人/同意拒绝 |
| `services/learner-service/src/main/java/com/englishflow/learner/web/LearnerHttpConfiguration.java` | 实际factory装配入口：装配resolver+default mapping port，注入factory与两个静态helper调用方；不启用新consumer |
| `services/learner-service/src/main/java/com/englishflow/learner/web/B25LearnerJdbcController.java`、`TargetPinController.java` | 两个现有requireLearningAccess调用点显式传同一注入resolver；只调整身份依赖，不变更路由/业务/SQL |
| `services/learner-service/src/test/java/com/englishflow/learner/security/VerifiedOwnerIdentityResolverTest.java`（新） | claims/sub/legacy mapping/mismatch/tenant隔离 |
| `services/learner-service/src/test/java/com/englishflow/learner/web/LearnerHttpPrincipalsTest.java`、`VerifiedLearnerPrincipalFactoryTest.java`（新或确认现有） | 两入口同JWT→同UUID owner，原401/403与PEP语义保留 |
| `evidence/redesign/<date>/R1-002-identity/golden-vectors.json`（新） | 仅合成UUID与wire ID，codec版本+双方一致性；不是源规格 |

注册创建事实与Outbox emitter连接仍属于待签收Outbox清单：`PasswordAccountService.java`、`IamProviderBoundaryController.java`等只有在精准scope/事务设计批准后才能调用codec产生事实。此处不预授权任何Outbox写入、迁移或完整consumer新增文件。

## ADR与兼容门禁

- 必须新增身份边界ADR；**不抢占数字编号**，建议文件slug `iam-canonical-event-principal-uuid-mapping`，编号由根审在实施时分配。须引用ADR0012/0013/0017/0018/0019与M1-018 canonical冻结，描述新wire表示、内部UUID、owner解析与legacy拒绝风险。
- A本身不需要改B8 OpenAPI UUIDschema或M1018 prn_正则；需要在ADR、task-spec、事件mapping规范和review evidence中说明表示等价。若实现发现必须增加JWTclaim、新mapping API/schema、改变canonical正则或opaque弃用响应，必须先走正式契约变更，不能继续假定“schema unchanged”。
- 正式冻结兼容检查须原样跑：`tests/p1r/p1r-m1-018-iam-compatibility.test.mjs`、auth契约checker与canonical事件checker；当前既有治理FAIL不能改expected/hash来吞掉。只允许具名批准的additive/source-binding变化，原canonical manifest不升级。
- legacy盘点仅统计受控事实与样本摘要，不提交真实主体ID或token；必须区别已正式issuer生成记录与mock/seed造的prn_。无法证明无真实legacy流量不等于可直接删兼容行为。

## 身份测试矩阵（计划，未执行）

| TC | 验收要求 |
|---|---|
| ID-01 canonical roundtrip | encode(UUID)==prn_UUID；decode(encode(UUID))==UUID；两个服务同goldenvector；nil/lenientUUID/uppercase/前后空格/双prefix/不支持版本/Unicode拒绝 |
| ID-02 unchanged JWT/API | IAM实际签发unit保持sub和B8subject UUID；RS256/issuer/audience/kid及资格拒绝claims不变；不新增必须claim |
| ID-03 factory equality | 同一经过ResourceServer验证的JWT分别进两factory→同UUIDowner；可选claim缺省/正确/双claim同值分别通过；mismatch/opaque无mapping统一拒绝 |
| ID-04 legacy map | 受控测试port显式一对一opaque→UUID可解析，过期/撤销/版本不明/一对多/逆向冲突拒绝；请求body/header伪mapping无效；defaultadapter始终拒绝opaque |
| ID-05 owner isolation | UUID_A不能读owner_B；prn_A wrapper不改变owner；tenantB拒绝；不通过alias跨owner/跨tenant串库 |
| ID-06 canonical sample | 完整approved envelope+payload schema校验；aggregate/actor/payload一致；traceId32hex/requestId字母开头；非法裸UUIDpayload、私密字段、actor mismatch拒绝 |
| ID-07 projection consistency | synthetic bootstrap decode→UUIDowner与两HTTP factory相同；重复eventId不新建第二owner；PENDING_ELIGIBILITY不授学习权限。先纯边界fixture，真实Kafka/DBconsumer另签 |
| ID-08 PEP fail closed | mapping成功但Gate未过/consent撤回/phase错误/policy或revocation不确定仍拒绝；映射失败不降级为空列表或另一个owner |
| ID-09 compatibility inventory | 原合法legacy样本明确迁移/映射或正式弃用；原schema/freeze测试无静默改阈值；无法证明样本来源则OPEN |

根审签收需明确：选择A或另案；codec版本/UUID集合；actor语义；legacy映射default拒绝是否获得兼容批准；两个factory与consumer映射的具名scope；ADR及canonical检查标准。任一缺项不宣称身份冲突关闭，不签READY。
