/* ==========================================================
   S!aP — MEW Al Dhaher Water Filling Station — Demo App Logic
   ========================================================== */

let selectedBayId = 14;
let hourlyChart, gaugeChart, reportChart;
let currentReportPeriod = "shift";
let appReady = false;

/* ---- WP-D: offline / store-and-forward demo state ---- */
let wanForced = false;       // true while "Simulate WAN loss" is toggled on
let wanBufferedCount = 0;    // buffered-transaction counter shown in the banner
let wanRestoredMsg = null;   // transient "WAN restored" banner text, or null
let wanRestoredTimer = null;

/* ================= VIEW REGISTRY + EVENT BUS (extension point for modules) =================
   Feature modules (twin3d.js, hmi.js, erp.js, ...) register their own screens here so the
   core app never needs editing when a module is added:
     SIAP.registerView({ id, title, sub, group, icon, navLabel, html, onMount, onShow, onHide, onTick })
   - group : "operations" | "revenue" | "intelligence" | "erp"   (sidebar section)
   - icon  : any lucide icon name
   - html  : inner HTML of the <section class="view"> (string) — or omit and own the DOM yourself
   - onMount(section) once the section exists; onShow/onHide on navigation; onTick(state) every
     simulation tick while the view is visible.
   SIAP.on/emit is a tiny event bus: "ready", "tick", "view:show", "bay:select", "bay:change",
   "fill:start", "fill:stop". */
const VIEW_TITLES = {
  dashboard: ["Command Dashboard", "Al Dhaher Lorry Filling Station · 42 Bays"],
  baycontrol: ["Filling Bay Control", "Live transaction sequence · custody-grade metering"],
  twin: ["Digital Twin", "End-to-end instrumented flow · one bay, fully live"],
  cctv: ["CCTV & LPR Wall", "IP video surveillance · Al Dhaher → Salmiya Control Centre"],
  billing: ["Billing & MEW Pay", "Prepaid wallet · K-net settlement · customer app"],
  reports: ["Reporting", "Shift, Day & Month · central historian"],
  sia: ["S!a — Ask it. Act on it.", "Conversational agentic AI · Glass Box explainable"],
};
const viewHooks = {};
const busListeners = {};
const NAV_GROUP_IDS = { operations: "nav-group-operations", revenue: "nav-group-revenue", intelligence: "nav-group-intelligence", erp: "nav-group-erp" };

const SIAP = window.SIAP = {
  get state() { return state; },
  get selectedBayId() { return selectedBayId; },
  pad, statusLabel: (s) => statusLabel(s), timeAgo: (ts) => timeAgo(ts),
  on(evt, fn) { (busListeners[evt] = busListeners[evt] || []).push(fn); return () => SIAP.off(evt, fn); },
  off(evt, fn) { busListeners[evt] = (busListeners[evt] || []).filter(f => f !== fn); },
  emit(evt, payload) { (busListeners[evt] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(`[SIAP:${evt}]`, e); } }); },
  showView(id) { const el = document.querySelector(`.nav-item[data-view="${id}"]`); if (el) el.click(); },
  activeView() { const v = document.querySelector(".view.active"); return v ? v.id.replace(/^view-/, "") : null; },
  selectBay(id) {
    selectedBayId = id;
    if (appReady) { renderBaySelect(); renderFlowTrack(); renderBayControlPanel(); renderTwinBaySelect(); renderBayTwinDiagram(id); }
    SIAP.emit("bay:select", state.bays.find(b => b.id === id));
  },
  /** Start a fill on a bay, optionally overriding the transaction fields
   *  ({ owner, account, plate, target }) — used by the ERP order-to-cash scenario. */
  startFill(bayId, tx = {}) {
    const bay = state.bays.find(b => b.id === bayId); if (!bay) return null;
    Object.assign(bay, { status: "filling", dispensed: 0, flow: +(30 + Math.random() * 20).toFixed(1) }, tx);
    if (appReady) { renderBayGrid(); if (bayId === selectedBayId) { renderFlowTrack(); renderBayControlPanel(); } }
    SIAP.emit("fill:start", bay); SIAP.emit("bay:change", bay);
    return bay;
  },
  stopFill(bayId, finalStatus = "idle") {
    const bay = state.bays.find(b => b.id === bayId); if (!bay) return null;
    bay.status = finalStatus; bay.flow = 0;
    if (appReady) { renderBayGrid(); if (bayId === selectedBayId) { renderFlowTrack(); renderBayControlPanel(); } }
    SIAP.emit("fill:stop", bay); SIAP.emit("bay:change", bay);
    return bay;
  },
  registerView(def) {
    VIEW_TITLES[def.id] = [def.title, def.sub || ""];
    viewHooks[def.id] = def;
    const mount = () => {
      if (def.html && !document.getElementById(`view-${def.id}`)) {
        const sec = document.createElement("section");
        sec.className = "view"; sec.id = `view-${def.id}`; sec.innerHTML = def.html;
        document.querySelector(".view-scroll").appendChild(sec);
      }
      if (!document.querySelector(`.nav-item[data-view="${def.id}"]`)) {
        const group = document.getElementById(NAV_GROUP_IDS[def.group || "operations"]);
        const item = document.createElement("div");
        item.className = "nav-item"; item.dataset.view = def.id; item.tabIndex = 0; item.setAttribute("role", "button");
        item.title = def.title; item.setAttribute("aria-label", def.title);
        item.innerHTML = `<i data-lucide="${def.icon || "box"}"></i><span class="nav-label"> ${def.navLabel || def.title}</span>`;
        // append at the end of that sidebar group (just before the next group label / footer)
        let cursor = group.nextElementSibling;
        while (cursor && cursor.classList.contains("nav-item")) cursor = cursor.nextElementSibling;
        group.parentNode.insertBefore(item, cursor);
        if (window.lucide) lucide.createIcons();
      }
      if (def.onMount) def.onMount(document.getElementById(`view-${def.id}`));
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();
  },
};

document.addEventListener("DOMContentLoaded", () => {
  wireNav();
  wireBayControl();
  wireCctv();
  wireBilling();
  wireReports();
  wireSia();
  wireWanToggle();

  renderBayGrid();
  renderAlarms();
  renderAlarmBanner();
  updateOpenAlarmsKpi();
  renderHourlyChart();
  renderGauge();
  renderArchDiagram();
  updateArchLiveBadges();
  renderMimicDiagram();
  renderBaySelect();
  renderFlowTrack();
  renderBayControlPanel();
  renderBayFaceplate();
  renderTwinBaySelect();
  renderBayTwinDiagram(selectedBayId);
  renderCctvGrid();
  renderLprLog();
  renderVideoEvents();
  renderLedger();
  renderMewActivity();
  renderReportTable();
  renderReportChart();

  wireKeyboardActivation();

  lucide.createIcons();
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(simulateTick, 2200);
  appReady = true;
  SIAP.emit("ready", state);
});

/** Lets keyboard users "click" the div-based controls (nav items, bay tiles, report
 *  tabs, the alarm-banner link) with Enter/Space, same as a native button would. */
function wireKeyboardActivation() {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target.closest(".nav-item, .bay-tile, .report-tab, [data-jump-alarms]");
    if (!el) return;
    e.preventDefault();
    el.click();
  });
}

/* ================= NAVIGATION ================= */
function wireNav() {
  // Delegated so nav items injected later by modules (SIAP.registerView) work too.
  document.querySelector(".sidebar").addEventListener("click", (e) => {
    const item = e.target.closest(".nav-item");
    if (!item) return;
    const view = item.dataset.view;
    const prev = SIAP.activeView();
    if (prev && prev !== view && viewHooks[prev] && viewHooks[prev].onHide) viewHooks[prev].onHide();
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    item.classList.add("active");
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    const section = document.getElementById(`view-${view}`);
    if (section) section.classList.add("active");

    const t = VIEW_TITLES[view] || [item.title || view, ""];
    document.getElementById("view-title").textContent = t[0];
    document.getElementById("view-sub").textContent = t[1];
    lucide.createIcons();
    if (viewHooks[view] && viewHooks[view].onShow) viewHooks[view].onShow(section);
    SIAP.emit("view:show", view);
  });
}

function tickClock() {
  const now = new Date();
  document.getElementById("clock").textContent =
    now.toLocaleTimeString("en-GB", { hour12: false }) + " AST";
}

