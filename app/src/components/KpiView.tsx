import { useMemo } from 'react';
import { useOps } from '../storage/store';
import { actionRows, slaKpis, type ActionRow } from '../domain/kpi';
import { fmt } from '../domain/seed';
import { Badge } from './ui';

const STATE_LABEL = { met: '✓ Met', breached: '✖ Breached', pending: '… Pending' } as const;
const STATE_COLOR = { met: '#107c10', breached: '#a4262c', pending: '#605e5c' } as const;

function Cell({ min, state }: { min?: number; state: ActionRow['ackState'] }) {
  return <td style={{ color: STATE_COLOR[state] }}>{STATE_LABEL[state]}{min !== undefined ? ` · ${min} min` : ''}</td>;
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
    <section className="card" aria-label="Manager action KPIs">
      <h2>Manager action KPIs <small className="muted">· Changi time · now {fmt(baseline.now)}</small></h2>
      <div className="kpis" role="list">
        {kpis.map((k) => (
          <div key={k.key} className="kpi" role="listitem" style={{ cursor: 'default' }}>
            <span className="v">{k.pct === null ? '—' : `${k.pct}%`}</span>
            <span className="kl">{k.label}</span>
            <small>SLA {k.target} · {k.met} met · {k.breached} breached · {k.pending} pending</small>
          </div>
        ))}
      </div>

      <h3>By owner</h3>
      <table>
        <thead><tr><th>Owner</th><th>Exceptions</th><th>Acknowledged ≤ 2 min</th><th>Action ≤ 5 min</th><th>Breached</th></tr></thead>
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

      <h3>Recent actions</h3>
      <table>
        <thead><tr><th>Exception</th><th>Severity</th><th>Owner</th><th>Detected</th><th>Acknowledged (SLA 2 min)</th><th>Action (SLA 5 min)</th></tr></thead>
        <tbody>
          {recent.map((r) => (
            <tr key={r.id}>
              <td>{r.type}</td><td><Badge level={r.severity} kind="sev" /></td><td>{view.ownerName(r.ownerId)}</td><td>{fmt(r.detectedAt)}</td>
              <Cell min={r.ackMin} state={r.ackState} /><Cell min={r.actMin} state={r.actState} />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
