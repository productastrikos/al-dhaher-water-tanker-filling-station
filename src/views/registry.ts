import type { NavGroup, ViewDef } from '../shell/types';

/** Single source of truth for the desktop console's screens + sidebar.
 *  (Replaces the legacy SIAP.registerView() calls.) Order within a group = sidebar order. */
export const VIEWS: ViewDef[] = [
  { id: 'dashboard', title: 'Command Dashboard', sub: 'Al Dhaher Lorry Filling Station · 42 Bays', group: 'operations', icon: 'layout-dashboard', load: () => import('./dashboard') },
  { id: 'baycontrol', title: 'Filling Bay Control', sub: 'Live transaction sequence · custody-grade metering', group: 'operations', icon: 'gauge', load: () => import('./baycontrol') },
  { id: 'cctv', title: 'CCTV & LPR Wall', sub: 'IP video surveillance · Al Dhaher → Salmiya Control Centre', group: 'operations', icon: 'camera', load: () => import('./cctv') },
  { id: 'network-map', title: 'Kuwait Network Map', sub: '26 stations · 52 bays across Kuwait', group: 'operations', icon: 'map', navLabel: 'Network Map', load: () => import('./network-map') },
  { id: 'twin3d', title: '3D Digital Twin', sub: 'Astriverse · station & bay · live from S!aP Connect', group: 'operations', icon: 'box', load: () => import('./twin3d') },
  { id: 'hmi', title: 'Tanker Loading HMI', sub: 'Bay faceplate · PCS 7 style · read-only mirror of the RTU', group: 'operations', icon: 'monitor', load: () => import('./hmi') },

  { id: 'billing', title: 'Billing & MEW Pay', sub: 'Prepaid wallet · K-net settlement · customer app', group: 'revenue', icon: 'wallet', load: () => import('./billing') },
  { id: 'reports', title: 'Reporting', sub: 'Shift, Day & Month · central historian', group: 'revenue', icon: 'file-bar-chart', navLabel: 'Reports', load: () => import('./reports') },

  { id: 'sia', title: 'S!a — Ask it. Act on it.', sub: 'Conversational agentic AI · Glass Box explainable', group: 'intelligence', icon: 'sparkles', navLabel: 'S!a — Ask & Act', load: () => import('./sia') },

  { id: 'erp-o2c', title: 'Order-to-Cash Tracker', sub: 'PO raised → Settlement · Bay 14 · Al-Salem Transport Co.', group: 'erp', icon: 'route', load: () => import('./erp/O2C') },
  { id: 'erp-orders', title: 'Purchase Orders', sub: 'Prepaid orders · approval · invoice · K-net', group: 'erp', icon: 'file-text', load: () => import('./erp/Orders') },
  { id: 'erp-customers', title: 'Customers & Accounts', sub: '10 tanker owners · KYC · wallet · fleet', group: 'erp', icon: 'building-2', load: () => import('./erp/Customers') },
  { id: 'erp-fleet', title: 'Fleet & Drivers', sub: '24 trucks · 24 drivers · calibration & licences', group: 'erp', icon: 'truck', load: () => import('./erp/Fleet') },
  { id: 'erp-cards', title: 'Access Credentials', sub: 'RFID / QR / PIN lifecycle', group: 'erp', icon: 'credit-card', load: () => import('./erp/Cards') },
  { id: 'erp-integration', title: 'ERP Integration', sub: 'SAP S/4HANA · Oracle Fusion · MS Dynamics 365', group: 'erp', icon: 'plug-zap', load: () => import('./erp/Integration') },
  { id: 'erp-admin', title: 'Tariffs · Work Orders · Audit', sub: 'contract rates · CMMS · immutable log', group: 'erp', icon: 'shield-check', navLabel: 'Tariffs · WOs · Audit', load: () => import('./erp/Admin') },
];

export const GROUPS: { id: NavGroup; label: string }[] = [
  { id: 'operations', label: 'Operations' },
  { id: 'revenue', label: 'Revenue & Customer' },
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'erp', label: 'Enterprise & ERP' },
];

export const viewById = (id: string) => VIEWS.find((v) => v.id === id);
