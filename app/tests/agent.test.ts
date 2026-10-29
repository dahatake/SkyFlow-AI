import { afterEach, describe, expect, it, vi } from 'vitest';
import { localProposal } from '../src/agent/client';
import { DEMO_PACK } from '../src/domain/demo';
import { advise } from '../src/domain/judgement';
import { buildSeed, deepFreeze } from '../src/domain/seed';
import type { Scenario } from '../src/domain/types';

afterEach(() => vi.unstubAllGlobals());

describe('local rule-based proposals', () => {
  for (const pack of DEMO_PACK) {
    it(`${pack.id}: produces grounded, deterministic proposals without I/O or mutation`, () => {
      const fetch = vi.fn(() => { throw new Error('Network is forbidden in the demo'); });
      vi.stubGlobal('fetch', fetch);
      const baseline = deepFreeze(buildSeed());
      const scenario: Scenario = { ...pack.scenario, createdAt: baseline.now, state: 'Active', decisions: {} };
      const before = JSON.stringify({ baseline, scenario });
      const proposal = localProposal(baseline, scenario, pack.id, 'test-proposal');
      expect(proposal).toEqual(localProposal(baseline, scenario, pack.id, 'test-proposal'));
      expect(proposal).toMatchObject({ status: 'Proposed', mode: 'rules', fallbackUsed: false, source: 'local' });
      expect(proposal.items).toHaveLength(pack.decisions.length);
      expect(proposal.steps.map((s) => s.agent)).toEqual(['Detect', 'Triage', 'Resolver', 'Comms']);
      for (const item of proposal.items) {
        const task = pack.decisions.find((t) => t.id === item.taskId)!;
        const advice = advise(baseline, scenario, pack.decisions, task);
        expect(task.options.some((o) => o.id === item.optionId)).toBe(true);
        expect(item.optionId).toBe(advice.optionId);
        expect(item.kpiDelta?.weighted).toBe(advice.scores[item.optionId].weighted - advice.scores.none.weighted);
      }
      expect(JSON.stringify({ baseline, scenario })).toBe(before);
      expect(fetch).not.toHaveBeenCalled();
    });
  }

  it('reports an unknown scenario explicitly', () => {
    const baseline = buildSeed();
    const scenario: Scenario = { ...DEMO_PACK[0].scenario, createdAt: baseline.now, state: 'Active' };
    expect(() => localProposal(baseline, scenario, 'missing-demo', 'test')).toThrow('Unknown demo missing-demo');
  });
});
