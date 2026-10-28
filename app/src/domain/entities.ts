import type { Baseline, Flight } from './types';
import routes from '../data/changi/routes.json';

export interface AircraftModel { type: string; image: string; credit: string }

const A380: AircraftModel = { type: 'Airbus A380-800', image: 'assets/aircraft/a380-sq-9v-ska.jpg', credit: 'Wikimedia Commons (public domain)' };
const B777: AircraftModel = { type: 'Boeing 777-300', image: 'assets/aircraft/b777-300.svg', credit: 'Wikimedia Commons, CC BY-SA 4.0' };
const B737: AircraftModel = { type: 'Boeing 737-300ER', image: 'assets/aircraft/b737-300er.svg', credit: 'Wikimedia Commons, CC BY-SA 4.0' };
const BY_AIRLINE: Record<string, AircraftModel> = { SQ: A380, TR: B737, EK: B777, QF: A380 };

export const aircraftFor = (airlineCode: string): AircraftModel => BY_AIRLINE[airlineCode] ?? B777;

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

const routeCount = (airlineName: string) =>
  routes.airlines.find((a) => a.airline.toLowerCase() === airlineName.toLowerCase())?.routes.length;

/** Real Changi route count for the airline (Wikipedia), if known. */
export const changiRoutes = routeCount;

/** Derived (simulated) load figures per flight; deterministic so the view is stable. */
export function flightLoad(f: Flight) {
  const h = hash(f.id);
  return { bags: 60 + (h % 220), cargoKg: 800 + ((h >> 3) % 9000) };
}

export type EntityKind = 'flight' | 'gate' | 'staff' | 'baggage' | 'cargo';
export interface HoverInfo { kind: EntityKind; title: string; rows: [string, string][]; image?: string; credit?: string }

export function staffAtStand(b: Baseline, standId: string, standOf: (f: Flight) => string) {
  const tids = new Set(b.turnarounds.filter((t) => b.flights.some((f) => f.id === t.flightId && standOf(f) === standId)).map((t) => t.id));
  const tasks = b.tasks.filter((t) => tids.has(t.turnaroundId));
  return { tasks, owners: new Set(tasks.map((t) => t.ownerId)).size };
}
