# R1-027 定级按已接收检查点续答

日期：2026-10-10。分支：`dev-redesign`。卡：R1-027 / BC-022。Owner 表面：learner-web。依赖：R1-020 已在工作区。

状态：已有 `asess_` 会话时，Web 与 Mobile 定级页先 GET 该会话，停在 `acceptedSequence` 的下一道未提交题，不新建会话。提交走已有 `POST /api/v1/assessment/placement/sessions/{sessionId}/responses`，带上读到的 `stateVersion`。409 先重新 GET，只在检查点未变时用原幂等键重试一次。未提交的选择不写入 localStorage，也不当成已保存。**不是 ACCEPTED，也不是 IT-2 出站。** 没有 commit，没有 push。本卡没有改 `CURRENT-PROGRESS.md`。没有浏览器走查，没有实机 PASS。没有改 `services/**`、`packages/contracts/**`、`evidence/redesign/2026-10-10/R1-021/**`。

## 行为

学习端网关基址已经是 `/api/v1`。客户端路径是 `/assessment/placement/sessions`、`/assessment/placement/sessions/{sessionId}` 和 `/assessment/placement/sessions/{sessionId}/responses`。

本地只保留 `asess_` 会话号，用来下次 GET。答案、选项、待提交队列和题干不写入 localStorage。DEC-05 未批，没有做完整离线，页面没有「已存本机」或「可离线答完」。

进入定级：

1. 已有 `asess_` 会话号时只 GET。读口的 `acceptedSequence` 是已接收题序，下一题优先用 `currentItem` / `nextItem`，否则用 `nextSequence`（缺省时为 `acceptedSequence + 1`）在 `items` 里按 `displayOrder` 或 `itemSequence` 取题。不会在已有进度时退回第 1 题。
2. 没有 `asess_` 会话号时才 `POST /assessment/placement/sessions`。恢复时 GET 失败也不再 POST。显式「重新开始」仍可以新开一套，那不是续答。
3. 10 题都已接收、读口没有下一题、也没有报告时，页面说明进度在服务端，重新读取不会新开一套。不编造分数，不把这种会话当成 `EMPTY` 再 POST。判分仍是 R1-021。

提交 body 只有 `expectedStateVersion`、`itemId`、`itemSequence`、`candidateResponse`、`responseDigest`、`timeSpentSec`。`expectedStateVersion` 是这次读到的版本。`responseDigest` 是 `[sessionId, itemId, itemSequence, candidateResponse]` 的 SHA-256 小写十六进制。请求带 `Idempotency-Key`，不带 `If-Match`。幂等键在一次点击里生成，409 处理内部不换新键。

409：先 GET。服务端 `acceptedSequence` 已经盖过这次题序，就采用服务端检查点，不再 POST。版本、题序和题目都没变，用原键、原 body 再 POST 一次。这次仍是 409，再 GET 一次后停止。版本或题目已经变、但这道题还没被接收，停止在服务端当前题上，不把旧 body 配新版本重发。网络失败和缺少检查点都不 POST 成新进度，本地选择也不记成已保存。

## 改动文件

本卡的定级续答落在：

- `apps/learner-web/src/domain/b1.ts`
- `apps/learner-web/src/domain/learner-content.ts`
- `apps/learner-web/src/api/learner-content.ts`
- `apps/learner-web/src/stores/learner-content.ts`
- `apps/learner-web/src/pages/AssessmentPage.vue`
- `apps/learner-web/tests/c04-assessment-chain.test.mjs`
- `apps/learner-web/tests/placement-checkpoint-resume.test.mjs`
- `apps/mobile/src/domain/learner-content.ts`
- `apps/mobile/src/api/learner-content.ts`
- `apps/mobile/src/stores/learner-content.ts`
- `apps/mobile/src/pages/assessment/assessment.vue`
- `apps/mobile/tests/c04-assessment-chain.test.mjs`
- `apps/mobile/tests/placement-checkpoint-resume.test.mjs`
- `evidence/redesign/2026-10-10/R1-027/report.md`

`learner-store-subject-isolation.test.mjs` 和 `mobile-learning-account-scope.test.mjs` 只补了这些 store 新增依赖的测试桩。向导选步、三条必要同意、注册、登录、重置文案没有在本卡里改。工作区里那些页面以及 services、contracts、R1-021 证据上的其他差量不是本卡改的。

## 验证

没有起服务，没有打 MySQL，没有浏览器走查。

```text
cd /Users/Admin/Desktop/work/cloudstudy/apps/learner-web && node --test tests/placement-score-units.test.mjs tests/c04-assessment-chain.test.mjs tests/onboarding-resume.test.mjs tests/placement-checkpoint-resume.test.mjs tests/learner-store-subject-isolation.test.mjs
exit 0
tests 32, pass 32, fail 0
```

```text
cd /Users/Admin/Desktop/work/cloudstudy/apps/mobile && node --test tests/placement-score-units.test.mjs tests/c04-assessment-chain.test.mjs tests/onboarding-resume-step.test.mjs tests/mobile-learning-account-scope.test.mjs tests/placement-checkpoint-resume.test.mjs
exit 0
tests 39, pass 39, fail 0
```

`placement-checkpoint-resume` 覆盖：已接收 3 题时下一题是第 4 题而不是第 1 题；只有 `asess_` 会话号才 GET，没有会话号才 POST；提交 body 带读到的 `stateVersion`，摘要为 64 位小写十六进制，无 `If-Match`；检查点未变的 409 用原键重试一次，第二次 409 停止；服务端已经接收或版本已变时不再 POST；本地选择和待提交队列不写回；10 题都已接收时不新开会话。命令原文在 `/tmp/r1-027-review.md`。

## 没有 PASS 的部分

- 没有浏览器或真机走查。页面上的续答、409 和「定级进度在服务端」没有实机 PASS。
- 没有把 V9 打到真实 MySQL，也没有跑判分。10 题都接收后的无答案会话仍是 `IN_PROGRESS`，没有报告。那是 R1-021。
- 读口和回执上的 `acceptedSequence`、`nextSequence` 不在已发布的 `B10PlacementSession` / `B10PlacementResponseReceipt` 里。契约文件没有改。
- `apps/learner-web/src/api/b1.ts` 仍向 `/assessment/placement/submit-step` 提交，`apps/learner-web/src/stores/b1.ts` 仍按本地答案推进。定级页用的是 learner-content store，不是这条旧链。
- `apps/mobile/tests/b10/b10-mobile-contract.test.mjs` 仍期望 `query('/assessment/placement/start', ...)`。本卡没有跑它，也没有把开题改回旧路径。
- 快速定级失败文案仍有「快速定级已保存在本地」。那不是本卡禁止的「已存本机」或「可离线答完」，也不是逐题续答。
- 不是 Luna 独立终审，不是 IT-2 出站，也不是 L2 干净库重放。
