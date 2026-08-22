# Phase 2｜AI 成人学习与实时交互 UI/UX 详细设计（v1 历史草案）

> **状态：历史/迁移参考。** v2 Phase 2 的页面宿主、交互、Gate 和验收以 [`../v2-980plus/05-Phase2-AI成人高级能力功能设计.md`](../v2-980plus/05-Phase2-AI成人高级能力功能设计.md) 为准；本文件不能单独生成新任务或决定模型/RTC 供应商选型。  
>
> 历史设计状态：Phase 2 设计草案；仅在 AI 合规、成本、隐私、年龄、模型和 Feature Flag Gate 全部通过后开放。  
> 适用用户：18 岁以上成人/大学生。  
> 关联主设计：[AI 成人学习与 AI 服务详细设计](AI成人学习与AI服务详细设计.md)、[全局横向设计基线](../shared/全局横向设计基线.md)。
> v2 服务边界：所有 AI 页面经 `api-gateway` 进入；AI 会话由 `ai-orchestrator`/`realtime-voice` 承载，用户/租户/权益/权限由 IAM 和领域服务校验，客户端不得直连模型或 RTC 供应商。

## 1. 项目边界与页面宿主

Phase 2 不新建前端项目，继续使用四个冻结项目：

| 项目 | Phase 2 责任 | 禁止事项 |
|---|---|---|
| `apps/mobile` | uni-app 移动 H5、iOS、Android、iPad；实时语音和数字人按能力降级 | 不持有模型/RTC 密钥；不在客户端决定 AI 评分、权益或安全结论 |
| `apps/learner-web` | PC/平板/PWA 学习工作台；长文本、图谱和报告优先 | 不复制移动端业务；不绕过 Gateway/领域服务直连模型 |
| `apps/admin-web` | AI 开关、成本、抽检、投诉、来源、版权、提示词和评测管理 | 不把模型输出直接发布为课程；不越权查看原始录音/原文 |
| `apps/official-site` | AI 服务说明、模型/标识/隐私/价格/关闭状态公示 | 不承载登录后的 AI 会话或收集未授权训练数据 |

所有 AI 页面使用统一 `ai/*` 语义命名空间；关闭或不满足 Gate 时不注册默认导航和预取清单。用户从通知/官网进入受保护页面时，先保存目标，完成登录、年龄、同意和权益校验后再恢复。

## 2. Canonical 路由与页面状态

| 页面组 | Canonical route | 主要能力 | 状态/降级 |
|---|---|---|---|
| AI 入口与说明 | `ai/home`、`ai/about` | 能力目录、AI 标识、服务说明、可用额度、关闭原因 | `ST-C/O`；Gate 关闭显示解释页和规则化替代入口 |
| AI Tutor | `ai/tutor`、`ai/tutor/session/:id` | 问答、语法/词汇解释、追问、练习、总结 | `AI_CREATED/RUNNING/STREAMING/READY/DEGRADED/REJECTED/FAILED`；流式失败保留已持久化内容 |
| 长期记忆 | `ai/memory` | 查看、编辑、删除、关闭记忆和同意 | `ST-J`；未同意不展示“已记住”，删除后旧引用失效 |
| AI 学习路径 | `ai/plan`、`ai/plan/review/:id` | 周计划、推荐解释、调整、自动单元 | `ST-C/F`；推荐不可用回退规则计划，用户修改优先 |
| 句法 X-Ray | `ai/xray`、`ai/xray/result/:id` | 任意英文输入、主干/从句/修饰/词性/解释 | `ST-D/F`；Schema/安全/超时失败转预制句法示例或纯文本提示 |
| 弱点图谱 | `ai/weakness` | 错误、写作、对话、模考汇总的弱点视图 | `ST-F/G`；样本不足必须明确，不绘制伪精确结论 |
| AI 写作 | `ai/writing`、`ai/writing/result/:id` | 成人写作、CET/考研、SCI 辅助、版本对比 | `ST-E/F`；原文与 AI 结果分层保存，解析失败可查看原稿 |
| 语音与发音 | `ai/voice`、`ai/voice/session/:id` | ASR、音素/重音/流利度、TTS、语速/角色 | `ST-G`；麦克风、RTC、ASR/TTS 失败转录音回放/文字练习，不宣称官方评分 |
| 实时角色扮演 | `ai/roleplay`、`ai/roleplay/session/:id` | 咖啡店、酒店、机场、医院、租房、海关、银行、电话、面试、会议、客户沟通 | `RTC_CONNECTING/CONNECTED/BARGE_IN/RECONNECTING/ENDED`；HTTP 轮询不是替代实现 |
| 数字人 | `ai/digital-human` | Rive 状态、表情、动作、语音同步 | `ST-G`；Ultra/High/Medium/Performance 分级，Performance 使用静态/2D 头像 |
| 成人考试/学术 | `ai/exam`、`ai/academic` | CET、考研、雅思/托福、学术英语、趋势 | `ST-E/F`；只展示非官方反馈/估计，版权和来源可见 |
| 商务与出海 | `ai/business`、`ai/overseas` | 会议、谈判、邮件、术语、海外生活沙盒 | `ST-E/F`；不输出法律/医疗/金融确定性建议 |
| 辩论 | `ai/debate`、`ai/debate/session/:id` | 选题、正反方、回合、总结、语言/逻辑反馈 | `ST-E/F`；安全拦截、断线恢复和回合幂等 |
| RAG 知识库 | `ai/rag`、`ai/rag/source/:id` | 来源、版本、分块、检索、引用和撤回 | `ST-D/M`；无授权来源不可索引/回答，引用缺失不得伪造 |
| 成人社交升级 | `ai/community`、`ai/community/group/:id` | 好友、Friend Quest、赛季、受控 UGC | `ST-I/M`；自由文本默认关闭，开启需独立审核 Gate |
| 额度/隐私/反馈 | `ai/settings`、`ai/consent`、`ai/feedback` | 同意、额度、删除、投诉、重做/忽略结果 | `ST-J/K`；每次读取/删除/投诉可按 requestId 回放 |

