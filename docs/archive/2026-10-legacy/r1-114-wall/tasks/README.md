# 114张逐步执行卡

> 规划范围为本轮R1。每卡明确文件、契约、执行步骤、逐项测试和阻塞边界；任务说明完整不代表READY或开发完成。

[状态墙](../status-wall.md) · [可筛选墙](../status-wall.html) · [执行与审批手册](../execution-handbook.md) · [总计划](../../../../06-design/v2-980plus/redesign/dev-plan-R1.md)

| 卡 | 主owner | 目标 | 步骤 | 测试 |
|---|---|---|---:|---:|
| [R1-001](R1-001.md) | official-site | 使官网当前公开范围在空目录、正常目录和请求失败时如实可读，并通过受控注册链接进入学习端；覆盖登记册11个官网页面。 | 5 | 3 |
| [R1-002](R1-002.md) | iam-service | 完成IAM公开注册的真实创建、受限会话和安全拒绝，201仅表示账号/会话建立。 | 5 | 3 |
| [R1-003](R1-003.md) | iam-service | 使注册同幂等键同请求耐久重放同一账号结果，同键不同请求409，并发不创建第二账号。 | 5 | 3 |
| [R1-004](R1-004.md) | iam-service | 闭合账号密码登录、RS256验证、刷新轮换、登出和会话撤销；撤销/重放后清除客户端该身份的私有状态。 | 5 | 3 |
| [R1-005](R1-005.md) | iam-service | 设备列表显示真实当前设备和会话，踢出确认后由IAM耐久撤销目标设备全部适用会话。 | 5 | 3 |
| [R1-006](R1-006.md) | iam-service | 仅按现有birthYear/confirmed/policyVersion契约由IAM评估成人资格，持久保存PASSED/REJECTED、来源和安全审计。 | 5 | 3 |
| [R1-007](R1-007.md) | learner-web/mobile | 成人/必要同意未过时学习入口受限且有说明，同时账号、设置、隐私和已真实开放的客服保持可访问。 | 5 | 3 |
| [R1-008](R1-008.md) | iam-service（协作 learner-web/mobile） | 同意表单先读取各用途当前已发布document/version/digest再逐项提交，既有必需用途沿IAM policy，新增未定义用途关闭。 | 5 | 3 |
| [R1-009](R1-009.md) | iam-service | 撤回同意后持久记录回执并回收该purpose影响的能力，PEP返回403且缓存失效，不误删除账号或无关事实。 | 5 | 3 |
| [R1-010](R1-010.md) | learner-service | 画像和目标分别由learner owner保存，四目标/四时长必填且标签可后补；已确认字段可恢复，未保存输入不谎称持久。 | 5 | 3 |
| [R1-011](R1-011.md) | learner-web/mobile | 首访向导按IAM资格、必要同意、已保存目标与placement状态续步，进入真实定级或合法快速开始，不按本地完成布尔跳步。 | 5 | 3 |
| [R1-012](R1-012.md) | iam-service | 密码重置申请对有无账号统一202，确认令牌一次性/短时有效，成功后撤销相应会话且返回登录出口。 | 5 | 3 |
| [R1-013](R1-013.md) | iam-service | Gate拒绝时停掉学习能力并清未授权私有缓存/回调，同时保留账号与必要审计，可退出/说明/支持并合法重进。 | 5 | 3 |
| [R1-014](R1-014.md) | QA | 独立重放L1全部接口和受影响双端交互，证明001…013/015…017的本轮事实与负例；只交局部QA证据，不晋升整个P1R父Gate。 | 5 | 12 |
| [R1-015](R1-015.md) | learner-web | 按IC-052/053/054完善Web注册、登录、重置三页的字段、反馈和安全返回路径；双端共享认证行为同步回归。 | 5 | 3 |
| [R1-016](R1-016.md) | learner-web | 按IC-055/056完善成人门说明和逐项同意交互，依据已发布政策版本和回执显示状态，受限账号可退出。 | 5 | 3 |
| [R1-017](R1-017.md) | learner-web | 按IC-057/009让画像表单回填已保存字段、保留未保存输入，目标/时长保存后按钮进入真实定级，首学引导按完成状态。 | 5 | 3 |
| [R1-018](R1-018.md) | learner-web/mobile | 双端从B25旧两题写入口切换到canonical P1十题会话，验证已发布四维manifest和无答案投影。 | 5 | 3 |
| [R1-019](R1-019.md) | api-gateway | 在所有正式调用已迁移且回滚先验有效后关闭B25 placement写route，保留到R2末的历史只读入口。 | 5 | 3 |
| [R1-020](R1-020.md) | assessment-service | assessment逐题提交在owner事务中执行顺序/版本CAS、幂等checkpoint与终题结果，409后可恢复同会话。 | 5 | 3 |
| [R1-021](R1-021.md) | assessment-service | 服务端按固定P1_PLACEMENT_V1客观规则保存FULL/ZERO、四维分与解释依据；定级反馈时点变更保持待签边界。 | 5 | 3 |
| [R1-022](R1-022.md) | assessment-service | assessment耐久冻结唯一placement result/report identity、版本和digest，重复完成重放原结果，历史规则和pins不可变。 | 5 | 3 |
| [R1-023](R1-023.md) | assessment-service | 保留明确选择的SKIPPED基线与已签canonical引用：UNVERIFIED、coverage0、评分/测得等级null；L2不生成计划，不冒充正式测评报告。 | 5 | 3 |
| [R1-024](R1-024.md) | assessment-service | 明确确认后重测建立新session/result，旧报告完整保留，只有另行确认目标/计划重排才影响现有计划。 | 5 | 3 |
| [R1-025](R1-025.md) | content-service | 将10题3/3/2/2合成fixture升级为可隔离重放、真实权利/媒体/四主体发布记录的P1定级manifest，缺听力音频不得通过G-CONTENT。 | 6 | 3 |
| [R1-026](R1-026.md) | content-service | 将已有3语法+2阅读练题绑定作为同源published五题fixture安全重放，题干公开、答案只留assessment sealed owner。 | 5 | 3 |
| [R1-027](R1-027.md) | learner-web | Web断线/刷新后从server已接受checkpoint续同session，未知结果先对账，保留当前未保存候选且身份切换取消旧回调。 | 5 | 3 |
| [R1-028](R1-028.md) | learner-web（协作 mobile） | 独立细化并验证IC-010…012/058/059的双端开题、回答、结果、快速开始、重测、错误与恢复各幕。 | 5 | 3 |
| [R1-029](R1-029.md) | QA | 独立在专属迁移空库重放L2 canonical十题→不可变报告和SKIPPED来源，验证018…028所有正负恢复分支。 | 5 | 12 |
| [R1-030](R1-030.md) | learning-service（协作 contracts/api-gateway） | 签收既有M1-013计划/今日/解释/日历/调整契约、owner、事件、不可变迁移与生成类型；复用SKIPPED归档引用，不另造baseline。 | 7 | 3 |
| [R1-031](R1-031.md) | learning-service | ensure验owner ASSESSED/SKIPPED归档来源、当前目标资格内容，冻结planningInput并建非空可执行plan；不足输入诚实失败不编分。 | 6 | 3 |
| [R1-032](R1-032.md) | learning-service | 同主体同输入同key重放原plan/input，异input同key409，natural唯一active与event/effect去重。 | 5 | 3 |
| [R1-033](R1-033.md) | learning-service | input+plan来源解释读回，home区分无计划/处理中/可学/完成/失败；SKIPPED初始安排，依赖故障不伪空。 | 5 | 3 |
| [R1-034](R1-034.md) | learning-service | 统一候选按冻结DAILY_PLAN排序/去重/四档lane/10%cap下发，保dueAt独立round/practiceRef；当前B25简单SRS不算完整planner。 | 6 | 3 |
| [R1-035](R1-035.md) | learning-service | 无plan/今日完成/无内容/无due/请求失败五reason不同CTA，不统一重测。 | 5 | 3 |
| [R1-036](R1-036.md) | learning-service | 030已签preview/confirm明确keep/replan/defer，cancel0写；历史/started/completed保留，409保dirty比较，半失败诚实恢复。 | 6 | 3 |
| [R1-037](R1-037.md) | learning-service | 双端currentplan/input/overlay同版，历史append-only、同pin異digest409，解释pin原配置。 | 5 | 3 |
| [R1-038](R1-038.md) | learning-service | 首学以owneraccepted有效task完成，未完成跨日/24h后仍续，已完成不重复引导/奖励。 | 5 | 3 |
| [R1-039](R1-039.md) | learner-web（协作 mobile/content-service/learning-service） | 书架/搜索仅合法可访问content，空/无匹配/失败分开，续真实checkpoint，strongstop不cache绕过。 | 5 | 3 |
| [R1-040](R1-040.md) | learner-web（协作 mobile） | 双端逐IC013…021/029真实plan/解释/today/调整/恢复/首学/书架所有状态与dirty保护一致。 | 6 | 3 |
| [R1-041](R1-041.md) | QA | 独立验证L3两sources四档/调整/不变history/首学货架/双端负例，仅证据发现不修实现。 | 6 | 12 |
| [R1-042](R1-042.md) | assessment-service（协作 contracts/api-gateway） | OpenAPI（sessions/items/attempts/checkpoint）＋AsyncAPI（完成事件）＋Flyway，生成 DTO/TS：逐操作比对冻结 M1-010 与当前 B10 JDBC 暴露面：canonical pre-attempt PUT session/checkpoint 尚不能被旧 attempts/{attemptId}/checkpoint 替代。 | 5 | 6 |
| [R1-043](R1-043.md) | assessment-service | 建单（内容码＋版本 pin，复用防双击）：以authenticated principal和服务端plan/task读取解析contentCode，不信任客户端version/owner；从content port取得已发布、可用且有权snapshot并pin完整字段。 | 4 | 6 |
| [R1-044](R1-044.md) | assessment-service | 语法 3 道＋阅读 2 道可练可判：从内容owner的published快照组装语法3题和阅读2题；为每题保留itemId、ruleVersion/digest与合法题型，不能用原型常量当正式题库。 | 4 | 6 |
| [R1-045](R1-045.md) | assessment-service | 作答与行内反馈（普通练习即时；定级口径待 DEC-04）`[DEC-04阻塞]`：普通练习选择按session/item稳定身份保存checkpoint；收到owner确认再显示正确/需再练与reason，不将客户端乐观状态称已保存。 | 4 | 6 |
| [R1-046](R1-046.md) | assessment-service | 检查点与断点续练`[DEC-05新增本机暂存待签收]`：PUT session/checkpoint在attempt产生前可用，验证baseStateVersion/checkpointVersion/clientSeq与digest；protectedDraft只留assessment受保护边界。 | 5 | 6 |
| [R1-047](R1-047.md) | assessment-service | 单元渲染＋完成幂等同步：加载当前session pin中的chapter/unit与内容hash，收藏/笔记/查词动作保留chapterId/anchor与snapshot，返回不跳新章节。 | 4 | 6 |
| [R1-048](R1-048.md) | assessment-service | 规则版本 pin：创建时把content owner签收ruleSet与每item ruleVersion/digest连同assessmentVersion保存到session；提交时服务端加载这些字段，不接受客户端覆盖。 | 4 | 6 |
| [R1-049](R1-049.md) | assessment-service | attempt 不可变：首次accepted保存submissionId/digest、protected answers、规则pin、source IDs与acceptedAt；判分态变化另有version，答案本身不被修改。 | 4 | 6 |
| [R1-050](R1-050.md) | assessment-service | 并发/重复提交幂等：写入前根据认证主体、聚合ID、clientEventId/operation和payloadHash查receipt，哈希相同直接返回；异hash409。 | 4 | 6 |
| [R1-051](R1-051.md) | assessment-service（协作 content-service） | 词汇详情（锁定＋去重＋测验/自评分开）：消费content owner已授权词性、双语释义、例句与真实audio安全引用；缺释义标暂无，缺media隐藏无效播放，不下载无rights资源。 | 4 | 6 |
| [R1-052](R1-052.md) | assessment-service | 听说写边界（独立草稿/两题交卷/稳定轮次）`[DEC-05新增本机暂存待签收]`：听力只有真实合法可用audio且rights有效才进入正式listen两题训练；保存两题各response，全部完成才final submit。若确有合法文本，只提供明确标记的文本学习降级，不能称听力训练/不能产生听力客观成绩或计入听力覆盖；音频缺失关闭正式听力作答/交卷入口。资源故障不计用户错答。 | 5 | 6 |
| [R1-053](R1-053.md) | assessment-service（协作 workflow-service） | 完成事件出盒（Outbox→Kafka＋DLQ）：将耐久accepted/assessed item fact与assessment.item.assessed.v2 Outbox放同一owner事务；失败回滚两者，严禁先发Kafka后commit。 | 5 | 6 |
| [R1-054](R1-054.md) | learner-web（协作 mobile） | 前端验收＋双端验收＋无障碍抽查：在固定18180/18183已获批准测试环境，以合成成人账号操作真实已发布内容；对R043…053的受影响两端路径逐页实际进入，不仅检查build。 | 5 | 7 |
| [R1-055](R1-055.md) | QA | L4 干净库重放：申请隔离空schema及Synthetic JWT/Kafka namespace；核验不存在shared数据后由既有Flyway完成全迁移，不drop/reset共享库或服务。 | 5 | 7 |
| [R1-056](R1-056.md) | learning-service（协作 contracts） | OpenAPI（mistakes/remedies/mastery）＋AsyncAPI＋Flyway，生成 DTO/TS：核对已签CONTRACT-GAP-REPAIR-VARIANT与mastery schema；将workflow state和availability独立枚举，明确sourceAssessmentEventId+itemId+projectionVersion及证据不可变引用。 | 5 | 6 |
| [R1-057](R1-057.md) | learning-service | 入本（ZERO 才入，来源可追）：只从assessment.item.assessed.v2读取已验证owner/item/outcome、eligible ZERO与errorCategory；正确题或未判分/缺内容拒绝当错题。 | 4 | 6 |
| [R1-058](R1-058.md) | learning-service | 补救生成（来源 attempt 组去重）：投影effect key固定sourceAssessmentEventId+itemId+projectionVersion；相同事实重复投递不生成第二repair task。不同合法attempt仍新增独立source事实。 | 4 | 6 |
| [R1-059](R1-059.md) | learning-service（协作 content-service） | 变式再练（skill 匹配；缺变式保留待补救）：从content owner已签内容快照/variant catalog读取相同item/skill的合法关系，仅允许LEGAL_VARIANT/CONTEXTUAL_EQUIVALENT；candidate按contentVariantRank ASC再variantId ASC。 | 4 | 6 |
| [R1-060](R1-060.md) | learning-service | 补救→D1→D7 分期（沿用冻结规则）：即时repair可信通过后D1安排为严格晚于修复localDate的首个configured studyday；从D1实际PASSlocalDate加7calendar得到nominal，再on/after滚到studyday为D7。 | 5 | 6 |
| [R1-061](R1-061.md) | learning-service | 投影更新＋弱点页：证据按evidenceId durable去重；只有非撤销客观正确且effectiveQuality>=2合格，每localDate取occurredAt最新再evidenceId决胜。不能用内存256key裁剪替代持久去重。 | 5 | 6 |
| [R1-062](R1-062.md) | learning-service | D1/D7（可信服务时钟、IANA/DST、来源去重）：从server Clock与已冻结IANA时区/weeklyStudyDays计算UTC dueAt，保存policy/pins；DST gap取首合法local time、overlap earlier offset，禁仅用客户端日期。 | 4 | 6 |
| [R1-063](R1-063.md) | learning-service | 空态（未练/全对分开）：以已验证source coverage/asOf区别NEVER_PRACTICED与ALL_CORRECT；source事实存在但projection未到位为PROCESSING，不能用[]代表已全对。 | 4 | 6 |
| [R1-064](R1-064.md) | learning-service | 跨端一致（主体＋游标＋版本）：请求subject/tenant从JWT/服务principal派生，list/detail都执行PEP；cursor绑定owner/filter/order/asOf/projectionVersion，不接受另一主体游标。 | 4 | 6 |
| [R1-065](R1-065.md) | learning-service | 中断恢复（同任务＋不重复销账）：repair读取提供当前task/session/checkpoint与pin关系；继续使用同一ID，查看旧结果只读，合法新round不挤占其它未完成checkpoint。 | 4 | 6 |
| [R1-066](R1-066.md) | learner-web（协作 mobile） | 前端验收＋双端验收：实际网页/mob错题→source→合法variant repair→D1→D7→mastery/weakness全链，以测试Clock/服务端policy跨日，不修改客户端时钟冒充due。 | 5 | 7 |
| [R1-067](R1-067.md) | QA | L5 干净库重放：在隔离干净learning schema与合法assessment源数据下，执行R056…066全链；assessment原source表只读，不复制workflow写authority。 | 5 | 7 |
| [R1-068](R1-068.md) | learning-service（协作 contracts） | OpenAPI（review queue/history）＋AsyncAPI＋Flyway，生成 DTO/TS：completeB10LearningReview为唯一public写；必需baseStateVersion/clientEventId/clientSeq/contentPin/payloadHash/sourceAssessmentAttemptId/rawQuality；禁止tenant/owner/outcome/effectiveQuality/score/mastery/stage/EF/interval/due/algorithm/pass/fail。 | 5 | 6 |
| [R1-069](R1-069.md) | learning-service | SRS入库/评分（SM2_Q03_V1，测验/自评分开）：从已接受assessment attempt/server protected interaction加载outcome，不接受client outcome；UNANSWERED/REVEALED cap0，INCORRECT min(raw,1)，GUESSED min(raw,2)，CORRECT_VERIFIED raw；NO_OBJECTIVE_EXPECTED仅server允许练习类型。 | 5 | 6 |
| [R1-070](R1-070.md) | learning-service | 到期队列/提醒（冻结学习日/IANA-DST）：serveraccepted review按原IANA/timePolicy生成due UTC；today/calendar同时读同queue fact，timezone变更不改既有dueAt。 | 6 | 6 |
| [R1-071](R1-071.md) | learning-service | 关闭自报直写（409）：保留无trusted outcome的旧自报入口409；已批准alias仅调canonical transition，不计算或写第二SRS路径。 | 4 | 6 |
| [R1-072](R1-072.md) | learning-service | 可信完成累计与窄补偿（新增撤销策略待DEC-07）：完成事实关联sourceAssessmentAttemptId、reviewId、queue item、batch和task目标集合；同一trusted review按归因规则累计一次，batch重复通知不再推进SRS/XP。 | 5 | 7 |
| [R1-073](R1-073.md) | learning-service | 历史＋回退（原因可查）：history只读immutable accepted review事实与各algorithm/timePolicy before/after；延期展示presentation overlay与canonicaldue分别说明，未来queue不作完成history。 | 4 | 6 |
| [R1-074](R1-074.md) | learning-service | 空队列（暂无/无记录/失败分开）：从owner已覆盖事实区分NEVER_LEARNED与HAS_HISTORY_NO_DUE；成功空due列表不能被说成没有学习历史。 | 4 | 6 |
| [R1-075](R1-075.md) | learning-service | 跨端一致（同 stage/版本＋去重）：canonical transition按主体/设备/聚合clientSeq及baseStateVersion执行；同event同hash原receipt，异hash/seq gap/stale/contentpin不一致明确CONFLICT。 | 4 | 6 |
| [R1-076](R1-076.md) | learner-web（协作 mobile） | 前端验收＋双端验收：实际双端due queue→active recall→quiz反馈/quality→server complete→next due/history；无due可结束/新学，不展示内部stage公式要求用户理解。 | 5 | 8 |
| [R1-077](R1-077.md) | QA | L6 干净库重放：隔离干净库经完整Flyway后运行R068…076；使用Gateway与真实source/owner facts，不直调domain替代公共链路。 | 5 | 7 |
| [R1-078](R1-078.md) | learning-service（协作 assessment-service） | 作答/错题/SRS 联合对账实现（来源覆盖＋唯一性＋最终一致；规则口径见 BC-046/055）：构建source attempt/itemAssessment→eligible mistake source/repair与eligibleSRS/mastery effect矩阵，按冻结映射规则核验是否应产生、是否一次产生、为何被抑制。 | 5 | 6 |
| [R1-079](R1-079.md) | QA | IT-4 联合重放（L4＋L5＋L6＋203）：IT4隔离环境从L4真实accepted sources开始，遍历FULL/ZERO eligible/ineligible与多源一logical的expected effects矩阵。 | 5 | 7 |
| [R1-080](R1-080.md) | learning-service（协作 assessment-service/contracts/api-gateway） | OpenAPI（reports/share）＋Flyway，生成 DTO/TS：明确assessment只写单次/placement报告；learning写DAILY/WEEKLY/PHASE；Gateway公开读按各owner路由，跨域只用现有受鉴权internal read port/已登记事件，不跨schema join。 | 5 | 6 |
| [R1-081](R1-081.md) | assessment-service | 定级报告卡（双端同版本；SKIPPED 非正式分）：读取canonical placement报告，ASSESSED给四维规则分/coverage/confidence/产品参考CEFR；每端使用相同reportId/version与已pin P1_PLACEMENT_V1 manifest，不宣称官方认证/精确词汇量。 | 4 | 6 |
| [R1-082](R1-082.md) | learning-service（协作 assessment-service） | 统计口径（范围/水位/学习日/owner accepted时长/轮次）：report key为learner/kind/[startInclusive,endExclusive)/timezone/weekStartRule/planCheckpointBoundary，sources至少learning+assessment且都有pinned watermark，缺少则PROCESSING metrics=null。 | 6 | 6 |
| [R1-083](R1-083.md) | learning-service | 教练建议（注明依据范围；依据不足给起步）：从已READY/PARTIAL pinned report及真实weakness/source rule选择可解释建议；记录suggestionRuleVersion、reportVersion、scope/source refs，不凭全历史假推断当周。 | 4 | 6 |
| [R1-084](R1-084.md) | learning-service（协作 assessment-service） | 分享深链（最小字段＋不可枚举＋撤销/有效期）：R1-080新share契约未签不开放入口；签收字段白名单/reference策略/expiry/revoke/owner后，主动预览公开字段并由用户确认，默认不公开任何字段；只用R1-080已获签收的白名单字段并由用户预览确认。 | 5 | 6 |
| [R1-085](R1-085.md) | learning-service（协作 assessment-service） | 无数据报告＋版本固定：无source coverage表示NEVER_LEARNED起步；必需watermark缺失PROCESSING metrics=null；已ready但指标无denom NOT_APPLICABLE/null；HTTP/生成失败FAILED，与0分分开。 | 4 | 6 |
| [R1-086](R1-086.md) | learner-web（协作 mobile） | 前端验收＋双端验收：实际web/mobile查看placement ASSESSED/SKIPPED、aggregate daily/weekly/phase、weakness建议与分享预览/撤销；单次assessment与learning汇总owner分别核对。 | 5 | 7 |
| [R1-087](R1-087.md) | QA | L7 干净库重放：隔离干净库运行R080…086，assessment单次/placement与learning aggregate/share按唯一owner写，跨域只合法read/event。 | 5 | 7 |
| [R1-088](R1-088.md) | content-service（协作 contracts/api-gateway） | 在既有 B9 命令模型上冻结草稿、审核、独立发布、下架/回滚与权限读的正式契约、owner 迁移和生成物，使 R1-089…101 使用同一版本；不另造演示 REST 或简审。 | 6 | 5 |
| [R1-089](R1-089.md) | content-service | 实现合法内容建稿、保存与 owner 版权提案绑定，使用 aggregate stateVersion CAS；保留旧发布快照，冲突时保留本地输入供显式比较。 | 5 | 5 |
| [R1-090](R1-090.md) | content-service | 内容后台请求先鉴权再查资源；无权限403和跨tenant拒绝不泄漏存在性，所有直达/替代入口都采用相同服务端PEP。 | 5 | 5 |
| [R1-091](R1-091.md) | content-service | 送审前收集所有资格缺项并409一次返回；校验报告/版权/媒体均精确绑定本版/hash，合格稿才 DRAFT→IN_REVIEW，不采用静态演示补齐。 | 5 | 5 |
| [R1-092](R1-092.md) | content-service | 两级正负向审核以不同作者/L1/L2主体、本版hash/reviewVersion顺序执行；负向必填理由保留不可变历史并产新DRAFT整改，当前已发布快照不受影响。 | 6 | 6 |
| [R1-093](R1-093.md) | content-service | 仅第四名发布运营能对本版双审APPROVED发独立PUBLISH；事务记PUBLISHED+pointer+canonical事实，公共目录异步同步状态另读。 | 5 | 5 |
| [R1-094](R1-094.md) | content-service | 可观察发布事实与公共/学习目录异步投影的区别；采用 contentEpoch/projectionVersion 拒旧/跨版事件，恢复后真实读回一致再显示已同步。 | 5 | 5 |
| [R1-095](R1-095.md) | content-service | 普通下架与rights/security/legal强停分开确认；命令锁当前发布目标和stateVersion，强停保存原因/actor/time/command/audit并禁旧会话与媒体，普通恢复不能解除禁供。 | 6 | 6 |
| [R1-096](R1-096.md) | content-service | 只将曾正式发布且当前仍合格的历史版本作为回滚候选，记录恢复点后原子重指针；强停、永久退役、版权过期、签名/媒体失效不能恢复。 | 5 | 5 |
| [R1-097](R1-097.md) | content-service | 准备并验证旧 B3 113+2 精确对象的一次性下线包；只有获得具体清单、可恢复备份和单独执行授权后才操作，禁止按数量猜测或全量清理。 | 6 | 4 |
| [R1-098](R1-098.md) | content-service | 学习会话 SESSION_START 固定contentVersionId/versionNumber；普通升级不偷换旧pin，强停精准UNAVAILABLE并给替代动作，历史答题可读不等于可重新分发。 | 5 | 5 |
| [R1-099](R1-099.md) | admin-ops-service（协作 iam-service） | 正式admin独立IAM会话登录/刷新/登出与深链returnTo；仅允许本后台白名单且二次permission检查，刷新失败回登录并清内存token。 | 5 | 5 |
| [R1-100](R1-100.md) | admin-ops-service | dashboard仅显示当前主体获准的owner投影指标，明确metricCode/version/period/generatedAt/source与stale；未知/失败/无权不能变0，钻取再鉴权。 | 5 | 5 |
| [R1-101](R1-101.md) | admin-ops-service（协作 iam-service） | permissions页以iam.policy.read只读展示角色/权限/资源及policy版本来源；明确无匹配与无权/失败，不提供CRUD/授权写。 | 5 | 5 |
| [R1-102](R1-102.md) | admin-web | 独立验收正式admin内容/审核/发布/下架回滚/权限交互；覆盖理由/版本冲突、保存失败输入保留、异步取消、四主体独立发布、强停禁恢复，失败返责任卡。 | 5 | 8 |
| [R1-103](R1-103.md) | QA | 隔离IT6正式重放本版资格、双审正负链、第四主体PUBLISH、投影、强停和合格回滚，独立核owner/事件/审计；单审核账号只提供拒绝证据。 | 6 | 6 |
| [R1-104](R1-104.md) | admin-ops-service（协作 learner.privacy/IAM/audit/workflow/contracts） | 冻结R1治理/support/privacy/audit/观测/recovery/release门的严格只读owner契约、Gateway与生成类型；admin授权BFF不能成为privacy owner或跨域写者。 | 6 | 5 |
| [R1-105](R1-105.md) | admin-ops-service | 只读风险案件及来源归档/锁定/隔离/升级/关闭事实，显示真实version/audit和受限上下文；不开放BC-085/088/089/090处置写。 | 5 | 6 |
| [R1-106](R1-106.md) | admin-ops-service | 读取受控低UGC举报队列的脱敏owner投影，游标分页/过滤来源状态；匿名401和scope正确，BC-094处置写维持R3。 | 5 | 6 |
| [R1-107](R1-107.md) | admin-ops-service | 本人和授权客服读同ticket/version/assignment及CLEAN六字段safePreviewRef/附件；legacyhash-only明确不足，升级目标理由与实际接收receipt真实区分，所有support写归R2。 | 6 | 7 |
| [R1-108](R1-108.md) | learner-service.privacy（协作 IAM/workflow/admin授权读投影） | 只读learner.privacy导出与IAM删除生命周期/168h冷静期/撤回资格/ownerreceipts和全会话撤销；半失败不标ANONYMIZED，worker写与新政策归R2。 | 6 | 7 |
| [R1-109](R1-109.md) | audit-service | 只读观测将Gateway/owner的401/403/失败包络与requestId/traceId/auditId关联，可给脱敏支持编号；unknown关联不捏造，无Token/密码/原文。 | 5 | 6 |
| [R1-110](R1-110.md) | workflow-service | 只读Saga步骤/ownerreceipts/Outbox重试/DLQ状态与安全关联，区分业务成功/补偿成功/未完成/人工恢复；不触发重试补偿或跨owner写。 | 5 | 6 |
| [R1-111](R1-111.md) | workflow-service | 只读发布门的真实探针/SBOM/兼容窗口/回滚演练证据与source commit/environment；缺、过期或不匹配证据不能标可发布，不执行发布评估写。 | 5 | 6 |
| [R1-112](R1-112.md) | audit-service | 审计列表按授权tenant/resource范围稳定分页/过滤与字段脱敏，immutable事实来源清楚，policy源可读；审计导出internal-only且独立授权，无公开分享。 | 6 | 6 |
| [R1-113](R1-113.md) | admin-web（协作 learner-web/mobile/learner.privacy/IAM） | 独立验收R1管理治理/客服/举报/隐私/审计及学习端支持隐私所有适用只读IC；本人/跨tenant/失败/刷新恢复可证，writeGate隐藏且读PASS不关闭完整写链AC。 | 6 | 8 |
| [R1-114](R1-114.md) | QA | 对R1-001…113所有适用切片进行当前commit隔离重放、独立Review和证据归档；按真正read/write/Gate范围批准，失败返卡，未测保留GAP，不继承历史任务/PASS。 | 6 | 8 |
