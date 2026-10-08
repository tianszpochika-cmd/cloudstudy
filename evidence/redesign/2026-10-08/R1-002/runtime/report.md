# R1-002 干净库注册受限会话 — 本轮运行交付

2026-10-08；源码 HEAD `8215c95d8ad63169a68afb997f2d7ad8bc1b9b71` + 具名差量。本报告为执行事实，待独立终审，不自己升级父卡或 IT-1。范围依据 `dev-plan-R1` 的 R1-002/BC-002：TLS 直达 IAM 注册 201、账号/会话持久、未过成人门/必要同意不得取得学习能力。

最终 [runtime-results-925ac824.json](runtime-results-925ac824.json) **PASS / command exit 0**。根审 [run-approval.json](run-approval.json) 绑定 script SHA、两专属 schema、MySQL ID、固定loopback端口与有效期；材料 [prepared-0fcf31a0718c.json](prepared-0fcf31a0718c.json) 只归档owner/mode与公开证书摘要。

| 验收点 | 当前实际结果 |
|---|---|
| 干净库 | 新 IAM owner schema 正常17迁移、最大V18、无失败；principal/account/session/device/audit/completed-idempotency 六计数全部0。独立learner owner schema 正常12迁移、最大V12、无repair |
| 注册 | 合成identifier/password/device经 `https://127.0.0.1:18087/api/v1/auth/register` 直接提交IAM，201，Cache-Control no-store。Gateway不接收密码 |
| 会话与审计 | 六计数为1/1/1/1/3/1；account→principal→session→device 同一主体的逻辑关联读回1组，tenant=platform，成人事实PENDING，session ACTIVE；不声明物理FK约束已验证 |
| Cookie | yuxuexing_refresh，Path=/api/v1/auth，HttpOnly/Secure/SameSite=Lax，Max-Age>0；JSON无refreshToken。真实凭据仅内存/受保护文件，不归档 |
| Token | 外置本机测试RSA3072持久 signer，实际公钥RS256验签；NOT_EVALUATED/UNKNOWN，phase-1/platform，UUID subject=owner；只有iam.self.read/write、learner.profile.read/write四项发行权限，0学习能力；无人工签发token |
| 服务侧拒绝 | 同一真实IAM token直达 `http://127.0.0.1:18088/api/v1/learner/targets`，403 `CONSENT_REQUIRED`；绕过Gateway，真实领域Resource Server+域PEP先拒绝，JDBC owner配置已正常启动，未制造学习源事实 |
| 事务失败 | 只在专属IAM库建立一次审计INSERT故障trigger，第二合成注册503；六计数全部与成功后相同，无孤立principal/会话/账号。已删除本次trigger |
| 两HTTPS client | Gateway真实SCG回源JWKS 200 + 独立生产JWKS WebClient验JWT后principal读回200；错误独立JVM信任时SCG仍200而鉴权401；错误routeCA且正确JVM信任时回源502，已鉴权请求的回源同为502。分链记录，不以route信任代替JWT client信任 |
| 暂停 | 同监督实际nativechild handle与出生身份守卫，仅关闭本次IAM/Gateway/learner；所有child已退出，18070/18087/18088释放，cleanupErrors空。专属库与Git外材料保留，Docker/container生命周期无操作 |

## 实际运行源码与构建来源

- `business-runtime.mjs` SHA `9db3dc4cf3333046633319a109eb020d0163942155acf035d302f42d9c41b0a7`；test SHA `bc21f860461176570024ca0cc0099ca17801dbb79555487155a2b88721241e7b`，根审与Luna具名source scope通过后执行。
- Gateway [build-receipt.json](../gateway/build-receipt.json)：Java25精确生产测试24/24、clean package exit0，完整输入构建前后相同；JAR SHA `db67eeae844ff68b3d2d58d5668151a78bb8a02696a159260b168227b6ace1c3`。
- IAM/learner [runtime-builds.json](../gateway/runtime-builds.json)：仅各模块当前源码clean package -DskipTests，退出0；输入/JAR来源已核，不把skip-tests包装称为完整测试。IAM JAR SHA `fc76f6a9a69c319f7119619288f8d1b1dcf5e6470047e7bc8a82e9a2a15a8a97`；learner JAR SHA `ea83b9d93e6fc034fddb8eded4a7c4d636ee218b965224fc4056ddea54cf5da0`。
- [offline-probe.json](offline-probe.json)：新Gateway真实class CodeSource/217工件摘要/源构建收据验证；synthetic private-bearing document被生产类精确拒绝，返回私钥0，cache/kid/解析/上限边界实测。source→JAR已绑定；此离线证据不替代实际HTTPS结果。
- [tool-tests-current.log](tool-tests-current.log) 为实际运行源码工具定向测试：lifecycle25+business4，共29项，非全仓回归。前轮工具组合28与后续business4有重叠，不相加成32。

