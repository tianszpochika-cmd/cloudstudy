# 契约与事件证据

- 专项治理固定 17 条 canonical operation 与 5 条 canonical v2 event；canonical 合并结果为 OpenAPI `427 operations / 783 schemas`、`188 events / 138 payload schemas`、AsyncAPI `47 channels / 165 operations`。
- `learner-service.privacy` 唯一拥有隐私导出 request/status/receipt；受控 owner fragment 只能通过 workflow 协调，不能复制原始事实。
- `iam-service` 唯一拥有账号删除 request、cancel、execute 和 principal 最终状态；冷静期固定为 168 小时，各领域 owner 只返回删除/匿名化 receipt。
- analytics ingress 只接受闭合 allow-list，并执行 consent/delete suppression、幂等、采样与 retention policy 引用；UI telemetry 不得冒充 Kafka 领域事实。
- audit export 仅允许四条 `/internal/v1/audit/exports*` 内部操作，要求 purpose、approval、tenant scope、redaction、短时一次性下载和 append-only receipt，不存在公开创建旁路。
- Token、密码、原始音频、支付凭据、对象字节、未脱敏自由文本、`rawBody` 与可直接定位主体的裸字段不得进入普通事件、日志或导出投影。
