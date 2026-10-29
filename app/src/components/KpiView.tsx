import { useMemo } from 'react';
import { useOps } from '../storage/store';
import { actionRows, slaKpis, type ActionRow } from '../domain/kpi';
import { fmt } from '../domain/seed';
import { Badge } from './ui';
import { RingGauge } from './D3Charts';
import { tr } from '../i18n';
import { trData } from '../i18n/data';

const STATE_LABEL = { met: '✓ Met', breached: '✖ Breached', pending: '… Pending' } as const;
const STATE_COLOR = { met: '#107c10', breached: '#a4262c', pending: '#605e5c' } as const;

function Cell({ min, state }: { min?: number; state: ActionRow['ackState'] }) {
  return <td style={{ color: STATE_COLOR[state] }}>{tr(STATE_LABEL[state])}{min !== undefined ? ` · ${tr('{n} min', { n: min })}` : ''}</td>;
}

/** What actions managers (BU Ops or other owners) take on exceptions, measured against three SLAs. */
export function KpiView() {
  const { view, baseline } = useOps();
  const rows = useMemo(() => actionRows(view), [view]);
  const kpis = slaKpis(rows);
  const byOwner = new Map<string, ActionRow[]>();
  rows.forEach((r) => byOwner.set(r.ownerId ?? 'unassigned', [...(byOwner.get(r.ownerId ?? 'unassigned') ?? []), r]));
  const recent = rows.filter((r) => r.actAt !== undefined || r.ackAt !== undefined).sort((a, b) => (b.actAt ?? b.ackAt!) - (a.actAt ?? a.ackAt!)).slice(0, 15);

  return (
    <section className="card" aria-label={tr('Manager action KPIs')}>
      <h2>{tr('Manager action KPIs')} <small className="muted">· {tr('Changi time · now {time}', { time: fmt(baseline.now) })}</small></h2>
      <div className="kpis" role="list">
        {kpis.map((k) => (
          <div key={k.key} className="kpi" role="listitem" style={{ cursor: 'default' }}>
            <RingGauge pct={k.pct} label={k.label} />
            <span className="kl">{k.label}</span>
            <small>{tr('SLA {target} · {met} met · {breached} breached · {pending} pending', { target: k.target, met: k.met, breached: k.breached, pending: k.pending })}</small>
          </div>
        ))}
      </div>

      <h3>{tr('By owner')}</h3>
      <table>
        <thead><tr><th>{tr('Owner')}</th><th>{tr('Exceptions')}</th><th>{tr('Acknowledged ≤ 2 min')}</th><th>{tr('Action ≤ 5 min')}</th><th>{tr('Breached')}</th></tr></thead>
        <tbody>
          {[...byOwner.entries()].map(([o, list]) => {
            const k = slaKpis(list);
            const breached = list.filter((r) => r.ackState === 'breached' || r.actState === 'breached').length;
            return (
              <tr key={o}>
                <td className={o === 'unassigned' ? 'unassigned' : ''}>{view.ownerName(o === 'unassigned' ? undefined : o)}</td>
                <td>{list.length}</td><td>{k[0].pct === null ? '—' : `${k[0].pct}%`}</td><td>{k[1].pct === null ? '—' : `${k[1].pct}%`}</td><td>{breached}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3>{tr('Recent actions')}</h3>
      <table>
        <thead><tr><th>{tr('Exception')}</th><th>{tr('Severity')}</th><th>{tr('Owner')}</th><th>{tr('Detected')}</th><th>{tr('Acknowledged (SLA 2 min)')}</th><th>{tr('Action (SLA 5 min)')}</th></tr></thead>
        <tbody>
          {recent.map((r) => (
            <tr key={r.id}>
              <td>{trData(r.type)}</td><td><Badge level={r.severity} kind="sev" /></td><td>{view.ownerName(r.ownerId)}</td><td>{fmt(r.detectedAt)}</td>
              <Cell min={r.ackMin} state={r.ackState} /><Cell min={r.actMin} state={r.actState} />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
