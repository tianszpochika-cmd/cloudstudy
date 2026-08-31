# 安全与隐私证据

- tenant、principal、device、owner、priority、assignment、SLA、state、delivery status、retention 和审计身份均由服务端可信上下文派生；客户端、Gateway 与 BFF 不能提交或覆盖。
- checker 对本地/外部/伪造 `$ref`、`allOf/oneOf/anyOf/not` 嵌套 authority、未知字段与未知枚举递归失败关闭。
- 通知 template 仅允许结构化参数和内部 deep-link；token、password、raw audio、payment credential 与未脱敏自由文本不得进入事件、普通日志或公开投影。
- support 描述、消息、截图与附件必须使用 SHA-256、redaction/scan/object version、授权引用和 safe preview；`PENDING/BLOCKED/ERROR/UNKNOWN` 均不得当作可用内容。
- learner/admin 路径使用同一 support owner 与状态机；历史 B13 create adapter 也必须执行默认拒绝、本地 PEP、SELF actor 和 `support.ticket.create.self`。
- legal hold 未知时清理失败关闭；关闭工单不能替代领域 owner 对账或直接修改订单、权益、学习、身份、内容和奖励事实。
