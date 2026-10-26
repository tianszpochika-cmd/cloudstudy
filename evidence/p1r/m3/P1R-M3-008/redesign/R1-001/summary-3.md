# R1-001 交付摘要 delivery-3（第三轮：F07 恢复链 + F08 证据保护 + TC 真机补采）

- 卡号：R1-001（BC-001/IC-001，owner official-site，P1R 主父 P1R-M3-008）
- 状态流：REWORK revision 8（reviewer-2 reject-2）→ IN_PROGRESS revision 9（start-rework-2.json）→ 本次提交 delivery-3 REVIEW。
- 契约动作：consume（未改正式契约；B9 `getB9OfficialSiteProjection`/`listB9PublicContentCatalog` + B13 `getB13PublicCommerceCatalog` 仅消费；`packages/contracts/generated/**` 未手改）。
- 允许范围：本卡 24 个允许编辑文件；`meta.stale` 候选已核对——正式 `ApiSuccessEnvelope.meta`（`ApiResponseMeta`）无 `stale` 字段，`B9PublicProjectionMeta.stale` 属于另一 `data+meta` 响应族且本卡操作返回 `data: B9PublicSiteProjection` 信封。结论：不扩展正式契约、不把 `meta.stale` 纳入本卡适配（F07 恢复信号以内容 `state=recovery` + `stale` + `errorCode` 为准）。

## 一、新旧对照与复用（以 delivery-3 artifacts 为准）

- 直接复用：`public-links.mjs` 白名单/`buildPublicLearningEntry`、BFF 私有网关读取/401-410 作废/60s 缓存/no-store 语义、`PublicStatus/PublicDocument`、`nuxt.config.ts` 固定地址、`foundation/v2-foundation` locale-theme 基础、安全断言；`about/status/privacy/terms/minors` 五页零 diff。
- 修改：`server/api/public-projection.get.ts`（F07：合法 recovery 保留过滤后数据/更新时间/stale/原因；permission/error/maintenance 仍清空；commerce 独立新鲜度保留；recovery 不再作废缓存）、`utils/public-projection.ts`（F02 全局优先级延续）、`usePublicProjection.ts`（F05 完整形状延续）、11 页 recovery 提示/空态文案/设备对应 CTA（F01/F03/F04 延续）、`packages/i18n` 课程空文案、`site-content.mjs` 路由、6 个测试文件同步。
- 补开发：完整 BFF recovery 组合断言 3 项（保留数据/独立 commerce 新鲜度/不可读清空）、reviewer 探针 F07 断言复跑通过。
- 迁移：无旧功能退役。

## 二、五步骤产物

1. 步骤 1：REWORK revision 8 已核对（delivery-2 与当前树一致、无他人改动；READY 11 文件漂移均为本卡预期改动）；start-rework-2 已记录 revision 9。不写领域 DB、不改 IAM/Java DTO/Outbox。
2. 步骤 2（F07）：恢复链已修复并经完整 BFF 组合测试；reviewer-2 探针加 F07 断言复跑通过（businessRecovery 全 green）。
3. 步骤 3：pricing/download 独立 200；课程/首页空态 `ready/empty` 显示“内容准备中”；三页 recovery 横幅（说明+最后成功时间+重试）延续有效。
4. 步骤 4：CTA 默认 auto 设备对应，`data-learning-entry="web|mobile"`，locale/theme 透传、returnTo 固定；双视口 DOM 22 页全部带正确入口。
5. 步骤 5：本 delivery-3 提交 REVIEW，不自批；缺口保持 P1 阻塞（见 §五）。

## 三、F07 处理结果

- 文件：`apps/official-site/server/api/public-projection.get.ts`（结果组装约 207~225 行）、`apps/official-site/tests/public-projection-bff.test.mjs`（新增 3 组合测试）。
- 修复：`normalized.state === "recovery"` 时保留 `normalized.projection`（仍经字段过滤）、`stale=true`、`errorCode`（保留 `PUBLIC_PROJECTION_STALE`，不再强制 null）、`generatedAt`；`permission/error/maintenance` 分支保持清空 + `stale=false`；commerce 健康时 pricing facet 可为 ready（不再把所有 facet 强制 recovery）；recovery 响应不再触发 `invalidate` 作废。
- 验证：18/18 BFF（含新 3 项）通过；reviewer-2 探针 + F07 7 项断言复跑通过（state/stale/errorCode/courses/generatedAt/facet 全一致）；保留 401/403/404/410、过期、并发作废、单 commerce 失败、真实网络 throw 负例（既有套件全绿）。

## 四、F08 处理结果

