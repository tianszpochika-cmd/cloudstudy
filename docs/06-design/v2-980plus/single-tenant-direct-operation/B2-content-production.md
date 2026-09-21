# B2 内容生产交付：行级条目/批量导入/定时排期/版本对比/行内试听

> 日期：2026-09-21。方向见 [单租户直营 README](README.md) §7（B2）。
> 状态：实现 + 契约 + 单测 + 管理前端完成；运行（真实 DB/网关/浏览器）与 P1R 验收未做，不改变任何 P1R 任务状态。

## 1. 做了什么

- **契约**（仍零新增路径，417 路由不变）：
  - `ContentItemUpsertInput/ContentItemRecord` + 7 个 `ITEM_*` 命令（枚举/policy/oneOf 与 B1 同构）。
  - `B9AdminContentState` 加可选 `item` 与 `scheduledTasks` 投影；`LexemeRecord` 加 `publishedFields` 快照。
  - `GET list` 加 `itemKind` 可选参数；`POST import/batch` 补上诚实的 `x-idempotency` 声明 + `B9IdempotencyKey` 参数引用（运行时本就强制 Idempotency-Key）——门禁失败项从 22 条降到 21 条，`import/batch` 出错消除。
- **content-service**：
  - `V17`：`content_item`（题目/例句/语法点/段落/练习行级，`fields_json` 可扩展）、`scheduled_publish_task`（PACK/LEXEME/ITEM 目标，执行时复核版本）、`lexeme.published_fields_json` 快照。
  - `ContentItemCommandService`（双审、作者禁自审、幂等、409、发布写 Outbox `content.item.published/unpublished.v1`）。
  - `ScheduledPublishService`（创建/取消/查询）+ `ScheduledPublishExecutor`（到期执行，版本 pin 过期则任务 FAILED 而不发布错版）+ `ScheduledPublishRelay`（`content.schedule.enabled=true` 才开的轮询）。
  - `B9ContentAdminController`：7 个 ITEM 分支、`SCHEDULE_PUBLISH/CANCEL_SCHEDULED_PUBLISH` 分支、owner 侧 `GET publish-tasks/{taskId}`（网关外部路由保持 fail-closed 到 B3）、`kind=ITEM` 列表投影（`contentCode=item:{id}`）、pack 详情附 `scheduledTasks`、批量导入支持 `lexeme/item` 条目（已存在按 headword 跳过）。
- **管理前端**：
  - `/items`：条目表 + 新建/编辑（kind/题干/fields JSON）+ 双审/发布/下线 + JSONL 批量导入面板（逐行校验、结果统计）+ 排期面板。
  - `/lexemes` 新增：版本对比（草稿 vs 已发布快照字段级 diff）、排期面板（词包/单词目标）、发音展开行内试听。
  - `AudioPreview` 组件：短时 signed-url 直播（0.5x–2.0x）+ 本地解码波形 canvas；音频字节不经过管理后端。
- **验证**：content-service `161/0/0`（新增 ITEM 3 + Schedule 3）；admin-web `vue-tsc` + `vite build` 通过；契约门禁 21 条（旧 22，诚实收敛 1）；网关 19 条逐条一致；`diff --check` + `stale-claims` PASS。

## 2. 设计取舍

1. **排期网关翻转留给 B3**：owner 侧任务读写已就绪，外部 `content-publish-tasks` 路由仍 fail-closed（翻转需同步重冻 M2-001 基线，单独立项更干净）。
2. **PACK 定时发布执行递延**：执行器对 PACK 目标返回 `SCHEDULE_PACK_DEFERRED`（任务 FAILED 留痕），LEXEME/ITEM 可直接执行；包级发布流水线（版本/hash/双审/权利快照复核）在 B3 补。
3. **打回语义与 B1 一致**：终审只收 APPROVED，打回靠 DRAFT 改字段重送。
4. **批量导入是 JSONL 而非 CSV 解析**：浏览器把 CSV 转 JSONL 再提交（模板在面板占位文案），服务端保持 JSON 强校验；CSV 解析器在 B3 按需加。

## 3. 未做（B3）

- 网关 publish-tasks 翻转 + 重冻基线；PACK 定时执行；学员分群灰度；pack 切换器；真实 DB/网关/浏览器运行验收；P1R 状态变更。
