# 静态原型反推规则的设计来源追溯（2026-10-02）

> 状态：`DESIGN-MAPPED / NOT-RUNTIME-VERIFIED`。本表只追溯移动 A01–A19 与管理审批整改的设计来源，不是 204 个 BC 的正式实施完成表，不宣称需求全量或业务 100% 通过。正式实施仍见 [traceability-matrix.md](traceability-matrix.md)。形成此表的 §20/§21 审批未纳入开发计划；用户随后授权的 §22 规划以本表为输入，来源存在不替代逐卡精确适用项签收。

## 1. 来源优先级与使用边界

根 [AGENTS.md](../../../../AGENTS.md) → 有效 ADR/[v2 架构](../../../02-architecture/v2-microservices-architecture.md) → [v2 设计基线](../README.md)与[业务运行设计包](../phase1-business-operation/README.md) → 本包 BC/IC 修订建议 → 静态演示。演示保存字段、硬编码数字、身份选择或本地回调都不能反向成为正式 owner、契约、算法或权限事实。

下方 FEAT/PRD-ATOM 来源均从现有 [V2-980 登记册](../08-980plus-功能点设计登记册.md) 核对；FEAT 的产品证据还可在 [feature-matrix](../../../../requirements/feature-matrix.md) 查到。PRD-ATOM 行沿用登记册所记录的 requirements 文档与行号，不创建新的原子 ID。平台管理权限单独绑定 ARCH/PAGE，不以学习端设备权限原子代替，不计入 980。登记范围是设计来源，**不意味着本轮实现了对应功能包的全部内容**；新增差异仍需对应 owner 签收，既有 canonical 契约继续生效。

[ARCH 能力](../../../02-architecture/v2-platform-capability-matrix.md) 只作架构依赖，不计入 980。运行层的 ACT/JNY/PAGE/RULE/INT/E2E 来自下表各源文件；这些 ID 只是设计及验收索引，未执行的运行测试不能标 PASS。

## 2. 运行层绑定表

同一 RT 引用展开为本行完整 ID；正式任务必须展开引用，不把 RT 当新的 canonical ID。

