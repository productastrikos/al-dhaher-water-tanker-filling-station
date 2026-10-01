import { create } from 'zustand';
import { AR as BASE } from './ar';

// Per-module extra translations: drop a file exporting `default: Record<string,string>` in src/i18n/extra/.
const extras = import.meta.glob<{ default: Record<string, string> }>('./extra/*.ts', { eager: true });
const AR: Record<string, string> = Object.assign({}, BASE, ...Object.values(extras).map((m) => m.default));

const KEY = 'siap.lang';
export type Lang = 'en' | 'ar';

function saved(): Lang {
  try { return localStorage.getItem(KEY) === 'ar' ? 'ar' : 'en'; } catch { return 'en'; }
}

interface LangState { lang: Lang; setLang(l: Lang): void; toggle(): void; }

export const useLangStore = create<LangState>((set, get) => ({
  lang: saved(),
  setLang(lang) {
    try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
    set({ lang });
  },
  toggle() { get().setLang(get().lang === 'ar' ? 'en' : 'ar'); },
}));

/** Translate an exact English UI string (falls back to the English text when no Arabic entry exists). */
export function tr(en: string, lang: Lang = useLangStore.getState().lang): string {
  if (lang === 'ar') return AR[en] || AR[en.trim()] || en;
  return en;
}

/** Hook: subscribes the component to language changes and returns { t, lang, dir }.
 *  Usage: const { t } = useT();  <span>{t('Command Dashboard')}</span> */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return { lang, dir: lang === 'ar' ? 'rtl' : 'ltr', t: (en: string) => tr(en, lang) };
}

const STATUS_EN: Record<string, string> = { idle: 'Idle', filling: 'Filling', done: 'Done', fault: 'Fault', offline: 'Offline' };
/** Localised bay status word. */
export function statusLabel(s: string, lang: Lang = useLangStore.getState().lang): string {
  return tr(STATUS_EN[s] ?? s, lang);
}

/** "Xm ago" label recomputed on each render. */
export function timeAgo(ts: number, lang: Lang = useLangStore.getState().lang): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return tr('just now', lang);
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}${tr('m ago', lang)}`;
  const h = Math.floor(m / 60);
  return `${h}${tr('h', lang)} ${m % 60}${tr('m ago', lang)}`;
}
