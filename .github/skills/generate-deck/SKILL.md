---
name: generate-deck
description: Build executive and CIO/CTO decks as PDF for a customer.
---
1. `cd app && npm ci && npx playwright install chromium`.
2. `npm run build:deck -- <customerId>` writes `app/out/decks/<id>/*.pdf` and per-slide PNGs.
3. Check names and dates are substituted, numbers match `docs/VALUE-MODEL.md` and are labelled as assumptions.
4. Narrative source: `docs/presentation-narrative.md`; demo path: `docs/DEMO-SCRIPT.md`.
