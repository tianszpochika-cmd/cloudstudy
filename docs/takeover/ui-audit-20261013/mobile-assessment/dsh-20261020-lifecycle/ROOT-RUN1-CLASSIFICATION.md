# Root run 1 — author classification note (does not modify Root evidence)

This note classifies `runs/codex-review-c3-lifecycle-1/` without changing any Root result, screenshot or manifest.

## same-owner-stale-get

- Root result file: `runs/codex-review-c3-lifecycle-1/same-owner-stale-get/results.json`
- Recorded: `BLOCKED_SETUP_INCOMPLETE`, 0 checks, setup failure `current.state.pending is not a function`.
- Classification: **harness/setup defect**, not a product PASS and not a product FAIL. The stale-GET behavior was never exercised.
- Repaired driver calls `current.pending()`; the old scripts are archived in `archive-root-run1/`.

## dirty-history-back

- Root result file: `runs/codex-review-c3-lifecycle-1/dirty-history-back/results.json`
- Recorded actual: `route=#/pages/login/login`, `confirmation=false`, `draftKept=false`; Root observed process exit 1 despite the written BLOCKED result.
- The run-1 JSON still carries the old author label `NOT_RUN` for this branch. That label is **superseded by this classification**, not by rewriting Root's file.
- Classification: **measured normal-H5 UX FAIL** — physical browser back from a selected question left the assessment route and lost the unsent draft without confirmation. This is real observed behavior, not an untested branch.
- Source-hook distinction: the path did not reach `assessment.vue`'s `onBackPress` callback, so this finding is about the measured H5 browser-back UX and does **not** prove the native/app `onBackPress` callback is defective. Both facts are kept.
- Repaired script now records `dirty-back-unsent-draft-lost-on-browser-back` as a product FAIL (exit 1), preserving the source-hook note. Product fix remains future work; C3 evidence stays FAIL until fixed.

## Exit status

- Root observed exit 1 for both BLOCKED results. The repaired lib/driver returns 2 for setup/incomplete and 1 only for a measured product FAIL. The run-1 exit status is historical and is not rewritten.
