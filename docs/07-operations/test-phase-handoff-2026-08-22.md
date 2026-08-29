# B0–B22 代码基线与测试阶段交接证据（2026-08-22；Historical / Superseded）

> 状态：Historical / Superseded（2026-08-22 交接快照）。本文件保留当时的任务、阻塞和证据事实用于审计；其中旧外部认证/OIDC、旧授权入口、旧服务边界和旧执行顺序均不可作为当前命令或验收依据。当前认证与运行入口以 ADR-0013、现行 v2 任务基线和最新运行记录为准。

> 执行日期：2026-08-22；2026-08-23 追加 B15/B16/B17/B18/B19/B20/B21/B22 与 G0–G4 代码和静态验证结果。本文记录 B5/B9 修复、契约重新生成、B0–B22 代码级验证、G0–G4 横切 DoD 门禁，以及前端构建/静态联调/系统测试基础/安全隐私灾备/预发布/上线观察 Gate 证据。它不是生产发布、真实基础设施、真机、容量或灾备验收证明。

## 1. 结论

- B1–B22 的代码/逻辑测试达到预期：除 B2 明确保留的 3 个外部集成 TODO 外，没有失败项；B17 专项 17/17、B18 专项 7/7、B19 专项 23/23、B20 专项 22/22、B21 专项 26/26、B22 专项 35/35 通过。
- 契约、迁移、Redis、运行配置、固定端口、安全边界、任务基线和前端构建门禁均通过。
- 四个前端开发服务已启动，HTTP 200 和浏览器页面烟测通过；移动 H5 的空白页问题已修复并复测通过。
- 后端微服务、真实 staging、生产切换和基础设施本轮没有启动成功：当前机器只有 Java 24，没有 Maven，也没有 Docker；v2 服务要求 Java 25 + Maven，基础设施编排要求 Docker。因此不能把本轮结论扩大为“全系统所有项目均已运行”或“Phase 1 已上线”。

当前可正式交接为：**B0–B22 代码/静态验证与 G0–G4 DoD 门禁实现完成，B17 合成旅程、B18 四端静态联调、B19 系统测试基础、B20 安全/隐私/内容/支付/灾备 Gate、B21 预发布/RC/Go-No-Go Gate 和 B22 生产上线/观察期 Gate 静态回归通过，进入后端运行态/基础设施/浏览器扩展/真机/专项 QA/发布与上线测试准备；尚未完成全系统运行态验收，G0–G4 运行证据和 B21/B22 发布决策保持阻塞/NO-GO。**

## 2. 基线与本轮修复

| 项目 | 证据 |
|---|---|
| 上一代码基线 | `a9856986d50603796726a00438ec12ba8dd3a68d`（`chore: commit workspace through B14 baseline`） |
| B5 契约修复 | `tests/b5/b5-static.test.mjs` 同时断言 B5 compatibility fragment 的 `createCommerceOrder`，以及 B13 对 canonical `/api/v1/commerce/orders` 的有意覆盖；避免把兼容契约和目标契约误判为冲突。 |
| B9 测试修复 | `tests/b9/b9-code-boundaries.test.mjs` 允许官网共享 foundation 仅保存 UI locale/theme，继续禁止 refresh token、sessionStorage 和 Authorization；并断言 storage 使用位置唯一。 |
| 契约重新生成 | `pnpm contracts:merge`：19 OpenAPI fragments、13 event fragments、374 routes、144 events；`pnpm contracts:generate`：5 generated files。 |
| 移动 H5 启动修复 | `apps/mobile/package.json` 增加直接 `@dcloudio/uni-h5` 依赖；`apps/mobile/src/compat/vue.ts` 补齐 uni-h5 所需的 Vue 兼容导出，恢复 H5 runtime mount。 |

## 3. B0–B22 当前状态

“代码层通过”不等于真实数据库、消息总线、IAM JWT 认证中心、跨进程服务、设备或生产迁移已经验收；初始状态列仍保留在任务基线中用于审计。

