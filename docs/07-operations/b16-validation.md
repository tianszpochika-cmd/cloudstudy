# B16 Gateway / 自有 JWT / IAM-RBAC 开发与验证记录

> 记录日期：2026-08-23  
> 范围：Phase 1 代码层、逻辑测试和运行前静态门禁  
> 结论：B16 代码与静态回归入口已完成；真实跨进程运行证据仍被 Java 25、Maven、Docker 和 IAM 运行环境阻塞。

## 1. 本轮交付

- `config/b16-security-runtime.json`：B16 安全运行清单，冻结 Phase 1 默认拒绝、自有 JWT Gate、18+ 成人 Gate、服务侧 PEP、mTLS/workload identity 和运行证据要求。
- `services/api-gateway`：真实固定窗口限流后端（memory/Redis）、限流错误 envelope、上游连接/超时错误映射、CORS、关联 ID、内部路径拒绝和伪造 authority 清理。
- `services/iam-service`：账号密码校验、BCrypt/失败锁定、RS256 JWT/JWKS issuer/audience/claims 校验、刷新轮换 CAS、会话撤销、设备/同意/成人 Gate/审计安全边界；私钥只从 KMS/Secret 注入，不进入仓库或日志。
- `services/service-template`：Resource Server 默认拒绝、绑定请求指纹的 PDP 决策、策略版本回退保护、mTLS/workload identity 证书边界和伪造服务身份头拒绝。
- `learner-service`、`learning-service`、`assessment-service`：补齐服务侧 JWT Resource Server、401/403 envelope、默认拒绝和伪造 authority header 边界；assessment 新增同一安全配置模式。
- `scripts/runtime/validate-b16-security-manifest.mjs`、`scripts/runtime/b16-bootstrap.mjs`：静态与运行前预检；缺少运行前置条件时失败，不伪造成功。
- `tests/b16/b16-platform.test.mjs`：6 项静态回归，覆盖 Gateway/IAM/PEP/所有 Phase 1 domain service/mTLS 约束。

## 2. 已执行证据

| 命令 | 结果 |
|---|---|
| `pnpm test:b16` | 6/6 PASS |
| `pnpm b16:static` | PASS；安全清单、6 项测试、契约、端口、14 服务 runtime manifest 全部通过 |
| B1–B16 Node 回归 | 全部通过；B2 保留原有 3 个外部 TODO，其余测试通过 |
| `pnpm contracts:validate` | 402 operations、476 OpenAPI schemas、144 events、100 event payload schemas、4 JSON Schemas PASS |
| `pnpm contracts:compatibility` | 0 breaking PASS |
| `pnpm db:validate` | 21 migrations 与 synthetic fixtures PASS |
| `pnpm redis:validate` | 28 entries、7 synthetic samples PASS |
| `pnpm config:check` / `pnpm infra:check` | PASS（infra 为静态检查） |
| `pnpm security:b14` | PASS；12 services、566 source files、13 event fragments |
| `pnpm tasks:v2:check` | 103 tasks、B15/B16 各 6 项计数校验 PASS |
| `pnpm dod:check --strict` | 5 PASS、0 warn、0 fail |
| Java 纯 IAM 域/测试源码 `javac --release 24` | 编译 PASS；仅作为当前 Java 24 环境下的语法/类型辅助证据，不替代 Java 25 构建 |
| `git diff --check` | 无 whitespace error（Git 仅提示现有换行转换） |

## 3. 运行态阻塞证据

`pnpm b16:bootstrap` 已按设计执行静态门禁后停止，输出的阻塞项为：

- 当前运行时 Java 为 24，B15/B16 v2 服务要求 Java 25；
- Maven 不可用，无法执行 Spring Boot 4.1.1 构建和测试；
- Docker 不可用，无法启动 MySQL、Redis、Kafka、MinIO、RabbitMQ 或执行健康/重启恢复验证；
- IAM JWT issuer/JWKS、MySQL 会话和测试账号尚未注入，不能宣告真实认证联调；
- `G-IAM-JWT` 仍为 `closed`，Gateway 与所有领域服务保持默认拒绝，不能把 bearer header 存在性当成认证成功。

因此，本记录不能证明 Gateway 18070、IAM 18087、领域服务 18088–18098 的跨进程登录、刷新、登出、撤销、跨租户拒绝、密钥轮换、限流窗口或故障恢复已经运行通过。

## 4. 后续运行验收顺序

1. 准备 Java 25、Maven 3.9.9+、Docker/等价容器运行时、IAM JWT 私钥和合成测试账号。
2. 执行 `pnpm toolchain:check`、`pnpm b15:bootstrap -- --start-infra --require-healthy`，再执行 `pnpm services:build -- --all`。
3. 启动独立服务，验证 Gateway→IAM→domain PEP 的健康、账号密码登录、JWKS 缓存/轮换、refresh rotation、logout/revoke、跨租户 403、PDP/IAM 不可用 deny 和直连阻断。
4. 接入真实 IAM schema/Flyway adapter、持久化审计回放和 workload mTLS 后，补齐 B16-TEST-006 的 API、浏览器和四端深链 evidence。

在这些运行证据完成前，B16 只能标记为“代码/静态验证完成，运行态待验收”，不能宣告 Phase 1 已进入可发布状态。
