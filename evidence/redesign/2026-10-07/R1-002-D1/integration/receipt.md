# D1 integration receipt — scoped independent acceptance

2026-10-07，dev-redesign，源码基线 `2ffa2eb2794b32e9f51ee7a1ac5ac4834ec5b7fb` + 本轮具名差量。Luna已签 **ACCEPT_SCOPED_DELIVERY / SOURCE_SCOPED_PASS**，明确 **SOURCE_SCOPED_PASS_NOT_WORKFLOW_ACCEPTANCE**；仅为具名D1源码与离线交付签收，不代表业务验收。本文定稿后按根审精确清单暂存；未提交/推送。

独立最终文件：[review/final-scope-review.md](../review/final-scope-review.md)，SHA-256 `d8a5d3f654d514722bef7d89795e83ebca86e259b54c99a8d6bd424d3594c260`。根审确认最终九项源码表哈希均64hex且与实际字节相符。

| 范围 | 可读证据 / 结果 | 边界 |
|---|---|---|
| receipt/processidentity | [最终源/结果](../identity-receipt/source-and-results.json)，[14项日志](../identity-receipt/test-after-scope-narrowing.log)，exit 0 | 实际Ed25519、外部anchor、12字段expected；真实macOS birth/cwd/executable、POSIX chmod/lstat、3个不监听toy child；PID复用比较是synthetic fixture，Linux未运行/stop拒绝、Windows拒绝 |
| 退出事件收窄 | [原失败证明与修复](../identity-receipt/scope-narrowing.md) | signed owned-child-exited不支持且明确拒绝；EXITED只为retained handle本地结果。旧13项日志保留，无新跨CLI死亡协议 |
| IAM lifecycle/harness | [最终报告](../lifecycle-harness/report.md)、[21项日志](../lifecycle-harness/lifecycle-tests-context-review.log)、[最终stage](../lifecycle-harness/stage-reviewed.json)、[签名原文](../lifecycle-harness/signed-stage-reviewed.json)与[外部公开key](../lifecycle-harness/public-key-reviewed.json) | exit 0；最终修订run绑定61份实际公共source、217项工件，12字段expected context；Luna已核对签名及源码哈希并限定签收。合计35/35定向测试，非全项目测试 |
| 生产类probe | [开放项](../lifecycle-harness/open-gaps.md) | 真实加载生产selector离线选择synthetic private RSA JWK：public-key-only OPEN；不能把harness入口过滤当生产拒绝 |
| 源码→JAR / 双HTTPS | [D1执行范围](../../R1-002-next-round-plan/execution-plan.md) | 当前旧target artifact来源UNATTESTED；TLS-01～08 NOT_EXECUTED，两实际client动态链分别OPEN；0业务listener/DB操作，D2无批准 |
| 当前机器 | 多个只读lsof + [port preflight](../lifecycle-harness/preflight-final.json) / 根审只读观测 | 当前相关服务/前端冷态，非运行中的15服务保留声明；执行进程未启停业务服务，不猜退出原因，不声称15服务已恢复 |

独立最终审查：**ACCEPT_SCOPED_DELIVERY / SOURCE_SCOPED_PASS**。最终绑定只使用stage-reviewed / signed-stage-reviewed / public-key-reviewed及source-and-inputs；stage-final与cb7f历史run的stage-readback是中间记录，不能混入最终63da修订run验签或哈希主张。R1-002仍 **PREPARATION_PARTIAL_NOT_READY**；原114卡墙、原R1-001完整验收、干净库/注册201/Cookie/资格/领域403/Outbox均OPEN；历史61skip/26治理FAIL未重跑或放宽。不START R1-003～005或IT-2，不迁移旧canonical或业务ACCEPTED。open-gaps旧stage-final导航由终审注明为非阻塞历史链接，保持已审IAM归档/manifest字节。

## 根审精确暂存白名单（未commit/push）

