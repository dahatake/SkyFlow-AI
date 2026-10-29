import { useEffect, useMemo, useRef, useState } from 'react';
import type { Baseline } from '../domain/types';
import { FIX_MINUTES, entitiesOf, fixesFor, slotOf, slotsBetween, type GpsEntity, type GpsFix } from '../domain/gps';
import * as repo from './repo';

export interface GpsState { entities: GpsEntity[]; history: Map<string, GpsFix[]>; latestSlot: number; count: number }
const HISTORY_MIN = 180;

/**
 * Collects a GPS fix per tracked entity every 5 operational minutes and stores it in IndexedDB.
 * Because the seed is regenerated at every start, the stored track is reset with it and back-filled with the last 3 hours.
 */
export function useGpsTracker(seed: Baseline | null, baseline: Baseline | null): GpsState {
  const store = useRef<{ seed: Baseline | null; history: Map<string, GpsFix[]>; last: number }>({ seed: null, history: new Map(), last: -1 });
  const [version, setVersion] = useState(0);
  const entities = useMemo(() => (baseline ? entitiesOf(baseline) : []), [seed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!seed || !baseline) return;
    const s = store.current;
    let from: number;
    if (s.seed !== seed) {
      s.seed = seed; s.history = new Map(); s.last = -1;
      void repo.clearGps().catch(() => undefined);
      from = baseline.now - HISTORY_MIN;
    } else from = s.last + FIX_MINUTES;
    const to = slotOf(baseline.now);
    if (from > to) return;
    const fresh = fixesFor(baseline, entities, slotsBetween(from, to));
    fresh.forEach((f) => { const l = s.history.get(f.entityId) ?? []; l.push(f); s.history.set(f.entityId, l); });
    s.last = to;
    void repo.saveGps(fresh).catch(() => undefined);
    setVersion((v) => v + 1);
  }, [seed, baseline, entities]);

  return useMemo(() => ({ entities, history: store.current.history, latestSlot: store.current.last, count: [...store.current.history.values()].reduce((n, l) => n + l.length, 0) }), [entities, version]); // eslint-disable-line react-hooks/exhaustive-deps
}
