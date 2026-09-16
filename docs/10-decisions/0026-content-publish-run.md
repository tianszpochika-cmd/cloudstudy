# ADR-0026：内容发布全链（W8，M3-010 翻牌）

- 状态：已接受（人类负责人全权委托执行，2026-09-16）
- 日期：2026-09-16
- 相关任务：`P1R-M3-010`（发布/投影/下线/回滚）

## 运行

- 4 名窄角色 staff（editor / reviewer-1 / reviewer-2+publisher / 全权限对照），DB 授权（本地夹具并具名），内容面无需门禁（仅租户 + 权严声明）。
- 草稿→送审→双审→发布→学员目录投影→下线→投影消失，全经网关 202/200；`scripts/runtime/p1r-live-publish.mjs` **13/13**。
- 否决证据：editor 审稿 403（无权）、全权限同人自审 409 `FOUR_EYES_REQUIRED`（有权仍拒）。

## 后果

- M3-010 翻牌。ROLLBACK 命令存在但本轮未跑（同一服务同一机制，留作回归项，未声称）。
- 证据：`evidence/live/2026-09-16/w8-live-evidence.json`。
