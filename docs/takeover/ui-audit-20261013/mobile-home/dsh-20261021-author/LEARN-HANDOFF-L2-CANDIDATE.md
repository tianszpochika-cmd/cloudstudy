# MB007 learn handoff L2 候选（2026-10-21）

状态：`PRIVATE_CANDIDATE_L2 / UI_NOT_SIGNED / BROWSER_NOT_RUN`。仅修 L1 审出的页门与每次显示重读；不重做 learn、不改 home/C7 四源、不改布局/文案/复习写口/API/store/runtime。未提交、未 fetch/push、未跑浏览器/服务/依赖，未改完成数。

## 0. L1 过程证据保留

L1 源码与报告已归档 `mobile-home/archive/learn-handoff-l1-20261021/`：

- `learn.vue` raw `52091366379e3a00771df9c8bf01a56ee4de08078c2e728fcce456beeb9e8c56`（21491B）
- `LEARN-HANDOFF-CANDIDATE.md` raw `81ac1442ca6754861af36691144e880f73fde9fc52bc02d89fd7770b2fd9a898`（6166B）
- 原始 learn（L1 前）仍保留 `archive/learn-handoff-before-20261021/`：`83b0756b84bbd2e34a4c4bdee196b02bb63403ca64b032034a16ffd7187d17c1`（18740B，213 split / 212 编辑器行）。

C7 四源冻结不变（本轮未改）：

- home `044948af7e0fab462f6c8c51f99e9bde2666cb799c9f2d261a37efedcbdcd5af`
- i18n `7e2ef7b596eeb15fa60f715a0e00274a7d1290ddf13b1da4c6cc91116311126f`
- store `c4ef9dd83452ea44f6deda55ac0be2dd3e49a810cd82d183d5342fa9b71cec21`
- runtime `03b21bab8c4121ec289b5633ae9fab79ba0b64c60d0431f7adbf8953115f265a`

## 1. L2 源与最小 diff

| 项 | 值 |
|---|---|
| 文件 | `apps/mobile/src/pages/learn/learn.vue` |
| 新 raw SHA256 | `4bd50e4b5af9685f7eabe88e89635f061632d383d0d8e6ae7105d510db90bb03` |
| 新 LF SHA256 | 同 raw（LF 工作副本） |
| 行数 | 333（split） |
| diff | `+139 / -19`（仅 learn.vue；无其他新增产品文件） |

### 1.1 真实 IAM 页门（P1-1）

- 新增 `import { ensureMobilePageAccess } from '../../auth/navigation'`（公开既有 gate，不新增权限/规则）。
- `syncPage()`（`:161`）：`await session.restore()` 后，再
  ```
  allowed = await ensureMobilePageAccess('/pages/learn/learn')
  ```
  await 之后依次核 `pageVisible / attempt===activeSync / epoch===pageEpoch / currentOwner()`；只有 `allowed===true` 才 `gateReady=true`。
- `ensure` 返回 false → `failClosed()`：`gateReady=false`、清 `content`、`contentState='error'`、`contentError=null`（页面用既有“课程暂不可用。”兜底，不新增文案）；loading 条件改为 `contentState==='loading' || (!gateReady && contentState!=='error')`，因此 gate 失败时错误/重试仍可见，不会被 loading 永久遮住。若 gate 已导航 login/onboarding/forbidden，页面离开，不误读内容。
- `ensure`/`restore` 异常 → `syncPage` 内 catch `failClosed()`；`startSync()` 再兜底 `.catch(() => failClosed())`，不产生 unhandled。`session.restore()` 本身已在 `stores/session.ts` 的 `restore()` 内 try/catch/finally 吞掉异常并清会话，因此这里的 catch 主要覆盖 ensure 与意外。
- 未手写 login/adult/consent/phase 判断；401/403/成人/同意/阶段仍由既有 `ensureMobilePageAccess`/API handler 分流。

### 1.2 每次显示强制重读当前课程（P1-2）

- `syncPage` 在门通过后：
  ```
  const intent = takeIntent()
  if (intent?.contentCode) applyIntent(intent)         // 新 intent（含 same code）force
  else if (contentCode.value) void loadContent(contentCode.value, true)  // 已选课程每次显示都 GET
  ```
- `loadContent` 开始即 `content.value=null; contentState='loading'`，旧 body 被 loading 遮住；成功后 ready。
- 不再只对 `loading/error` 重读：ready 也重读，仍然只 GET，不造新能力，不改 API/权限。
- 明确新 intent 与当前 code 相同也传 force，不受 `loadedContentCode` 缓存短路。
- 错误态的“重试”按钮改为 `startSync`：先重新过页门，再由 `syncPage` 对当前 code force GET；不允许跳过 gate 直接读内容。

### 1.3 事实更正：原同 code 重试并非已证死

- 原始 `loadContent` 守卫是
  ```
  if (!normalized || (normalized === loadedContentCode && contentState.value !== 'error')) return
  ```
  即 same code 且 `state==='error'` 时本来就会继续发 GET；“cache 短路”只是 Root 初始关切，**不是已复现 before FAIL**。
