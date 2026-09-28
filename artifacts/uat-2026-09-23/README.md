# 四端 Phase 1 全量验收推进记录（2026-09-23）

> **最新接手快照（2026-09-26 14:46 CST）**：[四端测试接手报告](../uat-2026-09-26/README.md)。本文件保存 9 月 23 日起的分批验收记录；文中各批“服务就绪”和“当前”只对该批当时环境成立。9 月 25 日 Batch24 所在私有 UAT 容器栈已于 9 月 26 日停止；当前供浏览器测试的是本机源码构建的主机 Java 进程和四端开发服务。最新本机实测新增合成成人注册/登录正向证据，同时复现首页 503、阅读 Gateway 预检 403/普通 GET 404；详见[登录冒烟](../uat-2026-09-26/local-latest-runtime/login-smoke/summary.md)与[阅读诊断](../uat-2026-09-26/local-latest-runtime/reading-diagnosis/summary.md)。最近完整 56 项判定仍为 **PASS 0 / PARTIAL 29 / BLOCKED 27 / NOT_TESTED 0**，没有因局部成功上调整页验收状态（本文件与覆盖台账均为严格整页业务验收口径；并列存在的[56 PAGE-P1 三态总表](../../docs/07-operations/page-push-ledger-2026-09-26.md)是另一套代理侧三态口径，2026-09-28 v10 为 PASS 40 / HONEST-EMPTY 16 / BLOCKED 0，两者数字不可互相换算、互不替代）。

## 判定口径

按[全端页面功能登记册](../../docs/06-design/v2-980plus/phase1-business-operation/03-全端页面功能登记册.md)的 **56 个 PAGE-P1 页面族**逐项检查；状态与证据见[覆盖台账](coverage-ledger.md)：**PASS 0、PARTIAL 29、BLOCKED 27、NOT_TESTED 0**。每个页面族已有实际操作或明确断路证据，尚无可判全功能通过的页面族。页面可达、HTTP 200、测试通过、数据行数和镜像存在，均不能单独代表业务功能通过。验收同时看用户操作、Gateway/owner 路由、持久化事实、数据来源、错误恢复和跨端效果。

本轮业务实测主要是本机 16 个 Java 服务与四个前端开发服务。[第十批](batch10-runtime.md)已将 Gateway/IAM 修复换入本地 JAR，16/16 健康，离线包真实 Gateway/owner 38/38 回归通过；第十二批 Docker 私有栈 19/19 HTTP 健康、四端 11/11 私有 HTTPS 浏览器入口返回 200。移动首页及“今日”深链先前的导航脚本异常在第十二批复测为 0，登录/注册/重置往返可操作；正式同意文件缺失，登录后跳回深链仍无正向证据。镜像构建、服务健康和页面 HTTP 200 均不能代替完整业务验收。[构建记录](docker-build-batch.md)与[隔离 Docker 运行证据](docker-isolated-full-runtime.md)分开记录。公网匿名入口的 200 仅是可达性证据，见[部署入口烟测](deployed-endpoint-smoke.md)。

**第十四批（20:58 CST）**集中构建并仅在私有 Docker 替换游戏化服务、学习 Web、管理 Web、移动 H5：19/19 私网健康、四端 11/11 浏览器入口、B4 14/14 匿名拒绝、管理治理/策略权限四组匿名视口均安全转登录。[B4 任务/成就/赛季真实性](b4-reward-truth-and-http-boundary.md)和[装扮权属](b4-avatar-entitlement-gate.md)改为无可信事实时空态/拒绝；[管理策略版本](admin-permissions-readonly.md)新增只读子页，治理页移除未接通写按钮。服务/契约和局部 UI 测试通过，但没有正式法律文档的私有 IAM 不能产生合法授权会话，以上 **不提升 56 个 PAGE ID 的 PASS 数**；真实任务、版权内容、奖励装备、管理写链仍未闭合。运行细节见[隔离 Docker 第十四批](docker-isolated-full-runtime.md)。

