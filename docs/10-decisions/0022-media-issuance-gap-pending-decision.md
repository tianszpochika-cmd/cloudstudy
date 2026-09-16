# P1-LIVE-012：media 读取的签发缺口（待人类负责人产品/法务决策）

- 状态：PROPOSED（未执行任何改动；铸造同意声明需要人类判断）
- 日期：2026-09-16
- 发现：本地全栈活探（consented 学员 token 读种子 asset → 403 `MEDIA_CONSENT_REQUIRED`）

## 活实测结论

1. `MediaController.context()` 要求 JWT 内 `media_consent`/`consent` == true/granted；IAM 从不签发该声明 → 所有学员读全拒。
2. IAM 从不签发任何 `media:*` 权限；`MediaAccessPolicy.requireRead` 要 `media:read`（或别名）→ 即使补了同意仍会 `MEDIA_READ_FORBIDDEN`。
3. 即使补了前两项，种子 asset 的 owner 是种子用户，`MEDIA_OWNER_FORBIDDEN` 仍会拦（除非走 content-rights，而 IAM 也不签发 `content_rights`）。

## 为什么没有顺手修

把 `ADULT_LEARNING` 同意直接折算成 `media_consent=granted` 属于法律判断：media 同意可能是独立的 DRM/版权接受基础，伪造"已同意"比拒绝更危险。最小可逆动作（只加 `media:read` 权限）也走不完链路（owner 拦），单独做没有活验证价值。

## 请决策（三选一）

- A：确认 `ADULT_LEARNING` 覆盖 media 读取 → 我补签发 `media_consent` + `media:read` + 种子 asset 授权，活验证关单。
- B：media 同意是独立事项 → 需要新增同意类型 + 前端同意页 + 签发，排期到 M5-003 轮次。
- C：Phase 1 学员不直读 media（经 content-service 中介）→ 我验证 B3 中介链，direct-media 读保持拒绝并记为设计。
