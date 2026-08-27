# 本地真实数据与浏览器全量测试记录（2026-08-26）

## 1. 目标与范围

本轮只验证本地环境：本地 IdP 登录、四端前端、Gateway、领域服务，以及页面与 MySQL/Redis 等本地基础设施之间的真实读写。微信小程序、iOS 真机、生产支付渠道和外部第三方能力不在本轮范围内。

测试账号仅使用本地 Keycloak 测试账号；密码不写入文档、日志或 Git。

## 2. 已完成的准备工作

### 2.1 服务与前端

- Gateway、IAM、12 个目标领域/平台服务及兼容 Core API 共 14 个后端进程已启动，并通过 readiness 检查。
- 四个固定前端端口已启动：learner Web `18180`、admin Web `18181`、官网 `18182`、mobile H5 `18183`。
- 运行模式已启用真实 OIDC；通知服务日志确认 resource server enabled=true。

### 2.2 本地真实数据 fixture

使用幂等脚本写入各 owner schema，未使用页面假数据替代后端：

```text
pnpm db:seed:local-real-all
local learning-world fixture ready: 21 gamification ledger(s), 242 feature-state row(s), 1 room(s), 25 seat(s), 1 offline package(s), 21 notification(s), 23 learner profile(s), 23 learning plan(s), 38 assessment session(s), 1 media asset(s), 63 learning interaction(s), 21 expression(s), 12 public-site facet(s)
local commerce fixture ready: 1 active SKU(s)
local admin/analytics fixture ready: 5 projection(s), 1 support ticket(s), 1 analytics receipt(s), 1 journal event(s), 7 metric projection(s)
```

本地 OIDC 用户的 provider subject 需要在注册/登录后按实际 `sub` 执行绑定；
`scripts/runtime/ensure-local-oidc-test-user.mjs` 只配置本地签名的 tenant、phase、同意、设备可信度、内容版权和权限 claim，
不会输出密码，也不把权限事实放在客户端请求头中。媒体服务的 V1/V2/V3 迁移已完成，`media_asset` 与 `media_rendition` 均有持久化 fixture。

为减少本地浏览器测试的人工衔接，`pnpm oidc:local-learner-watch` 可在用户打开注册页后启动；它只监测启动后新增、且没有管理员/内容审核角色的本地用户，调用管理员 bootstrap 写入 signed claims，再按实际 provider subject 重放本地 fixture 并执行用户级覆盖检查。该脚本是测试工具，不属于生产服务，不读取或输出密码，也不向注册表单开放 authority 字段。

随后执行只读覆盖核对 `pnpm db:check:local-real-coverage`，按内容、学习者、学习、评测、媒体、商城、成长、社群、通知、后台和分析 33 个 owner 表/投影与关键资源类型检查；登录后可追加 `LOCAL_TEST_SUBJECT=<provider-sub>` 复核当前账号的用户级行。
本次执行结果：`status=PASS`、`checks=33`；课程/词汇 `1/1`、B3 多模态内容 `72`、B3 音标 `48`、B3 资源类型 `14`、失败学习交互 `22`、学习画像/计划/SRS/交互 `23/23/38/66`、评测会话/报告 `38/38`、媒体 `1/1`、商城 SKU/权益 `1/22`、成长 feature state/奖励 `242/22`、社群房间/座位/排行榜 `1/25/44`、通知/离线包 `29/1`、后台/分析 `5/1/7`。
本轮又补齐了真实本地媒体对象：MinIO bucket `yuxuexing-local` 中已写入
`b3-audio-3401`（合成 WAV，16044 bytes，SHA-256 为
`03bdffca899373ff48458ba2c658718abf3e83544a9989e873e05cb990e230b9`），媒体 owner
元数据和内容投影均为 `READY`；浏览器听力页可继续验证“签名 URL → MinIO 对象”而不只是验证元数据。
覆盖成长/任务/成就/收藏/赛季/Avatar/游戏、自习室/座位/排行榜、通知/偏好/离线包、课程/词汇、媒体清单、商品目录/权益、后台脱敏投影、客服工单、审计关联和分析指标，以及语法错误反馈、写作历史和离线变更回放等本地可测试数据。服务运行时只访问自己的 owner schema；fixture 脚本仅用于本地测试数据准备。