| 批次 | 当前代码/逻辑状态 | 本轮证据 | 测试阶段剩余 |
|---|---|---|---|
| B0 | 基线与全局门禁已建立 | `dod:check`、契约/配置/端口/任务基线门禁通过 | 运行编排与真实基础设施 |
| B1 | 代码层通过 | 7/7 | Core API、MySQL/Redis、浏览器和设备链路 |
| B2 | 代码层通过；保留 3 个外部 TODO | 14 pass、3 TODO、0 fail | Core API+MySQL+Redis、浏览器集成、Docker 基础设施 |
| B3 | 代码层通过 | 17/17 | 真实媒体/存储、浏览器完整交互、原生设备能力 |
| B4 | 代码层通过 | 6/6 | 实时传输、持久化、浏览器/真机弱网 |
| B5 | 代码层通过；契约归属已澄清 | 4/4 | 支付 sandbox、SSO/RBAC、真实持久化和端到端 |
| B6 | 代码层通过 | 4/4，平台矩阵通过 | 真机、无障碍、弱网、备份恢复和发布签字 |
| B7 | 代码层通过 | 28/28 | Java 25/Maven Gateway、真实限流和浏览器/设备 |
| B8 | 代码层通过；JWT runtime Gate 默认 Gate 仍关闭 | 28/28 | 真实 自有 JWT 登录/JWKS、PDP/撤销和设备 |
| B9 | 代码层通过 | 6/6 | Java 25 服务、数据库/Kafka、浏览器和设备 |
| B10 | 代码层通过 | 7/7 | 目标服务运行态、数据库/Kafka、浏览器和设备 |
| B11 | 代码层通过 | 4/4 | 媒体/对象存储、录音权限、浏览器麦克风和设备 |
| B12 | 代码层通过 | 7/7 | Gateway/Workflow/数据库、浏览器和设备 |
| B13 | 代码层通过 | 12/12 | Kafka/worker、支付 Gate、Gateway/自有 JWT 登录、浏览器和设备 |
| B14 | 代码层通过 | 6/6 + 安全扫描 | Java 25 Gateway、真实迁移/回滚、容器化跨进程和设备 |
| B15 | 代码与静态预检完成，运行态阻塞 | 5/5、`b15:static` | Java 25/Maven/Docker、独立服务、迁移和基础设施健康 |
| B16 | 代码与静态回归完成，运行态阻塞 | 6/6、`b16:static`；真实测试 IAM JWT 认证中心 未接入 | Gateway→IAM→PEP 跨进程授权、持久化、mTLS、撤销和 E2E |
| B17 | 代码、静态与合成回归完成，运行态阻塞 | 17/17、`b17:static`；11 服务清单、读写链、Outbox/Saga 边界通过 | Java 25/Maven/Docker、MySQL/Kafka、真实 Gateway/IAM JWT 认证中心、跨进程链路和回滚 |
| B18 | 代码、静态联调与四端构建完成，真实 API/浏览器/设备阻塞 | `tests/b18` 7/7、`b18:static`；learner/mobile/admin/official 构建与固定 origin/账号矩阵通过 | Gateway/IAM JWT 认证中心/领域 API、Playwright、App/小程序/真机、公开投影运行证据 |
| B19 | 代码、静态系统测试基础完成，真实运行态阻塞 | `tests/b19` 23/23、`b19:static`；契约生成/兼容、4 browser runtimes、9 device profiles、10 quality gates 通过 | Gateway/IAM JWT 认证中心/Kafka/MySQL、Playwright/原生 Safari、真机、弱网/性能/读屏/对比度和真实缺陷报告 |
| B20 | 代码与静态 Gate 基础完成，真实安全/隐私/内容/支付/灾备运行态阻塞 | `tests/b20` 22/22、`b20:static`；安全 10/10 静态、隐私/内容 7/7 静态、商业/灾备 evidence index 22、运行证据全部 pending | Java 25/Maven/Docker、CI/KMS/Vault/镜像扫描、隐私请求/审计回放、版权双审、支付 sandbox 资质/登录后会话恢复、备份恢复/RPO/RTO、双人发布复核 |
| B21 | 代码与静态发布 Gate 基础完成，真实 staging/RC/Go-No-Go 阻塞 | `tests/b21` 26/26、`b21:static`；DEP/STG 13/13 静态、OBS/RC 6/6 静态、GATE/TEST 9/9 静态；runtime 全部 pending/blocked、release decision=NO-GO | B20 runtime acceptance、Java 25/Maven/Docker、真实 Kubernetes/registry/secret、OTel/SLO/告警、固定 RC 回归、回滚演练和五角色独立签字 |
| B22 | 代码与静态上线 Gate 基础完成，真实生产/观察期阻塞 | `tests/b22` 35/35、`b22:static`；REL 8/8 静态、DATA 9/9 静态、OPS/TEST 6/6 静态；runtime 全部 pending/blocked、release decision=NO-GO | B21 runtime acceptance、生产小流量、四端版本/签名、MySQL/Kafka 迁移对账、真实 SLO/告警/客服观察、Phase 1 报告和维护交接 |
| G0–G4 | 横切 DoD 门禁代码与静态基础完成，真实 Gate 证据阻塞 | `test:g` 41/41、`g:static`；G0 5/3、G1 6/6、G2 10/8、G3 12/12、G4 10/12 静态/运行检查通过；runtime 证据保持 pending/blocked | 范围签收、真实契约/迁移 diff、四端浏览器/设备回放、安全扫描/观测、发布审批/恢复/回滚和维护签字 |

