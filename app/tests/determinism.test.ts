import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { freezeClock, makeId, now, resetIdCounter, setClock } from '../src/domain/clock';
import { buildSeed, deepFreeze, changiClock, changiMinutes } from '../src/domain/seed';
import { computeImpact, defaultScenario, validateParams } from '../src/domain/scenario';
import { OpsView, noFilters } from '../src/domain/view';
import { DEMO_PACK, activeMitigations } from '../src/domain/demo';
import { advise, evaluate } from '../src/domain/judgement';
import { optimize, defaultConfig } from '../src/domain/optimizer';
import { actionRows, slaKpis } from '../src/domain/kpi';
import { currentWeek } from '../src/domain/planning';
import { applyLive } from '../src/domain/live';

const mk = () => deepFreeze(buildSeed());

describe('clock', () => {
  it('is frozen by the test setup and drives ids, Changi time and planning week', () => {
    const t = now();
    expect(t).toBe(new Date('2027-01-11T08:00:00+08:00').getTime());
    resetIdCounter();
    expect(makeId('sc')).toBe(makeId('sc').replace(/-\d+$/, '-0'));
    expect(changiClock()).toBe('08:00:00');
    expect(changiMinutes()).toBe(480);
    expect(currentWeek()).toEqual(currentWeek(t));
  });
  it('rejects invalid values and can be reset', () => {
    expect(() => freezeClock('nonsense')).toThrow();
    setClock(() => 5);
    expect(now()).toBe(5);
    freezeClock('2027-01-11T08:00:00+08:00');
  });
});

describe('reproducibility (golden)', () => {
  it('seed, optimizer and Copilot advice are identical across runs', () => {
    const a = mk(), b = mk();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const view = (x: typeof a) => new OpsView(x, 'baseline', undefined, noFilters, null);
    expect(JSON.stringify(optimize(view(a), defaultConfig(), a.now))).toBe(JSON.stringify(optimize(view(b), defaultConfig(), b.now)));
    for (const d of DEMO_PACK) {
      const sc: any = { ...d.scenario, state: 'Active', createdAt: 0, decisions: {} };
      for (const t of d.decisions) {
        expect(advise(a, sc, d.decisions, t).optionId).toBe(advise(b, sc, d.decisions, t).optionId);
      }
    }
  });
  it('pins the demo advice so regressions are visible', () => {
    const b = mk();
    const picks = DEMO_PACK.flatMap((d) => {
      const sc: any = { ...d.scenario, state: 'Active', createdAt: 0, decisions: {} };
      return d.decisions.map((t) => `${d.id}/${t.id}=${advise(b, sc, d.decisions, t).optionId}`);
    });
    expect(picks.length).toBeGreaterThan(5);
    expect(picks).toMatchSnapshot();
  });
});

describe('invariants (property based)', () => {
  const sevs = ['Low', 'Med', 'High'] as const;
  it('baseline is never mutated and impacts stay bounded for any valid scenario', () => {
    const b = mk();
    const snap = JSON.stringify(b);
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 180 }), fc.integer({ min: 0, max: 120 }), fc.constantFrom(...sevs), fc.integer({ min: 0, max: 240 }),
      (dur, buf, sev, delay) => {
        const sc = {
          ...defaultScenario(),
          params: {
            weather: { startOffsetMin: 0, durationMin: dur, piers: ['A'], severity: sev, recoveryBufferMin: buf },
            lateInbound: { flightId: b.flights[0].id, delayMin: delay, standId: b.flights[0].standId, sensitivity: 'Med' as const },
          },
        };
        const errs = validateParams(sc.params, b);
        if (errs.length) return true;
        const im = computeImpact(b, sc);
        return JSON.stringify(b) === snap && Object.values(im.flightDelay).every((v) => v >= 0);
      },
    ), { numRuns: 60 });
    expect(JSON.stringify(b)).toBe(snap);
  });
  it('out-of-range input is always rejected', () => {
    const b = mk();
    fc.assert(fc.property(fc.integer({ min: 181, max: 5000 }), (dur) =>
      validateParams({ weather: { startOffsetMin: 0, durationMin: dur, piers: ['A'], severity: 'High', recoveryBufferMin: 0 } }, b).length > 0), { numRuns: 40 });
  });
  it('live ticks are pure functions of (seed, tick)', () => {
    const b = mk();
    fc.assert(fc.property(fc.integer({ min: 0, max: 240 }), (t) => JSON.stringify(applyLive(b, t)) === JSON.stringify(applyLive(b, t))), { numRuns: 25 });
  });
});

describe('judgement scoring', () => {
  it('evaluate with no decisions scores >= every advised option', () => {
    const b = mk();
    for (const d of DEMO_PACK) {
      const sc: any = { ...d.scenario, state: 'Active', createdAt: 0, decisions: {} };
      const none = evaluate(b, sc, Object.fromEntries(d.decisions.map((t) => [t.id, 'none'])));
      for (const t of d.decisions) {
        const adv = advise(b, sc, d.decisions, t);
        expect(adv.rationale.length).toBeGreaterThan(0);
        expect(adv.scores[adv.optionId].weighted).toBeLessThanOrEqual(none.weighted);
      }
    }
  });
  it('mitigations are empty without decisions', () => {
    const sc: any = { ...DEMO_PACK[0].scenario, state: 'Active', createdAt: 0, decisions: {} };
    expect(activeMitigations(sc)).toEqual([]);
    expect(activeMitigations(null)).toEqual([]);
  });
});

describe('SLA KPIs', () => {
  it('are derived deterministically and counts add up', () => {
    const b = mk();
    const v = new OpsView(b, 'baseline', undefined, noFilters, null);
    const rows = actionRows(v);
    expect(JSON.stringify(rows)).toBe(JSON.stringify(actionRows(v)));
    expect(rows.length).toBe(b.exceptions.length);
    const k = slaKpis(rows);
    expect(k.length).toBeGreaterThan(0);
    for (const x of k) {
      expect(x.met + x.breached + x.pending).toBeLessThanOrEqual(rows.length);
      if (x.pct !== null) { expect(x.pct).toBeGreaterThanOrEqual(0); expect(x.pct).toBeLessThanOrEqual(100); }
    }
  });
});
