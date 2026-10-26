# R1-002 首次准备包独立复核（2026-10-05）

## 决策

**签收本次只读准备成果；不签 READY。** 状态保持 PLANNED / revision27，未登记 start、REWORK 或产品验收。R1-001 当前有效 ACCEPTED，无依赖漂移。执行人遵守了本批停止点，未要求其提前通过后置产品 TC。本轮主审也未运行构建、测试、后台或数据库操作。

16份来源快照、4份允许编辑文件快照全部匹配；规格及限定 Git 快照一致。现有 IAM jar 已补采：43,852,295字节，SHA256 `5d3fcdf828d91fe8793002d99ce1ddbdca484762d84be925e408de4bd0221f3f`。这关闭 E1 的“身份未采”，不证明 jar 与所有当前源码一致或本轮已构建。Node20.19.5/pnpm10.19.0/Java25.0.4.1已实测；18087/18070/18090无监听，13306/16379/19092有监听，仅证明输入可达条件。

## 已有实现与后置验收分开

| 原缺口 | 本轮结论 | 依据 |
|---|---|---|
| G1/G2 | 源码逻辑已存在，关闭“未展开源码”疑问；实际201/JWT/principal/permissions/领域403仍待TC01 | IamProviderBoundaryController.java:621–649、832–841、1036–1051；JwtTokenService.java:91–118 |
| C1 | 当前默认12且实现有最大128/控制字符校验，隔离运行固定12；实际边界留后验 | PasswordAccountService.java:163–166；application.yaml:91 |
| G3 | R1-003完整重放验收后置；002仍须验证自己的失败恢复仅建一次 | R1-002执行卡TC03与R1-003依赖 |
| authority拒绝 | domain hasOverride并不能证明公开HTTP未知字段拒绝；现有输入尚无实际HTTP证据 | Controller.java:134传Claims.none，1237是三个字段的RegisterRequest；TC02必须真实POST |

`ServerPrincipalContext.scope()` / `TenantScope` 是tenant/subject/owner数据范围，不能称作受限JWT学习scope。学习权限在 tokenAccount→有效账号→JWT 处剥离。新用户无成人、无个人同意不等于政策控制面应全空。上表是只读确认，不记任何产品TC PASS。

## 开工输入需要补齐的内容

### 1. E2：隔离库方案需要真实迁移及正确权限

准备报告第27行建议 LIKE空表 + SELECT/INSERT，不能直接用于IAM：

- IamRuntimeConfiguration.java:162–182：持久化不能关闭Flyway；replay/fingerprint秘密均须稳定、足够长且相互独立；JDBC database必须等于iam.persistence.schema。
- 同文件247–289：应用显式组合Flyway，并核V13真实迁移历史和最终结构。直接复制最终表、伪造/复制共享history或沿用R1-001六项false启动器都不成立。新库应从现行V1、V3…V18真实迁移；只有新建独占空库、无旧writer时才可限定确认V13 writers drained。
- JdbcIdempotencyStore.java:58、97需要UPDATE；124失败撤销claim需要DELETE。因此运行身份至少需其专用schema中的SELECT/INSERT/UPDATE/DELETE；迁移权限只授予专用迁移身份并与运行身份分离，不扩大到共享schema或existing user。
- scripts/runtime/run-v2-services.mjs:144–145硬绑共享iam_service/svc_iam；scripts/database/reconcile-iam-schema.mjs:9–10/25会修改既有共享身份。不能直接调用这两条路径建立本卡隔离环境。新建证据目录中的专用迁移/直启包装器，不修改共享启动器。

### 2. E3：合成政策与用户事实必须分开

Controller.java:133在创建账号前要求发布政策。ConsentService.java:23–26、293–315要求TERMS_OF_SERVICE、PRIVACY_NOTICE、ADULT_LEARNING三个完整且当前发布的descriptor。V14只建控制表、不种文书。

本卡使用专用IAM schema内的合成测试控制面事实，显式`IAM_CONSENT_POLICY_SOURCE=control-plane`；按JdbcConsentPolicy.java:26–30、93–108核对platform/ACTIVE、合法版本/digest/requirement/capabilities/publishedAt。用户/账号/设备/会话/个人consent/成人事实初始无注册数据。迁移自带角色/权限/policy基线不要求0行；不要把“所有表0行”当注册准备要求。

local profile默认auto会选local-candidate（IamRuntimeConfiguration.java:318–343），不能把该路径冒称真实控制表输入。测试文书只服务隔离本地验收，不冒称正式法务签收，不自动给新用户同意或成人能力。

### 3. 启动与安全输入

application-local.yaml:10会把refresh Cookie Secure设为false；本卡步骤4却要求Secure。准备包仅列基本配置不足以证明有效配置，应明确本卡TLS/Secure验收入口和临时profile覆盖。密码契约明确TLS only（b8-auth-iam.openapi.json:3165）；JWT RSA签名私钥不是TLS服务器证书。没有TLS输入时如实保留该输入缺口，不用HTTP+Cookie字符串代替TLS证明。

同一新库/JDBC/schema、运行身份、Flyway、独立HMAC、RS256/issuer/audience、政策source、password-min-length=12、Cookie和端口须给出无秘密的有效配置白名单。只操作当轮身份已核对的自有进程。TC01还需要真实learning-service领域PEP的403路径；准备已登记18090端口/路由/运行方式，不以服务未启动的503或Gateway拒绝冒充领域403。

### 4. 必要Outbox与失败点需要明确承接

现有注册链有数据库事务与审计：IdempotencyService.java:91–102、JdbcAccountStore.java:28–38、JdbcAuditFactPort.java:27–46。本轮未找到IAM注册Outbox producer/table，不能将audit表叫作Outbox。

现行上位联调矩阵06:40、46、54及`packages/contracts/events/v1/fragments/m1-018-iam-v2.events.json`已经锁定canonical `iam.account.bootstrap.created.v2`，IAM→learner、Outbox、至少一次；旧B8 auth.*.v1保持historical-only，禁止dual publish。R1-002步骤3的“必要Outbox”必须据此列出现有实现差距、拟复用公共事件能力和所需精确文件扩围，交主审确认后实施；不要求准备阶段先完成producer和下游全链，也不擅自扩大到资格/策略事件或修改核心设计。

TC03准备确定性、仅影响专用验收库/测试请求的事务失败入口，后续实际核对账号/principal/设备/session/claim/必要Outbox/audit的前后数量和恢复。审计失败、DB故障、Outbox故障分别如实命名，不能只跑内存异常就宣称真实DB回滚。完整R1-003重放不在本批提前验收。

## 下一批限定准备任务

见 `next-prompt.md`：只做四项隔离输入收尾；允许新建本卡专用测试schema和新身份、执行其canonical迁移及合成fixture，不碰共享事实/既有身份。本次限定授权不是READY，也不授权业务改造或注册POST。若迁移只能通过IAM启动执行，先交`--validate`和完整配置，主审核准该自有准备实例后执行迁移；不得因这点更改共享启动器或绕过Flyway。

全部新输出版本化，不覆盖prep-report.md/source-and-inputs.json及本轮固定证据。输入收齐后主审统一签READY并核准实现文件范围，随后一次交付002，不反复重做已确认的旧实现。003/004/005仍不开放。
