# 本地环境与开发测试验证：2026-10-06

## 结论与范围

本机 macOS arm64（M1 Max / 64 GB）可启动 Phase 1 开发栈：四项基础设施 healthy，15 个 v2 服务 readiness UP，四个前端可访问并完成基础交互。完整 Java 25 后端单元回归通过，前端类型/构建和契约结构、合并、生成检查通过。**完整 P1R 治理回归仍有 26 项失败，iOS 原生测试仍受 Xcode 首次初始化阻塞；不能称项目全部测试或业务验收通过。**

从 `dev-redesign` 的 `94b03e06` fast-forward 到远程 `98017031` 后开展修复，保留了原有未提交工作。此记录是本地维护证据，不提升任何 P1R/Evidence 状态，不把 R1-002 的准备收口当成正式 IAM 改造验收。

追溯：既有 P1R-M0-007（工具链）、P1R-M2-002（IAM）、P1R-M2-001（Gateway）、P1R-M2-008（本地编排）、P1R-M2-009（CI）维护；架构对应 ADR-0010/0013/0029、固定端口注册、领域 owner；IAM 的 ACT/JNY/PAGE/INT/E2E 映射沿用 Phase 1 业务运行设计包的认证、会话与资格边界，本轮没有新增业务接口或关闭设计 GAP。

## 修复与配置

- 拉齐锁定的 Node 20.19.5 / pnpm 10.19.0、Java 25.0.4.1、Maven 3.10.0；安装冻结依赖，锁文件未改。
- 修复 Docker 客户端与 plugin 链接指向已卸载 DMG `/Volumes/Docker` 的问题，启动本机 Docker Desktop。这些是主机配置，不提交绝对路径。
- 工具门禁加入 macOS arm64/x64 和 macOS Chrome/CHROME_PATH 探测，精确 Node/pnpm、Java 主版本、Docker/Compose/浏览器最低版本以及固定端口 hash 仍严格检查；本轮只实测 arm64。
- Node 20 不直接加载 TS：共享 i18n 测试改用测试专用 TypeScript ESM loader，类型门禁仍由 tsc/vue-tsc 执行，不升级或放宽 Node 版本。
- IAM 会话到期判断使用注入 Clock，并拒绝恰好到期的会话；补充到期前、到期时、到期后的回归，原先两个受真实日历时间影响的测试恢复。
- Gateway 的 plans:ensure 控制器证据改为契约实际 owner `V2PlansController`；路由负例改为多余路径段，避免把 `{articleId}` 内的合法后缀误判为越界。既有 owner/方法/authority header 检查保留。
- Redis 空卷先创建 ACL 文件，已存在的 ACL 不覆盖；恢复 15 个服务 namespace ACL 并验证跨 namespace 拒绝。
- MinIO/mc 改为固定官方提交、归档校验和与固定基础镜像构建；桶初始化 private，实际 S3 合成对象写入、读取校验、删除成功。
- 新 `db:prepare:iam` 只准备 schema/account/迁移权限，包含 V5 所需 schema 内 DROP；完整版本与 history 由 Flyway 管理。保留 V13 writer-drain 显式确认和失败拒绝，未添加自动 repair。
- 此前首次 IAM 启动的 V5 曾因 DROP 权限失败；在 IAM 停止、确认仅合成空账号、核对幂等 V5 DDL 后，给本机 owner 补 scoped DROP 并人工执行 Flyway repair，再成功迁移。该特定恢复操作没有做成自动启动逻辑。
- Nuxt runner 显式传 HOST/NITRO_HOST/NUXT_HOST，实测仅 `127.0.0.1:18182` 监听，无额外 IPv6 wildcard。所有固定端口保持原注册值。
- `services:run -- --all` 默认选 15 个 v2 服务；Core API/RabbitMQ 为显式兼容选择。移除会打印 Gateway 服务凭证的诊断输出。
- 更新迁移清单数量、事件计数断言；GAP 负例使用独立 REVIEW task fixture，不依赖仓库恰好存在未接受的 closure task。严格的 owner、负例、Evidence 和冻结兼容规则继续保留。
- 为 IAM locked accounts 的 200 响应补齐 requestId/traceId/API version 三个响应头声明；认证门禁 10/10 通过。从契约源重新生成 OpenAPI TS 与 API 客户端，未手写生成类型。
- 学习 Web、Mobile 和后台的旧 API adapter 停止请求 Gateway 已 withheld 的路由，返回共享 FEATURE_UNAVAILABLE 错误和 i18n 文案；保留有精确可用投影的请求，不扩大 Gateway owner/权限。静态扫描保留全量源扫描，并补充路径参数和 GET/POST 方法负例；移动 B11 十类被禁用调用实测均无 transport、无成功空结果、无离线重试。
- 兼容 CLI 接受 pnpm 转发的单个前导 `--`，修复原 CI 在参数解析阶段退出的问题；额外未知参数仍拒绝，CI 精确命令、两个冻结 ref 与完整审计逻辑均保留。实际执行结果为 OpenAPI/事件各 2 项 breaking change、schema compatible，仍 FAIL。
- CI 增加 dev-redesign push、macOS 前端、workspace/移动 B11 单元测试、Mobile H5 和空卷基础设施构建/健康/初始化检查；远程 CI 尚未运行或判绿。
- DoD 扫描仅豁免已核对的 `GATEWAY_AUDIT_SERVICE_TOKEN_URI` 无认证信息、无 query/hash 的端点；URL 形态的 Token、用户名密码 URL 和带 token 查询参数的 URL 仍拒绝，内置负例通过。

