# IT-1 正式验收：REJECT / FAIL

日期：2026-10-10。源码基线：`dev-redesign` / `69bea68b44b2c8c6c6dbdcdb38c0b955a458aaf1`。范围：R1-001…017 / BC-001…012、201、202 / IC-002…009、052…057。没有修改业务源码、历史证据、进度页；没有提交或推送。

## 出站判定

**IT-1 不满足出站条件。IT-2 动态验收 BLOCKED，未执行。** Web 和 Mobile H5 的注册、登录、密码重置统一复用 Gateway API 客户端，真实 DOM 提交目标是 `http://127.0.0.1:18070/api/v1/auth/*`，违反本分支“密码直接提交 IAM TLS”边界。浏览器注册→成人门→逐项同意→画像→定级主链因此未成功建立。

本轮在发送前保护性中断这类认证请求，仅记录 destination、method 与 viewport，没有读取或记录请求正文，没有把密码交给 Gateway。页面出现的“注册没有完成，请稍后再试”等提示由该保护性中断触发，不冒充真实 IAM 拒绝；**实际产品缺陷是浏览器要发送到 HTTP Gateway 的 destination**。未用 API 预注册、临时 Token、同意桩或测试代理替代主链。

| 本轮实测 | 结果 | 证据 |
|---|---|---|
| Web / H5 注册，1280×900 与 390×844 | 4 次均命中错误认证 destination，前网 abort | [browser-auth-result.json](browser-auth-result.json) |
| Web / H5 登录与重置，两 viewport | 8 次均命中错误认证 destination，前网 abort | [auth-pages-result.json](auth-pages-result.json) |
| IAM TLS 真实 OPTIONS，Web / H5 origin | HTTP 200，但均无 ACAO / ACAC / ACAM，不能完成跨源认证 | [browser-auth-result.json](browser-auth-result.json) |
| 官网原 11 页，两 viewport，正常独立 content | 22/22 HTTP 200、无横向溢出、无 pageerror；课程真实空态、下载真实空态、价格依赖失败诚实态 | [official-content-result.json](official-content-result.json) |
| 官网主页与课程空态去注册 CTA，两 viewport | 共4次真实点击到 Web 注册表单，18+ 说明可见 | [official-content-result.json](official-content-result.json)、[official-course-cta.json](official-course-cta.json) |
| IAM 新库 Flyway / 账号初态 | 17 成功 / 0 失败；账号 0 | [environment.json](environment.json) |

真实浏览器为本机官方 Google Chrome，通过 Playwright 1.63.0 建立独立会话；未启用 `ignoreHTTPSErrors`、全局证书忽略、SPKI 例外或响应 mock。Node 的 IAM TLS 预检只信任本轮限定测试 CA，`rejectUnauthorized=true`。浏览器没有尝试穿越证书警告。

## 确认缺陷与源码位置

- **AUTH_TRANSPORT / P1**：Web `apps/learner-web/src/stores/session.ts:107` 向认证 adapter 传入 `getGatewayBaseUrl()`；`apps/learner-web/src/auth/gateway-auth.ts:157`、`:163`、`:169` 分别发登录、注册、重置；`apps/learner-web/src/platform/gateway.ts:1` 默认 HTTP Gateway。H5 `apps/mobile/src/auth/gateway-auth.ts:143`、`:151`、`:159` 复用 `mobileApiClient`；其 `apps/mobile/src/api/client.ts:3` 与 `apps/mobile/src/platform/gateway.ts:1` 绑定同一 Gateway。实际 DOM 网络目标与源码一致。修复应提供独立 IAM TLS 认证 transport，同时保留领域 API 的 Gateway 边界，不能以测试反向代理或关闭浏览器校验补齐。
- **IAM_AUTH_CORS / P1**：`services/iam-service/src/main/java/com/englishflow/iam/config/IamSecurityConfiguration.java:34` 当前安全链没有配置浏览器 CORS；真实 `OPTIONS https://127.0.0.1:18087/api/v1/auth/register` 对两个固定学习端 origin 都返回 200 但缺失允许 origin、credential、method。单改前端 URL 仍不能完成浏览器直 IAM TLS 认证。

