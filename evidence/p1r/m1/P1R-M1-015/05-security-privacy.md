# 安全与隐私证据

- provider callback 只接受 `SANDBOX_HMAC`，执行单 active key、ACTIVE-only、unknown/revoked/expired/overlap 全拒绝、rotation receipt 与审计要求；key material 禁止进入契约、日志和事件。
- tenant、主体、owner、SKU、金额、币种、订单、payment attempt、provider、结果与权限上下文均由服务端解析；客户端/Gateway 不能提交授权事实。
- callback replay、nonce/时间窗、同 provider event 不同 digest、乱序、金额或结果不匹配均失败关闭。
- activation 的 raw code、digest、digest prefix、signature、credential 和支付敏感原文均禁止进入事件、普通审计和公开投影。
- 两条新增 Gateway internal route 使用 B8WorkloadIdentity，外部访问 DENY；Gateway 不拥有商业 schema 或领域写入。
- reconciliation 的双人审批要求两个不同 IAM 主体和不可变 receipt，不能由客户端传入 approver/role/tenant 扩权。
