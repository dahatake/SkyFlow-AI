---
name: swap-customer-dataset
description: Re-target the app to a new customer or airport via customer.json and the seed data.
---
1. Copy `app/src/customers/generic-hub` to `app/src/customers/<id>`; edit `customer.json`; register it in `app/src/customers/index.ts`.
2. `cd app && npm run validate:customer -- <id>`.
3. Run with `?customer=<id>` or `VITE_CUSTOMER=<id>`.
4. Layout data (stands, routes) is generated in `app/src/domain/seed.ts`, `airportMap.ts` and `app/scripts/fetch-changi-routes.py`; replace these for a different airport and keep `SCHEMA_VERSION`.
5. For live data use `app/src/data/fabricProvider.ts` with `scripts/fabric-setup.kql`.
6. Run `npm test` and `npm run test:e2e`.
