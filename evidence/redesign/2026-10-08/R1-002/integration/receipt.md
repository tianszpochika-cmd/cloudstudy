# R1-002 注册接口整合收据

日期：2026-10-08。分支：`dev-redesign`。来源提交：`8215c95d8ad63169a68afb997f2d7ad8bc1b9b71` + 下列具名差量。R1-002已获Luna[独立终审](../review/final-review.md)与根审签收 **ACCEPTED_CARD_SCOPE / R1_002_ACCEPTANCE_PASS**，当前 **SAFELY_PAUSED**。三个本轮新增账号的MySQL字面schema授权已收紧并验证。本收据整合验收来源，不替代独立终审。

## 范围与来源

本卡定义见 [dev-plan-R1 R1-002](../../../../../docs/06-design/v2-980plus/redesign/dev-plan-R1.md)：注册接口联调“201+会话，无学习能力”，验收“干净库注册201，token无学习权限”；来源 BC-002。用户明确要求“把1r 002完成后更新文档随后安全暂停”，同时提醒其他 agent 正初始化其他项目 Docker。本轮具名运行授权见 [最终运行审批](../runtime/run-approval.json)，首次审批 [原件](../runtime/run-approval-first-attempt.json)保留。

追溯：FEAT-USR-001 / PRD-ATOM-1044 / V2-980-0359、0366；ARCH-GW/IAM/SEC/DATA/REL/OBS；ACT-P1-VISITOR / JNY-P1-01 / PAGE-P1-AUTH-REGISTER / IC-052；RULE 成人Gate与必要同意前无学习能力；INT/E2E 注册受限会话。IAM是认证、账号、主体、设备、会话及本地注册审计的数据owner和唯一token签发者；Gateway只做路由/JWT边界与公钥消费；learner在独立schema运行自身PEP，拒绝发生在领域读取之前。所有注册密码只直达IAM TLS入口，Gateway不接收密码。

本轮生产实现仅修改Gateway JWK source及测试；其余差量是受控构建/离线/业务运行工具、公开脱敏证据和两份进度文档。未改公开契约、IAM/learner生产源码、数据库migration、端口、身份格式或跨服务事件实现。

下表为最终交付源码。运行后helper与实际执行业务源码分开记录，详见[post-tightening摘要](../runtime/source-manifest-post-tightening.json)；未改变的共享prepare.mjs仍为原SHA，不进入八项差量表。

| 最终具名源码差量 | SHA-256 |
|---|---|
| `services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayIamPublicJwkSource.java` | `54f7befee34c5e4c527bb4845b8599dac9dcd23193845fc43cee7f9472fd2489` |
| `services/api-gateway/src/test/java/com/englishflow/gateway/config/GatewayIamPublicJwkSourceTest.java` | `168f4aa7d91dcbf9cd1f329b9f3fb83c82c8ea693a96d2307a243f7abc4aefad` |
| `scripts/redesign/r1-002/GatewayTlsProbe.java` | `057a857b09f46c18e7e6409e1c21d74f400cd7c9d7035d80e0809492096b2b56` |
| `scripts/redesign/r1-002/lifecycle.mjs` | `9023abcb2db725958196f67b2651690d027606d30051a37d8f7e299326c780c1` |
| `scripts/redesign/r1-002/lifecycle.test.mjs` | `8a5c32b7cc773847c944f2f37d6b88fb0e33e23d9b697b97a3db86bb19d9ef35` |
| `scripts/redesign/r1-002/README.md` | `abd0185dd4574561fd41fbc2708fc941b9de2ec7c71ad5212de412eb9f360000` |
| `scripts/redesign/r1-002/business-runtime.mjs` | `eda7075959c60f4d8a2bd133a123367f4d0e1ead6088f463a125f9966e1af570` |
| `scripts/redesign/r1-002/business-runtime.test.mjs` | `8f77d8374011748250c4aa90796e9c3c8cfa6f96a91f498682fc5a6bcb298ea2` |

## 源码、构建与测试

[Gateway源码/构建独立审查](../review/gateway-source-build-review.md)已限定通过；[运行工具源码审查](../review/runtime-source-review.md)已给出SOURCE_SCOPE_PASS，包含learner独立JDBC库配置修复；[最终独立审查](../review/final-review.md)签收本轮卡级AC，原范围之外的缺口保留。

