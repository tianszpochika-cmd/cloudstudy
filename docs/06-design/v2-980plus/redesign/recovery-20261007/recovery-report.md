# 原机器基线恢复与缺口报告

核对日期：2026-10-07；分支 `dev-redesign`；核对 HEAD `ff0f8057f4088ead03ab7890493cdf9d06f6d5f1`。本次仅恢复搜索和文档索引，不认领产品卡，不启动服务或数据库，不提交/推送。

## 1. 可确认结论

| 待恢复对象 | 找到的来源 | 完整性/适用边界 | 未关闭缺口 |
|---|---|---|---|
| 114 卡、569 步、593 测试定义 | [原审查](../../../../../evidence/p1r/m2/P1R-M2-002/redesign/R1-002/reviewer-3-closeout/review.md) 第 25 行；[命令记录](../../../../../evidence/p1r/m2/P1R-M2-002/redesign/R1-002/commands-4.log) 第 9 行 | 是原机器已做结构检查的历史陈述；原数据文件未随 `98017031` 发布。无法重新计数、核对依赖或测试定义 | GAP-WALL-114 |
| 状态工具、revision27、1 ACCEPTED/113 PLANNED | 同一命令记录第 3、9、10 行；工具名字为 `scripts/check-redesign-dev-plan.mjs`、`scripts/test-redesign-task-state.mjs` | 命令记录称工具 67/67；两个工具当前不存在，`git log --all --` 指定路径无记录。没有状态 schema、迁移轨迹、操作者/验收者收据 | GAP-STATE-TOOL、GAP-STATE-REVISION27 |
| R1-001 官网原交付/验收 | [输入快照](../../../../../evidence/p1r/m2/P1R-M2-002/redesign/R1-002/source-and-inputs-4.json) 的 `localPlanContext.r1_001=ACCEPTED`、`publishedWithThisBundle=false`；[发布边界](../README.md) | 只有上下文摘要，不是 R1-001 manifest、产品补丁或独立签收。不能迁移 ACCEPTED | GAP-R1-001-DELIVERY、GAP-R1-001-ACCEPTANCE |
| 当前已公开卡定义 | [dev-plan-R1](../dev-plan-R1.md) | L1 17 卡 + L2 12 卡 = 29 个显式定义；只有任务/依赖，不维护状态 | 原 114 与 29 卡版本对应关系待核对；不造 R1-030…114 |
| R1-002 准备归档 | 原 `98017031` 包与其 `source-and-inputs-4.json` | 当前 27 个文件 SHA-256 全部匹配原输入清单。该清单不包含 114 卡墙或 R1-001 原件；它的 `sourceCommit=3d11be33` 不把未发布 dirty 绑定为完整产品快照 | 保持 PREPARATION_PARTIAL_NOT_READY；502、身份/Outbox 签收、注册/Cookie/领域403 等仍由后续准备审查处理 |

“未找回”仅限下述可审计搜索范围，不推断原机器不存在文件或产品从未实现。29 卡接手索引的 `currentWorkflowState` 全为 `null`，该值表示本索引不维护/导入工作流状态。

## 2. 搜索边界与来源

完整可复查命令及结果见 [search-snapshot.json](search-snapshot.json)。主要范围：

1. 当前文件：`docs/06-design/v2-980plus/redesign`、`requirements`、`scripts`、`config`、`evidence`、`artifacts` 和 `apps/official-site`；另外对相关目录做 `rg --files --hidden --no-ignore` 的文件名搜索，排除依赖、编译输出和私密材料。未发现原墙/工具/R1-001 专属包。
2. 本机 Git refs：`dev-redesign`、`master`、`origin/dev`、`origin/dev-redesign`、`origin/master`、`origin/HEAD` 与五个 Codex capture/checkpoint refs。`origin/dev-redesign` 和本地 HEAD 当次均为 `ff0f8057`；本次不 fetch，不声称覆盖服务器上尚未拉取的新对象。
3. reflog、唯一工作树、stash：唯一 worktree 是本仓库；`git stash list` 为空。reflog 显示本机 10 月 6 日 clone/切分支/快进/本机修复，无原 Windows 工作树的未提交差量来源。
4. 所有现有 refs 的提交消息与相关路径历史：L1 拆卡 `b1cad45f`、L2 拆卡 `9ee8c58a`、列车计划 `9bf7565d` 可追溯。对两个具名工具的历史查询无记录；`git log --all -S R1-030 --` 相关设计/需求/scripts 范围无记录。历史文件名搜索只找到当前计划与 R1-002 准备包等已知相关文件。
5. Git 悬空对象：`git fsck --full --no-reflogs --unreachable` 成功；三条悬空提交是 `86535be0`（本机环境与移动证据 stash）、`ee4bfa59`（同 stash 的 index）、`b99f5d86`（两份既有移动 README）。逐提交 stat 未发现卡墙/官网交付。Codex refs 的树内相关文件名也只有现有 29 卡计划与 R1-002 准备包。
6. 周边目录：只查看 `/Users/Admin/Desktop/work` 的任务相关文件名；旁边只有 `.workbuddy-ai`，对其唯一 2026-10-06 memory 做项目/恢复关键词定向匹配，内容是本机 clone/切分支/环境与移动原型记录，未出现 114 卡墙/R1-001 原件。没有遍历用户主目录、邮箱、其他项目、聊天数据库或远端 Windows 文件系统。

