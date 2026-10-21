# MB007 Home C8 候选（会话丢失恢复）冻结记录（2026-10-21）

状态：`PRIVATE_CANDIDATE_C8 / UI_NOT_SIGNED / BROWSER_NOT_RUN`。当前产品已冻结，不再改源码。只修“home 401 + refresh 401 清会话后仍停在 #/ 的 checking”这一产品 FAIL；不重做首页、不改 IAM/global API/session 核心、不签发/保存 token、不改 history/router。

## 0. 真实证据与旧结论保留

- Root 私有真实 H5：`.git/codex-local-backups/dsh-dispatch-20261021/root-home-auth401-l2.json` 与 `.png`；现象为 API home 401 + refresh 401 后仍 `#/`，只显示“正在确认学习状态…”，不回 login。
- 旧正式 QA auth 只报等待 login 超时；Root 已实证为产品问题，不是 harness。
- 旧 C7/L2 FAIL、截图、`c7-navigation-1` 与 C7 full34/source 证据全部保留；**C8 未自动继承/升级任何 C7 PASS**。
- C7+L2 源码/报告未覆盖：C6/C5/C4/C3 archive、`archive/learn-handoff-before/l1`、`dsh-20261021-author/C7-CANDIDATE.md`、`LEARN-HANDOFF-L2-CANDIDATE.md` 均保留。

## 1. 五源当前快照（本地实测）

当前 home 已复制到 `mobile-home/C8-source-snapshot/home.vue`（829 行，raw=LF）：`b097382f77c67acf710433a77da434076ab5e2db40eb5288c9ef838ff041d3ae`。

| 源 | raw SHA256 | LF SHA256 | 本轮 |
|---|---|---|---|
| home `apps/mobile/src/pages/home/home.vue` | `b097382f77c67acf710433a77da434076ab5e2db40eb5288c9ef838ff041d3ae` | 同 raw | **C8 唯一产品改动** |
| i18n `packages/i18n/src/mobile-experience.ts` | `7e2ef7b596eeb15fa60f715a0e00274a7d1290ddf13b1da4c6cc91116311126f` | `0bb9f0d6eda0cf25f45d18615d6ba4749586f19658dd5ef2ef6c21d511af158b` | 未变 |
| store `apps/mobile/src/stores/learner-content.ts` | `c4ef9dd83452ea44f6deda55ac0be2dd3e49a810cd82d183d5342fa9b71cec21` | 同 raw | 未变 |
| runtime `apps/mobile/src/platform/uni-runtime.ts` | `03b21bab8c4121ec289b5633ae9fab79ba0b64c60d0431f7adbf8953115f265a` | 同 raw | 未变 |
| learn `apps/mobile/src/pages/learn/learn.vue` | `4bd50e4b5af9685f7eabe88e89635f061632d383d0d8e6ae7105d510db90bb03` | 同 raw | 未变（L2） |

**哈希差异说明（不自动改 hash）**：Root 本轮实读当前 home 为 `6813dd96456730ab5395f80465d5e4efd4c5c8a586183dee1b8d920919f3451d`；本地冻结快照实测为 `b097382f…3ae`。两者不一致，本轮不重写、不猜测来源；以各自实测为准，Root 复核以当前工作树/快照实际字节重新计算。旧 C7 home `044948af…cd5af` 仍单独保留。

### C7 归档状态（ARCHIVE_GAP）

- **ARCHIVE_GAP**：C8 编辑前未直接复制 C7 home 原件，不能把改后源假称旧源。
- 已有 `archive/home-c7-before-auth401-20261021/home.vue`：由 C8 编辑逆向重建，raw `044948af7e0fab462f6c8c51f99e9bde2666cb799c9f2d261a37efedcbdcd5af`（778 行）与历史 C7 raw 一致；标记 **RECONSTRUCTED**，不作为“原件”声明。C7 历史文本/证据不覆盖，后续如需可再独立验证。
- 不阻塞保存当前 C8 差量。

## 2. C8 源码实现（仅 home）

1. **确认匿名才回 login**：新增 `confirmedAnonymous`（`pageVisible && !isAuthenticated && status in unauthenticated|error`）。`restoring/refreshing/revoking/unknown` 不当退出，仍显示 checking；API refresh 清会话后的 `unauthenticated` 触发恢复。
2. **复用公开 gate**：`recoverLogin()` 调 `ensureMobilePageAccess('/pages/home/home')`，由既有导航用 session `returnTo` 去 login；不手拼 returnTo。`revoking`/已登录/隐藏页直接返回。
3. **单次令牌 + epoch/revision**：`loginSeq + pageEpoch + identityRevision`；await 后核 token/epoch/pageVisible/当前路径/current auth。旧匿名 Promise 在 B 已登录后只走 `maybeEnter`，不写 navError、不踢回 login；path 已变化（login/onboarding/forbidden）不误报失败。
4. **登录出口不被 action token 锁死**：独立 `loginBusy`（仅防重复），登录按钮不使用 `actionCurrent(owner非空)`，也不再直接 `navigate('/pages/login/login')`。`ensure` 失败且仍在本页/同 revision 时用既有 `navFailed` 文案 + 登录按钮作为重试出口，不长期 checking。
5. **门后读取**：抽出 `readEntry(token,key)`；`runEntry` 与 `recoverLogin` 仅在 `ensure` 通过后进入，避免恢复路径二次 gate；旧 read/entry token 失效，旧回包不写当前 content/error/loading。
6. **保持**：401/403、consent/REJECTED/ELIGIBLE/phase 分流仍由既有 ensure/API；onShow/late/new owner 隔离保留；隐藏页不触发恢复；未改 API/store/runtime/i18n/learn。

## 3. 静态验证（未跑 browser）

| 项 | 结果 |
|---|---|
| typecheck（`pnpm --filter @englishflow/mobile typecheck`） | `PASS_EXIT_0`（本轮唯一一次） |
| home SFC parse/compile（script+template） | `C8_SFC_OK code=31605`（本轮唯一一次） |
| 浏览器 / auth401 真实回归 / build / 503 / late / matrix | `NOT_RUN`；Root 视额度决定只验 auth 或暂停 |
| Git | 无写操作 |

## 4. 未跑项与边界

- 未验证 Root 的 home401+refresh401 是否真实回 login；未填 browser PASS。
- 未跑 H5 build、C7 full34、learn A→B、late/owner/503；旧 C7/L2 结论不升级。
- 未改 home 之外四源；未改完成数/进度；未提交。
- 交付：本文件 + `C8-source-snapshot/home.vue`；C7 归档说明与全部旧证据保留。Root 复核以实际 hash/真实 H5 为准。
