# 可观测性

> v2 运行基线：OpenTelemetry 统一采集 Trace/Metrics/Logs，审计事件与业务事件分离但通过 requestId/traceId/eventId/decisionId 关联；目标与告警证据见 v2 微服务架构。

## 必备指标

- 登录、测评开始/完成、首课完成。
- 今日任务开始/完成和中断点。
- 练习提交、AI 成功率、schema 失败率、降级率。
- 反馈后重做率、复习完成率、七日和二十八日留存。
- API 延迟、队列积压、语音会话中断、供应商错误和成本估计。
- Gateway 路由命中/拒绝、401/403、限流、PDP 决策延迟、Outbox 积压、DLQ 数量、消费者延迟、重放和补偿结果。
- SLO、错误预算、RPO/RTO、备份恢复、容量和依赖漏洞/镜像 SBOM 状态。

## 日志要求

每条跨服务日志包含 requestId、traceId、service、environment、eventName 和 errorCode。敏感内容默认脱敏或不记录。

## 告警

优先告警学习主链路不可用、Gateway/IAM 不可用、PDP 延迟/拒绝异常、Outbox/DLQ 堆积、AI 降级率突增、数据写入失败、支付权益不一致和隐私删除任务失败。
