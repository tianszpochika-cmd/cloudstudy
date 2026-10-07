# R1-002 下一轮开工决策计划（草案，未批准）

源码基线 `ff0f8057`；本轮只读核对与方案编写，没有停服务、启动业务服务、读秘密环境、写DB、签READY。本计划不是旧canonical状态迁移。准备工具返工另按主审/独立review清单执行。

## 根审可分开签收的三个范围

| 决策 | 最小可批准内容 | 进入执行前必须具备 | 不随之获批 |
|---|---|---|---|
| D1 专项准备生命周期工具 | `scripts/redesign/r1-002/` 内源码/JAR/签名收据、fixed-port拒绝、只停自有子进程、offline与synthetic harness测试；不改通用runner | Luna准备包返工关闭、具名清单签收、秘密目录权限/owner实际读回 | 停当前runner、端口占用动态测试、业务注册、迁移、Outbox |
| D2 专项TLS运行窗口 | 在受控维护窗口，用已登记18070/18087验证真实两类client的合成TLSharness；随后按独立签收的专用环境计划运行真实IAM/Gateway GET | 当前runner原启动env与恢复来源受控保全、15服务恢复方案试验/收据、固定端口空闲、明确窗口owner；真实IAM另需全新DB/凭据/迁移决策 | 现有共享库变更、自动repair、凭据迁移、产品验收、READY |
| D3 身份候选A | 独立身份评审签收 `identity-decision-A-draft.md` 的最小codec/owner一致性范围与兼容例外 | 对legacy真实事实与冻结契约完成盘点；IAM/learner owner与安全review签字 | 未列出的IAM事件、全量learner consumer、Outbox业务实现、注册TC01～03 |

建议先批准D1设计/实现，D2暂维持不执行；D3先独立评审，不把“有方案”登记为冲突关闭。

## 现有runner能力与恢复边界（源码事实，不是环境快照）

`run-v2-services.mjs` 当前按 `--all` 或 `--service` 选择一次启动集，预先检查所有选定固定端口；没有热移除/单服务stop/restart、PID收据持久化、OS出生时间守卫、JAR启动hash或退出后端口释放确认。SIGINT/SIGTERM或任一子进程退出会清理整个children数组。当前PID8713/8817为父8694 `--all` children；归属有支持，但不存在可供专项工具收养的签名启动收据。

- IAM profile固定为声明的v2 + local-real + local；local允许ephemeral signing、local native transport与非Securecookie，但专项运行必须显式重新收紧，不能继承宽松默认。
- runtimeEnvironment读取原父进程env，并可回退本地配置；本轮只核对变量名/控制流，未读取或导出任何活进程env。父进程env是否有专用覆盖无法据源码推断。
- IAM datasource默认指向现有`iam_service`；runner启用durable persistence与Flyway。`IamRuntimeConfiguration.iamSecurityConfigurationGuard` **禁止durable persistence与spring.flyway.enabled=false组合**；`iamFlyway()`会调用`flyway.migrate()`。因此恢复真实IAM不能称“只读启动”，也不能禁Flyway绕过守卫。
- signing key路径由外置env或本地路径选择；找不到时local profile可ephemeral。源码路径/文件存在不等于运行实例已使用稳定键。本轮不读/迁移该私钥；恢复与下一轮专用准备应使用各自本机密钥，明确原会话受key轮换影响。
- Gateway普通runner的health是HTTP轮询，issuer与JWKS默认HTTP；没有本卡TLS argfile/route CA配置。不能原样套用来声称专项HTTPS验证。
- `.services:run`没有严格child只读credential快照、强秘密provider追溯或不可覆写JAR保护。未保全原有效env与发布来源前，停当前全栈的恢复风险仍OPEN；源代码默认值不是恢复凭证。

## D1具名最小文件清单候选

只在 `scripts/redesign/r1-002/` 中追加；不扩展 `scripts/runtime/run-v2-services.mjs`、通用manifest、正式API/数据库/Token设计。

