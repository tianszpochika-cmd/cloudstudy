# IT-3 计划今日（R1-030…042）

`kind`: `R2_IT3_PLAN_TODAY`。`accepted`: false。`lunaStamp`: false。这不是站级签收，也不是报告→横幅→今日任务的浏览器通过。

## 卡

R1-030…040 的代码已落在本分支工作区：正式报告才 ensure，解释句进不可变快照，今日空态按原因分流，`POST /api/v1/learning/plans:replan` 要求确认影响和 `If-Match`，只改未开始的 SRS。Web 与 H5 共用同一套今日计划规则。

R1-041（交互对稿）和 R1-042（干净库重放）没有跑。本轮监督进程里的 IAM 只听 HTTP `127.0.0.1:18087`（actuator 200）。`https://127.0.0.1:18087` 连接失败。磁盘上没有 `iam-server.p12` / `test-ca.pem`，`tls-harness` 不能签发。没有把证书写入 macOS 钥匙串，没有把客户端改成忽略证书或改打 HTTP，也没有为这两张卡新建专用 schema。

## 已跑测试

顶层 Node 门禁（不含 `tests/b10|b11|b12`），Node v20.19.5，串行：

```sh
node --test --test-concurrency=1 apps/mobile/tests/*.mjs apps/learner-web/tests/*.mjs
```

299 项，298 通过，1 失败。唯一失败文件是 `apps/mobile/tests/support-real-gateway.e2e.mjs`，阶段 `register`，`registered:false`，清理 `ACCOUNT:0`。日志 `/tmp/cs-r2/node-tests-r2-it3.log`，约 89 秒，退出码 1。同一文件已在台账第 4 节记为跳过。历史证据 `unit-tests-r2/` 仍是修复提交当时的 292/291/1，不回写。

本轮新增的计划今日用例包含在这 299 项里。其中 `apps/mobile/tests/mobile-state-boundaries.e2e.mjs` 与 `apps/mobile/tests/c03-learning-flow.test.mjs` 通过。聚焦的 `plan-today` 相关 Node 用例在并入全量前是 60/60。

learning-service：`PlanDayFactsTest`、`PlanInputHistoryTest`、`PlanningInputAssemblyTest`、`LearningJdbcPermissionBoundaryTest` 合计 12 项，0 失败，BUILD SUCCESS。

api-gateway：`GatewayRoutePolicyContractParityTest` 6 项，0 失败，BUILD SUCCESS。

契约：`pnpm contracts:merge:check` 为 28 个 OpenAPI 片段、436 条路由。`pnpm contracts:generate:check` 为 5 个生成文件。`pnpm contracts:validate` 通过：468 operations，818 OpenAPI schemas，退出码 0。

`pnpm typecheck`（turbo）7 项任务成功，退出码 0。执行到的包是 contracts、design-tokens、i18n、performance、api-client、mobile、learner-web。

`pnpm test`（turbo）只执行有 `test` 脚本的 `@englishflow/i18n`：11 项通过，缓存命中，退出码 0。它不重跑两端顶层的 299 项。

`pnpm dod:check` 输出 `ok: true`，5 项 PASS、0 失败，`strict` 为 false，退出码 0。

`node --test tests/p1r/p1r-gateway-contract.test.mjs`：38 项，34 通过，4 失败。失败名：

- Gateway contract audit passes the dedicated fragment and exact canonical projection
- M2-001 health identity is Gateway-owned and the compatibility projection permits exactly two scalar corrections plus the root plus reviewed additive nodes
- Gateway execution plan shape cannot bypass validation
- M1-017 has exactly eight public and nine internal operations with exact owner, security and authorization

这 4 项在 detached `eee50c76` 上同样失败（`/tmp/cs-r2/p1r-baseline.log`）。审计错误仍是既有的 public operation baseline drift（expected 365, got 401）、`iam-account-deletions` 未冻结、internal operation baseline drift（expected 66, got 67）。没有改冻结 hash。`docs/07-operations/local-development.md` 写明 2026-10-06 的 P1R 完整回归仍有 26 项失败。

## 浏览器

H5 夹具 e2e 在上述 299 项里通过，页面仍能看到「今天还没有安排任务。」。这是夹具路由，不是真实 IAM。

learner-web 用本机 Chrome 打开 `/`、`/today`、`/courses`、`/login`，视口 1280 与 390。八次都是 HTTP 200、标题「语学星」、`errors` 为空。八次 `overflow` 都是 true，包括本轮没有改过的 `/login`，所以不能当成 IT-3 布局通过，也不能当成站级走查。

## 清理

本轮启动后已停掉的进程组：

- PGID 73799：`pnpm services:run -- --all` 及其 Java（Gateway 18070、workflow 18071、IAM 18087、learner 18088、content 18089、learning 18090、assessment 18091、media 18092、notification 18093、gamification 18094、social 18095、commerce 18096、admin-ops 18097、analytics 18098、audit 18099）
- PGID 67240：mobile H5 `127.0.0.1:18183`
- PGID 20695：learner-web `127.0.0.1:18180`

停后这些端口不再监听。没有删除 schema。本轮没有为 IT-3 新建专用库。当时在跑的 learning-service 是 V12 写入之前打的 JAR，停止它不会把 V12 应用到共享库。

仍在运行、本轮没有动：`yuxuexing-local-mysql-1`（13306）、`yuxuexing-local-redis-1`（16379）、`yuxuexing-local-minio-1`（19000/19001）、`yuxuexing-local-kafka-1`（19092）、既有 qida 容器，以及 Docker 在 `127.0.0.1:18081` 上的监听。保留库 `r1_it1_browser_20261010_iam_5d9f4b7e` 与 `r1_it1_browser_20261010_cnt_5d9f4b7e` 没有删除。

## 未跑的全仓门禁

`pnpm build`、mobile `build:h5` / `build:app`、`mvn -B -ntp -f pom.xml test`、`pnpm test:p1r` 没有作为整仓门禁跑完。全量 Maven 的多个 `@SpringBootTest` 默认连 `127.0.0.1:13306` 的共享 `iam_service` 等 schema。本轮不在共享库上启动这些集成上下文，也不为了门禁新建或删除库。见台账第 4 节。
