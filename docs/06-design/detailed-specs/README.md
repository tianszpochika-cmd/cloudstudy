# 全量详细设计文档索引（v1 历史包）

> **状态**：历史/迁移/术语参考，不是新一轮代码落地施工图。新一轮业务需求、交互、阶段和验收的唯一基线是 [`../v2-980plus/README.md`](../v2-980plus/README.md)；服务边界以 [v2 微服务目标架构](../../02-architecture/v2-microservices-architecture.md) 为准。  
> **版本**：v3.3 历史基线对照版  
> **关联功能矩阵（历史来源证据）**：旧版曾使用“980+ 待校准”表述；当前 v2 已冻结 `V2-980-0001..0980` 范围登记（930 个业务域单元 + 50 个跨域扩展登记位），成熟度为 184/486/310，详见 [`../v2-980plus/README.md`](../v2-980plus/README.md)。
> **技术架构基线**：Vue 3 (uni-app/Vite) + Java 25 (Spring Boot 4.1 微服务) + Gateway/IAM/RBAC + MySQL 8.x + Redis 7.x；认证以自有 IAM 账号密码、JWT/JWKS、Refresh Token 轮换为准，详见 [ADR-0013](../../10-decisions/0013-self-owned-jwt-authentication-center.md)。
> **迁移兼容**：文档中历史出现的 `services/core-api` 表示 v1 兼容承载；v2 任务必须映射到目标领域服务和 `ARCH-*` 平台能力。
> **文档定位**：用于迁移已有实现、解释历史术语和回放 v1 设计决策；不能单独作为 v2 新任务、契约或验收的依据。

---

## 📂 8 大核心业务领域详细设计文档矩阵

| 序号 | 详细设计文档 | 对应业务域 (Domain) | 覆盖核心功能点 (Feature Matrix) | 包含核心内容 |
| :---: | :--- | :--- | :--- | :--- |
| **01** | [`01_Onboarding与自适应首屏详细设计.md`](./01_Onboarding与自适应首屏详细设计.md) | **ONB 域** | FEAT-ONB-001 ~ 022 (22 项) | • 5分钟非AI自适应定级算法<br>• 语言世界 3D/2D 大地图与迷雾点亮<br>• Adaptive Home 千人千面首屏重排<br>• Continue Learning 1秒断点续学 |
| **02** | [`02_词汇短语与SRS记忆闭环详细设计.md`](./02_词汇短语与SRS记忆闭环详细设计.md) | **VOC 域** | FEAT-VOC-001 ~ 030 (30 项) | • 改进型 SM-2 记忆算法公式实现<br>• Active Recall 主动回忆卡片状态机<br>• 3D 口腔侧剖面参数与词根词族网<br>• 句块 SRS 与 Sentence Mining 表达库 |
| **03** | [`03_语法树长难句与写作训练详细设计.md`](./03_语法树长难句与写作训练详细设计.md) | **GRM & WRT 域** | FEAT-GRM-001 ~ 012<br>FEAT-WRT-001 ~ 005 (17 项) | • 100+ 语法树与公式化规则卡片<br>• 长难句 X 光机彩色切片与 Vue Flow 树<br>• 句子积木拖拽重组与弱点雷达图<br>• 汉译英采分点规则比对与高分模板库 |
| **04** | [`04_听说读全模态精练系统详细设计.md`](./04_听说读全模态精练系统详细设计.md) | **LST, RDG, SPK 域** | FEAT-LST-001 ~ 006<br>FEAT-RDG-001 ~ 004<br>FEAT-SPK-001 ~ 006 (16 项) | • Wavesurfer 毫秒级字幕精听与波形渲染<br>• 连读/弱读/失爆音变雷达符号系统<br>• 分级阅读沉浸器与 Language Clips 短剧<br>• 48 国际音标 3D 嘴型与影子跟读 |
| **05** | [`05_做题中心模考与掌握闭环详细设计.md`](./05_做题中心模考与掌握闭环详细设计.md) | **ASM 域** | FEAT-ASM-001 ~ 020 (20 项) | • 8 大交互题型组件规范<br>• 4:4:2 每日流流水线动态打包<br>• 24h & 7d 延迟验证掌握闭环状态机<br>• CET-4/6 考研模考、防作弊与雷达报告 |
| **06** | [`06_游戏化星系与3D成长系统详细设计.md`](./06_游戏化星系与3D成长系统详细设计.md) | **GAM 域（历史 v1）** | FEAT-GAM-001 ~ 022 (22 项) | • XP 经验、段位与星币经济循环<br>• Streak 打卡火苗、断签破冰救援挑战<br>• 历史六游戏目录（不代表当前 v2 交付）<br>• 3D Avatar 角色衣柜与 4 级画质自适应 |
| **07** | [`07_自习室社群与用户基础服务详细设计.md`](./07_自习室社群与用户基础服务详细设计.md) | **SOC, USR, INF 域** | FEAT-SOC-001 ~ 010<br>FEAT-USR-001 ~ 007<br>FEAT-INF-001 ~ 008 (25 项) | • 虚拟番茄自习室大厅与白噪音混音<br>• 0 文本风险预设打气气泡 (低 UGC)<br>• 自有 IAM JWT 会话、刷新轮换与设备互踢<br>• 离线词书下载、断点增量同步与纠错工单 |
| **08** | [`08_商业化收单教研CMS与运营中台详细设计.md`](./08_商业化收单教研CMS与运营中台详细设计.md) | **COM & ADM 域** | FEAT-COM-001 ~ 009<br>FEAT-ADM-001 ~ 010 (19 项) | • 微信/支付宝/Apple IAP 聚合收银台<br>• IAP JWS 验签、被动补单与订阅状态机<br>• 教研 CMS 可视化录入与双审审批流<br>• 运营数据大盘 (DAU/GMV) 与 Feature Flag |

