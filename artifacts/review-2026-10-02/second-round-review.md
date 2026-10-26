# 第二轮评审报告（2026-10-02）

> 结论：**暂不批准“需求、业务链、交互链已经全量定稿/完美”。确认 12 项整改：2 项 P1、10 项 P2。**
>
> 分支：`dev-redesign`；HEAD：`3d11be3337accd32afbdbe13a218bca38c786043`。针对当前共享工作区评审，不等于该提交的净树结果。
>
> 用户指定北京时间 04:20 恢复；恢复后重新核对关键源码与文档，以下问题仍存在。本轮仅创建评审报告、截图和来源快照；没有修改实现、核心设计、正式需求或开发计划，没有提交、推送或重启服务。

## 1. 范围与证据边界

- 业务链全文：L1–L20、204 个保留 BC、C1–C10、验收附录；交互链全文：111 个 IC、U1–U9、D1–D6。全文读取/交叉检查不等于逐条运行验收。
- 管理原型全部 16 页及模型、指南逐页源码复核。中断前独立评审用隔离 VM 复现未保存标题丢失、存储失败/恢复反馈、工单升级缺字段；恢复后根 Agent 复核当前相关代码，未使用真实用户存储。
- 移动原型核对当前计划模板、今日/复习流程，并在现有服务的独立 `localhost` 页面实际查看今日安排、到期队列、15 分钟计划预览；预览最终取消，原 45 分钟目标保留。页面使用既有演示数据及演示时钟，不能当真实用户的日期/学业记录。用户 `127.0.0.1` 页面未操作。
- 需求 README、feature-matrix、设计来源表全文核对；PRD、登记册、角色/页面/学习规则/后台流程、ADR 与相关现行契约做定向语义核对。**没有逐一验收完整 PRD 每个原子项或全部 980 登记行。**
- 开发计划、认领台账、排期依赖与状态均排除。仅在工作区状态中看到其文件名，不读取或评审其内容。
- 本轮没有新增或运行测试套件。先前 56/56、页面布局样本和结构检查不充当本轮全量通过证据；浏览器所查页面未记录 Console error/warn，也不证明业务无缺陷。

P1 表示应优先关闭的数据丢失或核心事实/不可逆流程设计风险；P2 表示仍须整改的业务闭环、状态反馈、规范一致性或来源追溯缺陷。

## 2. 确认问题

### R2-01 · P1 · 跨窗口更新丢失未保存标题

**证据：** [app.js](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/mockups/admin/app.js:210) 收到 storage 事件后直接替换模型并重绘；同文件第 153 行从远端标题重建输入框。[BC-072](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/business-chains.md:176) 与 [U4](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/interaction-chains.md:347) 要求保留自己的未提交修改供对比。

**复现/影响：** 输入本地未保存标题，另一窗口合法更新数据后，本地输入消失、显示远端标题；用户没有机会复制或比较自己的修改。独立 VM 场景已复现，恢复后源码仍相同。

**关闭条件：** 保留编辑基线与未提交字段；外部更新时展示冲突/对比，明确选择后替换，不能无条件重绘抹掉输入。

### R2-02 · P1 · 隐私导出 owner、注销冷静期及撤回分支遗漏

**证据：** [L19](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/business-chains.md:356) 将整环 owner 写成 admin-ops/iam，遗漏导出事实 owner；[C7 删除流程](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/business-chains.md:517) 从受理进入访问停止与执行，第 519 行把撤销/查询/冷静期继续视为待定；[IC-106](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/interaction-chains.md:270) 与 IC-108 没有冷静期撤回分支。

上位 [accepted ADR-0014](C:/Users/Administrator/Desktop/my/cloudstudy/docs/10-decisions/0014-phase1-support-privacy-ownership.md:16) 已定义导出归 learner-service.privacy、删除请求/冷静期/撤回归 IAM，workflow 仅编排；[FEAT-USR-007](C:/Users/Administrator/Desktop/my/cloudstudy/requirements/feature-matrix.md:277) 明确七天冷静期；[隐私生命周期契约](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/phase1-business-operation/m1-017-privacy-lifecycle-contract.md:28) 已冻结 168 小时与 PENDING_COOLING_OFF→EXECUTING→ANONYMIZED，冷静期内二次认证可取消，status/cancel 操作已存在。

