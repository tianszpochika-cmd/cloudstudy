# 限定交付集成收据（2026-10-07）

状态：ROOT_AUTHORIZED_COMMIT_PUSH；本收据生成时尚未提交或推送。执行者：GPT-6.1 Sol high（`iam_preparation`）；范围审查者：Luna；四份原始证据空白保真例外由主审于本轮明确批准。本收据不签业务卡 ACCEPTED、READY、IT-1 干净库出站或 IT-2 开工。

## 已审来源与集成范围

- 分支 `dev-redesign`，本轮基线 `ff0f8057f4088ead03ab7890493cdf9d06f6d5f1`。
- [独立终审](../orchestrator-review/final-scope-review.md) SHA-256 `59cf598e808e18d000402ae243ef48594fdac46cca9ddbe078206f49b7b18c67`，仅 `ACCEPT_SCOPED_DELIVERY / SOURCE_SCOPED_PASS`。
- R1-001 [task-spec](../R1-001-implementation/task-spec.md) SHA-256 `9f578b432074b59083233b2f478b39cd611948aa366d93c8c89a8939247b0da6`；[source-delta](../R1-001-implementation/source-delta.patch) SHA-256 `d4497aea42a3f25068565a34db96730a2769d88677760b992b5ccbe967112038`；[artifact-manifest](../R1-001-implementation/artifact-manifest.json) SHA-256 `5aca3aea225af7fdef5fd7e66a74d12382e332ac2b9553e4f69ffc3293cfe99a`。
- 主审逐路径 allowlist：恢复目录、R1-002 准备工具目录、本日证据目录；14 个已批准官网/i18n源文件；唯一 CURRENT-PROGRESS 与 CHANGELOG。未暂存三处既有 mobile 文档差量、旧 canonical、服务源码、构建产物、外置秘密材料。
- 本收据前已暂存224文件：官网/i18n14、恢复13、准备工具7、证据188、集成文档2；本收据加入后225文件，证据189。34份 ignored `.log` 均先扫描，再逐路径 `git add -f -- <path>`；其余文件逐路径 `git add -- <path>`，未使用 `git add .`。

## 必要检查与退出码

| 检查 | 结果 / 退出码 |
|---|---|
| 最终审查及 task-spec/source-delta/manifest、准备工具哈希复核 | PASS，0；未改变已审字节 |
| R1-001 manifest 112份artifact与14份当前源码哈希 | 112/112与14/14 PASS，0 |
| 暂存清单与allowlist、stage期间文件稳定、暂存blob与工作树字节 | PASS，0 |
| 秘密与私密材料路径检查 | PASS，0；检查实际私钥PEM、JWT、provider key、含凭证URL、Git外private材料绝对路径；准备材料证据仅保留脱敏占位符及摘要/mode/owner结果 |
| CURRENT-PROGRESS与本轮CHANGELOG本地文件链接、状态边界 | PASS，0；保留 `PREPARATION_PARTIAL_NOT_READY`、双HTTPS运行OPEN、无START003～005/IT-2解锁 |
| 固定来源生成器 `build-index.py --verify-replay` | PASS，0；29卡、25来源、27/27固定旧输入，未覆盖快照 |
| 固定来源 `verify-index.py` 只读输出捕获验证 | 862 PASS / 0 FAIL，0；仅在内存捕获两个报告输出，原manifest/cards/search/integrity/validation/boundary七份快照哈希不变 |
| 初次全暂存 `git diff --cached --check` | **2**，仅下表四份已审原始证据空白；未改写原证据 |
| 仅排除下表四份原始证据的暂存源码/文档/其余证据 `git diff --cached --check -- <explicit-paths>` | PASS，0；本收据亦检查通过 |

未重跑官网全量、后端全量或治理门禁；未启动/重启/停止当前服务，未注册、写DB或运行Flyway。15服务运行态保持；26项治理FAIL和61skip继续作为10月6日快照。

## 四份原始证据空白保真例外

| 精确仓库路径 | 原因 |
|---|---|
| `evidence/redesign/2026-10-07/R1-001-implementation/source-delta.patch` | Git patch空白context行包含语法前缀空格；trim会改变patch内容和已审SHA |
| `evidence/redesign/2026-10-07/R1-001-implementation/source-delta-first-pass.patch` | 同上，保留首轮差量原字节 |
| `evidence/redesign/2026-10-07/R1-001-implementation/test-r1-001-final-raw-attempt.log` | 首次失败诊断stdout的原始空白，保留以匹配已审artifact SHA |
| `evidence/redesign/2026-10-07/R1-001-implementation/test-website-final-raw-attempt.log` | 同上，保留失败诊断而非覆盖为后续PASS |

主审授权仅为以上四份原始证据的保真例外，不是源码空白、全局阈值、契约或DoD豁免。不修改原报告/manifest；主审已核对暂存名单并授权提交及非force推送；发生远端新差量须报告，不自动rebase。

## 文档最终边界

CURRENT-PROGRESS与CHANGELOG记录29卡固定来源导航及原114墙/原R1-001验收缺口；官网当前源局部26+4、type/build、22原路由/CTA及4真实空态+40fixture+2无关scope+4非空fixture视觉；准备11/11、实际权限/脱敏及双动态OPEN。D1仅可下一轮具名离线开工，D2/D3未签；未迁移旧workflow ACCEPTED、不发布完成百分比。

需求、owner与 `FEAT/PRD-ATOM/V2-980 + ARCH + ACT/JNY/PAGE/RULE/INT/E2E` 追溯仍分别以[固定来源索引](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/README.md)、[官网具名任务](../R1-001-implementation/task-spec.md)、[准备报告](../R1-002-preparation/report.md)及[下一轮计划](../R1-002-next-round-plan/execution-plan.md)为审查来源；本收据不新建或升级业务映射状态。
