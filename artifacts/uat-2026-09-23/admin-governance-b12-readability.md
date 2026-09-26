# B12 管理治理页可读性切片（批15源码）

## 范围与事实边界

- 只改管理端治理页的表头与 `status`、`reasonCode`、`reviewMode` 展示，不改 API、权限、路由、Gateway 或 social/workflow owner。
- 枚举依据：`packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json` 的 `B12Report.status`、`B12ReportCommand.reasonCode`、`M1014Report.state/reasonCode`，以及 `services/social-service/src/main/java/com/englishflow/social/domain/SocialTypes.java` 的历史原因代码。
- 中英文均对这些已知代码显示短标签；缺失、未知或异常代码只显示通用“待确认”，不将原值拼进页面。`MANUAL` 显示“人工审核 / Human review”。
- `createdAt` 缺失时不再把 `updatedAt` 冒充提交时间；表格显示 `—`。这不改变源数据。

## 验证

- `pnpm --filter @englishflow/admin-web test:b12`：8/8 通过。测试从现行 B12/M1014 契约读取枚举，逐项检查中英文标签；另检查未知/恶意代码安全回退、缺失 mode/时间不冒充已知事实，以及批14 的读取错误/权限/重试状态。
- `pnpm --filter @englishflow/admin-web exec vue-tsc --noEmit`：退出码 0。
- `pnpm --filter @englishflow/admin-web build`：退出码 0，Vite 完成；保留既有 chunk 大小与混合导入提示，本切片未调整打包结构。
- `git diff --check`：退出码 0。

## 尚未覆盖

- 现行 Gateway 仍未接通 B12 管理举报队列，缺正式授权管理员会话；本切片不能证明已登录治理页的 390px 视觉布局，也不能升级 `PAGE-P1-ADMIN-GOVERNANCE` 的 BLOCKED 状态。
- 批14 的 390px 截图 `admin-governance-390-auth-boundary.png` 仅证明匿名访问进入登录页，不能代替治理列表画面。
