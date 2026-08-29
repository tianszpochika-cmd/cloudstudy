# 安全与隐私

- 事件范围仅允许跨服务集成事实，禁止 UI telemetry、日志、指标、同步 RPC、命令或数据库复制冒充 canonical 事件。
- payload schema、schemaVersion、producer、data owner、consumer group、topic 和 aggregate partition key 均受严格校验；未知字段、重复项及 runtime-like 声明失败关闭。
- B26 ACL 只是静态契约，未声称真实 broker 授权已部署；真实凭据、topic 与 ACL 由 `P1R-M2-005` 验证。
- Evidence 与测试未包含密码、Token、私钥、真实手机号、原始音频、支付密文或未脱敏自由文本。