脱敏截图：`screenshots/web-mobile-transport-fail.png`、`screenshots/h5-mobile-transport-fail.png`；输入账号及两处密码均遮盖。初态截图为空表单。登录与重置失败截图也遮盖全部输入框。

## 17 卡验收矩阵

“BLOCKED”表示本轮真实依赖/资格前置未达到，不推断功能未实现；不把历史卡级通过提升成站级通过。

| 卡 | BC / IC | 本轮状态 | 实测、复用与剩余门槛 |
|---|---|---|---|
| R1-001 | BC-001 / IC-001 | PASS_CURRENT_SCOPE / HISTORICAL_GATE_NOT_PROMOTED | 正常独立content的22页200/布局、主页与课程空态4次CTA真实通过，课程准备中/下载准备中来自空读投影；price因未起commerce显示诚实错误态，不扩栈。本轮具名scope通过不冒充历史001原件恢复/完整整卡独立ACCEPTED。 |
| R1-002 | BC-002 / IC-052 | FAIL_AUTH_TRANSPORT | 注册 4 个 DOM 场景错误 destination；未向服务提交密码，浏览器 201 / 会话未建立。IAM 新库迁移17/0不代替注册验收。 |
| R1-003 | BC-003 / IC-052 | BLOCKED_AUTH_TRANSPORT | 浏览器无法合法注册，未执行同键回放；旧幂等证据只保留历史审计。 |
| R1-004 | BC-004 / IC-053 | FAIL_AUTH_TRANSPORT | 登录4场景错误 destination；轮换/撤销/重放依赖合法新会话，本轮阻塞。 |
| R1-005 | BC-005 / IC-008、035 | BLOCKED_AUTH_TRANSPORT | 未取得合法浏览器会话，设备标当前/踢出401无本轮证据。 |
| R1-006 | BC-006 / IC-055 | BLOCKED_AUTH_TRANSPORT | PASSED / REJECTED 服务落库与审计本轮均未到达。 |
| R1-007 | BC-007 / IC-005、055 | BLOCKED_AUTH_TRANSPORT | 未过门受限学习、设置/隐私出口与退出未到达。 |
| R1-008 | BC-008 / IC-006、056 | BLOCKED_AUTH_TRANSPORT | 三项必要同意默认未选、发布版读取/换版本签署未到达，不能静态推断默认选中状态。 |
| R1-009 | BC-009 / IC-008、036、056 | BLOCKED_AUTH_TRANSPORT | 没有已签同意浏览器主体，撤回回执及能力403无本轮证据。 |
| R1-010 | BC-010、202 / IC-057 | BLOCKED_AUTH_TRANSPORT | 画像保存、退出登录后草稿续填、停 learner 再启读回都未到达；未启动 learner。 |
| R1-011 | BC-011 / IC-009、057 | FAIL_CHAIN / BLOCKED_AUTH_TRANSPORT | 主链首步无法建立合法会话，不能声称3击到达定级。 |
| R1-012 | BC-012 / IC-007、054 | FAIL_AUTH_TRANSPORT | 重置申请4场景错误 destination；有无账号恒202和回执不枚举没有本轮服务响应。 |
| R1-013 | BC-201 / IC-005、055 | BLOCKED_AUTH_TRANSPORT | 未成年拒绝清理、退出重入无本轮登录前置。 |
| R1-014 | L1 replay | FAIL_STATION | 本轮空专库与真实前端已运行，但主链失败，全卡全绿不成立。未删除或复用旧库。 |
| R1-015 | IC-052、053、054 | FAIL_AUTH_TRANSPORT | 注册/登录/重置三个实际表单均观察到，两端两viewport认证目标失败；后续交互幕阻塞。 |
| R1-016 | IC-055、056 | BLOCKED_AUTH_TRANSPORT | 成人门说明、拒绝出口、必要同意逐项验收未到达。 |
| R1-017 | IC-057、009 | BLOCKED_AUTH_TRANSPORT | 目标/时长回填、草稿与真实进度引导、定级按钮未到达。 |

