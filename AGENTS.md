# AGENTS.md

Guidance for AI coding agents (Copilot, etc.) working in this repo. Humans: see [README.md](README.md) and [docs/PLAYBOOK.md](docs/PLAYBOOK.md).

## What this is

An AI Operations Control Tower for airport ground handling. React UI plus a pure, deterministic scenario engine, exposed to a multi-agent service through MCP.

## Hard rules

1. **Engine is the source of truth.** Code in `app/src/domain` is pure and deterministic. Never mutate the baseline (it is deep-frozen). Overlays are derived.
2. **Models never produce numbers.** Agents pick among engine options. Validate every model-chosen id against the engine's list.
3. **Human approval gate.** Nothing is applied from an agent proposal without an explicit approval. Approver roles are checked server side.
4. **Deterministic fallback.** Every AI path must work with the model off (`mode: rules`).
5. **No wall-clock or randomness in the domain.** Use `app/src/domain/clock.ts` (`now`, `nowDate`, `makeId`). `?clock=<ISO>` freezes time. Do not use `Math.random`.
6. **Customer specifics live in `app/src/customers/<id>/customer.json`.** Do not hard-code customer names, currencies or assumptions in code.
7. **Every UI string goes through `tr('English text')`.** Add zh/ko/ja to a `src/i18n/dict-*.ts` file. `tests/i18n.test.ts` enforces it.
8. **No secrets in the repo.** Use managed identity and Key Vault. `.azure/` is ignored.

## Commands (run from `app/` unless noted)

```
npm ci --legacy-peer-deps   # .npmrc already sets this
npm test                    # unit + property + golden tests
npm run test:coverage       # >= 80% on src/domain
npm run lint
npx tsc --noEmit
npm run test:e2e            # Playwright, starts vite on :4173
npm run validate:customer
```

Services: `cd services/engine-mcp && npm test`; `cd services/agent-api && python -m pytest`.
Infra: `az bicep build --file infra/main.bicep`.

## Conventions

- TypeScript strict. Add a test for every new domain function. Golden snapshots live in `app/tests/__snapshots__`; update them only when behaviour change is intended.
- Keep comments rare and only where intent is not obvious.
- Do not reformat files you are not changing.
- Bicep: plain resources or AVM, parameters for anything customer or region specific, no hard-coded subscription ids.

## Where to look

| Need | File |
|---|---|
| Add a disruption scenario / decision | `app/src/domain/demo.ts`, `scenario.ts` |
| Change scoring | `app/src/domain/judgement.ts` |
| Change value model | `app/src/domain/value.ts`, `docs/VALUE-MODEL.md` |
| Agent pipeline | `services/agent-api/` |
| Engine tools | `services/engine-mcp/src` |
| Deploy | `infra/`, `azure.yaml`, `.github/workflows/cd.yml` |

Custom agents are in `.github/agents`, skills in `.github/skills`, prompts in `.github/prompts`.