| 本表引用 | ACT 与 JNY | PAGE | RULE | INT 与 E2E |
|---|---|---|---|---|
| RT01 | ACT-P1-VISITOR、ACT-P1-LEARNER；JNY-P1-01 | PAGE-P1-AUTH-LOGIN、PAGE-P1-AUTH-REGISTER-RESET、PAGE-P1-DEVICES | 无独立学习规则；IAM 生命周期 | INT-P1-001；E2E-P1-AUTH-LIFECYCLE |
| RT02 | ACT-P1-LEARNER、ACT-P1-SYSTEM；JNY-P1-02 | PAGE-P1-ADULT-CONSENT | 无独立学习规则；IAM 资格/同意 | INT-P1-002；E2E-P1-ADULT-CONSENT |
| RT03 | ACT-P1-LEARNER；JNY-P1-03、JNY-P1-05 | PAGE-P1-ONB-GOAL、PAGE-P1-TODAY、PAGE-P1-LEARN-HOME | RULE-P1-DAILY-PLAN、RULE-P1-TIME-SYNC | INT-P1-003、INT-P1-004；E2E-P1-FIRST-DAY、E2E-P1-TODAY-SESSION |
| RT04 | ACT-P1-LEARNER、ACT-P1-SYSTEM；JNY-P1-04 | PAGE-P1-ASSESSMENT、PAGE-P1-ASSESSMENT-RESULT | RULE-P1-PLACEMENT、RULE-P1-SESSION、RULE-P1-DAILY-PLAN | INT-P1-004；E2E-P1-FIRST-DAY |
| RT05 | ACT-P1-LEARNER；JNY-P1-05、JNY-P1-06 | PAGE-P1-TODAY、PAGE-P1-PRACTICE-SESSION、PAGE-P1-PRACTICE-HUB | RULE-P1-SESSION、RULE-P1-DAILY-PLAN、RULE-P1-TIME-SYNC | INT-P1-003、INT-P1-006；E2E-P1-TODAY-SESSION |
| RT06 | ACT-P1-LEARNER；JNY-P1-06 | PAGE-P1-READING、PAGE-P1-LISTENING、PAGE-P1-SPEAKING、PAGE-P1-WRITING、PAGE-P1-VOCAB | RULE-P1-SESSION、RULE-P1-TIME-SYNC | INT-P1-005、INT-P1-006；E2E-P1-MULTISKILL |
| RT07 | ACT-P1-LEARNER、ACT-P1-SYSTEM；JNY-P1-07 | PAGE-P1-SRS、PAGE-P1-VOCAB、PAGE-P1-TODAY | RULE-P1-SRS、RULE-P1-MASTERY、RULE-P1-TIME-SYNC | INT-P1-006、INT-P1-007、INT-P1-014；E2E-P1-SRS |
| RT08 | ACT-P1-LEARNER、ACT-P1-SYSTEM；JNY-P1-08、JNY-P1-09 | PAGE-P1-MISTAKES-MASTERY、PAGE-P1-REPORT | RULE-P1-MISTAKE-REPAIR、RULE-P1-MASTERY、RULE-P1-REPORT | INT-P1-006、INT-P1-007；E2E-P1-MISTAKE-MASTERY |
| RT09 | ACT-P1-LEARNER；JNY-P1-09 | PAGE-P1-REPORT、PAGE-P1-TODAY | RULE-P1-REPORT、RULE-P1-DAILY-PLAN | INT-P1-006、INT-P1-007；E2E-P1-TODAY-SESSION |
| RT10 | ACT-P1-CONTENT-EDITOR、ACT-P1-REVIEWER-L1、ACT-P1-REVIEWER-L2、ACT-P1-RELEASE-OPERATOR、ACT-P1-AUDITOR；JNY-P1-13 | PAGE-P1-ADMIN-CONTENT、PAGE-P1-ADMIN-MEDIA、PAGE-P1-ADMIN-REVIEW、PAGE-P1-ADMIN-PUBLISH-ROLLBACK、PAGE-P1-ADMIN-AUDIT | 无独立学习规则；上游后台流程 §3 | INT-P1-005、INT-P1-011、INT-P1-017；E2E-P1-CONTENT-PUBLISH、E2E-P1-RECOVERY |
| RT11 | ACT-P1-LEARNER、ACT-P1-SUPPORT、ACT-P1-SYSTEM；JNY-P1-14 | PAGE-P1-SUPPORT、PAGE-P1-ADMIN-SUPPORT、PAGE-P1-ADMIN-GOVERNANCE | RULE-P1-TIME-SYNC；客服流程 | INT-P1-012、INT-P1-013、INT-P1-017；E2E-P1-SUPPORT、E2E-P1-RECOVERY |
| RT12 | ACT-P1-LEARNER、ACT-P1-PRIVACY、ACT-P1-AUDITOR、ACT-P1-SYSTEM；JNY-P1-15 | PAGE-P1-PRIVACY、PAGE-P1-ADMIN-AUDIT | RULE-P1-TIME-SYNC；隐私生命周期 | INT-P1-015、INT-P1-016、INT-P1-017；E2E-P1-PRIVACY |
| RT13 | ACT-P1-LEARNER、ACT-P1-FINANCE、ACT-P1-PAYMENT-CHANNEL；JNY-P1-12 | PAGE-P1-COMMERCE、PAGE-P1-ADMIN-COMMERCE | 无独立学习规则；订单/权益契约 | INT-P1-010；E2E-P1-ENTITLEMENT |
| RT14 | ACT-P1-LEARNER、ACT-P1-SYSTEM；JNY-P1-10 | PAGE-P1-WORLD、PAGE-P1-AVATAR-REWARD | RULE-P1-SESSION | INT-P1-008；E2E-P1-REWARD |

核对入口：[角色](../phase1-business-operation/01-角色系统边界与业务总图.md)、[旅程 §6](../phase1-business-operation/02-端到端业务旅程台账.md)、[页面](../phase1-business-operation/03-全端页面功能登记册.md)、[规则](../phase1-business-operation/04-学习机制与学习引擎规则.md)、[后台流程](../phase1-business-operation/05-后台内容运营与客服业务流程.md)、[联调](../phase1-business-operation/06-业务联调矩阵.md)、[E2E](../phase1-business-operation/08-验收与追溯规范.md)。

## 3. 移动反推规则→需求与架构

原型落点统一为 `mockups/mobile/app.js` / `learning.js`；仅作设计对照，不填正式实施列。A 编号沿用 [交互审计证据](mockups/mobile/evidence/interaction-audit-20261001/README.md)。

