# System Component Diagram

## Current system: local-only horizontal demo

```mermaid
flowchart LR
    user["Operations user"] --> ui["Local React UI<br/>2D / 3D / dashboards"]
    ui --> advisor["Coded rule-based advisor<br/>Detect / Triage / Resolver / Comms"]
    advisor --> engine["Pure deterministic engine<br/>scenarios / KPI / optimizer / planning"]
    engine --> human["Human approval<br/>derived overlays / 5W2H tasks"]
    human --> storage["Local browser storage<br/>IndexedDB / preferences / audit"]
    seed["Bundled customer.json + seed<br/>simulated live feed / GPS"] --> engine
```

Everything runs on one local machine. Vite serves bundled assets on localhost; the browser executes all application logic. No LLM, MCP/API server, Azure, Entra sign-in, Fabric feed, Teams webhook or telemetry endpoint is used. Rules select valid engine options and compute explanations from scores. Comms records a local notification preview only.

The approval gate remains explicit; only the three manager roles can approve pipeline proposals. These are local demo role checks, not production authentication. Decisions and audit persist in IndexedDB; preferences use localStorage. Baseline records remain immutable. Dependencies need installation once; afterwards only the localhost server is needed (no PWA/service worker).

Implementation: [advisor](../app/src/agent/client.ts), [approval UI](../app/src/components/AgentView.tsx), [engine](../app/src/domain), [storage](../app/src/storage), [seed provider](../app/src/data/provider.ts).

## Archived cloud architecture (not running in the demo)

<details>
<summary>Historical Azure and LLM components</summary>

The diagrams below describe the retired cloud implementation, not the current runtime.
(Sources: [azure.yaml](../azure.yaml), [infra/resources.bicep](../infra/resources.bicep), `app/`, `services/`)

## 1. Application layer

```mermaid
flowchart LR
    user([Operations user])

    subgraph web["web (React SPA / app)"]
        direction TB
        ui["UI components<br/>Board, Decisions, Optimizer,<br/>AgentView, Map2D/Scene3D, KPI"]
        domain["domain<br/>deterministic engine<br/>scenario, judgement, kpi,<br/>optimizer, planning"]
        data["data provider<br/>seed / Fabric provider"]
        storage["storage<br/>IndexedDB, GPS tracker"]
        i18n["i18n + customers<br/>customer.json"]
        client["agent/client.ts"]
        ui --> domain
        ui --> data
        ui --> storage
        ui --> i18n
        ui --> client
    end

    subgraph api["agent-api (Python / FastAPI)"]
        direction TB
        routes["app.py<br/>/api/agent/propose, proposals,<br/>approve, reject, apply, audit, ask"]
        auth["auth.py<br/>Entra ID token validation"]
        pipeline["pipeline.py<br/>Detect → Triage → Resolver → Comms"]
        rules["rules.py<br/>deterministic fallback"]
        safety["safety.py<br/>injection check, grounding,<br/>redaction, circuit breaker, shield"]
        model["model.py<br/>LLM client"]
        engclient["engine_client.py<br/>MCP client"]
        store["store.py<br/>proposals + audit"]
        teams["teams.py<br/>approval card"]
        tel["telemetry.py<br/>OpenTelemetry"]
        routes --> auth
        routes --> pipeline
        routes --> store
        pipeline --> rules
        pipeline --> safety
        pipeline --> model
        pipeline --> engclient
        pipeline --> teams
        pipeline --> tel
    end

    subgraph engine["engine-mcp (TypeScript MCP server)"]
        tools["MCP tools<br/>get_live_state, get_exceptions, rank_by_sla,<br/>list_decision_tasks, run_scenario,<br/>compare_options, run_optimizer, get_kpi_value"]
        eng["engine.ts<br/>shared deterministic engine"]
        tools --> eng
    end

    subgraph sched["scheduler (Python job)"]
        job["scheduler.py<br/>periodic proposal run"]
    end

    user --> ui
    client -- "HTTPS /api/*" --> routes
    engclient -- "MCP over HTTP" --> tools
    job --> pipeline
    domain -. "same engine logic" .- eng
    model -- "LLM calls" --> llm[(Foundry models)]
    safety -- "prompt/content shield" --> cs[(Content Safety)]
    store --> db[(Cosmos DB)]
    teams -- "webhook" --> teamsx[(Microsoft Teams)]
```

## 2. Azure components

```mermaid
flowchart TB
    user([User browser])
    entra[Microsoft Entra ID]
    teams[Microsoft Teams]
    gh[azd / CI deploy]

    subgraph rg["Resource Group (infra/main.bicep + resources.bicep)"]
        swa["Static Web App<br/>web (React SPA)<br/>+ linked backend (Standard SKU)"]

        subgraph cae["Container Apps Environment"]
            api["Container App<br/>agent-api"]
            mcp["Container App<br/>engine-mcp"]
            job["Container Apps Job<br/>scheduler"]
        end

        acr["Azure Container Registry"]
        uami["User-assigned<br/>Managed Identity"]
        kv["Key Vault<br/>(Teams webhook secret)"]
        cosmos["Cosmos DB (NoSQL)<br/>containers: proposals, audit"]

        subgraph ai["Microsoft Foundry"]
            foundry["AI Services account + project"]
            dep1["Deployment: primary model"]
            dep2["Deployment: fast model"]
            foundry --- dep1
            foundry --- dep2
        end
        cs["Azure AI Content Safety<br/>(optional)"]

        subgraph mon["Monitoring"]
            law["Log Analytics workspace"]
            ai_ins["Application Insights"]
            alerts["Alert rules<br/>(optional)"]
        end

        subgraph net["Private networking (optional)"]
            vnet["VNet + subnets"]
            pe["Private Endpoints<br/>Cosmos, Key Vault,<br/>Foundry, Content Safety"]
        end
    end

    user -- HTTPS --> swa
    swa -- "Entra sign-in" --> entra
    swa -- "/api/* proxy" --> api
    api -- "MCP (internal ingress)" --> mcp
    job -- "run pipeline" --> api
    api -- "managed identity<br/>data-plane RBAC" --> cosmos
    api --> foundry
    api --> cs
    api -- "secret ref" --> kv
    api -- "webhook" --> teams
    api -. "validate tokens" .-> entra

    uami -. "AcrPull" .-> acr
    uami -. "Key Vault Secrets User" .-> kv
    uami -. "Cosmos data role" .-> cosmos
    uami -. "Cognitive Services roles" .-> foundry
    api & mcp & job -. "use identity" .-> uami
    gh -- "build & push image" --> acr
    acr -- "pull" --> cae

    cae --> law
    api & mcp & job -- "OpenTelemetry" --> ai_ins
    ai_ins --> law
    cosmos & kv & foundry & cs -- "diagnostics" --> law
    law --> alerts
    cae --- vnet
    vnet --- pe
    pe -.-> cosmos & kv & foundry & cs
```

## Notes

- `agent-api` and `scheduler` are built from the same image/project (`services/agent-api`); the scheduler runs as a Container Apps Job.
- The deterministic engine is the sole source of numbers; the LLM only selects/explains and is guarded by grounding checks in `safety.py`.
- Private endpoints, Content Safety, alerts, and the SWA linked backend are conditional on Bicep parameters (`enablePrivateNetworking`, `enableContentSafety`, `enableAlerts`, `linkSwaBackend`).

</details>
