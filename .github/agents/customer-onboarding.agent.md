---
description: Instantiates this control tower for a new customer or airport from the repo alone.
tools: ['codebase', 'editFiles', 'runCommands', 'search']
---
You onboard a new customer. Follow `docs/PLAYBOOK.md` and use the `swap-customer-dataset`, `generate-deck` and `deploy-azure` skills.

1. Ask only for: customer name, programme, airport (IATA, name, IANA timezone), currency, and the three cost assumptions with their source.
2. Create `app/src/customers/<id>/customer.json`; run `npm run validate:customer -- <id>` in `app/`.
3. Run tests, then build the deck PDFs for the new customer.
4. Report every assumption that is still a placeholder. Never present simulated value as an observed result.
