import { fmt } from './seed';
import type { ActionItem, Baseline, FlightStatus, OpException, Severity, SlaLevel, TaskState } from './types';

/**
 * Simulated live feed. The seeded baseline stays immutable; this derives the "observed" state at operational minute
 * seed.now + tick, deterministically, so a Horizon 2 streaming provider can replace it without touching the UI.
 * tick 0 returns the seed unchanged.
 */
const LADDER: FlightStatus[] = ['Scheduled', 'Inbound', 'Arrived', 'Turnaround', 'Ready', 'Departed'];

function h(key: string, n = 0): number {
  let x = 2166136261 ^ n;
  for (let i = 0; i < key.length; i++) { x ^= key.charCodeAt(i); x = Math.imul(x, 16777619); }
  x ^= x >>> 13; x = Math.imul(x, 1274126177); x ^= x >>> 16;
  return x >>> 0;
}

const LEVELS: SlaLevel[] = ['Normal', 'Watch', 'AtRisk', 'Breach'];
const EX_TYPES = ['Late milestone', 'GSE shortage', 'Staff gap', 'SLA breach risk', 'Weather impact', 'Blocked dependency'];
const SOURCES = ['DSM', 'DCT', 'G-Ops', 'Mosaic'];

export function applyLive(seed: Baseline, tick: number): Baseline {
  if (tick <= 0) return seed;
  const t = seed.now + tick;
  const b = structuredClone(seed) as Baseline;
  b.now = t;

  // ---- flights -----------------------------------------------------------
  b.flights.forEach((f) => {
    if (f.status === 'Cancelled') return;
    const idx0 = f.status === 'Delayed' ? 3 : LADDER.indexOf(f.status);
    const interval = 4 + (h(f.id, 1) % 4);
    const steps = Math.floor(tick / interval);
    const maxByTime = t >= f.std + 2 ? 5 : t >= f.std - 15 ? 4 : t >= f.sta + 5 ? 3 : t >= f.sta ? 2 : t >= f.sta - 40 ? 1 : 0;
    const idx = steps === 0 ? idx0 : Math.min(idx0 + steps, Math.max(idx0, maxByTime));
    let drift = 0;
    for (let k = 0; k < Math.floor(tick / 5); k++) drift += (h(f.id, 10 + k) % 5) - 1;
    drift = Math.max(0, Math.min(45, drift));
    f.etd = f.std + drift;
    f.status = idx === 5 ? 'Departed' : drift >= 20 && idx >= 2 ? 'Delayed' : LADDER[idx];
    if (idx >= 2 && f.ata === undefined) f.ata = f.sta + ((h(f.id, 2) % 7) - 2);
  });

  // ---- turnarounds, milestones, tasks -----------------------------------
  b.turnarounds.forEach((ta) => {
    const f = b.flights.find((x) => x.id === ta.flightId)!;
    const idx = f.status === 'Departed' ? 5 : f.status === 'Delayed' ? 3 : LADDER.indexOf(f.status);
    const complete = f.status === 'Departed' || f.status === 'Ready';
    const active = idx >= 2 && !complete;
    if (complete) ta.phase = 'Complete';
    else if (active && ta.phase === 'NotStarted') ta.phase = 'Active';
    if (active && ta.actualStart === undefined) ta.actualStart = f.ata ?? f.sta;

    b.milestones.filter((m) => m.turnaroundId === ta.id).forEach((m) => {
      if (m.status === 'Complete') return;
      const changeAt = 1 + (h(m.id, 3) % 10);
      if (tick < changeAt) return;
      if (complete || (t >= m.forecastTime && m.status !== 'Blocked')) { m.status = 'Complete'; m.actualTime = Math.min(m.forecastTime, t); return; }
      if (m.status === 'Blocked' && tick >= changeAt + 8 + (h(m.id, 4) % 15)) m.status = 'InProgress';
      else if ((m.status === 'Planned' || m.status === 'Ready') && t >= m.plannedTime - 3) m.status = 'InProgress';
      if ((m.status === 'InProgress' || m.status === 'AtRisk') && h(m.id, 100 + tick) % 17 === 0) { m.forecastTime += 2; if (m.forecastTime - m.plannedTime >= 8) m.status = 'AtRisk'; }
    });

    b.tasks.filter((k) => k.turnaroundId === ta.id).forEach((k) => {
      if (k.status === 'Complete') return;
      const changeAt = 1 + (h(k.id, 5) % 10);
      if (tick < changeAt) return;
      if (complete) { k.status = 'Complete'; k.actualTime = Math.min(k.forecastTime, t); return; }
      if (k.status === 'Blocked') { if (tick >= changeAt + 8 + (h(k.id, 6) % 15)) k.status = 'InProgress'; return; }
      if (t >= k.forecastTime && k.status !== 'Planned') { k.status = 'Complete'; k.actualTime = k.forecastTime; return; }
      if ((k.status === 'Planned' || k.status === 'Ready') && t >= k.plannedTime) k.status = 'InProgress';
      else if (k.status === 'InProgress' && h(k.id, 200 + tick) % 23 === 0) { k.status = 'AtRisk'; k.forecastTime += 3; }
      else if (k.status === 'AtRisk' && h(k.id, 300 + tick) % 11 === 0) k.status = 'InProgress';
    });

    // Risk follows the slip of incomplete milestones, refreshed at a staggered time per turnaround.
    if (tick >= 1 + (h(ta.id, 7) % 12)) {
      const slip = Math.max(0, ...b.milestones.filter((m) => m.turnaroundId === ta.id && m.status !== 'Complete').map((m) => m.forecastTime - m.plannedTime));
      const blocked = b.tasks.filter((k) => k.turnaroundId === ta.id && k.status === 'Blocked').length;
      let lvl = slip >= 25 ? 3 : slip >= 15 ? 2 : slip >= 6 ? 1 : 0;
      if (blocked >= 2) lvl = Math.min(3, lvl + 1);
      if (complete) lvl = Math.min(lvl, 1);
      ta.slaRisk = LEVELS[lvl];
      ta.health = LEVELS[lvl];
      if (!complete && ta.phase !== 'NotStarted') ta.phase = blocked >= 2 ? 'Blocked' : lvl >= 2 ? 'AtRisk' : 'Active';
    }
  });
  b.slaRisks.forEach((r) => {
    const ta = b.turnarounds.find((x) => x.id === r.affectedEntityId);
    if (!ta) return;
    r.level = ta.slaRisk;
    r.forecastBreach = ta.slaRisk === 'Breach' ? t + 15 : undefined;
  });

  // ---- assets and staff ---------------------------------------------------
  const win = Math.floor(tick / 6);
  b.assets.forEach((a) => {
    a.availFrom = t - 60;
    a.availTo = t + 360;
    const fail = (k: number) => k >= 0 && h(a.id, 400 + k) % 100 >= 98;
    if (fail(win) || fail(win - 1) || fail(win - 2)) { a.status = 'Unavailable'; return; }
    if (a.status === 'Unavailable' && tick < 15 + (h(a.id, 8) % 25)) return;
    const r = h(a.id, 500 + win) % 100;
    a.status = r < 30 ? 'Engaged' : r < 55 ? 'Available' : r < 70 ? 'Reserved' : a.status === 'Unavailable' ? 'Available' : a.status;
  });
  b.staff.forEach((s) => {
    s.engaged = Math.max(0, Math.min(s.planned, s.engaged + (h(s.id, 600 + tick) % 7) - 3));
    s.available = Math.max(1, Math.min(s.planned, s.available + (h(s.id, 700 + Math.floor(tick / 10)) % 3) - 1));
    s.windowStart = t - 60;
    s.windowEnd = t + 360;
  });
  b.constraints.forEach((c) => { c.sourceTime = t - (h(c.id, 9 + tick) % 3); });

  // ---- exceptions -----------------------------------------------------------
  const sevOf = (lvl: SlaLevel): Severity => (lvl === 'Breach' ? 'Critical' : lvl === 'AtRisk' ? 'High' : lvl === 'Watch' ? 'Medium' : 'Low');
  b.exceptions.forEach((e) => {
    const f = b.flights.find((x) => e.affectedEntityIds.includes(x.id));
    if (f?.status === 'Departed' && e.status !== 'Resolved') e.status = 'Resolved';
    if (e.status !== 'Resolved' && !e.ownerId && t - e.detectedAt >= 25 && e.severity !== 'Critical') e.severity = (['Low', 'Medium', 'High', 'Critical'] as Severity[])[(['Low', 'Medium', 'High', 'Critical'] as Severity[]).indexOf(e.severity) + 1];
  });
  for (let k = 0; k < 40; k++) {
    const spawn = 3 + k * 5 + (h('spawn', k) % 4);
    if (spawn > tick) break;
    const f = b.flights[h('flight', k) % b.flights.length];
    const ta = b.turnarounds.find((x) => x.flightId === f.id)!;
    if (f.status === 'Departed' || f.status === 'Cancelled' || ta.phase === 'Complete') continue;
    const at = seed.now + spawn;
    const task = b.tasks.find((x) => x.turnaroundId === ta.id && x.status !== 'Complete') ?? b.tasks.find((x) => x.turnaroundId === ta.id)!;
    const type = EX_TYPES[h('type', k) % EX_TYPES.length];
    const ex: OpException = {
      id: `ex-live-${k + 1}`, type, severity: sevOf(ta.slaRisk), detectedAt: at, source: `${SOURCES[h('src', k) % 4]} (live feed)`, status: 'New',
      affectedEntityIds: [f.id, ta.id, task.id, f.standId, ...(task.assetId ? [task.assetId] : [])],
      explanation: `${type} on ${f.flightNo}: detected by live feed at ${fmt(at)}.`, nextAction: 'Assign an owner', targetTime: at + 20,
    };
    const act: ActionItem = { id: `ac-live-${k + 1}`, exceptionId: ex.id, taskId: task.id, leadStakeholderId: 'u-lead', status: 'New', targetTime: ex.targetTime, audit: [`${fmt(at)} detected by ${ex.source}`] };
    b.exceptions.push(ex);
    b.actions.push(act);
  }
  return b;
}

