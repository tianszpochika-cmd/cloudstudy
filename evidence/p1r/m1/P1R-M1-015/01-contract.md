# 契约与事件证据

- 专项治理固定 13 条 canonical route 与 9 条 commerce v2 canonical event；B5/B13 v1 保持 historical-only，禁止双发和重新晋升。
- 当前唯一 active provider 为 `SANDBOX_HMAC`；`productionPaymentEnabled=false`、`autoRenewalEnabled=false`、`liveProviders=[]`。
- callback 必须绑定 tenant/provider/providerEventId、订单、payment attempt、金额、币种和结果，并执行 HMAC、时间窗、nonce、单 active key、去重和同 event 不同 digest 冲突拒绝。
- activation 只允许短暂明文输入与 digest-only 持久化，原子一次兑换；raw code/hash/hash prefix 不得进入事件、审计或 entitlement source reference。
- entitlement 使用单调版本、invalidation、tombstone 与短时安全缓存；miss、expired、unknown、version mismatch 或撤销不确定均失败关闭，refund/revoke/expire/security/unknown 不得 grace。
- refund 固定 `FULL_ONLY`，只有已验证 settlement 才可触发撤销；reconciliation 恢复需要两个不同的服务端 IAM 主体、前置版本、审批收据与恢复收据。
- canonical 合并结果为 OpenAPI 403 operations / 706 schemas、175 events、34 AsyncAPI channels / 122 operations；B26 仅为 static binding。
