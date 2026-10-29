import { useMemo, useState } from 'react';
import { defaultScenario, validateParams } from '../domain/scenario';
import { fmt, changiClock } from '../domain/seed';
import { SEVERITY_ORDER, SLA_ORDER, type Scenario, type ScenarioParams, type Severity } from '../domain/types';
import { LENS, useOps } from '../storage/store';
import { getLang, tr } from '../i18n';
import { trData } from '../i18n/data';
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
  const piers = count((f) => view.pierOf(f), { A: tr('Pier A'), B: tr('Pier B'), C: tr('Pier C') });
  const airlines = count((f) => f.airlineId, Object.fromEntries(b.airlines.map((a) => [a.id, a.code])));
  const ex = view.exceptions;
  const unassigned = ex.filter((e) => !view.ownerIdOf(e)).length;
  return (
    <section className="card" aria-label={tr('Risk and ownership summary')}>
      <h2>{tr('Risk by pier / airline')}</h2>
      {[piers, airlines].map((g, i) => (
        <ul className="bars" key={i}>{g.map((r) => <li key={r.k}><span>{r.name}</span><meter min={0} max={Math.max(1, r.total)} value={r.risky} aria-label={tr('{name}: {risky} of {total} at risk or worse', { name: r.name, risky: r.risky, total: r.total })} /><span>{tr('{risky}/{total} at risk', { risky: r.risky, total: r.total })}</span></li>)}</ul>
      ))}
      <h3>{tr('Ownership summary')}</h3>
      <p>{tr('{n} active', { n: ex.length })} · <strong className={unassigned ? 'unassigned' : ''}>{tr('{n} unassigned', { n: unassigned })}</strong> · {tr('{n} owned', { n: ex.length - unassigned })}</p>
    </section>
  );
}

export function TurnaroundWorkspace() {
  const { view, selection, select } = useOps();
  const b = view.b;
  const fid = selection?.kind === 'flight' ? selection.id : [...view.related(selection)].find((i) => i.startsWith('fl-')) ?? view.flights[0]?.id;
  const f = b.flights.find((x) => x.id === fid);
  if (!f) return <section className="card"><h2>{tr('Turnaround workspace')}</h2><p className="muted">{tr('No flight in the current scope.')}</p></section>;
  const ta = b.turnarounds.find((t) => t.flightId === f.id)!;
  const ms = b.milestones.filter((m) => m.turnaroundId === ta.id);
  const tasks = b.tasks.filter((t) => t.turnaroundId === ta.id);
  const staff = b.staff.filter((s) => tasks.some((t) => t.buId === s.buId));
  const risks = b.slaRisks.filter((r) => r.affectedEntityId === ta.id);
  const exs = view.exceptionsFor(f.id);
  return (
    <section className="card" aria-label={tr('Turnaround workspace')}>
      <div className="row between">
        <h2>{f.flightNo} · {f.origin}→{f.destination} · {tr('stand {stand}', { stand: view.standOf(f) })}</h2>
        <select aria-label={tr('Choose flight')} value={f.id} onChange={(e) => select({ kind: 'flight', id: e.target.value })}>
          {view.flights.map((x) => <option key={x.id} value={x.id}>{x.flightNo} ({view.standOf(x)})</option>)}
        </select>
      </div>
      <p>{trData(f.status)} · {tr('turnaround {phase}', { phase: trData(ta.phase) })} · STA {fmt(f.sta)} / STD {fmt(f.std + view.delay(f.id))} {view.delay(f.id) ? <Tag simulated /> : null} · <Badge level={view.turnRisk(ta.id)} /> {view.changed(ta.id) ? <Tag simulated /> : <Tag simulated={false} />}</p>
      <h3>{tr('Milestone timeline')}</h3>
      <ol className="timeline">{ms.map((m) => {
        const shift = view.impact.milestoneShift[m.id] ?? 0;
        return <li key={m.id}><strong>{trData(m.type)}</strong> {tr('plan')} {fmt(m.plannedTime)} → {tr('forecast')} {fmt(m.forecastTime + shift)} {shift ? <><Tag simulated /> (+{shift})</> : null} · {trData(m.status)}</li>;
      })}</ol>
      <h3>{tr('Tasks & assigned GSE')}</h3>
      <table><tbody>{tasks.map((t) => <tr key={t.id}><td>{trData(t.taskType)}</td><td>{trData(view.taskState(t.id))} {view.changed(t.id) && <Tag simulated />}</td><td>{view.ownerName(t.ownerId)}</td><td>{t.assetId ? `${t.assetId}: ${trData(view.assetState(t.assetId))}` : '—'}</td></tr>)}</tbody></table>
      <h3>{tr('Staff capacity')}</h3>
      <ul className="plain">{staff.map((s) => { const p = view.impact.capacityPressure[s.id]; return <li key={s.id}>{trData(b.bus.find((x) => x.id === s.buId)!.name)} / {trData(s.skillGroup)}: {tr('planned {n}, available {a}, engaged {e}', { n: s.planned, a: s.available, e: s.engaged })}{p ? <> · {tr('pressure')} {p.toFixed(2)} <Tag simulated /></> : null}</li>; })}</ul>
      <h3>{tr('SLA risks')}</h3>
      <ul className="plain">{risks.map((r) => <li key={r.id}><Badge level={view.turnRisk(ta.id)} /> {trData(r.cause)}</li>)}</ul>
      <h3>{tr('Related exceptions & owner trail')}</h3>
      <ul className="plain">{exs.map((e) => <li key={e.id}>{trData(e.type)} · {view.ownerName(view.ownerIdOf(e))} · {b.actions.find((a) => a.exceptionId === e.id)?.audit.map((x) => trData(x)).join('; ')}</li>)}</ul>
    </section>
  );
}

