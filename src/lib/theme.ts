import { create } from 'zustand';

const KEY = 'siap.theme';
export type Theme = 'dark' | 'light';

function read(): Theme {
  try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}

interface ThemeState { theme: Theme; toggle(): void; }

/** styles.css defines both palettes under :root and :root[data-theme="light"]; we just flip the attribute. */
export const useTheme = create<ThemeState>((set, get) => ({
  theme: read(),
  toggle() {
    const theme: Theme = get().theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
}));
