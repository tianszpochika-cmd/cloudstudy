# ADR-0024：纯 UI 开户链的五处 UI/服务端契约错位（P1-LIVE-014）

- 状态：已接受（人类负责人全权委托执行，2026-09-16）
- 日期：2026-09-16
- 相关任务：`P1R-M4-001/003/004`（注册/门/画像目标）
- 缺陷：P1-LIVE-014（本地全栈活链路实测发现，五项；此前所有 API 探针都绕过了 UI）

## 背景

API 探针手工拼对了版本号/同意集/轮换/版本链，UI 代码里全是旧值——纯 UI 从零开户在第一步就断了，且静默（除第一处有 alert 外全是原地不动）。

## 五项修复（均在 `apps/learner-web`，服务端不动）

1. 门 policyVersion 默认值 `v2-phase1` → `b30-adult-v1`（`stores/session.ts`；与 UI 内既有 `b30-consent-v1` 硬编码惯例一致）。否则每次 `iam.adult_gate.policy_version_invalid`。
2. 门响应映射（`auth/gateway-auth.ts`）：服务端回 `{status: 'PASSED'}` 而非 `adultGate` 字段，`parseSnapshot` 读出 UNKNOWN 致流程卡第一步；`confirmAdultGate` 处显式映射。
3. 补 `ADULT_LEARNING` 同意 PUT（`api/learner-content.ts`）：服务端 `LEARNING_REQUIRED` 三缺一则所有 learner 端点永久 403；UI 原来只送隐私/条款。
4. 同意落地后轮换一次 token（同文件）：access token 签发时刻冻结，旧 token 仍是 UNKNOWN；借 HttpOnly cookie 自动携带做一次 refresh 再写画像。
5. 写操作串行链式传版本（同文件）：画像/目标/偏好共享同一 profile 版本计数，并行三写必有一 409；现 profile→target→preferences 串行，前一个回包版本喂给下一个。

## 后果

- `vue-tsc` 0 错误；新链 `scripts/runtime/p1r-live-onboarding.mjs` **6/6 PASS**（注册→门→目标→保存直达 `/assessment` 首道真题，全部写操作 200，零错误）。
- 证据：`evidence/live/2026-09-16/onboarding-live-evidence.json`。
