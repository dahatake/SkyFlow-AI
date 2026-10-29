import { useMemo, useState } from 'react';
import { useOps } from '../storage/store';
import { dataQuality, delayPoints, exceptionHeatmap, fiveNumber, mean, pearson, staffUtilisation } from '../domain/analytics';
import { fmt } from '../domain/seed';
import { BoxPlots, BrushHistogram, GroupedBars, Heatmap, Scatter } from './AnalyticsCharts';
import { getLang, tr } from '../i18n';
import { airportName } from '../customers';
import { trData } from '../i18n/data';

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

/** Exploratory analytics: distribution, group comparison, relationship, composition and data quality over the whole baseline. */
export function AnalyticsView() {
  const { baseline } = useOps();
  const [range, setRange] = useState<[number, number] | null>(null);
  const all = useMemo(() => delayPoints(baseline), [baseline]);
  const allDelays = useMemo(() => all.map((p) => p.delayMin), [all]);
  const sel = useMemo(() => (range ? all.filter((p) => p.delayMin >= range[0] && p.delayMin <= range[1]) : all), [all, range]);
  const buName = (id: string) => trData(baseline.bus.find((b) => b.id === id)?.name ?? id);

  const overall = useMemo(() => fiveNumber(sel.map((p) => p.delayMin)), [sel]);
  const boxes = useMemo(() => baseline.bus.map((b) => ({ key: b.id, label: buName(b.id), stats: fiveNumber(sel.filter((p) => p.buId === b.id).map((p) => p.delayMin)) })).filter((d) => d.stats.n), [baseline, sel]);
  const heat = useMemo(() => exceptionHeatmap(baseline), [baseline]);
  const util = useMemo(() => staffUtilisation(baseline), [baseline]);
  const quality = useMemo(() => dataQuality(baseline), [baseline]);
  const r = pearson(sel.map((p) => p.plannedTime), sel.map((p) => p.delayMin));
  const late = sel.filter((p) => p.delayMin > 0).length;
  const worst = [...boxes].sort((a, b) => b.stats.median - a.stats.median)[0];
  const tight = [...util].filter((u) => u.utilisation !== null).sort((a, b) => b.utilisation! - a.utilisation!)[0];

  return (
    <section className="card" aria-label={tr('Data analytics')}>
      <h2>{tr('Data analytics')} <small className="muted">· {tr('{airport} time · now {time}', { airport: airportName(getLang()), time: fmt(baseline.now) })}</small></h2>
      <p className="muted">{tr('Explore the whole baseline: drag across the histogram to select a delay range and every linked chart and number updates.')}</p>

      <h3>{tr('Key findings')}</h3>
      <ul data-testid="analytics-findings">
        <li>{tr('{n} of {total} tasks selected; {late} forecast to slip, median slip {median} min.', { n: sel.length, total: all.length, late, median: overall.median.toFixed(1) })}</li>
        {worst && <li>{tr('Highest median slip: {bu} at {median} min.', { bu: worst.label, median: worst.stats.median.toFixed(1) })}</li>}
        {tight && <li>{tr('Tightest staffing: {bu} with {pct} of available staff engaged.', { bu: buName(tight.buId), pct: pct(tight.utilisation) })}</li>}
        <li>{tr('Correlation between planned time and slip: {r}.', { r: r === null ? '—' : r.toFixed(2) })}</li>
      </ul>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
        <div>
          <h3>{tr('Distribution of task slip')}</h3>
          <BrushHistogram values={allDelays} binSize={5} range={range} onRange={setRange} label={tr('Histogram of forecast slip in minutes per task')} />
          <button type="button" disabled={!range} onClick={() => setRange(null)}>{tr('Clear selection')}</button>
        </div>
        <div>
          <h3>{tr('Slip by business unit')}</h3>
          <BoxPlots data={boxes} unit={tr('min')} label={tr('Box plot of task slip by business unit')} />
        </div>
        <div>
          <h3>{tr('Planned time vs slip')}</h3>
          <Scatter points={sel.map((p) => ({ id: p.taskId, x: p.plannedTime, y: p.delayMin, group: p.priority - 1 }))}
            label={tr('Scatter of task slip against planned time')} xLabel={tr('Planned time')} yLabel={tr('Slip (min)')} xFmt={fmt} />
          <small className="muted">{tr('● priority 1 · ■ priority 2 · ▲ priority 3; dashed line is the linear trend.')}</small>
        </div>
        <div>
          <h3>{tr('Exceptions by type and severity')}</h3>
          <Heatmap cells={heat} label={tr('Heatmap of exception counts by type and severity')} />
        </div>
        <div>
          <h3>{tr('Staffing by business unit')}</h3>
          <GroupedBars data={util.map((u) => ({ label: buName(u.buId), planned: u.planned, available: u.available, engaged: u.engaged }))} label={tr('Planned, available and engaged staff per business unit')} />
        </div>
        <div>
          <h3>{tr('Data quality')}</h3>
          <table>
            <thead><tr><th>{tr('Entity')}</th><th>{tr('Records')}</th><th>{tr('Gaps')}</th><th>{tr('Completeness')}</th></tr></thead>
            <tbody>{quality.map((q) => <tr key={q.entity}><td>{tr(q.entity)}</td><td>{q.records}</td><td>{q.missing}</td><td>{pct(q.completeness)}{q.completeness < 0.9 ? ' ⚠' : ' ✓'}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <h3>{tr('Summary statistics')}</h3>
      <table>
        <thead><tr><th>{tr('Business unit')}</th><th>n</th><th>{tr('Mean')}</th><th>{tr('Median')}</th><th>Q1</th><th>Q3</th><th>{tr('Outliers')}</th></tr></thead>
        <tbody>
          {boxes.map((d) => (
            <tr key={d.key}><td>{d.label}</td><td>{d.stats.n}</td><td>{mean(sel.filter((p) => p.buId === d.key).map((p) => p.delayMin)).toFixed(1)}</td>
              <td>{d.stats.median.toFixed(1)}</td><td>{d.stats.q1.toFixed(1)}</td><td>{d.stats.q3.toFixed(1)}</td><td>{d.stats.outliers.length}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
