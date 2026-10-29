# Value model

Source: `app/src/domain/value.ts`. Customer inputs: `app/src/customers/<id>/customer.json` (`assumptions`).

For each demo disruption the engine computes two states:

- **Without decisions**: the disruption with no mitigation.
- **With decisions**: the engine's advised option for every judgement task.

| Measure | Source |
|---|---|
| SLA breaches, at-risk turnarounds, blocked tasks | `judgement.scoreImpact` over the engine impact |
| Flight delay minutes | Sum of `flightDelay` in the engine impact |
| Detection to owner action (min) | `assumptions.manualResponseMinutes` vs `agentResponseMinutes` |

Saving per event = avoided breaches x `slaBreachPenalty` + avoided blocked tasks x `blockedTaskCost` + avoided delay minutes x `costPerDelayMinute`. Monthly = per event x `disruptionsPerMonth`.

All outputs are **simulated**. The UI, decks and README say so. The default numbers are placeholders flagged in `assumptions.source`; replace them with finance and SIOC-validated figures and record the source there.

The response time row is an assumption, not a measurement. Measure it in a pilot (alert time to first owner action) before quoting it.