本轮复核后的 MySQL 真实数据摘要：`iam_principal=21`、活跃学习画像 `23`、学习计划 `23`、学习交互 `66`、表达式 `22`、已发布 B3 内容 `18`、已完成测评会话 `38`、测评报告 `38`、有效媒体资产/ready rendition `1/1`、active SKU `1`、active entitlement `22`、成长 feature state `242`、奖励 `22`、自习室/可用座位 `1/25`、排行榜投影 `44`、通知消息/离线包 `29/1`、后台投影/客服工单 `5/1`、分析指标 `7`。这些是本地 MySQL 查询结果，不代表页面已经完成认证后回归。

注册安全边界已修复：Keycloak 本地 realm 的 `tenant_id`、`device_id`、`permissions` 只能由管理员上下文维护；unmanaged attribute policy 为 `ADMIN_EDIT`。刷新注册页后不再出现权限、租户或设备输入项，避免注册者伪造服务端 authority claim。管理员仍可通过本地 bootstrap 为专用测试账号配置 signed claim；生产不复用这组本地属性 mapper。

### 2.3 契约、构建与静态回归

- `pnpm contracts:validate`：373 operations、478 OpenAPI schemas、154 events、110 event payload schemas、4 JSON Schemas，通过。
- `pnpm contracts:compatibility`：通过，OpenAPI 0 个 breaking change；`pnpm contracts:generate`：5 个生成文件，通过。
- B5 历史 admin 兼容片段已标记为 `historical-compatibility`，不再参与 canonical merge；旧 admin path、tag 和 orphan schema 不会进入生成客户端。当前前端只使用 B9/B12/B13 Gateway 路径。
- content-service 的 `/api/v1/public/site/projection` 已按 B9 `B9PublicSiteProjectionResponse` 返回公开字段；官网 BFF 再从 B13 commerce catalog 合并公开价格，不把订单/权益事实复制到 content schema。
- 语法掌握度已收口到 learning-service owner：Gateway 的 `/api/v1/grammar/mastery` 现在路由到 learning-service 的 MySQL 读模型，按 `b3_learning_interaction` 的语法尝试记录计算维度、等级、尝试次数和正确次数；B3 静态回归 `17/17` 通过，已重新编译 Gateway 与 learning-service 并重启。
- 学习闭环的 `/api/v1/learning/mistakes/queue` 不再固定返回空数组；learning-service 现在从自己的 `b3_learning_interaction` 失败记录生成错题项，支持按 `status` 过滤，返回 `source=mysql`、错误追踪和内容版本信息；B25 静态回归 `5/5` 与 learning-service Java 25 编译通过。
- learner Web、admin Web、mobile H5 生产构建，通过；官网 Nuxt 开发服务已重启并通过公开页浏览器回归。
- mobile H5 `pnpm --filter @englishflow/mobile build:h5`，通过。
- B1–B13、B15–B33、B35 回归通过；B2 保留 3 个外部依赖 TODO。
- B14 修复了成长/社群 owner JDBC 持久化边界扫描误报后，6/6 通过。
- `pnpm services:build -- --service 'gamification-service,analytics-service,commerce-service'`：通过；三个服务重新使用最新 JAR 启动。
- 本地运行态复核：Gateway/IAM/12 个目标领域或平台端口 `18070、18087–18098` 全部 HTTP 200；兼容 Core API 使用 `/api/v1/actuator/health` 返回 HTTP 200；四个前端 `18180–18183` 全部 HTTP 200。
- 本轮最新运行闸门 `b36-20260826030440`：连续 2 轮 readiness 均为 14/14 后端、4/4 前端 HTTP 200；Gateway projection 为 `source=gateway,state=ready,courseCount=2`；`browserAuthJourney=WAITING_USER_CONFIRMATION`，未输出 token 值。
- 发现并修复一次真实迁移问题：已执行的 content-service `V7` 保持不可变，新增幂等 `V8__mark_local_media_projection_ready.sql` 发布 MinIO 本地媒体投影状态；Flyway 校验通过并成功升级到 V8，未使用 `repair` 掩盖 checksum 冲突。
- content-service 新增幂等 `V9__create_public_site_facet_projection.sql`；下载、公告和合规从 content-service 自有 MySQL 公开投影读取，中英文各 6 条 facet；价格由 commerce-service 的真实 `phase1-foundations` SKU 提供。

