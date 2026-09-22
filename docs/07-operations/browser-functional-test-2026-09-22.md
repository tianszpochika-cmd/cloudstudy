# 浏览器实际功能测试与全栈启动（2026-09-22）

> 性质：**运行证据快照**。用真实 Chromium 走前端页面 + 网关接口，记录实际观察到的行为与缺陷。
> 观测时刻：**2026-09-22 21:5x–22:1x 本地**。端口占用、进程、数据均可变，复述前请重新实测。
> 相关提交见 `CHANGELOG.md` 的 `[T21-20260921]`、`[MERGE-20260922]`、`[DOCS-20260922]`、`[BROWSER-20260922]` 条目。

---

## 1. 浏览器能力与工具链 [实测]

| 项 | 值 | 取得方式 |
|---|---|---|
| Playwright | **1.63.0** | `node_modules/.bin/playwright.cmd --version`，root `package.json` 依赖 `playwright@^1.63.0` |
| 已安装浏览器 | `chromium-1243`、`chromium_headless_shell-1243`、`webkit-2359`、`ffmpeg-1011` | `$env:LOCALAPPDATA\ms-playwright` 目录列举 |
| firefox | **未安装** | 同上，目录中无 firefox 项 |
| 仓库 browser skill | `.claude/skills/browser/dist/browser.mjs` **不存在** | `Test-Path` → `False`；该 skill 已废弃且产物未入库，**只能走 Playwright** |

结论：**具备真实浏览器测试能力**（Chromium 可启动、可登录、可遍历路由、可采集 console/网络错误）。本文件记录的测试即由它执行。

---

## 2. 本次启动的全栈 [实测]

### 2.1 Docker 打包

`docker compose build` 退出码 **0**，产出 **19 个镜像**，标签 **`3d5b5885`**：

- 15 个 Java 服务（api-gateway、iam、learner、content、learning、assessment、media、notification、gamification、social、commerce、admin-ops、analytics、audit、workflow），551–612 MB
- 4 个前端：admin-web 75.8 MB、learner-web 74.7 MB、mobile-h5 75.5 MB、official-site 293 MB
- **`core-api` 未构建是设计如此**：`docker-compose.full.yml` 第 6–7 行写明不复活 v1 core-api [读取]
- 基础镜像 5 个已进缓存：`maven:3.9-eclipse-temurin-25`、`eclipse-temurin:25-jre`、`docker/dockerfile:1`、`node:20.19.5-bookworm-slim`、`nginx:1.27-alpine`

**打包过程失败 2 次**（均记录，非猜测）：

1. `IAM_JWT_PRIVATE_KEY_HOST_PATH` 的占位值被 compose 当成**未声明的命名卷** → `service "iam-service" refers to undefined volume build-placeholder`。该变量是 bind 挂载源（`${...}:/run/secrets/iam-rsa-private.pem:ro`）[读取]，占位必须是绝对路径。
2. `auth.docker.io/token` 连接超时 → `failed to fetch oauth token`。基础镜像预拉 + 重试后第 3 次成功。

打包用的占位 env 文件：`%TEMP%\clyunedev-build.env`（30 个 `${VAR:?}` 强制变量，值均为 `build-placeholder`，**不含真实密钥**）。

### 2.2 运行路径选择 [实测]

**未用 Docker 路径起服务**，因为：

- 本机**不存在** `/srv/cloudstudy/env/clyunedev.env`（`Test-Path` → False），clyunedev overlay 需要 15 个 DB 密码等服务器级 secret
- `docker-compose.core.yml` 发布 `127.0.0.1:18070/18087/18180/18181/18182` [读取]，与本机 JAR 路径**完全同端口**，且其自带 mysql/redis/kafka/minio 会撞 dev 基础设施

因此走仓库文档规定的本地路径：dev 基础设施 + `pnpm services:run -- --all` + 四个前端 dev server。

### 2.3 启动结果

**16 个后端 actuator 全绿（16/16）+ 4 个前端 HTTP 200** [实测]：

| 端口 | 服务 | 端口 | 服务 |
|---|---|---|---|
| 18070 | api-gateway | 18093 | notification |
| 18071 | workflow | 18094 | gamification |
| 18080 | core-api | 18095 | social |
| 18087 | iam | 18096 | commerce |
| 18088–18092 | learner/content/learning/assessment/media | 18097 | admin-ops |
| 18098 | analytics | 18099 | audit |
| **18180** | **learner-web** | **18181** | **admin-web** |
| **18182** | **official-site** | **18183** | **mobile-H5** |

