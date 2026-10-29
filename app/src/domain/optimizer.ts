import type { Asset, Baseline, Flight, Impact, SlaLevel, Stand, Task } from './types';
import { emptyImpact } from './scenario';
import { SEVERITY_ORDER, SLA_ORDER } from './types';
import type { OpsView } from './view';
import { tr } from '../i18n';

/**
 * One-click resource optimizer ("autopilot" for planners). A pure, deterministic, priority-driven heuristic that follows
 * common airport resource-allocation practice (gate assignment with turnaround buffers and a rolling horizon with a frozen
 * window, GSE assignment as time-window scheduling with proximity, skill-pool levelling with crew-seat limits).
 * It only produces a recommended plan; it never edits baseline records (DATA-003).
 */

export interface OptWeights { sla: number; distance: number; time: number; resource: number }
export interface OptLimits {
  /** Rolling horizon: only flights arriving inside this many minutes are replanned. */
  horizonMin: number;
  /** Minimum gap between two aircraft using the same stand (turnaround buffer). */
  standBufferMin: number;
  /** Longest acceptable GSE drive, in map units. */
  maxGseDistance: number;
  /** Crew seats: maximum concurrent servicing tasks one stand can host. */
  seatsPerStand: number;
  /** Duration assumed for a GSE-supported task. */
  taskMinutes: number;
}
export interface OptConfig { weights: OptWeights; limits: OptLimits }

export type PresetId = 'balanced' | 'sla' | 'resource' | 'speed';
export const PRESETS: Record<PresetId, { label: string; blurb: string; weights: OptWeights }> = {
  balanced: { label: 'Balanced', blurb: 'Even trade-off across all priorities', weights: { sla: 5, distance: 5, time: 5, resource: 5 } },
  sla: { label: 'SLA first', blurb: 'Protect premium airlines and at-risk turnarounds', weights: { sla: 9, distance: 3, time: 6, resource: 3 } },
  resource: { label: 'Resource saving', blurb: 'Fewer moves, shorter equipment travel, even workload', weights: { sla: 3, distance: 8, time: 3, resource: 9 } },
  speed: { label: 'Time critical', blurb: 'Soonest departures get the best stands and equipment', weights: { sla: 4, distance: 3, time: 10, resource: 3 } },
};
export const DEFAULT_LIMITS: OptLimits = { horizonMin: 180, standBufferMin: 10, maxGseDistance: 60, seatsPerStand: 4, taskMinutes: 20 };
export const defaultConfig = (): OptConfig => ({ weights: { ...PRESETS.balanced.weights }, limits: { ...DEFAULT_LIMITS } });

export interface StandMove { flightId: string; flightNo: string; from: string; to: string; reason: string }
export interface GseAssignment { taskId: string; taskType: string; flightNo: string; assetId: string; assetType: string; fromStand: string; toStand: string; distance: number; start: number; end: number; reason: string }
export interface StaffTransfer { fromBuId: string; fromSkill: string; toBuId: string; toSkill: string; qty: number; reason: string }
export interface TaskShift { taskId: string; taskType: string; flightNo: string; standId: string; shiftMin: number; reason: string }
export interface Unresolved { kind: 'stand' | 'gse' | 'staff'; ref: string; reason: string }
export interface OptMetrics {
  standConflicts: number; gseUnassigned: number; gseTravel: number; overloadedPools: number; seatOverruns: number; weightedScore: number;
}
export interface StandCap { standId: string; seats: number; peakBefore: number; peakAfter: number; tasks: number }
export interface GseCap { type: string; total: number; usable: number; assignedUnits: number; assignedTasks: number; peakInUse: number }
export interface StaffCap { buId: string; skill: string; available: number; engaged: number; availableAfter: number; pressureBefore: number; pressureAfter: number }
export interface OptPlan {
  capacity: { stands: StandCap[]; gse: GseCap[]; staff: StaffCap[] };
  summary: string[];
  generatedAt: number; config: OptConfig;
  standMoves: StandMove[]; gse: GseAssignment[]; staff: StaffTransfer[]; shifts: TaskShift[]; unresolved: Unresolved[];
  before: OptMetrics; after: OptMetrics; flightsConsidered: number; tasksConsidered: number; priorityOrder: { flightNo: string; score: number }[];
}

