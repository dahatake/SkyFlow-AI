import { fmt } from '../domain/seed';
import { useState } from 'react';
import { useOps } from '../storage/store';
import { Badge, Tag } from './ui';
import { ExceptionPipeline, Gantt, TurnaroundPipeline, ViewSwitch, type ViewMode } from './Views';

export function Board({ defaultView = 'table' }: { defaultView?: ViewMode }) {
  const { view, select, selection, related } = useOps();
  const [mode, setMode] = useState<ViewMode>(defaultView);
  const rows = view.flights
    .slice()
    .sort((a, b) => a.sta - b.sta);
  return (
    <section className="card" aria-label="Live turnaround board">
      <div className="row between"><h2>Live turnaround board <small>({rows.length})</small></h2><ViewSwitch value={mode} onChange={setMode} modes={['table', 'gantt', 'pipeline']} /></div>
      {mode === 'gantt' && <Gantt />}
      {mode === 'pipeline' && <TurnaroundPipeline />}
      {mode === 'table' && <div className="scroll">
        <table>
          <thead>
            <tr><th>Flight</th><th>Airline</th><th>Stand</th><th>Status</th><th>Turnaround</th><th>SLA risk</th><th>Milestone</th><th>Owner</th><th>Exc.</th></tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const ta = view.b.turnarounds.find((t) => t.flightId === f.id)!;
              const ms = view.b.milestones.filter((m) => m.turnaroundId === ta.id).find((m) => m.status !== 'Complete');
              const ex = view.exceptionsFor(f.id).filter((e) => view.statusOf(e) !== 'Resolved');
              const task = view.b.tasks.find((t) => t.turnaroundId === ta.id);
              const delay = view.delay(f.id);
              const sel = selection?.id === f.id;
              return (
                <tr key={f.id} tabIndex={0} aria-selected={sel} className={sel ? 'sel' : related.has(f.id) ? 'rel' : ''}
                  onClick={() => select({ kind: 'flight', id: f.id })} onKeyDown={(e) => e.key === 'Enter' && select({ kind: 'flight', id: f.id })}>
                  <td><strong>{f.flightNo}</strong> <small>{f.origin}→{f.destination}</small></td>
                  <td>{view.airlineOf(f.id)?.code}</td>
                  <td>{view.standOf(f)}{view.moved(f) && <> <Tag simulated />↔{f.standId}</>}</td>
                  <td>{f.status}{delay ? <> <Tag simulated />+{delay}m</> : null}</td>
                  <td>{ta.phase}</td>
                  <td><Badge level={view.turnRisk(ta.id)} /></td>
                  <td>{ms ? `${ms.type} ${fmt(ms.forecastTime + (view.impact.milestoneShift[ms.id] ?? 0))}` : '—'}</td>
                  <td>{view.ownerName(task?.ownerId)}</td>
                  <td>{ex.length ? <span title={ex.map((e) => e.type).join(', ')}>⚠ {ex.length}</span> : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="muted">No flights match the current filters.</p>}
      </div>}
    </section>
  );
}

export function ExceptionQueue({ compact = false, defaultView = 'list' }: { compact?: boolean; defaultView?: ViewMode }) {
  const { view, select, selection, related, role } = useOps();
  const [mode, setMode] = useState<ViewMode>(defaultView);
  const list = view.exceptions;
  return (
    <section className="card" aria-label="Exception and ownership queue">
      <div className="row between"><h2>Exceptions &amp; ownership <small>({list.length})</small></h2><ViewSwitch value={mode} onChange={setMode} modes={['list', 'pipeline']} /></div>
      {mode === 'pipeline' && <ExceptionPipeline />}
      {mode === 'list' && <ul className="list">
        {list.slice(0, compact ? 6 : 99).map((e) => {
          const sev = view.severity(e);
          return (
            <li key={e.id} tabIndex={0} className={selection?.id === e.id ? 'sel' : related.has(e.id) ? 'rel' : ''}
              onClick={() => select({ kind: 'exception', id: e.id })} onKeyDown={(ev) => ev.key === 'Enter' && select({ kind: 'exception', id: e.id })}>
              <div><Badge level={sev} kind="sev" /> <strong>{e.type}</strong> {view.changed(e.id) && <Tag simulated />}</div>
              <div className="muted">{e.explanation}</div>
              <div className="muted">
                Owner: <strong className={view.ownerIdOf(e) ? '' : 'unassigned'}>{view.ownerName(view.ownerIdOf(e))}</strong> · {view.statusOf(e)} · detected {fmt(e.detectedAt)} ({e.source}) · next: {e.nextAction} by {fmt(e.targetTime)}
              </div>
              <div className="muted">Affects: {e.affectedEntityIds.slice(0, 4).join(', ')}</div>
            </li>
          );
        })}
      </ul>}
      {!list.length && <p className="muted">No exceptions match.</p>}
      {role === 'Observer' && <p className="muted">Read-only lens.</p>}
    </section>
  );
}
