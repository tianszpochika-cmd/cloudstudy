# 逐页只读浏览器验收

`qa-pages.cjs` 只访问现有静态服务，在新浏览器上下文里操作合成数据；不启动服务、不改端口、不写源码、不接后台或真实外部服务。全部 JSON、下载与截图写 `.git/codex-local-backups/pages-qa-*`，每轮保留。

## 执行与证据

- 完整模式运行 `node docs/06-design/v2-980plus/redesign/mockups/webDemo/shared/qa-pages.cjs`。
- 设置 `QA_SKIP_MATRIX=1` 仅真实操作；设置 `QA_MATRIX_ONLY=1` 仅矩阵；两者不同时设置。可用 `DEMO_QA_ORIGIN` 指定已存在的原始同源服务器。
- reducedMotion 避免动效瞬态误判。管理页通过合成登录，未来页明确开启预览；测试不注入业务角色/完成事实。Fixture 通过产品提供的 DemoUI 切换，不写正常档案。
- 哈希包含数据/行为/页面/样式/两个入口；前后漂移会记 PARTIAL，不能升级为 PASS。
- 最终冻结集中终验：`pages-qa-1791716251915/report.json`，**4068 渲染组合 + 88/88 实际操作 PASS、0 问题/浏览器错误/外部请求/源码漂移、退出码 0**。共 44 组/端（mobile 390、learner-web 1280），不是 88 个独立页面。包括原生hash及同页render失败保留同一节点、恢复后读回，以及真实发布正文的恶意HTML/远程图片语法只能显示文本。
- 旧正常收据 `pages-qa-1791714921208/report.json` 为4068 +56；后续源码修正后的 `1791715350254`、`1791715675350`、`1791715862672`、`1791715923437` 均记录 PARTIAL_SOURCE_DRIFT，不能迁移为最终PASS。最终包固定当前入口与安全正文渲染的哈希。
- 失败原件保留：`1791714370180`、`1791714639381`、`1791715091779`、`1791715158513`、`1791715601551`、`1791716161725`。分别包含管理刷新需显式重登、跨账号选择上下文、采集器按钮/异步/重复选择器、周日无题组前提；新增刷新导致真实管理重登审计发生在fixture快照之后（改为明确重登后再开始隔离测量）。安全正文首轮的选择器同时匹配打开/收藏，也保留FAIL；改精确课程打开handler后真实采集通过。最终修订不删失败报告、不弱化可操作/实体/事实断言。

## 矩阵与业务操作分开

学习端：91 × 6 状态 ×（mobile390、desktop1280/1440）×亮/暗 = **3276**；独立后台：33 × 6 ×1280/1440×亮/暗 = **792**。总计4068。检查实际 route、文本、横向溢出、可见且enabled出口；PW empty实体计数0、full计数30与正文真实表单。后台详情构造真实模型实体ID，保留hash/标题；独立后台无 dataset.route 契约。

这只是每个组合的渲染和出口检查。业务通过只能使用下方真实输入/点击/结果/刷新用例；没有借助渲染矩阵给所有动作盖章。管理授权、安全审计、AI/支付/K12在本包仅为本机合成事实，不代表正式服务验收。

## 91 路由主要操作追溯

下表是组合脚本的覆盖关系，不把另一脚本历史结果迁移成当前PASS。主链和secondary由主审集中运行/核验最新哈希。本脚本自己的记录在上述88组原件；24 PW均已在数据迁移后真实复跑（13组/端）。页面拥有多个分支时，表中已执行主操作不能替代全部边界。

