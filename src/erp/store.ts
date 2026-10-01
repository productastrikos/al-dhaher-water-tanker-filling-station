/* S!aP — Enterprise & ERP module — ONE zustand store for all ERP state + the Order-to-Cash scenario engine
   (ported from legacy/erp.js). Everything is simulated. The O2C scenario drives a real bay (Bay 14) through
   useSiap.startFill/stopFill and writes the Gate LPR log, billing ledger, MEW wallet activity and alarms of the
   shared S!aP store, exactly like the legacy module did. */
import { create } from 'zustand';
import { useSiap } from '../sim/store';
import { bus } from '../sim/bus';
import { OWNERS, randPlate } from '../sim/data';
import {
  ERP_DEMO_IDS, buildSeed, daysFromNow, erpPad, fmtKD, initialsOf, loadPersisted, maskCivilId, savePersisted, timeStr,
  type AuditRow, type Credential, type Customer, type Driver, type ErpData, type PurchaseOrder, type SyncRow, type Truck,
} from './data';

/* ================= O2C definition ================= */
export const O2C_STEPS = [
  { key: 'po_raised', label: 'PO raised' },
  { key: 'approved', label: 'Approved' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'paid', label: 'Paid · K-net' },
  { key: 'wallet_credited', label: 'Wallet credited' },
  { key: 'truck_registered', label: 'Truck registered' },
  { key: 'driver_registered', label: 'Driver registered' },
  { key: 'card_issued', label: 'Card issued' },
  { key: 'gate_lpr', label: 'Gate LPR match' },
  { key: 'bay_authorised', label: 'Bay authorised · QR/PIN' },
  { key: 'filling', label: 'Filling · fine-fill' },
  { key: 'debit', label: 'Exact-volume debit' },
  { key: 'receipt', label: 'Receipt · SMS/e-mail' },
  { key: 'gl_posting', label: 'GL posting' },
  { key: 'settlement', label: 'Settlement to MEW bank' },
] as const;
export const O2C_FILL_INDEX = O2C_STEPS.findIndex((s) => s.key === 'filling');
export const O2C_STEP_MS = 2200;
export const O2C_BAY = 14;

export interface O2CObjects {
  poId?: string; customerId?: string; customerName?: string; account?: string; approver?: string; invoiceNo?: string; knetRef?: string;
  truckId?: string; plate?: string; driverId?: string; cardId?: string; bayId?: number; dispensed?: number; amountKD?: number;
}
export interface O2CLogLine { i: number; ts: number; text: string; }
export interface Scenario {
  index: number; running: boolean; waitingFill: boolean;
  objects: O2CObjects; stepTs: Record<number, number>; log: O2CLogLine[];
  /** English status line (translated by the view) */
  status: string;
}
const INITIAL_STATUS = 'Ready — press Run to start the scenario.';
const freshScenario = (): Scenario => ({ index: -1, running: false, waitingFill: false, objects: {}, stepTs: {}, log: [], status: INITIAL_STATUS });

export type Overlay =
  | { kind: 'po-wizard' }
  | { kind: 'receipt' }
  | { kind: 'customer'; id: string }
  | { kind: 'truck-form' }
  | { kind: 'driver-form' }
  | { kind: 'scan-plate' }
  | { kind: 'issue-card' };

export interface TruckForm { ownerId: string; plate: string; capacityIG: number; make: string; calibCertNo: string; calibExpiry: string; hatchType: string; }
export interface DriverForm { name: string; civilId: string; licenceExpiry: string; phone: string; truckId: string; }
export interface CardForm { type: string; customerId: string; truckId: string; driverId: string; }

interface ErpState extends ErpData {
  outage: { active: boolean; buffered: number };
  scenario: Scenario;
  overlay: Overlay | null;

  openOverlay(o: Overlay): void;
  closeOverlay(): void;

  createPo(a: { customerId: string; qty: number; tariffId: string }): PurchaseOrder;
  payPo(id: string): void;
  toggleCustomerSuspend(id: string): void;
  assignDriverTruck(driverId: string, truckId: string): void;
  registerTruck(f: TruckForm): void;
  registerDriver(f: DriverForm): void;
  scanPlate(plate: string): void;
  advanceCard(id: string, to: string): void;
  issueCard(f: CardForm): void;
  simulateWrongPins(cardId: string): void;
  retrySync(id: string): void;
  toggleOutage(): void;

