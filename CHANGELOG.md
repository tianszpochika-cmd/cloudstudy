# Changelog

## Unreleased

- 深度重构详细设计文档 02~08：补齐功能逐项规格、状态机、算法/判分规则、MySQL DDL、REST/OpenAPI、事件审计、弱网降级、权限和测试验收基线；新增全站一致性审计白皮书。
- 新增 Phase 1 开发执行基线：按功能链拆分为 14 个章节、140 个开发任务和 7 个批次；新增 Agent 状态总报表、认领/验收/阻塞协议与证据字段，并接入 backlog 与路线图索引。
- 建立本地固定端口约束：统一 Core API、三类 Web、uni-app H5、MySQL、Redis、MinIO 及可选基础设施端口；新增机器可读端口登记和冲突即失败的启动检查。
- 完成 B0 工程基础与契约基线：新增 OpenAPI/事件契约校验与生成流水线、MySQL/Redis 基线、运行配置与安全遥测基线、四级性能引擎、learner-web/mobile 基座和 Core API 健康检查；B0 状态报表更新为 15 项已完成、5 项待运行态验收。

## 2026-08-20

- 技术与需求基线冻结：确认并固化唯一技术路线为 Vue 3 + TypeScript + uni-app、Java 17 + Spring Boot 3、MySQL 8.x + Redis 7.x；Phase 2 使用 Python FastAPI AI 编排服务。AGENTS.md、PRD v3.3、ADR-0004/0005/0006 和技术栈基线为唯一实现依据。
- 需求文档重对齐：重写 requirements/README.md、mvp-scope.md、user-stories.md、acceptance-criteria.md 与 Iteration 00，统一 Phase 1 为 18+ 成人/大学生、无生成式 AI 的规则化语言学习产品；AI 归 Phase 2，K12/高中归 Phase 3 合规扩展。
- 技术文档重对齐：重写技术栈基线、技术规格索引、通用底层规范、跨端性能架构、AI 状态说明和首 30 天计划，删除 React/Next.js/NestJS/PostgreSQL 主线表述。
- 历史文档清理：删除 superseded 的 Tauri/NestJS ADR、旧 EnglishFlow 产品报告与展示 PDF/PPT/HTML、旧商业支持文档及测试导出文件。新增文档政策，明确 Git 历史仅用于审计，不作为开发依据。

## 2026-08-19

- PRD v3.3、Phase 1 UI/UX 设计包、3D Avatar、MySQL 架构迁移和深圳上线清单已入库；后续变更以 2026-08-20 基线冻结说明为准。