悬空对象搜索还有明确限制：`c8e74c1c7029200bfd6838f5c7f84edd00cc7a8b`（5727 bytes）、`77579b42d731067bde2276715c777c567c98a124`（6354 bytes）、`5790b18250595b992adf7f94c706a079b9272900`（13342 bytes）无法从悬空树恢复原路径，仅查看了 Git 对象尺寸，未读未知内容。另一个悬空 blob 可对应移动原型 `evidence/README.md`。不把未知 blob 称为已排除的恢复来源；若后续取得可信路径/来源，可再限定核对。

不读或搬运 DPAPI、私钥、系统凭据、真实用户数据、原始音频或旧 target JAR；原 Windows 私密材料不会成为此接手包的附件。

## 3. R1-001 的已存历史与当前源码

[官网 sweep summary](../../../../../evidence/live/2026-09-26/page-sweep/official/summary.json) 的归档提交为 `9ddcb954195dc3849d92ab7d99895b64b9c8e17f`，capture 时间 `2026-09-26T12:32:32.502Z`。记录包含 11 路由的 desk/mob 共 22 条 HTTP 200，errors 均为空；22 张截图仍在同目录。它早于 R1 的 L1/L2 拆卡。summary 未绑定 `taskId/sourceCommit/reviewer/acceptance`，也没有准确像素尺寸、测试命令、空目录种子/库隔离、文案逐项对稿、CTA→安全注册与独立签收。

这些是可复用的历史页面检查材料，不能作为 R1-001 的当前源码验收。当前 `apps/official-site` 最近路径提交为 `8a689ec5`，其历史还有 `de878bcf`、`5c5dc319`、`9cfb12cc`。它们在本次未被重新运行或晋升为 R1 Evidence。

本次定向源码读到：

- `apps/official-site/pages/courses/index.vue` 同时展示静态 `learningMethods` 与独立的公开已发布课程投影；只可据此定位官网现有实现，不能把静态介绍数量算作可学课程数。
- `apps/official-site/components/SiteStartButton.vue` 的目标为 `/start`；当前 `pages/start.vue` 主动作目标为 `/#practice-example`。这两段源码没有证明 R1-001 定义的“去注册 CTA”已随原交付合入。完整页面其他入口未在本次做浏览器复核，不能据此裁为全站 FAIL。
- `composables/useOfficialSiteLinks.ts` 仍有受控 learner 登录链接构建，说明共享安全跳转能力可核对复用；存在工具函数不等于所有 CTA 已连通。
- 运行层 PAGE 台账中 status/privacy/terms/minors 的“缺失”是历史源描述，当前文件已存在；本索引保留源文，不用旧描述覆盖当前源码，也不回写旧 canonical。

恢复 R1-001 所需原件：具名交付 patch/源提交（包含 dirty 的实际 diff）、11 路由/空态文案清单、明确视口、执行环境与受控公开投影基线、CTA→注册证明、无业务 Token 证据、命令结果/截图/摘要、独立验收者与签收时点。拿到原件后先核验 SHA/路径/秘密边界，再与当前源码逐文件对比；如原件无法取得，应制定当前源码重新验证方案并诚实区分重新验证与历史恢复。

## 4. 29 卡追溯索引的语义

[完整 JSON](cards-29-index.json) 保留每卡源行、原始定义、owner、依赖、验收、BC/IC 以及以下导航：

