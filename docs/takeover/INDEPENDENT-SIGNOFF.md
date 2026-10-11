# 独立签收台账（非 Luna）

> 审查方：`independentReviewer: Grok Bot 测试项目练手`
> 日期：2026-10-11（Asia/Shanghai）
> 源码基线（审查开始）：`809dfcfe`（`dev-redesign`）
> **诚实规则**：本文件是独立审查签收。`lunaStamp` / Luna 名义 `accepted` / `*Outbound` **保持 false / 不改写**。历史 REJECT 原件只读。

## 1. 总览

| 站 | 独立结论 | 发现数 | 证据锚点 | 签收状态 |
|---|---|---|---|---|
| IT-1 | PASS | 0 开（F-IT1-01/02 已关） | rv2 `ea1aa3c8` IT-1 11/11；AUTH/CORS 源码 + 单测 | SIGNED_PASS |
| IT-2 | PASS | 0 新开 | three-schema `2f1d24b6`；full-chain | SIGNED_PASS |
| IT-3 | PASS | 0 新开 | browser `d2012bf6`；full-chain | SIGNED_PASS |
| IT-4 | PASS | 0 新开 | browser `c460b646`；full-chain | SIGNED_PASS |
| IT-5 | PASS | 0 新开（P3 残留） | browser `1f244c3b`；full-chain | SIGNED_PASS（residual: RES-ARTWORK） |
| IT-6 | PASS | 0 开（F-IT6-01 已关） | rv2 `ea1aa3c8` IT-6 45/45；指纹重启一致；单测 18/18 | SIGNED_PASS（residual: RES-ARTWORK） |
| IT-7 | PASS | 0 新开 | rv2 `ea1aa3c8` IT-7 34/34；full-chain | SIGNED_PASS |
| 全链 | PASS | — | rv2 `ea1aa3c8` 58/58；node 361/361；Maven 1680/0/1 | SIGNED_PASS |

残留不挡签收（记入但不开修）：

| ID | 级 | 说明 |
|---|---|---|
| RES-WALL-114 | P3 | 原 114 卡墙仍 OPEN；115 张为按站拆卡，不补空卡 |
| RES-ARTWORK | P3 | H5 390 装饰节点超出盒子 10–24px，文档横向滚动为 0 |
| RES-RATE-BUDGET | P3 | 证据栈曾抬高 Gateway 高风险限额；生产默认未改 |
| RES-H5-RELOAD | P3 | hash 不重载时内存门状态可能旧；产品路由在文档加载后会送回无权限页 |

rv3 关闭（追加，不删上表）：

| ID | 状态 | 提交与证据 |
|---|---|---|
| RES-WALL-114 | CLOSED | 权威卡墙声明：R1-001…R1-115 共 115 张取代原 114。决定人 Grok Bot 测试项目练手，日期 2026-10-11。`evidence/redesign/2026-10-11/rv3-ea0d8dcd/wall/steps.json`。台账第 0.1 节 |
| RES-ARTWORK | CLOSED | 提交 `cd458ee6`、`0ffb50f3`。`evidence/redesign/2026-10-11/rv3-ea0d8dcd/artwork/steps.json`。站页扫描横向溢出 0，越界元素为空 |
| RES-RATE-BUDGET | CLOSED | 提交 `a6120fda`、`6f7e59d4`。`evidence/redesign/2026-10-11/rv3-ea0d8dcd/rate-budget/steps.json`。生产默认仍是 30；证据 profile 单独为 2000 |
| RES-H5-RELOAD | CLOSED | 提交 `f3c2a159`、`a5c540aa`。`evidence/redesign/2026-10-11/rv3-ea0d8dcd/h5-reload/steps.json`。只改哈希进入无权限页；从未同意的新用户进入引导页 |
| RES-IT5-OUTER | CLOSED | 不改 `B25ReviewEvidenceGateTest`。`evidence/redesign/2026-10-11/rv3-ea0d8dcd/it5/steps.json`。外层保持 PARTIAL / B25-LEGACY-UNVERIFIED-1；本期 NEVER_STUDIED 且 officialScore=false，按站口径 PASS |
| MinIO 跳过 | CLOSED | 提交 `18aa5170`。`evidence/redesign/2026-10-11/rv3-ea0d8dcd/minio/steps.json`。Maven 中 1 项、0 跳过 |

## 2. 发现明细

### F-IT1-01 未成年年份无法经表单提交（P2）

