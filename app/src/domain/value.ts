import { computeImpact } from './scenario';
import { activeMitigations, type DemoPack } from './demo';
import { scoreImpact, advise, type Score } from './judgement';
import type { Baseline, Scenario } from './types';
import type { CustomerAssumptions } from '../customers/schema';

export interface ValueRow {
  label: string; unit: string; before: number; after: number; delta: number;
}
export interface ValueReport {
  demoId: string; currency: string; rows: ValueRow[];
  /** Estimated saving for this single disruption, in the customer currency. */
  savingPerEvent: number; savingPerMonth: number;
  /** Every figure here is a simulation output combined with customer assumptions, never an observed result. */
  basis: string;
}

const sumDelay = (d: Record<string, number>) => Object.values(d).reduce((a, b) => a + Math.max(0, b), 0);

function measure(b: Baseline, sc: Scenario, override?: Record<string, string>) {
  const im = computeImpact(b, sc, activeMitigations(sc, override));
  return { score: scoreImpact(b, im) as Score, delayMin: sumDelay(im.flightDelay) };
}

/** Before = disruption with no decisions; after = the engine's advised option for every judgement task. Deterministic. */
export function valueReport(b: Baseline, pack: DemoPack, a: CustomerAssumptions, currency: string): ValueReport {
  const base: Scenario = { ...structuredClone(pack.scenario), state: 'Active', createdAt: 0, decisions: {} } as Scenario;
  const none = Object.fromEntries(pack.decisions.map((t) => [t.id, 'none']));
  const before = measure(b, base, none);
  const decided: Scenario = structuredClone(base);
  for (const t of pack.decisions) decided.decisions = { ...decided.decisions, [t.id]: { optionId: advise(b, base, pack.decisions, t).optionId, by: 'copilot', at: 0 } };
  const after = measure(b, decided);

  const row = (label: string, unit: string, x: number, y: number): ValueRow => ({ label, unit, before: x, after: y, delta: x - y });
  const rows = [
    row('Turnarounds in SLA breach', 'count', before.score.breach, after.score.breach),
    row('Turnarounds at risk', 'count', before.score.atRisk, after.score.atRisk),
    row('Blocked tasks', 'count', before.score.blocked, after.score.blocked),
    row('Flight delay minutes', 'min', before.delayMin, after.delayMin),
    row('Time from detection to owner action', 'min', a.manualResponseMinutes, a.agentResponseMinutes),
  ];
  const savingPerEvent = Math.max(0,
    (before.score.breach - after.score.breach) * a.slaBreachPenalty +
    (before.score.blocked - after.score.blocked) * a.blockedTaskCost +
    (before.delayMin - after.delayMin) * a.costPerDelayMinute);
  return {
    demoId: pack.id, currency, rows, savingPerEvent, savingPerMonth: savingPerEvent * a.disruptionsPerMonth,
    basis: `Simulated engine output x customer assumptions (${a.source})`,
  };
}
