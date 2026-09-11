/* ==========================================================
   S!aP — MEW Al Dhaher Water Filling Station — Demo Data Layer
   All data below is simulated for demonstration purposes only.
   ========================================================== */

const OWNERS = [
  "Al-Salem Transport Co.", "Gulf Water Logistics", "Desert Springs Co.",
  "Al Nahda Tankers", "Kuwait Bulk Carriers", "Nasser Water Trading",
  "Al Mutairi & Sons", "Salmiya Freight Water", "Fahaheel Tanker Co.",
  "Jahra Water Services"
];

const STATUSES = ["idle", "filling", "done", "fault", "offline"];
const STATUS_WEIGHTS = { idle: 0.31, filling: 0.44, done: 0.20, fault: 0.03, offline: 0.02 };

function weightedStatus() {
  const r = Math.random();
  let acc = 0;
  for (const s of STATUSES) {
    acc += STATUS_WEIGHTS[s];
    if (r <= acc) return s;
  }
  return "idle";
}

function randPlate() {
  return `${Math.ceil(Math.random() * 9)} / ${Math.floor(10000 + Math.random() * 89999)}`;
}

function randAccount() {
  return `KWT-${Math.floor(10000 + Math.random() * 89999)}`;
}

function pad(n) { return n.toString().padStart(2, "0"); }
function minutesAgo(m) { return Date.now() - m * 60000; }

const BAY_COUNT = 42;