## 本机验证

| 验证 | 结果与边界 |
|---|---|
| 工具链运行门禁、CI 结构门禁、DoD 扫描 | PASS；未移除完整契约门禁 |
| 冻结依赖安装 | PASS，锁文件不变 |
| MySQL / Redis / Kafka / MinIO | 4/4 healthy；私有桶初始化成功 |
| Redis 全新独立测试卷 | 首次启动 PONG；加入测试 ACL 后重跑 init，文件 SHA-256 保持一致；测试卷和容器已清理 |
| owner schema / Redis ACL / Kafka topic 管理 | 13 owner DML/DDL 隔离复核、15 namespace ACL、12 topics 预建完成；不代表全量 Saga/事件联调 |
| v2 运行 | 15/15 readiness UP，Core API 未混入默认 v2 数量 |
| 四前端 | 4/4 HTTP 可达；三端 1440×900、移动 390×844 的实际交互通过，无 pageerror、failed request 或横向溢出 |
| 浏览器禁用接口复验 | 实际 Chrome 中学习端 3、后台 2、移动端 2 项调用均 FEATURE_UNAVAILABLE，0 Gateway transport，英文文案验证后恢复中文；Browser plugin 不可用，按 frontend-testing-debugging 技能使用常规 Playwright |
| 前端 adapter 定向回归 | 18/18 PASS，含媒体授权/过期/撤销回归与十类 withheld 调用无 transport 负例 |
| 浏览器交互 | 学习端登录→注册、后台密码显示/隐藏、官网词卡弹窗、移动登录→注册；截图仅在本机临时目录，不当成全业务 UAT |
| 认证边界 | RSA/RS256 JWKS 发布；未登录伪造 role header 访问 profile/today 均 401；合成注册/login 成功、未满足必要同意仍 403，未直接授予学习资格 |
| `pnpm test` | i18n 11/11 PASS |
| `pnpm typecheck` | 7/7 workspace tasks PASS（生成同步后复验） |
| `pnpm build` | Learner/Admin/Official 3/3 PASS（生成同步后复验） |
| Mobile H5 / App 资源构建 | PASS；App 产物需 HBuilderX/打包基座，不是签名安装包或安全存储验收 |
| 官方站点测试 | 26/26 PASS |
| `mvn -B -ntp -f pom.xml test` | v2 16 个模块：1,505 项，0 failure / 0 error，61 skipped（需外部运行条件的集成类）；实际执行通过 1,444 项 |
| IAM 精确时钟回归 | 20/20 定向用例 PASS；全量 IAM 122 项含 22 skipped |
| 契约结构/合并/生成一致性 | PASS：465 operations、815 schemas、192 events、51 AsyncAPI channels；5 个生成文件一致 |
| 修复的 P1R 定向回归 | GAP、事件可靠性、数据 owner 118/118 PASS |
| `pnpm test:p1r` | 1,463 项：1,437 PASS、26 FAIL、0 skipped，不能报全绿 |
| Android SDK / 模拟器 | API 36、build-tools 36.0.0、platform-tools 37.0.1、emulator 37.2.12；工具 PASS；合成本地 AVD `cloudstudy-api36` 启动、adb device、sys.boot_completed=1 |
| 文档全库审计 | 修正既有管理端指南相对链接后 deadLinks=0；全库仍有 60 个未入链文档和 1 个缺 README 的目录，完整审计仍 FAIL，未做豁免 |
| iOS | Xcode 27.0 已安装；first launch / simctl 因许可未完成仍 FAIL，未运行 iOS 原生应用测试 |

Android SDK、AVD 和登录 shell 环境在主机用户目录配置，不提交 SDK、主机路径或许可文件。停止本轮模拟器可用 `adb -s emulator-5554 emu kill`。本轮 Java/frontend runner 正在运行，关闭对应终端即可停止；不要在运行中覆盖 JAR。

## 仍未关闭的 26 项治理回归

这些失败是最新业务契约/路由与冻结 D2 审计规则的冲突或缺口；安装工具、修改 macOS 检测不能解决。原有强制门禁保持 FAIL，未更换冻结基线、重算兼容 hash、自比较或增加 continue-on-error。

