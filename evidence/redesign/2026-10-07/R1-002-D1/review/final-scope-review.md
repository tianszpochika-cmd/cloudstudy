# R1-002 D1 独立终审

**结论：`ACCEPT_SCOPED_DELIVERY` / `SOURCE_SCOPED_PASS`。** 本结论仅签收本轮具名 D1 离线工具源码及其离线证据；不构成 R1-002 业务卡验收、workflow `ACCEPTED`、D2/D3 批准或 `READY`。所有动态 TLS 与业务运行结论继续保持未执行/未签收。

## 已核对范围

最终入口为 `evidence/redesign/2026-10-07/R1-002-D1/lifecycle-harness/report.md`（SHA256 `cf3d80aa995663b4fb31fc0fbc796e86515e4e2da94570738ac4a478bcd60f6c`）。其 `artifact-manifest.json`（`158299ce334e4efeef503524bcbfdb39390cc3b0a54da9dbd2a68fd8a6c610db`）及 `source-and-inputs.json`（`dfd5c6f52088144489ea13cd9dc888fc83664dc196f910092759c8a657aea0a5`）与本地最终源码相符。九个具名 D1 源文件的散列逐项复核通过，包括：

| 文件 | SHA256 |
|---|---|
| `scripts/redesign/r1-002/lifecycle.mjs` | `5dace89cfab45c0f02d32cf80271d480f42c1b3081e03ea3f80210d8b502773d` |
| `scripts/redesign/r1-002/lifecycle.test.mjs` | `18f4761f8a21cee2b12c2cafe5f74d7a3baf24a79c17a1798bf7a4213eda6bde` |
| `scripts/redesign/r1-002/tls-harness.mjs` | `a2e25ec465e42672238438e0747c57594f5cee292a726485c5771af87d5823ab` |
| `scripts/redesign/r1-002/GatewayTlsProbe.java` | `abea032fd9c2178bfc0e02e94b729bf5a8151b16e1cee130b5c116d039fb741c` |
| `scripts/redesign/r1-002/README.md` | `f6af73bdaa7dedf0163c23dfa1c1c85d1bcd421b378ac1ee9ccdcec7642a41f0` |
| `scripts/redesign/r1-002/receipt.mjs` | `46b9eb30ba485697980ce3da5ae13948943c4f734b53d4491d0cb86d64ae436f` |
| `scripts/redesign/r1-002/receipt.test.mjs` | `4eb02d0cccfefd1c26844adf7d2ad85201ce6904d7fe355df4f84165fb0c8a8e` |
| `scripts/redesign/r1-002/process-identity.mjs` | `ffe624362ed92aa1046238b989f8f139cfc8c1e065e227596c9c1e9db134a59d` |
| `scripts/redesign/r1-002/process-identity.test.mjs` | `bd93a4fa9292cc31d88f41e73e3a3f37459c259bf134871de981b29ebe54f398` |

`lifecycle-tests-context-review.log` 记录 21/21 定向测试通过；shared receipt/process identity 的最终报告和 `test-after-scope-narrowing.log` 记录 14/14，合计 **35/35 具名离线工具测试通过**。没有重跑未变化测试。后者包含真实 macOS POSIX owner/mode/lstat 与 kernel process birth 读取、三个非监听 toy child 的同监督操作；PID 复用等边界是合成 fixture，不是实机制造的竞态。Linux 未实跑，Windows DACL/CIM 不可用并拒绝操作。测试结果没有证明真实 listener、跨 CLI 收养或跨平台行为。

## 收据、源码与隔离边界

我用 `receipt.mjs` 的 `verifySignedReceipt`，以单独归档的 `public-key-reviewed.json` 公钥验证了 `signed-stage-reviewed.json`。签名、key ID 及完整 12 字段预期上下文匹配；收据的 61 个源码文件散列全部与当前文件一致，`source-and-inputs.json` 的 9 个具名文件散列也全部匹配，固定端口配置散列一致。最终 `stage-reviewed.json` 记录 `signature/source/artifactHashes=PASS`、217 个 copied JAR/classes/dependencies/probe 工件、`signals=0`、`listeners=0`、`dbOperations=0`。公钥文件明示它只是 run receipt key，不是 D2 maintenance authority。

必须区分三个归档对象：