/* ================= DASHBOARD ================= */
function renderBayGrid() {
  const grid = document.getElementById("bay-grid");
  grid.innerHTML = state.bays.map(b => `
    <div class="bay-tile ${b.status}" data-bay="${b.id}" tabindex="0" role="button" aria-label="Bay ${pad(b.id)} — ${statusLabel(b.status)}">
      <div class="bay-id">BAY ${pad(b.id)}</div>
      <div class="bay-status"><span class="bay-dot"></span>${statusLabel(b.status)}</div>
    </div>
  `).join("");

  grid.querySelectorAll(".bay-tile").forEach(tile => {
    tile.addEventListener("click", () => {
      SIAP.selectBay(parseInt(tile.dataset.bay, 10));
      document.querySelector('.nav-item[data-view="baycontrol"]').click();
    });
  });
}

function statusLabel(s) {
  return { idle: "Idle", filling: "Filling", done: "Done", fault: "Fault", offline: "Offline" }[s];
}

/** Turns a stored timestamp into a live "Xm ago" label — recomputed on every render so
 *  alarms/events don't look frozen if the demo screen is left running for a while. */
function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function renderAlarms() {
  const sevClass = { crit: "crit", warn: "warn", amber2: "warn", info: "info" };
  const list = document.getElementById("alarm-list");
  list.innerHTML = state.alarms.slice(0, 8).map(a => `
    <div class="alarm-item ${a.ack ? "acked" : ""}">
      <div class="alarm-dot ${sevClass[a.sev]}"></div>
      <div class="alarm-body">
        <div class="alarm-text">${a.text}</div>
        <div class="alarm-time">${timeAgo(a.ts)}</div>
      </div>
      ${a.ack
        ? `<span class="ack-btn acked-label">Acked</span>`
        : `<button class="ack-btn" data-ack="${a.id}">Ack</button>`}
    </div>
  `).join("");
  list.querySelectorAll("[data-ack]").forEach(btn => {
    btn.addEventListener("click", () => {
      const alarm = state.alarms.find(a => a.id === parseInt(btn.dataset.ack, 10));
      if (alarm) alarm.ack = true;
      renderAlarms();
      renderAlarmBanner();
      updateOpenAlarmsKpi();
    });
  });
}

function updateOpenAlarmsKpi() {
  const open = state.alarms.filter(a => !a.ack).length;
  const critOpen = state.alarms.filter(a => !a.ack && a.sev === "crit").length;
  state.kpis.openAlarms = open;
  const kpiEl = document.getElementById("kpi-alarms");
  if (kpiEl) kpiEl.textContent = open;
  const deltaEl = document.querySelector("#kpi-alarms").parentElement.querySelector(".kpi-delta");
  if (deltaEl) {
    if (critOpen > 0) { deltaEl.textContent = `${critOpen} critical`; deltaEl.className = "kpi-delta warn"; }
    else if (open > 0) { deltaEl.textContent = "no critical"; deltaEl.className = "kpi-delta"; }
    else { deltaEl.textContent = "all clear"; deltaEl.className = "kpi-delta up"; }
  }
}

function renderAlarmBanner() {
  const banner = document.getElementById("alarm-banner");
  // WP-D: while a simulated WAN outage is forced, the offline banner takes priority
  // over the normal critical-alarm banner (reuses the same .alarm-banner styling).
  if (wanForced) {
    banner.hidden = false;
    banner.className = "alarm-banner amber";
    banner.innerHTML = `<span class="dot"></span> Al Dhaher LCC offline — 42 bays continue on last-known balance · ${wanBufferedCount} transaction${wanBufferedCount === 1 ? "" : "s"} buffered (store-and-forward)`;
    return;
  }
  if (wanRestoredMsg) {
    banner.hidden = false;
    banner.className = "alarm-banner green";
    banner.innerHTML = `<span class="dot"></span> ${wanRestoredMsg}`;
    return;
  }
  banner.className = "alarm-banner";
  const crit = state.alarms.filter(a => !a.ack && a.sev === "crit");
  if (crit.length === 0) { banner.hidden = true; return; }
  banner.hidden = false;
  banner.innerHTML = `
    <span class="dot"></span>
    ${crit.length} unacknowledged critical alarm${crit.length > 1 ? "s" : ""} — "${crit[0].text}"
    <a data-jump-alarms tabindex="0" role="button">View &amp; acknowledge</a>
  `;
  banner.querySelector("[data-jump-alarms]").addEventListener("click", () => {
    document.querySelector('.nav-item[data-view="dashboard"]').click();
    document.getElementById("alarm-list").scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

/* ================= WP-D: OFFLINE / STORE-AND-FORWARD DEMO ================= */
function wireWanToggle() {
  const btn = document.getElementById("btn-wan-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (!wanForced) {
      wanForced = true;
      wanBufferedCount = 0;
      wanRestoredMsg = null;
      clearTimeout(wanRestoredTimer);
      state.kpis.wanLinkA = "down";
      state.kpis.wanLinkB = "down";
      updateArchLiveBadges();
      renderAlarmBanner();
      btn.classList.add("btn-red");
      btn.innerHTML = `<i data-lucide="wifi-off"></i> WAN loss: ON`;
    } else {
      wanForced = false;
      const replayed = wanBufferedCount;
      state.ledger.forEach(r => { if (r.status === "Buffered") r.status = "Posted"; });
      renderLedger();
      state.kpis.wanLinkA = "up";
      state.kpis.wanLinkB = "up";
      state.kpis.drSync = "syncing";
      state.kpis.drLagSec = 2;
      updateArchLiveBadges();
      wanRestoredMsg = `WAN restored — replayed ${replayed} buffered transaction${replayed === 1 ? "" : "s"} to Salmiya · DR RPO 0 s`;
      renderAlarmBanner();
      clearTimeout(wanRestoredTimer);
      wanRestoredTimer = setTimeout(() => {
        wanRestoredMsg = null;
        state.kpis.drSync = "synced";
        state.kpis.drLagSec = 0;
        updateArchLiveBadges();
        renderAlarmBanner();
      }, 4000);
      btn.classList.remove("btn-red");
      btn.innerHTML = `<i data-lucide="wifi-off"></i> Simulate WAN loss`;
    }
    lucide.createIcons();
  });
}

function verticalGradient(ctx, chartArea, colorTop, colorBottom) {
  const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, colorTop);
  g.addColorStop(1, colorBottom);
  return g;
}

function renderHourlyChart() {
  const ctx = document.getElementById("hourly-chart");
  hourlyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: state.hourly.labels,
      datasets: [
        {
          type: "bar",
          label: "Volume (k Imp.gal)",
          data: state.hourly.volume,
          backgroundColor: (c) => {
            const { chart } = c;
            if (!chart.chartArea) return "rgba(34,211,238,0.55)";
            return verticalGradient(chart.ctx, chart.chartArea, "rgba(34,211,238,0.75)", "rgba(34,211,238,0.12)");
          },
          hoverBackgroundColor: "rgba(34,211,238,0.9)",
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.62,
          yAxisID: "y",
          order: 2,
        },
        {
          type: "line",
          label: "Revenue (KD)",
          data: state.hourly.revenue,
          borderColor: "#34d399",
          borderWidth: 2.5,
          backgroundColor: (c) => {
            const { chart } = c;
            if (!chart.chartArea) return "rgba(52,211,153,0.15)";
            return verticalGradient(chart.ctx, chart.chartArea, "rgba(52,211,153,0.32)", "rgba(52,211,153,0.0)");
          },
          fill: true,
          tension: 0.4,
          yAxisID: "y1",
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: "#34d399",
          pointHoverBorderColor: "#04241a",
          pointHoverBorderWidth: 2,
          order: 1,
        },
      ],
    },
    options: chartBaseOptions(true, {
      y: (v) => `${v}k`,
      y1: (v) => `KD ${v}`,
    }),
  });
}

