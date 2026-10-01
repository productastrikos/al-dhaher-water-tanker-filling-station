/* MEW Pay driver app — seed data (Al-Salem Transport Co. · KWT-40216). Self-contained, same as legacy/mobile.js.
   Everything here is mocked: there is no backend. */

export interface Activity { label: string; delta: number; time: string }
export interface Truck { plate: string; capacity: number; calibExpiry: string; calibStatus: 'green' | 'amber' | 'red' }
export interface Driver { name: string; licence: string; truck: string }
export interface PurchaseOrder { id: string; qty: number; kd: number; status: string }
export interface Notification { icon: string; title: string; body: string; time: string }

export const INITIAL_BALANCE = 139.95;

export const INITIAL_ACTIVITY: Activity[] = [
  { label: 'Fill — Bay 14', delta: -8.55, time: '2m ago' },
  { label: 'K-net Top-up', delta: 100.0, time: '1h ago' },
  { label: 'Fill — Bay 03', delta: -12.1, time: '5h ago' },
  { label: 'Fill — Bay 22', delta: -6.82, time: 'yesterday' },
  { label: 'K-net Top-up', delta: 50.0, time: '2 days ago' },
  { label: 'Fill — Bay 08', delta: -9.14, time: '3 days ago' },
];

export const TRUCKS: Truck[] = [
  { plate: '3 / 84621', capacity: 5000, calibExpiry: '15 Dec 2026', calibStatus: 'green' },
  { plate: '7 / 55210', capacity: 8000, calibExpiry: '02 Oct 2026', calibStatus: 'amber' },
  { plate: '2 / 19983', capacity: 3000, calibExpiry: '28 Sep 2026', calibStatus: 'red' },
];

export const DRIVERS: Driver[] = [
  { name: 'Yousef Al-Rashidi', licence: 'Class 4 · exp 2027', truck: '3 / 84621' },
  { name: 'Marwan Haddad', licence: 'Class 4 · exp 2026', truck: '7 / 55210' },
];

export const PO_RATE_PER_IG = 0.0025; // KD / IG
export const PO_STATUS_TAG: Record<string, string> = { Draft: 'gray', Approved: 'blue', Invoiced: 'amber', Paid: 'green', Active: 'green' };

export const INITIAL_POS: PurchaseOrder[] = [
  { id: 'PO-2026-0187', qty: 5000, kd: 12.5, status: 'Active' },
  { id: 'PO-2026-0186', qty: 3000, kd: 7.5, status: 'Invoiced' },
  { id: 'PO-2026-0185', qty: 8000, kd: 20.0, status: 'Approved' },
  { id: 'PO-2026-0184', qty: 4000, kd: 10.0, status: 'Draft' },
];

export const INITIAL_NOTIFICATIONS: Notification[] = [
  { icon: 'navigation', title: 'Bay assignment', body: 'Proceed to Bay 14 — hatch guidance active.', time: '2m ago' },
  { icon: 'receipt', title: 'Receipt sent', body: 'Last fill receipt sent by SMS & e-mail.', time: '1h ago' },
  { icon: 'alert-triangle', title: 'Low balance warning', body: 'Wallet balance below KD 20 threshold after your next fill.', time: '3h ago' },
];

export const CARD_STEPS = ['Requested', 'Printed', 'Activated'] as const;

/* ---------- Station locator (26-station Kuwait network) ----------
   Same table as the desktop network map; distances computed from Al Dhaher (this wallet's home station)
   with the haversine formula, so "km away" reads plausibly for a demo. */
