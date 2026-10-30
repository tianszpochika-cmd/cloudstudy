# 项目上下文

> 当前状态总览：[docs/STATUS.md](../../docs/STATUS.md)。
> dev 执行迭代 2（第二轮重设计）；当前进度和接手顺序唯一见[进度页](../../docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)与[根交接](../../CURRENT-HANDOFF.md)。按 R1 卡依赖工作，不按旧台账认领。

- 产品名：语学星（研发代号：EnglishFlow）
- 公司主体：深圳云澜深境科技有限公司
- 域名主体：clyune（官网 clyune.com/.cn、学习 study.clyune.com、后台 work.clyune.com、接口 api.clyune.com、AI 专栏 clyune.ai、数据 clyune.cloud）
- 当前部署：SJC 服务器 `173.249.208.210`，域名 `clyune.com`：`learn.clyune.com`（学员 Web）、`admin.clyune.com`（后台）、`mobile.clyune.com`（移动 H5）、`api.clyune.com`（网关）。运行版本 `4990dd29`（2026-10-13），落后 `origin/dev`（截至 2026-10-30 落后 132 个提交）
- 市场：中国大陆
- Phase 1 用户：18 岁以上成人、大学生、职场前用户
- Phase 1 平台：Web/H5 优先，iOS/Android 包体随后，小程序 P1.5
- 前端：Vue 3 + TypeScript + uni-app；后台 Vue 3 + Element Plus
- 后端：Java 25 + Spring Boot 4.1 + Gateway/IAM/RBAC 微服务；Java 17 + Spring Boot 3 core-api 仅为 v1 迁移兼容/回滚边界
- 数据：MySQL 8.x + Redis 7.x + OSS/CDN
- Phase 2 AI：Python 3.11 + FastAPI + LiteLLM/LangGraph，独立于 Core API
- 实时语音：Phase 2 优先商业 RTC；自建 LiveKit 需新增 ADR
- 核心学习闭环：目标 -> 课程 -> 练习 -> 规则/AI反馈 -> 复习 -> 报告
- Phase 3：仅在资质、版权、未成年人保护和专项合规通过后进入 K12/高中
- 文档语言：简体中文
- 代码语言：英文

## 文档规则

需求事实源：requirements/product-requirements.md。
技术事实源：[AGENTS](../../AGENTS.md)、docs/02-architecture/ 与有效 ADR（尤其 0009/0010/0012/0013/0014）；本分支执行入口见上方进度页，原 P1R 只作追溯与冻结门禁。
历史路线不参与开发，旧展示材料已移除或不再作为参考。
