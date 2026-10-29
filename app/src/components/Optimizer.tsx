import { useMemo, useState } from 'react';
import { Flash24Regular, ArrowReset24Regular } from '@fluentui/react-icons';
import { useOps } from '../storage/store';
import { fmt } from '../domain/seed';
import { PRESETS, defaultConfig, optimize, type OptConfig, type OptMetrics, type OptPlan, type OptWeights, type PresetId } from '../domain/optimizer';
import { Tag } from './ui';

const WEIGHTS: [keyof OptWeights, string, string][] = [
  ['sla', 'SLA / airline priority', 'Protect at-risk turnarounds and premium airlines'],
  ['distance', 'Location distance', 'Shorter equipment travel and stand proximity'],
  ['time', 'Time criticality', 'Soonest departures first, avoid buffer breaches'],
  ['resource', 'Resource limitation', 'Fewer moves, even crew / equipment load'],
];

const METRICS: [keyof OptMetrics, string][] = [
  ['standConflicts', 'Stand overlaps (incl. buffer)'], ['gseUnassigned', 'GSE tasks without equipment'], ['gseTravel', 'GSE travel (map units)'],
  ['overloadedPools', 'Overloaded crew pools'], ['seatOverruns', 'Crew-seat overruns'], ['weightedScore', 'Weighted cost (lower is better)'],
];

