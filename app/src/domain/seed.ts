import type {
  Airline, Asset, Baseline, BusinessUnit, Constraint, Flight, Milestone, OpException, ActionItem, SlaLevel, SlaRisk,
  SlaRule, Stakeholder, Stand, StaffCapacity, Task, TaskState, Turnaround, ExceptionState, FlightStatus, Severity,
} from './types';

export const SCHEMA_VERSION = 1;
export const SEED_VERSION = '2026.1';
/** Minutes since midnight in Changi (Asia/Singapore) time: the single time zone used across the whole application. */
export function changiMinutes(d: Date = new Date()): number {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return g('hour') * 60 + g('minute');
}
export function changiClock(d: Date = new Date()): string {
  return d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour12: false });
}
export const NOW = changiMinutes(); // operational clock at application start, in Changi time

export const MILESTONE_TYPES = ['Chocks On', 'Deboarding', 'Cleaning & Catering', 'Boarding', 'Pushback Ready'];
const TASK_TYPES: [string, string, string][] = [
  ['Baggage Offload', 'bu-bag', 'Baggage Tractor'],
  ['Refuelling', 'bu-ramp', 'Fuel Truck'],
  ['Catering Load', 'bu-ramp', 'Catering Truck'],
  ['Baggage Load', 'bu-bag', 'Baggage Tractor'],
  ['Pushback', 'bu-ramp', 'Pushback Tug'],
];