| 测试文件 | 失败数 | 具体范围 |
|---|---:|---|
| p1r-api-contract | 2 | 未完成 Saga 列表和 mistakes 列表缺分页声明；当前无成功路径的 upload-url 缺幂等声明 |
| p1r-content-lifecycle | 1 | B9 新 lexeme/item 命令扩围与旧九分支冻结策略冲突 |
| p1r-contract-tooling | 12 | 固定 M1/M2 投影链与后续已提交的可变契约不一致；M2-001 旧预期投影不可构造 |
| p1r-gateway-contract | 5 | 365→399 公共 operation、74 个 route plan、account deletion 开放及旧 digest/投影规则漂移 |
| p1r-learning-loop-contract | 2 | learning 路由投影与 M1-013 冻结模型不一致 |
| p1r-m1-018-iam-compatibility | 1 | 当前 event artifact 不是旧 IAM 静态投影 |
| p1r-placement-contract | 3 | placement 运行响应状态扩展与冻结契约状态边界不一致 |

关闭这些失败需要逐项核对契约、owner 实现、正式允许的扩围与证据，不能仅改测试预期或门禁阈值。本轮已建立可用本地开发环境、修复可确认的实现/测试缺陷，并切断无执行投影的前端请求。剩余缺口不能仅凭环境维护关闭：需对应 owner 补齐运行契约、正式受控投影和证据，并按 P1R 流程复核；没有声称全部问题或全项目已完成。全量外部 API 审计另外发现既有非 canonical envelope/响应头声明，规范化 fixture 通过与原始源门禁通过不可混为一谈。

完整失败用例索引：

- canonical external API fixture passes the P1R governance gate — `tests/p1r/p1r-api-contract.test.mjs`
- canonical oneOf success/page envelope extensions remain valid — `tests/p1r/p1r-api-contract.test.mjs`
- P1R-M1-008 content lifecycle, B9/B1 disposition, catalog, B26 and reliability governance pass as D2 only — `tests/p1r/p1r-content-lifecycle.test.mjs`
- Git compatibility adds the fixed governance freeze when the historical baseline lacks it — `tests/p1r/p1r-contract-tooling.test.mjs`
- M1-009 policy remains frozen inside the latest fixed-baseline chain — `tests/p1r/p1r-contract-tooling.test.mjs`
- M1-010 policy remains frozen inside the latest fixed-baseline chain — `tests/p1r/p1r-contract-tooling.test.mjs`
- M1-011 policy and latest fixed-baseline chain fail closed while remaining static only — `tests/p1r/p1r-contract-tooling.test.mjs`
- M1-012 policy and latest fixed-baseline chain remain fail-closed and static-only — `tests/p1r/p1r-contract-tooling.test.mjs`
- M1-013 allowance and source binding reject policy widening, wrong digest and self/fallback baselines — `tests/p1r/p1r-contract-tooling.test.mjs`
- M1-014 policy digest, allowance binding and default compatibility remain fail-closed — `tests/p1r/p1r-contract-tooling.test.mjs`
- M1-015 exact commerce promotion rebuilds the frozen OpenAPI, event and static B26 projections — `tests/p1r/p1r-contract-tooling.test.mjs`
- M1-008 source baseline reaches the current M1-018 event projection with immutable governance attached — `tests/p1r/p1r-contract-tooling.test.mjs`
- M1-016 exact notification/sync/support promotion rebuilds the frozen projections — `tests/p1r/p1r-contract-tooling.test.mjs`
- M2-001 Gateway root-and-health projection is source-derived and descriptor-bound — `tests/p1r/p1r-contract-tooling.test.mjs`
- M2-001 Gateway execution-target promotion rejects root, owner, target and unavailable-operation drift — `tests/p1r/p1r-contract-tooling.test.mjs`
- Gateway contract audit passes the dedicated fragment and exact canonical projection — `tests/p1r/p1r-gateway-contract.test.mjs`
- M2-001 health identity is Gateway-owned and the compatibility projection permits exactly two scalar corrections plus the root plus reviewed additive nodes — `tests/p1r/p1r-gateway-contract.test.mjs`
- Gateway execution plan digest binds the reviewed finite target table — `tests/p1r/p1r-gateway-contract.test.mjs`
- Gateway execution plan shape cannot bypass validation — `tests/p1r/p1r-gateway-contract.test.mjs`
- M1-017 has exactly eight public and nine internal operations with exact owner, security and authorization — `tests/p1r/p1r-gateway-contract.test.mjs`
- repository learning-loop policy remains a frozen static D2 boundary — `tests/p1r/p1r-learning-loop-contract.test.mjs`
- checker CLI emits machine-readable frozen-policy result — `tests/p1r/p1r-learning-loop-contract.test.mjs`
- M1-018 IAM compatibility allowance is frozen, source-bound and static only — `tests/p1r/p1r-m1-018-iam-compatibility.test.mjs`
- placement policy is a passing static D2 boundary — `tests/p1r/p1r-placement-contract.test.mjs`
- CLI reports the static D2 source binding without claiming runtime verification — `tests/p1r/p1r-placement-contract.test.mjs`
- placement keeps its route frozen while recognizing only the exact M1-014 assessment topic consumer addition — `tests/p1r/p1r-placement-contract.test.mjs`
