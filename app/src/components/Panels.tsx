import { fmt } from '../domain/seed';
import { useOps } from '../storage/store';
import { ExceptionQueue } from './Board';
import { Map2D } from './Map2D';
import { Scene3D } from './Scene3D';
import { Badge, Tag } from './ui';
import { ExceptionStepper } from './Workflow';

const LAYERS: [string, string][] = [
  ['flights', 'Flights'], ['stands', 'Stands'], ['milestones', 'Milestones'], ['tasks', 'Tasks'], ['staff', 'Staff / capacity'],
  ['assets', 'GSE / assets'], ['sla', 'SLA risk'], ['weather', 'Weather / constraints'], ['relations', 'Relationships'],
];

export function VizPane() {
  const { vizMode, setVizMode, layers, toggleLayer, view } = useOps();
  return (
    <section className="card" aria-label="Operational map">
      <div className="row between">
        <h2>Situational view {view.simulated && <Tag simulated />}</h2>
        <div role="group" aria-label="2D / 3D toggle" className="seg">
          <button aria-pressed={vizMode === '2d'} onClick={() => setVizMode('2d')}>2D</button>
          <button aria-pressed={vizMode === '3d'} onClick={() => setVizMode('3d')}>3D</button>
        </div>
      </div>
      <details className="layers"><summary>Layers</summary>
        {LAYERS.map(([k, l]) => <label key={k}><input type="checkbox" checked={!!layers[k]} onChange={() => toggleLayer(k)} /> {l}</label>)}
      </details>
      {vizMode === '2d' ? <Map2D /> : <Scene3D />}
      <p className="legend">Risk: <Badge level="Normal" /> <Badge level="Watch" /> <Badge level="AtRisk" /> <Badge level="Breach" /> · Layers hide rendering only; KPIs are unaffected.</p>
    </section>
  );
}

export function DetailPanel() {
  const { selection, view, select } = useOps();
  const b = view.b;
  if (!selection) return <aside className="card" aria-label="Detail"><h2>Detail</h2><p className="muted">Select a flight, stand, task, asset or exception to see details and related entities.</p></aside>;
  const rel = view.related(selection);
  const flights = b.flights.filter((f) => rel.has(f.id));
  const exs = b.exceptions.filter((e) => rel.has(e.id));
  const tasks = b.tasks.filter((t) => rel.has(t.id));
  const assets = b.assets.filter((a) => rel.has(a.id));
  const factors = [...rel].flatMap((i) => view.impact.factors[i] ?? []);
  return (
    <aside className="card" aria-label="Detail">
      <div className="row between"><h2>{selection.kind} {selection.id}</h2><button onClick={() => select(null)} aria-label="Clear selection">✕</button></div>
      <h3>Flights</h3>
      <ul className="chips">{flights.map((f) => <li key={f.id}><button onClick={() => select({ kind: 'flight', id: f.id })}>{f.flightNo} @ {view.standOf(f)} <Badge level={view.turnRisk(b.turnarounds.find((t) => t.flightId === f.id)!.id)} /> {view.delay(f.id) ? `+${view.delay(f.id)}m` : ''}</button></li>)}</ul>
      <h3>Tasks</h3>
      <ul className="plain">{tasks.map((t) => <li key={t.id}>{t.taskType} · {view.taskState(t.id)} {view.changed(t.id) && <Tag simulated />} · {view.ownerName(t.ownerId)} · {fmt(t.forecastTime)}</li>)}</ul>
      <h3>Assets</h3>
      <ul className="plain">{assets.map((a) => <li key={a.id}>{a.type} {a.id}: {view.assetState(a.id)} {view.changed(a.id) && <Tag simulated />}</li>)}</ul>
      <h3>Exceptions</h3>
      <ul className="plain">{exs.map((e) => <li key={e.id}><button className="link" onClick={() => select({ kind: 'exception', id: e.id })}>{e.type}</button> <Badge level={view.severity(e)} kind="sev" /> · {view.ownerName(view.ownerIdOf(e))}</li>)}</ul>
      {factors.length > 0 && <><h3>Contributing factors <Tag simulated /></h3><ul className="plain">{factors.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
    </aside>
  );
}

export function ExceptionDetail() {
  const { selection, view } = useOps();
  const e = selection?.kind === 'exception' ? view.b.exceptions.find((x) => x.id === selection.id) : undefined;
  if (!e) return null;
  const act = view.b.actions.find((a) => a.exceptionId === e.id);
  const lead = view.b.stakeholders.find((s) => s.id === act?.leadStakeholderId);
  const chain = e.affectedEntityIds;
  return (
    <section className="card" aria-label="Exception detail">
      <h2>Exception detail · {e.id} {view.changed(e.id) && <Tag simulated />}</h2>
      <p><Badge level={view.severity(e)} kind="sev" /> {e.type} — baseline severity {e.severity}. Detected {fmt(e.detectedAt)} via {e.source}.</p>
      <p>{e.explanation}</p>
      <p>Owner: <strong>{view.ownerName(view.ownerIdOf(e))}</strong> · Lead stakeholder: {lead?.displayName ?? '—'} · Age {view.b.now - e.detectedAt} min · Target {fmt(e.targetTime)}</p>
      <ExceptionStepper id={e.id} />
      <p>Dependency chain: {chain.join(' → ')}</p>
      <ul className="plain">{act?.audit.map((a, i) => <li key={i}>{a}</li>)}</ul>
    </section>
  );
}
