import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { computeImpact, defaultScenario, validateParams } from '../src/domain/scenario';
import { buildSeed, deepFreeze } from '../src/domain/seed';
import { OpsView, noFilters } from '../src/domain/view';
import * as repo from '../src/storage/repo';
import { DEMO_PACK } from '../src/domain/demo';
import { getProvider } from '../src/data/provider';
import { activeMitigations } from '../src/domain/demo';
import { advise, evaluate, scoreImpact } from '../src/domain/judgement';
import { applyLive, diffLive } from '../src/domain/live';
import { deriveTasks } from '../src/domain/tasks';

const mk = () => deepFreeze(buildSeed());

describe('scenario engine', () => {
  it('AT-03: late inbound 45 min updates risk without mutating baseline', () => {
    const b = mk();
    const before = JSON.stringify(b);
    const sc = { ...defaultScenario(), params: { lateInbound: { flightId: 'fl-2', delayMin: 45, standId: b.flights[1].standId, sensitivity: 'Med' as const } } };
    expect(validateParams(sc.params, b)).toEqual([]);
    const im = computeImpact(b, sc);
    expect(im.flightDelay['fl-2']).toBe(45);
    expect(im.turnaroundRisk['ta-2']).toBe('AtRisk');
    expect(JSON.stringify(b)).toBe(before);
  });

  it('AT-04: invalid duration / quantity are rejected', () => {
    const b = mk();
    expect(validateParams({ weather: { startOffsetMin: 0, durationMin: 999, piers: ['A'], severity: 'High', recoveryBufferMin: 0 } }, b)[0]).toMatch(/duration/);
    expect(validateParams({ gse: { assetType: 'Fuel Truck', quantityUnavailable: 99, pier: 'A', durationMin: 10 } }, b).length).toBeGreaterThan(0);
    expect(validateParams({}, b).length).toBe(1);
  });

  it('covers every simulator case and baseline view ignores overlay', () => {
    const b = mk();
    const sc = {
      ...defaultScenario(),
      params: {
        weather: { startOffsetMin: 0, durationMin: 60, piers: ['A', 'B'], severity: 'High' as const, recoveryBufferMin: 10 },
        gse: { assetType: 'Fuel Truck', quantityUnavailable: 1, pier: 'A', durationMin: 60 },
        staff: { buId: 'bu-bag', capacityDeltaPct: 60, windowMin: 240 },
        slaStress: { airlineId: 'al-sq', milestoneType: 'Boarding', thresholdDeltaMin: 40, windowMin: 240 },
      },
    };
    expect(validateParams(sc.params, b)).toEqual([]);
    const im = computeImpact(b, sc);
    expect(im.impactedIds.length).toBeGreaterThan(0);
    expect(im.constraints.length).toBe(2);
    const base = new OpsView(b, 'baseline', im, noFilters, null);
    expect(base.simulated).toBe(false);
    expect(new OpsView(b, 'scenario', im, noFilters, null).simulated).toBe(true);
  });

  it('seed covers all risk states', () => {
    const b = mk();
    expect(new Set(b.turnarounds.map((t) => t.slaRisk)).size).toBe(4);
    expect(new Set(b.assets.map((a) => a.status)).size).toBe(5);
    expect(b.exceptions.some((e) => !e.ownerId)).toBe(true);
    expect(() => { (b.flights[0] as { status: string }).status = 'x'; }).toThrow();
  });
});

describe('decisions', () => {
  it('Copilot picks reduce the weighted score and never mutate baseline', () => {
    const b = mk();
    const before = JSON.stringify(b);
    for (const d of DEMO_PACK) {
      const sc: any = { ...d.scenario, state: 'Active', createdAt: 0, decisions: {} };
      const none = evaluate(b, sc, Object.fromEntries(d.decisions.map((t) => [t.id, 'none'])));
      d.decisions.forEach((t) => { sc.decisions[t.id] = { optionId: advise(b, sc, d.decisions, t).optionId, by: 'copilot', at: 0 }; });
      const after = scoreImpact(b, computeImpact(b, sc, activeMitigations(sc)));
      expect(after.weighted).toBeLessThan(none.weighted);
    }
    expect(JSON.stringify(b)).toBe(before);
  });
  it('re-gating moves flights in the overlay only', () => {
    const b = mk();
    const w = DEMO_PACK[0];
    const sc: any = { ...w.scenario, state: 'Active', createdAt: 0, decisions: { 'wx-gate': { optionId: 'regate-c', by: 'human', at: 0 } } };
    const im = computeImpact(b, sc, activeMitigations(sc));
    const ids = Object.keys(im.standOverride);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => im.standOverride[id].startsWith('C') && im.standOverride[id] !== 'C6')).toBe(true);
    expect(b.flights.find((f) => f.id === ids[0])!.standId).not.toBe(im.standOverride[ids[0]]);
  });
  it('redeploying staff shifts pressure to the donor BU', () => {
    const b = mk();
    const n = DEMO_PACK[2];
    const sc: any = { ...n.scenario, state: 'Active', createdAt: 0, decisions: { 'ns-source': { optionId: 'redeploy', by: 'human', at: 0 } } };
    const im = computeImpact(b, sc, activeMitigations(sc));
    expect(Object.keys(im.capacityPressure).some((k) => k.includes('bu-bag') && im.capacityPressure[k] > 1)).toBe(true);
  });
});

