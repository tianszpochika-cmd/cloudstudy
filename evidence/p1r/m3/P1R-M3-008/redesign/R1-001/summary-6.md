# R1-001 交付摘要 delivery-6（第六轮验收收尾：版本6采集器 + 运行环境证明 + 真实成功态链）

- 卡号：R1-001（BC-001/IC-001，owner official-site，P1R 主父 P1R-M3-008）
- 状态流：REWORK revision 17（reviewer-5 reject-5）→ IN_PROGRESS revision 18（start-rework-5.json 已在墙内）→ 本次 delivery-6 REVIEW。
- 契约动作：consume（未改正式契约；B9 两公开 GET + B13 公开价格 GET 仅消费；`packages/contracts/generated/**` 未手改）。
- 允许范围：本卡 24 文件；F12 已通过不再改造业务代码；历史交付/主审证据/共享配置/凭据未覆盖修改。

## 一、版本6采集器（F11 整改）

- 新建：`work/r1-001-sweep-6.cjs`（不覆盖 sweep-5）——真实 `response.status()`；h1 visible + CTA attached；**严格路径**：Web `pathname === /register`（且无 hash），mobile `pathname === /` 且 hash 路由 `=== /pages/register/register`；query 逐项独立比较（mobile returnTo/locale/theme 取 hash query）；禁止 `includes/startsWith` 放宽；Console-clean 逐视口；失败 `exit 1`。
- 同入口负例：`work/negative-sweep-6.cjs` 直接 `require` 同一 `checkHrefStrict/expectedEntry`，覆盖合法 web/mobile、非 200、缺 CTA、错 origin、错 web path、query 藏路径、错 mobile path、错设备共 10 项，全部符合预期（`work/negative-6/negative-6.json`，MOCKED 标记：仅证明采集器，不作产品验收）。
- 旧探针 3 误过在本轮复验：`wrong-web-path`、`path-only-in-query`、`wrong-mobile-path` 均被拒（pathname/hashRoute 严格不等）；`wrong-origin`、`wrong-device`、`missing-cta`、`non-200` 同样被拒。
- 本轮实测：46/46 PASS（22 http + 22 CTA/布局 + 2 Console），exit 0；输出 `work/r1-001-sweep-6/r1-001-sweep-6.json` + 2 截图。
- 浏览器覆盖统计纠正：sweep-6 输出为 46 项检查（非“浏览器覆盖 XX 页”口径）；website-runtime 全套仍未跑，映射见下。

## 二、运行环境证明（F14，不改后台实现）

- 工具链：Node v20.19.5；Java `openjdk 25.0.4.1 LTS`；Maven（`mvn -version` 首行为 WARNING 噪声，版本行待补采，见缺口）。
- 固定端口：除 `18081 ai-orchestrator`（他组占用）外其余 FREE；六端口 TCP 直连 CLOSED（停机后状态）。
- 自有实例（已停止，仅读公开 GET，未清库）：content-service PID 36212（`content-service-0.1.0-SNAPSHOT.jar`，18089）、commerce-service PID 39084（`commerce-service-0.1.0-SNAPSHOT.jar`，18096）、api-gateway PID 30312（`api-gateway-0.1.0-SNAPSHOT.jar`，18070）。
- 有效配置（无秘密）：profile `v2,local-real`；content schema `content_service`/jdbc 用户 `svc_content`、commerce `commerce_service`/`svc_commerce`（b17 清单）；`SPRING_FLYWAY_ENABLED=false`（迁移由 reconcile 脚本预应用）；content relay/consumer 默认关闭、runner 显式置 `true`（`run-v2-services.mjs:193-203`）；commerce 无 relay/consumer/schedule 写路径；Kafka 仅 `127.0.0.1:19092` 回环。
- 更正：自有进程 ≠ 数据隔离；本次仅发公开 GET，未验证 DB 写入有无；`delivery-5 environment.schemas=[]` 属报告缺口，本轮以本节为准。

## 三、真实 TC01（成功态链 + 空态缺口）