/** Human-readable change events between two consecutive live states (for the live feed ticker). */
export function diffLive(prev: Baseline, next: Baseline): string[] {
  const out: string[] = [];
  next.flights.forEach((f) => {
    const p = prev.flights.find((x) => x.id === f.id);
    if (p && p.status !== f.status) out.push(`${f.flightNo} ${p.status} → ${f.status}`);
  });
  next.turnarounds.forEach((ta) => {
    const p = prev.turnarounds.find((x) => x.id === ta.id);
    if (p && p.slaRisk !== ta.slaRisk) out.push(`${next.flights.find((f) => f.id === ta.flightId)!.flightNo} SLA risk ${p.slaRisk} → ${ta.slaRisk}`);
  });
  const blockedNow = next.tasks.filter((k) => k.status === 'Blocked').length, blockedBefore = prev.tasks.filter((k) => k.status === 'Blocked').length;
  if (blockedNow !== blockedBefore) out.push(`Blocked tasks ${blockedBefore} → ${blockedNow}`);
  const doneNow = next.tasks.filter((k) => k.status === 'Complete').length, doneBefore = prev.tasks.filter((k) => k.status === 'Complete').length;
  if (doneNow !== doneBefore) out.push(`${doneNow - doneBefore} task(s) completed (${doneNow}/${next.tasks.length})`);
  next.assets.forEach((a) => {
    const p = prev.assets.find((x) => x.id === a.id);
    if (p && p.status !== a.status && (a.status === 'Unavailable' || p.status === 'Unavailable')) out.push(`${a.type} ${a.id} ${p.status} → ${a.status}`);
  });
  next.exceptions.filter((e) => !prev.exceptions.some((x) => x.id === e.id)).forEach((e) => out.push(`New exception: ${e.type} (${e.severity}) from ${e.source}`));
  return out;
}

export type { TaskState };