## 4. B1–B22 测试结果

| 命令 | 结果 |
|---|---:|
| `pnpm test:b1` | 7/7 pass |
| `pnpm test:b2` | 14 pass / 3 TODO / 0 fail |
| `pnpm test:b3` | 17/17 pass |
| `pnpm test:b4` | 6/6 pass |
| `pnpm test:b5` | 4/4 pass |
| `pnpm test:b6` | 4/4 pass |
| `pnpm test:b7` | 28/28 pass |
| `pnpm test:b8` | 28/28 pass |
| `pnpm test:b9` | 6/6 pass |
| `pnpm test:b10` | 7/7 pass |
| `pnpm test:b11` | 4/4 pass |
| `pnpm test:b12` | 7/7 pass |
| `pnpm test:b13` | 12/12 pass |
| `pnpm test:b14` | 6/6 pass |
| `pnpm test:b15` | 5/5 pass |
| `pnpm test:b16` | 6/6 pass |
| `pnpm test:b17` | 17/17 pass |
| `pnpm test:b18` | 7/7 pass |
| `pnpm test:b19` | 23/23 pass |
| `pnpm test:b20` | 22/22 pass |
| `pnpm test:b21` | 26/26 pass |
| `pnpm test:b22` | 35/35 pass |

B2 的 3 个 TODO 是原测试明确标记的外部集成项：Core API + MySQL/Redis 运行态、浏览器主动回忆交互、Docker Compose 基础设施健康检查；不是本轮代码测试误报。

## 5. 其他门禁与生成证据

| 类别 | 结果 |
|---|---|
| OpenAPI/事件/schema | `contracts:validate`：402 operations、476 OpenAPI schemas、144 events、100 event payload schemas、4 JSON Schemas |
| 契约兼容 | `contracts:compatibility`：0 breaking |
| 数据库 | `db:validate`：21 migrations，fixtures 安全 |
| Redis | `redis:validate`：28 entries、7 synthetic samples、Redis 7.x |
| 配置 | `config:check`：7 flags，Phase 1 safety switches closed |
| 安全 | `security:b14`：12 services、583 source files、13 event fragments；B16/B17 另有 Gateway/IAM/PEP 与服务/事件静态清单 |
| 固定端口 | 启动前 `ports:check` 全部登记端口 free；启动后 18180–18183 由前端服务有意占用 |
| 发布矩阵 | `release:b6:check`：WEB/H5/ANDROID/IOS/IPAD/WECHAT_MINI_PROGRAM/WINDOWS_PWA 通过 |
| 任务基线 | 当前 `tasks:v2:check`：103 tasks，PASS；B15–B22 的代码/静态切片已完成，B22 真实上线/观察期证据仍 pending |
| B21 发布 Gate | `test:b21` 26/26、`b21:static`：部署/staging、观测/RC、Go/No-Go 三组静态证据通过；runtime evidence 仍 pending/blocked |
| B22 上线 Gate | `test:b22` 35/35、`b22:static`：生产金丝雀、迁移对账、观察期和 Phase 1 报告三组静态证据通过；runtime evidence 仍 pending/blocked |
| G0–G4 DoD | `test:g` 41/41、`g:static`：五组 Gate validator、B22 静态前置、固定端口、运行配置和任务基线通过；runtime evidence 仍 pending/blocked |
| DoD | `dod:check --json` / `--strict`：pass 5、warn 0、fail 0 |

## 6. 四端构建

