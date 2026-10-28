import { useMemo, useState } from 'react';
import { defaultScenario, validateParams } from '../domain/scenario';
import { fmt } from '../domain/seed';
import { SEVERITY_ORDER, SLA_ORDER, type Scenario, type ScenarioParams, type Severity } from '../domain/types';
import { LENS, useOps } from '../storage/store';
import { ExceptionQueue } from './Board';
import { Badge, Tag } from './ui';

export function RiskSummary() {
  const { view } = useOps();
  const b = view.b;
  const count = (key: (f: (typeof b.flights)[number]) => string, names: Record<string, string>) =>
    Object.keys(names).map((k) => {
      const fl = view.flights.filter((f) => key(f) === k);
      const risky = fl.filter((f) => SLA_ORDER.indexOf(view.turnRisk(b.turnarounds.find((t) => t.flightId === f.id)!.id)) >= 2).length;
      return { k, name: names[k], total: fl.length, risky };
    });
  const piers = count((f) => view.pierOf(f), { A: 'Pier A', B: 'Pier B', C: 'Pier C' });
  const airlines = count((f) => f.airlineId, Object.fromEntries(b.airlines.map((a) => [a.id, a.code])));
  const ex = view.exceptions;
  const unassigned = ex.filter((e) => !view.ownerIdOf(e)).length;
  return (
    <section className="card" aria-label="Risk and ownership summary">
      <h2>Risk by pier / airline</h2>
      {[piers, airlines].map((g, i) => (
        <ul className="bars" key={i}>{g.map((r) => <li key={r.k}><span>{r.name}</span><meter min={0} max={Math.max(1, r.total)} value={r.risky} aria-label={`${r.name}: ${r.risky} of ${r.total} at risk or worse`} /><span>{r.risky}/{r.total} at risk</span></li>)}</ul>
      ))}
      <h3>Ownership summary</h3>
      <p>{ex.length} active · <strong className={unassigned ? 'unassigned' : ''}>{unassigned} unassigned</strong> · {ex.length - unassigned} owned</p>
    </section>
  );
}

export function TurnaroundWorkspace() {
  const { view, selection, select } = useOps();
  const b = view.b;
  const fid = selection?.kind === 'flight' ? selection.id : [...view.related(selection)].find((i) => i.startsWith('fl-')) ?? view.flights[0]?.id;
  const f = b.flights.find((x) => x.id === fid);
  if (!f) return <section className="card"><h2>Turnaround workspace</h2><p className="muted">No flight in the current scope.</p></section>;
  const ta = b.turnarounds.find((t) => t.flightId === f.id)!;
  const ms = b.milestones.filter((m) => m.turnaroundId === ta.id);
  const tasks = b.tasks.filter((t) => t.turnaroundId === ta.id);
  const staff = b.staff.filter((s) => tasks.some((t) => t.buId === s.buId));
  const risks = b.slaRisks.filter((r) => r.affectedEntityId === ta.id);
  const exs = view.exceptionsFor(f.id);
  return (
    <section className="card" aria-label="Turnaround workspace">
      <div className="row between">
        <h2>{f.flightNo} · {f.origin}→{f.destination} · stand {view.standOf(f)}</h2>
        <select aria-label="Choose flight" value={f.id} onChange={(e) => select({ kind: 'flight', id: e.target.value })}>
          {view.flights.map((x) => <option key={x.id} value={x.id}>{x.flightNo} ({view.standOf(x)})</option>)}
        </select>
      </div>
      <p>{f.status} · turnaround {ta.phase} · STA {fmt(f.sta)} / STD {fmt(f.std + view.delay(f.id))} {view.delay(f.id) ? <Tag simulated /> : null} · <Badge level={view.turnRisk(ta.id)} /> {view.changed(ta.id) ? <Tag simulated /> : <Tag simulated={false} />}</p>
      <h3>Milestone timeline</h3>
      <ol className="timeline">{ms.map((m) => {
        const shift = view.impact.milestoneShift[m.id] ?? 0;
        return <li key={m.id}><strong>{m.type}</strong> plan {fmt(m.plannedTime)} → forecast {fmt(m.forecastTime + shift)} {shift ? <><Tag simulated /> (+{shift})</> : null} · {m.status}</li>;
      })}</ol>
      <h3>Tasks &amp; assigned GSE</h3>
      <table><tbody>{tasks.map((t) => <tr key={t.id}><td>{t.taskType}</td><td>{view.taskState(t.id)} {view.changed(t.id) && <Tag simulated />}</td><td>{view.ownerName(t.ownerId)}</td><td>{t.assetId ? `${t.assetId}: ${view.assetState(t.assetId)}` : '—'}</td></tr>)}</tbody></table>
      <h3>Staff capacity</h3>
      <ul className="plain">{staff.map((s) => { const p = view.impact.capacityPressure[s.id]; return <li key={s.id}>{b.bus.find((x) => x.id === s.buId)!.name} / {s.skillGroup}: planned {s.planned}, available {s.available}, engaged {s.engaged}{p ? <> · pressure {p.toFixed(2)} <Tag simulated /></> : null}</li>; })}</ul>
      <h3>SLA risks</h3>
      <ul className="plain">{risks.map((r) => <li key={r.id}><Badge level={view.turnRisk(ta.id)} /> {r.cause}</li>)}</ul>
      <h3>Related exceptions &amp; owner trail</h3>
      <ul className="plain">{exs.map((e) => <li key={e.id}>{e.type} · {view.ownerName(view.ownerIdOf(e))} · {b.actions.find((a) => a.exceptionId === e.id)?.audit.join('; ')}</li>)}</ul>
    </section>
  );
}

