import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buildSeed } from '../src/domain/seed';
import { FIX_MINUTES, entitiesOf, fixAt, fixesFor, slotsBetween } from '../src/domain/gps';
import { WORLD } from '../src/domain/airportMap';
import * as repo from '../src/storage/repo';
import { setLang, tr } from '../src/i18n';
import { trData } from '../src/i18n/data';

const b = buildSeed();
const ents = entitiesOf(b);
const slots = slotsBetween(b.now - 180, b.now);

describe('GPS tracking', () => {
  it('tracks aircraft, vehicles and people with 5-minute slots', () => {
    (['aircraft', 'gse', 'staff'] as const).forEach((k) => expect(ents.some((e) => e.kind === k)).toBe(true));
    slots.forEach((t, i) => { expect(t % FIX_MINUTES).toBe(0); if (i) expect(t - slots[i - 1]).toBe(FIX_MINUTES); });
  });
  it('produces deterministic fixes inside the map with lat/lon, level and accuracy', () => {
    const a = fixesFor(b, ents, slots), c = fixesFor(b, ents, slots);
    expect(JSON.stringify(a)).toBe(JSON.stringify(c));
    expect(a.length).toBeGreaterThan(ents.length);
    a.forEach((f) => { expect(f.x).toBeGreaterThanOrEqual(0); expect(f.x).toBeLessThanOrEqual(WORLD.w); expect(f.lat).toBeGreaterThan(1.3); expect(f.lat).toBeLessThan(1.4); expect(f.lon).toBeGreaterThan(103.9); expect(f.accuracyM).toBeGreaterThan(0); });
    expect(new Set(a.map((f) => f.level)).size).toBeGreaterThanOrEqual(3);
  });
  it('moves aircraft between slots and parks them at the stand while on block', () => {
    const f = b.flights.find((x) => x.status === 'Turnaround')!;
    const e = ents.find((x) => x.refId === f.id)!;
    const onBlock = fixAt(b, e, Math.floor((f.sta + f.etd) / 2 / 5) * 5);
    expect(onBlock?.state).toBe('At stand');
    const t0 = fixAt(b, e, Math.floor((f.sta - 20) / 5) * 5), t1 = fixAt(b, e, Math.floor((f.sta - 10) / 5) * 5);
    expect(t0 && t1 && (t0.x !== t1.x || t0.y !== t1.y)).toBe(true);
  });
  it('stores and reloads fixes in IndexedDB', async () => {
    const fx = fixesFor(b, ents, slots.slice(-3));
    await repo.clearGps(); await repo.saveGps(fx);
    expect((await repo.loadGps()).length).toBe(fx.length);
    await repo.clearGps();
    expect((await repo.loadGps()).length).toBe(0);
  });
  it('translates generated status text', () => {
    setLang('ja');
    expect(trData('Servicing SQ123')).not.toBe('Servicing SQ123');
    expect(tr('Zoom in')).not.toBe('Zoom in');
    setLang('en');
  });
});
