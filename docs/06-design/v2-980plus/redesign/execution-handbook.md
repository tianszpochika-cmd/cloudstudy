# R1 逐卡执行与测试审批手册

> 本轮范围：R1-001…114，共114张细化卡。R2/R3/P2/P3仍是登记范围。卡片、状态墙是P1R父任务的拆解交付与审查记录，不自动变更canonical父台账，也不继承旧ACCEPTED/DEV_DONE、静态原型或历史测试结果。

## 1. 执行模型每次只接一张可执行卡

1. 打开[状态墙](status-wall.md)，选择已经由本聊天核验输入并标为“可认领”的卡。编号不是执行顺序；按依赖拓扑执行。多个模型不得同时修改同一文件或同一P1R父manifest。
2. 打开对应`tasks/R1-NNN.md`。先读“目标、精确来源、先读文件、修改边界、契约、待决分支”。不要扩大到整个父任务，更不要从演示字段推导正式接口。
3. 记录工作区、当前HEAD、已存在的未提交改动、模型/执行者、父任务owner认领确认。保护共享改动。现有文件先核对当前实现；新文件明确标为“拟新增”，先确认没有重复实现。
4. 输入Gate或前置卡未通过，提交具体阻塞原因和解锁证据；可继续只读预检，不能自行把状态写成READY或跳过权限/政策。DEC仅关闭所列新增分支；既有冻结规则继续遵守。
5. 按卡片编号步骤逐项完成。每一步产物与检查都必须落实；发生接口/owner/设计冲突，停止受影响步骤并记录冲突，交给本聊天处理。禁止自行选择新算法、补偿窗口、客服隐私政策或审核例外。
6. 只运行卡片列出的适用检查；涉及共享服务、迁移或真实写入，先核验隔离环境和授权。不得为获得绿灯重启共享服务、清空共享数据或自动换端口。失败保留输入与日志，按卡片恢复要求处理。
7. 全步骤交付后，提交证据进入REVIEW。开发自测PASS仍需本聊天逐项复测、审查。修复退回意见时继续原卡，不新造已完成卡。

### 可直接交给执行模型的工作指令

“执行`tasks/R1-NNN.md`这一张卡。先核对状态墙READY、P1R父任务认领、依赖和输入Gate证据。只改卡片允许文件；复用当前架构/生成契约。按步骤交付并自测，保留成功、拒绝、重复、并发、写失败及恢复的适用证据。未批准的新政策分支保持关闭。提交REVIEW证据包及当前文件摘要，禁止自审、自批和升级P1R父状态。遇到缺失前置或设计冲突时记录BLOCKED及准确解锁条件。”

## 2. 每张卡的交付包

证据放到机器索引列出的`evidence/p1r/mN/<P1R-ID>/redesign/<R1-ID>/`，以该卡完整当前交付为单位。文件不要放在临时目录；禁止加入真实密码、Token、原始音频、用户隐私或生产凭据。日志使用脱敏的request/trace/event标识。

| 文件 / 字段 | 必须说明 |
|---|---|
| `delivery-<attempt>.json` | taskId、specSha256、sourceCommit、dirtyDiffSha256、完整completedSteps、交付文件及SHA-256、环境、已知GAP、限定回滚说明 |
| `summary.md` | 本卡目标、实际改动、复用资产、每一步产物、每项自测结果、未测边界；不要仅写“构建成功” |
| `commands.log` | 实际命令、工作目录、开始/结束时间、退出码；无需执行的条件命令写明原因 |
| `cases/` | 按卡片测试ID归档输入、操作、预期/实际、脱敏日志、数据库owner读回、事件/审计、失败恢复证据；UI另附截图与浏览器控制台 |
| `source-snapshot.json` | 本卡所有修改/生成/测试文件的摘要、契约/配置/fixture/policy版本、HEAD和未提交diff摘要；共享无关diff单独标明，不覆盖 |
| 父manifest关联 | 只登记本卡子证据关联；canonical父状态/签收仍按上位审批流程处理。不同执行者不得并发覆盖父manifest |

QA卡只交验证、日志、证据及发现，不修业务代码；契约卡只交适用契约/迁移/生成物与验证，不混入业务实现。前端卡不能修改服务端决策语义。

