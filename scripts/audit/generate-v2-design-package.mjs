import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requirementsDir = path.join(root, 'requirements');
const designDir = path.join(root, 'docs', '06-design');
const outDir = path.join(designDir, 'v2-980plus');
const matrixPath = path.join(requirementsDir, 'feature-matrix.md');
const prdPath = path.join(requirementsDir, 'product-requirements.md');
const atomicPath = path.join(designDir, 'traceability', '03-PRD原子需求候选清单.md');

const phaseOrder = ['Phase 1', 'Phase 2', 'Phase 3'];
const phaseTotals = { 'Phase 1': 540, 'Phase 2': 228, 'Phase 3': 212 };
const phaseShort = { 'Phase 1': 'P1', 'Phase 2': 'P2', 'Phase 3': 'P3' };
const refinementStatus = '待细化签收';
const domainOrder = [
  'ONB', 'VOC', 'GRM', 'LST', 'RDG', 'SPK', 'WRT', 'ASM', 'GAM', 'SOC', 'USR', 'INF', 'COM', 'ADM', 'AI2', 'K12',
];

const domains = {
  ONB: {
    name: '新手入学、自适应测评与语言世界地图',
    designDoc: '03-Phase1-学习闭环功能设计.md',
    route: 'onboarding/*；learn/home；learn/map；courses',
    platforms: 'apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）',
    intent: '让用户在最少决策成本下完成目标选择、定级、首周计划和断点恢复。',
    flow: '进入 → 选择目标/测评 → 保存草稿 → 生成计划 → 进入今日任务 → 断点恢复',
    action: '选择/测评 → 确认 → 生成或恢复学习计划',
    states: 'ST-B/ST-C；测评会话 CREATED/IN_PROGRESS/INTERRUPTED/COMPLETED；未解锁、无推荐和弱网必须可解释',
    contract: 'Gateway → learner-service + learning-service；usr_learning_profile、learning_plan、learning_session、content_version',
    permission: '公开内容可浏览；学习画像和计划仅本人可读写；阶段、内容版本和年龄 Gate 由服务端校验',
    event: 'onboarding.goal_selected.v1、onboarding.assessment_completed.v1、learning.plan_resumed.v1',
    acceptance: '首次进入可完成；中断可恢复；重复提交不重复建计划；地图锁定态、空推荐、加载、错误、离线和权限态均可回退到可学习路径。',
  },
  VOC: {
    name: '词汇、词根词缀、短语与 SRS 记忆引擎',
    designDoc: '03-Phase1-学习闭环功能设计.md',
    route: 'courses；practice/srs；practice/quick；practice/mastery；vocab/*',
    platforms: 'apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）',
    intent: '把内容浏览、主动回忆、信心度反馈、SRS 排程和 D+1/D+7 验证串成可回放的记忆闭环。',
    flow: '进入词书/生词本 → 查看词条 → 主动回忆/作答 → 选择信心度 → 即时反馈 → 写入 SRS → 到期复习',
    action: '浏览/筛选 → 作答或评定 → 提交 → 反馈 → 加入下一轮复习',
    states: 'ST-D/ST-E/ST-F；NEW/LEARNING/MASTERED/CONSOLIDATED；队列为空、内容版本失效、媒体失败、重复复习和离线恢复',
    contract: 'Gateway → content-service + learning-service；vocab_*、chunk、expression、lrn_srs_state、review_event、content_version',
    permission: '已发布内容可读；个人生词、掌握度和复习记录仅本人可读写；内容编辑权限不进入学习端。',
    event: 'vocab.item_viewed.v1、srs.review_submitted.v1、srs.schedule_rebuilt.v1、mastery.updated.v1',
    acceptance: '同一 Idempotency-Key 不重复记账；复习状态只由 VOC/SRS 事实源更新；断网先入有序队列，重连后按 clientSeq 合并。',
  },
  GRM: {
    name: '语法知识树、长难句 X 光机与弱点图谱',
    designDoc: '03-Phase1-学习闭环功能设计.md',
    route: 'courses/grammar；learn/session；grammar/*；reports/weakness',
    platforms: 'apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）',
    intent: '让用户从语法点、句子结构、错误原因和针对性练习之间形成可解释的学习路径。',
    flow: '选择知识点/句子 → 展开规则或 X 光结构 → 练习 → 查看规则反馈 → 记录弱点 → 再练习',
    action: '展开/定位 → 练习 → 提交 → 查看错因 → 进入修复任务',
    states: 'ST-D/ST-E/ST-F；知识树部分加载、DAG 解析失败、练习版本过期、无弱点、服务降级均需可解释',
    contract: 'Gateway → content-service + learning-service + assessment-service；grammar_point、sentence、syntax_dag、mastery_projection、attempt',
    permission: '学习者只读已发布规则和本人错因；教研编辑/审核在 admin-web 完成；X 光结构不改变原始题目事实。',
    event: 'grammar.point_opened.v1、syntax.xray_viewed.v1、grammar.practice_submitted.v1、weakness.repaired.v1',
    acceptance: '结构图加载失败时退化为线性句法；规则化反馈可离线展示；错因、掌握度和题目版本可回放。',
  },
  LST: {
    name: '精听、听力雷达、听写与视听短剧 Clips',
    designDoc: '03-Phase1-学习闭环功能设计.md',
    route: 'courses/listening；media；practice/listening；reports/listening',
    platforms: 'apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）',
    intent: '在媒体播放稳定的基础上，将泛听、精听、听写、字幕对照和结果复盘分层设计。',
    flow: '选择媒体 → 缓冲/播放 → A-B/慢速/字幕 → 听写或精听 → 提交 → 差异反馈 → 复听/复习',
    action: '播放/定位 → 输入或选择 → 提交 → 比对反馈 → 复听或加入任务',
    states: 'ST-D/ST-E/ST-G；BUFFERING/PLAYING/PAUSED/ENDED；媒体失败、字幕缺失、下载失败和耳机/系统权限需降级',
    contract: 'Gateway → content-service + media-service + learning-service + assessment-service；媒体/版权归 content+media，播放进度归 learning，听写 attempt/判分归 assessment，均绑定 content_version',
    permission: '媒体权利、下载权限和设备音频权限由服务端与端侧共同校验；原始录音不进入普通日志。',
    event: 'media.started.v1、media.segment_completed.v1、listening.dictation_submitted.v1、media.downloaded.v1',
    acceptance: '弱网可暂停并恢复；字幕/音频不可用时提供文本或练习替代；播放进度和听写结果不得重复提交。',
  },
  RDG: {
    name: '分级阅读、沉浸阅读器与故事模式',
    designDoc: '03-Phase1-学习闭环功能设计.md',
    route: 'courses/reading；reader/*；practice/reading；reports/reading',
    platforms: 'apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）',
    intent: '让阅读内容、查词、收藏、分支、阅读进度和理解测验在一个连续阅读空间完成。',
    flow: '筛选分级内容 → 打开阅读器 → 阅读/查词/收藏 → 分支或段落测验 → 保存进度 → 完成复盘',
    action: '筛选/打开 → 阅读和辅助操作 → 保存 → 测验 → 查看理解反馈',
    states: 'ST-D/ST-E/ST-F；内容下线、分支非法、进度冲突、查词失败、无推荐和离线阅读必须可恢复',
    contract: 'Gateway → content-service + learning-service + assessment-service；内容/分支归 content，阅读进度/批注归 learning，阅读测验 attempt/判分归 assessment，均绑定 content_version',
    permission: '已发布且有权利的内容可读；个人批注/收藏仅本人可见；编辑端不复用学习端阅读权限。',
    event: 'reading.opened.v1、reading.progress_saved.v1、reading.lookup_used.v1、reading.quiz_submitted.v1',
    acceptance: '滚动和分页均不丢失进度；版本变化提示用户选择迁移或重新开始；错误态保留已保存的最后进度。',
  },
  SPK: {
    name: '48 国际音标、跟读、Shadowing 影子跟读',
    designDoc: '03-Phase1-学习闭环功能设计.md',
    route: 'courses/speaking；phonetics；recording；practice/shadowing',
    platforms: 'apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）',
    intent: '提供规则化口语自练、录音回放和音标学习，不把 Phase 1 的规则反馈包装成 AI 评分。',
    flow: '查看示范 → 申请麦克风 → 录音 → 本地回放/重录 → 保存或上传 → 脚本化反馈 → 再练习',
    action: '录音 → 回放/重录 → 保存 → 复练',
    states: 'ST-E/ST-G；MIC_PERMISSION_DENIED/RECORDING/UPLOADING/LOCAL_ONLY/FAILED；无麦克风时提供静音跟读替代',
    contract: 'Gateway → content-service + media-service + assessment-service；recording_asset、phoneme_lesson、shadowing_session、content_version',
    permission: '设备麦克风权限在用户主动点击后申请；录音归属本人；Phase 1 不调用 ASR、AI 评分或数字人。',
    event: 'speaking.permission_requested.v1、recording.started.v1、recording.saved.v1、shadowing.completed.v1',
    acceptance: '拒绝麦克风仍可学习；录音上传失败可保留本地副本并允许重试；任何结果都能关联内容版本和会话。',
  },
  WRT: {
    name: '汉译英、模板仿写、病句改错与素材库',
    designDoc: '03-Phase1-学习闭环功能设计.md',
    route: 'courses/writing；practice/writing；reports/writing；writing/*',
    platforms: 'apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）',
    intent: '以规则、模板、对照和可回放草稿为核心，支持写作提交、修订和复盘。',
    flow: '选择题型/素材 → 编辑草稿 → 本地自动保存 → 提交 → 规则/对照反馈 → 修订 → 留存版本',
    action: '输入/选择模板 → 保存草稿 → 提交 → 查看反馈 → 修订或重做',
    states: 'ST-D/ST-E/ST-F；DRAFT/SUBMITTING/FEEDBACK_READY/RETRY_REQUIRED；草稿冲突、内容下线和保存失败可恢复',
    contract: 'Gateway → content-service + assessment-service + learning-service；writing_prompt、writing_attempt、writing_feedback_rule、draft_revision、content_version',
    permission: '草稿和练习记录仅本人可读；公开素材按 contentVersionId 和权利状态控制；Phase 1 不提供生成式改写。',
    event: 'writing.draft_saved.v1、writing.submitted.v1、writing.feedback_viewed.v1、writing.revised.v1',
    acceptance: '输入过程中不因网络抖动丢稿；提交按幂等键去重；反馈必须标出规则依据和原文位置。',
  },
  ASM: {
    name: '做题中心、四六级/考研模考与掌握度闭环',
    designDoc: '03-Phase1-学习闭环功能设计.md',
    route: 'practice/home；practice/session；checkpoint；exam/*；reports/*',
    platforms: 'apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）',
    intent: '统一承载题队、练习会话、自动保存、提交、错题验证、D+1/D+7 和报告复盘。',
    flow: '选练习/模考 → 创建会话 → 作答/自动保存 → 暂停/恢复 → 提交 → 结果和错因 → 延迟验证 → 报告',
    action: '开题 → 作答 → 自动保存 → 提交 → 查看结果 → 进入修复/复习',
    states: 'ST-E/ST-F；CREATED/IN_PROGRESS/INTERRUPTED/SUBMITTING/COMPLETED/AUTO_SUBMITTED/CANCELLED/EXPIRED',
    contract: 'Gateway → content-service + assessment-service + learning-service；题目/答案规则版本归 content，attempt/checkpoint/判分/report 快照归 assessment，mastery_projection/复习调度归 learning',
    permission: '练习和结果仅本人可写读；模考/报告受内容版本和权益控制；管理端只读脱敏结果或经过授权的审计数据。',
    event: 'assessment.started.v1、attempt.saved.v1、assessment.submitted.v1、mastery.verification_due.v1、report.generated.v1',
    acceptance: '断点恢复不丢作答；超时自动提交可追溯；重复提交不重算奖励/掌握度；报告能回到题目和错因。',
  },
  GAM: {
    name: '游戏化数值、六大游戏、3D 衣柜与奖励箱',
    designDoc: '04-Phase1-成长社群商业后台功能设计.md',
    route: 'world；games/*；avatar；reward；collection；streak',
    platforms: 'apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）',
    intent: '把学习结果转成可审计的 XP、星币、连续学习、成长资产和非现金奖励，不破坏学习闭环。',
    flow: '进入世界/游戏 → 选择玩法 → 完成学习相关动作 → 结算 → 查看流水 → 领取/装备 → 回到学习任务',
    action: '进入 → 选择 → 开始 → 结算 → 领取/回放',
    states: 'ST-H；结算中、资产缺失、奖励待确认、离线不发奖、性能降级和幂等补偿',
    contract: 'Gateway → gamification-service；xp_ledger、coin_ledger、streak、avatar、reward_chest、game_session',
    permission: '学习结果驱动奖励；客户端不能直接记账；奖励概率、兑换和库存均受服务端规则、审计和阶段 Gate 控制。',
    event: 'gamification.session_started.v1、xp.ledger_posted.v1、reward.granted.v1、avatar.equipped.v1',
    acceptance: '重复事件不重复发奖；断网不产生伪奖励；低配设备可退到 2.5D/静态切片；无现金随机抽奖和学习无关变现。',
  },
  SOC: {
    name: '虚拟自习室、排行榜与受控低 UGC 社区',
    designDoc: '04-Phase1-成长社群商业后台功能设计.md',
    route: 'world/study-room；leaderboard；feed；social/*',
    platforms: 'apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）',
    intent: '提供低审核成本的陪伴和成就反馈，控制互动边界，不引入陌生人私聊和开放发帖。',
    flow: '浏览房间/榜单 → 加入或占座 → 专注/预设互动 → 结束 → 结算学习时长 → 查看榜单',
    action: '浏览 → 加入/占座 → 专注/互动 → 退出 → 查看结果',
    states: 'ST-I/ST-H；座位租约、WS 断连、匿名、空房、成员受限、榜单延迟和离线补偿',
    contract: 'Gateway → social-service；study_room、seat_lease、leaderboard_snapshot、preset_interaction、presence_event',
    permission: '互动使用预设动作或审核词库；房间和榜单按隐私设置脱敏；客服和风控仅按授权范围处理。',
    event: 'study_room.joined.v1、study_room.focus_started.v1、study_room.left.v1、leaderboard.refreshed.v1',
    acceptance: '租约过期可恢复或重新入座；WS 断连不丢学习时长；空房和受限互动提供可学习替代入口。',
  },
  USR: {
    name: '用户画像、多端认证、设备管理与个人中心',
    designDoc: '04-Phase1-成长社群商业后台功能设计.md',
    route: 'auth/*；onboarding；me；settings；privacy；devices',
    platforms: 'apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）+ apps/official-site（登录入口）',
    intent: '保障身份、设备、偏好、个人中心、隐私和注销流程一致，并让多端恢复可解释。',
    flow: '登录/注册 → 验证 → 建立会话 → 管理设备/偏好 → 读取个人中心 → 修改/注销 → 审计和恢复',
    action: '输入/验证 → 确认 → 更新 → 二次确认或进入冷静期',
    states: 'ST-A/ST-J；SESSION_CREATED/REFRESHING/REVOKED；设备冲突、风险验证、注销冷静期、隐私拒绝和恢复',
    contract: 'Gateway → iam-service + learner-service；user、device、preference、user_learning_profile、account_deletion、privacy_request',
    permission: '默认拒绝；身份、设备、隐私和注销以服务端主体为准；客户端不得提交 userId、tenantId、ownerId 覆盖认证上下文。',
    event: 'auth.signed_in.v1、device.registered.v1、preference.updated.v1、account.deletion_requested.v1',
    acceptance: 'token 刷新最多一次静默重试；敏感操作二次确认；注销可撤回且最终匿名化有任务和审计证据。',
  },
  INF: {
    name: '统一通知、离线同步、弱网异常与全局基础',
    designDoc: '04-Phase1-成长社群商业后台功能设计.md',
    route: 'messages；sync；download；support；status；settings/notifications',
    platforms: 'apps/mobile + apps/learner-web 承载消息、同步、下载和客服；apps/admin-web 承载运营通知；apps/official-site 仅承载公开状态、下载和合规入口，不承载登录后同步或消息',
    intent: '把通知、下载、离线包、同步冲突、客服和全局异常变成每个功能都能复用的基础体验。',
    flow: '触发任务/通知 → 排队/下载/同步 → 展示进度 → 成功或冲突 → 恢复/重试 → 写入审计和埋点',
    action: '查看 → 操作 → 排队 → 同步/恢复',
    states: 'ST-J/ST-K；QUEUED/RUNNING/SUCCEEDED/CONFLICT/FAILED/CANCELLED；网络、空间、版本和权限错误分别呈现',
    contract: 'Gateway → notification-service + media-service + workflow-service；message、offline_package、sync_event、support_ticket、device_capability',
    permission: '通知、文件、相册和客服数据按设备权限、用户同意、租户和角色隔离；敏感原文不得进普通日志。',
    event: 'notification.delivered.v1、sync.enqueued.v1、sync.conflict_detected.v1、support.ticket_created.v1',
    acceptance: '网络超时不直接判定业务失败；同步按 clientEventId/clientSeq 去重；冲突可解释且不静默覆盖本地学习事实。',
  },
  COM: {
    name: '商业化会员、统一收银台与家庭组共享',
    designDoc: '04-Phase1-成长社群商业后台功能设计.md',
    route: 'commerce/*；me/membership；orders；official-site/pricing',
    platforms: 'apps/mobile + apps/learner-web + apps/official-site；收银和回调由 commerce-service 统一拥有',
    intent: '把 SKU、订单、支付回调、权益、退款和家庭组放在可审计的商业链路中，避免前端自行判断权益。',
    flow: '浏览方案 → 选择 SKU → 创建订单 → 支付/回调 → 权益激活 → 使用 → 到期/退款/降级',
    action: '查看 → 选择 → 下单 → 回调确认 → 查看权益/退款',
    states: 'ST-L/ST-J；PENDING/ACTIVE/GRACE/EXPIRED/REVOKED；支付等待、重复回调、退款和权益延迟可追溯',
    contract: 'Gateway → commerce-service；sku、order、payment_callback、entitlement、household、refund、audit_log',
    permission: '订单与权益按主体隔离；财务、客服、审计为独立 scope；真实微信/支付宝/Apple 收单在 Phase 1 默认关闭，需资质和沙盒证据。',
    event: 'order.created.v1、payment.callback_received.v1、entitlement.activated.v1、refund.completed.v1',
    acceptance: '支付回调按供应商事件号/JWS 去重；前端不展示未确认权益；退款和到期降级为不可变流水并可回放。',
  },
  ADM: {
    name: '教研 CMS、双审流、运营中台与风控合规',
    designDoc: '04-Phase1-成长社群商业后台功能设计.md',
    route: 'admin/dashboard；content/*；review/*；ops/*；risk/*；audit/*',
    platforms: 'apps/admin-web（Vue 3 + Element Plus）；学习端只消费已发布内容',
    intent: '让内容、版本、媒体、审核、运营、风控、客服、财务和审计拥有明确的职责边界。',
    flow: '检索 → 编辑草稿 → 校验 → 提交一审 → 二审 → 发布/定时发布 → 监控 → 回滚/归档',
    action: '检索 → 编辑 → 提交 → 双审 → 发布/回滚',
    states: 'ST-M/ST-N；DRAFT/IN_REVIEW/APPROVED/PUBLISHED/ARCHIVED；REJECTED、ROLLBACK_PENDING 作为动作结果表达',
    contract: 'Gateway → admin-ops-service + content-service + commerce-service + analytics-service；content_version、review_task、audit_log、feature_flag、risk_case、export_job、media_asset',
    permission: '默认拒绝；content-editor、review L1、review L2、finance、auditor、客服等为独立 scope；作者不能审自己的版本。',
    event: 'content.submitted.v1、content.reviewed.v1、content.published.v1、content.rolled_back.v1、audit.exported.v1',
    acceptance: '双审职责分离；发布/下线/导出/风控/退款均审计；异步任务可查询；租户隔离和脱敏导出可证明。',
  },
  AI2: {
    name: 'Phase 2 AI 伴学导师、实时语音与出国专项',
    designDoc: '05-Phase2-AI成人高级能力功能设计.md',
    route: 'ai/*；voice/*；roleplay/*；exam/ielts；business/*；overseas/*；ai-governance/*',
    platforms: 'apps/mobile + apps/learner-web；必要时 apps/admin-web 管理提示词、成本、风控和回放',
    intent: '在 Phase 2 Gate 通过后，将 AI 生成、实时 RTC、结构化评测和成人专项能力接入学习闭环。',
    flow: '用户输入/授权 → 前置敏感拦截 → AI 请求 → 流式/RTC 交互 → 后置合规核验 → Schema 校验 → 保存结果 → 采纳/重做/降级',
    action: '输入 → 安全预检 → 流式/实时交互 → 结构化反馈 → 采纳/重做/降级',
    states: 'AI request CREATED→PRECHECKED→RUNNING→POSTCHECK→PERSISTED→DELIVERED；CANCELLED、TIMEOUT、DEGRADED 可回放',
    contract: 'Gateway → ai-orchestrator + assessment-service + learning-service；ai_request、ai_result、prompt_version、consent、cost_ledger、safety_review',
    permission: '成人、地区、同意、成本预算和功能 Gate 全部通过才可用；AI 结果必须有 schema、版本、来源、免责声明、超时降级和审计。',
    event: 'ai.request_created.v1、ai.precheck_blocked.v1、ai.result_persisted.v1、rtc.session_ended.v1、ai.degraded.v1',
    acceptance: '无生成式 AI 的 Phase 1 页面不会出现 AI CTA；AI 超时退回规则化学习路径；实时 RTC 失败不能伪造评测结果；敏感输入和原始音频分级存储。',
  },
  K12: {
    name: 'Phase 3 中小学教材同步、中高考与防沉迷',
    designDoc: '06-Phase3-K12合规与教师机构功能设计.md',
    route: 'k12/*；parent/*；teacher/*；org/*；textbook/*；exam/high-school；safety/*',
    platforms: 'apps/mobile + apps/learner-web + apps/admin-web；按未成年人、监护人、教师和机构主体分层',
    intent: '在资质、版权、分类鉴别、监护授权和专项合规完成后，提供隔离的 K12 学习与教务能力。',
    flow: '阶段 Gate → 主体识别 → 监护/机构授权 → 内容权利校验 → 学习/管理 → 防沉迷与隐私控制 → 审计/撤回',
    action: 'Gate → 授权 → 学习/管理 → 受限状态或审计回放',
    states: 'K12 gate + 主体/监护/版权/资质状态机；默认关闭；PENDING/APPROVED/REVOKED/EXPIRED/RESTRICTED',
    contract: 'Gateway → guardian-service + institution-service + curriculum-rights-service；minor_account、guardian_consent、content_rights、textbook_unit、class_report、privacy_request、safety_event',
    permission: '未成年人、监护人、教师、机构和平台管理员主体分离；最小化采集；版权和地区范围先于内容展示；撤回后不可继续使用受限内容。',
    event: 'k12.gate_evaluated.v1、guardian.consent_recorded.v1、content_rights.checked.v1、safety.restricted.v1',
    acceptance: 'Gate 未通过时默认关闭且有解释；家长撤回、版权失效、防沉迷限制和隐私请求均可回放；租户和主体数据绝不串读。',
  },
  CROSS: {
    name: '跨域交互、发布治理与体验一致性扩展单元',
    designDoc: '07-跨域契约数据事件与验收设计.md',
    route: '四项目共享宿主、发布/合规/非功能基线和跨域深链',
    platforms: 'apps/mobile、apps/learner-web、apps/admin-web、apps/official-site',
    intent: '承接矩阵顶部总数与业务域明细之间的 50 个差额，显式设计跨域入口、状态、观测和验收；它们属于 v2 范围，但在细化签收前不冒充可实施功能。',
    flow: '跨域入口 → 认证/阶段/权限预检 → 调用事实源 → 显示统一状态 → 事件/outbox → 深链返回或恢复',
    action: '请求 → 鉴权/校验 → 执行业务 → 事件/outbox → 可回放恢复',
    states: '共享成功/空/加载/错误/离线/权限/恢复八态；requestId/traceId/clientEventId/Idempotency-Key 贯通',
    contract: '共享 API envelope、OpenAPI、事件、RBAC、contentVersionId、AdaptivePerformanceEngine 和跨项目深链约定',
    permission: '跨域只读事实源；不复制主体和领域主状态；任何扩大范围的设计先进入产品确认或 ADR。',
    event: 'cross.deep_link_opened.v1、cross.gate_blocked.v1、cross.recovery_completed.v1、cross.design_unit_reviewed.v1',
    acceptance: '每个跨域单元都有来源和待决状态；不能用重复页面或重复状态冒充新功能；全端、弱网、权限、性能和回滚证据齐全。',
  },
};