### 2.4 本轮接口契约收口

- admin Web 的 B5 仪表盘、审计和导出不再调用历史 `/admin/dashboard`、`/admin/feature-flags`、`/admin/audit-logs`；现在统一使用 B13 analytics/admin-ops Gateway 契约。
- B12 治理接口补齐 Gateway 到 social-service、notification-service 的 owner 路由；审核命令使用 `commandCode`，恢复命令使用契约规定的 `action`。
- mobile B11 删除了 404/405/501 后回退 B3 旧请求的行为；旧路径只保留为兼容契约或历史说明，不再作为浏览器运行时 fallback。
- 上述路径在未登录请求下均返回 Gateway 的结构化 401，而不是 404；这证明请求已进入当前认证边界。
- admin-ops 与 analytics 已切换为各自 owner schema 的 JDBC durable adapter；Flyway 历史分别为 admin-ops `1 → 2`、analytics `1`，重启后 fixture 仍可读回。

## 3. 浏览器测试矩阵

以下项目必须在本地 IdP 登录后通过 Codex Browser MCP 实际点击并记录页面结果、接口状态、控制台错误和数据库写回证据：

| 区域 | 页面/操作 | 真实数据验收 |
| --- | --- | --- |
| 认证 | 登录、回调、首页 | OIDC 回调成功，首页读 learner/gamification 数据 |
| 学习闭环 | 今日、课程、练习、词汇、语法、听力、阅读、口语、写作 | 页面读取内容；提交/评分/复习写回 owner schema |
| 报告 | B2 报告、学习进度 | 读取 assessment/learning 投影，不显示快照兜底误报 |
| 世界 | Avatar、游戏、社群、自习室、离线 | 列表来自 MySQL；领取、入座、下载状态和同步事件可写回 |
| 商城 | 商品目录、创建订单、支付意图 | 商品/订单走 commerce owner；支付渠道未配置时必须明确 gated，不伪造成功 |
| 设置 | 资料、目标、隐私、设备、导出 | 更新、设备踢下线和导出任务有真实持久化结果 |
| 管理端 | 登录、内容、运营、审计、客服 | 权限边界正确；无权限返回 403，不伪装空列表 |
| Mobile H5 | 登录后首页及与学习端对应的核心页面 | 与 learner Web 使用同一契约和本地数据源 |

## 4. 当前状态

- 数据、服务、契约和构建准备：**完成**。
- 本地 MySQL fixture 重跑与注册权限字段收口：**完成**；注册页重新打开后 authority 字段已隐藏。
- B14 安全扫描：**完成**。
- 登录前浏览器边界与公开页：**完成**；learner Web 受保护路由 15/15 正确重定向登录，官网公开路由 6/6 可见，admin Web 进入登录页，Mobile H5 不再绕过登录；本轮控制台无 error/warn。
- 浏览器登录后的逐页真实交互：**待执行**，需要在本地 IdP 页面完成一次人工密码输入后继续。
- 当前浏览器实际状态：仍停在本地 Keycloak `Register` 页面；注册表单只包含用户名、密码、确认密码、邮箱、名和姓，租户、设备与权限字段已隐藏。不能把注册页停留状态或匿名 401 当作登录后功能通过。
- 只有在浏览器矩阵全部执行并记录证据后，才能宣告本轮本地测试目标完成；当前不能把登录前 HTTP 200 或静态构建等同于认证后全功能通过。

## 5. 已知真实边界

- 支付提供商未配置时只验证订单与支付意图的安全门禁，不将本地测试标记为真实支付成功。
- 浏览器麦克风权限、音频输入和外部语音能力需按浏览器权限和 Phase 1 能力边界记录，不使用伪造评分冒充真实能力。
- B2 的 3 个外部依赖 TODO 不因本地 fixture 而被误报为通过。
- admin-ops-service 与 analytics-service 已具备各自 owner schema 的 JDBC durable adapter，后台 5 条脱敏投影、1 条客服工单、1 条分析回执、1 条 journal 和 7 条指标投影已写入本地 MySQL；仍需登录后用有权限账号逐页验证 200/403、命令幂等和审计写回，不能用匿名 401 证据替代。
- 官网聚合投影已从 content-service 返回 2 个本地 MySQL 课程、3 个下载渠道、1 条公告和 2 条合规通知；官方站点 BFF 同时读取 commerce-service 的 1 个 active SKU，官网价格页显示 `CNY 99.00`。公开投影仍不创建订单，也不伪造支付成功。
- 官网课程筛选已修复 UI 阶段名（入门/进阶）与服务端 CEFR 等级（A1–C2）的映射，并完成
  Nuxt 生产构建和浏览器回归；该修复不改变内容 owner 或数据库事实。

