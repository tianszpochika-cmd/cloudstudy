# R1-001 交付摘要 delivery-5（第五轮：F12 失败原因保留 + F11 版本5采集器 + 真实上游成功态）

- 卡号：R1-001（BC-001/IC-001，owner official-site，P1R 主父 P1R-M3-008）
- 状态流：REWORK revision 14（reviewer-4 reject-4）→ IN_PROGRESS revision 15（start-rework-4.json）→ 本次 delivery-5 REVIEW。
- 契约动作：consume（未改正式契约；B9 两公开 GET + B13 公开价格 GET 仅消费；`packages/contracts/generated/**` 未手改）。
- 允许范围：本卡 24 文件；历史交付/主审证据/共享配置/凭据未覆盖修改；F10 结果保持。

## 一、F12 处理结果

- 文件：`apps/official-site/server/api/public-projection.get.ts`（outage 缓存回填段约 251~275 行）、`apps/official-site/tests/public-projection-bff.test.mjs`（failed 序列第三步断言）。
- 修复：outage 回填时，已知 `error/permission/maintenance` facet 原样保留状态及原因（含 pricing→`error/PUBLIC_COMMERCE_DEGRADED`，`commerceState/commerceErrorCode` 同步）；仅此前成功取得的可读缓存标记 `recovery/stale`。无旧 SKU 复活、60 秒 TTL 不延长、权限作废/并发/locale 隔离不变。
- 验证：BFF 21/21；failed 序列第三步新增 `pricing=error/PUBLIC_COMMERCE_DEGRADED` + `commerceState/commerceErrorCode=error/DEGRADED` 断言；empty/changed/过期/并发负例复跑通过。

## 二、F11 处理结果

- 新采集器：`work/r1-001-sweep-5.cjs`（不覆盖旧 sweep-4）——真实 `response.status()`、h1 visible + 预期设备 CTA attached（mobile SSR 首屏 hidden 属实现语义，如实记录 visibleCount，不以 visible 为门）、origin/port/path/returnTo/locale/theme 精确断言（mobile returnTo 取 hash query）、Console-clean 逐视口、失败 `exit 1`。
- 同入口负例：`work/negative-sweep-5.cjs` 以不可达 origin 跑同一采集器，实测非零退出（collector-exit=1）+ wrong-origin 断言通过。
- 本轮实测：46/46 PASS（22 http + 22 CTA/布局 + 2 Console），exit 0；`r1-001-sweep-5.json` 固定脚本/输入/日志/哈希。
- 数量纠正：当前四套件 **38/38**（BFF 21 + 其余 17）；HEAD 旧 BFF 12/12（reviewer-3 `rollback-old-bff.log`，引用不重跑）。
- website-runtime 映射：11 项中 4 适用由本采集器/BFF/tc1 覆盖（布局无溢出、投影重试、pricing-download 独立页），`mobile navigation/sample entry` 与 `theme persistence` 记 PARTIAL（主题维度未执行），其余 5 不适用；全套未跑保持阻塞，不以 DONE 当 PASS。
- 未实际点击的重试、未检查的主题维度：记 PARTIAL/未执行，未写 PASS；必测项无“不适用”。

## 三、真实公开上游环境准备

- 工具链：Java 25.0.4.1（Microsoft LTS）+ Maven 3.9.9；infra 容器（mysql/redis/kafka/rabbitmq/minio）UP；jar 均存在（content/commerce/gateway）+ `secrets/iam-rsa-private.pem`。
- 启动：`pnpm services:run -- --service content-service,commerce-service,api-gateway --timeout-ms 180000`，三服务 healthy（content 18089 / commerce 18096 / gateway 18070），读现有 DB/Kafka，未清库。
- 真实读回：content 直连与 Gateway 路由均 200，5 DEMO 课程（`projectionVersion=4, contentEpoch=4`）；commerce `plans=[]`（权威空目录，`productionPaymentEnabled=false`）。
- BFF 真实链：`ready`，courses=7（DEMO 全量），pricing=0，facets courses/pricing/download=ready、announcements/compliance=empty，`generatedAt=2026-09-27`。
- 成功态渲染：双视口 courses-success（7 卡、无“内容准备中”、无购买）+ pricing-empty-honest + Console-clean，6/6 PASS（`work/real-upstream-5/`，含截图）。
- 注册入口：reviewer-3 两端落地/返回/双击/8 负例引用（适用源码未变）；本轮 learner-web `/register` 独立启动 200 确认、mobile H5 根 200 + 注册路由登记确认；均已停止，未提交注册。
- 缺项（P1/blocking=true，owner 明确）：503 故障注入需 content/commerce/Gateway owner 提供隔离实例级开关（本卡不写后台代码、不改路由安全）；空目录“内容准备中”真实渲染需合法空发布事实（当前为 DEMO 非空）；完整 website 全套、注册回跳会话隔离仍待主审终验。

## 四、每项检查（实际命令/退出码，详见 commands-5.log）

- 四套件 38/38 exit 0；BFF 21/21 含 F12 第三步断言。
- `pnpm --dir apps/official-site build`：Build complete。
- sweep-5：46/46 exit 0；negative-sweep-5：collector exit 1（预期）→ 总 exit 0；negative-control-4：exit 1（预期）。
- 真实上游：services:run 三 healthy；直连/Gateway/commerce/BFF/双视口成功态 6/6；learner-web/mobile 独立检查 200。
- 进程：services job（pwsh-13）、官网 dev（pwsh-12/14）、learner-web（pwsh-10）、mobile（pwsh-11）全部已停；六端口 CLOSED/FREE。

## 五、TC 结论

| TC | 结论 | 证据 |
|---|---|---|
| TC01 | PARTIAL/BLOCKED | sweep-5（22 页真实 200 + 精确 CTA + 布局 + Console）+ 真实成功态 7 卡双视口 + error 截图/DOM；缺空态真实渲染与注册点击落地终验 |
| TC02 | PARTIAL/BLOCKED（F10/F12 单测 PASS） | BFF 21/21 + 模拟恢复链；缺真实 503→恢复→重试（需 owner 故障注入开关） |
| TC03 | PARTIAL/BLOCKED | builder 负例 + sweep-5 精确入口 + reviewer-3 两端落地/返回/双击/8 负例引用；缺完整安全复核与注册回跳会话隔离终验 |
| website-runtime | 映射交付：4 适用 PASS（本轮覆盖），2 PARTIAL（主题/示例维度），5 不适用；全套未跑阻塞 | 见 §二映射表 |

## 六、哈希与回退

- HEAD `3d11be33` 未变；delivery-5 dirty 见收据；24 artifacts 以提交快照为准。
- 回退：仅撤销本卡 `apps/official-site` + `packages/i18n/src/official-site.ts` 差量（reviewer-3 已在隔离目录验证 24/24 恢复 + 旧 BFF 12/12）；保留 delivery-1/2/3/4 与 reviewer-1/2/3/4；不删证据、不覆盖共享改动、不动 DB/服务/端口。
