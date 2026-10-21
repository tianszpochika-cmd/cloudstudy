# C2 en-US / dark / 320×568 / CSS text 200% — `BLOCKED_BROWSER_LAUNCH`

Status recorded 2026-10-20 ~22:20 +08:00. This file classifies the C2 re-verification attempt. It is **not** a product FAIL and **not** a title PASS.

## Frozen candidate under test

| file | raw SHA-256 |
|---|---|
| `apps/mobile/src/pages/assessment/assessment.vue` | `d1b501e33b313679bd5c90dd8fcda8e9a5a6b790856a444b01e915523827366a` |
| `packages/i18n/src/mobile-experience.ts` | `44e4c857868f8be2bac17f7da86f43c9ea0d03eaaadd3a3f154414d02f129c64` |

## What was actually observed before the block

- `[实测 22:07 netstat]` 18183 LISTENING PID 37496; 18180 LISTENING PID 42932 — matches the Root-started sessions (no restart, no port change).
- `[实测 22:08 Invoke-WebRequest]` Vite dev serves the current module: `GET /@fs/.../packages/i18n/src/mobile-experience.ts` → 200, 83725 bytes, contains `Level check` ×1 and `Your result` ×2, and no `Level assessment` / `Assessment result`. This proves the running dev server serves C2 i18n; it does **not** prove the 200% title layout.
- `[实测 22:09 node c2-text200.cjs]` `browserType.launch: spawn EPERM` — Playwright Chromium could not be started from this DSH workspace-write session. The full stack is in `runs/c2-text200/results.json` (`failure`) and exit was 1. No page, context, or screenshot was ever created.
- `[实测 22:11 external probe]` Launching the same Playwright headless shell directly over CDP also died:
  - it briefly wrote `DevToolsActivePort` and logged `DevTools listening on ws://127.0.0.1:9335/devtools/browser/...`
  - then `FATAL:mojo\public\cpp\platform\platform_channel.cc:108] Check failed: . : 拒绝访问。 (0x5)` and exited.
  - The raw probe log lived in the per-call DSH temp directory and is no longer present; the quoted lines are transcribed from the tool output at 22:11. No second Chromium attempt was made after Root's instruction.
- `[实测 22:12 escalation]` one-shot `danger-full-access` for the exact run was rejected with `requires approval, but no approval channel is available`. No configuration was changed.

## Classification

- **`BLOCKED_BROWSER_LAUNCH`** — execution-environment boundary, not C2 product correctness.
- The C1 200% FAIL (`Level / assessmen / t`) remains the last real browser verdict. C2's `Level check` / `Your result` has **not** been browser-verified.
- No `PASS` is asserted here for any title, overflow, progress, or ARIA behavior.

## Probe cleanup state

`[实测 22:20]` no `chrome-headless-shell.exe` process, no listener on 9333/9334/9335, no retained `mb006-*` temp profile/log found. Nothing was closed; no user browser, service, or tab was touched. The browser suite for Root is prepared (see `scripts/`), but not launched again from this session.
