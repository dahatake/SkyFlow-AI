import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animated ring gauge: sweeps up to the value with a color that shifts from red to green. */
export function RingGauge({ pct, label, size = 120 }: { pct: number | null; label: string; size?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = d3.select(ref.current!);
    svg.selectAll('*').remove();
    const r = size / 2;
    const arc = d3.arc<{ end: number }>().innerRadius(r - 14).outerRadius(r - 4).startAngle(0).endAngle((d) => d.end).cornerRadius(6);
    const g = svg.append('g').attr('transform', `translate(${r},${r})`);
    g.append('path').datum({ end: Math.PI * 2 }).attr('d', arc).attr('fill', '#e1dfdd');
    const value = pct ?? 0;
    const color = d3.scaleLinear<string>().domain([0, 60, 100]).range(['#a4262c', '#c19c00', '#107c10']).clamp(true);
    const fg = g.append('path').datum({ end: 0 }).attr('fill', color(value));
    fg.attr('d', arc);
    const text = g.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', size / 4).attr('font-weight', 700).attr('fill', '#201f1e');
    const target = (value / 100) * Math.PI * 2;
    if (pct === null) { text.text('—'); return; }
    if (reduced()) { fg.datum({ end: target }).attr('d', arc); text.text(`${value}%`); return; }
    fg.transition().duration(1100).ease(d3.easeCubicOut)
      .attrTween('d', () => { const i = d3.interpolate(0, target); return (t) => arc({ end: i(t) }) ?? ''; });
    text.transition().duration(1100).ease(d3.easeCubicOut)
      .tween('text', function () { const i = d3.interpolateRound(0, value); return (t) => { this.textContent = `${i(t)}%`; }; });
  }, [pct, size]);
  return <svg ref={ref} width={size} height={size} role="img" aria-label={`${label}: ${pct === null ? 'n/a' : `${pct}%`}`} />;
}

export interface BarDatum { label: string; before: number; after: number }

/** Animated before/after bars with a hover highlight. */
export function BeforeAfterBars({ data, format }: { data: BarDatum[]; format: (n: number) => string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const W = 560, rowH = 44, left = 150, H = Math.max(1, data.length) * rowH + 8;
    const svg = d3.select(ref.current!).attr('viewBox', `0 0 ${W} ${H}`);
    svg.selectAll('*').remove();
    const max = d3.max(data, (d) => Math.max(d.before, d.after)) || 1;
    const x = d3.scaleLinear().domain([0, max]).range([0, W - left - 70]);
    const animate = !reduced();
    data.forEach((d, i) => {
      const g = svg.append('g').attr('transform', `translate(0,${i * rowH + 4})`).style('cursor', 'default');
      g.append('text').attr('x', 0).attr('y', 24).attr('font-size', 12).attr('fill', '#323130').text(d.label.length > 22 ? `${d.label.slice(0, 21)}…` : d.label).append('title').text(d.label);
      ([['before', '#a4262c', 4], ['after', '#107c10', 21]] as const).forEach(([k, c, y]) => {
        const bar = g.append('rect').attr('x', left).attr('y', y).attr('height', 14).attr('rx', 7).attr('fill', c).attr('opacity', 0.85);
        const lab = g.append('text').attr('y', y + 11).attr('font-size', 11).attr('fill', '#323130');
        const w = Math.max(2, x(d[k]));
        lab.attr('x', left + w + 6).text(format(d[k]));
        if (animate) {
          bar.attr('width', 0).transition().delay(i * 90).duration(800).ease(d3.easeCubicOut).attr('width', w);
          lab.attr('opacity', 0).transition().delay(i * 90 + 500).duration(300).attr('opacity', 1);
        } else bar.attr('width', w);
      });
      g.on('mouseenter', () => g.selectAll('rect').attr('opacity', 1)).on('mouseleave', () => g.selectAll('rect').attr('opacity', 0.85));
    });
  }, [data, format]);
  return <svg ref={ref} style={{ width: '100%', maxWidth: 560 }} role="img" aria-label="Before and after comparison" />;
}