  o2cRun(): void;
  o2cPause(): void;
  o2cStep(): void;
  o2cReset(): void;
  resetDemo(): void;
}

const initialData = (): ErpData => loadPersisted() ?? buildSeed();
const pick = (s: ErpState): ErpData => ({
  customers: s.customers, tariffs: s.tariffs, trucks: s.trucks, drivers: s.drivers, purchaseOrders: s.purchaseOrders,
  credentials: s.credentials, workOrders: s.workOrders, audit: s.audit, gate: s.gate, connectors: s.connectors,
  mapping: s.mapping, erpSync: s.erpSync,
});

/* module-level scenario machinery (timers / subscriptions are not state) */
let stepTimer: ReturnType<typeof setTimeout> | null = null;
let fillOffBus: (() => void) | null = null;
let fillOffSub: (() => void) | null = null;
let fillTimeout: ReturnType<typeof setTimeout> | null = null;

const rnd = (min: number, spread: number) => min + Math.floor(Math.random() * spread);
const upd = <T extends { id: string }>(arr: T[], id: string, patch: Partial<T> | ((x: T) => Partial<T>)): T[] =>
  arr.map((x) => (x.id === id ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x));

export const useErp = create<ErpState>((set, get) => ({
  ...initialData(),
  outage: { active: false, buffered: 0 },
  scenario: freshScenario(),
  overlay: null,

  openOverlay(o) { set({ overlay: o }); },
  closeOverlay() { set({ overlay: null }); },

  createPo({ customerId, qty, tariffId }) {
    const { customers, tariffs, purchaseOrders } = get();
    const customer = customers.find((c) => c.id === customerId)!;
    const tariff = tariffs.find((t) => t.id === tariffId)!;
    const id = `PO-2026-${erpPad(200 + purchaseOrders.length)}`;
    const now = Date.now();
    const po: PurchaseOrder = {
      id, customerId: customer.id, customerName: customer.name, quantityIG: qty, tariffId: tariff.id,
      rateKD: tariff.rate, amountKD: +(qty * tariff.rate).toFixed(3), requestedWindow: 'This week', status: 'Invoiced',
      approver: 'F. Al-Ansari (Ops Manager)', invoiceNo: `INV-${rnd(89100, 800)}`, knetRef: '—',
      createdAt: now, updatedAt: now, remainingIG: qty, fillsCount: 0,
    };
    set({ purchaseOrders: [po, ...purchaseOrders] });
    audit(po.approver, 'PO approved & invoiced', id, 'Draft', 'Invoiced');
    return po;
  },

  payPo(id) {
    setTimeout(() => {
      const po = get().purchaseOrders.find((p) => p.id === id);
      if (!po) return;
      const customer = get().customers.find((c) => c.id === po.customerId);
      if (!customer) return;
      set((s) => ({
        purchaseOrders: upd(s.purchaseOrders, id, { knetRef: `KNET-${rnd(772500, 900)}`, updatedAt: Date.now(), status: 'Active' }),
        customers: upd(s.customers, customer.id, { wallet: +(customer.wallet + po.amountKD).toFixed(3) }),
      }));
      pushLedger({ time: timeStr(Date.now()), account: customer.account, type: 'Top-up', volume: '—', amount: `+KD ${po.amountKD.toFixed(3)}`, channel: 'K-net', status: 'Cleared' });
      audit('K-net Gateway', 'Payment captured & wallet credited', po.id, 'Invoiced', 'Active');
    }, 900);
  },

  toggleCustomerSuspend(id) {
    const c = get().customers.find((x) => x.id === id);
    if (!c) return;
    const before = c.status;
    const after = before === 'Suspended' ? 'Active' : 'Suspended';
    set((s) => ({ customers: upd(s.customers, id, { status: after }) }));
    audit('F. Al-Ansari (Ops Manager)', after === 'Suspended' ? 'Customer suspended' : 'Customer re-activated', id, before, after);
  },

  assignDriverTruck(driverId, truckId) {
    set((s) => ({ drivers: upd(s.drivers, driverId, { assignedTruckIds: truckId ? [truckId] : [] }) }));
    audit('System', 'Driver linked to truck', driverId, '—', truckId || 'none');
  },

  registerTruck(f) {
    const { customers, trucks } = get();
    const owner = customers.find((c) => c.id === f.ownerId) ?? customers[0];
    let id = `TRK-${erpPad(rnd(4300, 600))}`;
    while (trucks.some((t) => t.id === id)) id = `TRK-${erpPad(rnd(4300, 600))}`;
    const truck: Truck = {
      id, plate: f.plate || randPlate(), ownerId: owner.id, ownerName: owner.name, capacityIG: f.capacityIG, make: f.make,
      calibCertNo: f.calibCertNo, calibExpiry: new Date(f.calibExpiry).getTime() || daysFromNow(365), hatchType: f.hatchType,
      status: 'Active', rfidTag: `RFID-T${erpPad(rnd(9500, 400))}`,
    };
    set({ trucks: [truck, ...trucks] });
    audit('System', 'Truck registered', truck.id, '—', 'Active');
  },

  registerDriver(f) {
    const { drivers } = get();
    const name = f.name.trim() || 'New Driver';
    const civilRaw = f.civilId.trim();
    let id = `DRV-${erpPad(rnd(7200, 600))}`;
    while (drivers.some((d) => d.id === id)) id = `DRV-${erpPad(rnd(7200, 600))}`;
    const driver: Driver = {
      id, name,
      civilId: civilRaw ? maskCivilId(civilRaw.length * 7 + name.length) : maskCivilId(name.length + Math.floor(Math.random() * 90)),
      licenceClass: 'Heavy Goods · Class 4',
      licenceExpiry: new Date(f.licenceExpiry).getTime() || daysFromNow(300),
      phone: f.phone || '+965 50000000',
      assignedTruckIds: f.truckId ? [f.truckId] : [],
      status: 'Active', initials: initialsOf(name),
    };
    set({ drivers: [driver, ...drivers] });
    audit('System', 'Driver registered', driver.id, '—', 'Active');
  },

  scanPlate(plate) {
    const truck = get().trucks.find((t) => t.plate === plate);
    const now = Date.now();
    pushLpr(truck
      ? { time: timeStr(now), plate, owner: truck.ownerName, gate: 'Entry', status: `Matched · Bay ${1 + Math.floor(Math.random() * 42)}` }
      : { time: timeStr(now), plate, owner: '—', gate: 'Entry', status: 'No match · Gate held' });
    audit('System', 'LPR scan test', plate, '—', truck ? 'Matched' : 'No match');
    set({ overlay: null });
  },

  advanceCard(id, to) {
    const c = get().credentials.find((x) => x.id === id);
    if (!c) return;
    const before = c.status;
    set((s) => ({ credentials: upd(s.credentials, id, { status: to, ...(to === 'Activated' ? { pinAttempts: 0 } : {}) }) }));
    audit('System', `Card ${to.toLowerCase()}`, id, before, to);
  },

  issueCard(f) {
    const { customers, trucks, drivers, credentials } = get();
    const customer = customers.find((c) => c.id === f.customerId) ?? customers[0];
    const truck = trucks.find((t) => t.id === f.truckId);
    const driver = drivers.find((d) => d.id === f.driverId);
    let id = `CARD-${erpPad(rnd(10600, 300))}`;
    while (credentials.some((c) => c.id === id)) id = `CARD-${erpPad(rnd(10600, 300))}`;
    const card: Credential = {
      id, type: f.type, customerId: customer.id, customerName: customer.name,
      truckId: truck ? truck.id : '', truckPlate: truck ? truck.plate : '—',
      driverId: driver ? driver.id : '', driverName: driver ? driver.name : '—',
      pinAttempts: 0, status: 'Requested', issuedAt: Date.now(), expiry: daysFromNow(365),
    };
    set({ credentials: [card, ...credentials] });
    audit('System', 'Card requested', id, '—', 'Requested');
  },

  simulateWrongPins(cardId) {
    const card = get().credentials.find((c) => c.id === cardId);
    if (!card) return;
    set((s) => ({ credentials: upd(s.credentials, cardId, { pinAttempts: 3, status: 'Suspended' }) }));
    audit('System', '3 wrong PIN attempts', card.id, 'Activated', 'Suspended');
    useSiap.setState((s) => {
      const alarms = [{ id: s.nextAlarmId, sev: 'crit' as const, text: `Card ${card.id} — 3 failed PIN attempts, account ${card.customerName} locked`, ts: Date.now(), ack: false }, ...s.alarms].slice(0, 12);
      return { alarms, nextAlarmId: s.nextAlarmId + 1, kpis: { ...s.kpis, openAlarms: alarms.filter((a) => !a.ack).length } };
    });
  },

  retrySync(id) {
    set((s) => ({ erpSync: s.erpSync.map((r) => (r.id === id ? { ...r, status: 'Synced', retries: r.retries + 1 } : r)) }));
    audit('System', 'Sync retried', id, 'Failed/Pending', 'Synced');
  },

  toggleOutage() {
    const { outage } = get();
    if (!outage.active) {
      set((s) => ({ outage: { active: true, buffered: 0 }, connectors: s.connectors.map((c) => ({ ...c, status: 'Down' })) }));
      audit('System', 'ERP outage simulated', 'all connectors', 'Connected', 'Down');
    } else {
      const n = outage.buffered;
      set((s) => ({ connectors: s.connectors.map((c) => ({ ...c, status: 'Connected', lastSync: Date.now() })) }));
      pushSync('sap', `Replayed ${n} buffered transactions`, 'S!aP → ERP', 'Synced', 0);
      audit('System', 'ERP link restored — buffered txns replayed', `${n} txns`, 'Down', 'Connected');
      set({ outage: { active: false, buffered: 0 } });
    }
  },

  /* ---------------- Order-to-Cash scenario ---------------- */
  o2cRun() {
    const sc = get().scenario;
    if (sc.index >= O2C_STEPS.length - 1) { setScenario({ status: 'Scenario complete — press Reset to run again.' }); return; }
    setScenario({ running: true, status: sc.waitingFill ? 'Resumed — waiting for Bay 14 to finish filling…' : 'Running…' });
    if (!sc.waitingFill) scheduleNext(400);
  },
  o2cPause() {
    clearStepTimer();
    const w = get().scenario.waitingFill;
    setScenario({ running: false, status: w ? 'Paused — Bay 14 keeps filling in the background.' : 'Paused.' });
  },
  o2cStep() {
    const sc = get().scenario;
    if (sc.waitingFill) { setScenario({ status: 'Still filling Bay 14 — waiting for completion (or press Run to continue automatically).' }); return; }
    const next = sc.index + 1;
    if (next >= O2C_STEPS.length) { setScenario({ status: 'Scenario complete — press Reset to run again.' }); return; }
    doStep(next);
  },
  o2cReset() {
    clearStepTimer();
    clearFillWait();
    const bay = useSiap.getState().bays.find((b) => b.id === O2C_BAY);
    if (bay && bay.status === 'filling') useSiap.getState().stopFill(O2C_BAY, 'idle');
    set({ scenario: freshScenario() });
  },
  resetDemo() {
    const { o2cReset } = get();
    set({ ...buildSeed(), outage: { active: false, buffered: 0 } });
    o2cReset();
  },
}));

