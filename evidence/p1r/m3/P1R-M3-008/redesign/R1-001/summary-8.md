# R1-001 第七次交付后限定整改摘要 delivery-8（IN_PROGRESS revision 25 → REVIEW）

- 卡号 R1-001；REWORK revision 24（reject-7：F15/F16 P1 + F17/F18 P2）→ start-11.json → 本次 delivery-8 REVIEW。HEAD `3d11be33`；24 产品文件仅新增 website-runtime.cjs F17 定位修复一行（其余 23 与 delivery-6/7 一致）；契约 consume。
- 运行环境（当轮自有进程，均已停止）：empty content PID 25720（`content-service-0.1.0-SNAPSHOT.jar feafab14…`，`r1_001_empty_20261005_t9b`/`r1_001_reader_t9b`）；restore content PID 15540/27956（同 jar，共享 owner 只读）；commerce 11824；gateway 26232；site dev。安全开关六项 false；凭据零输出；六端口 CLOSED；java 零残留。

## F15 / P1：可操作门恢复（任务1）

- 新建 `work/r1-001-sweep-11.cjs`（不改 7/10 版）：同一 `checkHrefStrict` 严格语义；`collectFromPage` 恢复 operable 门（`operable=0` 必 FAIL）；移动端常驻入口不可见时真实打开折叠菜单（`header button.menu-toggle` → `dialog[open]`），再验证菜单内入口可见、可操作、精确路径/参数与点击 origin。
- 同模块负例 `work/negative-sweep-11.cjs`：13/13 PASS（MOCKED）——全隐藏/全禁用（菜单仍无可操作项）失败、`menu-opens-operable-pass` 通过；`hidden-mobile-recorded` 旧弱化项已删除。
- 真实双视口 `tc11/sweep-empty-11`：46/46 PASS；7 个移动问题页全部 `menuOpened:true, operable:1, visibleCount:1`（download/announcements/compliance/status/privacy/terms/minors）；课程区域 + 菜单截图已归档。
- 产品缺陷定位：移动端 header CTA 按 CSS（`main.css:2596-2600`，690px 断点 `display:none`）隐藏，菜单内 `.mobile-nav-bottom .btn` 为真实可操作路径；无需修改产品页面。

## F16 / P1：同一失败页点击重试（任务2）

- 新建 `tc02-11session-v2.cjs`：同一页面+同一上下文完成 失败→恢复→点击→响应→DOM；禁止 reload/goto/load/独立 BFF 预触发。
- 无缓存 error：375x812 `gateway 503 → bff error/empty-fallback → page-error-hard（0 卡+可见错误说明+可用重试）→ restore 15540 healthy → 点击 BFF 200 ready → DOM 7 卡+日期 → Console clean`，7/7 PASS。
- 有缓存 recovery：1440x900 同一会话内自然进入 `recovery/memory-cache`（旧事实 7 卡 + “正在恢复”说明 + 可用重试）→ restore 27956 → 点击 BFF 200 → DOM 恢复，7/7 PASS。双场景区域截图（fail/recovered）已归档。
- 初版 v1 单脚本跨视口复用恢复进程导致第二视口预恢复（失败如实记录，已废弃）；v2 每视口独立恢复→点击→清理。

## F17 / P2：套件定位修复与完整报告（任务3a）

- `apps/official-site/tests/browser/website-runtime.cjs:328-341`：按当前视口找可操作入口（≤690px 用 mobile，必要时开菜单），替代首元素可见断言；产品页无需改动。
- `OFFICIAL_SITE_EVIDENCE_DIR=work/tc11/website-11` 完整跑到底：**11 checks / 152 layouts / 0 errors / exit 0**（`browser-checks.json` + stdout/stderr 原始归档）。旧 16/17 口径作废，检查项/布局采样/未执行项已分开。

## F18 / P2：TC03 与视觉证据（任务3b）

- reviewer-3 复用核验：`register-navigation d5cc9288…`、`negative-entry-browser 20cd7561…`、`desktop-rapid 02fb3dc2…`、`negative-entry-recheck 864570c8…`；相关源码当前哈希 `SiteStartButton 2281c5e6…`、`useOfficialSiteLinks 455b02ef…`、`public-links 94abc4fd…`、`useLearningDevice 16f80eed…`——与 reviewer-3/hashes.json 基线一致（`public-projection.get.ts`/`bff.test` 后续 F12 修不在注册路径）。适用环境：本轮同端口/同 UI（18182/18180/18183）；恶意参数 8 例、落地/返回、双视口双击均可精确复用。
- 新证据 `tc11/tc03-11` 10/10 PASS：无 evil 反射、CTA href 固定（含菜单路径 mobile）、真实 dblclick（目标未启动，仅 href 限定，不断言落地）、Cookie 无业务命中。
- storage 白名单：双视口 `localStorage+sessionStorage` 均为 0 键（unknown 0）；仅输出名称/分类/计数（本轮为空），不输出值；历史 `storageChecked:false` 口径保留为“键级已检、值未读”。
- 截图映射：课程区域（空说明/失败按钮/恢复课程）+ 价格空说明 + 菜单入口分别归档，不用顶部介绍区证明状态。

## 缺口与交付

- knownGaps：无 P0/P1/P2 未关闭（website/storage/recovery 均已实测；剩余仅说明性备注）。
- 回退：仅撤销本卡差量（含套件定位修复）；保留 delivery-1~7、reviewer-1~10 与 tc10/tc11；不动 DB/端口/他组进程；测试 schema/账号保留供复验。
