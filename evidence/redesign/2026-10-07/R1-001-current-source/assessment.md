# R1-001 当前源只读评估（2026-10-07）

结论：`CURRENT_SOURCE_GAPS_FOUND`。现有官网不是 R1-001 的“课程准备中 + 去注册 CTA”交付。旧测试 26/26 PASS，记录的是九月实现及边界；当前源重验不恢复原机器验收、不迁移 ACCEPTED。

源码：`ff0f8057f4088ead03ab7890493cdf9d06f6d5f1`；官网最后路径提交 `8a689ec5c7fca3dd753d972db10057cc768437c8`（2026-09-26）；官网与官网 i18n 当前无差量。45 个显式源文件摘要、运行进程见 [source-provenance.json](source-provenance.json)。PID 9008 为本仓库官网 Nuxt dev，固定 `127.0.0.1:18182 --strictPort`，2026-10-06 21:47:40 启动。未启动或重启服务。dev 无不可变 build/source manifest 接口，进程 cwd + HEAD/文件摘要只能绑定本次当前源观察，不能替代生产镜像证明。

## 11 页的明确来源与计数区别

权威候选集合来自 `docs/06-design/v2-980plus/phase1-business-operation/03-全端页面功能登记册.md:48..58` 的 **canonical route** 列：`/ /courses /pricing /download /announcements /about /compliance /status /privacy /terms /minors`。`evidence/live/2026-09-26/page-sweep/official/summary.json` 的 11 路由双视口扫描与其一致，只作路线来源佐证，不能导入 R1 验收。详细逐路由、PAGE ID、源行与现观察见 [route-scope.json](route-scope.json)。页面登记册的“缺失”栏是旧盘点，不覆盖当前路由实测。

| 来源 | 数值与含义 | 使用边界 |
|---|---|---|
| R1 计划第12行 / BC-001第56行 | 官网11页；R1要求双视口200及课程准备中+去注册 | 数量明确，卡自身未列URL |
| IC-001第46行 | 首页/课程/价格3类；无内容说准备中、无真收费不放购买 | 不是11路由清单 |
| PAGE登记册第48..58行 | 11个 canonical route | 本次具名11路由候选来源 |
| redesign README第25行 | 官网11页静态原型汇总 | 本地 redesign/mockups 未找到独立官网11路由manifest；静态交付不验收正式app |
| 正式 publicRoutes | 19个地址 = 13静态直达 + 6学习方法详情 | 不含 /pricing、/download；包含 /world /method /start /help，范围不同 |
| Nuxt pages 当前文件 | 16模板 = 15静态（含2个301）+1动态详情 | 枚举六方法详情后共21地址，不能与模板/卡数换算 |
| 官网README | 14类页面、19公开内容地址 | 14类与13静态+1动态模板相符；两别名不算公开索引，不是R1的11页替代物 |

主审若采用“11原地址直接200”，两别名301不算通过。若希望保留别名，必须明确修改卡适用性，不能把最终200改记为原路由200。本报告保留原计划，不自行签范围变更。

## 实测与缺口

使用 frontend-testing-debugging 技能。会话没有 Browser 插件技能，使用已有 Playwright 1.63.0 与已安装 Google Chrome 154.0.8037.98；未安装浏览器。默认 Chromium 首次缺缓存失败，原失败见 [browser-default-launch.log](browser-default-launch.log)，随后显式 channel=chrome 成功。

双视口 `1280×900` / `390×844`，每个11路由实际 GET。22/22非空、0框架错误覆盖层、0脚本/console异常、0横向溢出；18/22原路由直接200，4/22为301→200（价格和下载各两次）。截图与原始文本见 [browser-observation.json](browser-observation.json)；人工查看电脑课程页及手机开放情况截图，未进行全站视觉/主题/a11y或真机验收。

| 发现 | 源证据 / 运行证据 | 最小建议 |
|---|---|---|
| 缺去注册CTA | SiteStartButton固定/start；start主按钮/#practice-example；两视口实际点击相同路径，0 register/login链接，显示“学习账号注册与登录暂不可用。” | 复用受控 public-links 构造到 learner-web /register 的CTA；官网不接收密码/保存token；保留无需登录示例为次级 |
| 价格、下载不直达200 | pages/pricing.vue、download.vue显式301→/start，现测试断言此行为 | 两页独立诚实空态200，不渲染假的套餐/价格/支付或安装包，保留公开信息出口 |
| 空目录文案未按卡对稿 | Gateway真实state=empty，当前课程PublicStatus泛化“暂时没有公开内容”，按钮仍“查看开放情况” | 用课程专属i18n文案“课程准备中”，说明介绍和正式内容区别，提供去注册；不要把所有公共空态统称课程 |
| 旧策略和新卡冲突 | B14 FE测试、README/i18n九月26号明确要求关闭注册、价格301；R1后续卡要求注册 | 具名R1行为适用性，保留安全不变量，不能简单删旧测试或升级旧验收 |
| 未取得R1原验收 | 恢复目录已列来源/证据缺口 | 当前源重新交付单独绑定，不补写旧证据 |

