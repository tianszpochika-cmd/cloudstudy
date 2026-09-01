# 安全与隐私证据

- 三条 IAM v2 事件仅携带服务端组合的 bootstrap/资格/policy invalidation 事实；Token、密码、session、device、tenant、role、权限结论和原始同意布尔值不进 payload。
- `ELIGIBLE` 事件不授予访问；领域服务仍须对当前 JWT、owner/tenant/phase/rights/consent 执行 PEP/PDP。
- policy 版本、撤销或缓存无法证明为当前时必须 DENY；客户端/Gateway 权威字段不能放大权限。
- runtime promotion、B26 GO、M0-006 blocker wash、假 Evidence、缺 owner、历史 v1 晋升、dual publish 与 client producer 变异均被拒绝。
- 本任务没有处理生产凭据或真实用户数据。
