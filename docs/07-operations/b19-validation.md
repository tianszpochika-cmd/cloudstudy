# B19 系统测试、浏览器、设备与性能验证记录

> 执行日期：2026-08-23  
> 范围：Phase 1 契约回归、合成学习旅程、四端浏览器/设备矩阵、弱网/性能/无障碍/国际化/主题门禁和缺陷证据自动化。  
> 结论：B19 先完成可审计的代码与静态测试基础；真实服务、浏览器、设备和专项工具证据必须在运行环境就绪后单独取得。

## 1. 本轮交付

- API/事件/JSON Schema 契约回归：检查 operationId、版本、错误 envelope、幂等键、trace/request 传播、事件 envelope 和生成客户端一致性。
- 合成学习旅程：覆盖登录、学习目标、学习内容、提交、服务端判分、复习投影、报告和通知，并验证重复提交、事件去重、失败补偿和数据对账边界。
- 浏览器与设备矩阵：固定四端 origin、公开/登录边界、八态、权限、深链、键盘、响应式、H5/App/小程序/iPad/PWA 和媒体/secure storage 证据字段。
- QA 专项门禁：弱网/离线、LCP/交互响应、Ultra/High/Medium/Performance、可访问性、对比度、非颜色状态、locale/contentLocale、主题和缺陷分级。
- B19 bootstrap：静态模式只执行测试资产和前置门禁；runtime 模式要求真实 Gateway、OIDC、Kafka、账号矩阵、浏览器和设备证据目录，不会隐式伪造运行通过。

## 2. 静态验证结果

| 命令 | 结果 |
|---|---|
| `node --test tests/b19/*.test.mjs` | PASS；23/23 |
| `pnpm test:b19` | PASS；23/23 |
| `pnpm b19:static` | PASS；B18 前置、B19 测试、3 个 validator、契约生成/兼容、固定端口、配置和任务基线均通过 |
| `scripts/runtime/validate-b19-test-fixtures.mjs` | PASS；static-and-synthetic，runtime gate 缺少 5 项环境变量 |
| `scripts/runtime/validate-b19-browser-device-matrix.mjs` | PASS；4 browser runtimes、4 applications、9 device profiles、18 scenarios，runtimeBlocked=true |
| `scripts/runtime/validate-b19-quality-gates.mjs` | PASS；10 quality gates、24 evidence index、11 runtime pending |
| `pnpm contracts:validate` | PASS；402 operations、476 OpenAPI schemas、144 events、100 event payload schemas、4 JSON Schemas |
| `pnpm contracts:generate` | PASS；5 generated files |
| `pnpm contracts:compatibility` | PASS；0 breaking changes |

## 3. 运行态边界

以下内容不能由静态 fixture、源码扫描或前端 build 代替：

- Gateway、OIDC、MySQL、Kafka、领域服务之间的真实跨进程学习旅程、Outbox/事件对账和失败补偿；
- Chrome/Edge/Safari 的 Playwright 浏览器执行、八态、深链、键盘/响应式和 Console 证据；
- iOS、Android、iPad、PWA、微信小程序的安装/升级、secure storage、媒体权限、横竖屏、后台恢复和系统返回键；
- 2G/3G/断网、LCP/交互响应、四级画质、读屏、真实对比度和设备级主题/i18n 视觉证据；
- P0/P1 缺陷清零、P2 处置、可复现缺陷报告和完整证据索引。

`pnpm b19:bootstrap --require-runtime` 已按设计失败并保留阻塞原因：B17 运行预检发现当前 Java 24、Maven/Docker 不可用、B16 测试 IdP/Kafka 变量缺失；B19 进一步缺少 `B19_RUNTIME_ORIGIN`、`B19_RUNTIME_ACCOUNT_MATRIX`、`B19_RUNTIME_IDP_ISSUER`、`B19_RUNTIME_KAFKA_BOOTSTRAP`、`B19_RUNTIME_MYSQL_DSN`、Gateway/浏览器/设备证据目录等变量。该失败是阻断证据，不是测试误报。

## 4. 交接结论

B19 当前结论：**代码与静态系统测试基础完成，真实运行态阻塞**。只有在静态测试、真实 API/E2E、浏览器、设备、专项 QA 和缺陷门禁全部取得证据后，才能进入 B20 安全/隐私/灾备 Gate。代码/静态通过不等于 Phase 1 已完成或可以上线。