function clean(value) {
  return String(value ?? '')
    .replaceAll('**', '')
    .replaceAll('`', '')
    .replaceAll('<br>', ' / ')
    .replaceAll(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function cell(value) {
  return clean(value).replaceAll('|', '\\|').replaceAll('\r', '').replaceAll('\n', ' ');
}

function uncell(value) {
  return String(value ?? '').replaceAll('\\|', '|').trim();
}

function splitCells(line) {
  return line.split('|').slice(1, -1).map((item) => uncell(item));
}

function phaseFrom(value) {
  const text = clean(value);
  if (/Phase\s*1/i.test(text)) return 'Phase 1';
  if (/Phase\s*2/i.test(text)) return 'Phase 2';
  if (/Phase\s*3/i.test(text)) return 'Phase 3';
  return '跨阶段/治理';
}

function norm(value) {
  return clean(value).toLowerCase().replaceAll(/[^a-z0-9\u4e00-\u9fff]+/gi, '');
}

function parseMatrix() {
  const text = fs.readFileSync(matrixPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const summary = [];
  const explicit = [];
  for (const line of lines) {
    const summaryMatch = line.match(/^\|\s*\*\*(ONB|VOC|GRM|LST|RDG|SPK|WRT|ASM|GAM|SOC|USR|INF|COM|ADM|AI2|K12)\*\*\s*\|([^|]+)\|([^|]+)\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)/);
    if (summaryMatch) {
      summary.push({
        domain: summaryMatch[1],
        p1: Number(summaryMatch[4]),
        p2: Number(summaryMatch[5]),
        p3: Number(summaryMatch[6]),
        total: Number(summaryMatch[7]),
        name: clean(summaryMatch[2]),
        prd: clean(summaryMatch[3]),
      });
      continue;
    }
    if (/^\|\s*\*\*FEAT-[A-Z0-9]+-\d{3}\*\*/.test(line)) {
      const parts = splitCells(line);
      const id = clean(parts[0]);
      explicit.push({
        id,
        domain: id.match(/^FEAT-([A-Z0-9]+)-/)?.[1] ?? 'CROSS',
        category: clean(parts[1]),
        name: clean(parts[2]),
        detail: clean(parts[3]),
        platforms: clean(parts[4]),
        phase: phaseFrom(parts[5]),
        priority: clean(parts[5]),
        prd: clean(parts[6]),
        sourceType: '显式功能矩阵',
      });
    }
  }
  return { summary, explicit };
}

function parseAtomicInventory() {
  const text = fs.readFileSync(atomicPath, 'utf8');
  return text.split(/\r?\n/)
    .filter((line) => /^\|\s*PRD-ATOM-\d+\s*\|/.test(line))
    .map((line) => {
      const parts = splitCells(line);
      return {
        id: clean(parts[0]),
        line: clean(parts[1]),
        phase: clean(parts[2]),
        domain: clean(parts[3]) || 'CROSS',
        kind: clean(parts[4]),
        section: clean(parts[5]),
        source: clean(parts[6]),
        anchor: clean(parts[7]),
        design: clean(parts[8]),
        status: clean(parts[9]),
        sourceType: 'PRD 原子证据',
      };
    });
}

function priorityOf(item) {
  const kindRank = { functional: 0, dimension: 1, 'table-fact': 2, governance: 3 };
  return kindRank[item.kind] ?? 9;
}

function routeFor(domain) {
  return domains[domain]?.route ?? domains.CROSS.route;
}

function docFor(domain) {
  return domains[domain]?.designDoc ?? domains.CROSS.designDoc;
}

function buildUnits(matrix, atoms) {
  const summaryByDomain = new Map(matrix.summary.map((item) => [item.domain, item]));
  const explicitByKey = new Map();
  for (const feature of matrix.explicit) {
    const key = `${feature.phase}|${feature.domain}`;
    if (!explicitByKey.has(key)) explicitByKey.set(key, []);
    explicitByKey.get(key).push(feature);
  }
  const atomsByKey = new Map();
  for (const atom of atoms) {
    if (!phaseOrder.includes(atom.phase)) continue;
    const domain = domains[atom.domain] ? atom.domain : 'CROSS';
    const key = `${atom.phase}|${domain}`;
    if (!atomsByKey.has(key)) atomsByKey.set(key, []);
    atomsByKey.get(key).push(atom);
  }
  for (const list of atomsByKey.values()) list.sort((a, b) => priorityOf(a) - priorityOf(b) || Number(a.line) - Number(b.line));

  const units = [];
  const warnings = [];
  for (const phase of phaseOrder) {
    for (const domain of domainOrder) {
      const summary = summaryByDomain.get(domain);
      const target = summary ? Number(summary[phaseShort[phase].toLowerCase()]) : 0;
      if (!target) continue;
      const key = `${phase}|${domain}`;
      const used = new Set();
      const features = explicitByKey.get(key) ?? [];
      const pool = atomsByKey.get(key) ?? [];
      for (const feature of features.slice(0, target)) {
        units.push({ phase, domain, sourceId: feature.id, sourceType: feature.sourceType, sourceText: feature.name, detail: feature.detail, sourceAnchor: feature.prd, category: feature.category, status: '显式功能包已设计' });
        used.add(norm(`${feature.name} ${feature.detail}`));
      }
      let atomIndex = 0;
      while (units.filter((unit) => unit.phase === phase && unit.domain === domain).length < target && atomIndex < pool.length) {
        const atom = pool[atomIndex++];
        const sourceKey = norm(atom.source);
        if (!sourceKey || used.has(sourceKey)) continue;
        units.push({ phase, domain, sourceId: atom.id, sourceType: atom.sourceType, sourceText: atom.source, detail: atom.section, sourceAnchor: `requirements/product-requirements.md:${atom.line}`, category: atom.kind, status: 'PRD 原子证据已映射' });
        used.add(sourceKey);
      }
      let extIndex = 1;
      while (units.filter((unit) => unit.phase === phase && unit.domain === domain).length < target) {
        const slot = `V2-EXT-${phaseShort[phase]}-${domain}-${String(extIndex).padStart(3, '0')}`;
        units.push({
          phase,
          domain,
          sourceId: slot,
          sourceType: '矩阵分期槽位',
          sourceText: `${domains[domain].name}扩展设计槽位 ${String(extIndex).padStart(3, '0')}`,
          detail: `feature-matrix.md ${domain} ${phase} 目标为 ${target}，当前可直接映射证据不足；本行只作为设计占位，不视为已确认产品功能。`,
          sourceAnchor: `requirements/feature-matrix.md：${domain} / ${phase} 汇总行`,
          category: refinementStatus,
          status: refinementStatus,
        });
        extIndex += 1;
      }
      const actual = units.filter((unit) => unit.phase === phase && unit.domain === domain).length;
      if (actual !== target) warnings.push(`${phase}/${domain} 目标 ${target}，实际 ${actual}`);
    }
  }

  const gapByPhase = { 'Phase 1': 0, 'Phase 2': 20, 'Phase 3': 30 };
  for (const phase of phaseOrder) {
    for (let index = 1; index <= gapByPhase[phase]; index += 1) {
      units.push({
        phase,
        domain: 'CROSS',
        sourceId: `V2-EXT-${phaseShort[phase]}-TOTAL-${String(index).padStart(3, '0')}`,
        sourceType: '矩阵顶部总计差额',
        sourceText: `顶部总计与业务域明细差额的跨域扩展单元 ${String(index).padStart(3, '0')}`,
        detail: `feature-matrix.md 顶部 ${phase} 总计为 ${phaseTotals[phase]}，各业务域明细合计与其存在差额；本行用于深链、状态、事件、验收或待确认的跨域设计，不冒充具体业务功能。`,
        sourceAnchor: `requirements/feature-matrix.md：顶部 ${phase} 总计与各域汇总算术差额`,
        category: refinementStatus,
        status: refinementStatus,
      });
    }
  }
  return { units, warnings, matrixSummary: summaryByDomain };
}

function unitName(unit) {
  return unit.sourceText.length > 96 ? `${unit.sourceText.slice(0, 93)}...` : unit.sourceText;
}

function isPhaseOneAdultGate(unit) {
  return unit.phase === 'Phase 1'
    && unit.domain === 'USR'
    && /Phase 1 禁止/.test(unit.sourceText);
}

function presentationFor(unit, meta) {
  if (!isPhaseOneAdultGate(unit)) return meta;
  return {
    ...meta,
    route: 'auth/register；onboarding（年龄 Gate 拒绝页）',
    platforms: 'apps/mobile + apps/learner-web；apps/official-site 仅提供统一登录入口，不创建儿童/家长主体',
    action: '提交成人年龄/生日 → IAM 服务端判定 → 成人继续注册；未成年人拒绝并说明 Phase 3 尚未开放',
    flow: '输入最小化年龄信息 → 服务端年龄 Gate → 记录最小化审计 → 成人创建会话或未成年人拒绝 → 安全退出',
    states: 'ST-A；AGE_INPUT/AGE_VERIFIED/AGE_REJECTED/RETRY_REQUIRED；拒绝态不创建儿童、家长、监护或未成年人支付事实',
    contract: 'Gateway → iam-service；registration_age_gate、age_gate_decision、session、audit_log；拒绝态不创建 minor_account 或 guardian_consent',
    permission: '年龄 Gate 和主体类型仅由 IAM 服务端判定；最小化采集，不接受客户端年龄/tenant/owner 覆盖；拒绝默认关闭且不泄露敏感策略细节。',
    event: 'auth.age_gate_evaluated.v1、auth.age_gate_blocked.v1',
    acceptance: 'Phase 1 不创建儿童账号、家长账号、监护绑定、未成年人支付或 K12 学习目标；拒绝结果可解释、可审计且不能通过修改客户端字段绕过。',
  };
}

function designRow(unit, index) {
  const meta = domains[unit.domain] ?? domains.CROSS;
  const presentation = presentationFor(unit, meta);
  const id = `V2-980-${String(index).padStart(4, '0')}`;
  const status = unit.status === refinementStatus ? refinementStatus : unit.status;
  const designAnchor = `v2-980plus/${presentation.designDoc}；v2-980plus/01-统一交互与页面状态设计.md#${unit.domain.toLowerCase()}-设计模板`;
  return {
    ...unit,
    id,
    name: unitName(unit),
    designDoc: presentation.designDoc,
    route: presentation.route,
    platforms: presentation.platforms,
    interaction: `${presentation.action}；本单元聚焦“${unitName(unit)}”，成功后回到 ${unit.domain === 'ASM' ? '练习/报告' : '学习闭环'}。`,
    normalFlow: presentation.flow,
    states: presentation.states,
    contract: presentation.contract,
    permission: presentation.permission,
    event: presentation.event,
    acceptance: presentation.acceptance,
    designAnchor,
    review: status === refinementStatus ? '不得进入实现排期；需补齐 v2 单元正式名称、来源映射、独立验收口径和 owner 后再签收。' : '可进入逐条设计评审；实现仍需 contracts、migration、测试和跨端 DoD。',
  };
}

function mdTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => cell(column.value(row))).join(' | ')} |`).join('\n');
  return `${header}\n${divider}\n${body}`;
}

function write(name, contents) {
  fs.writeFileSync(path.join(outDir, name), `${contents.trim()}\n`, 'utf8');
}

function countsBy(items, key) {
  const result = {};
  for (const item of items) result[item[key]] = (result[item[key]] ?? 0) + 1;
  return result;
}

function generateReadme(units, atoms, matrix, warnings) {
  const statusCounts = countsBy(units, 'status');
  const phaseCounts = countsBy(units, 'phase');
  return `# 980+ 全量功能设计 v2