**第十五批（22:18 CST）**集中构建 Gateway、social owner、管理 Web 与官网四镜像，只替换隔离 Docker 的四个容器。私网健康 **19/19**、四端浏览器入口 **11/11**，无页面脚本错误或横向溢出。官网公开投影中英文均从内部 Gateway 返回 `empty`、公开课程 0；桌面与 390px 课程页显示清晰空态，无旧错误横幅。[官网 BFF 修复](batch15-official-bff-fix.md)收束了公开/内部地址和故障缓存。管理端[举报队列只读链](batch15-b12-moderation-read.md)已补精确 Gateway GET、社群 owner 权限、脱敏与游标翻页；私有运行仅能证实匿名 GET 401、POST 404 及登录页保护，无法证明授权管理员读写。上述仍维持 **PASS 0、PARTIAL 29、BLOCKED 27**，详见[第十五批隔离运行](docker-isolated-full-runtime.md)。

**第十七批（2026-09-25）**在私有 Docker 集中替换官网、content owner、学习 Web、移动 H5，19/19 健康与 11 项 HTTPS 入口通过；中英文公开课程仍为真实 0 项，移动“今日、设置、设备”三个匿名深链均安全回登录。官网进一步交互脚本发现移动学习链接仍指向访问者本机 `127.0.0.1:18183`；源码构建参数已修，待下一批镜像复测。ACTIVE 同意文档仍为 0，授权业务正向链未通过，页面族维持 **PASS 0、PARTIAL 29、BLOCKED 27**。详见[第十七批隔离报告](../uat-2026-09-25/batch17-isolated-uat.md)。

**第十八批（2026-09-25）**仅在私有 Docker 替换官网、移动 H5，保留 IAM V17；19/19 就绪、四端 11 项 HTTPS 页面与 11 项 CORS、官网 11 组交互和 152 组布局均通过。手机免费开始/登录链接已从访客本机修为移动域名；三个移动匿名深链仍能安全回登录。ACTIVE 同意文档仍为 0，公开课程仍为空，不能提升授权业务页面结论；页面族维持 **PASS 0、PARTIAL 29、BLOCKED 27**。详见[第十八批隔离报告](../uat-2026-09-25/batch18-isolated-uat.md)。

**第十九批（2026-09-25）**在私有完整备份、13 owner 停写和迁移验证后，下线 113 条旧 B3 及两条孤立词条，部署 canonical 通知偏好 owner、IAM 权限与双端设置入口。五镜像促升后 19/19 就绪，四端匿名 11 项、B11 深链 9 项及管理匿名保护检查通过；Gateway/owner 匿名通知偏好均 401。授权设置和真实学习闭环仍因缺 ACTIVE 正式同意文档、内容及运行证据而未验，页面族维持 **PASS 0、PARTIAL 29、BLOCKED 27**。详见[第十九批隔离报告](../uat-2026-09-25/batch19-isolated-uat.md)。

**第二十批（2026-09-25）**在同一私有 Docker 项目只替换 Gateway、管理 Web、移动 H5 三个镜像；其他 23 个容器身份及共享项目指纹不变，19/19 就绪。语法精确列表 GET 匿名请求由 404 变为 401，管理审计导出按 M1-017 internal-only 契约保持关闭；四端匿名浏览器 11/11、JWKS CORS 11/11，页面错误、请求失败和溢出均为 0。管理语言切换器中文→英文→中文往返在 390/1280px 均通过（2/2），移动 390px 截图已目视复核。无 ACTIVE 正式同意文档、无可发布语法内容、无审计导出审批/脱敏/存储链，未形成正向授权业务证据；56 项仍 **PASS 0、PARTIAL 29、BLOCKED 27**。详见[第二十批隔离报告](../uat-2026-09-25/batch20-isolated-uat.md)。