function chartBaseOptions(dualAxis, tickFormat) {
  const grid = { color: "rgba(148,178,216,0.07)", drawTicks: false };
  const ticks = { color: "#8fa3c2", font: { size: 10.5 } };
  const fmt = tickFormat || {};
  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    animation: { duration: 500, easing: "easeOutQuart" },
    plugins: {
      legend: {
        labels: {
          color: "#c3d3ec", boxWidth: 9, boxHeight: 9, usePointStyle: true, pointStyle: "circle",
          font: { size: 10.5, weight: "600" }, padding: 14,
        },
      },
      tooltip: {
        backgroundColor: "#0d1a30", borderColor: "rgba(148,178,216,0.25)", borderWidth: 1,
        padding: 10, titleColor: "#e7edf7", bodyColor: "#c3d3ec", boxPadding: 4,
        titleFont: { size: 11.5, weight: "700" }, bodyFont: { size: 11 }, cornerRadius: 8,
        displayColors: true, boxWidth: 8, boxHeight: 8, usePointStyle: true,
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: "rgba(148,178,216,0.15)" }, ticks },
      y: {
        grid, border: { display: false }, ticks: { ...ticks, callback: fmt.y ? (v) => fmt.y(v) : undefined },
        title: dualAxis ? { display: true, text: "Volume", color: "#5f7292", font: { size: 9.5, weight: "600" } } : undefined,
      },
    },
  };
  if (dualAxis) {
    opts.scales.y1 = {
      position: "right", grid: { display: false }, border: { display: false },
      ticks: { ...ticks, callback: fmt.y1 ? (v) => fmt.y1(v) : undefined },
      title: { display: true, text: "Revenue", color: "#5f7292", font: { size: 9.5, weight: "600" } },
    };
  }
  return opts;
}

const GAUGE_MAX = 1000;

function gaugeColor(val) {
  if (val > 900) return "#fbbf24";
  if (val < 350) return "#f87171";
  return "#22d3ee";
}

function renderGauge() {
  const val = state.kpis.inletFlow;
  const color = gaugeColor(val);
  if (!gaugeChart) {
    gaugeChart = new Chart(document.getElementById("gauge-chart"), {
      type: "doughnut",
      data: {
        datasets: [{
          data: [val, GAUGE_MAX - val],
          backgroundColor: (c) => {
            const { chart } = c;
            if (c.dataIndex !== 0 || !chart.chartArea) return "rgba(255,255,255,0.06)";
            return verticalGradient(chart.ctx, chart.chartArea, "#67e8f9", color);
          },
          borderWidth: 0,
          borderRadius: 6,
          circumference: 180,
          rotation: 270,
        }],
      },
      options: {
        cutout: "78%",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400, easing: "easeOutQuart" },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      },
    });
  } else {
    gaugeChart.data.datasets[0].data = [val, GAUGE_MAX - val];
    gaugeChart.update();
  }
  const valueEl = document.getElementById("gauge-value");
  valueEl.textContent = val;
  valueEl.style.color = color;
  document.getElementById("gauge-pressure").textContent = state.kpis.inletPressure.toFixed(1) + " bar";
}

/* ================= ARCHITECTURE DIAGRAM (Figure 1 style) ================= */
function renderArchDiagram() {
  const svg = `
  <svg class="scada-svg" viewBox="0 0 1180 300" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrowData" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0L10,5L0,10z" fill="#60a5fa"/>
      </marker>
      <marker id="arrowRepl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0L10,5L0,10z" fill="#34d399"/>
      </marker>
    </defs>

    <!-- Edge box -->
    <rect class="box box-accent" x="16" y="90" width="204" height="110" rx="8"/>
    <text class="title" x="30" y="112">AL DHAHER LCC</text>
    <text x="30" y="126">S!aP Connect — Edge</text>
    <text x="30" y="146">&#8226; 42 Bay RTUs — Modbus/OPC-UA</text>
    <text x="30" y="162">&#8226; CCTV / LPR — RTSP</text>
    <text x="30" y="178">&#8226; K-net Gateway — HTTPS</text>
    <text x="30" y="194" style="fill:var(--text-faint)">Field control &amp; safety unchanged</text>

    <!-- Edge -> WAN -->
    <path class="pipe-data" d="M220,135 L282,135" marker-end="url(#arrowData)"/>

    <!-- WAN pill -->
    <rect class="box" x="282" y="112" width="150" height="46" rx="23"/>
    <text class="title" x="357" y="132" text-anchor="middle">SECURED WAN</text>
    <text x="357" y="146" text-anchor="middle" style="font-size:9.5px">5G / GPRS / LTE &middot; IPsec</text>
    <circle id="wan-a-dot" class="link-dot-up" cx="322" cy="172" r="4"/>
    <text x="332" y="176" style="font-size:9.5px">Link A</text>
    <circle id="wan-b-dot" class="link-dot-up" cx="382" cy="172" r="4"/>
    <text x="392" y="176" style="font-size:9.5px">Link B</text>

    <!-- WAN -> DC -->
    <path class="pipe-data" d="M432,135 L466,135" marker-end="url(#arrowData)"/>

    <!-- Salmiya DC box -->
    <rect class="box box-accent" x="466" y="40" width="304" height="180" rx="8"/>
    <text class="title" x="480" y="62">S!aP PLATFORM — SALMIYA MAIN DC</text>
    <text x="480" y="76" style="fill:var(--text-faint)">Astrikos scope &middot; Glass Box</text>

    <g id="arch-modules">
      ${["S!aP Connect","S!aP Datalake","S!aP ML &amp; AI","S!aP BPM","S!aP Viz","S!a Agentic"].map((m,i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = 480 + col * 100, y = 88 + row * 40;
        return `<rect class="box box-chip" x="${x}" y="${y}" width="92" height="32" rx="5"/>
                <text x="${x+46}" y="${y+20}" text-anchor="middle" style="font-size:10.5px; font-weight:600; fill:var(--text); letter-spacing:0.01em;">${m}</text>`;
      }).join("")}
    </g>
    <rect class="box box-chip" x="480" y="176" width="272" height="26" rx="6"/>
    <text x="616" y="193" text-anchor="middle" style="font-size:9.5px">S!aP Core — RBAC &middot; SSO/AD &middot; Immutable Audit</text>

    <!-- DC -> DR -->
    <text x="788" y="32" text-anchor="middle" style="font-size:9.5px; fill:var(--green)">continuous replication</text>
    <path class="pipe-repl" d="M770,105 L806,105" marker-end="url(#arrowRepl)" style="fill:none;stroke:#34d399;stroke-width:2;stroke-dasharray:3 5;animation:flowmove .9s linear infinite;"/>

    <!-- DR box -->
    <rect class="box box-green" x="806" y="55" width="220" height="100" rx="8"/>
    <text class="title" x="820" y="76" style="fill:var(--green)">DISASTER RECOVERY</text>
    <text x="820" y="90">MEW HQ — South Surra</text>
    <text id="dr-status-text" x="820" y="110" class="mono" style="fill:var(--green)">RPO &asymp; 0s &middot; Synced</text>
    <text x="820" y="128" style="fill:var(--text-faint)">Business continuity &middot; Astrikos scope</text>

    <!-- DC -> Payment branch -->
    <path class="pipe-data" d="M618,220 L618,240" marker-end="url(#arrowData)"/>
    <rect class="box" x="466" y="248" width="304" height="42" rx="8"/>
    <text class="title" x="618" y="266" text-anchor="middle">PAYMENT &amp; CUSTOMER SYSTEMS</text>
    <text x="618" y="282" text-anchor="middle" style="font-size:9.5px">K-net gateway &middot; MEW web portal &middot; MEW Pay app (EN/AR)</text>
  </svg>`;
  document.getElementById("arch-diagram").innerHTML = svg;
}

function updateArchLiveBadges() {
  const dotA = document.getElementById("wan-a-dot");
  const dotB = document.getElementById("wan-b-dot");
  if (dotA) dotA.setAttribute("class", `link-dot-${state.kpis.wanLinkA}`);
  if (dotB) dotB.setAttribute("class", `link-dot-${state.kpis.wanLinkB}`);
  const dr = document.getElementById("dr-status-text");
  if (dr) {
    if (state.kpis.drSync === "synced") {
      dr.textContent = "RPO ≈ 0s · Synced";
      dr.style.fill = "var(--green)";
    } else {
      dr.textContent = `Syncing · lag ${state.kpis.drLagSec}s`;
      dr.style.fill = "var(--amber)";
    }
  }
}

/* ================= STATION PROCESS MIMIC (P&ID) ================= */
const MANIFOLD_COUNT = 6;
const BAYS_PER_MANIFOLD = 7;

function manifoldStats(idx) {
  const start = idx * BAYS_PER_MANIFOLD + 1;
  const end = start + BAYS_PER_MANIFOLD - 1;
  const bays = state.bays.filter(b => b.id >= start && b.id <= end);
  const filling = bays.filter(b => b.status === "filling").length;
  const fault = bays.filter(b => b.status === "fault").length;
  const done = bays.filter(b => b.status === "done").length;
  let cls = "valve-idle";
  if (fault > 0) cls = "valve-fault";
  else if (filling > 0) cls = "valve-open";
  else if (done === bays.length) cls = "valve-done";
  return { start, end, filling, fault, done, cls };
}

