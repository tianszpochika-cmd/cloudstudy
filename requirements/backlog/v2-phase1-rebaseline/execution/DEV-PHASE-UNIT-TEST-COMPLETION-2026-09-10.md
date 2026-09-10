# 开发阶段 · 单元测试补全完成报告（2026-09-10）

> 范围：语学星 P1R **开发阶段**（逻辑开发 · 逻辑性测试 · 函数单元测试）。
> 不含：浏览器测试 · 人工测试 · 环境测试 · 真实数据测试（属**测试阶段**）。
> 验证口径：`JAVA_HOME=<JDK 25> mvn -fae clean test`（14 个 Maven 模块，`services/core-api` 为 v1 legacy 不在 reactor 内）。

---

## 一、结论

**开发阶段可宣告结束。**

| 指标 | 数值 |
|---|---|
| Maven 模块 | **14 / 14 SUCCESS** |
| 测试总数 | **719** |
| Failures | **0** |
| Errors | **0** |
| Skipped | **14**（全部在 iam-service，均为需真实 DB 的 `@EnabledIfSystemProperty` 集成测试） |
| 全仓单命令耗时 | 5 分 20 秒 |

**skipped 的 14 项正是开发阶段与测试阶段的分界线**，在开发阶段不启用属预期：

- `iam.jdbc.integration=true` → `IamJdbcPersistenceContextTest`(8) / `IamConsentJdbcPersistenceContextTest`(4)
- `iam.jdbc.migration.integration=true` → `IamPolicyJdbcPersistenceContextTest`(1) / `IdempotencyV13MigrationSecurityTest`(1)

---

## 二、各模块最终结果

| # | 模块 | Tests | Fail | Err | Skip |
|---:|---|---:|---:|---:|---:|
| 1 | api-gateway | 69 | 0 | 0 | 0 |
| 2 | iam-service | 67 | 0 | 0 | 14 |
| 3 | learner-service | 22 | 0 | 0 | 0 |
| 4 | content-service | 103 | 0 | 0 | 0 |
| 5 | learning-service | 112 | 0 | 0 | 0 |
| 6 | assessment-service | 28 | 0 | 0 | 0 |
| 7 | media-service | 41 | 0 | 0 | 0 |
| 8 | notification-service | 71 | 0 | 0 | 0 |
| 9 | gamification-service | 26 | 0 | 0 | 0 |
| 10 | social-service | 44 | 0 | 0 | 0 |
| 11 | commerce-service | 68 | 0 | 0 | 0 |
| 12 | admin-ops-service | 34 | 0 | 0 | 0 |
| 13 | analytics-service | 22 | 0 | 0 | 0 |
| 14 | service-template | 12 | 0 | 0 | 0 |
| | **合计** | **719** | **0** | **0** | **14** |

---

## 三、本轮交付内容

新增 **57 个测试文件**，分布于 11 个服务：

| 服务 | 新增文件数 | 覆盖重点 |
|---|---:|---|
| learning-service | 17 | SM2/SRS 调度、掌握度阶段、计划状态机、幂等键、事实存储 |
| content-service | 11 | 命令服务生命周期与授权、发布门禁、投影策略（防答案泄漏）、版本状态机 |
| notification-service | 9 | 可信事件白名单、同意过滤、模板 locale、FailClosed 适配器、DLQ 恢复 |
| commerce-service | 8 | 激活码权益、支付回调去重与验签、端口注册表完整性 |
| social-service | 3 | 服务侧 PEP（身份→权限→租户→所有者）、Principal 身份事实、错误包络 |
| admin-ops-service | 3 | 单次确认凭据（跨租户/跨用户/资源绑定/过期）、5 个 FailClosed 适配器 503 语义 |
| media-service | 2 | 权利窗口 `[start, expiry)`、服务侧 PEP 全链路授权 |
| learner-service | 1 | Outbox 事件包络（命名规范、correlation id、载荷深度校验） |
| gamification-service | 1 | 可信完成事件防伪造（客户端奖励字段拒绝、来源白名单） |
| assessment-service | 1 | 规则评分引擎 7 种题型 |
| analytics-service | 1 | 隐私门禁（禁 PII / 禁字段 / Bearer 与 data: 值 / 嵌套校验 / 不可变） |

**测试目标选择原则**：优先 `FailClosed*`、PEP/授权判定、隐私门禁、状态机、校验规则（纯逻辑 + 安全关键）。