| 项目/目标 | 结果 |
|---|---|
| `apps/learner-web` | `vue-tsc && vite build` 通过 |
| `apps/admin-web` | `vue-tsc && vite build` 通过 |
| `apps/official-site` | Nuxt client/SSR/Nitro build 通过，14 个 prerender outputs；因开发服务锁使用 `NUXT_IGNORE_LOCK=1` 构建 |
| `apps/mobile` H5 | `uni build -p h5` 通过 |
| `apps/mobile` App | `uni build -p app` 通过 |
| `apps/mobile` 微信小程序 | `uni build -p mp-weixin` 通过 |

构建输出中仍有已知的 CJS API、Sass legacy API、动态 import chunk、大 chunk 和 Nuxt/Nitro 依赖解析警告；本轮没有编译失败。

## 7. 已启动项目与烟测

### 7.1 前端开发服务

| 项目 | 地址 | HTTP | 浏览器结果 |
|---|---|---:|---|
| learner-web | `http://127.0.0.1:18180/` | 200 | 标题为“语学星”，欢迎/学习工作台内容可见，无新的 console error |
| admin-web | `http://127.0.0.1:18181/login?redirect=/dashboard` | 200 | 正确进入登录页，显示“教研与运营中台”，无新的 console error |
| official-site | `http://127.0.0.1:18182/` | 200 | 首页标题、公开导航和品牌内容可见；`/courses`、`/pricing`、`/sitemap.xml` 均 200 |
| mobile H5 | `http://127.0.0.1:18183/` | 200 | `#app` 已挂载，当前路由为 `#/`，页面为 `pages/home/home`，底部导航和今日闭环内容可见 |

记录时监听进程为：18180→PID 10728、18181→PID 24888、18182→PID 8256、18183→PID 17436。进程保持运行，便于继续测试。移动 H5 的早期兼容报错（`logError`/`createVueApp` 缺失）已在修复前的历史日志中留痕；修复后的新加载未再出现这两类错误。

### 7.2 后端与基础设施启动阻塞

本轮已实际检查启动条件：

- `java -version`：Java 24（`24+36-3646`）；v2 `api-gateway`、`iam-service` 和目标服务 POM 要求 Java 25。
- `Get-Command mvn`：未找到 Maven；仓库也没有 `mvnw`。
- `docker --version` / `docker compose version`：未找到 Docker。
- `pnpm b16:bootstrap`：静态门禁通过，但因 Java 24、Maven/Docker 不可用和 B16 测试 IAM JWT 认证中心 环境变量缺失而按设计失败；JWT runtime Gate 保持关闭。
- `pnpm b17:bootstrap`：静态门禁通过；真实模式按设计因 Java 24、Maven/Docker 不可用、B16 测试 IAM JWT 认证中心 未注入和 Kafka 前置变量缺失而失败，未伪造 11 个服务、数据库、Kafka 或跨进程 E2E 已启动。
- `pnpm b19:bootstrap --require-runtime`：B18/B19 静态门禁、契约、任务基线和 B17 前置检查均执行；按设计因 Java 24、Maven/Docker、B16 IAM JWT 认证中心/Kafka 以及 B19 Gateway/账号/数据库/浏览器/设备 evidence 变量缺失而失败，未伪造真实系统测试通过。
- `pnpm b20:bootstrap --require-runtime`：B19 前置静态门禁和 B20 测试/validator 均通过；按设计因 Java 24、Maven/Docker、B16/B19 运行依赖以及 B20 隐私/审计/内容/支付/灾备 evidence 变量缺失而失败，未伪造安全、支付或灾备运行态通过。
- `pnpm b21:static`：B20 静态前置、B21 三组测试/validator、契约、生成、兼容、固定端口、运行配置和任务基线均通过；部署/staging 13 个静态检查、观测/RC 6 个静态检查、Go/No-Go/RC evidence 9 个静态检查通过，运行检查全部保持 pending/blocked。
- `pnpm b21:bootstrap --require-runtime`：按设计先要求 B20 runtime Gate 被接受；当前因 Java 24、Maven/Docker、B16–B20 运行前置和外部 evidence 变量缺失而失败，未创建 staging 集群、未发布镜像、未切换流量、未批准 Go。
- `pnpm b22:static`：B21 静态前置、B22 三组测试/validator、契约、生成、兼容、固定端口、运行配置和任务基线均通过；REL 8 个静态检查、DATA 9 个静态检查、OPS/TEST 6 个静态检查通过，运行检查全部保持 pending/blocked。
- `pnpm b22:bootstrap --require-runtime`：按设计先要求 B21 runtime Gate 被接受；当前因 B20/B21 运行前置、Java 24、Maven/Docker 和 B22 外部 evidence 变量缺失而失败，未执行生产切流、迁移、观察期或 Phase 1 关闭。
- `pnpm test:g`：G0–G4 边界测试 41/41；G2 配置/validator 字段冲突已修复，G0/G1/G3/G4 静态 validator 与运行 fail-closed 规则通过。
- `pnpm g:static`：DoD strict、B22 静态前置、G0–G4 测试/validator、固定端口、运行配置和 B7+ 任务基线通过；`pnpm g:bootstrap --require-runtime` 仍需真实外部证据并按设计阻塞。

