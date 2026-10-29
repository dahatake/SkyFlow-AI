# Playbook: from an empty folder to a deployed demo (target: under 2 hours)

Audience: a Hub SE using GitHub Copilot (or any AI harness) with only this repo.

## 0. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 22+ (`app/.nvmrc`) | `node -v` |
| Python | 3.12 (agent service only) | `python --version` |
| Azure CLI + Bicep | current | `az version` |
| Azure Developer CLI | current | `azd version` |
| GitHub CLI (CI/CD only) | current | `gh --version` |

Or open the repo in the dev container (`.devcontainer`).

## 1. Run it locally (10 min, no Azure)

```
./scripts/setup.ps1        # or setup.sh: npm ci, validate customers, run tests
cd app && npm run dev
```

Open `http://localhost:5173/?clock=2027-01-11T08:00:00%2B08:00&demo=1`.

## 2. Make it yours (30 min)

Fastest: in VS Code Copilot chat run `/instantiate-engagement`. Manual steps:

1. Copy `app/src/customers/generic-hub` to `app/src/customers/<id>`.
2. Edit `customer.json`: names, airport, currency, assumptions (with `assumptions.source`), dates.
3. Register the file in `app/src/customers/index.ts`.
4. `cd app && npm run validate:customer -- <id>`.
5. Run with `?customer=<id>` (or `VITE_CUSTOMER=<id>` in `app/.env.local`).
6. Airport layout and flights come from `app/src/domain/seed.ts`, `airportMap.ts` and `app/scripts/fetch-changi-routes.py`. Replace for a different airport and keep the schema (`SCHEMA_VERSION`). For live data use `app/src/data/fabricProvider.ts` with `scripts/fabric-setup.kql` and `scripts/publish-baseline.ts`.
7. `npm test && npm run test:e2e`.

## 3. Decks (10 min)

```
cd app && npx playwright install chromium
npm run build:deck -- <id>       # app/out/decks/<id>/*.pdf
```

Narrative: `docs/presentation-narrative.md`. Demo path: `docs/DEMO-SCRIPT.md`. Value numbers: `docs/VALUE-MODEL.md`. Replace every placeholder assumption before external use.

## 4. Deploy to Azure (45 min)

```
./scripts/preflight.ps1 -SubscriptionId <id> -Location <region>
azd env new <name>
azd env set AZURE_SUBSCRIPTION_ID <id>
azd env set AZURE_LOCATION <region>
azd env set BUDGET_CONTACT_EMAIL you@contoso.com
azd provision --preview        # review the what-if
azd up
```

What gets created (see `infra/`): Static Web App, Container Apps (`engine-mcp`, `agent-api`, `agent-scheduler` job), Container Registry, Microsoft Foundry account and project with two model deployments, Content Safety, Cosmos DB, Key Vault, Log Analytics and Application Insights, alerts and a workbook, and a monthly budget (default 10,000 USD, alerts at 50/80/100% and a 110% forecast).

Typical cost: dev roughly 40 to 180 USD per month, prod roughly 400 to 3,500 depending mostly on model usage.

Settings you may need:

| Setting | Where | Notes |
|---|---|---|
| Model names and capacity | `azd env set FOUNDRY_MODEL_PRIMARY ...` | Run preflight; quota differs per region |
| Teams webhook | `azd env set TEAMS_WEBHOOK_URL ...` | Stored in Key Vault. Optional |
| Entra sign-in | `aadClientId` parameters | `app/public/staticwebapp.config.json` requires login by default |
| Private networking | `enablePrivateNetworking=true` | Optional, adds roughly 30 USD per month |
| Web to agent API | `VITE_AGENT_API_URL` at build time | azd sets it from the deployed API |

Smoke test: `curl https://<agent-api>/health` and `E2E_BASE_URL=https://<swa> npm run test:e2e` (in `app/`).

## 5. CI/CD (15 min)

```
./scripts/setup-oidc.ps1 -SubscriptionId <id> -Repo <owner/name>
```

It prints the repository variables for `.github/workflows/cd.yml`: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_ENV_NAME`, `AZURE_LOCATION`, `BUDGET_CONTACT_EMAIL`. Create `staging` and `production` GitHub environments (each with its own variables; production with required reviewers). CD deploys staging, smoke-tests it, then production. To roll back, run the CD workflow manually with `ref` set to a previous good SHA. CI runs tests, lint, coverage, Bicep build and e2e on every PR.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `npm ci` peer dependency error | Use the repo `.npmrc` (`legacy-peer-deps`), do not delete it |
| Values differ from the demo script | Missing `?clock=`; the seed depends on the clock |
| Model deployment fails | Quota or region. Run preflight, change `FOUNDRY_MODEL_*` or region |
| Agent says "Rule-based fallback" | Service unreachable, model unavailable or output failed validation. By design |
| Scheduler job fails right after provision | Placeholder image until `azd deploy` finishes |
| 401 on the site | Entra sign-in is required; sign in or relax the route in `staticwebapp.config.json` |
| Key Vault name conflict on redeploy | Purge protection is on; use a new environment name |

## Tear down

`azd down --purge`