const state = {
  bays: [],
  kpis: {
    activeBays: 18,
    volumeToday: 1.84,          // million imp gal
    revenueToday: 22140,        // KD
    tankersServed: 613,
    openAlarms: 3,
    inletFlow: 742,             // m3/h
    inletPressure: 5.9,
    wanLinkA: "up",             // up | degraded | down
    wanLinkB: "up",
    drSync: "synced",           // synced | syncing
    drLagSec: 0,
  },
  nextAlarmId: 6,
  alarms: [
    { id: 1, sev: "warn", text: "Bay 27 — Control valve slow-close (2.4s)", ts: minutesAgo(2), ack: false },
    { id: 2, sev: "amber2", text: "Bay 12 — Flow meter vs. inlet 3.9% drift", ts: minutesAgo(6), ack: false },
    { id: 3, sev: "crit", text: "3 failed PIN attempts — Acct #KWT-40318", ts: minutesAgo(9), ack: false },
    { id: 4, sev: "info", text: "WAN link A failover — link B (cluster 3)", ts: minutesAgo(14), ack: true },
    { id: 5, sev: "info", text: "DR sync to South Surra complete", ts: minutesAgo(1), ack: true },
  ],
  hourly: {
    labels: Array.from({ length: 12 }, (_, i) => `${pad((i + 6) % 24)}:00`),
    volume: [22, 34, 41, 52, 58, 63, 71, 68, 60, 55, 49, 45],
    revenue: [260, 410, 495, 620, 690, 760, 850, 810, 720, 660, 590, 540],
  },
  ledger: [],
  lprLog: [],
  videoEvents: [
    { sev: "crit", text: "Water leak detected — Bay 09 apron", ts: minutesAgo(3), tag: "Paddle growth ↑ threshold — maintenance notified" },
    { sev: "warn", text: "Hatch mis-alignment — Bay 31", ts: minutesAgo(9), tag: "Arm-camera guidance shown to driver" },
    { sev: "info", text: "Facial + plate identity confirmed — Gate 1", ts: minutesAgo(12), tag: "3-factor match — driver verified" },
    { sev: "warn", text: "Barrier auto-raised — plate 4/11827", ts: minutesAgo(17), tag: "Synchronized local + Salmiya command" },
    { sev: "info", text: "Loitering after fill — Bay 05", ts: minutesAgo(20), tag: "Vehicle > 6 min post-completion — operator alerted" },
  ],
  mewActivity: [
    { label: "Fill — Bay 14", delta: "-KD 8.550" },
    { label: "K-net Top-up", delta: "+KD 100.000" },
    { label: "Fill — Bay 03", delta: "-KD 12.100" },
  ],
  reports: {
    shift: {
      cols: ["Shift", "Bays Active", "Volume (Imp.gal)", "Revenue (KD)", "Tankers", "Avg Fill (min)"],
      rows: [
        ["Shift A · 06:00–14:00", 39, "742,120", "8,910", 214, 11.4],
        ["Shift B · 14:00–22:00", 41, "801,340", "9,640", 231, 10.8],
        ["Shift C · 22:00–06:00", 33, "298,910", "3,590", 168, 12.9],
      ],
      chartLabels: ["Shift A", "Shift B", "Shift C"],
      chartData: [742120, 801340, 298910],
    },
    day: {
      cols: ["Date", "Bays Active", "Volume (Imp.gal)", "Revenue (KD)", "Tankers", "Uptime %"],
      rows: [
        ["18 Jul", 42, "1,798,220", "21,760", 601, "99.9%"],
        ["19 Jul", 41, "1,812,540", "22,010", 598, "99.7%"],
        ["20 Jul", 40, "1,655,980", "20,140", 572, "99.8%"],
        ["21 Jul", 42, "1,904,110", "23,290", 622, "100%"],
        ["22 Jul", 41, "1,860,760", "22,610", 609, "99.9%"],
        ["23 Jul (today)", 42, "1,842,370", "22,140", 613, "99.98%"],
      ],
      chartLabels: ["18 Jul", "19 Jul", "20 Jul", "21 Jul", "22 Jul", "23 Jul"],
      chartData: [1798220, 1812540, 1655980, 1904110, 1860760, 1842370],
    },
    month: {
      cols: ["Month", "Bays Active (avg)", "Volume (Imp.gal)", "Revenue (KD)", "Tankers", "Water Loss %"],
      rows: [
        ["Mar 2026", 40, "51.2M", "612,400", 17840, "1.8%"],
        ["Apr 2026", 41, "53.8M", "641,900", 18560, "1.6%"],
        ["May 2026", 41, "55.1M", "659,200", 19010, "1.5%"],
        ["Jun 2026", 42, "58.4M", "701,300", 19870, "1.4%"],
        ["Jul 2026 (MTD)", 41, "40.2M", "486,320", 14260, "1.4%"],
      ],
      chartLabels: ["Mar", "Apr", "May", "Jun", "Jul (MTD)"],
      chartData: [51.2, 53.8, 55.1, 58.4, 40.2],
    },
  },
  siaResponses: {
    "which bays are underperforming today?":
      "Three bays are below the station median (38.4 m³/h).\n\nBay 27 — 22.1 m³/h. Valve close-time drifted to 2.4s (SP 1.5s), restricts seat wear on 4 prior units.\nBay 12 — 31.6 m³/h. Meter drift 3.9% high, trend logged over 6 prior fills.\nBay 09 — realtime alert open since 09:04, inlet balance calibration overdue.\n\nRecommended: auto-close preventive WO for Bay 27 (valve seat inspection), schedule maintenance team for 12h. Dispatch task board for Bay 09 inspection.\n\nConfidence: 91% · sources: 42 RTUs, CCTV analytics, CMMS · S!a can raise the WO now, pending your approval.",
    "forecast tomorrow's peak demand":
      "Tomorrow's peak demand is forecast at 09:00–11:00 AST, ≈ 780 m³/h inlet, driven by weekday tanker cycle + 3 recurring high-volume accounts (Gulf Water Logistics, Desert Springs Co., Kuwait Bulk Carriers).\n\nRecommend staffing Shift A at full complement and pre-staging bays 1–20 with fine-fill calibration checked.\n\nConfidence: 87% · 90-day seasonal model + 14-day short-term trend.",
    "any accounts flagged for fraud?":
      "1 account flagged: KWT-40318 — 3 failed PIN attempts in 6 minutes at Bay 22, followed by a plate mismatch against the account's registered fleet.\n\nAction taken: account auto-locked pending verification, SMS + email alert sent to registered contact. No funds were debited.\n\nRecommend: manual review by Tanker Dept. before unlock. S!a can re-enable the account on your approval.",
  },
};