| 层 | 可用来源 | 此次使用边界 |
|---|---|---|
| FEAT | `requirements/feature-matrix.md` | 对认证/会话/设备、画像目标和定级引用存在的功能 ID；候选来源，不宣称覆盖卡全部差量 |
| PRD-ATOM | `docs/06-design/traceability/03-PRD原子需求候选清单.md` | 只引用已存在且可审查的候选原子；该清单本身不是逐卡批准。成人/同意只找到年龄治理旁证；重置精确原子仍 GAP |
| V2-980 | `08-980plus-功能点设计登记册.md` | 按源 FEAT 登记行链接实际 V2 ID；不造登记号、不把登记行计为实现 |
| ARCH | `v2-platform-capability-matrix.md` | 引用既有 Gateway、IAM/PEP、API、DATA、EVT、SEC、迁移能力 ID；无运行状态升级 |
| ACT/JNY/PAGE/RULE/INT/E2E | Phase 1 业务运行设计包 01/02/03/04/06/08 | 把候选卡语义连接到源台账；认证/成人/官网的 RULE 在源旅程标“不适用”，仍需安全/同意政策绑定；种子无独立用户幕 |
| 服务/data owner | 原计划 owner + 运行设计包 01 的唯一事实所有权表 | 原计划 delivery owner 原样保留；data owner 单列为候选，并给来源。official-site/learner-web/mobile/QA 不因 delivery owner 获得领域表写权 |
| Evidence | 原 closeout、输入清单、历史 sweep | 只声明原来证明的范围；当前产品验收包仍 GAP |

IC-only 卡的 BC 是从业务主表关联，并限定在该站已定义业务范围；QA 重放卡的 BC 为对应链的来源汇总。它们是索引导航，不扩展原卡范围。所有候选映射都有 `GAP-TRACE-SIGNOFF`：需要核对完整上位原子和卡独有验收，不在此自动签收。

其他逐卡共性 GAP：`GAP-CARD-CONTRACT-BINDING`（operationId/schema/migration/event/policy 的精确绑定），`GAP-CURRENT-RUNTIME-EVIDENCE`（当前提交/环境/干净库与 API/DB/事件/页面读回），`GAP-NAMED-ACCEPTOR`（验收责任人与收据）。对 R1-002 已有准备证据的存在另有历史说明，共性 GAP 不表示该卡毫无已有材料。

原计划还有需要核对、但本次不改写的定义歧义：R1-014 写“14 卡全绿”，显式依赖为 R1-001…013，IT-1 则包括 17 卡；原全量墙是否将交互卡/重放卡分别计入，必须取原件或具名裁决。29 是已定义卡数，不是完成数；108 是冻结业务步数，114/569/593 是另一份未发布的本地记录，不能互换。

## 5. 下一轮关闭顺序

1. 向原机器提供方取得非秘密的完整计划/状态 schema/工具/轨迹和 R1-001 产品+Evidence 导出，要求来源提交/dirty diff 与 SHA 清单；先审查恢复来源，不导入 ACCEPTED。
2. 若原件拿不到，用本 29 卡来源索引作为缺口清单，补签逐卡 FEAT/PRD-ATOM/V2-980、ARCH、运行层和 owner/契约/验收绑定；未公开的其他卡只保留缺口，不能按 114 计数凑号。
3. 先核对 R1-001 当前源码可复用范围与新的可执行验收方案；重新验证所得 Evidence 需独立标记当前提交/环境与审查者，不能伪称旧原件恢复。
4. R1-002 仍按现有准备缺口推进和独立签收；本恢复工作不关闭旧隔离环境 502，不把本机环境冒烟当 READY。
5. IT-1 全 17 卡在干净库上取得完整出站证据并签收后，再解锁 IT-2。原 IT-2 计划/种子先行定义不改变站点门禁。

## 6. 本次实际差量与验证

仅新增本 recovery 目录的报告、索引、来源快照和重建/校验脚本。未更改 CURRENT-PROGRESS、CHANGELOG、原卡计划、旧 canonical、应用代码；未提交或推送；未启动业务服务或进行注册/DB操作。

既有三处移动原型文档保持独立；它们的字节摘要在 `search-snapshot.json.preservedMobileFiles`，验证器复核其未变。`build-index.py` 成功生成 29 卡 / 25 来源文件；原 R1-002 摘要核验 27/27；历史官网 sweep 22 条全部 200。最终索引/链接/来源校验结果见 [validation.json](validation.json)。上述结果是恢复文档和历史完整性验证，不是 R1 卡业务验收。

## 验证器历史来源固定修正（2026-10-07）

Luna审查指出工作树CURRENT-PROGRESS摘要随合法更新变化会使恢复验证误失败。已将25个来源摘要、原卡定义与来源行引用改为固定ff0f8057历史blob读取，并固定source-manifest摘要；当前工作树路径/diff边界独立输出，不将新进度文本导入状态。索引与source-manifest内容未变，29卡仍currentWorkflowState=null；原有3个mobile文件摘要保持。重跑862 PASS / 0 FAIL，Python AST/JSON与git diff --check通过。不能据此接受业务卡。

生成器也已同步改为固定历史blob读取、manifest初次输出固定digest验证、既有5个immutable工件不覆盖；原搜索和移动快照不重新生成。`test-generator-replay.py`在临时Git夹具添加合法progress差量，重放exit0且实际progress/历史工件摘要不变。
