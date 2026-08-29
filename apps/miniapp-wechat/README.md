# miniapp-wechat（历史归档边界）

本目录是 `HISTORICAL/REWRITE` 记录，不是可安装、可构建或可发布的第五个前端项目。微信小程序只能由 `apps/mobile` 的 uni-app 条件编译目标输出，并在 Phase 1 之后按 Gate 决定是否启用。

## 当前状态

- 基线盘点只发现空的 `src/components`、`src/pages`、`src/services` 占位目录；这些占位已移除，没有可迁移的业务实现。
- 本目录仅允许保留本说明和 `archive-boundary.json`。不得新增 `package.json`、应用入口、页面、状态管理、API 客户端、领域模型、测试夹具或构建产物。
- 平台差异、微信授权适配和条件编译代码必须回到 `apps/mobile`；共享契约仍来自 `packages/contracts` 和其他共享包。
- 本目录不得加入 workspace、启动脚本、CI 构建矩阵或默认发布路由。

机器可读的归档约束、迁移去向和禁止项见 `archive-boundary.json`。