- 禁止项状态：`delivery-1.json`（239052c5…）、`delivery-2.json`（eabe36a0…）、`reviewer-1/`、`reviewer-2/` 均未触碰；已被收据固定哈希的 8+5 证据文件未修改（delivery-2 artifacts/evidence 复验 0 漂移）。
- 首轮 summary：`delivery-1` 固定哈希 `ab5ecabc…` 对应的原始字节在当前工作区与 git 历史中均不可得（证据目录 untracked，无提交记录；当前 `summary.md` 为 delivery-2 内容 `fc497d6f…`）。结论：**首轮 summary 原始字节缺失**，无法另存归档验旧哈希；不修改旧收据哈希；本 `summary-3.md` 为独立新证据，另附本节恢复映射说明。
- 新报告：`summary-3.md`、`commands-3.log`；旧 `summary.md`/`commands.log`/`commands-2.log` 保持原字节；回退说明见 §七（隔离临时目录验证，不实际回退共享树）。

## 五、自测结果（含真实时间与退出码，详见 commands-3.log）

- 单元：四套件 18/18（BFF，含 F07 新 3 项）→ 全套 32/32，退出 0。
- 构建：`pnpm --dir apps/official-site build`，Build complete，退出 0（直接调用；历史 wrapper 退出 1 为噪声，不复现）。
- 浏览器 TC01/TC03（Playwright 1.63，真实 18182 dev，退出 0）：375×812 + 1440×900 共 22 页 DOM sweep——11 页 × 双视口全部 200、无横向溢出、Console error 0、业务 Cookie 0；CTA 双视口全部正确（桌面 web→18180，移动 hydration→18183，见 reviewer-2 browser-checks 与本次 tc3-sweep.json）。
- TC01 空态分支：上游不可用时 BFF 诚实 error（课程重试按钮可见、pricing 无购买控件，双视口截图 + DOM 已存 `work/tc1/`）；空目录“内容准备中”分支经 BFF 单测 + 语义探针验证，成功态真实渲染仍 BLOCKED（无真实上游）。
- TC02：模拟“上游 503→失败→恢复→重试重载”经完整 BFF 通过（fail error/courses=0 → recovery courses=1/generatedAt/stale 一致 → retry 同结果，见 `work/tc2-simulated.json`，明确标 MOCKED）；真实 Gateway 503→恢复仍 BLOCKED。
- TC03：builder 级 4 恶意 returnTo→`/home`、重复点击同 href（首版 tc03.json 保留）；本次 DOM sweep 确认入口正确、无业务 Cookie；真实注册页回跳与稳定快速点击录制仍 BLOCKED（自研 sweep 点击步存在导航 flake，已如实降为 BLOCKED，不伪造 PASS）。

## 六、TC 结论

| TC | 结论 | 证据 |
|---|---|---|
| TC01 | PARTIAL/BLOCKED | `work/tc3/tc3-sweep.json`（22 页 200/入口/溢出/Console）+ `work/tc1/`（双视口 error 截图/DOM/无购买）+ BFF 空态单测；缺成功/空态真实渲染与注册点击落地 |
| TC02 | PARTIAL/BLOCKED（F07 已修复为 PASS 级单测语义） | BFF 18/18 + `work/tc2-simulated.json`（MOCKED 503→恢复→重试）；缺真实上游 503→恢复 |
| TC03 | PARTIAL/BLOCKED | builder 负例 + DOM 入口 + 无业务 Cookie；缺真实注册页回跳与稳定快速点击录制 |
| website-runtime.cjs | 未执行全套（BLOCKED） | 适用断言已由本次 sweep/单测逐项覆盖（见 §五）；全套交主审按现有浏览器执行 |

## 七、剩余阻塞、哈希与回退

- 阻塞（P1/blocking=true）：真实 Gateway/content/commerce 只读验收实例（18070）与学习端注册页（18180/18183）无监听——成功/空态真实渲染、真实 503→恢复、注册重复点击与回跳无法验证；`website-runtime.cjs` 全套未跑。
- 源码：`sourceCommit=3d11be33…`（HEAD 未变）；delivery-3 dirty 见收据；24 artifacts 以提交快照为准。
- 差量：限定 `apps/official-site` + `packages/i18n/src/official-site.ts`（F07 为 BFF 1 文件 + BFF 测试 1 文件；其余为 F01~F05 延续）；`git diff HEAD --stat` 另含他人/历史规划文档 dirty，本卡差量以收据 artifacts 为准，不覆盖共享改动。
- 回退验证：Accepted 做法是在隔离临时目录 `git worktree` 逐文件恢复收据 artifacts 并重跑 BFF 18/18；共享工作区不实际回退。本次已在工作区保留全部改动供主审复验。
