/* ==========================================================
   S!aP — MEW Al Dhaher Water Filling Station — Demo App Logic
   ========================================================== */

let selectedBayId = 14;
let hourlyChart, gaugeChart, reportChart;
let currentReportPeriod = "shift";

document.addEventListener("DOMContentLoaded", () => {
  wireNav();
  wireBayControl();
  wireCctv();
  wireBilling();
  wireReports();
  wireSia();

  renderBayGrid();
  renderAlarms();
  renderHourlyChart();
  renderGauge();
  renderBaySelect();
  renderFlowTrack();
  renderBayControlPanel();
  renderCctvGrid();
  renderLprLog();
  renderVideoEvents();
  renderLedger();
  renderMewActivity();
  renderReportTable();
  renderReportChart();

  lucide.createIcons();
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(simulateTick, 2200);
});

/* ================= NAVIGATION ================= */
function wireNav() {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
      item.classList.add("active");
      const view = item.dataset.view;
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      document.getElementById(`view-${view}`).classList.add("active");

      const titles = {
        dashboard: ["Command Dashboard", "Al Dhaher Lorry Filling Station · 42 Bays"],
        baycontrol: ["Filling Bay Control", "Live transaction sequence · custody-grade metering"],
        cctv: ["CCTV & LPR Wall", "IP video surveillance · Al Dhaher → Salmiya Control Centre"],
        billing: ["Billing & MEW Pay", "Prepaid wallet · K-net settlement · customer app"],
        reports: ["Reporting", "Shift, Day & Month · central historian"],
        sia: ["S!a — Ask it. Act on it.", "Conversational agentic AI · Glass Box explainable"],
      };
      document.getElementById("view-title").textContent = titles[view][0];
      document.getElementById("view-sub").textContent = titles[view][1];
      lucide.createIcons();
    });
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
    <div class="bay-tile ${b.status}" data-bay="${b.id}">
      <div class="bay-id">BAY ${pad(b.id)}</div>
      <div class="bay-status"><span class="bay-dot"></span>${statusLabel(b.status)}</div>
    </div>
  `).join("");

  grid.querySelectorAll(".bay-tile").forEach(tile => {
    tile.addEventListener("click", () => {
      selectedBayId = parseInt(tile.dataset.bay, 10);
      document.querySelector('.nav-item[data-view="baycontrol"]').click();
      renderBaySelect();
      renderFlowTrack();
      renderBayControlPanel();
    });
  });
}

function statusLabel(s) {
  return { idle: "Idle", filling: "Filling", done: "Done", fault: "Fault", offline: "Offline" }[s];
}

function renderAlarms() {
  const sevClass = { crit: "crit", warn: "warn", amber2: "warn", info: "info" };
  document.getElementById("alarm-list").innerHTML = state.alarms.slice(0, 6).map(a => `
    <div class="alarm-item">
      <div class="alarm-dot ${sevClass[a.sev]}"></div>
      <div>
        <div class="alarm-text">${a.text}</div>
        <div class="alarm-time">${a.time} ago</div>
      </div>
    </div>
  `).join("");
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
          backgroundColor: "rgba(34,211,238,0.55)",
          borderRadius: 4,
          yAxisID: "y",
          order: 2,
        },
        {
          type: "line",
          label: "Revenue (KD)",
          data: state.hourly.revenue,
          borderColor: "#34d399",
          backgroundColor: "rgba(52,211,153,0.15)",
          tension: 0.35,
          yAxisID: "y1",
          pointRadius: 2,
          order: 1,
        },
      ],
    },
    options: chartBaseOptions(true),
  });
}

function chartBaseOptions(dualAxis) {
  const grid = { color: "rgba(148,178,216,0.08)" };
  const ticks = { color: "#8fa3c2", font: { size: 10.5 } };
  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { labels: { color: "#8fa3c2", boxWidth: 10, font: { size: 10.5 } } },
      tooltip: { backgroundColor: "#0d1a30", borderColor: "rgba(148,178,216,0.2)", borderWidth: 1 },
    },
    scales: {
      x: { grid: { display: false }, ticks },
      y: { grid, ticks, title: dualAxis ? { display: true, text: "Volume", color: "#8fa3c2", font: { size: 10 } } : undefined },
    },
  };
  if (dualAxis) {
    opts.scales.y1 = { position: "right", grid: { display: false }, ticks, title: { display: true, text: "Revenue", color: "#8fa3c2", font: { size: 10 } } };
  }
  return opts;
}

const GAUGE_MAX = 1000;

function renderGauge() {
  const val = state.kpis.inletFlow;
  if (!gaugeChart) {
    gaugeChart = new Chart(document.getElementById("gauge-chart"), {
      type: "doughnut",
      data: {
        datasets: [{
          data: [val, GAUGE_MAX - val],
          backgroundColor: ["#22d3ee", "rgba(255,255,255,0.06)"],
          borderWidth: 0,
        }],
      },
      options: {
        circumference: 180,
        rotation: 270,
        cutout: "75%",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      },
    });
  } else {
    gaugeChart.data.datasets[0].data = [val, GAUGE_MAX - val];
    gaugeChart.update();
  }
  document.getElementById("gauge-value").textContent = val;
  document.getElementById("gauge-pressure").textContent = state.kpis.inletPressure.toFixed(1) + " bar";
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
}

function renderBaySelect() {
  const sel = document.getElementById("bay-select");
  sel.innerHTML = state.bays.map(b => `<option value="${b.id}" ${b.id === selectedBayId ? "selected" : ""}>Bay ${pad(b.id)} — ${statusLabel(b.status)}</option>`).join("");
  sel.onchange = () => {
    selectedBayId = parseInt(sel.value, 10);
    renderFlowTrack();
    renderBayControlPanel();
  };
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

function renderBayControlPanel() {
  const bay = state.bays.find(b => b.id === selectedBayId);
  document.getElementById("bc-heading").innerHTML = `Bay ${pad(bay.id)} &mdash; Live Transaction`;
  document.getElementById("bc-volume").innerHTML = `${bay.dispensed.toLocaleString()}<span style="font-size:16px;color:var(--text-dim);font-weight:600;"> / <span id="bc-target">${bay.target.toLocaleString()}</span> Imp.gal</span>`;
  const pct = Math.min(100, (bay.dispensed / bay.target) * 100);
  document.getElementById("bc-progress").style.width = pct.toFixed(0) + "%";
  document.getElementById("bc-flow").textContent = (bay.status === "filling" ? bay.flow : 0) + " m³/h";
  document.getElementById("bc-valve").textContent = bay.status === "filling" ? "Open · modulating" : bay.status === "done" ? "Closed · complete" : bay.status === "fault" ? "Fault · locked" : "Closed";
  const remaining = bay.target - bay.dispensed;
  const etaMin = bay.flow > 0 ? Math.max(0, (remaining / 1000) / (bay.flow / 60)) : 0;
  document.getElementById("bc-eta").textContent = bay.status === "filling" ? `${Math.floor(etaMin)}m ${Math.floor((etaMin % 1) * 60)}s` : "—";
  document.getElementById("bc-owner").textContent = bay.owner;
  document.getElementById("bc-account").textContent = bay.account;
  document.getElementById("bc-plate").textContent = bay.plate;
  const rate = 0.0025; // KD per unit, arbitrary demo rate
  const charge = (bay.dispensed * rate).toFixed(3);
  document.getElementById("bc-charge").textContent = `KD ${charge}`;
  document.getElementById("bc-balance").textContent = `KD ${(148.5 - charge).toFixed(3)}`;
  const now = new Date();
  document.getElementById("bc-datetime").textContent = `${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  document.getElementById("btn-start-fill").disabled = bay.status === "filling";
  document.getElementById("btn-stop-fill").disabled = bay.status !== "filling";
}

