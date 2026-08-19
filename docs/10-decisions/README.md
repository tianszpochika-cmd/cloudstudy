# 架构决策记录

重大技术、产品和数据决策使用 ADR 记录背景、选项、决策、后果和复查条件。不要只在聊天或口头会议中保留关键约定。

## ADR 索引

| 编号 | 决策 | 状态 |
| :--- | :--- | :--- |
| [ADR-0001](./0001-modular-monolith-first.md) | 模块化单体优先 | accepted |
| [ADR-0002](./0002-mobile-tauri-first.md) | 移动端 Tauri 优先 | superseded（ADR-0004） |
| [ADR-0003](./0003-core-api-nestjs-first.md) | Core API NestJS 主线 | superseded（ADR-0004） |
| [ADR-0004](./0004-stack-switch-uniapp-springboot.md) | 前后端主线切换 Vue3 + uni-app + Spring Boot 3 | accepted |
| [ADR-0005](./0005-python-ai-orchestrator-retained.md) | 保留 Python FastAPI AI 编排层 | accepted |
| [ADR-0006](./0006-database-switch-mysql.md) | 关系型数据库主线切换为 MySQL 8.x（PRD v3.2 §1.1） | accepted |
