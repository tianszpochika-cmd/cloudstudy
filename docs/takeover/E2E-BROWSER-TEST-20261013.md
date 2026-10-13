# E2E 浏览器实测记录 · 2026-10-13

环境：`dev-redesign` → learn / mobile / admin.clyunedev.com  
测试账号前缀：`e2e-20261013-`（可整批清理）  
工具：Playwright headless Chromium  
前端修复部署：`learner-web:5dd0daec`（bundle `index-Czsf7pgM.js`）

## 模块进度

| 模块 | 端 | 结果 | 证据 / 说明 |
|---|---|---|---|
| 认证 / 引导：注册 | learner-web | pass | `e2e-20261013-m*` 注册 201 → `/onboarding` |
| 认证 / 引导：成人门 | learner-web | pass | `POST /iam/adult-gate` 200 |
| 认证 / 引导：必要同意 | learner-web | fixed | 见 BUG-1；正常路径 refresh 200 进目标步 |
| 认证 / 引导：目标与时长 | learner-web | pass | FOUNDATION + 15 分钟，`PUT /learner/targets` 200 → `/assessment` |
| 定级测评：开场与作答 | learner-web | pass | `POST .../placement/sessions` 201；提交 1 题 responses 200，进入第 2 题 |
| 定级测评：整卷跑完 | learner-web | pending | 脚本未答完 10 题；跳过入口存在 |
| 首页 `/home` | learner-web | pass | SPA 导航到达「今天，也给自己一点进步。」无 pageerror；未完成定级时显示空计划属预期 |
| 今日 `/today` | learner-web | pass | 「给今天，安排一点进步。」 |
| 内容书架 `/courses` | learner-web | pass* | 页面渲染 OK；`GET /content/learner/catalog` **503** → 记 blocked |
| 学习路径 `/learn` | learner-web | pass | 「从这里，接着往前走。」 |
| 专项练习（侧栏分组） | learner-web | pending | 侧栏为折叠组，需展开后再点词汇/练习子项 |
| 错题本 `/mistakes` | learner-web | pass | 「再遇见一次，就更熟悉一点。」 |
| 学习报告 `/b2/report` | learner-web | pass | 「回头看看，你已经走了多远。」 |
| 掌握进度 `/mastery` | learner-web | pass | 「学过的，现在记住了多少？」 |
| 计划地图 `/plan-map` | learner-web | pass | 「按自己的节奏，一步一步来。」 |
| 学习世界 `/world` | learner-web | pass | 「把进步，装进你的世界。」 |
| 帮助与反馈 `/support` | learner-web | pass | 「遇到问题，我们一起解决。」 |
| 设置 `/settings/profile` | learner-web | pass | 「设置」 |
| 消息 / 商城 / 报告分享深链 | learner-web | pending | |
| 移动端全链路 | mobile | pass* | 见下方移动端表；主路径可走通 |
| 管理端模块 | admin | pass* | 14 个路由全部可进；修了 BUG-2/3、FIX-4，见下方管理端表 |

## 已知缺口（前端写死，不改）

- 部分页面「暂未开放 / 暂不可用」：按产品规则记入缺口，不静默改 API。
- 未完成定级时首页/今日显示「还没有学习计划」：产品预期，不是回归。

## 阻塞（后端 / 基础设施）

### BLOCK-1 内容目录 503 → 已修（FIX-4）

- 原现象：`GET /api/v1/content/learner/catalog` → 503；管理端 `/admin/content-commands` 同样 503 `CONTENT_FACT_CORRUPT`。
- 之前日志里的 `ConnectException` 是 OTLP 指标上报（localhost:4318）噪音，与此无关。
- 见 FIX-4。

## 缺陷与修复

### BUG-1 引导「必要同意」点继续无响应（401 refresh）

- **现象**：三份同意已勾选，点「继续」无跳转、无报错。控制台见 `POST /auth/token/refresh` 401。
- **服务端日志（用户 11:50–11:52 CST）**：`PUT /iam/consents` ×3 均为 200；随后 refresh 401；无后续写目标。同意已落库。
- **根因**：
  1. `signRequiredConsents` 在同意写入后强制 `refreshSilently()`。
  2. refresh 失败时清空会话。
  3. `recordRequiredConsents` 的 `catch` 在 `!stillCurrent(owner)` 时不写 `lastError`。
  4. 与 muse 换皮无关（仅 CSS class）。
- **复现**：擦除 refresh cookie 后再提交同意 → 401，旧版 `errors []`。
- **修复**：`5dd0daec` — `refreshSilently({ clearOnFailure: false })`；失败始终写 `lastError`；同意步展示 session 错误。
- **回测**：同场景出现「必要同意已保存，但登录凭证未能更新。请退出并重新登录后再继续。」
- **用户侧**：**退出再登录**（同意多半已在服务端）。



