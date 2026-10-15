# Correction to candidate1 visual boundary claim

This new note withdraws the earlier candidate1 claim that button/control contrast passed. Original scripts, JSON, pictures and review remain unchanged for audit.

The H5 controls are uni-button custom hosts. visual-core.cjs queried native `button`, so its controls array was empty and every(...) vacuously passed. The measured text array included the heading/description but omitted button text. Therefore the ten saved pictures still establish actual state/copy/layout and their recorded no-overlay/raw-key/overflow facts; they do **not** establish button text or control boundary contrast.

The actual runtime-cancel product failure is independent of this selector error and remains valid: official addInterceptor invoke returned false, busy persisted after2200ms with no hide/alert. It was later actually retested and recovered on candidate2, not reclassified as a harness issue.

New candidate2/run2/visual-core.cjs uses `[role=button]` for the actual H5 hosts. That corrected visual script has NOT_RUN because official primary usage reached90%. Its future run must verify nonempty expected control counts, not merely every(...), before any boundary signature. No unexecuted correction upgrades the old result.