/* ================= CCTV ================= */
const camCanvases = [];
function wireCctv() {}

function renderCctvGrid() {
  const grid = document.getElementById("cctv-grid");
  const labels = [
    "CAM-01 Gate Entry", "CAM-07 Bay 14 Arm", "CAM-12 Apron West",
    "CAM-19 Bay 22 PTZ", "CAM-24 Gate Exit", "CAM-31 Overview",
  ];
  grid.innerHTML = labels.map((label, i) => `
    <div class="cam-tile">
      <canvas id="cam-canvas-${i}" width="320" height="200"></canvas>
      <div class="cam-rec"><span class="dot"></span> REC</div>
      <div class="cam-label"><span>${label}</span><span>${i % 2 === 0 ? "LPR · UHD" : "60fps"}</span></div>
    </div>
  `).join("");
  labels.forEach((_, i) => {
    camCanvases.push(document.getElementById(`cam-canvas-${i}`).getContext("2d"));
  });
  drawCameraFrames();
}

function drawCameraFrames() {
  camCanvases.forEach((ctx, i) => {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.fillStyle = "#050c17";
    ctx.fillRect(0, 0, w, h);
    // faint scanline grid
    ctx.strokeStyle = "rgba(34,211,238,0.06)";
    for (let y = 0; y < h; y += 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    // simulated "road/apron" horizon
    ctx.fillStyle = "rgba(148,178,216,0.05)";
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
    // moving blob = tanker silhouette
    const t = Date.now() / 1000 + i * 3;
    const x = ((Math.sin(t * 0.5) + 1) / 2) * (w - 90) + 10;
    ctx.fillStyle = "rgba(148,178,216,0.35)";
    ctx.fillRect(x, h * 0.58, 80, 30);
    ctx.fillRect(x + 8, h * 0.5, 26, 14);
    // detection box occasionally
    if (Math.sin(t) > 0.3) {
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 4, h * 0.48, 90, 44);
      ctx.fillStyle = "#22d3ee";
      ctx.font = "9px sans-serif";
      ctx.fillText("PLATE OK", x - 4, h * 0.48 - 4);
    }
    // timestamp
    ctx.fillStyle = "rgba(207,228,255,0.55)";
    ctx.font = "9px monospace";
    ctx.fillText(new Date().toLocaleTimeString("en-GB", { hour12: false }), 6, 14);
  });
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
  document.getElementById("video-events").innerHTML = state.videoEvents.map(e => `
    <div class="alarm-item">
      <div class="alarm-dot ${sevClass[e.sev]}"></div>
      <div>
        <div class="alarm-text">${e.text}</div>
        <div class="alarm-time">${e.tag} &middot; ${e.time} ago</div>
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
        backgroundColor: "rgba(34,211,238,0.55)",
        borderRadius: 4,
      }],
    },
    options: chartBaseOptions(false),
  });
}

/* ================= S!A CHAT ================= */
function wireSia() {
  const send = () => {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;
    pushChat("user", text);
    input.value = "";
    setTimeout(() => {
      const answer = state.siaResponses[text.toLowerCase()] ||
        "S!a is analyzing across S!aP Datalake (42 bays, CCTV analytics, K-net settlement) — here's a summary answer for the demo. In production this is generated live from the historian with a confidence score and source trace.";
      pushChat("bot", answer);
    }, 500);
  };
  document.getElementById("chat-send").addEventListener("click", send);
  document.getElementById("chat-input").addEventListener("keydown", e => { if (e.key === "Enter") send(); });
  document.querySelectorAll(".suggest-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.getElementById("chat-input").value = chip.dataset.q;
      send();
    });
  });
  pushChat("bot", "Ask S!a about operations, revenue, assets or security across Al Dhaher — I'll answer in plain language with the sources behind it.");
}

function pushChat(who, text) {
  const win = document.getElementById("chat-window");
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${who}`;
  bubble.innerHTML = text.replace(/\n/g, "<br>");
  win.appendChild(bubble);
  win.scrollTop = win.scrollHeight;
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

  state.kpis.activeBays = state.bays.filter(b => b.status === "filling").length;
  state.kpis.inletFlow = Math.max(400, Math.min(950, state.kpis.inletFlow + Math.round((Math.random() - 0.5) * 30)));
  state.kpis.revenueToday += Math.random() * 12;
  state.kpis.tankersServed += Math.random() > 0.7 ? 1 : 0;

  document.getElementById("kpi-active").innerHTML = `${state.kpis.activeBays}<span class="kpi-unit">/42</span>`;
  document.getElementById("kpi-revenue").textContent = `KD ${Math.round(state.kpis.revenueToday).toLocaleString()}`;
  document.getElementById("kpi-tankers").textContent = state.kpis.tankersServed.toLocaleString();

  renderBayGrid();
  renderGauge();
  drawCameraFrames();

  // if currently viewed bay updated, refresh control panel
  if (document.getElementById("view-baycontrol").classList.contains("active")) {
    renderFlowTrack();
    renderBayControlPanel();
    renderBaySelect();
  }
  if (document.getElementById("view-billing").classList.contains("active") && Math.random() > 0.5) {
    state.ledger.unshift(genLedgerRow());
    state.ledger.pop();
    renderLedger();
  }
  if (document.getElementById("view-cctv").classList.contains("active") && Math.random() > 0.6) {
    state.lprLog.unshift(genLprRow());
    state.lprLog.pop();
    renderLprLog();
  }
  lucide.createIcons();
}
