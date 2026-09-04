# P1R M2 执行日志

## 2026-09-04 IAM 账户/密码并发安全检查点

- 源码：`9deb899`。认证改为锁前单次 cost-12 BCrypt、锁内 current principal/hash/status/counter 复核；credential epoch 在校验期间变化时统一 `INVALID_CREDENTIALS` 且零写入，避免旧在途请求污染或锁死刚重置的新凭据。
- 真实 MySQL 8.4/Spring 事务测试覆盖：单笔与四笔旧 hash 在途时 reset 先提交、旧请求全部失败关闭、新 epoch 计数/状态不变、新密码随后登录成功；同一 current hash 四路普通错误精确累计至锁定；audit outage 同时回滚账户事实与 idempotency claim。
- 验证：Java 25 定向 `29/29`；普通全套 `57` 项、`0 failure / 0 error`（13 项外部集成按配置跳过）；MySQL 专项 `8/8`；只含 `9deb899` 的临时 detached worktree 定向 `29/29`；diff PASS。
- 独立审查首轮发现“stale credential 污染新 epoch 计数”并判定 `REWORK`；返工后同一 reviewer 最终 `ACCEPT`、P1/P2=`0/0`。本结论仅关闭账户密码并发批次，`P1R-M2-002` 继续 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`。

## 2026-09-04 Gateway health 与 Evidence 责任闭环校正

- 修正 canonical `GET /api/v1/health` 身份：summary 为“读取 API Gateway 健康状态”，`HealthData.service=api-gateway`；路径、method、operationId、响应 envelope/status/header/schema 与其他 wire shape 均未晋升。
- 受控 compatibility scope 固定为 `OPENAPI_GATEWAY_ROOT_AND_HEALTH_IDENTITY_ONLY`；完整 execution target plan digest 为 `89b7361e29ff87defa1c4579bbf44ed0c4ec1d0ac7327d71fbe6a2d504b13694`，其中 execution target policy semantic digest 为 `d5182f41d59ef89a4e4743db930eda8ab0e42eb1113d6d57b08b9e4af507c2f9`；完整 Gateway root digest 为 `c58a64d1dec50705e462c5ff11fee166ac10c3caf9e4432a7c154b2bbab99ab3`，full OpenAPI semantic digest 为 `1f85e59cc7263cae9cd3517a89f1a394f07fcedfb9aac2669d92aae0e07031d7`，descriptor set digest 为 `864d4bfa2d87df7f7b257e03d116663bc83325947e01609be301a42f41cf678e`。
- 发布 `M2-EVIDENCE-RESPONSIBILITY-ADDENDUM-2026-09-04.md`：M2-001 持有 CORS/CSRF、public-path 与 Redis 限流实现/Evidence；durable audit、NetworkPolicy、平台关联终验、staging 复验分别由 M2-006、M2-008、M2-010、M8-013 持有。六项 Gateway runtime GAP 全部保持 `OPEN`，M2-003 依赖与最终 Gate 不变。
- 验证：Java 25 Gateway `63/63`、Gateway Node `37/37`、contract tooling `63/63`、合并 `26 OpenAPI fragments / 20 event fragments / 396 routes / 191 events`、校验 `427 operations / 783 schemas / 191 events`、生成物 `5/5`、相对 `66246d5` 的 OpenAPI compatibility `0 breaking`、计划 `108/108` 均 PASS。
- 源码检查点：`9560c75`。独立治理审查首轮为 `REWORK`、P1/P2=`0/2`，修正执行入口/交接旧责任、Addendum 适用范围、M2-004 audit-service owner、历史 superseded 范围及 digest 标签后，同一 reviewer 最终 `ACCEPT`、P1/P2=`0/0`；`P1R-M2-001` 仍因真实跨进程 Evidence 未齐而继续 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`。

## 2026-09-04 中断恢复与 Gateway 安全收口检查点

- 恢复起点：`dev@9e88958f22a3abff7f4521b819330be84207c0ae`，当时工作区干净且本地远程跟踪为 `0/0`；既有 IAM/Gateway 成果全部保留，没有执行 reset/clean/checkout。
- Gateway 检查点：`acee36a84ee1fd6557ac3b62a41d033622e8da4a`。移除三条尚无 provider-signature 边界的支付回调 execution projection，使其在精确高优先级规则上 404 fail closed；响应提交前把 request/trace header 归一为单值；B12/B13/B14 及未注册的 core-api compatibility 默认关闭。
- 契约投影同步为 `151 projections / 168 available operations / 197 unavailable operations`，当时 execution target digest 为 `5fbbaa85800a951a06251478270fb97ff1a5c61bbada38e62c11823792377af1`；该历史值随后由上方 health/治理校正检查点的新 digest 取代。
- 验证：Java 25 Gateway `62/62`、Gateway Node `32/32`、全量 P1R `1416/1416`、contracts merge/validate、Git baseline compatibility、Gateway audit、plan、GAP registry 和 diff PASS。独立只读审查确认支付回调不存在前缀逃逸，但指出 Gateway health 仍错误沿用 `service=core-api`，真实 Netty header-copy 顺序也尚未跨进程验证。
- 状态：`P1R-M2-001` 继续 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`。本轮不关闭任何 runtime GAP，不创建 canonical Evidence，不解锁 M2-003。
- 平台依赖审计确认：durable audit 自然属于 M2-006、NetworkPolicy 运行证明自然属于 M2-008/M2-010；把二者同时作为 M2-001 前置会形成依赖闭环。下一治理检查点须明确实施/Evidence/最终 Gate 责任，不能降低最终标准或提前验收。
- 远程：首次 fetch/push 因 GitHub HTTPS 连接重置/443 不可达失败；本地提交已安全落盘，网络恢复后必须重试推送并记录远程 SHA。

## 2026-09-01 启动

- 前置：M1-018 独立终验 `ACCEPT`、P1/P2=`0/0`；全局 Evidence Gate PASS；远程 `dev` 已包含 `d7fdabb01655e3c2c1e13c076d7ba2bf8281875c`。
- 并行轨道：`P1R-M2-001` Gateway 与 `P1R-M2-002` IAM 转为 `IN_PROGRESS`；`P1R-M2-003` 仅做只读预研，等待两项依赖验收。
- 执行模型：统筹 Agent 独占 Git、台账、Evidence 和公共文件；Gateway 与 IAM 执行 Agent 使用互斥服务目录，不提交、不推送。
- 运行诚实性：当前可完成代码、Java 25 测试和本机可用依赖验证；未实际运行的 Redis/MySQL/JWKS/upstream/浏览器/NetworkPolicy/跨进程链路继续 `NOT_RUNTIME_VERIFIED`。
