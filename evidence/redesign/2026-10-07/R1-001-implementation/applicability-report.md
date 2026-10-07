# 旧应用测试与R1当前源适用性

R1卡新范围由主审明确批准。`b13-official-site.test.mjs`、`b14-fe-005.test.mjs`、`website-entry.test.mjs` 是读取当前工作树的应用源测试，本轮随应用策略变化更新；未改旧canonical fixture、兼容阈值或历史Evidence。历史关闭账号/301策略源提交 `8a689ec5c7fca3dd753d972db10057cc768437c8`，三个历史测试的git blob及SHA-256完整记录在 [source-and-results.json](source-and-results.json)。保留当前源只读评估的旧26/26PASS日志，不把旧结果挪作新策略验收，也不复制旧套件对新源码重复运行。

| 测试位置/原断言 | R1明确替代范围 | 继续保留执行的不变量 |
|---|---|---|
| B13价格测试：pricing navigateTo /start + redirectCode301；download /start | pricing/download独立200，消费现有B9安全公开投影，七态保真；ready相关目录真空才准备中，非空展示真实公开介绍/价格/权益；pricing commerce-degraded→error+retry；不渲染购买/支付/安装动作 | projection DTO兼容、SKU/campaign组件结构、无订单/支付/权益写、无虚构offers JSON-LD |
| B14入口测试：start没有buildPublicLearningEntry，只有sample；注册暂不可用/电脑手机示例 | SiteStartButton/start/courses通过registerLink安全导航到learner/register；18+成人门前无学习权限；sample保留次级 | 官网不收密码、不建会话/持Token、不带客户端authority事实；八态非颜色唯一表达；URL locale/theme恢复；无假免费/同步能力承诺；界面示意标签、个人数据能力未开放说明 |
| website-entry sitemap：排除pricing/download | 两页直接200且纳入publicRoutes/sitemap，保留所有其他公开页 | route不重复；官网无/login /register内部身份页面；安全origin/固定returnTo/UTM白名单/拒绝credentials与执行URL；mobile helper安全能力保留 |
| public-projection-bff suite | 无行为变更 | Gateway只读、缓存失效、上游错误/未授权不伪装空目录、不得复活过期offers |
| 新r1-001.test.mjs（使用已有TS测试loader） | 固定18182已有服务，11原route首次200；真实空课程准备中、无价格/安装包；SSR实际registerhref及安全参数/成人说明；共享createI18n真实en-US→zh-CN fallback | 不启动服务、不提交注册，不把页面可达当IAM201或无学习scope证据 |

来源检索未发现“官网永远不得去注册”的具名canonical冻结摘要；这是限定结论，见 [修复前评估](../R1-001-current-source/assessment.md)。旧B14 Gateway strangler/default-deny/owner与已签canonical认证契约继续有效。没有通过修改阈值、测试跳过或篡改fixture消除失败。

现源test:website **26 PASS / 0 FAIL / 0 skip**；R1 HTTP/SSR专项 **4 PASS / 0 FAIL / 0 skip**。双视口22路由/CTA是独立浏览器运行记录。当前允许的测试变化仅上表策略；契约、IAM会话、adult Gate、Cookie、事件、干净库和注册后领域403仍待后续卡，未被本卡新测试关闭。

终审返工增加usePublicProjection.ts的同次请求onResponse读取既有commerce header；仅pricing处理degraded，无新API字段或请求。原network-failure回归继续执行。Nuxt SSR H3Event$Fetch没有.raw，raw首次类型/SSR/mock失败日志原样保留，修正为onResponse后重新核对。最终七态、ready相关目录空/非空、pricing degraded、缺响应、无关课程/下载scope由实际浏览器局部fixture验证，不把模拟响应当真实发布方案。
