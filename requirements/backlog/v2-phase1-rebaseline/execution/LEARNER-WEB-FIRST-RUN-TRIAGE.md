# learner-web 首次运行旅程排查（2026-09-13，第 24 轮）

方法：用真实浏览器驱动 `learner-web` 的注册→登录→首次运行旅程（**先验证再动手**）。所有结论均为 `[实测]`，除注明者。

## 修复 1：`CONSENT_REQUIRED` 被当作"无权限"，把新学习者困死

### 症状

strangler 开启、账号刚注册并登录后：

```
200 /api/v1/auth/login
200 /api/v1/iam/permissions
403 /api/v1/learner/profile
403 /api/v1/learner/targets
403 /api/v1/learner/preferences
→ http://127.0.0.1:18180/forbidden?from=/onboarding?redirect=/home
页面标题：暂时没有访问权限
```

学习者被从** onboarding 页面**弹到 **forbidden 页面**，**首次运行旅程无法继续**。

### 根因（两段，均已实测）

1. **后端行为是正确的**：403 的响应体是
   `{"error":{"message":"learner operation denied: CONSENT_REQUIRED","code":"CONSENT_REQUIRED","retryable":false}}`
   —— `CONSENT_REQUIRED` 是 `LearnerDecisionCode` 中**唯一**表示"前置步骤未完成"的码（其余均为真实拒绝），尚未同意时拒绝 profile/targets/preferences 是**正确的 fail-closed** ✓
2. **前端忽略了该码**：`apps/learner-web/src/stores/session.ts` 的 `handleForbidden` **对所有 403 一律** `router.replace({ name: 'forbidden' })` ✗ —— 信息就在响应里，只是没被读。

### 修复

`handleForbidden` 现在先取域名决策码；`CONSENT_REQUIRED` 时**留在 onboarding**（并保留 `redirect`），其余仍走 forbidden ✓

### 验证

| | 修复前 | 修复后 |
|---|---|---|
| 登录后 URL | `/forbidden?from=/onboarding?redirect=/home` ✗ | **`/onboarding?redirect=/home`** ✓ |
| 页面 | 暂时没有访问权限 ✗ | **欢迎来到语学星 / 先确认你可以安心开始** ✓ |

## 修复 2：两个前端都调用了契约里不存在的路径

`learner-web` 与 `mobile` 都请求 **`/api/v1/learner/onboarding/options`**，而契约声明的是 **`/api/v1/onboarding/options`** ✗
（`onboarding-domain` 规则的 owner 是 `learner-service` ✓ 路径本就**不带 `/learner`** ✓）

同一文件里相邻的 `taskEnsureCommand: '/onboarding/daily-tasks/ensure'` 写法是**正确的** ✓ ⇒ 判定为**笔误**（`[读取]`）。

修复后：`200 /api/v1/onboarding/options` ✓，页面错误数 **6 → 4**（只剩正确的 403 与预期的 401）✓

**顺带修正两个钉住错误路径的测试**（`apps/mobile/tests/c02-*.test.mjs`、`apps/learner-web/tests/c02-*.test.mjs`），改为断言契约正确的路径**并显式断言不含 `/learner/` 前缀** ✓

## ⚠️ 已登记未修的发现：未匹配路由的 404/403 **不带 CORS 头**

`[实测]` 覆盖矩阵（`Origin: http://127.0.0.1:18180`）：

| 情况 | 状态 | `Access-Control-Allow-Origin` |
|---|---|---|
| 匹配·无令牌 | 401 | **有** ✓ |
| 匹配·公开读 | 200 | **有** ✓ |
| 未匹配路径 | 404 | **无** ✗ |
| withhold 路由 | 404 | **无** ✗ |
| `/internal/**` | 404 | **无** ✗ |
| **未匹配路径的 preflight** | **403** | **无** ✗ |

**影响**：**无访问控制影响**（全部是拒绝）✓ 代价是**可诊断性** —— 浏览器读不到响应体，只能报 CORS 错误而非"路由不存在"；preflight 的 403 缺头更会把人引向排查 CORS 配置 ✗

**本轮已实际遭遇**：修复 2 的那个错误路径原本就表现为一条 CORS 错误，把真实的 404 掩盖了 ✓ 这正是该缺口的实际代价。

**未修原因**：位于 `M2-001` 的已验收网关边界，属契约/治理面变更，应与独立评审一同进行（与第 20–22 轮的经验一致）。

## 未覆盖

- `admin-web`、`official-site` 的同等旅程尚未驱动
- `learner-web` 的 2 项既有测试失败（`#19 登出后跳转`、`#32 评估链 owner/idempotency`）与本次改动无关（已用 stash 对照确认），待单独排查
