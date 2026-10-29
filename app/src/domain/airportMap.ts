/**
 * Schematic Changi map used by the GPS tracking view. The layout follows the public Changi map
 * (https://www.changiairport.com/en/at-changi/map.html): T3 to the north, T2 in the middle with two long piers pointing south,
 * T1 to the east with its two angled piers, Jewel between T1 / T2 / T3, T4 to the south-west. It is NOT survey-accurate:
 * replace it with the official floor plans / GeoJSON in production. North is up.
 *
 * Shapes are authored in "screen" coordinates of the reference map and converted to world units by `P`.
 */
export type Level = 'apron' | 'L1' | 'L2' | 'L3';
export type LevelChoice = 'overview' | Level;
export const LEVELS: { id: LevelChoice; label: string; blurb: string }[] = [
  { id: 'overview', label: 'Overview', blurb: 'Whole airport, all levels' },
  { id: 'apron', label: 'Apron / airside', blurb: 'Stands, taxiways, runways' },
  { id: 'L1', label: 'Level 1 · Arrivals', blurb: 'Arrival halls and baggage belts' },
  { id: 'L2', label: 'Level 2 · Departures', blurb: 'Check-in rows, gates and operations offices' },
  { id: 'L3', label: 'Level 3 · Transit / gates', blurb: 'Lounges and transit areas' },
];

const F = 1.8, OX = 40, OY = 60;
export type Pt = { x: number; y: number };
export const P = (x: number, y: number): Pt => ({ x: (x + OX) * F, y: (y - OY) * F });
const poly = (pts: number[][]) => pts.map(([x, y]) => P(x, y));
export const WORLD = { w: 2150, h: 860, metersPerUnit: 1.4 };

export interface Arm { pts: Pt[]; w: number }
export interface TerminalGeo { id: string; name: string; color: string; body: Pt[]; arms: Arm[]; label: Pt; box: { x: number; y: number; w: number; h: number }; pier?: string }
const box = (x0: number, y0: number, x1: number, y1: number) => { const a = P(x0, y0), b = P(x1, y1); return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }; };
export const TERMINALS: TerminalGeo[] = [
  {
    id: 'T3', name: 'Terminal 3', color: '#00897b', pier: 'C',
    body: poly([[138, 135], [162, 135], [210, 170], [360, 170], [372, 130], [512, 130], [522, 170], [700, 170], [700, 198], [548, 200], [520, 213], [205, 213], [190, 188], [165, 178]]),
    arms: [], label: P(445, 172), box: box(120, 115, 715, 225),
  },
  {
    id: 'T2', name: 'Terminal 2', color: '#f03a26', pier: 'B',
    body: poly([[200, 300], [310, 300], [310, 285], [392, 285], [392, 262], [500, 262], [500, 285], [580, 285], [580, 298], [690, 300], [690, 318], [200, 318]]),
    arms: [{ pts: [P(402, 318), P(402, 388), P(305, 438)], w: 15 * F }, { pts: [P(506, 318), P(506, 376), P(594, 432)], w: 15 * F }],
    label: P(446, 292), box: box(190, 255, 700, 450),
  },
  {
    id: 'T1', name: 'Terminal 1', color: '#1c6db8', pier: 'A',
    body: poly([[690, 172], [735, 172], [735, 300], [690, 300]]),
    arms: [{ pts: [P(735, 185), P(800, 185), P(872, 148)], w: 15 * F }, { pts: [P(735, 298), P(800, 298), P(872, 338)], w: 15 * F }],
    label: P(712, 240), box: box(680, 130, 890, 350),
  },
  {
    id: 'T4', name: 'Terminal 4', color: '#8e44ad',
    body: poly([[100, 445], [250, 445], [250, 482], [100, 482]]), arms: [], label: P(175, 468), box: box(90, 430, 265, 495),
  },
];
export const JEWEL = { ...P(640, 245), r: 28 * F, box: box(606, 212, 674, 278) };
export const terminalById = (id: string) => TERMINALS.find((t) => t.id === id)!;
export const terminalOfPier = (pier: string) => TERMINALS.find((t) => t.pier === pier) ?? TERMINALS[1];