| 规则/审计项 | BC / IC 落点 | 现有需求来源→登记单元 | ARCH 依赖 | 运行层 | 细化与未决边界 |
|---|---|---|---|---|---|
| A01 每任务独立作答/位置 | BC-037；IC-023 | FEAT-ONB-011→V2-980-0011；PRD-ATOM-1699→V2-980-0393 | ARCH-REL-001、ARCH-API-001 | RT05 | 账号/session/内容版本恢复；本地暂存范围 DEC-05，不以本机 storage 代替服务端 checkpoint |
| A02 复习撤销不回退无关成果 | BC-058、BC-203；IC-032 | FEAT-VOC-011→V2-980-0033；PRD-ATOM-0701→V2-980-0290 | ARCH-EVT-001、ARCH-REL-001 | RT07 | 只补偿本次评分来源；正式不可变 attempt/账本不能随演示 undo 删除，补偿契约 DEC-07 |
| A03 查看结果与独立重练 | BC-033、BC-040；IC-022 | FEAT-ASM-012→V2-980-0226；PRD-ATOM-0474→V2-980-0236 | ARCH-REL-001、ARCH-DATA-001 | RT05 | 查看不产生新提交，重练新轮次，稳定幂等身份 |
| A04 跨日任务/草稿身份分离 | BC-027、BC-029；IC-017 | FEAT-ASM-004→V2-980-0218；PRD-ATOM-0507→V2-980-0266 | ARCH-API-001、ARCH-REL-001 | RT03、RT05 | 原安排日期与当前完成日分离；日期、优先级/去重、10% cap 与各档预算沿用学习规则 §4.7/§6/§7.3；DEC-07 仅新增补偿/兼容与运行 GAP，样例不替代完整引擎 |
| A05 跨批复习累计与窄补偿 | BC-058；IC-032 | FEAT-VOC-011→V2-980-0033；FEAT-VOC-015→V2-980-0037 | ARCH-EVT-001、ARCH-DATA-001 | RT07 | 任务目标集合/源批次可追，不新增虚假 XP/活动；已有去重/投影键沿用上游，新增跨批撤销权限/补偿命令/窗口才待 DEC-07 |
| A06 词义选择锁定，测验/自评分开 | BC-042、BC-055；IC-025 | FEAT-VOC-016→V2-980-0038；PRD-ATOM-0489→V2-980-0250 | ARCH-API-001、ARCH-EVT-001 | RT06、RT07 | 单个逻辑错题不重入，主观认识不等于可信掌握 |
| A07 写作独立草稿/未知结果 | BC-043；IC-028 | FEAT-WRT-002→V2-980-0190；PRD-ATOM-0454→V2-980-0195 | ARCH-REL-001、ARCH-IAM-002 | RT06 | 固定规则与参考，不冒充 AI/完整评分；任务、轮次及账号隔离；暂存 DEC-05 |
| A08 阅读快照/完成同步 | BC-038、BC-199、BC-200；IC-023、IC-029 | FEAT-RDG-002→V2-980-0136；PRD-ATOM-0392→V2-980-0151 | ARCH-DATA-001、ARCH-EVT-001 | RT06 | 完成幂等，原章节上下文保留；真实内容/rights/下线 DEC-08 |
| A09 听力完整作答与保存 | BC-043；IC-026 | FEAT-LST-001→V2-980-0107；PRD-ATOM-0476→V2-980-0238 | ARCH-API-001、ARCH-REL-001 | RT06 | TTS 样例不能证明合法音频、听力覆盖或真实音频验收；未答全不提交 |
| A10 口语稳定轮次 | BC-043、BC-148；IC-027、IC-087 | FEAT-SPK-004→V2-980-0162 | ARCH-REL-001、ARCH-IAM-002 | RT06 | 原型保存演示轮次，不声称有效录音评分；真实语音/评分/保留 DEC-11 |
| A11 快速开始/首学/取消计划 | BC-011、BC-017、BC-023；IC-013、IC-021 | FEAT-ONB-005→V2-980-0005；FEAT-ONB-001→V2-980-0001 | ARCH-IAM-002、ARCH-API-001、ARCH-REL-001 | RT03、RT04 | 上游已允许 SKIPPED→保守计划；DEC-03 只待兼容/运行签核，不造报告；首次确认进首学，取消不改计划 |
| A12 限时暂停/恢复 | BC-037、BC-065；IC-023、IC-033 | FEAT-ASM-012→V2-980-0226；PRD-ATOM-0475→V2-980-0237 | ARCH-REL-001、ARCH-API-001 | RT05、RT09 | 离页/后台暂停，手动恢复；有效时长已冻结为版本化服务端 activity policy 的 owner accepted creditedSeconds/60，客户端计时/预估不结算；新增政策差异才待 DEC-07 |
| A13 成人/同意/身份回调守卫 | BC-006、BC-008、BC-022；IC-055、IC-056、IC-059 | FEAT-USR-001→V2-980-0359；PRD-ATOM-1044→V2-980-0366 | ARCH-IAM-001、ARCH-IAM-002 | RT01、RT02、RT04 | 正式资格由 IAM 判定；本机完整生日不扩大正式采集，年龄证据范围与同意用途待隐私/产品签核（DEC-02/05） |
| A14 商品/订单/票据独立事实 | BC-167、BC-168、BC-172、BC-175；IC-098、IC-100、IC-101 | FEAT-COM-009→V2-980-0469；PRD-ATOM-1104→V2-980-0475 | ARCH-REL-001、ARCH-IAM-002 | RT13 | 演示沙盒不扣款/不开真实权益；正式订单和渠道回执事实不能以客户端状态替代；自动续费差异见 §5 |
| A15 客服草稿/文字转义 | BC-185、BC-186；IC-103、IC-104 | FEAT-INF-008→V2-980-0412；PRD-ATOM-1545→V2-980-0530 | ARCH-IAM-002、ARCH-REL-001 | RT11 | 本机保存不代表已发送；ADR-0014 的 support owner 与后台 §6 的脱敏安全内容引用已冻结，仅 CLEAN safePreviewRef 可读，原文不进 ticket/event/log；新增采集/保留政策与运行证据才待 DEC-06/09 |
| A16 单机账号真实边界 | BC-004、BC-005、BC-204；IC-035、IC-043 | FEAT-USR-001→V2-980-0359；PRD-ATOM-1048→V2-980-0369 | ARCH-IAM-001、ARCH-IAM-002 | RT01 | 演示角色/密码不作身份授权，不声称真实撤销设备会话 |
| A17 缺内容不编造 | BC-042、BC-199；IC-025、IC-029 | FEAT-VOC-005→V2-980-0027；PRD-ATOM-0176→V2-980-0068 | ARCH-IAM-002、ARCH-DATA-001 | RT06 | 缺搭配/音频/授权如实关闭；来源/覆盖 DEC-08 |
| A18 无障碍偏好与本地 SVG | BC-121、BC-199；IC-070、IC-109、IC-110、IC-111 | PRD-ATOM-1738→V2-980-0397；FEAT-GAM-013→V2-980-0279 | ARCH-PLAT-001、ARCH-API-001 | RT06、RT14 | 降级不失主链，试穿不落真实权属；字体/读屏/真机仍按证据核验，成长 Gate DEC-12 |
| A19 样例测评的材料/覆盖诚实 | BC-013、BC-015、BC-063；IC-010、IC-012、IC-058 | FEAT-ONB-003→V2-980-0003；FEAT-ONB-004→V2-980-0004 | ARCH-API-001、ARCH-IAM-002 | RT04 | 五个样例不替代正式 10 题/四维 manifest；全跳过未定级、未测维度不造分；反馈时点差异 DEC-04 |