describe('workflow and role layouts', () => {
  it('workflow overlay changes status and owner without touching baseline', () => {
    const b = mk();
    const before = JSON.stringify(b);
    const e = b.exceptions[0];
    const v = new OpsView(b, 'baseline', undefined, noFilters, null, null, { [e.id]: { status: 'Resolved', ownerId: 'u-lead' } });
    expect(v.statusOf(e)).toBe('Resolved');
    expect(v.ownerIdOf(e)).toBe('u-lead');
    expect(v.exceptions.some((x) => x.id === e.id)).toBe(false);
    expect(JSON.stringify(b)).toBe(before);
  });
  it('every role has a layout and the map is not first for the Control Tower Lead', async () => {
    const { ROLE_META } = await import('../src/components/roles');
    const { ROLES } = await import('../src/domain/types');
    ROLES.forEach((r) => expect(ROLE_META[r].layout.length).toBeGreaterThan(3));
    expect(ROLE_META['Control Tower Lead'].layout[0].id).toBe('workflow');
    expect(ROLE_META['Control Tower Lead'].layout.find((p) => p.id === 'viz')!.secondary).toBe(true);
    expect(ROLE_META['Ramp Lead'].layout[0].id).toBe('viz');
  }, 30000);
});

describe('live feed and task list', () => {
  it('tick 0 is the seed; later ticks are deterministic, evolve data and never mutate the seed', () => {
    const b = mk();
    const before = JSON.stringify(b);
    expect(applyLive(b, 0)).toBe(b);
    const a = applyLive(b, 20), c = applyLive(b, 20);
    expect(JSON.stringify(a)).toBe(JSON.stringify(c));
    expect(a.now).toBe(b.now + 20);
    expect(a.flights.map((f) => f.status).join()).not.toBe(b.flights.map((f) => f.status).join());
    expect(a.tasks.filter((t) => t.status === 'Complete').length).toBeGreaterThan(b.tasks.filter((t) => t.status === 'Complete').length);
    expect(a.exceptions.length).toBeGreaterThan(b.exceptions.length);
    expect(diffLive(applyLive(b, 5), applyLive(b, 6)).length + diffLive(applyLive(b, 19), a).length).toBeGreaterThan(0);
    expect(JSON.stringify(b)).toBe(before);
  });
  it('decisions create 5W2H tasks with times anchored to the decision', () => {
    const b = mk();
    const d = DEMO_PACK[2];
    const sc: any = { ...d.scenario, state: 'Active', createdAt: 0, decisions: { 'ns-source': { optionId: 'standby', by: 'human', at: 0, opsAt: 490 } }, taskStatus: { 'ns-source:standby:0': 'Doing' } };
    const tasks = deriveTasks(sc, b.now);
    expect(tasks.length).toBe(3);
    tasks.forEach((t) => { ['what', 'why', 'who', 'where', 'how', 'howMuch'].forEach((k) => expect((t as any)[k]).toBeTruthy()); expect(t.when.start).toBeGreaterThanOrEqual(490); });
    expect(tasks.find((t) => t.id === 'ns-source:standby:0')!.progress).toBe(50);
    expect(deriveTasks({ ...sc, decisions: {} }, b.now)).toEqual([]);
  });
});

describe('provider and time position', () => {
  it('seed provider supplies the baseline through the interface', async () => {
    const p = getProvider();
    expect(p.id).toBe('seed');
    expect((await p.load()).seedVersion).toBe(p.seedVersion);
  });
  it('time position filters flights on stand; live shows all', () => {
    const b = mk();
    const live = new OpsView(b, 'baseline', undefined, noFilters, null, null).flights.length;
    const at = new OpsView(b, 'baseline', undefined, noFilters, null, b.now + 120).flights;
    expect(live).toBe(24);
    expect(at.length).toBeLessThan(live);
    expect(at.every((f) => f.sta <= b.now + 120 && b.now + 120 <= f.std)).toBe(true);
  });
});

describe('persistence', () => {
  it('demo pack scenarios validate and impact the baseline', () => {
    const b = mk();
    for (const d of DEMO_PACK) {
      const sc = { ...d.scenario, state: 'Active' as const, createdAt: 0 };
      expect(validateParams(sc.params, b)).toEqual([]);
      expect(computeImpact(b, sc).impactedIds.length).toBeGreaterThan(2);
    }
  });

  it('AT-07: deleting a scenario leaves baseline intact; reset restores seed', async () => {
    const { baseline } = await repo.loadBaseline();
    const sc = { ...defaultScenario(), id: 'sc-test' };
    await repo.saveScenario(sc);
    expect((await repo.loadScenarios()).length).toBe(1);
    await repo.removeScenario('sc-test');
    expect((await repo.loadBaseline()).baseline).toEqual(baseline);
    await repo.saveScenario(sc);
    await repo.resetPrototype();
    expect(await repo.loadScenarios()).toEqual([]);
  });
});
