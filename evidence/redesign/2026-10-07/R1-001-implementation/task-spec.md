# R1-001 当前源重新交付范围

日期2026-10-07；任务 R1-001，IT-1，BC-001 / IC-001，owner official-site。本次是在恢复缺口边界下，针对 `ff0f8057f4088ead03ab7890493cdf9d06f6d5f1` 当前源重新交付，不是找回原机器R1原件，不导入ACCEPTED，不签READY，不解锁R1-002或IT-2。主审已明确批准下列最小行为及文件范围。

依据：R1计划第12行“官网11页空目录诚实态（课程准备中+去注册CTA）/双视口200/空态文案对稿”；BC-001第56行；IC-001第46行；PAGE登记册第48..58行canonical routes。历史2026-09-26 sweep仅佐证路由来源。本卡具名11地址：`/ /courses /pricing /download /announcements /about /compliance /status /privacy /terms /minors`；各原地址首次响应直接200，不计301最终200。现有其他公开页继续保留，不删除以凑11。

双视口1280×900、390×844；真实公开课程投影空时显示“课程准备中”，学习方式介绍和正式内容分开。错误/无权限/离线等不能冒充empty；继续保留可重试。价格/下载独立200，消费现有B9安全公开投影，loading/empty/error/permission/recovery/maintenance/ready分别呈现并保留retry；仅相关目录确实空才准备中，ready/recovery非空只展示真实公开介绍/availability。价格scope消费现BFF的x-public-projection-commerce=degraded时视为error而非empty；其他课程/下载scope不因此全局失败。当前B13公开catalog已可达200，但不新增服务请求/公开字段，不改BFF或契约。允许现有已校验公开投影的真实SKU/价格/权益只读展示（使用projection已格式化价格，不伪造或硬编码金额），不提供购买、支付或安装包入口。无需登录官网示例保留。

去注册CTA复用 `buildPublicLearningEntry`，固定配置learnerWebUrl，目标 `/register`，固定returnTo=/home，只携带白名单UTM/UI locale/theme，不接收来自查询的任意目标/权限/token。桌面和手机本卡均去learner-web注册；现有mobile helper能力不退役。官网不收密码、不存业务Token、不建业务会话、不写领域事实。面向18岁以上成人与大学生；注册后仍由IAM判成人门，通过前不开放学习能力。页面可达验收不涵盖IAM201/Cookie/事务/事件/无学习scope或domain403；这些仍是后续卡GAP。

批准改动：SiteStartButton.vue、useOfficialSiteLinks.ts、usePublicProjection.ts、start.vue、courses/index.vue、pricing.vue、download.vue、site-content.mjs；共享packages/i18n官网文案；官网README；b13/b14/website-entry应用源测试与新增r1-001.test.mjs。当前nuxt.config没有两页redirect routeRules，毋须变更。无API/DB/事件或设计Token/品牌色修改，不扩大官网UI redesign。

B13/B14/website-entry为读工作树的应用源测试。按R1更新关闭账号/301/退役sitemap断言，保留origin/returnTo/UTM、只读、不持token、不收密码、不伪售、八态、错误不冒充空、i18n/theme不变量。历史8a689ec5测试blob/摘要与旧26PASS证据另在applicability-report/source-and-results中绑定；canonicalfixture/兼容阈值/旧Evidence/P1R状态不变。遇具名冻结门禁阻止则报告主审，不改阈值。

证据要求：task-spec摘要、当前HEAD + 实际diff摘要、明确修改文件sha256、进程/版本、专项测试PASS/FAIL、typecheck/build、双视口22原路由首次200、实际CTA点击到注册页、18+文案、未提交注册、无写请求。不启动或重启固定18182现有Nuxt runner；只接受正常源码HMR。运行绑定仍说明dev无不可变buildID。交付后Luna独立审查，不能自行升级为ACCEPTED。

候选 FEAT/PRD-ATOM/V2-980 + ARCH + ACT/JNY/PAGE/RULE/INT/E2E 与owner来源见当前源 [追溯导航](../R1-001-current-source/trace-navigation.json)。逐卡映射签收/具名RULE ID、原114墙与原验收仍GAP。3处原有mobile差量保持，不提交/推送，不改CURRENT-PROGRESS/原计划/CHANGELOG。

独立审查补充主审批准：usePublicProjection.ts是新增具名允许文件，仅用现有useRequestFetch的onResponse钩子读取现BFF commerce header，pricing局部degraded→现有error态；不新增API字段/请求或全局改变无关scope。追加两页真实空投影及七态/相关目录非空/commerce-degraded浏览器分支；共享createI18n en-US实际zh-CN fallback测试。首轮22页面证据保留，最终对受影响两页双视口重验并绑定最终源码摘要。