**第二十一批（2026-09-25）**在同一私有 Docker 项目只替换学习 Web 与管理 Web，其他 24 个服务容器身份和共享项目指纹不变，19/19 就绪。四端匿名浏览器 11 个入口/登录页样本加两条深链为 13/13 HTTP/JWKS、2/2 回跳目标，零页面错误、失败请求、溢出和破图；四端 390px 截图已目视复核。学习 Web 通知写后回读、部分失败重试和 B12 跨账号显示已做局部测试；管理登录回跳有会话存储异常恢复。官网本地 25/25 网站测试、11 组交互与 152 组布局断言通过，开发态 HMR 错误单独保留。没有合法授权业务或正式内容正向证据，页面族仍 **PASS 0、PARTIAL 29、BLOCKED 27**。详见[第二十一批隔离报告](../uat-2026-09-25/batch21-isolated-uat.md)。

**第二十二至二十四批（2026-09-25，私有容器历史记录）**：[第二十二批](../uat-2026-09-25/batch22-isolated-uat.md)替换社交服务和两端学习前端，四端匿名 16/16 HTTP/CORS，但移动社交深链出现 1 个脚本错误，M1014 举报契约仍不齐；[第二十三批](../uat-2026-09-25/batch23-isolated-uat.md)仅替换两端学习前端，四端匿名 26/26 HTTP/JWKS 与登录/注册导航局部通过，先前深链脚本错误未复现；[第二十四批](../uat-2026-09-25/batch24-isolated-uat.md)逐项替换四端前端，公开页面 24/24、JWKS CORS 18/18、合成错误提示 4/4。独立截图仍发现两端重置页英文/深色偏好丢失、学习 Web 窄屏字标隐藏。三批都未取得正式同意、可信内容及授权学习闭环；第二十四批时私有库 ACTIVE 文书、canonical 内容、已发布站点投影仍为 0。**这些是当时的私有容器证据，该栈 9 月 26 日已停止。**56 项整页判定不变。

后续专项复测于 **11:45 CST** 将 learner、content、learning、assessment 的成人准入 PEP 一次性换入本地运行栈，详见[成人准入第三批复测](adult-gate-batch3-runtime.md)。**13:12 CST** 又集中构建并部署七个 Java 服务，见[第四批运行回归](batch4-runtime.md)。**14:20 CST** 完成 Gateway、IAM、content、assessment 四个 JAR 与三处迁移的[第五批部署和真实请求回归](batch5-runtime.md)：16 个服务就绪、内容草稿并发拒绝通过、定级五路由拒绝/失败关闭矩阵通过。**15:10 CST** 的[第六批运行回归](batch6-runtime.md)将内容自动校验和媒体 V7/激活拒绝边界换入本机，内容 19 项、媒体 21 项 Gateway 检查通过。**15:57 CST** 的[第七批工作流回归](batch7-workflow-runtime.md)备份并应用 Workflow V2，补精确管理员权限与错误响应，Gateway/owner 22/22 检查通过。第十批已开始隔离 Docker 运行复测，范围和阻断见[容器报告](docker-isolated-full-runtime.md)。专项审计确认[非本地成人 Gate 与法律文档版本链](iam-production-gate-gap.md)缺可信年龄证据和正式文档发布事实，为生产闭环 P0/P1 阻断；本地通过不代表非本地可注册学习。[评测契约对齐](assessment-contract-permission-alignment.md)已统一 13 个可执行方法的 owner/权限，`daily-stream` 设计与运行副作用冲突仍保留。

