---
name: deploy-azure
description: Deploy the full platform with azd, safely.
---
1. `./scripts/preflight.ps1 -SubscriptionId <id> -Location <region>` (login, providers, region, model quota).
2. `azd env new <name>`; set `AZURE_SUBSCRIPTION_ID`, `AZURE_LOCATION`, `BUDGET_CONTACT_EMAIL`, optional model overrides.
3. `az deployment sub what-if` via `azd provision --preview`, review, then `azd up`.
4. Run the smoke test: `E2E_BASE_URL=<web uri> npm run test:e2e` in `app/` and `curl <api>/health`.
5. CI/CD identity: `./scripts/setup-oidc.ps1` and the variables listed in `docs/PLAYBOOK.md`.
