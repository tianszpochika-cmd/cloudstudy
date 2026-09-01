# 契约与事件证据

- canonical OpenAPI 为 `427 operations / 783 schemas`；事件目录为 `191 events / 141 payload schemas`，其中 `50 canonical / 141 historical`；AsyncAPI 为 `50 channels / 184 operations`。
- 三条最小 IAM v2 事件为 `iam.account.bootstrap.created.v2`、`iam.learning_eligibility.changed.v2` 和 `iam.policy.security_state_changed.v2`，均由 `iam-service` 生产并按 aggregate ID 分区。
- B8 `auth.*.v1` 和 `iam.session.revoked.v1` 保持 historical-only；禁止 dual publish，Gateway/浏览器/客户端不是事件 producer/consumer。
- API response repair 从不可变 `97497af` 投影生成，精确冻结 76 个 response/status 节点与 `B9ScheduledPublishTaskResponse`；额外路径、schema、enum、authority 或错误包装漂移都失败关闭。
- 40 个已关闭记录的 `closureEvidence` 指向各 owner 的 canonical manifest，而不是用 M1-018 统一替换历史 owner。