## learner-web 技能与扩展（补 · SPA / router.push）

| 模块 | 结果 | 说明 |
|---|---|---|
| 词汇复习 `/vocabulary` | pass | 「把见过的词，变成记得的词。」 |
| 分级阅读 `/reading` | pass | 「读一小段，看见更大的世界。」 |
| 语法与句子 `/grammar` | pass | 「拆开一句话，读懂它的结构。」 |
| 综合练习 `/practice` | pass | 「练一练，让理解更扎实。」 |
| 听力 `/listening` | pass | 「慢一点，听懂每一句。」 |
| 口语 `/speaking` | gap | 页面可开；文案含「暂未开放/暂不可用」类已知缺口 |
| 写作 `/writing` | gap | 同上 |
| 消息 `/messages` | pass | 「与你有关的新消息。」 |
| 商城 `/commerce` | pass | 「你的学习权益，一目了然。」 |
| 平台 `/platform` | pass | 「让这里，用起来更舒服。」 |

说明：硬刷新依赖 refresh cookie，E2E 中途多次硬跳会丢会话；侧栏 SPA / `$router.push` 更稳。


## 移动端 mobile.clyunedev.com

| 模块 | 结果 | 说明 |
|---|---|---|
| 注册 | pass | `uni-button`「注册并继续」→ onboarding |
| 成人门 | pass | 需点 `uni-checkbox`（非原生 input）；`POST /iam/adult-gate` 200 |
| 必要同意 | pass | 三项 consent PUT 200，refresh 200，进入目标步 |
| 目标保存 | pass* | 点「保存并开始测评」出现「正在保存…」；随后进定级/首页链路 |
| 定级入口 | pass | `#/pages/assessment/assessment` 可打开 |
| 今日 / 课程 / 练习 | pass | today / learn / practice 可渲染 |
| 我的 / 世界 / 设置 / 客服 | pass | profile / world / settings / support 可渲染；客服受控文案属产品策略 |

## 管理端 admin.clyunedev.com

| 模块 | 结果 | 说明 |
|---|---|---|
| 登录页 | pass | 渲染正常，空提交有校验文案 |
| 登录 | fixed | BUG-2：登录 200 后 refresh 403，被踢回登录页 |
| 工作台 `/dashboard` | pass | 指标为空，空态正常 |
| 内容与双审 `/content` | fixed | FIX-4 后列表 200 |
| 题目与练习 `/items` | pass* | 空态正常；控制台有 `GET /admin/content-commands/VOCAB-PHASE1` 404（服务器未种这条内容，数据缺口） |
| 词汇管理 `/lexemes` | pass* | 同上 VOCAB-PHASE1 404，页面显示「暂无符合条件的记录」 |
| 音标资料库 `/phonetics` | pass | |
| 学员工作台 `/learners` | pass | |
| 订单与退款 `/commerce` | pass | 0 单，空态正常 |
| 客服工单 `/support` | pass* | 0 单；「处理功能暂不可用」是前端已知缺口 |
| 审计记录 `/audit` | pass* | 0 条；「导出暂不可用」是已知缺口 |
| 策略版本 `/permissions` | fixed | BUG-3：之前 401 把会话踢掉 |
| 社群治理 `/governance`、`/risk` | pass | `/risk` 按设计并入治理页 |
| 人工恢复 `/recovery` | pass | |
| 发布与质量 `/release` | pass | |

测试管理员：`e2e-20261013-admin`（凭据在服务器 `/root/e2e-20261013-admin.txt`，600）。走注册 API 建号，再改该行 `roles/permissions`，并通过 API 完成成人 Gate 与三项同意。

### BUG-2 管理端登录后被踢回（refresh 403 `iam.auth.origin_untrusted`）

- 原因：`IAM_TRUSTED_LEARNER_ORIGINS` 只有 learn/mobile，没有 `https://admin.clyunedev.com`。与 2026-10-11 `1de5c1d4` 同类。
- 修复：服务器 env 加 admin 源（备份 `clyunedev.env.bak-*-admin-origin`），compose 默认值同步；只重建 iam-service。

### BUG-3 策略版本页 401 `iam.jwt.access_profile_invalid`

- 原因：`PolicyAccessAuthenticationVerifier.validPermission` 只允许 `[a-z0-9.-]`。真实管理员 token 一定带 `content:write`、`commerce:order:read` 这类冒号键，于是整份 token 判非法，前端当会话过期。
- 修复：放宽为 `[a-z0-9._:-]`（`b9a7739f`），iam-service 重建部署。

### FIX-4 DEMO-P5 种子数据乱码导致整个目录 503

