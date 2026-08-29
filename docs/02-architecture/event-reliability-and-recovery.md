# Phase 1 事件可靠性与恢复契约

> 状态：`D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`  
> 任务：`P1R-M1-007`  
> 本文解释契约如何运作，不代表 Kafka、Outbox、consumer、Saga 或人工恢复已经在线运行。

## 1. 单一事实源与边界

| 内容                                                                     | 唯一事实源                                             | 当前结论                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------ | ----------------------------------- |
| 事件名称、producer/data owner、consumer group、topic、partition、payload | `packages/contracts/events/v1/catalog.json`            | M1-006 D2，运行未验证               |
| Outbox、消费去重、重试、DLQ、replay、顺序和回执                          | `packages/contracts/events/v1/reliability-policy.json` | M1-007 D2                           |
| Saga、补偿、双人审批、对账、人工恢复与关闭                               | `config/p1r-saga-recovery.v1.json`                     | M1-007 D2                           |
| 可靠性、回执与恢复记录结构                                               | `packages/contracts/schemas/v1/registry.json`          | 8 个新增闭合 Schema                 |
| B26                                                                      | `config/b26-event-runtime.json`                        | 仅历史静态候选，`pending` / `NO-GO` |

M1-007 不改写 M1-006 已接受的 v1 事件 wire contract。`rootEventId`、`causationEventId` 与 `aggregateVersion` 在 owner 的 Outbox 边界形成补充可靠性记录；后续事件版本若要把它们加入 wire envelope，必须走独立兼容性决策。

## 2. 端到端处理顺序

```text
客户端命令
  → Gateway / IAM / 领域服务 PEP
  → owner 在一个 MySQL 事务中写领域事实 + 带 payload digest 的 immutable Outbox
  → publisher 取得有时限的 lease
  → Kafka broker ack 后 Outbox 才能 PUBLISHED
  → consumer 按 aggregateId 分区接收
  → consumer 在自己的事务中写领域 effect + dedupe receipt
  → 事务提交后再提交 offset
  → 超预算或不可重试错误进入 immutable DLQ
  → 独立审批后从原记录经同 consumer group/path 回放
  → 仍不能自动收敛时进入 Saga 补偿或人工恢复
```

投递语义是“至少一次”。publisher 在 broker 已接收但本地尚未标记时崩溃，允许用同一 `eventId` 重发；consumer 必须依靠 `(consumerGroup,eventId)` 防止第二次领域写入。任何 exactly-once 声明都不成立。

## 3. 身份与因果链

- 原始事实：`rootEventId = eventId`，`causationEventId = null`。
- 派生控制事件：生成新的 `eventId`，继承源 `rootEventId`，并令 `causationEventId` 指向直接来源事件。
- retry：保留 event/root/causation/aggregate version/schema/dedupe 全部身份。
- replay：保留源事件名、root、聚合、schema、topic、partition、dedupe 与 payload digest，另生成 `replayRunId`；描述回放动作的控制事件使用新的 `eventId`。
- 客户端不得提供或改写上述身份、actor、tenant、角色、权限或 approver 事实。

B26 的旧静态候选只声明 `payload.aggregateVersion`，也没有 `rootEventId`。M2 实现前，owner adapter 必须把它们转换为规范的 reliability context；静态候选本身不能被升级为运行证据。

## 4. 状态机

### Outbox

```text
PENDING --claim--> PUBLISHING --broker ack--> PUBLISHED
                         |
                         +--retryable/under budget--> RETRY_WAIT --due+lease--> PUBLISHING
                         |
                         +--non-retryable/exhausted--> DLQ
```

`PUBLISHED` 与 `DLQ` 是终态。lease 为 30 秒，可在过期后由并发 publisher 安全重新取得；该行为仍需 M2-004/005 在真实 MySQL 与 Kafka 中验证。

### Consumer

```text
RECEIVED --claim--> PROCESSING --effect+receipt commit--> APPLIED
                         |
                         +--existing applied receipt--> DUPLICATE_SKIPPED
                         +--retryable/under budget--> RETRY_WAIT --due+lease--> PROCESSING
                         +--non-retryable/exhausted--> DLQ
```

重试预算包含首次处理，最多 5 次；采用指数退避加 jitter，延迟范围 1–60 秒。未知错误按不可重试处理并失败关闭。

## 5. Replay、Saga 与人工恢复

- Replay 只读取 immutable Outbox/DLQ 来源，继续使用原 consumer group/path、schema、顺序检查和去重；单批最多 1000 条。
- 请求者需要 `event.replay.request`，审批者需要 `event.replay.approve`，两者必须是不同的、由服务端派生的 principal。
- workflow-service 只编排；补偿必须由目标领域 owner 通过版本化 API 或 canonical event 幂等执行并返回 receipt。workflow/audit 都不能直接写其他 owner schema。
- 人工恢复必须经过预对账、待双人审批、执行、后对账；closure receipt 必须同时绑定 `APPROVED` 决定、后对账 `MATCHED`、owner receipts 与 immutable audit 后才可声明 `CLOSED`。关闭工单或 DLQ 不等于业务已对账。

## 6. 可靠性记录与回执

共享 registry 冻结以下闭合结构，全部 `additionalProperties=false`：

- event reliability context；
- owner-local transactional Outbox record；
- Outbox publish receipt；
- consumer effect/dedupe receipt；
- immutable DLQ record；
- approved replay request；
- workflow recovery task；
- recovery closure receipt。

回执只保存必要标识、版本、结果摘要和 audit 引用，不保存 token、Cookie、授权头、密码、原始音频/答案或支付凭据。D2 Evidence 只能证明这些结构和规则存在，不能伪造任何实际 receipt 已产生。

## 7. 后续运行验收

- `P1R-M2-004`：真实 owner schema、事务、凭据、Outbox/lease 与隔离。
- `P1R-M2-005`：真实 Kafka topic/ACL/ack、publisher crash、consumer 重复/乱序/rebalance、DLQ 与无重复 effect 回放。
- `P1R-M2-006`：真实 Saga、版本化补偿、任务 lease、双人审批、人工恢复、对账、receipt 与不可变 audit。
- `P1R-M8-006/011/012`：端到端故障注入、恢复演练与灾备 Evidence。

静态自检入口：

```powershell
pnpm p1r:event-reliability:check
pnpm p1r:saga-recovery:check
pnpm contracts:validate
pnpm test:p1r
```
