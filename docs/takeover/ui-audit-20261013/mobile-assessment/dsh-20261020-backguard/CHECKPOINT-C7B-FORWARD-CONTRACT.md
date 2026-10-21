# CHECKPOINT — C7b forward auto-cancel contract (2026-10-21)

**Named scope:** `MB006_BACKGUARD_C7B_FORWARD_CONTRACT`

Status: prepared only; no browser/product/server/Git action. No PASS claimed. Source freeze
remains C7b `37bad477e4239061972941c42b24468db5994b8afb89feb61f720fbe168c07e5`.

## Change

- `runRepeatDismiss` after forward now accepts **0 or 1** prompt for both `repeat-back`
  (cancel) and `repeat-back-confirm`, not only confirm.
- Forward still requires the visible assessment question/root, selected A, assessment URL,
  and zero `respond`/`retest`/`ensure` writes.
- If the prompt auto-canceled, the cancel path no longer skips assertions: it requires the
  same original question, correct assessment URL, `assessment-submit` focus, A preserved,
  zero writes, and no phantom prompt.
- The confirm auto-cancel branch retains fresh real browser back + confirm and requires a
  real departure. Native-dialog, unknown-API, source-hash, and genuine-departure failure
  criteria are unchanged.

## Files / evidence

- Modified: `run.cjs` — sha256
  `672c4b82fcb8ffe5b74f50d66acb6f336dd84d2b2aab64d4a2158536f32015fd`.
- Updated: `PREP-20261021.md`.
- Archived: `archive/pre-forward-cancel-contract-20261021/run.cjs` — sha256
  `0d5d714ace43cedcc1069f5378f674bdb63e542bfba41c4d82366563c52056e8`.
- Existing `runs/` untouched. No refreeze, no browser spawn/probe.

`[实测] node --check` → `SYNTAX_OK`; page raw remains C7b `37bad477e4239061972941c42b24468db5994b8afb89feb61f720fbe168c07e5`.
