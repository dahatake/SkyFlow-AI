---
name: add-scenario
description: Add a disruption scenario with decision options to the deterministic engine, with tests and translations.
---
1. Read `app/src/domain/demo.ts` (`DEMO_PACK`) and `scenario.ts`.
2. Add a `DemoPack` with `scenario.params` valid under `validateParams` and decision tasks with options and 5W2H task templates.
3. Add zh/ko/ja text for new titles in `app/src/i18n/dict-data.ts`.
4. Tests in `app/tests`: validates, advised option lowers `weighted`, baseline unchanged, snapshot updated on purpose (`npx vitest run -u` only after review).
5. Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and check `valueReport` for the new pack.