/** One-click resource optimizer: re-plans stands, GSE, crew pools and crew seats by weighted priorities and hard limits. */
export function Optimizer() {
  const { baseView: view, baseline, logAudit, role, appliedPlan, applyPlan } = useOps();
  const [preset, setPreset] = useState<PresetId>('balanced');
  const [cfg, setCfg] = useState<OptConfig>(defaultConfig());
  const [plan, setPlan] = useState<OptPlan | null>(null);
  const [running, setRunning] = useState(false);
  const now = baseline.now;
  const bu = useMemo(() => new Map(baseline.bus.map((x) => [x.id, x.name])), [baseline]);

  const run = () => {
    setRunning(true);
    // Yield one frame so the button state paints before the (synchronous) heuristic runs.
    requestAnimationFrame(() => {
      const p = optimize(view, cfg, now);
      setPlan(p);
      setRunning(false);
      logAudit(role, `optimize-all (${PRESETS[preset].label}): ${p.standMoves.length} stand, ${p.gse.length} GSE, ${p.staff.length} crew, ${p.shifts.length} shifts`);
    });
  };
  const choose = (id: PresetId) => { setPreset(id); setCfg((c) => ({ ...c, weights: { ...PRESETS[id].weights } })); setPlan(null); };
  const setW = (k: keyof OptWeights, v: number) => { setCfg((c) => ({ ...c, weights: { ...c.weights, [k]: v } })); setPlan(null); };
  const setL = (k: keyof OptConfig['limits'], v: number) => { setCfg((c) => ({ ...c, limits: { ...c.limits, [k]: v } })); setPlan(null); };

  return (
    <section className="card optimizer" aria-label="Resource optimizer">
      <h2><Flash24Regular /> Optimize all resources <Tag simulated /></h2>
      <p className="muted">Recommends stand, equipment and crew changes in one click. Weighted priorities decide trade-offs; limits are never broken. Recommendation only: no write-back to operations.</p>

      <div className="row" role="group" aria-label="Priority preset">
        {(Object.keys(PRESETS) as PresetId[]).map((id) => (
          <button key={id} className={`demo-card ${preset === id ? 'on' : ''}`} aria-pressed={preset === id} onClick={() => choose(id)}>
            <span><strong>{PRESETS[id].label}</strong><small>{PRESETS[id].blurb}</small></span>
          </button>
        ))}
      </div>

      <div className="opt-grid">
        <fieldset><legend>Priorities (0 – 10)</legend>
          {WEIGHTS.map(([k, label, hint]) => (
            <label key={k} title={hint}>{label}: <b>{cfg.weights[k]}</b>
              <input type="range" min={0} max={10} value={cfg.weights[k]} onChange={(e) => setW(k, Number(e.target.value))} />
            </label>
          ))}
        </fieldset>
        <fieldset><legend>Limits</legend>
          <label>Planning horizon (min) <input type="number" min={30} max={480} step={15} value={cfg.limits.horizonMin} onChange={(e) => setL('horizonMin', clamp(+e.target.value, 30, 480))} /></label>
          <label>Stand turnaround buffer (min) <input type="number" min={0} max={60} value={cfg.limits.standBufferMin} onChange={(e) => setL('standBufferMin', clamp(+e.target.value, 0, 60))} /></label>
          <label>Max GSE travel (map units) <input type="number" min={10} max={200} step={5} value={cfg.limits.maxGseDistance} onChange={(e) => setL('maxGseDistance', clamp(+e.target.value, 10, 200))} /></label>
          <label>Crew seats per stand <input type="number" min={1} max={12} value={cfg.limits.seatsPerStand} onChange={(e) => setL('seatsPerStand', clamp(+e.target.value, 1, 12))} /></label>
        </fieldset>
      </div>

      <div className="row">
        <button className="primary opt-go" onClick={run} disabled={running}><Flash24Regular /> {running ? 'Optimizing…' : 'Optimize all'}</button>
        {plan && <button onClick={() => { applyPlan(plan); logAudit(role, 'optimize-apply'); }} disabled={appliedPlan === plan}>Apply to all views</button>}
        {appliedPlan && <button onClick={() => { applyPlan(null); logAudit(role, 'optimize-revert'); }}><ArrowReset24Regular /> Revert applied plan</button>}
        {plan && <button onClick={() => setPlan(null)}>Clear plan</button>}
        {plan && <small className="muted">Planned at {fmt(plan.generatedAt)} · {plan.flightsConsidered} flights · {plan.tasksConsidered} equipment tasks</small>}
      </div>

      {plan && (
        <div role="region" aria-label="Optimization result" aria-live="polite">
          <h3>Before → after</h3>
          <table><thead><tr><th>Measure</th><th>Before</th><th>After</th></tr></thead><tbody>
            {METRICS.map(([k, l]) => <tr key={k}><td>{l}</td><td>{plan.before[k]}</td><td><b>{plan.after[k]}</b> {plan.after[k] < plan.before[k] ? '▼' : plan.after[k] > plan.before[k] ? '▲' : ''}</td></tr>)}
          </tbody></table>
          <p className="muted">Highest priority: {plan.priorityOrder.map((p) => `${p.flightNo} (${p.score})`).join(', ') || 'none'}</p>

          <h3>Stand moves ({plan.standMoves.length})</h3>
          {plan.standMoves.length ? <table><tbody>{plan.standMoves.map((m) => <tr key={m.flightId}><td>{m.flightNo}</td><td>{m.from} → <b>{m.to}</b></td><td>{m.reason}</td></tr>)}</tbody></table> : <p className="muted">Current stand allocation is already best for these priorities.</p>}

          <h3>Equipment assignments ({plan.gse.length})</h3>
          {plan.gse.length ? <table><thead><tr><th>Flight</th><th>Task</th><th>Unit</th><th>Route</th><th>Window</th></tr></thead><tbody>
            {plan.gse.map((g) => <tr key={g.taskId}><td>{g.flightNo}</td><td>{g.taskType}</td><td>{g.assetId}</td><td>{g.fromStand} → {g.toStand} ({g.distance})</td><td>{fmt(g.start)}–{fmt(g.end)}</td></tr>)}
          </tbody></table> : <p className="muted">No equipment assignments needed.</p>}

          <h3>Crew transfers ({plan.staff.length})</h3>
          {plan.staff.length ? <ul>{plan.staff.map((s, i) => <li key={i}>Move <b>{s.qty}</b> from {bu.get(s.fromBuId)} · {s.fromSkill} to {bu.get(s.toBuId)} · {s.toSkill} <small className="muted">({s.reason})</small></li>)}</ul> : <p className="muted">No crew pool is overloaded.</p>}

          <h3>Task staggering for crew seats ({plan.shifts.length})</h3>
          {plan.shifts.length ? <ul>{plan.shifts.map((s) => <li key={s.taskId}>{s.flightNo} {s.taskType}: start <b>+{s.shiftMin} min</b> later <small className="muted">({s.reason})</small></li>)}</ul> : <p className="muted">All stands stay within their crew-seat limit.</p>}

          {plan.unresolved.length > 0 && <>
            <h3>Needs a human decision ({plan.unresolved.length})</h3>
            <ul>{plan.unresolved.map((u, i) => <li key={i} className="warn"><b>{u.kind.toUpperCase()}</b> {u.ref}: {u.reason}</li>)}</ul>
          </>}
        </div>
      )}
    </section>
  );
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
