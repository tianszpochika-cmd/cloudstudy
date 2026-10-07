# R1-002 专项准备工具

归档边界：`create-tls --out` 自动把私密材料路径替换为`<PRIVATE_MATERIAL_DIR>`，保留摘要与真实owner/mode验结果；stdout与Git外`transport-plan.json`仍提供执行者本机实际路径。不得原样把stdout写入可提交日志；归档既有日志/命令可显式运行`sanitize-evidence.mjs --material-dir <external material directory>`（每个本机材料目录重复一次）。该操作只处理本卡准备证据目录，不修改真实配置或普通源码路径。

`prepare.mjs`仅供准备审查；没有启动、停止、注册、迁移、repair、清库或 Outbox 写入模式。Node 20、Java 25、OpenSSL 与 keytool 使用本机已锁定工具链。新的材料不引用 Windows 私钥或 DPAPI 文件。

```sh
node --test scripts/redesign/r1-002/prepare.test.mjs
node scripts/redesign/r1-002/prepare.mjs --mode inspect
node scripts/redesign/r1-002/prepare.mjs --mode create-tls --private-parent /absolute/protected/external/parent
node scripts/redesign/r1-002/verify-binding.mjs --tls-dir /absolute/protected/external/material-directory
```

`create-tls` 要求已存在、当前用户拥有的 Git 外 0700 父目录；每次在该目录下生成独立子目录，绝不覆盖旧材料。它创建七天有效、RSA3072、SAN=127.0.0.1/localhost 的合成自签服务端证书、TLS 私钥、IAM PKCS12 和 Gateway 专用信任库。证书直接作为限定信任锚，不是生产 CA。私钥、keystore、含口令的 `iam-private.properties` / `gateway-jvm.args` 均在 Git 外且 0600。只回报公开证书摘要、路径及检查结果。创建失败留下的专用目录不作为有效启动配置，需要审查后清理；不会自动“恢复”或覆盖材料。

Gateway 路由必须使用 `spring.cloud.gateway.server.webflux.httpclient.ssl.*`；参数写在外部 `transport-plan.json`，`use-insecure-trust-manager=false`。独立 `GatewayIamPublicJwkSource` 通过裸 `WebClient.builder()` 建客户端，使用外部 `gateway-jvm.args` 的 JVM trustStore；该 argfile 必须在未来受控 Java 启动时置于 `-jar` 前。口令不能复制到命令行、共享配置、日志或证据。`iam-private.properties` 是受保护的配置导入候选，尚未被任何 IAM 进程消费；需与专用数据库/凭据、正确 profile 及发布版本一起设计受控启动。JWT issuer 仍为 `http://127.0.0.1:18087`，TLS 传输 URI 单独为 HTTPS。

`verify-binding` 提取当前 executable Gateway JAR 的公开依赖到临时目录，使用真实 Spring Binder 绑定当前属性类，验证新前缀与旧前缀负例，结束删除提取目录。它不创建 Spring context、不发 HTTP 请求。`create-tls` 的 JVM trust 检查也完全离线：专用默认信任库接受唯一测试锚、空库拒绝；这不代表 Reactor Netty/WebClient 或 Gateway 已握手成功。

Node 参数规划、Java 检查与依赖提取不硬编码 macOS 路径；本轮实测仅 macOS arm64。Unix 私密目录按 owner/mode 实测；Windows 材料创建主动拒绝，需另行实现并验证受保护 DACL/本机凭据方案，不能用 POSIX mode 冒充 Windows ACL。Windows inspect 的进程归属保持 UNVERIFIED；不要复用旧 launchers 绕开前缀和独立信任修正。

前轮历史快照中18070/18087由既有`--all` runner占用；[本轮只读preflight](../../../evidence/redesign/2026-10-07/R1-002-D1/lifecycle-harness/preflight-reviewed.json)确认两端口无listener，主审另核对原runner/四前端PID已退出。执行未停/重启，不推断退出原因。inspect只读取PID/PPID、创建时间、JAR路径与磁盘hash，屏蔽完整argv与环境。原runner没有持久启动收据或单服务停止接口，一个子进程退出会引发全栈清理；磁盘hash不能证明运行中JAR字节。冷态不解除动态窗口、source provenance与恢复责任缺口，仍不得擅停或收养其他进程。

## D1 离线生命周期与生产client probe