function renderMimicDiagram() {
  const xs = [230, 370, 510, 650, 790, 930];
  const headerY = 70;
  let branches = "";
  for (let i = 0; i < MANIFOLD_COUNT; i++) {
    const { start, end, filling, fault, cls } = manifoldStats(i);
    const x = xs[i];
    branches += `
      <line class="pipe" x1="${x}" y1="${headerY}" x2="${x}" y2="118" />
      <circle class="${cls}" cx="${x}" cy="128" r="11" stroke-width="2" id="manifold-valve-${i}"/>
      <rect class="box" x="${x - 68}" y="146" width="136" height="42" rx="6"/>
      <text class="title" x="${x}" y="163" text-anchor="middle">MANIFOLD ${String.fromCharCode(65 + i)}</text>
      <text x="${x}" y="178" text-anchor="middle" id="manifold-sub-${i}" style="font-size:9.5px">Bays ${start}-${end} &middot; ${filling} filling${fault ? ` &middot; ${fault} fault` : ""}</text>
    `;
  }
  const svg = `
  <svg class="scada-svg" viewBox="0 0 1180 200" xmlns="http://www.w3.org/2000/svg">
    <rect class="box box-accent" x="10" y="46" width="160" height="48" rx="8"/>
    <text class="title" x="22" y="66">WNCC INLET</text>
    <text x="22" y="80" style="font-size:9.5px">Shuwaikh &middot; DN800</text>
    <text id="mimic-inlet-flow" class="mono" x="22" y="106" style="fill:var(--accent); font-size:12px; font-weight:700;">${state.kpis.inletFlow} m&sup3;/h</text>

    <path id="mimic-header-pipe" class="pipe-flow" d="M170,${headerY} L990,${headerY}" />
    ${branches}

    <text x="1000" y="${headerY - 6}" style="font-size:9px; fill:var(--text-faint)">S!aP Connect —</text>
    <text x="1000" y="${headerY + 8}" style="font-size:9px; fill:var(--text-faint)">read-only tap</text>
  </svg>`;
  document.getElementById("mimic-diagram").innerHTML = svg;
}

/* ================= BAY CONTROL ================= */
function wireBayControl() {
  document.getElementById("btn-start-fill").addEventListener("click", () => {
    const bay = state.bays.find(b => b.id === selectedBayId);
    bay.status = "filling";
    if (bay.flow === 0) bay.flow = +(30 + Math.random() * 20).toFixed(1);
    renderBayGrid();
    renderFlowTrack();
    renderBayControlPanel();
  });
  document.getElementById("btn-stop-fill").addEventListener("click", () => {
    const bay = state.bays.find(b => b.id === selectedBayId);
    bay.status = "idle";
    bay.flow = 0;
    renderBayGrid();
    renderFlowTrack();
    renderBayControlPanel();
  });
  document.getElementById("btn-view-twin").addEventListener("click", () => {
    document.querySelector('.nav-item[data-view="twin"]').click();
    renderTwinBaySelect();
    renderBayTwinDiagram(selectedBayId);
  });
}

function renderBaySelect() {
  const sel = document.getElementById("bay-select");
  sel.innerHTML = state.bays.map(b => `<option value="${b.id}" ${b.id === selectedBayId ? "selected" : ""}>Bay ${pad(b.id)} — ${statusLabel(b.status)}</option>`).join("");
  sel.onchange = () => SIAP.selectBay(parseInt(sel.value, 10));
}

function bayFlowStepIndex(bay) {
  if (bay.status === "idle") return 0;
  if (bay.status === "fault" || bay.status === "offline") return 1;
  if (bay.status === "filling") return bay.dispensed < bay.target * 0.15 ? 2 : 3;
  if (bay.status === "done") return 4;
  return 2;
}

function renderFlowTrack() {
  const bay = state.bays.find(b => b.id === selectedBayId);
  const steps = ["Tanker Detected (LPR)", "Scan QR / Enter PIN", "Account Validated", "Filling In Progress", "Debit & SMS Receipt"];
  const activeIdx = bayFlowStepIndex(bay);
  document.getElementById("flow-track").innerHTML = steps.map((label, i) => {
    let cls = "";
    if (i < activeIdx) cls = "done";
    else if (i === activeIdx) cls = "active";
    return `
      <div class="flow-step ${cls}">
        <div class="dot"><div class="flow-line"></div>${i < activeIdx ? "✓" : i + 1}</div>
        <div class="label">${label}</div>
      </div>`;
  }).join("");
}

function renderBayFaceplate() {
  const bay = state.bays.find(b => b.id === selectedBayId);
  const pct = Math.min(100, (bay.dispensed / bay.target) * 100);
  const tankY = 24, tankH = 84;
  const levelH = (pct / 100) * tankH;
  const levelY = tankY + (tankH - levelH);
  const pipeClass = bay.status === "filling" ? "pipe-flow" : "pipe-idle";
  const valveClass = bay.status === "filling" ? "valve-open" : bay.status === "fault" ? "valve-fault" : bay.status === "done" ? "valve-done" : "valve-idle";
  const valveLabel = bay.status === "filling" ? `${Math.min(100, Math.round((bay.flow / 60) * 100))}%` : bay.status === "fault" ? "FAULT" : "CLOSED";

  const svg = `
  <svg class="scada-svg" viewBox="0 0 600 130" xmlns="http://www.w3.org/2000/svg" style="max-width:460px;">
    <defs>
      <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#0891b2" stop-opacity="0.9"/>
      </linearGradient>
      <clipPath id="tankClip"><rect x="258" y="${tankY + 2}" width="296" height="${tankH - 4}" rx="8"/></clipPath>
    </defs>

    <text x="10" y="16" style="font-size:9.5px; fill:var(--text-faint)">INLET HEADER</text>
    <line class="${pipeClass}" x1="10" y1="65" x2="140" y2="65"/>

    <circle class="${valveClass}" cx="152" cy="65" r="15" stroke-width="2"/>
    <line x1="152" y1="50" x2="152" y2="38" stroke="var(--text-dim)" stroke-width="2"/>
    <rect x="140" y="30" width="24" height="8" rx="2" fill="var(--panel-alt)" stroke="var(--border-strong)"/>
    <text x="152" y="98" text-anchor="middle" style="font-size:9px; fill:var(--text-dim)">VALVE</text>
    <text x="152" y="111" text-anchor="middle" class="mono" style="font-size:10px; font-weight:700; fill:var(--text)">${valveLabel}</text>

    <line class="${pipeClass}" x1="167" y1="65" x2="256" y2="65"/>

    <rect x="256" y="${tankY}" width="300" height="${tankH}" rx="10" fill="var(--panel-alt)" stroke="var(--border-strong)" stroke-width="1.5"/>
    <rect x="258" y="${levelY}" width="296" height="${levelH}" fill="url(#waterGrad)" clip-path="url(#tankClip)" style="transition: y .5s ease, height .5s ease;"/>
    <text x="406" y="${tankY + tankH / 2 - 4}" text-anchor="middle" class="mono" style="font-size:20px; font-weight:800; fill:#fff;">${pct.toFixed(0)}%</text>
    <text x="406" y="${tankY + tankH / 2 + 15}" text-anchor="middle" style="font-size:9.5px; fill:rgba(255,255,255,0.9);">TANKER — BAY ${pad(bay.id)}</text>
    <text x="406" y="${tankY - 6}" text-anchor="middle" style="font-size:9.5px; fill:var(--text-faint);">Custody-transfer EMF meter &middot; &plusmn;0.18%</text>
  </svg>`;
  document.getElementById("bay-faceplate").innerHTML = svg;
}

/** Deterministic per-account "pre-fill" wallet balance so it stays stable while an
 *  account is selected but still varies realistically bay-to-bay (was hardcoded before). */
function accountBalanceSeed(account) {
  let h = 0;
  for (let i = 0; i < account.length; i++) h = (h * 31 + account.charCodeAt(i)) >>> 0;
  return 80 + (h % 17000) / 100; // KD 80.00 – 250.00
}

