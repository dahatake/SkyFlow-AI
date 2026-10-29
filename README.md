# AI Operations Control Tower

[![CI](https://github.com/dahatake/SkyFlow-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/dahatake/SkyFlow-AI/actions/workflows/ci.yml)
[![CodeQL](https://github.com/dahatake/SkyFlow-AI/actions/workflows/codeql.yml/badge.svg)](https://github.com/dahatake/SkyFlow-AI/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node 22+](https://img.shields.io/badge/node-22%2B-339933)
![Python 3.12](https://img.shields.io/badge/python-3.12-3776AB)

[Overview](#overview) · [Quick start](#quick-start) · [Tutorial](#tutorial) · [Architecture](#architecture) · [Repository map](#repository-map) · [Deploy](#deploy-to-azure) · [Contributing](#contributing) · [License](#license)

## Overview

**One real-time view of ground operations, with agents that propose the fix and a person who approves it.**

When lightning stops ramp work, 12 arrivals slip and 4 gates collide. Today the duty team finds that through radios, chat and several screens. This control tower ranks every conflict by SLA exposure, lets an agent pipeline compare the options with a deterministic scenario engine, asks a manager to approve, and turns the decision into owned 5W2H tasks. It then shows what the decision saved, with the assumptions visible.

Reference customer: SATS (Project SPEAR) at Singapore Changi. A second sample customer (`generic-hub`) proves the same repo can be re-targeted.

![From disruption to decision](docs/img/workflow.svg)

| Step | What the viewer sees | Screenshot |
|---|---|---|
| 1. Problem | Disruption and what is wrong | ![](docs/img/02-executive-problem.png) |
| 2. Proposal | Detect, Triage and Resolve agents propose options | ![](docs/img/03-agent-proposal.png) |
| 3. Approval and tasks | Person approves, tasks get owners | ![](docs/img/04-tasks.png) |
| 4. Value | Before and after, simulated, with assumptions | ![](docs/img/05-value.png) |

### Features

- Conflicts ranked by SLA exposure in a 3D/2D operations view
- Four-agent pipeline (Detect, Triage, Resolver, Comms) over a deterministic engine exposed through MCP
- Human approval gate with server-side role checks and an audit trail
- 5W2H task generation and a simulated before/after value model
- Multi-language UI (en, zh, ko, ja) and Playwright accessibility tests
- Customer-agnostic: re-target via one `customer.json`

## Quick start

Prerequisites: Node.js 22+ (see `app/.nvmrc`). Python 3.12 is only needed for `services/agent-api`. No Azure subscription is required.

```powershell
git clone https://github.com/dahatake/SkyFlow-AI.git
cd SkyFlow-AI
./scripts/setup.ps1        # Linux/macOS: ./scripts/setup.sh
cd app
npm run dev                # http://localhost:5173
```

Reproducible demo: <http://localhost:5173/?clock=2027-01-11T08:00:00%2B08:00&demo=1>. The agent features fall back to a deterministic rule-based advisor when no agent service is configured, so the demo never depends on the network.

## Tutorial

A guided walk-through of the demo, then the agent service, then your own customer.

### 1. Run the demo

```powershell
cd app
npm run dev
```

Open <http://localhost:5173/?clock=2027-01-11T08:00:00%2B08:00&demo=1>. The `clock` parameter freezes time so every run is identical.

### 2. Follow the decision flow

1. **Problem**: read the disruption summary and the ranked conflicts.
2. **Proposal**: open the agent proposal. Detect, Triage and Resolver list engine-computed options with their trade-offs.
3. **Approval and tasks**: approve one option. Owned 5W2H tasks appear.
4. **Value**: open the value view to compare before and after, with the assumptions shown.

### 3. Run the agent service (optional)

```powershell
cd services/engine-mcp; npm ci; npm start          # MCP tools on :8080
cd ../agent-api
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
$env:AUTH_DISABLED='true'; $env:ENGINE_MCP_URL='http://localhost:8080/mcp'
uvicorn agent_api.app:create_app --factory --port 8000
```

With no model configured the service runs in `rules` mode. Details: [agent-api](services/agent-api/README.md), [engine-mcp](services/engine-mcp/README.md).

### 4. Bring your own customer

1. Copy `app/src/customers/generic-hub` to `app/src/customers/<id>`.
2. Edit `customer.json` (names, airport, currency, assumptions with a source).
3. Register it in `app/src/customers/index.ts`.
4. Run `npm run validate:customer -- <id>`, then open `?customer=<id>`.

The full path to a deployed demo is in the [PLAYBOOK](docs/PLAYBOOK.md); a talk track is in [DEMO-SCRIPT](docs/DEMO-SCRIPT.md).

## Architecture

![System architecture](docs/img/architecture.svg)

Design rules:

1. **The engine is the source of truth.** Models only choose among options the engine computed. They never produce numbers.
2. **Agents propose, people approve.** Nothing is applied without an approval, and the baseline is never mutated.
3. **Every AI path has a deterministic fallback.** Same input gives the same output.

## Repository map

| Path | What it is |
|---|---|
| `app/` | React + TypeScript UI, the pure domain engine (`src/domain`), tests, Playwright e2e, deck sources |
| `app/src/customers/<id>/customer.json` | Everything customer specific: names, airport, assumptions, dates |
| `services/engine-mcp/` | The engine exposed as MCP tools |
| `services/agent-api/` | Multi-agent pipeline, approval gate, audit, Teams card |
| `infra/` | Bicep for the whole platform (`azd up`) |
| `docs/` | Requirements, narrative, [PLAYBOOK](docs/PLAYBOOK.md), [DEMO-SCRIPT](docs/DEMO-SCRIPT.md), [VALUE-MODEL](docs/VALUE-MODEL.md) |
| `.github/` | CI/CD, plus Copilot instructions, agents, skills and prompts for AI-driven reuse |

## Reuse it for another engagement

Open the repo in VS Code with Copilot and run the prompt `/instantiate-engagement` (see [PLAYBOOK](docs/PLAYBOOK.md)). It uses the `customer-onboarding` agent and the `swap-customer-dataset`, `generate-deck` and `deploy-azure` skills.

## Commands

| Task | Command (from `app/`) |
|---|---|
| Unit tests | `npm test` (coverage gate: `npm run test:coverage`) |
| End-to-end and accessibility | `npm run test:e2e` |
| Lint | `npm run lint` |
| Validate customer files | `npm run validate:customer` |
| Decks to PDF | `npm run build:deck -- <customerId>` |
| Deploy | `azd up` after `./scripts/preflight.ps1` |

## Deploy to Azure

```powershell
./scripts/preflight.ps1    # Linux/macOS: ./scripts/preflight.sh
azd up
```

Infrastructure is Bicep in `infra/`; CI/CD lives in `.github/workflows`. Authentication uses managed identity, with no secrets in the repo. See the PLAYBOOK for OIDC setup.

## Contributing

Issues and pull requests are welcome. Before opening a PR, run `npm test`, `npm run lint` and `npx tsc --noEmit` in `app/`. Read [AGENTS.md](AGENTS.md) for the hard rules (engine is the source of truth, human approval gate, deterministic fallback, no secrets, every UI string through `tr()`).

## License

[MIT](LICENSE) © 2026 Daiyu Hatakeyama

## Status and honesty

Data is synthetic. Value figures are simulation output combined with assumptions in `customer.json`, and the UI says so. Replace the assumptions with validated customer numbers before external use.