| 系统 | 本轮已实测与修复 | 当前可确认的边界 | 主要未通过项 |
| --- | --- | --- | --- |
| 官网 | 当前运行进程的 19 个公开地址、11 组交互、152 组布局/主题重新通过浏览器回归，页面/Console 错误 0；公开投影与公告、公示页复核。精确下线 31 条误导性或缺字段的本地站点夹具。 | 本地公开投影课程 0、公告 0、下载渠道 3、公示 2；Web 卡的本机浏览器入口已补 URL。[现行浏览器回归](official-current-uat.md)、[公开数据核查](public-site-truth.md) | 真实可授权课程、获批方案、可下载客户端与正式公示版本仍缺发布事实；本机 `/start` 不是公网安装包。 |
| 学习 Web | 合成成人注册、登录、同意、目标及客服提交曾经 Gateway 实测；32/320px 及受保护路由巡检。入学、测评、首页、今日任务、技能错误态与设备/隐私误导操作做了小批界面修复；消息/偏好已与移动端做真实往返。第十二批听力页收紧授权播放及无音频控件，私有浏览器 B11 九条匿名路径均转登录且保留 redirect。 | 设备列表与踢出、消息已读/IN_APP 偏好经浏览器、Gateway、owner 和持久化验证；新账号首日无计划时明确显示 503/重试。[首日复测](learner-first-day-followup.md)、[消息复测](messages-notifications-followup.md)、[设备会话实测](learner-devices-privacy-live.md) | canonical 十题定级、规划/真实任务、五技能、媒体、可信 SRS、隐私导出/删除、报告和离线链仍未闭合；B11 真实播放/听写缺正向证据。 |
| 管理 Web | 授权 staff 曾读取客服工单、学员资料和审计列表；工作台/订单页在 1280/390px 完成真实浏览器加载、刷新、筛选、错误态。只读账号的退款入口和两处假成功入口已关闭。内容库经 UI 创建/编辑草稿；第五批 Gateway 复测过期保存 409、100+3 两页列表 200。客服在隔离 74 条演示记录后重测 27 条列表、分页、只读详情、中文筛选和三档布局。 | 所测读取和草稿链局部通过；400 条合成统计行及 5 条固定管理投影已隔离，平台指标与订单现在均 200/诚实空态，真实事件链仍未验。[统计隔离](analytics-fixture-quarantine.md)、[订单夹具隔离](admin-projection-fixture-quarantine.md)、[内容工作台](admin-content-uat.md)、[双审发布边界](admin-review-publish-boundary.md)、[媒体工作台缺口](admin-media-boundary.md)、[客服浏览器实测](support-admin-ui-acceptance.md)。 | 七态工单命令、审计导出、真实支付/退款、治理队列、可核验版权的内容双审/发布及媒体上传处理均未形成完整授权 UI→Gateway→owner 写入证据。 |
| 移动 H5 | 31 页 × 5 组视口/主题的合成夹具渲染；独立新账号完成注册、Gate、三项同意、目标、重新登录及首页/学习/资料页真实浏览器操作；消息、已读与设置中的站内通知偏好另经真实双端复测。 | 本地社群 100 个合成房间已隔离，新账号 320/390px 真实空态 35/35；离线包 GET/CORS 第十批本地与私有 Docker 负边界已修复。第十二批私有 Docker 首页/“今日”深链 pageerror 均为 0，五步登录/注册/重置往返通过，外部装饰图请求为 0；[移动真实复测](mobile-gate-home-uat.md)、[离线路由](offline-package-gateway-live.md)、[私有浏览器](docker-isolated-full-runtime.md)各有独立证据。 | 首日计划/任务、真实领域通知与登录后深链、原生 App、iPad、小程序、离线下载/同步、麦克风和真实播放器均未验收；正式 ACTIVE 法律文档缺失阻断私有栈正向登录。 |

## 已完成的分批修复