## 6. 本轮重启与运行证据

```text
后端 14 个进程 readiness: 14/14 HTTP 200
Core API 兼容健康检查: /api/v1/actuator/health -> HTTP 200
前端固定端口: 18180/18181/18182/18183 -> HTTP 200
protected learner routes: 15/15 -> /login?redirect=...
official public routes: 6/6 -> 页面可见
browser console error/warn: 0
canonical contract: 373 operations / 478 OpenAPI schemas
local admin/analytics durable fixture: 5 projections / 1 ticket / 1 receipt / 1 journal / 7 metrics
B36 runtime gate: b36-20260826030440, 2 readiness rounds, 14 services + 4 frontends, official projection ready
```

`ports:check` 是启动前的“端口必须空闲”检查；在本轮服务已运行时执行会按设计报告 busy。启动前登记表校验使用
`pnpm ports:check -- --registry-only`，通过且无重复端口。

## 7. 官网公开页本轮浏览器证据

使用 Codex Browser MCP 访问 `http://127.0.0.1:18182` 的 6 个公开路由，结果均为页面可见真实投影、无网络快照提示、无空投影提示、控制台 error 为 0：

```text
/, /courses, /pricing, /download, /announcements, /compliance -> 6/6 PASS
pricing: Phase 1 Foundations / SKU phase1-foundations / CNY 99.00
download: 学习 Web / WEB / AVAILABLE
announcement: 本地 Phase 1 真实运行态已就绪
compliance: 成人阶段边界、隐私与数据处理
```

受保护学习端、管理端和 Mobile H5 的登录后真实点击矩阵仍待本地 IdP 登录后执行；密码不会写入文档或日志。

### 8. 2026-08-26 11:23 增量复核

- `pnpm db:check:local-real-coverage`：`status=PASS`、`checks=33`；新增硬门槛 `content.phonemes=48`，已发布 B3 多模态资源总数为 `72`，其余 owner 覆盖保持通过。
- content-service 已应用 `V11__complete_local_phonetics_catalog.sql`，Flyway 从 v10 成功迁移到 v11；新增 46 条 PHONEME 和 8 组 MINIMAL_PAIR，H5 的 `48/48` 页面完整性条件现在由 MySQL owner 数据满足。
- `pnpm contracts:validate`、`pnpm config:check`、OIDC discovery/JWKS 检查均通过；最新 B36 闸门为 `b36-20260826032356`，连续两轮 14 个后端和 4 个前端 ready。

### 9. 2026-08-26 11:39 增量复核

- 修复本地 OIDC 标准安全事实映射：fixture 现在发布 `consent_state=GRANTED`、`account_status=ACTIVE`，social-service 按 canonical claim 读取同一事实；未放宽客户端 header 或未验证 subject 的权限边界。
- learner-service 保留 `prn_...` 内部 principal 的严格校验，同时在 IAM 内部 principal 映射尚未启用的本地迁移窗口内，仅接受 Spring Security 已验证的 UUID OIDC subject；请求体、query 和 `X-Role`/tenant/owner header 仍不参与 owner 派生。
- 本地用户种子新增 `b25_learning_review` durable owner row；最新无 subject seed 摘要为 `review=37`，覆盖检查 `33/33 PASS`。新用户 watcher 会在注册完成后按 UUID subject 扇出同一组用户级数据。
- learner-service 与 social-service Maven tests、B32 `4/4`、B25 `5/5`、contracts/config/OIDC checks 均通过；全栈重启后 B36 闸门 `b36-20260826033900` 连续两轮 `14/14` 后端、`4/4` 前端 ready，Gateway projection `state=ready, courseCount=2`。
- 认证后 Browser MCP 逐页读写矩阵仍未开始：当前浏览器仍停留在 Keycloak Register 页面，需要用户手动完成一次注册/登录；不能以匿名 401、静态 coverage 或 readiness 替代认证后全功能证据。

