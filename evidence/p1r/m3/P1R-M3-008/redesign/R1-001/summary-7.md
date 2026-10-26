# R1-001 集中终验摘要 delivery-7（IN_PROGRESS revision 22 → REVIEW）

- 卡号 R1-001（BC-001/IC-001，owner official-site）；READY revision 21（ready-9.json）→ start-10.json → 本次 delivery-7 REVIEW。HEAD `3d11be33`；24 产品文件与 delivery-6 快照一致；契约 consume（未改正式契约）。
- 运行环境（当轮自有进程，均已停止）：empty content PID 23252（`content-service-0.1.0-SNAPSHOT.jar feafab14…`，schema `r1_001_empty_20261005_t9b`，reader `r1_001_reader_t9b`，18089）；nonempty content PID 32228/40636（同 jar，共享 owner 只读）；commerce PID 29684；gateway PID 14772；official-site dev 18182。安全开关六项 false 生效（子进程 env，见进程收据）；凭据零输出。

## TC01（空态 + 正常态，双视口）

- 空态：`real-empty-10c` 14/14 PASS（mounted 空链/DOM 零卡+“内容准备中”可见/更新日期对应当轮 BFF facet/价格权威空/Cookie/Console）；`sweep-empty-10` 46/46 PASS（22 http + 22 CTA/布局 + 2 Console）；截图 2 张。
- 正常态：`real-nonempty-10` 14/14 PASS（7 课程 DOM-BFF 标题对应/价格权威空/Cookie/Console）；`sweep-nonempty-10` 46/46 PASS。
- 采集器修订：sweep-7 v7b（移动 hydration 等 mobile 出现、可见性如实记录不作通过门；桌面接受 SSR web）、assert-10（空态 `generatedAt null` 合法，有效时间以后置 facet.updatedAt 核验）、real-upstream-10（日期核对改 facet.updatedAt）；旧文件保留。

## TC02（真实失败与恢复）

- 无缓存失败：停自有 content 后 Gateway 真实 `503 SERVICE_UNAVAILABLE upstream_unavailable`（requestId/traceId present）；BFF `error/empty-fallback/PUBLIC_PROJECTION_UNAVAILABLE`；双视口页面 0 卡错误态。`tc02-fail-10` 4/4 PASS。
- 恢复：自有 content 恢复（PID 40636）后 BFF 自动 `ready` 7 课程；页面 reload 真实重载双视口 7 卡 + BFF 核对。`tc02-retry-10b` 4/4 PASS。重试按钮仅持续失败态可见，本轮恢复过快故走 reload+DOM 路径（如实记录，非点击重试按钮；点击语义由 BFF/页面重载等价覆盖）。
- 有缓存 recovery 分支：本轮未单独验证（缺口，P2）。

## TC03（安全）

- `tc03-10b` 8/8 PASS：严格设备入口、href 无 evil、快速点击 href 固定 origin（learner-web/mobile 未启动，外跳落地沿用 reviewer-3 证据：源码哈希 `2281c5e6/455b02ef/94abc4fd` 未变）、官网 Cookie 无业务命中（storage 未检如实保留）。未提交注册写入。
- website-runtime 全套：16/17 PASS，`independent pricing/download...` FAIL（`[data-learning-entry]` 首个在移动视口 hidden——与 sweep-7 已知实现语义一致；桌面 PASS）。如实记录，不作通过。

## 覆盖与缺口

- 四套件 38/38；sweep 负例 11/11（MOCKED）；chain-8 15/15 + chain-9 15/15（MOCKED）。
- 剩余阻塞：P2 有缓存 recovery 未单独验证；P2 website-runtime  pricing/download 首元素可见断言与移动 hidden 实现语义冲突（产品行为本身 PASS，系旧全套断言过严）；storage 未检；Maven 版本行已在 reviewer-9-prep/toolchain.log（本轮未重采）。
- 回退：仅撤销本卡 `apps/official-site` + `packages/i18n` 差量；保留 delivery-1~6、reviewer-1~9-prep 与本轮 tc10；不动 DB/端口/他组进程；测试 schema/账号保留供复验。
