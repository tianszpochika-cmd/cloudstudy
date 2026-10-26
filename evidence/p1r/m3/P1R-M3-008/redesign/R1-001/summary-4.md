# R1-001 交付摘要 delivery-4（第四轮：F10 缓存连续状态 + F11 采集口径 + 真实上游核对）

- 卡号：R1-001（BC-001/IC-001，owner official-site，P1R 主父 P1R-M3-008）
- 状态流：REWORK revision 11（reviewer-3 reject-3）→ IN_PROGRESS revision 12（start-rework-3.json）→ 本次 delivery-4 REVIEW。
- 契约动作：consume（未改正式契约；B9 两公开 GET + B13 公开价格 GET 仅消费；`packages/contracts/generated/**` 未手改）。
- 允许范围：本卡 24 文件；历史交付/主审证据/共享配置/凭据均未覆盖修改。

## 一、F10 处理结果

- 文件：`apps/official-site/server/api/public-projection.get.ts`（recovery 缓存更新段）、`apps/official-site/tests/public-projection-bff.test.mjs`（连续测试）。
- 修复：recovery 响应携带权威内容+commerce 事实时，用当前结果刷新 `lastGoodProjectionByLocale` 但保留原 `fetchedAt`——随后网络故障只能读到已清空/替换的事实，不能复活旧 SKU；recovery 永不刷新 60 秒 TTL；无前置缓存时不从 recovery 新建缓存；`permission/error/maintenance` 作废路径不变；locale 隔离、过期、并发撤回规则不变。
- 连续过程覆盖：ready（旧 withdrawn）→ recovery × {commerce 权威空 / 新套餐替换 / 503 失败} → outage，随后断言旧 SKU 不复活且与第二步一致；超 60 秒 TTL 后 outage 回 error；并发旧响应晚到不回填。
- 验证：BFF 21/21（含新 3 项）；reviewer-3 `cache-probe.mjs` 三序列在新实现下第二步事实已更新、第三步不再出现 withdrawn（以本次 `dbg-f10` 输出为准；旧 `cache-and-http.json` 为缺陷复现记录，保留不改）。

## 二、F11 处理结果

- 新建版本化采集器：`evidence/.../work/r1-001-sweep-4.cjs`（替代旧 `tc3-sweep.cjs` 口径，不覆盖旧脚本）。
  - HTTP 状态取自 `response.status()` 真实响应；
  - 每页等待 `h1 attached` + 2 秒 hydration，再读 CTA/布局；
  - 对 11 页 × 双视口的 http/CTA（数量>0、全部含 /register、target 仅 web|mobile）/无溢出逐项 `assert`；
  - Console error 非空即该视口失败；任一失败 `process.exit(1)`；
  - 受控失败脚本 `work/negative-control-4.cjs` 验证缺失 CTA 时退出 1（本次实测 exit=1，输出 CONTROLLED-FAIL-OK）。
- 本轮数量纠正：当前四套件 **38/38**（BFF 21 + 其余 17）；HEAD 旧 BFF（delivery-1 时点回退验证）为 **12/12**；此前 summary-3 的“32/32”与“旧 BFF 18”均为当时快照数，以本次原始日志为准。
- 原始日志：四套件输出、`r1-001-sweep-4.json`（46/46 checks）、`build` 输出，起止时间与退出码见 `commands-4.log`。
- website-runtime.cjs 映射：11 项 check 中本卡适用 4 项（R1-001 页面/CTA/投影重试/pricing-download 独立页）；其余 7 项为 method/help/world/start、动效/主题/性能等非本卡范围，记不适用并说明理由，不以 DONE 当 PASS。

## 三、任务三真实上游核对

- 端口实测（TCP 直连 + `check-fixed-ports`）：18070/18089/18096/18182/18180/18183 全部 CLOSED/FREE，无监听实例。
- Gateway 路由存在（`GatewayRouteExecutionPolicy` 含两条公开路由），content `GET /api/v1/public/site/projection` 与 commerce `GET /internal/v1/commerce/public/catalog` 实现存在，但无运行进程可联调。
- learner-web `/register`：独立启动 18180 后 HTTP 200（599 字节，含注册标记），仅检查路由可达，未提交注册。
- mobile H5：独立启动 18183 后根 200（462 字节）；`pages/register/register` 路由登记存在（`pages.json:158` + `navigation.ts:13`），H5 按需编译未在本次单独打开注册页 deep-link。
- 缺项（P1/blocking=true，owner 明确）：需要 content-service（18089）+ commerce-service（18096）+ api-gateway（18070）的只读验收实例（合法发布事实 + 空数据输入 + 503 注入能力），由 content/commerce/Gateway owner 按固定端口提供；官网 18182 与 18180/18183 前端已可独立启动。未用 core-api 旁路、未用 mock 冒充联调、未清库、未重启共享服务。

