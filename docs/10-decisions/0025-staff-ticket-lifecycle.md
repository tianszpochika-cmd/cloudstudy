# ADR-0025：staff 面解锁与工单管理链（P1-LIVE-016 结案，M6-005 翻牌）

- 状态：已接受（人类负责人全权委托执行，2026-09-16）
- 日期：2026-09-16
- 相关任务：`P1R-M6-005`（learner/admin 同模）、`P1R-M7`（客服管理链）

## 背景

本地无 staff 种子，但 `iam_account` 的 roles/permissions 直发行、token 原样携带——配窄权限 staff 属合法本地夹具（与种子脚本同类），遂配 `support.ticket.read/manage` 专测管理面。

## 三连修（P1-LIVE-016）

1. 种子 `MEDIUM` 优先级与代码枚举（LOW/NORMAL/HIGH/URGENT）漂移：admin 全量列举读到种子行即 500。活库 `MEDIUM→NORMAL` + 种子源同改。
2. `admin_ops_outbox_event.event_id` CHAR(36) 装不下 `cmd_<uuid>`（40 字符）：V4 迁移扩到 VARCHAR(64)。（audit 侧已是 128，无事。）
3. 同表写侧缺 `occurred_at`（NOT NULL 无默认）：补写（与 learner/commerce 同物种，至此 6 家写侧全部核对无掉队）。

## 验证

新链 `scripts/runtime/p1r-live-w7.mjs` **9/9**：建单→staff 全量列举（同模字段逐键一致）→START→RESOLVE 确认挑战→学员侧见 RESOLVED。admin-ops 64/0/0。
