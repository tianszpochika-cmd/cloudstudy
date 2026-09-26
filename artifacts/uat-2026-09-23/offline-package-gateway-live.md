# 离线包精确 GET：第十批本地 Gateway 回归

在主任务更换 Gateway JAR、启动本地 16 Java runner 后，执行 `node scripts/runtime/uat-offline-package-owner-boundary.mjs --after-gateway-deploy`。测试只访问本地固定 Gateway/IAM/notification，未启停服务或触碰隔离 Docker。原始 [38 项运行记录](offline-package-owner-boundary.json)为 **PASS**。

| 场景 | 真实结果 |
| --- | --- |
| 移动 H5 `Origin: http://127.0.0.1:18183`，GET + `Authorization` 预检 | `OPTIONS 200`，允许的 Origin 与请求一致，`Access-Control-Allow-Credentials: true`。 |
| 携同一 Origin 的实际 GET 响应 | `200`，同时返回允许的 Origin 和凭据 CORS 头。 |
| 匿名访问 owner / Gateway | 均 `401`。 |
| 新注册、尚未过成人 Gate 的账号 | owner 与 Gateway 均 `403`。 |
| 成人 Gate、三项同意、重新登录后 | owner 与 Gateway 均 `200`，`items=[]`；没有返回伪造签名地址。 |
| 离线写入口 | authorize POST、download PATCH、cleanup POST、events POST、checkpoint PUT 均 `404`；移动 Origin 对 authorize POST 的预检 `403`。没有新增下载或离线事件。 |
| 跨主体与伪造权威头 | 第二个独立合成成人账号携第一个账号的 `X-Subject-Id` 及伪造角色、租户头，Gateway 仍只给空列表；两个账号都没有新增下载事实。 |
| 清理 | 两个 `.invalid` 合成账号均已停用；各自活跃会话、设备、principal 与 owner 下载事实均为 0。 |

第一个执行版本的预检曾返回 `403`，原因是探针错误加入了 `x-client-platform`，而移动端实际 API 客户端没有发送该头；Gateway 的显式 CORS 允许清单也不允许它。该首轮失败保留在 [探针错误记录](offline-package-owner-preflight-harness-fail.json)。修正探针为移动端真实 `Authorization` 请求头后，通过了预检和实际 GET 的 CORS 验证；Gateway 没有为测试放宽头部规则。

运行后再次以事务前完整备份哈希执行只读校验：99 个合成包维持 `DELETED`、99 条下载事实维持隔离，**已发布包 0**、跨 schema 引用 0、离线对象 0。隔离与恢复边界见 [数据审计](../audit-2026-09-23/offline-package-fixtures/README.md)。

跨主体测试只能覆盖身份区分、伪造头拒绝影响和零写入：当前没有真实已发布离线包，无法做“账号 A 已授权下载、账号 B 不可见”的正向资源所有权验证。真实下载、版权/权益、分片签名、对象字节、断网恢复与同步写入仍未验收，写路由继续保持关闭。B4 GET OpenAPI 目前只显式声明 `200`，`401/403/503` 的响应契约仍需补齐；本轮没有把这项描述为已通过。
