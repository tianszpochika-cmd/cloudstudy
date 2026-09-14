# 架构决策记录

当前有效 ADR 是开发约束的一部分。v2 的后端目标架构、服务边界和新任务拆分必须同时阅读 ADR-0009、ADR-0010、涉及客服/隐私边界时的 ADR-0014，以及对应的架构能力矩阵。

## 当前有效 ADR

| 编号 | 决策 | 状态 |
| :--- | :--- | :--- |
| ADR-0001 | 模块化单体优先 | superseded（后端目标由 ADR-0010 取代；迁移期仍适用于旧 `core-api`） |
| ADR-0002 | 移动端 App 采用 Tauri 2.0 主线 | superseded（移动端随 [ADR-0004](0004-stack-switch-uniapp-springboot.md) 改用 uni-app 原生渲染；Tauri/RN 路线分析作为历史参考保留） |
| ADR-0003 | Core API 采用 Node.js (NestJS) | superseded（随 [ADR-0004](0004-stack-switch-uniapp-springboot.md) 改用 Java / Spring Boot 3；NestJS 评估作为历史参考保留） |
| ADR-0004 | Vue 3 + uni-app + Spring Boot 3 主线 | superseded（当前前端矩阵见 [ADR-0008](0008-four-frontend-projects-and-platform-targets.md)；当前后端/事件平台见 [ADR-0010](0010-java25-microservices-gateway-iam.md)） |
| ADR-0005 | 保留 Python FastAPI AI 编排层 | accepted |
| ADR-0006 | MySQL 8.x + Redis 7.x 数据主线 | accepted |
| ADR-0007 | Phase 1 范围与 Agent/DoD 治理基线 | accepted |
| ADR-0008 | 四个前端项目与平台目标归属 | accepted |
| ADR-0009 | v2-980plus 设计与开发任务重基线 | accepted |
| ADR-0010 | Java 25 LTS + 微服务 + Gateway + IAM/RBAC | accepted |
| ADR-0011 | 外部身份提供方方案废止 | superseded / 仅保留迁移审计线索；当前认证基线见 [ADR-0013](0013-self-owned-jwt-authentication-center.md) |
| ADR-0012 | JWT Bearer（Access Token）与四端会话基线 | accepted / 由 ADR-0013 补充签发边界 |
| ADR-0013 | 自有 JWT 认证中心 | accepted / 当前正式登录基线 |
| ADR-0014 | Phase 1 客服与隐私编排事实所有权 | accepted |
| ADR-0015 | 事件传输与 Outbox 的标准形状 | accepted |
| ADR-0016 | 服务身份与内部令牌签发 | accepted |

ADR-0001、ADR-0002、ADR-0003 与 ADR-0004 均为 superseded 但不删除，保留用于解释 `core-api`、移动端与技术栈选型的迁移来源和已放弃路线；编号序列 `0001–0016` 保持连续，不得留空号。Git 历史仅用于审计，不作为当前开发依据。

> 补记：ADR-0015 此前已存在但未列入本表，ADR-0016 于同日新增。两者的补入使"编号连续"这一条与文件实际相符；此前该条自述 `0001–0014`，而目录中已有 0015，属表述落后于事实。