**影响：** 接手开发可能把导出写入错误服务，或跳过已规定的撤回窗口。已有契约不能因实现尚未验证而重新变成未决规则。

**关闭条件：** BC/IC 明确 owner、冷静期、取消后返回与状态查询；DEC-09 区分已冻结规则、真正待决的保留政策、worker 实现与运行证据。

### R2-03 · P2 · 存储失败仍给成功提示，恢复后告警不清

**证据：** [adbSave/acall](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/mockups/admin/app.js:68) 保存失败返回 false，但第 76 行忽略返回值并继续显示成功消息；成功写入分支没有清除 storageIssue。

**复现/影响：** 模拟容量错误后送审，最后提示仍是“已补齐当前版本演示材料并送审”；恢复写入成功后，页面仍显示“本机存储写入失败”。本会话变化与持久保存被混为一谈。

**关闭条件：** 保存失败保留可恢复的会话状态，反馈未持久化及重试；成功后清除对应告警，最终反馈不覆盖错误。

### R2-04 · P2 · 内容审核缺少驳回/要求修改闭环

**证据：** [BC-075/076](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/business-chains.md:179) 与 [IC-041](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/interaction-chains.md:128) 没有负面决定→理由读回→作者整改→新草稿→重新校验/送审分支；[审核按钮](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/mockups/admin/app.js:151) 仅提供通过；[approve 模型](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/mockups/admin/model.js:116) 只有通过路径。

上位 [内容状态机](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/phase1-business-operation/05-后台内容运营与客服业务流程.md:63) 及第 127–130 行要求 APPROVED/CHANGES_REQUESTED/REJECTED，并创建新 DRAFT version、重新校验，保留版本/hash 决定。

**影响：** L2 发现答案错误时，无法记录退回理由并让作者恢复整改；不操作或直接改标题换版均不能替代审核决定。此项不属于待批准的简审例外。

**关闭条件：** 原 BC/IC 下补齐两个负面决定、理由/通知/读回/重新送审；新稿不复用旧签核，历史决定保留；原型能走通该分支。

### R2-05 · P2 · 工单升级没有接收方与原因

**证据：** [工单详情](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/mockups/admin/app.js:178) 直接一键升级；[工单模型](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/mockups/admin/model.js:172) 只改状态并保存 action/who/time/status。[BC-186](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/business-chains.md:363) 已要求升级接收方、原因与状态保存读回。

**复现/影响：** 工单显示“已升级”，原 assignee 仍是当前接单人，记录无目标接收方与原因；无法证明转给谁、是否接收。

**关闭条件：** 升级需明确目标、原因及交接状态；未接收显示待接收，刷新可读回，不把单纯状态改变说成完成交接。

### R2-06 · P2 · 强停缺少处置原因留存

**证据：** [stop 模型](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/mockups/admin/model.js:135) 保存 forced 状态、操作者、时间、恢复点，没有处置原因；[强停入口](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/mockups/admin/app.js:158) 只有动作确认。[BC-079](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/business-chains.md:183) 与设计来源表 M04 要求禁供标记、原因和权限独立留存。

**影响：** 状态被保护但无法读回为何禁止分发，审计与后续受控解除缺乏依据。

**关闭条件：** 选择/填写原因并随版本/命令保存，在详情与审计读回；保留现有强停禁普通恢复规则。

### R2-07 · P2 · 移动计划优先新学，到期复习在短计划中消失

**证据：** [lmTemplate](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/mockups/mobile/learning.js:110) 先放语法/阅读/写作/新词/章节；第 113–116 行只有 minutes≥45 才追加到期复习；第 124 行按顺序消耗预算。[IC-015](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/interaction-chains.md:67) 与 C4 要求续学后先归并到期任务，再安排新学。

