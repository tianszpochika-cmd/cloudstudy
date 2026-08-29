# B15 Phase 1 运行环境与基础设施验证

> **文档状态：Historical validation snapshot**。下文的 Java 24、5 个依赖、21 个迁移等数字只记录 2026-08-22 当次检查，不代表当前工作站或当前配置；现行依赖为 MySQL、Redis、Kafka、MinIO 四项必需依赖，RabbitMQ 仅作 `core-api` v1 可选兼容。当前状态读取规则见 [`README.md`](README.md)。

> 验证日期：2026-08-22（Asia/Shanghai）
> 执行范围：`V2-B15-ENV-001`、`INF-002`、`RUN-003`、`DATA-004`、`OBS-005`、`TEST-006`  𑁋 仅覆盖代码层、静态预检和当前工作站环境检查，不代替真实基础设施运行验收。

## 1. 结论

B15 已完成代码与静态预检基础，但尚未完成真实运行态。2026-08-22 当次工作站只有 Java 24，Maven 与 Docker 不可用；这些环境数字不是当前机器事实，也不影响现行 Java 25 目标基线。

阻止是预期行为：B15 的 bootstrap 默认会先检查工具链，缺少 Java 25/Maven 时立即失败，不会启动容器、不执行数据库破坏性清理，也不会把静态检查结果伪装成运行态通过。

## 2. 本次实现

- `config/toolchain-baseline.json`：锁定 Java 25、Maven 3.9.9、Spring Boot 4.1.1、Spring Cloud release train 和 v2 服务矩阵；保留 Java 17 `core-api` 兼容边界。
- `config/v2-runtime-services.json`：登记 Gateway、IAM、11 个 Phase 1 领域/平台服务和兼容 Core API 的项目、主类、固定端口和健康路径；AI、实时语音、K12/监护等未来服务保持禁用。
- `scripts/toolchain/check-toolchain.mjs`：静态检查 POM 版本与 Enforcer；运行态严格要求 Java 25/Maven >=3.9.9。
- `scripts/runtime/validate-v2-runtime-manifest.mjs`：检查运行清单、项目、主类、配置、端口、Actuator 路径和 loopback 边界。
- `scripts/runtime/b15-bootstrap.mjs`：提供安全预检、可选 `--start-infra`、可选 `--require-healthy`；不自动启动 Java 服务，不含 `down`、`DROP DATABASE` 或 `TRUNCATE TABLE`。
- `scripts/runtime/build-v2-services.mjs`、`scripts/runtime/run-v2-services.mjs`：提供显式 Maven 构建和独立 Java 进程运行；启动前强制 Java 25、固定端口和 Actuator readiness，健康失败会停止已启动子进程。
- `config/local-services.json`、`config/local-ports.json`、`.env.example`、`infra/docker/docker-compose.dev.yml`：现行配置以 MySQL、Redis、Kafka、MinIO 为 4 个 v2 必需依赖；RabbitMQ 仅为 `core-api` v1 可选兼容依赖。
- v2 服务启动配置：修正 `admin-ops-service`/`analytics-service` 的 18097/18098 端口漂移，补齐 Gateway、Commerce、Notification、Analytics 的 readiness group、优雅停机和 OTel 导出基线；运行清单现在会阻止端口/探针配置不一致。
- `tests/b15/b15-static.test.mjs`：覆盖运行清单、Phase 1 禁用边界、Kafka/固定端口、Compose 健康标记和 bootstrap 安全开关。

## 3. 验证证据

| 命令 | 结果 | 说明 |
|---|---|---|
| `pnpm test:b15` | PASS，5/5 | B15 静态测试全部通过，包括构建器和独立进程运行器边界 |
| `pnpm b15:static` | PASS | 2026-08-29 复验：14 个服务工具链静态检查、运行清单、固定端口注册、4 个 v2 必需依赖/7 个绑定、24 个仓库迁移、合成 fixture 和配置安全开关通过 |
| `pnpm toolchain:check -- --static-only` | PASS | v2 POM 均为 Java 25、release 25、Spring Boot 4.1.1，并启用 Enforcer |
| `pnpm toolchain:check` | BLOCKED | Java 24，不满足 Java 25；Maven unavailable |
| `pnpm b15:bootstrap` | BLOCKED | 在工具链检查处停止；未启动 Docker、Java 服务或数据库迁移 |
| `node scripts/runtime/validate-v2-runtime-manifest.mjs` | PASS | 14 个服务、loopback、Phase 1 manifest 通过 |
| `pnpm infra:check` | PASS（静态） | 2026-08-29 复验：4 个 v2 必需依赖、7 个固定端口绑定静态通过；RabbitMQ 为可选兼容，Docker 健康态未验证 |
| `pnpm db:validate` | PASS（静态） | 21 个迁移和合成 fixture 通过；未连接真实 MySQL |
| `pnpm config:check` | PASS | 7 个 Phase 1 安全开关通过 |
| `node --check scripts/runtime/build-v2-services.mjs` | PASS | 构建器语法检查通过 |
| `node --check scripts/runtime/run-v2-services.mjs` | PASS | 独立进程运行器语法检查通过 |
| `python -c "import yaml; fs=['services/api-gateway/src/main/resources/application.yaml','services/commerce-service/src/main/resources/application.yaml','services/analytics-service/src/main/resources/application.yml','services/notification-service/src/main/resources/application.yml','services/admin-ops-service/src/main/resources/application.yml','services/core-api/src/main/resources/application.yml']; [yaml.safe_load(open(f,encoding='utf-8')) for f in fs]"` | PASS | 6 份关键 Spring application YAML 解析通过 |
| `pnpm services:build -- --all --dry-run` | PASS | 14 个 manifest 服务均生成固定 Maven 构建命令 |
| `pnpm services:run -- --service api-gateway` | BLOCKED | 运行器在 Java 25 检查处停止，当前检测到 Java 24，未启动服务 |

## 4. 运行态阻塞与接续命令

在具备 Java 25、Maven 3.9.9+ 和 Docker 后，按顺序执行：

```powershell
pnpm ports:check
pnpm toolchain:check
pnpm b15:bootstrap -- --start-infra --require-healthy
pnpm services:build -- --all
pnpm services:run -- --all
```

随后才可以执行 Java 服务构建/启动、真实 Flyway 迁移、Kafka/Redis/MinIO smoke、健康矩阵、优雅停机和跨服务 trace 验证。若任一健康检查失败，应保留日志并停止进入 B16，不得用 `b15:static` 代替运行态证据。

## 5. 范围声明

- 本次没有提交真实用户隐私、生产凭证、支付密钥或音频原始数据。
- 本次没有打开 Phase 2 AI、实时语音或 Phase 3 K12/监护默认路由。
- B15 不能宣告“全部完成”，只能宣告“代码与静态预检完成，运行态待环境就绪”。B16–B22 仍需按依赖执行；Phase 1 只有在 B15–B22 的运行、测试、发布和观察期证据齐全后才能上线。
