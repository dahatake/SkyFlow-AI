import { describe, expect, it } from 'vitest';
import { AIRPORT_CATALOG, searchCatalog } from '../src/importer/catalog';
import { gatherAirportFacts, parseWikidata } from '../src/importer/gather';
import { buildImportedAirport } from '../src/importer/generate';
import { validateCustomer } from '../src/customers/schema';

const sin = AIRPORT_CATALOG.find((a) => a.iata === 'SIN')!;

describe('airport importer', () => {
  it('catalog has unique codes, valid zones and four localized labels', () => {
    expect(new Set(AIRPORT_CATALOG.map((a) => a.iata)).size).toBe(AIRPORT_CATALOG.length);
    AIRPORT_CATALOG.forEach((a) => {
      expect(() => new Intl.DateTimeFormat('en', { timeZone: a.timezone })).not.toThrow();
      (['en', 'zh', 'ko', 'ja'] as const).forEach((l) => expect(a.labels[l], `${a.iata} ${l}`).toBeTruthy());
    });
  });
  it('searches localized labels and codes', () => {
    expect(searchCatalog('羽田').map((a) => a.iata)).toContain('HND');
    expect(searchCatalog('wsss')[0].iata).toBe('SIN');
  });
  it('parses wikidata claims', () => {
    const f = parseWikidata({ claims: {
      P3872: [{ mainsnak: { datavalue: { value: { amount: '+50000000' } } }, qualifiers: { P585: [{ datavalue: { value: { time: '+2019-01-01T00:00:00Z' } } }] } }],
      P2044: [{ mainsnak: { datavalue: { value: { amount: '+7' } } } }],
      P856: [{ mainsnak: { datavalue: { value: 'https://example.org' } } }],
      P571: [{ mainsnak: { datavalue: { value: { time: '+1981-07-01T00:00:00Z' } } } }],
    } });
    expect(f).toEqual({ annualPassengers: 50000000, elevationM: 7, website: 'https://example.org', opened: '1981' });
  });
  it('gathers nothing but does not throw when offline', async () => {
    const facts = await gatherAirportFacts(sin, { fetcher: () => Promise.reject(new Error('offline')) });
    expect(facts.online).toBe(false);
    expect(facts.summary).toEqual({});
  });
  it('gathers localized summaries from Wikipedia and Wikidata', async () => {
    const fetcher = async (url: string) => {
      const body = url.includes('w/api.php') ? { query: { pages: { 1: { pageprops: { wikibase_item: 'Q1' }, langlinks: [{ lang: 'ja', '*': 'チャンギ国際空港' }] } } } }
        : url.includes('wikidata') ? { entities: { Q1: { claims: {} } } } : { extract: `summary ${url.split('/')[2]}` };
      return new Response(JSON.stringify(body));
    };
    const facts = await gatherAirportFacts(sin, { fetcher });
    expect(facts.online).toBe(true);
    expect(facts.summary.ja).toContain('ja.wikipedia.org');
    expect(facts.summary.en).toBeTruthy();
  });
  it('maps airport country to UI language, defaulting to English', async () => {
    const { langForCountry } = await import('../src/importer/catalog');
    expect(['JP', 'KR', 'CN', 'HK', 'TW', 'SG', 'FR'].map(langForCountry)).toEqual(['ja', 'ko', 'zh', 'zh', 'zh', 'en', 'en']);
  });
  it('parses Overpass geometry and projects it inside the box', async () => {
    const { parseOverpass, projector, mapBbox, fetchOsmMap } = await import('../src/importer/osm');
    const feats = parseOverpass({ elements: [
      { type: 'way', tags: { aeroway: 'runway', ref: '16L/34R' }, geometry: [{ lat: 35.55, lon: 139.77 }, { lat: 35.56, lon: 139.79 }] },
      { type: 'way', tags: { building: 'terminal' }, geometry: [{ lat: 35.54, lon: 139.78 }, { lat: 35.55, lon: 139.78 }, { lat: 35.55, lon: 139.79 }] },
      { type: 'way', tags: { highway: 'service' }, geometry: [{ lat: 35.5, lon: 139.7 }, { lat: 35.5, lon: 139.8 }] },
    ] });
    expect(feats.map((f) => f.kind)).toEqual(['runway', 'terminal']);
    const b = mapBbox(35.5494, 139.7798);
    const [x, y] = projector(b, 1000, 700)(feats[0].pts[0]);
    expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(1000); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(700);
    expect(await fetchOsmMap(35.5, 139.7, () => Promise.reject(new Error('offline')))).toBeNull();
  });
  it('generates valid, deterministic sample data for every airport', () => {
    AIRPORT_CATALOG.forEach((a) => {
      const x = buildImportedAirport(a, { online: false, summary: {}, sources: [] }, '2026-01-01T00:00:00Z');
      expect(validateCustomer(x.customer), a.iata).toEqual([]);
      expect(x.data.flights.length).toBeGreaterThan(0);
      const stands = new Set(x.data.stands.map((s) => s.id));
      x.data.flights.forEach((f) => { expect(stands.has(f.standId)).toBe(true); expect(f.std).toBeGreaterThan(f.sta); expect(f.origin).not.toBe(a.iata); });
      expect(JSON.stringify(buildImportedAirport(a, x.facts, x.importedAt))).toBe(JSON.stringify(x));
    });
  });
});
