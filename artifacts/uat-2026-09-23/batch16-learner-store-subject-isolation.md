# Batch 16 — learner content, B2, and B10 account isolation

## Findings

- `learner-content` persisted onboarding, placement draft, pending answers and tasks in one browser key without an account owner. Pending owner reads and writes could finish after A→B or A→logout→A and repopulate the new session.
- B2 persisted its review queue and checkpoint under shared keys. B10 had shared writing, practice, grammar, reading, vocabulary cache, sequence, and offline queue keys.

## Changes

- All three stores now use the IAM-verified subject and session `authGeneration` to identify the active session. Identity changes reset sensitive in-memory state; asynchronous callbacks check both subject and generation before applying results or errors.
- `learner-content` persists a subject-bound snapshot and discards old or mismatched snapshots. B2 wraps queue and checkpoint data with a subject. B10 wraps each stored draft, queue, sequence, and cache with a subject and removes known unowned legacy keys when first opened by a verified account.
- Logout and account switch clear local and live data in these stores. B10 keeps only the shared device performance setting, which is not a learner domain fact.
- Existing unowned drafts and offline queues are intentionally discarded because their owner cannot be verified.

## Verification

- `node --test apps/learner-web/tests/learner-store-subject-isolation.test.mjs`: **4/4 passed**. Covers A→B, A→logout→A with delayed owner responses, B2 queue/checkpoint, B10 writing/practice/grammar drafts and offline/reading storage.
- Combined with B1, C03/C04/C05 and B10 boundary tests: **27/27 passed**.
- `pnpm --filter @englishflow/learner-web build`: **passed**, including `vue-tsc`; existing Vite mixed import chunk notices remain.
- `git diff --check` for the three stores and new test: **passed**.

## Boundary

These are source and local behavior tests. The isolated Docker image and two real authenticated browser accounts have not yet been tested for this batch. Other learner-web stores outside B1, learner-content, B2, and B10 need their own account-isolation review.
