# B33 四端 Gateway 交互、构建与官网公开投影验证

> 日期：2026-08-25  
> 模式：`local-real`，固定端口，真实 Gateway、content-service owner MySQL、真实前端开发服务  
> 结论：B33 本机前端运行切片已通过；浏览器完整注册/登录/学习旅程属于 B34。

## 固定项目边界

| 项目 | 端口 | 结果 |
|---|---:|---|
| `apps/learner-web` | 18180 | Gateway-only，`vue-tsc` 与生产构建通过 |
| `apps/admin-web` | 18181 | Gateway-only，生产构建通过 |
| `apps/official-site` | 18182 | SSR/预渲染构建通过，公开投影由 Gateway 提供 |
| `apps/mobile` Mobile H5 | 18183 | Gateway-only，`uni build -p h5` 通过 |
| `apps/miniapp-wechat` | — | 无独立 `package.json`，仅保留条件编译语义，不计为第五个项目 |

四端都通过固定端口和 `strictPort` 启动；运行时没有直接调用 core-api 或领域服务端口，也没有导入 `GatewayTestDouble`。客户端角色、租户、owner、permission 头会被剥离，鉴权事实来自 Gateway/服务端验证 JWT。

## 本轮修复

- Mobile H5 默认进入 `local-real`：重载后不再把本地缓存的首页、首日投影或任务完成状态当成事实；任务完成只有收到 learner-service 确认后才更新权威页面状态。
- Gateway 新增公开官网投影路由 `/api/v1/public/site/projection`，仅允许 GET/HEAD，保留客户端权限头剥离。
- content-service 新增公开只读聚合，课程数据来自已发布 MySQL content read model；下载、公告和合规来自 content-service 自有的公开 facet 投影表，并严格按 B9 allow-list 返回。价格不跨 owner 写入 content-service，由官方站点 BFF 从 commerce-service 的 B13 public catalog 合并真实 SKU。
- 官网 Nuxt SSR `/api/public-projection` 现在可观测 `source=gateway`、`state=ready`，并能读到已发布内容。

## 验证命令与证据

```powershell
pnpm b33:static
pnpm test:b33
pnpm --filter @englishflow/learner-web typecheck
pnpm --filter @englishflow/learner-web build
pnpm --filter @englishflow/admin-web build
pnpm --filter @englishflow/official-site build # 本地有 Nuxt dev lock 时使用 $env:NUXT_IGNORE_LOCK='1'
pnpm --filter @englishflow/mobile build:h5
pnpm b33:frontend-runtime
```

静态/契约结果：`b33:static PASS`、`test:b33 1/1 PASS`。四端页面 HTTP 均为 `200`；官网公开投影最近一次为 `HTTP 200 / source=gateway / state=ready`，课程条目来自 content-service MySQL，未输出 token、密码或浏览器存储内容。

官网公开链路：

```text
official-site SSR /api/public-projection
  -> Gateway /api/v1/public/site/projection
  -> content-service /api/v1/public/site/projection
  -> content_service published content read model + public facet projection
  -> commerce-service /api/v1/public/commerce/catalog (price merge at official-site BFF)
```

## B33 边界

B33 证明四个前端能构建、固定端口运行并通过 Gateway/公开投影交互；官网 6 个公开路由已用 Browser MCP 验证真实课程、商品、下载、公告和合规数据。尚未将浏览器中的注册、登录、成人 Gate、onboarding、课程、练习、评测、报告、退出和 Mobile H5 触控旅程计为通过。该部分由 B34 MCP 浏览器验收完成，异常/重启/幂等回归由 B35 完成，最终交接由 B36 完成。
