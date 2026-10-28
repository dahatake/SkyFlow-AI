import { useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { useOps } from '../storage/store';
import { RISK_COLOR, SLA_GLYPH } from './ui';

const FULL = { x: 0, y: 0, w: 100, h: 80 };

export function Map2D() {
  const { view, layers, selection, related, select } = useOps();
  const [vb, setVb] = useState(FULL);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const b = view.b;
  const zoom = FULL.w / vb.w;
  const cluster = zoom < 1.6;
  const svg = useRef<SVGSVGElement>(null);

  const zoomBy = (k: number, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2) => {
    const w = Math.min(FULL.w, Math.max(10, vb.w / k));
    const h = w * (FULL.h / FULL.w);
    setVb({ x: cx - ((cx - vb.x) / vb.w) * w, y: cy - ((cy - vb.y) / vb.h) * h, w, h });
  };
  const toWorld = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: vb.x + ((e.clientX - r.left) / r.width) * vb.w, y: vb.y + ((e.clientY - r.top) / r.height) * vb.h };
  };
  const onWheel = (e: WheelEvent) => { const p = toWorld(e); zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, p.x, p.y); };
  const onDown = (e: PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY }; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onMove = (e: PointerEvent) => {
    if (!drag.current) return;
    const r = svg.current!.getBoundingClientRect();
    const dx = ((e.clientX - drag.current.x) / r.width) * vb.w;
    const dy = ((e.clientY - drag.current.y) / r.height) * vb.h;
    drag.current = { x: e.clientX, y: e.clientY };
    setVb((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
  };
  const fitSelected = () => {
    const ids = [...related];
    const st = b.stands.filter((s) => ids.includes(s.id));
    if (!st.length) return setVb(FULL);
    const xs = st.map((s) => s.x), ys = st.map((s) => s.y);
    const w = Math.max(30, Math.max(...xs) - Math.min(...xs) + 24);
    setVb({ x: (Math.min(...xs) + Math.max(...xs)) / 2 - w / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 - (w * 0.8) / 2, w, h: w * 0.8 });
  };
  const keys = (e: React.KeyboardEvent) => {
    const s = vb.w * 0.1;
    if (e.key === '+' || e.key === '=') zoomBy(1.2);
    else if (e.key === '-') zoomBy(1 / 1.2);
    else if (e.key === '0') setVb(FULL);
    else if (e.key === 'ArrowLeft') setVb((v) => ({ ...v, x: v.x - s }));
    else if (e.key === 'ArrowRight') setVb((v) => ({ ...v, x: v.x + s }));
    else if (e.key === 'ArrowUp') setVb((v) => ({ ...v, y: v.y - s }));
    else if (e.key === 'ArrowDown') setVb((v) => ({ ...v, y: v.y + s }));
  };

  const visibleFlights = new Set(view.flights.map((f) => f.id));
  const standRisk = (id: string) => {
    const lv = b.flights.filter((f) => view.standOf(f) === id && visibleFlights.has(f.id)).map((f) => view.turnRisk(b.turnarounds.find((t) => t.flightId === f.id)!.id));
    return (['Breach', 'AtRisk', 'Watch', 'Normal'] as const).find((l) => lv.includes(l));
  };
  const standById = (id: string) => b.stands.find((s) => s.id === id)!;
  const pierY = (p: string) => b.stands.find((s) => s.pier === p)!.y;
  const cons = [...b.constraints, ...view.impact.constraints];
  const relLines = layers.relations && selection ? b.stands.filter((s) => related.has(s.id)) : [];
  const hi = (id: string) => (related.has(id) ? 'hi' : '');

  return (
    <div className="viz2d">
      <div className="toolbar" role="toolbar" aria-label="2D map controls">
        <button onClick={() => zoomBy(1.3)} aria-label="Zoom in">＋</button>
        <button onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">－</button>
        <button onClick={() => setVb(FULL)}>Fit airport</button>
        <button onClick={fitSelected} disabled={!selection}>Fit selected</button>
        <span className="muted">zoom ×{zoom.toFixed(1)}{cluster ? ' · clustered' : ''}</span>
      </div>
      <svg ref={svg} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} tabIndex={0} role="application" aria-label="2D airport operational map. Arrow keys pan, plus and minus zoom, 0 resets."
        onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => (drag.current = null)} onKeyDown={keys}>
        {['A', 'B', 'C'].map((p) => (
          <g key={p}>
            <rect x={2} y={pierY(p) - 6} width={90} height={22} className="pier" />
            <text x={3} y={pierY(p) - 2} className="lbl">Pier {p}</text>
          </g>
        ))}
        {layers.weather && cons.map((c) => {
          const s = standById(c.scope) ?? null;
          const sim = c.source === 'Simulation';
          return s
            ? <g key={c.id}><rect x={s.x - 6} y={s.y - 5} width={12} height={16} className="constraint" /><text x={s.x - 5} y={s.y + 12} className="lbl">✕ {c.type.slice(0, 14)}</text></g>
            : <g key={c.id}><rect x={2} y={pierY(c.scope) - 6} width={90} height={22} className={sim ? 'constraint sim' : 'constraint'} /><text x={40} y={pierY(c.scope) + 14} className="lbl">☂ {c.type}{sim ? ' (Simulated)' : ''}</text></g>;
        })}
        {relLines.length > 1 && layers.relations && relLines.slice(1).map((s) => <line key={s.id} x1={relLines[0].x} y1={relLines[0].y + 4} x2={s.x} y2={s.y + 4} className="relation" />)}
        {layers.stands && b.stands.map((s) => {
          const risk = standRisk(s.id);
          const nf = b.flights.filter((f) => view.standOf(f) === s.id && visibleFlights.has(f.id));
          return (
            <g key={s.id} className={`stand ${hi(s.id)}`} tabIndex={0} role="button" aria-label={`Stand ${s.stand}, ${nf.length} flights${risk ? ', risk ' + risk : ''}`}
              onClick={(e) => { e.stopPropagation(); select({ kind: 'stand', id: s.id }); }} onKeyDown={(e) => e.key === 'Enter' && select({ kind: 'stand', id: s.id })}>
              <rect x={s.x - 5} y={s.y - 4} width={10} height={10} rx={1} stroke={risk && layers.sla ? RISK_COLOR[risk] : undefined} strokeWidth={layers.sla && risk ? 0.8 : 0.3} />
              <text x={s.x - 4} y={s.y + 9} className="lbl">{s.stand}</text>
              {layers.sla && risk && <text x={s.x + 1} y={s.y - 4.5} className="glyph" fill={RISK_COLOR[risk]}>{SLA_GLYPH[risk]}</text>}
            </g>
          );
        })}
        {layers.flights && b.flights.filter((f) => visibleFlights.has(f.id)).map((f) => {
          const s = standById(view.standOf(f));
          const idx = b.flights.filter((x) => view.standOf(x) === s.id && visibleFlights.has(x.id)).indexOf(f);
          const ta = b.turnarounds.find((t) => t.flightId === f.id)!;
          const risk = view.turnRisk(ta.id);
          if (cluster && idx > 0) return null;
          const n = cluster ? b.flights.filter((x) => view.standOf(x) === s.id && visibleFlights.has(x.id)).length : 1;
          return (
            <g key={f.id} className={`flight ${hi(f.id)}`} tabIndex={0} role="button" aria-label={`Flight ${f.flightNo} risk ${risk}`}
              onClick={(e) => { e.stopPropagation(); select({ kind: 'flight', id: f.id }); }} onKeyDown={(e) => e.key === 'Enter' && select({ kind: 'flight', id: f.id })}
              transform={`translate(${s.x} ${s.y + 1 + (cluster ? 0 : idx * 3.2)})`}>
              <path d="M-3 0 L3 0 M0 -2.2 L0 2.2 M-1.5 -1 L1.5 -1" stroke={RISK_COLOR[risk]} strokeWidth={0.8} />
              <text x={-3} y={0.2} className="tiny">{f.flightNo}{n > 1 ? ` +${n - 1}` : ''}</text>
            </g>
          );
        })}
        {!cluster && layers.assets && b.assets.map((a) => {
          const s = standById(a.standId);
          const st = view.assetState(a.id);
          return <rect key={a.id} x={s.x + 3} y={s.y - 3} width={1.8} height={1.8} className={`asset ${st} ${hi(a.id)}`}><title>{a.type} {st}{view.changed(a.id) ? ' (Simulated)' : ''}</title></rect>;
        })}
        {!cluster && layers.tasks && b.tasks.filter((t) => related.has(t.id)).map((t, i) => {
          const f = b.flights.find((x) => x.id === b.turnarounds.find((ta) => ta.id === t.turnaroundId)!.flightId)!;
          const s = standById(view.standOf(f));
          return <circle key={t.id} cx={s.x - 4 + i * 1.6} cy={s.y + 5} r={0.7} className={`task ${view.taskState(t.id)}`}><title>{t.taskType}: {view.taskState(t.id)}</title></circle>;
        })}
        {!cluster && layers.milestones && b.milestones.filter((m) => related.has(m.id) && m.status !== 'Complete').map((m, i) => {
          const f = b.flights.find((x) => x.id === b.turnarounds.find((ta) => ta.id === m.turnaroundId)!.flightId)!;
          const s = standById(view.standOf(f));
          return <text key={m.id} x={s.x + 5.5} y={s.y + i * 2.2 - 2} className="tiny">◆{m.type.slice(0, 6)}</text>;
        })}
        {layers.staff && b.bus.map((bu, i) => {
          const sc = b.staff.filter((x) => x.buId === bu.id);
          const avail = sc.reduce((a, x) => a + x.available, 0), eng = sc.reduce((a, x) => a + x.engaged, 0);
          const pressure = Math.max(0, ...sc.map((x) => view.impact.capacityPressure[x.id] ?? 0));
          return <g key={bu.id}><rect x={2 + i * 31} y={74} width={29} height={4} className="bar" /><rect x={2 + i * 31} y={74} width={29 * Math.min(1, eng / Math.max(1, avail))} height={4} className={pressure > 1 ? 'bar-fill hot' : 'bar-fill'} /><text x={3 + i * 31} y={73.5} className="tiny">{bu.name} {eng}/{avail}{pressure ? ' (Simulated)' : ''}</text></g>;
        })}
      </svg>
    </div>
  );
}
