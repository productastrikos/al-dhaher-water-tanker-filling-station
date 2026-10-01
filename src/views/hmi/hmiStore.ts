import { create } from 'zustand';
import { pad, type Bay } from '../../sim/data';
import { bus } from '../../sim/bus';

/* Module-local HMI state (per bay) — ported from legacy/hmi.js `hmi` object. Lives in a store so it survives
   the keep-alive view being hidden/shown. Batches accumulate from fill:start / fill:stop even while the
   HMI is not on screen (as long as this module has been loaded). */

export const TREND_POINTS = 60;

export interface BatchRec {
  batchNo: string; preset: number; delivered: number; remaining: number; flow: number; account: string; ok: boolean;
}

export const batchNoFor = (bayId: number, seq: number) => `B-${pad(bayId)}-${seq.toString().padStart(4, '0')}`;

/** Deterministic seed: 2 "already completed" batches per bay so the table never looks empty. */
export function seedHistory(bay: Pick<Bay, 'id' | 'account'>): { rows: BatchRec[]; nextSeq: number } {
  let seed = 0;
  for (const ch of String(bay.account || bay.id)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const baseSeq = 100 + (seed % 800);
  const rows: BatchRec[] = [];
  for (let i = 0; i < 2; i++) {
    const preset = 3000 + ((seed >> (i + 1)) % 5) * 1000;
    rows.push({ batchNo: batchNoFor(bay.id, baseSeq + i), preset, delivered: preset, remaining: 0, flow: 0, account: bay.account, ok: true });
  }
  return { rows: rows.reverse(), nextSeq: baseSeq + 2 };
}

interface HmiState {
  mode: Record<number, 'AUTO' | 'MANUAL'>;
  batchHistory: Record<number, BatchRec[]>;
  batchSeq: Record<number, number>;
  displayDispensed: Record<number, number>;
  flowHistory: Record<number, number[]>;
  classic: boolean;

  setMode(bayId: number, m: 'AUTO' | 'MANUAL'): void;
  setClassic(v: boolean): void;
  setDisplay(bayId: number, v: number): void;
  pushFlowSample(bayId: number, v: number): void;
  resetFlow(bayId: number, v: number): void;
  onFillStart(bay: Bay): void;
  onFillStop(bay: Bay): void;
}

export const useHmi = create<HmiState>((set, get) => ({
  mode: {},
  batchHistory: {},
  batchSeq: {},
  displayDispensed: {},
  flowHistory: {},
  classic: false,

  setMode: (bayId, m) => set((s) => ({ mode: { ...s.mode, [bayId]: m } })),
  setClassic: (classic) => set({ classic }),
  setDisplay: (bayId, v) => set((s) => ({ displayDispensed: { ...s.displayDispensed, [bayId]: v } })),
  pushFlowSample: (bayId, v) => set((s) => {
    const h = (s.flowHistory[bayId] ?? new Array(TREND_POINTS).fill(0)).slice();
    h.push(v);
    if (h.length > TREND_POINTS) h.shift();
    return { flowHistory: { ...s.flowHistory, [bayId]: h } };
  }),
  resetFlow: (bayId, v) => set((s) => ({ flowHistory: { ...s.flowHistory, [bayId]: new Array(TREND_POINTS).fill(v) } })),

  onFillStart(bay) {
    if (!bay) return;
    set((s) => {
      const seeded = s.batchHistory[bay.id] ? null : seedHistory(bay);
      return {
        displayDispensed: { ...s.displayDispensed, [bay.id]: 0 },
        ...(seeded ? { batchHistory: { ...s.batchHistory, [bay.id]: seeded.rows }, batchSeq: { ...s.batchSeq, [bay.id]: seeded.nextSeq } } : {}),
      };
    });
  },
  onFillStop(bay) {
    if (!bay) return;
    const ok = bay.status === 'done';
    set((s) => {
      const seeded = s.batchHistory[bay.id] ? null : seedHistory(bay);
      const hist = s.batchHistory[bay.id] ?? seeded!.rows;
      const seq = s.batchSeq[bay.id] ?? seeded!.nextSeq;
      const rec: BatchRec = {
        batchNo: batchNoFor(bay.id, seq), preset: bay.target, delivered: bay.dispensed,
        remaining: Math.max(0, bay.target - bay.dispensed), flow: 0, account: bay.account, ok,
      };
      return {
        batchHistory: { ...s.batchHistory, [bay.id]: [rec, ...hist].slice(0, 3) },
        batchSeq: { ...s.batchSeq, [bay.id]: seq + 1 },
      };
    });
  },
}));

// fill:start / fill:stop keep the batch table honest even if another view (ERP scenario, Bay Control)
// drives the bay. Registered once at module load.
const offStart = bus.on('fill:start', (bay) => useHmi.getState().onFillStart(bay));
const offStop = bus.on('fill:stop', (bay) => useHmi.getState().onFillStop(bay));
if (import.meta.hot) import.meta.hot.dispose(() => { offStart(); offStop(); }); // avoid duplicate listeners on HMR
