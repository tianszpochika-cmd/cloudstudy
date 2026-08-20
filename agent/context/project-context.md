# 项目上下文

- 产品名：语学星（研发代号：EnglishFlow）
- 公司主体：深圳云澜深境科技有限公司
- 域名主体：clyune（官网 clyune.com/.cn、学习 study.clyune.com、后台 work.clyune.com、接口 api.clyune.com、AI 专栏 clyune.ai、数据 clyune.cloud）
- 市场：中国大陆
- Phase 1 用户：18 岁以上成人、大学生、职场前用户
- Phase 1 平台：Web/H5 优先，iOS/Android 包体随后，小程序 P1.5
- 前端：Vue 3 + TypeScript + uni-app；后台 Vue 3 + Element Plus
- 后端：Java 17 + Spring Boot 3 模块化单体
- 数据：MySQL 8.x + Redis 7.x + OSS/CDN
- Phase 2 AI：Python 3.11 + FastAPI + LiteLLM/LangGraph，独立于 Core API
- 实时语音：Phase 2 优先商业 RTC；自建 LiveKit 需新增 ADR
- 核心学习闭环：目标 -> 课程 -> 练习 -> 规则/AI反馈 -> 复习 -> 报告
- Phase 3：仅在资质、版权、未成年人保护和专项合规通过后进入 K12/高中
- 文档语言：简体中文
- 代码语言：英文

## 文档规则

需求事实源：requirements/product-requirements.md。
技术事实源：AGENTS.md、docs/02-architecture/、docs/10-decisions/0001/0004/0005/0006。
历史路线不参与开发，旧展示材料已移除或不再作为参考。
