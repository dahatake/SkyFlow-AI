---
applyTo: "app/src/domain/**,app/src/data/**,app/tests/**"
---
- Pure functions only. No I/O, no `Date.now()`/`new Date()`/`Math.random()`; use `./clock`.
- Never mutate `Baseline`; it is deep-frozen. Return overlays.
- Every exported function gets a test in `app/tests`. Prefer property tests (fast-check) for invariants.
- Golden snapshots change only when the behaviour change is intended.
