import {
  SEVERITY_ORDER, SLA_ORDER,
  type AssetState, type Baseline, type Impact, type Mitigation, type Scenario, type ScenarioParams, type Severity, type SlaLevel, type TaskState,
} from './types';
import { tr } from '../i18n/core';
import { makeId, now as clockNow } from './clock';
import { trData } from '../i18n/data';

const raise = (l: SlaLevel, by: number): SlaLevel => SLA_ORDER[Math.min(3, SLA_ORDER.indexOf(l) + by)];
const maxLevel = (a: SlaLevel, b: SlaLevel): SlaLevel => (SLA_ORDER.indexOf(a) >= SLA_ORDER.indexOf(b) ? a : b);
const bumpSev = (s: Severity): Severity => SEVERITY_ORDER[Math.min(3, SEVERITY_ORDER.indexOf(s) + 1)];
const rankTask = (s: TaskState) => ['Planned', 'Ready', 'InProgress', 'Complete', 'AtRisk', 'Blocked'].indexOf(s);

export const emptyImpact = (): Impact => ({
  flightDelay: {}, turnaroundRisk: {}, taskRisk: {}, milestoneShift: {}, exceptionSeverity: {}, assetState: {},
  constraints: [], capacityPressure: {}, factors: {}, impactedIds: [], standOverride: {}, mitigations: [],
});

const inRange = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** SIM-002: range, type, required scope and cross-parameter compatibility. */
export function validateParams(p: ScenarioParams, b: Baseline): string[] {
  const e: string[] = [];
  if (!Object.values(p).some(Boolean)) e.push(tr('Enable at least one disruption case.'));
  const l = p.lateInbound;
  if (l) {
    if (!b.flights.some((f) => f.id === l.flightId)) e.push(tr('Late inbound: select a flight.'));
    if (!inRange(l.delayMin, 0, 240)) e.push(tr('Late inbound: delay must be a number between 0 and 240 minutes.'));
    if (!b.stands.some((s) => s.id === l.standId)) e.push(tr('Late inbound: select an affected stand.'));
  }
  const w = p.weather;
  if (w) {
    if (!inRange(w.startOffsetMin, 0, 720)) e.push(tr('Weather: start offset must be 0-720 minutes.'));
    if (!inRange(w.durationMin, 0, 180)) e.push(tr('Weather: stoppage duration must be between 0 and 180 minutes.'));
    if (!inRange(w.recoveryBufferMin, 0, 120)) e.push(tr('Weather: recovery buffer must be 0-120 minutes.'));
    if (!w.piers.length) e.push(tr('Weather: choose at least one affected zone.'));
  }
  const g = p.gse;
  if (g) {
    const count = b.assets.filter((a) => a.type === g.assetType && a.standId.startsWith(g.pier)).length;
    if (!g.assetType) e.push(tr('GSE: choose an asset type.'));
    if (!inRange(g.quantityUnavailable, 0, count)) e.push(tr('GSE: unavailable quantity must be 0..{count} (available {assets} on pier {pier}).', { count, assets: g.assetType || tr('assets'), pier: g.pier }));
    if (!inRange(g.durationMin, 1, 720)) e.push(tr('GSE: duration must be 1-720 minutes.'));
  }
  const s = p.staff;
  if (s) {
    if (!b.bus.some((x) => x.id === s.buId)) e.push(tr('Staff: select a BU/team.'));
    if (!inRange(s.capacityDeltaPct, 0, 100)) e.push(tr('Staff: capacity reduction must be 0-100%.'));
    if (!inRange(s.windowMin, 1, 720)) e.push(tr('Staff: effective window must be 1-720 minutes.'));
  }
  const t = p.slaStress;
  if (t) {
    if (!b.airlines.some((x) => x.id === t.airlineId)) e.push(tr('SLA stress: select an airline.'));
    if (!inRange(t.thresholdDeltaMin, 0, 60)) e.push(tr('SLA stress: threshold delta must be 0-60 minutes.'));
    if (!inRange(t.windowMin, 1, 720)) e.push(tr('SLA stress: time window must be 1-720 minutes.'));
  }
  if (g && w && w.piers.includes(g.pier) && w.durationMin === 0) e.push(tr('Combined: weather zone includes the GSE pier but stoppage duration is 0.'));
  return e;
}

