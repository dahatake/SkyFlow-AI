# Demo script: "Thunderstorm over the apron"

Reproducible start: `http://localhost:5173/?clock=2027-01-11T08:00:00%2B08:00&demo=1` (guided demo overlay walks the steps). For a deployed site use its URL. Fallback if the network fails: the app runs entirely in the browser; the agent falls back to the rule-based advisor. Backup recording: export the deck PDFs with `npm run build:deck` and keep a screen recording of this path.

## 3-minute version (executive)

| Time | Click | Say |
|---|---|---|
| 0:00 | Executive tab, "Run the thunderstorm scenario" | "Lightning stops ramp work. Today SIOC finds the knock-on effects through radios and chat." |
| 0:40 | Read the three panels | "Left: what is wrong, ranked by SLA exposure. Middle: what to do. Right: what it saves." |
| 1:20 | "Review the agent proposal" | "Agents compare options with the same engine every time. They cannot invent numbers." |
| 1:50 | "Approve and apply" | "A manager approves. Nothing happens before that." |
| 2:20 | Value tab | "Simulated saving per event and per month. Assumptions are on screen and are ours to validate with you." |
| 2:50 | Close | "Ask: confirm assumptions and the MVP scope date." |

## 10-minute version (adds proof)

1. Overview: live feed, 2D/3D, filters (1 min).
2. Switch role lens to Ramp Lead then back, to show each role gets its own priorities (1 min).
3. Agent tab: open the **agent trace** (Detect, Triage, Resolver, Comms) and the tools each step called (2 min).
4. Switch Mode to Rule-based advisor and re-run: same options, showing the deterministic fallback (1 min).
5. Task list: 5W2H tasks created by the approved decision (1 min).
6. Simulator: change a parameter, show Baseline / Scenario / Difference (1 min).
7. Optimize: one-click optimizer, recommendation only (1 min).
8. Close on Value tab and the next-step ask (1 min).

## Expected on-screen results (frozen clock, seed 2026.1, SATS assumptions)

| Scenario | Breaches avoided | At risk avoided | Blocked tasks avoided | Saving per event (SGD) |
|---|---|---|---|---|
| Weather delay | 0 | 3 | 28 | 1,680 |
| Flight delay | 1 | 3 | 10 | 3,100 |
| No ground staff | 0 | 9 | 60 | 3,600 |

These come from `valueReport` and are pinned by `app/tests/value.test.ts`. If a number differs, the seed, clock or assumptions changed.

## If something goes wrong

- Blank page or error banner: Diagnostics tab, Reset.
- Agent service slow: set Mode to Rule-based advisor.
- No network: everything except Teams delivery works offline.