export function OwnerWorkbench() {
  const { view } = useOps();
  const b = view.b;
  const groups = new Map<string, typeof b.exceptions>();
  view.exceptions.forEach((e) => groups.set(view.ownerIdOf(e) ?? 'unassigned', [...(groups.get(view.ownerIdOf(e) ?? 'unassigned') ?? []), e]));
  return (
    <section className="card" aria-label={tr('Owner workbench')}>
      <h2>{tr('Owner workbench')}</h2>
      {[...groups].map(([o, list]) => (
        <div key={o}>
          <h3 className={o === 'unassigned' ? 'unassigned' : ''}>{view.ownerName(o === 'unassigned' ? undefined : o)} ({list.length})</h3>
          <ul className="plain">{list.map((e) => {
            const fl = e.affectedEntityIds.filter((i) => i.startsWith('fl-')).map((i) => b.flights.find((f) => f.id === i)?.flightNo);
            const bus = new Set(b.tasks.filter((t) => e.affectedEntityIds.includes(t.id)).map((t) => t.buId));
            return <li key={e.id}><Badge level={view.severity(e)} kind="sev" /> {trData(e.type)} · {fl.join(', ')} · {trData(view.statusOf(e))} · {tr('due {time}', { time: fmt(e.targetTime) })}{bus.size > 1 ? ` · ${tr('cross-BU')}` : ''} {view.changed(e.id) && <Tag simulated />}</li>;
          })}</ul>
        </div>
      ))}
      {!groups.size && <p className="muted">{tr('No items in scope.')}</p>}
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
  const live = useMemo(() => validateParams(p, b), [p, b, getLang()]);
  const pierOf = (x?: string) => x ?? 'A';
  const types = [...new Set(b.assets.map((a) => a.type))];
  const diff = useMemo(() => {
    const i = view.impact;
    return { flights: Object.keys(i.flightDelay).length, turn: Object.keys(i.turnaroundRisk).length, tasks: Object.keys(i.taskRisk).length, ex: Object.keys(i.exceptionSeverity).length, assets: Object.keys(i.assetState).length, total: i.impactedIds.length };
  }, [view]);

  return (
    <section className="card" aria-label={tr('Scenario manager')}>
      <h2>{tr('Scenario manager')} <span className="tag sim">{tr('Simulation · view-only')}</span></h2>
      <p className="muted">{tr('Scenarios only change what is displayed. No operational record is modified and nothing is sent to any system.')}</p>
      {!can && <p role="status" className="warn">{tr('Your lens ({role}) is read-only for scenario editing. You can still activate and compare existing scenarios.', { role: trData(role) })}</p>}
      <div role="group" aria-label={tr('Comparison mode')} className="seg">
        {(['baseline', 'scenario', 'difference'] as const).map((m) => <button key={m} aria-pressed={mode === m} disabled={m !== 'baseline' && !activeId} onClick={() => setMode(m)}>{tr(m[0].toUpperCase() + m.slice(1))}</button>)}
        <button onClick={() => activate(null)} disabled={!activeId}>{tr('Return to Baseline')}</button>
      </div>
      {activeId && <div className="diff" aria-label={tr('Difference summary')}>
        <h3>{tr('Baseline vs scenario difference')}</h3>
        <p>{tr('{total} impacted entities · {flights} delayed flights · {turn} turnaround risk changes · {tasks} task changes · {ex} exception escalations · {assets} assets unavailable', diff)}</p>
        <details><summary>{tr('Impacted-entity explorer')}</summary><ul className="plain">{view.impact.impactedIds.map((id) => <li key={id}>{id}: {(view.impact.factors[id] ?? [tr('escalated by related impact')]).join('; ')}</li>)}</ul></details>
      </div>}

      <h3>{tr('Saved scenarios')}</h3>
      <ul className="plain">{scenarios.map((s) => (
        <li key={s.id}>
          <strong>{trData(s.name)}</strong> <Badge level={s.state} kind="plain" /> {s.notes && <span className="muted">— {s.notes}</span>}
          {' '}<button onClick={() => activate(s.id === activeId ? null : s.id)}>{s.id === activeId ? tr('Deactivate') : tr('Activate')}</button>
          {can && <> <button onClick={() => { setDraft(structuredClone(s)); setErrors([]); }}>{tr('Edit')}</button> <button onClick={() => duplicate(s.id)}>{tr('Duplicate')}</button> <button onClick={() => { const n = prompt(tr('Rename scenario'), s.name); if (n) saveScenario({ ...s, name: n }); }}>{tr('Rename')}</button> <button onClick={() => void removeScenario(s.id)}>{tr('Delete')}</button></>}
        </li>
      ))}{!scenarios.length && <li className="muted">{tr('None yet.')}</li>}</ul>

      {can && <fieldset>
        <legend>{tr('Parameter editor')}</legend>
        <label>{tr('Name')} <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
        <label>{tr('Notes')} <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>

        <label><input type="checkbox" checked={!!p.lateInbound} onChange={(e) => set({ ...p, lateInbound: e.target.checked ? { flightId: b.flights[0].id, delayMin: 45, standId: b.flights[0].standId, sensitivity: 'Med' } : undefined })} /> {tr('Late inbound')}</label>
        {p.lateInbound && <div className="grid">
          <label>{tr('Flight')} <select value={p.lateInbound.flightId} onChange={(e) => set({ ...p, lateInbound: { ...p.lateInbound!, flightId: e.target.value, standId: b.flights.find((f) => f.id === e.target.value)!.standId } })}>{b.flights.map((f) => <option key={f.id} value={f.id}>{f.flightNo}</option>)}</select></label>
          <label>{tr('Delay min (0-240)')} <input type="number" value={Number.isNaN(p.lateInbound.delayMin) ? '' : p.lateInbound.delayMin} onChange={(e) => set({ ...p, lateInbound: { ...p.lateInbound!, delayMin: num(e.target.value) } })} /></label>
          <label>{tr('Stand')} <select value={p.lateInbound.standId} onChange={(e) => set({ ...p, lateInbound: { ...p.lateInbound!, standId: e.target.value } })}>{b.stands.map((s) => <option key={s.id}>{s.id}</option>)}</select></label>
          <label>{tr('Connection sensitivity')} <select value={p.lateInbound.sensitivity} onChange={(e) => set({ ...p, lateInbound: { ...p.lateInbound!, sensitivity: e.target.value as 'Low' } })}><option value="Low">{tr('Low')}</option><option value="Med">{tr('Med')}</option><option value="High">{tr('High')}</option></select></label>
        </div>}

        <label><input type="checkbox" checked={!!p.weather} onChange={(e) => set({ ...p, weather: e.target.checked ? { startOffsetMin: 15, durationMin: 30, piers: ['A'], severity: 'High', recoveryBufferMin: 15 } : undefined })} /> {tr('Weather / ramp stoppage')}</label>
        {p.weather && <div className="grid">
          <label>{tr('Start offset min')} <input type="number" value={Number.isNaN(p.weather.startOffsetMin) ? '' : p.weather.startOffsetMin} onChange={(e) => set({ ...p, weather: { ...p.weather!, startOffsetMin: num(e.target.value) } })} /></label>
          <label>{tr('Duration min (0-180)')} <input type="number" value={Number.isNaN(p.weather.durationMin) ? '' : p.weather.durationMin} onChange={(e) => set({ ...p, weather: { ...p.weather!, durationMin: num(e.target.value) } })} /></label>
          <label>{tr('Zones')} <select multiple value={p.weather.piers} onChange={(e) => set({ ...p, weather: { ...p.weather!, piers: [...e.target.selectedOptions].map((o) => o.value) } })}>{['A', 'B', 'C'].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>{tr('Severity')} <select value={p.weather.severity} onChange={(e) => set({ ...p, weather: { ...p.weather!, severity: e.target.value as Severity } })}>{SEVERITY_ORDER.map((x) => <option key={x} value={x}>{trData(x)}</option>)}</select></label>
          <label>{tr('Recovery buffer min')} <input type="number" value={Number.isNaN(p.weather.recoveryBufferMin) ? '' : p.weather.recoveryBufferMin} onChange={(e) => set({ ...p, weather: { ...p.weather!, recoveryBufferMin: num(e.target.value) } })} /></label>
        </div>}

        <label><input type="checkbox" checked={!!p.gse} onChange={(e) => set({ ...p, gse: e.target.checked ? { assetType: types[0], quantityUnavailable: 1, pier: 'A', durationMin: 60 } : undefined })} /> {tr('Missing / unavailable GSE')}</label>
        {p.gse && <div className="grid">
          <label>{tr('Asset type')} <select value={p.gse.assetType} onChange={(e) => set({ ...p, gse: { ...p.gse!, assetType: e.target.value } })}>{types.map((t) => <option key={t} value={t}>{trData(t)}</option>)}</select></label>
          <label>{tr('Pier')} <select value={pierOf(p.gse.pier)} onChange={(e) => set({ ...p, gse: { ...p.gse!, pier: e.target.value } })}>{['A', 'B', 'C'].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>{tr('Quantity unavailable')} <input type="number" value={Number.isNaN(p.gse.quantityUnavailable) ? '' : p.gse.quantityUnavailable} onChange={(e) => set({ ...p, gse: { ...p.gse!, quantityUnavailable: num(e.target.value) } })} /></label>
          <label>{tr('Duration min')} <input type="number" value={Number.isNaN(p.gse.durationMin) ? '' : p.gse.durationMin} onChange={(e) => set({ ...p, gse: { ...p.gse!, durationMin: num(e.target.value) } })} /></label>
        </div>}

        <label><input type="checkbox" checked={!!p.staff} onChange={(e) => set({ ...p, staff: e.target.checked ? { buId: b.bus[0].id, capacityDeltaPct: 30, windowMin: 120 } : undefined })} /> {tr('Staff capacity reduction')}</label>
        {p.staff && <div className="grid">
          <label>{tr('BU / team')} <select value={p.staff.buId} onChange={(e) => set({ ...p, staff: { ...p.staff!, buId: e.target.value } })}>{b.bus.map((x) => <option key={x.id} value={x.id}>          {trData(x.name)}</option>)}</select></label>
          <label>{tr('Reduction % (0-100)')} <input type="number" value={Number.isNaN(p.staff.capacityDeltaPct) ? '' : p.staff.capacityDeltaPct} onChange={(e) => set({ ...p, staff: { ...p.staff!, capacityDeltaPct: num(e.target.value) } })} /></label>
          <label>{tr('Window min')} <input type="number" value={Number.isNaN(p.staff.windowMin) ? '' : p.staff.windowMin} onChange={(e) => set({ ...p, staff: { ...p.staff!, windowMin: num(e.target.value) } })} /></label>
          <label>{tr('Skill group')} <select value={p.staff.skillGroup ?? ''} onChange={(e) => set({ ...p, staff: { ...p.staff!, skillGroup: e.target.value || undefined } })}><option value="">{tr('All')}</option><option value="General">{tr('General')}</option><option value="Certified">{tr('Certified')}</option></select></label>
        </div>}

        <label><input type="checkbox" checked={!!p.slaStress} onChange={(e) => set({ ...p, slaStress: e.target.checked ? { airlineId: b.airlines[0].id, milestoneType: b.slaRules[0].milestoneType, thresholdDeltaMin: 20, windowMin: 120 } : undefined })} /> {tr('SLA threshold stress')}</label>
        {p.slaStress && <div className="grid">
          <label>{tr('Airline')} <select value={p.slaStress.airlineId} onChange={(e) => set({ ...p, slaStress: { ...p.slaStress!, airlineId: e.target.value } })}>{b.airlines.map((a) => <option key={a.id} value={a.id}>{trData(a.name)}</option>)}</select></label>
          <label>{tr('SLA milestone')} <select value={p.slaStress.milestoneType} onChange={(e) => set({ ...p, slaStress: { ...p.slaStress!, milestoneType: e.target.value } })}>{[...new Set(b.slaRules.map((r) => r.milestoneType))].map((m) => <option key={m} value={m}>{trData(m)}</option>)}</select></label>
          <label>{tr('Threshold delta min')} <input type="number" value={Number.isNaN(p.slaStress.thresholdDeltaMin) ? '' : p.slaStress.thresholdDeltaMin} onChange={(e) => set({ ...p, slaStress: { ...p.slaStress!, thresholdDeltaMin: num(e.target.value) } })} /></label>
          <label>{tr('Window min')} <input type="number" value={Number.isNaN(p.slaStress.windowMin) ? '' : p.slaStress.windowMin} onChange={(e) => set({ ...p, slaStress: { ...p.slaStress!, windowMin: num(e.target.value) } })} /></label>
        </div>}

        {live.length > 0 && <ul role="alert" className="errors">{live.map((e) => <li key={e}>{e}</li>)}</ul>}
        {errors.length > 0 && live.length === 0 && <p role="alert" className="errors">{errors.join(' ')}</p>}
        <div className="row">
          <button className="primary" onClick={() => { const e = saveScenario(draft); setErrors(e); if (!e.length) activate(draft.id); }}>{tr('Apply (simulate only)')}</button>
          <button onClick={() => { const e = saveScenario(draft); setErrors(e); }}>{tr('Save')}</button>
          <button onClick={() => { setDraft(defaultScenario()); setErrors([]); }}>{tr('New')}</button>
        </div>
      </fieldset>}
    </section>
  );
}

export function Diagnostics() {
  const { diag, audit, exportData, reset, baseline } = useOps();
  return (
    <section className="card" aria-label={tr('Diagnostics')}>
      <h2>{tr('Diagnostics & data')}</h2>
      <p>{tr('Schema v{schema} · seed {seed}', { schema: baseline.schemaVersion, seed: baseline.seedVersion })}</p>
      <div className="row"><button onClick={exportData}>{tr('Export scenario / diagnostics')}</button><button onClick={() => { if (confirm(tr('Reset the prototype to the seed baseline? Scenarios and logs will be cleared.'))) void reset(); }}>{tr('Reset prototype')}</button></div>
      <h3>{tr('Client diagnostics ({n})', { n: diag.length })}</h3>
      <ul className="plain">{diag.slice(-30).reverse().map((d) => <li key={d.id}>{changiClock(new Date(d.time))} [{d.kind}] {d.message}</li>)}</ul>
      <h3>{tr('Interaction audit ({n})', { n: audit.length })}</h3>
      <ul className="plain">{audit.slice(-30).reverse().map((a) => <li key={a.id}>{changiClock(new Date(a.time))} {a.actor}: {a.action} {a.entityRef ?? ''} {a.scenarioRef ?? ''}</li>)}</ul>
    </section>
  );
}

export { ExceptionQueue };
