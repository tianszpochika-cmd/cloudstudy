# 独立复审第二轮：恢复边界、权限读回与D1开工方案

日期：2026-10-07；源代码基线：`ff0f8057f4088ead03ab7890493cdf9d06f6d5f1`。只读复核指定文件；运行了现有专项测试 `node --test scripts/redesign/r1-002/prepare.test.mjs`，没有启动/停止服务、连接数据库、创建持久材料或改变状态。首轮报告中的验证器哈希问题已修正；首轮把恢复索引修复写成READY前置的表述也已澄清：这是接手档案质量门，不是独立IAM业务READY前置。

## 判定

| 对象 | 判定 | 适用范围 |
|---|---|---|
| 固定来源manifest、`verify-index.py` 与工作树边界记录 | **ACCEPT_SCOPED_DELIVERY** | 固定的历史来源验证与当前差量记录可以签收；不代表114卡墙或业务卡验收。 |
| `build-index.py` | **REWORK** | 生成器仍按当前工作树重建并覆盖固定manifest，和新的固定blob验证器不兼容。当前快照内容可验证；生成器可复现性未签收。 |
| R1-002权限读回代码及定向测试 | **ACCEPT_SCOPED_DELIVERY** | POSIX/macOS目录与文件的owner、精确mode、类型及symlink拒绝边界；不签运行时TLS、不签READY。 |
| TLS材料审查证据的当前文件 | **发布前脱敏** | 当前版本含本机私密材料绝对路径，当前哈希仅标识审查所见版本。等待准备agent完成路径脱敏并重新固化hash。 |
| 下一轮D1离线harness开工方案 | **ACCEPT_SCOPED_DELIVERY（仅允许具名D1实施开工）** | 仅按具名清单开发离线stage/lifecycle/harness和负例测试；不表示D1交付完成。 |
| D2维护窗口、D3身份候选A、R1-002 READY | **未签/保持OPEN** | D2需维护owner、恢复来源、固定端口和具名窗口；D3需身份/兼容评审；任何一项都不随D1开工自动获批。 |

## 恢复索引的固定来源与差量边界