| 文件候选 | 内容 |
|---|---|
| `lifecycle.mjs` | 只暴露preflight、stage、launch-harness、probe、stop-owned、restore-verify；默认preflight。未签窗口且端口占用时launch拒绝；不提供adopt-existing/kill-by-port/kill-all模式 |
| `process-identity.mjs` | Linux `/proc` starttime+bootId/exe/cwd、macOS PID/PPID/executable/cwd/OS birthtime+本进程handle、Windows CIM CreationDate/ExecutablePath与受保护收据；不可获取必要字段就拒绝stop。避免打印argv/env |
| `receipt.mjs` | canonical JSON签名、外部运行目录/注册表、public-only证据；限制签名key只用于本卡运行收据，不是JWT发行者 |
| `tls-harness.mjs` | 专用synthetic HTTPS publisher与client probes；端口只能取config/local-ports.json；不映射/register/login，不签AccessToken、不连接DB/Kafka |
| `GatewayTlsProbe.java` | 使用当前source/jar绑定的实际SCG route client与`GatewayIamPublicJwkSource`分别请求；不可用普通curl/Node客户端替代生产client验证 |
| `lifecycle.test.mjs`、`process-identity.test.mjs`、`receipt.test.mjs` | PID重用/伪收据/越目录/不匹配JAR/占用端口/退出超时/权限拒绝负例。没有窗口时所有测试不占18070/18087、不停服务 |
| `README.md` | 追加预条件、明确harness与真实IAM证据边界、操作owner、异常及恢复手册 |

具体方法/字段需根审固定后实现；不是批准使用任意外部命令的通用进程管理器。

## 收据与进程守卫

公开签名收据至少包括：schemaVersion、runId、intent=R1_002_PREPARATION_HARNESS、createdAt/OS时区、host平台、sourceGitHead、限定源码dirty摘要/文件SHA256、local-ports.json SHA256、Java executable路径/version/hash、实际启动JAR路径/bytes/SHA256、实际加载类/dependency来源、argv仅非秘密allowlist、配置模板版本、公开TLS指纹、bindHost/registered ports、PID/PPID/OS出生时间/子进程handle来源、启动探针/退出/释放结果。不得含完整env、密码、Token、私钥、私密配置内容或低熵秘密摘要。

签名候选为本卡独立Ed25519 receipt key：在Git外受保护目录/OS安全存储生成，公钥及fingerprint可归档。它证明本卡工具收据未被改动，不能证明无收据的旧runner或替代OS进程事实。签名key与IAM RS256 key分开；receipt不是AccessToken，客户端不能以其授权。

启动时将审核JAR复制到Git外本run只读artifact目录，不覆盖运行中target；保存构建命令exit/hash。工具核对当前source清单→构建输入→artifact hash→实际启动路径→OS创建时间。已dirty源码不得仅凭gitHEAD宣称同提交构建；明确新差量文件hash。历史runner不收养、无完整receipt不stop。

stop-owned只接受本run signed receipt+活进程精确匹配；重核PID出生时间、exe、cwd、artifact路径/hash、端口监听PID。只有一致才SIGTERM；等待同进程退出并核对原固定端口已释放。超时记录FAIL，保留资源/receipt，不自动SIGKILL、不终止新占用者。Linux/macOS无法原子消除独立CLI的PID复用TOCTOU，优先同一监督进程持有ChildProcess handle；跨CLI stop须报告剩余风险并采用pidfd（Linux可用时）/OS handle（Windows），macOS校验不够时拒绝。签名收据不消除此风险。

## 受控退出与恢复阶段