历史 `evidence/redesign/2026-10-10/IT-1-exit/report.md` 已明确只做 HTTP 10/10、浏览器仅开注册页、未重启读画像。本轮没有覆盖它，也没有复用其 PASS 作为当前浏览器结果。

## 环境、资源与证据绑定

正常content只追加一个域；Gateway `GatewayRouteExecutionPolicy.java:74` / `:493` 将公开site projection保留路由到content。content `ContentHttpController.java:82` 仅用本域读模型输出课程/公开facet，定价从commerce另读；BFF `public-projection.get.ts:155`…`:192` 将commerce失败隔离为degraded。真实Gateway200 courses0、BFF200 source=gateway state=empty；没有启动commerce或legacy core。初轮依赖未起的诚实错误态保留在 [official-result.json](official-result.json)，补充独立content后结果单列 [official-content-result.json](official-content-result.json) 和 [content-public-transport.json](content-public-transport.json)，未覆盖初轮记录。

只对 `yuxuexing-local-mysql-1` 做精确 inspect/必要 SQL：image `mysql:8.0`、server `8.0.46`、compose project `yuxuexing-local` / service `mysql`、healthy、映射 `127.0.0.1:13306`。未操作任何 qida 容器、Docker daemon、compose 启停或 prune。

启动前已执行 `pnpm ports:check`；exit3仅来自已存在的5个预期基础设施监听（MySQL、Redis、Kafka、MinIO API/console），所有本轮 Java/frontend 固定端口均空闲。没有停止或收养其他进程，没有换端口。

本轮实际新建 `r1_it1_browser_20261010_iam_5d9f4b7e` / `it1_iam_5d9f4b7e`，补充根审批准的 `r1_it1_browser_20261010_cnt_5d9f4b7e` / `it1_cnt_5d9f4b7e`。IAM Flyway17/0、content28/0；content公开课程0、公开facet0。`partial_revokes=0`，`SHOW GRANTS` 是 USAGE + 各自仅一个 schema 的 SELECT/INSERT/UPDATE/DELETE/CREATE/ALTER/DROP/INDEX/REFERENCES，库名下划线按 literal 转义。learner/assessment 名字未创建、服务未启动。新库保留供复核，未 DROP 任何新旧库或用户。没有服务间共享库/账号。

仅本轮 IAM18087 TLS、Gateway18070、content18089、Web18180、H5 18183、官网18182 原生子进程运行，前端使用仓库 strictPort 启动入口。IAM签名私钥/TLS私钥/独立信任库/配置/日志位于 Git 外0700目录且文件0600；[secret-material-modes.json](secret-material-modes.json) 只列文件名和权限。没有记录 Token、Cookie、密码或私钥。所有提交尝试保护中断后，IAM账号仍0。

[source-binding.json](source-binding.json) 绑定当前 HEAD、入口/BC/IC/相关源码/脚本 SHA；[environment.json](environment.json) 绑定 JAR SHA、MySQL身份、固定端口、子进程 PID。这里是已有 target artifact 的摘要绑定，**没有新 Maven 构建回执，不能据此声明所有 JVM 字节码已从当前源码独立重建**；AUTH_TRANSPORT 则由当前源码 frontend dev server 和真实 DOM destination 双重证明。

已通过74806 supervisor的stop关闭全部本轮child，随后EOF关闭监督进程，exit0；environment.json的cleanup与cleanup-verification.json记录最终退出事实，相关固定端口无监听。保留本轮两个测试库、两个单库账号与受保护秘密材料用于独立审查；没有DROP任何库/账号。IT-1 获根审和 Luna 签收前，不执行 IT-2。最终manifest列全部新证据摘要；本轮数据库身份、grant、迁移与账号数见 [database-verification.json](database-verification.json)，过程/端口/监督进程退出见 [cleanup-verification.json](cleanup-verification.json)。
