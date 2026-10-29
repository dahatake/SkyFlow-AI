import { useEffect, useMemo, useState } from 'react';
import { openDB, idbGet } from '../storage/idb';
import { activeCustomer } from '../customers';
import type { OsmMap } from '../importer/osm';
import { projector } from '../importer/osm';
import { tr } from '../i18n';

const W = 1000, H = 700;
const STYLE = {
  apron: { fill: 'var(--line)', stroke: 'none', w: 0 },
  terminal: { fill: '#d13438', stroke: '#8e192b', w: 1 },
  taxiway: { fill: 'none', stroke: '#e3a21a', w: 2 },
  runway: { fill: 'none', stroke: 'var(--fg)', w: 7 },
} as const;
const ORDER = ['apron', 'taxiway', 'runway', 'terminal'] as const;

/** Loads the OpenStreetMap geometry stored for the active imported airport, if any. */
export function useImportedMap(): OsmMap | null | undefined {
  const [map, setMap] = useState<OsmMap | null | undefined>(undefined);
  useEffect(() => {
    const id = activeCustomer().id;
    if (!id.startsWith('imp-')) { setMap(null); return; }
    openDB().then((db) => idbGet<{ map?: OsmMap | null }>(db, 'airports', id)).then((r) => setMap(r?.map ?? null)).catch(() => setMap(null));
  }, []);
  return map;
}

export function OsmAirportMap({ map }: { map: OsmMap }) {
  const proj = useMemo(() => {
    const pts = map.features.flatMap((f) => f.pts);
    const lat = pts.map((p) => p[0]), lon = pts.map((p) => p[1]);
    const padLat = (Math.max(...lat) - Math.min(...lat)) * 0.04, padLon = (Math.max(...lon) - Math.min(...lon)) * 0.04;
    return projector({ s: Math.min(...lat) - padLat, n: Math.max(...lat) + padLat, w: Math.min(...lon) - padLon, e: Math.max(...lon) + padLon }, W, H);
  }, [map]);
  const path = (pts: [number, number][], close: boolean) => pts.map((p, i) => `${i ? 'L' : 'M'}${proj(p).map((n) => n.toFixed(1)).join(' ')}`).join('') + (close ? 'Z' : '');
  return (
    <figure className="osm-map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tr('Airport map from OpenStreetMap')}>
        <rect width={W} height={H} className="osm-bg" />
        {ORDER.map((k) => map.features.filter((f) => f.kind === k).map((f, i) => {
          const s = STYLE[k];
          return <path key={`${k}${i}`} d={path(f.pts, k === 'apron' || k === 'terminal')} fill={s.fill} stroke={s.stroke} strokeWidth={s.w} strokeLinecap="round" vectorEffect="non-scaling-stroke"><title>{f.ref ?? tr(k === 'runway' ? 'Runway' : k === 'terminal' ? 'Terminal' : k)}</title></path>;
        }))}
      </svg>
      <figcaption className="muted">{tr('Real map data')}: {map.source}</figcaption>
    </figure>
  );
}
