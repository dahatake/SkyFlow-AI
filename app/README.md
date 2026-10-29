# AI Operations Control Tower (prototype)

Browser-only, view-only prototype implementing [docs/requirement-definition.md](../docs/requirement-definition.md).

```
cd app
npm install
npm run dev      # http://localhost:5173
npm test         # scenario engine + persistence tests
npm run build
```

- **Stack:** React + TypeScript + Vite, three.js (3D), SVG (2D). Data lives in IndexedDB (entities, scenarios, audit, diagnostics); localStorage holds only UI preferences.
- **Single source of truth:** `src/domain/view.ts` (`OpsView`) projects the frozen baseline + active scenario overlay for every panel (FR-001, DATA-003).
- **Simulator:** `src/domain/scenario.ts` – pure validation and impact calculation for the five cases plus combined; baseline is never mutated (SIM-001..004). Baseline / Scenario / Difference modes in the Scenario manager.
- **Languages:** header toggle EN / 中文 / 한국어 / 日本語 (`src/i18n/`). UI text goes through `tr('English text', {params})`; seed/demo data strings through `trData()`. Translations live in `src/i18n/dict-*.ts` (every key needs zh/ko/ja, enforced by `tests/i18n.test.ts`); missing keys fall back to English. The choice is stored in localStorage (`aiops.lang`).
- **GPS map:** `src/components/GpsMap.tsx`, `src/domain/gps.ts`, `src/domain/airportMap.ts`, `src/storage/gpsTracker.ts` – GPS mode of the Situational view: schematic Changi with Overview / Apron / L1 / L2 / L3 layers, wheel-zoom and drag-pan, a fix per aircraft, GSE vehicle and person every 5 minutes stored in IndexedDB (`gps` store), replay and CSV export (GPS-001..004).
- **Planning:** `src/domain/planning.ts` + `src/components/PlanningView.tsx` – day/week resource schedule (gates, staff shifts, GSE, belts, check-in) as Gantt or table, on a deterministic sample Changi week (PLAN-001..003).
- **Roles:** six lenses (header selector) that adjust default tab, scope filters and edit permissions.
- **Optimizer:** `src/domain/optimizer.ts` – one-click "Optimize all" (Optimize tab) that recommends stand moves, GSE assignments, crew transfers and crew-seat staggering from weighted priorities and hard limits; recommendation only (OPT-001..004).
- **2D/3D:** shared selection, filters, layers and simulation context; 3D has orbit/pan/dolly, reset, fit/focus selected, follow, LOD labels.
- **Data:** seeded synthetic dataset (`seedVersion`/`schemaVersion` checked at load); Diagnostics tab offers Reset and Export.

- **Data-provider interface:** `src/data/provider.ts` (seed provider now; a Fabric adapter can implement the same interface in Horizon 2).
- **Time position:** slider in the shared view context scrubs operational time across board, KPIs, 2D and 3D; **Live** resets it.
- **Diagnostics:** load, render errors, invalid scenarios and interaction timings (no operational payloads), exportable.

- **Decision queue:** each demo scenario has judgement tasks (staff, crew, facility, gate, schedule). People choose an option or accept the Copilot assist pick; decisions only alter the simulated overlay (`src/domain/demo.ts`, `judgement.ts`) and the scoreboard compares Normal day vs Disruption vs With decisions.
- **3D models:** procedural airliners per airline (A350-900, 787-9, 777-300ER, A380-800 with livery colours), jet bridges, piers, tower and ground vehicles (`src/components/models3d.ts`). No third-party model files are bundled; licensed GLB assets can be swapped in later.

- **Clock and roles:** big operational clock (live/replay) and next-departure hint in the header; role lenses are buttons whose panel order follows each role's priorities (`src/components/roles.tsx`).
- **Response workflow:** Detect → Acknowledge → Assign → Decide → Monitor → Resolve stepper with bulk actions; progress is a local IndexedDB overlay (`workflow` store), never written to the baseline.
- **Alternative views:** turnaround board as Table / Gantt / Pipeline; exceptions as List / Pipeline (`src/components/Views.tsx`).

- **Task list:** every decision option expands into 5W2H action tasks (What, Why, Who, When, Where, How, How much) shown as List / Gantt / Board with priority and status (`src/domain/tasks.ts`, `components/TaskList.tsx`). Choosing a decision in the Decision queue creates them.
- **Live feed:** the seed stays immutable; `src/domain/live.ts` derives the observed state at operational minute 08:00 + tick (flight status, milestones, tasks, SLA risk, GSE, crew, new exceptions). One tick per real minute by default (x15 / x60 for demos), with pause, restart and a change ticker.
