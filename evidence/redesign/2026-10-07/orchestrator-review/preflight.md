# R1-001 / R1-002 独立预审

首轮审查日期：2026-10-07；分支：`dev-redesign`；基线：`ff0f8057f4088ead03ab7890493cdf9d06f6d5f1`。本报告首轮只审恢复交接、29卡候选索引、R1-002准备工具及R1-001范围；第二轮纠正项与当前结论见[第二轮独立复审](independent-round2.md)。没有触碰三处既有移动原型文档差量。

## 阶段性结论

| 事项 | 结论 | 优先级 / 边界 |
|---|---|---|
| 29卡索引 | 可签“来源导航索引交付”；29个显式计划卡、依赖与GAP被保留，未导入任何状态。 | 不可签成114卡墙恢复、逐卡映射完成或业务验收。859/0 是文档、行号、引用和结构校验数，不是产品用例结果。 |
| R1-002准备工具 | 可签“定向准备工具交付（部分）”：正确前缀、JAR内依赖绑定、合成TLS材料和离线JVM信任检查得到证据。 | 保持 `PREPARATION_PARTIAL_NOT_READY`。两条运行时握手都明确未执行；Gateway JWKS 502、身份兼容及Outbox实施范围未关闭。 |
| R1-001恢复 | 不能继承旧摘要的 `ACCEPTED`；限定搜索未找到原产品差量和独立验收原件。 | 可依据当前R1卡做新的、源码绑定的验收；标为当前复验，不称旧交付恢复。 |
| 冻结门禁 | 保持现有失败和冻结范围，不降低兼容校验、不改旧快照。 | 历史宽泛的 `DRAFT / 待审批` 文案不阻止本轮已授权的审查与准备，也不否定按R1卡实施明确范围内工作。 |

## R1-001：最小签收清单

