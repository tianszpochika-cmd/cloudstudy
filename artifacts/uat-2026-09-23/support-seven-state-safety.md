# 客服七态链安全收口（2026-09-23）

## 结论

M1-016 的七态契约已存在，但本轮源码还不能完成真实的提交→接单→回复→升级/解决→确认/重开链，状态仍为 `NOT_RUNTIME_VERIFIED`。现有学习者请求只把描述做 SHA-256 后发送，客服无法读取问题；现有服务没有签发和核验 `CLEAN` 内容引用的 owner，也没有跨域处理的 `ownerResultRef` 回执。继续让旧建单或转移 API 返回成功会产生无法处理的工单，因此公开映射到旧 `SupportController` 的写入口对有效旧格式请求返回 `503 SUPPORT_CONTENT_REFERENCE_UNAVAILABLE`，无效请求仍由参数校验拒绝。没有调用旧 `SupportTicketService` 写入、通知转发或审计。

## 本轮源码修复

| 范围 | 结果 |
| --- | --- |
| 学习者 Web 与移动端 | 移除描述哈希建单和未接通重开交互；显示简短不可用提示和只读历史列表；读取失败时清除过期列表 |
| 管理端 | 继续只读；明确历史工单不可处理，兼容七态/七类标签但不提供命令按钮 |
| 旧合成数据 | JDBC 将无效历史分类映射为 `LEGACY_UNMAPPED`，保留行的只读可见性；不改写旧行或真实/混合数据。API 标记 `workflowVersion=LEGACY_HASH_ONLY`、`actionable=false`，不把旧 101 行当作七态可操作队列 |
| 并发 | 旧 owner store 的更新增加 `ticket_version` 条件 CAS；过期更新返回 409，内存实现同规则 |
| 七态规则 | 新增独立 `OPEN/ASSIGNED/WAITING_USER/WAITING_INTERNAL/RESOLVED/CLOSED/REOPENED` 转移策略和单测，拒绝过期版本、未经核验的内容/owner 回执、越权确认、超窗重开和无对账关闭；当前规则尚未接入生产写链 |

## 验证

- `mvn -f services/admin-ops-service/pom.xml -Dtest=!AdminOpsJwtDecoderNegativeTest test`：通过，包含本轮状态机、CAS、旧分类及控制器拒绝测试；2 项原有条件测试跳过。
- 无排除的完整 Maven 测试：65 执行、0 断言失败、1 环境错误、2 跳过。错误为 `AdminOpsJwtDecoderNegativeTest` 在本机创建 JWKS loopback HTTP server 时 `Unable to establish loopback connection`，与客服代码无关；不把完整套件记录为通过。
- 学习者 Web、移动端、管理端的类型检查和生产构建通过；`pnpm p1r:notification-sync-support-contract:check` 通过，并明确报告 `runtimeStatus=NOT_RUNTIME_VERIFIED`；`git diff --check` 通过。
- 本轮未重启服务、未重建 Docker、未对数据库执行迁移/种子/写入，也没有使用真实工单进行操作。因此运行中的旧实例仍可能显示旧页面或旧行为，部署后必须复测写入口 503 和历史列表读取。

## 未关闭的依赖与路由

1. 需要一个服务端签发、扫描、脱敏并核验的内容引用 owner。客户端不得自行声明 `scanStatus=CLEAN`；客服消息和解决说明均须走这一入口。当前无可复用端口。
2. 需要 IAM 签发/服务端核对 learner self read/message/confirm/reopen 与 staff read/command/message 权限。当前成人 learner JWT 只见 `support.ticket.create`，不能把客户端角色头当权限。
3. 需要 admin-ops 同一 owner 的七态持久化、消息/指派/SLA/留存历史及原子 CAS+审计+幂等；本轮纯规则与旧存储 CAS 尚不足以构成正式写链。旧行应继续与新队列隔离。
4. 跨域升级和解决需要 owner 处理回执/对账；未收到或受法务保留时，解决/关闭须失败。超时关闭和重开窗口还需明确策略版本。
5. 上述服务入口存在并通过验证后，再向 Gateway 执行策略增加 learner `/api/v1/support/tickets/{ticketId}/messages` GET/POST、`/{ticketId}/confirm` POST、`/{ticketId}/reopen` POST，及 admin `/api/v1/admin/ops/tickets/{ticketId}/messages` GET/POST、`/{ticketId}/commands` POST，并将现有 ticket GET/POST 改连正式 owner 处理器。B13 已含部分 M1-016 admin 契约，B5 有 learner 消息 POST；扩展现有源片段，避免重复 path 覆盖。