- 同轮固定：Gateway 200（7 课程，`projectionVersion=4, contentEpoch=4, generatedAt=2026-09-27T17:05:36Z`，requestId/traceId 均 present）→ commerce 200（`plans=0, catalogVersion=commerce-public-v1, productionPaymentEnabled=false`）→ BFF 200（`ready/gateway`，courses 7 ID 逐一对应，pricing facet `ready` + plans/skus=0）。
- 双视口 DOM：courses 7 卡、无“内容准备中”；pricing 无价格卡、无 checkout/payment/order 链接、无购买按钮、有权威空说明；Console-clean。6/6 PASS（`work/real-upstream-6/`，脚本/输入/日志/截图已固定）。
- 空态缺口（P1/blocking）：当前上游为 7 DEMO 非空，合法空课程事实缺失——“内容准备中”真实渲染未验证；需 content owner 提供隔离空发布事实（不清共享库、不新增 migration）。

## 四、真实 TC02（503→恢复→点击重试缺口）

- 现状：BFF 真实链 `ready` 已通；BFF 单测 F10/F12（含 failed 第三步 error/DEGRADED）通过；模拟恢复链仅标 MOCKED。
- 缺口（P1/blocking）：真实 503 需 content/commerce/Gateway owner 提供隔离实例级故障注入开关；本卡不写后台代码、不改路由安全。已核实：Gateway 对上游断连的映射需 owner 确认实际状态码（若为 503 则仅停/启自己已记录 PID 的上游并恢复；其它状态如实记录，不冒充）。

## 五、安全与证据收尾（TC03 + 覆盖统计）

- reviewer-3 注册证据复用（适用源码未变：`SiteStartButton.vue 2281c5e6…`、`useOfficialSiteLinks.ts 455b02ef…`、`public-links.mjs 94abc4fd…` 均与 delivery-5 快照一致）：两端落地/返回/双击/8 负例（`register-navigation.json`、`negative-entry-browser.json`、`desktop-rapid.json`，哈希见 commands-6.log）。
- 本卡补：官网业务会话隔离检查——sweep-6 双视口业务 Cookie 检查（`refresh|session|token|auth` 名称匹配）0 命中；官网不保存业务 Token（AGENTS §2.2），localStorage/sessionStorage 键值读取未执行，记 PARTIAL。本卡不做 R1-002 注册写入。
- 浏览器覆盖统计纠正：sweep-6 为 46 项检查（22 http + 22 CTA/布局 + 2 Console）；website-runtime 11 项映射——适用 2（布局无溢出、pricing-download 独立页）、PARTIAL 3（导航示例/主题持久化/投影重试：主题维度与真实重试点击未执行）、不适用 6；全套未跑保持阻塞，不以 DONE 当 PASS。

## 六、每项检查（实际命令/退出码，详见 commands-6.log）

- 四套件 38/38 exit 0；BFF 21/21。
- `pnpm --dir apps/official-site build`：Build complete。
- sweep-6：46/46 exit 0；negative-6：10/10 exit 0（MOCKED）。
- 真实上游：services:run 三 healthy；直连/Gateway/commerce/BFF/双视口成功态 6/6；六端口停止后 CLOSED。
- 进程：全部自有临时进程已停；当前无运行任务。

## 七、TC 结论与剩余阻塞

| TC | 结论 | 证据 |
|---|---|---|
| TC01 | PARTIAL/BLOCKED | sweep-6 精确 CTA + 真实成功态 7 卡链 + error 截图/DOM；缺合法空事实的“内容准备中”真实渲染与注册点击落地终验 |
| TC02 | PARTIAL/BLOCKED | BFF F10/F12 单测 + 模拟链；缺真实 503→恢复→点击重试（需 owner 开关） |
| TC03 | PARTIAL/BLOCKED | 同模块负例 + sweep-6 精确入口 + reviewer-3 两端证据引用 + Cookie 名称检查；缺完整安全复核、回跳会话隔离终验与稳定快速点击录制 |
| website-runtime | 映射交付：2 适用 PASS，3 PARTIAL，6 不适用；全套未跑阻塞 | 见 §一/§五 |

- P1/blocking：合法空发布事实、503 注入开关、空态/重试点击终验、会话隔离终验、website 全套、Maven 版本行补采。
- HEAD `3d11be33` 未变；24 artifacts 以提交快照为准；回退仅撤销本卡差量（reviewer-3 已验证 24/24 + 旧 BFF 12/12）；保留 delivery-1~5 与 reviewer-1~5。