- 原因：4 条 `DEMO-P5-*` 内容（265101–265104）在服务器上经 latin1 客户端写入，中文成了双重编码（`å…³äºŽ`），但 `payload_hash` 是按正确文本算的。content-service 读到任一行 hash 不符就抛 `CONTENT_FACT_CORRUPT`，整个列表 503。纯英文的两条 hash 正常。
- 修复：备份后对 4 行 `payload_json` 和 13 行 `b25_content_item.prompt` 做 latin1→utf8mb4 反转；36 行 hash 全部复核一致。种子脚本加 `SET NAMES utf8mb4`。
- 复测：新学员 `GET /content/learner/catalog` 200，34 条。
- 备份：`/srv/cloudstudy/backups/content-demo-p5-mojibake-20261013073634.sql.gz`。

### RISK-1 token 体积接近 Tomcat 8KB 请求头上限

- 管理员号带上注册时的全部学习者权限后 token 7.9KB，所有后端返回 Tomcat 400 `Request header is too large`。测试号已收窄为纯管理权限（4.4KB）。
- 普通学员通过 Gate 后 token 约 5.3KB，余量不多。属于较大改动（token 精简或调大 `server.max-http-request-header-size`），未改，记录。

## 仍开着的事

- 口语/写作 learner-web：页面开得开，含「暂未开放/暂不可用」已知缺口
- b4-games 暗色模式、管理端无路由 demo 页：仍待你定
- 服务器缺 `VOCAB-PHASE1` 内容（题目/词汇页 404，页面空态正常）
- RISK-1：token 体积接近 8KB 请求头上限

## 种子数据 SEED-20261013 与 favicon（2026-10-13 下午）

### 种子
- 脚本：`scripts/seed/seed-20261013.mjs`（`account` | `data` | `admin-api` 补齐），数据：`scripts/seed/seed-20261013-data.mjs`（真实中英文内容）。
- 清理：`sh scripts/seed/cleanup-seed-20261013.sh [--dry-run]`，会先自动备份，再执行 `cleanup-seed-20261013.sql`。dry-run 已验证（ROLLBACK）。审计链（admin_audit_record / audit_fact）不删；账号不删。
- 写入方式：有 API 的走 API，包括词条、题目、风险案件、人工恢复、策略版本、报告分享、6 笔 API 订单。其余用 SQL（utf8mb4），所有 hash 都按 canonical 方式计算，并统一打上 `SEED-20261013` / `seed-20261013-*` / id 段 2610130000+ 的标记。
- 学员账号 `e2e-20261013-learner`（凭据在 `/root/e2e-20261013-learner.txt`，600 权限）：已完成成年确认、三项同意、目标（四六级 · 15 分钟）和定级 10/10 COMPLETED，学习计划 plan-100012 已生成。

### 浏览器验证（Playwright，截图在 box `/workspace/e2e-seed/`）
- 学员端有数据：课程、阅读、听力（30）、语法、错题（40）、掌握度（53）、消息（80）、权益、世界（XP 880 / Lv4）、计划地图、报告。
- 管理端有数据：工作台（42 指标）、词汇（50）、题目（40）、客服（40）、治理举报（30）、订单（36）、策略版本（30）、审计。
- favicon：learn / admin / mobile 三端的 svg、32、180、apple-touch 均返回 200，图片尺寸正确；标题已更新。

### 过程中修正的种子问题
- coin_ledger 只接受正数结算（`LEDGER_INVARIANT` 会导致 /world 返回 409）。已改为全部正数并重算余额。
- b3 体验数据需要绑定 `content_b3_item_binding`，且必须指向已发布、权利信息完整的版本。已改为绑定 2610130001。
- 管理端订单读取的是事件投影 `admin_projection`(COMMERCE)，已为种子订单补写投影。
- 词条的 pos 必须使用受控词表值（NOUN / VERB / ADJ / ADV）。

### 发现的问题（未修，需要决定）
- BUG-S1：策略文档省略 `minimumDeviceTrust` 时，服务端返回 `null`，而 admin-web 的 `parsePolicyVersionPage` 只接受 undefined 或 string。结果是只要有一条这样的策略，整页就显示「策略版本暂不可用」。种子已改为显式传入 `REGISTERED` 来规避；前端或服务端仍需要修。
- BUG-S2：学员首页的引导只看 sessionStorage 标记，不看定级是否已完成。新会话里，即使定级已 COMPLETED，仍会显示「剩余步骤：定级」。
- 写作（/writing）在 Phase 1 被 `CLOSED_NAV` 关闭，种子数据无法在学员端展示。听力音频没有真实媒体资产，manifest 返回 404，页面显示「授权已过期」；文本和字幕正常。
- 人工恢复没有列表 API（GET /admin/recovery/recoveries 返回 404），30 条种子已入库，但页面只显示当前申请。/learners 需要检索后才会出数据。