- Gateway完整JSON先拒RSA私参`d/p/q/dp/dq/qi/oth`、EC/OKP `d`及对称`k`，再检查parsed key.isPrivate；unknown/malformed/mixed/envelope旁路不能跳过。错误只保留固定安全文案、不保留parser cause；private文档不入缓存。边界及测试详见[task spec](../gateway/task-spec.md)。
- [Gateway构建收据](../gateway/build-receipt.json)绑定84项当前源码/pom/toolchain/共享工具输入；前后完全一致，inputSnapshotSHA为`044d1b9befc8bbbeb5c49a4a8ae88075d5cf6ba427d859123a0954b7bc776952`。Java25.0.4.1、Maven3.10.0执行精确test及clean package，均exit0；定向测试24/24、0失败/错误/跳过。JAR为73,128,627 bytes，SHA为`db67eeae844ff68b3d2d58d5668151a78bb8a02696a159260b168227b6ace1c3`，已由运行者的实际buildreceipt reader复核。
- [IAM/Learner构建收据](../gateway/runtime-builds.json)记录分别163/112项输入，构建前后不变；两模块clean package -DskipTests均exit0，不声称其全套测试通过。IAM JAR为43,847,067 bytes/SHA `fc76f6a9a69c319f7119619288f8d1b1dcf5e6470047e7bc8a82e9a2a15a8a97`；Learner为41,555,971 bytes/SHA `ea83b9d93e6fc034fddb8eded4a7c4d636ee218b965224fc4056ddea54cf5da0`。
- [离线实际probe](../runtime/offline-probe.json)验证签名、source、217项工件与source→JAR；真实生产source拒private fixture、选择数0，public/unknown kid/cache/expiry边界通过。离线probe本身没有网络、listener或业务token签发。
- [执行时组合工具日志](../runtime/tool-tests-current.log)为29/29、0失败/跳过，lifecycle25+business4；运行后最新helper的[定向日志](../runtime/business-tests-grant-literals.log)为5/5，其中四项与组合29重叠，不累加为34；没有另跑组合30。保留[早期工具试跑](../runtime/tool-tests.log)20/28、8失败的原件；其source-guard测试夹具问题修正后的日志与通过记录分开保留。这些均为定向验证，不是全项目回归。

## 实际运行与失败保留

首次 [runtime-results-51ca8300.json](../runtime/runtime-results-51ca8300.json)保持 **FAILED**。注册、Cookie、受限JWT、durable关联、故障回滚、两HTTPS正反向已通过，但learner disabled模式未装配JdbcTemplate，child提前退出，整轮不得验收。失败轮finally确认自有children退出、三固定端口释放、cleanupErrors=[]；未停Docker或其他容器。

修复仅调整运行配置：为learner生成独立新schema/凭据并用正常JDBC/Flyway启动；另建全新的IAM schema，从零重新执行整轮，不在首轮已有注册数据上冒充干净基线。首次库/材料及报告保留，不覆盖失败。最终 [runtime-results-925ac824.json](../runtime/runtime-results-925ac824.json)为 **PASS**、监督执行exit0，事实如下：

| 验收检查 | 最终实际结果 |
|---|---|
| 干净专库与正常迁移 | IAM 17个成功Flyway版本、0失败、最大版本18；注册前principal/account/session/device/audit/completed-idempotency六类计数全部0。独立Learner 12个迁移版本成功、0失败、最大版本12 |
| TLS直达IAM注册 | HTTP201，Cache-Control no-store；Web Cookie `yuxuexing_refresh`、Path=/api/v1/auth、HttpOnly、Secure、SameSite=Lax、正Max-Age；响应JSON无refreshToken |
| IAM签发与受限会话 | 外部受保护RSA3072 key，RS256公钥验签通过，issuer/audience匹配；adult_gate=NOT_EVALUATED、consent_state=UNKNOWN、tenant=platform、phase=phase-1、sub=owner；仅四项注册后白名单权限，学习权限0 |
| 持久事实关联 | account/principal/session/device实际匹配1组，成人事实PENDING、session ACTIVE；六类计数分别1/1/1/1/3/1 |
| 本地事务失败原子性 | 本次专库审计故障触发器造成第二次注册503，六类计数仍1/1/1/1/3/1，随后恢复本轮触发器；未留下第二组账号/会话或成功幂等记录 |
| 两条真实HTTPS | Gateway SCG→IAM JWKS和独立JWKS WebClient→IAM验证后转发均200；仅独立JWKS信任错误时为route200/independent401，仅SCG信任错误为route502/forwarded502 |
| 真实领域服务PEP | 携受限JWT直接调用127.0.0.1:18088 `/api/v1/learner/targets`，绕过Gateway，403/CONSENT_REQUIRED；真实Learner JDBC与独立owner schema，拒绝发生在领域adapter读取之前 |
| 清理与安全暂停 | ownedChildrenStopped=true；18070/18087状态FREE且pids=[]，learnerPortFree=true；cleanupErrors=[]。根审另行只读lsof未见三端口listener |