- **准则**：acceptance-matrix R1-006 — 成人/未成年各有一条独立用例；合成年龄经 UI 提交后服务端判定。
- **事实**：`AdultGatePage.vue` 的 `canConfirm` 与 `max=getFullYear()-18`、mobile `adultBirthYearValid` 使未成年年份无法点继续；named-gates 用同会话另发 API 才得到 REJECTED。
- **要求**：UI 允许提交 1900…当年的整数年；服务端为唯一判定；未成年提交后页面进入 REJECTED/无权限态，无「改年份晋级」控件。

### F-IT1-02 学习同意撤回无页面入口（P2）

- **准则**：R1-009 — 已登录主体撤回 ADULT_LEARNING 后学习口 403。
- **事实**：证据靠直接 `PUT /iam/consents`；Web/H5 设置·隐私页无撤回按钮。
- **要求**：设置/隐私提供明确「撤回学习同意」；确认后写 WITHDRAWN；随后学习口 403；账号仍 ACTIVE。

### F-IT6-01 发布台仅进程内存（P1）

- **准则**：IT-6 出站与 IT-7 对等的持久化诚实性；r6 summary 自承 `studio: in-memory`。
- **事实**：`ContentReleaseStudio` 用 `LinkedHashMap` 保存 versions/pins/idempotency；重启丢失。IT-7 已落 `it7_closure_desk`，IT-6 未跟进。
- **要求**：发布台状态持久化（Flyway 表或等价）；重启后只读指纹不变；补浏览器/重启证据；旧内存行为单测可留作对照但不作为出站。

### rv1 关闭说明

实现提交：`65be71d1`（F-IT1-01）、`6117e6c1`（F-IT1-02）、`10a291fe`（F-IT6-01）。证据目录：`evidence/redesign/2026-10-11/it6-persist-rv1-a749da72`。读法见该目录 `reading.md`。`steps.json` 与 `report.md` 保持脚本首跑原文。

F-IT1-01：表单可提交 1900 到当年的整数年。后缀 `a749da72` 在 Web 与 H5、1280 与 390 用真实表单提交 2016。注册是 `POST https://127.0.0.1:18087/api/v1/auth/register`，状态 201。成人门是 `POST http://127.0.0.1:18070/api/v1/iam/adult-gate`，状态 200，响应含 `"status":"REJECTED"`。页面进入无权限页。「再试一次」与「改年份」按钮计数为 0。Web 两条在 `steps.json` 里是 FAIL，因为当时已加载的脚本只接受 IAM 源站；发现允许 IAM 或 Gateway，当场请求打到 Gateway。

F-IT1-02：设置页有「撤回学习同意」和二次确认。Web 1280 与 H5 390 留在设置页。调用记录里最后一次 `PUT /api/v1/iam/consents` 是 `ADULT_LEARNING`、`decision` 为 `WITHDRAWN`，状态 200；随后 `GET /api/v1/learner/targets` 为 403，错误码 `CONSENT_REQUIRED`。`steps.json` 把这两条记成 FAIL，因为当时脚本取了引导阶段第一次 ACCEPTED 的 PUT。

F-IT6-01：content-service 用 Flyway `V30` 表 `it6_release_studio`。简审短链后只重启 content-service。重启前后指纹相同，行都是 `state_version` 6、JSON 长度 3737。IT-6 全量浏览器记为 SKIP，见卡账第 4 节。

顶层 `node --test --test-concurrency=1 apps/mobile/tests/*.mjs apps/learner-web/tests/*.mjs` 为 361 项、360 通过、1 失败。失败文件是 `apps/mobile/tests/support-real-gateway.e2e.mjs`，工单 GET 503，本轮没有启动 admin-ops。`IamAuthCorsConfigurationTest` 5 项、0 失败。`ContentReleaseStudioTest` 15 项、0 失败。`ContentReleaseStudioRestartTest` 3 项、0 失败。`rv1_*` 库已删。qida 名称计数前后都是 50。

第 4 节签收栏仍空。`lunaStamp` 仍是 false。本段不是 `SIGNED_PASS`。

### rv2 关闭说明

证据目录：`evidence/redesign/2026-10-11/rv2-ea1aa3c8`。读法见该目录 `reading.md`。提交：`404f6c6f`（IT-1）、`3c33a9ed`（IT-6 全量浏览器）、`87e2c1cb`（workflow 允许 `rv2_` 隔离库）、`6f8670cb`（顶层 node）、`41acb289`（IT-7 与全链）。`steps.json` 与 `summary.json` 是脚本首跑原文，首跑即 PASS。

F-IT1-01：后缀 `ea1aa3c8` 在 Web 与 H5、1280 与 390 用真实表单提交 2016。注册是 `POST https://127.0.0.1:18087/api/v1/auth/register`，状态 201。成人门是 `POST http://127.0.0.1:18070/api/v1/iam/adult-gate`，状态 200，响应含 `REJECTED`。页面进入无权限页。「再试一次」与「改年份」计数为 0。四条都是 PASS。