因此以下项目本轮没有被伪造为“已启动”：Gateway 18070、IAM 18087、目标领域服务 18088–18098、兼容 Core API 18080，以及 MySQL 13306、Redis 16379、MinIO 19000/19001、RabbitMQ 15689/15690。需要先准备 Java 25、Maven 和 Docker，再执行后端/基础设施运行态验证。

## 8. 测试阶段交接条件

当前只能进行：

1. 官网公开页、服务 readiness、CORS、401/403/fail-closed 和未登录边界的 smoke；
2. 在具备 Java 25/Maven/Docker 后准备 Gateway、IAM、目标服务和基础设施运行态；
3. 先执行重新设计后的 B23–B25：真实 自有 JWT 登录/IAM、H5/Web 全局登录门禁和本地 MySQL 真实数据；
4. B23–B25 的注册登录、登录门禁和 MySQL 真实读写 smoke 通过后，才进入 B26 的正式浏览器/H5 全链路测试。

现在还不能宣告：全系统后端已完成认证后业务闭环、真实微服务已完成独立部署、生产迁移完成、真实支付/RTC/媒体已上线，或可以直接进行完整发布验收。B23–B27 的最新依赖和状态以 requirements/backlog/v2-B23plus-Phase1-真实运行与实机测试任务基线.md 为准。

相关代码级批次记录仍见：

- [B14 validation](./b14-validation.md)
- [B15 validation](./b15-validation.md)
- [B16 validation](./b16-validation.md)
- [B17 validation](./b17-validation.md)
- [B18 validation](./b18-validation.md)
- [B19 validation](./b19-validation.md)
- [B20 validation](./b20-validation.md)
- [B21 validation](./b21-validation.md)
- [B22 validation](./b22-validation.md)
- [G0–G4 Gate validation](./g-gate-validation.md)
- [B7+ 任务基线](../../requirements/backlog/v2-B7plus-代码重塑与交互测试任务基线.md)
- [B0–B6 历史状态表](../../requirements/backlog/Agent开发状态总报表.md)

## 9. 重设后的 Phase 1 到上线计划

当前执行范围已从 B14 之后重新限定为 Phase 1 成人产品，不再把 B15/B16 解释为 Phase 2/3 业务：

| 批次 | 目标 | 当前状态 |
|---|---|---|
| B15 | Java 25/Maven、基础设施、独立进程、迁移、观测和运行态 smoke | 代码与静态预检完成；Java 25/Maven/Docker 运行态阻塞，详见 [`b15-validation.md`](b15-validation.md) |
| B16 | Gateway、自有 JWT 登录、IAM/RBAC/ABAC、PEP、撤销和权限回归 | 代码与静态回归入口完成；真实 Gateway/IAM/测试 IAM JWT 认证中心、持久化、mTLS 和跨进程权限运行态阻塞，详见 [`b16-validation.md`](b16-validation.md) |
| B17 | 领域服务、数据库、Outbox/Kafka、关键读写链路和 Saga | 代码、静态门禁与合成回归完成；真实 Java 25/数据库/Kafka/Gateway/IAM JWT 认证中心/跨进程运行态阻塞，详见 [`b17-validation.md`](b17-validation.md) |
| B18 | 四端真实 API 联调、i18n/theme、官网公开边界和核心交互 | 代码/静态联调完成；真实 API/浏览器/设备阻塞，详见 [`b18-validation.md`](b18-validation.md) |
| B19 | 契约、集成、E2E、浏览器、真机、弱网、性能和无障碍 | 代码/静态系统测试基础完成；真实 API/E2E/浏览器/设备/专项 QA 阻塞，详见 [`b19-validation.md`](b19-validation.md) |
| B20 | 安全、隐私、版权、支付 sandbox、备份恢复和灾备 Gate | 代码/静态 Gate 基础完成；真实安全/隐私/内容/支付/灾备证据阻塞，详见 [`b20-validation.md`](b20-validation.md) |
| B21 | staging、不可变 RC、SLO/告警、回滚和 Go/No-Go | 代码与静态发布 Gate 基础完成；真实 staging/RC/观测/回滚/五角色签字阻塞，详见 [`b21-validation.md`](b21-validation.md) |
| B22 | 生产小流量上线、迁移对账、观察期和 Phase 1 收口 | 代码与静态上线 Gate 基础完成；真实生产切换/迁移/观察期/验收阻塞，详见 [`b22-validation.md`](b22-validation.md) |
| G0–G4 | 横切 DoD 门禁代码化与证据编排 | 代码与静态 Gate 完成；真实范围签收、运行契约、交互/设备、QA/观测、发布/回滚证据阻塞，详见 [`g-gate-validation.md`](g-gate-validation.md) |

