import { create } from 'zustand';
import { viewById } from '../views/registry';
import { bus } from '../sim/bus';

function initialView(): string {
  try {
    const v = new URLSearchParams(window.location.search).get('view');
    if (v && viewById(v)) return v;
  } catch { /* ignore */ }
  return 'dashboard';
}

interface UiState {
  activeView: string;
  /** views visited so far — they stay mounted (keep-alive) */
  visited: string[];
  showView(id: string): void;
}

export const useUi = create<UiState>((set, get) => {
  const first = initialView();
  return {
    activeView: first,
    visited: [first],
    showView(id) {
      if (!viewById(id)) return;
      const { visited } = get();
      set({ activeView: id, visited: visited.includes(id) ? visited : [...visited, id] });
      bus.emit('view:show', id);
    },
  };
});

/** Imperative helper for non-React code: switch screen. */
export const showView = (id: string) => useUi.getState().showView(id);
