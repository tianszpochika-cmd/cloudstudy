# ADR-0014：Phase 1 客服与隐私编排事实所有权

- **状态**：accepted
- **日期**：2026-08-29
- **范围**：客服工单、隐私导出、账号注销/删除、工作流与审计边界

## 背景

既有需求、契约与代码把客服、隐私导出和账号删除分别提到 `learner-service`、`admin-ops-service`、`notification-service`、`workflow-service` 与 IAM，但目标架构此前只把 `admin-ops-service` 描述为 BFF，也没有明确隐私请求自身的 owner。继续保持模糊会造成学习者端与后台工单双表、workflow 跨库写入、删除流程只停用登录或多个服务都宣称拥有同一请求。

当前实现已经在 `admin-ops-service` 建立 `support_ticket` schema 和领域逻辑，在 `learner-service` 暴露自助隐私导出入口；账号、会话和主体生命周期由 `iam-service` 拥有。本 ADR 将这些现状收敛成 Phase 1 目标边界，不新增运行服务。

## 决策

1. `admin-ops-service.support` 是客服工单、ticket message、assignment、SLA 和 resolution 的唯一事实 owner。学习者 `/api/v1/support/tickets*` 与后台 `/api/v1/admin/ops/tickets*` 可以保留不同角色入口，但必须路由到同一 owner、schema、状态机和幂等规则。
2. `learner-service.privacy` 是隐私导出 request、status、expiry 和 receipt 的唯一事实 owner。它不跨库读取其他领域表；`workflow-service` 按请求协调各领域 owner 生成最小数据片段并收集 receipt。
3. `iam-service` 是账号注销/删除 request、冷静期、撤回和主体最终状态的唯一事实 owner。各领域服务只删除、匿名化或依法保留自己拥有的数据，并返回版本化 receipt。
4. `workflow-service` 只拥有 Saga、重试、补偿、DLQ 与人工恢复任务，不能直接修改客服、身份、学习、订单或其他领域表。
5. `audit-service` 或受控平台审计模块记录不可变审计，但不拥有业务状态。`notification-service` 只负责触达，不拥有工单或删除请求。
6. 客服不得复制或直接修改订单、权益、学习、身份、内容和奖励事实；恢复动作必须调用对应 owner 的受控命令并留下 command/task/audit ID。

## 被否决的方案

- **由 `workflow-service` 统一拥有工单、导出和删除事实**：会把编排器变成跨域业务服务，并诱发跨库写入。
- **由 `notification-service` 拥有客服工单**：消息投递与客服 case 生命周期不是同一事实边界。
- **立即增加独立 `support-service` 和 `privacy-service`**：Phase 1 当前规模和已有实现不足以证明新增两个服务的独立部署收益；未来若容量、组织或合规要求变化，须另立 ADR 并迁移。
- **学习者端和后台各存一套工单**：无法保证 SLA、消息、状态、审计和幂等一致。

## 影响与迁移要求

- 目标服务数量不变；`admin-ops-service` 的 BFF 能力与 `support` 子域必须在代码、包、schema、权限和观测上保持清晰边界。
- 现有 B5 learner support 与 B13 admin support 契约必须统一 ID、状态枚举、消息/附件模型、错误语义和路由映射；完成前标记 `CONTRACT-GAP-SUPPORT-ROUTING`。
- 隐私导出仍需补 status/download/expiry/receipt 和短时下载授权；完成前标记 `CONTRACT-GAP-PRIVACY-EXPORT`。
- 账号删除仍需补 request/cancel/status/execute OpenAPI、canonical 事件、参与 owner 清单、法律保留和部分失败恢复；完成前标记 `CONTRACT-GAP-PRIVACY-DELETION` 与相应 `EVENT-GAP`。
- 任何“已完成”声明都必须有当前提交下的 learner/admin 双端工单、导出、冷静期、跨 owner receipt、失败恢复、审计与越权拒绝 Evidence。

## 关联

- [Phase 1 业务运行设计包](../06-design/v2-980plus/phase1-business-operation/README.md)
- [v2 目标微服务架构](../02-architecture/v2-microservices-architecture.md)
- [ADR-0010：Java 25 与微服务/Gateway/IAM 架构](0010-java25-microservices-gateway-iam.md)
- [ADR-0013：自有 JWT 认证中心](0013-self-owned-jwt-authentication-center.md)