### 10. 2026-08-26 11:48 运行模式修复与全量静态复核

- 定位到此前“服务 readiness 正常但页面统一显示网络不可用”的根因：本地全栈 runner 未传 `B30_REAL_OIDC=true`，Gateway/领域服务的业务 Resource Server 处于关闭状态，readiness 并不等价于认证后业务可用。
- `scripts/runtime/run-v2-services.mjs` 新增 `--real-oidc`，根目录新增 `pnpm services:run:oidc`；本地真实数据测试的标准启动命令为 `pnpm services:run:oidc -- --all --timeout-ms 90000`。当前已按真实 OIDC 重启 14 个后端，Keycloak discovery/JWKS 检查通过；匿名访问 `/learner/profile`、`/grammar/points`、`/notifications/messages`、`/gamification/me/summary` 均由 Gateway 返回 401，证明认证边界已启用。
- 按新启动命令实际重启后，运行闸门更新为 `b36-20260826035724`：14/14 后端、4/4 前端连续两轮 ready，Gateway projection 为 `state=ready,courseCount=2`；匿名受保护接口继续返回 401；本地 MySQL 覆盖仍为 `33/33 PASS`；契约兼容性为 `0 breaking change`；B1–B14 `pass`，B2 仅保留 3 个既定外部 TODO；B15 `5/5`、G `41/41`；learner-web/admin-web/official-site/Mobile H5 构建与 learner-web typecheck 均通过（官网首次构建仅因已有 Nuxt dev lock，使用 `NUXT_IGNORE_LOCK=1` 后通过）。
- 认证后 Browser MCP 仍不能由 Agent 代填密码；当前浏览器停留在本地 Keycloak Register 页。用户完成注册/登录后，继续执行 Web/H5 逐页读写矩阵，并将接口状态、页面结果、控制台和 MySQL 写回追加到本记录；在此之前不能宣告全量功能已通过。

### 11. 2026-08-26 契约全量收口

- 静态审计发现四个前端实际调用路径未进入当前 canonical OpenAPI：`/api/v1/onboarding/daily-tasks/ensure`、`/api/v1/learning/media-progress`、`/api/v1/speaking/shadowing/completions`，以及被 B1/B25 双片段覆盖的每日任务完成路径。已按源片段修复：B25 新增 `ensure` 公开路径和请求 schema；B1 保留原公开 operationId 并补齐 learner-service owner 迁移、JWT、`Idempotency-Key` 和错误响应元数据；B11 新增媒体进度与跟读完成请求/回执 schema。未直接编辑生成文件。
- `pnpm contracts:merge`、`pnpm contracts:validate`、`pnpm contracts:generate`、`pnpm contracts:compatibility` 均通过；canonical/generated 现为 `373 operations / 478 OpenAPI schemas / 154 events / 110 event payload schemas`，兼容性 `0 breaking change`。`pnpm test:b11`、`pnpm test:b25`、`pnpm test:g` 分别为 `4/4`、`5/5`、`41/41`；G1 static result 为 PASS 且默认决策仍为 BLOCKED。
- 前端调用与 canonical 路径复核为 4/4 PASS；下一步仍需在用户完成本地注册/登录后，重新启动并执行认证后 Web/H5 点击、接口状态和 MySQL 写回回归。契约修复不等于认证后页面已全量通过。

### 12. 2026-08-26 12:14 重启后证据

