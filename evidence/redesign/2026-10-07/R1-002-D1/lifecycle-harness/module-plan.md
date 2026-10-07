# D1 模块接口方案

方案状态：具名D1授权内实现草案；共享receipt/processidentity exports待执行进程对齐。动态D2不获授权，不生成根审批准收据。

- `lifecycle.mjs`：导出CLI解析、固定ports读回、source snapshot、artifact绑定/stage/verify、D2 gate与有限dispatch；默认preflight只读。stage从显式source file list及dirty allowlist记录hash，当前HEAD与实际磁盘JAR并列，不能把旧target等同本轮source构建。复制当前Gateway JAR并提取其公开类/libs到Git外独立runartifact，编译Java probe至run目录，最终0400/0500只读并签名stage receipt。构建来源未获独立attestation时只能离线诊断artifact，动态入口拒绝。
- `receipt.mjs`（其他owner）：签名/验证canonical receipt、外部目录与runId守卫、owner/mode检查、公开归档摘要。lifecycle必须复用，不能以自签run receipt授权维护窗口；root窗口trust anchor须由独立批准输入给定且绑定精确run/source/artifact/ports/有效期。
- `process-identity.mjs`（其他owner）：活进程只读身份和本监督进程ChildProcess handle守卫；lifecycle stop-owned只调用共享模块，不发裸PID信号，不收养无收据旧runner。
- `tls-harness.mjs`：纯配置schema/危险项拒绝、synthetic publisher未来入口、公开响应边界、TLS01～08计划状态。无module-import自动启动；当前D1调用gate仅返回拒绝。所有监听需要调用者已通过可信D2门禁并绑定run/端口，不接受任意URL/端口/命令。
- `GatewayTlsProbe.java`：与生产 `GatewayIamPublicJwkSource` 同包，直接加载当前Gateway JAR真实类；通过SCG `HttpClientFactory`构建route client，独立source通过已有StringURI构造器。`--offline`仅实例化/验证绑定与实际class来源，不发送请求/建server；未来动态明确传递已审批配置。两client结果分别记录，不相互冒证，未签名SignedJWT只作为kid selector，无sign或Bearer请求。

stage/receipt职责边界：snapshot包括HEAD、sourceHashes、dirtyAllowlist、portsSha、Java path/version/hash、Gateway JAR sha/bytes、dependency/class sha。stage不声称重新构建业务JAR：本轮编译的只是probe，实际client class来自已绑定旧JAR；缺source→JAR provenance为动态阻塞，不以时间戳推断。源码new dirty摘要不读env或私钥。真实路径仅Git外；报告使用 `<RUN_ROOT>` / `<RUN_DIR>` / `<PRIVATE_MATERIAL_DIR>`。

restore-verify只比较签名恢复声明与具名快照，不启动runner、不读取env、不连接健康或DB；当前未获原栈恢复bundle时明确拒绝。未来恢复生命周期继续由D2维护owner负责，本工具无全栈控制能力。