// Small deterministic PRNG so the seed is identical on every fresh profile.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function buildSeed(): Baseline {
  const r = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];

  const airlines: Airline[] = [
    { id: 'al-sq', code: 'SQ', name: 'Singapore Airlines', slaProfileId: 'sla-prem' },
    { id: 'al-tr', code: 'TR', name: 'Scoot', slaProfileId: 'sla-lcc' },
    { id: 'al-ek', code: 'EK', name: 'Emirates', slaProfileId: 'sla-prem' },
    { id: 'al-qf', code: 'QF', name: 'Qantas', slaProfileId: 'sla-std' },
  ];
  const bus: BusinessUnit[] = [
    { id: 'bu-ramp', name: 'Ramp Services', scope: 'Aircraft servicing, fuel, pushback' },
    { id: 'bu-bag', name: 'Baggage Handling', scope: 'Baggage load/offload' },
    { id: 'bu-cat', name: 'Catering & Cabin', scope: 'Catering, cleaning' },
  ];
  const stakeholders: Stakeholder[] = [
    { id: 'u-lead', displayName: 'Control Tower Lead (TBC)', roleType: 'Control Tower Lead', buId: 'bu-ramp', scope: 'Airport-wide' },
    { id: 'u-sioc1', displayName: 'SIOC Duty Manager A', roleType: 'SIOC Duty Manager', buId: 'bu-ramp', scope: 'Airport-wide' },
    { id: 'u-bu1', displayName: 'BU Ops Manager (Ramp)', roleType: 'BU Ops Manager', buId: 'bu-ramp', scope: 'Ramp Services' },
    { id: 'u-bu2', displayName: 'BU Ops Manager (Baggage)', roleType: 'BU Ops Manager', buId: 'bu-bag', scope: 'Baggage Handling' },
    { id: 'u-ramp1', displayName: 'Ramp Lead Pier A', roleType: 'Ramp Lead', buId: 'bu-ramp', scope: 'Pier A' },
    { id: 'u-ramp2', displayName: 'Ramp Lead Pier B', roleType: 'Ramp Lead', buId: 'bu-ramp', scope: 'Pier B' },
    { id: 'u-own1', displayName: 'Action Owner (Fuel)', roleType: 'Action Owner', buId: 'bu-ramp', scope: 'Fuel' },
    { id: 'u-own2', displayName: 'Action Owner (Cabin)', roleType: 'Action Owner', buId: 'bu-cat', scope: 'Cabin' },
    { id: 'u-obs', displayName: 'Executive Observer', roleType: 'Observer', buId: 'bu-ramp', scope: 'Read-only' },
  ];

  const stands: Stand[] = [];
  ['A', 'B', 'C'].forEach((pier, pi) => {
    for (let n = 1; n <= 6; n++) {
      stands.push({ id: `${pier}${n}`, pier, stand: `${pier}${n}`, x: (n - 1) * 14 + 8, y: pi * 30 + 12, status: 'Open' });
    }
  });

  const statuses: FlightStatus[] = ['Scheduled', 'Inbound', 'Arrived', 'Turnaround', 'Turnaround', 'Ready', 'Departed', 'Delayed', 'Cancelled'];
  const flights: Flight[] = [];
  const turnarounds: Turnaround[] = [];
  const milestones: Milestone[] = [];
  const tasks: Task[] = [];
  const assets: Asset[] = [];
  const slaRules: SlaRule[] = [];
  const slaRisks: SlaRisk[] = [];
  const staff: StaffCapacity[] = [];

  const turnStates = ['NotStarted', 'Active', 'AtRisk', 'Blocked', 'Complete'] as const;
  const taskStates: TaskState[] = ['Planned', 'Ready', 'InProgress', 'AtRisk', 'Blocked', 'Complete'];
  const levels: SlaLevel[] = ['Normal', 'Watch', 'AtRisk', 'Breach'];

  airlines.forEach((al) =>
    MILESTONE_TYPES.forEach((m, i) =>
      slaRules.push({ id: `rule-${al.code}-${i}`, airlineId: al.id, milestoneType: m, targetMin: 10 + i * 12, toleranceMin: 5 + (al.id === 'al-sq' ? 0 : 5), priority: al.slaProfileId === 'sla-prem' ? 1 : 2 }),
    ),
  );

  // Assets: a pool at each pier.
  ['Baggage Tractor', 'Fuel Truck', 'Catering Truck', 'Pushback Tug'].forEach((type, ti) => {
    stands.forEach((s, si) => {
      if ((si + ti) % 3 !== 0) return;
      const st = (['Available', 'Reserved', 'Engaged', 'Unavailable', 'Unknown'] as const)[(si + ti) % 5];
      assets.push({ id: `as-${type.split(' ')[0].slice(0, 3).toLowerCase()}-${s.id}`, type, status: st, standId: s.id, availFrom: NOW - 60, availTo: NOW + 360 });
    });
  });

  for (let i = 0; i < 24; i++) {
    const al = airlines[i % airlines.length];
    const stand = stands[i % stands.length];
    const sta = NOW - 50 + i * 8;
    const status = i === 7 ? 'Cancelled' : statuses[i % statuses.length];
    const delay = status === 'Delayed' ? 25 : 0;
    const f: Flight = {
      id: `fl-${i + 1}`, flightNo: `${al.code}${100 + i * 7}`, airlineId: al.id,
      origin: pick(['SIN', 'HKG', 'DXB', 'SYD', 'NRT', 'LHR']), destination: pick(['BKK', 'KUL', 'CGK', 'MEL', 'ICN', 'DEL']),
      sta, ata: ['Arrived', 'Turnaround', 'Ready', 'Departed'].includes(status) ? sta : undefined,
      std: sta + 60 + delay, etd: sta + 60 + delay, status, pierId: stand.pier, standId: stand.id,
    };
    flights.push(f);
    const phase = turnStates[(i + (status === 'Departed' ? 4 : 0)) % turnStates.length];
    const health = levels[(i * 3) % 4];
    const t: Turnaround = {
      id: `ta-${i + 1}`, flightId: f.id, plannedStart: sta, plannedEnd: f.std, actualStart: f.ata, phase: status === 'Departed' ? 'Complete' : phase,
      health, slaRisk: levels[(i + 1) % 4],
    };
    turnarounds.push(t);
    const rule = slaRules.find((x) => x.airlineId === al.id)!;
    slaRisks.push({ id: `sr-${i + 1}`, ruleId: rule.id, affectedEntityId: t.id, level: t.slaRisk, cause: `${rule.milestoneType} forecast vs target ${rule.targetMin} min`, forecastBreach: t.slaRisk === 'Breach' ? sta + 40 : undefined });

    MILESTONE_TYPES.forEach((mt, mi) => {
      const planned = sta + mi * 12;
      const status: TaskState = taskStates[(i + mi) % taskStates.length];
      milestones.push({
        id: `ms-${i + 1}-${mi}`, turnaroundId: t.id, type: mt, plannedTime: planned,
        forecastTime: planned + (status === 'AtRisk' ? 8 : status === 'Blocked' ? 20 : 0),
        actualTime: status === 'Complete' ? planned : undefined, status,
      });
    });
    TASK_TYPES.forEach(([tt, bu, assetType], ki) => {
      const status: TaskState = taskStates[(i + ki * 2) % taskStates.length];
      const planned = sta + ki * 10;
      const asset = assets.find((a) => a.type === assetType && a.standId[0] === stand.pier);
      tasks.push({
        id: `tk-${i + 1}-${ki}`, turnaroundId: t.id, taskType: tt, ownerId: bu === 'bu-bag' ? 'u-bu2' : ki === 1 ? 'u-own1' : 'u-ramp' + (stand.pier === 'B' ? 2 : 1),
        buId: bu, status, plannedTime: planned, forecastTime: planned + (status === 'AtRisk' ? 10 : status === 'Blocked' ? 25 : 0),
        actualTime: status === 'Complete' ? planned : undefined, priority: ((ki % 3) + 1) as 1 | 2 | 3, assetId: asset?.id,
      });
    });
  }
  // Link a few assets to tasks (Engaged assets have assignments).
  assets.forEach((a) => {
    if (a.status === 'Engaged' || a.status === 'Reserved') a.assignedTaskId = tasks.find((t) => t.assetId === a.id)?.id;
  });

  bus.forEach((bu) =>
    ['General', 'Certified'].forEach((sk, si) => {
      const planned = 20 + si * 6;
      staff.push({ id: `sc-${bu.id}-${sk}`, buId: bu.id, skillGroup: sk, planned, available: planned - (bu.id === 'bu-bag' ? 6 : 2), engaged: planned - 8, windowStart: NOW - 60, windowEnd: NOW + 360 });
    }),
  );

  const constraints: Constraint[] = [
    { id: 'cn-1', type: 'Weather: Lightning Watch', scope: 'B', start: NOW + 30, end: NOW + 75, severity: 'Medium', source: 'MET feed (synthetic)', sourceTime: NOW - 5 },
    { id: 'cn-2', type: 'Stand Closure: Maintenance', scope: 'C6', start: NOW - 30, end: NOW + 240, severity: 'Low', source: 'Airport Ops (synthetic)', sourceTime: NOW - 90 },
  ];

  const sevs: Severity[] = ['Low', 'Medium', 'High', 'Critical'];
  const exStates: ExceptionState[] = ['New', 'Acknowledged', 'Assigned', 'Monitoring', 'Resolved'];
  const types = ['Late milestone', 'GSE shortage', 'Staff gap', 'SLA breach risk', 'Weather impact', 'Blocked dependency'];
  const exceptions: OpException[] = [];
  const actions: ActionItem[] = [];
  for (let i = 0; i < 12; i++) {
    const t = turnarounds[(i * 2) % turnarounds.length];
    const f = flights.find((x) => x.id === t.flightId)!;
    const tk = tasks.find((x) => x.turnaroundId === t.id)!;
    const status = exStates[i % exStates.length];
    // Every fourth exception is intentionally unassigned to exercise the "Unassigned" state.
    const ownerId = i % 4 === 3 || status === 'New' ? undefined : tk.ownerId;
    const ex: OpException = {
      id: `ex-${i + 1}`, type: types[i % types.length], severity: sevs[(i * 3) % 4], detectedAt: NOW - 20 + i, source: pick(['DSM', 'DCT', 'G-Ops', 'Mosaic']) + ' (synthetic)',
      status, ownerId, affectedEntityIds: [f.id, t.id, tk.id, f.standId, ...(tk.assetId ? [tk.assetId] : [])],
      explanation: `${types[i % types.length]} on ${f.flightNo}: forecast ${tk.taskType} ${tk.forecastTime - tk.plannedTime} min behind plan.`,
      nextAction: ownerId ? 'Confirm recovery plan with BU Ops' : 'Assign an owner', targetTime: NOW + 10 + i * 3,
    };
    exceptions.push(ex);
    actions.push({ id: `ac-${i + 1}`, exceptionId: ex.id, taskId: tk.id, ownerId, leadStakeholderId: 'u-lead', status, targetTime: ex.targetTime, audit: [`${fmt(ex.detectedAt)} detected by ${ex.source}`] });
  }

  return {
    schemaVersion: SCHEMA_VERSION, seedVersion: SEED_VERSION, now: NOW,
    airlines, bus, stakeholders, stands, flights, turnarounds, milestones, tasks, staff, assets, slaRules, slaRisks, exceptions, actions, constraints,
  };
}

export function fmt(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Recursively freezes so UI code cannot mutate baseline records (DATA-003). */
export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o as object).forEach(deepFreeze);
  }
  return o;
}