## 保留失败与范围

首轮 [runtime-results-51ca8300.json](runtime-results-51ca8300.json) 原样 **FAILED**：注册/Cookie/受限token/逻辑持久关联/回滚/Gateway分链均通过，learner disabled配置因无条件TargetPinService缺JdbcTemplate早退。已按源配置规则改专项工具为独立learner JDBC owner schema；首轮已注册IAM库、材料、审批 [run-approval-first-attempt.json](run-approval-first-attempt.json)保留，最终验收来自另外新干净IAM库。未清除首轮事实、未修production来绕过guard。

第一工具组合 [tool-tests.log](tool-tests.log) 因D1共享receipt拒绝未tracked的新业务工具源失败；只把D1真正消费的离线源码列入其签名snapshot，business工具由本轮根审单独SHA绑定，没有放宽shared receipt/process guard。随后工具PASS记录保留。

未进行R1-003/004/005、成人门提交、同意发布、学习画像、Outbox新增/全平台Kafka、IT-1出站或IT-2。原D1 TLS-01～08矩阵仍历史NOT_EXECUTED；本次记录具体真实HTTPS正负路径，未把计划八项写为全绿。其他项目Docker初始化未被干预；原114墙/R1-001完整历史原件及D3身份兼容研究缺口不由本次卡级运行关闭。

## 运行后权限收紧与当前工具差量

本次业务 PASS 实际执行源码为 `9db3dc4cf3333046633319a109eb020d0163942155acf035d302f42d9c41b0a7`，其审批、原始 PASS/FAILED 日志与 [执行时源码摘要](source-manifest.json) 保留。当前未来 prepare helper 源码为 `eda7075959c60f4d8a2bd133a123367f4d0e1ead6088f463a125f9966e1af570`；该后续差量没有再次执行注册或服务窗口，不能反写成业务 PASS 的执行源码。

只读检查发现 MySQL `partial_revokes=false` 时初始未转义下划线的数据库授权按 pattern 解释。根审批准只对本次创建的三个测试用户撤销原 pattern、授予转义后的单一 literal schema 同九项权限；密码未变，无业务写入/服务重启/容器生命周期操作。当前 [permission-readback-final.json](permission-readback-final.json) 核实三个用户无 global write/GRANT OPTION、只持有对应 literal schema 权限，本库允许且另一自有测试库拒绝。[owner-table-readback.json](owner-table-readback.json) 用各 owner 自身凭据实际 SELECT 自有 flyway_schema_history 聚合，最终IAM/learner/首轮IAM分别17/12/17，未返回个人或业务行。[readback-summary.json](readback-summary.json) 单独核实最终 IAM 的 account_registered 审计聚合为1；此逻辑关联与聚合不代表数据库外键约束元数据核验。

当前 prepare 使用源于同一 MySQL identity guard 的 partial_revokes 值生成正确 literal grant scope；仅本轮 business-runtime 工具及其定向测试变更，历史共享 prepare.mjs 原样保留。新增 literal scope 测试 [business-tests-grant-literals.log](business-tests-grant-literals.log) 5/5、syntax exit0；执行时组合29项与当前business5项的4项重叠，不相加称34，也未另跑组合30。最新文件摘要见 [source-manifest-post-tightening.json](source-manifest-post-tightening.json)，公开材料扫描见 [privacy-scan.json](privacy-scan.json)。所有材料以 DELIVERED_FOR_INDEPENDENT_REVIEW 交付，签卡由独立审查者/根审决定。
