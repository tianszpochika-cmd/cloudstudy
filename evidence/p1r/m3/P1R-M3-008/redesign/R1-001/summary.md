# R1-001 交付摘要（delivery-2，REWORK 后整改，自测记录）

- 卡号：R1-001（BC-001/IC-001，owner official-site，P1R 主父 P1R-M3-008）
- 状态流：READY revision 5（rework 新准备，spec 57726738）→ IN_PROGRESS revision 6（执行人 Muse Spark）→ 本次提交 delivery-2 REVIEW；delivery-1 与 reviewer-1 证据保留，不覆盖。
- 契约动作：consume（未改正式契约；B9 两公开 GET + B13 公开价格 GET 仅消费；`packages/contracts/generated/**` 未手改）

## 1. 新旧对照与复用（F06 修正：实际差量以 delivery-2 artifacts 为准）

- 直接复用：`public-links.mjs` 白名单/`buildPublicLearningEntry`、`public-projection.get.ts` 的私有网关读取/401-410 作废/60s recovery/no-store 语义、`PublicStatus/PublicDocument` 组件、`nuxt.config.ts` 固定地址、`foundation/v2-foundation` locale-theme 基础、B13/B14 安全断言（open redirect、只读、无 Token）；`about/status/privacy/terms/minors` 五页本卡零 diff（仅复用现有模板）。
- 修改（F01~F05 整改后）：`public-projection.ts` 新增 `facets/commerceState/commerceErrorCode`，且全局 maintenance/permission/error 优先、commerce 只在内容投影可读时参与；`public-projection.get.ts` 把 commerce degraded 转为 pricing facet `error/PUBLIC_COMMERCE_DEGRADED`；`usePublicProjection.ts`（本次已获 24 文件范围授权）补齐初始 loading 与真实 throw 的完整响应形状；`pricing/download/courses/announcements` 在 recovery 带旧数据时保留列表并同时显示恢复说明、最后成功时间与重试入口，`courses/首页` 空态按 `ready/empty` 显示“内容准备中”；`SiteStartButton` 默认 `auto` 按 `useLearningDevice` 解析 web/mobile（SSR/hydration 同一 computed，`data-learning-entry="web|mobile"` + `data-device`），课程/价格出口同样设备对应；`useOfficialSiteLinks.ts` 新增 `registerLink(web|mobile)` 经 `buildPublicLearningEntry` 透传 uiLocale/theme、固定 returnTo；`site-content.mjs` 公开路由补 `/pricing/download`；`packages/i18n` 仅补课程空文案与 pricing/download/更新时间文案（其它公示空态不动）；5 个测试文件同步（BFF 新增 empty/global 优先级/recovery/真实 throw 负例，B13 新增 recovery 三页断言与移动入口断言）。
- 补开发：per-facet 状态模型、BFF commerce degraded 显式化、独立 pricing/download 页、受控注册 CTA（含移动）、课程“内容准备中”文案、recovery 提示。
- 迁移：无旧功能退役；旧 301 语义由本卡替换。

## 2. 五步骤产物（rework）

1. 步骤 1（输入记录）：rework READY 收据核对通过（spec 57726738、46 源文件无变化、22 证据无变化、7 台账行存在），`git rev-parse HEAD=3d11be33`，start-rework-1 已记录（revision 6）。本卡不写领域 DB、不改 IAM/Java DTO/Outbox。
2. 步骤 2（公开状态模型，F02/F05）：全局 maintenance/permission/error 优先于独立 commerce 成功；`usePublicProjection.ts` 初始 loading 与真实 throw 均为完整响应形状；BFF 单测新增三种全局×commerce 成功组合负例与真实 reject 用例。
3. 步骤 3（11 页模板与出口，F01/F03）：pricing/download 独立 200；11 页复用 PublicStatus/PublicDocument；课程及首页空态按 `ready/empty` 显示“内容准备中”；pricing/download/announcements/courses 在 recovery 带旧数据时保留列表并显示恢复说明、最后成功时间与重试入口；无真实方案不显示购买、无有效版本不假下载；公开路由同步。
4. 步骤 4（受控跳转，F04）：11 页共享 CTA 默认 `auto` 设备对应（桌面 SSR 为 web；移动断点 hydration 为 mobile），课程/价格出口同样设备对应；`data-learning-entry="web|mobile"` 无遗留无值标记；locale/theme 透传、returnTo 固定（web `/home`、H5 `/pages/home/home`）；/start 保持辅助示例页；官网无业务 Token。
5. 步骤 5（本交付）：提交 delivery-2 REVIEW，不自批；三个产品 TC 由主审独立复测；缺口按 F06 如实记阻塞。