function renderBayControlPanel() {
  const bay = state.bays.find(b => b.id === selectedBayId);
  renderBayFaceplate();
  document.getElementById("bc-heading").innerHTML = `Bay ${pad(bay.id)} &mdash; Live Transaction`;
  document.getElementById("bc-volume").innerHTML = `${bay.dispensed.toLocaleString()}<span style="font-size:16px;color:var(--text-dim);font-weight:600;"> / <span id="bc-target">${bay.target.toLocaleString()}</span> Imp.gal</span>`;
  const pct = Math.min(100, (bay.dispensed / bay.target) * 100);
  document.getElementById("bc-progress").style.width = pct.toFixed(0) + "%";
  document.getElementById("bc-flow").textContent = (bay.status === "filling" ? bay.flow : 0) + " m³/h";
  document.getElementById("bc-valve").textContent = bay.status === "filling" ? "Open · modulating" : bay.status === "done" ? "Closed · complete" : bay.status === "fault" ? "Fault · locked" : "Closed";
  const remaining = bay.target - bay.dispensed;
  // dispensed/target are Imp.gal, flow is m³/h (1 Imp.gal = 0.004546 m³); the demo clock runs ~60× real time
  const etaMin = bay.flow > 0 ? Math.max(0, (remaining * 0.004546) / bay.flow) : 0;
  document.getElementById("bc-eta").textContent = bay.status === "filling" ? `${Math.floor(etaMin)}m ${Math.floor((etaMin % 1) * 60)}s` : "—";
  document.getElementById("bc-owner").textContent = bay.owner;
  document.getElementById("bc-account").textContent = bay.account;
  document.getElementById("bc-plate").textContent = bay.plate;
  const rate = 0.0025; // KD per unit, arbitrary demo rate
  const chargeNum = bay.dispensed * rate;
  document.getElementById("bc-charge").textContent = `KD ${chargeNum.toFixed(3)}`;
  const preBalance = accountBalanceSeed(bay.account);
  document.getElementById("bc-balance-pre").textContent = `KD ${preBalance.toFixed(3)}`;
  document.getElementById("bc-balance").textContent = `KD ${Math.max(0, preBalance - chargeNum).toFixed(3)}`;
  const now = new Date();
  document.getElementById("bc-datetime").textContent = `${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  document.getElementById("btn-start-fill").disabled = bay.status === "filling";
  document.getElementById("btn-stop-fill").disabled = bay.status !== "filling";
}

/* ================= DIGITAL TWIN (end-to-end instrumented flow) ================= */
function renderTwinBaySelect() {
  const sel = document.getElementById("twin-bay-select");
  sel.innerHTML = state.bays.map(b => `<option value="${b.id}" ${b.id === selectedBayId ? "selected" : ""}>Bay ${pad(b.id)} — ${statusLabel(b.status)}</option>`).join("");
  sel.onchange = () => SIAP.selectBay(parseInt(sel.value, 10));
}

/** Deterministic-ish live jitter so readings move every tick without being random noise. */
function twinJitter(seed, amplitude) {
  return Math.sin(Date.now() / 4000 + seed) * amplitude;
}

function renderBayTwinDiagram(bayId) {
  const bay = state.bays.find(b => b.id === bayId);
  if (!bay) return;
  document.getElementById("twin-hint").textContent = `Bay ${pad(bay.id)} · live`;

  const filling = bay.status === "filling";
  const fault = bay.status === "fault";
  const offline = bay.status === "offline";
  const commsDown = fault || offline;
  const authed = bay.status !== "idle" && !offline;
  const pct = Math.min(100, (bay.dispensed / bay.target) * 100);
  const fineFill = filling && bay.dispensed > bay.target * 0.85;
  const flow = filling ? bay.flow : 0;
  const pressure = (state.kpis.inletPressure + (bay.id % 5) * 0.06 + twinJitter(bay.id, 0.08)).toFixed(2);
  const temp = (26 + twinJitter(bay.id + 50, 0.7)).toFixed(1);
  const charge = (bay.dispensed * 0.0025).toFixed(3);

  const pipeClass = filling ? "pipe-flow" : "pipe-idle";
  const inletValveClass = commsDown ? "valve-fault" : filling ? "valve-open" : bay.status === "done" ? "valve-done" : "valve-idle";
  const fineValveClass = commsDown ? "valve-fault" : fineFill ? "valve-open" : filling ? "valve-done" : "valve-idle";
  const inletValveLabel = offline ? "NO COMMS" : fault ? "FAULT" : filling ? "OPEN" : "CLOSED";
  const fineValveLabel = offline ? "NO COMMS" : fault ? "FAULT" : fineFill ? `${Math.round(pct)}%` : filling ? "FULL FLOW" : "CLOSED";

  const tankY = 118, tankH = 92, tankX = 830, tankW = 190;
  const levelH = (pct / 100) * (tankH - 4);
  const levelY = tankY + 2 + (tankH - 4 - levelH);
  // LPR/QR badges live in the top band, centered over the tank — keeps them clear of
  // the Flow Computer box (ends x=755) on the left and the tank box (starts y=118) below.
  const badgeW = 130, badgeX = tankX + tankW / 2 - badgeW / 2, badgeCx = tankX + tankW / 2;

  const svg = `
  <svg class="scada-svg" viewBox="0 0 1180 300" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="twinWaterGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#0891b2" stop-opacity="0.9"/>
      </linearGradient>
      <clipPath id="twinTankClip"><rect x="${tankX + 2}" y="${tankY + 2}" width="${tankW - 4}" height="${tankH - 4}" rx="8"/></clipPath>
    </defs>

    <!-- Control center + flow computer (mirrors S!aP Connect / RTU already on the arch diagram) -->
    <rect class="box box-chip" x="430" y="14" width="160" height="54" rx="6"/>
    <text class="title" x="510" y="35" text-anchor="middle">CONTROL CENTER</text>
    <text x="510" y="51" text-anchor="middle" style="font-size:9px">S!aP Connect &middot; Bay ${pad(bay.id)} RTU</text>

    <rect class="box box-chip" x="605" y="14" width="150" height="54" rx="6"/>
    <text class="title" x="680" y="35" text-anchor="middle">FLOW COMPUTER</text>
    <text x="680" y="51" text-anchor="middle" style="font-size:9px">${offline ? "Offline &middot; no comms" : fault ? "Fault &middot; locked" : filling ? (fineFill ? "Auto &middot; fine-fill top-up" : "Auto &middot; full flow") : bay.status === "done" ? "Cycle complete" : "Standby"}</text>

    <line x1="440" y1="68" x2="255" y2="150" stroke="var(--border-strong)" stroke-width="1.3"/>
    <line x1="480" y1="68" x2="400" y2="150" stroke="var(--border-strong)" stroke-width="1.3"/>
    <line x1="650" y1="68" x2="560" y2="150" stroke="var(--border-strong)" stroke-width="1.3"/>
    <line x1="700" y1="68" x2="655" y2="150" stroke="var(--border-strong)" stroke-width="1.3"/>

    <!-- Station inlet (source) -->
    <rect class="box box-accent" x="10" y="130" width="150" height="82" rx="8"/>
    <text class="title" x="24" y="152">STATION INLET</text>
    <text x="24" y="168" style="font-size:9.5px">WNCC header &middot; DN800</text>
    <text x="24" y="196" class="mono" style="fill:var(--accent); font-size:13px; font-weight:700;">${state.kpis.inletFlow} m&sup3;/h</text>

    <line class="${pipeClass}" x1="160" y1="170" x2="238" y2="170"/>

    <!-- Inlet valve -->
    <circle class="${inletValveClass}" cx="255" cy="170" r="16" stroke-width="2"/>
    <text x="255" y="207" text-anchor="middle" style="font-size:9px">INLET VALVE</text>
    <text x="255" y="220" text-anchor="middle" class="mono" style="font-size:9.5px; font-weight:700;">${inletValveLabel}</text>

    <line class="${pipeClass}" x1="271" y1="170" x2="330" y2="170"/>

    <!-- Custody flowmeter -->
    <rect class="box" x="330" y="150" width="90" height="42" rx="6"/>
    <text class="title" x="375" y="167" text-anchor="middle" style="font-size:9.5px">FLOWMETER</text>
    <text x="375" y="183" text-anchor="middle" class="mono" style="font-size:11px; font-weight:700; fill:var(--accent);">${flow.toFixed(1)} m&sup3;/h</text>
    <text x="375" y="207" text-anchor="middle" style="font-size:8.5px; fill:var(--text-faint);">custody &plusmn;0.18%</text>

    <line class="${pipeClass}" x1="420" y1="170" x2="620" y2="170"/>

    <!-- Pressure transmitter (branch up) -->
    <line x1="480" y1="170" x2="480" y2="142" stroke="var(--border-strong)" stroke-width="1.5"/>
    <circle cx="480" cy="126" r="15" fill="var(--bg-alt)" stroke="var(--border-strong)" stroke-width="1.5"/>
    <text x="480" y="130" text-anchor="middle" class="mono" style="font-size:8.5px; font-weight:700; fill:var(--text);">PT</text>
    <text x="480" y="102" text-anchor="middle" class="mono" style="font-size:10px; font-weight:700; fill:var(--accent);">${pressure} bar</text>
    <text x="480" y="207" text-anchor="middle" style="font-size:8.5px; fill:var(--text-faint);">inlet pressure</text>

    <!-- Temperature transmitter (branch down) -->
    <line x1="560" y1="170" x2="560" y2="198" stroke="var(--border-strong)" stroke-width="1.5"/>
    <circle cx="560" cy="214" r="15" fill="var(--bg-alt)" stroke="var(--border-strong)" stroke-width="1.5"/>
    <text x="560" y="218" text-anchor="middle" class="mono" style="font-size:8.5px; font-weight:700; fill:var(--text);">TT</text>
    <text x="560" y="242" text-anchor="middle" class="mono" style="font-size:10px; font-weight:700; fill:#fbbf24;">${temp}&deg;C</text>
    <text x="560" y="258" text-anchor="middle" style="font-size:8.5px; fill:var(--text-faint);">water temp</text>

    <!-- Fine-fill valve -->
    <circle class="${fineValveClass}" cx="640" cy="170" r="16" stroke-width="2"/>
    <text x="640" y="207" text-anchor="middle" style="font-size:9px">FINE-FILL VALVE</text>
    <text x="640" y="220" text-anchor="middle" class="mono" style="font-size:9.5px; font-weight:700;">${fineValveLabel}</text>

    <line class="${pipeClass}" x1="656" y1="170" x2="760" y2="170"/>

    <!-- LPR + auth badges — sit in the clear top band above the tank (not beside it),
         so they can never collide with the tank box or its plate/owner label below. -->
    <rect class="box-chip" x="${badgeX}" y="20" width="${badgeW}" height="24" rx="5" style="fill:var(--bg-alt); stroke:var(--border);"/>
    <text x="${badgeCx}" y="36" text-anchor="middle" style="font-size:9px;">
      <tspan style="fill:var(--text-dim);">LPR&nbsp;</tspan>
      <tspan style="fill:${authed ? "var(--green)" : "var(--text-faint)"}; font-weight:700;">${authed ? "PLATE OK" : "AWAITING"}</tspan>
    </text>
    <rect x="${badgeX}" y="48" width="${badgeW}" height="24" rx="5" style="fill:var(--bg-alt); stroke:var(--border);"/>
    <text x="${badgeCx}" y="64" text-anchor="middle" style="font-size:9px;">
      <tspan style="fill:var(--text-dim);">QR/PIN&nbsp;</tspan>
      <tspan style="fill:${authed ? "var(--green)" : "var(--text-faint)"}; font-weight:700;">${authed ? "VERIFIED" : "AWAITING"}</tspan>
    </text>
    <line x1="${badgeCx}" y1="44" x2="${badgeCx}" y2="48" stroke="var(--border-strong)" stroke-width="1.3"/>
    <line x1="${badgeCx}" y1="72" x2="${badgeCx}" y2="${tankY}" stroke="var(--border-strong)" stroke-width="1.3"/>

    <!-- Tanker receiving vessel -->
    <rect x="${tankX}" y="${tankY}" width="${tankW}" height="${tankH}" rx="10" fill="var(--panel-alt)" stroke="var(--border-strong)" stroke-width="1.5"/>
    <rect x="${tankX + 2}" y="${levelY}" width="${tankW - 4}" height="${levelH}" fill="url(#twinWaterGrad)" clip-path="url(#twinTankClip)" style="transition: y .5s ease, height .5s ease;"/>
    <text x="${tankX + tankW / 2}" y="${tankY + tankH / 2 - 2}" text-anchor="middle" class="mono" style="font-size:20px; font-weight:800; fill:#fff;">${pct.toFixed(0)}%</text>
    <text x="${tankX + tankW / 2}" y="${tankY + tankH / 2 + 17}" text-anchor="middle" style="font-size:9.5px; fill:rgba(255,255,255,0.9);">TANKER &middot; BAY ${pad(bay.id)}</text>
    <text x="${tankX + tankW / 2}" y="${tankY - 8}" text-anchor="middle" style="font-size:9px; fill:var(--text-faint);">${bay.plate} &middot; ${bay.owner}</text>

    <!-- Debit + receipt -->
    <line x1="${tankX + tankW}" y1="${tankY + tankH / 2}" x2="1020" y2="${tankY + tankH / 2}" stroke="var(--border-strong)" stroke-width="1.5" stroke-dasharray="3 4"/>
    <rect class="box box-green" x="1020" y="${tankY + tankH / 2 - 36}" width="150" height="72" rx="8"/>
    <text class="title" x="1095" y="${tankY + tankH / 2 - 14}" text-anchor="middle" style="fill:var(--green);">DEBIT &amp; RECEIPT</text>
    <text x="1095" y="${tankY + tankH / 2 + 6}" text-anchor="middle" class="mono" style="font-size:14px; font-weight:800; fill:var(--green);">KD ${charge}</text>
    <text x="1095" y="${tankY + tankH / 2 + 24}" text-anchor="middle" style="font-size:8.5px; fill:var(--text-faint);">SMS + email on completion</text>
  </svg>`;
  document.getElementById("twin-diagram").innerHTML = svg;
}

/* ================= CCTV ================= */
const CAMERAS = [
  { id: "CAM-01", label: "Gate Entry",  meta: "LPR · UHD", img: "assets/images/cctv/gate-entry.jpg",  tag: "PLATE OK" },
  { id: "CAM-07", label: "Bay 14 Arm",  meta: "60fps",     img: "assets/images/cctv/bay14-arm.jpg",   tag: "FILL ARM OK" },
  { id: "CAM-12", label: "Apron West",  meta: "LPR · UHD", img: "assets/images/cctv/apron-west.jpg",  tag: "AREA CLEAR" },
  { id: "CAM-19", label: "Bay 22 PTZ",  meta: "60fps",     img: "assets/images/cctv/bay22-ptz.jpg",   tag: "TANKER ID" },
  { id: "CAM-24", label: "Gate Exit",   meta: "LPR · UHD", img: "assets/images/cctv/gate-exit.jpg",   tag: "PLATE OK" },
  { id: "CAM-31", label: "Overview",    meta: "60fps",     img: "assets/images/cctv/overview.jpg",    tag: "42 BAYS OK" },
];

function wireCctv() {
  document.addEventListener("click", (e) => {
    const tile = e.target.closest(".cam-tile");
    if (tile) openCamLightbox(parseInt(tile.dataset.cam, 10));
    if (e.target.closest("[data-close-lightbox]")) closeCamLightbox();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCamLightbox(); });
}

function renderCctvGrid() {
  const grid = document.getElementById("cctv-grid");
  grid.innerHTML = CAMERAS.map((cam, i) => `
    <div class="cam-tile" data-cam="${i}" style="background-image:url('${cam.img}')">
      <div class="cam-crosshair"><span class="h"></span><span class="v"></span></div>
      <div class="cam-time" id="cam-time-${i}">--:--:--</div>
      <div class="cam-rec"><span class="dot"></span> REC</div>
      <div class="cam-overlay-box" id="cam-box-${i}" style="display:none;"></div>
      <div class="cam-overlay-tag" id="cam-tag-${i}" style="display:none;">${cam.tag}</div>
      <div class="cam-label"><span>${cam.id} ${cam.label}</span><span>${cam.meta}</span></div>
    </div>
  `).join("");
  drawCameraFrames();
}

function drawCameraFrames() {
  const now = new Date().toLocaleTimeString("en-GB", { hour12: false });
  CAMERAS.forEach((cam, i) => {
    const timeEl = document.getElementById(`cam-time-${i}`);
    if (timeEl) timeEl.textContent = now;

    const box = document.getElementById(`cam-box-${i}`);
    const tag = document.getElementById(`cam-tag-${i}`);
    if (!box || !tag) return;
    // occasionally (re)position a detection box to feel "live" without a jarring redraw every tick
    if (Math.random() > 0.35) {
      const left = 12 + Math.random() * 55;
      const top = 30 + Math.random() * 40;
      const w = 22 + Math.random() * 14;
      const h = 16 + Math.random() * 12;
      box.style.left = left + "%";
      box.style.top = top + "%";
      box.style.width = w + "%";
      box.style.height = h + "%";
      box.style.display = "block";
      tag.style.left = left + "%";
      tag.style.top = top + "%";
      tag.style.display = "block";
    } else {
      box.style.display = "none";
      tag.style.display = "none";
    }
  });
}

function openCamLightbox(i) {
  const cam = CAMERAS[i];
  if (!cam) return;
  let box = document.getElementById("cam-lightbox");
  if (!box) {
    box = document.createElement("div");
    box.id = "cam-lightbox";
    box.className = "cam-lightbox";
    document.body.appendChild(box);
  }
  box.innerHTML = `
    <div class="cam-lightbox-inner">
      <div class="cam-lightbox-frame" style="background-image:url('${cam.img}')">
        <div class="cam-crosshair"><span class="h"></span><span class="v"></span></div>
        <div class="cam-time">${new Date().toLocaleTimeString("en-GB", { hour12: false })}</div>
        <div class="cam-rec"><span class="dot"></span> REC</div>
        <div class="cam-label"><span>${cam.id} ${cam.label}</span><span>${cam.meta}</span></div>
      </div>
      <div class="cam-lightbox-bar">
        <div class="util-text">Live feed &middot; Al Dhaher &rarr; Salmiya Control Centre &middot; 60-day NVR retention</div>
        <div class="cam-lightbox-close" data-close-lightbox>Close (Esc)</div>
      </div>
    </div>`;
  box.onclick = (e) => { if (e.target === box) closeCamLightbox(); };
}

function closeCamLightbox() {
  const box = document.getElementById("cam-lightbox");
  if (box) box.remove();
}

function renderLprLog() {
  document.getElementById("lpr-log").innerHTML = state.lprLog.slice(0, 8).map(r => `
    <tr>
      <td class="mono">${r.time}</td>
      <td class="mono">${r.plate}</td>
      <td>${r.owner}</td>
      <td>${r.gate}</td>
      <td>${r.status.startsWith("Matched") ? `<span class="tag green">${r.status}</span>` :
            r.status.startsWith("Filled") ? `<span class="tag blue">${r.status}</span>` :
            `<span class="tag amber">${r.status}</span>`}</td>
    </tr>
  `).join("");
}

function renderVideoEvents() {
  const sevClass = { crit: "crit", warn: "warn", info: "info" };
  document.getElementById("video-events").innerHTML = state.videoEvents.slice(0, 6).map(e => `
    <div class="alarm-item">
      <div class="alarm-dot ${sevClass[e.sev]}"></div>
      <div>
        <div class="alarm-text">${e.text}</div>
        <div class="alarm-time">${e.tag} &middot; ${timeAgo(e.ts)}</div>
      </div>
    </div>
  `).join("");
}

/* ================= BILLING ================= */
function wireBilling() {}

function renderLedger() {
  document.getElementById("ledger-log").innerHTML = state.ledger.slice(0, 9).map(r => `
    <tr>
      <td class="mono">${r.time}</td>
      <td class="mono">${r.account}</td>
      <td>${r.type}</td>
      <td class="mono">${r.volume}</td>
      <td class="mono" style="color:${r.amount.startsWith('+') ? 'var(--green)' : 'var(--text)'}">${r.amount}</td>
      <td>${r.channel}</td>
      <td>${r.status === "Cleared" || r.status === "Posted" ? `<span class="tag green">${r.status}</span>` : `<span class="tag amber">${r.status}</span>`}</td>
    </tr>
  `).join("");
}

function renderMewActivity() {
  document.getElementById("mew-activity").innerHTML = state.mewActivity.map(a => `
    <div class="metric-line">
      <span class="k">${a.label}</span>
      <span class="v" style="color:${a.delta.startsWith('+') ? 'var(--green)' : 'var(--text)'}">${a.delta}</span>
    </div>
  `).join("");
}

/* ================= REPORTS ================= */
function wireReports() {
  document.querySelectorAll(".report-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".report-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentReportPeriod = tab.dataset.period;
      renderReportTable();
      renderReportChart();
    });
  });

  document.getElementById("btn-export-csv")?.addEventListener("click", exportReportCsv);
  document.getElementById("btn-export-pdf")?.addEventListener("click", () => window.print());
  document.getElementById("btn-schedule-report")?.addEventListener("click", openScheduleModal);
  document.getElementById("schedule-modal-cancel")?.addEventListener("click", closeScheduleModal);
  document.getElementById("schedule-modal-save")?.addEventListener("click", saveScheduleReport);
  document.getElementById("schedule-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "schedule-modal") closeScheduleModal();
  });

  renderScheduledReports();
}

/* ---- WP-D: real CSV export for the active report period ---- */
function exportReportCsv() {
  const r = state.reports[currentReportPeriod];
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [r.cols.map(esc).join(",")].concat(r.rows.map(row => row.map(esc).join(",")));
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `siap-report-${currentReportPeriod}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---- WP-D: Schedule Report modal + localStorage-persisted list ---- */
function openScheduleModal() {
  const modal = document.getElementById("schedule-modal");
  if (!modal) return;
  const periodSelect = document.getElementById("schedule-period");
  if (periodSelect) periodSelect.value = currentReportPeriod;
  modal.hidden = false;
}
function closeScheduleModal() {
  const modal = document.getElementById("schedule-modal");
  if (modal) modal.hidden = true;
}
function loadReportSchedules() {
  try { return JSON.parse(localStorage.getItem("siap.reports.schedules") || "[]"); } catch (e) { return []; }
}
function saveReportSchedules(list) {
  localStorage.setItem("siap.reports.schedules", JSON.stringify(list));
}
function saveScheduleReport() {
  const period = document.getElementById("schedule-period")?.value || currentReportPeriod;
  const time = document.getElementById("schedule-time")?.value || "07:00";
  const emailsInput = document.getElementById("schedule-emails")?.value.trim();
  const emails = emailsInput || "ops@mew.gov.kw";
  const list = loadReportSchedules();
  list.unshift({ period, time, emails, createdAt: Date.now() });
  saveReportSchedules(list);
  renderScheduledReports();
  closeScheduleModal();
}
function renderScheduledReports() {
  const el = document.getElementById("scheduled-reports-list");
  if (!el) return;
  const list = loadReportSchedules();
  if (!list.length) { el.innerHTML = `<div class="util-text">No scheduled reports yet &mdash; click "Schedule Report" to add one.</div>`; return; }
  const periodLabel = { shift: "Shift-wise", day: "Day-wise", month: "Month-wise" };
  el.innerHTML = list.map((s, i) => `
    <div class="scheduled-row">
      <div><b style="color:var(--text)">${periodLabel[s.period] || s.period}</b> &middot; daily ${s.time} &middot; ${s.emails}</div>
      <button class="ack-btn" data-remove-schedule="${i}">Remove</button>
    </div>`).join("");
  el.querySelectorAll("[data-remove-schedule]").forEach(btn => {
    btn.addEventListener("click", () => {
      const list2 = loadReportSchedules();
      list2.splice(parseInt(btn.dataset.removeSchedule, 10), 1);
      saveReportSchedules(list2);
      renderScheduledReports();
    });
  });
}

function renderReportTable() {
  const r = state.reports[currentReportPeriod];
  document.getElementById("report-thead").innerHTML = `<tr>${r.cols.map(c => `<th>${c}</th>`).join("")}</tr>`;
  document.getElementById("report-tbody").innerHTML = r.rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join("")}</tr>`).join("");
}

function renderReportChart() {
  const r = state.reports[currentReportPeriod];
  if (reportChart) reportChart.destroy();
  reportChart = new Chart(document.getElementById("report-chart"), {
    type: "bar",
    data: {
      labels: r.chartLabels,
      datasets: [{
        label: "Volume",
        data: r.chartData,
        backgroundColor: (c) => {
          const { chart } = c;
          if (!chart.chartArea) return "rgba(34,211,238,0.55)";
          return verticalGradient(chart.ctx, chart.chartArea, "rgba(34,211,238,0.75)", "rgba(34,211,238,0.12)");
        },
        hoverBackgroundColor: "rgba(34,211,238,0.9)",
        borderRadius: 5,
        borderSkipped: false,
        barPercentage: 0.55,
      }],
    },
    options: chartBaseOptions(false),
  });
}

/* ================= S!A CHAT (page view + floating panel share the same logic) ================= */
function wireSia() {
  wireChatSurface("chat-window", "chat-input", "chat-send");
  document.querySelectorAll("#view-sia .suggest-chip").forEach(chip => {
    chip.addEventListener("click", () => askInSurface("chat-window", "chat-input", chip.dataset.q));
  });
  pushChat("chat-window", "bot", "Ask S!a about operations, revenue, assets or security across Al Dhaher — I'll answer in plain language with the sources behind it.");

  wireChatSurface("ai-panel-window", "ai-panel-input", "ai-panel-send");
  document.querySelectorAll("#ai-panel-chips .suggest-chip").forEach(chip => {
    chip.addEventListener("click", () => askInSurface("ai-panel-window", "ai-panel-input", chip.dataset.q));
  });
  pushChat("ai-panel-window", "bot", "Hi — I'm S!a. Ask me about bay performance, revenue, forecasts or security across Al Dhaher.");

  wireAiFab();
}

function wireChatSurface(windowId, inputId, sendId) {
  const send = () => askInSurface(windowId, inputId, document.getElementById(inputId).value.trim());
  document.getElementById(sendId).addEventListener("click", send);
  document.getElementById(inputId).addEventListener("keydown", e => { if (e.key === "Enter") send(); });
}

function askInSurface(windowId, inputId, text) {
  if (!text) return;
  pushChat(windowId, "user", text);
  const input = document.getElementById(inputId);
  if (input) input.value = "";
  setTimeout(() => {
    const answer = state.siaResponses[text.toLowerCase()] ||
      "S!a is analyzing across S!aP Datalake (42 bays, CCTV analytics, K-net settlement) — here's a summary answer for the demo. In production this is generated live from the historian with a confidence score and source trace.";
    pushChat(windowId, "bot", answer);
  }, 500);
}

function pushChat(windowId, who, text) {
  const win = document.getElementById(windowId);
  if (!win) return;
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${who}`;
  bubble.innerHTML = text.replace(/\n/g, "<br>");
  win.appendChild(bubble);
  win.scrollTop = win.scrollHeight;
}

