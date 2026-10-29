import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { tr } from '../i18n';
import type { FiveNumber, HeatCell } from '../domain/analytics';
import { SEVERITY_ORDER } from '../domain/types';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const dur = () => (reduced() ? 0 : 600);
const AXIS = '#605e5c';

function useSvg(draw: (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => void, deps: unknown[]) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = d3.select(ref.current!);
    svg.selectAll('*').remove();
    draw(svg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/** Histogram of values with a brush: dragging selects a range that filters every linked chart. */
export function BrushHistogram({ values, binSize, range, onRange, label }: { values: number[]; binSize: number; range: [number, number] | null; onRange: (r: [number, number] | null) => void; label: string }) {
  const W = 560, H = 220, m = { t: 10, r: 10, b: 36, l: 36 };
  const ref = useSvg((svg) => {
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    if (!values.length) return;
    const lo = Math.floor(d3.min(values)! / binSize) * binSize;
    const hi = Math.max(Math.ceil((d3.max(values)! + 1) / binSize) * binSize, lo + binSize);
    const x = d3.scaleLinear().domain([lo, hi]).range([m.l, W - m.r]);
    const bins = d3.bin().domain([lo, hi]).thresholds(d3.range(lo, hi, binSize))(values);
    const y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.length) || 1]).nice().range([H - m.b, m.t]);
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(8)).attr('color', AXIS);
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5)).attr('color', AXIS);
    svg.append('text').attr('x', W / 2).attr('y', H - 4).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', AXIS).text(label);
    const bars = svg.append('g').selectAll('rect').data(bins).join('rect')
      .attr('x', (b) => x(b.x0!) + 1).attr('width', (b) => Math.max(0, x(b.x1!) - x(b.x0!) - 2))
      .attr('y', H - m.b).attr('height', 0).attr('fill', '#0f6cbd');
    bars.append('title').text((b) => `${b.x0}–${b.x1}: ${b.length}`);
    bars.transition().duration(dur()).attr('y', (b) => y(b.length)).attr('height', (b) => H - m.b - y(b.length));
    const brush = d3.brushX().extent([[m.l, m.t], [W - m.r, H - m.b]]).on('end', (e: d3.D3BrushEvent<unknown>) => {
      if (!e.sourceEvent) return;
      onRange(e.selection ? [x.invert(e.selection[0] as number), x.invert(e.selection[1] as number)] : null);
    });
    const g = svg.append('g').call(brush);
    if (range) g.call(brush.move, [x(range[0]), x(range[1])]);
  }, [values, binSize, label, range === null]);
  return <svg ref={ref} style={{ width: '100%', maxWidth: 560 }} role="img" aria-label={label} />;
}

export interface BoxDatum { key: string; label: string; stats: FiveNumber }

/** Horizontal box plots (median, IQR, whiskers at 1.5 IQR, outlier dots) per group. */
export function BoxPlots({ data, label, unit }: { data: BoxDatum[]; label: string; unit: string }) {
  const rowH = 34, W = 560, m = { l: 130, r: 16, t: 8, b: 30 };
  const H = data.length * rowH + m.t + m.b;
  const ref = useSvg((svg) => {
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    const all = data.flatMap((d) => [d.stats.min, d.stats.max]);
    if (!all.length) return;
    const x = d3.scaleLinear().domain([Math.min(0, d3.min(all)!), Math.max(1, d3.max(all)!)]).nice().range([m.l, W - m.r]);
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(8)).attr('color', AXIS);
    svg.append('text').attr('x', W - m.r).attr('y', H - 2).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', AXIS).text(unit);
    data.forEach((d, i) => {
      const cy = m.t + i * rowH + rowH / 2, s = d.stats;
      const g = svg.append('g').attr('opacity', 0);
      g.append('title').text(`${d.label}: n=${s.n}, ${tr('median')} ${s.median.toFixed(1)}, Q1 ${s.q1.toFixed(1)}, Q3 ${s.q3.toFixed(1)}, ${tr('outliers')} ${s.outliers.length}`);
      svg.append('text').attr('x', 0).attr('y', cy + 4).attr('font-size', 12).attr('fill', '#323130').text(d.label.length > 18 ? `${d.label.slice(0, 17)}…` : d.label);
      if (s.n) {
        g.append('line').attr('x1', x(s.lowFence)).attr('x2', x(s.highFence)).attr('y1', cy).attr('y2', cy).attr('stroke', '#323130');
        g.append('rect').attr('x', x(s.q1)).attr('width', Math.max(2, x(s.q3) - x(s.q1))).attr('y', cy - 10).attr('height', 20).attr('fill', '#c7e0f4').attr('stroke', '#0f6cbd');
        g.append('line').attr('x1', x(s.median)).attr('x2', x(s.median)).attr('y1', cy - 10).attr('y2', cy + 10).attr('stroke', '#0f6cbd').attr('stroke-width', 3);
        g.selectAll('path.o').data(s.outliers).join('path').attr('transform', (v) => `translate(${x(v)},${cy})`)
          .attr('d', d3.symbol(d3.symbolDiamond, 40)()!).attr('fill', '#a4262c');
      }
      g.transition().delay(reduced() ? 0 : i * 60).duration(dur()).attr('opacity', 1);
    });
  }, [data, unit]);
  return <svg ref={ref} style={{ width: '100%', maxWidth: 560 }} role="img" aria-label={label} />;
}