**浏览器结果：** 复习页显示 5 个词与 1 项延迟验证到期。45 分钟今日安排把复习放最后；15 分钟预览只有 5 分钟语法与 8 分钟阅读，完全没有到期复习。原型 5 分钟复习任务可以装入 15 分钟，但模板不产生候选。截图见第 4 节。

**影响：** 用户选择较短日预算时，正常“今日学习”持续优先新内容，必须主动寻找独立复习入口，与文档设计相反。这里评审交互优先级，不要求演示完整实现正式算法。

**关闭条件：** 所有预算档都从续学/到期/新学同一候选集安排；不能仅因预算<45 排除复习。装不下的到期任务明确说明和安排，示例任务分钟不反推正式 policy。

### R2-08 · P2 · 已冻结学习规则仍被写成待定义

**证据：** [BC-051](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/business-chains.md:134)、BC-056:146、[IC-032](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/interaction-chains.md:105) 把日期、具体时区、预算或 SM2 参数整体继续挂 DEC-07；C4 与 DEC-07 没有明确切分已有规则和新增提案。

上位 [日计划 D2 规则](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/phase1-business-operation/04-学习机制与学习引擎规则.md:228) 已固定预算、10% 上浮与积压口径（15 分钟 total cap=17）；同文件第 295–320 行固定 SM2 公式、IANA/DST、时区变更，第 385 行固定 D1 为下一 configured study day、D7 基于 D1 PASS 日期。D2 规则冻结不代表真实运行通过。

**影响：** 研发/验收可能重新决定已批准参数，各端选择不同日期和预算。总则“上游优先”不足以消除执行表中的待决歧义。

**关闭条件：** 主表直接引用既有 policy，DEC-07 只列本包新提案及真正缺口；禁止用演示 SM2/日期替代正式规则。

### R2-09 · P2 · AC-03 仍要求 DEC-03 整体定稿才验收快速开始

**证据：** [AC-03](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/business-chains.md:569) 保留“前提是 DEC-03 已定稿”；但 BC-023、C5 与 [IC-013](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/interaction-chains.md:65) 已确认 canonical SKIPPED 合法，DEC-03 只余兼容/实现/运行签核。

**影响：** 验收 Agent 从附录执行时会错误关闭已经允许的快速开始路径。

**关闭条件：** AC-03 沿用 ASSESSED/SKIPPED 现行契约；运行证据不足记 GAP，不用整个 DEC 状态重新批准业务路径。

### R2-10 · P2 · D6 附录仍称“已批单人可发”

**证据：** [D6](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/interaction-chains.md:437) 写“简审档（原文已批）”“保留单人可发、留痕可撤”；与正文 IC-041/U4、[BC-084](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/business-chains.md:188) 的正式四主体分离、单人仅本机演示及例外待签收不一致。

**影响：** 执行导航仍可能被接手 Agent 当作正式单人审核发布授权。

**关闭条件：** 附录限定本机演示，引用正式职责分离与例外批准条件；“已批”只描述历史出处。

### R2-11 · P2 · 客服 hash-only 被当作当前唯一规范，遗漏安全内容引用

**证据：** [C7 客服](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/business-chains.md:508)、[DEC-06](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/revision-notes.md:66) 与交互 U5 将可理解描述整体视为尚需新批准；没有区分旧 hash-only 数据与当前安全内容协议。

上位 [统一客服规范](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/phase1-business-operation/05-后台内容运营与客服业务流程.md:239) 已定义七态、脱敏描述引用、版本与 retention；[内容引用 policy](C:/Users/Administrator/Desktop/my/cloudstudy/config/p1r-notification-sync-support-contract.v1.json:1011) 已要求 contentRefId/sha256/redactionVersion/scanStatus/objectVersion/safePreviewRef，只有 CLEAN 可用，原始自由文本不得进入 ticket/event。

