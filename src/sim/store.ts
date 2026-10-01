import { create } from 'zustand';
import {
  Alarm, Bay, Kpis, LedgerRow, LprRow, VideoEvent, OWNERS, pad, randAccount, randPlate,
  createBays, genLedgerRow, genLprRow, genVideoEvent, seedAlarms, seedVideoEvents, seedMewActivity,
  SEED_KPIS, INITIAL_NEXT_ALARM_ID,
} from './data';
import { bus } from './bus';

export interface SiapState {
  bays: Bay[];
  kpis: Kpis;
  alarms: Alarm[];
  nextAlarmId: number;
  ledger: LedgerRow[];
  lprLog: LprRow[];
  videoEvents: VideoEvent[];
  mewActivity: { label: string; delta: string }[];
  selectedBayId: number;
  /** simulated WAN outage ("Simulate WAN loss" demo toggle) */
  wan: { forced: boolean; bufferedCount: number; restoredMsg: string | null };
  tickCount: number;

  tick(): void;
  selectBay(id: number): void;
  /** Start a fill on a bay, optionally overriding transaction fields ({owner, account, plate, target}). */
  startFill(bayId: number, tx?: Partial<Pick<Bay, 'owner' | 'account' | 'plate' | 'target'>>): Bay | null;
  stopFill(bayId: number, finalStatus?: Bay['status']): Bay | null;
  ackAlarm(id: number): void;
  toggleWan(): void;
}

const range = <T,>(n: number, f: () => T): T[] => Array.from({ length: n }, f);
let wanRestoredTimer: ReturnType<typeof setTimeout> | null = null;

