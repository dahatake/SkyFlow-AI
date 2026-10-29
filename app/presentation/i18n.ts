import zh from './i18n/zh';
import ko from './i18n/ko';
import ja from './i18n/ja';

/** Presentation decks share the app's language choice (localStorage key `aiops.lang`); `?lang=zh|ko|ja|en` overrides it. */
export type DeckLang = 'en' | 'zh' | 'ko' | 'ja';
const LANGS: DeckLang[] = ['en', 'zh', 'ko', 'ja'];
const DICTS: Record<DeckLang, Record<string, string>> = { en: {}, zh, ko, ja };

const pick = (v: string | null): DeckLang | null => (LANGS as string[]).includes(v ?? '') ? (v as DeckLang) : null;
export function deckLang(): DeckLang {
  let stored: string | null = null;
  try { stored = localStorage.getItem('aiops.lang'); } catch { /* no storage */ }
  return pick(new URLSearchParams(location.search).get('lang')) ?? pick(stored) ?? 'en';
}

const lang = deckLang();
export const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Translates an English source string (whitespace-normalised); falls back to English. */
export function tx(s: string): string {
  return DICTS[lang][norm(s)] ?? s;
}

const INLINE = new Set(['B', 'I', 'EM', 'STRONG', 'SPAN', 'BR', 'SMALL', 'CODE', 'A', 'SUP', 'SUB']);
const SKIP = new Set(['SCRIPT', 'STYLE', 'CANVAS', 'SVG']);
const HAS_TEXT = /[A-Za-z]{2,}/;
const ATTRS = ['aria-label', 'title', 'data-act'];

/** Visits every translatable element: leaf-like elements whose innerHTML is the dictionary key. */
export function walk(root: Element, onText: (el: Element, key: string) => void, onAttr: (el: Element, attr: string, key: string) => void) {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (SKIP.has(el.tagName.toUpperCase())) continue;
    for (const a of ATTRS) { const v = el.getAttribute(a); if (v && HAS_TEXT.test(v)) onAttr(el, a, norm(v)); }
  }
  const visit = (el: Element) => {
    if (SKIP.has(el.tagName.toUpperCase())) return;
    const kids = Array.from(el.children);
    const direct = Array.from(el.childNodes).some((n) => n.nodeType === 3 && HAS_TEXT.test(n.textContent ?? ''));
    const inlineOnly = kids.every((k) => INLINE.has(k.tagName) && !k.querySelector('div,p,ul,li,table,section'));
    if (kids.length === 0 || (direct && inlineOnly)) {
      if (HAS_TEXT.test(el.textContent ?? '')) onText(el, norm(el.innerHTML));
      return;
    }
    kids.forEach(visit);
  };
  Array.from(root.children).forEach(visit);
}

export function localise() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
  if (lang === 'en') return;
  const d = DICTS[lang];
  document.title = d[norm(document.title)] ?? document.title;
  const meta = document.querySelector('meta[name="description"]');
  const m = meta?.getAttribute('content');
  if (meta && m && d[norm(m)]) meta.setAttribute('content', d[norm(m)]);
  walk(document.body,
    (el, key) => { if (d[key]) el.innerHTML = d[key]; },
    (el, attr, key) => { if (d[key]) el.setAttribute(attr, d[key]); });
}
