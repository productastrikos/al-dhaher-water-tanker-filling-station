/* ==========================================================
   S!aP — WP-C: Tanker Loading HMI (Siemens PCS 7 style faceplate)
   Owns: this file (hmi.js) + hmi.css. Reads SIAP.state, mutates bays
   ONLY through SIAP.startFill / SIAP.stopFill (platform is read-only
   towards the field — see IMPLEMENTATION_PLAN.md §1.1 / §5.3).
   ========================================================== */
(function () {
  "use strict";

  /* ---------- local module state (per-bay, kept in this file only) ---------- */
  const hmi = {
    mode: {},            // bayId -> "AUTO" | "MANUAL"
    batchHistory: {},    // bayId -> [{batchNo, preset, delivered, remaining, flow, account, ok}, ...] newest first, max 3
    batchSeq: {},        // bayId -> next batch sequence number
    displayDispensed: {},// bayId -> smoothed/interpolated dispensed value used for the mimic fill level
    flowHistory: {},     // bayId -> [60 floats] rolling flow trend
    classic: false,      // PCS 7 grey theme toggle
    visible: false,
    interpTimer: null,
    unsubTick: null,
    unsubBaySelect: null,
    chart: null,
  };

  const TREND_POINTS = 60;

  function pad5(n) { return Math.max(0, Math.round(n)).toString().padStart(5, "0"); }

  function batchNoFor(bayId, seq) {
    return `B-${SIAP.pad(bayId)}-${seq.toString().padStart(4, "0")}`;
  }

  /** Lazily seed 2 "already completed" batches per bay so the table never looks empty
   *  the first time a bay is opened, then batches accumulate live from fill:start/fill:stop. */
  function ensureHistory(bay) {
    if (hmi.batchHistory[bay.id]) return;
    let seed = 0;
    for (const ch of String(bay.account || bay.id)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const baseSeq = 100 + (seed % 800);
    hmi.batchSeq[bay.id] = baseSeq + 2;
    const rows = [];
    for (let i = 0; i < 2; i++) {
      const preset = 3000 + ((seed >> (i + 1)) % 5) * 1000;
      rows.push({
        batchNo: batchNoFor(bay.id, baseSeq + i),
        preset,
        delivered: preset,
        remaining: 0,
        flow: 0,
        account: bay.account,
        ok: true,
      });
    }
    hmi.batchHistory[bay.id] = rows.reverse(); // newest of the two seeded rows first
  }

  function pushCompletedBatch(bay, ok) {
    ensureHistory(bay);
    const seq = hmi.batchSeq[bay.id]++;
    const rec = {
      batchNo: batchNoFor(bay.id, seq),
      preset: bay.target,
      delivered: bay.dispensed,
      remaining: Math.max(0, bay.target - bay.dispensed),
      flow: 0,
      account: bay.account,
      ok,
    };
    const hist = hmi.batchHistory[bay.id];
    hist.unshift(rec);
    hist.length = Math.min(hist.length, 3);
  }

  function flowHist(bayId) {
    if (!hmi.flowHistory[bayId]) hmi.flowHistory[bayId] = new Array(TREND_POINTS).fill(0);
    return hmi.flowHistory[bayId];
  }

  function pushFlowSample(bayId, v) {
    const h = flowHist(bayId);
    h.push(v);
    if (h.length > TREND_POINTS) h.shift();
  }

  function currentBay() {
    return SIAP.state.bays.find((b) => b.id === SIAP.selectedBayId);
  }

  function modeFor(bayId) {
    return hmi.mode[bayId] || "AUTO";
  }

  /* ================= HTML shell ================= */
  const HTML = `
    <div class="hmi-root" id="hmi-root">

      <div class="hmi-topstrip">
        <div class="hmi-topstrip-left">
          <label class="hmi-field-label">Bay</label>
          <select class="select" id="hmi-bay-select"></select>
          <span class="hmi-tag" id="hmi-tag">LFS-BAY-14</span>
        </div>
        <div class="hmi-topstrip-mid">
          <div class="hmi-mode-lamp" id="hmi-mode-lamp"><span class="hmi-lamp-dot" id="hmi-mode-dot"></span><span id="hmi-mode-text">AUTO</span></div>
          <div class="hmi-alarm-line" id="hmi-alarm-line">No active alarms for this bay</div>
        </div>
        <div class="hmi-topstrip-right">
          <div class="hmi-classic-toggle">
            <span>PCS 7 classic</span>
            <label class="hmi-switch">
              <input type="checkbox" id="hmi-classic-check" />
              <span class="hmi-switch-track"><span class="hmi-switch-thumb"></span></span>
            </label>
          </div>
          <div class="hmi-datetime" id="hmi-datetime">23-Jul 08:41:02</div>
        </div>
      </div>

      <div class="hmi-body">
        <div class="hmi-col-left">
          <div class="hmi-panel">
            <div class="hmi-panel-title">Batch Record</div>
            <div class="hmi-table-wrap">
              <table class="hmi-batch-table" id="hmi-batch-table"></table>
            </div>
          </div>
          <div class="hmi-panel hmi-totaliser-panel">
            <div class="hmi-totaliser-block">
              <div class="hmi-totaliser-label">DELIVERED (IG)</div>
              <div class="hmi-totaliser-digits" id="hmi-delivered-digits">03420</div>
            </div>
            <div class="hmi-totaliser-block hmi-totaliser-block-sm">
              <div class="hmi-totaliser-label">REMAINING (IG)</div>
              <div class="hmi-totaliser-digits hmi-totaliser-digits-sm" id="hmi-remaining-digits">01580</div>
            </div>
          </div>
        </div>

        <div class="hmi-col-mid">
          <div class="hmi-panel hmi-mimic-panel">
            <div id="hmi-mimic-svg"></div>
          </div>
        </div>

        <div class="hmi-col-right">
          <div class="hmi-panel hmi-controls-panel">
            <div class="hmi-panel-title">Commands</div>
            <div class="hmi-btn-grid">
              <button class="hmi-btn" id="hmi-btn-manual">MANUAL</button>
              <button class="hmi-btn hmi-btn-active" id="hmi-btn-auto">AUTO</button>
              <button class="hmi-btn hmi-btn-green" id="hmi-btn-start">START</button>
              <button class="hmi-btn hmi-btn-red" id="hmi-btn-stop">STOP</button>
              <button class="hmi-btn" id="hmi-btn-reset">RESET</button>
            </div>
          </div>
          <div class="hmi-panel hmi-lamps-panel">
            <div class="hmi-panel-title">Interlocks</div>
            <div class="hmi-lamp-row" data-lamp="earth"><span class="hmi-lamp-dot"></span>Earth clamp</div>
            <div class="hmi-lamp-row" data-lamp="hatch"><span class="hmi-lamp-dot"></span>Hatch open</div>
            <div class="hmi-lamp-row" data-lamp="overfill"><span class="hmi-lamp-dot"></span>Overfill probe</div>
            <div class="hmi-lamp-row" data-lamp="estop"><span class="hmi-lamp-dot"></span>Emergency stop</div>
            <div class="hmi-lamp-row" data-lamp="rtu"><span class="hmi-lamp-dot"></span>RTU comms</div>
          </div>
        </div>
      </div>

      <div class="hmi-panel hmi-trend-panel">
        <div class="hmi-panel-title">Flow Trend <span class="hint">FT-14 &middot; last ~2 min</span></div>
        <div class="hmi-trend-wrap"><canvas id="hmi-trend-chart"></canvas></div>
      </div>

      <div class="util-text hmi-util-text">Commands are S!aP BPM authorisations relayed to the RTU &mdash; the platform is read-only towards the control loop.</div>
    </div>
  `;

  SIAP.registerView({
    id: "hmi",
    group: "operations",
    icon: "monitor",
    title: "Tanker Loading HMI",
    sub: "Bay faceplate · PCS 7 style · read-only mirror of the RTU",
    html: HTML,

    onMount(section) {
      wireControls(section);
      renderBaySelect();
      renderAll();
    },

    onShow() {
      hmi.visible = true;
      renderBaySelect();
      renderAll();
      buildChart();
      startInterpolation();
      // NOTE: tick-driven refresh comes from the onTick hook below, which the core app
      // calls directly only while this view is active — do not also bind SIAP.on("tick",...)
      // here, or every tick would fire twice while visible.
      hmi.unsubBaySelect = SIAP.on("bay:select", () => { renderBaySelect(); renderAll(); resetChartForBay(); });
    },

    onHide() {
      hmi.visible = false;
      stopInterpolation();
      if (hmi.unsubBaySelect) { hmi.unsubBaySelect(); hmi.unsubBaySelect = null; }
    },

    onTick() {
      onTick();
    },
  });

  /* ================= wiring ================= */
  function wireControls(section) {
    const sel = section.querySelector("#hmi-bay-select");
    sel.addEventListener("change", () => SIAP.selectBay(parseInt(sel.value, 10)));

    section.querySelector("#hmi-classic-check").addEventListener("change", (e) => {
      hmi.classic = e.target.checked;
      section.querySelector("#hmi-root").classList.toggle("hmi-classic", hmi.classic);
    });

    section.querySelector("#hmi-btn-manual").addEventListener("click", () => setMode("MANUAL"));
    section.querySelector("#hmi-btn-auto").addEventListener("click", () => setMode("AUTO"));

    section.querySelector("#hmi-btn-start").addEventListener("click", () => {
      const bay = currentBay();
      if (!bay || bay.status === "filling") return;
      SIAP.startFill(bay.id);
    });
    section.querySelector("#hmi-btn-stop").addEventListener("click", () => {
      const bay = currentBay();
      if (!bay) return;
      SIAP.stopFill(bay.id, "idle");
    });
    section.querySelector("#hmi-btn-reset").addEventListener("click", () => {
      const bay = currentBay();
      if (!bay) return;
      if (bay.status === "fault" || bay.status === "offline") bay.status = "idle";
      SIAP.stopFill(bay.id, "idle");
    });

    // fill:start / fill:stop -> keep the batch table honest even if another view (ERP
    // scenario, Bay Control) drives the bay while this HMI is open.
    SIAP.on("fill:start", (bay) => {
      if (!bay) return;
      ensureHistory(bay);
      hmi.displayDispensed[bay.id] = 0;
      if (bay.id === SIAP.selectedBayId) renderAll();
    });
    SIAP.on("fill:stop", (bay) => {
      if (!bay) return;
      pushCompletedBatch(bay, bay.status === "done");
      if (bay.id === SIAP.selectedBayId) renderAll();
    });
  }

  function setMode(m) {
    const bay = currentBay();
    if (!bay) return;
    hmi.mode[bay.id] = m;
    renderTopStrip(bay);
    const section = document.getElementById("view-hmi");
    section.querySelector("#hmi-btn-manual").classList.toggle("hmi-btn-active", m === "MANUAL");
    section.querySelector("#hmi-btn-auto").classList.toggle("hmi-btn-active", m === "AUTO");
  }

  /* ================= interpolation (250 ms smoothing of the mimic fill level) ================= */
  function startInterpolation() {
    stopInterpolation();
    hmi.interpTimer = setInterval(() => {
      if (!hmi.visible) return;
      const bay = currentBay();
      if (!bay) return;
      const target = bay.dispensed;
      const cur = hmi.displayDispensed[bay.id] ?? target;
      const next = cur + (target - cur) * 0.35;
      hmi.displayDispensed[bay.id] = Math.abs(next - target) < 0.5 ? target : next;
      renderMimic(bay);
      renderTotaliser(bay);
    }, 250);
  }
  function stopInterpolation() {
    if (hmi.interpTimer) { clearInterval(hmi.interpTimer); hmi.interpTimer = null; }
  }

  function onTick() {
    if (!hmi.visible) return;
    const bay = currentBay();
    if (!bay) return;
    pushFlowSample(bay.id, bay.status === "filling" ? bay.flow : 0);
    renderAll();
    updateChart();
  }

  function resetChartForBay() {
    const bay = currentBay();
    if (!bay) return;
    hmi.flowHistory[bay.id] = new Array(TREND_POINTS).fill(bay.status === "filling" ? bay.flow : 0);
    updateChart();
  }

  /* ================= render ================= */
  function renderBaySelect() {
    const sel = document.getElementById("hmi-bay-select");
    if (!sel) return;
    sel.innerHTML = SIAP.state.bays
      .map((b) => `<option value="${b.id}" ${b.id === SIAP.selectedBayId ? "selected" : ""}>Bay ${SIAP.pad(b.id)} — ${SIAP.statusLabel(b.status)}</option>`)
      .join("");
  }

  function renderAll() {
    const bay = currentBay();
    if (!bay) return;
    ensureHistory(bay);
    if (hmi.displayDispensed[bay.id] === undefined) hmi.displayDispensed[bay.id] = bay.dispensed;
    renderTopStrip(bay);
    renderBatchTable(bay);
    renderTotaliser(bay);
    renderMimic(bay);
    renderLamps(bay);
  }

  function renderTopStrip(bay) {
    const tag = document.getElementById("hmi-tag");
    if (tag) tag.textContent = `LFS-BAY-${SIAP.pad(bay.id)}`;

    const mode = modeFor(bay.id);
    const dot = document.getElementById("hmi-mode-dot");
    const text = document.getElementById("hmi-mode-text");
    if (dot && text) {
      dot.className = "hmi-lamp-dot " + (mode === "AUTO" ? "hmi-lamp-green" : "hmi-lamp-amber");
      text.textContent = mode;
    }

    const alarmLine = document.getElementById("hmi-alarm-line");
    if (alarmLine) {
      const needle = `Bay ${SIAP.pad(bay.id)}`;
      const match = SIAP.state.alarms.find((a) => a.text.includes(needle));
      if (match) {
        alarmLine.textContent = `⚠ ${match.text} · ${SIAP.timeAgo(match.ts)}`;
        alarmLine.classList.add("hmi-alarm-active");
      } else {
        alarmLine.textContent = "No active alarms for this bay";
        alarmLine.classList.remove("hmi-alarm-active");
      }
    }

    const dt = document.getElementById("hmi-datetime");
    if (dt) {
      const now = new Date();
      dt.textContent = `${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${SIAP.pad(now.getHours())}:${SIAP.pad(now.getMinutes())}:${SIAP.pad(now.getSeconds())}`;
    }

    // buttons enable/disable to match bay status
    const section = document.getElementById("view-hmi");
    if (section) {
      const startBtn = section.querySelector("#hmi-btn-start");
      const stopBtn = section.querySelector("#hmi-btn-stop");
      const resetBtn = section.querySelector("#hmi-btn-reset");
      if (startBtn) startBtn.disabled = bay.status === "filling";
      if (stopBtn) stopBtn.disabled = bay.status !== "filling";
      if (resetBtn) resetBtn.disabled = !(bay.status === "fault" || bay.status === "offline");
      section.querySelector("#hmi-btn-manual").classList.toggle("hmi-btn-active", mode === "MANUAL");
      section.querySelector("#hmi-btn-auto").classList.toggle("hmi-btn-active", mode === "AUTO");
    }
  }

  function renderBatchTable(bay) {
    const table = document.getElementById("hmi-batch-table");
    if (!table) return;
    const hist = hmi.batchHistory[bay.id] || [];
    const current = {
      batchNo: `B-${SIAP.pad(bay.id)}-CUR`,
      preset: bay.target,
      delivered: bay.dispensed,
      remaining: Math.max(0, bay.target - bay.dispensed),
      flow: bay.status === "filling" ? bay.flow : 0,
      account: bay.account,
      status: bay.status,
    };
    const cols = [current, ...hist].slice(0, 3);

    const statusCell = (c) => {
      if (c === current) {
        if (bay.status === "filling") return `<span class="hmi-status-chip hmi-status-run">RUNNING</span>`;
        if (bay.status === "done") return `<span class="hmi-status-chip hmi-status-ok">DONE</span>`;
        if (bay.status === "fault") return `<span class="hmi-status-chip hmi-status-fault">FAULT</span>`;
        if (bay.status === "offline") return `<span class="hmi-status-chip hmi-status-fault">OFFLINE</span>`;
        return `<span class="hmi-status-chip hmi-status-idle">IDLE</span>`;
      }
      return c.ok
        ? `<span class="hmi-status-chip hmi-status-ok">OK</span>`
        : `<span class="hmi-status-chip hmi-status-idle">STOPPED</span>`;
    };

    const rowsDef = [
      ["Preset (IG)", (c) => c.preset.toLocaleString()],
      ["Delivered (IG)", (c) => Math.round(c.delivered).toLocaleString()],
      ["Remaining (IG)", (c) => Math.round(c.remaining).toLocaleString()],
      ["Flow (m³/h)", (c) => c.flow.toFixed(1)],
      ["Batch No.", (c) => c.batchNo],
      ["Account", (c) => c.account],
      ["Status", statusCell],
    ];

    let html = `<thead><tr><th></th>${cols.map((_, i) => `<th>${i === 0 ? "CURRENT" : "BATCH " + i}</th>`).join("")}</tr></thead><tbody>`;
    for (const [label, fn] of rowsDef) {
      html += `<tr><td class="hmi-row-label">${label}</td>${cols.map((c) => `<td class="${c !== current && c.ok ? "hmi-cell-ok" : ""}">${fn(c)}</td>`).join("")}</tr>`;
    }
    html += "</tbody>";
    table.innerHTML = html;
  }

  function renderTotaliser(bay) {
    const disp = hmi.displayDispensed[bay.id] ?? bay.dispensed;
    const deliveredEl = document.getElementById("hmi-delivered-digits");
    const remainingEl = document.getElementById("hmi-remaining-digits");
    if (deliveredEl) deliveredEl.textContent = pad5(disp);
    if (remainingEl) remainingEl.textContent = pad5(Math.max(0, bay.target - disp));
  }

  function renderLamps(bay) {
    const section = document.getElementById("view-hmi");
    if (!section) return;
    const filling = bay.status === "filling";
    const fault = bay.status === "fault";
    const offline = bay.status === "offline";
    const nearFull = filling && bay.dispensed > bay.target * 0.97;

    const set = (name, cls) => {
      const row = section.querySelector(`.hmi-lamp-row[data-lamp="${name}"] .hmi-lamp-dot`);
      if (row) row.className = "hmi-lamp-dot " + cls;
    };

    set("earth", fault ? "hmi-lamp-red" : filling || bay.status === "done" ? "hmi-lamp-green" : "hmi-lamp-off");
    set("hatch", filling ? "hmi-lamp-amber" : "hmi-lamp-off");
    set("overfill", nearFull ? "hmi-lamp-red" : "hmi-lamp-off");
    set("estop", fault ? "hmi-lamp-red" : "hmi-lamp-green");
    set("rtu", offline ? "hmi-lamp-red" : "hmi-lamp-green");
  }

  /* ================= mimic SVG ================= */
  function renderMimic(bay) {
    const host = document.getElementById("hmi-mimic-svg");
    if (!host) return;

    const disp = hmi.displayDispensed[bay.id] ?? bay.dispensed;
    const pct = Math.max(0, Math.min(100, (disp / bay.target) * 100));
    const filling = bay.status === "filling";
    const fault = bay.status === "fault";
    const offline = bay.status === "offline";
    const commsDown = fault || offline;
    const fineFill = filling && disp > bay.target * 0.85;

    const pressure = (SIAP.state.kpis.inletPressure + (bay.id % 5) * 0.06 + Math.sin(Date.now() / 4000 + bay.id) * 0.08).toFixed(2);
    const temp = (26 + Math.sin(Date.now() / 4000 + bay.id + 50) * 0.7).toFixed(1);
    const flow = filling ? bay.flow : 0;

    const pipeClass = filling ? "pipe-flow" : "pipe-idle";
    const pumpRunning = filling && !commsDown;
    const inletClass = commsDown ? "valve-fault" : filling ? "valve-open" : bay.status === "done" ? "valve-done" : "valve-idle";
    const fineClass = commsDown ? "valve-fault" : fineFill ? "valve-open" : filling ? "valve-done" : "valve-idle";
    const inletLabel = offline ? "NO COMMS" : fault ? "FAULT" : filling ? "OPEN" : "CLOSED";
    const fineLabel = offline ? "NO COMMS" : fault ? "FAULT" : fineFill ? `${Math.round(pct)}%` : filling ? "FULL" : "CLOSED";

    // truck tank geometry (side elevation)
    const tankX = 190, tankY = 235, tankW = 560, tankH = 92, tankRx = tankH / 2;
    const levelH = (pct / 100) * (tankH - 6);
    const levelY = tankY + (tankH - 3) - levelH;

    const svg = `
    <svg class="scada-svg hmi-svg" viewBox="0 0 1000 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hmiWaterGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.92"/>
          <stop offset="100%" stop-color="#0891b2" stop-opacity="0.92"/>
        </linearGradient>
        <clipPath id="hmiTankClip"><rect x="${tankX + 3}" y="${tankY + 3}" width="${tankW - 6}" height="${tankH - 6}" rx="${tankRx - 3}"/></clipPath>
      </defs>

      <!-- ===== upstream: storage, pump, inlet valve, EMF meter, PT, TT, fine-fill valve ===== -->
      <rect class="box box-accent" x="10" y="20" width="58" height="72" rx="6"/>
      <text class="title" x="39" y="16" text-anchor="middle" style="font-size:9.5px;">STORAGE</text>
      <rect x="18" y="30" width="42" height="54" rx="4" fill="#0891b2" opacity="0.55"/>
      <text x="39" y="100" text-anchor="middle" style="font-size:8.5px; fill:var(--text-faint);">TK-01</text>

      <line class="${pipeClass}" x1="68" y1="56" x2="112" y2="56"/>

      <!-- Pump P-01 : ISA circle-with-triangle -->
      <circle cx="128" cy="56" r="17" fill="var(--bg-alt)" stroke="${pumpRunning ? "var(--green)" : "var(--border-strong)"}" stroke-width="2"/>
      <path d="M 121 47 L 121 65 L 137 56 Z" fill="${pumpRunning ? "var(--green)" : "#33445c"}"/>
      <text x="128" y="86" text-anchor="middle" style="font-size:9px;">P-01</text>
      <text x="128" y="98" text-anchor="middle" class="mono" style="font-size:8.5px; font-weight:700; fill:${pumpRunning ? "var(--green)" : "var(--text-faint)"};">${pumpRunning ? "RUNNING" : "STOPPED"}</text>

      <line class="${pipeClass}" x1="145" y1="56" x2="186" y2="56"/>

      <!-- Inlet valve XV-14A -->
      <circle class="${inletClass}" cx="202" cy="56" r="15" stroke-width="2"/>
      <text x="202" y="90" text-anchor="middle" style="font-size:8.5px;">XV-${SIAP.pad(bay.id)}A</text>
      <text x="202" y="101" text-anchor="middle" class="mono" style="font-size:8.5px; font-weight:700;">${inletLabel}</text>

      <line class="${pipeClass}" x1="217" y1="56" x2="266" y2="56"/>

      <!-- EMF custody meter FT-14 -->
      <rect class="box" x="266" y="38" width="82" height="36" rx="6"/>
      <text class="title" x="307" y="53" text-anchor="middle" style="font-size:9px;">FT-${SIAP.pad(bay.id)}</text>
      <text x="307" y="68" text-anchor="middle" class="mono" style="font-size:10.5px; font-weight:700; fill:var(--accent);">${flow.toFixed(1)} m&sup3;/h</text>

      <line class="${pipeClass}" x1="348" y1="56" x2="560" y2="56"/>

      <!-- PT-14 branch up -->
      <line x1="400" y1="56" x2="400" y2="34" stroke="var(--border-strong)" stroke-width="1.4"/>
      <circle cx="400" cy="20" r="13" fill="var(--bg-alt)" stroke="var(--border-strong)" stroke-width="1.4"/>
      <text x="400" y="24" text-anchor="middle" class="mono" style="font-size:8px; font-weight:700;">PT</text>
      <text x="446" y="24" text-anchor="start" class="mono" style="font-size:9.5px; font-weight:700; fill:var(--accent);">${pressure} bar</text>

      <!-- TT-14 branch down -->
      <line x1="470" y1="56" x2="470" y2="78" stroke="var(--border-strong)" stroke-width="1.4"/>
      <circle cx="470" cy="92" r="13" fill="var(--bg-alt)" stroke="var(--border-strong)" stroke-width="1.4"/>
      <text x="470" y="96" text-anchor="middle" class="mono" style="font-size:8px; font-weight:700;">TT</text>
      <text x="470" y="118" text-anchor="middle" class="mono" style="font-size:9.5px; font-weight:700; fill:#fbbf24;">${temp}&deg;C</text>

      <!-- Fine-fill valve XV-14B -->
      <circle class="${fineClass}" cx="576" cy="56" r="15" stroke-width="2"/>
      <text x="576" y="90" text-anchor="middle" style="font-size:8.5px;">XV-${SIAP.pad(bay.id)}B</text>
      <text x="576" y="101" text-anchor="middle" class="mono" style="font-size:8.5px; font-weight:700;">${fineLabel}</text>

      <!-- header down to gantry -->
      <line class="${pipeClass}" x1="591" y1="56" x2="650" y2="56"/>
      <line class="${pipeClass}" x1="650" y1="56" x2="650" y2="120"/>

      <!-- Loading arm gantry (yellow/black hazard) -->
      <rect x="600" y="118" width="100" height="10" fill="#f4b13d" stroke="#7a5a12" stroke-width="1"/>
      <rect x="606" y="112" width="6" height="16" fill="#1c1c1c"/>
      <rect x="688" y="112" width="6" height="16" fill="#1c1c1c"/>
      <line class="${pipeClass}" x1="650" y1="128" x2="650" y2="160"/>
      <line class="${pipeClass}" x1="650" y1="160" x2="530" y2="205"/>

      <!-- ===== apron + truck side elevation ===== -->
      <line x1="20" y1="368" x2="980" y2="368" stroke="var(--border-strong)" stroke-width="2"/>
      <text x="20" y="386" style="font-size:8.5px; fill:var(--text-faint);">APRON — BAY ${SIAP.pad(bay.id)}</text>

      <!-- chassis -->
      <line x1="90" y1="330" x2="920" y2="330" stroke="#33445c" stroke-width="6" stroke-linecap="round"/>

      <!-- cab -->
      <rect x="90" y="255" width="90" height="76" rx="6" fill="var(--panel-alt)" stroke="var(--border-strong)" stroke-width="1.5"/>
      <path d="M 96 255 L 100 224 L 168 224 L 172 255 Z" fill="var(--panel-alt)" stroke="var(--border-strong)" stroke-width="1.5"/>
      <rect x="108" y="230" width="52" height="22" rx="3" fill="#6fb8d6" opacity="0.5"/>

      <!-- tank (cylindrical side elevation) -->
      <rect x="${tankX}" y="${tankY}" width="${tankW}" height="${tankH}" rx="${tankRx}" fill="var(--panel-alt)" stroke="var(--border-strong)" stroke-width="1.6"/>
      <rect x="${tankX + 3}" y="${levelY}" width="${tankW - 6}" height="${levelH}" fill="url(#hmiWaterGrad)" clip-path="url(#hmiTankClip)" style="transition: y .35s ease, height .35s ease;"/>
      <text x="${tankX + tankW / 2}" y="${tankY + tankH / 2 - 6}" text-anchor="middle" class="mono" style="font-size:22px; font-weight:800; fill:#fff;">${pct.toFixed(0)}%</text>
      <text x="${tankX + tankW / 2}" y="${tankY + tankH / 2 + 16}" text-anchor="middle" style="font-size:10px; fill:rgba(255,255,255,0.92);">${bay.plate} &middot; ${bay.owner}</text>

      <!-- rear ladder -->
      <line x1="905" y1="240" x2="905" y2="325" stroke="var(--border-strong)" stroke-width="2"/>
      <line x1="915" y1="240" x2="915" y2="325" stroke="var(--border-strong)" stroke-width="2"/>
      <line x1="905" y1="255" x2="915" y2="255" stroke="var(--border-strong)" stroke-width="2"/>
      <line x1="905" y1="275" x2="915" y2="275" stroke="var(--border-strong)" stroke-width="2"/>
      <line x1="905" y1="295" x2="915" y2="295" stroke="var(--border-strong)" stroke-width="2"/>
      <line x1="905" y1="315" x2="915" y2="315" stroke="var(--border-strong)" stroke-width="2"/>

      <!-- wheels: 1 steer + 3 rear axles (6 wheels) -->
      <circle cx="130" cy="335" r="16" fill="#1c1c1c" stroke="#000" stroke-width="1"/>
      <circle cx="130" cy="335" r="6" fill="#555"/>
      ${[700, 760, 820].map((cx) => `
      <circle cx="${cx}" cy="335" r="16" fill="#1c1c1c" stroke="#000" stroke-width="1"/>
      <circle cx="${cx}" cy="335" r="6" fill="#555"/>`).join("")}
    </svg>`;
    host.innerHTML = svg;
  }

  /* ================= trend chart ================= */
  function buildChart() {
    const canvas = document.getElementById("hmi-trend-chart");
    if (!canvas || typeof Chart === "undefined") return;
    if (hmi.chart) { hmi.chart.destroy(); hmi.chart = null; }
    const bay = currentBay();
    if (bay) resetChartForBay();
    const h = bay ? flowHist(bay.id) : new Array(TREND_POINTS).fill(0);
    hmi.chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: h.map((_, i) => i),
        datasets: [
          {
            label: "Flow",
            data: h,
            borderColor: "#22d3ee",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.35,
            fill: true,
            backgroundColor: (c) => {
              const { chart } = c;
              if (!chart.chartArea) return "rgba(34,211,238,0.18)";
              const g = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
              g.addColorStop(0, "rgba(34,211,238,0.35)");
              g.addColorStop(1, "rgba(34,211,238,0.0)");
              return g;
            },
          },
          {
            label: "Preset flow",
            data: h.map(() => 45),
            borderColor: "rgba(148,178,216,0.55)",
            borderWidth: 1.4,
            borderDash: [5, 4],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false, min: 0, suggestedMax: 60 },
        },
        elements: { line: { capBezierPoints: true } },
      },
    });
  }

  function updateChart() {
    if (!hmi.chart) return;
    const bay = currentBay();
    if (!bay) return;
    const h = flowHist(bay.id);
    hmi.chart.data.labels = h.map((_, i) => i);
    hmi.chart.data.datasets[0].data = h;
    hmi.chart.data.datasets[1].data = h.map(() => 45);
    hmi.chart.update("none");
  }
})();