/** Type x severity heatmap. Each cell prints its count so colour is never the only channel. */
export function Heatmap({ cells, label }: { cells: HeatCell[]; label: string }) {
  const types = [...new Set(cells.map((c) => c.type))];
  const cw = 78, rh = 28, m = { l: 150, t: 28 };
  const W = m.l + cw * SEVERITY_ORDER.length + 8, H = m.t + rh * types.length + 8;
  const ref = useSvg((svg) => {
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    const max = d3.max(cells, (c) => c.count) || 1;
    const color = d3.scaleSequential(d3.interpolateBlues).domain([0, max * 1.2]);
    SEVERITY_ORDER.forEach((s, i) => svg.append('text').attr('x', m.l + i * cw + cw / 2).attr('y', 18).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', AXIS).text(tr(s)));
    types.forEach((t, r) => svg.append('text').attr('x', 0).attr('y', m.t + r * rh + rh / 2 + 4).attr('font-size', 12).attr('fill', '#323130').text(tr(t).length > 22 ? `${tr(t).slice(0, 21)}…` : tr(t)));
    const g = svg.selectAll('g.c').data(cells).join('g').attr('transform', (c) => `translate(${m.l + SEVERITY_ORDER.indexOf(c.severity) * cw},${m.t + types.indexOf(c.type) * rh})`);
    g.append('rect').attr('width', cw - 3).attr('height', rh - 3).attr('rx', 3).attr('fill', (c) => (c.count ? color(c.count) : '#f3f2f1')).attr('opacity', 0).transition().duration(dur()).attr('opacity', 1);
    g.append('text').attr('x', (cw - 3) / 2).attr('y', (rh - 3) / 2 + 4).attr('text-anchor', 'middle').attr('font-size', 12).attr('font-weight', 600)
      .attr('fill', (c) => (c.count > max * 0.55 ? '#fff' : '#201f1e')).text((c) => c.count || '·');
    g.append('title').text((c) => `${c.type} · ${tr(c.severity)}: ${c.count}`);
  }, [cells]);
  return <svg ref={ref} style={{ width: '100%', maxWidth: W }} role="img" aria-label={label} />;
}

export interface Pt { id: string; x: number; y: number; group: number }

/** Scatter with a least-squares trend line; marker shape encodes the group in addition to colour. */
export function Scatter({ points, label, xLabel, yLabel, xFmt }: { points: Pt[]; label: string; xLabel: string; yLabel: string; xFmt: (n: number) => string }) {
  const W = 560, H = 240, m = { t: 10, r: 14, b: 38, l: 42 };
  const ref = useSvg((svg) => {
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    if (!points.length) return;
    const x = d3.scaleLinear().domain(d3.extent(points, (p) => p.x) as [number, number]).nice().range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain(d3.extent(points, (p) => p.y) as [number, number]).nice().range([H - m.b, m.t]);
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(6).tickFormat((v) => xFmt(+v))).attr('color', AXIS);
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6)).attr('color', AXIS);
    svg.append('text').attr('x', W / 2).attr('y', H - 4).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', AXIS).text(xLabel);
    svg.append('text').attr('transform', `translate(11,${H / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', AXIS).text(yLabel);
    const shapes = [d3.symbolCircle, d3.symbolSquare, d3.symbolTriangle];
    const colors = ['#a4262c', '#c19c00', '#107c10'];
    svg.append('g').selectAll('path').data(points).join('path')
      .attr('transform', (p) => `translate(${x(p.x)},${y(p.y)})`)
      .attr('d', (p) => d3.symbol(shapes[p.group % 3], 36)()!).attr('fill', (p) => colors[p.group % 3]).attr('fill-opacity', 0.65)
      .append('title').text((p) => `${p.id}: ${xFmt(p.x)}, ${p.y} min`);
    const n = points.length, sx = d3.sum(points, (p) => p.x), sy = d3.sum(points, (p) => p.y);
    const sxy = d3.sum(points, (p) => p.x * p.y), sxx = d3.sum(points, (p) => p.x * p.x);
    const den = n * sxx - sx * sx;
    if (n > 2 && den !== 0) {
      const slope = (n * sxy - sx * sy) / den, icpt = (sy - slope * sx) / n;
      const [a, b] = x.domain();
      svg.append('line').attr('x1', x(a)).attr('x2', x(b)).attr('y1', y(icpt + slope * a)).attr('y2', y(icpt + slope * b))
        .attr('stroke', '#323130').attr('stroke-dasharray', '5 4').attr('stroke-width', 1.5);
    }
  }, [points, xLabel, yLabel]);
  return <svg ref={ref} style={{ width: '100%', maxWidth: 560 }} role="img" aria-label={label} />;
}

export interface UtilDatum { label: string; planned: number; available: number; engaged: number }

/** Grouped bars: planned vs available vs engaged headcount per business unit. */
export function GroupedBars({ data, label }: { data: UtilDatum[]; label: string }) {
  const W = 560, H = 240, m = { t: 24, r: 10, b: 34, l: 36 };
  const keys = ['planned', 'available', 'engaged'] as const;
  const names = { planned: tr('Planned'), available: tr('Available'), engaged: tr('Engaged') };
  const colors = { planned: '#8a8886', available: '#0f6cbd', engaged: '#107c10' };
  const ref = useSvg((svg) => {
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    if (!data.length) return;
    const x0 = d3.scaleBand().domain(data.map((d) => d.label)).range([m.l, W - m.r]).paddingInner(0.2);
    const x1 = d3.scaleBand().domain(keys as unknown as string[]).range([0, x0.bandwidth()]).padding(0.08);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => Math.max(d.planned, d.available, d.engaged)) || 1]).nice().range([H - m.b, m.t]);
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x0).tickFormat((v) => (v.length > 12 ? `${v.slice(0, 11)}…` : v))).attr('color', AXIS);
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5)).attr('color', AXIS);
    keys.forEach((k, i) => {
      svg.append('rect').attr('x', m.l + i * 90).attr('y', 4).attr('width', 10).attr('height', 10).attr('fill', colors[k]);
      svg.append('text').attr('x', m.l + i * 90 + 14).attr('y', 13).attr('font-size', 11).attr('fill', AXIS).text(names[k]);
    });
    const g = svg.append('g').selectAll('g').data(data).join('g').attr('transform', (d) => `translate(${x0(d.label)},0)`);
    keys.forEach((k) => {
      g.append('rect').attr('x', x1(k)!).attr('width', x1.bandwidth()).attr('fill', colors[k]).attr('y', H - m.b).attr('height', 0)
        .attr('data-key', k).transition().duration(dur()).attr('y', (d) => y(d[k])).attr('height', (d) => H - m.b - y(d[k]));
      g.append('text').attr('x', x1(k)! + x1.bandwidth() / 2).attr('y', (d) => y(d[k]) - 3).attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#323130').text((d) => d[k]);
    });
  }, [data]);
  return <svg ref={ref} style={{ width: '100%', maxWidth: 560 }} role="img" aria-label={label} />;
}
