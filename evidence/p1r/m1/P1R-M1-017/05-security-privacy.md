# 安全与隐私证据

- principal、tenant、owner、consent、legal hold、retention、状态、执行时间和审批身份均由可信服务端上下文派生；客户端、Gateway 与 BFF 不能提交或覆盖。
- 隐私导出要求本人二次确认、异步状态、短时一次性下载授权、过期、脱敏、部分失败恢复和最小化 owner receipt。
- 账号删除固定 168 小时冷静期、取消/执行互斥、执行后会话撤销、合法保留、owner receipt、半失败恢复与最终对账。
- analytics 对 consent/delete suppression、结构化 allow-list、幂等、采样与 retention 引用失败关闭，禁止自由文本和高敏凭据。
- audit export 仅 internal-only，要求最小权限、purpose/approval、tenant scope、redaction、append-only 审计和恢复引用；`/v1/audit/exports`、未知路径、额外 schema 与 root runtime promotion 均被拒绝。
- 对抗审查发现的同步 source/canonical 绕过已修复：`rawBody`、`subjectId`、公开 audit export 与 `RUNTIME_VERIFIED` 注入均无法通过。
