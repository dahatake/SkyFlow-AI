import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { DEMO_PACK } from '../../../app/src/domain/demo';
import { buildSeed, deepFreeze } from '../../../app/src/domain/seed';
import * as engine from '../src/engine.js';
import { createServer } from '../src/server.js';

const demo = DEMO_PACK[0];
const task = demo.decisions[0];
const real = task.options.find((o) => o.id !== 'none')!;

async function connect() {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(b);
  const c = new Client({ name: 't', version: '0' });
  await c.connect(a);
  return c;
}
const parse = (r: any) => JSON.parse(r.content[0].text);

describe('engine functions', () => {
  it('are deterministic', () => {
    const run = () => JSON.stringify([
      engine.getLiveState(10), engine.getExceptions(10), engine.rankBySla(10), engine.listDecisionTasks(demo.id),
      engine.runScenario(demo.id, { [task.id]: real.id }, 5), engine.compareOptions(demo.id, task.id), engine.runOptimizer('sla', 3), engine.getKpiValue(demo.id, { [task.id]: real.id }),
    ]);
    expect(run()).toBe(run());
  });

  it('never mutates the baseline seed', () => {
    const before = JSON.stringify(deepFreeze(buildSeed()));
    engine.runScenario(demo.id, { [task.id]: real.id }, 20);
    engine.runOptimizer('balanced', 20);
    engine.compareOptions(demo.id, task.id, 20);
    expect(JSON.stringify(engine.baselineAt(0))).toBe(before);
    expect(Object.isFrozen(engine.baselineAt(20))).toBe(true);
  });

  it('chosen engine option lowers the weighted score in KPI output', () => {
    const k = engine.getKpiValue(demo.id, { [task.id]: real.id });
    expect(k.after.weighted).toBeLessThanOrEqual(k.before.weighted);
    expect(k.delta.weighted).toBe(k.after.weighted - k.before.weighted);
  });

  it('compare_options agrees with the engine advice and covers all options', () => {
    const c = engine.compareOptions(demo.id, task.id);
    expect(c.options.map((o) => o.id).sort()).toEqual(task.options.map((o) => o.id).sort());
    expect(task.options.some((o) => o.id === c.advice.optionId)).toBe(true);
  });

  it('rank_by_sla is ordered by severity descending', () => {
    const order = ['Low', 'Medium', 'High', 'Critical'];
    const r = engine.rankBySla(0).ranked;
    for (let i = 1; i < r.length; i++) expect(order.indexOf(r[i - 1].severity)).toBeGreaterThanOrEqual(order.indexOf(r[i].severity));
  });

  it('throws typed errors for unknown ids', () => {
    expect(() => engine.listDecisionTasks('nope')).toThrow(engine.ToolError);
    expect(() => engine.runScenario(demo.id, { [task.id]: 'bogus' })).toThrow(/Unknown optionId/);
    expect(() => engine.runScenario(demo.id, { bogus: 'none' })).toThrow(/Unknown taskId/);
    expect(() => engine.baselineAt(-1)).toThrow(engine.ToolError);
  });
});

describe('MCP surface', () => {
  it('lists all eight tools', async () => {
    const c = await connect();
    const names = (await c.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual(['compare_options', 'get_exceptions', 'get_kpi_value', 'get_live_state', 'list_decision_tasks', 'rank_by_sla', 'run_optimizer', 'run_scenario']);
  });

  it('returns JSON for a valid call', async () => {
    const c = await connect();
    const r = parse(await c.callTool({ name: 'run_scenario', arguments: { demoId: demo.id, decisions: { [task.id]: real.id } } }));
    expect(r.score.weighted).toBeTypeOf('number');
    expect(r.decisions[task.id]).toBe(real.id);
  });

  it('returns an error result (not a crash) for unknown ids', async () => {
    const c = await connect();
    const r: any = await c.callTool({ name: 'compare_options', arguments: { demoId: 'nope', taskId: 'x' } });
    expect(r.isError).toBe(true);
    expect(parse(r).error.code).toBe('unknown_demo');
    const r2: any = await c.callTool({ name: 'run_scenario', arguments: { demoId: demo.id, decisions: { [task.id]: 'bogus' } } });
    expect(r2.isError).toBe(true);
    expect(parse(r2).error.validOptionIds).toContain('none');
  });

  it('rejects schema violations', async () => {
    const c = await connect();
    const bad = await c.callTool({ name: 'get_live_state', arguments: { tick: 'abc' } }).then((r: any) => r.isError === true, () => true);
    expect(bad).toBe(true);
    const bad2 = await c.callTool({ name: 'get_exceptions', arguments: { tick: 0, severity: 'Urgent' } }).then((r: any) => r.isError === true, () => true);
    expect(bad2).toBe(true);
    const bad3 = await c.callTool({ name: 'run_optimizer', arguments: { preset: 'nope' } }).then((r: any) => r.isError === true, () => true);
    expect(bad3).toBe(true);
  });
});
