/* S!aP — Enterprise & ERP module — seed data (ported from legacy/erp-data.js).
   Everything here is SIMULATED for demonstration purposes only. */
import { OWNERS, pad, randAccount, randPlate } from '../sim/data';

export const ERP_STORAGE_KEY = 'siap.erp.v1';

export const ERP_DRIVER_NAMES = [
  'Yousef Al-Ansari', 'Mohammed Al-Rashidi', 'Fahad Al-Mutairi', 'Salem Al-Ajmi',
  'Nasser Al-Enezi', 'Khaled Al-Fadhli', 'Abdullah Al-Sabah', 'Bader Al-Qattan',
  'Talal Al-Dosari', 'Rashed Al-Shammari', 'Hamad Al-Otaibi', 'Sami Al-Kandari',
  'Omar Al-Failakawi', 'Marzouq Al-Azmi', 'Fawaz Al-Rasheed', 'Adel Al-Yahya',
  'Waleed Al-Harbi', 'Sultan Al-Zaabi', 'Naif Al-Qahtani', 'Jaber Al-Sane',
  'Turki Al-Mudhaf', 'Yaqoub Al-Bader', 'Anwar Al-Salman', 'Ibrahim Al-Duwaisan',
];
export const ERP_TRUCK_MAKES = ['Isuzu FVR', 'Mercedes-Benz Actros', 'MAN TGS 26', 'Volvo FMX', 'Hino 700', 'Scania P410'];
export const ERP_CAPACITIES = [3000, 5000, 8000];
export const ERP_CATEGORIES = ['Municipal contractor', 'Private', 'Government'];
const ERP_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ERP_MAINT_CREW = ['A. Al-Kandari (Instrumentation)', 'M. Al-Sabah (Mechanical)', 'Y. Al-Rashidi (E&I)', 'H. Al-Otaibi (Mechanical)'];

