# IAM 成人 Gate 与法律文档版本链：非本地环境静态审计

审计日期：2026-09-23。范围为当前源码、B8 契约、Phase 1 旅程和 `clyunedev` Compose 配置。此项没有调用认证接口、查询数据库、读取凭据、重启服务或部署容器，因此下面的 HTTP 结果是按代码分支推导，**不是非本地运行实测**。

## 结论

**P0：当前代码无法让非 `local`/`test` 环境中的新成人完成“注册 → 成人 Gate → 必要同意 → 学习”闭环。** 即使认证与同意文档均已正确部署，成人 Gate 仍会拒绝所有正常新用户。用户提交的出生年只在本地自述开关下转成所谓年龄证据；非本地环境禁止启用该开关，仓库里没有其他生产年龄证据入口。

法律文档另有独立的 **P1 版本链缺口**：IAM 非本地环境只接受数据库中 `ACTIVE` 的发布文档，迁移不预置任何行，也未找到正式的发布写入入口；官网 `/privacy`、`/terms` 为静态文案，学习 Web 和移动端用固定的 `b30-consent-v1` 提交同意，未展示或读取 IAM 当前的文档版本和摘要。若上线文档版本变化，两端会得到版本冲突；若未发布，相关 IAM 读取/写入会失败关闭。

## 逐步链路与证据

| 步骤 | 当前源码事实 | 非本地结果或风险 |
|---|---|---|
| 注册并签发初始会话 | `IamProviderBoundaryController.register` 创建账号后调用 `establish`，其签发 JWT 时调用 `eligibilityClaims`；后者计算所有五类同意描述符。见 `services/iam-service/src/main/java/com/englishflow/iam/web/IamProviderBoundaryController.java:121-134,809-821,981-995,1012-1015`，`ConsentType.java:7-12`。 | 无已发布同意描述符时 `JdbcConsentPolicy.descriptor` 抛 `POLICY_UNAVAILABLE`，HTTP 映射 503。账号写入是否回滚未做运行验证，不能声称注册成功。即使发布后注册可用，初始会话仍是受限状态。 |
| 成人 Gate | `/iam/adult-gate` 在 `localAdultGateEnabled=false` 时直接抛 `ADULT_AGE_EVIDENCE_MISSING`，映射 HTTP 403；仅在开关开启时用请求中的 `birthYear` 生成 `local-development-attestation`。见 `IamProviderBoundaryController.java:346-382,1125-1143`。 | `application.yaml:60` 默认关闭。`IamRuntimeConfiguration.java:192-197` 禁止非 `local`/`test` 启动时开启。当前生产代码中的 `TrustedAgeEvidence.fromServerAttestation` 唯一调用点就是此本地分支；没有可信年龄事实接入。 |
| 必要同意 | 非本地 `auto` 来源选择 `JdbcConsentPolicy`，只选 `iam_consent_document_version` 的 `ACTIVE` 行；缺行或坏行失败关闭。见 `IamRuntimeConfiguration.java:318-347`、`JdbcConsentPolicy.java:24-29,39-47,65-79`。 | V14 迁移明确不预置发布行；仓库搜索到对该表的 `INSERT` 仅在测试代码。需要受控发布五类当前文档，才能支撑 `consentState` 对所有类型的读取；其中 `TERMS`、`PRIVACY`、`ADULT_LEARNING` 是学习必要同意。见 `V14__create_iam_consent_document_control.sql:1-34`、`ConsentService.java:154-175`。 |
| 官网与客户端展示 | 官网 `PublicDocument.vue:19-53` 从 `experience-content.ts:202-224` 渲染静态摘要，没有版本、摘要或 IAM 发布记录引用。学习 Web `OnboardingPage.vue:120-128`、移动端 `onboarding.vue:120-123` 只显示同意文字，没有到 `/privacy`、`/terms` 或版本化全文的链接。两端同意请求见 `apps/learner-web/src/api/learner-content.ts:465-488`、`apps/mobile/src/api/learner-content.ts:258-269`。 | 两端固定提交 `b30-consent-v1`，不读取当前版本或附带可选 `expectedDocumentDigest`。IAM 会核对版本、可选摘要，版本不一致为 409；但当前界面无法证明用户看到的是 IAM 所记录的同一文档。B8 契约把 `expectedDocumentDigest` 定义为**可选**，不是必填。见 `packages/contracts/fragments/b8/b8-auth-iam.openapi.json:4176-4218`、`ConsentService.java:99-104,290-295`。 |
| 学习准入 | JWT 签发前的 `tokenAccount` 在成人 Gate 与必要同意都具备之前剥离大多数学习权限。见 `IamProviderBoundaryController.java:605-631`。 | 失败关闭本身正确；但它也意味着当前生产新用户无法完成正常学习。不能把本地 `local`/`test` 的成人自述通过当成生产验收。 |

