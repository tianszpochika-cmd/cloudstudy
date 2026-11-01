# 业务链条文档 v2.3（原型反推与二轮审批整改稿）

**20 条主链｜204 个保留业务步骤｜编号范围 BC-001…BC-208｜原编号不重排**  
配套：[交互链条文档](interaction-chains.md) · [修订说明与待确认清单](revision-notes.md) · [结构校验结果](validation-report.md)

> **使用状态：原型反推修订设计稿。2026-10-02 两轮独立审批发现的文档偏离已修正文案；本稿不代表产品签核、正式实现验收或上线批准。** 12 项 DEC 保留新增差异与运行签收边界，已存在的 canonical 规则继续生效，不因本包待签收而自动关闭已获准业务。当前设计来源和冲突见 [设计来源追溯](design-source-traceability.md)，本轮整改见 revision-notes §21；历史 Agent 审批结论只记录当时检查范围，不作为当前放行依据。未执行外部法规或生产系统核验。
>
> 不把“原文未写”当成“系统一定没有”；也不把“本稿已经补写”当成“功能已经完成”。现网能力是否变更应先核对实现与回归证据，不能凭本稿缺少证据自动关停或清理数据。

## 0. 阅读与执行约定

### 0.1 保留架构，拆开阶段含义

原文同时把 `R1/R2/R3` 用于验收轮次、未来入口登记和功能开放范围。本稿保留现行口径
（R1：本地干净库；R2：test 重放；R3：仅登记未来入口）与冻结令效力；
维度拆分（验收环境/门控/实现状态）是 DEC-01 待确认提案，确认前不替代现行口径。
新排期记录应分别填写：

| 维度 | 本稿口径 | 使用边界 |
|---|---|---|
| 产品范围 | 保留 P1 基础学习、P2 AI/实时语音、P3 K12 的原分期 | 支付、原生、世界等未明确映射到 P 的部分不擅自补归属 |
| 原里程碑 | R1：本地干净库；R2：test 重放；R3：仅登记未来入口；具体链内沿用备注 | 现行口径继续有效；DEC-01 确认前不冻结失效，冲突见 DEC-01/12 |
| 验收环境（新增） | LOCAL / TEST / RELEASE | 说明在哪里验证；能在 TEST 重放不等于可面向真实用户 |
| 门控（新增） | CLOSED / INTERNAL / OPEN | 说明谁能访问；OPEN 需真实依赖、权限、内容和验收证据齐全 |
| 实现状态（新增） | 未核验 / 待实现 / 待验收 / 已验收 | 本次文档修订不代填“已验收” |

P1 定级新接口仍为默认路径；B25 只读迁移约定保留。L14/L15、L16、真实支付、完整离线等原先关闭的能力，不因这里补齐设计就自动准入。

### 0.2 每一步的最低验收契约（新增设计）

**触发与前置 → 权限与输入 → 持久化/源事实 → 成功读回 → 异常恢复 → 用户下一步。**

- 确认所属用户/租户/账号范围；前端隐藏不代替服务端鉴权。
- 同一操作重传用同一幂等键；真正的新操作换键；同键不同请求不得覆盖结果。
- 写入成功后可读回；“收到请求”“已保存”“下游更新中”“完成”不混用。
- 冲突先获取最新状态；结果未知先查回执；不能把所有失败都处理成不断重试。
- 事件消费者、权限、内容与供应商未准备好的入口，新增开发阶段默认不开放。
- 测试种子、stub、沙盒必须标识并隔离；不能形成真实成绩、奖励、费用或已上线证明。

具体字段名/接口路径以上位契约和仓库为准。本稿提出的逻辑字段不是声称现有 API 已经返回它们；落地时要同步接口、数据字典和测试，而不是由不同 Agent 各自命名。

### 0.3 冲突优先级与开门规则

同一 ID 的行为先服从根 AGENTS、有效 ADR 和现行 v2/业务运行基线；本稿主表与 C1–C10 共同解释反推建议，交互稿负责用户表达，不另造业务规则。`DEC-xx` 未签收的新增建议不能当已批准契约，也不能使上游已批准的业务失效。遇到冲突登记来源、影响与负责人，不自行替换技术栈、删历史字段、改变角色策略或修改原冻结口径。

源文“简审档已批”只保留本包历史出处。现行 Phase 1 业务运行基线要求内容作者、L1、L2、发布者分离；本包单人简审仅为本机演示提案，未获正式变更签收不得覆盖该基线（DEC-01/08）。禁 Electron、默认商业 RTC 和正式安全约束继续生效。本稿没有追加审批权限，隐私正文、数据保留、支付模式等决策不能由 Agent 自行签收。

---

## L1 注册入门环（R1，BC-001…012，owner：iam-service）