基础设施容器（已运行 26 小时）：MySQL 13306、Redis 16379、Kafka 19092、RabbitMQ 15689/15690、MinIO 19000/19001。

---

## 3. 浏览器实测首轮结果 [实测]

Chromium 打开各前端 → 登录 → 从页面 `a[href^="/"]` 动态发现路由并逐个访问，采集 HTTP 状态、`document.title`、console error、失败请求、截图。

```
admin-web      pages=12 httpOk=12 consoleErrors=16 failedReq=4
learner-web    pages=14 httpOk=14 consoleErrors=1  failedReq=0
official-site   pages=9  httpOk=9  consoleErrors=0  failedReq=0
mobile-h5       pages=1  httpOk=1  consoleErrors=1  failedReq=0
```

**HTTP 全 200 不代表功能可用**：admin-web 登录后 URL 直接变成 `/forbidden?from=/dashboard`。逐路由审计（访问后记录最终 URL 与是否出现「暂时无法访问这个页面」）：

| 结果 | 路由 | 最终 URL |
|---|---|---|
| DENIED | `/dashboard` | `/forbidden?from=/dashboard` |
| DENIED | `/support` | `/forbidden?from=/support` |
| DENIED | `/commerce` | `/forbidden?from=/commerce` |
| DENIED | `/audit` | `/forbidden?from=/audit` |
| OK | `/content` `/lexemes` `/items` `/phonetics` `/learners` `/governance` `/release` `/recovery` | 停在原路由，title 为各页专属标题 |

---

## 4. 缺陷 1：权限命名前后端不一致，4 个管理端页面被 403 挡死 [实测]

### 现象

`repro-gamma` 的 JWT 与 `/api/v1/iam/permissions` 快照中**都含有** `admin.dashboard.read`、`admin.commerce.read`、`admin.audit.read`、`admin.support.read` [实测]（解码 accessToken + 调权限接口核对）。前端路由守卫用这些名字判定 [读取] `apps/admin-web/src/router/index.ts:34/70/76/94`，判定通过；但后端接口返回 403，视图随即跳 `/forbidden`：

```
403 GET /api/v1/admin/ops/metrics?limit=50
    {"code":"FORBIDDEN","message":"analytics permission is required","requestId":"analytics-error"}
403 GET /api/v1/admin/ops/tickets?...        {"code":"ADMIN_PERMISSION_DENIED","message":"permission denied"}
403 GET /api/v1/admin/ops/commerce/orders?… {"code":"ADMIN_PERMISSION_DENIED","message":"permission denied"}
403 GET /api/v1/admin/ops/audit              {"code":"ADMIN_PERMISSION_DENIED","message":"permission denied"}
```

### 根因：后端 PEP 要的是另一套权限名

| 页面 | 接口 → 服务 | 后端真正要求 | 契约/文档中是否存在 | 修复前测试账号是否有 |
|---|---|---|---|---|
| /dashboard | `/admin/ops/metrics` → analytics-service | **`analytics.read`** [读取] `AnalyticsPrincipalResolver.java:23` | **不存在**（全仓 md/json/yml 搜索为空） | 否（55 项中 0 个 analytics） |
| /support | `/admin/ops/tickets` → admin-ops `SupportController` | **`support.ticket.read`** [读取] `SupportTicketService.java:122/138` | 契约叫 **`support.ticket.read.admin`**，**名字对不上** [读取] `openapi.json` | 否（只有 `support.ticket.create`） |
| /commerce、/audit | `/admin/ops/{commerce/orders,audit}` → `AdminOpsController` → `query()` | **`admin.projection.read`** [读取] `AdminPermission.java:6`、`AdminOpsService.java:79` | **不存在** | 否 |

补充事实：

- `AdminPep.requirePermission` 是**严格权限匹配、不展开角色** [读取] `AdminPep.java:14`
- IAM 源码中**没有 `platform-admin` 角色→权限映射** [实测] grep `services/iam-service/src/main` 零匹配 → 权限靠逐个手工授予，无法从映射推导应发集
- 路由映射确认：`GatewayRouteExecutionPolicy.java:485` 把 metrics 转到 ANALYTICS；`:655/656/660` 把 commerce-orders、tickets、audit 转到 ADMIN_OPS [读取]

