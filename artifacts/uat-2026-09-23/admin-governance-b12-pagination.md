# B12 管理治理队列分页（批15源码）

## 已实现

- 治理页只读展示契约允许的 `OPEN`、`REVIEWING`、`RESOLVED`、`DISMISSED` 举报队列。首屏读取 `meta.hasMore` 与 `meta.nextCursor`，有后续页时展示“加载更多”；游标只做 URL 编码后原值回传，不解析、不生成。
- 状态筛选切换、刷新、账号或权限变化会清空旧页和游标，并阻止旧请求回写。后续页 401/403 同样清空；普通读取失败保留已读行、游标和重试入口，显示“当前列表不完整”。
- 元数据缺失、`hasMore` 与游标冲突、空的未完页及重复游标均不会被当作完整列表。跨页同编号行去重。
- 既有独立 `/recovery` 路由和权限边界未改。未接入治理写命令。

## 依据与验证

- OpenAPI：`packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json`，`GET /api/v1/admin/moderation/reports` 声明 `Cursor`、`PageSize`、`ApiCursorPageEnvelope` 及 `x-pagination.mode=cursor`。当前 social owner 的队列响应已返回 `data.items` 和 `meta.hasMore/nextCursor`。
- `pnpm --filter @englishflow/admin-web test:b12`：13/13 通过，含 opaque 游标传递、翻页、状态切换、后续页失败重试、权限变更、刷新竞态及畸形分页信息。
- `pnpm --filter @englishflow/admin-web exec vue-tsc --noEmit`：退出码 0。
- `pnpm --filter @englishflow/admin-web build`：退出码 0；Vite 保留现有第三方 PURE 注释、混合导入和大 chunk 提示。
- `node --test apps/admin-web/tests/b14-fe-005.test.mjs`：4/4 通过，管理端 Gateway/认证边界未回归。
- `git diff --check`：退出码 0。

## 证据边界

- 本次未重启共享服务或打 Docker 包。没有正式授权管理员会话下的治理队列浏览器截图；既有 390px 匿名截图仅证明登录边界，不能当作分页交互验收。需要父任务在后续集中打包后用授权会话完成运行时翻页与窄屏复测。