> 版本：v2.2 架构绑定与一致性审核版  
> 生成器：scripts/audit/generate-v2-design-package.mjs  
> 设计状态：v2 全量范围已冻结；其中缺少独立名称/验收的单元须完成细化签收后才能进入实现排期。

> 架构基线：[v2 微服务技术架构](../../02-architecture/v2-microservices-architecture.md)；[平台能力矩阵](../../02-architecture/v2-platform-capability-matrix.md)；[架构映射与任务重基线](11-架构映射与任务重基线.md)；[B7+ 代码任务基线](../../../requirements/backlog/v2-B7plus-代码重塑与交互测试任务基线.md)。本目录的契约、数据、权限、事件和验收设计均服从这些文档。

## 1. 这是一套独立的新版本

\`v2-980plus/\` 是下一轮开发的**唯一全量业务设计与需求落地基线**。\`requirements/\` 保留产品证据、编号和法规边界；当它与本目录的 v2 业务范围、交互、阶段或验收发生冲突时，先修正 v2 变更记录与追溯台账，不能回退到 v1 详细设计。既有 \`detailed-specs/\`、\`phase-*\` 设计包和 B0–B6 只保留历史、迁移和术语对照价值，不再作为新任务的需求事实源。

新版本的设计对象是 design unit，不把一个页面状态、一个按钮或一条 API 机械地算成业务功能。显式 FEAT-* 继续作为功能包主键；PRD-ATOM-* 是需求证据主键；V2-EXT-* 是已登记在 v2 范围内、但尚未细化到独立名称和验收的透明单元。它们不回退到 v1，也不得在细化签收前被当成可实施功能。

## 2. 可验证的数量口径

| 口径 | 数量 | 说明 |
|---|---:|---|
| 矩阵顶部目标 | 980 | Phase 1 540、Phase 2 228、Phase 3 212 |
| 各业务域汇总 | 930 | 16 个业务域的分期数字相加 |
| 本版设计单元 | ${units.length} | 930 个业务域单元 + 50 个跨域扩展单元 |
| PRD 原子候选证据 | ${atoms.length} | 来自既有追溯清单，不等于功能数量 |
| 显式 FEAT 功能包 | ${matrix.explicit.length} | 继续复用既有编号，不重新造 ID |

${mdTable(phaseOrder.map((phase) => ({ phase, target: phaseTotals[phase], actual: phaseCounts[phase] ?? 0 })), [
  { label: '阶段', value: (row) => row.phase },
  { label: '顶部目标', value: (row) => row.target },
  { label: '本版单元', value: (row) => row.actual },
  { label: '设计边界', value: (row) => row.phase === 'Phase 1' ? '成人/大学生；规则化学习；无生成式 AI' : row.phase === 'Phase 2' ? '成人 AI；通过 Gate 后启用' : 'K12；资质、版权和未成年人合规后启用' },
])}

状态分布：${Object.entries(statusCounts).map(([key, value]) => `${key} ${value}`).join('；')}。

## 3. 文档导航

1. [00-版本基线与980+计数口径](00-版本基线与980+计数口径.md)：事实源、数量冲突、设计单元和升格规则。
2. [01-统一交互与页面状态设计](01-统一交互与页面状态设计.md)：所有功能必须套用的入口、主流程、八态、权限、弱网和验收模板。
3. [02-全端信息架构与交互模式](02-全端信息架构与交互模式.md)：四个前端项目、路由族、导航、深链和响应式模式。
4. [03-Phase1-学习闭环功能设计](03-Phase1-学习闭环功能设计.md)：ONB/VOC/GRM/LST/RDG/SPK/WRT/ASM。
5. [04-Phase1-成长社群商业后台功能设计](04-Phase1-成长社群商业后台功能设计.md)：GAM/SOC/USR/INF/COM/ADM。
6. [05-Phase2-AI成人高级能力功能设计](05-Phase2-AI成人高级能力功能设计.md)：AI2 与 Phase 2 Gate、Schema、RTC 和降级。
7. [06-Phase3-K12合规与教师机构功能设计](06-Phase3-K12合规与教师机构功能设计.md)：K12、监护、教师机构、版权和防沉迷。
8. [07-跨域契约数据事件与验收设计](07-跨域契约数据事件与验收设计.md)：四项目横向约束、跨域扩展单元和验收证据。
9. [08-980plus-功能点设计登记册](08-980plus-功能点设计登记册.md)：V2-980-0001 至 V2-980-${String(units.length).padStart(4, '0')} 的逐条设计登记。
10. [09-追溯与验收矩阵](09-追溯与验收矩阵.md)：来源 → 设计 → 契约/数据 → 页面状态 → 埋点 → AC/测试追溯。
11. [10-设计评审与未决项](10-设计评审与未决项.md)：必须由产品/架构/合规签收的数量和交互问题。
12. [11-架构映射与任务重基线](11-架构映射与任务重基线.md)：V2-980 业务单元与 ARCH 平台能力的依赖、任务卡和验收字段。
13. [12-架构与设计一致性审核](12-架构与设计一致性审核.md)：v2 需求、服务边界、权限、数据、事件和运行模型的审核结论。
14. [B7+ 代码重塑与交互测试任务基线](../../../requirements/backlog/v2-B7plus-代码重塑与交互测试任务基线.md)：从 B7 开始的代码层、逻辑/交互测试任务与阶段 Gate。

## 3.1 v2 技术架构绑定

- 新服务目标运行时为 Java 25 LTS + Spring Boot 4.1.x/Spring Framework 7.x；Phase 2 AI 编排仍为 Python 3.11+。
- 外部调用统一经过 api-gateway；身份、租户、会话、RBAC/ABAC 和策略撤销由 iam-service 负责，领域服务必须再次执行服务侧 PEP 校验。
- 认证统一采用平台自有 IAM 账号密码登录；iam-service 直接签发短时 RS256/ES256 JWT Bearer Access Token，并通过 JWKS 发布公钥。Refresh Token 由 IAM 会话边界轮换、检测重放并撤销；JWT profile、存储和异常交互以 [ADR-0013](../../10-decisions/0013-self-owned-jwt-authentication-center.md) 为准。
- 四端只能通过 Authorization: Bearer 发送 Access Token；Token 不得进入 URL、localStorage、日志、事件、埋点或错误响应；Gateway 与每个领域服务必须独立通过 JWKS 验签并执行 PEP。
- packages/contracts/ 是 OpenAPI、AsyncAPI 和 JSON Schema 的事实源；领域服务各自拥有数据、迁移、Redis 命名空间、Outbox 和审计边界。
- 现有 services/core-api（Java 17/Spring Boot 3）仅作为 v1 兼容单体和 Strangler Fig 迁移边界，不代表 v2 微服务已实现完成；任何迁移都必须有契约、数据、权限、观测、回滚和 SLO 证据。
- V2-980-* 只描述业务/跨域设计单元；ARCH-* 平台能力必须按 [平台能力矩阵](../../02-architecture/v2-platform-capability-matrix.md) 单独建任务，不计入 980。

## 4. 重生成和审计

在仓库根目录执行：

~~~text
node scripts/audit/generate-v2-design-package.mjs
node scripts/audit/verify-v2-design-package.mjs
~~~

生成器只写入本目录；验证器会检查 980 行、阶段/域数量、每行来源和设计字段、四项目边界、Phase 1/2/3 Gate、V2-EXT 占位标记和关键模板锚点。

${warnings.length ? `当前生成警告：${warnings.join('；')}` : '本次生成没有目标数量警告。'}
`;
}