- 按最新构建和契约重新执行 `pnpm services:run:oidc -- --all --timeout-ms 90000`；B36 `b36-20260826041322` 通过，两轮均为 14/14 后端、4/4 前端 HTTP 200，Gateway projection `source=gateway,state=ready,courseCount=2`，`browserAuthJourney=WAITING_USER_CONFIRMATION`，未输出 token 值。
- 重启后 `pnpm db:check:local-real-coverage` 仍为 `33/33 PASS`；OIDC discovery、authorization-code、token、JWKS、PKCE、端口登记和 `pnpm contracts:validate` 均通过。四个新收口路径在匿名 smoke 中均返回结构化 `401`（而非 `404/405`）：每日任务 ensure、媒体进度、跟读完成；匿名未写入数据库，符合默认拒绝策略。
- 契约变更后的自动回归 `test:b1`–`test:b33`、`test:b35` 全部退出码 0；B2 保留既定 `3 TODO`，其余本轮测试项无失败（B1 7/7、B11 4/4、B25 5/5、B33 1/1、B35 4/4）。
- learner-web、admin-web、Mobile H5、official-site 生产构建均通过；浏览器当前仍停留在 Keycloak 本地 `Register` 页面，注册表单只显示用户名、密码、确认密码、邮箱、名和姓。认证后的逐页点击、业务 API 200、写回 MySQL 和 Console 证据仍须在完成一次手动密码输入后继续，当前不能宣告全功能测试通过。

### 13. 2026-08-26 12:31 本地真实主体补数与接口覆盖复核

- `pnpm db:seed:local-real-all` 已再次幂等执行：当前覆盖为学习画像/计划 `26/26`、SRS/复习 `42/41`、学习交互/表达式 `75/25`、测评会话/报告 `42/42`、通知 `33`、成长 feature state/奖励 `275/25`、商城权益 `25`、社群座位/排行榜 `25/47`；`pnpm db:check:local-real-coverage` 仍为 `33/33 PASS`。
- `pnpm b31:learner-runtime` 最新运行 `b31-learner-20260826042940`：真实 OIDC 登录、成人 Gate、隐私/条款同意、画像/目标/偏好写入、幂等重放、读取和重登录读回共 `18/18 PASS`；MySQL profile/goal/preferences/IAM principal/consent 均有回写证据，未输出 token 或凭据。
- 前端 API 静态覆盖复核扫描 learner Web、Mobile H5、admin Web 的 API/auth 目录共 44 个源码文件、105 个静态路径前缀；93 个直接匹配 canonical OpenAPI，剩余 12 个均为动态路径前缀、浏览器回调、客户端 base URL 或与 canonical 参数路径拼接的合法前缀，未发现新的孤立 API 路径。
- 14 个后端健康端点和四个前端根页当前可访问：后端 `18070、18080、18087–18098` 全部 200；四端 `18180–18183` 根页全部 200。官方站点不提供 `/actuator/health`，使用根页 200 验证，不把该差异误报为故障。
- 已启动 `pnpm oidc:local-learner-watch`，仅处理 watcher 启动后新增且无管理员/审核角色的本地注册用户：完成注册后会按实际 OIDC subject 写入测试 fixture 并执行覆盖检查；密码不读取、不输出、不写入文档。
- 浏览器当前仍在 Keycloak `Register` 页面。登录前的匿名 401、后端 readiness、契约/静态扫描和 API 运行器均不能替代 Browser MCP 登录后的逐页点击与页面写回证据；该矩阵继续等待人工完成一次密码输入。

### 14. 2026-08-26 运行态与真实写入回归收口

