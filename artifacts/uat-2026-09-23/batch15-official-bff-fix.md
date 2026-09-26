# 第 15 批：官网公开投影 BFF 地址与降级缓存修复

## 触发证据与范围

- 当前私有 Docker 官网容器的 `/api/public-projection?locale=zh-CN` 返回 HTTP 200、`state=error`、`source=empty-fallback`，却带 `Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=300`。容器内直连 `http://api-gateway:18070/api/v1/public/site/projection?uiLocale=zh-CN` 返回 HTTP 200；走公开自签 HTTPS 代理则报 `DEPTH_ZERO_SELF_SIGNED_CERT`。这说明官网服务端使用了浏览器的公开上游地址，且错误结果可能被缓存。详见 `batch15-media-content-readonly.md`。
- 本次只修改官网 BFF、私有运行时配置、full Compose 的 `official-site` 覆盖段、示例环境文件和官网测试。未改私有运行状态、社交服务配置或任何内容/媒体事实；未构建 Docker 镜像。

## 修复行为

1. `NUXT_GATEWAY_INTERNAL_BASE_URL` 进入 Nuxt 私有 `runtimeConfig.gatewayInternalBaseUrl`，full Compose 默认指向 `http://api-gateway:18070/api/v1`。官网 BFF 的公开投影与公开商业目录读取均使用它。浏览器的 `NUXT_PUBLIC_GATEWAY_BASE_URL` 保持原值；未关闭 TLS 验证。未设置内部地址时保留已有绝对公开地址的本地兼容路径，非法或相对服务端 URL 失败关闭。
2. BFF 默认 `Cache-Control: no-store`；仅上游完整、商业目录未降级且投影状态为 `ready` 或 `empty` 时发送 `public, max-age=60, s-maxage=60`。错误、权限拒绝、恢复、维护及商业目录降级不进入共享缓存，移除 300 秒 `stale-while-revalidate`。
3. 最近一次完整 `ready` 投影按 UI 语言分开保存，最多用于 60 秒内的短期故障恢复。上游明确返回空投影或 401/403/404/410 时立即清除旧快照；401/403 返回 `permission` 空投影。过期后故障返回 `error` 空投影，避免长期复活旧课程或价格。保留现有 `source`、`state`、`errorCode` 返回结构。
4. 商业目录是公开价格的唯一来源；目录为空或降级时清除内容投影内遗留的 `pricingPlans/skus`，不把旧价格重新展示为可购买方案。

## 验证

| 检查 | 结果 |
|---|---|
| 官网 `pnpm --filter @englishflow/official-site test:website` | 21/21 通过，包含新增 BFF 路由和旧价格清除测试 |
| 官网 `pnpm --filter @englishflow/official-site exec nuxi typecheck` | 通过 |
| `docker compose` 以两个示例 env 与 core+full Compose 运行 `config --quiet` | 通过 |
| 相关文件 `git diff --check` | 通过 |

新增测试直接装载并执行当前 BFF TypeScript 处理器，覆盖内部/公开地址隔离、正常缓存、初始错误、短期恢复、60 秒过期、真实空态、401/403/404/410、UI 语言隔离、非法内部 URL、商业目录单独失败及 full Compose 配置。测试使用内存中的公开假数据，不触碰运行中的 Docker 容器或数据库。

## 第十五批隔离运行复测与剩余边界

- 第十五批官网镜像已进入私有 Docker。[隔离运行证据](docker-isolated-full-runtime.md)显示中英文 BFF 均为 `state=empty/source=gateway/stale=false/courses=0`；课程页 1280/390px 截图无旧错误横幅、脚本错误或横向溢出，六张学习方式卡与真实公开课程空态分开。浏览器公开配置未改为容器内部地址。当前数据库公开课程和媒体源事实仍为空，不能把 BFF 正常返回误报为内容已齐全。
- 成功响应最多可被代理缓存 60 秒，进程内短期故障恢复最多 60 秒。若业务要求内容/价格下架立即全站生效，还需内容版本水位与主动失效设计；本批未改这些领域规则。