function generateBaseline(units, matrix, atoms) {
  const domainSummary = matrix.summary.map((row) => ({
    domain: row.domain,
    name: row.name,
    p1: row.p1,
    p2: row.p2,
    p3: row.p3,
    total: row.total,
    actual: units.filter((unit) => unit.domain === row.domain).length,
  }));
  return `# 版本基线与 980+ 计数口径

## 1. 继承关系与禁止事项

本版的事实优先级如下：

- 本目录：下一轮开发唯一的全量业务设计、交互、阶段、数据/契约映射和验收落地基线；
- [PRD](../../../requirements/product-requirements.md)、[功能矩阵](../../../requirements/feature-matrix.md) 和 [PRD 原子候选清单](../traceability/03-PRD原子需求候选清单.md)：产品证据、编号、法规边界和追溯索引；
- [v2 微服务技术架构](../../02-architecture/v2-microservices-architecture.md)、[架构映射与任务重基线](11-架构映射与任务重基线.md) 与 [B7+ 代码任务基线](../../../requirements/backlog/v2-B7plus-代码重塑与交互测试任务基线.md)：服务边界、Gateway/IAM、数据/事件、任务依赖和验收字段；
- 既有 \`detailed-specs/\`、\`phase-*\`、B0–B6：历史实现、术语和迁移参考；若与 v2 冲突，不得覆盖 v2。

本版禁止：为补齐数量私造 FEAT-*、把页面状态计为业务功能、把 Phase 2/3 能力提前放入 Phase 1、绕过四项目边界、在客户端复制领域事实，或用旧版文档推翻本版设计。

## 2. 数量校准

功能矩阵顶部给出 Phase 1 540、Phase 2 228、Phase 3 212，共 980；但业务域汇总行直接相加为 Phase 1 540、Phase 2 208、Phase 3 182，共 930。差额为 Phase 2 20、Phase 3 30。本版按以下可审计方式处理：

1. 930 个业务域设计单元：按矩阵每个业务域和阶段的汇总目标生成；优先绑定显式 FEAT-*，其次绑定 PRD-ATOM-*；
2. 50 个跨域扩展设计单元：使用 V2-EXT-P2-TOTAL-* 和 V2-EXT-P3-TOTAL-*，设计其跨域入口、状态、事件、性能、恢复和验收模板，并标记为“待细化签收”；
3. 任何 V2-EXT 单元在 v2 设计 owner 补齐正式名称、来源映射和独立验收前，不得进入开发 WBS、接口实现或上线统计；
4. 因此，本目录交付的是“980 个属于 v2 范围、但成熟度不同的设计单元”；范围已以 v2 为准，未细化单元仍不能假装已经具备可实施定义。

${mdTable(domainSummary, [
  { label: '域', value: (row) => row.domain },
  { label: '业务域名称', value: (row) => row.name },
  { label: 'P1', value: (row) => row.p1 },
  { label: 'P2', value: (row) => row.p2 },
  { label: 'P3', value: (row) => row.p3 },
  { label: '域目标合计', value: (row) => row.total },
  { label: '本版业务域单元', value: (row) => row.actual },
])}

## 3. 设计单元升格规则

| 状态 | 进入条件 | 可做的工作 | 不允许 |
|---|---|---|---|
| 显式功能包已设计 | 有 FEAT-*、矩阵细节和既有设计锚点 | 进行逐条交互评审、契约拆解和实现排期评估 | 以设计完成代替代码验收 |
| PRD 原子证据已映射 | 有 PRD-ATOM-*、来源行和域级设计模板 | 补充独立页面/接口/权限/验收判断 | 把候选证据直接当成已签收功能 |
| 待细化签收 | 已纳入 v2 范围，但只有矩阵目标或差额信息 | 做交互占位、冲突识别和独立验收细化 | 写实现代码、承诺上线或回退到 v1 取定义 |

## 4. 设计完整性定义

每个 V2-980 单元必须同时拥有：来源主键、PRD/矩阵锚点、所属阶段和业务域、四项目页面宿主、主流程、成功/空/加载/错误/离线/权限/恢复状态、API/数据事实源、权限与隐私、事件埋点、验收标准和 review 状态。缺一项即视为设计不完整。

## 5. 阶段门

- Phase 1：仅成人与大学生；规则化练习和反馈；不启用生成式 AI、ASR、AI 评分、数字人、K12 和开放社交。
- Phase 2：AI 请求必须经过前置敏感拦截、结构化 Schema、后置合规核验、成本/同意/超时降级和审计；实时语音使用商业 RTC，不用 HTTP 轮询。
- Phase 3：K12 仅在资质、版权、主体、监护授权、未成年人保护和专项合规通过后开启；默认关闭并可回放撤回。

PRD 原子候选证据 ${atoms.length} 条仅作为追溯输入，不能替代产品对 980 设计单元的正式签收。
`;
}