/* ---------- initialize bays ---------- */
for (let i = 1; i <= BAY_COUNT; i++) {
  const status = weightedStatus();
  const target = 5000;
  const dispensed = status === "filling"
    ? Math.floor(target * (0.15 + Math.random() * 0.7))
    : status === "done" ? target
    : status === "idle" ? 0
    : Math.floor(target * Math.random() * 0.4);

  state.bays.push({
    id: i,
    status,
    owner: OWNERS[Math.floor(Math.random() * OWNERS.length)],
    account: randAccount(),
    plate: randPlate(),
    target,
    dispensed,
    flow: status === "filling" ? +(30 + Math.random() * 25).toFixed(1) : 0,
  });
}
// guarantee bay 14 is a nice "hero" filling bay for the control view default
const hero = state.bays.find(b => b.id === 14);
hero.status = "filling";
hero.owner = "Al-Salem Transport Co.";
hero.account = "KWT-40216";
hero.plate = "3 / 84621";
hero.dispensed = 3420;
hero.target = 5000;
hero.flow = 41.8;

/* ---------- initialize ledger ---------- */
const CHANNELS = ["Bay 14", "K-net", "Bay 03", "MEW Pay app", "Bay 22", "Web portal"];
const TYPES = ["Fill (debit)", "Top-up", "Fill (debit)", "Top-up", "Fill (debit)", "Voucher gen"];
function genLedgerRow() {
  const idx = Math.floor(Math.random() * CHANNELS.length);
  const isTopup = TYPES[idx].includes("Top-up") || TYPES[idx].includes("Voucher");
  const now = new Date();
  return {
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    account: randAccount(),
    type: TYPES[idx],
    volume: isTopup ? "—" : `${(Math.random() * 4000 + 500).toFixed(0)}`,
    amount: isTopup ? `+KD ${(Math.random() * 200 + 20).toFixed(3)}` : `-KD ${(Math.random() * 12 + 2).toFixed(3)}`,
    channel: CHANNELS[idx],
    status: isTopup ? (Math.random() > 0.2 ? "Cleared" : "Settling") : "Posted",
  };
}
for (let i = 0; i < 8; i++) state.ledger.push(genLedgerRow());

/* ---------- initialize LPR log ---------- */
const GATES = ["Entry", "Entry", "Exit", "Entry", "Exit"];
function genLprRow() {
  const now = new Date();
  const matched = Math.random() > 0.15;
  return {
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    plate: randPlate(),
    owner: matched ? OWNERS[Math.floor(Math.random() * OWNERS.length)] : "—",
    gate: GATES[Math.floor(Math.random() * GATES.length)],
    status: matched
      ? (Math.random() > 0.5 ? `Matched · Bay ${Math.ceil(Math.random() * 42)}` : `Filled ${(Math.random() * 2000 + 3000).toFixed(0)} IG`)
      : "No match · Gate held",
  };
}
for (let i = 0; i < 7; i++) state.lprLog.push(genLprRow());

/* ---------- video analytics event pool (rotates into state.videoEvents live) ---------- */
const VIDEO_EVENT_POOL = [
  { sev: "warn", text: "Vehicle idling beyond limit — Bay 18 apron", tag: "Auto-notify sent to gate marshal" },
  { sev: "info", text: "Plate re-confirmed on exit — Gate 2", tag: "3-factor match — driver verified" },
  { sev: "warn", text: "PPE not detected — walking lane, Bay 27", tag: "Safety officer alerted" },
  { sev: "info", text: "Night-mode IR switch — Apron West", tag: "Illumination below threshold" },
  { sev: "crit", text: "Unauthorized approach — Gate 1 barrier", tag: "Barrier held, security dispatched" },
  { sev: "info", text: "Tanker queue cleared — Manifold C", tag: "Average wait back under 4 min" },
];
function genVideoEvent() {
  const t = VIDEO_EVENT_POOL[Math.floor(Math.random() * VIDEO_EVENT_POOL.length)];
  return { ...t, ts: Date.now() };
}
