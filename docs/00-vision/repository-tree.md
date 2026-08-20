# 仓库目录地图

~~~text
语学星/
├─ apps/                         多端应用
│  ├─ learner-web/               学习 Web
│  ├─ miniapp-wechat/            微信小程序
│  ├─ mobile/                    uni-app 移动端原生配置与打包（见 ADR-0004）；含 ios/ 与 android/
│  ├─ official-site/             官网与 SEO
│  └─ admin-web/                 运营/教研/客服后台
├─ services/                     后端运行时
│  ├─ core-api/                  模块化核心业务 API
│  ├─ ai-orchestrator/           AI 供应商、提示词和安全编排
│  ├─ realtime-voice/            实时语音会话
│  ├─ content-worker/            内容生产与发布任务
│  ├─ notification-worker/       学习提醒任务
│  ├─ analytics-worker/          事件与指标聚合
│  └─ job-runner/                通用异步/定时任务
├─ packages/                     跨端共享包
│  ├─ api-client/ contracts/ domain/
│  ├─ ui-web/ ui-mobile/ design-tokens/
│  ├─ i18n/ content-schema/ ai-prompts/
│  └─ telemetry/ config/
├─ database/                     数据结构、迁移、种子和夹具
├─ content/                      课程、练习、词汇、媒体和评分规则
├─ ai/                           提示词、评测集、策略和实验
├─ analytics/                    事件、指标和看板定义
├─ requirements/                 PRD、MVP、用户故事和验收标准
├─ docs/                         产品、架构、设计、运维和合规
├─ infra/                        本地容器、部署、监控和安全
├─ scripts/                      启动、数据库、内容、发布和 CI 脚本
├─ tests/                        E2E、集成、契约、AI、性能和安全
├─ agent/                        Agent 上下文、工作流、提示词和决策
└─ .github/                      CI、Issue 和 PR 模板
~~~

空目录中的 .gitkeep 是有意保留的未来边界，不代表已经实现对应功能。
