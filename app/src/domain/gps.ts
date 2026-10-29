import type { Asset, Baseline, Flight, Task } from './types';
import { DEPOT, OPS_ROOMS, RUNWAY_Y, TERMINALS, TRANSIT_POINT, beltPoint, checkinRow, gateLounge, standPoint, taxiPath, toLatLon, type Level } from './airportMap';

/** GPS fixes are reported every 5 minutes of operational time. */
export const FIX_MINUTES = 5;
export type GpsKind = 'aircraft' | 'gse' | 'staff';
export interface GpsEntity { id: string; kind: GpsKind; label: string; sub: string; device: string; refId?: string }
export interface GpsFix {
  id: string; entityId: string; t: number; x: number; y: number; lat: number; lon: number; level: Level;
  speedKmh: number; headingDeg: number; accuracyM: number; source: string; state: string;
}

const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000; };
const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.min(1, Math.max(0, k));
const lerpP = (a: { x: number; y: number }, b: { x: number; y: number }, k: number) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
const bearing = (a: { x: number; y: number }, b: { x: number; y: number }) => (Math.round((Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI) + 360) % 360;
const slot = (t: number) => Math.floor(t / FIX_MINUTES) * FIX_MINUTES;
export const slotOf = slot;

/** Aircraft: approach -> touchdown -> taxi in -> stand -> pushback/taxi out -> take-off, all derived from the flight times. */
function aircraft(f: Flight, t: number) {
  if (f.status === 'Cancelled') return null;
  const sta = f.ata ?? f.sta, off = f.etd;
  const sp = standPoint(f.standId);
  const { mid, hold } = taxiPath(f.standId);
  const south = { x: hold.x, y: RUNWAY_Y.to - 20 };
  const north = { x: hold.x, y: RUNWAY_Y.from };
  if (t < sta - 25 || t > off + 22) return null;
  if (t < sta - 9) { const p = lerpP(south, hold, (t - (sta - 25)) / 16); return { ...p, h: 0, speed: 250, level: 'apron' as Level, state: 'Approach' }; }
  if (t < sta) {
    const k = (t - (sta - 9)) / 9;
    const a = k < 0.5 ? hold : mid, b = k < 0.5 ? mid : sp;
    return { ...lerpP(a, b, k < 0.5 ? k / 0.5 : (k - 0.5) / 0.5), h: bearing(a, b), speed: k < 0.3 ? 80 : 30, level: 'apron' as Level, state: 'Taxi in' };
  }
  if (t <= off) return { x: sp.x, y: sp.y, h: bearing(mid, sp), speed: 0, level: 'apron' as Level, state: 'At stand' };
  if (t < off + 12) {
    const k = (t - off) / 12;
    const a = k < 0.5 ? sp : mid, b = k < 0.5 ? mid : hold;
    return { ...lerpP(a, b, k < 0.5 ? k / 0.5 : (k - 0.5) / 0.5), h: bearing(a, b), speed: k < 0.2 ? 8 : 30, level: 'apron' as Level, state: k < 0.2 ? 'Pushback' : 'Taxi out' };
  }
  return { ...lerpP(hold, north, (t - (off + 12)) / 10), h: 0, speed: 250, level: 'apron' as Level, state: 'Take-off' };
}
/** GSE parks near its home stand and drives to the stand of any task it supports. */
function gse(b: Baseline, a: Asset, t: number) {
  const home = standPoint(a.standId);
  const idx = hash(a.id);
  const park = { x: home.x + 55 + idx * 25, y: home.y + 14 + idx * 10 };
  const tasks = b.tasks.filter((k) => k.assetId === a.id);
  const flightOf = (k: Task) => b.flights.find((f) => f.id === b.turnarounds.find((x) => x.id === k.turnaroundId)?.flightId);
  const win = tasks.map((k) => ({ k, f: flightOf(k) })).filter((x): x is { k: Task; f: Flight } => !!x.f && x.f.status !== 'Cancelled')
    .map((x) => ({ ...x, s: x.k.forecastTime - 8, e: x.k.forecastTime + 25 }))
    .sort((p, q) => Math.abs(p.s - t) - Math.abs(q.s - t))[0];
  if (a.status === 'Unavailable') return { ...DEPOT, h: 0, speed: 0, level: 'apron' as Level, state: 'Out of service' };
  if (!win) return { ...park, h: 270, speed: 0, level: 'apron' as Level, state: 'Parked' };
  const target = { x: standPoint(win.f.standId).x + 25 + idx * 12, y: standPoint(win.f.standId).y + 10 };
  const drive = 8;
  if (t < win.s - drive) return { ...park, h: 270, speed: 0, level: 'apron' as Level, state: 'Parked' };
  if (t < win.s) return { ...lerpP(park, target, (t - (win.s - drive)) / drive), h: bearing(park, target), speed: 20, level: 'apron' as Level, state: 'Driving to stand' };
  if (t <= win.e) return { ...target, h: 270, speed: 0, level: 'apron' as Level, state: 'Serving ' + win.f.flightNo };
  if (t < win.e + drive) { const p = lerpP(target, park, (t - win.e) / drive); return { ...p, h: bearing(target, park), speed: 20, level: 'apron' as Level, state: 'Returning' }; }
  return { ...park, h: 270, speed: 0, level: 'apron' as Level, state: 'Parked' };
}

type Role = 'ramp' | 'bag' | 'cabin' | 'gate' | 'checkin' | 'manager' | 'pier' | 'sioc';
const activeFlights = (b: Baseline, t: number) => b.flights.filter((f) => f.status !== 'Cancelled' && (f.ata ?? f.sta) - 5 <= t && t <= f.etd + 5).sort((a, c) => a.sta - c.sta);

function staffTarget(b: Baseline, role: Role, n: number, ref: string | undefined, t: number): { x: number; y: number; level: Level; state: string } {
  const jig = (s: string, amp = 10) => ({ dx: (hash(ref + s + n) - 0.5) * amp, dy: (hash(s + ref + n + 'y') - 0.5) * amp });
  const act = activeFlights(b, t);
  const crew = OPS_ROOMS.crew;
  const pick = (list: Flight[]) => (list.length ? list[(n + Math.floor(t / 25)) % list.length] : undefined);
  if (role === 'sioc') { const j = jig('s', 14); return { x: OPS_ROOMS.sioc.x + j.dx, y: OPS_ROOMS.sioc.y + j.dy, level: 'L2', state: 'In SIOC' }; }
  if (role === 'manager') {
    const patrol = Math.floor(t / 20 + n) % 3 === 0 && act.length;
    if (patrol) { const f = act[(n + Math.floor(t / 20)) % act.length]; const p = standPoint(f.standId); return { x: p.x + 20, y: p.y - 14, level: 'apron', state: 'Apron round' }; }
    return { x: OPS_ROOMS.bu.x + jig('m').dx, y: OPS_ROOMS.bu.y + jig('m').dy, level: 'L2', state: 'In office' };
  }
  if (role === 'pier') {
    const mine = act.filter((f) => f.standId.startsWith(ref ?? 'A'));
    const f = mine.length ? mine[Math.floor(t / 10 + n) % mine.length] : undefined;
    if (f) { const p = standPoint(f.standId); return { x: p.x + 28, y: p.y + 14, level: 'apron', state: 'At ' + f.standId }; }
    return { x: crew.x, y: crew.y, level: 'L2', state: 'Crew room' };
  }
  if (role === 'ramp' || role === 'cabin') {
    const f = pick(act);
    if (!f) return { x: crew.x + jig('r').dx, y: crew.y + jig('r').dy, level: 'L2', state: 'Crew room' };
    const p = standPoint(f.standId); const j = jig('p', 30);
    return { x: p.x + 30 + j.dx, y: p.y + j.dy, level: 'apron', state: 'Servicing ' + f.flightNo };
  }
  if (role === 'bag') {
    const f = pick(act);
    if (!f) return { x: crew.x + jig('b').dx, y: crew.y + jig('b').dy, level: 'L2', state: 'Crew room' };
    const p = standPoint(f.standId);
    if (t < (f.ata ?? f.sta) + 40) { const t0 = TERMINALS.find((x) => x.pier === f.standId[0])!; const bp = beltPoint(t0.id, n); return { x: bp.x + jig('x').dx, y: bp.y + jig('x').dy, level: 'L1', state: 'Belt ' + f.flightNo }; }
    return { x: p.x + 40, y: p.y - 10, level: 'apron', state: 'Loading ' + f.flightNo };
  }
  if (role === 'gate') {
    const f = pick(b.flights.filter((x) => x.status !== 'Cancelled' && x.etd - 60 <= t && t <= x.etd));
    if (!f) return { x: TRANSIT_POINT.x + jig('g', 40).dx, y: TRANSIT_POINT.y + jig('g').dy, level: 'L3', state: 'Transit service point' };
    const g = gateLounge(f.standId);
    return { x: g.x + jig('g', 8).dx, y: g.y + jig('g', 8).dy, level: 'L2', state: 'Boarding ' + f.flightNo };
  }
  const f = pick(b.flights.filter((x) => x.status !== 'Cancelled' && x.etd - 180 <= t && t <= x.etd - 45));
  if (!f) return { x: crew.x + jig('c').dx, y: crew.y + jig('c').dy, level: 'L2', state: 'Crew room' };
  const t0 = TERMINALS.find((x) => x.pier === f.standId[0])!; const r = checkinRow(t0.id, n);
  return { x: r.x + jig('c', 8).dx, y: r.y + jig('c', 8).dy, level: 'L2', state: 'Check-in ' + f.flightNo };
}

interface StaffSpec { role: Role; n: number; ref?: string }
const STAFF_SPEC = new Map<string, StaffSpec>();

export function entitiesOf(b: Baseline): GpsEntity[] {
  STAFF_SPEC.clear();
  const out: GpsEntity[] = [];
  b.flights.filter((f) => f.status !== 'Cancelled').forEach((f) => out.push({ id: `gps-ac-${f.id}`, kind: 'aircraft', label: f.flightNo, sub: 'Aircraft', device: 'ADS-B / A-SMGCS transponder', refId: f.id }));
  b.assets.forEach((a) => out.push({ id: `gps-gse-${a.id}`, kind: 'gse', label: a.id.replace('as-', '').toUpperCase(), sub: a.type, device: 'Vehicle telematics (GNSS)', refId: a.id }));
  const st = (id: string, label: string, sub: string, spec: StaffSpec, device = 'Handheld GNSS + indoor BLE') => { STAFF_SPEC.set(id, spec); out.push({ id, kind: 'staff', label, sub, device, refId: undefined }); };
  b.stakeholders.forEach((s, i) => {
    const role: Role = s.roleType === 'Ramp Lead' ? 'pier' : s.roleType === 'BU Ops Manager' ? 'manager' : s.roleType === 'Action Owner' ? 'ramp' : 'sioc';
    st(`gps-st-${s.id}`, s.displayName, s.roleType, { role, n: i, ref: role === 'pier' ? (s.scope.endsWith('B') ? 'B' : 'A') : undefined });
  });
  const crew: [Role, string, string, number][] = [['ramp', 'Ramp crew', 'Ramp Services', 5], ['bag', 'Baggage crew', 'Baggage Handling', 5], ['cabin', 'Cabin crew', 'Catering & Cabin', 4], ['gate', 'Gate agent', 'Customer service', 4], ['checkin', 'Check-in agent', 'Customer service', 4]];
  crew.forEach(([role, label, sub, n]) => { for (let k = 1; k <= n; k++) st(`gps-st-${role}-${k}`, `${label} ${String(k).padStart(2, '0')}`, sub, { role, n: k - 1 }); });
  return out;
}

export function fixAt(b: Baseline, e: GpsEntity, t: number): GpsFix | null {
  let p: { x: number; y: number; h: number; speed: number; level: Level; state: string } | null = null;
  let acc = 3, source = e.device;
  if (e.kind === 'aircraft') { const f = b.flights.find((x) => x.id === e.refId); p = f ? aircraft(f, t) : null; acc = p && p.speed > 100 ? 25 : 8; }
  else if (e.kind === 'gse') { const a = b.assets.find((x) => x.id === e.refId); p = a ? gse(b, a, t) : null; acc = 3; }
  else {
    const spec = STAFF_SPEC.get(e.id) ?? { role: 'ramp' as Role, n: 0 };
    const cur = staffTarget(b, spec.role, spec.n, spec.ref, t), prev = staffTarget(b, spec.role, spec.n, spec.ref, t - FIX_MINUTES);
    const same = cur.level === prev.level;
    const q = same ? lerpP(prev, cur, 0.85) : cur;
    p = { x: q.x, y: q.y, h: bearing(prev, cur), speed: same ? Math.min(8, Math.round(Math.hypot(cur.x - prev.x, cur.y - prev.y) * 0.024)) : 0, level: cur.level, state: cur.state };
    acc = cur.level === 'apron' ? 4 : 12;
    if (cur.level !== 'apron') source = 'Indoor positioning (BLE / Wi-Fi)';
  }
  if (!p) return null;
  const ll = toLatLon(p.x, p.y);
  const x = p.x;
  return {
    id: `${e.id}@${t}`, entityId: e.id, t, x, y: p.y, lat: Math.round(ll.lat * 1e6) / 1e6, lon: Math.round(ll.lon * 1e6) / 1e6, level: p.level,
    speedKmh: Math.round(p.speed), headingDeg: Math.round(p.h), accuracyM: acc, source, state: p.state,
  };
}

/** All fixes for every entity in the given 5-minute slots. */
export function fixesFor(b: Baseline, ents: GpsEntity[], slots: number[]): GpsFix[] {
  const out: GpsFix[] = [];
  slots.forEach((t) => ents.forEach((e) => { const f = fixAt(b, e, t); if (f) out.push(f); }));
  return out;
}
export function slotsBetween(from: number, to: number): number[] {
  const out: number[] = [];
  for (let t = slot(from); t <= slot(to); t += FIX_MINUTES) out.push(t);
  return out;
}
export const fixesToCsv = (fx: GpsFix[]) => ['time_min,entity,lat,lon,level,speed_kmh,heading_deg,accuracy_m,source,state', ...fx.map((f) => [f.t, f.entityId, f.lat, f.lon, f.level, f.speedKmh, f.headingDeg, f.accuracyM, `"${f.source}"`, `"${f.state}"`].join(','))].join('\n');
