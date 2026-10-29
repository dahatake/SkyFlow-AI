import { createContext, useContext } from 'react';
import { LANGS, tr, type Lang } from './core';

export const LangCtx = createContext<{ lang: Lang; change(l: Lang): void }>({ lang: 'en', change: () => undefined });
export const useLang = () => useContext(LangCtx);

/** Language toggle: EN / 中文 / 한국어 / 日本語. */
export function LangSwitch() {
  const { lang, change } = useLang();
  return (
    <div role="group" aria-label={tr('Language')} className="seg lang">
      {LANGS.map((l) => <button key={l.id} aria-pressed={lang === l.id} title={l.name} lang={l.id === 'zh' ? 'zh-CN' : l.id} onClick={() => change(l.id)}>{l.short}</button>)}
    </div>
  );
}
