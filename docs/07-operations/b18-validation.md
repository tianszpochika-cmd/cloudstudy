# B18 四端真实 API 联调与功能闭环验证记录

> 执行日期：2026-08-23  
> 范围：Phase 1 四端代码层联调、Gateway 客户端边界、恢复状态、权限确认、公开公告投影、主题/国际化和合成测试矩阵。  
> 结论：B18 的代码与静态联调骨架完成；真实后端 API、浏览器、App/小程序、真机和设备证据仍需运行环境就绪后取得。

## 1. 本轮交付

- learner-web：将 /learn、/courses 从占位页替换为学习闭环和课程投影页面，接入今日任务、课程、复习队列、日报告、幂等完成、权限/离线/恢复状态。
- mobile：学习流接入 /learning/review-queue 和幂等复习完成命令，保留 uni-app H5/App/微信条件编译、secure storage、离线和性能降级边界。
- admin-web：新增 /support 客服工单工作台，要求 admin.support.read/admin.support.command，命令提交前二次确认，服务端投影脱敏，使用 Idempotency-Key，不接受客户端角色/租户/owner 事实。
- official-site：新增 /announcements 公开公告页，继续只读 public projection，加入受控链接、SEO、SSR/预渲染和空/错误/恢复状态；官网不创建订单、支付或登录后业务事实。
- 测试矩阵：新增 config/b18-frontend-test-matrix.json、scripts/runtime/validate-b18-frontend-matrix.mjs 和 tests/b18 合成账号/固定端口/Phase 1 边界校验。
- 启动门禁：新增 b18:static 与 b18:bootstrap；runtime 模式要求 B17 真实运行预检、四端测试 origin 和账号矩阵变量，缺失时失败而不伪造通过。

## 2. 验证证据

| 命令 | 结果 |
|---|---|
| node --test tests/b18/*.test.mjs | PASS；7/7（四端接入、学习闭环、admin 权限/恢复、官网公开边界、i18n/theme、Phase 1 过滤、合成账号矩阵） |
| pnpm b18:static | PASS；B18 测试、契约、兼容性、固定端口、runtime config、前端矩阵全部通过 |
| pnpm contracts:validate（由 bootstrap 调用） | PASS；402 operations、476 OpenAPI schemas、144 events、100 event payload schemas、4 JSON Schemas |
| pnpm contracts:compat（由 bootstrap 调用） | PASS；0 breaking changes |
| pnpm --filter @englishflow/learner-web typecheck | PASS |
| pnpm --filter @englishflow/learner-web build | PASS |
| pnpm --filter @englishflow/admin-web build | PASS；仅保留既有大 chunk/CJS API 警告 |
| pnpm --filter @englishflow/mobile exec tsc --noEmit --pretty false | PASS |
| pnpm --filter @englishflow/mobile build:h5 | PASS；保留 uni-app/Sass 既有 deprecation/chunk 警告 |
| pnpm --filter @englishflow/official-site build | PASS；SSR/Nitro 预渲染包含 /announcements，9 个页面入口、16 个预渲染产物 |
| node scripts/runtime/validate-b18-frontend-matrix.mjs | PASS；4 个固定 origin、4 个合成账号、无凭证、Phase 1-only |

## 3. 运行态边界

以下内容没有被本轮静态或构建结果冒充为完成：

- Gateway、OIDC 测试 IdP、learner/content/learning/assessment/admin-ops 的真实跨进程 API 联调；
- Playwright/Chromium 浏览器深链、登录/刷新/登出、八态、键盘/响应式和 Console 证据；
- iOS/Android/iPad/App/微信小程序条件编译、secure storage、媒体权限、后台恢复和四级画质真机证据；
- admin 最小权限审批、重复命令、审计落盘和真实恢复任务；
- 官网 public projection 断链、下载禁用、缓存恢复和真实 SEO/浏览器检查。

pnpm b18:bootstrap --require-runtime 必须在 B17 runtime preflight、Java 25/Maven/Docker 或等价 CI、测试 IdP、Kafka/数据库和 B18 origin/账号矩阵变量就绪后执行。当前环境沿用 B17 阻塞：Java 24 而非 Java 25、Maven/Docker 不可用，且真实测试 IdP/Kafka 与 B18 runtime 变量未注入；因此 runtime bootstrap 应明确失败，不能宣告全系统联调已通过。

## 4. 交接结论

B18 可以标记为“代码/静态联调完成，真实运行态阻塞”，并作为 B19 系统测试、浏览器、设备和性能任务的开发输入；不能标记为 B18 的真实 API/浏览器/设备验收完成，也不能据此宣告 Phase 1 已上线。