- `signed-stage-reviewed.json` 是可验签的 staged receipt 原文；其 `artifact` 是 `binding.json` 的相对路径、字节数和 SHA256。
- `stage-reviewed.json` 中 `receipt.kind=redacted-summary-not-signed-original` 是脱敏摘要，缺少签名 envelope，不能当作签名原文或可执行 binding。
- `stage-readback.json` 和 `stage-final.json` 属于 context-review 前的旧中间 run。其原 binding hash 不对应最终 `signed-stage-reviewed.json`；不能拿旧 readback 跟最终 receipt 对比。最终阶段自己的 `verifyStagedRun` 已逐项复核 Git 外 binding、217 项工件和权限，归档报告记录该结果；本审查没有输出或复制 Git 外私密路径及原始材料。

`receipt.mjs:147–157` 的 key API 消费既有 0700 目录，以 `wx` 新建专用 Ed25519 文件并拒绝同名文件；`README.md:31–34` 正确要求执行者预先提供 Git 外新目录。目录“空”是操作者前置条件，当前 API 校验 owner/type/mode 并检查 receipt key 文件名冲突，但不枚举拒绝目录内其他无关文件；它不会复用或覆盖已有 receipt key。README 的表述作为调用要求准确，空目录未被工具单独强制验证不构成本轮交付阻塞。

README `:22` 将 10 月 6 日 runner 占用明确写成历史快照，并称本轮只读 preflight 无 Gateway/IAM listener、主审另核对旧 runner 与四个前端 PID 已退出；同时明确未停止/重启、退出原因未知。这个时间边界准确，当前状态应描述为冷态，不得沿用“15 服务仍运行”的旧快照。冷态也不提供 D2 窗口、旧 runner 恢复包或 source-to-JAR provenance。

## 可接受的离线结果与保留的 GAP

`stage-reviewed.json` 将磁盘 Gateway JAR（SHA256 `34f13139294dead9f80cf0a4d41d43485d9cb95e0895c319ed4504b1fad66380`）和 61 份源码快照分别绑定，并明确 `sourceJarProvenance=UNATTESTED_CURRENT_TARGET`、`sourceToJarVerified=false`。Java probe 从复制的 JAR 加载真实 `HttpClientFactory`/`GatewayIamPublicJwkSource`；它只在 `--offline` 下编译、实例化和注入文档调用，零 HTTP 请求。报告中的 Java 绑定与 parser/cache/kid 选择是离线生产 class 观察，不是 TLS handshake 或业务流量证据。

probe 对真实加载的 `GatewayIamPublicJwkSource` 注入合成 private RSA JWK 后按 `kid` 选择并返回一条私钥成员，`publicKeyOnlyProductionGap=OPEN`。因此生产 source 的 public-only 行为仍是 OPEN；harness publisher 的 public-only 入参保护不能替代生产 source 拒绝证据。TLS-01～08 全为 `NOT_EXECUTED`，包括双 client 握手、证书/主机名验证及网络 timeout。D1 离线 class/probe 交付可以签收，但不得把这一结果表述为 TLS 成功或关闭该 GAP。

README `:38–44` 正确区分 SCG route client 与独立 `GatewayIamPublicJwkSource` WebClient，并将真实动态测试留待单独具名 D2 代码和窗口。`lifecycle.mjs:200–228` 对 staged receipt 验证满 12 个上下文字段并固定当前平台、loopback、登记端口、`ownerKind=harness` 和 `iamBusinessRuntime=false`；`receipt.mjs:190–200` 要求外部传入 Ed25519 公钥，不能把收据自身 key ID 当信任锚。`launch-harness`、`probe`、`stop-owned`、`restore-verify` 当前保持拒绝或 detached refusal；没有 listener、signal、DB、Flyway、Kafka、注册或 Access Token 签发动作。D2 的 authority/window，D3 的身份/Outbox决策与业务实施仍未签。

## 最小文档收尾项

`lifecycle-harness/open-gaps.md:6` 仍将 private-JWK 观察链接到历史 `stage-final.json`。该文件保留旧 run；当前同一观察应指向最终 `stage-reviewed.json`。这是一个非阻塞证据导航修正，不能据旧文件替代当前最终 run。本报告不改该文件或其他归档。

接受范围只覆盖以上具名 D1 源码与可审计离线交付。R1-002 保持 `PREPARATION_PARTIAL_NOT_READY`；不得升级业务卡状态、READY、D2 或 D3。
