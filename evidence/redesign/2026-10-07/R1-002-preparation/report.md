# R1-002 macOS 准备层报告

日期：2026-10-07（Asia/Shanghai）。源码 HEAD `ff0f8057f4088ead03ab7890493cdf9d06f6d5f1`，本目录为新的准备证据，不改旧 canonical 或签 READY。状态 **PREPARATION_PARTIAL_NOT_READY**。

## 本轮通过项

- 新专项工具 `prepare.mjs` 初轮8项定向测试 PASS；权限返工后10/10 PASS、脱敏终稿11/11 PASS，增加真实owner/mode读回及权限变更/错误owner/符号链接/文件类型/路径逃逸拒绝，以及归档副本脱敏而执行配置不变的负例。原前缀、insecure trust、HTTP降级、issuer混用、固定端口与Java argfile负例保留。
- 当前 Gateway 5.0.3 依赖 metadata 已确认新属性名。使用当前 executable Gateway JAR 的真实 Spring Binder 实测：新 `spring.cloud.gateway.server.webflux.httpclient.ssl.*` 绑定精确证书，insecure=false；旧 `spring.cloud.gateway.httpclient.ssl.*` 对当前配置未绑定。见 `binding.json`。
- 在Git外全新0700目录生成独立七天TLS合成材料；私钥、PKCS12和含口令配置0600；没有迁移旧 Windows DPAPI/私钥。复审版对目录及七个文件逐项`lstat`读回owner、mode、type与symlink，异常即拒绝；证书SAN匹配127.0.0.1/localhost且不匹配其他hostname，Java @argfile可解析；离线默认JVM trustStore接受唯一测试锚、空库拒绝。最新证据见 `tls-materials-final.json` 的structured privateMaterialPermissions；初轮 `tls-materials.json` 的字符串只作为历史生成结果，不能当权限核验证据。未创建生产材料。
- 阻止秘密输出：keytool密码由子进程环境注入，Java trustStore口令由Git外受保护argfile注入；证据只含路径、公开证书摘要及检查结果。
- 未更改端口、正式接口、身份schema、Outbox源规格、注册业务或任何数据库；未启动/停止服务；未注册用户。

初次测试暴露 macOS `/var`→`/private/var` realpath 差异，测试已使用真实路径比较，初轮8/8、权限返工10/10、脱敏终稿11/11通过。首次结果未当作PASS。各轮命令真实退出码见 `commands.json`，全部0。review前后工具hash、具体返工与证据索引见`permission-review-rework.md`及`sanitization-review-rework.md`。可提交证据中的实际私密目录均显式替换为placeholder；真正可执行配置保留Git外，不能把脱敏plan当启动配置。

## 两条 HTTPS 信任链结论

| 链路 | 已证明 | 保持OPEN |
|---|---|---|
| SCG Gateway→IAM route HTTP client | 旧准备脚本的prefix不能绑定当前属性；新prefix在真实Binder绑定成功 | Gateway进程未消费新参数，HTTPS回源/hostname verification/502消除未实测 |
| Gateway JWT independent JWKS WebClient | 当前源码直接 `WebClient.builder().build()`，不继承route CA；新独立JVM trustStore离线准备有效 | 实际GatewayIamPublicJwkSource HTTPS GET、Reactor Netty trust消费、缓存/unknownkid及JWT验签尚未动态验证 |

旧 Windows prep-4 独立收口测得 Gateway JWKS502，IAM HTTPS health/JWKS200。旧启动器虽然检查trust.p12，实际Java spawn未注入JVMtrustStore，只传旧route前缀；两条缺口不能互相补证。本机2026-10-06文档的普通HTTPJWKS/认证冒烟是在原runner环境完成，不能关闭旧隔离环境的HTTPS502，也不证明新专用库/材料已运行。

## 当前端口与恢复影响

