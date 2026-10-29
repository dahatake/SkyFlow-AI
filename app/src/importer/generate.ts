import type { Airline, Flight, StaffCapacity, Stand } from '../domain/types';
import type { Customer } from '../customers/schema';
import { AIRPORT_CATALOG, type CatalogAirport } from './catalog';
import type { GatheredFacts } from './gather';

export interface ImportedAirport {
  id: string;
  iata: string;
  importedAt: string;
  catalog: CatalogAirport;
  facts: GatheredFacts;
  customer: Customer;
  data: { airlines: Airline[]; stands: Stand[]; flights: Flight[]; staff: StaffCapacity[] };
}

const POOLS: Record<CatalogAirport['region'], [string, string][]> = {
  asia: [['SQ', 'Singapore Airlines'], ['NH', 'All Nippon Airways'], ['CX', 'Cathay Pacific'], ['KE', 'Korean Air'], ['TG', 'Thai Airways'], ['AI', 'Air India']],
  europe: [['LH', 'Lufthansa'], ['AF', 'Air France'], ['KL', 'KLM'], ['BA', 'British Airways'], ['IB', 'Iberia'], ['LX', 'Swiss']],
  namerica: [['AA', 'American Airlines'], ['DL', 'Delta Air Lines'], ['UA', 'United Airlines'], ['AC', 'Air Canada'], ['WN', 'Southwest Airlines'], ['AS', 'Alaska Airlines']],
  mideast: [['EK', 'Emirates'], ['QR', 'Qatar Airways'], ['TK', 'Turkish Airlines'], ['EY', 'Etihad Airways'], ['SV', 'Saudia'], ['GF', 'Gulf Air']],
  oceania: [['QF', 'Qantas'], ['NZ', 'Air New Zealand'], ['VA', 'Virgin Australia'], ['JQ', 'Jetstar'], ['FJ', 'Fiji Airways'], ['SQ', 'Singapore Airlines']],
  latam: [['LA', 'LATAM Airlines'], ['AM', 'Aeroméxico'], ['CM', 'Copa Airlines'], ['AV', 'Avianca'], ['G3', 'Gol'], ['AD', 'Azul']],
  africa: [['ET', 'Ethiopian Airlines'], ['SA', 'South African Airways'], ['MS', 'EgyptAir'], ['KQ', 'Kenya Airways'], ['AT', 'Royal Air Maroc'], ['WB', 'RwandAir']],
};

// Local deterministic PRNG so the same airport always yields the same sample data.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}
const seedOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const importId = (iata: string) => `imp-${iata.toLowerCase()}`;

/** Builds a valid customer profile plus deterministic sample operational data scaled by the gathered facts. */
export function buildImportedAirport(ap: CatalogAirport, facts: GatheredFacts, importedAt: string): ImportedAirport {
  const r = rng(seedOf(ap.iata));
  const mpax = (facts.annualPassengers ?? 20_000_000) / 1_000_000;
  const standCount = Math.max(10, Math.min(40, Math.round(Math.sqrt(mpax) * 3)));
  const flightCount = Math.max(24, Math.min(120, Math.round(mpax * 1.5)));
  const piers = ['A', 'B', 'C', 'D'].slice(0, Math.max(2, Math.ceil(standCount / 10)));

  const airlines: Airline[] = POOLS[ap.region].map(([code, name], i) => ({ id: `al-${code.toLowerCase()}`, code, name, slaProfileId: i < 2 ? 'sla-prem' : i < 4 ? 'sla-std' : 'sla-lcc' }));
  const stands: Stand[] = Array.from({ length: standCount }, (_, i) => {
    const pier = piers[i % piers.length];
    const n = Math.floor(i / piers.length) + 1;
    return { id: `st-${pier}${n}`, pier, stand: `${pier}${n}`, x: 60 + (i % 10) * 70, y: 80 + piers.indexOf(pier) * 90, status: 'Open' };
  });
  const dests = AIRPORT_CATALOG.filter((x) => x.iata !== ap.iata);
  const flights: Flight[] = Array.from({ length: flightCount }, (_, i) => {
    const al = airlines[Math.floor(r() * airlines.length)];
    const st = stands[i % stands.length];
    const sta = 300 + Math.floor((i / flightCount) * 1000) + Math.floor(r() * 20);
    const std = sta + 45 + Math.floor(r() * 60);
    const inbound = dests[Math.floor(r() * dests.length)].iata;
    const outbound = dests[Math.floor(r() * dests.length)].iata;
    const delay = r() < 0.2 ? 5 + Math.floor(r() * 40) : 0;
    return {
      id: `fl-${i + 1}`, flightNo: `${al.code}${100 + Math.floor(r() * 899)}`, airlineId: al.id, origin: inbound, destination: outbound,
      sta, std, etd: std + delay, status: delay ? 'Delayed' : 'Scheduled', pierId: st.pier, standId: st.id,
    } as Flight;
  });
  const staff: StaffCapacity[] = ['Ramp', 'Baggage', 'Catering', 'Cleaning'].map((g, i) => {
    const planned = Math.max(8, Math.round(standCount * (1.2 + i * 0.3)));
    return { id: `sc-${i + 1}`, buId: i === 1 ? 'bu-bag' : i === 2 || i === 3 ? 'bu-cat' : 'bu-ramp', skillGroup: g, planned, available: Math.max(1, planned - Math.floor(r() * 3)), engaged: Math.floor(planned * 0.5), windowStart: 0, windowEnd: 1440 };
  });

  const customer: Customer = {
    id: importId(ap.iata),
    name: `${ap.labels.en} ground handling`,
    programme: 'Imported airport pilot',
    productName: 'AI Operations Control Tower',
    airport: { iata: ap.iata, name: ap.labels.en, timezone: ap.timezone, country: ap.country, lat: ap.lat, lon: ap.lon, labels: ap.labels },
    currency: ap.currency,
    assumptions: {
      costPerDelayMinute: 90, slaBreachPenalty: 2000, blockedTaskCost: 50, manualResponseMinutes: 15, agentResponseMinutes: 4, disruptionsPerMonth: Math.max(4, Math.round(mpax / 3)),
      source: `ASSUMPTION - generated sample values for ${ap.iata}; replace with discovery data`,
    },
    deck: { mvpScopeDate: '2027-01-29', buildStartDate: '2027-03-01', anchorScenario: 'demo-weather' },
  };
  return { id: importId(ap.iata), iata: ap.iata, importedAt, catalog: ap, facts, customer, data: { airlines, stands, flights, staff } };
}
