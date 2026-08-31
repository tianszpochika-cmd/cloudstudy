# 契约与事件证据

- 专项治理固定 19 条 canonical operation、35 个 M1016 schema、8 条 canonical v2 event 和 5 条来源通知订阅；B11/B5/B13 v1 保持 historical-only，禁止双发和隐式晋升。
- `notification-service` 唯一拥有通知偏好、模板引用、消息、投递结果与读回执；偏好使用 `expectedVersion` CAS，模板参数、locale、channel、category、DND 与 frequency 均为闭合集合。
- Phase 1 channel 为 `IN_APP/PUSH/EMAIL/SMS`；SMS 仅允许验证码、安全、换绑和极重要账户/支付用途，学习催促、营销和未知用途失败关闭。
- 通知最多 5 次尝试（包含首次）；`workflow-service` 只拥有 retry/DLQ/replay/recovery 任务，不得回滚或覆盖 owner 事实。
- 通用同步只传递 `clientEventId/clientSeq/baseVersion/contentVersionId/payloadHash` 与受控冲突/恢复引用；真正写入仍走 owner-specific command，客户端不是 Kafka producer 或通用领域 writer。
- learner/admin support 共用 `admin-ops-service.support` 唯一 owner、七态状态机、七类分类、CAS、assignment/SLA history、受扫描脱敏内容引用、retention/legal hold 与审计收据；priority、tenant、identity、assignment、SLA 和状态均由服务端派生。
- canonical 合并结果为 OpenAPI 410 operations / 741 schemas、183 events / 133 payload schemas、42 AsyncAPI channels / 147 operations。
