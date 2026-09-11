# 开发会话记录：2026-09-11（M2 平台安全骨架）

> **文档分类：会话历史快照（Historical / Session Log）**。本文件记录 2026-09-11 的开发会话成果，供跨会话/跨电脑恢复参考；任务实时状态以 [02-编号任务台账](../02-编号任务台账.md) 为唯一事实源，验收结论以 canonical Evidence manifest 为准，本文不改变任何状态。

- 会话起点：`dev@352879a`（拉取远程后）
- 会话终点：`dev@c15abe4`（已推送，`origin/dev` 同步）
- 会话提交数：24（`352879a..c15abe4`）
- 总阶段：`D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`
- 台账计数（会话结束时）：`27 ACCEPTED / 1 BLOCKED / 1 IN_PROGRESS / 79 PLANNED`

## 1. 会话成果总览

| 任务 | 结果 | 关键证据 |
|---|---|---|
| `P1R-M2-001` Gateway 运行安全边界 | **ACCEPTED** | `--run --browser --fault` **29/29 PASS**（11 浏览器用例、503/Redis 恢复、脱敏审计），独立终审 `ACCEPT`，manifest 23 artifacts（`sourceCommit=7ba4d33`） |
| `P1R-M2-002` 自有 IAM | **ACCEPTED** | 返工批次 ①–⑧；opt-in MySQL **19/19**、V13 迁移安全 **1/1**、非 local 跨进程重启刷新 **200（rotation=1）**、IAM 全套 **90/0/0（20 skipped）**；独立终审 `ACCEPT`（P0/P1/P2=0/0/0，余 2 项非阻塞 P3），manifest 35 artifacts（`sourceCommit=c9f935b`） |
| `P1R-M2-003` 领域服务 PEP 扩展 | **IN_PROGRESS（Batch 1 完成）** | 认领 + 只读调研 + 事实来源决策（服务侧 PDP 事实）；learning **121/0/0/0**、assessment **37/0/0/0**、content **113/0/0/0**、learner **30/0/0/0**；四个最高危服务完成“已验证 JWT + 默认拒绝 + 伪造头拒绝 + 负例测试”基线 |

## 2. 提交时间线（24）

- **M2-001 证据与验收**：`7ba4d33`（浏览器+故障注入运行证据归档）→ `183c08a`（独立终审 `ACCEPTED` + M2-002 REWORK 记录）→ `0408b9b`（验收门禁复核）
- **M2-002 返工批次 ①②**：`32e8835`（legacy Consent 显式历史条目）→ `a31a55b`/`c17c94f`（控制面策略来源 V14 + manifest 摘要重定）
- **M2-002 返工批次 ③**：`1bec2a0`（密码重置投递 handoff、缺失/禁用/限流审计、HMAC 目标摘要、429 `Retry-After`）
- **M2-002 返工批次 ④**：`f30e60c`+`24f2572`（403 契约声明尝试）→ `ec7b4ea`+`84b2ba6`（撤回契约尝试，改已声明 400 边界默认拒绝 native）
- **M2-002 返工批次 ⑤**：`49e337a`（Consent/Policy 部分提交加固）
- **M2-002 返工批次 ⑥**：`172dfca`（refresh 空 body 与媒体类型错误映射修复）→ `a9e577d`（opt-in/跨进程证据归档）
- **M2-002 返工批次 ⑦⑧**：`1a51bd4`（adult gate 守卫 + 幂等回调加固）→ `7c0f428`（空控制面 fail-closed）→ `c9f935b`（部分发布规范必需集）→ `52b3891`（终审 `ACCEPTED` + manifest）→ `bd3b525`（门禁复核）
- **M2-003**：`3ca4ad6`（认领）→ `6ef4a1f`（事实来源决策点）→ `80454d6`（Batch 1a learning）→ `32dc2d2`（Batch 1b assessment）→ `c15abe4`（Batch 1c content+learner）

## 3. M2-002 返工要点（⑧批）

