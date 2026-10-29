import { useMemo, useState } from 'react';
import { CalendarLtr24Regular } from '@fluentui/react-icons';
import { CATEGORIES, DAY, WEEK, buildPlan, clock, currentWeek, dayLabel, usage, type PlanCategory, type PlanItem, type PlanResource, type Terminal } from '../domain/planning';
import { Tag } from './ui';
import { tr, useLang } from '../i18n';

const pct = (n: number) => `${Math.round(n * 100)}%`;
const TERMS: ('' | Terminal)[] = ['', 'T1', 'T2', 'T3', 'T4'];

/** Day / week resource plan for gates, staff, equipment, baggage belts and check-in rows, as Gantt chart or table. */
export function PlanningView() {
  const { lang } = useLang();
  const plan = useMemo(buildPlan, [lang]);
  const wk = useMemo(() => currentWeek(), []);
  const todayIdx = Math.min(6, Math.max(0, Math.floor(wk.nowMin / DAY)));
  const [scope, setScope] = useState<'day' | 'week'>('day');
  const [day, setDay] = useState(todayIdx);
  const [mode, setMode] = useState<'gantt' | 'table'>('gantt');
  const [cat, setCat] = useState<'' | PlanCategory>('Gate');
  const [term, setTerm] = useState<'' | Terminal>('');
  const [q, setQ] = useState('');
  const [selRaw, setSel] = useState<PlanItem | null>(null);
  const sel = selRaw ? plan.items.find((i) => i.id === selRaw.id) ?? null : null;

  const from = scope === 'day' ? day * DAY : 0;
  const to = scope === 'day' ? (day + 1) * DAY : WEEK;
  const itemsBy = useMemo(() => { const m = new Map<string, PlanItem[]>(); plan.items.forEach((i) => m.set(i.resourceId, [...(m.get(i.resourceId) ?? []), i])); return m; }, [plan]);
  const rows = useMemo(() => plan.resources
    .filter((r) => (!cat || r.category === cat) && (!term || r.terminal === term || (r.terminal === 'All' && cat === 'Staff')))
    .filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || (itemsBy.get(r.id) ?? []).some((i) => i.end > from && i.start < to && i.label.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.group.localeCompare(b.group) || a.name.localeCompare(b.name, undefined, { numeric: true })), [plan, cat, term, q, itemsBy, from, to]);
  const stats = useMemo(() => rows.map((r) => ({ r, u: usage(r, itemsBy.get(r.id) ?? [], from, to) })), [rows, itemsBy, from, to]);
  const avg = stats.length ? stats.reduce((s, x) => s + x.u.utilization, 0) / stats.length : 0;
  const conflicts = stats.reduce((s, x) => s + x.u.conflicts, 0);
  const nowPct = wk.nowMin >= from && wk.nowMin < to ? ((wk.nowMin - from) / (to - from)) * 100 : null;
  const ticks = scope === 'day' ? Array.from({ length: 12 }, (_, i) => ({ at: i * 2 * 60, label: clock(i * 120) })) : Array.from({ length: 7 }, (_, i) => ({ at: i * DAY, label: dayLabel(wk.start, i) }));

  const visible = (id: string) => (itemsBy.get(id) ?? []).filter((i) => i.end > from && i.start < to);
  const entries = useMemo(() => stats.flatMap(({ r }) => visible(r.id).map((i) => ({ r, i }))).sort((a, b) => a.i.start - b.i.start || a.r.name.localeCompare(b.r.name)), [stats]); // eslint-disable-line react-hooks/exhaustive-deps
  const when = (m: number) => `${dayLabel(wk.start, Math.floor(m / DAY))} ${clock(m)}`;

  return (
    <section className="card plan" aria-label={tr('Resource planning')}>
      <h2><CalendarLtr24Regular /> {tr('Resource planning')} {' '}<Tag simulated /></h2>
      <p className="muted">{tr('Who and what is scheduled when: gates, staff rosters, equipment, baggage belts and check-in rows for {from} – {to}. Sample data modelled on Changi (4 terminals, about 100 gates, 3-shift ground handling) with invented flights and rosters; replace with the real roster / AODB feed in production.', { from: dayLabel(wk.start, 0), to: dayLabel(wk.start, 6) })}</p>

      <div className="row plan-controls">
        <div className="seg" role="group" aria-label={tr('Time scope')}>
          <button aria-pressed={scope === 'day'} onClick={() => setScope('day')}>{tr('Day')}</button>
          <button aria-pressed={scope === 'week'} onClick={() => setScope('week')}>{tr('Week')}</button>
        </div>
        {scope === 'day' && <label>{tr('Date')} <select value={day} onChange={(e) => setDay(Number(e.target.value))}>{Array.from({ length: 7 }, (_, i) => <option key={i} value={i}>{dayLabel(wk.start, i)}{i === todayIdx ? ` ${tr('(today)')}` : ''}</option>)}</select></label>}
        <label>{tr('Resource')} <select value={cat} onChange={(e) => setCat(e.target.value as '' | PlanCategory)}><option value="">{tr('All types')}</option>{CATEGORIES.map((c) => <option key={c} value={c}>{tr(c)}</option>)}</select></label>
        <label>{tr('Terminal')} <select value={term} onChange={(e) => setTerm(e.target.value as '' | Terminal)}>{TERMS.map((t) => <option key={t} value={t}>{t || tr('All')}</option>)}</select></label>
        <label>{tr('Search')} <input type="search" value={q} placeholder={tr('gate, team, flight…')} onChange={(e) => setQ(e.target.value)} /></label>
        <div className="seg" role="group" aria-label={tr('View type')}>
          <button aria-pressed={mode === 'gantt'} onClick={() => setMode('gantt')}>{tr('Gantt')}</button>
          <button aria-pressed={mode === 'table'} onClick={() => setMode('table')}>{tr('Table')}</button>
        </div>
      </div>

      <div className="plan-kpis" role="status">
        <span>{tr('{n} resources', { n: rows.length })}</span>
        <span>{tr('{n} scheduled items', { n: stats.reduce((s, x) => s + x.u.items, 0) })}</span>
        <span>{tr('average use {pct}', { pct: pct(avg) })}</span>
        <span className={conflicts ? 'over' : ''}>{tr('{n} conflicting items', { n: conflicts })}</span>
      </div>

      {mode === 'gantt' ? (
        <div className="gantt" role="table" aria-label={tr('Gantt chart, {scope}', { scope: tr(scope === 'day' ? 'day' : 'week') })}>
          <div className="g-row g-head" role="row">
            <div className="g-label" role="columnheader">{tr('Resource · capacity')}</div>
            <div className="g-track" role="columnheader">{ticks.map((t) => <span key={t.at} className="g-tick" style={{ left: `${((t.at - (scope === 'day' ? 0 : 0)) / (to - from)) * 100}%` }}>{t.label}</span>)}</div>
          </div>
          {stats.map(({ r, u }, idx) => (
            <div key={r.id}>
              {(idx === 0 || stats[idx - 1].r.category !== r.category || stats[idx - 1].r.group !== r.group) &&               <div className="g-group">{tr(r.category)} · {r.group}</div>}
              <div className="g-row" role="row">
                              <div className="g-label" role="rowheader" title={tr('{name}: capacity {cap} {unit}, owner {owner}', { name: r.name, cap: r.capacity, unit: r.unit, owner: r.owner })}>
                                <b>{r.name}</b><small>{tr('{cap} {unit} · {pct} used', { cap: r.capacity, unit: r.unit, pct: pct(u.utilization) })}{u.conflicts ? ` · ⚠ ${u.conflicts}` : ''}</small>
                </div>
                <div className="g-track" role="cell">
                  {ticks.map((t) => <i key={t.at} className="g-grid" style={{ left: `${((t.at) / (to - from)) * 100}%` }} />)}
                  {nowPct !== null && <i className="g-now" style={{ left: `${nowPct}%` }} aria-hidden="true" />}
                  {visible(r.id).map((i) => {
                    const l = (Math.max(i.start, from) - from) / (to - from) * 100, w = (Math.min(i.end, to) - Math.max(i.start, from)) / (to - from) * 100;
                    return <button key={i.id} className={`g-bar k-${i.kind} ${i.conflict ? 'bad' : ''} ${sel?.id === i.id ? 'on' : ''}`} style={{ left: `${l}%`, width: `${w}%` }} title={`${i.label} · ${when(i.start)}–${clock(i.end)}${i.conflict ? ` · ${tr('CONFLICT')}` : ''}`} onClick={() => setSel(i)}>{scope === 'day' || w > 3 ? i.label : ''}</button>;
                  })}
                </div>
              </div>
            </div>
          ))}
          {!stats.length && <p className="muted">{tr('No resources match the filters.')}</p>}
        </div>
      ) : (
        <>
          <h3>{tr('Resource summary')}</h3>
          <div className="tbl-wrap"><table><thead><tr><th>{tr('Resource')}</th><th>{tr('Type')}</th><th>{tr('Terminal')}</th><th>{tr('Owner')}</th><th>{tr('Capacity')}</th><th>{tr('Items')}</th><th>{tr('Booked h')}</th><th>{tr('Use')}</th>{scope === 'week' && Array.from({ length: 7 }, (_, i) => <th key={i}>{dayLabel(wk.start, i).split(' ')[0]}</th>)}<th>{tr('Conflicts')}</th></tr></thead><tbody>
            {stats.map(({ r, u }) => (
              <tr key={r.id}><td>{r.name}</td><td>{tr(r.category)}</td><td>{tr(r.terminal)}</td><td>{r.owner}</td><td>{r.capacity} {r.unit}</td><td>{u.items}</td><td>{u.bookedHours}</td><td><meter min={0} max={1} low={0.4} high={0.85} value={u.utilization} aria-label={tr('{name} use {pct}', { name: r.name, pct: pct(u.utilization) })} /> {pct(u.utilization)}</td>
                {scope === 'week' && Array.from({ length: 7 }, (_, d) => <td key={d}>{pct(usage(r, itemsBy.get(r.id) ?? [], d * DAY, (d + 1) * DAY).utilization)}</td>)}
                <td className={u.conflicts ? 'over' : ''}>{u.conflicts || '–'}</td></tr>
            ))}
          </tbody></table></div>
          <h3>{tr(entries.length > 300 ? 'Schedule ({n}, first 300 shown)' : 'Schedule ({n})', { n: entries.length })}</h3>
          <div className="tbl-wrap"><table><thead><tr><th>{tr('Start')}</th><th>{tr('End')}</th><th>{tr('Resource')}</th><th>{tr('Kind')}</th><th>{tr('Item')}</th><th>{tr('Load')}</th><th>{tr('Detail')}</th></tr></thead><tbody>
            {entries.slice(0, 300).map(({ r, i }: { r: PlanResource; i: PlanItem }) => (
              <tr key={i.id} className={i.conflict ? 'over' : ''}><td>{when(i.start)}</td><td>{clock(i.end)}</td><td>{r.name}</td><td>{tr(i.kind)}</td><td>{i.label}{i.conflict ? ' ⚠' : ''}</td><td>{i.load}{r.category === 'Staff' ? ` / ${r.capacity}` : ''}</td><td className="wrap">{i.detail}</td></tr>
            ))}
          </tbody></table></div>
        </>
      )}

      {sel && (
        <aside className="plan-detail" role="status" aria-label={tr('Selected item')}>
          <b>{sel.label}</b> · {tr(sel.kind)} · {when(sel.start)} – {clock(sel.end)}{sel.conflict && <span className="over"> · {tr('conflict: overlaps another booking or exceeds capacity')}</span>}
          <div className="muted">{plan.resources.find((r) => r.id === sel.resourceId)?.name} — {sel.detail}</div>
          <button onClick={() => setSel(null)}>{tr('Close')}</button>
        </aside>
      )}
      <p className="muted legend"><span className="sw k-Flight" /> {tr('Flight on gate')} <span className="sw k-Shift" /> {tr('Staff shift')} <span className="sw k-Task" /> {tr('Equipment task')} <span className="sw k-Allocation" /> {tr('Belt / check-in')} <span className="sw k-Maintenance" /> {tr('Maintenance')} <span className="sw bad" /> {tr('Conflict')}</p>
    </section>
  );
}
