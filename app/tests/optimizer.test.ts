import { describe, expect, it } from 'vitest';
import { buildSeed, deepFreeze } from '../src/domain/seed';
import { OpsView, noFilters } from '../src/domain/view';
import { PRESETS, defaultConfig, optimize, overlayPlan } from '../src/domain/optimizer';

const mk = () => deepFreeze(buildSeed());
const viewOf = (b: ReturnType<typeof mk>) => new OpsView(b, 'baseline', undefined, noFilters, null);

describe('resource optimizer', () => {
  it('is deterministic, non-destructive and never worsens measured conflicts', () => {
    const b = mk();
    const before = JSON.stringify(b);
    const a = optimize(viewOf(b), defaultConfig(), b.now);
    const c = optimize(viewOf(b), defaultConfig(), b.now);
    expect(JSON.stringify(a)).toBe(JSON.stringify(c));
    expect(JSON.stringify(b)).toBe(before);
    expect(a.after.standConflicts).toBeLessThanOrEqual(a.before.standConflicts);
    expect(a.after.gseUnassigned).toBeLessThanOrEqual(a.before.gseUnassigned);
  });

  it('respects hard limits: no double-booked GSE, no closed stand, GSE distance cap', () => {
    const b = mk();
    const cfg = defaultConfig();
    const p = optimize(viewOf(b), cfg, b.now);
    p.gse.forEach((g) => expect(g.distance).toBeLessThanOrEqual(cfg.limits.maxGseDistance));
    const byAsset = new Map<string, [number, number][]>();
    p.gse.forEach((g) => byAsset.set(g.assetId, [...(byAsset.get(g.assetId) ?? []), [g.start, g.end]]));
    byAsset.forEach((l) => l.forEach(([s, e], i) => l.forEach(([s2, e2], j) => { if (i !== j) expect(s < e2 && s2 < e).toBe(false); })));
    p.standMoves.forEach((m) => expect(b.constraints.some((c) => c.scope === m.to && /Closure/i.test(c.type))).toBe(false));
  });

  it('a tighter distance limit leaves more work for humans', () => {
    const b = mk();
    const loose = optimize(viewOf(b), defaultConfig(), b.now);
    const tight = defaultConfig();
    tight.limits.maxGseDistance = 10;
    const t = optimize(viewOf(b), tight, b.now);
    expect(t.gse.length).toBeLessThanOrEqual(loose.gse.length);
    if (t.gse.length < loose.gse.length) expect(t.unresolved.some((u) => u.kind === 'gse')).toBe(true);
  });

  it('priority presets change the ranking inputs', () => {
    const b = mk();
    const sla = optimize(viewOf(b), { ...defaultConfig(), weights: PRESETS.sla.weights }, b.now);
    const speed = optimize(viewOf(b), { ...defaultConfig(), weights: PRESETS.speed.weights }, b.now);
    expect(sla.priorityOrder.length).toBeGreaterThan(0);
    expect(JSON.stringify(sla.priorityOrder)).not.toBe(JSON.stringify(speed.priorityOrder));
  });

  it('applying a plan overlays stand moves without touching baseline', () => {
    const b = mk();
    const before = JSON.stringify(b);
    const p = optimize(viewOf(b), defaultConfig(), b.now);
    const im = overlayPlan(undefined, p, b);
    const v = new OpsView(b, 'scenario', im, noFilters, null);
    p.standMoves.forEach((m) => expect(v.standOf(b.flights.find((f) => f.id === m.flightId)!)).toBe(m.to));
    expect(JSON.stringify(b)).toBe(before);
  });
});