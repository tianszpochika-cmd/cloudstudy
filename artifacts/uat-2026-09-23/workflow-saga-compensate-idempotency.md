# B26 Saga 补偿请求幂等专项（2026-09-23）

## 已实现的边界

- `POST /api/v1/admin/recovery/sagas/{sagaId}/compensate` 要求 `Idempotency-Key`，只接受无 body 或空 JSON 对象。服务使用已验证 JWT 的 platform tenant 与 subject，把操作、sagaId 和规范请求体纳入 SHA-256 指纹。
- 本地 `workflow_request_idempotency` 唯一键先占位；同 actor、同键、同请求返回保存的 `sagaId` 响应，不再执行补偿；同键异 sagaId 或异 body 返回 409。首次请求执行前以 `SELECT ... FOR UPDATE` 锁定 saga 行，串行化同一 saga 的不同请求键。
- 当前 `CompensationTransport` 没有真实 owner 通道，会记录 `REFUSED_NO_TRANSPORT` 并让 saga 留在失败态，不把外部补偿伪报为成功。仅本地状态与响应的事务性请求幂等已覆盖；**真实跨服务补偿仍未完成**。

## 验证

- `mvn -q -f services/workflow-service/pom.xml test`：通过；专项覆盖同键重放、异 sagaId／body 409、锁定查询、非空 body 400、非待补偿状态 409。
- `pnpm contracts:merge:check`：通过；B26 路由已进入聚合契约。
- `pnpm contracts:validate`：B26 Saga 补偿缺口已越过；媒体上传地址已按无成功路径修正，当前全量契约校验通过。

## 仍需关闭

- 真实 owner 补偿需要 Saga/step 原子认领、稳定的下游幂等键和 owner receipt；外部调用成功但本地记账失败不能靠本地事务消除重发风险。当前 transport 继续失败关闭，不得宣称真实跨服务补偿可用。
- workflow 服务现按精确权限及 JWT 中的 `platform` tenant 放行恢复路由；正式 staff 权限发放与高风险动态撤销仍需闭环，不能把本地脚本直接改库视为生产授权流程。
- 尚未部署新版 workflow 服务，也未做真实 MySQL 并发或 Gateway 端到端复测。

## 服务侧权限变更独立审查

- 最新 `WorkflowSecurityConfiguration` 从 IAM 已验证的 `permissions` 字符串列表映射 `PERM_` 权限，校验 issuer、audience、时效及 `token_type=access`，并对四类内部路径实施默认拒绝：恢复申请需 `admin.recovery.request`，审批/拒绝/执行及 Saga 补偿需 `admin.recovery.command`，Saga 查询需 `admin.recovery.read`，内部 Saga 创建需 `workflow.saga.start`；四类还均要求 JWT `tenant_id=platform`。先前 Saga read/start 缺 tenant 检查的问题已由主任务补齐。
- B26 七条公开恢复路由的 `x-authorization.requiredPermission` 已与上述真实映射一致，只声明已核对的 JWT 主体、租户和权限事实。服务代码没有额外 staff 角色、资源 owner、策略版本或实时会话撤销判断，契约不把这些标成已实现。
- 七条权限映射静态核对 7/7 通过；`pnpm contracts:merge`、`pnpm contracts:merge:check`、`pnpm contracts:validate` 均通过。首次 `pnpm contracts:generate:check` 检出生成文件漂移，运行 `pnpm contracts:generate` 后复核通过。
- **正式授权与兼容缺口**：IAM 普通注册明确不发 `admin.*`；仓库内的本地恢复脚本直接更新 `iam_account` 来构造 staff 账号，未发现可用于正式部署的 staff 授权流程。没有这类已签发权限的管理端请求会安全地返回 403。`workflow.saga.start` 仅在服务侧出现，既无 Gateway 公开投影也无 IAM 发放事实；当前服务令牌因 `token_type=service` 被拒绝，内部 Saga 创建不能算可用。
- **高风险边界**：本次 PEP 使用已签发 JWT 内的静态权限；未核验当前会话撤销或策略版本。IAM 默认 access token TTL 为 15 分钟，管理员权限撤销后的旧令牌窗口仍需正式 fail-closed 设计。现有 workflow 测试直接调用控制器，没有经过 SecurityFilterChain 的缺 token、缺权限、错 tenant、错路径和成功授权 HTTP 矩阵；Maven 测试通过不能替代该矩阵或部署后复测。
