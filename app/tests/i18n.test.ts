import { describe, expect, it } from 'vitest';
import { allEntries, getLang, setLang, tr } from '../src/i18n';

describe('i18n', () => {
  const entries = Object.entries(allEntries());
  it('has a complete, placeholder-consistent translation for every key', () => {
    expect(entries.length).toBeGreaterThan(50);
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    entries.forEach(([k, v]) => {
      (['zh', 'ko', 'ja'] as const).forEach((l) => {
        expect(v[l], `${l}: ${k}`).toBeTruthy();
        expect(ph(v[l]), `${l} placeholders: ${k}`).toBe(ph(k));
      });
    });
  });
  it('switches language, interpolates and falls back to English', () => {
    const prev = getLang();
    setLang('ja');
    const [k, v] = entries[0];
    expect(tr(k)).toBe(v.ja);
    expect(tr('Untranslated {x}', { x: 1 })).toBe('Untranslated 1');
    setLang('en');
    expect(tr(k)).toBe(k);
    setLang(prev);
  });
});
