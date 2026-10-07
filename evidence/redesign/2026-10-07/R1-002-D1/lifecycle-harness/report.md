# R1-002 D1 生命周期/harness离线交付

交付状态：D1_SOURCE_AND_OFFLINE_RESULT_FOR_REVIEW，待Luna max独立审查；不签READY、workflow ACCEPTED或D2/D3。基线`dev-redesign`/`2ffa2eb2794b32e9f51ee7a1ac5ac4834ec5b7fb`。执行范围与追溯见[task-spec](task-spec.md)，模块边界见[module-plan](module-plan.md)。本进程只写具名五文件与本目录；receipt/processidentity由另一执行owner交付，不互写。

## 准备通过项

- [21项最终定向测试](lifecycle-tests-context-review.log) exit0；[语法检查](syntax-context-review.log) exit0；真实CLI launch/probe/restore/boolean批准参数拒绝exit1，均无signal/listener/DB。测试中的占用端口、过期窗口与other-platform是fixture输入，不是真实维护/TLS或跨平台运行。
- [最终只读preflight](preflight-reviewed.json)为macOS，18070/18087无listener；主审独立核对原runner与前端PID已退出。执行未停/启动/重启服务，不推断退出原因，不写成15服务仍运行。
- [最终stage](stage-reviewed.json)离线编译probe及执行exit0：61份实际公共源码快照、ports配置、已审磁盘Gateway JAR、工具版本/hash和217份copied JAR/classes/dependencies/probe工件绑定。实际protected材料owner/mode读回、0400/0500工件与签名完整manifest核验通过。Git外独立run/key，不覆盖target/原材料，不读活进程env。
- [可验签staged receipt原文](signed-stage-reviewed.json)+[公开key](public-key-reviewed.json)只含公共source、run-relative artifact和process=null；签名证明本run收据完整性。其artifact SHA对应Git外真实binding，脱敏stage/binding副本不能作为签名原文或可执行配置；不是根审维护批准key，不能授权D2。
- `verifyStagedRun`向shared verifier传满12个expected字段，额外固定platform=`process.platform`、bindHost注册loopback、ports=[18070,18087]、ownerKind=harness、iamBusinessRuntime=false。有效同key签名但ports=[]、ownerKind=toy-child及模拟other-platform均对消费端拒绝。createdAt保留有效格式/签名，不添加expiry，也不把时间戳当维护窗口。

## Java真实class证据与OPEN

实际SCG5.0.3 `HttpClientFactory`+真实`HttpClientSslConfigurer`实例化成功；独立`GatewayIamPublicJwkSource`直接从copied Gateway JAR classes加载。URI request Mono不订阅，未发送HTTP请求；注入文档检查直接调用生产select/parse/cache，没有复制实现。

生产source选择synthetic private RSA JWK返回1且isPrivate=true，**public-key-only GAP=OPEN**。未过滤后冒称拒绝，不修改服务源码；临时private JWK只在Java内存且不输出/持久化，不调用JWT sign。生产cache注入文档reads1→unknown2→expired3，unknownkid0，malformed/超上限拒绝；timeout2000ms/TTL300来自生产常量，真实HTTP timeout/并发/TLS未测。定位和下一轮具名缺口见[open-gaps](open-gaps.md)。

TLS-01～08全部 **NOT_EXECUTED**；route/JWKS双真实HTTPS仍OPEN。`sourceJarProvenance=UNATTESTED_CURRENT_TARGET`、`sourceToJarVerified=false`：HEAD/dirty source与旧磁盘JAR并列，不证明本轮source已构建JAR。Linux/Windows未实跑，不称verified。

## 留存失败与明确限制

[首轮NPE日志](probe-first-attempt.log)保留Java exit1：SCG constructor3留下null sslConfigurer；按实际class API改constructor4后编译/离线运行通过。第二轮stage因shared run path拒绝合法Java nested `$` class filename返回1；另一owner仅放行字面`$`并保留路径/权限守卫，最终217工件完整核验。context-review前的stage-final/签名/读回仍留作中间历史，当前最终入口仅stage-reviewed及context-review日志，未覆写失败为PASS。命令退出码见[commands](commands.json)。

CLI只有限六mode，无任意exec/adopt/kill-port/kill-all。D2 authority未配置，launch/probe硬拒绝；当前无raw listen API，未来publisher/client动态入口须另审具名代码与窗口。macOS独立CLI stop-owned调用shared detached拒绝，不能只凭PID/receipt发signal；同监督进程handle验证由shared模块owner测试。restore-verify缺批准恢复bundle只拒绝，不启动全栈、读DB或承诺恢复通过。shared schema已删除无法对死亡PID签发的owned-child-exited事件，退出结果仅本地保留，不宣称可签名死亡事件。

本轮零业务注册/AccessToken签发/DB/Flyway/Kafka；未改旧canonical、progress/CHANGELOG、服务或契约，未提交推送。原114/001完整验收/干净库与26治理FAIL/61skip历史边界保留，不开003～005/IT-2，不发布百分比。[源码与输入hash](source-and-inputs.json)、[归档工件hash](artifact-manifest.json)供独立复核。
