# R1-001 解阻准备报告（BLOCKED revision 20，不登记 start，不提交产品完成声明）

> 状态基线 `[实测]`（`dev-plan-R1.status.json` 本轮读取）：revision 20 / BLOCKED / executor `Muse Spark` / submission `delivery-6.json`。
> 主审基线 `[读取]`（`reviewer-6/review.md` + `block-6.json` + `findings.json`）：始于 REVIEW revision 19，本卡 BLOCKED；禁止按现有默认配置继续启动后台；F11/F13 为 P2（采集器与证据判定），F14 为 P1（运行输入 Gate）。
> 本报告只新增 `work/` 解阻准备文件，不改业务、不启动后台、不登记 start；旧 delivery-1~6、reviewer-1~6 保留；共享 dirty（规划文档等）未碰；HEAD `3d11be33` 未变 `[实测]`（`git rev-parse HEAD`）；不清库、不改端口、不进 R1-002。

## 1. 版本7采集器（F11 新建，不覆盖旧证据）

- 新文件 `work/r1-001-sweep-7.cjs`（`checkHrefStrict` 保留 v6 严格语义：Web `pathname === /register` 且无 hash；mobile `pathname === /` 且 hash 路由 `=== /pages/register/register`；query 逐项独立比较；无 `includes/startsWith` 路径放宽）。
- `collectFromPage` 改为“视口决定期望设备 + 至少一个可见可操作入口”：`375x812→mobile` / `1440x900→web`；等待 h1 visible + 预期设备入口 visible（可操作 = visible 且非 disabled/aria-disabled）；HTTP 状态（`page.__r1Status`）、设备、入口集合、可见性在同一模块断言；website-runtime 映射 2 适用 / 3 PARTIAL / 6 不适用。
- 新文件 `work/negative-sweep-7.cjs` 与真实采集共用 `checkHrefStrict` + `collectFromPage` 语义替身，覆盖合法 web/mobile、非 200、缺 CTA、错 origin、错 web path、query 藏路径、错 mobile path、错设备 ×2、全隐藏共 11 项。
- 本阶段实测 `[实测]`：`negative-sweep-7.cjs → work/negative-7/negative-7.json`，11/11 符合预期（`failedChecks: []`），标记 MOCKED（仅证明采集器，不作产品验收）。旧 `negative-7-fresh` 保留，未覆盖。

## 2. 证据判定补齐（F13，不重做业务）

- 课程 DOM-BFF 对应：`work/real-upstream-7.cjs` 逐视口断言 DOM 完整渲染标题集合与 BFF 课程标题集合逐项相等（BFF 用 contentCode 作 id 的局限已在脚本注释说明），替代 v6“只比数量”；`domIds` 变量已删除，不再出现“算出未记录/比较”。
- 价格权威空 PASS 条件：facet 合法空（`empty` 或 `ready` + 0 计划）且 `!stale && !errorCode`、无价格卡、无购买链接/按钮、**可见空说明文本**（`getByText(没有可购买|暂未发布|尚未开放|敬请期待|暂无).isVisible()`）、`recovery` 横幅计数必须为 0（排除 error/recovery 冒充权威空）。
- 空说明文案来源 `[读取]`（`packages/i18n/src/official-site.ts`）： authoritative 空态为“当前没有可购买的付费套餐”（`c4e8f2a1b5`），与脚本正则匹配；`内容准备中` 为课程空态（`c52c0deec1`），不在价格 PASS 正则内，避免课程/价格文案混淆。
- Cookie：`real-upstream-7.cjs` 逐视口真实补采 `context.cookies()` 名称/数量（只记名称与命中数，不输出值）；业务命中按 `refresh|session|token|auth` 名称匹配计数；`summary-6.md` 的“0 命中”口径更正为未执行（v6 脚本无 Cookie 采集代码，`reviewer-6/real-evidence-check` 已证实）。
- 未检查的 storage（localStorage/sessionStorage 键值）如实记未执行；截图与当轮 `real-upstream-7.json`（含 upstream/commerce/bff 固定块）一并固定哈希；旧截图不覆盖。

## 3. 安全启动配置和预检（F14，不启动后台）