18070 PID8713（创建2026-10-06 21:46:35 CST）和18087 PID8817（21:46:39），cwd为本仓库、PPID8694为`run-v2-services.mjs --all`。磁盘JAR摘要及只读身份记录见`inspect.json`。没有持久启动收据；磁盘hash无法证明启动后的JAR字节没有被覆盖，因此只报告归属支持，不升级强身份守卫通过。

runner的SIGTERM/SIGINT会停止全部子服务；单个子服务退出同样触发catch→stopChildren，因此不能安全地仅停两服务再恢复。恢复会需要原有效启动env、当前构建产物/收据、健康检查及IAM migration条件；不能凭旧shell默认值推断可恢复。主审已决定本轮保留当前15服务runner，不重启，动态TLS证据OPEN。

后续须先设计可恢复的专项运行方案：保留现有启动来源和凭据事实、受控维护窗口、专用库/用户/全新密钥、源码绑定JAR收据、fixed-port检查、仅自有进程生命周期与恢复验证。不得新增端口、擅停共享runner、自动Flyway repair或改现有库。Windows ACL/凭据适配和Linux实跑亦未验证；当前工具明确拒绝未经DACL验证的Windows材料创建。

## 待签收与业务未验证

UUID/prn_仍需独立身份评审；learner两条HTTP身份转换路径并未证明与事件投影是同一owner。Outbox精确文件扩围、完整事件样例和canonical校验须在身份决议后签收，研究包见`identity-outbox-review-packet.md`。本轮没有关闭冲突。

本机专用全新数据库、Flyway validate/用户零基线/ACTIVE政策未执行；注册TC01～03、201+受限会话、真实受限JWT→领域403、Set-Cookie和Outbox/Kafka/消费事实均未验证。R1-002不签READY，不启动003～005，不解锁IT-2。

## 追溯与owner

| 层 | 映射 | 本轮证据/边界 |
|---|---|---|
| R1 / BC / IC | R1-002 / BC-002；IC-052注册交互沿卡R1-015 | 本轮仅准备，不执行注册交互验收 |
| 功能/原子/980 | FEAT-USR-001；PRD-ATOM-1044；V2-980-0359、V2-980-0366 | 账号密码仅TLS到IAM，准备工具不开放学习 |
| 架构 | ARCH-GW-001、ARCH-IAM-001/002、ARCH-SEC-001、ARCH-DATA-001、ARCH-EVT-001、ARCH-REL-001、ARCH-OBS-001 | metadata/Binder/trust/process evidence；DB/事件/观测运行仍OPEN |
| ACT / JNY / PAGE | ACT-P1-VISITOR、ACT-P1-LEARNER、ACT-P1-SYSTEM；JNY-P1-01 J01.2/J01.3；PAGE-P1-AUTH-REGISTER-RESET、PAGE-P1-AUTH-LOGIN | 对应Phase1业务运行设计的身份与会话入口，不迁移旧完成状态 |
| RULE | 07状态权限矩阵§3.1身份与成人Gate；04学习引擎§3.1中的成人Gate+必要同意 | 无单独新造RULE-P1-auth编号；RULE-P1-DAILY-PLAN的资格前置沿用，未声称学习规则验收 |
| INT / E2E | INT-P1-001、INT-P1-002、INT-P1-017；E2E-INT-P1-001/002/017；E2E-P1-PUBLIC-ENTRY、E2E-P1-AUTH-LIFECYCLE | E2E保持UNVERIFIED |
| owner | IAM：密码/主体/会话/资格/审计decision/Outbox；Gateway：route与JWT预校验；learner：owner-bound bootstrap消费；QA：独立验收 | Gateway不签Token，工具不注册/消费/跨表写；旧P1R-M2-002仅追溯 |

输入与新增工具源码SHA256见`source-and-inputs.json`；命令/退出码见`commands.json`。未修改CURRENT-PROGRESS、CHANGELOG或其他执行子进程文件，未提交/推送。