实现卡允许同时修改其`filePlan`列出的服务与双端页面，使该BC的写入/读回交互可用；不要只写后端而遗漏卡内UI。标为前端验收的卡按其限定文件只写复测与证据，缺陷退回对应实现卡；最后的链QA另验端到端一致性。卡片命令若有`requiresFiles`，须先创建并审查该拟新增脚本，不能把未来命令当成当前已经可用的入口。

## 3. 状态与权限分工

| 状态 | 进入条件 | 谁负责 |
|---|---|---|
| 待准备 PLANNED | 本轮新拆解卡，未继承旧实现完成 | 本聊天维护规划 |
| 可认领 READY | 本聊天核对当前P1R父认领、依赖、适用Gate、DEC边界和证据 | 本聊天记录ready收据 |
| 开发中 IN_PROGRESS | READY后由唯一执行者开始；整改续做仍核对准备证据 | 执行者记录start/checkpoint |
| 待我测试审批 REVIEW | 全步骤、当前文件摘要、自测与恢复证据齐全 | 执行者提交submit收据 |
| 退回整改 REWORK | 测试/审查失败，列明文件、问题、修复要求与复测ID | 本聊天记录reject收据 |
| 受阻 BLOCKED | 精确条件未满足，并给出解锁证据 | 执行者或本聊天记录block |
| 本卡范围已通过 ACCEPTED | 本聊天复测全部适用测试、检查每步、审查diff/回滚/证据；无开放P0/P1/P2 | 本聊天记录approve收据 |
| 证据变化待复审 STALE | 说明、交付、Gate/收据/测试证据或已通过依赖发生变化 | 状态墙计算；本聊天reopen后复验 |

审批者为本聊天“设计审查”，threadId=`01a0cb93-8791-7ee2-b453-8e8752b2553f`。开发者不能签自己的审批。文件脚本校验是协作规则和防误操作工具，并非账号认证或安全授权系统；写文件权限并不能证明收据出自审批者，接手时仍需核对本聊天实际复测记录。

## 4. 本聊天每卡测试审批顺序

1. **入口核对**：任务spec摘要、P1R父认领/源台账摘要、全部已通过依赖及Gate当前证据；仅复验本卡所需输入。准备记录不能替代正式父任务全部Gate。
2. **范围审查**：逐个交付文件核对diff、契约生成方式、服务owner/权限、共享变更保护、无凭据、未开放非本轮分支；重新计算交付摘要。
3. **逐步检查**：对每个执行步骤的`output/check`记录`stepChecks`，写实际结果与证据，不能只填PASS。
4. **逐项复测**：执行每个适用测试ID，记录环境、操作、预期/实际和证据；自动测试、真实DB/API/事件、浏览器与真机分别记录。静态检查/VM/HTTP200不能代替运行链或业务验收。
5. **失败与恢复**：按卡片核对权限、重复、并发、版本、失败与中断恢复；UI包含Loading/Empty/Error、冲突输入保留、主题/字号/触达、Console和读回。
6. **审批**：无开放阻塞缺陷且所有适用项有证据才ACCEPTED；否则REWORK或BLOCKED。条件测试必须以`conditionalOn:[blockerId]`精确绑定规格中的`allowExclude=true`分支，且准备阶段已核准该分支EXCLUDED，才可记NOT_APPLICABLE；须引用匹配的排除ID/原因/证据。核心测试、关闭分支的拒绝测试和未标记的必需输入不可排除；不能以“没环境”“没时间”跳过本卡目标。确需变更可选范围时先改源规格并审查，再准备当前摘要。
7. **归档与下一卡**：归档review收据、测试日志、case结果、每步检查和限界；更新子状态墙。父台账要独立核对完整父范围，不能因为一张R1子卡通过就升级。源码或证据变化后重新审批。

**提交触发方式**：执行者完成后在本聊天告知卡号与delivery收据路径，本聊天读取REVIEW队列并进行测试审批。状态墙自身不会自动启动模型、发送消息或执行测试；本批只准备流程与任务，尚未派发开发，也没有任何新卡通过开发验收。

## 5. 状态记录工具（仓库根目录）

使用项目Node 20.19.5。下列命令只处理本地计划/子状态；不会启动服务、运行收据内命令、写数据库或变更P1R父台账。