function wireAiFab() {
  const fab = document.getElementById("ai-fab");
  const panel = document.getElementById("ai-panel");
  const close = document.getElementById("ai-panel-close");
  const openPanel = () => {
    panel.classList.add("open");
    fab.classList.add("open");
    fab.innerHTML = '<i data-lucide="x"></i>';
    lucide.createIcons();
    document.getElementById("ai-panel-input").focus();
  };
  const closePanel = () => {
    panel.classList.remove("open");
    fab.classList.remove("open");
    fab.innerHTML = '<i data-lucide="sparkles"></i>';
    lucide.createIcons();
  };
  fab.addEventListener("click", () => panel.classList.contains("open") ? closePanel() : openPanel());
  close.addEventListener("click", closePanel);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && panel.classList.contains("open")) closePanel(); });
}

/* ================= SIMULATION TICK ================= */
function simulateTick() {
  // advance a couple of random filling bays
  state.bays.forEach(b => {
    if (b.status === "filling") {
      b.dispensed = Math.min(b.target, b.dispensed + Math.round(b.flow * 8));
      b.flow = +(Math.max(15, b.flow + (Math.random() - 0.5) * 4)).toFixed(1);
      if (b.dispensed >= b.target) { b.status = "done"; b.flow = 0; }
    }
  });

  // occasionally flip an idle bay to filling, or done back to idle (bay cycle)
  if (Math.random() > 0.6) {
    const idles = state.bays.filter(b => b.status === "idle");
    if (idles.length) {
      const b = idles[Math.floor(Math.random() * idles.length)];
      b.status = "filling";
      b.flow = +(28 + Math.random() * 22).toFixed(1);
      b.dispensed = 0;
      b.owner = OWNERS[Math.floor(Math.random() * OWNERS.length)];
      b.account = randAccount();
      b.plate = randPlate();
    }
  }
  if (Math.random() > 0.75) {
    const dones = state.bays.filter(b => b.status === "done");
    if (dones.length) dones[Math.floor(Math.random() * dones.length)].status = "idle";
  }
  // maintenance occasionally clears a faulted bay back into service
  if (Math.random() > 0.88) {
    const faults = state.bays.filter(b => b.status === "fault");
    if (faults.length) faults[Math.floor(Math.random() * faults.length)].status = "idle";
  }

  state.kpis.activeBays = state.bays.filter(b => b.status === "filling").length;
  state.kpis.inletFlow = Math.max(400, Math.min(950, state.kpis.inletFlow + Math.round((Math.random() - 0.5) * 30)));
  state.kpis.revenueToday += Math.random() * 12;
  state.kpis.tankersServed += Math.random() > 0.7 ? 1 : 0;
  state.kpis.volumeToday += Math.random() * 0.0008;

  document.getElementById("kpi-active").innerHTML = `${state.kpis.activeBays}<span class="kpi-unit">/42</span>`;
  document.getElementById("kpi-revenue").textContent = `KD ${Math.round(state.kpis.revenueToday).toLocaleString()}`;
  document.getElementById("kpi-tankers").textContent = state.kpis.tankersServed.toLocaleString();
  document.getElementById("kpi-volume").innerHTML = `${state.kpis.volumeToday.toFixed(2)}<span class="kpi-unit">M Imp.gal</span>`;

  renderBayGrid();
  renderGauge();
  drawCameraFrames();

  // occasional WAN link flap / DR sync lag for realism — suppressed while a demo outage is forced
  if (!wanForced) {
    if (Math.random() > 0.93) {
      state.kpis.wanLinkA = state.kpis.wanLinkA === "up" ? "degraded" : "up";
    }
    if (Math.random() > 0.9) {
      if (state.kpis.drSync === "synced") { state.kpis.drSync = "syncing"; state.kpis.drLagSec = Math.ceil(Math.random() * 4); }
      else { state.kpis.drSync = "synced"; state.kpis.drLagSec = 0; }
    }
  } else {
    // WP-D: bays keep filling on last-known balance; each tick buffers one more
    // transaction locally (store-and-forward) until the link is restored.
    wanBufferedCount++;
    const row = genLedgerRow();
    row.status = "Buffered";
    state.ledger.unshift(row);
    state.ledger.pop();
    if (document.getElementById("view-billing").classList.contains("active")) renderLedger();
    renderAlarmBanner();
  }
  updateArchLiveBadges();

  if (document.getElementById("view-dashboard").classList.contains("active")) {
    renderMimicDiagram();
  }

  // occasionally raise a new alarm sourced from a faulted bay
  if (Math.random() > 0.85) {
    const faulted = state.bays.filter(b => b.status === "fault");
    if (faulted.length) {
      const b = faulted[Math.floor(Math.random() * faulted.length)];
      state.alarms.unshift({
        id: state.nextAlarmId++,
        sev: Math.random() > 0.6 ? "crit" : "warn",
        text: `Bay ${pad(b.id)} — valve fault, custody metering suspended`,
        ts: Date.now(),
        ack: false,
      });
      state.alarms = state.alarms.slice(0, 12);
      renderAlarmBanner();
      updateOpenAlarmsKpi();
    }
  }

  // keep "Xm ago" labels honest even when nothing else changed on this tick
  if (document.getElementById("view-dashboard").classList.contains("active")) {
    renderAlarms();
  }

  // if currently viewed bay updated, refresh control panel
  if (document.getElementById("view-baycontrol").classList.contains("active")) {
    renderFlowTrack();
    renderBayControlPanel();
    renderBaySelect();
  }
  if (document.getElementById("view-twin").classList.contains("active")) {
    renderTwinBaySelect();
    renderBayTwinDiagram(selectedBayId);
  }
  if (document.getElementById("view-billing").classList.contains("active") && Math.random() > 0.5) {
    state.ledger.unshift(genLedgerRow());
    state.ledger.pop();
    renderLedger();
  }
  if (document.getElementById("view-cctv").classList.contains("active")) {
    renderVideoEvents();
    if (Math.random() > 0.6) {
      state.lprLog.unshift(genLprRow());
      state.lprLog.pop();
      renderLprLog();
    }
    if (Math.random() > 0.75) {
      state.videoEvents.unshift(genVideoEvent());
      state.videoEvents = state.videoEvents.slice(0, 8);
      renderVideoEvents();
    }
  }
  // module screens registered via SIAP.registerView
  const active = SIAP.activeView();
  if (active && viewHooks[active] && viewHooks[active].onTick) viewHooks[active].onTick(state);
  SIAP.emit("tick", state);
  lucide.createIcons();
}