## 3. FEAT 与 UI/UX 追溯

| 主功能 | PRD/设计范围 | 主要页面 | Gateway/目标服务数据事实 | 最小验收 |
|---|---|---|---|---|
| `FEAT-AI2-001` | §24 AI Tutor、长期路径的 Tutor 入口 | `ai/tutor`、`ai/plan` | `/api/v1/ai/sessions`、`ai_request`、`ai_result`、`learning_plan` | 目标上下文、提示词版本、结构化反馈、失败降级和用户采纳均可见 |
| `FEAT-AI2-002` | §24.2 长期学习记忆 | `ai/memory`、`ai/consent` | `/api/v1/ai/memory`、`ai_memory`、`consent_record` | 仅记录学习相关信息；查看/编辑/删除/关闭后不再注入上下文 |
| `FEAT-AI2-003` | §25 即时句法 X-Ray、弱点图谱 | `ai/xray`、`ai/weakness` | `/api/v1/ai/xray`、`syntax_analysis`、`weakness_projection` | 主干、从句、词性、解释、来源和 Schema 版本可回放；样本不足明确 |
| `FEAT-AI2-004` | §26 成人/CET/考研/SCI 写作 | `ai/writing`、`ai/exam`、`ai/academic` | `/api/v1/ai/writing`、`writing_attempt`、`ai_feedback` | 原文不丢失；反馈分层、AI 标识、非官方文案和安全拒答完整 |
| `FEAT-AI2-005` | §27 ASR、发音辅助、TTS | `ai/voice`、`ai/roleplay` | `/api/v1/ai/voice` + RTC 信令、`voice_session`、`media_asset` | 权限拒绝、断网、超时、重连、口音/速度设置和文字替代可操作 |
| `FEAT-AI2-006` | §31 商务会议、谈判、邮件、行业术语 | `ai/business`、`ai/roleplay` | `/api/v1/ai/scenarios`、`roleplay_session`、`scenario_version` | 角色、目标、回合、打断、总结和成本边界清晰，不替代真实业务建议 |
| `FEAT-AI2-007` | §33 雅思/托福四科、诊断、趋势 | `ai/exam`、`ai/voice`、`ai/writing` | `/api/v1/ai/exams`、`exam_session`、`ai_report` | 自研题/公开维度/非官方估计分层；不宣称真题、官方考官或官方成绩 |

未单列主 FEAT 的角色扮演、数字人、海外生活、辩论、RAG 和社交升级，分别落在 `SUBFEAT-AI2-*` 设计章节，不能因为使用同一页面宿主而丢失独立权限、成本、来源和验收。

## 4. 交互与安全规则

### 4.1 AI 结果卡

每个结果卡必须显示 `AI 生成/AI 辅助` 标识、目标课程、输入范围、`promptVersion`/`schemaVersion`（面向审计的详情入口）、置信/样本说明、重做、编辑、忽略、举报和删除入口。结果卡不允许把“建议”显示为“事实”“官方评分”或“保证正确”。

### 4.2 流式和实时会话

- 流式内容按增量块渲染，不触发全局 DOM 重排；每个 chunk 带序号，重复 chunk 不重复展示。
- RTC 会话显示连接、麦克风、AI 思考、对方说话、可打断、重连和结束状态；Barge-in 先取消当前输出，再写入可回放事件。
- 断线恢复使用 `sessionId + turnId + clientEventId`；无法恢复时保留文字/录音并提供重新开始，不伪造已完成回合。
- 录音、原文和模型输出分别受隐私开关控制；普通埋点只记录结果类型和耗时，不记录原始内容。

### 4.3 阶段和权限

未完成年龄/成人 Gate、AI 同意、内容版权、额度、模型安全和投诉路径时，页面只显示规则化能力或“暂不可用”说明。Phase 3/K12 页面和默认导航不从 Phase 2 路由推导出来。

## 5. 跨端验收

| 场景 | mobile/H5/iPad | learner Web | admin Web | 官网 |
|---|---|---|---|---|
| Tutor/写作/X-Ray/报告 | 可用；小屏分段卡片 | 可用；长文/图谱工作台 | 抽检、投诉、版本 | 只展示服务说明 |
| RTC/数字人 | 设备权限、Barge-in、低配降级 | 麦克风/耳机、重连、宽屏会话 | 质量/成本监控 | 不提供会话 |
| RAG/来源 | 引用卡、撤回提示 | 引用侧栏、版本对比 | 索引/版权/下线 | 公开来源政策 |
| 社交升级 | 受控互动 | 受控互动 | 审核/风控 | 不承载社交 |

所有核心路径覆盖正常、空、加载、错误、离线、权限拒绝、成本/额度用尽、内容撤回、模型超时、Schema 失败和性能降级；对应 Phase 2 验收以 `docs/06-design/phase-2/AI成人学习与AI服务详细设计.md` 第 20 节为准。
