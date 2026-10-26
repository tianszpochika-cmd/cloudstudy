# R1-002 输入收尾：四项任务，不实施业务改造

接续Cloudstudy dev-redesign。读取本目录review.md和R1-002现行执行卡。状态应为revision27、001有效ACCEPTED、002…005 PLANNED；以实际内容为准，有漂移先报告。现有准备报告/收据/证据不可覆盖。主审已补采IAM jar身份，已确认受限权限逻辑和默认密码边界源码，不重复请求owner提供E1/G1/G2/C1，不把这些静态结论当TC PASS。

## 任务1：建立IAM专用迁移基线

限定允许新建一个`r1_002_iam_*`测试schema和新建本卡专用身份；所有DDL/fixture只在该新库，禁止共享iam_service或既有用户的ALTER/GRANT/清理。

从现行V1、V3…V18真实迁移，保留合法history/checksum；不复制最终表/共享history或伪造SUCCESS。新库无旧writer的证明与V13 writer-drained条件要记录。运行身份仅对该新schema拥有实际所需DML（SELECT/INSERT/UPDATE/DELETE）；迁移身份所需DDL与运行身份分离。输出新库/身份/权限/迁移版本与结构哈希、零账号/设备/session/个人consent基线；迁移角色、权限和policy种子不要求0行。

禁止直接运行硬绑共享库的reconcile-iam-schema或run-v2-services。在本卡证据目录新建专用脚本。若迁移必须通过启动IAM执行，先交仅静态`--validate`及有效配置，等待主审核准准备实例；本批不自行启动业务服务或POST注册。

## 任务2：准备可执行的隔离启动方式

JDBC database、iam.persistence.schema和专用身份完全对应；明确Flyway开启，不能复用R1-001关闭Flyway的包装器。独立稳定replay/fingerprint秘密只在进程安全环境，固定password-min-length=12。RS256密钥、issuer/audience、政策source、Cookie、端口均做脱敏白名单核验。

说明TLS/Secure的真实验收入口；local默认Secure=false不能作为本卡通过证据，JWT私钥也不是TLS证书。现有TLS输入缺失时给最小配置方案供主审签收，不擅改全局端口/协议登记，不用HTTP冒充TLS。

列出TC01真实领域PEP403所需learning-service:18090/Gateway:18070/IAM:18087的最小启动与安全配置；只准备拒绝路径，不提前开发学习业务、不操作共享进程或数据库。不能将401/404/503冒充403。

## 任务3：建立合成政策fixture

仅在专用新库准备TERMS_OF_SERVICE、PRIVACY_NOTICE、ADULT_LEARNING三类完整、当前发布的合成政策descriptor，字段与JdbcConsentPolicy/ConsentPolicyDescriptor一致。固定IAM_CONSENT_POLICY_SOURCE=control-plane并只读验证其来源，不用local-candidate冒充持久化控制面。

新用户保持无成人判定、无个人同意、无学习能力。测试文书标本地合成用途；identifier/device/测试时钟可归档，密码仅运行时生成，不落证据。记录fixture内容摘要/版本/源哈希，不需要先注册账号，不写共享事实。

## 任务4：一次性交输入包与必要扩围提案

新增prep-report-2.md、source-and-inputs-2.json和脱敏commands-2.log。四Gate写准确scope、已取得证据/缺口，不自行READY/start/ACCEPTED。

必须补：
- corrected术语：TenantScope是数据owner范围，受限JWT由tokenAccount→JwtTokenService完成；HTTP附加字段拒绝留真实TC02，Claims.none不是HTTP证据。
- 必要Outbox承接：按M1-018的iam.account.bootstrap.created.v2，列出现有缺失、公共能力复用、拟增加/修改的精确文件及本卡事务失败验证点。旧B8 v1不得dual publish，audit不能冒充Outbox。只提案，不实现，不要求先做完producer才交输入包。
- TC03列可控、可还原、仅作用新库/测试请求的真实DB/必要Outbox失败方式与owner读回；不提前执行，不扩大为003全部重放。

交主审统一签READY及实现边界后才实施002并交REVIEW；003/004/005继续等待各自依赖。遇到具体输入限制给唯一最小解阻条件，避免泛写“等owner”。
