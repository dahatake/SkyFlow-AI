import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Add24Regular, Subtract24Regular, Home24Regular, Location24Regular, ArrowDownload24Regular, Dismiss24Regular } from '@fluentui/react-icons';
import { useOps } from '../storage/store';
import { fmt } from '../domain/seed';
import { APRON_AREAS, GRASS, JEWEL, LEVELS, P, RUNWAYS, RUNWAY_Y, TERMINALS, WORLD, beltPoint, checkinRow, gateLounge, gateName, OPS_ROOMS, standPoint, terminalById, toLatLon, type LevelChoice } from '../domain/airportMap';
import { FIX_MINUTES, fixesToCsv, type GpsEntity, type GpsFix, type GpsKind } from '../domain/gps';
import { tr } from '../i18n';
import { trData } from '../i18n/data';

interface Cam { k: number; x: number; y: number }
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const KIND_COLOR: Record<GpsKind, string> = { aircraft: '#0f6cbd', gse: '#8764b8', staff: '#2e8b57' };
const PLANE = 'M0,-11 L2.6,-3 L11,3 L11,5.5 L2.6,3.2 L2,9 L5,11 L5,13 L0,12 L-5,13 L-5,11 L-2,9 L-2.6,3.2 L-11,5.5 L-11,3 L-2.6,-3 Z';
type Box = { x: number; y: number; w: number; h: number };
const MAIN: Box = { x: 200, y: 40, w: 1600, h: 790 };
const WHOLE: Box = { x: 0, y: 0, w: WORLD.w, h: WORLD.h };
const PLACES: [string, string][] = [['', 'All terminals'], ['T1', 'Terminal 1'], ['T2', 'Terminal 2'], ['T3', 'Terminal 3'], ['T4', 'Terminal 4'], ['JEWEL', 'Jewel']];
const focusBox = (l: LevelChoice, place: string): Box => (place === 'JEWEL' ? JEWEL.box : place ? terminalById(place).box : l === 'overview' ? WHOLE : MAIN);const NICE = [5, 10, 20, 50, 100, 200, 500, 1000, 2000];
const LAYER_KEYS: [string, string][] = [['aircraft', 'Aircraft'], ['gse', 'GSE vehicles'], ['staff', 'Staff'], ['gates', 'Gates / stands'], ['trails', 'Trails']];