/* ================= helpers that touch the stores ================= */
function setScenario(p: Partial<Scenario>) { useErp.setState((s) => ({ scenario: { ...s.scenario, ...p } })); }
function clearStepTimer() { if (stepTimer) { clearTimeout(stepTimer); stepTimer = null; } }
function clearFillWait() {
  if (fillOffBus) { fillOffBus(); fillOffBus = null; }
  if (fillOffSub) { fillOffSub(); fillOffSub = null; }
  if (fillTimeout) { clearTimeout(fillTimeout); fillTimeout = null; }
}

function audit(user: string, action: string, object: string, before: string, after: string) {
  const row: AuditRow = { id: `AUD-${erpPad(10000 + Math.floor(Math.random() * 89999))}`, ts: Date.now(), user, action, object, before, after };
  useErp.setState((s) => ({ audit: [row, ...s.audit].slice(0, 60) }));
}

function pushSync(connectorId: string, object: string, direction: string, status: string, retries: number) {
  const row: SyncRow = { id: `SYNC-${erpPad(10000 + Math.floor(Math.random() * 89999))}`, ts: Date.now(), connector: connectorId, object, direction, status, retries };
  useErp.setState((s) => ({
    erpSync: [row, ...s.erpSync].slice(0, 30),
    connectors: s.connectors.map((c) => (c.id === connectorId ? { ...c, lastSync: Date.now(), objectsSynced: (c.objectsSynced || 0) + 1 } : c)),
  }));
}