- L1/L2 的 `force` retry 保持并强化既有行为；L2 新增真实 503 恢复用例，未把 before 写成缺陷。

### 1.4 owner / 旧 intent / task 安全（P1-4）

- `lastOwnerSubject` 记录上一个非空 subject；identity 变化时：
  - `switched = Boolean(subject && lastOwnerSubject && subject !== lastOwnerSubject)`；
  - `subject===null && status!=='restoring'` 视为登出；
  - 两者任一：`initialIntent=null; initialConsumed=true; taskId=''`，再 `invalidateOwner()` 清 content/contentCode/loaded/状态。
  - `status==='restoring'` 的临时 null 不清初次 intent，避免首次 restore 把 onLoad intent 丢掉。
- `onLoad` 增加 `if (initialConsumed) return`：已消费的初次 intent 不会被后到的 onLoad options 覆盖新 pending。
- `takeIntent` 仍是 pending 优先；新 owner 的真实 pending 仍可读，旧 owner 的 initialIntent/taskId 不会重放。
- 未为 taskId 打开任何完成写口；未改 `learning.load` 复习写口。

### 1.5 保留的旧保护

- `readSeq + pageEpoch + owner` 独立读 token，旧回包不写当前 content/error/loading；旧 HTTP 不 abort。
- `onHide`/`onBeforeUnmount` 增 epoch/readSeq、`gateReady=false`，遮旧 body；返回后必须重新过 gate。
- `loadedContentCode` 只在成功且当前时记录；失败清空；重试真实 GET。
- `contentLocale` 与 UI locale 分离、API 401/403 分流、review `learning.load` 均未改。

## 2. L2 测试计划（Root browser）

| # | 场景 | 断言 |
|---|---|---|
| A1 | 首页课程 A→首页→课程 B | 页门通过后 B 发新 GET；DOM 为 B；A 不残留 |
| A2 | A→首页→A（同 code 明确 intent） | 仍发新 GET，不只显示旧缓存 |
| A3 | A ready→离开→返回（无新 intent） | 门通过后仍 force GET A，loading 遮旧 body，成功后再显示 A |
| A4 | B 加载中切回 A/再进 B | 仅最后 intent 写；旧包不覆盖 |
| A5 | B 加载中离开再返回 | 重读 B（无新 intent 也 GET），不永久 loading |
| A6 | B 503 失败→点重试 | 重试先过页门，再发真实 GET；200 后显示 B；不被 cache 短路 |
| A7 | B 503→离开→返回（无新 intent） | 门通过后重读 B；不残留旧错误壳 |
| A8 | 身份 A→B（页可见） | 旧内容清空、旧 initialIntent/taskId 不重放；B 重新 gate；无 A 课闪现 |
| A9 | 登出/401 | 旧内容不显示；既有 login 分流；无 unhandled |
| A10 | ensure 返回 false/抛错 | fail closed：不读业务内容、gateReady false、已有“课程暂不可用。”反馈；不崩溃 |
| A11 | 成人/同意/阶段门未过 | 由既有 ensure 分流到 onboarding/forbidden/login；不自行读课程 |
| A12 | 直接深链 onLoad + tab 二次 pending | onLoad 初次 intent 仅用一次；pending 优先且只消费一次；onMounted 不覆写 |
| A13 | 403 内容读取 | 既有 API 分流/错误呈现，不伪装成空内容 |
| A14 | 晚到 A 包在 B 之后 | 旧包不写 B 的 content/error/loading |
| A15 | taskId 归属 | 新课无 task 清旧 task；不显示旧任务完成承诺 |

## 3. 静态验证（非 browser PASS）

| 项 | 结果 |
|---|---|
| `pnpm --filter @englishflow/mobile typecheck` | `PASS_EXIT_0` |
| SFC parse/compile | `LEARN_L2_FINAL_OK code=14524`；重试按钮已指向 `startSync`（先 gate 再 force GET）；failClosed 时错误仍可见 |
| 源码断言 | 含 `ensureMobilePageAccess('/pages/learn/learn')`、after-await epoch/owner 检查、`gateReady` 只在 allowed 后置 true、每次显示 `loadContent(contentCode, true)`、`lastOwnerSubject`、`startSync`；无 `onMounted`/`initializeContent` |
| H5 build / 浏览器 / 503 / late | `NOT_RUN`（Root 执行；不重复 DSH 环境阻塞） |
| Git | 无写操作 |

## 4. 边界

产品仅改 `apps/mobile/src/pages/learn/learn.vue`；文档为 L2 本文件、L1 更正注记、archive 两份 HASHES。未改 home/i18n/store/runtime/API/MB006/56 文件/14 目录/依赖/权限/路由/完成数。C7 navigation FAIL 与旧 503 证据在 Root 复跑前不升级；不称 learn 整页重设计完成。
