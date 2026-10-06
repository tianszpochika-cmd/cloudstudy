# R1-002 Outbox 扩围提案（主审收口，未实施）

## 已校正的契约口径

- topic：`platform.iam.v1`；eventName：`iam.account.bootstrap.created.v2`；schema/schemaVersion：`iam.event.v2`；version：2。
- producer：IAM；账号与必要审计/Outbox 在同一本地事务内提交，relay 异步、至少一次投递，消费端去重。Gateway、客户端不生产该事实；不 dual publish 旧 B8 事件。
- auditId：调用方创建并保留同一个 `AuditDecision`，审计与 Outbox 共用 `decision.decisionId().toString()`。`JdbcAuditFactPort.append` 返回 void，不存在 INSERT 返回生成键。
- 初次 bootstrap 的 aggregateVersion=1，bootstrapState=`PENDING_ELIGIBILITY`，bootstrapReason=`SELF_REGISTERED_ADULT_CANDIDATE`。createdAt/occurredAt 取同一次创建事实时间，不能取 relay 重试时间。
- eventId 在本地事务中生成并持久化，重发沿用；dedupeKey 派生输入须符合 canonical pattern、避免泄露原始注册标识/密码/幂等秘密。traceId/requestId 按事件 envelope 的正则核验，不能假定 HTTP meta 值天然符合。actorId、aggregateId 与 principalId 的表示关系须统一签收。

## 保持待决的身份兼容事项

现有 PrincipalId/JWT/数据库路径使用裸 UUID，M1-018 payload 要求 `prn_` 格式。仅给事件字符串加前缀，或全局改变 PrincipalId.toString，都不能证明 owner、JWT 与 learner 投影仍一致。

进入实现前应签收一个显式的表示/映射方案，覆盖 canonical 事件、IAM 内部 ID、JWT subject/owner、learner 消费与 PEP；或走正式契约变更流程。此次审查没有改变正式契约或核心身份设计，该事项仍阻塞 READY。禁止把“文档已指出冲突”记为冲突关闭。

## 拟实施文件范围（未授权修改）

除原卡四文件外，提案至少覆盖 V19 Outbox migration、append/claim/ack/retry port 与 JDBC adapter、relay、IAM runtime Bean/事务装配、事件配置属性与 application.yaml、必要 Maven Kafka 依赖、审计 decisionId 传播、数据库集成及 relay 负例测试。

根审需结合身份决议确定精确文件清单，再更新 task-specs 与生成卡片。当前只保留提案，不更改文件授权、不提前实现其它 IAM 事件，不要求在本卡完成 learner 全量消费集成。

## 运行缺口

本次独立 GET 确认自有 Gateway→IAM JWKS 转发返回 502。SCG 路由 HTTP client 与 GatewayIamPublicJwkSource 自建 WebClient 是两条信任链；一个客户端配置测试 CA 不证明另一个客户端能取钥。后续须分别提供保持主机名验证的 HTTPS 信任配置及运行证据。JWT issuer 保持原标识 `http://127.0.0.1:18087`，与 HTTPS 传输地址分开。

完整事件样例及 canonical envelope/payload 校验仍待身份表示签收，不能声称静态校验或 Kafka producer 已通过。