- 两端修正同意前分流、目标保存顺序和丢失响应重试；缩短提示、消除测评重复错误与首页假进度，未获已发布内容引用的任务不能进入或标记完成。移动 390px 首页说明与按钮布局已复核。[首日链路](first-day-gap.md)、[首日 UI](first-day-ui-polish.md)
- 公开商品目录只展示已获批准且支付门禁开放的项目；官网使用规范公开 `plans` 投影。content 服务公开站点字段校验和发布职责隔离、learner 首日缺规划事实不报 READY；旧 SRS 与游戏的假成绩/奖励入口已在源码收束为拒绝或未核验，授权运行复测仍待补齐。[公开数据](public-site-truth.md)、[SRS](srs-integrity-gap.md)、[成长与消息](growth-notification-gap.md)
- 本地数据库精确将 31 条假站点卡或缺字段公告、140 条 `local-real-10x-v1` B3 学习材料与 10 条 B2 词块设为未发布；固定假签名且没有分片地址的离线包设为删除态。可控制的种子源同步保持这些状态，保留原行供追溯。另有 113 条已发布 B3 材料缺正式版本关联、但与 233 条学习交互有关，本轮未整批撤下；需逐项审校和迁移。[可见数据核查](visible-data-truth.md)、[剩余发布数据审计](remaining-published-data-audit.md)、[媒体真实性](media-object-integrity.md)
- 管理内容库对 11 条无版本定义逐条扫 173 张现行 owner 表后，仅备份并清理 3 条没有外部引用的 REPRO/T14 草稿探针及其精确子行；当前内容定义 103、无版本 8。余下 8 条有公开投影、评测、审核或发布关联，不能仅凭探针名称删除。[内容数据核查](admin-content-data-truth.md)
- 管理统计四张表各 100 条本地合成记录已完整备份并从平台租户隔离到专用测试租户；工作台与历史/近 30 天指标读显示诚实空态，不能当作真实指标闭环。[统计隔离与浏览器复验](analytics-fixture-quarantine.md)
- 管理端五条固定本地演示投影经备份后移入专用测试租户，原来误导的 `PAID` 订单不再展示；订单页经真实浏览器验证 200/空态。[固定投影隔离](admin-projection-fixture-quarantine.md) 客服 101 条原始工单中 74 条明确合成数据也经备份精确隔离；平台仍有 27 条本地 owner/UAT 工单，Gateway 授权列表 200/27、fixture 详情 404，工单处置写链未通过。[客服工单来源审计](support-ticket-provenance-quarantine.md)
- 修复学习世界种子向**所有**活跃主体扩散的脚本入口，现要求显式指定一个已注册的本地合成账号。旧版影响 167 个主体；其中 104 个成人 Gate 未通过。对这 104 个主体的 1,560 条精确匹配假事实已先备份再于单个事务删除；仅复核类 734 条、已通过 Gate 的 63 个主体的 905 条精确候选、104 个画像的成人/同意标记均未改。备份与回滚边界见[污染修复记录](seed-contamination-repair.md)。
- media-service 不再签发 MinIO 无法识别的假地址，缺对象版本或存储校验值时拒发；第六批还修复了未上传字节却能标记 `ACTIVE` 的问题，无对象存储时激活 503 且零写入。旧数据 5 个对象只有 3 个字节大小与散列一致，且全部缺版本及存储 SHA，当前仍不能播放。Docker full overlay 已补七个领域服务的 MySQL profile 及一次性 owner 迁移门禁；私有栈已启动，但媒体正向链尚未验。[对象核查](media-object-integrity.md)、[第六批运行回归](batch6-runtime.md)、[隔离容器复测](docker-isolated-full-runtime.md)
- 社群六张表的 100 个合成房间及 501 条子行、排行榜 381 条固定种子投影分别完整备份后精确隔离，均有独立 post-check、SHA-256 与逐列恢复路径；普通账号关联的那条排行榜投影也符合旧固定 20 分种子，仅移动该投影，不修改账号。[社群数据隔离](../audit-2026-09-23/social-room-fixtures/README.md)、[排行榜独立审查](social-leaderboard-fixture-review.md)。真实社群正向房间/专注/榜单尚无可信材料可验。

## 仍阻断完整验收的链路