- legacy Consent：显式 legacy 历史条目，历史可读但不授权，重放命中 legacy 返回确定性 409（不做 V14 伪造摘要回填）。
- Consent 策略来源：V14 `iam_consent_document_version`（不预置 fixture）+ `JdbcConsentPolicy`（只读 ACTIVE、缺行/坏行失败关闭）+ `iam.consent.policy-source` 开关（非 local 禁止 `local-candidate`）。
- 密码重置：投递 handoff（未配置传输不宣称送达）、缺失/禁用/限流审计（未解析主体哨兵）、域分离 HMAC 限流键、429 `Retry-After: 60`。
- native：`iam.auth.native-transport-policy=deny` 默认拒绝（400 已声明边界）；`local-unverified` 仅限 local/test。
- 原子性：Consent 审计移至 CAS 之后；Policy activate 先目标 CAS 后 supersede，失败整体回滚。
- 终审后加固：空控制面 `hasRequiredConsentFor` fail-closed（`7c0f428`）；按规范必需类型集合判定、部分发布缺失类型拒绝（`c9f935b`）。
- 冒烟发现并修复：契约允许的 refresh 空 body 幂等指纹 NPE；不支持媒体类型由 500 改规范 400；未预期异常处理器增加服务端日志。

## 4. M2-003 Batch 1 要点

- 事实来源决策（用户确认）：JWT 只提供已验证身份/租户/角色/权限；phase/consent/rights/撤销由服务侧策略/PDP 提供，缺失或异常默认拒绝。
- learning：新增 JWT authorities 转换器与 `LearningHttpPrincipals` 入口；删除生产 `phaseOne()` 硬编码 `ConsentState.GRANTED` 与死代码 resolver。
- assessment：新增转换器与 `AssessmentHttpPrincipals` 入口（此前无 PEP/权限模型，最高危）。
- content：新增转换器与 `ContentHttpPrincipals`；工厂要求显式 platform tenant 与非空 authority；修复头过滤器驼峰参数黑名单永不匹配的真实缺陷。
- learner：新增转换器与 `LearnerHttpPrincipals`（UUID/`prn_` 主体、platform 租户、`learner` 角色、非空权限）。
- 每个服务均补转换器/入口/头过滤器负例测试；契约检查 PASS（learning-loop 50、assessment 78、learner-planning 146 adversarial cases）。

## 5. 验证与门禁（会话内多次复跑）

- IAM 全套 `90/0/0（20 skipped）`；opt-in MySQL 矩阵 `19/19`；V13 `1/1`；跨进程重启刷新 `200（rotation=1）`。
- Gateway 运行批次 `--run --browser --fault` `29/29 PASS`。
- 全量 P1R 回归 **1421/1421 PASS**（Node 20.19.5）。
- `plan:p1r:check`（会话结束时 27/1/1/79）、`p1r-gap-registry-check` PASS（40 CLOSED / 5 OPEN）、`p1r:evidence:check` PASS（108 tasks / `errors: []`）、`docs:audit` PASS、`check-dod --strict` PASS=5 WARN=0 FAIL=0。
- 契约兼容：403 声明撤回后 OpenAPI 回到基线；`p1r:auth-contract:check`、`p1r:data-ownership:check` 等均 PASS。

## 6. 本机环境处理（会话内）

- 本地基础设施从临时 `cloudstudy-p1r-m2-*` 夹具切换到标准栈 `yuxuexing-local`（MySQL 13306 / Redis 16379 / Kafka 19092 / MinIO 19000-19001 / RabbitMQ 15689-15690，全部 healthy）；旧容器移除、数据卷保留。
- opt-in 隔离库：`iam_service` + `iam_v13_test_20260911_a`（`iam_runtime` 仅本地测试）。
- JDK 25 按命令临时覆盖（`C:\Users\tiansongzhen\.jdks\openjdk-25.0.2`），系统 `JAVA_HOME` 保持 JDK 21，不影响其他项目。
- 远程同步：本次 24 个提交已推送成功（`origin/dev = c15abe4`）。

## 7. 未完成与下一步

- **M2-003 剩余批次**：Batch 2（media/social/admin-ops，含 social tenant 缺省回退修复）→ Batch 3（notification/commerce/analytics）→ Batch 4（gamification）→ 运行证据与最终独立复审。
- **M2-002 遗留 P3**：legacy 重放控制器级 409 用例、规范必需类型映射维护断言。
- **M2-003 已知边界**：端点级细粒度 `@PreAuthorize` 权限矩阵、phase/consent/rights 的 PDP 事实源尚未接线（Batch 1 为“JWT 身份 + 默认拒绝”基线）。
- **其他**：`P1R-M0-006` 仍 `BLOCKED`（移动工具链高危漏洞）；M2-004…M2-010 待启动；总体阶段仍 `D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`。