> 主路径先满足真实学习门，再让用户尽快进入可完成任务。成人门不通过仍应有允许的账号服务出口；三项同意的具体用途原文未给出，见 DEC-02。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-001<a id="bc-001"></a> | 访客浏览官网 11 页（只读投影） | 页面与目录如实；能学习、仅预览、暂无内容分别说明；不开假价格或“定级占位”；原型 #/about 外链仅为只读投影入口，官网内容承接待 DEC-08。 | [IC-001](interaction-chains.md#ic-001) |
| BC-002<a id="bc-002"></a> | 注册（identifier+密码+设备，TLS 直达 IAM） | 201 后只代表账号与会话建立；未过成人门或必要授权不得获得学习能力；失败不泄露账号存在性。 | [IC-002](interaction-chains.md#ic-002) / [IC-052](interaction-chains.md#ic-052) |
| BC-003<a id="bc-003"></a> | 重复注册同幂等键回放 | 同一主体、同一操作、同一请求返回同一结果；同键不同请求拒绝，不建立第二账号。 | [IC-002](interaction-chains.md#ic-002) / [IC-052](interaction-chains.md#ic-052) |
| BC-004<a id="bc-004"></a> | 登录/刷新/撤销（短时 JWT+轮换） | access token 仍在内存；可刷新时静默续期；不可刷新或被撤销才重登；授权不足不进入重登循环；见 C1。 | [IC-002](interaction-chains.md#ic-002) / [IC-053](interaction-chains.md#ic-053) |
| BC-005<a id="bc-005"></a> | 多设备登录与踢出 | 设备列表准确标识当前设备；踢出二次确认，原型 #/devices 踢出仅为预览确认，不执行真实会话撤销；被踢设备旧会话失效，解释原因并清除该账号本地私有状态。 | [IC-002](interaction-chains.md#ic-002) / [IC-008](interaction-chains.md#ic-008) / [IC-035](interaction-chains.md#ic-035) |
| BC-006<a id="bc-006"></a> | 成人门提交（birthYear+确认+版本） | PASSED/REJECTED 与审计可查；只采集现有契约所需年份，不擅自扩成完整生日；原型完整出生日期仅为本机演示手段，正式启用完整日期须经隐私审批（DEC待确认）；拒绝后的出口见 BC-201。 | [IC-003](interaction-chains.md#ic-003) / [IC-005](interaction-chains.md#ic-005) / [IC-055](interaction-chains.md#ic-055) |
| BC-007<a id="bc-007"></a> | 门未过的受限访问 | 账号、设置、隐私与真实可用的客服仍可访问；学习入口解释受限原因；不以无限加载或反复登录代替门状态。 | [IC-003](interaction-chains.md#ic-003) / [IC-005](interaction-chains.md#ic-005) / [IC-055](interaction-chains.md#ic-055) |
| BC-008<a id="bc-008"></a> | 三同意记录（动态读取已发布版本） | 逐项保存同意对象、版本、结果与来源记录；用途/必要性按 DEC-02 明确后实施（DEC待确认）；三项的当前版本均可在签名前读到，任一项读不到版本号时不展示签署按钮；可选授权默认不预勾；不能把未定义的可选授权默认绑到基础学习。 | [IC-003](interaction-chains.md#ic-003) / [IC-006](interaction-chains.md#ic-006) / [IC-056](interaction-chains.md#ic-056) |
| BC-009<a id="bc-009"></a> | 同意撤回与能力回收 | 撤回有回执且相关能力按既有契约返回 403；清楚列出影响，不扩大到无关能力；历史数据去向按隐私策略，不把撤回等同删除账号；原型本机同意记录不代表服务端授权，用途待 DEC-02。 | [IC-003](interaction-chains.md#ic-003) / [IC-006](interaction-chains.md#ic-006) / [IC-008](interaction-chains.md#ic-008) / [IC-036](interaction-chains.md#ic-036) / [IC-056](interaction-chains.md#ic-056) |
| BC-010<a id="bc-010"></a> | 画像目标+每日时长保存 | learner_goal 落库并读回；目标/时长用于开始学习；目标与时长必填，标签选填，标签留空不阻塞保存；标签是否必填按字段契约，修订建议可后补。 | [IC-004](interaction-chains.md#ic-004) / [IC-057](interaction-chains.md#ic-057) |
| BC-011<a id="bc-011"></a> | 首访向导（成人门→必要授权→目标→定级/快速开始） | 按实际完成状态续步；快速开始为已获准的次入口设计，契约兼容、实现与运行签核见 DEC-03；首次建计划确认后进入首学引导，取消不改变有效计划。 | [IC-004](interaction-chains.md#ic-004) / [IC-009](interaction-chains.md#ic-009) / [IC-057](interaction-chains.md#ic-057) |
| BC-012<a id="bc-012"></a> | 密码重置不枚举 | 申请无论账号存在与否均返回 202 和一致文案；凭据校验、失效与重试不得泄露账号；完成后给登录出口。 | [IC-002](interaction-chains.md#ic-002) / [IC-007](interaction-chains.md#ic-007) / [IC-054](interaction-chains.md#ic-054) |

## L2 定级环（R1，BC-013…022，owner：assessment-service）

> 保留 10 题定级和 SKIPPED 基线。快速开始业务路径已获准，其契约兼容、实现及运行签核仍待验证；定级反馈时点和本地持久暂存仍按对应决策处理，不靠伪造报告或离线成功补齐。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-013<a id="bc-013"></a> | P1 开题（10 道密封题，answer-free） | 满足学习门才建 session；实际有 10 道可用题后才能开题；原型 5 道固定样例仅演示流程，不计正式 10 题；下发无标准答案/解析库；开题失败不建假会话。 | [IC-010](interaction-chains.md#ic-010) / [IC-058](interaction-chains.md#ic-058) |
| BC-014<a id="bc-014"></a> | 逐题作答（checkpoint 顺序+版本锁） | 成功回执推进检查点；乱序/并发 409 后读最新进度，不盲重发；请求结果未知时先对账，再同键重试。 | [IC-011](interaction-chains.md#ic-011) / [IC-059](interaction-chains.md#ic-059) |
| BC-015<a id="bc-015"></a> | 规则判分（客观题） | 服务端保留 FULL/ZERO 与规则依据；定级逐题仅反馈已保存与进度、结束统一讲评为演示方案，是否全量切换待 DEC-04 确认，确认前不各自选一种（DEC待确认）；普通练习仍即时判分；不提前下发未答题答案。 | [IC-011](interaction-chains.md#ic-011) |
| BC-016<a id="bc-016"></a> | 完成出报告（reportId+digest 钉死） | 完成的报告为不可变快照；重复完成返回同一结果；报告未就绪显示处理中，不把空对象当已完成报告。 | [IC-012](interaction-chains.md#ic-012) |
| BC-017<a id="bc-017"></a> | 跳过定级（fast-track，非权威 hint） | 保留 SKIPPED 基线；以显式来源向 BC-023 传递，不伪造测评分数或报告；跳过入口属于已获准的 R1 设计，契约兼容、实现与运行签核见 DEC-03；单题跳过不计分、可补答，不等同整轮 fast-track。 | [IC-010](interaction-chains.md#ic-010) / [IC-058](interaction-chains.md#ic-058) |
| BC-018<a id="bc-018"></a> | 定级重测（新 session，旧报告保留） | 用户确认后新开；旧报告可查；说明是否影响当前计划，只有确认重排才走 BC-029，不静默覆盖旧计划。 | [IC-012](interaction-chains.md#ic-012) |
| BC-019<a id="bc-019"></a> | B25 旧口只读兼容 | 保留原迁移约定：R1.2 切新口时关闭写口，只读到R2 末；实际日期/迁移证据待发布登记，不据文档宣称已下线。 | [IC-010](interaction-chains.md#ic-010) |
| BC-020<a id="bc-020"></a> | 题库 10 道种子（3/3/2/2，数据·一次性） | 干净库重放 10 行、分布与答案隔离正确；这是种子核验，不代表所有目标/难度已经具备持续内容供给。 | 技术/数据/治理准入验收，无独立用户幕 |
| BC-021<a id="bc-021"></a> | B3 练题绑定 5 道（数据·一次性） | 绑定 5 行、干题无答案；真实学习目录能否开放另按 C9 内容覆盖门，不把种子数当可运营证明。 | 技术/数据/治理准入验收，无独立用户幕 |
| BC-022<a id="bc-022"></a> | 定级断点恢复 | 以服务端已接收 checkpoint 恢复，先查最新检查点再决定重试，不无条件新开 session；未提交答案只在明确支持的暂存范围恢复（断网草稿只存题号与选项）；身份改变取消旧回调；不承诺完整离线；本地持久暂存待 DEC-05。 | [IC-010](interaction-chains.md#ic-010) / [IC-011](interaction-chains.md#ic-011) / [IC-019](interaction-chains.md#ic-019) / [IC-059](interaction-chains.md#ic-059) |

## L3 计划今日环（R1，BC-023…032，owner：learning-service）

> 今日页以学习者能做什么为中心；先确保有真实内容，再显示开始。计划生成、今日任务来源和任务空态必须能解释。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-023<a id="bc-023"></a> | ensure：校验输入→pin→生成计划 | 目标规则接受已获准的 ASSESSED 正式报告或 SKIPPED 保守起步来源；快速开始不得要求用户补造正式报告，SKIPPED 固定 UNVERIFIED、coverage=0、aggregateScore/referenceLevel 为空；目标、资格和可学内容满足才建初始计划。DEC-03 跟踪契约兼容、实现、幂等与运行签核，不能据设计视为已接通；首次确认进入首学引导，取消调整不改变有效计划；保存不可变来源快照；输入不足返回可解释状态，不生成空计划冒充成功。 | [IC-013](interaction-chains.md#ic-013) |
| BC-024<a id="bc-024"></a> | ensure 幂等重放 | 相同学习者、输入版本与请求返回同一计划；来源/目标改变视为新操作，不能沿用旧幂等键覆盖旧结果。 | [IC-013](interaction-chains.md#ic-013) |
| BC-025<a id="bc-025"></a> | 首页计划横幅（planningInput+plan 内嵌） | 显示当前目标、预计时长与计划状态；无计划、生成中、可学习、已完成、加载失败分开；不只以 planId 存在判断可开始。 | [IC-020](interaction-chains.md#ic-020) |
| BC-026<a id="bc-026"></a> | 计划解释（一句话说明来路） | 根据真实输入解释；跳过定级时标“初始安排，后续按练习调整”，不得暗示已经精准测得用户水平。 | [IC-014](interaction-chains.md#ic-014) / [IC-020](interaction-chains.md#ic-020) |
| BC-027<a id="bc-027"></a> | 今日任务下发（practiceRef 指针） | 指针有效且内容可访问；所有时长档使用同一获准候选池，恢复→到期验证→到期 SRS→补救→目标关键项→新学→可选项，归并、排序及预算沿用 C4 的冻结规则；静态演示可用样例预估，不可按时长模板先放新学而漏掉到期项。任务卡用时仅为预估不计实际时长；跨日接回保留原题与草稿且任务身份与原安排日期分离；任务为空返回原因，完成事件与下游投影分开显示；同源归并不重复计预算与展示；用量口径见 BC-065/BC-066。 | [IC-015](interaction-chains.md#ic-015) / [IC-017](interaction-chains.md#ic-017) / [IC-018](interaction-chains.md#ic-018) / [IC-019](interaction-chains.md#ic-019) / [IC-021](interaction-chains.md#ic-021) |
| BC-028<a id="bc-028"></a> | 无计划与今日空态分流 | 区分未建计划、今日完成、暂无内容、暂无到期复习、请求失败；分别提供建计划/结束/可用内容/重试；不统一引导重测。 | [IC-016](interaction-chains.md#ic-016) / [IC-020](interaction-chains.md#ic-020) |
| BC-029<a id="bc-029"></a> | 目标变更与计划重排（版本锁） | 调整前预览变化并提供保留/重新安排选择，确认影响，保留已完成记录与旧快照；采用 C4 的 totalCap=ceil(用户分钟×1.10)，不把超过名义分钟但仍在 cap 内的合法安排拒绝。任务整体装入，未装入项说明原因与后续安排；延期仅限获准 repair/goal/new/optional，不能改 SRS/验证 dueAt；已开始进度保留。并发时读最新目标，新 plan/overlay 版本不抹掉历史。 | [IC-013](interaction-chains.md#ic-013) / [IC-017](interaction-chains.md#ic-017) |
| BC-030<a id="bc-030"></a> | 跨端读回一致（Web/H5） | 同账号读同一有效 planId/版本；切换后刷新最新状态；旧页面提交冲突时引导恢复，不回写过期计划。 | [IC-020](interaction-chains.md#ic-020) |
| BC-031<a id="bc-031"></a> | 计划 input snapshot 不可变 | 历史快照不原地修改；变更新建版本；篡改 409；解释内容引用生成当时版本，避免历史理由随配置漂移。 | [IC-013](interaction-chains.md#ic-013) |
| BC-032<a id="bc-032"></a> | 首次学习任务（修订：按完成状态而非注册 24h） | 未完成首次学习可继续引导；已完成不再重复首访；“注册 24h”仅可作分析维度，不作为用户能否获得引导的门。 | [IC-009](interaction-chains.md#ic-009) / [IC-015](interaction-chains.md#ic-015) / [IC-021](interaction-chains.md#ic-021) |

## L4 练题判分环（R1，BC-033…044，owner：assessment-service）

> 判分源事实与错题、复习、成长投影分开。业务已保存后，下游慢不应让用户重答；普通练习保留即时反馈。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-033<a id="bc-033"></a> | B10 建单（内容码+版本 pin） | 验证内容可学与计划指针后建 session；锁定题目/内容版本；重复开单按契约复用，查看旧结果不复用原会话，重练按新轮次建单，防止双击生成多个进行中会话。 | [IC-022](interaction-chains.md#ic-022) / [IC-109](interaction-chains.md#ic-109) / [IC-110](interaction-chains.md#ic-110) |
| BC-034<a id="bc-034"></a> | 语法 3 道可练可判 | 按真实题包返回 FULL/ZERO；错误进入错题链；成功提交与异步入本状态分开，不要求用户重复做题。 | [IC-022](interaction-chains.md#ic-022) |
| BC-035<a id="bc-035"></a> | 阅读 2 道可列可判 | 与语法统一提交/判分/检查点契约；缺内容诚实关闭，不自动拿不匹配题目凑数。 | [IC-022](interaction-chains.md#ic-022) |
| BC-036<a id="bc-036"></a> | 会话内作答与行内反馈 | 提交→确认已保存→展示对错与解释；未答完全部题目不允许交卷，部分选择按任务独立保存；明确“下一题”；颜色之外有文字反馈；无全局跳页或无依据的自动推进。 | [IC-022](interaction-chains.md#ic-022) / [IC-111](interaction-chains.md#ic-111) |
| BC-037<a id="bc-037"></a> | 练习检查点与断点续练 | 恢复最近已接收题目/单元；未提交草稿有明确保存范围；各任务独立保存题目/选择/位置/提交轮次、切换前保存按任务恢复，查看结果不推进原轮次；刷新、返回、跨端恢复的依据一致，本机暂存范围待 DEC-05 确认，见 C2。 | [IC-019](interaction-chains.md#ic-019) / [IC-023](interaction-chains.md#ic-023) |
| BC-038<a id="bc-038"></a> | 课程会话单元渲染 | 显示章节、进度与下一步；章节完成幂等同步匹配的今日/顺延任务，收藏/笔记/查词上下文保留原章节；返回再进保留已确认位置；内容被强制下线时停止加载并给替代出口。 | [IC-023](interaction-chains.md#ic-023) |
| BC-039<a id="bc-039"></a> | 判分规则版本 pin | 旧会话沿用建立时的规则版本；新版本不重写旧 attempt；确需纠错走独立可审计流程，不悄悄改历史。 | [IC-022](interaction-chains.md#ic-022) |
| BC-040<a id="bc-040"></a> | attempt 不可变 | 原始有效作答与回执不可原地篡改；非法修改沿用 409 拒绝；下游状态可重建但不得伪造源作答。 | [IC-023](interaction-chains.md#ic-023) |
| BC-041<a id="bc-041"></a> | 同题并发/重复提交幂等 | 同操作只接收一次并返回同回执；不同设备并发以版本锁裁决；客户端读回最新状态，不静默丢弃已接收答案。 | [IC-022](interaction-chains.md#ic-022) |
| BC-042<a id="bc-042"></a> | 词汇详情（large-vocab） | 释义/例句/发音按真实可用字段展示；缺媒体不显示能播放；刷词选择后锁定，同一逻辑错题只登记一次，测验对率与自评认识分别显示；原型缺搭配例句明示暂无已核对；搜索/详情不暴露题库答案或无权内容。 | [IC-024](interaction-chains.md#ic-024) / [IC-025](interaction-chains.md#ic-025) |
| BC-043<a id="bc-043"></a> | 听力/口语/写作能力关闭边界 | 未开放模块默认不占主导航；写作按任务独立草稿、稳定提交身份与未知单存、跨日分离，听力须答完全部题目方可提交，口语按稳定轮次区分查看与新开一轮；旧链接解释原因并回可用学习；有文本替代也须确有授权/内容；不写内部里程碑日期；原型 Video Call 未开与演示分仅为设计稿，真链待 DEC-11；本机草稿与离线边界待 DEC-05 确认。 | [IC-024](interaction-chains.md#ic-024) / [IC-026](interaction-chains.md#ic-026) / [IC-027](interaction-chains.md#ic-027) / [IC-028](interaction-chains.md#ic-028) |
| BC-044<a id="bc-044"></a> | 练习完成事件出盒（Kafka） | 本地事务提交+outbox 可查；投递/重试/DLQ 可查；成长未开放时不显示奖励；L11 准入后再验实际结算，不阻塞作答成功。 | [IC-018](interaction-chains.md#ic-018) |

## L5 错题补救环（R1，BC-045…054，owner：learning-service）

> 补救是一条可恢复的学习路径，不是额外罚做。变式题缺货时说明真实情况；与到期复习共用今日任务归并。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-045<a id="bc-045"></a> | 错题入本（判 ZERO） | 只对符合规则的错误作答入本；来源 attempt 可追；聚合/去重后数量不强求等于 attempt 数；正确作答不为凑数建错题。 | [IC-030](interaction-chains.md#ic-030) |
| BC-046<a id="bc-046"></a> | 补救任务生成 | 任务关联错误来源、知识点与内容版本；错题投影按 sourceAssessmentEventId+itemId+projectionVersion 去重，进入计划的普通候选按 logicalItemId 去重并保留全部源事实及压制原因。重复提交/事件不新建第二投影，合法新 attempt 按其规则留独立事实，不以“同知识点”吞掉新证据；对账见 BC-203，预算见 C4。 | [IC-030](interaction-chains.md#ic-030) |
| BC-047<a id="bc-047"></a> | 变式再练 | 必须是真实可用且有关联依据的变式题，按 skill 匹配，缺变式保留待补救不用他题替代；无可用变式给解释/后续安排，不以原题冒充变式。 | [IC-030](interaction-chains.md#ic-030) |
| BC-048<a id="bc-048"></a> | 变式通过后的销账 | 通过后更新本次补救状态并留痕；自评不记验证通过，变式通过只记本次修复。D1 为当场修复当地日期之后第一个配置学习日；D7 nominal date 为 D1 PASS 当地日期+7 个日历日，scheduled date 为当日或之后第一个配置学习日；保存各日期、dueAt、时区和学习日快照，沿用 C4。一次通过不等于永久掌握。 | [IC-030](interaction-chains.md#ic-030) |
| BC-049<a id="bc-049"></a> | 掌握度投影更新 | 由有效作答/补救事件驱动，可追溯来源与版本；投影更新中有状态；不让用户直接写权威掌握度。 | [IC-031](interaction-chains.md#ic-031) |
| BC-050<a id="bc-050"></a> | 弱点页 | 显示有证据的薄弱项与可执行练习入口；数据不足说明尚不能判断，不编造分数或心理判断。 | [IC-031](interaction-chains.md#ic-031) |
| BC-051<a id="bc-051"></a> | D+1/D+7 回顾 | 验收使用可控时钟，日期严格按 BC-048 及上游学习规则 §7.3；与 SRS/补救按 canonical logicalItemId 去重，保留被压制来源，不把一次动作自动结清全部不同目的。未到期禁用提交；用户重排不能改验证 dueAt，失败进入 REOPENED；无合法内容显示 WAITING_FOR_CONTENT，不假通过。 | [IC-031](interaction-chains.md#ic-031) |
| BC-052<a id="bc-052"></a> | 全对/无错题空态 | 区分尚未练习与已练但无错题；允许结束学习或做可用练习，不把“空本”解释成数据失败。 | [IC-030](interaction-chains.md#ic-030) |
| BC-053<a id="bc-053"></a> | 跨端错题一致 | 按同一主体、游标与投影版本读回；异步延迟可解释；不能用重复答题催促同步。 | [IC-030](interaction-chains.md#ic-030) |
| BC-054<a id="bc-054"></a> | 补救中断恢复 | 恢复同一补救任务和已确认进度；重试不重复销账；内容失效时保留历史并说明可用替代。 | [IC-030](interaction-chains.md#ic-030) |

## L6 SRS 复习环（R1，BC-055…062，owner：learning-service）

> SM2_Q03_V1 的公式、质量约束、间隔、IANA 时区与 DST 决议已由上游学习规则 §6 冻结，沿用 C4 引用，不重新候选参数。可信结果是推进依据；静态自评、撤销和日期演示不能成为权威复习事实，新增撤销补偿边界仍见 DEC-07。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-055<a id="bc-055"></a> | SRS 入库（SM2_Q03_V1） | 沿用上游 §6 的完整 SM2_Q03_V1 policy，客观判分约束 q，自评不能伪造 objective outcome；每个 item 独立 state，learning owner 接受可信结果并保存前后版本和算法审计。既有算法、候选去重和错题投影键不待 DEC-07 重选；对账见 BC-203；新增跨批撤销补偿另签收。 | [IC-032](interaction-chains.md#ic-032) |
| BC-056<a id="bc-056"></a> | 复习到期提醒（混入今日） | 服务端接受 review 的 UTC reviewedAt 按 pin 的 IANA 时区加日历日生成 dueAt，DST gap 前移到首个合法时间、overlap 取较早 offset；切时区不改既有 dueAt。日历/今日读同源到期事实，按 C4 冻结优先级、预算及 CATCH_UP 编排；装不下的到期项显式显示剩余，不改到期事实或伪称清完。 | [IC-015](interaction-chains.md#ic-015) / [IC-017](interaction-chains.md#ic-017) / [IC-021](interaction-chains.md#ic-021) / [IC-032](interaction-chains.md#ic-032) |
| BC-057<a id="bc-057"></a> | 关闭自报直写 | 不接受用户绕过可信作答直接写权威 stage；保留原 409 契约，界面解释操作不可用，不暴露内部错误码。 | [IC-032](interaction-chains.md#ic-032) |
| BC-058<a id="bc-058"></a> | 复习完成事件 | 仅可信完成推进，事件幂等可重放；多批累计按任务目标集合追溯来源，重复通知不重复推 stage 或发奖励。静态撤销仅演示本次评分来源重算，不删除正式不可变 attempt/review/奖励账本，不补造记录或 XP；新增跨批撤销权限、补偿命令及其窗口待 DEC-07，不重定义现有 owner/聚合/算法规则。 | [IC-032](interaction-chains.md#ic-032) |
| BC-059<a id="bc-059"></a> | 复习历史 | 显示实际完成、延期和算法版本/必要解释；没有历史时引导可用学习，不把未来任务当已完成。 | [IC-032](interaction-chains.md#ic-032) |
| BC-060<a id="bc-060"></a> | 遗忘回退（stage 回落） | 由可信结果与既定规则触发，回落有原因；不把接口重试或系统延迟算作遗忘。 | [IC-032](interaction-chains.md#ic-032) |
| BC-061<a id="bc-061"></a> | 空复习队列 | 暂无到期任务、尚无学习记录与读取失败分开；到期为空允许结束或新学，不逼迫重测。 | [IC-016](interaction-chains.md#ic-016) / [IC-032](interaction-chains.md#ic-032) |
| BC-062<a id="bc-062"></a> | SRS 跨端一致 | 同账号最终读回同 stage/版本；旧事件不倒序覆盖新状态；并发推进去重，见 C3/C4。 | [IC-032](interaction-chains.md#ic-032) |

## L7 报告复盘环（R1，BC-063…070，owner：assessment-service）

> 报告验数据口径和可解释性，不只验 HTTP 200。正式测评报告与普通学习报告分开；分享是额外授权，不是默认公开。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-063<a id="bc-063"></a> | 定级报告卡（双端） | 报告引用不可变快照；与报告页同版本；SKIPPED 基线不显示为正式测评分数。 | [IC-012](interaction-chains.md#ic-012) |
| BC-064<a id="bc-064"></a> | 日报/周报 | 显示统计范围、更新时间与学习日口径；空、生成中、部分数据与失败分开；接口 200 不替代数据口径验收。 | [IC-033](interaction-chains.md#ic-033) |
| BC-065<a id="bc-065"></a> | 学习时长统计 | 沿用上游 §9.4：仅汇总 owner accepted、由版本化 P1_SESSION_V1 服务端 activity policy 产生的 creditedSeconds/60；不能用客户端计时、页面打开、后台停留、任务预估或报告临时估算替代。回顾/历史/日报/周报同源，迟到事实创建新 reportVersion，不改旧快照；若提议新增计时或补偿政策，才进入 DEC-07。下发用量见 BC-027。 | [IC-033](interaction-chains.md#ic-033) |
| BC-066<a id="bc-066"></a> | 新学/复习拆分 | 与 today 任务归并规则一致；同一次有效活动不能在新学和复习各计一次；报告与回顾/历史同源已保存轮次；下发用量口径见 BC-027；报告能追到源记录。 | [IC-033](interaction-chains.md#ic-033) |
| BC-067<a id="bc-067"></a> | 教练建议（下周练什么） | 先用可解释规则和真实记录；规则建议须注明依据的学习记录范围；依据不足时只给起步建议并说明数据尚少，不把规则建议包装成已开放的 AI 功能。 | [IC-033](interaction-chains.md#ic-033) |
| BC-068<a id="bc-068"></a> | 报告分享（只读深链） | 用户主动分享、最小公开字段；不携带登录 token；新增设计要求不可枚举分享引用、撤销/有效期，不能暴露完整私有报告。 | [IC-033](interaction-chains.md#ic-033) |
| BC-069<a id="bc-069"></a> | 无数据报告 | 区分从未学习与统计未就绪；给开始学习或稍后刷新；不用零分暗示未学习者能力差。 | [IC-033](interaction-chains.md#ic-033) |
| BC-070<a id="bc-070"></a> | 报告版本固定 | 历史报告不因规则更新而改写；数据纠错另产版本并标记关系，不静默改变已分享结果。 | [IC-033](interaction-chains.md#ic-033) |

## L8 内容双审发布环（本包历史 R1 简审提案，BC-071…084，owner：content-service）

> 正式职责分离与 canonical 状态继续服从上游；本包简审只作本机演示，正式例外待 DEC-01/08 签收，不让单人团队伪造双签。发布事实、目录同步和内容分发权限是不同状态；媒体前置待 DEC-08。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-071<a id="bc-071"></a> | 建草稿（202+版本） | 回执与实际处理状态一致；可读取草稿或明确处理中；首次创建失败不出现不可定位的“幽灵草稿”。 | [IC-040](interaction-chains.md#ic-040) |
| BC-072<a id="bc-072"></a> | 草稿编辑（版本锁） | 保存成功可读回；冲突显示最新版本和自己的未提交修改；不能自动用旧内容覆盖他人编辑。 | [IC-040](interaction-chains.md#ic-040) |
| BC-073<a id="bc-073"></a> | 无权建稿/读写边界 | 先鉴权再返回业务细节；沿用 403，不通过未知编码泄漏资源存在性；前端不给绕过权限的替代按钮。 | [IC-040](interaction-chains.md#ic-040) |
| BC-074<a id="bc-074"></a> | 送审资格（版权+报告+必要媒体） | 沿用 409 并一次返回所有缺项；按内容类型判断必要媒体；媒体来源/覆盖待 DEC-08；不靠伪造媒体或空报告让送审通过。 | [IC-041](interaction-chains.md#ic-041) |
| BC-075<a id="bc-075"></a> | 双签模式 L1 初审 | 正式 L1 主体有权限且不是作者/申请人；决定只允许 APPROVED/CHANGES_REQUESTED/REJECTED，绑定内容版本/hash、FIRST_REVIEW 和独立 reviewVersion，保留历史决定。退回/驳回须记录可读的结构化原因、按敏感数据规则保存备注并通知作者；随后创建新 DRAFT 版本，重新校验、送审，不原地改已审核 hash 沿用批准。本机简审不伪造第二签，正式例外待 DEC-01/08。 | [IC-041](interaction-chains.md#ic-041) |
| BC-076<a id="bc-076"></a> | 双签模式 L2 终审 | 同版本/hash 的 FIRST_REVIEW=APPROVED 才可 FINAL_REVIEW；L2 与作者、L1 主体分离，决定同样只允许 APPROVED/CHANGES_REQUESTED/REJECTED，绑定独立 reviewVersion 并保留原因/历史/通知结果。L2 退回或驳回后创建新 DRAFT 版本重校验、重新两级审核；并发决定去重，旧签核不转移到新版本。正式职责分离不能以昵称或演示模式绕过。 | [IC-041](interaction-chains.md#ic-041) |
| BC-077<a id="bc-077"></a> | 审批通过（原 ACTIVE 显示别名） | 审核通过只形成该版本的 APPROVED 资格；正式 PUBLISH 为独立受控命令，发布者与作者/L1/L2 分离且须复核版权、媒体、阶段、版本和签核。ACTIVE 只作旧原型显示别名，不作为平行持久状态或自动发布事实。目录同步另行追踪；简审正式例外待 DEC-01/08 签收。 | [IC-041](interaction-chains.md#ic-041) |
| BC-078<a id="bc-078"></a> | 发布→目录投影 | 发布成功产生独立不可变已发布快照与发布指针，不与可编辑草稿共用对象；新修订不改旧在架快照。发布事实与目录同步状态分别持久化，刷新/切页/晚回调不伪造已同步，按版本与命令对账。用户端只读获准版本；content owner 的 PUBLISHED/Outbox 与各投影水位独立核验。 | [IC-042](interaction-chains.md#ic-042) |
| BC-079<a id="bc-079"></a> | 下架→目录回收 | 普通下架停止新分发；强制停止必须选择或填写有效处置原因，空原因不得提交；原因、禁供事实、目标版本、command、实际主体、时间与审计关联并在详情读回，不能用固定文案代用户决定。强停阻断旧会话/媒体后续授权；普通回滚不得清除禁供，解除走独立获准处置。离线字节限制见 C6/DEC-08，不能承诺立即召回。 | [IC-042](interaction-chains.md#ic-042) |
| BC-080<a id="bc-080"></a> | v2 发布与回滚 v1 | 只能从已发布历史快照中选与当前版本不同、版权/媒体/阶段/签核仍有效且无强制禁供的候选；旧版本为空时无回滚动作。回滚切发布指针并另记命令/审计/同步结果，不能把当前下架对象直接改成在架或复活失效版本。 | [IC-042](interaction-chains.md#ic-042) |
| BC-081<a id="bc-081"></a> | 版权提案绑定 | 送审前绑定具体内容版本与适用范围，绑定缺失/失效不送审；已绑定但审核中失效同样不发布；不因有提案编号就默认权利有效。 | [IC-040](interaction-chains.md#ic-040) |
| BC-082<a id="bc-082"></a> | 审核报告绑定 | 送审前绑定与内容版本/审核模式一致的报告；版本改变或模式切换需按策略重审，不复用不匹配报告绕过校验。 | [IC-041](interaction-chains.md#ic-041) |
| BC-083<a id="bc-083"></a> | 旧 B3 精确下线（113+2，数据·一次性） | 保留原指定下线量与清单核对；回滚记录可查；113+2 是原清理口径，不是本包 BC 缺号说明。 | 技术/数据/治理准入验收，无独立用户幕 |
| BC-084<a id="bc-084"></a> | 简审档（本包历史提案） | 小团队 1 人可发只保留为本包历史提案和明确标记的本机演示；现行正式基线仍要求作者/L1/L2/发布者分离。正式简审例外须由产品/架构/内容责任人通过 DEC-01/08 和变更单签收，签收前不生成虚假双签或正式发布资格；模式切换不能复用不匹配签核。 | [IC-041](interaction-chains.md#ic-041) |

## L9 风控治理环（R1 读建档+R3 处置，BC-085…094，owner：admin-ops-service）

> 原“读建档”与真锁定/隔离/升级的开放边界不一致，见 DEC-01。写处置链未准入时保持原只读范围，不因按钮存在就视为可用。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-085<a id="bc-085"></a> | 账号/内容真锁定 | R1 保持只读建档、不执行锁定；锁定属 R3 处置写链，原文与“R3 处置”存在开放边界歧义，按 DEC-01 冻结写入开关；开启后锁定理由、影响与恢复条件均可查。 | [IC-050](interaction-chains.md#ic-050) |
| BC-086<a id="bc-086"></a> | 风险评估建档 | R1 只建有来源的只读档案，不生成示例当真数据，不执行处置；建档与实际处置状态分离，权限控制读写。 | [IC-050](interaction-chains.md#ic-050) |
| BC-087<a id="bc-087"></a> | 风险分诊 | 处置写链准入后启用；分派/退回有状态、操作者与时间；分派后接收方不可用时按 BC-089 处理，不显示已派单；失败不显示已派单。 | [IC-050](interaction-chains.md#ic-050) |
| BC-088<a id="bc-088"></a> | 隔离 | R1 保持只读、不执行隔离；与普通锁定/下架影响区分；重复操作幂等；解除须另有授权与审计，不靠前端恢复按钮直接解锁。 | [IC-050](interaction-chains.md#ic-050) |
| BC-089<a id="bc-089"></a> | 升级 | R1 保持只读、不执行升级；保留原案件与证据链，升级原因明确；接收方不可用时不伪造接单成功。 | [IC-050](interaction-chains.md#ic-050) |
| BC-090<a id="bc-090"></a> | 关闭（原 13 步治理链） | R1 保持只读、不执行关闭；原“13 步”细节未随本包提供，未补齐前不宣称全链通过；关闭要求满足案件策略并能追溯处置结果。 | [IC-050](interaction-chains.md#ic-050) |
| BC-091<a id="bc-091"></a> | 治理页风险区 | 真实案件、过滤条件、更新时间可查；无案件与无权限分开，无案件时不展示处置按钮；不单独虚构风险页面数据。 | [IC-050](interaction-chains.md#ic-050) |
| BC-092<a id="bc-092"></a> | 无独立 /risk 路由 | 保留并入治理页的范围；旧入口跳到有权页面，不能绕过治理区权限。 | [IC-050](interaction-chains.md#ic-050) |
| BC-093<a id="bc-093"></a> | 举报只读队列（R1） | 脱敏+游标；匿名 401；管理员也仅查看授权范围；来源/状态说明清楚。 | [IC-051](interaction-chains.md#ic-051) |
| BC-094<a id="bc-094"></a> | 举报处置写链（R3） | R1/R2 保持只读；具体启用条件待 DEC-01；未启用隐藏处置按钮，服务端同样拒绝写入。 | [IC-051](interaction-chains.md#ic-051) |

## L10 消息通知环（R1 读+R2 写，BC-095…102，owner：notification-service）

> 原链内包含读、偏好写、第三方渠道和完整离线，不再笼统称“全链只读/已可同步”。本地草稿恢复不等于离线包能力。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-095<a id="bc-095"></a> | 通知列表+已读 | 通知必须有真实来源或明确测试标识，原型点赞/好友学时已标演示，定级时长无实测不展示；已读幂等且可读回；无消息不当作系统失败。 | [IC-060](interaction-chains.md#ic-060) |
| BC-096<a id="bc-096"></a> | 偏好版本写回读 | 乐观状态失败要回退并保留用户选择；一次指出冲突项；偏好持久化与渠道实际可发送分开。 | [IC-034](interaction-chains.md#ic-034) / [IC-061](interaction-chains.md#ic-061) |
| BC-097<a id="bc-097"></a> | 免打扰部分失败重试 | 列出成功/未成功项目；只重试失败项且同键；不得整体显示已保存掩盖部分失败。 | [IC-034](interaction-chains.md#ic-034) / [IC-061](interaction-chains.md#ic-061) |
| BC-098<a id="bc-098"></a> | 登出/切号清空 | 登出或切号时清除该账号私有通知、草稿及敏感缓存；不清掉其他账号服务器数据；异步回包不可写入新账号界面。 | [IC-061](interaction-chains.md#ic-061) |
| BC-099<a id="bc-099"></a> | 真实事件驱动通知（R2） | 领域事件去重后生成；旧事件回放不重复轰炸；用户撤权/停用后按通知策略处理，不继续发送无权内容。 | [IC-060](interaction-chains.md#ic-060) |
| BC-100<a id="bc-100"></a> | Push/Email/SMS（R3） | 第三方与授权未准备前保持关闭；界面不提供会无效保存的“已启用”开关；R3 第三方渠道开放待 DEC-01，确认前保持关闭；开放后验退订、免打扰与失败状态。 | [IC-061](interaction-chains.md#ic-061) |
| BC-101<a id="bc-101"></a> | 离线包列表读 | 列表读取不等于包可下载；返回包版本、可用性与限制；没有离线能力时不作为主入口推广；原型无必败下载、大小“—”不虚构已符合。 | [IC-062](interaction-chains.md#ic-062) |
| BC-102<a id="bc-102"></a> | 完整离线下载/同步（R3） | 字节分发与冲突策略未准入前关闭；已存在的 404 接口不展示成可点下载；启用需内容权限、版本、切号清理与同步证据；R3 开放待 DEC-01，目录可读不等于可下载。 | [IC-019](interaction-chains.md#ic-019) / [IC-062](interaction-chains.md#ic-062) |

## L11 成长激励环（R2，BC-103…110，owner：gamification-service）

> 奖励只能从真实可信完成结算。成长未准入不阻止基础学习完成；本地事件测试与真实用户成长结算分开。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-103<a id="bc-103"></a> | 可信完成→成长结算（Kafka） | 只消费可信完成事件；+XP 有账本依据；未结算显示处理中，不在前端预加不可回溯奖励；原型本地 XP 仅演示计算不记账本，结算开放待 DEC-12。 | [IC-018](interaction-chains.md#ic-018) / [IC-063](interaction-chains.md#ic-063) |
| BC-104<a id="bc-104"></a> | 重放不重结 | 同一结算业务键只有一笔有效入账；失败可重试；补偿与冲正另记，不删除原账掩盖差异。 | [IC-063](interaction-chains.md#ic-063) |
| BC-105<a id="bc-105"></a> | 打卡日历 | 学习日/时区与报告一致，真实完成才点亮，不预填连续天数；沿用上游学习规则 §10，切时区保留已保存 dueAt 的 UTC 事实，显示及下一轮计划使用新时区，防止同学习日重复 Streak/任务。新增迁移或补偿差异才待 DEC-07。 | [IC-063](interaction-chains.md#ic-063) |
| BC-106<a id="bc-106"></a> | 任务奖励领取 | 仅权益写链真实可用时开放；成功可读回；未准入给不可用原因，不把通用 503 当“购买会员即可解锁”；原型只看不动账，开放待 DEC-12。 | [IC-063](interaction-chains.md#ic-063) |
| BC-107<a id="bc-107"></a> | 成就展示 | 已获/未获/未开放分开；规则与证据可查；未上线奖励不展示可领取红点。 | [IC-063](interaction-chains.md#ic-063) |
| BC-108<a id="bc-108"></a> | 装扮 entitlement 门 | 依据服务端权属与功能开关判断；未开放与无权属分开；缺写链时隐藏交易动作。 | [IC-064](interaction-chains.md#ic-064) |
| BC-109<a id="bc-109"></a> | 空房间/空榜边界 | 未开放默认藏入口，旧链接解释；开放但无数据才用空态；没有已确认日期就不写开放时间承诺；原型 closed 项不写日期已符合，目录可点不等于可开放，待 DEC-12。 | [IC-064](interaction-chains.md#ic-064) |
| BC-110<a id="bc-110"></a> | 社交 rooms（R3，有用户才开） | 与 BC-118/119 的 R2 标签统一待 DEC-12，R2/R3 冲突裁定确认前按关闭处理，不用本地 stub 证明真实社交可开放。 | [IC-064](interaction-chains.md#ic-064) |

## L12 商城空态（R1/R2，BC-111…112，owner：commerce-service）

> 支付功能仍在 L17。本链保留空目录读取和测试意图，但学习主导航不推广空商城。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-111<a id="bc-111"></a> | 空商城目录（R1/R2） | 学习端不以空商城占主路径；历史入口解释当前不支持购买并返回可用学习；后台保留诚实目录读回；原型沙盒标记已符合，正式购买开放待 DEC-01，真通道待 DEC-10。 | [IC-038](interaction-chains.md#ic-038) / [IC-065](interaction-chains.md#ic-065) |
| BC-112<a id="bc-112"></a> | 沙盒支付意图（R2，SANDBOX） | 仅测试角色/环境可见；意图落库，不扣真款、不发真实付费权益；绝不混入真实订单报表；原型沙盒标题与重复确认不建单已符合。历史映射：原 BC-114（沙盒意图）内容并入本步，见合并提交 8570fe1a；旧号 BC-113/114/115/116 不复用。 | [IC-065](interaction-chains.md#ic-065) |

## L13 世界成长环（R2，BC-117…130，owner：social/gamification）

> 保留R2 总标签作为历史备注；社交房间与 BC-110 的R3 冲突见 DEC-12。目录、可玩性、权益与治理分别准入，不能只因目录有数据就全部开放。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-117<a id="bc-117"></a> | 个人空间只读参观 | 原只读范围保留，真实开放范围待 DEC-12；未开放默认隐藏；原型只读参观数据仅占位，开放待 DEC-12；不以空房间和未知开放时间替代产品能力。 | [IC-064](interaction-chains.md#ic-064) / [IC-066](interaction-chains.md#ic-066) |
| BC-118<a id="bc-118"></a> | 房间加入/席位/续租 | 阶段与 BC-110 统一待 DEC-12；启用后校验资格/容量/租期；断线释放/重入幂等，不能多占席位。 | [IC-067](interaction-chains.md#ic-067) |
| BC-119<a id="bc-119"></a> | 专注/互动（低 UGC 治理） | 开放依赖房间与治理；互动待审/已发布/被拒清楚区分；治理不可用时不开放写入。 | [IC-068](interaction-chains.md#ic-068) |
| BC-120<a id="bc-120"></a> | 排行榜投影与反刷 | 只由可信账本投影；赛季未开始、暂无上榜与加载失败分开；原型演示伙伴已声明非真人，上线按许可隐藏实名，待 DEC-12；不公开无关个人资料。 | [IC-069](interaction-chains.md#ic-069) |
| BC-121<a id="bc-121"></a> | 服装目录+试穿 | 试穿不改变权属和装备；退出可恢复原装；原型试穿不落库、本机 SVG 降级已符合；目录未开放隐藏，不让无效兑换成为主要按钮。 | [IC-070](interaction-chains.md#ic-070) |
| BC-122<a id="bc-122"></a> | 服装兑换（entitlement 写链） | 兑换校验余额/条件并幂等入权属；结果未知先查单，不重复扣减；没有完整写链不开放。 | [IC-071](interaction-chains.md#ic-071) |
| BC-123<a id="bc-123"></a> | 装扮装备/卸下 | 仅本人有效权属可装备；并发版本控制；卸下可读回；过期/撤销权益后的替换规则需明确。 | [IC-071](interaction-chains.md#ic-071) |
| BC-124<a id="bc-124"></a> | 宝箱规则说明 | 只展示已确定的来源/奖励/限制；原文未定义的概率或付费机制不得由 Agent 补造。 | [IC-072](interaction-chains.md#ic-072) |
| BC-125<a id="bc-125"></a> | 宝箱领取 | 可信任务结算触发资格；重复领取同结果；动画晚于成功回执，不用动画代表已入账。 | [IC-072](interaction-chains.md#ic-072) |
| BC-126<a id="bc-126"></a> | 赛季与奖励 | 时间/资格/结算版本固定；赛季奖励幂等；原型 S3 起止与已定稿字样仅占位不作承诺，待 DEC-12；未确认规则保持关闭，不以空排行榜暗示已开赛。 | [IC-073](interaction-chains.md#ic-073) |
| BC-127<a id="bc-127"></a> | 小游戏目录（原 6 款） | 保留 6 款规划但默认只展示真正可玩的项目；全关闭时不占主导航；预告放次级页且不承诺未确认日期；原型 6 款主列表展示仅设计全量稿，上线门默认隐藏，待 DEC-12。 | [IC-074](interaction-chains.md#ic-074) / [IC-111](interaction-chains.md#ic-111) |
| BC-128<a id="bc-128"></a> | 小游戏可信开局 | 服务端题包/版本/会话校验；不泄漏答案；开局失败可重试，不生成可领奖的假完成态。 | [IC-075](interaction-chains.md#ic-075) |
| BC-129<a id="bc-129"></a> | 小游戏判分防刷 | 服务端校验；核验失败、网络异常与确认违规分开；不把每次冲突都判作弊；保留申诉/真实客服出口。 | [IC-075](interaction-chains.md#ic-075) |
| BC-130<a id="bc-130"></a> | 游戏奖励入账（复用 L11） | 依赖 BC-103/104；同一有效对局只结算一次；游戏会话与成长账本可关联，结果未知显示处理中。 | [IC-075](interaction-chains.md#ic-075) |

## L14 AI 伴学环（P2，BC-131…144，owner：ai-orchestrator）

> P2 范围保留，P1 关闭；R2 stub 不代表真实服务。新增输出展示前/分段安全放行、停止、部分结果和成本闭环建议，待 DEC-11。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-131<a id="bc-131"></a> | AI Gate（阶段+年龄+同意+成本预算） | 沿用全门检查；按实际失败原因解释，不一律引导付费；原型十方案与本机回复仅设计稿，上线门 CLOSED，真链待 DEC-11；配额/预算并发预占与释放待 DEC-11。 | [IC-077](interaction-chains.md#ic-077) |
| BC-132<a id="bc-132"></a> | AI 输入/授权 | 说明哪些内容将发往模型服务；必要输入才提交；保存范围/保留期待 DEC-11，不默认长期保存完整敏感输入。 | [IC-078](interaction-chains.md#ic-078) |
| BC-133<a id="bc-133"></a> | 输入前置检查 | 拦截原因可理解且不暴露规则漏洞；允许修改输入或转普通练习；不得写假生成结果充当成功。 | [IC-079](interaction-chains.md#ic-079) |
| BC-134<a id="bc-134"></a> | AI 请求（prompt_version 固定） | requestId、模型/模板版本与必要来源可追；新重做建新请求；重复传输沿同键，不重复生成和记账。 | [IC-080](interaction-chains.md#ic-080) |
| BC-135<a id="bc-135"></a> | 受控流式交互与停止 | 新增设计：检查通过的缓冲片段才展示，或整段通过后展示；不得先全量可见再声称已拦截；策略待 DEC-11。 | [IC-080](interaction-chains.md#ic-080) |
| BC-136<a id="bc-136"></a> | 输出合规核验（保留原双审要求，机制待确认） | 参与展示前/分段放行；双审细节待 DEC-11，不擅自等同 L8 双签；后置审计不能作为唯一拦截；失败不把违规内容继续显示给用户。 | [IC-080](interaction-chains.md#ic-080) / [IC-081](interaction-chains.md#ic-081) |
| BC-137<a id="bc-137"></a> | Schema 校验（Pydantic/Zod） | 非法结构不能写成可信评分/学习记录；允许解释失败并转规则化练习；部分文本不等于完整结构化结果。 | [IC-081](interaction-chains.md#ic-081) |
| BC-138<a id="bc-138"></a> | 结果保存（schema+来源+说明） | 区分完整、用户停止、失败/被拦截；只有校验通过的结果进入可信下游；保留策略与可见范围按 DEC-11。 | [IC-081](interaction-chains.md#ic-081) / [IC-084](interaction-chains.md#ic-084) |
| BC-139<a id="bc-139"></a> | 采纳/重做/转普通练习 | 采纳不自动修改权威掌握度；重做解释消耗并建新请求；保留已完成旧结果；主次动作不并列争抢注意力。 | [IC-082](interaction-chains.md#ic-082) |
| BC-140<a id="bc-140"></a> | 超时与降级 | 可读普通练习确实存在时才跳转；用户停止/超时/服务失败分开；上游无法即时取消也不继续向用户追加内容。 | [IC-080](interaction-chains.md#ic-080) / [IC-082](interaction-chains.md#ic-082) / [IC-083](interaction-chains.md#ic-083) |
| BC-141<a id="bc-141"></a> | 成本台账（cost_ledger） | 预估、预占、真实消耗、释放/调整分开；取消不等于零成本；一次调用不因重放多记账，实际策略待 DEC-11。 | [IC-082](interaction-chains.md#ic-082) / [IC-083](interaction-chains.md#ic-083) |
| BC-142<a id="bc-142"></a> | 审计与用户历史分离 | 内部输入→输出关联需授权脱敏；用户仅看自己的可见结果，不展示系统提示词、密钥或内部审计原文。 | [IC-084](interaction-chains.md#ic-084) |
| BC-143<a id="bc-143"></a> | P1 无 AI CTA | 沿用原关闭策略；主导航、推荐卡和深链同样受门控，原型可点入口仅设计稿，P1 按关闭处理，待 DEC-11；不能只隐藏按钮而 API 仍可调用。 | [IC-076](interaction-chains.md#ic-076) |
| BC-144<a id="bc-144"></a> | R2 stub 链 | 测试证据显式标 STUB；不得混入真实学习记录、成本账或用户历史；stub 通过不等于真实模型链通过。 | 技术/数据/治理准入验收，无独立用户幕 |

## L15 实时语音环（P2，BC-145…152，owner：realtime-voice）

> 保留默认商业 RTC、自建 LiveKit 需 ADR。延迟阈值、音频保留和实际供应商条件原文未提供，不在此编数。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-145<a id="bc-145"></a> | RTC Gate（商业 RTC，三方签约） | 阶段、授权、设备、网络与服务资格通过才开；麦克风未授权时可返回普通练习，不自动尝试录音。 | [IC-085](interaction-chains.md#ic-085) |
| BC-146<a id="bc-146"></a> | 低延迟双向对讲 | 延迟指标原文未给数值，需 DEC-11 定义测量与目标；连接中、已连接、重连中状态真实，不伪造通话成功。 | [IC-086](interaction-chains.md#ic-086) |
| BC-147<a id="bc-147"></a> | Barge-in 打断 | 用户停止后不继续播放旧输出；旧分片标识作废；重连不重放过期音频。 | [IC-086](interaction-chains.md#ic-086) |
| BC-148<a id="bc-148"></a> | 发音结构化评分（不直连模型） | 沿用经后端服务核验的评分链；有足够有效音频与合法结构才出分；噪声/失败不得伪造低分；原型演示分仅静态占位不计可信评分，待 DEC-11。 | [IC-087](interaction-chains.md#ic-087) |
| BC-149<a id="bc-149"></a> | 录音分级存储（原始音频隔离） | 录音用途、保留与访问规则先确认；撤回后的采集停止；长期原始采集待 DEC-09/DEC-11，确认前不采集；删除与保留按 BC-190/191 对账。 | [IC-088](interaction-chains.md#ic-088) |
| BC-150<a id="bc-150"></a> | RTC 失败不伪造结果 | 明确设备/网络/服务失败；保留已确认任务进度；只有跟读链真实可用才提供跟读替代，否则回文字练习。 | [IC-089](interaction-chains.md#ic-089) |
| BC-151<a id="bc-151"></a> | 跟读/复述任务闭环 | 任务开始、有效录音、评分、完成与恢复均可查；重试不重复记完成；不把一次通话连接当任务完成。 | [IC-087](interaction-chains.md#ic-087) / [IC-089](interaction-chains.md#ic-089) |
| BC-152<a id="bc-152"></a> | 自建 LiveKit 需 ADR | 保留默认商业 RTC；无批准 ADR 不擅自替换架构；没有商业服务准入时保持关闭。 | 技术/数据/治理准入验收，无独立用户幕 |

## L16 K12 合规环（P3，BC-153…166，owner：pending-compliance-owner，待定）

> P3 继续上锁。owner、资质、版权、服务细节未确认；owner 在 K12 准入前必须明确，否则保持关闭，这份流程文档不是合规审查意见，也不新增开放许可。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-153<a id="bc-153"></a> | K12 Gate（默认关闭） | 保留 P3 上锁、P1/P2 不开放；原型角色与课程链仅设计稿，上线门 CLOSED，真开放待 DEC-01 与手续签收；旧入口说明当前仅服务成人，不鼓励虚报年龄绕门。 | [IC-090](interaction-chains.md#ic-090) |
| BC-154<a id="bc-154"></a> | 未成年人识别 | 与成人门隔离；识别后按批准策略分流；具体判定依据与数据范围尚待合规/产品确认。 | [IC-090](interaction-chains.md#ic-090) |
| BC-155<a id="bc-155"></a> | 监护授权 | 授权人与关系校验按独立契约；仅在 K12 准入后实施；不把成人账号勾选替代监护授权。 | [IC-091](interaction-chains.md#ic-091) |
| BC-156<a id="bc-156"></a> | 教师/机构资质校验 | 保留资质要求但不凭此文档宣称已合规；范围、有效期、核验责任需补齐才能开放。 | 技术/数据/治理准入验收，无独立用户幕 |
| BC-157<a id="bc-157"></a> | 教材同步（版权+地区） | 有权范围和版本先校验；不可用教材不显示可开始；原型全正版字样仅占位，版权待验见 DEC-08；不得以展示书名代替许可核验。 | [IC-092](interaction-chains.md#ic-092) |
| BC-158<a id="bc-158"></a> | 中高考专项内容 | 只在批准教材/考试范围内提供；真实题目与审核完整才开放；本稿不新增题库或资质结论。 | [IC-092](interaction-chains.md#ic-092) |
| BC-159<a id="bc-159"></a> | K12 学习闭环 | 目标→练习→复盘与成人动线/权限隔离；安全门未过不得借成人路径学习。 | [IC-093](interaction-chains.md#ic-093) |
| BC-160<a id="bc-160"></a> | 防沉迷（时长/时段） | 沿用原限制需求；具体规则来自经批准策略，不在此填未经核实的法定数值；各端同一服务端判定。 | [IC-094](interaction-chains.md#ic-094) |
| BC-161<a id="bc-161"></a> | 家长撤回 | 撤销后停止相关能力；显示对课程、录音和数据的影响；处理进度与删除状态分开。 | [IC-095](interaction-chains.md#ic-095) |
| BC-162<a id="bc-162"></a> | 版权失效下线 | 走强制停止分发，旧会话/缓存读取也受限；历史成绩按保留策略处理，不能继续提供失效内容。 | [IC-092](interaction-chains.md#ic-092) |
| BC-163<a id="bc-163"></a> | 未成年人隐私请求 | 最小采集与导出/删除流程绑定授权角色；不开放任意家长查询他人数据；依赖 BC-191 的跨服务处理。 | [IC-095](interaction-chains.md#ic-095) |
| BC-164<a id="bc-164"></a> | 安全事件审计 | 内部可追溯；家长可查的是获准脱敏摘要，不是内部日志/模型原始提示；权限按关系和范围控制。 | [IC-096](interaction-chains.md#ic-096) |
| BC-165<a id="bc-165"></a> | 租户/主体隔离 | 跨租户、跨家庭、跨身份读取均拒绝；服务端与导出任务同样校验，不能只靠前端隐藏。 | [IC-093](interaction-chains.md#ic-093) |
| BC-166<a id="bc-166"></a> | K12 开锁手续清单 | 资质、版权、责任人、合规签收与端到端证据齐全才放行；owner 尚未明确时继续关闭。 | 技术/数据/治理准入验收，无独立用户幕 |

## L17 支付环（R3，BC-167…176，owner：commerce-service）

> 真实支付仍未因本次修订准入。补齐资金→权益→订阅管理→退款/对账，但所有渠道特定字段、地区规则和审批角色见 DEC-10。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-167<a id="bc-167"></a> | SKU/价格快照（版本固定） | 明确产品、周期、币种、价格与权益；结算中不得静默改价，原型演示价绑定同一订单快照，真通道与口径待 DEC-10；地区/渠道规则另核定，见 DEC-10。 | [IC-097](interaction-chains.md#ic-097) |
| BC-168<a id="bc-168"></a> | 下单幂等 | 同键同单；显示总价、周期和自动续费状态；结果未知先查单；不能把客户端成功回跳当付款凭据。 | [IC-048](interaction-chains.md#ic-048) / [IC-098](interaction-chains.md#ic-098) |
| BC-169<a id="bc-169"></a> | 真实支付通道准入 | 保留合同/渠道配置归档要求；平台、地区与主体未确定部分待 DEC-10；真通道不开时用户不可支付。 | 技术/数据/治理准入验收，无独立用户幕 |
| BC-170<a id="bc-170"></a> | 真实支付意图（provider live） | 与沙盒隔离；跳转使用对应渠道安全流程；用户取消不重复下单；应用不自行保存卡号等支付敏感信息。 | [IC-099](interaction-chains.md#ic-099) |
| BC-171<a id="bc-171"></a> | 回调验签→交易确认→权益发放 | 新增补齐权益链：验签/去重/乱序处理后确认交易；权益发放可重试并对账；“已付款待开通”不是支付失败。 | [IC-048](interaction-chains.md#ic-048) / [IC-099](interaction-chains.md#ic-099) / [IC-100](interaction-chains.md#ic-100) |
| BC-172<a id="bc-172"></a> | 自动续费与订阅生命周期 | 开通保留二次确认；续费失败、取消续订、到期、恢复购买均有状态；当前权益与下次扣款分开，具体渠道规则待 DEC-10。 | [IC-048](interaction-chains.md#ic-048) / [IC-098](interaction-chains.md#ic-098) / [IC-100](interaction-chains.md#ic-100) |
| BC-173<a id="bc-173"></a> | 订单/渠道/权益对账（日切） | 三方核对并列出差异；先补发/纠错再关单；不能要求用户再次付款解决已付未开通；资金状态与权益各可查。 | [IC-048](interaction-chains.md#ic-048) / [IC-100](interaction-chains.md#ic-100) |
| BC-174<a id="bc-174"></a> | 退款双人审批（保留原约束） | 退款申请/渠道处理/结果与权益处置分离；两名审批者要求未满足时不擅自简化，单人运营方案待 DEC-10；异步退款不假装已到账。 | [IC-048](interaction-chains.md#ic-048) / [IC-101](interaction-chains.md#ic-101) |
| BC-175<a id="bc-175"></a> | 开票 | 开票资格、主体、渠道与金额口径待 DEC-10；原型两请求独立保存且未签发真实票据已符合；显示申请/处理中/完成/失败；不把商店收据直接命名为已开具本地发票。 | [IC-048](interaction-chains.md#ic-048) / [IC-101](interaction-chains.md#ic-101) |
| BC-176<a id="bc-176"></a> | 沙盒并行对照 | 覆盖付款成功/失败/取消/重复回调/续费失败/退款/已付待权益/恢复购买；沙盒证据不冒充真实扣款或真实生产验收。 | 技术/数据/治理准入验收，无独立用户幕 |

## L18 多端原生环（R3，BC-177…184，owner：apps/mobile）

> 保留 uni-app / iOS / Android / Tauri / PWA 的原范围和限制。共享业务身份与安全凭据隔离同时成立，不直接跨端复制登录 token。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-177<a id="bc-177"></a> | uni-app 小程序目标条件编译 | 构建通过与业务可用分开验；目标差异显式配置，不能仅凭可运行首页宣称全链一致。 | [IC-102](interaction-chains.md#ic-102) |
| BC-178<a id="bc-178"></a> | 微信小程序登录态 | 按批准登录映射关联学习者；不自动合并不同主体；新旧账号确认、切号清理与服务端权限仍一致。 | [IC-102](interaction-chains.md#ic-102) |
| BC-179<a id="bc-179"></a> | iOS 壳（iPhone/iPad） | 产出 TestFlight 内测包；验登录、学习恢复及适用支付链；不把内测包等同商店审核通过。 | [IC-102](interaction-chains.md#ic-102) |
| BC-180<a id="bc-180"></a> | Android 壳 | 产出内测包并验主学习链；设备差异/权限失败有恢复；上架要求另核定，本稿不宣称满足各商店审核。 | [IC-102](interaction-chains.md#ic-102) |
| BC-181<a id="bc-181"></a> | 原生安全存储（Keychain/Keystore） | 保留不允许普通 storage fallback；各端独立安全凭据，同一业务身份不等于跨端复制 token。 | [IC-102](interaction-chains.md#ic-102) |
| BC-182<a id="bc-182"></a> | 推送通道（APNs/FCM） | R2 本地通知 stub 只算测试替身；真实推送需许可/设备令牌/退订测试；到达率指标待实测与验收定义。 | [IC-102](interaction-chains.md#ic-102) |
| BC-183<a id="bc-183"></a> | Tauri 桌面壳（如需，禁 Electron） | 保留原技术约束；若开启需包签名与主链验证；不因 IDE 偏好擅自改壳框架。 | [IC-102](interaction-chains.md#ic-102) |
| BC-184<a id="bc-184"></a> | PWA 工作区（learner-web） | 可安装和缓存边界清晰；PWA 不自动等于完整离线；切号/内容下架/失效资源处理依赖 C2/C6。 | [IC-102](interaction-chains.md#ic-102) |

## L19 隐私客服环（R1 读+R2 写，BC-185…192，owner：admin-ops-service.support / learner-service.privacy / iam-service）

> 工单、导出和账号删除分别遵循 ADR-0014 与 C7 的既有 owner/契约；workflow 只编排。旧 hash-only 记录不能替代当前安全内容引用。新增采集/保留政策及真实 worker 验收继续待签收；请求受理、冷静期、撤回、执行和最终完成分别读回。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-185<a id="bc-185"></a> | 工单提交（canonical 安全内容引用） | admin-ops-service.support 唯一建单；沿用七类分类及 C7 安全内容引用，只有 CLEAN 的服务端脱敏 safePreviewRef 可读，原文/裸 URL 不进 ticket/event/log。本人身份/权限与 expectedVersion 等按正式契约；本机文字仅为转义演示且明确未发送。旧 hash-only 只留痕，不能称客服已获问题；新增采集目的/范围/保留变更才待 DEC-06。 | [IC-037](interaction-chains.md#ic-037) / [IC-047](interaction-chains.md#ic-047) / [IC-103](interaction-chains.md#ic-103) |
| BC-186<a id="bc-186"></a> | 工单列表/详情/筛选 | 本人只见自己的工单；客服仅在授权及 CLEAN 安全预览范围读取，双方读同一 ticket/state/message/assignment 版本。旧 hash-only 标信息不足，禁止假回复/关闭，只能获准升级/安全补正。升级必须选授权目标并填写原因，保存 assignment 版本、接收方与受理结果；未接收明确“待接收”，刷新/列表可读回，不把发出请求当完成交接。 | [IC-037](interaction-chains.md#ic-037) / [IC-047](interaction-chains.md#ic-047) / [IC-104](interaction-chains.md#ic-104) |
| BC-187<a id="bc-187"></a> | 客服接单/回复/升级/关闭 | 沿用 OPEN/ASSIGNED/WAITING_USER/WAITING_INTERNAL/RESOLVED/CLOSED/REOPENED；变更校验 expectedVersion，接单/转交记录 assignment/SLA 历史。升级缺目标/原因不能提交，未获接收回执保持待接收；回复草稿、已提交消息、触达结果分开。需领域恢复时调用该 owner 命令并关联 command/task/audit 与 reconciliation receipt，不能直接改订单/学习事实；确认处理结果后才解决/关闭，追加与重开按获准策略。 | [IC-037](interaction-chains.md#ic-037) / [IC-047](interaction-chains.md#ic-047) / [IC-104](interaction-chains.md#ic-104) |
| BC-188<a id="bc-188"></a> | 本人数据导出 | learner-service.privacy 唯一拥有 request/status/expiry/短时下载 grant/receipt；二次认证后创建请求，按 C7 冻结状态查询。READY 才可申请本人一次性、短时、no-store 下载 grant；部分失败进入恢复，不伪装文件已生成。本机请求标未生成真实文件；跨服务真实 worker/对账仍有运行 GAP，见 BC-191/DEC-09。 | [IC-008](interaction-chains.md#ic-008) / [IC-036](interaction-chains.md#ic-036) / [IC-105](interaction-chains.md#ic-105) |
| BC-189<a id="bc-189"></a> | 账号删除（幂等+二次认证+168 小时冷静期+回执） | IAM 唯一拥有删除请求/冷静期/撤回/执行/最终状态。二次认证和影响确认后进入 PENDING_COOLING_OFF，服务端派生 168 小时及 executeAt；期间二次认证可撤回至 CANCELLED，进入 EXECUTING 后不可撤回。执行或部分失败读真实状态，所有 owner receipt 及会话/设备撤销对账完成才 ANONYMIZED；撤销 token 不等于删完。见 C7/BC-191。 | [IC-008](interaction-chains.md#ic-008) / [IC-036](interaction-chains.md#ic-036) / [IC-106](interaction-chains.md#ic-106) / [IC-108](interaction-chains.md#ic-108) |
| BC-190<a id="bc-190"></a> | 音频保留策略 | 明确采集目的、保存范围、保留期及删除执行；数值原文未定义，待 DEC-09/11；策略未批准不采集长期原始录音。 | [IC-008](interaction-chains.md#ic-008) / [IC-036](interaction-chains.md#ic-036) / [IC-088](interaction-chains.md#ic-088) / [IC-107](interaction-chains.md#ic-107) |
| BC-191<a id="bc-191"></a> | 跨服务导出/删除或匿名化 worker | workflow 仅编排 owner-local command、重试、DLQ、对账与人工恢复，不拥有工单/导出/身份事实或跨库写权限；各领域 owner 按 policy/legal hold 处理自己的数据并返回版本化 receipt。未知 legal hold fail closed；依法保留只留最小化/匿名化项，使用 RETAINED_LEGAL_HOLD receipt。成功 owner 不重复执行，部分失败 RECOVERY_REQUIRED，不返回全部完成；真实 worker 和证据 GAP 仍待 DEC-09。 | [IC-036](interaction-chains.md#ic-036) / [IC-105](interaction-chains.md#ic-105) / [IC-106](interaction-chains.md#ic-106) / [IC-107](interaction-chains.md#ic-107) / [IC-108](interaction-chains.md#ic-108) |
| BC-192<a id="bc-192"></a> | 退出登录与账号删除后的会话失效 | 普通退出可重登；删除状态页分别给冷静期查询/撤回、执行/恢复进度及完成说明，不循环要求登录继续学习。CANCELLED 后重新读取 IAM 最新主体资格与会话结果，给获准账号/学习出口，不让客户端恢复已撤销 token。ANONYMIZED 前按契约核验全部会话/refresh family/设备/access JTI 撤销；私有缓存按已批准范围清理，不以缓存清理代替 owner 删除。 | [IC-008](interaction-chains.md#ic-008) / [IC-036](interaction-chains.md#ic-036) / [IC-053](interaction-chains.md#ic-053) / [IC-106](interaction-chains.md#ic-106) / [IC-108](interaction-chains.md#ic-108) |

## L20 观测审计环（R1，BC-193…198，owner：audit/workflow-service）

> 沿用 T19/T20/T21 引用，但这些外部材料未随本包验读。观测编号能定位，不能泄漏认证秘密；生产发布仍需独立证据。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-193<a id="bc-193"></a> | 网关 401 审计包络 | 沿用 T19 的 fact+receipt 对账要求；T19 外部材料未随本包核验；日志不记录 token/密码等秘密。 | 技术/数据/治理准入验收，无独立用户幕 |
| BC-194<a id="bc-194"></a> | requestId/traceId/auditId 关联 | 三 ID 可关联源请求与结果，不要求值相同；用户仅见可安全提供的支持编号；权限脱敏后可定位。 | 技术/数据/治理准入验收，无独立用户幕 |
| BC-195<a id="bc-195"></a> | Saga+补偿 | 沿用 T20/未知补偿名拒绝；记录每步成功/失败/补偿与重试；不能把最终补偿成功误报为原业务成功。 | 技术/数据/治理准入验收，无独立用户幕 |
| BC-196<a id="bc-196"></a> | Outbox→Kafka 白名单+DLQ | 沿用 T21；消费幂等、失败可观察、重放有审批边界；按来源事实重建投影，不按行数强制补齐假数据。 | 技术/数据/治理准入验收，无独立用户幕 |
| BC-197<a id="bc-197"></a> | 健康探针/优雅停机/SBOM（发布门） | 保留发布准入要求；构建证据、迁移兼容和停机恢复可核验；无证据不得标已可生产发布；原型 ops 屏 checklist 与演练按钮仅为演示，不计为生产证据。 | 技术/数据/治理准入验收，无独立用户幕 |
| BC-198<a id="bc-198"></a> | 可回滚发布（命名回滚+恢复点） | 应用与数据兼容策略一起验；不得承诺任何数据库变更都可直接回滚；演练记录实际恢复结果与限制；原型命名恢复点仅为演示，不替代真实演练记录。 | 技术/数据/治理准入验收，无独立用户幕 |

## 补链附录（BC-199…208，原归属保留）

> 保留原归属；修正附录标题范围到 BC-199…208。BC-203 改为来源与规则对账，BC-204 映射到管理登录实际幕。

| ID | 步骤与范围 | 验收与恢复（含本次修订设计） | 对应交互 |
|---|---|---|---|
| BC-199<a id="bc-199"></a> | 书架、搜索与续学（归 L3） | 只列可访问内容；空目录/无搜索结果/加载失败分开；续学到有效检查点，强制下线后不绕过权限；原型原创样例与缺数据明示已符合，承接待 DEC-08；供无障碍抽验。 | [IC-020](interaction-chains.md#ic-020) / [IC-029](interaction-chains.md#ic-029) / [IC-039](interaction-chains.md#ic-039) / [IC-109](interaction-chains.md#ic-109) / [IC-110](interaction-chains.md#ic-110) / [IC-111](interaction-chains.md#ic-111) |
| BC-200<a id="bc-200"></a> | 内容升级时在学版本锁定（归 L8） | 普通升级可按 pin 完成旧版；强制下线不得继续；保留历史不等于允许继续分发，见 C6。 | [IC-023](interaction-chains.md#ic-023) / [IC-029](interaction-chains.md#ic-029) / [IC-042](interaction-chains.md#ic-042) |
| BC-201<a id="bc-201"></a> | 门被拒后的清理与重进（归 L1） | 停止受限能力并清理未授权私有状态；保留必要审计/账号服务；允许查看说明、联系支持、退出，不鼓励改资料绕门。 | [IC-005](interaction-chains.md#ic-005) / [IC-055](interaction-chains.md#ic-055) |
| BC-202<a id="bc-202"></a> | 画像草稿续填（归 L1） | 说明草稿保存位置与范围；已确认字段可读回；本地持久草稿按 DEC-05，切号不得串读。 | [IC-004](interaction-chains.md#ic-004) / [IC-057](interaction-chains.md#ic-057) |
| BC-203<a id="bc-203"></a> | 作答/错题/SRS 联合对账（L4/L5/L6） | 按源 attempt 和规则检查完整性、唯一性、最终一致性，聚合与入队规则以 BC-046/BC-055 为准；不要求三表行数相同；异步超时可告警补偿，见 C3。 | [IC-022](interaction-chains.md#ic-022) / [IC-030](interaction-chains.md#ic-030) / [IC-032](interaction-chains.md#ic-032) |
| BC-204<a id="bc-204"></a> | 管理登录/回跳/会话恢复（归 L8 前置） | 明确对应管理登录幕；回跳验证权限与安全目标；可续期静默续期，失效则重登后恢复允许页面；原型任意密码与固定回工作台仅为演示简化，不替代正式鉴权。 | [IC-043](interaction-chains.md#ic-043) |
| BC-205<a id="bc-205"></a> | 管理仪表盘（归 L8） | 在架数=查询时点当前发布指针引用且可供给的独立内容数（非草稿/历史版本数）；待审数=查询时点 IN_REVIEW 的内容版本数（L1/L2 进度不重复计）；待建档风险数=授权范围内尚未建档的有来源案件数。均为时点存量，明确 queryAsOf/范围，不能标题叫“今日新增”；新增/处理量若增加必须另定义学习时区及日区间。内容事实归 content，案件归 admin-ops，聚合只读；范围、来源水位、更新时间和局部失败分列。原型按这些定义计算，硬编码样例不作业务规则。 | [IC-044](interaction-chains.md#ic-044) |
| BC-206<a id="bc-206"></a> | 权限只读页（iam.policy.read，归 L8） | 来源为 ARCH-IAM-002 与 PAGE-P1-ADMIN-PERMISSIONS 的管理 RBAC/ABAC，不能以学习端通知/麦克风/存储设备授权代替。仅查看获准身份/角色/资源范围，空/错/无权分开；无匹配不展示其他角色范围；只读页不露写入入口；无权操作不是登录失效，服务端默认拒绝。 | [IC-046](interaction-chains.md#ic-046) |
| BC-207<a id="bc-207"></a> | 媒体边界与上传正链（归 L8，R2） | 未接对象字节时清楚说明；开启后上传/校验/绑定/失败重试可查；内容发布所需媒体依赖见 DEC-08，不伪造资产。 | [IC-041](interaction-chains.md#ic-041) / [IC-045](interaction-chains.md#ic-045) |
| BC-208<a id="bc-208"></a> | 审计列表（归 L9，R1 读） | 分页、过滤与脱敏；导出 internal-only 权限单独检查，范围与保留待 DEC-09；内部审计不直接分享给学习者；原型导出仅作说明不落文件。 | [IC-049](interaction-chains.md#ic-049) |


---

<a id="c1"></a>

## C1. 身份、授权与版本冲突（新增执行契约）

| 场景 | 业务处理 | 用户表现 |
|---|---|---|
| 会话过期但可刷新 | 有限次数、统一协调刷新；重放原合法请求 | 尽量无打断，不能每个并发请求各自弹登录 |
| 刷新失效/设备被踢/会话撤销 | 停止自动重试，清除对应私有状态 | 说明需要重新登录；验证后恢复安全且有权的原位置 |
| 已登录但撤回授权/缺业务权限 | 保留仍有效会话，阻断受限能力 | 说明具体能力限制；不是无限“请重新登录” |
| 账号删除中或已删除 | 不恢复普通学习会话，按删除流程处理 | 给实际处理状态/完成说明，不提示“登录继续学习” |
| 版本冲突 | 拉取最新版本，保留尚未提交的非敏感输入供比较 | 说明已有更新；用户确认后再发新操作，不覆盖他人修改 |
| 结果未知（断网/回执丢失） | 先按 request/operation/session 查询；未接收才同键重试 | “正在确认提交结果”，不立即显示失败或让用户再付一次 |

请求按学习者/管理者与所属主体隔离；管理页回跳需校验目标和权限。登录状态不可被用户可写的本地标志替代。原 Web token 内存约束和原生安全存储约束保留；refresh 的具体存储机制本包未定义，必须沿用安全基线核对。

<a id="c2"></a>

## C2. 断点恢复、本机暂存与完整离线（新增执行契约）

| 能力 | 恢复依据 | 本版边界 |
|---|---|---|
| 服务端断点 | 已接收的 checkpoint、session、版本 | 基础路径；恢复后继续同一有效会话 |
| 当前页面未提交选择 | 本页内存中的选择/输入 | 可在页面停留时保留；未持久化不得承诺刷新后还在 |
| 本机持久草稿 | 经批准的本地数据范围与保存策略 | DEC-05；未核验实现前不显示“已存本机” |
| 完整离线学习 | 获准内容包、题目、离线授权与冲突/同步契约 | 原 BC-102/R3 范围；不能由 PWA 安装或读到包列表推定已可用 |

恢复键至少能区分账号、学习会话与内容/题目版本；实际字段名需对齐现有接口。切号、登出、设备撤销后的缓存清理针对该账号，异步旧回包不得落入新账号页面。不得把标准答案、登录 token 或未获准敏感资料作为练题本地草稿。

恢复顺序：获取当前服务端会话 → 校验资格与内容可用性 → 比较版本/已收回执 → 恢复已确认位置 → 对未提交选择提示重选或按获准规则恢复。另一设备已经完成时，不重放旧草稿覆盖结果。

<a id="c3"></a>

## C3. 作答—错题—SRS—成长的一致性（新增，替换“三表行数一致”）

1. **源事实**：每次被接收的有效作答有不可变 attempt 与回执，重复传输不产生第二次同操作作答。
2. **错题**：只有满足入本条件的错误来源进入错题；同题/同知识点是否聚合由明确规则决定，可追到源 attempt；聚合规则与 BC-046 的去重键一致，任一处变更另一处同步更新；规则口径见 BC-046，对账执行见 BC-203。
3. **SRS**：只有满足入队/推进规则的来源更新一次；正确作答不等于必须另建一条新复习记录；入队条件与 BC-055 的来源规则一致，任一处变更另一处同步更新；规则口径见 BC-055，对账执行见 BC-203。
4. **成长**：仅可信完成事件结算；是否开放成长不改变源作答已经成功的事实。
5. **最终一致**：提交源事实及 outbox 后允许下游短暂更新中；时限、告警阈值和补偿负责人须配置并验收，不在此编造秒数。

**例子只解释口径**：5 次有效作答、其中 2 次错误，应能找到 5 个作答事实；错题数量取决于 2 个错误来源的聚合规则，SRS 数量取决于入队/更新规则。不能为了让三处都等于 5 而创建无意义记录，也不能因为不等于 5 就判业务失败。

联合对账验收：来源覆盖、唯一性、合法版本、没有越权记录、没有重复推进、延迟可观察、补偿后符合规则。失败的用户反馈必须区分“答题未保存”和“答题已保存，复习记录更新中”。

<a id="c4"></a>

## C4. 今日任务归并、预算与统计（沿用冻结 policy；新增补偿差异见 DEC-07）

权威规则来自[学习机制与学习引擎规则](../phase1-business-operation/04-学习机制与学习引擎规则.md) §4.7/§6/§7.3/§9.4 与 [D2 policy](../../../../config/p1r-learning-loop-contract.v1.json)。D2 已冻结规则，真实 owner/Outbox/Kafka/worker/跨端运行仍需验收；本包不重新候选算法或参数。

所有 5/15/30/45 分钟档使用同一合法候选池和稳定排序：`RECOVERY_REQUIRED → DELAY_VERIFICATION_DUE → SRS_OVERDUE_OR_DUE → MISTAKE_REPAIR → GOAL_CRITICAL → NEW_CORE → OPTIONAL`，依次比较 dueSortAt 升序、riskScore 降序、goalAffinity 降序、lastEvidenceAt 升序、stableCandidateId 二进制升序。普通候选按 logicalItemId、恢复按 sessionId 去重，保留 winner、被压制来源和原因；错题投影沿用 sourceAssessmentEventId+itemId+projectionVersion。一次动作只完成其获准 completion rule，不凭“同知识点”自动结清不同验证来源。

| 每日名义分钟 | review/repair | goal/new | rotation | total cap |
|---:|---:|---:|---:|---:|
| 5 | 2 | 2 | 1 | 6 |
| 15 | 6 | 6 | 3 | 17 |
| 30 | 12 | 12 | 6 | 33 |
| 45 | 18 | 18 | 9 | 50 |

`totalCap=ceil(quota×1.10)`，按服务端版本化 estimatedMinutes 整体装入，不能拆任务凑分钟；恢复先在 total cap 内保留，到期验证/SRS/repair 使用 review lane，无复习债务才将剩余 review 额度依次回流目标新学、技能轮换。`debtMinutes > 2×normalReviewRepairMinutes` 才触发 CATCH_UP（等号不触发）：reviewCap=ceil(quota×0.70)、goalCap=ceil(quota×0.20)、rotationCap=max(0,totalCap-reviewCap-goalCap)，catchUpDays=clamp(ceil(debtMinutes/max(1,reviewCap)),2,7)。7 天后仍有积压显式返回 backlogRemainingAfterWindow；无能完整装入的合法轻量目标项返回 GOAL_LIGHT_ITEM_UNAVAILABLE，不伪称清完。游戏/社交不占核心预算。

| 已冻结事项 | 本包沿用边界 |
|---|---|
| SM2_Q03_V1 | q 受服务端客观结果约束；EF 初始 2.50，decimal ROUND_HALF_UP，EF'=clamp(round2(EF+0.10-(3-q)×(0.08+(3-q)×0.02)),1.30,2.50)；q<2 重置 repetitions=0/interval=1/lapse+1，q≥2 的前六次间隔为 1/3/7/15/30/90 日，之后 clamp(round(旧 interval×EF'),1,365)，完整事实字段沿用上游 §6 |
| 学习时区与到期 | reviewedAt 是服务端接受的 UTC Instant，按 pin 的 IANA 时区加日历日；DST gap 前移首个合法时间，overlap 取较早 offset；切时区不改既有 dueAt |
| D1/D7 | D1 为当场修复当地日期之后第一个配置学习日；D7 nominal 为 D1 PASS 当地日期+7 日，scheduled 为当日或之后第一个配置学习日；保留 nominal/scheduled/dueAt/时区/学习日快照；未到期拒绝提交 |
| 有效时长与报告 | 分钟仅来自 owner accepted、版本化服务端 activity policy 的 creditedSeconds/60；客户端计时和任务预估无权结算。报告按水位生成不可变快照，迟到事实新建 reportVersion |
| 变更与取消 | 改目标/时长/学习日新建 plan/overlay 并保留历史；拖拽限同优先级非强制项，延期仅限 repair/goal/new/optional，记录理由/展示日期/overlayVersion，不改 SRS 或验证的 canonical dueAt |

静态原型可以用固定样例候选和预估时长演示，但所有时长档都要呈现恢复与到期优先、未装入原因和剩余安排；不得把硬编码模板、客户端日期、评分撤销视为上述完整引擎已实现。DEC-07 只跟踪本包新增跨批撤销权限、补偿命令/窗口、跨投影影响及与既有 policy 的兼容签收，不让已冻结键、参数、预算重新待定。

默认体验不使用“欠账”评价用户。今日无任务带明确业务原因，无法装入或缺合法内容给实际说明；“预计用时”与 accepted 实际时长分开，不编造精确数字或完成事实。

<a id="c5"></a>

## C5. 定级、快速开始与计划输入（新增设计，DEC-03/04）

```text
完成正式定级
  → 不可变 reportId + digest
  → 校验所有者/版本/可用性
  → 建正式来源计划

用户跳过定级
  → SKIPPED 基线（目标、时长及获准的初始难度依据）
  → 标明非权威评估来源
  → 建初始计划，后续根据可信练习调整
```

两条路径都保存输入快照，不允许以空 reportId 假装 ASSESSED 校验通过，也不能给合法 SKIPPED 人造 reportId。输入分支、pin、所有者与资格引用沿用上游学习规则 §3.1 和已签收 canonical 契约；SKIPPED 固定 UNVERIFIED、coverage=0、aggregateScore/referenceLevel=null。DEC-03 只记录本包兼容/实现/运行签核，不另造第二套输入字段或重新否定快速开始路径。

定级反馈建议以“已保存+进度”为即时反馈，完整解释放完成报告，避免与教学练习混为一谈；原逐题给对错的方案是否保留由 DEC-04 决定。普通练习仍保留行内即时判分。没有批准的时长数据时，入口只写“10 道题”，不保证 3 分钟。

<a id="c6"></a>

## C6. 内容版本、下架与已有会话（新增执行契约）

| 内容事件 | 新目录/新会话 | 已有会话与历史 |
|---|---|---|
| 普通升级 | 按新有效版本开放 | 已 pin 会话可按批准策略读完旧版；历史保留 |
| 普通下架（仅停止新分发） | 不再提供新入口 | 是否允许在学者完成须由下架策略明确，不能只靠“目录消失”决定 |
| 必须停止分发 | 目录、接口、媒体后续授权都停止 | 旧会话也不能继续拉取；保留成绩不等于继续提供内容 |
| 回滚 | 先验证目标版本仍具发布资格 | 不能复活已强制停止的版本；记录影响和恢复点 |

媒体需同步考虑已发下载地址的有效性与后续访问控制。**已经被用户下载的离线字节不能仅靠后台改状态就保证立即收回**；完整离线开放前应确定授权有效期、联网复验、删除范围与告知方式（DEC-05/08），不得承诺技术上未证实的即时召回。

正式审核与发布沿用上游作者/L1/L2/发布者职责分离；本包历史单人简审提案仅演示，正式例外待 DEC-01/08 签收。版本/hash、签核、权利、必要媒体和阶段资格共同决定发布；任何版本变化使旧签核失效。已发布快照与草稿独立，发布指针、同步任务和强制禁供事实均可读回；普通回滚只能选合法的历史已发布版本，不能清除强制禁供标记。

<a id="c7"></a>

## C7. 客服、导出与删除（沿用 ADR-0014/D2；新增政策与运行 GAP 见 DEC-06/09）

### 客服

以[ADR-0014](../../../10-decisions/0014-phase1-support-privacy-ownership.md) 和[后台流程](../phase1-business-operation/05-后台内容运营与客服业务流程.md) §6 为准：`admin-ops-service.support` 唯一拥有 ticket/message/assignment/SLA/resolution/retention；学员和后台不同路由读写同一事实，状态严格为 OPEN/ASSIGNED/WAITING_USER/WAITING_INTERNAL/RESOLVED/CLOSED/REOPENED，变更校验 expectedVersion，保留 assignment/SLA 历史与审计。

分类沿用 ACCOUNT_SECURITY/CONTENT_CORRECTION/LEARNING_SYNC/MEDIA_DEVICE/ENTITLEMENT_ORDER/PRIVACY/OTHER 七类。描述/截图/附件用 `contentRefId+sha256+redactionVersion+scanStatus+objectVersion+safePreviewRef`；仅 CLEAN 的服务端脱敏安全预览及 media owner 授权附件可读，扫描或 legal hold 未知 fail closed。原文、裸 URL 不进 ticket/event/log；SLA 和 retention 保存版本化 policy 与 receipt，TTL 不替代保留政策。此安全引用契约已冻结，不是 DEC-06 的新提案；扩大采集目的/范围、变更保留策略或开放未验证通道才需另签收。

hash-only 只描述历史缺信息记录，不代表当前唯一合法工单设计；这类旧单禁止假回复/关闭，只能获准补正或升级。升级必须选择授权接收方、填写原因并读回 assignment/审计及实际受理结果；尚未接收显示“待接收”，不能把请求发出当交接完成。正常 CLEAN 工单可按角色安全读取/回复；领域修复调用该 owner 的受控命令并收 reconciliation receipt，客服不能改订单、身份或学习表，关闭不能替代修复。静态正文只本机转义演示并标未发送；真实支持通道、客服触达、workers 尚需运行证据，不能虚构联系方式、回复或解决时限。

### 导出与删除

沿用[隐私生命周期 D2 契约](../phase1-business-operation/m1-017-privacy-lifecycle-contract.md)，不是另造状态。`learner-service.privacy` 唯一拥有 export request/status/expiry/短时下载 grant/receipt；`iam-service` 唯一拥有 deletion request、168 小时冷静期、撤回、执行、会话/设备撤销与主体最终状态。`workflow-service` 只协调 owner-local command、重试、DLQ、对账和人工恢复，不跨 schema 写业务事实。

- 导出：`REQUESTED → COLLECTING → ASSEMBLING → READY → DOWNLOAD_ISSUED → EXPIRED`；失败为 `FAILED → RECOVERY_REQUIRED`，恢复仅回 `COLLECTING` 或 `EXPIRED`。本人二次认证创建请求；READY 才申请一次性短时 no-store grant，不把 grant 写入普通事件/日志/审计正文；receipt 只展示最小化 owner/digest/legal-hold 决定/完成时间，不含原文。
- 删除：二次认证/影响确认 → `PENDING_COOLING_OFF`；168 小时后才可由受信 workload 执行 → `EXECUTING → ANONYMIZED`。只在冷静期允许二次认证撤回 → `CANCELLED`；开始执行后不提供撤回。失败为 `EXECUTING → RECOVERY_REQUIRED → EXECUTING`，不越过冷静期、不把部分成功当完成。
- 用户使用既有 status/receipt 查询和冷静期 cancel 入口；subject/tenant/owner/state/executeAt/legal hold/会话撤销/receipt authority 都由服务端派生，客户端不能提交或猜测。取消后读 IAM 最新资格/会话决定提供获准出口，不恢复已撤销令牌。

每个领域 owner 对自己数据先判 legal hold，再删除/匿名化或最小化依法保留并提交版本化 receipt；未知 legal hold 拒绝执行，保留项用 RETAINED_LEGAL_HOLD receipt 明示。ANONYMIZED 前须对账全部预期 owner，并核验所有会话、refresh family、设备和 access JTI 撤销；已成功 owner 不因重试重复执行。缓存清理/TTL/禁用登录都不能代替删除。DEC-09 继续跟踪新增处理范围、保留政策数值/例外，以及真实 owner schema、worker、事件/Saga、回执对账和运行证据；不重新待定已冻结 owner、冷静期、撤回及状态接口。

删除前说明有效订阅与支付渠道管理入口；不假定删除账号会自动取消第三方续费。普通退出登录与账号删除使用不同标题和后续路径。

<a id="c8"></a>

## C8. 支付—权益—订阅—退款（新增设计，DEC-10）

保留 L17 的 10 个主编号，扩展已有步骤下的分支，不插入新 BC 号。以下为逻辑状态，不代表当前接口已实现。

| 层次 | 必须区分的状态/动作 | 对应步骤 |
|---|---|---|
| 订单/资金 | 待支付、取消/失败、确认中、已支付、退款处理中、已退款 | BC-168/170/171/173/174 |
| 学习权益 | 未开通、待发放、有效、暂停/到期、按政策撤销 | BC-171/172/173 |
| 订阅 | 正常续订、取消下次续订、续费失败、到期、渠道允许的恢复 | BC-172 |
| 恢复购买 | 校验渠道凭据/账户归属→读取有效购买→幂等补齐权益 | BC-172/173 |
| 用户支持 | 已付款未开通可查状态/联系真实支持，不重新付款 | BC-171/173/185…187 |

每次外部通知验证签名/来源、去重、处理乱序；服务端确认付款后异步发权益，权益失败重试不能再向用户扣一次钱。取消续订、到期、退款和账号删除是不同动作，各自的权限变化按经确认渠道规则执行。

原退款“双人审批”保留。单人运营是否能满足、如何处理由 DEC-10 决策，不能通过伪造第二审批人解决。真实通道未准入时，沙盒只验证流程，不形成真实权益和营收统计。

<a id="c9"></a>

## C9. 内容覆盖与入口可用性（新增发布门，DEC-08）

10 道定级题、5 道练题绑定和旧 B3 下线清单是原数据验收范围，不足以证明用户第二天仍然能学。每个拟开放目标/难度需要记录：可用定级题、真实练习、变式/解释、次日复习内容、必要媒体、版权/审核状态、缺货时的可用替代。

这是覆盖检查，不在本稿凭空设最低题库数量。目标没有足够内容承接时，限制该目标的开放范围，并在选目标之前说明；不在用户完成定级后才告诉他无课可学。

首版主导航只突出已可用学习、复盘和账号功能。未开放的 AI/世界/商城/语音/小游戏采用功能门与旧链接解释，而不是一排可以点击但什么也做不了的入口。无已确认发布日期不承诺“即将上线”。

<a id="c10"></a>

## C10. AI/语音可信输出与停止（新增设计，DEC-11）

AI 展示链的修订建议：输入授权与资格/预算检查 → 前置检查 → 版本固定的请求 → 展示前缓冲检查或整段检查 → 结构验证 → 可信结果保存/采纳。后置审计可以存在，但不能把已展示的违规内容视为成功拦截。

用户停止、上游超时、审核失败、结构失败、生成完整分别有状态；停止后停止向用户追加旧分片；上游可能仍已产生费用，成本台账记录真实结果，不宣称停止等于免费。预算预占/释放、部分结果是否保存、日志可见范围及保留期均待确认（DEC-11）。

AI 建议不直接变成权威成绩/掌握度；通过既有可信学习链才能更新学习状态。语音无有效音频、网络中断或评分失败不出假分。替代入口必须真实可用，否则返回已有文字练习。

---

## 附 A. 双端/异常验收清单（新增，用于开发与验收）

| 场景编号 | 操作 | 应出现的证据与用户结果 |
|---|---|---|
| AC-01 | 注册双击/重传 | 一个账号、同回执；未过学习门不能学习，账号服务可访问 |
| AC-02 | 可续期会话与被踢会话分别访问 | 前者静默恢复；后者停止重试、明确退出，不能把两者混用 |
| AC-03 | 完成定级 / 跳过定级各建计划 | 两条 canonical 路径均获准；来源/资格/pin/快照/幂等可查，SKIPPED 固定 UNVERIFIED、coverage=0、评分/等级 null，无伪造报告；兼容与运行证据 GAP 不重新成为整项 DEC-03 业务批准前提 |
| AC-04 | 提交已入库但回执丢失，刷新后继续 | 查 checkpoint 后恢复；不新建会话、不多推进一题 |
| AC-05 | 两设备同时答同题 | 一个有效版本结果；另一端读最新状态，可解释恢复 |
| AC-06 | 5 次作答含 2 次错误，重复投递所有事件 | 作答、错题、SRS 按规则可追，不要求行数相同，不重复结算 |
| AC-07 | 同日出现补救+D+1/SRS 重合任务 | 依据确定规则归并，保留来源；合计预算和顺延可解释 |
| AC-08 | 分别模拟未建计划/已完成/无内容/读取失败 | 四种不同原因与动作；不都跳去重新定级 |
| AC-09 | 注册数天后第一次学习 | 引导仍可继续；已完成首学者不会重复进入首次流 |
| AC-10 | v2 上线后继续 v1，再模拟强制下线 | 普通 pin 可续；强制下线后不可继续拉取，历史按政策保留 |
| AC-11 | 切号时旧请求晚返回、本地有草稿 | 新账号不显示旧数据；草稿权限与清理范围正确 |
| AC-12 | 客服/导出 worker 未准入 | 不显示假可用闭环或“全部完成”；真实替代渠道需存在 |
| AC-13 | 删除申请、冷静期撤回、执行恢复和普通退出分别走完 | 普通退出可重登；IAM 168 小时冷静期内二次认证可撤回至 CANCELLED 并读最新资格出口，执行后不可撤回；部分失败不判完成，owner receipt 与全部会话撤销对账后才 ANONYMIZED |
| AC-14 | 沙盒已付款但权益消费者失败 | 显示已付待开通，补发一次；重试不再扣款、不多发权益 |
| AC-15 | 续费失败/取消续订/恢复购买/退款各回放 | 资金、订阅、权益各自按确定规则流转；重复通知无二次副作用 |
| AC-16 | AI 在部分输出时停止/审核不通过 | 停止追加；未通过内容不展示，状态与实际成本可追；仅 P2 测试 |
| AC-17 | 主学习链只用键盘、字体放大、减少动效 | 能开始/提交/返回，焦点与反馈可感知，不依赖未开放小游戏 |
| AC-18 | 新用户完成首学并到下一学习日 | 确有下一步内容/复习可做，或明确范围限制；不只证明种子题能答 |

每项证据记录环境、提交版本、数据版本、角色、请求/会话编号、源写入与读回、页面结果及失败恢复。以上是验收设计，不代表已执行通过。

## 附 B. 成熟度与编号口径

| 链条 | 本包保留步骤数 |
|---|---:|
| L1 | 12 |
| L2 | 10 |
| L3 | 10 |
| L4 | 12 |
| L5 | 10 |
| L6 | 8 |
| L7 | 8 |
| L8 | 14 |
| L9 | 10 |
| L10 | 8 |
| L11 | 8 |
| L12 | 2 |
| L13 | 14 |
| L14 | 14 |
| L15 | 8 |
| L16 | 14 |
| L17 | 10 |
| L18 | 8 |
| L19 | 8 |
| L20 | 6 |
| 补链附录 | 10 |
| **合计** | **204** |

- BC-113/115/116：原文明确并入 L17 后退役；不恢复为新步骤，不重用编号。
- BC-114：沿用 BC-112 记载的历史合并注记（提交 8570fe1a），旧号不复用；该来源说明不新增步骤，也不作为本轮正式业务验收证据。
- 补链附录实际包含 BC-199…208 共 10 步，已修正原标题范围。
- R1=108、R2=39、R3/待细化=57 仅保留为 2026-09-28 冻结与变更单的历史口径，本轮没有逐 ID 核对出一份可信阶段清单，不标“已重算”。此前补写的分项构成既与 108 不符，区间排除也有错误，已撤除。204 是有效 BC 编号的结构计数；108 个非索引 IC 幕是另一维度，不能混作 R1 步骤或完成数。阶段重新核对须列出每个 BC 的读/写子范围、唯一归属和排除项，并由 DEC-01 责任人签收；核对前不据历史总数判断完成或自动开放，也不自行改变冻结范围。
- 原稿提到的 310 占位行、486 映射行、P2 的 68 单元、P3 的 62 单元，以及 D1–D6、T19–T21、R1.2、M6/M8 等外部口径未随本包核验。保留引用来源，不宣称这些外部数值本次已对账。
- 非交互步骤可以没有独立 IC 幕；其验证方式是数据、事件、后台/发布证据，不能为了补幕而造页面。

完整待确认项、修改边界和替换方法见 [修订说明](revision-notes.md)。