- `scripts/redesign/r1-002/receipt.mjs`、`receipt.test.mjs`、`process-identity.mjs`、`process-identity.test.mjs`。
- `scripts/redesign/r1-002/lifecycle.mjs`、`lifecycle.test.mjs`、`tls-harness.mjs`、`GatewayTlsProbe.java`、`README.md`（另一执行owner具名交付）。
- `docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md`、`CHANGELOG.md`。
- `evidence/redesign/2026-10-07/R1-002-D1/` 内各owner具名公开证据；根审按最终实际文件清单逐项纳入，包含ignored日志时须明确路径，不能以宽泛git add捕获其他工作。

排除所有Git外run/key/material、私钥/凭据/argv/env、旧Evidence/canonical、业务源代码、其他进度入口及用户三处mobile文档。本轮source/output hashes在各owner清单；实际提交与commit SHA待根审，本文不是已提交收据。

## 脱敏扫描及既有用户差量

初次模式扫描D1公开证据32文件：private PEM/JWK私参值/JWT/长credential赋值均0。最终含独立终审的37文件复扫同样无秘密模式或未分类私密路径命中。六处用户目录前缀匹配位于两个stage副本的 `binding.tools[0..2].executable`；根审明确判定为公开toolchain来源，可保留实际工具路径+hash用于审计，**不是秘密命中**。禁止的run/receipt-key/material/敏感用户/凭据路径不因此放宽；模式扫描不能证明所有秘密绝对不存在，未读取Git外私钥或活进程env/argv。

三处mobile文件实际SHA全部等于恢复边界原记录，保留且排除提交：

| 文件（mockups/mobile/下） | SHA-256 |
|---|---|
| `evidence/README.md` | `982766f6602aa45aadb207de3b9156c690278de1fc46a81e7625256b52068d14` |
| `README.md` | `c784ad68793e9235629acd56fa024cb90d8d2aca74880ce12f8490fd88a52595` |
| `evidence/independent-r14/README.md` | `923f4230c334e53e8b89202f1fa0587fda1f7efaab981c2b93b0c48145ea38ce` |

## Enumerated public evidence paths (draft boundary)

The following 37 existing relative paths are the exact root-authorized staging boundary, including final independent scope-review. No directory-wide staging authorization is implied. Ignored log paths are explicitly listed.

```text
identity-receipt/artifact-manifest.json
identity-receipt/exited-event-pre-fix-proof.json
identity-receipt/prior-source-and-results.json
identity-receipt/review-ready.md
identity-receipt/scope-narrowing.md
identity-receipt/source-and-results.json
identity-receipt/task-spec.md
identity-receipt/test-after-scope-narrowing.log
identity-receipt/test-final.log
identity-receipt/test-first.log
integration/next-round-task-plan.md
integration/receipt.md
lifecycle-harness/artifact-manifest.json
lifecycle-harness/commands.json
lifecycle-harness/lifecycle-tests-context-review.log
lifecycle-harness/lifecycle-tests-final.log
lifecycle-harness/module-plan.md
lifecycle-harness/open-gaps.md
lifecycle-harness/preflight-final.json
lifecycle-harness/preflight-reviewed.json
lifecycle-harness/preflight.json
lifecycle-harness/probe-first-attempt.log
lifecycle-harness/public-key-reviewed.json
lifecycle-harness/public-receipt-key.json
lifecycle-harness/report.md
lifecycle-harness/signed-stage-receipt.json
lifecycle-harness/signed-stage-reviewed.json
lifecycle-harness/source-and-inputs.json
lifecycle-harness/stage-final.json
lifecycle-harness/stage-readback.json
lifecycle-harness/stage-reviewed.json
lifecycle-harness/syntax-context-review.log
lifecycle-harness/syntax-final.log
lifecycle-harness/task-spec.md
review/final-scope-review.md
review/identity-next-decision.md
review/preflight.md
```

Final scan: 37 files, 0 secret-pattern or unclassified private-path findings; 6 approved public toolchain executable paths classified separately. This is a pattern scan of public evidence only, not private material or process environment inspection.