function generateInteraction() {
  return `# 统一交互与页面状态设计

> 本文是 v2-980plus 的强制模板。任何 V2-980 单元必须能在登记册中回指本模板和所属域模板。

## 1. 一个功能单元的标准交互生命周期

~~~text
入口/深链 → 阶段与权限预检 → 加载事实源 → 主操作 → 本地反馈/自动保存
→ 服务端幂等提交 → 结果确认 → 复习/下一步/回到闭环 → 事件与审计
~~~

预检失败不应该让用户进入不可解释的空白页面。页面必须告诉用户是阶段未开放、权限不足、内容下线、网络不可用还是服务暂时失败，并提供安全的下一步。

## 2. 设计单元必填卡片

| 维度 | 必须回答的问题 |
|---|---|
| 用户目标 | 用户想完成什么学习、管理或恢复动作？成功的可观察结果是什么？ |
| 入口 | 从哪个路由、卡片、通知或深链进入？未登录和未通过 Gate 怎么办？ |
| 主操作 | 一个首要 CTA 是什么？危险、次要和退出动作如何分层？ |
| 输入 | 输入格式、必填项、长度、敏感内容、草稿和撤销如何处理？ |
| 反馈 | 成功后去哪；错误是否可重试；结果是否写入哪一个事实源？ |
| 状态 | 正常、空、加载、错误、离线、权限、恢复和处理中是否分别设计？ |
| 跨端 | 移动 H5/App/iPad、Learner Web/PWA、Admin Web 和 Official Site 的宿主是否清楚？ |
| 契约 | API、事件、数据表、版本、幂等键、requestId/traceId 是否明确？ |
| 安全 | 角色、资源 owner、tenant、阶段、内容权利、隐私和设备权限如何校验？ |
| 验收 | 可由哪条 AC、测试、埋点、日志或回放证明？ |

## 3. 统一八态

| 状态 | 交互要求 | 禁止表现 |
|---|---|---|
| 成功/有数据 | 首屏呈现核心结果，给出下一步闭环 CTA；写操作展示 requestId 关联的完成反馈 | 只显示“操作成功”而不说明事实是否落库 |
| 空 | 说明为什么为空，给出筛选清除、创建、学习替代或回到今日任务 | 把权限拒绝、内容下线或服务错误伪装成空 |
| 加载 | 首次加载有骨架或阶段提示；长任务显示进度和取消/后台运行策略 | 无限转圈、重复发起副作用请求 |
| 错误 | 显示可理解说明、稳定 errorCode 对应动作和 retryable；保留已保存数据 | 只显示后端堆栈、让用户重复提交 |
| 离线 | 读缓存可标注时间；写事件进入有序队列并显示待同步 | 把超时当成失败、重复生成业务事实 |
| 权限 | 区分登录、角色、资源、设备和阶段 Gate；提供申请、返回或等效路径 | 403 变成空白或静默隐藏核心结果 |
| 恢复 | 从最后一个安全 checkpoint 恢复，说明冲突和选择；可回放 | 静默覆盖本地作答、草稿、进度或奖励 |
| 处理中 | 显示排队、进度、查询入口和可安全离开策略 | 用户离开后丢失任务或允许第二次副作用 |

## 4. CTA 与反馈层级

1. 一个页面只能有一个主 CTA；主 CTA 只推动用户完成当前闭环的一步。
2. 取消、退出和返回保留已保存事实；危险操作采用二次确认并说明不可逆性。
3. 学习反馈优先回答“我哪里错、为什么、下一步练什么”；游戏和商业反馈不能遮挡学习反馈。
4. 长任务采用任务中心或通知回访，不把后台任务伪装成同步完成。
5. 任何生成、上传、提交、领奖、支付、发布、注销和审核操作必须使用 Idempotency-Key，并在 UI 上阻止重复点击。

## 5. 表单、练习和媒体交互

### 5.1 表单

输入开始后自动保存草稿；离开页面先判断 dirty 状态；校验错误就近显示；服务端 422 返回字段级 details；重试不清空用户输入。

### 5.2 练习

题目、选项、作答、保存、提交和评分分离。提交前允许回看；提交后锁定本次 attempt；错误反馈可跳转到证据和修复练习。D+1/D+7 是后续会话，不在客户端直接修改掌握度。

### 5.3 Phase 1 成人年龄 Gate

注册和 Onboarding 先由 \`iam-service\` 判定年龄与主体 Gate。未成年人、儿童账号、家长账号、监护绑定、未成年人支付和 K12 学习目标在 Phase 1 必须明确拒绝：页面给出安全解释和退出路径，服务端不创建相应主体或权益事实；这些不是 Phase 1 的可见功能入口。

### 5.4 音频/录音

先申请设备权限，再开始录音；展示计时和本地回放；上传失败保留本地安全副本；无麦克风提供静音/文本替代。Phase 1 不显示 AI 评分文案。

### 5.5 实时/流式

Phase 2 才启用 AI 流式 Token 或 RTC。前置安全、连接状态、打断、重连、后置核验和降级路径必须可见；用户看到的是结构化结果，不是未经校验的原始模型输出。

## 5.6 JWT Bearer 认证与会话

- 登录使用统一的 IAM 账号密码 JSON API；四端品牌化登录页把凭据仅提交给 Gateway→iam-service，认证中心直接签发短时非对称 JWT Access Token。
- Access Token 通过 Authorization: Bearer 发送；Web Refresh Token 使用 HttpOnly/Secure/SameSite Cookie，移动端使用 Keychain/Keystore。Refresh Token 由 IAM 会话边界轮换、检测重放并撤销，不进入领域服务。
- Gateway 与每个领域服务独立校验 issuer、audience、签名、算法、时间窗口、token type 和必要 scope；验证失败返回 401，身份有效但无权限返回 403。
- Access Token 不进入 URL、localStorage、日志、埋点、事件和错误详情。Web/H5 使用内存 token manager，原生端使用 Keychain/Keystore 等安全存储；刷新失败只允许一次静默重试后回到登录页。

## 6. 四项目与响应式

| 项目 | 负责范围 | 主要交互 | 不允许 |
|---|---|---|---|
| apps/mobile | 移动 H5、iOS、Android、iPad、后续微信小程序条件编译 | 底部导航、单列卡片、手势、底部抽屉、离线和设备权限 | 为 H5/iPad/小程序再复制业务项目 |
| apps/learner-web | PC Web、平板浏览器、PWA 工作区 | 侧边导航、双栏/三栏、键盘快捷键、持久工作区 | 重复承载 mobile 的移动业务页面 |
| apps/admin-web | 教研、审核、运营、商业、客服、风控 | 表格、筛选、抽屉、审阅、双审和审计时间线 | 复用学习者端导航或直接改学习事实 |
| apps/official-site | 品牌、课程、价格、下载、SEO、合规公示 | 首屏转化、公开内容、登录/下载深链 | 承载登录后的学习业务 |

布局只使用 design-system 的 token；复杂 3D、粒子、波形和图谱必须接入 AdaptivePerformanceEngine 的 Ultra/High/Medium/Performance 四级档位。低配设备可退到 2.5D SVG、2D 切片、静态图或文本结果。

### 6.1 国际化与主题基础

- 四个项目共享 \`packages/i18n\` 与 \`packages/design-tokens\`，但各自实现平台适配层；UI locale 与内容/学习语言 \`contentLocale\` 是不同字段，不能用英语学习内容覆盖中文 UI，也不能让客户端改写内容语言事实。
- Phase 1 默认使用 \`zh-CN\` UI；locale 注册、缺失 key fallback、参数插值、日期/数字/复数格式化和伪本地化检查必须通过共享运行时完成。新增 UI 语种、翻译审校和内容本地化属于后续受控变更，不能由业务页面临时硬编码。
- Token 必须区分原子值和语义值，覆盖颜色、字体、间距、圆角、阴影、动效、断点与焦点态；支持亮色、暗色、跟随系统和高对比主题。Nuxt SSR 使用稳定的首屏主题/locale 来源以避免 hydration 闪烁；uni-app、Element Plus 和 Web 使用各自变量适配层。
- 主题偏好可以本地持久化；与学习档案同步前必须由 \`learner-service\` 的偏好契约显式允许。颜色之外必须同时使用文案、图标、形状或状态属性表达成功、错误、权限和处理中状态。

## 7. 统一契约和数据规则

- 成功响应使用 requestId、data、meta；错误响应使用 requestId、traceId、error.errorCode/message/retryable/details。
- REST/JSON/事件使用 camelCase；数据库使用 snake_case；时间为 UTC/RFC 3339；媒体时间为整数毫秒。
- 领域事实只能由唯一 owner 更新：\`content-service\` 拥有内容版本、题目/练习定义和答案规则版本；\`assessment-service\` 拥有 attempt、checkpoint、规则判分和报告快照；\`learning-service\` 拥有计划、SRS、进度和 mastery_projection；GAM 拥有 XP/奖励，COM 拥有订单/权益。\`admin-ops-service\` 只能聚合和发命令，内容发布状态仍归 \`content-service\`。
- 离线写事件必须携带 clientEventId、clientSeq、baseCursor 或 baseStateVersion、contentVersionId、payload hash 和幂等键。
- 埋点必须能沿 requestId → traceId → eventId/clientEventId → 领域事实 → audit 回放；不得采集原始密码、token、API Key、原始音频或未脱敏自由文本。

## 8. 可访问性与文案

焦点顺序与阅读顺序一致；触控目标不小于设计系统要求；颜色之外同时使用文字/图标；媒体有字幕或文本替代；错误文案说明原因和动作；敏感和 Gate 文案不诱导绕过限制。
`;
}