function pushLedger(row: { time: string; account: string; type: string; volume: string; amount: string; channel: string; status: string }) {
  useSiap.setState((s) => ({ ledger: [row, ...s.ledger].slice(0, 9) }));
}
function pushLpr(row: { time: string; plate: string; owner: string; gate: string; status: string }) {
  useSiap.setState((s) => ({ lprLog: [row, ...s.lprLog].slice(0, 8) }));
}

/* ================= scenario engine ================= */
function logLine(i: number, o: O2CObjects): string {
  const lines: Record<string, string> = {
    po_raised: `PO ${o.poId} raised for ${o.customerName}`,
    approved: `PO ${o.poId} approved by ${o.approver || 'Ops Manager'}`,
    invoiced: `Invoice ${o.invoiceNo} issued`,
    paid: `K-net ref ${o.knetRef} — payment captured`,
    wallet_credited: `Wallet credited — ${o.customerName}`,
    truck_registered: `Truck ${o.truckId} (${o.plate}) registered`,
    driver_registered: `Driver ${o.driverId} registered`,
    card_issued: `Card ${o.cardId} activated`,
    gate_lpr: `Gate LPR matched plate ${o.plate}`,
    bay_authorised: `Bay ${o.bayId} authorised for account ${o.account}`,
    filling: `Filling started — Bay ${o.bayId} · target 5,000 IG`,
    debit: `Exact-volume debit — ${o.dispensed ? o.dispensed.toLocaleString() : '—'} IG · KD ${o.amountKD != null ? o.amountKD.toFixed(3) : '—'}`,
    receipt: 'Receipt sent — SMS + e-mail',
    gl_posting: 'GL posting synced to SAP S/4HANA',
    settlement: 'Settlement to MEW bank complete',
  };
  return lines[O2C_STEPS[i].key] || O2C_STEPS[i].label;
}

