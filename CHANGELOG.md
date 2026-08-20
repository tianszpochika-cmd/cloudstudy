# Changelog

## Unreleased

- B3 最终执行推进：补齐 Web/uni-app 句法积木与仿写、写作改错/历史、阅读理解/表达挖掘、听力位置保存、48 音标口型交互、服务端权威答题、500ms 影子跟读与咖啡店角色扮演；新增 JDBC durable repository、离线 cursor v2、Web AES-GCM-256 内存录音仓和 Mobile Keychain/Keystore 适配边界，并修复公开改错题泄露参考答案的问题。Core API Maven 11 tests、B3 tests 17/17、全仓 Node 74 pass/3 TODO、Web/mobile typecheck/build、契约/迁移/fixture/配置/端口校验均通过；真实 MySQL/Redis/S3、授权媒体、原生密钥链、浏览器完整 E2E 与 iOS/Android/iPad/小程序弱网仍待验收。
- 推进 B3 全模态精练：扩展到语法树/陷阱/练习/六维掌握、句子 X-Ray/积木/仿写、写作模板/改错、听力时间轴/倍速/循环/A-B/盲听、Language Clips/离线包、阅读词典/分支/题目、48 音标最小对、浏览器录音 SHA-256、0.5 秒跟读/角色扮演；新增详细 V0012 表、158 条合并路由、43 个版本化事件、Web/mobile 离线队列与安全同步边界，B3 测试 13/13，MySQL/Redis/S3、真实媒体、Core API 持久化和多端弱网运行态仍待验收，详见 `docs/07-operations/b3-validation.md`。
- 建立 B2 核心学习基线：新增词汇/SRS 与练习/掌握契约、事件、V0010/V0011 迁移、规则引擎、Web/uni-app 词卡与练习交互、学习流兼容入口和静态验收；静态门禁、契约生成校验、Web/uni-app H5 构建已通过，MySQL/Redis 持久化接线、D+1/D+7 worker、Docker 与浏览器运行态仍待外部环境验收，详见 `docs/07-operations/b2-validation.md`。
- 深度重构详细设计文档 02~08：补齐功能逐项规格、状态机、算法/判分规则、MySQL DDL、REST/OpenAPI、事件审计、弱网降级、权限和测试验收基线；新增全站一致性审计白皮书。
- 新增 Phase 1 开发执行基线：按功能链拆分为 14 个章节、140 个开发任务和 7 个批次；新增 Agent 状态总报表、认领/验收/阻塞协议与证据字段，并接入 backlog 与路线图索引。
- 建立本地固定端口约束：统一 Core API、三类 Web、uni-app H5、MySQL、Redis、MinIO 及可选基础设施端口；新增机器可读端口登记和冲突即失败的启动检查。
- 完成 B0 工程基础与契约基线：新增 OpenAPI/事件契约校验与生成流水线、MySQL/Redis 基线、运行配置与安全遥测基线、四级性能引擎、learner-web/mobile 基座和 Core API 健康检查；B0 状态报表更新为 15 项已完成、5 项待运行态验收。
- 完成 B1 首日学习链实现基线：接入手机号 OTP/双 Token 轮换与重放撤销、Onboarding/确定性规则测评、内容版本与版权双审发布、用户偏好/设备/隐私服务、Web/uni-app 首日页面与本地恢复；新增 V0006–V0009、22 条 OpenAPI 操作、25 个事件及 7 项 B1 静态门禁，运行态依赖验收待补。

## 2026-08-20

- 技术与需求基线冻结：确认并固化唯一技术路线为 Vue 3 + TypeScript + uni-app、Java 17 + Spring Boot 3、MySQL 8.x + Redis 7.x；Phase 2 使用 Python FastAPI AI 编排服务。AGENTS.md、PRD v3.3、ADR-0004/0005/0006 和技术栈基线为唯一实现依据。
- 需求文档重对齐：重写 requirements/README.md、mvp-scope.md、user-stories.md、acceptance-criteria.md 与 Iteration 00，统一 Phase 1 为 18+ 成人/大学生、无生成式 AI 的规则化语言学习产品；AI 归 Phase 2，K12/高中归 Phase 3 合规扩展。
- 技术文档重对齐：重写技术栈基线、技术规格索引、通用底层规范、跨端性能架构、AI 状态说明和首 30 天计划，删除 React/Next.js/NestJS/PostgreSQL 主线表述。
- 历史文档清理：删除 superseded 的 Tauri/NestJS ADR、旧 EnglishFlow 产品报告与展示 PDF/PPT/HTML、旧商业支持文档及测试导出文件。新增文档政策，明确 Git 历史仅用于审计，不作为开发依据。

## 2026-08-19

- PRD v3.3、Phase 1 UI/UX 设计包、3D Avatar、MySQL 架构迁移和深圳上线清单已入库；后续变更以 2026-08-20 基线冻结说明为准。
