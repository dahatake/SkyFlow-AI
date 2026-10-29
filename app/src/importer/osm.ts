export type OsmKind = 'runway' | 'taxiway' | 'apron' | 'terminal';
export interface OsmFeature { kind: OsmKind; ref?: string; pts: [number, number][] }
export interface OsmMap { source: string; bbox: { s: number; w: number; n: number; e: number }; features: OsmFeature[]; fetchedAt: string }

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];

export function mapBbox(lat: number, lon: number, half = 0.045) {
  const dLon = half / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  return { s: lat - half, n: lat + half, w: lon - dLon, e: lon + dLon };
}

export const overpassQuery = (b: OsmMap['bbox']) =>
  `[out:json][timeout:50];way["aeroway"~"^(runway|taxiway|apron|terminal)$"](${b.s},${b.w},${b.n},${b.e});out geom 1500;`;

type OverpassEl = { type?: string; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] };

/** Pure conversion of an Overpass response into the features the map draws. */
export function parseOverpass(json: { elements?: OverpassEl[] }): OsmFeature[] {
  const out: OsmFeature[] = [];
  for (const el of json.elements ?? []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const aeroway = el.tags?.aeroway;
    const kind: OsmKind | null = aeroway === 'runway' || aeroway === 'taxiway' || aeroway === 'apron' || aeroway === 'terminal' ? aeroway : el.tags?.building === 'terminal' ? 'terminal' : null;
    if (!kind) continue;
    out.push({ kind, ref: el.tags?.ref ?? el.tags?.name, pts: el.geometry.map((g) => [g.lat, g.lon]) });
  }
  return out;
}

/** Downloads real airport geometry from OpenStreetMap via Overpass; resolves to null when unreachable. */
export async function fetchOsmMap(lat: number, lon: number, fetcher: typeof fetch = (u, i) => fetch(u, i), timeoutMs = 60000): Promise<OsmMap | null> {
  const bbox = mapBbox(lat, lon);
  for (const url of [...ENDPOINTS, ENDPOINTS[0]]) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetcher(url, { method: 'POST', body: new URLSearchParams({ data: overpassQuery(bbox) }), signal: ctl.signal });
      if (!r.ok) continue;
      const features = parseOverpass(await r.json());
      if (features.length) return { source: 'OpenStreetMap contributors (ODbL), via Overpass API', bbox, features, fetchedAt: new Date().toISOString() };
    } catch { /* try next endpoint */ } finally { clearTimeout(timer); }
  }
  return null;
}

/** Equirectangular projection of lat/lon into a w x h box, keeping the true aspect ratio. */
export function projector(b: OsmMap['bbox'], w: number, h: number) {
  const midLat = (b.n + b.s) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const spanX = (b.e - b.w) * kx, spanY = b.n - b.s;
  const k = Math.min(w / spanX, h / spanY);
  const ox = (w - spanX * k) / 2, oy = (h - spanY * k) / 2;
  return ([lat, lon]: [number, number]) => [ox + (lon - b.w) * kx * k, oy + (b.n - lat) * k] as [number, number];
}
