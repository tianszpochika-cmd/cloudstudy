# 安全与隐私边界

客户端不能提交 tenant、owner、adult gate、policy、score 或答案规则权威事实。服务端 PEP 默认拒绝，且 canonical audit/log 边界锁定敏感字段。

submit 与 checkpoint 的 `x-audit.redacted` 精确覆盖 response digest、五类原始答案载荷以及 protected draft 边界；旧 `.response` 假路径被失败关闭。历史事件和审计中禁止 raw response、answer key/rule、recording、AI/mastery authority、官方认证、官方题库、全国百分位和权威作弊结论。

主观 self-rating/manual review 不得伪装为客观 outcome；assessment report 不获得 learning mastery、SRS、reward 或 ban 的 owner 权限。
