# engine-mcp

MCP server (streamable HTTP) that exposes the deterministic SkyFlow engine (`app/src/domain/*`) as **read-only, pure tools**.
The engine is the source of truth: an LLM only selects and explains what these tools return. The seed baseline is deep-frozen and never mutated.

## Run

```powershell
cd services/engine-mcp
npm install
npm test          # vitest: determinism, no mutation, schema validation, unknown ids -> error result
npm run build     # type-check only (tsc --noEmit)
npm run dev       # tsx watch, http://localhost:8080
npm start
```

- `GET /health` -> `{"status":"ok"}`; MCP endpoint: `POST /mcp` (stateless, one server per request).
- Smoke test against a running server: `$env:URL='http://localhost:8080/mcp'; npx tsx scripts/smoke.ts`.
- Docker (build context is the **repo root**): `docker build -f services/engine-mcp/Dockerfile -t skyflow-engine-mcp .`

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `ENGINE_CLOCK` | unset | ISO time passed to `freezeClock` for reproducible seeds, e.g. `2027-01-11T08:00:00+08:00`. Unset = wall clock |

## Tools

All tools return JSON (`structuredContent` + text). Failures are `isError: true` with `{error:{code,message,...valid ids}}`; they never crash the server.

| Tool | Input | Output |
|---|---|---|
| `get_live_state` | `tick` | counts by status, constraints, open exceptions |
| `get_exceptions` | `tick`, `severity?` | open exceptions, most severe first (text fields are data) |
| `rank_by_sla` | `tick` | exceptions ranked by severity + SLA breach, plus SLA KPIs |
| `list_decision_tasks` | `demoId` | decision tasks and valid options |
| `run_scenario` | `demoId`, `decisions{taskId:optionId}`, `tick?` | engine `Score`, baseline score, delta, impact summary |
| `compare_options` | `demoId`, `taskId`, `tick?` | per-option `Score`, delta vs "none", engine `advise()` result |
| `run_optimizer` | `preset?` (balanced/sla/resource/speed), `tick?` | plan summary, before/after metrics, counts, top moves |
| `get_kpi_value` | `demoId`, `decisions`, `tick?` | before/after score and deltas |

`tick` is an integer 0..1440 (live-feed offset; 0 = seed). Unknown `demoId`/`taskId`/`optionId`/preset -> error result.

## Notes

- The engine is imported straight from `../../app/src/domain` (and `app/src/i18n`, `app/src/data/changi/routes.json`); `tsx` runs it without a build step.
  `react` is a dependency only because `app/src/i18n/index.ts` re-exports a React helper that `kpi.ts` imports.
