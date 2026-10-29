import type { Lang } from '../i18n/core';
import type { CatalogAirport } from './catalog';

export interface GatheredFacts {
  online: boolean;
  wikidataId?: string;
  annualPassengers?: number;
  elevationM?: number;
  website?: string;
  opened?: string;
  summary: Partial<Record<Lang, string>>;
  sources: string[];
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export type GatherStep = 'article' | 'facts' | 'localized';

const LANGS: Lang[] = ['en', 'zh', 'ko', 'ja'];

async function json<T>(f: Fetcher, url: string, ms: number): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await f(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally { clearTimeout(timer); }
}

type WdClaim = { mainsnak?: { datavalue?: { value?: unknown } }; qualifiers?: Record<string, { datavalue?: { value?: { time?: string } } }[]> };
const claimValues = (claims: Record<string, WdClaim[]> | undefined, p: string) => claims?.[p] ?? [];

/** Pure parser for a Wikidata entity so it can be tested without the network. */
export function parseWikidata(entity: { claims?: Record<string, WdClaim[]> } | undefined): Pick<GatheredFacts, 'annualPassengers' | 'elevationM' | 'website' | 'opened'> {
  const c = entity?.claims;
  const out: Pick<GatheredFacts, 'annualPassengers' | 'elevationM' | 'website' | 'opened'> = {};
  const pax = claimValues(c, 'P3872')
    .map((x) => ({ n: Number((x.mainsnak?.datavalue?.value as { amount?: string } | undefined)?.amount), t: x.qualifiers?.P585?.[0]?.datavalue?.value?.time ?? '' }))
    .filter((x) => Number.isFinite(x.n) && x.n > 0).sort((p, q) => q.t.localeCompare(p.t));
  if (pax[0]) out.annualPassengers = Math.round(pax[0].n);
  const el = Number((claimValues(c, 'P2044')[0]?.mainsnak?.datavalue?.value as { amount?: string } | undefined)?.amount);
  if (Number.isFinite(el)) out.elevationM = Math.round(el);
  const web = claimValues(c, 'P856')[0]?.mainsnak?.datavalue?.value;
  if (typeof web === 'string' && /^https?:\/\//.test(web)) out.website = web;
  const inc = (claimValues(c, 'P1619')[0] ?? claimValues(c, 'P571')[0])?.mainsnak?.datavalue?.value as { time?: string } | undefined;
  const y = inc?.time?.match(/^[+-]?(\d{4})/);
  if (y) out.opened = y[1];
  return out;
}

/**
 * Collects public facts about an airport from Wikipedia / Wikidata. Every request is optional:
 * offline or blocked networks return what was gathered so far, never throwing.
 */
export async function gatherAirportFacts(
  ap: CatalogAirport,
  opts: { fetcher?: Fetcher; timeoutMs?: number; onStep?: (s: GatherStep) => void } = {},
): Promise<GatheredFacts> {
  const f: Fetcher = opts.fetcher ?? ((u, i) => fetch(u, i));
  const ms = opts.timeoutMs ?? 8000;
  const facts: GatheredFacts = { online: false, summary: {}, sources: [] };
  const titles: Partial<Record<Lang, string>> = { en: ap.wiki };
  opts.onStep?.('article');
  try {
    type Q = { query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string }; langlinks?: { lang: string; '*': string }[] }> } };
    const q = await json<Q>(f, `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageprops%7Clanglinks&lllimit=500&titles=${encodeURIComponent(ap.wiki)}`, ms);
    const page = Object.values(q.query?.pages ?? {})[0];
    facts.wikidataId = page?.pageprops?.wikibase_item;
    page?.langlinks?.forEach((l) => { if (l.lang === 'zh' || l.lang === 'ko' || l.lang === 'ja') titles[l.lang] = l['*']; });
    facts.online = true;
    facts.sources.push(`https://en.wikipedia.org/wiki/${encodeURIComponent(ap.wiki.replace(/ /g, '_'))}`);
  } catch { /* offline: fall back to catalog data */ }

  opts.onStep?.('facts');
  if (facts.wikidataId) {
    try {
      const wd = await json<{ entities?: Record<string, { claims?: Record<string, WdClaim[]> }> }>(f, `https://www.wikidata.org/wiki/Special:EntityData/${facts.wikidataId}.json?origin=*`, ms);
      Object.assign(facts, parseWikidata(wd.entities?.[facts.wikidataId]));
      facts.sources.push(`https://www.wikidata.org/wiki/${facts.wikidataId}`);
    } catch { /* keep partial facts */ }
  }

  opts.onStep?.('localized');
  await Promise.all(LANGS.filter((l) => titles[l]).map(async (l) => {
    try {
      const s = await json<{ extract?: string }>(f, `https://${l}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titles[l]!.replace(/ /g, '_'))}`, ms);
      if (s.extract) { facts.summary[l] = s.extract.slice(0, 400); facts.online = true; }
    } catch { /* language skipped */ }
  }));
  return facts;
}
