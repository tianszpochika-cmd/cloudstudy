# IT-1 / IT-2 验收矩阵（独立审查基线）

审查基线：2026-10-10，HEAD 69bea68b44b2c8c6c6dbdcdb38c0b955a458aaf1。起始工作区 clean。  
阶段：第一阶段只读审查。本文是可审计的 AC 与证据矩阵，不是 ACCEPT 签收。没有启动服务、浏览器、Docker、SQL 或测试；没有改业务代码或旧状态文件。  
范围：仅 R1-001…017 / IT-1 和 R1-018…029 / IT-2。旧 114 卡墙及原 R1-001 完整验收原件继续 OPEN；这不阻止对当前 R1-001 源码范围重新验收。

## 判定口径与现状

dev-plan-R1.md 的站点门禁是 IT-1 全卡真实验收、干净库全绿并签收后才能进入 IT-2。CURRENT-HANDOFF.md 也写明 IT-2 未开工；但 CURRENT-PROGRESS.md 同时出现“IT-2 已按继续推进开工”和“不得越站跳入 IT-2”。依门禁，现有 R1-018…029 产物可作为卡级候选证据审核，不能追认 IT-2 已正式开站。当前状态：IT-1 FAIL（发现范围内硬阻塞）；IT-2 BLOCKED（依赖 IT-1 签收），其既有证据另有可复用片段与确定缺陷。

历史结论按卡范围引用，不自动升级为站点结论。R1-002、003、004、005、006、008 在进度页称有 Luna 独立终审；正式复用前仍要确认被测源与本次 HEAD 一致。R1-007 是实现/单测交付；R1-009…029 多数只有调度审查或作者运行报告，不能当独立 ACCEPT。作者报告里的 PASS 仅说明对应产物声称完成了什么，独立审查须对源、原始 HTTP/DB 事实和缺口重新核验。

截图只证明画面。浏览器证据若要证明注册到定级的动作链，需记录同一真实浏览器会话中连续点击、页面变化与对应请求/响应（requestId/traceId 或可核验的关联），并核对实际 owner 数据；孤立截图、源码断言、静态原型和服务直连都不能替代这条链。缺实现按对应 AC 判 FAIL，不得只因没运行而标成 NOT_RUN。

## IT-1：R1-001…017（BC-001…012/201/202；IC-002…009/052…057）