- 新文件 `work/r1-001-safe-runtime-7.md`：固定端口表（Gateway 18070 / content 18089 / commerce 18096 / official 18182 / learner-web 18180 / mobile-h5 18183，均 127.0.0.1）。
- 显式覆盖（调用方覆盖，不改共享 runner 默认）：`CONTENT_EVENT_RELAY_ENABLED=false`、`CONTENT_EVENT_CONSUMER_ENABLED=false`、`CONTENT_FLYWAY_ENABLED=false`、`COMMERCE_FLYWAY_ENABLED=false`（`run-v2-services.mjs:197/202` 默认 `?? 'true'`，故必须显式覆盖 `[读取]`）。
- 应用默认均为关闭 `[读取]`（`content application.yml:7/80/95`；`ContentEventRelayConfiguration:37`、`ContentInboundConsumerConfiguration:44`、`ContentServiceConfiguration:300` 定时发布 relay 需 `content.schedule.enabled=true`；`commerce application.yaml:13/80/82`）。
- schema/credential（`config/b17-runtime-services.json:17/24`）：`content_service/svc_content`、`commerce_service/svc_commerce`；迁移由 reconcile 预应用，`SPRING_FLYWAY_ENABLED=false`（`run-v2-services.mjs:280`）；本轮仅公开 GET，无秘密落盘。
- delivery-5/6 口径更正：“commerce 无写路径”仅指本卡检查的公开 GET 路径（`CommerceController.java:52` `publicCatalog` 纯读；写操作均为鉴权 POST），不泛指整个商业服务。
- 预检（本阶段已执行 `[实测]`）：Node v20.19.5、Java 25.0.4.1（Maven 版本行因 WARNING 噪声未取，记缺口）；四套件 38/38；负例 11/11；六端口 CLOSED；`Get-Process java` 无残留，后台零启动。

## 4. 只读盘点：合法空课程输入与 Gateway 断连映射（TC01/02/03 可执行步骤）

- 上游现状（delivery-5/6 固定事实引用，非本阶段重测）：content/Gateway 200，7 DEMO（`projectionVersion=4, contentEpoch=4, generatedAt=2026-09-27T17:05:36Z`，requestId/traceId present）；commerce 200 `plans=0`（权威空价格，`productionPaymentEnabled=false`）；BFF `ready/gateway` 7 ID 逐一对应。
- 断连映射 `[读取]`（`GatewayErrorMapper.java:30-38`）：`ConnectException→503 upstream_unavailable`；超时（Timeout/SocketTimeout/ConnectTimeout）→504；其它→502。BFF 侧：上游非 2xx 抛 `PUBLIC_PROJECTION_HTTP_<status>`（`public-projection.get.ts:165`），无缓存时落 `error/PUBLIC_PROJECTION_UNAVAILABLE`，有 60s 内缓存时落 `recovery/PUBLIC_PROJECTION_STALE`。
- TC01 可执行（READY 后）：版本7 sweep 双视口 11 页 + 真实链 DOM-BFF 对应 + 可见空说明；合法空课程事实缺失→空态“内容准备中”分支不可执行（缺项 A）。
- TC02 可执行（READY 后）：安全配置启动三实例→公开 GET 基线→停自己已记录 PID 的 content（或 commerce）实例→观察 Gateway 真实映射（503/504/502 均如实记录，不冒充 503）→恢复实例→用户点击重试→BFF/DOM 重载比对（缺项 B：需主审确认可否停启自有实例；故障注入开关非必需）。
- TC03 可执行（READY 后）：版本7 sweep 精确入口 + reviewer-3 两端落地/返回/双击/8 负例（适用源码未变时引用）+ Cookie 名称补采；注册写入仍属 R1-002，不执行。
- 缺项与最小 owner 动作：
  - A（content owner）：提供隔离合法空发布事实（或授权可逆的临时下线方案），不清共享库、不新增 migration；否则 TC01 空态分支保持 BLOCKED。
  - B（content/commerce/Gateway owner）：确认自有实例停启可否作为断连来源；若否，提供隔离故障注入开关或等效只读断连手段。
  - C（主审）：签 READY 后再运行真实终验；终验输出 delivery-7 REVIEW。

## 5. 状态与停止条件

- 本报告为解阻准备，不登记 start，不提交 delivery-7，不作产品完成声明；状态保持 BLOCKED revision 20。
- 保留共享 dirty 及 delivery-1~6、reviewer-1~6；不清库、不改端口、不进 R1-002；自有临时进程零启动，无需停止。
- 新文件哈希：sweep-7 / negative-sweep-7 / negative-7.json / real-upstream-7.cjs / safe-runtime-7.md / 本报告，见 `commands-7.log`。
