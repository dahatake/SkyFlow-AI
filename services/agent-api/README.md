# agent-api

FastAPI service that runs a four-agent pipeline, **Detect -> Triage -> Resolver -> Comms**, over the `engine-mcp` tools and produces a
human-approved `Recommendation`. The engine supplies every number; models only select among engine options and write explanations.
Every stage has a deterministic rules-only fallback (the engine's own `advise()` result), so the service works with no model at all.

## Run

```powershell
cd services/agent-api
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"            # tests + API (rules mode, no Azure needed)
pip install -e ".[dev,azure]"      # plus Agent Framework, MCP client, Azure Identity/Cosmos/Monitor, PyJWT[crypto]
pytest                             # fake engine + fake model, no network
$env:AUTH_DISABLED='true'; $env:ENGINE_MCP_URL='http://localhost:8080/mcp'
uvicorn agent_api.app:create_app --factory --port 8000
python -m agent_api.scheduler      # one scheduled Detect run (Container Apps job)
```

Docker: `docker build -f services/agent-api/Dockerfile -t skyflow-agent-api .` (from the repo root) (scheduler job: same image, command `python -m agent_api.scheduler`).

## API

| Endpoint | Purpose |
|---|---|
| `GET /health` | liveness; reports `model: configured|rules-only` |
| `POST /api/agent/propose` `{demoId, tick?, mode:'agent'|'rules'}` | run the pipeline, persist, audit, post Teams card |
| `GET /api/agent/proposals[?demoId&status&limit]`, `GET /api/agent/proposals/{id}` | read proposals |
| `POST /api/agent/proposals/{id}/approve` / `reject` `{actor, role}` | human decision (role must be in `APPROVER_ROLES`) |
| `POST /api/agent/proposals/{id}/apply` `{actor, role}` | Approved -> Applied only |
| `GET /api/agent/proposals/{id}/audit` | audit trail (redacted prompts, tool I/O) |
| `POST /api/agent/ask` `{question, demoId, tick?, mode?}` | answers only from engine tool results; refuses out-of-scope / injection |

Status flow: `Proposed -> Approved -> Applied`, or `Proposed -> Rejected`. Any other transition returns 409.

## Safety design

- Every model-chosen `optionId`/`taskId`/`exceptionId` is validated against the engine's lists; any violation rejects that stage's output and uses rules (`fallbackUsed=true`).
- Model text may not contain numbers absent from the engine results it was given. `kpiDelta` is copied from the engine, never model-written.
- Tool allow-list is fixed in code; flight remarks/exception text is sanitized and wrapped in `<data>` tags, system prompts say to ignore instructions in data.
- Limits: input length, per-user rate limit, per-call and pipeline timeouts, token cap, retry budget, circuit breaker. Prompt Shields failure/attack = model disabled (fail closed).
- Auth: Entra ID bearer token (issuer/audience/signature); roles from the `roles` claim; token identity overrides the `actor` in the body.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `AUTH_DISABLED` | `false` | `true` skips auth (local/dev/tests); user from `X-User-Id` |
| `TENANT_ID`, `API_AUDIENCE` | | Entra token issuer tenant / expected audience |
| `APPROVER_ROLES` | `SIOC Duty Manager,Control Tower Lead,BU Ops Manager` | roles allowed to approve/reject/apply |
| `ENGINE_MCP_URL` | `http://localhost:8080/mcp` | engine-mcp endpoint |
| `FOUNDRY_PROJECT_ENDPOINT` | | Foundry project endpoint (DefaultAzureCredential); unset = rules only |
| `FOUNDRY_MODEL_PRIMARY` / `FOUNDRY_MODEL_FAST` | | deployments for Resolver / Detect, Triage, Comms, Ask (fast defaults to primary) |
| `CONTENT_SAFETY_ENDPOINT` | | enables Prompt Shields screening of operational text and questions |
| `COSMOS_ENDPOINT`, `COSMOS_DATABASE` | `skyflow` | Cosmos DB (managed identity); containers `proposals`, `audit`, partition key `/demoId`. Unset = in-memory |
| `TEAMS_WEBHOOK_URL` | | post the Adaptive Card on proposal (best effort) |
| `PUBLIC_API_URL` | | base URL used by the card's Approve/Reject actions |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | | OpenTelemetry export to Application Insights |
| `RATE_LIMIT_PER_MIN` | `10` | per-user limit on propose/ask |
| `MAX_INPUT_CHARS` | `500` | max question length |
| `MODEL_TIMEOUT_S` / `PIPELINE_TIMEOUT_S` / `ENGINE_TIMEOUT_S` | `20` / `60` / `10` | time limits |
| `MAX_OUTPUT_TOKENS` | `800` | model output cap |
| `MODEL_RETRY_BUDGET` | `1` | retries on transient model errors |
| `BREAKER_THRESHOLD` / `BREAKER_COOLDOWN_S` | `3` / `60` | circuit breaker |
| `SCHEDULER_DEMO_IDS`, `SCHEDULER_MODE`, `SCHEDULER_TICK` | all demos, `agent`, minute-of-day | scheduler scope |

## Notes

- Teams actions use `Action.Http`, which Office 365 connector webhooks honour. Teams cannot attach an Entra token, so with auth enabled use a bot/Action.Execute relay in front of the API.
- The Cosmos store expects the containers to exist (provisioned by infra). The `azure` extra is imported lazily; without it the service runs in rules mode.
