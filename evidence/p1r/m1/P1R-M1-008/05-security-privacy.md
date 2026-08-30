# 安全与隐私

- actor、tenant、owner、role、permission、reviewer、版权与 Phase/feature Gate 均由服务端权威事实派生；客户端不能通过请求字段提升权限。
- FIRST 与 FINAL 审核阶段、reviewVersion、contentVersionId、contentHash、auditId 与 decidedAt 被结构化冻结；最终运行时仍须证明职责分离和不可变审计。
- 发布、排期、下线、回滚和内部 retirement 都需要 expected state/version、幂等和审计关联；未知命令、字段或状态组合失败关闭。
- public/learner projection 采用显式 allow-list，禁止答案规则、审核细节、内部版权证据、权限上下文和敏感字段进入公开响应或跨服务事件。
- B10 active pin 不允许用 fallback 改写已开始 session/attempt/report/mastery 的历史内容事实；紧急移除只返回结构化不可用原因。
- 静态 policy 中的 `NOT_RUNTIME_VERIFIED` 不能被未知 proof/status/attestation 字段晋升为运行或发布证明。