- 契约全量重新生成并校验：`pnpm contracts:merge`、`pnpm contracts:generate`、`pnpm contracts:validate` 和 `pnpm contracts:compatibility -- --json` 均通过；当前 canonical 结果为 `374 operations / 479 OpenAPI schemas / 154 events / 110 event payload schemas / 4 JSON Schemas`，兼容性 `0 breakingChanges`。
- 修复每日任务确保写入的真实问题：本地 fixture 可能已按业务唯一键存在同一学习者/课程的任务，但任务主键不同；learner-service 现在按 `principal_id + tenant_id + content_code` 回读并保持幂等，避免成功写入后错误返回 500。数据库异常统一返回结构化 503，不再泄露 SQL 细节。
- 修复商城支付意图的 Gateway 契约路由冲突：两处同名公共路由均重写到 commerce-service 的 `/internal/v1/commerce/orders/{orderId}/payment-intents`，不再错误重写为不存在的 `/payments`。
- 真实认证写入回归 `pnpm b36:frontend-write-runtime`：`b36-frontend-write-20260826055311`，`47/47 PASS`；覆盖学习者偏好、每日任务、SRS、词汇库、表达式、语法、句块、写作、听力、阅读、口语、成长、社群和商城订单/支付意图。MySQL 写回证据为 `learningInteractions=21`、`reviews=1`、`libraryRemoved=1`、`socialReports=1`、`commerceOrders=1`，`subjectBound=true`，未输出 token 或凭据。
- 真实认证读取回归 `pnpm b36:frontend-read-runtime`：`b36-frontend-read-20260826055339`，`70/70 PASS`；覆盖四端共享的学习、测评、报告、词汇、语法、听说读写、媒体、通知、离线、成长、社群和商城读模型。
- 本地数据覆盖 `pnpm db:check:local-real-coverage`：`status=PASS`、`35/35`；MySQL owner 数据、Kafka 7 个 topic、Redis PONG、MinIO ready、Keycloak OIDC/JWKS 和 B35 回归均通过。当前真实 OIDC 全栈运行会话为 `22710`，14 个后端服务均保持运行。
- `pnpm build`：learner-web、admin-web、official-site 全部成功；`pnpm --filter @englishflow/mobile build:h5` 成功。构建仅保留依赖工具的 deprecation/chunk-size warning，不影响产物生成；Core API 兼容健康检查 `/api/v1/actuator/health` 返回 HTTP 200，四个前端固定端口均返回 HTTP 200。
- 以上自动化验证已经证明当前 Gateway、服务侧鉴权、契约和本地 MySQL 读写链路可用；应用内浏览器现已重新打开到 Keycloak `Sign in to your account` 页面。登录后 Web/H5 逐页点击、页面可见数据、浏览器控制台和页面触发的 MySQL 写回证据仍待用户手动完成密码输入后执行，不能用 API 运行器替代该项验收。

### 15. 2026-08-26 登录边界与直达路由增量复核

- 修复 learner-web `/settings` 根路由未受保护的问题：直达 `/settings` 现在统一跳转 `/login?redirect=/settings/profile`，避免未登录用户进入错误页。
- Mobile H5 的练习、词汇、个人、平台、设置、今日等受保护直达页面统一经过 `ensureMobilePageAccess`；App 启动时优先解析 H5 hash 目标，再决定是否渲染页面，避免直达 URL 在登录前短暂读取业务数据。
- 使用 Browser MCP 为每个路由创建独立新标签复核：learner-web `/settings` `1/1 PASS`；Mobile H5 7 个受保护直达页面 `7/7 PASS`，最终均到本地 IdP 登录页；本轮未检查 Cookie、Local Storage、Token，也未输入密码。已采集的浏览器控制台 error/warn 为 `0`。
- `node --test apps/mobile/tests/b14-fe-005.test.mjs` `5/5 PASS`；learner-web typecheck/build 和 Mobile H5 build 均通过。H5 开发服务已按最新代码重新启动并保持在 `18183`。
- 修正健康探针复核路径后，Gateway `18070/actuator/health/readiness`、Core API `18080/api/v1/actuator/health`、IAM/领域服务 `18087–18098/actuator/health/readiness` 全部返回 HTTP `200`；四端固定端口 `18180–18183` 根页也全部返回 HTTP `200`。此前对后端 `/` 的失败结果是错误探测路径造成的误报。
- 本节只关闭了匿名访问边界和深链门禁证据；认证后的全量页面点击、页面触发的 API 读写、控制台和 MySQL 回写矩阵仍不能在没有浏览器登录态的情况下宣告完成。

### 16. 2026-08-26 G1 契约 Gate 基线修复

- 补跑 `pnpm test:g` 发现 G1 配置和测试断言仍停留在旧的 `373/478`，而 canonical/generated 契约已是 `374/479`；已同步 `config/g1-contract-data.json` 与 `tests/g/g1-contract-data.test.mjs`。
- 修复后 `pnpm test:g` 为 `41/41 PASS`，G1 仍保持 `defaultDecision=BLOCKED`、运行态证据缺失时 fail-closed；`pnpm test:b14` 为 `6/6 PASS`，未通过修改 Gate 规则掩盖缺失的认证后浏览器证据。

### 17. 2026-08-26 全栈重启交接

