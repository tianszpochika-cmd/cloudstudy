# Web / H5 内置浏览器真实测试报告（2026-08-23；Historical / Superseded）

> 状态：Historical / Superseded（2026-08-23 原始运行快照）。本报告仅保留当时页面与运行证据；当时旧外部认证入口的 404/阻塞不代表当前 IAM 认证边界，也不得作为当前实现或验收结论。当前执行以 ADR-0013 与现行 IAM `/api/v1/auth/*` 入口为准。

> 执行日期：2026-08-23  
> 测试方式：Codex 内置 Browser，真实启动本地 Web/H5 服务后进行页面导航、控件点击、表单输入、错误态和浏览器 Console 检查。  
> 关系说明：这是独立的运行态测试记录，不新增或改写 B23–B27 章节任务状态。

## 1. 测试结论

本轮 Web、官网、管理后台和 Mobile H5 已完成一轮真实浏览器测试，并对测试途中发现的问题直接修复后回归。公开页面、未登录边界、移动端主导航、目标设置、错误态、深链保护和构建均有证据。

不能宣告“全系统浏览器测试通过”或“可以生产上线”：当时的旧外部认证服务尚未获批，无法创建真实测试账户或取得有效 Token；Gateway 下游领域服务、MySQL/Kafka/Redis 等完整运行链路未启动。因此，登录后学习闭环、管理命令、跨服务写入、真实数据提交和权限矩阵仍属于阻塞/未覆盖，而不是用合成登录结果代替。

## 2. 运行环境与证据边界

| 项目 | 实际值 |
|---|---|
| 官网 | `http://127.0.0.1:18182/` |
| 学习 Web | `http://127.0.0.1:18180/` |
| 管理后台 | `http://127.0.0.1:18181/` |
| Mobile H5 | `http://127.0.0.1:18183/` |
| Gateway | `127.0.0.1:18070`，进程已启动；Actuator `503 DOWN` |
| IAM | `127.0.0.1:18087`，Actuator `200 UP` |
| 浏览器 | Codex 内置 Browser；每次交互后读取 DOM snapshot 和 error/warning Console |
| 真实设备 | 未覆盖；当前 Browser 不提供 viewport capability，未冒充 iOS/Android/iPad/微信小程序结果 |

后端运行态检查结果：

- `GET /actuator/health`（IAM）：HTTP `200`，状态 `UP`。
- `GET /actuator/health`（Gateway）：HTTP `503`，状态 `DOWN`，原因是领域目标服务未全部运行。
- `GET /api/v1/iam/principal/me`（Gateway）：HTTP `401`，返回结构化 `unauthorized`、`requestId` 和 `traceId`，默认拒绝生效。
- 当时尝试的旧外部认证 `authorization-start` 入口返回 HTTP `404`；该入口现已废弃，不代表当前 IAM `/api/v1/auth/*` 入口。浏览器点击 Gateway 深链还受到内置浏览器本地端口导航策略限制；没有绕过该限制，也没有伪造登录成功。

## 3. 合成测试输入

本轮使用的浏览器内合成输入为：

- 测试批次标识：`browser-synthetic-20260823`。
- 目标选择：`WORKPLACE`（工作沟通）。
- 每日投入：`30 分钟`。
- UI locale：`zh-CN`；content locale：`en-US`。

由于测试 IAM JWT 认证中心 未获批，本轮没有注册真实账户、写入真实用户资料或制造 JWT/refresh token。目标表单提交只验证了本地草稿保留和服务端 `401` 的可解释处理。

## 4. 浏览器测试结果

### 4.1 官网

| 用例 | 操作 | 结果 | 证据 |
|---|---|---|---|
| `OFS-001` | 打开首页，检查品牌、主导航、Hero、公开内容降级提示和 footer | PASS | 首页结构完整，Console error/warning 为 `[]` |
| `OFS-002` | 依次打开 `/courses`、`/pricing`、`/download`、`/announcements`、`/about`、`/compliance` | PASS | 每页均有正确标题和 `main`，Console error/warning 为 `[]` |
| `OFS-003` | 在课程页点击“入门阶段”筛选 | PASS | 筛选按钮进入 active 状态；公开数据不可用时保留明确 alert |
| `OFS-004` | 检查“进入学习”及 CTA 的受控登录深链 | PARTIAL/BLOCKED | href 正确且带 `returnTo`、`returnTo`、`uiLocale`、`theme`；真实 IAM JWT 认证中心/Gateway auth route 未就绪 |

官网公开页没有读取登录后的学习数据，也没有把公开投影不可用伪装成课程内容。此前发现的 SSR hydration theme 不确定性已修复，重新打开的官网页面 Console 已清零。

### 4.2 学习 Web