| route | 覆盖脚本 | 真实主操作/出口与断言 |
|---|---|---|
| login | 主链 qa-flow | 注册/登录、成人门、三项主动同意、目标预览保存、首次学习测评入口 |
| register | 主链 qa-flow | 注册/登录、成人门、三项主动同意、目标预览保存、首次学习测评入口 |
| reset | qa-pages | reset-request-and-complete：合成重置请求与本机完成 |
| gate | 主链 qa-flow | 注册/登录、成人门、三项主动同意、目标预览保存、首次学习测评入口 |
| onboard | 主链 qa-flow | 注册/登录、成人门、三项主动同意、目标预览保存、首次学习测评入口 |
| placement | 主链 qa-flow | 五题真实作答→报告→查看计划→生成安排 |
| report | 主链 qa-flow | 五题真实作答→报告→查看计划→生成安排 |
| home | qa-pages | home-primary-resumes-actual-task：实际点击续学出口，不提前记完成 |
| today | 主链 qa-flow | 今日题组选择→逐题提交→独立结果→错题匹配变式补救 |
| courses | 主链 qa-flow | 今日题组选择→逐题提交→独立结果→错题匹配变式补救 |
| practice | 主链 qa-flow | 今日题组选择→逐题提交→独立结果→错题匹配变式补救 |
| mistakes | 主链 qa-flow | 今日题组选择→逐题提交→独立结果→错题匹配变式补救 |
| srs | qa-secondary | 释义→评分→撤销→重做→刷新结果和原到期事实 |
| weekly | qa-pages | history-result-calendar-weekly-original-context：结果来源ID、回当天回顾、结束学习、日历周报精确日期 |
| world | 主链 qa-flow + qa-secondary | 撤销/组员加入退出/设置保存/主动撤回即拒绝学习/撤回后仍可提交本人工单 |
| league | qa-secondary | 退出本人排名、消息分类全标已读、独立通知、无障碍重载/恢复、本人旧工单筛选详情返回 |
| games | qa-pages | games-primary-five-original-questions-and-single-result：五题实际点击→5/5→刷新单结果 |
| space | qa-pages | primary-exit-space：真实点击对应业务出口（介绍、只读或拒绝页） |
| subs | qa-secondary | 失败支付原单重试、unknown查询不重复下单、续订取消保留本期权益、退款/票据分别读回 |
| native | qa-pages | native-four-synthetic-installs-persist-and-deduplicate：四种形态模拟/重载/去重 |
| rewards | qa-pages | workflow-reward-wallet-and-avatar-exchange-deduplicate：真实本机完成→领取、试穿不扣分、兑换扣40/去重/装备刷新 |
| achieve | qa-pages | primary-exit-achieve：真实点击对应业务出口（介绍、只读或拒绝页） |
| avatar | qa-pages | workflow-reward-wallet-and-avatar-exchange-deduplicate：真实本机完成→领取、试穿不扣分、兑换扣40/去重/装备刷新 |
| msgs | qa-secondary | 退出本人排名、消息分类全标已读、独立通知、无障碍重载/恢复、本人旧工单筛选详情返回 |
| me | qa-pages | primary-exit-me：真实点击对应业务出口（介绍、只读或拒绝页） |
| about | qa-pages | primary-exit-about：真实点击对应业务出口（介绍、只读或拒绝页） |
| settings | 主链 qa-flow + qa-secondary | 撤销/组员加入退出/设置保存/主动撤回即拒绝学习/撤回后仍可提交本人工单 |
| devices | 主链 qa-flow + qa-secondary | 撤销/组员加入退出/设置保存/主动撤回即拒绝学习/撤回后仍可提交本人工单 |
| privacy | 主链 qa-flow + qa-secondary | 撤销/组员加入退出/设置保存/主动撤回即拒绝学习/撤回后仍可提交本人工单 |
| support | 主链 qa-flow + qa-secondary | 撤销/组员加入退出/设置保存/主动撤回即拒绝学习/撤回后仍可提交本人工单 |
| search | qa-secondary | 实时搜索→匹配词汇结果、历史刷新读回、无匹配诚实空态 |
| commerce | qa-secondary | 失败支付原单重试、unknown查询不重复下单、续订取消保留本期权益、退款/票据分别读回 |
| admin | qa-pages | workflow-admin-aperm-readonly-exit：真实合成登录、权限只读与返回工作台 |
| aperm | qa-pages | workflow-admin-aperm-readonly-exit：真实合成登录、权限只读与返回工作台 |
| adraft | qa-pages | workflow-content-return-two-reviewers-independent-publish：新建/送审/原因退回/保存重送/不同初终审/独立发布/刷新；另强停旧学习链接 |
| areview | qa-pages | workflow-content-return-two-reviewers-independent-publish：新建/送审/原因退回/保存重送/不同初终审/独立发布/刷新；另强停旧学习链接 |
| apublish | qa-pages | workflow-content-return-two-reviewers-independent-publish：新建/送审/原因退回/保存重送/不同初终审/独立发布/刷新；另强停旧学习链接 |
| agov | qa-pages | workflow-report-risk-owner-target-reception-close：举报原因建档、受理隔离、不同目标升级、目标接收后关闭 |
| aaudit | qa-pages | workflow-audit-filter-detail-download：实体审计筛选、详情展开、真实下载仅合成JSON |
| alogin | qa-pages | workflow-admin-aperm-readonly-exit：真实合成登录、权限只读与返回工作台 |
| amedia | qa-pages | workflow-media-metadata-failure-retry-bind：合成文件元信息、失败/恢复/绑定实体 |
| acs | qa-pages | workflow-ticket-authorized-escalation-full-lifecycle：新工单、接单回复、目标+原因升级、接收/解决/关闭/重开 |
| ashop | qa-pages | workflow-refund-return-resubmit-dual-review-channel-recovery：申请、退回补正、不同财务双审、渠道失败/恢复、资金权益分别验证 |
| areport | qa-pages | workflow-report-risk-owner-target-reception-close：举报原因建档、受理隔离、不同目标升级、目标接收后关闭 |
| aobs | qa-pages | workflow-observation-failure-named-recovery-receipt：任务故障/恢复回执与命名演练审计，不操作服务 |
| ai | qa-pages | workflow-ai-gate-stop-recover-timeout-retry-adopt：明确预览+主动同意、输入/停止/恢复/采纳/超时/重试（固定原创响应） |
| voice | qa-pages | workflow-voice-failure-retry-score-delete：失败无评分、恢复完成才有固定评分、历史删除；无录音 |
| k12 | qa-pages | workflow-k12-explicit-synthetic-consent-teacher-budget-withdraw：虚构确认/教师核验/任务/原创答题/版权失效/撤回立即拒绝，历史保留 |
| aigate | qa-pages | workflow-ai-gate-stop-recover-timeout-retry-adopt：明确预览+主动同意、输入/停止/恢复/采纳/超时/重试（固定原创响应） |
| aiflow | qa-pages | workflow-ai-gate-stop-recover-timeout-retry-adopt：明确预览+主动同意、输入/停止/恢复/采纳/超时/重试（固定原创响应） |
| vscore | qa-pages | workflow-voice-failure-retry-score-delete：失败无评分、恢复完成才有固定评分、历史删除；无录音 |
| k12guard | qa-pages | workflow-k12-explicit-synthetic-consent-teacher-budget-withdraw：虚构确认/教师核验/任务/原创答题/版权失效/撤回立即拒绝，历史保留 |
| k12course | qa-pages | workflow-k12-explicit-synthetic-consent-teacher-budget-withdraw：虚构确认/教师核验/任务/原创答题/版权失效/撤回立即拒绝，历史保留 |
| tdetail | qa-secondary | 退出本人排名、消息分类全标已读、独立通知、无障碍重载/恢复、本人旧工单筛选详情返回 |
| paudio | qa-pages | audio-retention-preference-enable-clear-persist：偏好开/清/刷新，不存真实音频 |
| pay | qa-secondary | 失败支付原单重试、unknown查询不重复下单、续订取消保留本期权益、退款/票据分别读回 |
| a11y | qa-secondary | 退出本人排名、消息分类全标已读、独立通知、无障碍重载/恢复、本人旧工单筛选详情返回 |
| arrears | qa-pages | primary-exit-arrears：真实点击对应业务出口（介绍、只读或拒绝页） |
| celebrate | qa-pages | primary-exit-celebrate：真实点击对应业务出口（介绍、只读或拒绝页） |
| offlinet | qa-pages | primary-exit-offlinet：真实点击对应业务出口（介绍、只读或拒绝页） |
| pgen | 主链 qa-flow | 五题真实作答→报告→查看计划→生成安排 |
| planexp | qa-pages | primary-exit-planexp：真实点击对应业务出口（介绍、只读或拒绝页） |
| session | qa-pages | primary-exit-session：真实点击对应业务出口（介绍、只读或拒绝页） |
| mastery | qa-pages | primary-exit-mastery：真实点击对应业务出口（介绍、只读或拒绝页） |
| pfault | qa-pages | primary-exit-pfault：真实点击对应业务出口（介绍、只读或拒绝页） |
| npref | qa-secondary | 退出本人排名、消息分类全标已读、独立通知、无障碍重载/恢复、本人旧工单筛选详情返回 |
| firstlearn | 主链 qa-flow | 注册/登录、成人门、三项主动同意、目标预览保存、首次学习测评入口 |
| greject | qa-pages | primary-exit-greject：真实点击对应业务出口（介绍、只读或拒绝页） |
| cupgrade | qa-pages | primary-exit-cupgrade：真实点击对应业务出口（介绍、只读或拒绝页） |
| vocab | 主链 qa-flow + qa-secondary | 真实搜索词义、词义答题、加入复习、三词任务；模式切换不改原错答 |
| listening | 主链 qa-flow + qa-secondary | 字幕/速度、真实两题材料理解、错答结果保存与去重 |
| speaking | qa-secondary + qa-pages | 三模式自练记录与查看去重；奖励源为实际非导入自练完成 |
| writing | 主链 qa-flow | 固定规则拒绝不足格式→修改→确认提交→结果读回 |
| offpkg | qa-pages | offline-download-pause-resume-delete-keeps-records：暂停不增长/续传/删除包保留学习记录 |
| refund | qa-secondary | 失败支付原单重试、unknown查询不重复下单、续订取消保留本期权益、退款/票据分别读回 |
| shelf | qa-pages + 主链 qa-flow | 章节笔记保存/刷新、完成、收藏列表与精确原始章节返回 |
| book | qa-pages + 主链 qa-flow | 章节笔记保存/刷新、完成、收藏列表与精确原始章节返回 |
| chapter | qa-pages + 主链 qa-flow | 章节笔记保存/刷新、完成、收藏列表与精确原始章节返回 |
| drill | 主链 qa-flow + qa-secondary | 真实搜索词义、词义答题、加入复习、三词任务；模式切换不改原错答 |
| wordbook | 主链 qa-flow + qa-secondary | 真实搜索词义、词义答题、加入复习、三词任务；模式切换不改原错答 |
| phonics | qa-secondary | 六组实际展开、具体音素文本示范派发；不证明扬声器可听 |
| alphabet | qa-pages | workflow-alphabet-marker-three-real-answers-persist：选择字母/掌握标记/三题拼读答案/刷新 |
| lab | qa-pages | lab-explicit-synthetic-day-and-failure-switch：明确推进/恢复日期与失败开关 |
| recap | qa-pages | history-result-calendar-weekly-original-context：结果来源ID、回当天回顾、结束学习、日历周报精确日期 |
| history | qa-pages | history-result-calendar-weekly-original-context：结果来源ID、回当天回顾、结束学习、日历周报精确日期 |
| result | qa-pages | history-result-calendar-weekly-original-context：结果来源ID、回当天回顾、结束学习、日历周报精确日期 |
| plan | qa-pages | plan-preview-cancel-confirm-preserves-records：预览/取消不改事实，确认修改/重载并保留完成记录 |
| calendar | qa-pages | history-result-calendar-weekly-original-context：结果来源ID、回当天回顾、结束学习、日历周报精确日期 |
| reviewqueue | qa-pages | reviewqueue-primary-budget-entry-retains-source-dates：点击预算安排→今日，原复习到期日不变 |
| collections | qa-pages + 主链 qa-flow | 章节笔记保存/刷新、完成、收藏列表与精确原始章节返回 |
| words | 主链 qa-flow + qa-secondary | 真实搜索词义、词义答题、加入复习、三词任务；模式切换不改原错答 |

## 输入与事实失败保护

本脚本另有内容/AI/工单/退款原因未提交输入的导航→返回→刷新→显式重登、实体/账号隔离、角色/未来重绘测试；QuotaExceeded 时同页render必须保持同一input节点；按钮及原生hash都必须仍在原页、hash回旧route、可见文本保留、无成功提示、恢复存储后可导航且读回。empty/full 真实创建使用临时key，正常档案原始字节不变。旧DOM的key/route/entity在渲染时固定，账号/fixture切换不能把旧输入写入新档案。发布桥只用历史快照、强停后旧章节链接拒绝且正文不泄出。恶意HTML/script/远程Markdown图从建稿→退回重送→双审→发布→学习章节完整落地后硬断言无执行节点/标志、无远程请求、无横向溢出。

## 仍需分别验收

- 不验证文本示范实际听感、设备麦克风、native安装、真实离线下载或外部官网可用性。
- 颜色对比、视觉层次、触达面积和焦点由独立视觉QA记录；此矩阵的无溢出不等于逐页视觉完美。
- 真实身份、服务器幂等/审计/权限、AI模型、RTC、资金/权益、未成年人合规和迁移交付不属于静态预览完成声明。
