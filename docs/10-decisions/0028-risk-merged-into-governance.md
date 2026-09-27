# ADR-0028: RISK 并入治理页（无独立路由）

> 日期：2026-09-28；状态：已接受（Phase 1）；关联：目标“RISK 并入治理页”。

## 背景

PAGE-P1-ADMIN-RISK 登记为 canonical `/admin/risk`，但 router 无此路由（BLOCKED）；登记册要求“从治理/客服明确风险 case owner”，并留下 CONTRACT-GAP（risk case list/detail/decision operation），备注“可复用 executeB12ModerationCommand 需契约确认”。

## 决定

1. **UI 归属 = 治理页**（`/governance` 内风险区）。不新建 `/risk` 路由、不新建独立页；canonical `/admin/risk` 保持未路由（文档化为已合并）。
2. **B12 不复用**（契约确认结论）：B12 moderation 的事实是社交举报、决定是 START/RESOLVE/DISMISS/ESCALATE；风险案件的事实是告警/支付/账号/内容异常、决定是 TRIAGE/ISOLATE/UNISOLATE/ESCALATE/CLOSE。事实与决定集均不相交，复用会混淆审计语义。
3. **数据归属 = admin-ops-service**（ops 协调事实）：`risk_case` 表 + 决策历史；隔离/升级只记录 owner-flow 凭据引用（如内容下架命令号），永不跨服务执行域动作；升级 AUDIT 写本地审计（可查），升级 SUPPORT 记录意图与外部引用（support transition 通道未通，不伪造工单）。
4. **首个实时规则 = ACCOUNT_LOCKOUT**：IAM 锁定行是唯一可由测试真实触发的 Phase-1 风险信号。IAM 出最小披露只读端点（opaque subjectRef + 锁定态，staff 持 `admin.risk.read` 经“已验证 JWT + 现行权限重查” discipline）；admin-ops `rules:evaluate` 按（rule, subject, UTC 天）对开放案件去重建档；IAM 不可达则整轮评估 fail closed，不出部分结果。
5. ** staffing 权限**：`admin.risk.read/write`；预发布 staff 账号同样走成人门 + 同意（否则 IAM 按 P1-LIVE-006 剥离非学习许可，属既有正确行为）。

## 后果

- 新增公共操作 5 个（风险 4 + IAM 锁定 1），网关均挂既有 PREFIX 规则（admin-domain/iam-domain），rules/plans 计数不动，available 219→224。
- 后续：媒体/支付/导出规则、support transition 打通后的真升级、service-token 传输硬化。