## 4. 管理整改规则→需求与架构

原型落点为 `mockups/admin/app.js`，正式宿主仍为 `apps/admin-web`（Vue 3 + Element Plus）。

| 整改规则 | BC / IC | 现有需求来源→登记单元 | ARCH 依赖 | 运行层 | 必须保存/核验与差异 |
|---|---|---|---|---|---|
| M01 草稿版本/hash 与匹配签核 | BC-072、BC-075、BC-076、BC-082；IC-040、IC-041 | FEAT-ADM-005→V2-980-0497；PRD-ATOM-1528→V2-980-0514 | ARCH-DATA-001、ARCH-REL-001 | RT10 | 决定 APPROVED/CHANGES_REQUESTED/REJECTED 绑定版本/hash、阶段和独立 reviewVersion；负向决定原因/通知/历史可追，新 DRAFT 版本修订重校验/送审；不能改审核对象沿用批准 |
| M02 作者、L1、L2、发布者分离 | BC-073、BC-076、BC-077、BC-084；IC-041 | FEAT-ADM-005→V2-980-0497；PRD-ATOM-1531→V2-980-0517 | ARCH-IAM-001、ARCH-IAM-002 | RT10 | 服务端 principal/权限/作者事实判定，昵称或选择演示角色不作授权；简审差异见 §5 |
| M03 已发布独立快照与同步持久化 | BC-077、BC-078；IC-041、IC-042 | FEAT-ADM-005→V2-980-0497；PRD-ATOM-1528→V2-980-0514 | ARCH-EVT-001、ARCH-DATA-001、ARCH-REL-001 | RT10 | APPROVED 与 PUBLISH 命令分开；草稿不改旧在架；同步版本/水位/失败刷新可追，晚回调不改新版本 |
| M04 强制停用禁普通恢复 | BC-079、BC-088、BC-200；IC-042、IC-050 | FEAT-ADM-007→V2-980-0499；FEAT-ADM-005→V2-980-0497 | ARCH-IAM-002、ARCH-EVT-001 | RT10、RT11 | 强停须有效选择/填写原因，关联目标版本/command/主体/时间/审计并读回；无原因不提交，不用固定文案代决定；恢复另获准，不以普通上架清除，L9 写处置 Gate 仍关闭 |
| M05 合法不同旧版本回滚 | BC-080、BC-198；IC-042 | FEAT-ADM-005→V2-980-0497；PRD-ATOM-1528→V2-980-0514 | ARCH-DR-001、ARCH-REL-001 | RT10 | 仅已发布历史快照候选，权利/媒体/阶段/签核有效，无禁供；无候选不显示回滚；发布指针与审计另记 |
| M06 指标按数据/状态/时点定义 | BC-205；IC-044 | FEAT-ADM-009→V2-980-0501 | ARCH-DATA-001、ARCH-OBS-001 | RT10；PAGE-P1-ADMIN-DASHBOARD；INT-P1-018 | 在架/待审/待建档为存量；content/admin-ops 源事实、授权范围及更新时间分列；聚合不得跨域写表 |
| M07 媒体上传/送审资格 | BC-074、BC-207；IC-041、IC-045 | FEAT-ADM-005→V2-980-0497；PRD-ATOM-1520→V2-980-0506 | ARCH-IAM-002、ARCH-API-001 | RT10 | 真实媒体对象/校验/绑定回执决定资格；本机演示文件不等于 READY/CLEAN，内容覆盖 DEC-08 |
| M08 安全内容引用与旧 hash-only 工单 | BC-186、BC-187；IC-047 | FEAT-ADM-008→V2-980-0500；PRD-ATOM-1545→V2-980-0530 | ARCH-IAM-002、ARCH-REL-001 | RT11 | 当前 CLEAN 脱敏预览按角色安全读取；旧 hash-only 禁回复/关闭，只能升级/补正。升级须授权目标与原因，assignment/待接收/实际接收结果读回，未接收不算交接；不能越权改订单/成绩；新增采集差异见 DEC-06 |
| M09 财务/治理/权限与审计边界 | BC-174、BC-085、BC-093、BC-206、BC-208；IC-046、IC-048、IC-049、IC-050、IC-051 | 财务/后台来源：PRD-ATOM-1538→V2-980-0523；PRD-ATOM-1472→V2-980-0503；管理权限来源：ARCH-IAM-002 / PAGE-P1-ADMIN-PERMISSIONS（平台能力，不新增原子 ID） | ARCH-IAM-002、ARCH-OBS-001 | RT10、RT11、RT13；ACT-P1-FINANCE、ACT-P1-AUDITOR、ACT-P1-PLATFORM-ADMIN；PAGE-P1-ADMIN-PERMISSIONS | 退款两名独立审批人；管理 RBAC/ABAC 默认拒绝、资源/owner/阶段范围裁剪，权限只读。治理读写分 Gate，审计导出独立鉴权；原型无正式 IAM/PEP 不报安全验收 |

