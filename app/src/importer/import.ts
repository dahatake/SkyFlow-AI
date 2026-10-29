import { openDB, idbPut, idbGetAll } from '../storage/idb';
import { validateCustomer, type Customer } from '../customers/schema';
import { findAirport, langForCountry } from './catalog';
import { setLang } from '../i18n/core';
import { fetchOsmMap, type OsmMap } from './osm';
import { gatherAirportFacts, type GatherStep } from './gather';
import { buildImportedAirport, type ImportedAirport } from './generate';
import { nowDate } from '../domain/clock';

export type ImportPhase = 'gather' | 'facts' | 'localized' | 'map' | 'generate' | 'validate' | 'store' | 'activate';
export const IMPORT_PHASES: ImportPhase[] = ['gather', 'facts', 'localized', 'map', 'generate', 'validate', 'store', 'activate'];
export interface ImportProgress { phase: ImportPhase; index: number; total: number; percent: number }

export const CUSTOMERS_KEY = 'aoct-imported-customers';
export const ACTIVE_KEY = 'aoct-active-customer';

export function readImportedCustomers(): Record<string, Customer> {
  try { return JSON.parse(localStorage.getItem(CUSTOMERS_KEY) ?? '{}') as Record<string, Customer>; } catch { return {}; }
}

export async function listImported(): Promise<ImportedAirport[]> {
  return idbGetAll<ImportedAirport>(await openDB(), 'airports');
}

/** Gathers, generates, validates and stores an airport; reports progress after every phase. */
export async function runImport(iata: string, onProgress: (p: ImportProgress) => void, fetcher?: typeof fetch): Promise<ImportedAirport & { map: OsmMap | null }> {
  const ap = findAirport(iata);
  if (!ap) throw new Error(`Unknown airport ${iata}`);
  const total = IMPORT_PHASES.length;
  const report = (phase: ImportPhase, done: boolean) => {
    const index = IMPORT_PHASES.indexOf(phase);
    onProgress({ phase, index, total, percent: Math.round(((index + (done ? 1 : 0)) / total) * 100) });
  };
  const phaseOf: Record<GatherStep, ImportPhase> = { article: 'gather', facts: 'facts', localized: 'localized' };
  let last: ImportPhase | null = null;
  report('gather', false);
  const facts = await gatherAirportFacts(ap, {
    fetcher: fetcher ? (u, i) => fetcher(u, i) : undefined,
    onStep: (s) => { if (last) report(last, true); last = phaseOf[s]; report(last, false); },
  });
  report('localized', true);

  report('map', false);
  const map = await fetchOsmMap(ap.lat, ap.lon, fetcher);
  report('map', true);

  report('generate', false);
  const rec = { ...buildImportedAirport(ap, facts, nowDate().toISOString()), map };
  report('generate', true);

  report('validate', false);
  const errs = validateCustomer(rec.customer);
  if (errs.length) throw new Error(`Generated profile is invalid: ${errs.join('; ')}`);
  report('validate', true);

  report('store', false);
  await idbPut(await openDB(), 'airports', rec);
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify({ ...readImportedCustomers(), [rec.id]: rec.customer }));
  report('store', true);

  report('activate', false);
  localStorage.setItem(ACTIVE_KEY, rec.id);
  setLang(langForCountry(ap.country));
  report('activate', true);
  return rec;
}