**影响：** 可以安全读取问题的既有设计被误标为完全未批准，同时新“正文”提案未说明应如何服从内容引用边界。

**关闭条件：** 保留历史 hash-only 单禁止假回复/关闭；正式新工单沿用既有脱敏内容引用，不把原始自由文本写入 ticket/event。扩大采集/保留政策和运行准入仍单列待决，不冒充运行完成。

### R2-12 · P2 · 管理权限来源配到了学习端设备授权

**证据：** [M09 来源映射](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/redesign/design-source-traceability.md:76) 将 PRD-ATOM-1701→V2-980-0394 用于管理权限；[登记册单元](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/08-980plus-功能点设计登记册.md:416) 属 USR、宿主 auth/me/settings；[PRD Permission Center](C:/Users/Administrator/Desktop/my/cloudstudy/requirements/product-requirements.md:2868) 指通知、麦克风、存储等系统授权。

真正的管理 RBAC 来源是 [PAGE-P1-ADMIN-PERMISSIONS](C:/Users/Administrator/Desktop/my/cloudstudy/docs/06-design/v2-980plus/phase1-business-operation/03-全端页面功能登记册.md:134) 与 [ARCH-IAM-002](C:/Users/Administrator/Desktop/my/cloudstudy/docs/02-architecture/v2-platform-capability-matrix.md:13)。

**影响：** ID 存在与配对检查虽通过，需求语义仍错误，可能误称管理权限已满足学习端设备授权需求。

**关闭条件：** 拆分设备授权与管理 RBAC 追溯；每个管理行为绑定正确上位能力，不创建虚假需求原子 ID。

## 3. 已正确保留的边界与仍待签收事项

以下没有重复列为新缺陷：

- 单人简审、L2 自动发布明确仅本机演示，正式四主体分离例外仍待产品/架构/内容 owner 签收；但 R2-10 的附录残留须修正。
- 自动续费提案与现行非自动续费 SKU 差异已登记，不能据此放行真实支付。
- AI/语音/K12/社交成长的后续阶段 Gate、真实版权与媒体资格、正式 IAM/PEP、真实支付、隐私 worker 和运行证据仍须对应验收。
- 历史 108/39/57 阶段计数不是完成数，尚未可靠逐 ID 重算；本轮不代替产品对阶段范围签收。
- 设计来源表已如实声明局部映射范围；“ID 可定位/错配 0”的结构结果不能代替 R2-12 的语义检查。
- 12 项 DEC 不能统一标已完成；已有 canonical 规则与待签收新增提案需要逐项分开。

## 4. 浏览器证据

- [复习页到期队列](mobile-due-queue.png)：5 个词与 1 项延迟验证到期。
- [15 分钟计划预览](mobile-15-minute-preview.png)：仅语法与阅读，预计 13 分钟，无到期复习。
- 核对后取消调整，原 45 分钟今日安排保留。演示队列/时钟来自本机样例，不是生产数据。
- 原图使用当时浏览器默认视口；本轮没有再次声称全部 91 屏、响应式或真机通过。

## 5. 接手整改与复审依据

先处理 P1，再关闭各项 P2。每项关闭须有对应代码/文档变更、状态读回与恢复证据；不能仅把描述改成“已完成”。本报告列整改条件，**不构成开发计划、排期或认领台账**。

整改后复审重点：跨窗口本地输入保护、存储失败与重试、审核退回、工单交接、强停理由、短预算到期安排，以及正文/附录/来源/上位契约一致性。正式系统运行与上线审批仍单独验收。

当前结果只能说明这一轮确认的缺陷与覆盖范围，不能换算为产品完成百分比，也不能保证未覆盖需求没有其他问题。

## 6. 来源快照

[reviewed-sources.json](reviewed-sources.json) 保存本轮 13 个定向来源的 SHA-256；开发计划和任务台账不在快照范围。来源发生变化后需复核对应问题，不能直接沿用本报告的行号或未关闭结论。

