import { useMemo, type ReactNode } from 'react';
import { GanttChart24Regular, Board24Regular, TableSimple24Regular, TextBulletListSquare24Regular, ArrowRight24Regular } from '@fluentui/react-icons';
import { fmt } from '../domain/seed';
import type { ExceptionState } from '../domain/types';
import { useOps } from '../storage/store';
import { Badge, RISK_COLOR, Tag } from './ui';
import { tr } from '../i18n';
import { trData } from '../i18n/data';

export type ViewMode = 'table' | 'gantt' | 'pipeline' | 'list';

export function ViewSwitch({ value, onChange, modes }: { value: ViewMode; onChange(v: ViewMode): void; modes: ViewMode[] }) {
  const meta: Record<ViewMode, [string, ReactNode]> = {
    table: ['Table', <TableSimple24Regular key="t" />], gantt: ['Gantt', <GanttChart24Regular key="g" />],
    pipeline: ['Pipeline', <Board24Regular key="p" />], list: ['List', <TextBulletListSquare24Regular key="l" />],
  };
  return (
    <div role="group"     aria-label={tr('Choose view')} className="seg small">
          {modes.map((m) => <button key={m} aria-pressed={value === m} onClick={() => onChange(m)} title={tr('{view} view', { view: tr(meta[m][0]) })}>{meta[m][1]} {tr(meta[m][0])}</button>)}
    </div>
  );
}

/** Turnaround Gantt: planned window, forecast milestones and live/scrubbed time markers. */
export function Gantt() {
  const { view, select, selection, related, timePos } = useOps();
  const b = view.b;
  const t0 = b.now - 60, t1 = b.now + 240;
  const pct = (t: number) => `${Math.max(0, Math.min(100, ((t - t0) / (t1 - t0)) * 100))}%`;
  const rows = view.flights.slice().sort((a, c) => a.sta - c.sta);
  const ticks = [] as number[];
  for (let t = Math.ceil(t0 / 30) * 30; t <= t1; t += 30) ticks.push(t);
  return (
    <div className="gantt" role="table"     aria-label={tr('Turnaround Gantt chart')}>
          <div className="g-head"><span>{tr('Flight')}</span><div className="track">{ticks.map((t) => <span key={t} className="tick" style={{ left: pct(t) }}>{fmt(t)}</span>)}</div></div>
      <div className="g-body">
        {rows.map((f) => {
          const ta = b.turnarounds.find((t) => t.flightId === f.id)!;
          const risk = view.turnRisk(ta.id);
          const delay = view.delay(f.id);
          const ms = b.milestones.filter((m) => m.turnaroundId === ta.id);
          const sel = selection?.id === f.id;
          return (
            <div key={f.id} role="row" tabIndex={0} className={`g-row ${sel ? 'sel' : related.has(f.id) ? 'rel' : ''}`}
              onClick={() => select({ kind: 'flight', id: f.id })} onKeyDown={(e) => e.key === 'Enter' && select({ kind: 'flight', id: f.id })}
              aria-label={tr('{flight} stand {stand} {phase} risk {risk}', { flight: f.flightNo, stand: view.standOf(f), phase: tr(ta.phase), risk: tr(risk) })}>
                            <span className="g-label"><strong>{f.flightNo}</strong> <small>{view.standOf(f)} · {tr(ta.phase)}</small></span>
              <div className="track">
                <div className="bar" style={{ left: pct(ta.plannedStart), width: `calc(${pct(ta.plannedEnd + delay)} - ${pct(ta.plannedStart)})`, background: RISK_COLOR[risk] }}                 title={`${fmt(ta.plannedStart)}–${fmt(ta.plannedEnd + delay)} · ${tr(risk)}${delay ? ' · ' + tr('+{n} min (Simulated)', { n: delay }) : ''}`}>
                                  <span className="bar-t">{risk === 'Normal' ? '' : tr(risk)}{delay ? ` +${delay}m` : ''}</span>
                </div>
                {ms.map((m) => {
                  const shift = view.impact.milestoneShift[m.id] ?? 0;
                  const late = m.forecastTime + shift > m.plannedTime;
                  return <span key={m.id} className={`ms ${late ? 'late' : ''}`} style={{ left: pct(m.forecastTime + shift) }} title={tr('{type}: plan {plan} → forecast {forecast}', { type: trData(m.type), plan: fmt(m.plannedTime), forecast: fmt(m.forecastTime + shift) })}>◆</span>;
                })}
              </div>
            </div>
          );
        })}
        <div className="now-line" style={{ left: `calc(130px + (100% - 130px) * ${(b.now - t0) / (t1 - t0)})` }} title={tr('Live {time}', { time: fmt(b.now) })}><span>{tr('Live {time}', { time: fmt(b.now) })}</span></div>
        {timePos !== null && <div className="now-line scrub" style={{ left: `calc(130px + (100% - 130px) * ${(timePos - t0) / (t1 - t0)})` }}><span>{fmt(timePos)}</span></div>}
      </div>
      {!rows.length &&       <p className="muted">{tr('No flights match the current filters.')}</p>}
            <p className="muted">{tr('Bars = planned turnaround window (colour + label = SLA risk). ◆ = milestone forecast (red when later than plan).')} <Tag simulated={view.simulated} /></p>
    </div>
  );
}