/** Decorative grass patches and open apron areas, taken loosely from the reference map. */
export const GRASS = [[75, 478, 200, 510], [10, 415, 60, 460], [300, 455, 400, 495], [420, 470, 560, 510], [895, 90, 955, 390], [965, 70, 1020, 400], [830, 40, 880, 90], [0, 90, 40, 150], [60, 90, 130, 150]].map(([a, b, c, d]) => box(a, b, c, d));
export const APRON_AREAS = [box(195, 213, 690, 262), box(0, 213, 195, 330), box(200, 318, 690, 345)];
export const RUNWAYS = [{ id: '02L/20R', x: P(60, 0).x }, { id: '02C/20C', x: P(20, 0).x }];
export const RUNWAY_Y = { from: 20, to: 840 };
const GEO0 = { lat: 1.3644, lon: 103.9915, x: P(500, 280).x, y: P(500, 280).y };

export const toLatLon = (x: number, y: number) => {
  const m = WORLD.metersPerUnit;
  return { lat: GEO0.lat - ((y - GEO0.y) * m) / 111320, lon: GEO0.lon + ((x - GEO0.x) * m) / (111320 * Math.cos((GEO0.lat * Math.PI) / 180)) };
};

const along = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const off = (p: Pt, dx: number, dy: number): Pt => ({ x: p.x + dx * F, y: p.y + dy * F });
/** Point on the pier where a stand connects (gate side) and the aircraft nose position (apron side), per stand 1..6. */
function standGeo(standId: string): { gate: Pt; stand: Pt; lane: number } {
  const pier = standId[0], k = Math.max(0, Math.min(5, Number(standId.slice(1)) - 1 || 0)), j = k % 3, t = 0.18 + j * 0.32;
  if (pier === 'A') {
    const a = TERMINALS[2].arms[k < 3 ? 0 : 1].pts, s = k < 3 ? -1 : 1;
    const g = along(a[1], a[2], t);
    return { gate: g, stand: off(g, 0, s * 16), lane: k < 3 ? P(0, 100).y : P(0, 460).y };
  }
  if (pier === 'B') {
    const a = TERMINALS[1].arms[k < 3 ? 0 : 1].pts, s = k < 3 ? -1 : 1;
    const g = along(a[1], a[2], t);
    return { gate: g, stand: off(g, s * 16, 6), lane: P(0, 460).y };
  }
  const g = P(250 + k * 78, 213);
  return { gate: g, stand: off(g, 0, 18), lane: P(0, 238).y };
}
export const standPoint = (standId: string) => { const g = standGeo(standId); return { ...g.stand, terminal: terminalOfPier(standId[0]) }; };
export const gateLounge = (standId: string): Pt => standGeo(standId).gate;
/** Aircraft taxi route: stand -> lane -> west to the runway holding point. */
export function taxiPath(standId: string) {
  const g = standGeo(standId), s = g.stand;
  return { mid: { x: s.x, y: g.lane }, hold: { x: RUNWAYS[0].x, y: g.lane } };
}
const GATE_PREFIX: Record<string, [string, number]> = { A: ['D', 30], B: ['F', 50], C: ['B', 10] };
/** Public-style gate label for a stand id, e.g. A1 -> D30. */
export const gateName = (standId: string) => { const [p, n] = GATE_PREFIX[standId[0]] ?? ['G', 1]; return `${p}${n + (Number(standId.slice(1)) - 1)}`; };

export const checkinRow = (terminalId: string, k: number): Pt => {
  const i = k % 5;
  if (terminalId === 'T1') return P(693, 190 + i * 22);
  if (terminalId === 'T2') return P(410 + i * 16, 273);
  if (terminalId === 'T3') return P(395 + i * 22, 150);
  return P(130 + i * 20, 455);
};
export const beltPoint = (terminalId: string, k: number): Pt => {
  const i = k % 5;
  if (terminalId === 'T1') return P(714, 190 + i * 22);
  if (terminalId === 'T2') return P(410 + i * 16, 308);
  if (terminalId === 'T3') return P(395 + i * 22, 190);
  return P(130 + i * 20, 472);
};
export const OPS_ROOMS = {
  sioc: { ...P(712, 205), label: 'SIOC' },
  crew: { ...P(712, 262), label: 'Crew room' },
  bu: { ...P(450, 282), label: 'BU office' },
};
export const DEPOT = P(230, 236);
export const TRANSIT_POINT = P(440, 192);