只有 B15–B22 的运行、测试、发布和观察期证据全部通过，才可以宣告 Phase 1 上线。Phase 2/3 任务另以 `F2/F3` 保留，并继续受 `G-P2/G-P3` 冻结约束。

B15 本次已建立 Kafka KRaft 本地编排、Java 25 工具链拒绝策略、14 服务运行清单、固定端口注册、bootstrap 预检和静态 smoke evidence。默认 bootstrap 在发现 Java 24/Maven 缺失后停止，未启动容器、未执行迁移、未伪造服务构建通过；运行态接续条件和命令见 [`b15-validation.md`](b15-validation.md)。

## 10. 2026-08-24 B23–B27 任务重设与 B27 验证补充

根据真实运行复现，Mobile H5 未登录时仍能进入首页、测评和词汇入口，而受保护 API 返回 401；真实 自有 JWT 登录 入口返回 auth_service_unavailable，公共商品目录没有业务 fixture，Kafka 尚无业务 Topic。因此原先“先做浏览器/真机，再补认证和数据”的顺序不适合作为用户目标的交付顺序。

新的执行顺序是：

| 批次 | 任务 | 状态 |
|---|---|---|
| B23 | 标准 自有 JWT 登录/IAM 注册登录、JWKS、会话、撤销和服务侧权限 | 代码/静态完成；真实 IAM JWT 认证中心/JWT/会话运行待验收 |
| B24 | H5/Web 全局登录门禁、登录后会话恢复、成人 Gate、401/403 和登录后交互 | 代码/静态完成；真实 自有 JWT 登录后的会话恢复和正式浏览器待验收 |
| B25 | 本地 MySQL schema/fixture、内容、学习、练习、测评、SRS 和报告真实读写 | 代码/fixture/本地 MySQL 基础完成；API→DB→API、JWT、Redis/重启对账待验收 |
| B26 | Kafka/Outbox、跨服务学习闭环、浏览器/H5 真实数据测试和缺陷回归 | 代码/静态完成；真实 Kafka、认证后数据旅程、浏览器证据和缺陷闭环待验收 |
| B27 | iOS/Android/iPad/PWA/小程序真机、专项质量、RC、回滚和测试交接 | 代码/静态完成；真机、发布、回滚和交接运行待验收 |

B23–B25 完成并通过注册登录、登录门禁和 MySQL 真实读写 smoke 后，进入 B26 正式测试；B27 是原真机和上线交接 Gate，不是正式测试入口。B27 的代码/静态套件已通过 `pnpm test:b27` 24/24 与 `pnpm b27:static`，但运行校验仍 fail-closed，当前 `status=BLOCKED`、`releaseDecision=NO-GO`。完整证据见 [`b27-validation.md`](b27-validation.md)。

2026-08-24 起，当前里程碑聚焦本机 Web/H5、14 后端进程、标准 自有 JWT 登录、本地 MySQL/Kafka/Redis 和 Codex Browser MCP 真浏览器测试。接续执行 B28–B36；iOS/Android/iPad、微信小程序、远程真机、staging、RC 和生产发布暂缓。只有 B28–B36 全部通过才能给出本机 `LOCAL-TEST-PASS`，该结论不等于生产 Go。任务定义见 [`v2-B28plus-Phase1-本机真实全栈与MCP浏览器验收任务基线.md`](../../requirements/backlog/v2-B28plus-Phase1-本机真实全栈与MCP浏览器验收任务基线.md)。