[R1卡计划](../../../../docs/06-design/v2-980plus/redesign/dev-plan-R1.md#L12)明定官网11页“课程准备中 + 去注册CTA”，双视口HTTP 200和空态文案对稿；[BC-001](../../../../docs/06-design/v2-980plus/redesign/business-chains.md#L56)要求官网只读投影、如实区分可学/仅预览/暂无内容，禁止假价格和定级占位。当前恢复报告确认历史9月26日sweep只有22条200记录，没有task/source/reviewer/acceptance绑定或CTA与空目录证据（[recovery-report.md](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/recovery-report.md#L34-L45)）。因此最小签收应是：

1. 以实现提交和当前源哈希绑定新的复验；逐页记录计划范围内的11个路由、桌面/移动视口尺寸、HTTP结果、空态/可用内容来源和可复现命令。双视口200本身不能替代逐页语义核对。
2. `/courses`及`/pricing`、`/download`等页面反映真实公开投影；空目录用诚实空态，不虚构可学课程、价格、下载可用性或定级占位。文案通过官网共享i18n审查。
3. CTA到学习端受控`/register`入口，带受限的安全返回路径；官网不收集或代理密码，不保存/接收/转发业务Token。账号密码只由学习端直接TLS提交IAM，注册201也不代表拥有学习权限（[AGENTS.md §2.2](../../../../AGENTS.md#L57-L60)，[BC-002](../../../../docs/06-design/v2-980plus/redesign/business-chains.md#L57)）。
4. 独立复核者按R1-001验收文案、路由、CTA目标和安全不变量，留下提交、命令及结果收据；没有用户隐私、真实凭据或业务Token。

旧官网行为是9月26日之后由`8a689ec5`引入的历史状态；现有[B14用例](../../../../apps/official-site/tests/b14-fe-005.test.mjs#L62-L90)明确期待“注册登录暂不可用”和示例页CTA。R1卡现已明确新的注册CTA目标，不存在“必须继续去demo”的R1冻结禁项。保留旧B14作为旧源/旧行为快照，不修改其历史断言或旧Evidence；对新实现增加源码/提交绑定的R1验收投影或版本化当前源检查。新检查应继续保留B14可迁移的安全断言：官网无登录会话/token处理、无假免费承诺、未过门不开放学习能力、受控返回地址。若常规当前源测试仍把旧“关闭注册”当新行为唯一真值，应采用新的适用性/版本绑定测试，而不是放宽旧门禁或改旧fixture。此项是按现行卡和明确实施指令完成，不因历史通用审批文字暂停。

## R1-002：准备工具签收与READY边界

脚本明确限制为只读inspect/离线材料准备，没有启动、停止、注册、迁移或Outbox写入（[README.md](../../../../scripts/redesign/r1-002/README.md#L3-L20)）。Spring Cloud 5.0.3依赖元数据显示实际属性前缀是`spring.cloud.gateway.server.webflux.httpclient.ssl.*`，`use-insecure-trust-manager=false`（[inspect.json](../../../redesign/2026-10-07/R1-002-preparation/inspect.json#L12-L31)；工具定义见[prepare.mjs](../../../../scripts/redesign/r1-002/prepare.mjs#L8-L10)）。`verify-binding`针对可执行Gateway JAR中的真实依赖离线使用Spring Binder核验新前缀并排除旧前缀（[verify-binding.mjs](../../../../scripts/redesign/r1-002/verify-binding.mjs#L14-L29)、[binding.json](../../../redesign/2026-10-07/R1-002-preparation/binding.json#L4-L14)）。生成证书有loopback SAN；`VerifyTrust.java`只用专用trustStore本地检查“接受唯一锚/空库拒绝”，并明确无HTTP握手（[VerifyTrust.java](../../../../scripts/redesign/r1-002/VerifyTrust.java#L9-L33)）。这足以签收范围狭窄的准备工具交付，但不证明Spring应用上下文、Reactor Netty或WebClient实际信任配置成功。

两条信任路径必须分别验：Spring Cloud Gateway route client的显式测试CA属性；以及`GatewayIamPublicJwkSource`自建的`WebClient.builder()`所使用的JVM trustStore。后者不继承前者配置，argfile须在将来的受控Java启动中置于`-jar`前（[README.md](../../../../scripts/redesign/r1-002/README.md#L14-L16)）。当前`binding.json`明确两个handshake都是`false`；旧准备运行记录Gateway转发JWKS为502（[prep-4 review](../../../../evidence/p1r/m2/P1R-M2-002/redesign/R1-002/reviewer-3-closeout/review.md#L19-L31)）。`inspect.json`还确认18070/18087属于既有`--all` runner，没有可靠启动收据，工具未停服务（[inspect.json](../../../redesign/2026-10-07/R1-002-preparation/inspect.json#L35-L75)）。因此本轮不应为验证TLS停止当前runner；等有可恢复隔离环境与启动/回滚收据后再验证。

**R1-002签READY的最小条件：**

1. 在同一、隔离且可恢复的准备环境中重新核对专用IAM数据库迁移/空用户基线、IAM安全TLS配置、固定登记端口及服务构建来源；安全参数已配置不等于进程消费了它。
2. 分别通过保持主机名验证的HTTPS真实握手：IAM直连JWKS、Gateway转发JWKS、Gateway独立`GatewayIamPublicJwkSource`取JWKS；旧502在同环境关闭。Gateway route和独立WebClient任何一条未验，都不能READY。issuer仍按契约是`http://127.0.0.1:18087`，HTTPS只作为传输地址（见[prepare.mjs](../../../../scripts/redesign/r1-002/prepare.mjs#L33-L61)）。
3. 对身份提供具名、签收的表示方案：冻结事件payload要求`prn_...`（[m1-018 fragment](../../../../packages/contracts/events/v1/fragments/m1-018-iam-v2.events.json#L60-L74)）；IAM `PrincipalId.toString()`是裸UUID（[PrincipalId.java](../../../../services/iam-service/src/main/java/com/englishflow/iam/domain/PrincipalId.java#L7-L34)）。Learner只接受已验证UUID或`principal_id`中的`prn_`，并对JWT主体、存储owner做精确字符串相等（[VerifiedLearnerPrincipalFactory.java](../../../../services/learner-service/src/main/java/com/englishflow/learner/web/VerifiedLearnerPrincipalFactory.java#L38-L47)、[LearnerTenantScope.java](../../../../services/learner-service/src/main/java/com/englishflow/learner/domain/LearnerTenantScope.java#L15-L25)、[LearnerTenantScope.java](../../../../services/learner-service/src/main/java/com/englishflow/learner/domain/LearnerTenantScope.java#L40-L55)）。不能仅给事件加前缀或全局改`toString()`。决议须覆盖IAM内部UUID、JWT `sub`/`principal_id`、事件payload及envelope aggregateId、owner投影和PEP；若需改变冻结schema/身份契约，须先走正式版本化源规格更新。M1-018规定破坏性事件升级发布v3（fragment第16-19行）。
4. 在上述身份决议下签收精确Outbox实现文件范围和样例；核验event envelope/payload格式、审计decisionId复用、幂等/时间语义。按冻结契约可直接签收的口径包括`platform.iam.v1`、IAM producer、`iam.account.bootstrap.created.v2` / schema v2、同本地事务后异步至少一次及消费者去重、不双发旧B8、bootstrap状态/原因等（[outbox-proposal-4.md](../../../../evidence/p1r/m2/P1R-M2-002/redesign/R1-002/outbox-proposal-4.md#L3-L9)）。V19 migration、Kafka依赖、port/JDBC适配器、relay、运行Bean/事务装配和对应故障测试是扩围清单，须有卡/owner对精确范围签收（同文件第17-21行）；照既有ADR-0015及当前事件契约实施无需另造架构机制，但若改变事件模式、版本、身份或源schema则必须先正式更新契约并评审。审查报告和“实现时适配”不能代替签收（同文件第11-15行）。
5. 准备证据齐备后才将准备状态提升READY并开始注册实现。真实201/Set-Cookie、无学习权限、TC01-03事务/relay故障用例及受限JWT→领域403属于READY后产品验收，不要求在准备阶段提前注册；TC03文件仅是`executed:false`计划，A需证明本地事务原子性、B应保持已提交201及pending直到broker确认并按至少一次去重、C区分业务冲突和事务回滚（[tc03-plan-4.json](../../../../evidence/p1r/m2/P1R-M2-002/redesign/R1-002/tc03-plan-4.json#L1-L30)）。

当前离线证据显示运行状态仍OPEN，不存在可以签READY的网络收据。首轮审查时`privateMaterialPermissions`是固定字符串；第二轮已增加逐项`lstat` owner/mode/type读回及负例，具体范围和剩余路径脱敏项见[第二轮独立复审](independent-round2.md)。

## 29卡索引及恢复包

恢复报告在限定本机范围内未找到114卡原计划/状态工具和R1-001完整交付；明确没有把本地1/114或旧`ACCEPTED`迁移为当前状态（[recovery-report.md](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/recovery-report.md#L7-L15)、[CURRENT-PROGRESS.md](../../../../docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md#L20-L25)）。索引只对应计划当前可读的29卡，并将所有workflow state留空（[cards-29-index.md](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/cards-29-index.md#L1-L10)）；候选导航带`GAP-TRACE-SIGNOFF`，认证/成人/官网RULE源标“不适用”仍缺安全/同意政策绑定（[recovery-report.md](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/recovery-report.md#L47-L63)）。可按索引签收，但后续每卡实现仍须补齐完整契约/owner/验收映射，不能用索引当完成墙。

首轮指出的“验证器把合法进度更新当来源漂移”已由第二轮固定blob验证修复（见[第二轮独立复审](independent-round2.md)）。第二轮仍发现`build-index.py`把`CURRENT-PROGRESS.md`列作源并读取当前工作树（[build-index.py](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/build-index.py#L9-L35)）；在合法进度更新后重跑builder会无条件覆盖manifest，生成与固定`ff0f8057` manifest digest不符的混合快照。CHANGELOG不在sources中，单独更新它不会触发此问题。builder仍需改为从固定blob重建并保留原manifest，或把快照重建与当前差量报告拆开。另，恢复报告记载R1-014“14卡全绿”与IT-1全17卡范围有歧义，须由原证据或具名裁决澄清，不能改写为14卡出站（[recovery-report.md](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/recovery-report.md#L65-L73)）。

验证器自报`HANDOFF_SOURCE_INDEX_VERIFICATION_NOT_BUSINESS_ACCEPTANCE`，859 passed、0 failed；属于索引结构/来源检查（[validation.json](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/validation.json#L1-L15)），不得写成859个产品用例通过。其与历史R1-002摘要27/27匹配只证明档案完整性，不关闭502（[recovery-report.md](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/recovery-report.md#L13-L15)）。

## 26项冻结治理回归的相关性

本机验证记录保持26项失败且要求冻结D2门禁为FAIL、不得改兼容hash、自比较或调宽阈值（[local-environment-verification](../../../../docs/07-operations/local-environment-verification-2026-10-06.md#L80-L94)）。与R1-002准备交付直接相关、但不妨碍签收孤立离线工具的是：M1-008到M1-018投影、M1-018 IAM兼容，及M2-001/Gateway投影失败（同文件第109、111-112、120行；Gateway contract第113-117行）。若声称Gateway路由/owner静态投影无误，这些失败阻止该主张；R1-002单卡仍由502和身份问题独立阻塞。其余API、content、M1-009…016（除上述M1-008/M2-001）、learning-loop及placement失败不阻塞本轮工具准备或R1-001官网验收，但全局D2仍保持FAIL，不可宣称治理门禁清空（同文件第98-108、110、118-119、121-123行）。

## 下一轮放行条件

- 可立即放行：将29卡包作为来源导航索引归档；将R1-002修正后的定向工具按部分准备交付签收；按R1-001明确范围实现官网CTA/诚实空态并对新提交做源码绑定的独立复验。
- R1-002从`PREPARATION_PARTIAL_NOT_READY`转READY前：具名签收UUID/`prn_`表示方案及Outbox精确文件范围；取得两个TLS客户端分别握手且Gateway转发JWKS成功的同环境可恢复收据；核验干净专用IAM基线与安全配置。恢复索引SHA快照与当前差量的分离是接手档案质量门，不是独立IAM业务READY前置；不得停止当前`--all` runner来取代隔离环境。
- R1-001签收：当前提交与逐页/视口/内容/CTA证据绑定，目标为受控learner `/register`，保留官网不处理凭据或业务token、成人门和注册后无学习权限等安全边界。保留B14旧快照，不篡改旧结果。

本次审查只写此报告；未改服务、契约、状态、门禁或既有移动文件，没有运行服务、数据库或全量测试。