`GET /api/public-projection?locale=zh-CN` HTTP200：`state=empty, source=gateway, stale=false, errorCode=null`，courses/pricingPlans/skus/campaigns/downloadChannels/announcements/complianceNotices 均空。见 [public-projection.json](public-projection.json)。这证明当前公开读取的空态；不把401/403、error/offline转换为空态，也不填假数据。

注册目的地 read-only GET：`18180/register` 与 `18183/#/pages/register/register` 均200、实际显示两密码字段和18+成人说明，无脚本/console错误。源码分别有 `/register` 与 `pages/register/register`。**页面可达不证明注册201、Cookie、幂等、成人Gate落库或注册会话无学习权限**；这些留给R1-002及后续卡。未提交注册，拦截非GET/HEAD/OPTIONS，`blockedWrites=[]`。

## 旧关闭策略来源与冻结边界

`git blame` 明确 B14 FE测试关闭断言与对应i18n来自 `8a689ec5`，应用README第41/54行维护该策略。九月21号官网实现README仍描述注册CTA，这是前一轮快照，不能覆盖九月26号源码。闭账号策略不是根据当前运行不可达推断：当前两端页面确实可达。

限定检索 `scripts/contracts/compatibility-diff.mjs`、`docs/10-decisions/*.md`、`LEGACY-B-TEST-TRIAGE.md` 与官网tests，未找到“禁止官网去注册”规则的专用canonical摘要/Freeze ID/ADR。现有B14应用测试为读取工作树源码的node:test，不能仅凭名字视为Gateway canonical冻结。B14 Gateway strangler、默认拒绝、公开投影owner与M2契约冻结仍受控；本报告**不宣称所有B14未冻结，也不豁免canonical检查**。保留 `GAP-CLOSURE-POLICY-CANONICAL-BINDING`，如实现时命中具名冻结门禁，先报主审，不改阈值。

`pnpm --filter @englishflow/official-site test:website` exit0，26 PASS、0 FAIL/skip，见 [existing-tests.log](existing-tests.log)。包含安全origin/UTM/returnTo、mock BFF投影与错误、八态、只读边界，以及明确关闭账号/301策略。它没有完成当前11原路由直接200、实际去注册点击或干净库IAM链路。

## 下一轮验收隔离与最小实现范围

当前源交付建立 `R1-001-implementation/task-spec.md`，冻结11URL、双视口、CTA目标与18+边界；证据绑定源码HEAD + 实际diff摘要 + taskSpec摘要 + 文件sha256 + 测试版本/进程，不写旧Evidence/canonicalfixture，不签READY/ACCEPTED。

可按R1新行为更新**应用源测试**冲突断言，但保持原测试文件历史commit/sha256和本报告26/26结果，逐条说明旧/new适用性：关闭账号与301被本卡新行为取代；安全origin/returnTo/UTM、只读、不持token/不收密码、不伪售、不造下载、错误不冒充empty、八态、i18n/theme继续当前源回归。旧canonical契约/owner/auth fixture和旧验收状态一律保留。

另加R1具名定向测试：11URL首次200+双视口正文/空态，课程准备中，注册CTA实际点击→learner /register且参数受控，18+文案，价格/下载没有购买/安装按钮，投影错误仍可重试。报告中单列“历史源26项”“现源不变量”“R1新行为”；不能因为增加新套件而忽略旧应用测试已失效断言。若需要重现旧策略，仅在固定旧commit隔离源码运行，不把旧测试对当前不同策略失败伪记PASS。

候选导航见 [trace-navigation.json](trace-navigation.json)：FEAT-USR-003、PRD-ATOM-1044、V2-980-0361、ARCH-GW-001/ARCH-API-001、ACT-P1-VISITOR、JNY-P1-01、PAGE11、INT-P1-001/005、E2E-P1-PUBLIC-ENTRY；RULE具名ID及逐卡权威映射仍GAP。official-site交付owner，content-service公开课程事实、commerce-service价格事实、iam-service账号/成人Gate事实；官网不代写任何owner事实。
