# R1-001 当前源局部交付（待独立审查）

结果 `SOURCE_SCOPED_PASS_NOT_WORKFLOW_ACCEPTANCE`：完成主审批准的最小修复及独立审查返工，尚未迁移工作流。不是恢复原机器验收，不导入ACCEPTED，不签R1-002 READY，不视为干净专用库或IT-1出站。

源码基于ff0f8057，14个具名应用/文案/测试文件差量见 [source-delta.patch](source-delta.patch)，最终文件SHA、task-spec摘要及8a689ec5历史测试blob见 [source-and-results.json](source-and-results.json)。[任务范围](task-spec.md)、[旧应用测试适用性](applicability-report.md)界定被替代的关闭账号/301断言；旧canonical fixture/兼容阈值/历史Evidence未改。

官网去注册CTA安全跳到learner-web `/register`，桌面/手机一致；/start保留无需登录示例为次级。空公开课程显示“课程准备中”，六类学习方式介绍单独保留。/pricing、/download成为独立200公开投影页并进入sitemap：消费现有B9安全读，loading/empty/error/permission/recovery/maintenance/ready分别呈现；仅相关目录真空才准备中，非空显示真实公开介绍/状态。价格可只读展示已校验projection的SKU/价格/权益；无硬编码金额、购买、支付、order或native下载动作。现有公开价格BFF原本已读取B13catalog，本轮不新增请求/API字段/后端变更。

`usePublicProjection`用**同次请求onResponse钩子**读取现BFF的 `x-public-projection-commerce`：仅pricing把degraded转为既有error态+retry，避免commerce失败后清价格而假装empty；课程/下载仍读正常内容。缺响应/缺projection拒绝。Nuxt SSR H3Event$Fetch没有.raw，首次raw尝试导致类型/SSR/mock失败，原日志保留；改为onResponse后实际SSR、类型及浏览器均通过。

| 最终验证 | 结果与证据 |
|---|---|
| 现有应用源测试 | 26/26 PASS，0skip，[最终日志](test-website-final.log)；安全不变量继续执行 |
| R1 HTTP/SSR/安全参数/真实共享fallback | 4/4 PASS，0skip，[最终日志](test-r1-001-final.log)；共享createI18n en-US实际回退中文，contentLocale独立 |
| Nuxt类型检查 / 隔离生产build | 均exit0，[类型](typecheck-final.log)、[build](build-final.log)；独立临时Nuxt/Nitro/output目录，未启动构建产物 |
| 最终11原路由双视口 / CTA | [最终观察](browser-observation.json)：1280×900/390×844；22/22首次直接200、22非空、0overlay、0横向溢出、0route脚本/console异常；首页/start/课程空态实际点击→learner/register，固定returnTo=/home及locale/theme/UTM，非法redirect/access_token不传播 |
| 价格/下载投影分支 | [分态证据](projection-branches.json)：4个实际空投影页面 + 40个浏览器局部模拟（七态、ready非空、ready相关目录空、commerce-degraded、缺响应）；课程无关scope另2例；0errors/writes |
| 非空只读权益可读性 | 人工发现复用暗底included-list让亮底权益过浅，仅移除该类；[非空视觉补验](projection-nonempty-final.json)：两页双视口4非空模拟+4实际空页，0error；未添加品牌/状态色 |

当前 B13catalog operation非withheld：canonical `getB13PublicCommerceCatalog`存在，Gateway policy具名route；只读GET HTTP200 plans=[]、productionPaymentEnabled=false，官网现BFF commerce header=gateway。完整owner检查见 [projection-owner-check.json](projection-owner-check.json)。浏览器模拟公开方案/价格/native href只在测试上下文响应里；没有写入服务器或冒充真实已发布方案，native href不呈现。ERROR、权限、恢复、维护、缺响应都不冒充准备中；commerce degraded只影响价格scope。

原官网共享i18n将旧“账号注册不可用”改为受控入口说明，明确18+成人门通过前不开放学习能力。官网没有密码表单/业务Token/会话/领域写。注册页只读可达，未提交注册、未创建用户、无写请求。官网dev PID仍9008、启动时间不变；没有启动/重启服务。进程cwd+HEAD/diff/task/file摘要绑定运行源，dev无不可变生产build-ID；build不表示部署或业务链通过。

人工查看手机课程准备中、注册前说明、价格错误及只读非空权益截图；未宣称全主题/全locale/WCAG/真机或法律文件获批。首轮导航DOM等待失败见 [首次诊断](browser-first-observation.json)；raw兼容失败见 [类型诊断](typecheck-final-raw-attempt.log)、[SSR诊断](test-r1-001-final-raw-attempt.log)，均保留，不改写为PASS。首轮绿色源码差量/摘要另保留，最终摘要单独绑定。

候选FEAT-USR-003 / PRD-ATOM-1044 / V2-980-0361、ARCH-GW-001/ARCH-API-001、ACT-P1-VISITOR、JNY-P1-01、PAGE11、INT-P1-001/005、E2E-P1-PUBLIC-ENTRY来源见 [导航](../R1-001-current-source/trace-navigation.json)。official-site是展示owner；content-service课程，commerce-service价格，iam-service账号/成人门。IAM201/Cookie/成人Gate落库/无学习scope/领域403/事务事件/干净库全链、逐卡追溯签收及具名RULE ID仍GAP。原114墙及原R1验收缺口保留。

恢复工具也已固定返工：build-index/verify-index只读固定ff0f8057历史blob，已有immutable manifest/29索引/搜索快照不覆盖；临时Git夹具合法progress差量replay通过，真实progress与5个历史工件摘要不变，862索引检查PASS。3个原有mobile摘要保持。正式状态/进度/CHANGELOG/旧Evidence/canonical fixture未改，未提交或推送。由Luna对当前具名局部交付独立复审，再由主审决定后续范围；本执行进程不签业务ACCEPTED。
