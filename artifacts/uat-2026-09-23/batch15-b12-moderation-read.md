# 第 15 批：B12 管理举报队列只读链

## 已实现

- 把 `GET /api/v1/admin/moderation/reports` 精确路由到 social owner 的 `/internal/v1/social/admin/moderation/reports`；POST 处置命令仍无可执行投影。Gateway 路由规则和执行投影均与 `p1r-gateway-boundary.openapi.json` 对齐。
- B12 OpenAPI 新增 `B12AdminReport` 最小披露模型：仅返回稳定的不透明房间/目标引用。owner 只接受经过验证的 `admin.moderation.read`、已验证租户与 Phase 1 身份；不采信客户端租户、主体或角色头。
- owner 按数据库 `id DESC` 做单行探测的游标分页，`pageSize` 限幅 1–100，`hasMore/nextCursor` 一致；游标使用带随机 nonce 的 AES-GCM 并绑定租户，筛选状态也在加密内容中。房间与目标引用由租户绑定的 HMAC 派生，不回传原始主体编号、举报人、客户端事件编号或全局自增号。
- 管理页面支持四种契约状态的只读筛选、加载更多、失败重试和权限变化清屏；原始枚举值改为简短双语标签，缺少 `reviewMode`/提交时间时不虚构事实。详情见 [可读性](admin-governance-b12-readability.md)与[分页](admin-governance-b12-pagination.md)。
- `SOCIAL_MODERATION_CURSOR_KEY` 必须由服务器 secret 注入且至少 32 字节；缺失时 GET 明确 503。Compose 将变量列为必填，示例与部署说明已同步；私有 UAT 环境已生成独立稳定值，未写进仓库或日志。轮换密钥将使旧游标失效，页面可从第一页重新读取。

## 源码验证

| 验证 | 结果 |
| --- | --- |
| social `ModerationCursorCodecTest` + `ModerationQueueReadBoundaryTest` | 8/8 通过：租户/筛选/篡改、权限/密钥失败关闭、分页、脱敏、HTTP 200/400/500/503 回执 |
| Gateway `GatewayRoutePolicyContractParityTest` + `GatewayPathProjectionProcessTest` | 6/6 通过：契约一致、GET 路径与 `status/pageSize/cursor` 转发；POST 不可执行 |
| Gateway 路由 Locator 集成测试 | 通过；进程投影测试使用隔离本机上游，不是正式授权运行证据 |
| OpenAPI merge / validate / generate | 455 operations、797 schemas、192 events 校验通过；生成检查通过 |
| admin-web B12 | 13/13，类型检查和构建通过；该结果只覆盖局部代码 |

完整 Gateway 测试在此 Windows JDK 上因 `java.net.http` 无法建立 loopback connection 报 14 项环境错误，路由/执行/进程定向测试均通过；不能把完整测试称为全绿。冻结 `p1r:gateway-contract:check` 仍有 6 项既有基线漂移（固定计数/摘要与现行多批扩展不符），本次新增规则让当前统计为 65 route rules、65 execution plans；契约运行时 parity 测试通过。[第十五批隔离运行](docker-isolated-full-runtime.md)证实私有 Gateway GET 匿名 401、social owner GET 匿名 401，管理 `/governance` 在 1280/390px 转登录且无溢出或页面错误；这仍不是授权管理员读取证据。

## 验收边界

- 没有正式 ACTIVE 同意文件和合法管理员会话，私有 Docker 只能验证匿名拒绝、服务健康、网页登录边界；不能伪造 JWT 或把局部测试计为授权正向 UAT。
- 处置命令的 Gateway POST 仍返回 404，社群 owner 现有旧写处理也没有所需幂等、版本、双审和审计事实。完整 `PAGE-P1-ADMIN-GOVERNANCE` 仍是 **BLOCKED**；举报从学习端提交、管理处置、申诉、回执和跨端恢复需后续端到端证据。
