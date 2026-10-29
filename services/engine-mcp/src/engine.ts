import { DEMO_PACK, demoById, type DecisionTask, type DemoPack } from '../../../app/src/domain/demo';
import { advise, evaluate, type Score } from '../../../app/src/domain/judgement';
import { actionRows, slaKpis } from '../../../app/src/domain/kpi';
import { applyLive } from '../../../app/src/domain/live';
import { PRESETS, defaultConfig, optimize, type PresetId } from '../../../app/src/domain/optimizer';
import { computeImpact, validateParams } from '../../../app/src/domain/scenario';
import { buildSeed, deepFreeze } from '../../../app/src/domain/seed';
import { activeMitigations } from '../../../app/src/domain/demo';
import { SEVERITY_ORDER, type Baseline, type Scenario, type Severity } from '../../../app/src/domain/types';
import { OpsView, noFilters } from '../../../app/src/domain/view';

export class ToolError extends Error {
  constructor(readonly code: string, message: string, readonly details?: Record<string, unknown>) { super(message); }
}

export const MAX_TICK = 1440;
export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

let seed: Baseline | undefined;
const cache = new Map<number, Baseline>();

/** Frozen baseline at a live tick; computed once per tick and never mutated by any tool. */
export function baselineAt(tick = 0): Baseline {
  if (!Number.isInteger(tick) || tick < 0 || tick > MAX_TICK) throw new ToolError('invalid_tick', `tick must be an integer between 0 and ${MAX_TICK}`);
  let b = cache.get(tick);
  if (!b) {
    seed ??= deepFreeze(buildSeed());
    b = deepFreeze(applyLive(seed, tick));
    if (cache.size > 64) cache.clear();
    cache.set(tick, b);
  }
  return b;
}

const viewOf = (b: Baseline) => new OpsView(b, 'baseline', undefined, noFilters, null);

function pack(demoId: string): DemoPack {
  const d = demoById(demoId);
  if (!d) throw new ToolError('unknown_demo', `Unknown demoId '${demoId}'`, { validDemoIds: DEMO_PACK.map((x) => x.id) });
  return d;
}

function task(d: DemoPack, taskId: string): DecisionTask {
  const t = d.decisions.find((x) => x.id === taskId);
  if (!t) throw new ToolError('unknown_task', `Unknown taskId '${taskId}' for ${d.id}`, { validTaskIds: d.decisions.map((x) => x.id) });
  return t;
}

/** Validates every taskId and optionId against the engine's own option lists and fills the rest with 'none'. */
function resolveDecisions(d: DemoPack, decisions: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = Object.fromEntries(d.decisions.map((t) => [t.id, 'none']));
  for (const [taskId, optionId] of Object.entries(decisions)) {
    const t = task(d, taskId);
    if (!t.options.some((o) => o.id === optionId)) {
      throw new ToolError('unknown_option', `Unknown optionId '${optionId}' for task '${taskId}'`, { validOptionIds: t.options.map((o) => o.id) });
    }
    out[taskId] = optionId;
  }
  return out;
}

function scenarioOf(d: DemoPack, decisions: Record<string, string>): Scenario {
  return {
    ...d.scenario, state: 'Active', createdAt: 0,
    decisions: Object.fromEntries(Object.entries(decisions).map(([k, v]) => [k, { optionId: v, by: 'copilot' as const, at: 0 }])),
  } as Scenario;
}

const delta = (a: Score, b: Score) => Object.fromEntries((Object.keys(a) as (keyof Score)[]).map((k) => [k, b[k] - a[k]])) as unknown as Score;

export function getLiveState(tick = 0) {
  const b = baselineAt(tick);
  const v = viewOf(b);
  const count = <T>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((m, x) => { const k = f(x); m[k] = (m[k] ?? 0) + 1; return m; }, {});
  return {
    tick, operationalMinute: b.now, seedVersion: b.seedVersion,
    flights: { total: b.flights.length, byStatus: count(b.flights, (f) => f.status) },
    turnarounds: { total: b.turnarounds.length, byPhase: count(b.turnarounds, (t) => t.phase), bySlaRisk: count(b.turnarounds, (t) => t.slaRisk) },
    tasks: { total: b.tasks.length, byStatus: count(b.tasks, (t) => t.status) },
    assets: { total: b.assets.length, byStatus: count(b.assets, (a) => a.status) },
    constraints: b.constraints.map((c) => ({ id: c.id, type: c.type, scope: c.scope, start: c.start, end: c.end, severity: c.severity })),
    openExceptions: v.exceptions.length,
  };
}

export function getExceptions(tick = 0, severity?: Severity) {
  const v = viewOf(baselineAt(tick));
  const items = v.exceptions
    .filter((e) => !severity || v.severity(e) === severity)
    .map((e) => ({
      id: e.id, type: e.type, severity: v.severity(e), detectedAt: e.detectedAt, source: e.source, status: v.statusOf(e),
      ownerId: v.ownerIdOf(e) ?? null, affectedEntityIds: e.affectedEntityIds, explanation: e.explanation, nextAction: e.nextAction, targetTime: e.targetTime,
    }));
  return { tick, count: items.length, exceptions: items };
}