## 3. 修改文件（delivery-2 artifacts 为准，均在 24 文件 rework 范围内）

- `apps/official-site/utils/public-projection.ts`
- `apps/official-site/composables/usePublicProjection.ts`
- `apps/official-site/server/api/public-projection.get.ts`
- `apps/official-site/pages/index.vue`
- `apps/official-site/pages/courses/index.vue`
- `apps/official-site/pages/pricing.vue`
- `apps/official-site/pages/download.vue`
- `apps/official-site/pages/announcements.vue`
- `apps/official-site/pages/compliance.vue`
- `apps/official-site/components/SiteStartButton.vue`
- `apps/official-site/composables/useOfficialSiteLinks.ts`
- `packages/i18n/src/official-site.ts`
- `apps/official-site/utils/site-content.mjs`
- `apps/official-site/tests/public-projection-bff.test.mjs`
- `apps/official-site/tests/b13-official-site.test.mjs`
- `apps/official-site/tests/b14-fe-005.test.mjs`
- `apps/official-site/tests/website-entry.test.mjs`
- `apps/official-site/tests/browser/website-runtime.cjs`
- 未改（零 diff 复用）：`about.vue/status.vue/privacy.vue/terms.vue/minors.vue`、`utils/public-links.mjs`。

## 4. 自测结果（rework 后最终源码）

- 单元/静态：`node --test <4 official files>` 32/32 PASS（BFF 15：含 empty/三种全局×commerce 成功/recovery/真实 throw；B13 含 recovery 三页与移动入口；sitemap；CTA）。
- 构建：`pnpm --dir apps/official-site build` Build complete（仅第三方 DeprecationWarning，无 Duplicate key、无 TS 错误）。
- 本地 dev（固定端口 18182，rework 后重验；进程已停）：
  - 11 页 sweep：全部 200。
  - CTA sweep：11 页 `data-learning-entry="web"`（桌面 SSR，2~5 个），无遗留无值标记；首 href 均为学习端 Web 注册 `returnTo=%2Fhome`。
  - 移动入口：`registerLink(mobile)` 输出 `http://127.0.0.1:18183/#/pages/register/register?...returnTo=%2Fpages%2Fhome%2Fhome` 且 locale/theme/utm 透传；`SiteStartButton auto` 经 `useLearningDevice` 在移动断点解析 mobile（SSR 首屏 web、hydration 一致）。
  - 语义探针：全空→courses empty；其它 facet 有数据时空课程仍 empty；maintenance/permission/error×commerce 成功→pricing 均为全局态；recovery 带旧数据 stale=true；composable 初始 loading 与真实 throw 均为完整形状。
  - 投影 API：无真实上游时 `/api/public-projection` 返回 `error/empty-fallback/PUBLIC_PROJECTION_UNAVAILABLE`，全 facet error。
  - TC03 自查：4 种恶意 returnTo→`/home`；重复点击同 href；首页 HTML 无业务 Token/认证存储痕迹。

## 5. 三个产品用例（自测，非审批结论；F06 修正：以下缺口均为阻塞，未验证≠通过）

- TC01 browser — BLOCKED（部分自测，非 PASS）：11 页 200 + CTA 设备对应 + 错误态诚实；但缺：375x812/1440x900 双视口空态“内容准备中”真实渲染截图与 Console、双视口成功态、真实注册点击回跳证据。
- TC02 integration — BLOCKED（部分自测，非 PASS）：BFF 单测覆盖 empty/全局优先级/commerce degraded/recovery/真实 throw + 本地 error 回退；但缺：真实上游 503→恢复的端到端重载证据（无真实 Gateway/内容/商业上游）。
- TC03 security — BLOCKED（部分自测，非 PASS）：单测 open redirect 负例 + 本地 4 用例净化 + 无 Token + 移动 builder 校验；但缺：真实浏览器（含移动视口）重复点击与返回流程录制。
- `website-runtime.cjs` 浏览器部分未在本机跑（需 Playwright/Chromium），由主审复跑。

## 6. 剩余问题与回退（F06 修正）

- 真实公开上游（Gateway 18070 + 内容/商业投影）缺失：TC01 成功/空态双视口、TC02 真实 503→恢复仍阻塞。
- 移动真机/移动浏览器点击：仅 builder 输出 + SSR `data-learning-entry` 语义自查，真实移动点击回跳仍阻塞。
- 回退：仅撤销本卡自身在 `apps/official-site` 与 `packages/i18n/src/official-site.ts` 范围内的差量（以 delivery-2 artifacts 清单为准逐文件恢复）；保留 `delivery-1`、reviewer-1 与本次全部证据；不删除证据目录、不 checkout 覆盖共享改动、不动 DB/服务/端口。