export const useSiap = create<SiapState>((set, get) => ({
  bays: createBays(),
  kpis: { ...SEED_KPIS },
  alarms: seedAlarms(),
  nextAlarmId: INITIAL_NEXT_ALARM_ID,
  ledger: range(8, genLedgerRow),
  lprLog: range(7, genLprRow),
  videoEvents: seedVideoEvents(),
  mewActivity: seedMewActivity(),
  selectedBayId: 14,
  wan: { forced: false, bufferedCount: 0, restoredMsg: null },
  tickCount: 0,

  /** One simulation step (called every 2.2 s by <Shell/>). Ported 1:1 from legacy simulateTick(). */
  tick() {
    const s = get();
    const bays = s.bays.map((b) => ({ ...b }));
    const kpis = { ...s.kpis };
    let alarms = s.alarms;
    let nextAlarmId = s.nextAlarmId;
    let ledger = s.ledger;
    let lprLog = s.lprLog;
    let videoEvents = s.videoEvents;
    let wan = s.wan;

    bays.forEach((b) => {
      if (b.status === 'filling') {
        b.dispensed = Math.min(b.target, b.dispensed + Math.round(b.flow * 8));
        b.flow = +(Math.max(15, b.flow + (Math.random() - 0.5) * 4)).toFixed(1);
        if (b.dispensed >= b.target) { b.status = 'done'; b.flow = 0; }
      }
    });
    if (Math.random() > 0.6) {
      const idles = bays.filter((b) => b.status === 'idle');
      if (idles.length) {
        const b = idles[Math.floor(Math.random() * idles.length)];
        b.status = 'filling'; b.flow = +(28 + Math.random() * 22).toFixed(1); b.dispensed = 0;
        b.owner = OWNERS[Math.floor(Math.random() * OWNERS.length)]; b.account = randAccount(); b.plate = randPlate();
      }
    }
    if (Math.random() > 0.75) {
      const dones = bays.filter((b) => b.status === 'done');
      if (dones.length) dones[Math.floor(Math.random() * dones.length)].status = 'idle';
    }
    if (Math.random() > 0.88) {
      const faults = bays.filter((b) => b.status === 'fault');
      if (faults.length) faults[Math.floor(Math.random() * faults.length)].status = 'idle';
    }

    kpis.activeBays = bays.filter((b) => b.status === 'filling').length;
    kpis.inletFlow = Math.max(400, Math.min(950, kpis.inletFlow + Math.round((Math.random() - 0.5) * 30)));
    kpis.revenueToday += Math.random() * 12;
    kpis.tankersServed += Math.random() > 0.7 ? 1 : 0;
    kpis.volumeToday += Math.random() * 0.0008;

    if (!wan.forced) {
      if (Math.random() > 0.93) kpis.wanLinkA = kpis.wanLinkA === 'up' ? 'degraded' : 'up';
      if (Math.random() > 0.9) {
        if (kpis.drSync === 'synced') { kpis.drSync = 'syncing'; kpis.drLagSec = Math.ceil(Math.random() * 4); }
        else { kpis.drSync = 'synced'; kpis.drLagSec = 0; }
      }
    } else {
      // store-and-forward: bays keep filling on last-known balance, one more transaction is buffered per tick
      wan = { ...wan, bufferedCount: wan.bufferedCount + 1 };
      ledger = [{ ...genLedgerRow(), status: 'Buffered' }, ...ledger].slice(0, ledger.length);
    }

    if (Math.random() > 0.85) {
      const faulted = bays.filter((b) => b.status === 'fault');
      if (faulted.length) {
        const b = faulted[Math.floor(Math.random() * faulted.length)];
        alarms = [{
          id: nextAlarmId++,
          sev: (Math.random() > 0.6 ? 'crit' : 'warn') as Alarm['sev'],
          text: `Bay ${pad(b.id)} — valve fault, custody metering suspended`,
          ts: Date.now(), ack: false,
        }, ...alarms].slice(0, 12);
      }
    }
    kpis.openAlarms = alarms.filter((a) => !a.ack).length;

    if (!wan.forced && Math.random() > 0.5) ledger = [genLedgerRow(), ...ledger].slice(0, ledger.length);
    if (Math.random() > 0.6) lprLog = [genLprRow(), ...lprLog].slice(0, lprLog.length);
    if (Math.random() > 0.75) videoEvents = [genVideoEvent(), ...videoEvents].slice(0, 8);

    set({ bays, kpis, alarms, nextAlarmId, ledger, lprLog, videoEvents, wan, tickCount: s.tickCount + 1 });
    bus.emit('tick');
  },

  selectBay(id) {
    set({ selectedBayId: id });
    bus.emit('bay:select', get().bays.find((b) => b.id === id));
  },

  startFill(bayId, tx = {}) {
    if (!get().bays.some((b) => b.id === bayId)) return null;
    let started: Bay | null = null;
    set((s) => ({
      bays: s.bays.map((b) => {
        if (b.id !== bayId) return b;
        started = { ...b, status: 'filling', dispensed: 0, flow: +(30 + Math.random() * 20).toFixed(1), ...tx };
        return started;
      }),
    }));
    bus.emit('fill:start', started);
    bus.emit('bay:change', started);
    return started;
  },

  stopFill(bayId, finalStatus = 'idle') {
    if (!get().bays.some((b) => b.id === bayId)) return null;
    let stopped: Bay | null = null;
    set((s) => ({
      bays: s.bays.map((b) => {
        if (b.id !== bayId) return b;
        stopped = { ...b, status: finalStatus, flow: 0 };
        return stopped;
      }),
    }));
    bus.emit('fill:stop', stopped);
    bus.emit('bay:change', stopped);
    return stopped;
  },

  ackAlarm(id) {
    set((s) => {
      const alarms = s.alarms.map((a) => (a.id === id ? { ...a, ack: true } : a));
      return { alarms, kpis: { ...s.kpis, openAlarms: alarms.filter((a) => !a.ack).length } };
    });
  },

  toggleWan() {
    const s = get();
    if (!s.wan.forced) {
      if (wanRestoredTimer) clearTimeout(wanRestoredTimer);
      set({ wan: { forced: true, bufferedCount: 0, restoredMsg: null }, kpis: { ...s.kpis, wanLinkA: 'down', wanLinkB: 'down' } });
    } else {
      const replayed = s.wan.bufferedCount;
      set({
        wan: { forced: false, bufferedCount: 0, restoredMsg: `WAN restored — replayed ${replayed} buffered transaction${replayed === 1 ? '' : 's'} to Salmiya · DR RPO 0 s` },
        ledger: s.ledger.map((r) => (r.status === 'Buffered' ? { ...r, status: 'Posted' } : r)),
        kpis: { ...s.kpis, wanLinkA: 'up', wanLinkB: 'up', drSync: 'syncing', drLagSec: 2 },
      });
      if (wanRestoredTimer) clearTimeout(wanRestoredTimer);
      wanRestoredTimer = setTimeout(() => {
        set((cur) => ({ wan: { ...cur.wan, restoredMsg: null }, kpis: { ...cur.kpis, drSync: 'synced', drLagSec: 0 } }));
      }, 4000);
    }
  },
}));

/** Non-reactive accessor, handy inside event handlers / the 3D scene loop. */
export const siap = () => useSiap.getState();
