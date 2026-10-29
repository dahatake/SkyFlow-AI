import { describe, it, expect } from 'vitest';
import { buildPlan, jobMix } from '../src/domain/planning';

describe('planning staff roster', () => {
  it('splits head count over jobs without losing anyone', () => {
    for (const fn of ['Ramp', 'Baggage', 'Cabin', 'Fuel', 'Pushback', 'Control', 'Check-in', 'Gate', 'Technical']) {
      for (const hc of [1, 7, 34]) expect(jobMix(fn, hc).reduce((s, [, n]) => s + n, 0)).toBe(hc);
    }
  });

  it('generates a deterministic named roster for every staff team', () => {
    const a = buildPlan(), b = buildPlan();
    expect(a.staff.length).toBeGreaterThan(300);
    expect(a.staff).toEqual(b.staff);
    const teams = a.resources.filter((r) => r.category === 'Staff');
    teams.forEach((t) => expect(a.staff.filter((p) => p.teamId === t.id)).toHaveLength(t.capacity));
  });
});