function generateIA() {
  return `# 全端信息架构与交互模式

## 1. 四项目冻结映射

| 项目 | 路由根 | 内容边界 | 典型出口 |
|---|---|---|---|
| apps/mobile | /onboarding、/learn、/courses、/practice、/world、/me | 移动 H5/App/iPad；微信小程序只作为条件编译输出 | 返回今日任务、继续学习、同步中心 |
| apps/learner-web | /learn、/courses、/practice、/reports、/me | PC Web、平板浏览器和 PWA 工作区 | 深链到练习、报告、阅读器、媒体 |
| apps/admin-web | /admin | 内容、教研、审核、运营、商业、客服、风控、审计 | 任务队列、审阅抽屉、审计时间线 |
| apps/official-site | /、/courses、/pricing、/download、/compliance | 品牌、公开课程、价格、下载、SEO、公示 | 登录、下载、公开咨询；不进入学习工作区 |

## 2. 学习者信息架构

~~~text
学习入口
├─ onboarding：目标、定级、计划、首屏引导
├─ learn：今日任务、地图、继续学习、报告摘要
├─ courses：词汇、语法、听力、阅读、口语、写作、场景包
├─ practice：SRS、专项练习、模考、错题、D+1/D+7
├─ world：游戏化、成就、自习室、排行榜、收藏
└─ me：个人、设备、通知、隐私、会员、客服、同步
~~~

## 3. 页面壳与深链

| 页面壳 | 适用 | 必备元素 | 离开策略 |
|---|---|---|---|
| LearnShell | 学习首屏/地图/课程 | 阶段 Gate、今日任务、继续学习、通知、全局搜索 | 返回今日任务或保留最近访问 |
| PracticeShell | 所有练习/模考 | 题号/进度、保存、暂停、提交、离线状态 | checkpoint 恢复；提交中不可二次提交 |
| ReaderShell | 阅读/听力/媒体 | 内容版本、播放/字号、查词、收藏、进度 | 自动保存并提示版本冲突 |
| SocialShell | 自习室/榜单 | 匿名/隐私状态、租约、预设互动、退出 | 租约结算后返回学习任务 |
| AdminShell | admin-web | 租户/角色、筛选、表格、抽屉、审计 | 草稿保存；审核/发布需要二次确认 |
| OfficialShell | 官网 | SEO、公开导航、登录/下载 CTA、合规脚注 | 只产生公开深链，不携带敏感上下文 |

深链必须携带 resourceId、contentVersionId（如适用）、来源页面和安全过期策略；不能把 token、个人隐私或可写权限放进 URL。未登录时先回到统一认证，Gate 不通过时回到解释页而不是 404。

## 3.1 认证与会话交互

~~~text
点击登录/注册 → 统一账号密码页面提交到 IAM
   → IAM 校验密码并签发 JWT Access Token + rotated Refresh Token 会话
   → API 使用 Bearer（JWT） → Gateway 验签 → 服务侧再次验签与 PEP
~~~

- 深链和 returnTo 必须经过 allow-list 校验；URL 中不得出现 Access/Refresh Token。
- Access Token 过期时 token manager 只做一次并发合并的静默 refresh；refresh 失败、重放或会话撤销后清理本地状态并回到登录入口。
- official-site 只产生公开登录 deep link，不保存登录后业务 Token；admin-web 使用独立登录页面和前端会话边界，业务 API audience 统一为 yuxuexing-api，scope/permission 由服务侧 PEP 决定且不共享 Refresh Token。

## 4. 交互模式注册表

| 模式 | 适用功能 | 移动端 | Web/后台 | 统一状态要求 |
|---|---|---|---|---|
| 单步卡片 | 目标选择、词卡、短练习 | 单列、底部 CTA | 卡片或工作区右栏 | 当前选择、保存、错误和恢复 |
| 连续练习 | SRS、专项、模考 | 顶部进度 + 底部提交 | 顶部进度 + 键盘操作 | 会话、checkpoint、提交幂等 |
| 媒体精练 | 听力、录音、阅读 | 播放条/抽屉 | 固定播放器/双栏 | 缓冲、权限、离线、字幕缺失 |
| 结构图/图谱 | 地图、语法、知识图谱 | 2.5D/可缩放画布 | Vue Flow/AntV G6 | 性能档、聚焦节点、无法渲染替代 |
| 抽屉审阅 | 反馈、通知、后台编辑 | bottom sheet | drawer/side panel | 不丢草稿、可回到来源 |
| 表格工作台 | CMS、订单、审计 | 移动端只读/任务卡 | Element Plus 表格 + 筛选 | RBAC、分页游标、导出审计 |
| 实时会话 | Phase 2 RTC | 全屏会话 + 打断 | 双栏会话 + 事件流 | 连接、静音、打断、降级、回放 |

## 5. 平板与小屏规则

- iPad 使用 mobile 项目输出，横屏可切换双栏，但不改变业务状态和 API；平板浏览器使用 learner-web，视觉上可以共享 token，不共享页面实现。
- 移动 H5 必须避免依赖 hover、右键和宽表；PC 工作区必须提供键盘可达、批量筛选和可复制的审阅上下文。
- 小程序条件编译只处理平台能力差异，业务路由、状态和 API 事实仍来自 apps/mobile。
- 低带宽先呈现缓存和最近进度，长任务通过通知中心回访；任何端都不静默丢失输入。

## 6. 跨项目返回协议

跨项目跳转使用受控 deep link：sourceProject、targetProject、resourceType、resourceId、contentVersionId、returnTo、expiresAt。目标项目重新鉴权并重新拉取事实；返回只携带完成事件的 correlationId，不携带可伪造积分、掌握度、权益或审核结果。
`;
}