Compose 证据：`infra/docker/clyunedev/docker-compose.core.yml:120-155` 配置了持久化 IAM、真实签名密钥及非本地部署所需参数，没有设置 `SPRING_PROFILES_ACTIVE=local/test` 或 `IAM_LOCAL_ADULT_GATE_ENABLED=true`；full overlay `docker-compose.full.yml:74-76` 也没有补充成人证据来源。因此此配置下上述 Gate 403 分支成立。`application.yaml:60-66` 的同意来源默认 `auto` 会选择数据库发布表。

设计冲突：Phase 1 旅程 `docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md:52,59-60` 要求新成人从注册进入服务端 Gate，再进入同意；B8 契约 `packages/contracts/fragments/b8/b8-auth-iam.openapi.json:3898-3934` 明确 `birthYear` 只是客户端断言，不能单独授权。当前代码的非本地拒绝符合安全原则，但生产闭环尚未实现。

## 最小可实施闭环

1. **确定可信年龄证据的来源和使用边界。** 需要可由 IAM 验证真实性、主体绑定、时效和防重放的服务端证据；可以是经批准的外部核验结果或受控人工核验事实。`birthYear` 与勾选仅保留为用户断言。选型、数据最小化、保留期和失败/撤销规则需由产品与合规责任人确定；现有仓库没有一个可安全默认采用的生产证据源。
2. **在 IAM 建立受信接入与持久事实。** 从服务端受信通道取得证据，绑定已认证 principal，再调用成人判定与 `AdultGateFactStore`；记录可审计的证据摘要、来源、验证时刻、策略版本与重核条件。无证据、伪造、过期、未成年或验证服务不可用都拒绝，并覆盖幂等、并发、撤销和签发后权限变化。根据最终接入方式更新契约/ADR，不能改成开放客户端上传“已验证”布尔值。
3. **发布同一份版本化法律全文。** 建立受控审核与发布流程，为 IAM 的五类文档写入经批准的 `ACTIVE` 版本、SHA-256 摘要和元数据；官网公开可读的版本化全文必须与 IAM 摘要一一对应。新用户应可读取当前版本与全文；两端显示链接和版本，提交与其实际阅读版本一致的 `version`，建议同时发送 `expectedDocumentDigest`。版本更新后客户端回读并要求重新确认，不能继续固定 `b30-consent-v1`。
4. **做一次非本地真实环境闭环验收。** 使用新账号完成注册、可信年龄核验、三项必要同意、令牌刷新、学习入口和撤回；并覆盖无证据/未成年、缺少发布文档、版本更新、不同步摘要、撤回后新令牌拒绝。另核实原生 iOS/Android 形态：当前 `IAM_NATIVE_TRANSPORT_POLICY=deny` 默认拒绝 `NATIVE_SECURE_STORAGE`，生产原生注册/登录也需要独立可信设备证明接入，见 `application.yaml:67-71`、`IamProviderBoundaryController.java:584-599`。

**验收状态：BLOCKED / NOT_RUNTIME_VERIFIED。** 以上为源码与配置审计，不代替 Docker 非本地运行、真实年龄证据供应链、发布文档记录及浏览器/原生端人工验收。