M09 的管理权限依据为[平台能力矩阵](../../../02-architecture/v2-platform-capability-matrix.md) ARCH-IAM-002 和[页面登记册](../phase1-business-operation/03-全端页面功能登记册.md) PAGE-P1-ADMIN-PERMISSIONS。原 PRD-ATOM-1701→V2-980-0394 是学习者设备/系统的通知、麦克风、存储授权，已从该管理权限映射移除；没有用它证明后台角色/资源授权，也没有补造需求原子或改变 980 范围数。

## 5. 待决差异与阶段边界

| 差异 | 来源冲突/限制 | 本轮处理 | 负责人/DEC 与关闭条件 |
|---|---|---|---|
| 简审一人可发 | 本包历史 BC-084 与上游后台 §3.6/3.7 四主体分离不同 | 正式沿用 canonical；简审只显示本机演示，不授正式资格 | 产品/架构/content，DEC-01/08：若申请例外须签变更单并同步上游角色/契约/验收，Agent 不代签 |
| 冻结学习编排/SM2/日期/报告 | 学习规则 §4.7/§6/§7.3/§9.4 与 D2 policy 已明确去重/排序、分 lane、10% cap、CATCH_UP、完整 SM2、IANA/DST、D1/D7 和 accepted 时长 | BC/IC/C4/U3 沿用，所有时长档到期优先；样例预估不冒充完整 canonical 引擎 | learning/assessment，DEC-07 仅新增跨批撤销权限/补偿命令/窗口、兼容与运行签收；既有 policy 不重新待选 |
| 草稿缓存/生日/新增补偿 | 本机字段或 undo 不能扩大正式采集或删除不可变事实 | 暂存/完整生日范围与新增补偿单独登记，既有 owner/键/算法继续生效 | IAM/隐私/learning/assessment，DEC-02/05/07；新增采集需明确决策，不能用“演示已有”代批准 |
| 客服安全引用与旧 hash-only | ADR-0014/后台 §6 已冻结 support owner、七类分类、状态/版本与安全内容引用；旧 hash-only 不是当前唯一设计 | C7/U5 区分 CLEAN 安全预览与缺信息旧单；升级目标/原因及真实接收结果可追，原文不进 ticket/event/log | admin-ops/隐私，DEC-06 仅新增采集/保留政策和真实发送/触达/恢复签收，不重新待批既有引用 |
| 隐私 owner/冷静期/撤回 | ADR-0014 与隐私生命周期 D2 已冻结 learner-service.privacy 导出、IAM 删除、168 小时冷静期、冷静期二次认证撤回、状态/receipt/grant；workflow 只编排 | C7/U5 及 BC-188…192/IC-105/106/108 沿用，部分失败不判完成，取消后读最新资格出口 | learner/IAM/各 owner/隐私，DEC-09 仅新增保留政策数值/例外、真实 workers/事件/Saga/回执和运行 GAP；不能重新选 owner 或冷静期 |
| 自动续费 | FEAT-COM-003→V2-980-0463 为非自动续费周期 SKU；本包 BC-172 是自动续费生命周期设计 | 演示订阅管理不变成正式自动扣款；默认正式非自动续费策略不改 | commerce/产品/财务，DEC-10：渠道、确认、撤销与票据签核后方可新增正式行为 |
| SKIPPED 快速计划 | FEAT-ONB-005→V2-980-0005 和上游学习规则 §3.1 已接受该路径 | 已纠正 BC-023“仅正式报告”；维持 UNVERIFIED/coverage=0/null 评分与等级 | DEC-03：仅剩本包兼容/实现/运行签核，不能重复要求批准已存在业务或伪造报告 |
| AI、语音、K12 | FEAT-AI2-001→V2-980-0681 属 Phase 2；FEAT-K12-001→V2-980-0869 属 Phase 3 | 静态页面只供设计审阅，未授予 Phase 1 默认路由 | DEC-01/11 及独立 K12 准入；Phase 1 RT 不能冒充这些能力的完整运行追溯 |
| 社交/成长/支付/完整离线 | 目录、样例分数、演示伙伴、本机订单或 PWA 不能证明真实事实/权益/同步 | 只保留原范围与阶段 Gate；不按屏数或演示 PASS 自动开放 | DEC-01/08/10/12 与对应服务 owner，完成契约、真实证据及发布签核 |

12 项 DEC 的角色签收仍见 [revision-notes §4](revision-notes.md#4-待确认决策清单)。本表没有代替产品、隐私、内容、财务或 QA 批准，也不修改 V2-980 范围数与正式实施台账。
