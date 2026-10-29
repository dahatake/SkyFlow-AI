# Azure Well-Architected Framework (WAF) Analytics Report: SkyFlow AI

- **Framework:** [Microsoft Azure Well-Architected Framework](https://learn.microsoft.com/en-us/azure/well-architected/) (five pillars)
- **Scope:** the repository as-is. This is a static review of `azure.yaml`, `infra/` (Bicep), `services/`, `app/` and `.github/workflows/`. No live subscription was assessed, so runtime configuration, quotas and actual costs are not covered.
- **Rating scale:** 🟢 Strong · 🟡 Adequate, with gaps · 🔴 Gap that should be addressed before production.

## 1. Workload summary

SkyFlow AI is an AI Operations Control Tower for airport ground handling. A deterministic scenario engine is the source of truth, and AI agents only choose among engine options. A human approval gate applies to every change.

| Component | Azure service | Notes |
|---|---|---|
| `web` (React SPA, `app/`) | Static Web Apps (Standard) | Optional Entra ID auth; linked backend proxies `/api/*` to agent-api |
| `agent-api` (Python/FastAPI) | Container Apps (external ingress) | Entra JWT validation, rate limiter, circuit breaker, Content Safety shield, 1 vCPU / 2 GiB |
| `engine-mcp` (Node/TS MCP server) | Container Apps (**internal** ingress) | 0.5 vCPU / 1 GiB |
| `scheduler` | Container Apps Job | Cron `* * * * *`, 55 s timeout, no retries |
| Persistence | Cosmos DB NoSQL (serverless by default) | `proposals` and `audit` containers; local auth disabled |
| AI | Foundry (AIServices) with gpt-4.1 and gpt-4.1-mini (GlobalStandard), Azure AI Content Safety | Local auth disabled; managed identity |
| Secrets, images | Key Vault (RBAC, soft delete 90 d, purge protection), ACR Basic | Teams webhook stored in Key Vault |
| Observability | Log Analytics, Application Insights, availability tests (3 APAC locations), metric alerts, workbook, diagnostic settings | Retention 30 d, 5 GB/day cap |
| Optional network | VNet and private endpoints for Cosmos, Key Vault and AI accounts | `enablePrivateNetworking`, default `false` |
| Delivery | GitHub Actions: CI (tests, Bicep lint, gitleaks), CodeQL, CD with azd and OIDC federation, smoke tests | Dependabot enabled |

## 2. Executive scorecard

| Pillar | Rating | One-line verdict |
|---|---|---|
| Reliability | 🟡 | Good health probes, alerts and a deterministic fallback. Single region, no zone redundancy, and scale-to-zero outside prod. |
| Security | 🟢/🟡 | Strong identity-first design. Public endpoints are the default, and auth can be disabled. |
| Cost Optimization | 🟢 | Serverless and scale-to-zero defaults, a budget, and a log cap. Some SKU and cadence items to tune. |
| Operational Excellence | 🟢 | IaC, CI/CD with OIDC, tests, alerts and a workbook. A few runbook and policy gaps. |
| Performance Efficiency | 🟡 | HTTP autoscaling is configured. No load tests or SLO targets, and the model quota is modest. |

## 3. Pillar analysis

### 3.1 Reliability

**Strengths**
- The architecture degrades gracefully. "Every AI path must work with the model off (`mode: rules`)" (`AGENTS.md`). A `CircuitBreaker` and a `RateLimiter` in `safety.py` protect the model and API paths.
- `/health` and `/api/health` endpoints exist. Application Insights availability tests run from 3 locations, with metric alerts on availability, API 5xx and container restarts (`infra/modules/monitoring-alerts.bicep`).
- Optimistic concurrency is used in `CosmosStore` (`CosmosAccessConditionFailedError` handling). The `MemoryStore` fallback keeps demos working.
- `activeRevisionsMode: Single` and `fetch-latest-image` keep reprovisioning from rolling back images.
- Immutable baseline plus derived overlays make state reproducible and testable.

**Gaps and risks**
| # | Finding | Evidence | Risk | Recommendation |
|---|---|---|---|---|
| R1 | Container Apps environment is not zone redundant. | `zoneRedundant: false` (`resources.bicep`) | Zonal outage takes down the API and the engine. | Make this a parameter. Enable it for `prod`, which needs a VNet-integrated environment. |
| R2 | Cosmos DB is single-region and not zone redundant. | `isZoneRedundant: false` | Data-plane outage, and no regional DR for the audit trail. | For prod: enable zone redundancy where the region supports it, add a secondary region, use continuous backup (PITR), and set `enableAutomaticFailover`. |
| R3 | The `dev` and `staging` default is `minReplicas: 0` (the `isProd` guard). | `var minReplicas = isProd ? 1 : 0` | Cold starts. The first request after idle is slow. | Acceptable for non-prod. Use ≥2 replicas in prod so a single replica loss does not cause downtime. |
| R4 | The scheduler runs every minute with `replicaRetryLimit: 0`. | `cronExpression: '* * * * *'` | A missed run is silently skipped. | Confirm the job is idempotent and add an alert on job failures. Consider an overlap guard. |
| R5 | No documented RTO/RPO, SLO or DR runbook. | `docs/` | Recovery expectations are unclear. | Define SLOs, for example API availability, p95 latency and proposal-to-approval time. Add a DR section to `docs/PLAYBOOK.md`. |
| R6 | Foundry is deployed in a single region (`eastus2`) as GlobalStandard. | `foundryLocation` | A regional model outage degrades AI features. | Rely on the rules-mode fallback. Optionally add a secondary deployment or Foundry account. |
| R7 | The SPA is cross-region with the API, which sits in `eastasia`. Cosmos is in `southeastasia` and Foundry in `eastus2`. | `main.bicep` | Cross-region latency and several regional dependencies. | Document the trade-off. These choices were driven by capacity and model availability. |

### 3.2 Security

**Strengths**
- **Identity-first:** a user-assigned managed identity has least-privilege roles (AcrPull, Key Vault Secrets User, Cognitive Services User, Cosmos data contributor). Cosmos, Foundry and Content Safety all have `disableLocalAuth: true`. Key Vault uses RBAC authorization. There are no keys in the repo, and the rule is stated in `AGENTS.md`.
- **API authentication:** `Authenticator` validates Entra ID bearer tokens (RS256 signature via tenant JWKS, audience, issuer allow-list). Roles come from the `roles` claim, and approver roles are enforced server side.
- **Internal engine:** `engine-mcp` has `external: false`, and `allowInsecure: false` is set on both apps.
- **AI safety:** prompt-injection heuristics (`looks_like_injection`, `sanitize_untrusted`, `wrap_data`), output redaction, number-grounding checks (models never produce numbers), Content Safety shield, and a human approval gate.
- **Key Vault:** soft delete (90 days) and purge protection are on by default. Optional private endpoints are available.
- **Supply chain:** gitleaks, CodeQL (weekly and on PR), Dependabot, and OIDC federation for CD (no stored Azure credentials).

**Gaps and risks**
| # | Finding | Evidence | Risk | Recommendation |
|---|---|---|---|---|
| S1 | Private networking is off by default, so Cosmos, Key Vault, Foundry and Content Safety are reachable over public endpoints. | `enablePrivateNetworking = 'false'` | Larger attack surface and a data-exfiltration path. | Default to `true` for `staging` and `prod`. The agent-api egress also needs the VNet. |
| S2 | `authDisabled` resolves to `true` when `apiAudience` is empty ("demo only"). | `main.bicep` | An unauthenticated API with approval endpoints. | Fail the deployment when `environmentType == 'prod'` and auth is disabled. Add a Bicep `assert` or a validation step in `preflight`. |
| S3 | CORS allows all headers with `allowCredentials: true`. Methods are broad, but origins are restricted to the SWA host plus the explicit extras. | `corsPolicy` | Low risk. A misconfigured `additionalCorsOrigins` widens it. | Restrict `allowedHeaders` to what is needed (`Authorization`, `Content-Type`). Validate that extras are not wildcards. |
| S4 | No WAF or edge protection. agent-api has external ingress, and the SWA-linked path is not the only route to it. | `ingress.external: true` | Direct API exposure and no L7 filtering or DDoS-tuned policy. | For prod, front the API with Azure Front Door and WAF, or APIM. Restrict agent-api ingress to the Front Door or SWA source (IP restrictions or private link). |
| S5 | Key Vault `networkAcls.defaultAction` is `Allow` without private networking. | `resources.bicep` | Public network reachability for secrets. | Covered by S1. Also enable Defender for Cloud plans (Key Vault, Cosmos DB, Containers, App Service). |
| S6 | ACR is Basic. | `sku: Basic` | No private link, no geo-replication, no content trust or quarantine. | Use Premium in prod if private link or vulnerability policy is required. Keep the admin user disabled. |
| S7 | Tokens are validated with a JWKS client against the tenant. | `auth.py` | Low. | Add a test and alert for repeated 401/403 patterns. |
| S8 | Log content could include user data. | `telemetry.py`, `redact` | Data-protection risk if the redaction is incomplete. | Keep `redact` coverage under test. Review retention against customer data policy. |

### 3.3 Cost Optimization

**Strengths**
- Cosmos serverless by default, with an autoscale max of 1000 RU/s when disabled.
- Container Apps use the Consumption profile, with scale-to-zero outside prod and capped `maxReplicas` (dev 2; prod 5 for the engine and 10 for the API).
- Log Analytics has a 5 GB/day cap and 30-day retention. `monthlyBudgetUsd` and contact emails are parameterised for a budget with alerts.
- Resource tags (`azd-env-name`, `application`, `customer`, `environmentType`) allow cost allocation.
- Smaller model (`gpt-4.1-mini`, 100K TPM) and primary model (`gpt-4.1`, 50K TPM) are separate deployments, so cheap calls go to the small model.
- The deterministic engine does the numeric work, so token use is bounded.

**Opportunities**
| # | Finding | Recommendation |
|---|---|---|
| C1 | The scheduler runs every minute (about 43,200 executions a month) even when idle. | Make the cadence a parameter. Back off, or trigger by event, in non-prod. |
| C2 | Static Web Apps **Standard** is needed for the linked backend, but costs more than Free. | Keep Standard for staging and prod. Use Free in dev only if the linked backend is not needed (`linkSwaBackend=false`). |
| C3 | Availability tests from 3 locations run in every environment. | Reduce to one location in dev. |
| C4 | A 5 GB/day cap can drop telemetry silently. | Alert at 80% of the cap. Consider basic logs or an archive tier for verbose tables. |
| C5 | Model capacity is provisioned as GlobalStandard (pay-per-token). | Monitor token use. Add per-user and per-day token budgets in agent-api. |
| C6 | A budget exists but is a single threshold set. | Add forecast alerts at 50/80/100% and a per-environment budget. |
| C7 | No Reservations or Savings Plan analysis. | Revisit for prod when usage is stable. |

### 3.4 Operational Excellence

**Strengths**
- Everything is IaC (Bicep with AVM-style modules) and `azd`-driven. Deployment is reproducible, with `azure.yaml` defining 4 services.
- CI covers unit, property and golden tests (80% coverage gate on the domain), lint, type-check, Playwright e2e, Python tests, Bicep build and lint, and secret scanning.
- CD uses OIDC federation, an environment-specific deploy (`deploy-env.yml`) with API and browser smoke tests after deployment.
- Observability: Application Insights, an Azure Monitor workbook, alerts with an action group, and diagnostic settings for Foundry, Content Safety, Cosmos and Key Vault.
- Clear contributor guidance (`AGENTS.md`, `.github/instructions`, skills, custom agents) and operating docs (`PLAYBOOK.md`, `DEMO-SCRIPT.md`).
- An audit container records proposals and approvals. `trace_id` links records.
- A frozen-time clock (`?clock=<ISO>`) makes tests deterministic.

**Gaps**
| # | Finding | Recommendation |
|---|---|---|
| O1 | No Azure Policy or governance assignments in the repo. | Add policy for required tags, private endpoints, and disabled local auth. Evaluate with `azqr` in CI. |
| O2 | No documented incident runbooks or on-call mapping for alerts. | Add runbooks linked from alert descriptions. |
| O3 | No progressive-delivery strategy. Revisions run in Single mode. | Use multiple revisions with traffic splitting (blue/green) for prod. |
| O4 | Bicep is checked with build and lint only. | Add `what-if` in PRs and Checkov or PSRule for Azure in CI. |
| O5 | Distributed tracing across SPA → agent-api → engine-mcp → Foundry is not documented as an end-to-end check. | Ensure W3C trace propagation and publish a sample KQL. |
| O6 | Model evaluation is limited to rules-based tests. | Add an offline evaluation set for the agent pipeline (groundedness, option selection accuracy) and gate on it. |
| O7 | The repository root contains a binary archive (`*-app.zip`). | Remove it from source control. It adds noise and may contain stale content. |

### 3.5 Performance Efficiency

**Strengths**
- Pure, deterministic TypeScript engine on the client and the MCP service gives fast, cacheable results. IndexedDB storage is used on the client.
- HTTP-concurrency autoscale rules (engine 50, API 30 concurrent requests), and a fast model for light work.
- SWA serves static assets from the edge. SWA's linked backend keeps the API same-origin, which avoids CORS preflights.
- Rate limiter and a 5 s timeout on the Content Safety call prevent slow dependencies from piling up.

**Gaps**
| # | Finding | Recommendation |
|---|---|---|
| P1 | No load or performance tests, and no latency SLOs. | Add Azure Load Testing for agent-api, with p95 targets for `/api/*` and proposal generation. |
| P2 | Cold starts when `minReplicas` is 0. | Use `minReplicas ≥ 1` for the API in any environment used for demos or live ops. |
| P3 | Model quota is modest (50K and 100K TPM). Bursts during disruptions may hit 429s. | Add retry with jittered backoff and request quotas in advance. Use the rules fallback on 429, which the circuit breaker mostly covers. |
| P4 | The rate limiter is in memory per replica. | With multiple replicas, limits are not global. Use a shared store (Redis or Cosmos) if strict limits are needed. |
| P5 | Cosmos partition key is `/demoId`. | This suits the demo and single-tenant model. For multi-airport scale, confirm cardinality and hot-partition risk. |
| P6 | Large client bundle (3D scene, maps). | Code-split heavy views (`Scene3D`, `GpsMap`) and track Web Vitals in Application Insights. |

## 4. Cross-cutting: Well-Architected for AI workloads

| Concern | Status |
|---|---|
| Grounding and determinism | 🟢 Engine is the source of truth, and models never produce numbers. |
| Human-in-the-loop | 🟢 Server-side approver roles. |
| Content safety and prompt injection | 🟢 Content Safety plus heuristics and redaction. |
| Responsible-AI evidence | 🟡 Audit log exists, but there is no evaluation set, transparency note or red-team record. |
| Model lifecycle | 🟡 Model name and version are parameters, but there is no retirement tracking. Add a check for the deprecation dates of `gpt-4.1`. |
| Data residency | 🟡 Models are in `eastus2`, while the data is in Southeast Asia. Confirm with customer requirements. |

## 5. Prioritised action plan

| Priority | Action | Pillar | Effort |
|---|---|---|---|
| P0 | Block `authDisabled` for `prod` (S2). | Security | S |
| P0 | Enable private networking for staging and prod (S1, S5). | Security | M |
| P1 | Front the API with Front Door and WAF, and restrict direct ingress (S4). | Security / Reliability | M |
| P1 | Zone redundancy and a multi-region or backup plan for Cosmos and Container Apps (R1, R2). | Reliability | M |
| P1 | Define SLOs, RTO/RPO and runbooks (R5, O2). | Reliability / Ops | S |
| P1 | Add load tests and `minReplicas ≥ 2` for prod (P1, P2, R3). | Performance | M |
| P2 | Policy-as-code, `what-if` and IaC scanning in CI (O1, O4). | Ops | M |
| P2 | Scheduler cadence, availability-test locations and budget alerts (C1, C3, C6). | Cost | S |
| P2 | AI evaluation gate and model-lifecycle tracking (O6, section 4). | Ops / AI | M |
| P3 | Shared rate limiting, bundle splitting, remove the zip from the repo (P4, P6, O7). | Performance / Ops | S |

Effort: S = under 1 day, M = 1–5 days.

## 6. Method and limitations

- Findings come from reading the source. Nothing was deployed or measured, and numbers such as 43,200 runs per month are derived from the configuration.
- Items marked "prod" assume `environmentType = prod`. In the `dev` defaults, several gaps are intentional trade-offs for cost.
- Re-run this review after infra changes. The [Azure Well-Architected Review assessment](https://learn.microsoft.com/en-us/assessments/azure-architecture-review/) and `azqr` against a deployed environment will validate the runtime state.

## 7. References

- [Azure Well-Architected Framework](https://learn.microsoft.com/en-us/azure/well-architected/)
- [Well-Architected pillars](https://learn.microsoft.com/en-us/azure/well-architected/pillars)
- [Well-Architected for AI workloads](https://learn.microsoft.com/en-us/azure/well-architected/ai/)
- [Azure Container Apps reliability](https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-container-apps)
- [Azure Cosmos DB WAF service guide](https://learn.microsoft.com/en-us/azure/well-architected/service-guides/cosmos-db)