## 四、每项检查（实际命令/时间/退出码，详见 commands-4.log）

- 四套件 38/38，退出 0；BFF 21/21 含 F10 新 3 项。
- `pnpm --dir apps/official-site build`：Build complete（第三方 DeprecationWarning 外无 error）。
- `r1-001-sweep-4.cjs`：46/46 PASS，退出 0（22 页 http 200 + 22 页 CTA/布局 + 2 视口 Console-clean）。
- `negative-control-4.cjs`：退出 1（受控失败有效）。
- learner-web/mobile 独立启动检查：200 确认；进程已停。
- reviewer-3 引用证据：注册落地/返回/双击/恶意导航（`register-navigation.json` 等）、隔离回退（`rollback-result.json` + `rollback-old-bff.log` 12/12）注明适用源码版本引用，未修改。

## 五、TC 结论

| TC | 结论 | 证据 |
|---|---|---|
| TC01 | PARTIAL/BLOCKED | 22 页真实 200 + CTA + 布局 + Console（`r1-001-sweep-4.json`）；error 截图/DOM（`work/tc1/`）；空“内容准备中”分支经单测；缺成功/空态真实渲染与注册点击落地（reviewer-3 已补落地，完整会话隔离仍待验） |
| TC02 | PARTIAL/BLOCKED（F10 新语义单测 PASS） | BFF 21/21 + 模拟恢复链；缺真实 Gateway 503→恢复→重试 |
| TC03 | PARTIAL/BLOCKED | builder 负例 + 新 sweep DOM 入口 + reviewer-3 两端落地/返回/双击/8 负例引用；缺完整安全/浏览器断言复核与真实注册回跳会话隔离 |
| website-runtime | 明确映射：4 适用 PASS（本次 sweep/单测覆盖），7 不适用（非本卡范围），全套未跑保持阻塞 | 见 summary-4 §二映射表 |

## 六、剩余阻塞与哈希

- P1/blocking=true：真实公开上游三实例缺失；成功/空态真实渲染；真实 503→恢复；注册回跳会话隔离；website-runtime 全套。
- 源码：HEAD `3d11be33` 未变；delivery-4 dirty 见收据；24 artifacts 以提交快照为准；`git diff` 另含他人/历史规划 dirty，本卡以收据为准。
- 回退：仅撤销本卡 `apps/official-site` + `packages/i18n/src/official-site.ts` 差量（reviewer-3 已在隔离目录验证 24/24 恢复 + 旧 BFF 12/12）；共享树不实际回退。

## 七、website-runtime.cjs 逐项映射（11 项）

| # | 检查 | 本卡 | 本轮 |
|---|---|---|---|
| 1 | desktop homepage and modal word practice | 不适用（示例互动，非 11 页公开投影/CTA） | 未跑 |
| 2 | course search, clear and route navigation | 不适用（筛选交互，非本卡验收） | 未跑 |
| 3 | help search and FAQ expansion | 不适用 | 未跑 |
| 4 | world room/2D-3D/role wall/sentence rounds | 不适用（R2 世界） | 未跑 |
| 5 | theme persistence/high contrast/quality | 不适用（M8 主题/性能） | 未跑 |
| 6 | mobile navigation/availability/sample entry | 部分适用（导航提及） | 未跑全套；导航 CTA 由 sweep 覆盖 |
| 7 | reduced motion | 不适用 | 未跑 |
| 8 | multi-route × viewport/theme layout | 适用（可达性侧影） | sweep 22 页无溢出覆盖 |
| 9 | public projection source + retry | 适用 | BFF + sweep + tc1 error 覆盖 |
| 10 | pricing/download independent + CTA | 适用 | sweep 逐页断言覆盖 |
| 11 | system theme/motion retired pref | 不适用 | 未跑 |
