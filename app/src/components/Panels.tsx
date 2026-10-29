import { fmt } from '../domain/seed';
import { useOps } from '../storage/store';
import { ExceptionQueue } from './Board';
import { Map2D } from './Map2D';
import { Scene3D } from './Scene3D';
import { GpsMap } from './GpsMap';
import { Badge, Tag } from './ui';
import { ExceptionStepper } from './Workflow';
import { tr } from '../i18n';
import { trData } from '../i18n/data';

const LAYERS: [string, string][] = [
  ['flights', 'Flights'], ['stands', 'Stands'], ['milestones', 'Milestones'], ['tasks', 'Tasks'], ['staff', 'Staff / capacity'],
  ['assets', 'GSE / assets'], ['gates', 'Gates'], ['baggage', 'Baggage'], ['cargo', 'Cargo'], ['sla', 'SLA risk'], ['weather', 'Weather / constraints'], ['relations', 'Relationships'],
];

export function VizPane() {
  const { vizMode, setVizMode, layers, toggleLayer, view } = useOps();
  return (
    <section className="card"     aria-label={tr('Operational map')}>
      <div className="row between">
            <h2>{tr('Situational view')} {view.simulated && <Tag simulated />}</h2>
            <div role="group" aria-label={tr('2D / 3D toggle')} className="seg">
          <button aria-pressed={vizMode === '2d'} onClick={() => setVizMode('2d')}>2D</button>
          <button aria-pressed={vizMode === '3d'} onClick={() => setVizMode('3d')}>3D</button>
          <button aria-pressed={vizMode === 'gps'} onClick={() => setVizMode('gps')}>GPS</button>
        </div>
      </div>
      {vizMode !== 'gps' && <details className="layers">      <summary>{tr('Layers')}</summary>
              {LAYERS.map(([k, l]) => <label key={k}><input type="checkbox" checked={!!layers[k]} onChange={() => toggleLayer(k)} /> {tr(l)}</label>)}
      </details>}
      {vizMode === '2d' ? <Map2D /> : vizMode === '3d' ? <Scene3D /> : <GpsMap />}
      <p className="legend">{tr('Risk:')} <Badge level="Normal" /> <Badge level="Watch" /> <Badge level="AtRisk" /> <Badge level="Breach" /> · {tr('Layers hide rendering only; KPIs are unaffected.')}</p>
    </section>
  );
}

export function DetailPanel() {
  const { selection, view, select } = useOps();
  const b = view.b;
  if (!selection) return <aside className="card" aria-label={tr('Detail')}><h2>{tr('Detail')}</h2><p className="muted">{tr('Select a flight, stand, task, asset or exception to see details and related entities.')}</p></aside>;
  const rel = view.related(selection);
  const flights = b.flights.filter((f) => rel.has(f.id));
  const exs = b.exceptions.filter((e) => rel.has(e.id));
  const tasks = b.tasks.filter((t) => rel.has(t.id));
  const assets = b.assets.filter((a) => rel.has(a.id));
  const factors = [...rel].flatMap((i) => view.impact.factors[i] ?? []);
  return (
    <aside className="card"     aria-label={tr('Detail')}>
          <div className="row between"><h2>{tr(selection.kind)} {selection.id}</h2><button onClick={() => select(null)} aria-label={tr('Clear selection')}>✕</button></div>
          <h3>{tr('Flights')}</h3>
      <ul className="chips">{flights.map((f) => <li key={f.id}><button onClick={() => select({ kind: 'flight', id: f.id })}>{f.flightNo} @ {view.standOf(f)} <Badge level={view.turnRisk(b.turnarounds.find((t) => t.flightId === f.id)!.id)} /> {view.delay(f.id) ? `+${view.delay(f.id)}m` : ''}</button></li>)}</ul>
      <h3>{tr('Tasks')}</h3>
            <ul className="plain">{tasks.map((t) => <li key={t.id}>{trData(t.taskType)} · {tr(view.taskState(t.id))} {view.changed(t.id) && <Tag simulated />} · {view.ownerName(t.ownerId)} · {fmt(t.forecastTime)}</li>)}</ul>
            <h3>{tr('Assets')}</h3>
            <ul className="plain">{assets.map((a) => <li key={a.id}>{trData(a.type)} {a.id}: {tr(view.assetState(a.id))} {view.changed(a.id) && <Tag simulated />}</li>)}</ul>
            <h3>{tr('Exceptions')}</h3>
            <ul className="plain">{exs.map((e) => <li key={e.id}><button className="link" onClick={() => select({ kind: 'exception', id: e.id })}>{trData(e.type)}</button> <Badge level={view.severity(e)} kind="sev" /> · {view.ownerName(view.ownerIdOf(e))}</li>)}</ul>
            {factors.length > 0 && <><h3>{tr('Contributing factors')} <Tag simulated /></h3><ul className="plain">{factors.map((x, i) => <li key={i}>{trData(x)}</li>)}</ul></>}
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
    <section className="card"     aria-label={tr('Exception detail')}>
          <h2>{tr('Exception detail')} · {e.id} {view.changed(e.id) && <Tag simulated />}</h2>
          <p><Badge level={view.severity(e)} kind="sev" /> {trData(e.type)} — {tr('baseline severity {severity}. Detected {time} via {source}.', { severity: tr(e.severity), time: fmt(e.detectedAt), source: trData(e.source) })}</p>
      <p>{trData(e.explanation)}</p>
          <p>{tr('Owner:')} <strong>{view.ownerName(view.ownerIdOf(e))}</strong> · {tr('Lead stakeholder:')} {lead?.displayName ?? '—'} · {tr('Age {n} min', { n: view.b.now - e.detectedAt })} · {tr('Target {time}', { time: fmt(e.targetTime) })}</p>
      <ExceptionStepper id={e.id} />
          <p>{tr('Dependency chain:')} {chain.join(' → ')}</p>
      <ul className="plain">{act?.audit.map((a, i) => <li key={i}>{a}</li>)}</ul>
    </section>
  );
}