function patchPo(id: string, patch: Partial<PurchaseOrder>) {
  useErp.setState((s) => ({ purchaseOrders: upd(s.purchaseOrders, id, patch) }));
}
function patchObj(p: Partial<O2CObjects>) {
  useErp.setState((s) => ({ scenario: { ...s.scenario, objects: { ...s.scenario.objects, ...p } } }));
}

function stepEffects(i: number) {
  const key = O2C_STEPS[i].key;
  const st = useErp.getState();
  const cust = st.customers[0]; // Al-Salem Transport Co. — matches Bay 14's hero account
  const obj = () => useErp.getState().scenario.objects;
  const nowTs = Date.now();
  const demoPo = () => useErp.getState().purchaseOrders.find((p) => p.id === ERP_DEMO_IDS.po)!;

  switch (key) {
    case 'po_raised': {
      const existing = st.purchaseOrders.find((p) => p.id === ERP_DEMO_IDS.po);
      const fresh = { status: 'Draft', approver: '—', invoiceNo: '—', knetRef: '—', remainingIG: 5000, fillsCount: 0, updatedAt: nowTs };
      if (!existing) {
        const po: PurchaseOrder = {
          id: ERP_DEMO_IDS.po, customerId: cust.id, customerName: cust.name, quantityIG: 5000,
          tariffId: 'TRF-STD', rateKD: 0.0025, amountKD: 12.5, requestedWindow: 'Today', createdAt: nowTs, ...fresh,
        };
        useErp.setState((s) => ({ purchaseOrders: [po, ...s.purchaseOrders] }));
      } else patchPo(existing.id, fresh);
      patchObj({ poId: ERP_DEMO_IDS.po, customerId: cust.id, customerName: cust.name, account: cust.account });
      audit('System', 'PO raised', ERP_DEMO_IDS.po, '—', 'Draft');
      break;
    }
    case 'approved': {
      const po = demoPo(); const approver = 'F. Al-Ansari (Ops Manager)';
      patchPo(po.id, { status: 'Approved', approver, updatedAt: nowTs });
      patchObj({ approver });
      audit(approver, 'PO approved', po.id, 'Draft', 'Approved');
      break;
    }
    case 'invoiced': {
      const po = demoPo(); const invoiceNo = `INV-${rnd(89000, 900)}`;
      patchPo(po.id, { status: 'Invoiced', invoiceNo, updatedAt: nowTs });
      patchObj({ invoiceNo });
      audit('System', 'Invoice generated', invoiceNo, 'Approved', 'Invoiced');
      break;
    }
    case 'paid': {
      const po = demoPo(); const knetRef = `KNET-${rnd(772000, 900)}`;
      patchPo(po.id, { status: 'Paid', knetRef, updatedAt: nowTs });
      patchObj({ knetRef });
      audit('K-net Gateway', 'Payment captured', knetRef, 'Invoiced', 'Paid');
      break;
    }
    case 'wallet_credited': {
      const po = demoPo(); const customer = st.customers.find((c) => c.id === po.customerId)!;
      const before = customer.wallet; const after = +(before + po.amountKD).toFixed(3);
      useErp.setState((s) => ({ customers: upd(s.customers, customer.id, { wallet: after }) }));
      patchPo(po.id, { status: 'Active', updatedAt: nowTs });
      pushLedger({ time: timeStr(nowTs), account: customer.account, type: 'Top-up', volume: '—', amount: `+KD ${po.amountKD.toFixed(3)}`, channel: 'K-net', status: 'Cleared' });
      audit('System', 'Wallet credited', customer.id, fmtKD(before), fmtKD(after));
      break;
    }
    case 'truck_registered': {
      const existing = st.trucks.find((t) => t.id === ERP_DEMO_IDS.truck);
      let truck: Truck;
      if (!existing) {
        truck = { id: ERP_DEMO_IDS.truck, plate: '3 / 84621', ownerId: cust.id, ownerName: cust.name, capacityIG: 5000, make: 'Isuzu FVR', calibCertNo: 'CAL-90142', calibExpiry: daysFromNow(340), hatchType: 'Top hatch', status: 'Active', rfidTag: 'RFID-T9999' };
        useErp.setState((s) => ({ trucks: [truck, ...s.trucks] }));
      } else {
        truck = { ...existing, status: 'Active' };
        useErp.setState((s) => ({ trucks: upd(s.trucks, existing.id, { status: 'Active' }) }));
      }
      patchObj({ truckId: truck.id, plate: truck.plate });
      audit('System', 'Truck registered', truck.id, '—', 'Active');
      break;
    }
    case 'driver_registered': {
      const existing = st.drivers.find((d) => d.id === ERP_DEMO_IDS.driver);
      if (!existing) {
        const driver: Driver = { id: ERP_DEMO_IDS.driver, name: 'Yousef Al-Ansari', civilId: maskCivilId(14), licenceClass: 'Heavy Goods · Class 4', licenceExpiry: daysFromNow(400), phone: '+965 60112233', assignedTruckIds: [ERP_DEMO_IDS.truck], status: 'Active', initials: 'YA' };
        useErp.setState((s) => ({ drivers: [driver, ...s.drivers] }));
      } else {
        useErp.setState((s) => ({ drivers: upd(s.drivers, existing.id, { status: 'Active', assignedTruckIds: [ERP_DEMO_IDS.truck] }) }));
      }
      patchObj({ driverId: ERP_DEMO_IDS.driver });
      audit('System', 'Driver registered', ERP_DEMO_IDS.driver, '—', 'Active');
      break;
    }
    case 'card_issued': {
      const existing = st.credentials.find((c) => c.id === ERP_DEMO_IDS.card);
      if (!existing) {
        const card: Credential = { id: ERP_DEMO_IDS.card, type: 'RFID + PIN', customerId: cust.id, customerName: cust.name, truckId: ERP_DEMO_IDS.truck, truckPlate: obj().plate || '3 / 84621', driverId: ERP_DEMO_IDS.driver, driverName: 'Yousef Al-Ansari', pinAttempts: 0, status: 'Activated', issuedAt: nowTs, expiry: daysFromNow(365) };
        useErp.setState((s) => ({ credentials: [card, ...s.credentials] }));
      } else {
        useErp.setState((s) => ({ credentials: upd(s.credentials, existing.id, { status: 'Activated', pinAttempts: 0, issuedAt: nowTs }) }));
      }
      patchObj({ cardId: ERP_DEMO_IDS.card });
      audit('System', 'Card activated', ERP_DEMO_IDS.card, 'Requested', 'Activated');
      break;
    }
    case 'gate_lpr': {
      const plate = obj().plate || '3 / 84621';
      pushLpr({ time: timeStr(nowTs), plate, owner: cust.name, gate: 'Entry', status: 'Matched · Bay 14' });
      useErp.setState((s) => ({ gate: { ...s.gate, queue: s.gate.queue.filter((q) => q.plate !== obj().plate) } }));
      audit('System', 'Gate LPR match', obj().plate || '—', '—', 'Matched');
      break;
    }
    case 'bay_authorised': {
      useSiap.getState().selectBay(O2C_BAY);
      patchObj({ bayId: O2C_BAY });
      audit('System', 'Bay 14 authorised · QR/PIN', obj().account || cust.account, '—', 'Authorised');
      break;
    }
    case 'filling': {
      const o = obj();
      useSiap.getState().startFill(O2C_BAY, { owner: cust.name, account: o.account || cust.account, plate: o.plate || '3 / 84621', target: 5000 });
      // legacy ran this fill at a brisk 70 m3/h so the demo finishes in ~20 s
      useSiap.setState((s) => ({ bays: s.bays.map((b) => (b.id === O2C_BAY ? { ...b, flow: 70 } : b)) }));
      audit('System', 'Fill started', 'Bay 14', 'Idle', 'Filling');
      beginFillWait();
      break;
    }
    case 'debit': {
      const o = obj();
      const bay = useSiap.getState().bays.find((b) => b.id === O2C_BAY);
      const dispensed = bay ? bay.dispensed : 5000;
      const tariff = st.tariffs.find((t) => t.id === 'TRF-STD')!;
      const amount = +(dispensed * tariff.rate).toFixed(3);
      patchObj({ dispensed, amountKD: amount });
      pushLedger({ time: timeStr(nowTs), account: o.account || cust.account, type: 'Fill (debit)', volume: `${dispensed}`, amount: `-KD ${amount.toFixed(3)}`, channel: 'Bay 14', status: 'Posted' });
      useSiap.setState((s) => ({ mewActivity: [{ label: 'Fill — Bay 14', delta: `-KD ${amount.toFixed(3)}` }, ...s.mewActivity].slice(0, 3) }));
      const po = st.purchaseOrders.find((p) => p.id === ERP_DEMO_IDS.po);
      if (po) patchPo(po.id, { status: 'Closed', remainingIG: Math.max(0, po.quantityIG - dispensed), fillsCount: (po.fillsCount || 0) + 1, updatedAt: nowTs });
      const customer = st.customers.find((c) => c.id === cust.id)!;
      audit('System', 'Exact-volume debit', o.account || cust.account, fmtKD(customer.wallet), fmtKD(customer.wallet - amount));
      break;
    }
    case 'receipt': {
      useErp.setState({ overlay: { kind: 'receipt' } });
      audit('System', 'Receipt sent · SMS + e-mail', obj().account || cust.account, '—', 'Sent');
      break;
    }
    case 'gl_posting': {
      pushSync('sap', `GL Posting — Fill Bay 14 · ${obj().invoiceNo || ''}`, 'S!aP → ERP', 'Synced', 0);
      audit('System', 'GL posting synced', obj().invoiceNo || obj().account || '—', 'Pending', 'Synced');
      break;
    }
    case 'settlement': {
      pushSync('sap', `Settlement — K-net batch ${obj().knetRef || ''}`, 'S!aP → ERP', 'Synced', 0);
      audit('System', 'Settlement to MEW bank complete', obj().knetRef || '—', 'Open', 'Settled');
      break;
    }
  }
}