/* ---------- small helpers ---------- */
export const erpPad = (n: number, len = 4) => n.toString().padStart(len, '0');
export const daysFromNow = (d: number) => Date.now() + d * 86400000;
export const daysAgo = (d: number) => Date.now() - d * 86400000;
export const dateStr = (ts: number) => { const d = new Date(ts); return `${d.getDate()} ${ERP_MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export const dateTimeStr = (ts: number) => { const d = new Date(ts); return `${dateStr(ts)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const timeStr = (ts: number) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const maskCivilId = (seed: number) => `28${erpPad(seed % 100, 2)}••••${erpPad((seed * 37) % 10000, 4)}`;
export const initialsOf = (name: string) => name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const fmtKD = (n: number) => `KD ${(+n || 0).toFixed(3)}`;
export const fmtIG = (n: number) => `${Math.round(n || 0).toLocaleString()} IG`;

/** Fixed ids the Order-to-Cash tracker reuses on every run so replays don't accumulate duplicate records. */
export const ERP_DEMO_IDS = { po: 'PO-2026-DEMO', truck: 'TRK-DEMO14', driver: 'DRV-DEMO14', card: 'CARD-DEMO14' };

/* ---------- types ---------- */
export interface KycItem { status: string; }
export interface Customer {
  id: string; name: string; account: string; crNo: string; category: string; contact: string; phone: string; email: string;
  kyc: { civilId: KycItem; crCopy: KycItem; calibrationCert: KycItem };
  creditTerms: string; wallet: number; status: string; registeredSince: string;
}
export interface Tariff { id: string; name: string; tier: string; rate: number; unit: string; vat: number; minIG: number; }
export interface Truck {
  id: string; plate: string; ownerId: string; ownerName: string; capacityIG: number; make: string; calibCertNo: string;
  calibExpiry: number; hatchType: string; status: string; rfidTag: string;
}
export interface Driver {
  id: string; name: string; civilId: string; licenceClass: string; licenceExpiry: number; phone: string;
  assignedTruckIds: string[]; status: string; initials: string;
}
export interface PurchaseOrder {
  id: string; customerId: string; customerName: string; quantityIG: number; tariffId: string; rateKD: number; amountKD: number;
  requestedWindow: string; status: string; approver: string; invoiceNo: string; knetRef: string;
  createdAt: number; updatedAt: number; remainingIG: number; fillsCount: number;
}
export interface Credential {
  id: string; type: string; customerId: string; customerName: string; truckId: string; truckPlate: string; driverId: string; driverName: string;
  pinAttempts: number; status: string; issuedAt: number; expiry: number;
}
export interface WorkOrder { id: string; title: string; priority: string; detail: string; assignee: string; due: string; status: string; }
export interface AuditRow { id: string; ts: number; user: string; action: string; object: string; before: string; after: string; }
export interface GateQueueItem { plate: string; owner: string; eta: string; }
export interface Gate { queue: GateQueueItem[]; lastRelease: number; }
export interface Connector { id: string; name: string; protocol: string; status: string; lastSync: number; latencyMs: number; objectsSynced: number; }
export interface MappingRow { object: string; saip: string; erp: string; frequency: string; direction: string; }
export interface SyncRow { id: string; ts: number; connector: string; object: string; direction: string; status: string; retries: number; }

export interface ErpData {
  customers: Customer[]; tariffs: Tariff[]; trucks: Truck[]; drivers: Driver[]; purchaseOrders: PurchaseOrder[];
  credentials: Credential[]; workOrders: WorkOrder[]; audit: AuditRow[]; gate: Gate;
  connectors: Connector[]; mapping: MappingRow[]; erpSync: SyncRow[];
}

/* ================= builders ================= */
function buildCustomers(): Customer[] {
  return OWNERS.map((name, i) => {
    const wallet = +(60 + Math.random() * 380).toFixed(3);
    return {
      id: `CUST-${erpPad(i + 1)}`,
      name,
      account: i === 0 ? 'KWT-40216' : randAccount(),
      crNo: `CR-${20411 + i * 137}`,
      category: ERP_CATEGORIES[i % ERP_CATEGORIES.length],
      contact: ERP_DRIVER_NAMES[i % ERP_DRIVER_NAMES.length],
      phone: `+965 ${(60112233 + i * 137001) % 100000000}`,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@corp.kw`,
      kyc: {
        civilId: { status: i === 7 ? 'Pending' : 'Verified' },
        crCopy: { status: i === 7 ? 'Pending' : 'Verified' },
        calibrationCert: { status: i === 3 ? 'Expiring soon' : 'Verified' },
      },
      creditTerms: 'Prepaid',
      wallet,
      status: i === 9 ? 'Suspended' : (i === 7 ? 'Pending KYC' : 'Active'),
      registeredSince: dateStr(daysAgo(220 + i * 41)),
    };
  });
}

function buildTariffs(): Tariff[] {
  return [
    { id: 'TRF-STD', name: 'Standard', tier: 'Standard', rate: 0.0025, unit: 'KD / Imp.gal', vat: 0, minIG: 0 },
    { id: 'TRF-BULK', name: 'Bulk (≥ 8,000 IG per PO)', tier: 'Bulk', rate: 0.0021, unit: 'KD / Imp.gal', vat: 0, minIG: 8000 },
    { id: 'TRF-GOV', name: 'Government contract', tier: 'Government', rate: 0.0018, unit: 'KD / Imp.gal', vat: 0, minIG: 0 },
  ];
}

function buildTrucks(customers: Customer[]): Truck[] {
  const trucks: Truck[] = [];
  for (let i = 0; i < 24; i++) {
    const owner = customers[i % customers.length];
    const expiryOffset = i % 7 === 0 ? -12 - i : (i % 5 === 0 ? 8 + i : 140 + i * 6);
    const calibExpiry = daysFromNow(expiryOffset);
    const status = expiryOffset < 0 ? 'Due calibration' : (i === 13 ? 'Blocked' : 'Active');
    trucks.push({
      id: `TRK-${erpPad(4100 + i)}`,
      plate: randPlate(),
      ownerId: owner.id,
      ownerName: owner.name,
      capacityIG: ERP_CAPACITIES[i % ERP_CAPACITIES.length],
      make: ERP_TRUCK_MAKES[i % ERP_TRUCK_MAKES.length],
      calibCertNo: `CAL-${8801 + i * 3}`,
      calibExpiry,
      hatchType: i % 2 === 0 ? 'Top hatch' : 'Rear valve',
      status,
      rfidTag: `RFID-T${erpPad(9000 + i)}`,
    });
  }
  return trucks;
}

function buildDrivers(trucks: Truck[]): Driver[] {
  const drivers: Driver[] = [];
  for (let i = 0; i < 24; i++) {
    const name = ERP_DRIVER_NAMES[i];
    const truck = trucks[i];
    drivers.push({
      id: `DRV-${erpPad(7100 + i)}`,
      name,
      civilId: maskCivilId(i + 11),
      licenceClass: 'Heavy Goods · Class 4',
      licenceExpiry: daysFromNow(120 + i * 9),
      phone: `+965 ${(50033221 + i * 91001) % 100000000}`,
      assignedTruckIds: truck ? [truck.id] : [],
      status: i === 19 ? 'Suspended' : 'Active',
      initials: initialsOf(name),
    });
  }
  return drivers;
}

function buildPurchaseOrders(customers: Customer[], tariffs: Tariff[]): PurchaseOrder[] {
  const statusCycle = ['Draft', 'Draft', 'Submitted', 'Approved', 'Approved', 'Invoiced', 'Paid', 'Active', 'Active', 'Consuming', 'Consuming', 'Closed'];
  const approvers = ['F. Al-Ansari (Ops Manager)', 'S. Al-Mutairi (Finance)', '—'];
  return statusCycle.map((status, i) => {
    const customer = customers[(i * 3 + 1) % customers.length];
    const tariff = tariffs[i % tariffs.length];
    const qty = [3000, 5000, 8000, 6000, 4000][i % 5];
    const amount = +(qty * tariff.rate).toFixed(3);
    const created = daysAgo(30 - i * 2);
    const consumed = status === 'Closed' ? qty : (status === 'Consuming' ? Math.floor(qty * 0.4) : 0);
    return {
      id: `PO-2026-${erpPad(187 + i)}`,
      customerId: customer.id,
      customerName: customer.name,
      quantityIG: qty,
      tariffId: tariff.id,
      rateKD: tariff.rate,
      amountKD: amount,
      requestedWindow: `${dateStr(created + 2 * 86400000)} – ${dateStr(created + 9 * 86400000)}`,
      status,
      approver: ['Draft', 'Submitted'].includes(status) ? '—' : approvers[i % approvers.length],
      invoiceNo: ['Draft', 'Submitted', 'Approved'].includes(status) ? '—' : `INV-${88201 + i}`,
      knetRef: ['Draft', 'Submitted', 'Approved', 'Invoiced'].includes(status) ? '—' : `KNET-${771200 + i * 17}`,
      createdAt: created,
      updatedAt: created + i * 3600000,
      remainingIG: qty - consumed,
      fillsCount: status === 'Closed' ? Math.ceil(qty / 5000) : (status === 'Consuming' ? 1 : 0),
    };
  });
}

function buildCredentials(trucks: Truck[], drivers: Driver[]): Credential[] {
  const types = ['RFID + PIN', 'QR + PIN', 'RFID + QR'];
  const statuses = ['Requested', 'Printed', 'Activated', 'Activated', 'Activated', 'Suspended'];
  const creds: Credential[] = [];
  for (let i = 0; i < 20; i++) {
    const truck = trucks[i];
    const driver = drivers[i];
    const status = statuses[i % statuses.length];
    creds.push({
      id: `CARD-${erpPad(10400 + i)}`,
      type: types[i % types.length],
      customerId: truck.ownerId,
      customerName: truck.ownerName,
      truckId: truck.id,
      truckPlate: truck.plate,
      driverId: driver.id,
      driverName: driver.name,
      pinAttempts: status === 'Suspended' ? 3 : 0,
      status,
      issuedAt: daysAgo(80 - i),
      expiry: daysFromNow(285 + i),
    });
  }
  return creds;
}

function buildWorkOrders(): WorkOrder[] {
  const rows: [string, string, string][] = [
    ['Bay 27 — valve seat inspection', 'High', 'Slow close-time drift 2.4s vs SP 1.5s'],
    ['Bay 12 — meter calibration', 'High', 'Custody meter vs inlet drift 3.9%'],
    ['Bay 09 — inlet balance calibration', 'Medium', 'Overdue per CMMS schedule'],
    ['Bay 31 — hatch alignment sensor', 'Medium', 'Arm-camera flagged mis-alignment'],
    ['Manifold C — pressure transmitter swap', 'Low', 'PT trending outside ±2% band'],
    ['Bay 05 — loitering sensor check', 'Low', 'Post-completion dwell time alerts'],
  ];
  const statuses = ['Open', 'In Progress', 'Scheduled', 'Open', 'Scheduled', 'Closed'];
  const dueOffsets = [2, 5, 1, 7, 10, -3];
  return rows.map((r, i) => ({
    id: `WO-${erpPad(5500 + i)}`,
    title: r[0], priority: r[1], detail: r[2],
    assignee: ERP_MAINT_CREW[i % ERP_MAINT_CREW.length],
    due: dateStr(daysFromNow(dueOffsets[i])),
    status: statuses[i],
  }));
}

function buildAudit(): AuditRow[] {
  const seed: [string, string, string, string, string][] = [
    ['System', 'PO approved', 'PO-2026-0193', 'Approved', 'Invoiced'],
    ['S. Al-Mutairi', 'KYC verified', 'CUST-0004', 'Pending', 'Verified'],
    ['System', 'Card activated', 'CARD-10406', 'Printed', 'Activated'],
    ['F. Al-Ansari', 'Customer suspended', 'CUST-0010', 'Active', 'Suspended'],
    ['System', 'Work order raised', 'WO-5502', '—', 'Open'],
    ['System', 'GL posting synced', 'INV-88208', 'Pending', 'Synced'],
    ['Ops Marshal', 'Truck calibration flagged', 'TRK-4106', 'Active', 'Due calibration'],
    ['System', 'Settlement batch closed', 'KNET-771214', 'Open', 'Settled'],
  ];
  return seed.map((r, i) => ({
    id: `AUD-${erpPad(9000 + i)}`,
    ts: daysAgo(6 - i * 0.6),
    user: r[0], action: r[1], object: r[2], before: r[3], after: r[4],
  }));
}

function buildGate(customers: Customer[]): Gate {
  const plates = [randPlate(), randPlate(), randPlate(), randPlate()];
  return {
    queue: plates.map((plate, i) => ({ plate, owner: customers[i % customers.length].name, eta: `${2 + i * 2} min` })),
    lastRelease: daysAgo(0.002),
  };
}

function buildConnectors(): Connector[] {
  return [
    { id: 'sap', name: 'SAP S/4HANA', protocol: 'IDoc / OData', status: 'Connected', lastSync: daysAgo(0.003), latencyMs: 210, objectsSynced: 1842 },
    { id: 'oracle', name: 'Oracle Fusion', protocol: 'REST / BICC', status: 'Connected', lastSync: daysAgo(0.01), latencyMs: 340, objectsSynced: 966 },
    { id: 'd365', name: 'MS Dynamics 365', protocol: 'OData v4', status: 'Degraded', lastSync: daysAgo(0.25), latencyMs: 1120, objectsSynced: 214 },
  ];
}

function buildMapping(): MappingRow[] {
  return [
    { object: 'GL Posting', saip: 'ledger[] (Fill debit / Top-up)', erp: 'SAP: ACC_DOCUMENT IDoc', frequency: 'Real-time', direction: 'S!aP → ERP' },
    { object: 'Invoice', saip: 'purchaseOrders[].invoiceNo', erp: 'OData: FI_INVOICE entity', frequency: 'On approval', direction: 'S!aP → ERP' },
    { object: 'Customer master', saip: 'customers[]', erp: 'SAP: Business Partner (BP)', frequency: 'Every 15 min', direction: 'ERP → S!aP' },
    { object: 'Fleet master', saip: 'trucks[] / drivers[]', erp: 'Equipment / HR master', frequency: 'Every 15 min', direction: 'ERP → S!aP' },
    { object: 'Stock level', saip: 'kpis.volumeToday', erp: 'Material stock (MARD)', frequency: 'Hourly', direction: 'ERP → S!aP' },
    { object: 'MoF interface', saip: 'erpSync[] settlement rows', erp: 'Ministry of Finance revenue file', frequency: 'Daily batch', direction: 'S!aP → MoF' },
  ];
}

function buildSyncLog(): SyncRow[] {
  const rows: [string, string, string, string, number][] = [
    ['sap', 'GL Posting — Daily Revenue', 'S!aP → ERP', 'Synced', 0],
    ['oracle', 'Tanker Master — KWT-40216', 'ERP → S!aP', 'Synced', 0],
    ['sap', 'Invoice #INV-88213', 'S!aP → ERP', 'Synced', 0],
    ['d365', 'Stock Level — Al Dhaher', 'ERP → S!aP', 'Pending', 1],
    ['sap', 'Customer master — CUST-0004', 'ERP → S!aP', 'Synced', 0],
    ['oracle', 'Fleet master — TRK-4106', 'ERP → S!aP', 'Failed', 2],
  ];
  return rows.map((r, i) => ({
    id: `SYNC-${erpPad(3000 + i)}`,
    ts: daysAgo(0.02 * (i + 1)),
    connector: r[0], object: r[1], direction: r[2], status: r[3], retries: r[4],
  }));
}

export function buildSeed(): ErpData {
  const customers = buildCustomers();
  const tariffs = buildTariffs();
  const trucks = buildTrucks(customers);
  const drivers = buildDrivers(trucks);
  return {
    customers, tariffs, trucks, drivers,
    purchaseOrders: buildPurchaseOrders(customers, tariffs),
    credentials: buildCredentials(trucks, drivers),
    workOrders: buildWorkOrders(),
    audit: buildAudit(),
    gate: buildGate(customers),
    connectors: buildConnectors(),
    mapping: buildMapping(),
    erpSync: buildSyncLog(),
  };
}

/* ---------- persistence (same key / shape as legacy) ---------- */
export function loadPersisted(): ErpData | null {
  try {
    const raw = localStorage.getItem(ERP_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.customers) || !Array.isArray(p.trucks) || !Array.isArray(p.purchaseOrders) || !Array.isArray(p.credentials)
      || !Array.isArray(p.drivers) || !Array.isArray(p.tariffs) || !Array.isArray(p.workOrders) || !Array.isArray(p.audit)
      || !Array.isArray(p.connectors) || !Array.isArray(p.mapping) || !Array.isArray(p.erpSync) || !p.gate || !Array.isArray(p.gate.queue)) return null;
    // An outage drill is not persisted across reloads, so don't resurrect "Down" connectors without their banner.
    const connectors = (p.connectors as Connector[]).map((c) => (c.status === 'Down' ? { ...c, status: 'Connected' } : c));
    return { ...(p as ErpData), connectors };
  } catch (e) { console.warn('[ERP] localStorage load failed', e); return null; }
}

export function savePersisted(d: ErpData) {
  try { localStorage.setItem(ERP_STORAGE_KEY, JSON.stringify(d)); }
  catch (e) { console.warn('[ERP] localStorage save failed', e); }
}