### 本次已做的解封（**仅本地测试账号数据，未改代码**）

对 `repro-gamma@example.invalid` 追加 6 个代码实际要求的权限（55 → 61）：

```sql
UPDATE iam_service.iam_account
SET permissions = CONCAT(permissions,
  ',admin.projection.read,support.ticket.read,support.ticket.read.admin,analytics.read,audit.export,support.ticket.manage')
WHERE identifier='repro-gamma@example.invalid'
  AND permissions NOT LIKE '%admin.projection.read%';
```

**复验 [实测]**：重新登录后**直接进入 `/dashboard`（title「工作台 · 语学星」）**，13 次路由访问**全部 OK、零 forbidden、零 403**，`/support`、`/commerce`、`/audit` 均渲染真实页面。

### 状态：**未修（需上游裁决）**

补权限只是让本地测试能继续走，缺陷仍在：**契约缺 2 个权限声明 + 1 个权限名前后端不一致**。方向需决策——补契约迁就代码，还是改代码迁就契约（`support.ticket.read` → `support.ticket.read.admin`）。

---

## 5. 缺陷 2：客服工单列表 500 —— 一行脏数据打死整个读接口 [实测]

解封权限后 `/support` 过了权限关，但接口 500：

```
java.lang.IllegalArgumentException:
  No enum constant com.englishflow.adminops.support.TicketCategory.bulk-100x-category-0059
    at TicketCategory.valueOf(TicketCategory.java:3)
    at JdbcAdminOpsAdapters$SupportTickets.map(JdbcAdminOpsAdapters.java:388)
    at JdbcAdminOpsAdapters$SupportTickets.list(JdbcAdminOpsAdapters.java:359)
    at SupportTicketService.list(SupportTicketService.java:126)
    at SupportController.list(SupportController.java:49)
```

证据：

- 枚举只有 6 个合法值 `CONTENT_CORRECTION / ACCOUNT_ACCESS / BILLING / LEARNING_DATA / PRIVACY_REQUEST / TECHNICAL` [读取] `TicketCategory.java`
- 库中 **45 行合法 + 约 100 行 `bulk-100x-category-*` fixture 脏值** [实测] `GROUP BY category`
- 映射处**无任何容错** [读取] `JdbcAdminOpsAdapters.java:388` 裸 `valueOf`；**同类裸调用还有 3 处**：`:310` `Domain.valueOf`、`:390` `TicketPriority.valueOf`、`:392` `TicketState.valueOf`

性质：**读路径上「单行未知值 → 整个查询 500」**。与 T14 在写路径修过的批隔离是同一类病（非业务异常不应中断整批/整页）。

**此前未暴露的原因**：权限 403 先挡住了该代码路径；缺陷 1 解封后才现形——**两个缺陷存在依赖关系**。

### 状态：**未修**。建议把 4 处裸 `valueOf` 改为容错映射（未知值 → 显式 UNKNOWN 或跳过该行），改后跑 admin-ops 单测 + 浏览器复验 `/support`。

---

## 6. 其他浏览器观察 [实测]

| 观察 | 性质 |
|---|---|
| `/content` 请求 `content-commands/VOCAB-PHASE1` → 404 `CONTENT_NOT_FOUND` | 数据状态（该 pack 不存在），非代码缺陷 |
| `/phonetics` → 404 | **已知 withhold**：网关未放行该路径（M3/M4 未决）[读取] `CHANGELOG.md` T6 |
| learner-web 登录后直达 `/home`（成人门 PASSED），14 路由全绿，1 个 console error | 正常 |
| official-site 9 页 **零 console error** | 正常 |
| mobile-H5 单页 title 为「登录」 | 正常（H5 起始页） |
| 管理端看板指标区 | 与 `/admin/ops/metrics` 权限问题相关，解封后不再 403 |