export interface Card { id: string; title: string; sub: string; badge?: ReactNode; kind: string; action?: ReactNode }

export function Pipeline({ columns, cards }: { columns: { key: string; label: string; hint: string }[]; cards: Record<string, Card[]> }) {
  const { select, selection, related } = useOps();
  return (
    <div className="pipeline" role="group"     aria-label={tr('Pipeline view')}>
      {columns.map((c, i) => (
            <section key={c.key} className="p-col" aria-label={`${tr(c.label)}: ${(cards[c.key] ?? []).length}`}>
              <header><strong>{tr(c.label)}</strong><span className="count">{(cards[c.key] ?? []).length}</span><small>{tr(c.hint)}</small>{i < columns.length - 1 && <ArrowRight24Regular className="chev" />}</header>
          <ul>
            {(cards[c.key] ?? []).slice(0, 8).map((k) => (
              <li key={k.id} tabIndex={0} className={`p-card ${selection?.id === k.id ? 'sel' : related.has(k.id) ? 'rel' : ''}`}
                onClick={() => select({ kind: k.kind, id: k.id })} onKeyDown={(e) => e.key === 'Enter' && select({ kind: k.kind, id: k.id })}>
                <div><strong>{k.title}</strong> {k.badge}</div><small>{k.sub}</small>{k.action}
              </li>
            ))}
            {(cards[c.key] ?? []).length > 8 && <li className="muted">{tr('+{n} more', { n: (cards[c.key] ?? []).length - 8 })}</li>}
          </ul>
        </section>
      ))}
    </div>
  );
}

export const EX_STAGES: { key: ExceptionState; label: string; hint: string }[] = [
  { key: 'New', label: 'Detected', hint: 'Needs acknowledgement' },
  { key: 'Acknowledged', label: 'Acknowledged', hint: 'Needs an owner' },
  { key: 'Assigned', label: 'Assigned', hint: 'Needs a plan' },
  { key: 'Monitoring', label: 'Acting', hint: 'In recovery' },
  { key: 'Resolved', label: 'Resolved', hint: 'Closed' },
];
export const nextState = (s: ExceptionState): ExceptionState | null => EX_STAGES[EX_STAGES.findIndex((x) => x.key === s) + 1]?.key ?? null;

export function ExceptionPipeline() {
  const { view, advance, role, baseline } = useOps();
  const can = role !== 'Observer';
  const cards = useMemo(() => {
    const out: Record<string, Card[]> = {};
    baseline.exceptions.forEach((e) => {
      const st = view.statusOf(e);
      if (view.exceptions.length && st !== 'Resolved' && !view.exceptions.some((x) => x.id === e.id)) return;
      const n = nextState(st);
      (out[st] ??= []).push({
        id: e.id, kind: 'exception', title: trData(e.type), sub: tr('{owner} · due {time}', { owner: view.ownerName(view.ownerIdOf(e)), time: fmt(e.targetTime) }),
        badge: <Badge level={view.severity(e)} kind="sev" />,
        action: n && can ? <button onClick={(ev) => { ev.stopPropagation(); advance([e.id], n, n === 'Assigned' && !view.ownerIdOf(e) ? 'u-sioc1' : undefined); }}>→ {tr(EX_STAGES.find((s) => s.key === n)!.label)}</button> : undefined,
      });
    });
    return out;
  }, [view, baseline, advance, can]);
  return <Pipeline columns={EX_STAGES} cards={cards} />;
}

const PHASES = [
  { key: 'NotStarted', label: 'Not started', hint: 'Waiting for aircraft' }, { key: 'Active', label: 'Active', hint: 'Servicing on stand' },
  { key: 'AtRisk', label: 'At risk', hint: 'Needs attention' }, { key: 'Blocked', label: 'Blocked', hint: 'Waiting on a dependency' }, { key: 'Complete', label: 'Complete', hint: 'Ready to depart' },
];

export function TurnaroundPipeline() {
  const { view } = useOps();
  const cards: Record<string, Card[]> = {};
  view.flights.forEach((f) => {
    const ta = view.b.turnarounds.find((t) => t.flightId === f.id)!;
    const risk = view.turnRisk(ta.id);
    // Simulated risk can promote a turnaround to a worse pipeline stage.
    const key = ta.phase === 'Complete' ? 'Complete' : risk === 'Breach' ? 'Blocked' : risk === 'AtRisk' ? 'AtRisk' : ta.phase === 'Blocked' || ta.phase === 'AtRisk' ? ta.phase : ta.phase;
    (cards[key] ??= []).push({ id: f.id, kind: 'flight', title: f.flightNo, sub: `${view.standOf(f)} · ${view.airlineOf(f.id)?.code}`, badge: <Badge level={risk} /> });
  });
  return <Pipeline columns={PHASES} cards={cards} />;
}