`verify-index.py`固定`PINNED_SOURCE_COMMIT=ff0f8057...`与manifest SHA-256，并从只允许manifest列出的路径执行`git show <commit>:<path>`计算blob，而非把当前工作树当历史来源（[verify-index.py](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/verify-index.py#L9-L31)）。我独立用只读脚本核对，manifest中25个来源的SHA全部等于该commit的blob；manifest SHA也等于验证器固定值。候选卡定义和导航引用同样从固定blob取行（同文件第32-40行）。验证器把当前HEAD、tracked差量、status、源文件当前SHA与历史SHA差异及三处移动文件的保留结果写入单独`current-worktree-boundary.json`（同文件第63-67行）；该记录明确不导入工作流状态。当前记录中三个既有移动文件均`preserved:true`，其字节摘要与基线一致。

**生成器仍需返工。** `build-index.py:31-35`从当前工作树读取全部sources，以当前文件hash写`source-manifest.json`，并用当前HEAD填`sourceCommit`；脚本后续用这批当前`texts`构造卡索引（[build-index.py](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/build-index.py#L31-L35)、[L70-L75](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/build-index.py#L70-L75)）。当`CURRENT-PROGRESS.md`有合法当前更新后再跑builder，它会把当前差量混入标注为固定HEAD的manifest并覆盖原manifest；随后新的`verify-index.py`因固定manifest SHA或历史blob SHA不符而失败。建议将builder的事实来源也固定为`git show ff0f8057:<path>`，让它保留固定manifest；当前工作树采集继续只写边界报告。若要接受任意历史版本重建，应增加具名参数/单独输出路径，而不要悄悄覆写这份锁定快照。

因此，**验证脚本和当前已生成的来源快照本身可按有限范围签收；含当前builder的生成/校验工具对不可变快照的可复现交付仍REWORK**。不需要为此停掉已授权IAM准备工作或制造新的READY条件；它只阻塞将builder宣传为固定来源的可复现重建器/签收该工具包。

## 准备工具的真实权限拒绝边界

权限实现不再用声明性字符串冒充读回。`assertExternalDirectory`先限制Git外路径、当前UID和精确`0700`（[prepare.mjs](../../../../scripts/redesign/r1-002/prepare.mjs#L12-L25)）；`checkPrivateMetadata`比较真实`lstat`返回的UID、`mode & 07777`、symlink属性及文件/目录类型，任一不符抛错（同文件第28-38行）。`verifyPrivateMaterialPermissions`只接受本地文件名，对外部父目录和每个指定文件逐个`lstat`（同文件第40-50行）。TLS生成后在Java消费受保护配置前检查目录及七个文件，成功返回前再次检查并把实际值写入结构化回执（同文件第103-144行）。因此它能拒绝目录权限被改成0755/0500、文件改成0640、owner不符、symlink、错误文件类型和带分隔符的路径逃逸；失败不会生成PASS权限回执。

我实际运行的现有定向测试结果为**10/10通过**：其中`chmod 0640`和`0755`/`0500`在真实临时文件系统上触发拒绝；symlink和错误类型被拒绝；owner正向从真实`lstat` UID读回。owner负例将`expectedUid`设置为不匹配值来触发真实比较分支，但没有把文件`chown`给另一用户或从第二个OS身份运行；所以此证据证明owner predicate/readback，而不是另一用户对整个目录的端到端OS访问隔离。该限定适合本次权限准备工具范围，文案不要写成做过跨用户试运行。Windows仍主动拒绝，POSIX stat不证明Windows DACL；本轮也未检查/声称macOS扩展ACL隔离。若后续正式门禁要求ACL级隔离，应另加对应OS权限检查。

准备返工记录提供了路径前/后hash，且最新`tls-materials-review.json`含七项真实文件与父目录mode/owner/type读回，均PASS（[permission-review-rework.md](../../../redesign/2026-10-07/R1-002-preparation/permission-review-rework.md#L5-L24)、[tls-materials-review.json](../../../redesign/2026-10-07/R1-002-preparation/tls-materials-review.json#L45-L147)）。测试验证了拒绝分支（[prepare.test.mjs](../../../../scripts/redesign/r1-002/prepare.test.mjs#L65-L94)）。证据目前仍在`directory`及Java参数中的file URI记录本机绝对私密路径；准备agent正在脱敏。提交/发布前要求脱敏后更新证据hash及材料清单，确认只改路径文本且没有把秘密写入证据；这不推翻权限检查结果，也不授权任何运行时测试。

## D1离线harness方案能否开工

`execution-plan.md`明确把D1、D2、D3拆分；D1只含`lifecycle.mjs`、进程身份、外部签名receipt、synthetic TLS harness、生产Gateway/JWKS两客户端probe和负例测试，限定在`scripts/redesign/r1-002/`，不改通用runner、API/DB/Token设计（[execution-plan.md](../../../redesign/2026-10-07/R1-002-next-round-plan/execution-plan.md#L5-L13)、[L26-L40](../../../redesign/2026-10-07/R1-002-next-round-plan/execution-plan.md#L26-L40)）。方案要求端口占用时不发signal/不监听/不碰DB；当前runner不adopt、不stop，必要身份字段缺失则拒绝stop；receipt不得含完整env、密码、token、私钥或低熵秘密摘要（同文件第42-60行）。D1离线测试和代码范围足以进入下一轮**具名D1专项实施**，前提是根审把表内精确文件清单及“只实现离线阶段”的边界写入任务交接；开始D1代码不等于允许本轮碰18070/18087，也不允许在当前15服务runner上做动态验证。

D2仍需单独维护窗口、恢复bundle和试验后的原栈恢复收据；计划确认IAM启动会运行Flyway，不能承诺只读启动（[execution-plan.md](../../../redesign/2026-10-07/R1-002-next-round-plan/execution-plan.md#L17-L24)、[L52-L60](../../../redesign/2026-10-07/R1-002-next-round-plan/execution-plan.md#L52-L60)）。因此D2不可随本次签收。

`identity-decision-A-draft.md`明标PROPOSED/未批准。候选A把JWT/API UUID与事件wire `prn_`作严格codec映射，明确了两处learner入口owner一致、opaque legacy默认拒绝、PEP不放宽及不连接IAM数据库等边界；同时承认actorId语义、真实legacy事实、身份owner、ADR和canonical兼容审核仍待签（[identity-decision-A-draft.md](../../../redesign/2026-10-07/R1-002-next-round-plan/identity-decision-A-draft.md#L1-L14)、[L39-L60](../../../redesign/2026-10-07/R1-002-next-round-plan/identity-decision-A-draft.md#L39-L60)）。它是可供独立评审的具体方案，不是生效决定，不足以开D3身份实现，不关闭Outbox身份阻塞，也不提升R1-002 READY。

## 文件SHA-256

以下摘要对应本轮实际审阅时文件字节；`tls-materials-review.json`预期因脱敏变更hash，必须以脱敏完成后的新清单为准。

| 文件 | SHA-256 |
|---|---|
| `recovery-20261007/build-index.py` | `d48fc28a9a22f8c1387f01f8b2cacd3cd6d796202e576ec846c65ec561cf1c06` |
| `recovery-20261007/verify-index.py` | `81b67a09e6de56f29d2c12af926e6435fb594845eb80efafcb993bdcab324fc9` |
| `recovery-20261007/source-manifest.json` | `d6c4f419fa62932d74ab6542ec0ef16583748cde07790f650dba95a9b2f3b319` |
| `recovery-20261007/current-worktree-boundary.json` | `ec93f4b8eaa00e5e10d378c24c5e353d3d9b685749bc9bdc0ed3dd2c7c39b63a` |
| `scripts/redesign/r1-002/prepare.mjs` | `fd579fa6bb4bad18885f85a44acdb8f53c6f1b7957a31ff6f14a613e541adc0e` |
| `scripts/redesign/r1-002/prepare.test.mjs` | `b2da658cab1d0ae947026fe5edaf17c738b3a5d474a289cf2afb7522a30aa508` |
| `R1-002-preparation/tls-materials-review.json` | `44758a369529364a054e42b714e0e5e3908a898d7911b9aaf4545fca31ab8c78` |
| `R1-002-preparation/permission-review-rework.md` | `4da33bb0fdaad40a771cd6d653a7bf37a43cb9260e339a379476f8fd3f426704` |
| `R1-002-next-round-plan/execution-plan.md` | `51a6f5695fdb1fc21410c705a26037723fdcd56f40e639326936eda29b24cb61` |
| `R1-002-next-round-plan/identity-decision-A-draft.md` | `dab6e19c7d2d3c4582b54e808f72f0965a51f3ef59cc16ead467844c9a2b6be0` |

本轮测试证据只证明10个准备工具定向单测；没有重跑整个恢复生成器/验证器，没有执行TLS握手、数据库或业务验收，没有改变IAM状态。
