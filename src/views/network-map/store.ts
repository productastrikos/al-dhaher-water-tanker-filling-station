import { create } from 'zustand';
import { OWNERS, randPlate, type BayStatus } from '../../sim/data';
import { NETWORK_STATIONS, MAP_W, MAP_H, stationPct, type Station } from './stations';

/* Module-local state for the Kuwait network map. Only the flagship (Al Dhaher) reads the real sim bays; the other
   25 stations are a small deterministic synthetic model with a light per-tick jitter — a map overview, not a
   second simulation engine (same as the legacy). */

export type NmStatus = 'idle' | 'filling' | 'done' | 'fault' | 'offline';
export interface NmBay { status: NmStatus; target: number; dispensed: number; owner: string; plate: string; lastActivity: number; }
export interface View { x: number; y: number; w: number; h: number; }

function seededRng(seedStr: string) {
  let seed = 0;
  for (const ch of String(seedStr)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return function next() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function weightedStatusFrom(rnd: () => number): NmStatus {
  const r = rnd();
  if (r < 0.08) return 'fault';
  if (r < 0.55) return 'filling';
  if (r < 0.85) return 'done';
  return 'idle';
}

function seedStationBays(station: Station): NmBay[] {
  const rnd = seededRng(`nm-${station.id}-${station.name}`);
  const bays: NmBay[] = [];
  for (let i = 0; i < 2; i++) {
    const status = weightedStatusFrom(rnd);
    const target = 3000 + Math.floor(rnd() * 3) * 1000;
    const dispensed = status === 'filling' ? Math.floor(target * (0.2 + rnd() * 0.6)) : status === 'done' ? target : 0;
    bays.push({
      status, target, dispensed,
      owner: OWNERS[Math.floor(rnd() * OWNERS.length)],
      plate: randPlate(),
      lastActivity: Date.now() - Math.floor(rnd() * 90) * 60000,
    });
  }
  return bays;
}

export function aggregateStatus(bays: { status: BayStatus }[] | undefined): BayStatus {
  if (!bays || !bays.length) return 'idle';
  if (bays.some((b) => b.status === 'fault')) return 'fault';
  if (bays.some((b) => b.status === 'filling')) return 'filling';
  if (bays.every((b) => b.status === 'done')) return 'done';
  return 'idle';
}

/* ---- pan/zoom via the SVG's own viewBox (see legacy comments: vector-crisp at any zoom level) ---- */
export const ZOOM_MAX_FACTOR = 8;
export const MIN_VB_W = MAP_W / ZOOM_MAX_FACTOR;
export const FULL_VIEW: View = { x: 0, y: 0, w: MAP_W, h: MAP_H };

export function clampView(v: View): View {
  const w = Math.min(MAP_W, Math.max(MIN_VB_W, v.w));
  const h = w * (MAP_H / MAP_W);
  return { w, h, x: Math.min(MAP_W - w, Math.max(0, v.x)), y: Math.min(MAP_H - h, Math.max(0, v.y)) };
}

interface NmState {
  bays: Record<number, NmBay[]>;
  selectedId: number | null;
  searchTerm: string;
  view: View;
  setView(v: View): void;
  setSearch(s: string): void;
  select(id: number | null): void;
  /** Zoom keeping the map point at fractional position (fx, fy) of the viewport fixed. */
  zoomAt(ptX: number, ptY: number, factor: number): void;
  focusStation(st: Station, targetW?: number): void;
  jitter(): void;
}

const initialBays = () => {
  const out: Record<number, NmBay[]> = {};
  NETWORK_STATIONS.forEach((st) => { if (!st.flagship) out[st.id] = seedStationBays(st); });
  return out;
};

export const useNm = create<NmState>((set, get) => ({
  bays: initialBays(),
  selectedId: null,
  searchTerm: '',
  view: { ...FULL_VIEW },

  setView: (view) => set({ view: clampView(view) }),
  setSearch: (searchTerm) => set({ searchTerm }),
  select: (selectedId) => set({ selectedId }),

  zoomAt(ptX, ptY, factor) {
    const v = get().view;
    const fx = (ptX - v.x) / v.w, fy = (ptY - v.y) / v.h;
    const w = v.w / factor;
    let nv = clampView({ x: v.x, y: v.y, w, h: w * (MAP_H / MAP_W) });
    nv = clampView({ ...nv, x: ptX - fx * nv.w, y: ptY - fy * nv.h });
    set({ view: nv });
  },

  /** Pan+zoom so a station's pin is at the centre at a comfortable zoom level. */
  focusStation(st, targetW = MAP_W / 3) {
    const { xPct, yPct } = stationPct(st);
    const ux = (xPct / 100) * MAP_W, uy = (yPct / 100) * MAP_H;
    const w = Math.min(get().view.w, targetW);
    const h = w * (MAP_H / MAP_W);
    set({ view: clampView({ w, h, x: ux - w / 2, y: uy - h / 2 }) });
  },

  /** 1–2 random non-flagship bays change status per tick so the map isn't a static screenshot. */
  jitter() {
    const ids = Object.keys(get().bays);
    if (!ids.length) return;
    const bays = { ...get().bays };
    const hits = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < hits; i++) {
      const id = ids[Math.floor(Math.random() * ids.length)];
      const list = bays[+id].map((b) => ({ ...b }));
      const bay = list[Math.floor(Math.random() * list.length)];
      bay.status = weightedStatusFrom(Math.random);
      if (bay.status === 'filling') bay.dispensed = Math.floor(bay.target * (0.1 + Math.random() * 0.6));
      else if (bay.status === 'done') bay.dispensed = bay.target;
      else bay.dispensed = 0;
      bay.lastActivity = Date.now();
      bays[+id] = list;
    }
    set({ bays });
  },
}));
