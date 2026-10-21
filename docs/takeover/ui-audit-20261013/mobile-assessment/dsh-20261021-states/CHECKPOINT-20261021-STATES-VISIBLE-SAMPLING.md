# CHECKPOINT-20261021-STATES-VISIBLE-SAMPLING

Date 2026-10-21 (CST). Scope: **only `dsh-20261021-states/states-verify.cjs`** and this checkpoint. No browser, valid-env startup probe, product, fixture, helper, other test directory, Git or server action.

## Change

Root review noted that `installVisibleProbe` sent a frame only when question/report/skipped was visible or `frame % 30 === 0`. In the 250 ms restore401 window that could leave `assessmentFrames = 0`, forcing visible-flash evidence to NOT_RUN.

The send condition is now:

```js
if (frame <= 800 && typeof window.__mb006VisibleFrame === 'function') window.__mb006VisibleFrame(rec);
```

Every requestAnimationFrame DOM fact in the valid observation window is sent, capped at 800 frames. The 30-frame sampling is removed. Root reviews `sampledFrames`, `route`, `frame` and `visibility`.

Unchanged:

- visibility criteria (`display`/`visibility`/ancestor hidden/rect-viewport intersection);
- DOM presence counts (`domPresence`) and the retained observer;
- all error/pageerror/unhandled/warning assertions;
- fixture, helper, gate, unique run/close behavior and any other script.

## Validation

- `node --check states-verify.cjs`: **exit 0**.
- [实测] current page is C7b `37bad477e4239061972941c42b24468db5994b8afb89feb61f720fbe168c07e5`.
- Current `states-verify.cjs` SHA-256: `e9936be6a40ee6ffb1d5986e0cd37b06b26f86c7ca2f869b9216da501c4e6583` (21455 bytes).
- Prior pre-visible archive remains at `20261021-C7B-restore401-pre-visible-flash/`.
- **NOT_RUN**: restore401 single run, all browser evidence, native/backend and UI acceptance.

C7b still needs a controlled service refresh before Root runs restore401 alone. This checkpoint does **not** claim the product has no visible flash or that any case passes.