/**
 * Pure scenario engine: baseline + validated params + decision mitigations -> derived overlay (SIM-001, NFR-004).
 * Mitigations only ever change the overlay; baseline records are never touched.
 */
export function computeImpact(b: Baseline, sc: Scenario, mit: Mitigation[] = []): Impact {
  const im = emptyImpact();
  const p = sc.params;
  const impacted = new Set<string>();
  const why = (id: string, msg: string) => ((im.factors[id] ??= []).push(`${trData(sc.name)}: ${msg}`), impacted.add(id));
  const taOf = (flightId: string) => b.turnarounds.find((t) => t.flightId === flightId);
  const raiseTurn = (taId: string, lvl: SlaLevel) => (im.turnaroundRisk[taId] = maxLevel(im.turnaroundRisk[taId] ?? 'Normal', lvl));
  const hitTask = (taskId: string, st: TaskState) => {
    const cur = im.taskRisk[taskId];
    if (!cur || rankTask(st) > rankTask(cur)) im.taskRisk[taskId] = st;
  };
  const escalate = (ids: string[]) =>
    b.exceptions.filter((x) => x.status !== 'Resolved' && x.affectedEntityIds.some((i) => ids.includes(i))).forEach((x) => {
      im.exceptionSeverity[x.id] = bumpSev(im.exceptionSeverity[x.id] ?? x.severity);
      impacted.add(x.id);
    });

  // ---- mitigations -------------------------------------------------------
  const gseRestore = (type: string, pier: string) => mit.filter((m) => m.kind === 'gse' && m.assetType === type && m.pier === pier).reduce((a, m) => a + (m as { qty: number }).qty, 0);
  const bufferCut = mit.reduce((a, m) => a + (m.kind === 'bufferCut' ? m.minutes : 0), 0);
  const deferLow = mit.some((m) => m.kind === 'deferLow');
  const recover = (fid: string) => mit.reduce((a, m) => a + (m.kind === 'recover' && m.flightId === fid ? m.minutes : 0), 0);
  const staffAdj: Record<string, number> = {};
  mit.forEach((m) => {
    if (m.kind !== 'staff') return;
    staffAdj[m.buId] = (staffAdj[m.buId] ?? 0) + m.add;
    if (m.fromBuId) staffAdj[m.fromBuId] = (staffAdj[m.fromBuId] ?? 0) - m.add;
  });
  const saves: Record<string, number> = {};
  const closed = new Set(b.constraints.filter((c) => b.stands.some((s) => s.id === c.scope)).map((c) => c.scope));
  mit.forEach((m) => {
    if (m.kind !== 'gate') return;
    const targets = b.stands.filter((s) => s.pier === m.toPier && !closed.has(s.id));
    const load = new Map(targets.map((s) => [s.id, b.flights.filter((f) => f.standId === s.id).length]));
    const moved = b.flights.filter((f) => {
      const ta = taOf(f.id);
      if (!ta || ta.phase === 'Complete' || f.status === 'Departed' || f.status === 'Cancelled') return false;
      return m.flightIds ? m.flightIds.includes(f.id) : m.fromPiers.includes(f.pierId);
    });
    moved.forEach((f) => {
      const t = [...targets].sort((x, y) => load.get(x.id)! - load.get(y.id)!)[0];
      if (!t) return;
      load.set(t.id, load.get(t.id)! + 1);
      im.standOverride[f.id] = t.id;
      if (m.savesMin) saves[f.id] = (saves[f.id] ?? 0) + m.savesMin;
      why(f.id, m.savesMin ? tr('re-gated {from} → {to} (saves {min} min)', { from: f.standId, to: t.id, min: m.savesMin }) : tr('re-gated {from} → {to}', { from: f.standId, to: t.id }));
    });
  });
  const pierOf = (flightId: string) => {
    const f = b.flights.find((x) => x.id === flightId)!;
    const s = im.standOverride[flightId];
    return s ? b.stands.find((x) => x.id === s)!.pier : f.pierId;
  };
  im.mitigations = mit.map((m) => m.kind);

  if (p.lateInbound) {
    const l = p.lateInbound;
    const mult = { Low: 0.5, Med: 1, High: 1.5 }[l.sensitivity];
    const f = b.flights.find((x) => x.id === l.flightId);
    const ta = f && taOf(f.id);
    if (f && ta && l.delayMin > 0) {
      const rec = recover(f.id) + (saves[f.id] ?? 0);
      const residual = Math.max(0, l.delayMin - rec);
      const eff = residual * mult;
      im.flightDelay[f.id] = (im.flightDelay[f.id] ?? 0) + l.delayMin;
      why(f.id, tr('late inbound +{min} min ({sens} connection sensitivity)', { min: l.delayMin, sens: trData(l.sensitivity) }) + (rec ? tr('; {rec} min recovered by decisions', { rec }) : ''));
      raiseTurn(ta.id, eff >= 60 ? 'Breach' : eff >= 30 ? 'AtRisk' : eff >= 10 ? 'Watch' : 'Normal');
      why(ta.id, tr('residual delay {residual} × {mult} = {eff} effective min', { residual, mult, eff: eff.toFixed(0) }));
      b.milestones.filter((m) => m.turnaroundId === ta.id).forEach((m) => {
        im.milestoneShift[m.id] = (im.milestoneShift[m.id] ?? 0) + residual;
        impacted.add(m.id);
      });
      b.tasks.filter((t) => t.turnaroundId === ta.id && t.status !== 'Complete').forEach((t) => {
        hitTask(t.id, eff >= 30 ? 'AtRisk' : t.status);
        why(t.id, tr('forecast shifted +{min} min', { min: residual }));
      });
      if (eff >= 30) escalate([f.id, ta.id]);
    }
  }

  if (p.weather && p.weather.durationMin > 0) {
    const w = p.weather;
    const start = (sc.anchor ?? b.now) + w.startOffsetMin;
    const hardEnd = start + w.durationMin;
    const bufferMin = Math.max(0, w.recoveryBufferMin - bufferCut);
    const end = hardEnd + bufferMin;
    w.piers.forEach((pier) => {
      im.constraints.push({ id: `sim-wx-${pier}`, type: 'Simulated ramp stoppage', scope: pier, start, end, severity: w.severity, source: 'Simulation', sourceTime: b.now });
    });
    b.turnarounds.forEach((ta) => {
      const f = b.flights.find((x) => x.id === ta.flightId)!;
      const pier = pierOf(f.id);
      if (!w.piers.includes(pier) || ta.plannedEnd < start || ta.plannedStart > end || ta.phase === 'Complete') return;
      const hard = ta.plannedStart <= hardEnd;
      raiseTurn(ta.id, !hard ? 'Watch' : w.severity === 'Critical' ? 'Breach' : w.severity === 'High' ? 'AtRisk' : 'Watch');
      why(ta.id, hard ? tr('ramp stoppage {min} min on pier {pier}', { min: w.durationMin, pier }) : tr('recovery buffer {min} min on pier {pier}', { min: bufferMin, pier }));
      b.tasks.filter((t) => t.turnaroundId === ta.id && t.status !== 'Complete').forEach((t) => {
        hitTask(t.id, !hard || w.severity === 'Low' ? 'AtRisk' : 'Blocked');
        why(t.id, hard ? tr('ramp work suspended') : tr('ramp work restarting'));
      });
      escalate([f.id, ta.id]);
    });
  }

  if (p.gse && p.gse.quantityUnavailable > 0) {
    const g = p.gse;
    const qty = Math.max(0, g.quantityUnavailable - gseRestore(g.assetType, g.pier));
    const pool = b.assets.filter((a) => a.type === g.assetType && a.standId.startsWith(g.pier));
    pool.slice(0, qty).forEach((a) => {
      im.assetState[a.id] = 'Unavailable' as AssetState;
      why(a.id, tr('{type} unavailable for {min} min', { type: trData(g.assetType), min: g.durationMin }));
      b.tasks.filter((t) => t.assetId === a.id && t.status !== 'Complete').forEach((t) => {
        hitTask(t.id, 'Blocked');
        why(t.id, tr('dependent asset {id} unavailable', { id: a.id }));
        raiseTurn(t.turnaroundId, 'AtRisk');
        why(t.turnaroundId, tr('task {task} lacks {type}', { task: trData(t.taskType), type: trData(g.assetType) }));
      });
      escalate([a.id]);
    });
    if (qty < g.quantityUnavailable) pool.slice(qty, g.quantityUnavailable).forEach((a) => why(a.id, tr('{type} restored by decision', { type: trData(g.assetType) })));
  }

  const windowFor = p.staff?.windowMin ?? 240;
  b.staff.forEach((x) => {
    const s = p.staff;
    const delta = s && s.buId === x.buId && (!s.skillGroup || s.skillGroup === x.skillGroup) ? s.capacityDeltaPct : 0;
    const rows = b.staff.filter((y) => y.buId === x.buId).length;
    const adj = (staffAdj[x.buId] ?? 0) / rows;
    if (delta === 0 && adj >= 0) return;
    const eff = x.available * (1 - delta / 100) + adj;
    const pressure = eff <= 0 ? 9.99 : x.engaged / eff;
    im.capacityPressure[x.id] = pressure;
    why(x.id, tr('capacity {from} → {to}', { from: x.available, to: eff.toFixed(1) }) + (delta ? tr(' (−{pct}%)', { pct: delta }) : '') + (adj ? tr(', crew {adj} by decisions', { adj: `${adj > 0 ? '+' : ''}${adj.toFixed(1)}` }) : '') + tr(', pressure {p}', { p: pressure.toFixed(2) }));
    if (pressure > 1) {
      b.tasks.filter((t) => t.buId === x.buId && t.status !== 'Complete' && t.plannedTime <= b.now + windowFor).forEach((t) => {
        if (deferLow && t.priority === 3) { why(t.id, tr('deferred (priority 3) by decision')); return; }
        hitTask(t.id, pressure > 1.3 ? 'Blocked' : 'AtRisk');
        why(t.id, tr('staff pressure {p} on {skill}', { p: pressure.toFixed(2), skill: trData(x.skillGroup) }));
        raiseTurn(t.turnaroundId, pressure > 1.3 ? 'AtRisk' : 'Watch');
      });
    }
  });

  if (p.slaStress && p.slaStress.thresholdDeltaMin > 0) {
    const t = p.slaStress;
    const steps = Math.ceil(t.thresholdDeltaMin / 20);
    b.turnarounds.forEach((ta) => {
      const f = b.flights.find((x) => x.id === ta.flightId)!;
      if (f.airlineId !== t.airlineId || ta.plannedStart > b.now + t.windowMin || ta.phase === 'Complete') return;
      raiseTurn(ta.id, raise(ta.slaRisk, steps));
      why(ta.id, tr(steps > 1 ? '{milestone} threshold tightened by {min} min (+{steps} SLA steps)' : '{milestone} threshold tightened by {min} min (+{steps} SLA step)', { milestone: trData(t.milestoneType), min: t.thresholdDeltaMin, steps }));
    });
  }

  // Escalate exceptions that touch blocked tasks introduced by the scenario.
  const blocked = Object.entries(im.taskRisk).filter(([, s]) => s === 'Blocked').map(([id]) => id);
  if (blocked.length) escalate(blocked);

  im.impactedIds = [...impacted];
  return im;
}

export function defaultScenario(): Scenario {
  return { id: makeId('sc'), name: tr('New scenario'), notes: '', state: 'Draft', createdAt: clockNow(), params: {} };
}