| 用例 | 操作 | 结果 | 证据 |
|---|---|---|---|
| `LWR-001` | 直达 `/home`，观察冷启动、未登录保护和登录页 | PASS | 先显示安全启动状态，随后稳定进入登录边界，无空白页；Console `[]` |
| `LWR-002` | 首页“开始学习” → 登录页 → “返回登录” | PASS | 两次导航均可完成，未产生客户端异常 |
| `LWR-003` | 检查登录页的 Gateway 深链和“恢复已有会话” | PARTIAL/BLOCKED | 深链结构正确；当时旧外部认证流程未配置，无法完成真实 session restore |
| `LWR-004` | 验证已登录 AppShell 页面内容渲染 | BLOCKED | 没有有效测试 Token，不能用假 Token 代替；AppShell 嵌套 RouterView 已改为外层 RouterView slot，并由 typecheck/build 验证 |

学习 Web 的启动空白问题已修复：应用先挂载并显示短暂的安全恢复状态，路由恢复失败时进入明确的登录/错误边界。AppShell 不再嵌套一个会吞掉页面内容的 RouterView。

### 4.3 管理后台

| 用例 | 操作 | 结果 | 证据 |
|---|---|---|---|
| `ADM-001` | 直达 `/dashboard`，检查启动和未登录路由守卫 | PASS | 显示“正在恢复管理员会话并检查权限”，随后进入登录页；Console `[]` |
| `ADM-002` | 登录页“返回登录” | PASS | 回到后台登录边界，未出现空白或 Console error |
| `ADM-003` | 检查 Gateway 登录链接 | PARTIAL/BLOCKED | href 和回跳参数存在；真实 IAM JWT 认证中心 未就绪，未执行伪造登录 |
| `ADM-004` | 进入登录后的教研/运营命令页面 | BLOCKED | 需要真实管理员 principal、RBAC/ABAC 决策和领域服务运行态 |

### 4.4 Mobile H5

| 用例 | 操作 | 结果 | 证据 |
|---|---|---|---|
| `H5-001` | 打开首页，检查今日闭环、空态、登录提示和底部导航 | PASS | 首页显示安全空态和登录边界；Console `[]` |
| `H5-002` | 点击“练习 / 世界 / 课程 / 我的 / 学习” | PASS | TabBar 路由可以切换；已修复 TabBar 使用 `navigateTo` 导致 uni-h5 拒绝的问题 |
| `H5-003` | 首页“修改目标”，选择“工作沟通”、`30 分钟`、18+ 同意，提交 | PASS | 真实点击后进入测评页；后端未认证时显示“请先登录后再保存学习目标”，没有伪造成功 |
| `H5-004` | 从首页“继续课程”或 TabBar 进入练习 | PASS | 受保护页在无会话时进入登录页；没有将 401 当成成功数据 |
| `H5-005` | 直接打开 `#/pages/b2-practice/b2-practice` 深链 | PASS（修复后） | 新浏览器会话最终进入登录页；不再无限停留在“等待读取学习服务” |
| `H5-006` | 练习服务失败后点击重试 | PASS | 保留错误态、重试入口和安全空态；不生成本地题目/答案；Console `[]` |
| `H5-007` | 检查 Mobile H5 Vite/uni-h5 Console | PASS（应用侧） | Vue Router deprecated warning 已通过 Vite 解析插件消除；剩余 Sass legacy warning 来自 uni/Sass 依赖构建链，不是页面 Console error |

H5 的深链修复通过两层完成：移动 API 客户端增加 Promise 级超时和一次性结算保护；B2 练习页在 `onMounted` 与 `onShow` 共享会话守卫，兼容 H5 直达页面时 uni 生命周期顺序差异。

## 5. 本轮直接修复

1. 官网公开链接使用 SSR/client 稳定的 theme mode，避免 hydration mismatch。
2. learner-web/admin-web 改为先挂载安全启动状态，再恢复路由，避免后端不可用时白屏。
3. learner-web AppShell 使用外层 RouterView slot，修复认证页面可能出现的 shell 空内容。
4. Mobile H5 增加 `switchTab`/`navigateTo` 路由分流，修复 TabBar 页面跳转失败。
5. Mobile H5 等待会话恢复后再加载受保护页面，消除冷启动竞态。
6. Mobile Vite 增加 vue-router public entry 解析兼容，移除浏览器 Console 的 deprecated import warning。
7. 移动 API 客户端增加默认 8 秒超时、Promise 级兜底和重复请求保护。
8. 401 学习请求统一转为登录语义；目标保存失败显示中文、可解释提示，不把 `Authentication is required.` 当作服务不可用或成功。
9. B2 练习页增加直达深链的 mounted 会话守卫和登录回跳边界。

以上修改只属于本轮浏览器测试发现的实现修复；没有修改 B23–B27 任务定义、章节验收状态或 Phase 1/Phase 2 范围。

## 6. 构建与静态回归

| 检查 | 结果 |
|---|---|
| `pnpm --filter @englishflow/learner-web typecheck` | PASS |
| `pnpm --filter @englishflow/learner-web build` | PASS |
| `pnpm --filter @englishflow/admin-web build` | PASS |
| `pnpm --filter @englishflow/official-site build` | PASS |
| `pnpm --dir apps/mobile test:b10` | 4/4 PASS |
| `pnpm --dir apps/mobile test:b11` | 6/6 PASS |
| `pnpm --dir apps/mobile test:b12` | 3/3 PASS |
| `pnpm --dir apps/mobile build:h5` | PASS |
| `git diff --check` | PASS |

