# D1 离线结果与下一轮最小缺口

本轮实际macOS离线stage及Java probe已通过，TLS-01～08均NOT_EXECUTED。当前18070/18087与原四前端无listener，原runner/指定PID已退出；主审独立确认此冷态。执行进程未停止、启动或重启服务，不推断退出原因；10月6日15服务快照仍仅为历史事实。

## 生产public-key-only缺口：OPEN

`GatewayIamPublicJwkSource.parseJwkSet`直接交给JWKSet.parse，`matching`仅按kid过滤，没有private拒绝或public转换。当前磁盘Gateway JAR SHA `34f13139294dead9f80cf0a4d41d43485d9cb95e0895c319ed4504b1fad66380`的真实加载类，在离线注入synthetic private RSA JWK时选择返回1条且isPrivate=true。实际输出见[stage-final](stage-final.json)的`binding.probe.documentFixtureChecks`：`publicKeyOnlyProductionGap=OPEN`。临时private JWK只在Java内存，不输出或持久化，不签JWT。

定位：[生产source](../../../../../services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayIamPublicJwkSource.java)的`parseJwkSet`和`matching`；本轮[probe源码](../../../../../scripts/redesign/r1-002/GatewayTlsProbe.java)直接调用生产select，不过滤其返回结果。harness自身public-only publisher配置检查仅是fixture入口保护，不能作为生产source拒绝证据。服务owner为Gateway/security；修复与新增服务测试不在本轮具名清单，待独立决议。未来TLS-07必须区分TLS成功、envelope/parser/kid结果和当前private-key暴露GAP。

真实加载类的注入文档检查还证明known kid缓存读1次、unknown kid返回0且重新读第2次、时钟推进301秒后读取第3次；malformed与超文档上限被拒绝。2秒请求timeout与300秒TTL来自生产常量；没有真实网络timeout、并发合并或TLS握手测量，不扩大结论。

## 从当前源绑定probe进入未来动态的最小项

1. **Source→JAR来源**：当前stage只把HEAD+61份实际公共source SHA与已审旧target JAR并列，`UNATTESTED_CURRENT_TARGET`/`sourceToJarVerified=false`。未来须在具名源码范围内构建Gateway JAR，记录构建命令exit、输入快照和输出JAR SHA，主审签收后更新限定artifact绑定；无需全局attestation平台。
2. **独立D2窗口**：当前端口FREE只是冷态事实。未来需具名owner/窗口有效期、run/source/artifact/ports精确绑定与可信批准来源，另行审查入口；本轮没有维护authority，也不生成批准收据或开放自选公钥/booleanflag。
3. **具体动态入口**：本轮launch/probe/restore是拒绝入口，Java只允许`--offline`；下一轮另签具名代码，加入18087 GET health/JWKS synthetic publisher、18070真实SCG/client probe、分别请求计数与失败分类、两client独立信任/hostname/timeout负例。任何材料权限或固定端口冲突先拒绝。无注册/Token/DB/Flyway/Kafka。
4. **同监督生命周期**：未来同一监督进程持有真实child handle，shared receipt/processidentity核对签名manifest与OS出生事实再操作；不跨CLI收养PID。新增动态必须覆盖受控退出、超时保留/无SIGKILL和端口释放，不借receipt消除PID复用风险。
5. **冷态与恢复责任**：既有runner已退出，无需专项工具替用户关旧runner；这不证明原配置/恢复bundle存在或15服务已恢复。未来原栈恢复owner、配置provider、artifact来源、IAM正常Flyway启动风险和恢复验证需另签；本工具不做全栈启动/repair。真实IAM专用运行仍另需新DB/凭据/迁移决议，不能用synthetic harness关闭真实IAM运行OPEN。

D3身份/Outbox、注册201/Cookie/领域403、干净库与READY仍未签，不开003～005/IT-2，不迁移旧业务状态。