本轮仅批准D1离线实施。`lifecycle.mjs`默认`preflight`：读取固定端口配置与hash、具名源码快照和只读lsof监听归属；不发网络请求、不绑定端口、不发signal。CLI只接受`preflight/stage/launch-harness/probe/stop-owned/restore-verify`及具名参数，没有任意exec、收养、kill-port、kill-all或boolean维护批准选项。

```sh
node --test scripts/redesign/r1-002/lifecycle.test.mjs
node scripts/redesign/r1-002/lifecycle.mjs
node scripts/redesign/r1-002/lifecycle.mjs --mode stage --run-root /absolute/protected/external/run-parent --key-dir /absolute/protected/external/new-receipt-key-directory --material-dir /absolute/protected/external/material-directory
```

stage要求已存在、Git外、当前用户拥有、0700的run父目录；执行者预先新建0700的专用空key目录。`createReceiptKey`实际API消费已存在的目录并以`wx`创建key文件，已有receipt key即拒绝，不复用或覆盖。TLS材料须受保护。每次新建`r1-002-<UUID>`，不覆盖旧run、target或材料；receipt key是专用Ed25519，不是IAM signer。复制当前Gateway JAR到runartifact，提取该JAR实际公开classes/dependencies，用实际依赖编译`GatewayTlsProbe.java`，只运行`--offline`。artifact文件0400/目录0500；binding/receipt0600。异常中间产物留在该专用run内供owner审查，不递归删除其他run。

签名收据的artifact为`binding.json`：其hash绑定实际copied JAR、全部class/dependency/probe SHA、工具版本/hash、ports配置与source快照。消费前用外部可信公钥验证收据、精确上下文，再逐项核对实际artifact/hash/权限。dirtySha256是具名源码文件快照摘要，不是旧target构建证明；`sourceJarProvenance=UNATTESTED_CURRENT_TARGET`、`sourceToJarVerified=false`始终明确。本轮没有重新构建服务JAR，不写原target。README及toolchain说明另作非秘密文档/配置来源，不把它们当实际JAR的构建attestation。

Java probe通过实际SCG `HttpClientFactory`建立route client，直接加载当前Gateway JAR的`GatewayIamPublicJwkSource`，后者URI构造器的request Mono不订阅。离线配置/实例化只能证明class与依赖可加载、prefix/route CA绑定和真实生产parser/cache/kid选择的注入文档行为；0请求/0listener，TLS01～08全部NOT_EXECUTED。未签名SignedJWT只用于kid selector，不调用sign、不提交Bearer、不验证AccessToken。

生产source的private-JWK实际行为单独记录：synthetic RSA私钥只在离线Java进程内存生成、从不输出/存盘；如果实际source按kid返回private JWK，结果报`publicKeyOnlyProductionGap=OPEN`。harness自身publisher配置的public-only校验不能冒充生产source拒绝；不擅改服务。2秒timeout/300秒cache常量来自加载类，cache测试注入文档，不能称真实HTTP timeout或TLS动态证据。

D2当前没有维护authority trust anchor或批准窗口，`launch-harness/probe`一律先拒绝0signal/0listener/0DB；即使传伪批准boolean、自选公钥或“绿灯”fixture也不能授权。`tls-harness.mjs`没有raw listen接口，future publisher仅允许注册18087的health/JWKS GET；生产client harness固定18070，须在另行具名D2源码和窗口审查后实施动态入口。`stop-owned`独立CLI一律调用共享detached拒绝；不能因receipt、PID、出生时间看似匹配就跨CLI发signal。共享processidentity仅允许同监督进程的实际child handle，非监听toy验证由其owner执行，本轮没有stop当前runner。

`restore-verify`缺原栈恢复bundle/窗口时只拒绝，不启动runner或查询数据库；未来原栈恢复归D2维护owner。stage/stdout与`--out`归档都脱敏`<RUN_ROOT>/<RUN_DIR>/<RECEIPT_KEY_DIR>/<PRIVATE_MATERIAL_DIR>`，可执行binding留在Git外；脱敏binding/公开summary不是对应签名原文。另行归档的[staged receipt原文](../../../evidence/redesign/2026-10-07/R1-002-D1/lifecycle-harness/signed-stage-reviewed.json)和[公开验签key](../../../evidence/redesign/2026-10-07/R1-002-D1/lifecycle-harness/public-key-reviewed.json)只含公共source/run-relative artifact路径（process=null），可验证Ed25519签名，证明D1收据provenance；artifact hash对应Git外真实binding，不是脱敏副本，不能反用来授权D2或证明source→JAR构建。macOS离线实测另见本轮证据；Linux/Windows未实跑不称verified。