/** After the fill starts, wait for Bay 14 to finish (fine-fill complete), then post the exact-volume debit. */
function beginFillWait() {
  clearFillWait();
  setScenario({ waitingFill: true, status: 'Filling Bay 14 — waiting for fine-fill to complete…' });
  let settled = false;
  const finish = () => {
    if (settled) return; settled = true;
    clearFillWait();
    setScenario({ waitingFill: false });
    doStep(O2C_FILL_INDEX + 1); // exact-volume debit
    if (useErp.getState().scenario.running) scheduleNext(O2C_STEP_MS);
  };
  const finishSoon = () => { setTimeout(finish, 0); };
  fillOffBus = bus.on('fill:stop', (b) => { if (b && b.id === O2C_BAY) finishSoon(); });
  fillOffSub = useSiap.subscribe((s) => {
    const b = s.bays.find((x) => x.id === O2C_BAY);
    if (b && b.status !== 'filling') finishSoon();
  });
  fillTimeout = setTimeout(() => {
    if (settled) return;
    useSiap.getState().stopFill(O2C_BAY, 'done');
    finish();
  }, 60000);
}

function doStep(i: number) {
  stepEffects(i);
  const ts = Date.now();
  useErp.setState((s) => ({
    scenario: {
      ...s.scenario,
      index: Math.max(s.scenario.index, i),
      stepTs: { ...s.scenario.stepTs, [i]: ts },
      log: [{ i, ts, text: logLine(i, s.scenario.objects) }, ...s.scenario.log].slice(0, 20),
    },
  }));
  bus.emit('erp:step', { index: i, key: O2C_STEPS[i].key, objects: { ...useErp.getState().scenario.objects } });
}

