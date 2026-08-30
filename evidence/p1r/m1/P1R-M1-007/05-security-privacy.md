# 安全与隐私

- `eventId/rootEventId/causationEventId`、owner、aggregate 和 schemaVersion 均来自服务端可信边界；客户端身份、角色或审批字段不能取得事件或恢复权限。
- replay 和人工恢复绑定不可变 action digest、server-derived requester、独立 approver、策略版本、过期时间、审计 ID 与 pre/post reconciliation；自批、旧批准复用和跳过对账均失败关闭。
- workflow-service、audit-service、DLQ 工具和恢复操作不得直接写外域事实；禁止共享表、Kafka RPC、分布式 2PC 和回滚不可变源事实。
- receipt 与审计字段采用 allow-list；敏感凭据、Token、密码、私钥、真实手机号、原始音频、支付密文和未脱敏自由文本不进入策略、测试或 Evidence。
- B26 ACL 仍只是静态候选；真实身份、凭据和 broker 授权由 `P1R-M2-005` 验证。
