import { tr } from '../i18n/core';
import { trData } from '../i18n/data';
import { computeImpact } from './scenario';
import { activeMitigations, type DecisionOption, type DecisionTask } from './demo';
import { SLA_ORDER, type Baseline, type Impact, type Scenario } from './types';

export interface Score { atRisk: number; breach: number; blocked: number; escalated: number; impacted: number; weighted: number }

export function scoreImpact(b: Baseline, im: Impact): Score {
  const lvl = (taId: string) => {
    const t = b.turnarounds.find((x) => x.id === taId)!;
    const o = im.turnaroundRisk[taId];
    return o && SLA_ORDER.indexOf(o) > SLA_ORDER.indexOf(t.slaRisk) ? o : t.slaRisk;
  };
  const live = b.turnarounds.filter((t) => t.phase !== 'Complete');
  const atRisk = live.filter((t) => ['AtRisk', 'Breach'].includes(lvl(t.id))).length;
  const breach = live.filter((t) => lvl(t.id) === 'Breach').length;
  const blocked = Object.values(im.taskRisk).filter((s) => s === 'Blocked').length;
  const escalated = Object.keys(im.exceptionSeverity).length;
  const impacted = im.impactedIds.length;
  return { atRisk, breach, blocked, escalated, impacted, weighted: breach * 5 + atRisk * 3 + blocked * 2 + escalated };
}

export function evaluate(b: Baseline, sc: Scenario, override?: Record<string, string>): Score {
  return scoreImpact(b, computeImpact(b, sc, activeMitigations(sc, override)));
}

export const noDecisions = (task: DecisionTask[]) => Object.fromEntries(task.map((t) => [t.id, 'none']));

export interface Advice { optionId: string; rationale: string; scores: Record<string, Score> }

/** Copilot-assist: rule-based advisory that simulates each option with the other decisions held fixed. */
export function advise(b: Baseline, sc: Scenario, pack: DecisionTask[], task: DecisionTask): Advice {
  const current = Object.fromEntries(pack.map((t) => [t.id, sc.decisions?.[t.id]?.optionId ?? 'none']));
  const scores: Record<string, Score> = {};
  task.options.forEach((o) => { scores[o.id] = evaluate(b, sc, { ...current, [task.id]: o.id }); });
  const rank = (o: DecisionOption) => scores[o.id].weighted + o.cost * 0.5;
  const best = [...task.options].sort((a, c) => rank(a) - rank(c))[0];
  const base = scores['none'] ?? scores[task.options[0].id];
  const s = scores[best.id];
  const rationale = best.id === 'none'
    ? tr('No option improves the weighted risk score enough to justify its cost; monitor and revisit if conditions change.')
    : tr('Cuts flights at risk {a0} → {a1}, blocked tasks {b0} → {b1} and escalated exceptions {e0} → {e1}. Trade-off: {tradeoff}', { a0: base.atRisk, a1: s.atRisk, b0: base.blocked, b1: s.blocked, e0: base.escalated, e1: s.escalated, tradeoff: trData(best.tradeoff) });
  return { optionId: best.id, rationale, scores };
}