function advance() {
  const next = useErp.getState().scenario.index + 1;
  if (next >= O2C_STEPS.length) {
    clearStepTimer();
    setScenario({ running: false, status: 'Scenario complete — press Reset to run again.' });
    return;
  }
  doStep(next);
  if (next === O2C_FILL_INDEX) return; // now waiting on the fill; finish() continues the chain
  if (useErp.getState().scenario.running) scheduleNext(O2C_STEP_MS);
}

function scheduleNext(delay: number) {
  clearStepTimer();
  stepTimer = setTimeout(() => {
    const sc = useErp.getState().scenario;
    if (!sc.running || sc.waitingFill) return;
    advance();
  }, delay);
}

/* ================= gate queue + outage buffer (driven by the sim tick, like the legacy tick hook) ================= */
function onTick() {
  const s = useErp.getState();
  const queue = [...s.gate.queue];
  let lastRelease = s.gate.lastRelease;
  if (Math.random() > 0.55 && queue.length < 8) {
    queue.push({ plate: randPlate(), owner: OWNERS[Math.floor(Math.random() * OWNERS.length)], eta: `${2 + Math.floor(Math.random() * 10)} min` });
  } else if (Math.random() > 0.7 && queue.length > 0) {
    queue.shift();
    lastRelease = Date.now();
  }
  const patch: Partial<ErpState> = { gate: { queue, lastRelease } };
  if (s.outage.active && Math.random() > 0.4) patch.outage = { ...s.outage, buffered: s.outage.buffered + 1 };
  useErp.setState(patch);
}

/* ================= persistence + tick wiring (once, even across HMR) ================= */
const g = globalThis as unknown as { __erpWired?: { unsubTick: () => void; unsubSave: () => void } };
if (g.__erpWired) { g.__erpWired.unsubTick(); g.__erpWired.unsubSave(); }
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaved: ErpData | null = pick(useErp.getState());
savePersisted(lastSaved);
g.__erpWired = {
  unsubTick: bus.on('tick', onTick),
  unsubSave: useErp.subscribe((s) => {
    const d = pick(s);
    if (lastSaved && (Object.keys(d) as (keyof ErpData)[]).every((k) => d[k] === lastSaved![k])) return;
    lastSaved = d;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => savePersisted(d), 250);
  }),
};
