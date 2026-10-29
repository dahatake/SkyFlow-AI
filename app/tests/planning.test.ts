import { describe, expect, it } from 'vitest';
import { CATEGORIES, DAY, WEEK, buildPlan, conflictIds, usage } from '../src/domain/planning';

describe('resource plan (sample Changi week)', () => {
  const p = buildPlan();
  it('is deterministic and covers every resource category with capacity numbers', () => {
    expect(JSON.stringify(buildPlan())).toBe(JSON.stringify(p));
    CATEGORIES.forEach((c) => expect(p.resources.some((r) => r.category === c)).toBe(true));
    p.resources.forEach((r) => expect(r.capacity).toBeGreaterThan(0));
    expect(p.resources.filter((r) => r.category === 'Gate').length).toBe(24);
  });
  it('keeps every item inside the week and references real resources', () => {
    const ids = new Set(p.resources.map((r) => r.id));
    p.items.forEach((i) => { expect(ids.has(i.resourceId)).toBe(true); expect(i.start).toBeGreaterThanOrEqual(0); expect(i.end).toBeLessThanOrEqual(WEEK); expect(i.end).toBeGreaterThan(i.start); });
  });
  it('flags only the deliberate gate overstay as a conflict', () => {
    const bad = conflictIds(p.resources, p.items);
    expect(bad.size).toBeGreaterThan(0);
    p.items.filter((i) => bad.has(i.id)).forEach((i) => expect(i.resourceId).toBe('gate-T3-2'));
  });
  it('computes bounded utilisation per day', () => {
    p.resources.forEach((r) => { const u = usage(r, p.items.filter((i) => i.resourceId === r.id), 0, DAY); expect(u.utilization).toBeGreaterThanOrEqual(0); expect(u.utilization).toBeLessThanOrEqual(1); });
  });
});
