import { fmt } from '../domain/seed';
import { useState } from 'react';
import { useOps } from '../storage/store';
import { Badge, Tag } from './ui';
import { tr } from '../i18n';
import { trData } from '../i18n/data';
import { ExceptionPipeline, Gantt, TurnaroundPipeline, ViewSwitch, type ViewMode } from './Views';

export function Board({ defaultView = 'table' }: { defaultView?: ViewMode }) {
  const { view, select, selection, related } = useOps();
  const [mode, setMode] = useState<ViewMode>(defaultView);
  const rows = view.flights
    .slice()
    .sort((a, b) => a.sta - b.sta);
  return (
    <section className="card"     aria-label={tr('Live turnaround board')}>
          <div className="row between"><h2>{tr('Live turnaround board')} <small>({rows.length})</small></h2><ViewSwitch value={mode} onChange={setMode} modes={['table', 'gantt', 'pipeline']} /></div>
      {mode === 'gantt' && <Gantt />}
      {mode === 'pipeline' && <TurnaroundPipeline />}
      {mode === 'table' && <div className="scroll">
        <table>
          <thead>
            <tr><th>{tr('Flight')}</th><th>{tr('Airline')}</th><th>{tr('Stand')}</th><th>{tr('Status')}</th><th>{tr('Turnaround')}</th><th>{tr('SLA risk')}</th><th>{tr('Milestone')}</th><th>{tr('Owner')}</th><th>{tr('Exc.')}</th></tr>
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
                  <td>{tr(f.status)}{delay ? <> <Tag simulated />+{delay}m</> : null}</td>
                                    <td>{tr(ta.phase)}</td>
                  <td><Badge level={view.turnRisk(ta.id)} /></td>
                                    <td>{ms ? `${trData(ms.type)} ${fmt(ms.forecastTime + (view.impact.milestoneShift[ms.id] ?? 0))}` : '—'}</td>
                  <td>{view.ownerName(task?.ownerId)}</td>
                                    <td>{ex.length ? <span title={ex.map((e) => trData(e.type)).join(', ')}>⚠ {ex.length}</span> : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="muted">{tr('No flights match the current filters.')}</p>}
      </div>}
    </section>
  );
}

export function ExceptionQueue({ compact = false, defaultView = 'list' }: { compact?: boolean; defaultView?: ViewMode }) {
  const { view, select, selection, related, role } = useOps();
  const [mode, setMode] = useState<ViewMode>(defaultView);
  const list = view.exceptions;
  return (
    <section className="card"     aria-label={tr('Exception and ownership queue')}>
          <div className="row between"><h2>{tr('Exceptions & ownership')} <small>({list.length})</small></h2><ViewSwitch value={mode} onChange={setMode} modes={['list', 'pipeline']} /></div>
      {mode === 'pipeline' && <ExceptionPipeline />}
      {mode === 'list' && <ul className="list">
        {list.slice(0, compact ? 6 : 99).map((e) => {
          const sev = view.severity(e);
          return (
            <li key={e.id} tabIndex={0} className={selection?.id === e.id ? 'sel' : related.has(e.id) ? 'rel' : ''}
              onClick={() => select({ kind: 'exception', id: e.id })} onKeyDown={(ev) => ev.key === 'Enter' && select({ kind: 'exception', id: e.id })}>
              <div><Badge level={sev} kind="sev" />               <strong>{trData(e.type)}</strong> {view.changed(e.id) && <Tag simulated />}</div>
              <div className="muted">{trData(e.explanation)}</div>
              <div className="muted">
                              {tr('Owner:')} <strong className={view.ownerIdOf(e) ? '' : 'unassigned'}>{view.ownerName(view.ownerIdOf(e))}</strong> · {tr(view.statusOf(e))} · {tr('detected {time} ({source}) · next: {action} by {target}', { time: fmt(e.detectedAt), source: trData(e.source), action: trData(e.nextAction), target: fmt(e.targetTime) })}
              </div>
                            <div className="muted">{tr('Affects:')} {e.affectedEntityIds.slice(0, 4).join(', ')}</div>
            </li>
          );
        })}
      </ul>}
                    {!list.length && <p className="muted">{tr('No exceptions match.')}</p>}
                    {role === 'Observer' && <p className="muted">{tr('Read-only lens.')}</p>}
    </section>
  );
}