F-IT1-02：Web 1280 与 H5 390 留在设置页。最后一次 `PUT /api/v1/iam/consents` 状态 200，正文含 `ADULT_LEARNING` 与 `WITHDRAWN`。随后 `GET /api/v1/learner/targets` 状态 403，正文含 `CONSENT_REQUIRED`。两条都是 PASS。

F-IT6-01：全量浏览器 45 步 PASS，没有 SKIP。流程含建稿、冲突、双签与简审、发布、投影、下架与强制停止、回滚边界，Web 与 H5 的 1280 和 390。只重启 content-service 后再读指纹。前后相同，1803 字符，库行都是 `70 34410`。`replayedCommands` 是 false。H5 390 文档横向溢出是 0，装饰超出仍按 RES-ARTWORK 记录。

顶层 `node --test --test-concurrency=1 apps/mobile/tests/*.mjs apps/learner-web/tests/*.mjs` 在 admin-ops 监听时为 361 项、361 通过、0 失败。全链 58 步 PASS，it7 34 步 PASS，链内 node 同样 361/361/0。收口重启后指纹相同，`versionBefore` 是 45，没有重放收口命令。

`mvn -B -ntp -f pom.xml test` 于 2026-10-11T11:35:14+08 BUILD SUCCESS，总时间 02:15 min。合计 1680 项、0 失败、1 跳过。跳过的是 `MinioObjectStorePortReadOnlyIntegrationTest`。learning-service 199 项、0 失败、0 跳过。assessment-service 153 项、0 失败、0 跳过。admin-ops 收口 11 项、0 失败。workflow-service 58 项、0 失败、0 跳过。IAM JDBC 上下文 9 项、V13 迁移 1 项，0 失败。共享库表数前后一致。`rv2_` 与 `iam_v13_test_rv2round` 已删。qida 名称计数前后都是 50。

本轮站级 SKIP 为空。独立审查已于合并 `94e1f90b` 后填写第 4 节：`IT-1`/`IT-6`/`IT-7`/`FULL-CHAIN` = `SIGNED_PASS`。`lunaStamp` 仍是 false。

### rv3 关闭说明

证据目录：`evidence/redesign/2026-10-11/rv3-ea0d8dcd`。读法见该目录 `reading.md`。实现提交：`cd458ee6`（装饰盒）、`f3c2a159`（hash 门）、`a6120fda`（证据限额 profile）、`18aa5170`（MinIO 隔离 bucket）、`dd545739`（全链脚本）、`0ffb50f3`（H5 safe-area 探针）、`a5c540aa`（撤回后留在无权限页）、`6f7e59d4`（站页复用会话）、`ea0d8dcd`（工单列表等读取后再显示空态）。

收口重跑的 `summary` 是 PASS。全链 158 步，it7 34 步，`failed` 为空。链内 `node --test --test-concurrency=1 apps/mobile/tests/*.mjs apps/learner-web/tests/*.mjs` 为 367 项、367 通过、0 失败。Web 与 H5、1280 与 390 都有截图。同后缀更早一次只因外部 qida 名称从 44 变成 46 而失败，本轮没有 stop 或 start，该次目录未入库。`rv3-dd545739` 与 `rv3-6f7e59d4` 不改写。

RES-ARTWORK：站页 `getBoundingClientRect` 留在容器和视口内，文档横向溢出是 0。RES-H5-RELOAD：撤回与未成年拒绝后只改哈希，Web 到 `/forbidden`，H5 到 `#/pages/forbidden/forbidden`，`reload` 是 false。从未同意的新用户到引导页。RES-RATE-BUDGET：生产默认 `high-risk-admin` 仍是 30；`evidence` profile 单独写成 2000，并且不带占位符。IT-5：外层保持 PARTIAL / B25-LEGACY-UNVERIFIED-1，本期 NEVER_STUDIED 且 officialScore=false，按站口径 PASS，不改写成 READY。

`pnpm typecheck` 为 7 项全部通过。`pnpm contracts:validate` 为 471 个操作、818 个 OpenAPI schema、192 个事件。`mvn -B -ntp -f pom.xml test` 于 2026-10-11T13:43:59+08 BUILD SUCCESS，总时间 02:20 min。合计 1681 项、0 失败、0 跳过。`MinioObjectStorePortReadOnlyIntegrationTest` 为 1 项、0 跳过。`rv3_` 与 `iam_v13_test_rv3round` 已删。共享 schema 表数前后一致。两个保留库仍在。qida 名称计数前后都是 46。固定端口无监听。

权威卡墙是 R1-001…R1-115。原 114 卡墙无法找回，差异不能逐张核对，没有补空卡。BC-094 与 BC-187 不在这些站。