/** GPS tracking map: schematic Changi with level layers, Google-Maps style zoom / pan, and 5-minute position history. */
export function GpsMap() {
  const { gps, baseline, select, selection, role } = useOps();
  const wrap = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ w: 800, h: 540 });
  const [cam, setCam] = useState<Cam | null>(null);
  const [level, setLevel] = useState<LevelChoice>('overview');
  const [layers, setLayers] = useState<Record<string, boolean>>({ aircraft: true, gse: true, staff: true, gates: true, trails: true });
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [follow, setFollow] = useState(false);
  const [replay, setReplay] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: Math.max(300, el.clientWidth), h: el.clientHeight }));
    ro.observe(el); setSize({ w: Math.max(300, el.clientWidth), h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fitCam = useCallback((box: { x: number; y: number; w: number; h: number }): Cam => {
    const k = Math.min(size.w / box.w, size.h / box.h) * 0.96;
    return { k, x: size.w / 2 - (box.x + box.w / 2) * k, y: size.h / 2 - (box.y + box.h / 2) * k };
  }, [size]);
  const home = useMemo(() => fitCam(WHOLE), [fitCam]);
  const c = cam ?? home;
  const camRef = useRef(c); camRef.current = c;
  const kMin = home.k * 0.7, kMax = home.k * 28;
  const z = c.k / home.k;

  const anim = useRef(0);
  const animateTo = useCallback((t: Cam) => {
    cancelAnimationFrame(anim.current);
    const from = { ...camRef.current }, t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 280), e = 1 - Math.pow(1 - p, 3);
      setCam({ k: from.k * Math.pow(t.k / from.k, e), x: from.x + (t.x - from.x) * e, y: from.y + (t.y - from.y) * e });
      if (p < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }, []);
  const zoomTarget = useCallback((factor: number, px: number, py: number, base: Cam = camRef.current): Cam => {
    const k = clamp(base.k * factor, kMin, kMax), r = k / base.k;
    return { k, x: px - (px - base.x) * r, y: py - (py - base.y) * r };
  }, [kMin, kMax]);
  const zoomBy = (f: number) => animateTo(zoomTarget(f, size.w / 2, size.h / 2));

  // Wheel / trackpad pinch zoom around the cursor, like Google Maps.
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element).closest?.('.gm-pop')) return;
      e.preventDefault(); cancelAnimationFrame(anim.current);
      const r = el.getBoundingClientRect();
      setCam(zoomTarget(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX - r.left, e.clientY - r.top));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomTarget]);

  // Drag to pan, two-finger pinch to zoom.
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const pinch = useRef(0);
  const onDown = (e: React.PointerEvent) => {
    cancelAnimationFrame(anim.current);
    wrap.current?.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved.current = 0;
    if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; pinch.current = Math.hypot(a.x - b.x, a.y - b.y); }
  };
  const onMove = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    if (cursor.current) {
      const wx = (e.clientX - r.left - camRef.current.x) / camRef.current.k, wy = (e.clientY - r.top - camRef.current.y) / camRef.current.k;
      const ll = toLatLon(wx, wy); cursor.current.textContent = `${ll.lat.toFixed(5)}, ${ll.lon.toFixed(5)}`;
    }
    const prev = ptrs.current.get(e.pointerId); if (!prev) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) setCam(zoomTarget(d / pinch.current, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top));
      pinch.current = d; moved.current += 10; return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y; moved.current += Math.abs(dx) + Math.abs(dy);
    if (moved.current > 4) { setFollow(false); setCam({ ...camRef.current, x: camRef.current.x + dx, y: camRef.current.y + dy }); }
  };
  const onUp = (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); pinch.current = 0; };
  const onDbl = (e: React.MouseEvent) => { const r = wrap.current!.getBoundingClientRect(); animateTo(zoomTarget(e.shiftKey ? 0.5 : 2, e.clientX - r.left, e.clientY - r.top)); };
  const onKey = (e: React.KeyboardEvent) => {
    const step = 60;
    if (e.key === '+' || e.key === '=') zoomBy(1.6); else if (e.key === '-') zoomBy(1 / 1.6); else if (e.key === '0') animateTo(home);
    else if (e.key === 'ArrowLeft') setCam({ ...c, x: c.x + step }); else if (e.key === 'ArrowRight') setCam({ ...c, x: c.x - step });
    else if (e.key === 'ArrowUp') setCam({ ...c, y: c.y + step }); else if (e.key === 'ArrowDown') setCam({ ...c, y: c.y - step });
    else return;
    e.preventDefault();
  };
  const [place, setPlace] = useState('');
  const chooseLevel = (l: LevelChoice) => { setLevel(l); animateTo(fitCam(focusBox(l, place))); };
  const choosePlace = (p: string) => { setPlace(p); animateTo(fitCam(focusBox(level, p))); };

  // Latest known fix per entity at the displayed time.
  const T = replay ?? gps.latestSlot;
  const lastFix = (id: string): GpsFix | undefined => {
    const l = gps.history.get(id); if (!l) return undefined;
    for (let i = l.length - 1; i >= 0; i--) if (l[i].t <= T) return l[i].t >= T - 2 * FIX_MINUTES ? l[i] : undefined;
    return undefined;
  };
  const ents = gps.entities;
  const byId = useMemo(() => new Map(ents.map((e) => [e.id, e])), [ents]);
  const lab = (e: GpsEntity) => (e.kind === 'staff' ? trData(e.label) : e.label);
  const needle = q.trim().toLowerCase();
  const matches = (e: GpsEntity) => !needle || `${e.label} ${lab(e)} ${e.sub} ${trData(e.sub)}`.toLowerCase().includes(needle);
  const shown = ents.map((e) => ({ e, f: lastFix(e.id) })).filter((x): x is { e: GpsEntity; f: GpsFix } => !!x.f && layers[x.e.kind] && (level === 'overview' || x.f.level === level));
  const sel = selId ? byId.get(selId) : undefined;
  const selFix = sel ? lastFix(sel.id) : undefined;
  const trail = (id: string) => (gps.history.get(id) ?? []).filter((f) => f.t <= T && f.t > T - 12 * FIX_MINUTES && (level === 'overview' || f.level === level));

  // Mirror selection from the other views (flights and assets share ids with aircraft / GSE).
  useEffect(() => {
    if (!selection) return;
    const hit = ents.find((e) => e.refId === selection.id && ((selection.kind === 'flight' && e.kind === 'aircraft') || (selection.kind === 'asset' && e.kind === 'gse')));
    if (hit) setSelId(hit.id);
  }, [selection, ents]);
  useEffect(() => {
    if (follow && selFix) animateTo({ ...camRef.current, x: size.w / 2 - selFix.x * camRef.current.k, y: size.h / 2 - selFix.y * camRef.current.k });
  }, [follow, selFix?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const hov = hoverId ? byId.get(hoverId) : undefined;
  const popEnt = hov ?? sel;
  const popFix = popEnt ? lastFix(popEnt.id) : undefined;
  const popRows = (e: GpsEntity): [string, string][] => {
    const rows: [string, string][] = [];
    const fl = e.kind === 'aircraft' ? baseline.flights.find((x) => x.id === e.refId) : undefined;
    const as = e.kind === 'gse' ? baseline.assets.find((x) => x.id === e.refId) : undefined;
    if (fl) {
      const al = baseline.airlines.find((a) => a.id === fl.airlineId);
      const ta = baseline.turnarounds.find((t) => t.flightId === fl.id);
      rows.push([tr('Flight'), fl.flightNo], [tr('Airline'), al?.name ?? fl.airlineId], [tr('Route'), `${fl.origin} → ${fl.destination}`],
        [tr('Stand'), `${fl.standId} (${fl.pierId})`], ['STA / STD', `${fmt(fl.sta)} / ${fmt(fl.std)}`], ['ETD', fmt(fl.etd)], [tr('Status'), trData(fl.status)]);
      if (fl.ata !== undefined) rows.push(['ATA', fmt(fl.ata)]);
      if (ta) {
        rows.push([tr('Turnaround'), `${trData(ta.phase)} · ${fmt(ta.plannedStart)}–${fmt(ta.plannedEnd)}`], ['SLA', `${trData(ta.health)} / ${trData(ta.slaRisk)}`]);
        const tasks = baseline.tasks.filter((t) => t.turnaroundId === ta.id);
        if (tasks.length) rows.push([tr('Tasks'), `${tasks.filter((t) => t.status === 'Complete').length}/${tasks.length}`]);
      }
      const ex = baseline.exceptions.filter((x) => x.affectedEntityIds.includes(fl.id) || (ta && x.affectedEntityIds.includes(ta.id)));
      if (ex.length) rows.push([tr('Exceptions'), ex.map((x) => `${trData(x.type)} (${trData(x.severity)})`).join(', ')]);
    }
    if (as) {
      const task = as.assignedTaskId ? baseline.tasks.find((t) => t.id === as.assignedTaskId) : undefined;
      rows.push([tr('Asset type'), trData(as.type)], [tr('Status'), trData(as.status)], [tr('Stand'), as.standId], [tr('Available'), `${fmt(as.availFrom)}–${fmt(as.availTo)}`]);
      if (task) rows.push([tr('Assigned task'), `${trData(task.taskType)} · ${trData(task.status)}`]);
    }
    rows.push([tr('Device'), e.device]);
    return rows;
  };
  const pick = (e: GpsEntity) => {
    if (moved.current > 4) return;
    setSelId(e.id);
    if (e.refId && e.kind === 'aircraft') select({ kind: 'flight', id: e.refId });
    else if (e.refId && e.kind === 'gse') select({ kind: 'asset', id: e.refId });
  };
  const locate = () => { if (selFix) animateTo({ k: Math.max(camRef.current.k, home.k * 6), x: size.w / 2 - selFix.x * Math.max(camRef.current.k, home.k * 6), y: size.h / 2 - selFix.y * Math.max(camRef.current.k, home.k * 6) }); };
  const exportCsv = () => {
    const all = [...gps.history.values()].flat().sort((a, b) => a.t - b.t);
    const url = URL.createObjectURL(new Blob([fixesToCsv(all)], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'gps-fixes.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const occupied = useMemo(() => {
    const s = new Set<string>();
    ents.filter((e) => e.kind === 'aircraft').forEach((e) => { const f = lastFix(e.id); const fl = baseline.flights.find((x) => x.id === e.refId); if (f && fl && f.state === 'At stand') s.add(fl.standId); });
    return s;
  }, [ents, T, baseline]); // eslint-disable-line react-hooks/exhaustive-deps

  const slots = useMemo(() => { let lo = Infinity; gps.history.forEach((l) => { if (l.length && l[0].t < lo) lo = l[0].t; }); return Number.isFinite(lo) ? { lo, hi: gps.latestSlot } : null; }, [gps]);
  const px = (n: number) => n / c.k; // screen px -> world units
  const mPerPx = WORLD.metersPerUnit / c.k;
  const bar = NICE.filter((n) => n / mPerPx >= 60 && n / mPerPx <= 150)[0] ?? NICE[NICE.length - 1];
  const lvlOn = (l: LevelChoice) => level === 'overview' || level === l;
  const dim = level !== 'overview' && level !== 'apron';
  const standList = ['A', 'B', 'C'].flatMap((p) => [1, 2, 3, 4, 5, 6].map((n) => `${p}${n}`));

  return (
    <div className="gpsmap" aria-label={tr('GPS tracking map')}>
      <div className="gps-stage" ref={wrap} tabIndex={0} role="application" aria-label={tr('GPS tracking map')}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={onDbl} onKeyDown={onKey}>
        <svg width={size.w} height={size.h} role="img" aria-label={tr('Schematic Changi Airport map with live positions')}>
          <g transform={`translate(${c.x} ${c.y}) scale(${c.k})`}>
            <rect x={-300} y={-300} width={WORLD.w + 600} height={WORLD.h + 600} className="gm-land" />
            {GRASS.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={12} className="gm-grass" />)}
            {APRON_AREAS.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} className={`gm-apron ${dim ? 'dim' : ''}`} />)}
            {RUNWAYS.map((r) => (
              <g key={r.id} className={dim ? 'dim' : ''}>
                <rect x={r.x - 16} y={RUNWAY_Y.from} width={32} height={RUNWAY_Y.to - RUNWAY_Y.from} className="gm-runway" />
                <line x1={r.x} y1={RUNWAY_Y.from} x2={r.x} y2={RUNWAY_Y.to} className="gm-center" vectorEffect="non-scaling-stroke" />
                {z > 0.9 && <text x={r.x} y={RUNWAY_Y.from + 40} fontSize={px(10)} textAnchor="middle" className="gm-label">{r.id}</text>}
              </g>
            ))}
            {z > 1.2 && lvlOn('apron') && <text x={P(440, 240).x} y={P(440, 240).y} fontSize={px(10)} textAnchor="middle" className="gm-label">{tr('Apron')}</text>}
            {TERMINALS.map((t) => {
              const floor = level === 'L1' || level === 'L2' || level === 'L3';
              const fill = floor ? { fill: t.color, fillOpacity: 0.16, stroke: t.color, strokeWidth: 1.5 } : { fill: t.color, stroke: t.color, strokeWidth: 0 };
              return (
                <g key={t.id}>
                  {t.arms.map((a, i) => {
                    const pts = a.pts.map((p) => `${p.x},${p.y}`).join(' ');
                    return <g key={i}><polyline points={pts} fill="none" stroke={t.color} strokeOpacity={floor ? 0.18 : 1} strokeWidth={a.w} strokeLinecap="round" strokeLinejoin="round" />{floor && <polyline points={pts} fill="none" stroke="#fff" strokeWidth={a.w * 0.35} strokeLinecap="round" strokeLinejoin="round" />}</g>;
                  })}
                  <polygon points={t.body.map((p) => `${p.x},${p.y}`).join(' ')} {...fill} vectorEffect="non-scaling-stroke" />
                  {floor && <polyline points={t.body.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="none" />}
                  <text x={t.label.x} y={t.label.y} fontSize={t.id === 'T4' ? 24 : 38} textAnchor="middle" className={`gm-tname ${floor ? 'floor' : ''}`} fill={floor ? t.color : '#fff'}>{t.id}</text>
                  {level === 'L1' && Array.from({ length: 5 }, (_, i) => { const p = beltPoint(t.id, i); return <g key={i}><rect x={p.x - 13} y={p.y - 4} width={26} height={8} rx={4} className="gm-belt" />{z > 4 && <text x={p.x} y={p.y + 14} fontSize={px(8)} textAnchor="middle" className="gm-label">{tr('Belt')} {i + 1}</text>}</g>; })}
                  {level === 'L2' && Array.from({ length: 5 }, (_, i) => { const p = checkinRow(t.id, i); return <g key={i}><rect x={p.x - 7} y={p.y - 7} width={14} height={14} className="gm-row" />{z > 4 && <text x={p.x} y={p.y + 3} fontSize={px(8)} textAnchor="middle" className="gm-label">{String.fromCharCode(65 + i)}</text>}</g>; })}
                  {level === 'L3' && <g><rect x={t.label.x - 40} y={t.label.y + 8} width={80} height={16} rx={4} className="gm-room" />{z > 2 && <text x={t.label.x} y={t.label.y + 20} fontSize={px(9)} textAnchor="middle" className="gm-label">{tr('Lounges')}</text>}</g>}
                </g>
              );
            })}
            <circle cx={JEWEL.x} cy={JEWEL.y} r={JEWEL.r} className="gm-jewel" />
            <text x={JEWEL.x} y={JEWEL.y + 4} fontSize={16} textAnchor="middle" className="gm-tname" fill="#fff">JEWEL</text>
            {z > 3 && <text x={JEWEL.x} y={JEWEL.y + 24} fontSize={px(9)} textAnchor="middle" fill="#fff" className="gm-label">{tr('Levels 1–5')}</text>}
            {level === 'L2' && Object.values(OPS_ROOMS).map((r) => <g key={r.label}><rect x={r.x - 22} y={r.y - 9} width={44} height={18} rx={3} className="gm-room" /><text x={r.x} y={r.y + 3} fontSize={px(8)} textAnchor="middle" className="gm-label">{tr(r.label)}</text></g>)}
            {layers.gates && standList.map((id) => {
              const sp = standPoint(id), g = gateLounge(id), occ = occupied.has(id);
              const gateLevel = level === 'L2' || level === 'L3';
              return (
                <g key={id}>
                  {gateLevel && <rect x={g.x - 10} y={g.y - 7} width={20} height={14} rx={2} className="gm-gate" />}
                  {!gateLevel && level !== 'L1' && <rect x={sp.x - 12} y={sp.y - 8} width={24} height={16} rx={2} className={`gm-stand ${occ ? 'occ' : ''}`} />}
                  {level !== 'L1' && z > (gateLevel ? 2 : 1.6) && <text x={gateLevel ? g.x : sp.x} y={(gateLevel ? g.y : sp.y) + 3} fontSize={px(8)} textAnchor="middle" className="gm-label strong">{gateLevel ? gateName(id) : id}</text>}
                </g>
              );
            })}            {layers.trails && shown.filter((x) => x.e.id === selId || (z > 1.2 && trail(x.e.id).length > 1)).map(({ e }) => {
              const pts = trail(e.id).map((f) => `${f.x},${f.y}`).join(' ');
              return <polyline key={e.id} points={pts} fill="none" stroke={KIND_COLOR[e.kind]} className={`gm-trail ${e.id === selId ? 'sel' : ''}`} vectorEffect="non-scaling-stroke" />;
            })}
            {shown.map(({ e, f }) => {
              const dimmed = !matches(e), isSel = e.id === selId;
              return (
                <g key={e.id} className={`gm-ent ${dimmed ? 'dim' : ''}`} style={{ transform: `translate(${f.x}px, ${f.y}px)` }} onClick={() => pick(e)} onPointerEnter={() => setHoverId(e.id)} onPointerLeave={() => setHoverId((h) => (h === e.id ? null : h))} role="button" tabIndex={-1} aria-label={`${lab(e)} ${trData(f.state)}`}>
                  <g style={{ transform: `scale(${1 / c.k})` }}>
                    {isSel && <circle r={16} className="gm-ring" />}
                    {e.kind === 'aircraft' && <path d={PLANE} transform={`rotate(${f.headingDeg}) scale(0.9)`} fill={KIND_COLOR.aircraft} stroke="#fff" strokeWidth={1} />}
                    {e.kind === 'gse' && <rect x={-5} y={-5} width={10} height={10} rx={2} fill={KIND_COLOR.gse} stroke="#fff" strokeWidth={1} />}
                    {e.kind === 'staff' && <circle r={5} fill={f.level === 'apron' ? KIND_COLOR.staff : '#0e7a87'} stroke="#fff" strokeWidth={1.2} />}
                    {(isSel || (z > 2.2 && e.kind === 'aircraft') || z > 5 || (needle && !dimmed)) && <text y={e.kind === 'aircraft' ? 26 : -9} textAnchor="middle" fontSize={10} className="gm-tag">{e.kind === 'staff' ? lab(e).split(' ').slice(-2).join(' ') : e.label}</text>}
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {popEnt && popFix && (() => {
          const pinned = popEnt.id === selId;
          const sx = c.x + popFix.x * c.k, sy = c.y + popFix.y * c.k, W = 280;
          const left = clamp(sx + 18, 8, Math.max(8, size.w - W - 8)), top = clamp(sy - 20, 8, Math.max(8, size.h - 260));
          return (
            <div className={`gm-pop ${pinned ? 'pinned' : ''}`} style={{ left, top, width: W }} role="dialog" aria-label={lab(popEnt)}
              onPointerDown={(ev) => ev.stopPropagation()} onDoubleClick={(ev) => ev.stopPropagation()}>
              <div className="gm-pop-head">
                <b>{lab(popEnt)}</b>
                <small>{tr(popEnt.kind === 'aircraft' ? 'Aircraft' : popEnt.kind === 'gse' ? 'GSE vehicle' : 'Staff')} · {trData(popEnt.sub)}</small>
                <button className="gm-pop-x" aria-label={tr('Close')} title={tr('Close')} onClick={() => { setHoverId(null); if (pinned) { setSelId(null); setFollow(false); } }}><Dismiss24Regular /></button>
              </div>
              <dl>
                {popRows(popEnt).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                <div><dt>{tr('Last fix')}</dt><dd>{fmt(popFix.t)} · {trData(popFix.state)}</dd></div>
                <div><dt>{tr('Position')}</dt><dd className="mono">{popFix.lat.toFixed(6)}, {popFix.lon.toFixed(6)}</dd></div>
                <div><dt>{tr('Level')}</dt><dd>{tr(popFix.level === 'apron' ? 'Apron / airside' : 'Level ' + popFix.level.slice(1))}</dd></div>
                <div><dt>{tr('Speed')}</dt><dd>{popFix.speedKmh} km/h · {popFix.headingDeg}° · ±{popFix.accuracyM} m</dd></div>
                <div><dt>{tr('Source')}</dt><dd>{tr(popFix.source)}</dd></div>
              </dl>
            </div>
          );
        })()}
        <div className="gm-levels" role="radiogroup" aria-label={tr('Map layer')}>
          {LEVELS.map((l) => <button key={l.id} role="radio" aria-checked={level === l.id} className={level === l.id ? 'on' : ''} title={tr(l.blurb)} onClick={() => chooseLevel(l.id)}>{tr(l.label)}</button>)}
        </div>
        <div className="gm-places"><select aria-label={tr('Go to')} value={place} onChange={(e) => choosePlace(e.target.value)}>{PLACES.map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}</select></div>
        <div className="gm-zoom" role="group" aria-label={tr('Zoom')}>
          <button aria-label={tr('Zoom in')} title={tr('Zoom in')} onClick={() => zoomBy(1.6)}><Add24Regular /></button>
          <button aria-label={tr('Zoom out')} title={tr('Zoom out')} onClick={() => zoomBy(1 / 1.6)}><Subtract24Regular /></button>
          <button aria-label={tr('Reset view')} title={tr('Reset view')} onClick={() => { setLevel('overview'); animateTo(home); }}><Home24Regular /></button>
          <button aria-label={tr('Zoom to selected')} title={tr('Zoom to selected')} onClick={locate} disabled={!selFix}><Location24Regular /></button>
        </div>
        <div className="gm-foot">
          <span className="gm-scale" style={{ width: bar / mPerPx }}>{bar >= 1000 ? `${bar / 1000} km` : `${bar} m`}</span>
          <span>{tr('Zoom')} ×{z.toFixed(1)}</span>
          <span ref={cursor} className="mono">–</span>
        </div>
        <div className="gm-hint" aria-hidden="true">{tr('Scroll to zoom · drag to pan · double-click to zoom in')}</div>
      </div>

      <div className="row gps-bar">
        <label>{tr('Search')} <input type="search" value={q} placeholder={tr('flight, vehicle, person…')} onChange={(e) => setQ(e.target.value)} /></label>
        {LAYER_KEYS.map(([k, l]) => <label key={k}><input type="checkbox" checked={layers[k]} onChange={() => setLayers((s) => ({ ...s, [k]: !s[k] }))} /> {tr(l)}</label>)}
        <button onClick={exportCsv} disabled={!gps.count}><ArrowDownload24Regular /> {tr('Export GPS CSV')}</button>
      </div>
      <div className="row gps-bar" role="group" aria-label={tr('Position history')}>
        {slots ? (
          <>
            <label className="grow">{tr('History')} <input type="range" min={slots.lo} max={slots.hi} step={FIX_MINUTES} value={replay ?? slots.hi} onChange={(e) => setReplay(Number(e.target.value) >= slots.hi ? null : Number(e.target.value))} aria-valuetext={fmt(replay ?? slots.hi)} /></label>
            <b>{replay === null ? tr('Live') : tr('Replay')} · {fmt(replay ?? slots.hi)}</b>
            {replay !== null && <button onClick={() => setReplay(null)}>{tr('Back to live')}</button>}
          </>
        ) : <span className="muted">{tr('Waiting for the first GPS fixes…')}</span>}
        <small className="muted">{tr('{n} fixes stored · one per entity every {m} min · {e} tracked entities · role {r}', { n: gps.count, m: FIX_MINUTES, e: ents.length, r: tr(role) })}</small>
      </div>

      {sel ? (
        <aside className="gps-detail card" aria-label={tr('Tracked entity')}>
          <div className="row between"><h3>{lab(sel)} <small className="muted">{tr(sel.kind === 'aircraft' ? 'Aircraft' : sel.kind === 'gse' ? 'GSE vehicle' : 'Staff')} · {trData(sel.sub)}</small></h3>
            <span><label><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> {tr('Follow')}</label> <button onClick={() => { setSelId(null); setFollow(false); }}>{tr('Close')}</button></span></div>
          {selFix ? <p>{tr('Status')}: <b>{trData(selFix.state)}</b> · {tr('Last fix')} {fmt(selFix.t)} · {selFix.lat.toFixed(6)}, {selFix.lon.toFixed(6)} · {tr(selFix.level === 'apron' ? 'Apron / airside' : 'Level ' + selFix.level.slice(1))} · {selFix.speedKmh} km/h · {selFix.headingDeg}° · ±{selFix.accuracyM} m · {tr(selFix.source)}</p> : <p className="muted">{tr('No recent fix: the entity is outside the tracked window.')}</p>}
          <div className="tbl-wrap"><table><thead><tr><th>{tr('Time')}</th><th>{tr('Latitude')}</th><th>{tr('Longitude')}</th><th>{tr('Level')}</th><th>{tr('Speed')}</th><th>{tr('Status')}</th></tr></thead><tbody>
            {(gps.history.get(sel.id) ?? []).filter((f) => f.t <= T).slice(-8).reverse().map((f) => <tr key={f.id}><td>{fmt(f.t)}</td><td>{f.lat.toFixed(6)}</td><td>{f.lon.toFixed(6)}</td><td>{f.level === 'apron' ? tr('Apron') : f.level}</td><td>{f.speedKmh} km/h</td><td>{trData(f.state)}</td></tr>)}
          </tbody></table></div>
        </aside>
      ) : <p className="muted">{tr('Select an aircraft, vehicle or person on the map to see its GPS history.')}</p>}
    </div>
  );
}