export function rankBySla(tick = 0) {
  const v = viewOf(baselineAt(tick));
  const rows = actionRows(v);
  const breached = (r: (typeof rows)[number]) => (r.ackState === 'breached' ? 1 : 0) + (r.actState === 'breached' ? 1 : 0);
  const open = new Set(v.exceptions.map((e) => e.id));
  const ranked = rows
    .filter((r) => open.has(r.id))
    .sort((a, c) => SEVERITY_ORDER.indexOf(c.severity) - SEVERITY_ORDER.indexOf(a.severity) || breached(c) - breached(a) || a.detectedAt - c.detectedAt || a.id.localeCompare(c.id))
    .map((r, i) => ({ rank: i + 1, ...r, ownerId: r.ownerId ?? null }));
  return { tick, ranked, kpis: slaKpis(rows) };
}

const optionView = (o: DecisionTask['options'][number]) => ({ id: o.id, label: o.label, detail: o.detail, tradeoff: o.tradeoff, cost: o.cost });

export function listDecisionTasks(demoId: string) {
  const d = pack(demoId);
  return {
    demoId: d.id, title: d.title, blurb: d.blurb,
    tasks: d.decisions.map((t) => ({ id: t.id, title: t.title, area: t.area, question: t.question, owner: t.owner, options: t.options.map(optionView) })),
  };
}

export function runScenario(demoId: string, decisions: Record<string, string>, tick = 0) {
  const d = pack(demoId);
  const b = baselineAt(tick);
  const full = resolveDecisions(d, decisions);
  const sc = scenarioOf(d, full);
  const errs = validateParams(sc.params, b);
  if (errs.length) throw new ToolError('invalid_scenario', errs.join('; '));
  const im = computeImpact(b, sc, activeMitigations(sc, full));
  const score = evaluate(b, sc, full);
  const none = evaluate(b, scenarioOf(d, Object.fromEntries(d.decisions.map((t) => [t.id, 'none']))), Object.fromEntries(d.decisions.map((t) => [t.id, 'none'])));
  const delays = Object.values(im.flightDelay);
  return {
    demoId: d.id, tick, decisions: full, score, baselineScore: none, delta: delta(none, score),
    impact: {
      impactedCount: im.impactedIds.length, flightsDelayed: delays.filter((x) => x > 0).length, maxFlightDelayMin: delays.length ? Math.max(...delays) : 0,
      standOverrides: Object.keys(im.standOverride).length, constraints: im.constraints.length, mitigations: im.mitigations,
    },
  };
}

export function compareOptions(demoId: string, taskId: string, tick = 0) {
  const d = pack(demoId);
  const t = task(d, taskId);
  const b = baselineAt(tick);
  const sc = scenarioOf(d, Object.fromEntries(d.decisions.map((x) => [x.id, 'none'])));
  const adv = advise(b, sc, d.decisions, t);
  const none = adv.scores['none'] ?? adv.scores[t.options[0].id];
  return {
    demoId: d.id, taskId: t.id, tick, title: t.title, question: t.question,
    options: t.options.map((o) => ({ ...optionView(o), score: adv.scores[o.id], deltaVsNone: delta(none, adv.scores[o.id]) })),
    advice: { optionId: adv.optionId, rationale: adv.rationale },
  };
}

export function runOptimizer(preset?: PresetId, tick = 0) {
  if (preset !== undefined && !PRESET_IDS.includes(preset)) throw new ToolError('unknown_preset', `Unknown preset '${preset}'`, { validPresets: PRESET_IDS });
  const b = baselineAt(tick);
  const cfg = defaultConfig();
  if (preset) cfg.weights = { ...PRESETS[preset].weights };
  const p = optimize(viewOf(b), cfg, b.now);
  return {
    tick, preset: preset ?? 'balanced', summary: p.summary, before: p.before, after: p.after,
    flightsConsidered: p.flightsConsidered, tasksConsidered: p.tasksConsidered,
    counts: { standMoves: p.standMoves.length, gseAssignments: p.gse.length, staffTransfers: p.staff.length, taskShifts: p.shifts.length, unresolved: p.unresolved.length },
    standMoves: p.standMoves.slice(0, 20), staffTransfers: p.staff.slice(0, 20), unresolved: p.unresolved.slice(0, 20), priorityOrder: p.priorityOrder.slice(0, 10),
  };
}

export function getKpiValue(demoId: string, decisions: Record<string, string>, tick = 0) {
  const r = runScenario(demoId, decisions, tick);
  return { demoId: r.demoId, tick, decisions: r.decisions, before: r.baselineScore, after: r.score, delta: r.delta, weightedImprovement: r.baselineScore.weighted - r.score.weighted };
}
