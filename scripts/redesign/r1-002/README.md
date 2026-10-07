# R1-002 专项准备工具

归档边界：`create-tls --out` 自动把私密材料路径替换为`<PRIVATE_MATERIAL_DIR>`，保留摘要与真实owner/mode验结果；stdout与Git外`transport-plan.json`仍提供执行者本机实际路径。不得原样把stdout写入可提交日志；归档既有日志/命令可显式运行`sanitize-evidence.mjs --material-dir <external material directory>`（每个本机材料目录重复一次）。该操作只处理本卡准备证据目录，不修改真实配置或普通源码路径。

仅供准备审查；没有启动、停止、注册、迁移、repair、清库或 Outbox 写入模式。Node 20、Java 25、OpenSSL 与 keytool 使用本机已锁定工具链。新的材料不引用 Windows 私钥或 DPAPI 文件。

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

当前 18070/18087 由既有 `--all` runner 占用。inspect 只读取 PID/PPID、创建时间、JAR 路径与磁盘 hash，屏蔽完整 argv 与环境。该 runner 没有持久启动收据，也没有单服务停止接口；一个子进程退出会引发全栈清理。不要根据磁盘 hash 推断运行中 JAR 未被替换，更不能为 TLS 验证擅停当前服务。后续动态检查需要先准备可恢复的环境/收据与维护方案，并使用已登记端口。