## 新增账号ACL收口与后续工具差量

只读检查发现MySQL partial_revokes=false，初始未转义下划线的数据库授权按pattern解释。根审仅授权对首次/最终两轮这三个本轮新账号撤销原pattern授权，按转义的单一字面schema重授原九项必要权限，不改变密码或全局模式、其他账号。[最终权限读回](../runtime/permission-readback-final.json)证明三个账号无global write/GRANT OPTION、仅对应literal schema授权、本库允许且另一自有测试库拒绝。[owner自表读回](../runtime/owner-table-readback.json)用各owner自身凭据实际SELECT自有flyway_schema_history聚合，最终IAM/learner/首次IAM成功迁移数分别17/12/17，无个人或业务明细行返回；[审计聚合读回](../runtime/readback-summary.json)核实最终IAM account_registered为1。这是运行后权限收紧与只读回查，业务写入0、服务重启0、容器生命周期操作0。

本次完整业务运行的script SHA为`9db3dc4cf3333046633319a109eb020d0163942155acf035d302f42d9c41b0a7`、test SHA为`bc21f860461176570024ca0cc0099ca17801dbb79555487155a2b88721241e7b`，绑定在最终运行审批及[执行时摘要](../runtime/source-manifest.json)中。运行后future prepare helper SHA为`eda7075959c60f4d8a2bd133a123367f4d0e1ead6088f463a125f9966e1af570`，以同一MySQL身份守卫读取partial_revokes值并生成正确字面grant；新helper只完成syntax及定向5/5，未再执行注册或服务窗口。实际运行来源原样保留，不能将新helper宣称为此前运行源码；共享prepare.mjs未改。

[公开材料扫描](../runtime/privacy-scan.json)检查41份文件与85项本次已知受保护值，已知secret、私钥块、完整access token和合成注册identifier匹配均0。扫描仅覆盖所述值和模式，不宣称通用secret检测。执行者未自行签卡，最终状态由Luna独立终审及根审确认。

## 范围判定与保留项

当前本地注册审计已durable；本请求没有跨服务publisher。历史`auth.account.registered.v1`与event审计映射、Outbox/Kafka发布及prn_ legacy/完整身份兼容缺口仍OPEN，由根审按本卡201+会话+无学习能力的定义判断其不是本次验收扩围。若后续实现跨服务事实，仍须IAM同事务Outbox及契约/发布证据，不能以本地审计替代。

本轮只核验R1-002实际卡范围。原114卡墙/状态工具及原R1-001完整验收原件未恢复，旧P1R/canonical workflow不自动迁移；IT-1全链干净库尚未出站。未执行R1-003～005，不开IT-2，不宣称全局完成率。旧D1 TLS-01～08矩阵没有全面重跑，Windows旧隔离环境未验；本机全量61skip/26治理FAIL仍为10月6日历史快照。

安全暂停仅关闭本轮自产生且出生身份/native handle匹配的IAM/Gateway/Learner children。保留首次IAM库、最终IAM与Learner两个新专库、专属账号及Git外0700/0600材料供恢复核验；未自动Drop、未重启Docker、未compose down/prune、未停止其他容器。没有收养PID或按端口杀进程。用户原有三份mobile文档差量保持，不进入本轮交付范围。

## 文档与最终签收

已同步 [CURRENT-PROGRESS](../../../../../docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)及[CHANGELOG](../../../../../CHANGELOG.md)。Luna[独立终审](../review/final-review.md)结论：**ACCEPTED_CARD_SCOPE / R1_002_ACCEPTANCE_PASS**，根审接受同一卡scope；终审文件SHA-256为`9dc2392babf6b4382784462b75f62faa12aa900c07fa5bf01fb08c8413ccaf68`。该签收只覆盖R1-002明文AC，不回写原114机器墙workflow、不关闭原R1-001历史依赖原件缺口、不使IT-1出站。按用户要求，交付后状态为 **SAFELY_PAUSED**。此收据仅整合公开脱敏证据，不包含密码、完整token/Cookie、私钥或Git外凭据路径。