---

## 四、发现的缺陷与修复

### 4.1 测试代码缺陷（22 个失败，`src/main` 一行未改）

这些测试由子 agent 生成，因频率限制中断、**未能对照实现验证**，本质是"猜实现行为猜错了"。

| # | 类型 | 实例 |
|---|---|---|
| 1 | 输入不合业务规则 | commerce 用 `"issue-N"`（7 字符 < 实现的 8–128 要求），共 7 处 |
| 2 | Java 集合构造器抢先抛异常 | `List.of(null)` 抛 NPE；`Set.of(重复)` 抛 IAE；`Map.of(k, null)` 抛 NPE |
| 3 | `Map.copyOf` 的 null 语义 | 顶层 payload null 值由 `Map.copyOf` 抛 **NPE**（早于 `validateValue` 的 IAE 分支）；嵌套 null 才走 IAE |
| 4 | 时间未递增 | SM2 测试 `ladder(7)` 已推进到 `NOW+25200`，后续却用 `NOW+99`，触发单调性防护（4 处） |
| 5 | 前置条件缺失 | 通知 locale 测试漏 `consents.setConsent(...)` |
| 6 | 语义理解错误 | `find()` 是 Optional 语义不应抛异常；`reasonCode` 对外为 `TEMPLATE_NOT_ALLOWLISTED` |
| 7 | 参数写错 | `completed>total` 实际传 (5,6)；`LearningPlan` 需先 `resume` 才能 `completeTask` |
| 8 | 边界值判断错 | `MasteryStage` 是 `score>=85 && attempts>=3`；`SrsStage` 是 `rep>=4 && interval>=30` |
| 9 | 异常类型错 | `Objects.requireNonNull` 抛 NPE 而非 IAE（`IdempotencyKey`、`SrsState`、`LearningSchema`） |
| 10 | ID 格式约束 | `LearnerTenantScope` 的 subjectId 必须是 `prn_`+≥15 字符 或已验证 UUID |

**核心纪律：agent 产出的测试，必须实际跑通才算完成；写测试前必须先读实现。**

### 4.2 源码布局缺陷（1 处，真实缺陷，已修）

**`api-gateway` 测试文件包/目录错配**

- 文件：`services/api-gateway/src/test/java/com/englishflow/gateway/CanonicalRoutePolicyRouteLocatorIntegrationTest.java`
- 问题：物理位于 `gateway/` 目录，却声明 `package com.englishflow.gateway.config;`
- 症状：全仓不带 `clean` 构建时 `NoClassDefFoundError: GatewayProperties`（`target/` 中残留旧 class 与新产品冲突）；单模块 `clean test` 则 69/69 全绿
- 修复：`git mv` 归位到 `config/` 目录

**规则**：Java 源文件必须"包名 == 目录路径"，否则编译产物落点不稳定，是间歇性构建失败的常见根源。

---

## 五、环境教训（影响后续所有构建验证）

**VSCode 的 Java 语言服务器（redhat.java / JDT LS，常驻 1.4–2 GB）会与 Maven 争抢各模块 `target/` 目录**，导致：

1. `maven-compiler-plugin` 报 `写入 xxx.class 时出错`（Windows 文件锁）；
2. 构建**卡死**（某模块零文件写入，进程不退出）；
3. 增量编译残留旧 class → 运行时 `ClassNotFoundException`。

**实证**：三次全仓构建分别失败在 api-gateway / media-service / learning-service **三个不同模块**，而每个模块单独重跑即全绿 → 环境争用，非代码缺陷。

**正确做法**：
- 跑全仓构建/验证前**关闭 VSCode**（或至少禁用 Java 扩展）；
- 验证必须用 `mvn clean test`（带 `clean`），否则会漏掉"陈旧产物 + 目录错配"类缺陷；
- 某模块构建异常时，先**单模块 `clean test` 复跑**再判定是否为代码问题。

---

## 六、测试阶段边界（明确不做）

以下属**测试阶段**，需真实环境（Docker / MySQL 13306 / Redis 16379 / Kafka）：

- 浏览器测试（Playwright）
- 人工测试
- 环境测试
- 真实数据测试
- 上述 14 个 `iam.jdbc.*` 集成测试
- M2-001 / M2-002 运行层 Evidence（受 V13 漂移阻塞）