| **09** | [`09_全站详细设计一致性审计白皮书.md`](./09_全站详细设计一致性审计白皮书.md) | **全域横向审计** | 01 ~ 08 全量设计 | • 功能编号覆盖核验<br>• API/DDL/字段/状态机一致性<br>• 权限、幂等、审计、弱网与性能基线<br>• 未决风险与实现前置项 |

## 阶段补充设计与追溯

- Phase 1 原子功能补充：[phase-1/full-coverage](../phase-1/full-coverage/)。
- Phase 2 成人 AI：[phase-2/AI成人学习与AI服务详细设计.md](../phase-2/AI成人学习与AI服务详细设计.md)。
- Phase 3 K12 与未成年人：[phase-3/K12未成年人教师机构与合规详细设计.md](../phase-3/K12未成年人教师机构与合规详细设计.md)。
- Phase 2 UI/UX：[phase-2/AI成人学习与实时交互UIUX详细设计.md](../phase-2/AI成人学习与实时交互UIUX详细设计.md)。
- Phase 3 UI/UX：[phase-3/K12未成年人教师机构UIUX与页面状态详细设计.md](../phase-3/K12未成年人教师机构UIUX与页面状态详细设计.md)。
- 全局横向基线：[shared/全局横向设计基线.md](../shared/全局横向设计基线.md)。
- 需求追溯中心：[traceability](../traceability/)。
- v2 后端目标架构：[v2-microservices-architecture.md](../../02-architecture/v2-microservices-architecture.md)。
- v2 平台能力矩阵：[v2-platform-capability-matrix.md](../../02-architecture/v2-platform-capability-matrix.md)。

---

## 审计与版本约定

- 02 ~ 08 的详细设计必须以 `requirements/feature-matrix.md` 的功能编号为单一映射基线；扩展运行时能力使用 `gameCode`、`contentType` 或版本字段表达，不另造 `FEAT-*` 编号。
- REST JSON 使用 camelCase，MySQL 使用 snake_case；跨域实体优先复用 `user_id`、`content_version_id`、`vocab_id`、`expression_id`、`grammar_point_id`、`sentence_id`、`question_id`、`exercise_id`、`attempt_id`、`session_id` 等 canonical ID。
- 每份详细设计必须补充目标 `Service Owner`、数据 owner、Gateway operation、RBAC/ABAC、事件/幂等、观测和回滚映射；旧的 `Core API` 字样不能作为 v2 服务边界。
- 09 白皮书是设计阶段横向一致性审计记录，不替代实现阶段的 OpenAPI 生成、数据库迁移、自动化测试和跨端验收。