- 原有进程已停止后，MySQL、Redis、Kafka、MinIO、Keycloak 和 RabbitMQ 容器保持原数据运行；未执行清库、重置或重新生成用户数据。
- 首次启动暴露 Windows Java 25 `WEPollSelectorImpl` 无法建立 loopback pipe 的环境问题；已验证 `Selector.open()` 在默认 TEMP 下失败、在 `C:\\Temp` 下成功，并将短临时目录兼容处理固化到 `scripts/runtime/run-v2-services.mjs`。可通过 `ENGLISHFLOW_JAVA_TEMP_DIR` 覆盖。
- 以 `pnpm services:run:oidc -- --all --timeout-ms 90000` 启动最新构建：Gateway、Core API、IAM 和 11 个领域服务共 `14/14` readiness 通过；learner-web、admin-web、official-site、Mobile H5 共 `4/4` 根页 HTTP `200`。
- 重启后契约校验为 `374 operations / 479 OpenAPI schemas / 154 events / 110 event payload schemas / 4 JSON Schemas`；本地 owner 数据覆盖 `35/35 PASS`；公开站点 projection 为 `200`，四个受保护 Gateway API 匿名访问均为结构化 `401`。

### 18. 2026-08-26 认证后 Browser MCP 与最终运行回归

- 认证后的 learner Web 已使用本地 OIDC 会话完成真实页面回归：`/reading` 读取 MySQL 文章、提交理解题并显示服务端 `RULE_PASS`；`/writing` 读取真实写作提示、提交草稿并显示 `FOUNDATION · 80`、`RULE_STRUCTURE · PASS`；`/practice` 读取 B25 真实题目、提交后进入下一题；`/grammar` 读取语法点、句法数据和练习；`/vocabulary` 的“今天没有到期复习”为空态与服务端数据一致，不是网络错误；`/b2/report` 通过 OIDC 会话恢复后读到 assessment/learning 服务端报告快照。上述页面 Browser MCP Console `error/warn=0`。
- learner Web 页面写回已由页面操作和 MySQL 聚合事实交叉核对：阅读提交新增 `READING/ATTEMPT`，写作提交产生真实规则反馈，练习提交推进真实 assessment 会话；不以静态 fixture 或旧 Core API 响应代替 Gateway→领域服务证据。
- 认证后的 Mobile H5 已完成 OIDC 回调、成人阶段学习首页和测评链路：首页显示由内容服务写入 MySQL 的 B31 已发布内容；测评重读后显示真实题目，提交后回读 `C2 · 100 分`，页面明确标记结果来自 assessment-service/MySQL，Browser MCP Console `error/warn=0`。
- Mobile H5 当前仍存在一个需要继续修复的首次进入交互问题：从认证回调第一次进入测评页时偶发先显示“当前没有可用的测评题目”，点击“重新读取”后稳定读到同一主体的真实题目/报告；新页签首页可正常读到 MySQL 内容。该现象不能记录为全功能通过，后续应继续定位页面生命周期/首次请求竞态。移动端麦克风权限不由自动化强行授予，语音链路仅记录可用的文本/示范音频降级。
- 12 条并行链路代理均已返回结果。C01 认证/RBAC/主体隔离、C02 资料/目标/偏好、C03 导航布局、C04 测评、C05 词汇/SRS、C06 语法、C07 写作内容编码、C08 阅读、C09 听力、C10 发音/口语、C11 世界/社交/通知、C12 官网/后台均完成各自范围的修复或验证；代理报告中早于本节的旧阻塞以当前主线程构建和运行证据为准，未将未认证 401 或 API 运行器单独提升为浏览器通过。
- 本节后最新自动化证据：`pnpm b36:frontend-read-runtime` `70/70 PASS`；`pnpm b36:frontend-write-runtime` `47/47 PASS`，主体绑定且 MySQL 写回聚合为 `learningInteractions=21`、`reviews=1`、`libraryRemoved=1`、`socialReports=1`、`commerceOrders=1`；`pnpm b36:gate-runtime` 两轮均为 `14/14` 后端、`4/4` 前端、Gateway `state=ready`。
- 本节后静态/构建证据：`pnpm test:b1`–`pnpm test:b14`、`pnpm test:b35`、`pnpm test:g` 无失败；B2 保留 `3 TODO`；`pnpm contracts:validate` 为 `374/479/154/110/4`，兼容性 `0 breakingChanges`；迁移、Redis、配置、基础设施静态校验、安全扫描和 `pnpm build` 均通过。移动端新增真实查询参数类型修复，Web 语法性能降级提示已与网络/内容不可用提示分离。
