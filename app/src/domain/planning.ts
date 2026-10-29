/**
 * Synthetic, deterministic week plan modelled on Changi Airport (SIN): four terminals with roughly 100 gates, 3-shift ground handling
 * (SATS / dnata style), baggage belts, check-in rows and GSE pools. Sizes and patterns follow public descriptions of Changi
 * (about 1,000 movements a day, 24/7 operation); individual flights, rosters and unit IDs are invented sample data.
 * Times are minutes from Monday 00:00 (Singapore time) of the displayed week.
 */
import { tr, locale } from '../i18n';
import { now as clockNow } from './clock';
export type PlanCategory = 'Gate' | 'Staff' | 'GSE' | 'Belt' | 'Check-in';
export type PlanKind = 'Flight' | 'Shift' | 'Task' | 'Maintenance' | 'Allocation';
export type Terminal = 'T1' | 'T2' | 'T3' | 'T4' | 'All';
export const CATEGORIES: PlanCategory[] = ['Gate', 'Staff', 'GSE', 'Belt', 'Check-in'];
export const DAY = 1440;
export const WEEK = 7 * DAY;

export interface PlanResource { id: string; name: string; category: PlanCategory; terminal: Terminal; group: string; capacity: number; unit: string; owner: string }
export interface PlanItem { id: string; resourceId: string; start: number; end: number; kind: PlanKind; label: string; detail: string; load: number; conflict?: boolean }
export interface PlanData { resources: PlanResource[]; items: PlanItem[]; staff: StaffMember[]; sources: string[] }

function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