const HOME_STATION = { lat: 29.055, lon: 48.105 };
interface Station { name: string; governorate: string; lat: number; lon: number; flagship?: boolean; status: 'open' | 'soon' }
const NETWORK_STATIONS: Station[] = [
  { name: 'Al Dhaher', governorate: 'Ahmadi', lat: 29.055, lon: 48.105, flagship: true, status: 'open' },
  { name: 'Fahaheel', governorate: 'Ahmadi', lat: 29.083, lon: 48.128, status: 'open' },
  { name: 'Abu Halifa', governorate: 'Ahmadi', lat: 29.114, lon: 48.117, status: 'open' },
  { name: 'Fintas', governorate: 'Ahmadi', lat: 29.164, lon: 48.128, status: 'open' },
  { name: 'Mina Abdullah', governorate: 'Ahmadi', lat: 29.028, lon: 48.146, status: 'open' },
  { name: 'Shuaiba', governorate: 'Ahmadi', lat: 29.027, lon: 48.178, status: 'soon' },
  { name: 'Sabah Al-Ahmad City', governorate: 'Ahmadi', lat: 28.972, lon: 48.086, status: 'soon' },
  { name: 'Wafra', governorate: 'Ahmadi', lat: 28.633, lon: 47.933, status: 'soon' },
  { name: 'Farwaniya', governorate: 'Farwaniya', lat: 29.277, lon: 47.939, status: 'open' },
  { name: 'Jleeb Al-Shuyoukh', governorate: 'Farwaniya', lat: 29.263, lon: 47.925, status: 'open' },
  { name: 'Khaitan', governorate: 'Farwaniya', lat: 29.297, lon: 47.966, status: 'soon' },
  { name: 'Ardiya', governorate: 'Farwaniya', lat: 29.28, lon: 47.9, status: 'soon' },
  { name: 'Sabah Al-Nasser', governorate: 'Farwaniya', lat: 29.24, lon: 47.867, status: 'soon' },
  { name: 'Andalous', governorate: 'Farwaniya', lat: 29.291, lon: 47.953, status: 'soon' },
  { name: 'Qurain', governorate: 'Mubarak Al-Kabeer', lat: 29.267, lon: 48.08, status: 'open' },
  { name: 'Sabah Al-Salem', governorate: 'Mubarak Al-Kabeer', lat: 29.243, lon: 48.098, status: 'soon' },
  { name: 'Adan', governorate: 'Mubarak Al-Kabeer', lat: 29.25, lon: 48.07, status: 'soon' },
  { name: 'Shuwaikh', governorate: 'Al Asimah', lat: 29.343, lon: 47.933, status: 'soon' },
  { name: 'Sulaibikhat', governorate: 'Al Asimah', lat: 29.343, lon: 47.905, status: 'soon' },
  { name: 'Jahra', governorate: 'Jahra', lat: 29.347, lon: 47.66, status: 'soon' },
  { name: 'Sulaibiya', governorate: 'Jahra', lat: 29.296, lon: 47.752, status: 'soon' },
  { name: 'Amghara', governorate: 'Jahra', lat: 29.323, lon: 47.807, status: 'soon' },
  { name: 'Saad Al-Abdullah', governorate: 'Jahra', lat: 29.417, lon: 47.683, status: 'soon' },
  { name: 'Naeem', governorate: 'Jahra', lat: 29.336, lon: 47.678, status: 'soon' },
  { name: 'Taima', governorate: 'Jahra', lat: 29.36, lon: 47.628, status: 'soon' },
  { name: 'Abdali', governorate: 'Jahra', lat: 29.786, lon: 47.555, status: 'soon' },
];

function kmBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export const STATIONS_WITH_DISTANCE = NETWORK_STATIONS
  .map((s) => ({ ...s, km: kmBetween(HOME_STATION, s) }))
  .sort((a, b) => a.km - b.km);

export const fmtKD = (n: number) => `${n < 0 ? '-' : ''}KD ${Math.abs(n).toFixed(3)}`;
export const fmtInt = (n: number) => n.toLocaleString('en-US');

/** Deterministic pseudo-QR cells (same LCG as legacy): 121 cells, true = dark. */
export function qrCells(seed: number): boolean[] {
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return Array.from({ length: 121 }, () => rand() > 0.55);
}