1. **定级与首日**：canonical 五条定级路由已在本地 Gateway/owner 接通，匿名/准入/权限拒绝和缺正式题源的 503 零写入矩阵已验；正式目标 pin、已授权十题内容/答案规则快照和真实 201→十题→报告链仍缺，旧两题不能代替。目标事件未产生不可变规划输入、计划或真实今日任务。[新五路由运行矩阵](p1-placement-live/report.md)、[定级缺口](assessment-gap.md)、[首日](first-day-gap.md)
2. **学习与媒体**：语法、写作、听力、阅读、音标旧前缀 owner 冲突，Gateway 404；旧内部判分靠固定词或非空答案。媒体对象、权利、字幕和客户端播放器尚无闭环；旧 SRS 自报写入已拒绝，但可信 transition 及报告未完成。[技能](skills-gap.md)、[媒体/学习](media-learning-gap.md)、[SRS](srs-integrity-gap.md)
3. **管理与可信数据**：客服七态写命令、审计导出、治理队列及内容发布写链没有正式运行证据；旧合成数据仍可能出现在受保护列表。种子污染的剩余 734 条仅复核行、63 个已通过 Gate 主体的混合活动，以及不可信的画像标记仍需分辨，不能用行数或“拟真”标题掩盖。[管理端](admin-gap.md)、[客服](support-workflow-gap.md)、[污染修复](seed-contamination-repair.md)
4. **契约与发布**：B10 错题、B26 人工恢复与 Saga 补偿、内容自动校验及媒体元数据写入的现行片段已合并；媒体上传地址按无成功路径精确失败关闭。第十八批源码将 B3 语法目录的精确 GET 权限元数据和 Gateway 规则合入 canonical OpenAPI，并同步设备时间字段的真实语义描述；`contracts:merge:check` 与 `contracts:generate:check` 通过。冻结 Gateway 基线仍有多条既有规则漂移，不能把契约同步等同于运行路由或功能可用。[契约门禁](contract-validation-gate.md)、[媒体上传边界](media-upload-url-contract-boundary.md)、[工作流实测](batch7-workflow-runtime.md)。正式版权、独立审核、音频字节、支付和法律发布 Gate 均缺完整证据。

## 本地运行与复测边界

2026-09-23 **13:12 CST** 的[第四批集中部署](batch4-runtime.md)更新七个本地 Boot JAR；**14:20 CST** 的[第五批集中部署](batch5-runtime.md)在备份与迁移后更新 Gateway、IAM、content、assessment。**15:10 CST** 的[第六批](batch6-runtime.md)应用 media V7 并更新 content/media；**15:57 CST** 的[第七批](batch7-workflow-runtime.md)应用 workflow V2 并更新 workflow。**16:57 CST** 的[第八批](batch8-runtime.md)更新 IAM/assessment；**17:50 CST** 的[第九批](batch9-runtime.md)更新 content；第十批更新 Gateway/IAM 并复测离线包 38/38。16/16 本机 Java 服务按各自健康路径就绪，四端前端仍在固定端口；内容 19 项、媒体 21 项、工作流 22 项、B10 边界 26 项、IAM 删除边界 29 项及管理发布负边界 23 项真实 Gateway/owner 回归各在其限定范围内通过。正式评测、账号删除、正向发布及媒体真实上传播放仍未通过。早批 Java/前端定向测试与这些运行证据不能互相替代。Docker 私有栈已做入口、匿名/拒绝和 IAM 原子性验证，完整业务 E2E 仍阻断；完整契约校验已通过，Gateway 冻结路由检查仍失败。

要把页面族改判 PASS，仍需使用合法授权账号验证页面操作、Gateway、owner 持久化、回执、失败恢复与跨端表现；涉及版权/独立审核的材料在证据齐备前保持未发布。移动原生、iPad、小程序及公网容器内行为尚未被本地 H5 或服务健康检查覆盖。本索引是当前失败与修复证据，不是“可人工全部验收”的完成证明。

[下一批共享依赖与任务拆分](next-wave-dependencies.md)列出契约/Gateway、成人 Gate 与 owner PEP、内容媒体双审、canonical 定级、首日编排和客服状态机的依赖关系；需按真实链路逐项收口。