const GSE_FOR_TASK: Record<string, string> = {
  'Baggage Offload': 'Baggage Tractor', 'Baggage Load': 'Baggage Tractor', Refuelling: 'Fuel Truck', 'Catering Load': 'Catering Truck', Pushback: 'Pushback Tug',
};
const USABLE: Asset['status'][] = ['Available', 'Reserved', 'Engaged'];
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const overlaps = (a0: number, a1: number, b0: number, b1: number, gap = 0) => a0 < b1 + gap && b0 < a1 + gap;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function optimize(view: OpsView, cfg: OptConfig, now: number): OptPlan {
  const b = view.b;
  const { weights: w, limits: L } = cfg;
  const standById = new Map(b.stands.map((s) => [s.id, s]));
  const fById = new Map(b.flights.map((f) => [f.id, f]));
  const taOf = new Map(b.turnarounds.map((t) => [t.flightId, t]));
  const sevRank = (f: Flight) => Math.max(-1, ...b.exceptions.filter((e) => e.affectedEntityIds.includes(f.id) && view.statusOf(e) !== 'Resolved').map((e) => SEVERITY_ORDER.indexOf(view.severity(e))));
  const slaRank = (l: SlaLevel) => SLA_ORDER.indexOf(l);
  const start = (f: Flight) => f.sta + view.delay(f.id);
  const end = (f: Flight) => f.std + view.delay(f.id);

  const flights = b.flights.filter((f) => f.status !== 'Departed' && f.status !== 'Cancelled' && end(f) >= now && f.sta <= now + L.horizonMin);
  const ids = new Set(flights.map((f) => f.id));

  // Priority = SLA exposure + airline SLA tier + urgency + open exception severity, scaled by the user's weights.
  const score = (f: Flight) => {
    const ta = taOf.get(f.id);
    const sla = ta ? slaRank(view.turnRisk(ta.id)) / 3 : 0;
    const tier = b.slaRules.find((r) => r.airlineId === f.airlineId)?.priority === 1 ? 1 : 0.4;
    const urgency = Math.max(0, 1 - (end(f) - now) / Math.max(60, L.horizonMin));
    const sev = (sevRank(f) + 1) / 4;
    return round1(w.sla * (sla * 0.6 + tier * 0.4) + w.time * urgency + w.sla * 0.5 * sev);
  };
  const scores = new Map(flights.map((f) => [f.id, score(f)]));
  const ordered = [...flights].sort((a, c) => scores.get(c.id)! - scores.get(a.id)! || start(a) - start(c));

  // --- 1. Stands -----------------------------------------------------------------------------------------------
  const blocked = (s: Stand, t0: number, t1: number) =>
    s.status === 'Closed' || b.constraints.some((c) => (c.scope === s.id || c.scope === s.pier) && /Closure/i.test(c.type) && overlaps(t0, t1, c.start, c.end));
  const weather = (s: Stand, t0: number, t1: number) => b.constraints.some((c) => c.scope === s.pier && /Weather/i.test(c.type) && overlaps(t0, t1, c.start, c.end));
  const hub = (() => {
    const pool = b.assets.filter((a) => USABLE.includes(view.assetState(a.id)) && standById.has(a.standId)).map((a) => standById.get(a.standId)!);
    const src = pool.length ? pool : b.stands;
    return { x: src.reduce((s, p) => s + p.x, 0) / src.length, y: src.reduce((s, p) => s + p.y, 0) / src.length };
  })();

  const finalStand = new Map<string, string>(); // flightId -> stand after planning
  const occupancy = new Map<string, { id: string; t0: number; t1: number }[]>();
  const book = (standId: string, f: Flight) => { const l = occupancy.get(standId) ?? []; l.push({ id: f.id, t0: start(f), t1: end(f) }); occupancy.set(standId, l); };
  const free = (standId: string, f: Flight) => !(occupancy.get(standId) ?? []).some((o) => overlaps(start(f), end(f), o.t0, o.t1, L.standBufferMin));
  const frozen = (f: Flight) => f.ata !== undefined || ['Arrived', 'Turnaround', 'Ready'].includes(f.status);

  const countConflicts = (stOf: (f: Flight) => string) => {
    let n = 0;
    for (let i = 0; i < flights.length; i++) for (let j = i + 1; j < flights.length; j++) {
      const a = flights[i], c = flights[j];
      if (stOf(a) === stOf(c) && overlaps(start(a), end(a), start(c), end(c), L.standBufferMin)) n++;
    }
    return n;
  };
  const conflictsBefore = countConflicts((f) => view.standOf(f));

  ordered.filter(frozen).forEach((f) => { const s = view.standOf(f); finalStand.set(f.id, s); book(s, f); });
  const standMoves: StandMove[] = [];
  const unresolved: Unresolved[] = [];
  ordered.filter((f) => !frozen(f)).forEach((f) => {
    const cur = standById.get(view.standOf(f))!;
    const rank = scores.get(f.id)!;
    const cost = (s: Stand) =>
      w.distance * (dist(s, hub) / 40)
      + w.resource * (b.assets.filter((a) => a.standId === s.id && USABLE.includes(view.assetState(a.id))).length ? 0 : 1)
      + (weather(s, start(f), end(f)) ? 6 + rank / 4 : 0)
      + (s.id === cur.id ? 0 : 1.5 + (10 - w.resource) / 4); // re-gating penalty
    const cands = b.stands.filter((s) => !blocked(s, start(f), end(f)) && free(s.id, f)).sort((a, c) => cost(a) - cost(c) || a.id.localeCompare(c.id));
    const pick = cands.find((s) => s.id === cur.id && cost(s) <= cost(cands[0]) + 0.5) ?? cands[0];
    if (!pick) { finalStand.set(f.id, cur.id); unresolved.push({ kind: 'stand', ref: f.flightNo, reason: tr('No stand free for the full occupancy window including buffer') }); return; }
    finalStand.set(f.id, pick.id); book(pick.id, f);
    if (pick.id !== cur.id) {
      const why = blocked(cur, start(f), end(f)) ? tr('current stand closed') : !free(cur.id, f) || (occupancy.get(cur.id) ?? []).length ? tr('avoids overlap / buffer breach or reduces equipment travel') : tr('shorter equipment travel');
      standMoves.push({ flightNo: f.flightNo, flightId: f.id, from: cur.id, to: pick.id, reason: why });
    }
  });
  const conflictsAfter = countConflicts((f) => finalStand.get(f.id) ?? view.standOf(f));

  // --- 2. GSE: time-window scheduling with proximity ---------------------------------------------------------
  const flightIdOfTask = new Map(b.turnarounds.map((x) => [x.id, x.flightId]));
  const tasks = b.tasks.filter((t) => ids.has(flightIdOfTask.get(t.turnaroundId) ?? '') && view.taskState(t.id) !== 'Complete' && GSE_FOR_TASK[t.taskType]);
  const flightOf = (t: Task) => fById.get(b.turnarounds.find((x) => x.id === t.turnaroundId)!.flightId)!;
  const taskStart = (t: Task) => t.forecastTime + view.delay(flightOf(t).id);
  const order = [...tasks].sort((a, c) => (scores.get(flightOf(c).id)! + (4 - c.priority)) - (scores.get(flightOf(a).id)! + (4 - a.priority)) || taskStart(a) - taskStart(c));
  const booked = new Map<string, [number, number][]>();
  const gse: GseAssignment[] = [];
  let travelBefore = 0, unassignedBefore = 0;
  tasks.forEach((t) => {
    const a = b.assets.find((x) => x.id === t.assetId);
    const st = standById.get(view.standOf(flightOf(t)))!;
    if (a && USABLE.includes(view.assetState(a.id)) && standById.has(a.standId)) travelBefore += dist(standById.get(a.standId)!, st); else unassignedBefore++;
  });
  let travelAfter = 0;
  order.forEach((t) => {
    const f = flightOf(t);
    const st = standById.get(finalStand.get(f.id) ?? view.standOf(f))!;
    const t0 = taskStart(t), t1 = t0 + L.taskMinutes;
    const type = GSE_FOR_TASK[t.taskType];
    const pool = b.assets.filter((a) => a.type === type && USABLE.includes(view.assetState(a.id)) && standById.has(a.standId));
    const timeOk = pool.filter((a) => a.availFrom <= t0 && a.availTo >= t1 && !(booked.get(a.id) ?? []).some(([x, y]) => overlaps(t0, t1, x, y, 5)));
    const near = timeOk.filter((a) => dist(standById.get(a.standId)!, st) <= L.maxGseDistance).sort((a, c) => dist(standById.get(a.standId)!, st) - dist(standById.get(c.standId)!, st) || a.id.localeCompare(c.id));
    const a = near[0];
    if (!a) {
      unresolved.push({ kind: 'gse', ref: `${f.flightNo} ${t.taskType}`, reason: !pool.length ? tr('No usable {type}', { type }) : !timeOk.length ? tr('All {type} units busy or outside availability window', { type }) : tr('Nearest {type} is beyond {n} units', { type, n: L.maxGseDistance }) });
      return;
    }
    const d = round1(dist(standById.get(a.standId)!, st));
    travelAfter += d;
    booked.set(a.id, [...(booked.get(a.id) ?? []), [t0, t1]]);
    gse.push({ taskId: t.id, taskType: t.taskType, flightNo: f.flightNo, assetId: a.id, assetType: a.type, fromStand: a.standId, toStand: st.id, distance: d, start: t0, end: t1, reason: tr('nearest free {type} ({eligible} eligible of {usable} usable); priority {score}', { type, eligible: near.length, usable: pool.length, score: scores.get(f.id)! }) });
  });

  // --- 3. Crew seats per stand: stagger tasks that exceed the seat limit --------------------------------------
  const shifts: TaskShift[] = [];
  const bySt = new Map<string, Task[]>();
  tasks.forEach((t) => { const s = finalStand.get(flightOf(t).id) ?? view.standOf(flightOf(t)); bySt.set(s, [...(bySt.get(s) ?? []), t]); });
  let seatBefore = 0;
  const seatLoad = (list: Task[], shiftOf: (t: Task) => number) => {
    let over = 0;
    list.forEach((t) => {
      const a0 = taskStart(t) + shiftOf(t);
      const c = list.filter((o) => overlaps(a0, a0 + L.taskMinutes, taskStart(o) + shiftOf(o), taskStart(o) + shiftOf(o) + L.taskMinutes)).length;
      if (c > L.seatsPerStand) over++;
    });
    return over;
  };
  const overStandBefore = new Map<string, Task[]>();
  tasks.forEach((t) => { const s = view.standOf(flightOf(t)); overStandBefore.set(s, [...(overStandBefore.get(s) ?? []), t]); });
  overStandBefore.forEach((l) => { seatBefore += seatLoad(l, () => 0); });
  let seatAfter = 0;
  const shiftMap = new Map<string, number>();
  bySt.forEach((list, standId) => {
    const sorted = [...list].sort((a, c) => taskStart(a) - taskStart(c) || a.priority - c.priority);
    const shiftOf = new Map<string, number>();
    sorted.forEach((t) => {
      let shift = 0;
      const conc = () => sorted.filter((o) => o !== t && shiftOf.has(o.id) && overlaps(taskStart(t) + shift, taskStart(t) + shift + L.taskMinutes, taskStart(o) + (shiftOf.get(o.id) ?? 0), taskStart(o) + (shiftOf.get(o.id) ?? 0) + L.taskMinutes)).length;
      while (conc() >= L.seatsPerStand && shift < 60) shift += 5;
      shiftOf.set(t.id, shift); shiftMap.set(t.id, shift);
      if (shift > 0) shifts.push({ taskId: t.id, taskType: t.taskType, flightNo: flightOf(t).flightNo, standId, shiftMin: shift, reason: tr('Stand {stand} crew seats ({n}) exceeded', { stand: standId, n: L.seatsPerStand }) });
    });
    seatAfter += seatLoad(sorted, (t) => shiftOf.get(t.id) ?? 0);
  });

  // --- 4. Staff: move spare capacity from slack skill pools to overloaded ones ----------------------------------
  const staff: StaffTransfer[] = [];
  const pressure = (id: string) => view.impact.capacityPressure[id] ?? (b.staff.find((s) => s.id === id)!.engaged / b.staff.find((s) => s.id === id)!.available);
  const spare = new Map(b.staff.map((s) => [s.id, Math.max(0, Math.floor(s.available - s.engaged / 0.85))]));
  const need = b.staff.filter((s) => pressure(s.id) > 1).sort((a, c) => pressure(c.id) - pressure(a.id));
  const overloadedBefore = need.length;
  let overloadedAfter = 0;
  need.forEach((n) => {
    let want = Math.ceil(n.engaged - n.available * 0.95);
    for (const d of b.staff.filter((s) => s.id !== n.id && pressure(s.id) < 0.85).sort((a, c) => (spare.get(c.id) ?? 0) - (spare.get(a.id) ?? 0))) {
      const give = Math.min(want, spare.get(d.id) ?? 0);
      if (give <= 0) continue;
      spare.set(d.id, (spare.get(d.id) ?? 0) - give);
      want -= give;
      staff.push({ fromBuId: d.buId, fromSkill: d.skillGroup, toBuId: n.buId, toSkill: n.skillGroup, qty: give, reason: tr('pressure {p} → target ≤ 0.95; donor at {d}', { p: pressure(n.id).toFixed(2), d: pressure(d.id).toFixed(2) }) });
      if (want <= 0) break;
    }
    if (want > 0) { overloadedAfter++; unresolved.push({ kind: 'staff', ref: `${b.bus.find((x) => x.id === n.buId)?.name ?? n.buId} · ${n.skillGroup}`, reason: tr('{n} short with no donor pool spare', { n: want }) }); }
  });

  // --- 5. Capacity per resource and plain-language summary -------------------------------------------------------
  const peak = (list: { t0: number; t1: number }[]) => Math.max(0, ...list.map((x) => list.filter((o) => overlaps(x.t0, x.t1, o.t0, o.t1)).length));
  const standIds = [...new Set([...overStandBefore.keys(), ...bySt.keys()])].sort();
  const capStands: StandCap[] = standIds.map((id) => ({
    standId: id, seats: L.seatsPerStand, tasks: bySt.get(id)?.length ?? 0,
    peakBefore: peak((overStandBefore.get(id) ?? []).map((t) => ({ t0: taskStart(t), t1: taskStart(t) + L.taskMinutes }))),
    peakAfter: peak((bySt.get(id) ?? []).map((t) => ({ t0: taskStart(t) + (shiftMap.get(t.id) ?? 0), t1: taskStart(t) + (shiftMap.get(t.id) ?? 0) + L.taskMinutes }))),
  }));
  const capGse: GseCap[] = [...new Set(b.assets.map((a) => a.type))].sort().map((type) => {
    const units = b.assets.filter((a) => a.type === type);
    const mine = gse.filter((g) => g.assetType === type);
    return { type, total: units.length, usable: units.filter((a) => USABLE.includes(view.assetState(a.id))).length, assignedUnits: new Set(mine.map((g) => g.assetId)).size, assignedTasks: mine.length, peakInUse: peak(mine.map((g) => ({ t0: g.start, t1: g.end }))) };
  });
  const capStaff: StaffCap[] = b.staff.map((s) => {
    const inn = staff.filter((x) => x.toBuId === s.buId && x.toSkill === s.skillGroup).reduce((n, x) => n + x.qty, 0);
    const out = staff.filter((x) => x.fromBuId === s.buId && x.fromSkill === s.skillGroup).reduce((n, x) => n + x.qty, 0);
    const availableAfter = s.available + inn - out;
    return { buId: s.buId, skill: s.skillGroup, available: s.available, engaged: s.engaged, availableAfter, pressureBefore: round1(pressure(s.id) * 100) / 100, pressureAfter: round1((s.engaged / Math.max(1, availableAfter)) * 100) / 100 };
  });
  const summary = [
    tr('Replanned {flights} flights and {tasks} equipment tasks inside the next {min} min (aircraft already on stand were kept in place).', { flights: flights.length, tasks: tasks.length, min: L.horizonMin }),
    standMoves.length ? tr('{n} flight(s) move stand; stand overlaps fall from {a} to {b}.', { n: standMoves.length, a: conflictsBefore, b: conflictsAfter }) : tr('No stand moves were needed; stand overlaps stay at {n}.', { n: conflictsAfter }),
    tr('{n} of {total} equipment tasks have a unit assigned (before: {before}); total travel {tb} → {ta} map units.', { n: gse.length, total: tasks.length, before: tasks.length - unassignedBefore, tb: round1(travelBefore), ta: round1(travelAfter) }),
    staff.length ? tr('{n} crew member(s) are shifted between pools; overloaded pools {a} → {b}.', { n: staff.reduce((n, x) => n + x.qty, 0), a: overloadedBefore, b: overloadedAfter }) : tr('Crew pools needed no transfer ({n} overloaded).', { n: overloadedBefore }),
    shifts.length ? tr('{n} task(s) start later so no stand exceeds {seats} crew seats.', { n: shifts.length, seats: L.seatsPerStand }) : tr('All stands stay within {seats} crew seats.', { seats: L.seatsPerStand }),
    unresolved.length ? tr('{n} item(s) could not be solved within the limits and need a human decision.', { n: unresolved.length }) : tr('Everything was solved within the limits.'),
  ];

  const metrics = (m: Omit<OptMetrics, 'weightedScore'>): OptMetrics => ({
    ...m,
    weightedScore: round1(m.standConflicts * 10 * w.time + m.gseUnassigned * 6 * w.sla + m.gseTravel * 0.2 * w.distance + m.overloadedPools * 5 * w.resource + m.seatOverruns * 2 * w.resource),
  });
  return {
    capacity: { stands: capStands, gse: capGse, staff: capStaff }, summary,
    generatedAt: now, config: cfg, standMoves, gse, staff, shifts, unresolved,
    flightsConsidered: flights.length, tasksConsidered: tasks.length,
    priorityOrder: ordered.slice(0, 5).map((f) => ({ flightNo: f.flightNo, score: scores.get(f.id)! })),
    before: metrics({ standConflicts: conflictsBefore, gseUnassigned: unassignedBefore, gseTravel: round1(travelBefore), overloadedPools: overloadedBefore, seatOverruns: seatBefore }),
    after: metrics({ standConflicts: conflictsAfter, gseUnassigned: tasks.length - gse.length, gseTravel: round1(travelAfter), overloadedPools: overloadedAfter, seatOverruns: seatAfter }),
  };
}

/** Layers an applied plan onto the derived impact so every view shows the optimized stands and reserved equipment. */
export function overlayPlan(base: Impact | undefined, plan: OptPlan, b: Baseline): Impact {
  const im = base ?? emptyImpact();
  const standOverride = { ...im.standOverride };
  plan.standMoves.forEach((m) => { standOverride[m.flightId] = m.to; });
  const assetState = { ...im.assetState };
  const status = new Map(b.assets.map((a) => [a.id, a.status]));
  plan.gse.forEach((g) => { if (!assetState[g.assetId] && status.get(g.assetId) === 'Available') assetState[g.assetId] = 'Reserved'; });
  const moved = plan.standMoves.map((m) => m.flightId);
  return {
    ...im, standOverride, assetState,
    impactedIds: [...new Set([...im.impactedIds, ...moved])],
    mitigations: [...im.mitigations, tr('Optimizer: {a} stand moves, {b} equipment assignments, {c} crew transfers', { a: plan.standMoves.length, b: plan.gse.length, c: plan.staff.length })],
  };
}
