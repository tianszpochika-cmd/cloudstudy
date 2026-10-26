# R1-001 解阻准备包收尾（BLOCKED revision 20，不 start、不交 delivery-7、不自标 READY）

> 基线 `[读取]`：`reviewer-7-prep/review.md`（仍 BLOCKED revision 20，submission 仍 delivery-6；版本7设备/可见性/HTTP/严格路径已通过；三项准备修正 + 唯一业务输入缺口）。
> 状态 `[实测]`：revision 20 / BLOCKED / executor `Muse Spark`；HEAD `3d11be33`；六端口 CLOSED；java 零残留；本阶段零后台启动。
> 版本7已通过断言保留：视口定设备、可见可操作入口、HTTP 同模块、严格路径——本组未改 `r1-001-sweep-7.cjs` / `negative-sweep-7.cjs` 断言语义。

## 1. Cookie 验收修正

- `work/real-upstream-7.cjs` 的 `cookie-names`（固定 true）改为 `cookie-no-business`：`assertNoBusinessCookies` 命中业务模式即抛错判失败；仅记录官网相关名称（allowlist `yx.public.locale|theme`）与数量，不输出值；`storageChecked: false` 如实注明 storage 未检查。
- 官网 Cookie 基线 `[读取]`（`app.vue:12-13`）：仅 `yx.public.locale` / `yx.public.theme`；业务 Token 在 learner-web 内存（`access-token.ts`），官网不存业务 Token。
- 负例（MOCKED，同模块）：`negative-chain-8` 含 `cookie-clean-pass`（通过）、`cookie-business-fail`（session-id 失败）、`cookie-token-fail`（auth-token 失败）——“无命中通过、有命中失败”已覆盖 `[实测]` 15/15 全过。

## 2. 真实链硬断言

- 新模块 `work/real-chain-assert-8.cjs`（真实采集与负例共用）：`assertChainFacts`（三路 200 + BFF `ready/gateway` + 课程 ID `deepEqual` + `generatedAt` 相等 + 0 计划/SKU；版本变动判快照不一致）、`assertCourseDomTitles`（当轮归档标题集合逐项相等）、`assertPricingEmptyVisible`（0 价格卡/购买链接/按钮 + 价格区域可见空说明 + recovery/error 计数 0 + facet 合法空且 `!stale && !errorCode`）、`assertNoBusinessCookies`。
- `real-upstream-7.cjs` 已接入：当轮归档 `log.bffTitles`（不再另起未归档 fetch）；`chain facts-linked` 硬断言；DOM 对照走归档集合；价格空说明限定 pricing 区域（`main/.page-body/body` 内 `isVisible()`），`facet-recovery` + `facet-error/[data-facet-state=error]` 双排除。
- 负例 `[实测]`：`negative-chain-8.json` 15 项（非200×2、错误ID、错误时间、错误state、DOM 失配、缺空说明、recovery/error 冒充、Cookie 命中×2）全部符合预期。
- 新文件一律 `-8` 后缀；`real-upstream-6.cjs`、sweep-6/7 采集器与已固定 JSON 均未覆盖。

## 3. 可执行 Windows 安全启动配置

- 新脚本 `work/r1-001-safe-run-8.cjs`：`--validate` 仅校验不启动 `[实测]` PASS；READY 后透传参数给 `run-v2-services.mjs`，**仅对子进程**注入六项 false（relay/consumer/schedule/content-Flyway/commerce-Flyway/SPRING-Flyway），调用方环境不受影响；不改共享启动器默认值；不输出凭据。
- 输出 `work/safe-run-8/safe-run-8.json`：六项安全环境、固定六端口、content/commerce/gateway 三 jar 身份（名/字节/mtime/sha256）；effective 核验方法：READY 后子进程 `env | Select-String CONTENT_|COMMERCE_|SPRING_FLYWAY` 核对六项 false。
- jar 身份 `[实测]`：content `63760208B feafab14…`、commerce `41501716B 317af7b7…`、gateway `73129664B f1bb8088…`。

## 4. 合法空课程输入盘点

- 新文件 `work/empty-courses-input-8.md`：只读核查 6 项——公开投影取全部课程且 `uiLocale` 仅影响其它 facet（换语言不能造空）；合法空唯一来源是零已发布版本；现有 seed 均为共享 platform 写入型（不可用）；无预置隔离空 schema/快照；内存仓空断言不可复用为 DB 事实；migration 无空开关。
- 最小新建方案（待批，未执行）：同一事务内将 7 公开行的 `current_published_version_id` 置 NULL（可逆 UPDATE），前后 SELECT 核查，终验后回滚；不新增 migration、不改契约、不清库；替代方案为隔离实例零 seed 基线（需 owner 连接串）；两方案皆否则 TC01 空态分支保持 BLOCKED。

## 5. 状态

- 新增/修订：`real-chain-assert-8.cjs`、`negative-chain-8.cjs` + 输出、`real-upstream-7.cjs`（断言修订）、`r1-001-safe-run-8.cjs` + 输出、`empty-courses-input-8.md`、本包 + `commands-8.log`。旧证据全保留。
- 终验授权确认：停启当轮自己启动且身份核对过的实例属验收授权，不重复申请；不操作其它任务进程。
- 状态保持 **BLOCKED revision 20**；主审签 READY 后集中执行 TC01/02/03，输出 delivery-7 REVIEW。