```text
node scripts/generate-redesign-dev-plan-index.cjs
node scripts/check-redesign-dev-plan.mjs
node scripts/redesign-task-state.mjs init
node scripts/redesign-task-state.mjs wall
node scripts/redesign-task-state.mjs hash R1-001
node scripts/redesign-task-state.mjs snapshot R1-001
node scripts/redesign-task-state.mjs artifact evidence/p1r/m3/P1R-M3-008/redesign/R1-001/summary.md
node scripts/redesign-task-state.mjs template R1-001 submit
node scripts/redesign-task-state.mjs record R1-001 evidence/p1r/m3/P1R-M3-008/redesign/R1-001/delivery-1.json
```

`template <卡号> <ready/start/checkpoint/submit/approve/reject/block/reopen>`输出当前卡的收据模板。所有REPLACE/PENDING必须用实际结果填完；模板本身不能作为证据。状态表全局`revision`防止并发覆盖：记录前重新读取，冲突时重新基于最新状态生成收据，不强行覆盖。每次重试使用新的不可变收据文件；记录会保存收据及文件摘要，篡改旧收据会使验收失效。意外遗留`.lock`时先确认没有正在写状态的进程，再由本聊天恢复，不让执行模型自行删锁。

ready收据需parentClaim、当前先读/来源/契约及所有已存在允许编辑源码的sourceArtifacts摘要、每个适用Gate的scope/PASS证据及blockerDecisions（APPROVED或EXCLUDED并说明原因）；模板自动计算已有输入文件摘要，但不会自动判PASS。submit需全部completedSteps、范围内交付artifacts、evidence、sourceCommit/dirtyDiffSha256、environment、knownGaps、rollback；approve需独立复测runs、全部case results、全部stepChecks、findings为空或仅非阻塞项以及decision=ACCEPTED。程序验证文件存在/摘要、依赖/状态和必填字段；测试真实性、业务语义、授权与排除合理性必须由本聊天审查。

`snapshot <卡号>`读取当前真实HEAD、本卡允许范围的Git差量/状态及全部文件摘要，计算`dirtyDiffSha256`；不能用任意哈希串或仅一份文本diff代替。ready另保存全部允许编辑/生成文件的`fileBaseline`，新文件缺失记null。开工前快照须保持一致；提交时本卡新增/修改的每个源码和生成文件都必须列入artifacts。实际获准删除的文件须列`deletedArtifacts:[{path,previousSha256}]`并附退役授权/备份恢复证据；工具检查的是完整性，不赋予删除授权。审批和后续墙检查完整范围快照，漏列文件或新增输出无法逃过漂移检查；允许复用无差量但经本聊天实测的现有实现。

准备记录保留开发前输入摘要。卡片明确允许修改的契约或先读代码发生预期变动时，必须在交付artifacts中列出同一路径的当前摘要，审批对照前后版本审查；只读政策、规范、Gate证据不可借此替换。复测日志必须产生在本次交付之后。READY、REVIEW和已通过记录的证据变化会在状态墙显示待复审；开发中的允许文件编辑不误判为阻塞。已通过卡先reopen；其余状态按实际情况退回或block后重新ready，不能覆盖旧收据。

必需输入文件消失直接阻塞；canonical台账在准备时记录完整摘要，后续持续校验本卡主父、协作父、契约输入的相关行。相关认领/范围行变化后重新准备，无关父行更新不使本卡失效。历史start/checkpoint/reject等收据同样不可覆写；若丢失或被改，先恢复可验证的原记录，不能用新PASS抹去旧证据缺失。REVIEW期间HEAD/本卡Git快照变动需重提交；已ACCEPTED卡以完整范围文件、相关输入和证据核定有效性，保留原sourceCommit作为交付来源，无关提交不撤销已通过结果。规格“是否已有”是规划快照；拟新增文件交付后的存在须能关联到本卡已核准准备与交付，不需反复改规格来制造新摘要。

## 6. 优先顺序与并行边界

先核验G-ENV/G-CONTRACT/G-PLATFORM/G-FRONTEND适用基础；独立合成内容种子R1-025/026可先行，但必须经过G-CONTENT资格验证。L1出站后再接L2，L2 QA后接L3；其余按机器索引依赖。没有输入证据时全部保持待准备。

可并行只读预检、不同服务不冲突的独立任务或测试；同文件、生成契约、父manifest、同聚合迁移/政策存在冲突就串行。一次提交一张卡；不得把几十张卡一次改完后统一声称通过。每链QA与站间出站都要等待前置卡审批完成。真实部署、生产写入/迁移/清理及未登记范围另走既有授权流程。