构建输出仍有已知非阻塞提示：uni-app 新版本提示、Dart Sass legacy JS API、Vite CJS API/dynamic import 提示和部分大 chunk 提示。这些没有导致本轮页面 Console error，但应进入依赖升级和性能预算任务。

## 7. 未覆盖、阻塞与下一步

- **真实身份链路**：当时需要批准旧外部认证服务、测试账号、JWKS、redirect URI 和可回收 session；该链路现已废弃，当前应改按 IAM `/api/v1/auth/*` 入口重新验收登录、登出、refresh、撤销、成人 Gate、RBAC/ABAC 和管理员权限矩阵。
- **完整后端链路**：Gateway 当前能启动并正确返回 401，但健康检查因领域目标服务未全启动而为 `503 DOWN`；需要 Java 25/Maven、MySQL、Redis、Kafka 及各服务独立进程后，才能测真实读写、Outbox、事件、幂等、补偿和报告闭环。
- **已认证页面**：learner-web 的学习首页/课程/练习/报告、admin-web 的教研/运营/客服命令尚未以真实 principal 验收；本轮没有用假 Token 取得“通过”。
- **设备和响应式**：需要真实 Chrome/Firefox/Safari 矩阵、Android/iOS/iPad、微信小程序条件编译和真机触控/麦克风/弱网；当前内置 Browser 没有 viewport capability，不能替代设备验收。
- **依赖与性能**：处理 Sass/Vite deprecated warning、拆分过大前端 chunk，并在真实内容/认证数据可用后补充加载性能和可访问性证据。

因此，本报告支持“Web/H5 浏览器测试基础轮已完成，发现问题已修复并形成阻塞清单”，不支持“全链路测试完成”或“生产上线批准”。

## 8. 第二轮 Mobile H5 回归与修复（2026-08-23）

本轮使用全新 Mobile H5 浏览器会话 `browser-h5-round2`，目标是复核页面交互、草稿数据往返和未登录错误态，不创建假用户、假 Token 或本地伪造服务端结果。

| 用例 | 操作 | 结果 | 证据 |
|---|---|---|---|
| `H5-R2-001` | 打开 Mobile H5 首页并等待远程 read model | PASS | 首页显示今日闭环安全空态、登录入口和 TabBar；error/warning Console 为 `[]` |
| `H5-R2-002` | 精确点击“工作沟通”、`30 分钟`和 18+ 同意 | PASS | DOM 选中态同时显示 `工作沟通优先解决邮件、会议和日常表达。`、`30 分钟`；各交互后 Console 为 `[]` |
| `H5-R2-003` | 提交目标，进入测评，再重新打开 onboarding | PASS（未登录降级） | 进入 `#/pages/assessment/assessment`；显示“请先登录后再保存学习目标”；重新打开后草稿仍恢复为工作沟通/30 分钟，未显示服务端成功假数据 |
| `H5-R2-004` | 打开世界页，检查成长、奖励和社交 401 | PASS（修复后） | 将 B4/B12 的 HTTP 401 统一映射为权限态，显示中文登录引导和“去登录”，不再展示原始“请求失败（HTTP 401）” |
| `H5-R2-005` | 点击“去登录”，再点击“返回学习首页” | PASS | 正确进入登录页，再返回首页；真实 IAM JWT 认证中心 未配置时明确显示不可伪造登录成功；Console 为 `[]` |
| `H5-R2-006` | 直接打开 `#/pages/b2-practice/b2-practice` | PASS | 约 9 秒内进入登录页，不再无限停留在加载状态；Console 为 `[]` |

本轮代码修复：

1. `B12RewardsCard` 和 `B12SocialExtensions` 将 401 与 403 统一纳入 permission 状态，提供登录入口并隐藏原始 HTTP 错误。
2. 延续 B4 成长页的 401 权限态处理，保证成长/奖励/社交模块的错误语义一致。

本轮能够证明的是：H5 页面交互、客户端本地草稿持久化、Gateway 401 到权限态的错误处理和登录边界可用；不能证明真实用户资料、目标、奖励或社交记录已经写入后端。当时旧外部认证服务、领域服务 Controller/运行进程及 MySQL/Redis/Kafka 未就绪，因此本轮没有以本地假数据冒充服务端数据往返。

## 9. 第二轮构建与测试证据

| 检查 | 结果 |
|---|---|
| `pnpm --dir apps/mobile test:b10` | 4/4 PASS |
| `pnpm --dir apps/mobile test:b11` | 6/6 PASS |
| `pnpm --dir apps/mobile test:b12` | 3/3 PASS |
| `pnpm --dir apps/mobile build:h5` | PASS |
| `git diff --check` | PASS（仅工作区既有 LF/CRLF 提示） |

第二轮结论：Mobile H5 的页面级交互和未登录恢复路径可以继续进入后续真实身份/后端数据联调；全链路数据交互仍保持 BLOCKED，不能据此宣告真实账号闭环或生产可用。