function phaseDoc(title, intro, includedDomains, units) {
  const sections = includedDomains.map((domain) => {
    const meta = domains[domain];
    const rows = units.filter((unit) => unit.domain === domain);
    const phaseCounts = countsBy(rows, 'phase');
    return `### ${domain} · ${meta.name}

**本版单元**：${rows.length}；${phaseOrder.map((phase) => `${phase} ${phaseCounts[phase] ?? 0}`).join(' / ')}  
**设计入口**：[${meta.designDoc}](${meta.designDoc})  
**路由宿主**：${meta.route}  
**终端**：${meta.platforms}

**交互意图**：${meta.intent}

**主流程**：${meta.flow}

**动作与反馈**：${meta.action}。成功后 ${domain === 'ASM' ? '回到报告或修复任务' : '回到今日任务、复习或下一步学习'}；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：${meta.states}。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：${meta.contract}。${meta.permission}

**事件**：${meta.event}。所有事件沿 requestId、traceId、eventId/clientEventId 关联到领域事实。

**验收**：${meta.acceptance}

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 ${domain}；每一条需保留来源、状态、设计锚点和 review 结论。
`;
  }).join('\n');
  return `# ${title}

${intro}

> **v2 架构绑定**：本阶段通过 \`api-gateway\` 访问目标领域服务；每个域的契约、数据、权限和事件以本文件的“契约与事实源”及 [v2 微服务技术架构](../../02-architecture/v2-microservices-architecture.md) 为准。现有 \`services/core-api\` 只承担迁移兼容，不是本版目标事实源。

## 1. 本阶段的共同交互约束

- 先判断阶段、年龄/主体、内容版本、权限和可用性，再渲染核心 CTA。
- 所有学习动作都必须回到“目标 → 练习 → 反馈 → 复习 → 复盘”；社交、游戏和商业模块只能作为辅助出口。
- 所有写操作具备自动保存、幂等、失败恢复和可回放证据；不让客户端直接修改跨域事实。
- 所有登录后 API 请求使用平台 IAM 签发的 JWT Bearer（Access Token）；Refresh Token 轮换、重放检测、撤销和设备下线由 IAM 会话边界统一处理。
- 登录/注册页面可以品牌化，但不得在前端或业务服务签发 JWT；401、403、过期、撤销和刷新失败必须分别呈现可理解的恢复动作。
- 移动端、iPad、learner-web 的业务状态相同，页面组件按平台分别实现；admin-web 和 official-site 不复用学习者导航。

## 2. 域级设计

${sections}

## 3. 评审顺序

1. 先评审域级流程和边界；
2. 再按登记册逐条确认来源、独立验收和是否需要 SUBFEAT；
3. 再生成 OpenAPI、迁移、事件和页面任务；
4. 最后用真实设备/浏览器检查加载、空、错误、离线、权限、恢复和性能降级。
`;
}

function generateCrossDoc(units) {
  const cross = units.filter((unit) => unit.domain === 'CROSS');
  return `# 跨域契约、数据、事件与验收设计

## 1. 这 50 个单元的定位

本文件承接矩阵顶部 980 与业务域明细 930 的差额：Phase 2 20 个、Phase 3 30 个。它们属于 v2 已登记范围内的跨域设计扩展槽位，目的是把深链、Gate、共享状态、观测、性能、恢复、发布和验收设计补齐；在 v2 设计 owner 补齐独立名称、来源映射和验收前，不视为可实施的具体业务功能。

| 阶段 | 单元数 | 状态 | 进入实现的前置条件 |
|---|---:|---|---|
| Phase 2 | ${cross.filter((unit) => unit.phase === 'Phase 2').length} | 待细化签收 | AI/成人 Gate、独立名称/验收、成本和安全评审 |
| Phase 3 | ${cross.filter((unit) => unit.phase === 'Phase 3').length} | 待细化签收 | K12 资质、版权、监护、主体、地区、防沉迷和独立验收 |

## 2. 跨域调用顺序

~~~text
深链/通知/任务入口
  → 认证与主体识别
  → 阶段 Gate / 资源权利 / RBAC / owner 校验
  → 读取唯一事实源
  → 页面按八态呈现
  → 有副作用写入 Idempotency-Key
  → outbox 发布事件
  → 目标页面/通知中心回访
~~~

任何跨域页面不得复制用户、学习掌握、订单权益、奖励、审核或 K12 主体事实。只能读取 owner 提供的契约视图。

## 3. 契约与数据不变量

| 主题 | 规则 |
|---|---|
| API | 成功为 requestId/data/meta；错误为 requestId/traceId/error；新接口由 packages/contracts 生成类型 |
| 幂等 | 所有有副作用写操作带 Idempotency-Key；网络超时先查幂等结果，不盲目重做 |
| 离线 | clientEventId + clientSeq + baseCursor/baseStateVersion + contentVersionId + payload hash；服务端有序去重 |
| 事件 | 只发布跨服务集成事实，不把 UI 点击、日志或指标放入总线；采用至少一次投递，按聚合 ID 分区，eventId 去重，outbox 保证事实落库后再发布；Kafka 不充当 RPC 或分布式事务协调器 |
| 认证 | 自有 IAM 账号密码登录并签发 JWT Bearer（Access Token）；Gateway 与每个领域服务独立 JWKS 验签；Refresh Token 轮换/撤销不进入领域事件或业务事实 |
| 权限 | 认证、角色、tenant、资源 owner、阶段、内容权利同时校验；403 不能伪装空数据 |
| 状态 | 使用 canonical 状态；域内别名只能在兼容 mapper 中出现；UI 文案不覆盖后端事实 |
| 观测 | requestId → traceId → eventId/clientEventId → 领域事实 → audit_log 可回放 |
| 性能 | AdaptivePerformanceEngine 控制 3D、图谱、波形、流式和粒子；低配设备有静态/文本替代 |

## 4. 逐条登记

${mdTable(cross.map((unit, index) => ({ ...unit, number: index + 1 })), [
  { label: 'V2 ID', value: (row) => row.id ?? `V2-980-CROSS-${String(row.number).padStart(3, '0')}` },
  { label: '阶段', value: (row) => row.phase },
  { label: '来源', value: (row) => row.sourceId },
  { label: '设计主题', value: (row) => row.sourceText },
  { label: '统一交互', value: (row) => domains.CROSS.action },
  { label: '状态', value: () => domains.CROSS.states },
  { label: '评审状态', value: (row) => row.status },
])}

## 5. 升格为正式功能的评审单

v2 设计 owner 必须为每个 V2-EXT 单元补充：正式功能名称、v2 来源映射、用户故事、入口和出口、独立验收、角色/数据边界、是否需要 FEAT/SUBFEAT、阶段和优先级。架构负责人再确认 API owner、数据表、事件和 ADR；合规负责人确认 AI/K12/版权/隐私边界。三方未签收前保持待细化签收，不回退到 v1 寻找定义。
`;
}

function generateRegister(units) {
  const rows = units.map((unit, index) => designRow(unit, index + 1));
  const intro = `# 980plus 功能点设计登记册

> 自动生成：scripts/audit/generate-v2-design-package.mjs  
> 行数：${rows.length}；编号连续范围：V2-980-0001 至 V2-980-${String(rows.length).padStart(4, '0')}。  
> 说明：本表是设计追溯登记，不等于代码实现。待细化签收行属于 v2 范围，但必须补齐可实施定义。

## 1. 行级设计字段

每行都回答：来源是什么、用户在哪里操作、核心交互是什么、正常流程是什么、页面有哪些状态、哪个契约/数据事实源负责、权限/隐私怎么做、埋点如何回放、怎样验收、当前是否允许排期。

认证相关设计单元还必须明确：自有 IAM 签发的 JWT Bearer（Access Token）、统一 API audience、Refresh Token 轮换/撤销、Token 存储边界、401/403 语义、JWKS 轮换，以及四端登录/会话隔离；不得把前端 Token 解析或客户端权限覆盖写成产品方案。

## 2. 逐条登记

`;
  const table = mdTable(rows, [
    { label: 'V2 ID', value: (row) => row.id },
    { label: '阶段', value: (row) => row.phase },
    { label: '域', value: (row) => row.domain },
    { label: '设计单元', value: (row) => row.name },
    { label: '来源主键', value: (row) => row.sourceId },
    { label: '来源/PRD锚点', value: (row) => `${row.sourceAnchor}；${row.detail}` },
    { label: '设计文档', value: (row) => row.designDoc },
    { label: '页面/路由宿主', value: (row) => row.route },
    { label: '终端', value: (row) => row.platforms },
    { label: '主交互', value: (row) => row.interaction },
    { label: '正常流程', value: (row) => row.normalFlow },
    { label: '页面状态', value: (row) => row.states },
    { label: '契约/数据事实源', value: (row) => row.contract },
    { label: '权限/隐私', value: (row) => row.permission },
    { label: '埋点/事件', value: (row) => row.event },
    { label: '验收', value: (row) => row.acceptance },
    { label: '设计状态', value: (row) => row.status },
    { label: '评审门槛', value: (row) => row.review },
  ]);
  return `${intro}${table}\n`;
}

