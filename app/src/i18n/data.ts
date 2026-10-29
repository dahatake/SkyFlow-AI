import { tr, allEntries, getLang } from './core';
import './dict-data';

type Tpl = { key: string; re: RegExp; names: string[] };
let cache: { size: number; list: Tpl[] } | null = null;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function templates(): Tpl[] {
  const all = allEntries();
  const keys = Object.keys(all);
  if (cache && cache.size === keys.length) return cache.list;
  const list: Tpl[] = [];
  for (const key of keys) {
    if (!/\{\w+\}/.test(key)) continue;
    const names: string[] = [];
    const src = key.split(/(\{\w+\})/).map((p) => {
      const m = /^\{(\w+)\}$/.exec(p);
      if (!m) return esc(p);
      names.push(m[1]);
      return '(.+?)';
    }).join('');
    list.push({ key, re: new RegExp('^' + src + '$'), names });
  }
  // Longest literal text first so the most specific template wins.
  list.sort((a, b) => b.key.replace(/\{\w+\}/g, '').length - a.key.replace(/\{\w+\}/g, '').length);
  cache = { size: keys.length, list };
  return list;
}

/**
 * Translates a seed/demo data string at display time.
 * Exact lookup first, then "{placeholder}" templates; placeholder values are translated recursively.
 * Unknown strings are returned unchanged.
 */
export function trData(s: string | undefined | null): string {
  if (s == null || getLang() === 'en') return s ?? '';
  if (s in allEntries()) return tr(s);
  for (const t of templates()) {
    const m = t.re.exec(s);
    if (!m) continue;
    const params: Record<string, string> = {};
    t.names.forEach((n, i) => { params[n] = trData(m[i + 1]); });
    return tr(t.key, params);
  }
  return s;
}
