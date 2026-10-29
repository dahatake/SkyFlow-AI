import { openDB, idbGetAll, idbPut, idbPutMany, idbDelete, idbClear, idbGet } from './idb';
import { getProvider } from '../data/provider';
import type { GpsFix } from '../domain/gps';
import type { AuditEvent, Baseline, DiagEvent, Scenario } from '../domain/types';

const PREF_KEY = 'aoct.prefs';

export interface Prefs { role: string; theme: 'light' | 'dark'; view: '2d' | '3d' | 'gps'; layers: Record<string, boolean>; panel: boolean }
export const defaultPrefs: Prefs = {
  role: 'Control Tower Lead', theme: 'light', view: '2d', panel: true,
  layers: { flights: true, stands: true, milestones: true, tasks: true, staff: true, assets: true, sla: true, weather: true, relations: true },
};

export function loadPrefs(): Prefs {
  try {
    return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') };
  } catch {
    return defaultPrefs;
  }
}
export function savePrefs(p: Prefs) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* small-value store only; ignore quota */ }
}

/** DATA-001/004: seed on first run, reset on schema/seed mismatch rather than silently using stale data. */
export async function loadBaseline(): Promise<{ baseline: Baseline; migrated: boolean }> {
  const db = await openDB();
  const p = getProvider();
  const stored = await idbGet<Baseline>(db, 'baseline', 'current');
  const compatible = !!stored && stored.schemaVersion === p.schemaVersion && stored.seedVersion === p.seedVersion;
  // The seed is anchored to the current Changi time, so it is regenerated on every start.
  const baseline = await p.load();
  await idbPut(db, 'baseline', baseline, 'current');
  return { baseline, migrated: !!stored && !compatible };
}

export async function resetPrototype(): Promise<Baseline> {
  const db = await openDB();
  await Promise.all(['baseline', 'scenarios', 'audit', 'diagnostics', 'workflow', 'gps'].map((s) => idbClear(db, s)));
  const baseline = await getProvider().load();
  await idbPut(db, 'baseline', baseline, 'current');
  return baseline;
}

export const loadScenarios = async () => idbGetAll<Scenario>(await openDB(), 'scenarios');
export const saveScenario = async (s: Scenario) => idbPut(await openDB(), 'scenarios', s);
export const removeScenario = async (id: string) => idbDelete(await openDB(), 'scenarios', id);
export const appendAudit = async (e: AuditEvent) => idbPut(await openDB(), 'audit', e);
export const loadAudit = async () => idbGetAll<AuditEvent>(await openDB(), 'audit');
export const appendDiag = async (e: DiagEvent) => idbPut(await openDB(), 'diagnostics', e);
export const loadDiag = async () => idbGetAll<DiagEvent>(await openDB(), 'diagnostics');

export interface WfEntry { id: string; status: string; ownerId?: string; ackAt?: number; actAt?: number }
export const loadWorkflow = async () => idbGetAll<WfEntry>(await openDB(), 'workflow');
export const saveWorkflow = async (e: WfEntry) => idbPut(await openDB(), 'workflow', e);

/** GPS fixes (one per entity every 5 minutes) are persisted for replay and export; the store is reset together with the regenerated seed. */
export const loadGps = async () => idbGetAll<GpsFix>(await openDB(), 'gps');
export const saveGps = async (f: GpsFix[]) => idbPutMany(await openDB(), 'gps', f);
export const clearGps = async () => idbClear(await openDB(), 'gps');
