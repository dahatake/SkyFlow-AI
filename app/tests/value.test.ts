import { describe, expect, it } from 'vitest';
import { buildSeed, deepFreeze } from '../src/domain/seed';
import { DEMO_PACK } from '../src/domain/demo';
import { valueReport } from '../src/domain/value';
import { CUSTOMERS, activeCustomer } from '../src/customers';
import { validateCustomer } from '../src/customers/schema';

describe('customers', () => {
  it('every bundled customer file is valid', () => {
    Object.values(CUSTOMERS).forEach((c) => expect(validateCustomer(c)).toEqual([]));
    expect(Object.keys(CUSTOMERS).length).toBeGreaterThanOrEqual(2);
    expect(activeCustomer().id).toBe('sats-changi');
  });
  it('rejects bad input with actionable messages', () => {
    const c = structuredClone(CUSTOMERS['sats-changi']) as any;
    c.airport.timezone = 'Mars/Base'; c.assumptions.agentResponseMinutes = 99; delete c.assumptions.source; c.deck.mvpScopeDate = '13 Nov';
    const e = validateCustomer(c).join('|');
    expect(e).toMatch(/timezone/); expect(e).toMatch(/must not exceed/); expect(e).toMatch(/source/); expect(e).toMatch(/deck/);
    expect(validateCustomer(null)).toEqual(['customer must be an object']);
  });
});

describe('value model', () => {
  it('is deterministic, never negative and shows improvement for the anchor scenario', () => {
    const b = deepFreeze(buildSeed());
    const c = CUSTOMERS['sats-changi'];
    for (const p of DEMO_PACK) {
      const a = valueReport(b, p, c.assumptions, c.currency), z = valueReport(b, p, c.assumptions, c.currency);
      expect(JSON.stringify(a)).toBe(JSON.stringify(z));
      expect(a.savingPerEvent).toBeGreaterThanOrEqual(0);
      a.rows.forEach((r) => expect(r.after).toBeLessThanOrEqual(r.before));
      expect(a.basis).toMatch(/Simulated/);
    }
    const w = valueReport(b, DEMO_PACK[0], c.assumptions, c.currency);
    expect(w.rows.some((r) => r.delta > 0)).toBe(true);
    expect(w.savingPerMonth).toBe(w.savingPerEvent * c.assumptions.disruptionsPerMonth);
  });
});


describe('demo script numbers (docs/DEMO-SCRIPT.md)', () => {
  it('match the documented savings per event for the SATS assumptions', () => {
    const b = deepFreeze(buildSeed());
    const c = CUSTOMERS['sats-changi'];
    const saving = DEMO_PACK.map((p) => valueReport(b, p, c.assumptions, c.currency).savingPerEvent);
    expect(saving).toEqual([1680, 3100, 3600]);
  });
});
