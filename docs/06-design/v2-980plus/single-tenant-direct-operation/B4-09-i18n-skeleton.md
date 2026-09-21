# B4-09 UI 语言包骨架交付（TENANT-B4-09）

> 日期：2026-09-21。规划见 [B4-multilingual-plan](B4-multilingual-plan.md) §2 TENANT-B4-09。
> 状态：共享包骨架 + 单测 + 管理端切换器完成；运行（浏览器）与 P1R 验收未做，不改变任何 P1R 任务状态。

## 1. 做了什么

- **`packages/i18n`**（唯一共享入口原则；新增 `./starter-locales` 导出）：
  - `src/starter-locales.ts`：`admin`/`learner` 双命名空间骨架。`zh-CN` 为完整源，`en-US` 对骨架键集完整，`fr`/`de` 有意稀疏——运行时经 `en-US` 回退 `zh-CN`，缺 key 永不抛（返回回退串；全链缺失才返回 key 本身）。
  - `tests/starter-locales.test.mjs`（`pnpm --filter @englishflow/i18n test`，Node 类型剥离直测 TS 源码）：源完整性、fr/de 全键回退不断言空、fr/de 自有译文命中、未知 key 原样返回、**伪本地化展开全键**（`en-XA` 生效）、缺 key 扫描如实报告 fr/de、切换 UI locale 不碰 `contentLocale`——**7/7**。
- **管理端语言切换器**（仅 UI，不碰 `contentLocale`）：
  - `v2-foundation.ts` 注册 fr/de 骨架；`AdminLocaleSwitcher.vue`（中/英/法/德下拉，经持久化 adapter 写 `ef.ui-locale`，`ef.content-locale` 原样保留）；`App.vue` Header 接入。Element Plus 未知语言经既有映射回退中文（`adapters.ts` 原逻辑，不崩溃）。
- **验证**：i18n 包 `typecheck` + `test 7/7`；admin-web `vue-tsc` + `vite build` 通过；四服务单测全绿（本任务无 Java 改动，复跑确认）；合并零漂移（无契约变更）；`validate-contracts` 唯一旧失败；`p1r-api-contract` 7/2；网关 63/393/202；`diff --check` + `stale-claims` PASS。

## 2. 设计取舍（诚实记录）

1. **骨架≠全量翻译**：管理端/学员端页面现状多为中文硬编码，全量抽 key 是独立大工程；本任务交付命名空间 + 回退机制 + 切换器 + 扫描测试，全量迁移留待后续（扫描测试即迁移进度尺：`findMissingKeys` 报告清零之日即完成之时）。
2. **fr/de 语言名用短码**：骨架注册在共享实例的 `fr`/`de` 键下（`normalizeLocale` 保留短码），与 `fr-FR` 内容缎带是两回事——UI locale 与 contentLocale 分离原则在此再次落地（切换器单测显式断言）。
3. **学员端只出骨架不接线**：learner-web/mobile 的接线（adapter + 语言设置页）与官网一样超出“骨架”范围；包已导出，接线方按 `adapters.ts` 四种桥接自行接入。
4. **测试直测 TS 源码**：Node 24 类型剥离，无需构建；与仓库 `.test.mjs` 文本断言风格一致（运行真实 `createI18n`，非文本匹配）。

## 3. 未做（后续）

- 全量 key 抽取与 fr/de 完整翻译；学员端接线；浏览器八态；全量回归（B4-10）；网关重冻；P1R 状态变更。