export function OwnerWorkbench() {
  const { view } = useOps();
  const b = view.b;
  const groups = new Map<string, typeof b.exceptions>();
  view.exceptions.forEach((e) => groups.set(view.ownerIdOf(e) ?? 'unassigned', [...(groups.get(view.ownerIdOf(e) ?? 'unassigned') ?? []), e]));
  return (
    <section className="card" aria-label="Owner workbench">
      <h2>Owner workbench</h2>
      {[...groups].map(([o, list]) => (
        <div key={o}>
          <h3 className={o === 'unassigned' ? 'unassigned' : ''}>{view.ownerName(o === 'unassigned' ? undefined : o)} ({list.length})</h3>
          <ul className="plain">{list.map((e) => {
            const fl = e.affectedEntityIds.filter((i) => i.startsWith('fl-')).map((i) => b.flights.find((f) => f.id === i)?.flightNo);
            const bus = new Set(b.tasks.filter((t) => e.affectedEntityIds.includes(t.id)).map((t) => t.buId));
            return <li key={e.id}><Badge level={view.severity(e)} kind="sev" /> {e.type} · {fl.join(', ')} · {view.statusOf(e)} · due {fmt(e.targetTime)}{bus.size > 1 ? ' · cross-BU' : ''} {view.changed(e.id) && <Tag simulated />}</li>;
          })}</ul>
        </div>
      ))}
      {!groups.size && <p className="muted">No items in scope.</p>}
    </section>
  );
}

const num = (v: string) => (v === '' ? NaN : Number(v));