const AIRCRAFT: Record<string, { mins: number; gse: number }> = { A380: { mins: 150, gse: 2 }, B777: { mins: 120, gse: 2 }, A350: { mins: 100, gse: 1 }, B787: { mins: 95, gse: 1 }, A330: { mins: 90, gse: 1 }, A320: { mins: 55, gse: 1 }, B737: { mins: 55, gse: 1 } };
const CARRIERS: { code: string; name: string; fleet: string[]; dest: string[]; handler: string }[] = [
  { code: 'SQ', name: 'Singapore Airlines', fleet: ['A350', 'B787', 'A380', 'B777'], dest: ['HKG', 'LHR', 'SYD', 'NRT', 'FRA', 'BOM', 'JFK'], handler: 'SATS' },
  { code: 'TR', name: 'Scoot', fleet: ['A320', 'B787'], dest: ['BKK', 'DPS', 'PER', 'ICN', 'KIX', 'TPE'], handler: 'SATS' },
  { code: 'EK', name: 'Emirates', fleet: ['A380', 'B777'], dest: ['DXB'], handler: 'dnata' },
  { code: 'QF', name: 'Qantas', fleet: ['A380', 'A330'], dest: ['SYD', 'MEL'], handler: 'SATS' },
  { code: 'CX', name: 'Cathay Pacific', fleet: ['A350', 'A330'], dest: ['HKG'], handler: 'SATS' },
  { code: 'BA', name: 'British Airways', fleet: ['A380', 'B777'], dest: ['LHR'], handler: 'dnata' },
  { code: 'MH', name: 'Malaysia Airlines', fleet: ['A330', 'B737'], dest: ['KUL'], handler: 'dnata' },
  { code: 'JL', name: 'Japan Airlines', fleet: ['B787', 'B777'], dest: ['NRT', 'HND'], handler: 'SATS' },
  { code: 'QR', name: 'Qatar Airways', fleet: ['A350', 'B777'], dest: ['DOH'], handler: 'dnata' },
  { code: 'TG', name: 'Thai Airways', fleet: ['A350', 'A330'], dest: ['BKK'], handler: 'SATS' },
  { code: 'GA', name: 'Garuda Indonesia', fleet: ['B737', 'A330'], dest: ['CGK', 'DPS'], handler: 'dnata' },
  { code: 'AI', name: 'Air India', fleet: ['A320', 'B787'], dest: ['DEL', 'BOM'], handler: 'dnata' },
];
const TERMINAL_CARRIERS: Record<string, string[]> = { T1: ['TR', 'TG', 'GA', 'AI', 'MH'], T2: ['SQ', 'TR', 'CX', 'JL', 'QF'], T3: ['SQ', 'EK', 'QF', 'BA', 'QR'], T4: ['CX', 'GA', 'AI', 'TG'] };
const GATE_COUNT: Record<string, number> = { T1: 6, T2: 7, T3: 7, T4: 4 };
const GATE_PREFIX: Record<string, string> = { T1: 'C', T2: 'F', T3: 'A', T4: 'G' };
const BELT_COUNT: Record<string, number> = { T1: 5, T2: 6, T3: 6, T4: 3 };
const ROW_COUNT: Record<string, number> = { T1: 5, T2: 5, T3: 5, T4: 3 };
const TERMINALS = ['T1', 'T2', 'T3', 'T4'] as const;
const hhmm = (m: number) => `${String(Math.floor((m % DAY) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const GSE_POOLS: [string, number, string][] = [['Baggage Tractor', 5, 'BT'], ['Belt Loader', 4, 'BL'], ['Fuel Dispenser', 4, 'FD'], ['Catering Truck', 4, 'CT'], ['Pushback Tug', 4, 'PT'], ['GPU', 3, 'GP']];
const GSE_NEED: Record<number, string[]> = { 1: ['Baggage Tractor', 'Fuel Dispenser', 'Pushback Tug'], 2: ['Baggage Tractor', 'Belt Loader', 'Fuel Dispenser', 'Catering Truck', 'Pushback Tug'] };

const TEAMS: { id: string; name: string; terminal: Terminal; owner: string; pool: number; fn: string }[] = [
  { id: 'st-sats-ramp-t1', name: 'SATS Ramp T1', terminal: 'T1', owner: 'SATS', pool: 34, fn: 'Ramp' },
  { id: 'st-sats-ramp-t2', name: 'SATS Ramp T2', terminal: 'T2', owner: 'SATS', pool: 42, fn: 'Ramp' },
  { id: 'st-sats-ramp-t3', name: 'SATS Ramp T3', terminal: 'T3', owner: 'SATS', pool: 46, fn: 'Ramp' },
  { id: 'st-dnata-ramp-t3', name: 'dnata Ramp T3', terminal: 'T3', owner: 'dnata', pool: 28, fn: 'Ramp' },
  { id: 'st-dnata-ramp-t4', name: 'dnata Ramp T4', terminal: 'T4', owner: 'dnata', pool: 22, fn: 'Ramp' },
  { id: 'st-bag-t1', name: 'Baggage Handling T1', terminal: 'T1', owner: 'SATS', pool: 30, fn: 'Baggage' },
  { id: 'st-bag-t2', name: 'Baggage Handling T2', terminal: 'T2', owner: 'SATS', pool: 36, fn: 'Baggage' },
  { id: 'st-bag-t3', name: 'Baggage Handling T3', terminal: 'T3', owner: 'SATS', pool: 40, fn: 'Baggage' },
  { id: 'st-cabin', name: 'Cabin Cleaning & Catering', terminal: 'All', owner: 'SATS', pool: 60, fn: 'Cabin' },
  { id: 'st-fuel', name: 'Fuelling Crew', terminal: 'All', owner: 'Into-plane', pool: 24, fn: 'Fuel' },
  { id: 'st-push', name: 'Pushback & Towing', terminal: 'All', owner: 'SATS', pool: 18, fn: 'Pushback' },
  { id: 'st-sioc', name: 'SIOC Duty Managers', terminal: 'All', owner: 'Airport Ops', pool: 8, fn: 'Control' },
  { id: 'st-ci-t1', name: 'Check-in Agents T1', terminal: 'T1', owner: 'SATS', pool: 24, fn: 'Check-in' },
  { id: 'st-ci-t2', name: 'Check-in Agents T2', terminal: 'T2', owner: 'SATS', pool: 30, fn: 'Check-in' },
  { id: 'st-ci-t3', name: 'Check-in Agents T3', terminal: 'T3', owner: 'dnata', pool: 32, fn: 'Check-in' },
  { id: 'st-ci-t4', name: 'Check-in Agents T4', terminal: 'T4', owner: 'dnata', pool: 14, fn: 'Check-in' },
  { id: 'st-gate', name: 'Gate & Boarding Agents', terminal: 'All', owner: 'SATS', pool: 36, fn: 'Gate' },
  { id: 'st-tech', name: 'Line Maintenance Engineers', terminal: 'All', owner: 'SIA Engineering', pool: 20, fn: 'Technical' },
];

/** Jobs inside each function and their share of the team (the last job takes the remainder). */
const JOBS: Record<string, [string, number][]> = {
  Ramp: [['Ramp Agent', 0.45], ['Loader Driver', 0.2], ['Aircraft Marshaller', 0.1], ['Ramp Team Leader', 0.1], ['Load Controller', 0.15]],
  Baggage: [['Baggage Loader', 0.5], ['Baggage Tractor Driver', 0.25], ['Belt Operator', 0.15], ['Baggage Supervisor', 0.1]],
  Cabin: [['Cabin Cleaner', 0.5], ['Catering Loader', 0.25], ['Catering Truck Driver', 0.15], ['Cleaning Supervisor', 0.1]],
  Fuel: [['Fuel Dispenser Operator', 0.6], ['Fuel Quality Inspector', 0.15], ['Fuelling Supervisor', 0.25]],
  Pushback: [['Pushback Tug Driver', 0.5], ['Wing Walker', 0.3], ['Towing Supervisor', 0.2]],
  Control: [['SIOC Duty Manager', 0.5], ['Flight Dispatcher', 0.3], ['Resource Coordinator', 0.2]],
  'Check-in': [['Check-in Agent', 0.65], ['Baggage Drop Agent', 0.2], ['Check-in Supervisor', 0.15]],
  Gate: [['Gate Agent', 0.6], ['Boarding Agent', 0.25], ['Gate Supervisor', 0.15]],
  Technical: [['Licensed Engineer', 0.4], ['Aircraft Technician', 0.4], ['Maintenance Controller', 0.2]],
};
const CERTS: Record<string, string> = {
  Ramp: 'Ramp safety, airside driving permit', Baggage: 'Baggage handling, airside driving permit', Cabin: 'Cabin cleaning, airside pass',
  Fuel: 'Into-plane fuelling licence, fire safety', Pushback: 'Pushback & towing licence, airside driving permit', Control: 'Airport operations management, A-CDM',
  'Check-in': 'DCS check-in, dangerous goods awareness', Gate: 'DCS boarding, security screening', Technical: 'CAAS Part-66 B1/B2, human factors',
};
const FIRST = ['Wei', 'Aisha', 'Ravi', 'Mei', 'Hui Min', 'Arjun', 'Siti', 'Jun Jie', 'Nur', 'Priya', 'Kenji', 'Min-jun', 'Daniel', 'Farah', 'Zhi Hao', 'Lakshmi', 'Hafiz', 'Xin Yi', 'Marcus', 'Anita'];
const LAST = ['Tan', 'Lim', 'Wong', 'Rahman', 'Kumar', 'Ng', 'Chua', 'Ismail', 'Lee', 'Singh', 'Goh', 'Teo', 'Abdullah', 'Nair', 'Ong', 'Yeo', 'Chen', 'Pillai', 'Koh', 'Sim'];

export interface StaffMember { id: string; name: string; teamId: string; team: string; job: string; function: string; terminal: Terminal; employer: string; shift: string; restDay: number; certifications: string }

/** Splits a head count over a function's jobs; the counts always add up to `hc`. */
export function jobMix(fn: string, hc: number): [string, number][] {
  const jobs = JOBS[fn] ?? [[fn, 1]];
  let left = hc;
  return jobs.map(([job, share], i) => { const n = i === jobs.length - 1 ? left : Math.min(left, Math.round(hc * share)); left -= n; return [job, n] as [string, number]; }).filter(([, n]) => n > 0);
}
const SHIFTS: [string, number, number, number][] = [['Morning', 6 * 60, 14 * 60, 0.9], ['Afternoon', 14 * 60, 22 * 60, 1], ['Night', 22 * 60, 30 * 60, 0.6]];

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;

export function buildPlan(): PlanData {
  const r = rng(2026);
  const resources: PlanResource[] = [];
  const items: PlanItem[] = [];
  const byRes = new Map<string, PlanItem[]>();
  let seq = 0;
  const add = (it: Omit<PlanItem, 'id'>) => { const x = { ...it, id: `pl-${++seq}` }; items.push(x); byRes.set(x.resourceId, [...(byRes.get(x.resourceId) ?? []), x]); return x; };
  const free = (resId: string, s: number, e: number, gap = 5) => !(byRes.get(resId) ?? []).some((o) => o.start < e + gap && s < o.end + gap);

  // Gates: sequential turnarounds with a buffer, 24 hours a day with a quieter 02:00-05:00 trough.
  const turns: { terminal: string; gateId: string; start: number; end: number; flightNo: string; carrier: (typeof CARRIERS)[number]; type: string; dest: string }[] = [];
  TERMINALS.forEach((t) => {
    for (let g = 1; g <= GATE_COUNT[t]; g++) {
      const id = `gate-${t}-${g}`;
      resources.push({ id, name: tr('{t} Gate {g}', { t, g: `${GATE_PREFIX[t]}${10 + g}` }), category: 'Gate', terminal: t, group: `Terminal ${t[1]}`, capacity: 1, unit: 'aircraft', owner: 'CAG' });
      const pool = TERMINAL_CARRIERS[t].map((c) => CARRIERS.find((x) => x.code === c)!);
      let cur = Math.floor(r() * 90);
      while (cur < WEEK - 60) {
        const hour = Math.floor((cur % DAY) / 60);
        if (hour >= 2 && hour < 5 && r() < 0.6) { cur += 120; continue; }
        const car = pool[Math.floor(r() * pool.length)];
        const type = car.fleet[Math.floor(r() * car.fleet.length)];
        const dur = AIRCRAFT[type].mins + Math.floor(r() * 20);
        const dest = car.dest[Math.floor(r() * car.dest.length)];
        const flightNo = `${car.code}${100 + Math.floor(r() * 880)}`;
        const end = Math.min(WEEK, cur + dur);
        add({ resourceId: id, start: cur, end, kind: 'Flight', label: `${flightNo} ${dest}`, detail: tr('{flightNo} {carrier} {type} ⇄ {dest}; turnaround {from}–{to}; handler {handler}', { flightNo, carrier: car.name, type, dest, from: hhmm(cur), to: hhmm(end), handler: car.handler }), load: 1 });
        turns.push({ terminal: t, gateId: id, start: cur, end, flightNo, carrier: car, type, dest });
        cur = end + 20 + Math.floor(r() * 50);
      }
    }
  });
  // One deliberate late-inbound overstay so the conflict flag has something to show.
  const clash = items.find((i) => i.resourceId === 'gate-T3-2' && i.start > 2 * DAY + 600);
  if (clash) add({ resourceId: 'gate-T3-2', start: clash.start - 25, end: clash.start + 40, kind: 'Flight', label: 'SQ322 overstay', detail: tr('Late departure holding the stand while the next inbound is on final (example conflict)'), load: 1 });

  // GSE pools and their assignments to gate turnarounds.
  const gseUnits: PlanResource[] = [];
  GSE_POOLS.forEach(([type, n, code]) => {
    for (let k = 1; k <= n; k++) {
      const t = TERMINALS[(k - 1) % 4];
      const res: PlanResource = { id: `gse-${code}-${k}`, name: `${code}-${String(k).padStart(2, '0')} (${t})`, category: 'GSE', terminal: t, group: type, capacity: 1, unit: 'unit', owner: t === 'T3' || t === 'T4' ? 'dnata' : 'SATS' };
      gseUnits.push(res); resources.push(res);
    }
  });
  [...turns].sort((a, b) => a.start - b.start).forEach((tn) => {
    GSE_NEED[AIRCRAFT[tn.type].gse].forEach((type, i) => {
      const s = tn.start + 10 + i * 12, e = s + 25;
      const unit = gseUnits.filter((u) => u.group === type).sort((a, b) => Number(b.terminal === tn.terminal) - Number(a.terminal === tn.terminal))
        .find((u) => free(u.id, s, e));
      if (unit) add({ resourceId: unit.id, start: s, end: e, kind: 'Task', label: `${tn.flightNo} ${tr(type.split(' ')[0])}`, detail: tr('{type} serving {flightNo} at {gate}', { type: tr(type), flightNo: tn.flightNo, gate: tn.gateId.replace('gate-', '').replace('-', ' gate ') }), load: 1 });
    });
  });
  gseUnits.forEach((u, i) => {
    let s = (1 + (i % 5)) * DAY + 150 + (i % 3) * 30; // quiet window around 02:30-03:30
    while (!free(u.id, s, s + 180, 0) && s < WEEK - 200) s += 60;
    if (free(u.id, s, s + 180, 0)) add({ resourceId: u.id, start: s, end: s + 180, kind: 'Maintenance', label: tr('Planned maintenance'), detail: tr('Scheduled service and safety check'), load: 1 });
  });

  // Baggage belts: arrivals use a belt from 10 min after on-block for 40 min.
  const belts: PlanResource[] = [];
  TERMINALS.forEach((t) => { for (let k = 1; k <= BELT_COUNT[t]; k++) { const b = { id: `belt-${t}-${k}`, name: tr('{t} Belt {k}', { t, k }), category: 'Belt' as const, terminal: t as Terminal, group: `Terminal ${t[1]}`, capacity: 1, unit: 'flight', owner: 'CAG' }; belts.push(b); resources.push(b); } });
  [...turns].sort((a, b) => a.start - b.start).forEach((tn) => {
    const s = tn.start + 10, e = s + 40;
    const belt = belts.filter((b) => b.terminal === tn.terminal).find((b) => free(b.id, s, e, 0));
    if (belt) add({ resourceId: belt.id, start: s, end: e, kind: 'Allocation', label: tr('{flightNo} bags', { flightNo: tn.flightNo }), detail: tr('Arrival baggage for {flightNo} ({carrier})', { flightNo: tn.flightNo, carrier: tn.carrier.name }), load: 1 });
  });

  // Check-in rows: open 180 min before departure, close 45 min before.
  const rows: PlanResource[] = [];
  TERMINALS.forEach((t) => { for (let k = 1; k <= ROW_COUNT[t]; k++) { const x = { id: `ci-${t}-${k}`, name: t === 'T4' ? tr('T4 FAST zone {k}', { k }) : tr('{t} Row {r}', { t, r: String.fromCharCode(64 + k) }), category: 'Check-in' as const, terminal: t as Terminal, group: `Terminal ${t[1]}`, capacity: t === 'T4' ? 20 : 12, unit: 'counters', owner: 'CAG' }; rows.push(x); resources.push(x); } });
  [...turns].sort((a, b) => a.start - b.start).forEach((tn) => {
    const s = tn.end - 180, e = tn.end - 45;
    if (s < 0) return;
    const row = rows.filter((x) => x.terminal === tn.terminal).find((x) => free(x.id, s, e, 0));
    if (row) add({ resourceId: row.id, start: s, end: e, kind: 'Allocation', label: tr('{flightNo} check-in', { flightNo: tn.flightNo }), detail: tr('Check-in for {flightNo} to {dest}; opens {open}, closes {close}', { flightNo: tn.flightNo, dest: tn.dest, open: hhmm(s), close: hhmm(e) }), load: 1 });
  });

  // Staff rosters: three shifts a day; weekends lighter; each team rests on a rotating day.
  const staff: StaffMember[] = [];
  TEAMS.forEach((tm, ti) => {
    resources.push({ id: tm.id, name: tr(tm.name), category: 'Staff', terminal: tm.terminal, group: tr(tm.fn), capacity: tm.pool, unit: 'staff', owner: tm.owner });
    for (let d = 0; d < 7; d++) {
      SHIFTS.forEach(([name, s, e, f]) => {
        const weekend = d >= 5 ? 0.9 : 1;
        const sioc = tm.fn === 'Control' ? 0.5 : 1;
        const hc = Math.max(1, Math.round(tm.pool * f * weekend * (0.82 + r() * 0.2) * sioc * (d === (ti + 1) % 7 && name === 'Night' ? 0.8 : 1)));
        add({ resourceId: tm.id, start: d * DAY + s, end: Math.min(WEEK, d * DAY + e), kind: 'Shift', label: `${tr(name)} ${hc}`, detail: `${tr('{team} {shift} shift {from}–{to}: {hc} of {pool} staff rostered', { team: tr(tm.name), shift: tr(name), from: hhmm(s), to: hhmm(e), hc, pool: tm.pool })}. ${tr('Jobs')}: ${jobMix(tm.fn, hc).map(([j, n]) => `${tr(j)} ${n}`).join(', ')}`, load: hc });
      });
    }
    // Named roster: every team member has one job, a base shift and a weekly rest day.
    const sr = rng(900 + ti);
    jobMix(tm.fn, tm.pool).forEach(([job, n]) => {
      for (let k = 0; k < n; k++) {
        const idx = staff.length;
        const shift = SHIFTS[(k + ti) % 3 === 2 && sr() < 0.4 ? 0 : (k + ti) % 3][0];
        staff.push({ id: `emp-${String(idx + 1).padStart(4, '0')}`, name: `${FIRST[Math.floor(sr() * FIRST.length)]} ${LAST[Math.floor(sr() * LAST.length)]}`, teamId: tm.id, team: tm.name, job, function: tm.fn, terminal: tm.terminal, employer: tm.owner, shift, restDay: (idx + ti) % 7, certifications: CERTS[tm.fn] ?? '' });
      }
    });
  });

  items.forEach((i) => { i.conflict = conflictIds(resources, items).has(i.id); });
  // Display strings are localised last because the generator above groups GSE by its English pool name.
  resources.forEach((x) => {
    const m = /^Terminal (\d)$/.exec(x.group);
    x.group = m ? tr('Terminal {n}', { n: m[1] }) : tr(x.group);
    x.unit = tr(x.unit);
  });
  return { resources, items, staff, sources: [
    'https://worldairportmap.com/airport/SIN', 'https://en.wikipedia.org/wiki/Infrastructure_of_Changi_Airport',
  ] };
}

let cache: { items: PlanItem[]; ids: Set<string> } | null = null;
/** Items that break a limit: overlapping use of a single-capacity resource, or concurrent load above a pool's capacity. */
export function conflictIds(resources: PlanResource[], items: PlanItem[]): Set<string> {
  if (cache && cache.items === items) return cache.ids;
  const out = new Set<string>();
  const by = new Map<string, PlanItem[]>();
  items.forEach((i) => by.set(i.resourceId, [...(by.get(i.resourceId) ?? []), i]));
  resources.forEach((res) => {
    const list = (by.get(res.id) ?? []).sort((a, b) => a.start - b.start);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length && list[j].start < list[i].end; j++) {
      if (res.category === 'Staff' ? list[i].load + list[j].load > res.capacity : overlaps(list[i], list[j])) { out.add(list[i].id); out.add(list[j].id); }
    }
  });
  cache = { items, ids: out };
  return out;
}

export interface Usage { items: number; bookedHours: number; utilization: number; conflicts: number }
/** Utilisation of a resource inside [from, to): booked capacity-time over available capacity-time. */
export function usage(res: PlanResource, list: PlanItem[], from: number, to: number): Usage {
  let booked = 0, n = 0, c = 0;
  list.forEach((i) => {
    const ov = Math.min(i.end, to) - Math.max(i.start, from);
    if (ov <= 0) return;
    n++; if (i.conflict) c++;
    booked += ov * (res.category === 'Staff' ? i.load : 1);
  });
  const avail = (to - from) * (res.category === 'Staff' ? res.capacity : 1);
  return { items: n, bookedHours: Math.round(booked / 6) / 10, utilization: Math.min(1, avail ? booked / avail : 0), conflicts: c };
}

/** Monday 00:00 (Singapore) of the current week, as a UTC-based timestamp, plus "now" in plan minutes. */
export function currentWeek(now = clockNow()) {
  const sgt = new Date(now + 8 * 3600e3);
  const dow = (sgt.getUTCDay() + 6) % 7;
  const start = Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate() - dow);
  return { start, nowMin: Math.floor((sgt.getTime() - start) / 60000) };
}
export const dayLabel = (weekStart: number, d: number) => new Date(weekStart + d * 864e5).toLocaleDateString(locale(), { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short' });
export const clock = hhmm;