截图 36 张与 `report.json` 在 `%TEMP%\browser-evidence\`（会话临时产物，未入库）。

---

## 7. 测试账号（**密码不入库** [读取] `AGENTS.md` §3.8）

本次会话在**本地 dev 库**创建的合成账号，登录验证均 200 [实测]：

| 标识 | 角色 / 权限 | 成人门 | 用途 |
|---|---|---|---|
| `repro-gamma@example.invalid` | `platform-admin` + content 三审 + learner 全量 + 61 项权限（含本次追加的 6 项） | **PASSED / GRANTED** | 主账号：管理端全部页面 + 学习端 |
| `repro-eps@example.invalid` | `platform-admin` + content 三审，token 18 项 | NOT_EVALUATED | 内容**一审**（作者不能自审） |
| `repro-zeta@example.invalid` | 同上，token 18 项 | NOT_EVALUATED | 内容**终审 + 发布** |
| `repro-delta@example.invalid` | learner + content 角色，token 4 项 | NOT_EVALUATED | 首次运行旅程（成人门→同意→目标） |

> **密码是本次会话在本地创建的会话态值，按 `AGENTS.md` 不写入 Git**；它们只存在于本地 MySQL，未写入任何仓库文件。如需重置：走 IAM 注册新号，或本地直改 `iam_service.iam_account` 后重新登录。
>
> 权限会被**成人门裁剪** [实测]：eps/zeta/delta 的学习/社交/商业权限在 token 中为 0 项，**学习端只能用 gamma**；delta 剩余 4 项是设计如此（未过门）。

---

## 8. 未闭合 / 待决（不得当作已完成）

1. **缺陷 1 未修**：契约缺 `analytics.read`、`admin.projection.read`；`support.ticket.read` vs 契约 `support.ticket.read.admin` 名字不一致。**需上游裁决方向**，本次只做了测试账号解封。
2. **缺陷 2 未修**：4 处裸 `valueOf` 未容错，脏数据仍会让工单列表 500。
3. **`pnpm ports:check` 与常态冲突**：基础设施端口（13306/16379/19092/15689/15690/19000/19001）在正常运行时被判 BUSY → `exit 3` 并提示停进程 [实测]；而 `AGENTS.md` §2.3 要求「启动全栈前先运行 pnpm ports:check」[读取]——**按字面执行永远失败**。未改。
4. **`packages/i18n` 测试与 Node 版本 pin 矛盾**：测试直 import `.ts` [读取] `tests/starter-locales.test.mjs:9`，而 root `engines.node=20.19.5` [读取] `package.json`；`node 20.19.5` 报 `ERR_UNKNOWN_FILE_EXTENSION`，`node 22.14 --experimental-strip-types` 才 7/7 [实测]。未改。
5. **`.gitignore` 不忽略根目录 `*.log`** [读取] `.gitignore:36` 仅有 `logs/*` → 运行日志污染 `git status`。**本次已加 `*.log` 规则修复**。
6. **clyunedev Docker 运行路径本机不可用**（缺服务器 env + 端口与本地路径互斥），镜像能打但不能用这套起。
7. **打包日志重定向曾误导**：脚本内 `>` 未捕获 docker 的 stderr，任务包装层报 `exit 0` 而实际 `build-exit=1` [实测]——**会被假绿骗过**。复现打包请用 `2>&1 > file`。

---

## 9. 复现命令

```powershell
# 1) Docker 打包（tag 用当前 sha；30 个强制变量用占位值）
docker compose --env-file "$env:TEMP\clyunedev-build.env" `
  -f infra/docker/clyunedev/docker-compose.core.yml `
  -f infra/docker/clyunedev/docker-compose.full.yml build 2>&1 > docker-build.log

# 2) 启动全栈（本地路径）
& "$env:APPDATA\npm\pnpm.cmd" services:build -- --all
& "$env:APPDATA\npm\pnpm.cmd" services:run -- --all --timeout-ms 180000
& "$env:APPDATA\npm\pnpm.cmd" --filter admin-web dev
& "$env:APPDATA\npm\pnpm.cmd" --filter learner-web dev
& "$env:APPDATA\npm\pnpm.cmd" --filter official-site dev
& "$env:APPDATA\npm\pnpm.cmd" --filter mobile dev:h5

# 3) 浏览器功能测试（脚本见本次会话 %TEMP% 下 browser-fn-test.mjs / admin-routes-audit.mjs）
#    关键：用 createRequire 从仓库根解析 playwright，否则临时目录下 ESM 解析不到依赖
```
