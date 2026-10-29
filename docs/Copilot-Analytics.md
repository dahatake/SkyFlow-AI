# GitHub Copilot Analytics Report — SkyFlow AI

Snapshot: 2026-10-29 · Repository: `dahatake/SkyFlow-AI` · Source: git history and `.github/` contents (static analysis).

> Scope note: GitHub Copilot usage telemetry (suggestion acceptance, chat turns, seats) is **not stored in the repository**. This report covers what the repo proves: Copilot customization assets, commit activity, and the code surface they steer. For live usage metrics use the org/enterprise *Copilot usage metrics* dashboard or API.

## 1. Executive summary

| Metric | Value |
|---|---|
| Tracked files | 214 |
| Commits (all branches) | 22 (2026-10-28 → 10-29) |
| Contributors | 1 human, 5 Dependabot commits |
| Copilot customization files | 15 (in `.github/`, excl. workflows/dependabot) |
| Custom agents | 4 |
| Skills | 5 |
| Path-scoped instruction files | 4 + 1 repo-wide |
| Reusable prompts | 1 |
| Commits with `Co-authored-by: Copilot` trailer | 0 |

Takeaway: the repo is heavily **Copilot-ready** (agents, skills, scoped instructions covering all four code areas), but there is no commit-level attribution of Copilot-assisted work.

## 2. Copilot asset inventory

### Custom agents (`.github/agents/`)
| Agent | Purpose | Tools |
|---|---|---|
| `azure-deployer` | azd deployment after validation, least privilege | codebase, runCommands, search |
| `customer-onboarding` | Instantiate the tower for a new customer/airport | codebase, editFiles, runCommands, search |
| `deck-builder` | Executive and CIO/CTO decks, story check | codebase, editFiles, runCommands |
| `scenario-author` | Add disruption scenarios + tests | codebase, editFiles, runCommands, search |

### Skills (`.github/skills/`)
`add-language`, `add-scenario`, `deploy-azure`, `generate-deck`, `swap-customer-dataset`.

### Path-scoped instructions (`.github/instructions/`)
| File | `applyTo` |
|---|---|
| `domain.instructions.md` | `app/src/domain/**`, `app/src/data/**`, `app/tests/**` |
| `ui.instructions.md` | `app/src/components/**`, `app/src/App.tsx`, `app/src/i18n/**` |
| `agents.instructions.md` | `services/**` |
| `infra.instructions.md` | `infra/**`, `azure.yaml`, `.github/workflows/**`, `scripts/**` |

Plus `copilot-instructions.md` (repo-wide) and prompt `instantiate-engagement.prompt.md`.

## 3. Coverage analysis

| Code area | Files | Instructions | Agent | Skill |
|---|---|---|---|---|
| `app/` (React/TS UI + domain engine) | 103 | domain, ui | scenario-author, deck-builder | add-scenario, add-language, generate-deck |
| `services/` (agent-api Python, engine-mcp) | 35 | agents | — | — |
| `infra/`, workflows, scripts | ~7 + 4 workflows | infra | azure-deployer | deploy-azure |
| `docs/` (bilingual EN/JA) | 35 | — (repo-wide only) | customer-onboarding | swap-customer-dataset |

Every top-level code area has at least one scoped instruction file. Gaps:
- `docs/` has no scoped instruction (e.g. enforce EN/JA parity).
- `services/` has no dedicated agent or skill.
- No agent uses `fetch`/`githubRepo`; tools are limited to local operations (good for least privilege).

## 4. Activity profile

- 22 commits in 2 days: 4 on 10-28, 18 on 10-29 — a rapid, bursty build typical of AI-assisted scaffolding.
- Commit subjects: 13 of 22 use `feat…` conventional prefixes; 2 are generic "Refactor code structure for improved readability and maintainability" and 1 "Implement new feature…" — wording characteristic of auto-generated Copilot commit messages.
- File mix: `.ts` 59, `.md` 43, `.tsx` 26, `.py` 20, `.json` 15, `.bicep` 6 — TypeScript-dominant, which is well served by Copilot.
- Security/quality automation Copilot can leverage: `ci.yml`, `cd.yml`, `codeql.yml`, `deploy-env.yml`, Dependabot.

## 5. Recommendations

1. **Attribute AI work**: keep the `Co-authored-by: Copilot` trailer on Copilot-made commits to enable future measurement.
2. **Fill gaps**: add `docs.instructions.md` (`applyTo: docs/**`, EN/JA parity) and a `services` agent/skill.
3. **Replace generic commit messages** with specific ones; add a commit-message instruction.
4. **Pull real usage data**: enable the Copilot usage metrics API/dashboard for the org and add a scheduled workflow to export it into this repo.
5. **Validate customization health**: run the Chat Customizations evaluation on each `.agent.md`/`SKILL.md` (most are 5–10 lines; add inputs, outputs, and guardrails).
6. **Use Copilot code review** on PRs alongside CodeQL.

## 6. Method

Data from `git log`, `git ls-files`, and file frontmatter under `.github/`. Session-store history showed no recorded Copilot sessions for this repository. Counts are as of the snapshot date.