1. **P0当前保留**：只读定位当前全栈owner与原启动来源；owner在Git外保全恢复配置/秘密provider引用。只留变量名、profile、endpoint、provider版本是否存在等非秘密检查结果；不从活进程dump env。原有效env无法恢复则D2不启动。
2. **P1离线stage**：先完成源码构建/权限/签名/guard负例、准备TLS矩阵与专用artifact。此时端口仍占用，launch必须返回拒绝并且0信号/0listener/0DB操作。返回拒绝不是动态测试PASS。
3. **P2批准窗口**：维护owner按照原runner生命周期退出全15服务，记录停止与各固定端口释放。专项工具不替owner关闭无收据进程，不因“项目相关”自动发信号。任何未知占用者都停止推进并报告，不改变端口。
4. **P3合成TLS**：在固定18087运行明确标识的synthetic JWKS publisher，在18070运行生产client代码绑定的最小harness；只health/JWKS GET，0注册/Token签发/DB/Kafka。收据标记`IAM_BUSINESS_RUNTIME=false`；它只证明两client TLS，不冒充真实IAM/业务闭环。
5. **P4专项cleanup**：按本run强身份守卫停harness，确认两个固定端口释放、tmp artifact与证据完整；私密材料由owner保留/清理，不把临时清理扩展到其他run。失败保留清理责任与详细非秘密原因。
6. **P5原栈恢复**：维护owner从已核对的原恢复bundle运行原15服务，并承担IAM启动Flyway风险；不使用专项库/专用测试证书覆盖原env。比较服务数、健康、公开JWKS fingerprint/预期轮换、无多余listeners；若失败使用原artifact/source与配置回滚，不自动repair或改变原库。恢复结果是环境恢复证据，不提升R1产品状态。
7. **P6真实IAM专用运行（另行门禁）**：专用全新DB/独立schema/user/迁移与政策fixture必须单独具名授权；IAM必须保留既有guard，不承诺“durable+disableFlyway”。采用本机新RS256 signer与TLS材料，仅GET健康/JWKS；然后真实IAM/Gateway两链分别取证。新号注册与Outbox实现仍需D3/精确scope/READY后流程。

## TLS双client动态矩阵（计划，未执行）

| TC | scoped route CA | independent JVM trust | fixture | 必须分开观察 |
|---|---|---|---|---|
| TLS-01 | 正确 | 正确 | 有效证书+loopback SAN+公开RSA envelope | route GET200与独立source成功选公开kid，各自实际publisher请求计数 |
| TLS-02 | 正确 | 不含测试锚 | 同上 | route成功、独立sourceTLS拒绝，证明没有相互冒证 |
| TLS-03 | 错误专用CA | 正确 | 同上 | routeTLS拒绝、独立source成功；显式CA应覆盖默认trust，需实测确认 |
| TLS-04 | 错误 | 错误 | 同上 | 两条均拒绝；不得insecure、不得降级HTTP |
| TLS-05 | 正确 | 正确 | 证书SAN仅别的host、端点仍127.0.0.1固定18087 | 两条hostname verification拒绝；不另开hostname/端口 |
| TLS-06 | 正确 | 正确 | 已过期合成证书 | 两条拒绝；不改系统时钟 |
| TLS-07 | 正确 | 正确 | 200 malformed envelope/private JWK/unknownkid | TLS成功与键选择拒绝区分；unknownkid不得错当TLS失败或发行Token |
| TLS-08 | 正确 | 正确 | 超时/不可用publisher | route与独立source分别受控失败，独立请求符合2s timeout；不把框架异常泄露当可接受 |

选择kid的probe可构造未签名的Nimbus `SignedJWT`对象用于调用已有select路径，但不调用sign、不通过任何业务Bearer入口；证据标记selector probe，不是JWT验签/领域403。真实受限AccessToken验签与Set-Cookie仍待READY后注册验收。

## 进入下一轮的判定

D1可在审查签收后继续实现，D2当前仍被占用端口/恢复bundle缺失阻止，D3只是一份独立评审候选。干净库、政策、Outbox exact-scope、TC01～03、受限JWT/领域PEP/Cookie仍必须各自关闭后才能讨论READY。追溯沿R1-002/BC-002/IC-052、FEAT-USR-001/PRD-ATOM-1044/V2-980-0359/0366、ARCH-GW/IAM/SEC/DATA/EVT/REL/OBS、ACT-P1-VISITOR/LEARNER/SYSTEM、JNY-P1-01、PAGE-P1-AUTH-*、07§3.1身份规则、INT-P1-001/002/017、E2E-INT-P1-001/002/017；准备PASS不签业务E2E。