export function ScenarioManager() {
  const { scenarios, activeId, activate, saveScenario, removeScenario, duplicate, mode, setMode, view, role, baseline } = useOps();
  const [draft, setDraft] = useState<Scenario>(defaultScenario());
  const [errors, setErrors] = useState<string[]>([]);
  const can = LENS[role].canSimulate;
  const b = baseline;
  const p = draft.params;
  const set = (np: ScenarioParams) => setDraft({ ...draft, params: np });
  const live = useMemo(() => validateParams(p, b), [p, b]);
  const pierOf = (x?: string) => x ?? 'A';
  const types = [...new Set(b.assets.map((a) => a.type))];
  const diff = useMemo(() => {
    const i = view.impact;
    return { flights: Object.keys(i.flightDelay).length, turn: Object.keys(i.turnaroundRisk).length, tasks: Object.keys(i.taskRisk).length, ex: Object.keys(i.exceptionSeverity).length, assets: Object.keys(i.assetState).length, total: i.impactedIds.length };
  }, [view]);

  return (
    <section className="card" aria-label="Scenario manager">
      <h2>Scenario manager <span className="tag sim">Simulation · view-only</span></h2>
      <p className="muted">Scenarios only change what is displayed. No operational record is modified and nothing is sent to any system.</p>
      {!can && <p role="status" className="warn">Your lens ({role}) is read-only for scenario editing. You can still activate and compare existing scenarios.</p>}
      <div role="group" aria-label="Comparison mode" className="seg">
        {(['baseline', 'scenario', 'difference'] as const).map((m) => <button key={m} aria-pressed={mode === m} disabled={m !== 'baseline' && !activeId} onClick={() => setMode(m)}>{m[0].toUpperCase() + m.slice(1)}</button>)}
        <button onClick={() => activate(null)} disabled={!activeId}>Return to Baseline</button>
      </div>
      {activeId && <div className="diff" aria-label="Difference summary">
        <h3>Baseline vs scenario difference</h3>
        <p>{diff.total} impacted entities · {diff.flights} delayed flights · {diff.turn} turnaround risk changes · {diff.tasks} task changes · {diff.ex} exception escalations · {diff.assets} assets unavailable</p>
        <details><summary>Impacted-entity explorer</summary><ul className="plain">{view.impact.impactedIds.map((id) => <li key={id}>{id}: {(view.impact.factors[id] ?? ['escalated by related impact']).join('; ')}</li>)}</ul></details>
      </div>}

      <h3>Saved scenarios</h3>
      <ul className="plain">{scenarios.map((s) => (
        <li key={s.id}>
          <strong>{s.name}</strong> <Badge level={s.state} kind="plain" /> {s.notes && <span className="muted">— {s.notes}</span>}
          {' '}<button onClick={() => activate(s.id === activeId ? null : s.id)}>{s.id === activeId ? 'Deactivate' : 'Activate'}</button>
          {can && <> <button onClick={() => { setDraft(structuredClone(s)); setErrors([]); }}>Edit</button> <button onClick={() => duplicate(s.id)}>Duplicate</button> <button onClick={() => { const n = prompt('Rename scenario', s.name); if (n) saveScenario({ ...s, name: n }); }}>Rename</button> <button onClick={() => void removeScenario(s.id)}>Delete</button></>}
        </li>
      ))}{!scenarios.length && <li className="muted">None yet.</li>}</ul>

      {can && <fieldset>
        <legend>Parameter editor</legend>
        <label>Name <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
        <label>Notes <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>

        <label><input type="checkbox" checked={!!p.lateInbound} onChange={(e) => set({ ...p, lateInbound: e.target.checked ? { flightId: b.flights[0].id, delayMin: 45, standId: b.flights[0].standId, sensitivity: 'Med' } : undefined })} /> Late inbound</label>
        {p.lateInbound && <div className="grid">
          <label>Flight <select value={p.lateInbound.flightId} onChange={(e) => set({ ...p, lateInbound: { ...p.lateInbound!, flightId: e.target.value, standId: b.flights.find((f) => f.id === e.target.value)!.standId } })}>{b.flights.map((f) => <option key={f.id} value={f.id}>{f.flightNo}</option>)}</select></label>
          <label>Delay min (0-240) <input type="number" value={Number.isNaN(p.lateInbound.delayMin) ? '' : p.lateInbound.delayMin} onChange={(e) => set({ ...p, lateInbound: { ...p.lateInbound!, delayMin: num(e.target.value) } })} /></label>
          <label>Stand <select value={p.lateInbound.standId} onChange={(e) => set({ ...p, lateInbound: { ...p.lateInbound!, standId: e.target.value } })}>{b.stands.map((s) => <option key={s.id}>{s.id}</option>)}</select></label>
          <label>Connection sensitivity <select value={p.lateInbound.sensitivity} onChange={(e) => set({ ...p, lateInbound: { ...p.lateInbound!, sensitivity: e.target.value as 'Low' } })}><option>Low</option><option>Med</option><option>High</option></select></label>
        </div>}

        <label><input type="checkbox" checked={!!p.weather} onChange={(e) => set({ ...p, weather: e.target.checked ? { startOffsetMin: 15, durationMin: 30, piers: ['A'], severity: 'High', recoveryBufferMin: 15 } : undefined })} /> Weather / ramp stoppage</label>
        {p.weather && <div className="grid">
          <label>Start offset min <input type="number" value={Number.isNaN(p.weather.startOffsetMin) ? '' : p.weather.startOffsetMin} onChange={(e) => set({ ...p, weather: { ...p.weather!, startOffsetMin: num(e.target.value) } })} /></label>
          <label>Duration min (0-180) <input type="number" value={Number.isNaN(p.weather.durationMin) ? '' : p.weather.durationMin} onChange={(e) => set({ ...p, weather: { ...p.weather!, durationMin: num(e.target.value) } })} /></label>
          <label>Zones <select multiple value={p.weather.piers} onChange={(e) => set({ ...p, weather: { ...p.weather!, piers: [...e.target.selectedOptions].map((o) => o.value) } })}>{['A', 'B', 'C'].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Severity <select value={p.weather.severity} onChange={(e) => set({ ...p, weather: { ...p.weather!, severity: e.target.value as Severity } })}>{SEVERITY_ORDER.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Recovery buffer min <input type="number" value={Number.isNaN(p.weather.recoveryBufferMin) ? '' : p.weather.recoveryBufferMin} onChange={(e) => set({ ...p, weather: { ...p.weather!, recoveryBufferMin: num(e.target.value) } })} /></label>
        </div>}

        <label><input type="checkbox" checked={!!p.gse} onChange={(e) => set({ ...p, gse: e.target.checked ? { assetType: types[0], quantityUnavailable: 1, pier: 'A', durationMin: 60 } : undefined })} /> Missing / unavailable GSE</label>
        {p.gse && <div className="grid">
          <label>Asset type <select value={p.gse.assetType} onChange={(e) => set({ ...p, gse: { ...p.gse!, assetType: e.target.value } })}>{types.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Pier <select value={pierOf(p.gse.pier)} onChange={(e) => set({ ...p, gse: { ...p.gse!, pier: e.target.value } })}>{['A', 'B', 'C'].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Quantity unavailable <input type="number" value={Number.isNaN(p.gse.quantityUnavailable) ? '' : p.gse.quantityUnavailable} onChange={(e) => set({ ...p, gse: { ...p.gse!, quantityUnavailable: num(e.target.value) } })} /></label>
          <label>Duration min <input type="number" value={Number.isNaN(p.gse.durationMin) ? '' : p.gse.durationMin} onChange={(e) => set({ ...p, gse: { ...p.gse!, durationMin: num(e.target.value) } })} /></label>
        </div>}

        <label><input type="checkbox" checked={!!p.staff} onChange={(e) => set({ ...p, staff: e.target.checked ? { buId: b.bus[0].id, capacityDeltaPct: 30, windowMin: 120 } : undefined })} /> Staff capacity reduction</label>
        {p.staff && <div className="grid">
          <label>BU / team <select value={p.staff.buId} onChange={(e) => set({ ...p, staff: { ...p.staff!, buId: e.target.value } })}>{b.bus.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Reduction % (0-100) <input type="number" value={Number.isNaN(p.staff.capacityDeltaPct) ? '' : p.staff.capacityDeltaPct} onChange={(e) => set({ ...p, staff: { ...p.staff!, capacityDeltaPct: num(e.target.value) } })} /></label>
          <label>Window min <input type="number" value={Number.isNaN(p.staff.windowMin) ? '' : p.staff.windowMin} onChange={(e) => set({ ...p, staff: { ...p.staff!, windowMin: num(e.target.value) } })} /></label>
          <label>Skill group <select value={p.staff.skillGroup ?? ''} onChange={(e) => set({ ...p, staff: { ...p.staff!, skillGroup: e.target.value || undefined } })}><option value="">All</option><option>General</option><option>Certified</option></select></label>
        </div>}

        <label><input type="checkbox" checked={!!p.slaStress} onChange={(e) => set({ ...p, slaStress: e.target.checked ? { airlineId: b.airlines[0].id, milestoneType: b.slaRules[0].milestoneType, thresholdDeltaMin: 20, windowMin: 120 } : undefined })} /> SLA threshold stress</label>
        {p.slaStress && <div className="grid">
          <label>Airline <select value={p.slaStress.airlineId} onChange={(e) => set({ ...p, slaStress: { ...p.slaStress!, airlineId: e.target.value } })}>{b.airlines.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>SLA milestone <select value={p.slaStress.milestoneType} onChange={(e) => set({ ...p, slaStress: { ...p.slaStress!, milestoneType: e.target.value } })}>{[...new Set(b.slaRules.map((r) => r.milestoneType))].map((m) => <option key={m}>{m}</option>)}</select></label>
          <label>Threshold delta min <input type="number" value={Number.isNaN(p.slaStress.thresholdDeltaMin) ? '' : p.slaStress.thresholdDeltaMin} onChange={(e) => set({ ...p, slaStress: { ...p.slaStress!, thresholdDeltaMin: num(e.target.value) } })} /></label>
          <label>Window min <input type="number" value={Number.isNaN(p.slaStress.windowMin) ? '' : p.slaStress.windowMin} onChange={(e) => set({ ...p, slaStress: { ...p.slaStress!, windowMin: num(e.target.value) } })} /></label>
        </div>}

        {live.length > 0 && <ul role="alert" className="errors">{live.map((e) => <li key={e}>{e}</li>)}</ul>}
        {errors.length > 0 && live.length === 0 && <p role="alert" className="errors">{errors.join(' ')}</p>}
        <div className="row">
          <button className="primary" onClick={() => { const e = saveScenario(draft); setErrors(e); if (!e.length) activate(draft.id); }}>Apply (simulate only)</button>
          <button onClick={() => { const e = saveScenario(draft); setErrors(e); }}>Save</button>
          <button onClick={() => { setDraft(defaultScenario()); setErrors([]); }}>New</button>
        </div>
      </fieldset>}
    </section>
  );
}

export function Diagnostics() {
  const { diag, audit, exportData, reset, baseline } = useOps();
  return (
    <section className="card" aria-label="Diagnostics">
      <h2>Diagnostics &amp; data</h2>
      <p>Schema v{baseline.schemaVersion} · seed {baseline.seedVersion}</p>
      <div className="row"><button onClick={exportData}>Export scenario / diagnostics</button><button onClick={() => { if (confirm('Reset the prototype to the seed baseline? Scenarios and logs will be cleared.')) void reset(); }}>Reset prototype</button></div>
      <h3>Client diagnostics ({diag.length})</h3>
      <ul className="plain">{diag.slice(-30).reverse().map((d) => <li key={d.id}>{new Date(d.time).toLocaleTimeString()} [{d.kind}] {d.message}</li>)}</ul>
      <h3>Interaction audit ({audit.length})</h3>
      <ul className="plain">{audit.slice(-30).reverse().map((a) => <li key={a.id}>{new Date(a.time).toLocaleTimeString()} {a.actor}: {a.action} {a.entityRef ?? ''} {a.scenarioRef ?? ''}</li>)}</ul>
    </section>
  );
}

export { ExceptionQueue };
