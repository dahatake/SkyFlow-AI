# Copilot instructions

Read [AGENTS.md](../AGENTS.md) first; it is the source of truth for rules and commands.

Quick reminders:

- The domain engine (`app/src/domain`) is pure and deterministic. Use `clock.ts` for time and ids, never `Date.now()` or `Math.random()` there.
- LLM output must be validated against engine options. Models do not produce numbers.
- Agent proposals need human approval before anything is applied.
- All UI text uses `tr()` with zh/ko/ja translations.
- Customer-specific values belong in `app/src/customers/<id>/customer.json`.
- After changes run `npm test`, `npx tsc --noEmit` and `npm run lint` in `app/`.
- Use the skills in `.github/skills` for repeatable tasks (add-scenario, swap-customer-dataset, add-language, generate-deck, deploy-azure).