| 卡 / AC 来源 | 出站需要的真实证据（UI → API → owner DB；必要负向） | 现有可复用证据与本轮复核要求 |
|---|---|---|
| R1-001 / BC-001, IC-001：官网 11 页诚实目录与注册 CTA | 真实官网双视口逐页核 11 个 canonical path 返回 200、空态/文案；实际点击注册 CTA 到学习端注册页，记录跳转与页面请求。 | 10-07 R1-001 只有 SOURCE_SCOPED_PASS：11 路由/双视口与官网局部投影证据可按源哈希复用；截图和路由直达不证明 CTA 点击链。当前源需复核，原 114 墙及原 001 完整验收仍 OPEN，但不是本次当前源验收的额外门槛。 |
| R1-002 / BC-002, IC-052：成人账号注册，只有受限会话 | 从真实注册表单提交合成凭据到 IAM 的 TLS 入口；201 后由 IAM 专库读到账户、principal、device、session 与 audit；验 JWT 签发者/RS256/权限不含学习权限。负向：审计失败/缺字段/冲突不新增半套身份。 | 10-08 有 Luna 独立终审及专库/Gateway/PEP 收据，可复用同源行为。致命差异：当前 Web/Mobile 登录、注册、重置都从 Gateway base URL 发请求，默认地址为 HTTP Gateway；没有分开的 IAM 认证 base URL，当前真实 UI 路径不是直达 IAM TLS。详见下文“IT-1 当前硬阻塞”。脚本直连 IAM TLS 不能证明页面合规。 |
| R1-003 / BC-003：注册幂等回放 | 同键同体返回同一 session/device/account；同键异体 409 不建第二账号；缺幂等键拒绝。IAM DB 账号/幂等行读回。 | 10-09 R1-IAM-LIFECYCLE 报告与 Luna 终审可复用，前提是签名源文件未变。需在本次 UI 链确认浏览器走了实际合规 IAM TLS 入口；当前客户端路径未满足。 |
| R1-004 / BC-004, IC-053：登录、刷新轮换、撤销与重放 | 正确/错误密码真实登录；Refresh Cookie 轮换、旧 refresh 重放使会话撤销；logout 后 access/refresh 均拒绝。核 Cookie 属性和 IAM session DB。 | 10-09 R1-IAM-LIFECYCLE 的旋转、重放、撤销负例可复用；本次只需对齐源码/配置及入口。密钥、密码与 token 不得进入证据。 |
| R1-005 / BC-005：多设备与踢出 | A/B 两设备登录；各自列表仅一个当前设备；A 踢 B 后 B 的 access/refresh 401，A 仍有效；读 IAM session/device 状态。 | 10-09 生命周期收据可复用同源卡级断言；当前跨端真实页面列表/踢出动作需复验其可达性及 API 关联。 |
| R1-006 / BC-006, IC-055：成人门服务端判定 | 合成年龄提交后，成人和未成年各有一条独立用例；成人 PASSED/ELIGIBLE，未成年 REJECTED/RESTRICTED，审计 DENY，账号/会话仍可访问受限账号功能；DB 不储完整生日。负向：未成年改成年年份重提不得晋级。 | 10-09 生命周期报告含 clean IAM DB 与审计事实，可复用卡级路径；表单对稿与点击链需本次浏览器复验。 |
| R1-007 / BC-007, IC-005：门未过等待态 | 未成年登录后账号、支持、隐私说明和退出仍可用；学习入口解释受限且不可点击，服务端学习口 403；无循环登录或诱导改年龄。 | 双端单测/交付可用于定位；没有真实浏览器/真机页面证据，需本轮验 UI 与 403。 |
| R1-008 / BC-008, IC-006/056：先读发布版本再记录三项必要同意 | UI 三项逐项未勾选起始；先读当前发布版本再由用户逐项确认；IAM DB 保存主体/用途/版本/状态和审计；新登录资格更新。负向：旧版本 409 不脏写，缺键/非法决策 400。 | 10-09 生命周期收据和 Luna 卡级终审可复用动态版本/负例；当前 UI 版本文本、勾选初态与请求关联需实机复核。现有来源提示只读到一份 consentState.version，不可宣称三项各有独立发布版本。 |
| R1-009 / BC-009：撤回并回收能力 | 已登录主体撤回 ADULT_LEARNING；IAM 撤回历史追加、账号仍 ACTIVE、历史不删；拿撤回前仍有效 token 调 learner 画像/目标等学习口得 403。复检打开；IAM 复检不可达/非 200也 fail closed。 | 10-09 R1-009 有专用 IAM/learner schemas 与撤回后 403；可复用当时 local-candidate 剖面结果。需复核默认复检配置、当前 IAM 动态事实，并将 UI 请求同 request/DB 关联。报告承认 B25 403 body 是框架 Forbidden、隐私导出未复检；不得扩大为所有账号能力都 403。 |
| R1-010 / BC-010/202, IC-057：目标与每天时长落库/读回/续填 | UI 选择合法目标/时长并保存；learner 专库 learner_goal/profile/outbox 读回规范码、时长、版本；重进表单真实回填。负向：门/同意不满足 403 且零写；无目标 GET 404；幂等异体/过期版本 409，非法字段不落库。 | 10-09 R1-010 的 HTTP/SQL 正反例可复用字段行为。确认源码缺陷：b9-learner.openapi.json 的 PUT /targets 要求 B9IfMatch 且 expectedStateVersion 精确匹配；LearnerHttpController.java:126-137 只绑定 request body 和 Idempotency-Key，没有读取 If-Match，Web/Mobile 调用也只发 expectedStateVersion。必须把漏/错 If-Match 验证为 FAIL，不能以 body 版本锁替代契约头。缺少停服务后再读的证据也需补。 |
| R1-011 / BC-011, IC-009：按服务端状态续步到定级 | 一个新合成账号从现有 UI 真走成人门→三同意→目标→已保存回填→assessment 页面，依赖 GET gate/consent/targets 的服务端事实决定下一步；刷新或中断后续步正确。 | 10-09 R1-011 有双端纯函数/假 HTTP 测试，没有真实新号完整链；现路由存在和测评页可打开只能证明路由，不证明向导点击、事实读取和回跳。必须本轮浏览器实走。 |
| R1-012 / BC-012, IC-007/054：密码重置不枚举 | 同一个界面分别提交存在与不存在的 identifier，均 202、公开文案/稳定字段一致；IAM 专库中无账号请求不建 challenge，有账号请求只存不可逆摘要；空白/缺字段 400。 | 10-09 R1-012 HTTP 与 SQL 正负例可复用同源卡级行为。密码重置确认错误返回 401，但作者报告称公开 errorCode 为 INTERNAL_ERROR；若该确认幕进入验收须登记此契约缺陷，不能冒充稳定错误码已通过。 |
| R1-013 / BC-201：拒绝后的重进边界 | 未成年 REJECTED 后换键、提交成年年份仍 REJECTED，retryAllowed=false；退出/再登录仍是受限会话；账号 ACTIVE、无删除请求、无生日落库、仅 DENY 审计。 | 10-09 R1-013 HTTP/SQL 可复用状态机事实；其报告没有启动 learner，因此不能作为“画像未删”的事实证据。 |
| R1-014 / R1-001…013：L1 干净库重放 | 在本次源码与隔离空 schema 上重放卡级 API/DB 必要断言并得到明细；需含依赖门，不能把前端卡或全链未跑项计绿。 | 10-09 R1-014 为同库后端 21/21；明确未跑 001 官网、007 Mobile 门、011 新号真实续步等。可复用确实覆盖的 HTTP/DB 步骤；不能作为 14 卡全绿或站点验收。 |
| R1-015 / IC-052…054：注册、登录、重置三页幕验收 | 三页真浏览器逐幕验字段校验、提交中、成功/错误文案、回到安全登录/继续；各请求连接到相应 IAM API 和身份数据。 | CURRENT-PROGRESS 提到调度审查通过；本审查搜索范围未找到 R1-015 具名报告/运行收据。仅作线索，需补可追溯现源证据。 |
| R1-016 / IC-055/056：门说明与逐项同意文案 | 真实页面只收出生年份；三项初始均未勾选；发布版本可读时展示真实版本；读不到时禁提交并解释；拒绝仍能账号设置/支持/退出。 | 10-09 R1-016 是源码/单测说明，作者明确没有浏览器对稿；需真实可见性和提交拦截复验。DEC-02 未批，不能把未批准正文或可选分析/语音授权说成已同意。 |
| R1-017 / IC-057/009：画像回填、定级 CTA、首页引导条 | 真实 UI 保存后刷新回填规范码；主 CTA 进入已有 assessment 页面；引导条按实际未完成步骤缩小，完成后只按真实进入状态收起。 | 10-09 R1-017 有源码/单测，作者明确没有浏览器或真机；需在 IT-1 真实链中查看目标、引导条、CTA 和路径。 |
| IT-1 站点汇总 | 连续真实浏览器旅程从官网/注册页到成人门、三同意、画像读回、定级入口；每步关联 IAM/learner owner DB；门未过/同意撤回/错误账号等适用负例均服务端拒绝。三个 schema 独立，IAM 本人签发 RS256，服务端同意复检开启。 | 10-10 IT-1-exit 的 10/10 HTTP 链与三个专库可复用为 API/DB 基础候选，但脚本直连服务，浏览器只打开并截图 /register，没做全链；其读口为 EMPTY，不是新定级会话。由于真实前端认证目前经 Gateway 且默认 HTTP，站点门当前 FAIL。 |

