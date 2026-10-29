export type Lang = 'en' | 'zh' | 'ko' | 'ja';
export const LANGS: { id: Lang; short: string; name: string; locale: string }[] = [
  { id: 'en', short: 'EN', name: 'English', locale: 'en-GB' },
  { id: 'zh', short: '中文', name: '中文（简体）', locale: 'zh-CN' },
  { id: 'ko', short: '한국어', name: '한국어', locale: 'ko-KR' },
  { id: 'ja', short: '日本語', name: '日本語', locale: 'ja-JP' },
];
export type Entry = { zh: string; ko: string; ja: string };

const KEY = 'aiops.lang';
const read = (): Lang => {
  try { const v = localStorage.getItem(KEY); if (v === 'en' || v === 'zh' || v === 'ko' || v === 'ja') return v; } catch { /* no storage */ }
  return 'en';
};
let current: Lang = typeof localStorage === 'undefined' ? 'en' : read();
const dict: Record<string, Entry> = {};

/** Registers translations. The key is the exact English source text; "{name}" marks a placeholder shared by all languages. */
export function register(entries: Record<string, Entry>) { Object.assign(dict, entries); }
export const allEntries = () => dict;
export const getLang = (): Lang => current;
export const locale = () => LANGS.find((l) => l.id === current)!.locale;
export function setLang(l: Lang) {
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l === 'zh' ? 'zh-CN' : l;
}

/** Translate an English source string. Unknown keys fall back to English so the UI never shows blanks. */
export function tr(key: string, params?: Record<string, string | number>): string {
  const s = current === 'en' ? key : dict[key]?.[current] ?? key;
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : s;
}