function generateTraceability(units, matrix, atoms) {
  const phaseRows = phaseOrder.map((phase) => {
    const phaseUnits = units.filter((unit) => unit.phase === phase);
    return { phase, target: phaseTotals[phase], units: phaseUnits.length, explicit: phaseUnits.filter((unit) => unit.sourceType === '显式功能矩阵').length, atom: phaseUnits.filter((unit) => unit.sourceType === 'PRD 原子证据').length, pending: phaseUnits.filter((unit) => unit.status === refinementStatus).length };
  });
  const domainRows = domainOrder.map((domain) => {
    const domainUnits = units.filter((unit) => unit.domain === domain);
    return { domain, name: domains[domain].name, p1: domainUnits.filter((unit) => unit.phase === 'Phase 1').length, p2: domainUnits.filter((unit) => unit.phase === 'Phase 2').length, p3: domainUnits.filter((unit) => unit.phase === 'Phase 3').length, pending: domainUnits.filter((unit) => unit.status === refinementStatus).length };
  });
  return `# 追溯与验收矩阵

## 1. 阶段追溯覆盖

${mdTable(phaseRows, [
  { label: '阶段', value: (row) => row.phase },
  { label: '矩阵顶部目标', value: (row) => row.target },
  { label: '本版单元', value: (row) => row.units },
  { label: '显式 FEAT', value: (row) => row.explicit },
  { label: 'PRD 原子证据', value: (row) => row.atom },
  { label: '待细化签收', value: (row) => row.pending },
])}

## 2. 业务域追溯覆盖

${mdTable(domainRows, [
  { label: '域', value: (row) => row.domain },
  { label: '名称', value: (row) => row.name },
  { label: 'P1', value: (row) => row.p1 },
  { label: 'P2', value: (row) => row.p2 },
  { label: 'P3', value: (row) => row.p3 },
  { label: '待确认', value: (row) => row.pending },
])}

## 3. 端到端追溯链

~~~text
PRD / feature-matrix
  → PRD-ATOM-* 或 FEAT-*
  → V2-980-* design unit
  → 域级设计文档 + 统一交互模板
  → route/page state + API contract + data owner
  → event/audit/analytics
  → acceptance criteria + unit/integration/e2e evidence
~~~

登记册中的来源主键必须能回到 requirements/product-requirements.md 或 requirements/feature-matrix.md。设计文档锚点必须回到本目录；契约和数据列必须指向唯一事实源；测试任务以后以 V2 ID 作为关联标签。

## 4. 每个设计单元的验收门

| 门 | 必检内容 | Evidence 示例 |
|---|---|---|
| 产品门 | PRD 行、用户故事、目标、优先级、阶段和独立验收 | 需求链接、评审记录、原型/交互稿 |
| 交互门 | 入口、主 CTA、正常流程、八态、退出/恢复、响应式 | 页面录屏、视觉检查、真实设备操作 |
| 契约门 | OpenAPI、请求/响应、错误码、幂等、分页、版本 | packages/contracts、API 测试 |
| 数据门 | 唯一 owner、迁移、索引、审计、保留和脱敏 | migration、数据字典、回放查询 |
| 安全门 | RBAC、tenant、owner、阶段/内容权利、设备权限 | 403/401/跨租户测试、审计记录 |
| 质量门 | 单测、集成、E2E、离线/弱网、性能档和无障碍 | CI、设备矩阵、性能报告 |
| 阶段门 | Phase 1 无 AI；Phase 2 AI Gate；Phase 3 K12 Gate | Gate 配置、审计和回滚证据 |

## 5. 统计声明

本矩阵验证的是本目录已生成 ${units.length} 行设计登记。它不把 ${atoms.length} 条 PRD 原子候选直接当成 ${units.length} 个功能，也不把待细化签收的 V2-EXT 行当成可实施功能。v2 细化签收后，必须同步回写 feature-matrix.md、WBS、contracts、测试台账和 CHANGELOG。
`;
}

function generateReview(units, matrix, atoms) {
  const pending = units.filter((unit) => unit.status === refinementStatus);
  return `# 设计评审与未决项

## 1. 必须先签收的数量问题

| 问题 | 证据 | 当前处理 | 需要谁决定 |
|---|---|---|---|
| 顶部 980 与业务域 930 不一致 | feature-matrix.md 汇总表 | 本版保留 930 业务域单元 + 50 跨域扩展单元 | 产品负责人 |
| 显式 FEAT 仅 ${matrix.explicit.length} 条 | 功能矩阵 FEAT 行扫描 | 不重新造 FEAT；其余按 PRD-ATOM 或 V2-EXT 登记 | 产品/教研 |
| PRD 原子候选 ${atoms.length} 条不等于功能数 | PRD 原子候选清单 | 先做证据层，再确认哪些独立验收并升格 SUBFEAT | 产品/架构 |
| Phase 2/3 设计提前出现的风险 | 既有设计与阶段边界 | 目录分阶段；Gate 未通过前只保留设计，不进 Phase 1 默认路由 | 产品/合规 |

## 2. 当前待细化签收单元

本版有 ${pending.length} 个待细化签收单元，全部为 V2-EXT 透明占位。它们属于 v2 范围，但必须先补正式名称、v2 来源映射和独立验收；不能直接拆成代码任务。

${mdTable(pending.map((unit, index) => ({ ...unit, number: index + 1 })), [
  { label: '顺序', value: (row) => row.number },
  { label: '阶段', value: (row) => row.phase },
  { label: '来源占位', value: (row) => row.sourceId },
  { label: '主题', value: (row) => row.sourceText },
  { label: '补证据要求', value: () => 'v2 来源锚点、用户故事、正式名称、独立 AC、owner、权限、事件' },
])}

## 3. 交互合理性检查清单

- 是否只有一个主 CTA，并且完成后回到学习闭环或明确的后台任务队列？
- 是否区分空、权限、内容下线、网络错误和阶段未开放？
- 是否在移动 H5、App、iPad、learner-web、admin-web 和 official-site 中指定了唯一宿主？
- 是否有自动保存、幂等键、checkpoint、重试预算和恢复入口？
- 是否使用唯一领域事实源，没有在前端或跨域复制掌握度、权益、奖励、审核和 K12 主体？
- 是否有真实数据版本、权限、隐私、审计和埋点证据？
- 是否遵循 ADR-0013 的 JWT Bearer profile：自有 IAM 签发、Gateway/服务侧独立 JWKS 验签、刷新轮换、撤销和 Token 不落 URL/日志/业务事件？
- 是否禁止前端或业务服务自行签发 Token、伪造角色/tenant/owner 头，并区分 401 与 403？
- 是否通过 AdaptivePerformanceEngine 的四级档位和低配替代路径？
- AI 是否只在 Phase 2 Gate 后出现；K12 是否只在 Phase 3 Gate 后出现？

## 4. 设计评审结论格式

每次评审记录至少包含：V2 ID、来源主键、评审人和日期、结论（通过/修改/阻塞）、交互问题、契约/数据问题、阶段/合规问题、后续责任人、Evidence 链接。状态通过前，不能在 WBS 中标记为“可开发”。
`;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const matrix = parseMatrix();
  const atoms = parseAtomicInventory();
  const built = buildUnits(matrix, atoms);
  const units = built.units.map((unit, index) => designRow(unit, index + 1));
  if (units.length !== 980) throw new Error(`Expected 980 design units, got ${units.length}`);
  write('README.md', generateReadme(units, atoms, matrix, built.warnings));
  write('00-版本基线与980+计数口径.md', generateBaseline(units, matrix, atoms));
  write('01-统一交互与页面状态设计.md', generateInteraction());
  write('02-全端信息架构与交互模式.md', generateIA());
  write('03-Phase1-学习闭环功能设计.md', phaseDoc('Phase 1 学习闭环功能设计', '本文件覆盖学习者最核心的八个能力域，目标是让每个学习动作都能完成“目标 → 练习 → 反馈 → 复习 → 闭环复盘”。', ['ONB', 'VOC', 'GRM', 'LST', 'RDG', 'SPK', 'WRT', 'ASM'], units));
  write('04-Phase1-成长社群商业后台功能设计.md', phaseDoc('Phase 1 成长、社群、商业与后台功能设计', '本文件覆盖游戏化、受控社群、用户基础、通知同步、商业化和管理后台。它们服务于学习闭环，并不拥有其他域的学习事实。', ['GAM', 'SOC', 'USR', 'INF', 'COM', 'ADM'], units));
  write('05-Phase2-AI成人高级能力功能设计.md', phaseDoc('Phase 2 AI 成人高级能力功能设计', 'Phase 2 只面向成人，且必须在模型安全、成本、同意、内容审核、AI 登记和实时通信前置条件通过后启用。', ['AI2'], units));
  write('06-Phase3-K12合规与教师机构功能设计.md', phaseDoc('Phase 3 K12 合规与教师机构功能设计', 'Phase 3 是隔离的受监管扩展，不改变 Phase 1/2 默认产品边界。所有未成年人、监护、教师、机构、教材和防沉迷能力均由 Gate 控制。', ['K12'], units));
  write('07-跨域契约数据事件与验收设计.md', generateCrossDoc(units));
  write('08-980plus-功能点设计登记册.md', generateRegister(units));
  write('09-追溯与验收矩阵.md', generateTraceability(units, matrix, atoms));
  write('10-设计评审与未决项.md', generateReview(units, matrix, atoms));
  const phaseCounts = countsBy(units, 'phase');
  const domainCounts = countsBy(units, 'domain');
  console.log(JSON.stringify({ outDir, units: units.length, phaseCounts, domainCounts, explicitFeatures: matrix.explicit.length, atomicEvidence: atoms.length, warnings: built.warnings }, null, 2));
}

main();