仍保持的外部项：`lunaStamp` 是 false。R1-029 的 3 个 NOT_RUN 不回写。历史 FAIL 目录不改写。两个保留库仍在。没有对 qida 执行 stop 或 start。第 4 节已有的 `SIGNED_PASS` 单元格不改。本段不是新的 `SIGNED_PASS`。

## 3. Luna P1 复核（本轮）

| 项 | 结果 | 依据 |
|---|---|---|
| AUTH_TRANSPORT | 源码 PASS | Web `iamAuthBaseUrl` + passwordClient；Mobile `mobileIamAuthClient` → `requireIamAuthBaseUrl(getIamAuthBaseUrl())`；默认 `https://127.0.0.1:18087/api/v1` |
| IAM_AUTH_CORS | 单测 PASS | `IamAuthCorsConfiguration` + `IamAuthCorsConfigurationTest`（本轮 5 项、0 失败，exit 0） |
| 浏览器具名门 | 历史 PASS 未签 | `it1-named-gates` / R1-014。rv1 后缀 `a749da72` 已重采未成年提交与撤回，见上方关闭说明。第 4 节未签 |

## 4. 签收栏（修复轮完成后填写）

| 站 | independentReviewer | 日期 | commit | evidence | verdict |
|---|---|---|---|---|---|
| IT-1 | Grok Bot 测试项目练手 | 2026-10-11 | `94e1f90b` | rv2 `ea1aa3c8` IT-1 11/11 首跑 PASS；注册 IAM HTTPS 201；成人门 REJECTED；撤回 WITHDRAWN→targets 403；复跑 IamAuthCors 5/5 | SIGNED_PASS |
| IT-2 | Grok Bot 测试项目练手 | 2026-10-11 | `f7905ab8` | three-schema `2f1d24b6`；full-chain-r8 `627fa9bf`；rv1 后 node 定向 28/28 | SIGNED_PASS |
| IT-3 | Grok Bot 测试项目练手 | 2026-10-11 | `f7905ab8` | browser `d2012bf6`；full-chain-r8 `627fa9bf` | SIGNED_PASS |
| IT-4 | Grok Bot 测试项目练手 | 2026-10-11 | `f7905ab8` | browser `c460b646`；full-chain-r8 `627fa9bf` | SIGNED_PASS |
| IT-5 | Grok Bot 测试项目练手 | 2026-10-11 | `f7905ab8` | browser `1f244c3b`；full-chain-r8 `627fa9bf` | SIGNED_PASS（residual: RES-ARTWORK） |
| IT-6 | Grok Bot 测试项目练手 | 2026-10-11 | `94e1f90b` | rv2 `ea1aa3c8` IT-6 45/45；重启指纹一致 1803；ContentReleaseStudio* 18/18 | SIGNED_PASS（residual: RES-ARTWORK） |
| IT-7 | Grok Bot 测试项目练手 | 2026-10-11 | `94e1f90b` | rv2 `ea1aa3c8` IT-7 34/34；收口重启指纹一致；full-chain 58/58 | SIGNED_PASS |
| FULL-CHAIN | Grok Bot 测试项目练手 | 2026-10-11 | `94e1f90b` | rv2 `ea1aa3c8` 全链 58/58；node 361/361；Maven 1680/0/1 BUILD SUCCESS | SIGNED_PASS |

签收填写规则：`verdict=SIGNED_PASS` 仅当该站发现已关、关键证据 PASS、且未改任何 `lunaStamp`。可选附 `residual: RES-*`。

## 5. 调度

- 修复轮：`rv1`，screen `cs-rv1`，分支 `grok/cs-rv1-20261011`（自 `dev-redesign`）。2026-10-11 独立审查复核：代码符合三项要求，定向 node 28/28、`ContentReleaseStudio*` 18/18、`IamAuthCorsConfigurationTest` 5/5 复跑绿，已合并为 `f7905ab8`；签收 IT-2…IT-5。
- 修复轮：`rv2`，screen `cs-rv2`，分支 `grok/cs-rv2-20261011`。RV2-01…RV2-04 证据在 `evidence/redesign/2026-10-11/rv2-ea1aa3c8`。独立审查复核：IT-1 11/11、IT-6 45/45（指纹一致）、IT-7 34/34、全链 58/58、node 361/361、Maven 1680/0/1；定向复跑 IamAuthCors 5/5、ContentReleaseStudio* 18/18。已合并为 `94e1f90b`；签收 IT-1、IT-6、IT-7、FULL-CHAIN。七站全部 `SIGNED_PASS`（仅 P3 残留）。独立审查例行已关闭。
- Luna 字段始终外部待办。