## IT-1 当前硬阻塞：认证凭据实际路径不符合边界

本次源码复核发现真实学习端没有直达 IAM 的独立认证传输路径：

- Web 的 stores/session.ts:107-111 用 getGatewayBaseUrl() 创建 auth adapter；auth/gateway-auth.ts:157-179 的 login/register/password reset 均通过该 client 请求 /auth/*。
- Mobile 的 stores/session.ts:74 创建 Gateway auth adapter；auth/gateway-auth.ts:143-171 用 mobileApiClient 发 login/register/password-reset；api/client.ts 从 Gateway base URL 构造请求。
- 两端 gateway.ts 的默认 URL 是 http://127.0.0.1:18070/api/v1，且没有独立 IAM/auth base URL 配置。Gateway 路由规则明确将 register、login、password reset 接到 iam-service；所以浏览器交出的账号密码先到 Gateway，再被转发，默认本地链路还使用 HTTP。
- iam-service 的 application.yaml 默认 issuer 为 http://127.0.0.1:18087；application-local.yaml 未配置 TLS。IT-1-exit 的 Node 收据虽然使用直连 IAM 自签 TLS，但这只是脚本探针，不是 Web/Mobile 业务 UI 认证路径，也不能证明浏览器证书校验、CORS 或 Secure Cookie。

AGENTS.md 明确规定账号密码只能直接提交至 IAM 的 TLS 认证入口。当前 UI 的 Gateway 代理不能以同一 token/响应结果等价替代。若使用直 IAM，必须提供有证书校验的 IAM HTTPS 地址、Web 与 Mobile 的独立 auth base URL、仅允许的精确 CORS origin/credential/preflight 设置，并让浏览器真实请求证明密码请求目标是 IAM；移动端还需确认系统安全存储，无普通 storage fallback。此项是 IT-1 范围 FAIL，因此 IT-1 不能签收，IT-2 不能开站。

当前源码复核锚点：
- apps/learner-web/src/auth/gateway-auth.ts:143-179，apps/learner-web/src/stores/session.ts:107-111，apps/learner-web/src/platform/gateway.ts:1
- apps/mobile/src/auth/gateway-auth.ts:141-172，apps/mobile/src/stores/session.ts:74，apps/mobile/src/api/client.ts:1-4，apps/mobile/src/platform/gateway.ts:1
- services/api-gateway/.../GatewayRoutePolicy.java:133-137，GatewayRouteExecutionPolicy.java:459-465
- services/iam-service/src/main/resources/application.yaml:10-16,73；application-local.yaml

## IT-2：R1-018…029（BC-013…022；IC-010…012/058/059）

| 卡 / AC 来源 | 出站需要的真实证据（UI → Gateway → owner API → DB；必要负向） | 现有可复用证据与本轮复核要求 |
|---|---|---|
| R1-018 / BC-013, IC-010/058：P1 新开题 | 学习门满足后经 Gateway POST /assessment/placement/sessions，assessment 专库建 session 并从 content owner 取 10 题；用户响应只含题干选项，不含标准答案/解析。门/同意未过应 403 且不读银行、不建 session；库存少于 10 应 503 且不泄露残余题干。 | R1-029 在一个隔离测试 schema 中回放了 content/learner/assessment 的数据/API 子集；它依次重命名该 schema 的 Flyway history 表来完成三服务迁移，**不是三个独立 owner schema/user**，不能复用为隔离证明。其 JWKS 是临时源、同意复检由 loop stub 提供、没有真实 IAM，不能证明 IAM 签名或动态撤回事实。R1-018 自身报告没有浏览器与 content 实库。另有运行字段 items 未进入已发布 B10PlacementSession 严格 schema，需先关闭契约差异。 |
| R1-019 / BC-019：B25 旧口退写、保留会话只读 | Gateway 的旧 POST /assessment/placement/start 必须 404 且无上游请求；旧 GET 可读已有会话；新 sessions POST 仍可用。站点链不能再用其他旧 B25 写口提交 P1 答案或跳过。 | 当前代码确实把旧 POST start 从 Gateway 投影删掉，R1-029 有真实 Gateway 404 候选证据；R1-019 报告明确 POST /placement/submit-step 与 POST /placement/skip 仍被转发，B25AssessmentJdbcController.java:126、166 仍是写处理器，GatewayRouteExecutionPolicy.java:603-604 仍外露。R1-027/028 的学习端仍用 submit-step；R1-023 报告说 skip 仍是 B25 请求且不带 P1 sessionId。旧 start 单项 404 可复用，整体 P1 答题/跳过路径不得用旧写口冒充完成。 |
| R1-020 / BC-014, IC-011/059：顺序与版本锁 checkpoint | 真实新会话逐题写 assessment owner DB；接受序号与 stateVersion 递增，断线/重复请求重放同键只回原回执；超前、落后、旧版本、同版本并发 409 且 checkpoint 不变。 | R1-029 真 MySQL 回放覆盖部分乱序/旧版本 409 与正确顺序读回，可复用满足这些断言的原始 SQL/HTTP。R1-020 自身报告明确 V9 未打真实 MySQL；R1-029 运行可补其迁移/库内部分。仍需当前源与真实 IAM token、浏览器写请求确认；契约没有已发布 acceptedSequence/nextSequence，须关 contract gap。 |
| R1-021 / BC-015, IC-011：服务端规则判分 | 10 题使用 content owner 的答案规则；每题反馈只有 FULL/ZERO 与允许解释，响应、日志、页面均无正确答案；乱序不判分不写；无权限服务令牌 403，非 service/错误 service id 拒绝。核 assessment DB 原始 correct、判分与审计事实。 | R1-029 有 FULL/ZERO 与答案不泄漏的真实库候选证据；R1-021 报告承认服务 token 是配置项而非 IAM 现场签发，密封/receipt schema 未补 outcome/explanation。必须用 IAM 实际签发且权限受限的 service token 重验，关闭 contract gap；测试桩或自配置 JWT 不可签收。 |
| R1-022 / BC-016, IC-012：不可变报告快照 | 完成第 10 题后报告落一行且有稳定 reportId/digest；重读同一正文/摘要；重复完成或换键不能重复/改写；未完成不出报告。 | R1-029 同库报告与重读 same body 可复用数据库断言。R1-022 报告指出当前结果形状与发布 B10PlacementReport 冲突（digest 与 reportDigest、answerRulePin），完成事件 schema 仍要求旧 pin 且没有新无答案事件。须在 UI 前关闭契约/事件边界并基于当前契约重验。 |
| R1-023 / BC-017, IC-010/058：跳过定级的 SKIPPED 基线 | 用户真实点跳过后创建 P1 会话基线 SKIPPED/USER_SKIP，无成绩、无报告；同键回放一条；已完成报告后跳过 409 且摘要不变。 | R1-029 有服务端正负例候选结果；R1-023 报告确认当前 learner 跳过仍走 POST /assessment/placement/skip 的 B25 旧口、请求没有 P1 sessionId，不能将 P1 会话置为 SKIPPED。真实 UI 路径仍未打通，契约也未更新。作为 IT-2 学习闭环属 FAIL。 |
| R1-024 / BC-018, IC-012：重测另开 session、保留旧报告 | 完成报告页点击重测，经公开 Gateway 到 assessment owner 新建 session；新 session 从题 1 起、旧 session/attempt/report/digest 全保留；未完成/无报告 409 且不写新行。 | R1-029 仅通过 assessment internal 路径证实服务内 retest；public-retest-route-observation 实际记录 Gateway 404。当前 P1PlacementJdbcController.java:339 有内部 retest，Gateway 执行投影未发布它；Web AssessmentPage.vue 报告卡和 Mobile assessment.vue 都渲染 disabled 的“重测尚未接通”。这是已确认缺实现，验收判 FAIL，不能登记 NOT_RUN。 |
| R1-025 / BC-020：定级 10 题种子 | content-service 独立 schema Flyway 后恰有 10 行，3/3/2/2；sealed 内部 API 下发成功且不含 answer/correctOption；少于 10 时 503 且不泄露题干。 | R1-025 自身在独立 content schema `r1_025_cnt_20261010_6e7dace4` 做了种子与 sealed 内部 API 下发验收，可复用其 10 行数据/接口行为候选证据；这与 R1-029 的同库顺序回放是两份不同证据，不能混称 R1-029 有独立 content owner schema。核当前 migration 与运行镜像/源码一致。不要以内容 seed 代表 learner catalog 已开放。 |
| R1-026 / BC-021：B3 5 道干题绑定 | content owner 表 5 个 practice items，响应只含 stem/options/practiceRef，不含 answerRule；LEARNER rights 未具备时目录仍空、请求 403。 | R1-026 的内容库 SQL/API 结果可复用。报告清楚声明 rights 只允许 SEALED、LEARNER catalog 为 0，故只能签数据种子范围，不能当真实学习内容可用证明。 |
| R1-027 / BC-022, IC-059：断网后服务端 checkpoint 恢复 | 浏览器开始真实 10 题会话；制造真实网络中断/刷新或关闭再打开；已服务端接收答案通过 GET 回到下一题，未确认选择不被标已保存；断网期间不得 POST 新会话或用旧 checkpoint 覆盖新状态。 | R1-027/R1-028 只有源码解析单测并明言没有浏览器/真机；R1-029 也没有断网。需真正中断浏览器网络并记录连续恢复过程、请求与 DB checkpoint。只运行 source test 不算此 AC。 |
| R1-028 / IC-010…012/058/059：引导、作答、反馈、报告、重试幕对稿 | 真 Web/Mobile 实机显示 10 题说明、进度和未提交态；通过操作展示真实 FULL/ZERO、完成报告与回今日/计划入口；报告重测次按钮调用真实可用 API，旧报告保持。 | R1-028 仅源码/单测，并明确无 browser/pass。当前 Web 与 Mobile 重测按钮在源码上 disabled，状态可静态确认；不能作为点击幕 PASS。报告 CTA 仍是“查看今日状态”而 IC-012 写“生成我的计划”，记为待产品/契约裁定的幕间差异。 |
| R1-029 / R1-018…028：L2 干净库重放 | 对 R1-018…028 的当前源与专库执行完整重放，结果无 FAIL/NOT_RUN；测试身份、实际服务发行版、数据库 schema、网关、IAM 与浏览器均绑定同一轮。 | 当前 R1-029 报告为 PASS_WITH_NOT_RUN：26 PASS、3 NOT_RUN、0 FAIL；步骤中公开重测实际返回 404（这是已观察到的缺路由缺陷，不能因原作者将步骤标为 NOT_RUN 而当作未知）；完整浏览器链和重测按钮连接未执行。三个领域服务是在同一隔离 schema 上依次迁移，改名 Flyway history 表来避免历史冲突；这提供内容/learner/assessment 数据与 API 子集的候选行为证据，但不证明独立 owner schema/user。IAM 使用临时 JWKS、同意复检使用 loop stub。无法作为服务隔离、站点全绿或独立签收证据。 |

## IT-2 站点运行门槛（仅卡范围所需）

1. 正式开始 IT-2 前，先由独立审核者签收 IT-1；本矩阵建立时此条件不满足。
2. IT-2 闭环至少要由 learner-web/移动端真实页面经 Gateway 请求实际 content、assessment、learner owner；用各服务独立 MySQL schema/user。iam-service 必须真实运行并签发 RS256 user/service JWT；JWKS、issuer、audience、权限与审计可验。禁止临时 JWKS、手工 token、loop stub 或直接跳过服务端 PEP。
3. learner 的 consent recheck 在生产默认和本轮环境保持开启；由 IAM 专库撤回事实驱动已签 token 的 403，IAM 不可达或事实/版本不确定时 fail closed。注册/未成人/无必要同意都不得造学习会话。
4. R1-019 的 public POST /placement/start 404 只覆盖旧开题；检查迁移后所有旧写口。现状 submit-step 与 skip 仍被 Gateway 转发，不能让新 P1 UI 经这些旧口写 B25 owner。
5. 对 R1-018/020/021/022/023/024 的 response/receipt/report/event 与 packages/contracts OpenAPI/AsyncAPI 严格一致；已知运行形状 items、acceptedSequence/nextSequence、outcome/explanation、digest/reportDigest 差异须先关契约缺口。跨服务只通过 owner API/event，不直写别域表。
6. R1-027 真实断网恢复和 R1-024 可用的公开重测按钮/路由必须现场证明；公开重测现为 404，页面按钮 disabled，属确认 FAIL。
7. 测试主体必须合成。证据不得包含密码、refresh/access token、签名私钥、service secret、完整答案密钥或真实隐私。Web access token 仅内存；Refresh token 为 HttpOnly/Secure/SameSite Cookie；移动端只用 Keychain/Keystore，不得普通 storage fallback。
8. 端口按 config/local-ports.json：Gateway 18070、IAM 18087、learner 18088、content 18089、assessment 18091、learner-web 18180、Mobile H5 18183、MySQL 13306；仅 loopback。每次执行前核 fixed-port ownership，服务启用 strictPort，不自动递增或改端口；不得 down/prune 或碰不属于本轮的容器。2026-10-10 调度方报告本轮相关端口空闲，但本文没有启动或重新检查端口。

