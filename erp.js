/* ==========================================================
   S!aP — Enterprise & ERP module (WP-B)
   Registers 7 views under SIAP group "erp" and drives the
   Order-to-Cash demo scenario end-to-end through the SIAP bus.
   Reuses globals from data.js / app.js / erp-data.js (classic
   scripts, shared scope): state, SIAP, OWNERS, randPlate,
   randAccount, pad, statusLabel, ERP, erpPad, erpDaysFromNow,
   erpDaysAgo, erpDateStr, erpDateTimeStr, erpTimeStr,
   erpMaskCivilId, erpInitials, ERP_TRUCK_MAKES, ERP_CAPACITIES.
   ========================================================== */

/* ================= small format / UI helpers ================= */
function erpFmtKD(n) { return `KD ${(+n || 0).toFixed(3)}`; }
function erpFmtIG(n) { return `${Math.round(n || 0).toLocaleString()} IG`; }

function erpStatusTagClass(status) {
  const s = String(status).toLowerCase();
  if (["active", "activated", "connected", "synced", "closed", "verified", "done", "cleared", "posted", "matched"].some(k => s.includes(k))) return "green";
  if (["pending", "printed", "requested", "scheduled", "degraded", "open", "draft", "submitted", "syncing", "consuming", "in progress"].some(k => s.includes(k))) return "amber";
  if (["suspended", "blocked", "failed", "fault", "down", "expired", "lost", "no match"].some(k => s.includes(k))) return "red";
  return "gray";
}
function erpTag(status) { return `<span class="tag ${erpStatusTagClass(status)}">${status}</span>`; }
function erpPriorityTag(p) { return `<span class="tag ${p === "High" ? "red" : p === "Medium" ? "amber" : "gray"}">${p}</span>`; }

function erpExpiryBadge(expiryTs) {
  const days = Math.floor((expiryTs - Date.now()) / 86400000);
  if (days < 0) return `<span class="tag red">Expired ${Math.abs(days)}d ago</span>`;
  if (days <= 30) return `<span class="tag amber">Due in ${days}d</span>`;
  return `<span class="tag green">Valid · ${days}d</span>`;
}

/* ================= singleton overlay (modal / drawer) ================= */
function erpOverlayEscHandler(e) { if (e.key === "Escape") erpCloseOverlay(); }
function erpCloseOverlay() {
  const el = document.getElementById("erp-overlay");
  if (el) el.remove();
  document.removeEventListener("keydown", erpOverlayEscHandler);
}
function erpOpenOverlay(className, innerHtml) {
  erpCloseOverlay();
  const overlay = document.createElement("div");
  overlay.className = className;
  overlay.id = "erp-overlay";
  overlay.innerHTML = innerHtml;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) erpCloseOverlay(); });
  document.addEventListener("keydown", erpOverlayEscHandler);
  if (window.lucide) lucide.createIcons();
  return overlay;
}

/* ================= audit + sync log helpers ================= */
function erpAudit(user, action, object, before, after) {
  ERP.audit.unshift({ id: `AUD-${erpPad(10000 + Math.floor(Math.random() * 89999))}`, ts: Date.now(), user, action, object, before, after });
  ERP.audit = ERP.audit.slice(0, 60);
}
function erpPushSync(connectorId, object, direction, status, retries) {
  ERP.erpSync.unshift({ id: `SYNC-${erpPad(10000 + Math.floor(Math.random() * 89999))}`, ts: Date.now(), connector: connectorId, object, direction, status, retries: retries || 0 });
  ERP.erpSync = ERP.erpSync.slice(0, 30);
  const c = ERP.connectors.find(x => x.id === connectorId);
  if (c) { c.lastSync = Date.now(); c.objectsSynced = (c.objectsSynced || 0) + 1; }
}
function erpFindDemoPo() { return ERP.purchaseOrders.find(p => p.id === ERP.DEMO_IDS.po); }

/* ================= gate queue <-> dashboard KPI ================= */
function erpSyncQueueKpi() {
  if (state && state.kpis) state.kpis.queue = ERP.gate.queue.length;
  const tankersEl = document.getElementById("kpi-tankers");
  if (!tankersEl) return;
  const deltaEl = tankersEl.parentElement && tankersEl.parentElement.querySelector(".kpi-delta");
  if (deltaEl) deltaEl.innerHTML = `&#9650; in queue: ${ERP.gate.queue.length}`;
}
function erpJiggleGateQueue() {
  if (Math.random() > 0.55 && ERP.gate.queue.length < 8) {
    ERP.gate.queue.push({ plate: randPlate(), owner: OWNERS[Math.floor(Math.random() * OWNERS.length)], eta: `${2 + Math.floor(Math.random() * 10)} min` });
  } else if (Math.random() > 0.7 && ERP.gate.queue.length > 0) {
    ERP.gate.queue.shift();
    ERP.gate.lastRelease = Date.now();
  }
  erpSyncQueueKpi();
}

let erpOutage = { active: false, buffered: 0 };

function erpOnTick() {
  erpJiggleGateQueue();
  if (erpOutage.active) {
    if (Math.random() > 0.4) erpOutage.buffered += 1;
    if (SIAP.activeView() === "erp-integration") erpRenderIntegrationScreen();
  }
  if (scenario.waitingFill && SIAP.activeView() === "erp-o2c") { o2cRenderWaiting(); o2cRenderDetail(); }
}

/* ================= cross-screen refresh ================= */
function erpRenderAllErpScreens() {
  erpRenderOrdersScreen();
  erpRenderCustomersScreen();
  erpRenderFleetScreen();
  erpRenderCardsScreen();
  erpRenderIntegrationScreen();
  erpRenderAdminScreen();
  o2cRender();
}

function erpResetDemoData() {
  ERP.reset();
  erpOutage = { active: false, buffered: 0 };
  o2cReset();
  erpRenderAllErpScreens();
  erpSyncQueueKpi();
}

/* ============================================================
   VIEW 1 — Order-to-Cash Tracker (erp-o2c)  — THE demo screen
   ============================================================ */
const O2C_STEPS = [
  { key: "po_raised", label: "PO raised" },
  { key: "approved", label: "Approved" },
  { key: "invoiced", label: "Invoiced" },
  { key: "paid", label: "Paid · K-net" },
  { key: "wallet_credited", label: "Wallet credited" },
  { key: "truck_registered", label: "Truck registered" },
  { key: "driver_registered", label: "Driver registered" },
  { key: "card_issued", label: "Card issued" },
  { key: "gate_lpr", label: "Gate LPR match" },
  { key: "bay_authorised", label: "Bay authorised · QR/PIN" },
  { key: "filling", label: "Filling · fine-fill" },
  { key: "debit", label: "Exact-volume debit" },
  { key: "receipt", label: "Receipt · SMS/e-mail" },
  { key: "gl_posting", label: "GL posting" },
  { key: "settlement", label: "Settlement to MEW bank" },
];
const O2C_FILL_INDEX = O2C_STEPS.findIndex(s => s.key === "filling");
const O2C_STEP_MS = 2200;

const scenario = {
  index: -1, running: false, waitingFill: false,
  timer: null, fillUnsub: null, pollId: null,
  objects: {}, stepTs: {}, log: [],
};

function o2cLogLine(i) {
  const key = O2C_STEPS[i].key; const o = scenario.objects;
  const lines = {
    po_raised: `PO ${o.poId} raised for ${o.customerName}`,
    approved: `PO ${o.poId} approved by ${o.approver || "Ops Manager"}`,
    invoiced: `Invoice ${o.invoiceNo} issued`,
    paid: `K-net ref ${o.knetRef} — payment captured`,
    wallet_credited: `Wallet credited — ${o.customerName}`,
    truck_registered: `Truck ${o.truckId} (${o.plate}) registered`,
    driver_registered: `Driver ${o.driverId} registered`,
    card_issued: `Card ${o.cardId} activated`,
    gate_lpr: `Gate LPR matched plate ${o.plate}`,
    bay_authorised: `Bay ${o.bayId} authorised for account ${o.account}`,
    filling: `Filling started — Bay ${o.bayId} · target 5,000 IG`,
    debit: `Exact-volume debit — ${o.dispensed ? o.dispensed.toLocaleString() : "—"} IG · KD ${o.amountKD != null ? o.amountKD.toFixed(3) : "—"}`,
    receipt: `Receipt sent — SMS + e-mail`,
    gl_posting: `GL posting synced to SAP S/4HANA`,
    settlement: `Settlement to MEW bank complete`,
  };
  return lines[key] || O2C_STEPS[i].label;
}

function o2cStepEffects(i) {
  const key = O2C_STEPS[i].key;
  const cust = ERP.customers[0]; // Al-Salem Transport Co. — matches Bay 14's hero account
  const obj = scenario.objects;
  const nowTs = Date.now();

  switch (key) {
    case "po_raised": {
      let po = erpFindDemoPo();
      if (!po) {
        po = {
          id: ERP.DEMO_IDS.po, customerId: cust.id, customerName: cust.name, quantityIG: 5000,
          tariffId: "TRF-STD", rateKD: 0.0025, amountKD: 12.5, requestedWindow: "Today",
          status: "Draft", approver: "—", invoiceNo: "—", knetRef: "—",
          createdAt: nowTs, updatedAt: nowTs, remainingIG: 5000, fillsCount: 0,
        };
        ERP.purchaseOrders.unshift(po);
      } else {
        Object.assign(po, { status: "Draft", approver: "—", invoiceNo: "—", knetRef: "—", remainingIG: 5000, fillsCount: 0, updatedAt: nowTs });
      }
      obj.poId = po.id; obj.customerId = cust.id; obj.customerName = cust.name; obj.account = cust.account;
      erpAudit("System", "PO raised", po.id, "—", "Draft");
      break;
    }
    case "approved": {
      const po = erpFindDemoPo(); po.status = "Approved"; po.approver = "F. Al-Ansari (Ops Manager)"; po.updatedAt = nowTs;
      obj.approver = po.approver;
      erpAudit(po.approver, "PO approved", po.id, "Draft", "Approved");
      break;
    }
    case "invoiced": {
      const po = erpFindDemoPo(); po.status = "Invoiced"; po.invoiceNo = `INV-${89000 + Math.floor(Math.random() * 900)}`; po.updatedAt = nowTs;
      obj.invoiceNo = po.invoiceNo;
      erpAudit("System", "Invoice generated", po.invoiceNo, "Approved", "Invoiced");
      break;
    }
    case "paid": {
      const po = erpFindDemoPo(); po.status = "Paid"; po.knetRef = `KNET-${772000 + Math.floor(Math.random() * 900)}`; po.updatedAt = nowTs;
      obj.knetRef = po.knetRef;
      erpAudit("K-net Gateway", "Payment captured", po.knetRef, "Invoiced", "Paid");
      break;
    }
    case "wallet_credited": {
      const po = erpFindDemoPo(); const customer = ERP.customers.find(c => c.id === po.customerId);
      const before = customer.wallet;
      customer.wallet = +(customer.wallet + po.amountKD).toFixed(3);
      po.status = "Active"; po.updatedAt = nowTs;
      if (Array.isArray(state.ledger)) {
        state.ledger.unshift({ time: erpTimeStr(nowTs), account: customer.account, type: "Top-up", volume: "—", amount: `+KD ${po.amountKD.toFixed(3)}`, channel: "K-net", status: "Cleared" });
        state.ledger = state.ledger.slice(0, 9);
        if (typeof renderLedger === "function") renderLedger();
      }
      erpAudit("System", "Wallet credited", customer.id, erpFmtKD(before), erpFmtKD(customer.wallet));
      break;
    }
    case "truck_registered": {
      let truck = ERP.trucks.find(t => t.id === ERP.DEMO_IDS.truck);
      if (!truck) {
        truck = { id: ERP.DEMO_IDS.truck, plate: "3 / 84621", ownerId: cust.id, ownerName: cust.name, capacityIG: 5000, make: "Isuzu FVR", calibCertNo: "CAL-90142", calibExpiry: erpDaysFromNow(340), hatchType: "Top hatch", status: "Active", rfidTag: "RFID-T9999" };
        ERP.trucks.unshift(truck);
      } else { truck.status = "Active"; }
      obj.truckId = truck.id; obj.plate = truck.plate;
      erpAudit("System", "Truck registered", truck.id, "—", "Active");
      break;
    }
    case "driver_registered": {
      let driver = ERP.drivers.find(d => d.id === ERP.DEMO_IDS.driver);
      if (!driver) {
        driver = { id: ERP.DEMO_IDS.driver, name: "Yousef Al-Ansari", civilId: erpMaskCivilId(14), licenceClass: "Heavy Goods · Class 4", licenceExpiry: erpDaysFromNow(400), phone: "+965 60112233", assignedTruckIds: [ERP.DEMO_IDS.truck], status: "Active", initials: "YA" };
        ERP.drivers.unshift(driver);
      } else { driver.status = "Active"; driver.assignedTruckIds = [ERP.DEMO_IDS.truck]; }
      obj.driverId = driver.id;
      erpAudit("System", "Driver registered", driver.id, "—", "Active");
      break;
    }
    case "card_issued": {
      let card = ERP.credentials.find(c => c.id === ERP.DEMO_IDS.card);
      if (!card) {
        card = { id: ERP.DEMO_IDS.card, type: "RFID + PIN", customerId: cust.id, customerName: cust.name, truckId: ERP.DEMO_IDS.truck, truckPlate: obj.plate || "3 / 84621", driverId: ERP.DEMO_IDS.driver, driverName: "Yousef Al-Ansari", pinAttempts: 0, status: "Requested", issuedAt: nowTs, expiry: erpDaysFromNow(365) };
        ERP.credentials.unshift(card);
      }
      card.status = "Activated"; card.pinAttempts = 0; card.issuedAt = nowTs;
      obj.cardId = card.id;
      erpAudit("System", "Card activated", card.id, "Requested", "Activated");
      break;
    }
    case "gate_lpr": {
      if (Array.isArray(state.lprLog)) {
        state.lprLog.unshift({ time: erpTimeStr(nowTs), plate: obj.plate || "3 / 84621", owner: cust.name, gate: "Entry", status: "Matched · Bay 14" });
        state.lprLog = state.lprLog.slice(0, 8);
        if (typeof renderLprLog === "function") renderLprLog();
      }
      ERP.gate.queue = ERP.gate.queue.filter(q => q.plate !== obj.plate);
      erpSyncQueueKpi();
      erpAudit("System", "Gate LPR match", obj.plate || "—", "—", "Matched");
      break;
    }
    case "bay_authorised": {
      SIAP.selectBay(14);
      obj.bayId = 14;
      erpAudit("System", "Bay 14 authorised · QR/PIN", obj.account || cust.account, "—", "Authorised");
      break;
    }
    case "filling": {
      SIAP.startFill(14, { owner: cust.name, account: obj.account || cust.account, plate: obj.plate || "3 / 84621", target: 5000, flow: 70 });
      erpAudit("System", "Fill started", "Bay 14", "Idle", "Filling");
      o2cBeginFillWait();
      break;
    }
    case "debit": {
      const bay = state.bays.find(b => b.id === 14);
      const dispensed = bay ? bay.dispensed : 5000;
      const tariff = ERP.tariffs.find(t => t.id === "TRF-STD");
      const amount = +(dispensed * tariff.rate).toFixed(3);
      obj.dispensed = dispensed; obj.amountKD = amount;
      if (Array.isArray(state.ledger)) {
        state.ledger.unshift({ time: erpTimeStr(nowTs), account: obj.account || cust.account, type: "Fill (debit)", volume: `${dispensed}`, amount: `-KD ${amount.toFixed(3)}`, channel: "Bay 14", status: "Posted" });
        state.ledger = state.ledger.slice(0, 9);
        if (typeof renderLedger === "function") renderLedger();
      }
      if (Array.isArray(state.mewActivity)) {
        state.mewActivity.unshift({ label: "Fill — Bay 14", delta: `-KD ${amount.toFixed(3)}` });
        state.mewActivity = state.mewActivity.slice(0, 3);
        if (typeof renderMewActivity === "function") renderMewActivity();
      }
      const po = erpFindDemoPo();
      if (po) { po.status = "Closed"; po.remainingIG = Math.max(0, po.quantityIG - dispensed); po.fillsCount = (po.fillsCount || 0) + 1; po.updatedAt = nowTs; }
      const customer = ERP.customers.find(c => c.id === cust.id);
      erpAudit("System", "Exact-volume debit", obj.account || cust.account, erpFmtKD(customer.wallet), erpFmtKD(customer.wallet - amount));
      break;
    }
    case "receipt": {
      o2cShowReceiptModal();
      erpAudit("System", "Receipt sent · SMS + e-mail", obj.account || cust.account, "—", "Sent");
      break;
    }
    case "gl_posting": {
      erpPushSync("sap", `GL Posting — Fill Bay 14 · ${obj.invoiceNo || ""}`, "S!aP → ERP", "Synced", 0);
      erpAudit("System", "GL posting synced", obj.invoiceNo || obj.account, "Pending", "Synced");
      break;
    }
    case "settlement": {
      erpPushSync("sap", `Settlement — K-net batch ${obj.knetRef || ""}`, "S!aP → ERP", "Synced", 0);
      erpAudit("System", "Settlement to MEW bank complete", obj.knetRef || "—", "Open", "Settled");
      break;
    }
  }
}

function o2cBeginFillWait() {
  scenario.waitingFill = true;
  o2cSetStatus("Filling Bay 14 — waiting for fine-fill to complete…");
  let settled = false;
  const finish = () => {
    if (settled) return; settled = true;
    scenario.waitingFill = false;
    if (scenario.fillUnsub) { scenario.fillUnsub(); scenario.fillUnsub = null; }
    if (scenario.pollId) { clearInterval(scenario.pollId); scenario.pollId = null; }
    o2cDoStep(O2C_FILL_INDEX + 1); // exact-volume debit
    if (scenario.running) o2cScheduleNext(O2C_STEP_MS);
  };
  scenario.fillUnsub = SIAP.on("fill:stop", (bayObj) => { if (bayObj && bayObj.id === 14) finish(); });
  const startedAt = Date.now();
  scenario.pollId = setInterval(() => {
    const b = state.bays.find(x => x.id === 14);
    if (!b) return;
    if (b.status === "done") { finish(); return; }
    if (Date.now() - startedAt > 60000) { SIAP.stopFill(14, "done"); finish(); }
  }, 1000);
}

function o2cDoStep(i) {
  o2cStepEffects(i);
  scenario.index = Math.max(scenario.index, i);
  scenario.stepTs[i] = Date.now();
  scenario.log.unshift({ i, ts: Date.now(), text: o2cLogLine(i) });
  scenario.log = scenario.log.slice(0, 20);
  SIAP.emit("erp:step", { index: i, key: O2C_STEPS[i].key, objects: Object.assign({}, scenario.objects) });
  erpSave();
  o2cRender();
  erpRenderOrdersScreen(); erpRenderCustomersScreen(); erpRenderFleetScreen();
  erpRenderCardsScreen(); erpRenderIntegrationScreen(); erpRenderAdminScreen();
}

function o2cAdvance() {
  const next = scenario.index + 1;
  if (next >= O2C_STEPS.length) { o2cPause(); o2cSetStatus("Scenario complete — press Reset to run again."); return; }
  o2cDoStep(next);
  if (next === O2C_FILL_INDEX) return; // now waiting on the fill; finish() continues the chain
  if (scenario.running) o2cScheduleNext(O2C_STEP_MS);
}

function o2cScheduleNext(delay) {
  clearTimeout(scenario.timer);
  scenario.timer = setTimeout(() => {
    if (!scenario.running || scenario.waitingFill) return;
    o2cAdvance();
  }, delay != null ? delay : O2C_STEP_MS);
}

function o2cRun() {
  if (scenario.index >= O2C_STEPS.length - 1) { o2cSetStatus("Scenario complete — press Reset to run again."); return; }
  scenario.running = true;
  o2cSetStatus(scenario.waitingFill ? "Resumed — waiting for Bay 14 to finish filling…" : "Running…");
  o2cRender();
  if (!scenario.waitingFill) o2cScheduleNext(400);
}
function o2cPause() {
  scenario.running = false; clearTimeout(scenario.timer);
  o2cSetStatus(scenario.waitingFill ? "Paused — Bay 14 keeps filling in the background." : "Paused.");
  o2cRender();
}
function o2cStep() {
  if (scenario.waitingFill) { o2cSetStatus("Still filling Bay 14 — waiting for completion (or press Run to continue automatically)."); return; }
  const next = scenario.index + 1;
  if (next >= O2C_STEPS.length) { o2cSetStatus("Scenario complete — press Reset to run again."); return; }
  o2cDoStep(next);
}
function o2cReset() {
  scenario.running = false; clearTimeout(scenario.timer);
  if (scenario.fillUnsub) { scenario.fillUnsub(); scenario.fillUnsub = null; }
  if (scenario.pollId) { clearInterval(scenario.pollId); scenario.pollId = null; }
  const bay = state.bays.find(b => b.id === 14);
  if (bay && bay.status === "filling") SIAP.stopFill(14, "idle");
  scenario.index = -1; scenario.waitingFill = false; scenario.objects = {}; scenario.stepTs = {}; scenario.log = [];
  o2cSetStatus("Ready — press Run to start the scenario.");
  o2cRender();
}

function o2cSetStatus(text) { const el = document.getElementById("erp-o2c-status"); if (el) el.innerHTML = text; }

function o2cRenderWaiting() {
  const el = document.getElementById("erp-o2c-waiting"); if (!el) return;
  if (!scenario.waitingFill) { el.innerHTML = ""; return; }
  const bay = state.bays.find(b => b.id === 14);
  const dispensed = bay ? bay.dispensed : 0;
  const target = bay ? bay.target : 5000;
  const pct = Math.min(100, Math.round((dispensed / target) * 100));
  el.innerHTML = `<div class="erp-o2c-waiting"><span class="erp-spin"></span> Filling Bay 14 — ${dispensed.toLocaleString()} / ${target.toLocaleString()} IG (${pct}%)</div>
    <div class="erp-progress-mini"><div style="width:${pct}%"></div></div>`;
}

function o2cRenderDetail() {
  const el = document.getElementById("erp-o2c-detail"); if (!el) return;
  const o = scenario.objects;
  const po = o.poId ? ERP.purchaseOrders.find(p => p.id === o.poId) : null;
  const bay = state.bays.find(b => b.id === 14);
  const card = o.cardId ? ERP.credentials.find(c => c.id === o.cardId) : null;
  el.innerHTML = `
    <div class="erp-summary-box">
      <div class="erp-section-title">Order</div>
      <div class="metric-line"><span class="k">PO</span><span class="v">${po ? po.id : "—"}</span></div>
      <div class="metric-line"><span class="k">Customer</span><span class="v">${o.customerName || "—"}</span></div>
      <div class="metric-line"><span class="k">Status</span><span class="v">${po ? erpTag(po.status) : "—"}</span></div>
      <div class="metric-line"><span class="k">Invoice / K-net</span><span class="v">${o.invoiceNo || "—"} / ${o.knetRef || "—"}</span></div>
    </div>
    <div class="erp-summary-box">
      <div class="erp-section-title">Fleet &amp; Credential</div>
      <div class="metric-line"><span class="k">Truck</span><span class="v">${o.truckId || "—"} (${o.plate || "—"})</span></div>
      <div class="metric-line"><span class="k">Driver</span><span class="v">${o.driverId || "—"}</span></div>
      <div class="metric-line"><span class="k">Card</span><span class="v">${card ? erpTag(card.status) : "—"}</span></div>
    </div>
    <div class="erp-summary-box">
      <div class="erp-section-title">Bay &amp; Settlement</div>
      <div class="metric-line"><span class="k">Bay 14</span><span class="v">${bay ? statusLabel(bay.status) : "—"}</span></div>
      <div class="metric-line"><span class="k">Dispensed</span><span class="v">${bay ? bay.dispensed.toLocaleString() : 0} / ${bay ? bay.target.toLocaleString() : 5000} IG</span></div>
      <div class="metric-line"><span class="k">GL / Settlement</span><span class="v">${scenario.index >= O2C_STEPS.length - 1 ? "Posted" : "Pending"}</span></div>
    </div>`;
}

function o2cRender() {
  const track = document.getElementById("erp-o2c-track"); if (!track) return;
  track.innerHTML = O2C_STEPS.map((s, i) => {
    let cls;
    if (i < scenario.index) cls = "done";
    else if (i === scenario.index) cls = (scenario.waitingFill && i === O2C_FILL_INDEX) ? "active" : "done";
    else cls = "";
    const ts = scenario.stepTs[i];
    return `<div class="erp-o2c-step ${cls}">
      <div class="erp-o2c-line"></div>
      <div class="erp-o2c-dot">${cls === "done" ? '<i data-lucide="check"></i>' : (i + 1)}</div>
      <div class="erp-o2c-label">${s.label}</div>
      <div class="erp-o2c-time">${ts ? erpTimeStr(ts) : ""}</div>
    </div>`;
  }).join("");

  const objectsEl = document.getElementById("erp-o2c-objects");
  if (objectsEl) {
    objectsEl.innerHTML = scenario.log.length ? `
      <table class="data-table"><thead><tr><th>Time</th><th>Step</th><th>Detail</th></tr></thead>
      <tbody>${scenario.log.map(l => `<tr><td class="mono">${erpTimeStr(l.ts)}</td><td>${O2C_STEPS[l.i].label}</td><td>${l.text}</td></tr>`).join("")}</tbody></table>
    ` : `<div class="erp-empty">No activity yet — press Run.</div>`;
  }

  o2cRenderWaiting();
  o2cRenderDetail();

  const runBtn = document.getElementById("erp-o2c-run");
  const pauseBtn = document.getElementById("erp-o2c-pause");
  if (runBtn) runBtn.disabled = scenario.running;
  if (pauseBtn) pauseBtn.disabled = !scenario.running;

  if (window.lucide) lucide.createIcons();
}

function o2cShowReceiptModal() {
  const o = scenario.objects;
  const cust = ERP.customers.find(c => c.id === o.customerId) || ERP.customers[0];
  const bay = state.bays.find(b => b.id === 14);
  const dispensed = o.dispensed || (bay ? bay.dispensed : 5000);
  const amount = o.amountKD != null ? o.amountKD : +(dispensed * 0.0025).toFixed(3);
  erpOpenOverlay("erp-modal-overlay", `
    <div class="erp-modal">
      <div class="erp-modal-header"><h3>Receipt — Bay 14</h3><button class="erp-modal-close" id="erp-rc-close"><i data-lucide="x"></i></button></div>
      <div class="erp-modal-body">
        <div class="erp-receipt-grid">
          <div class="erp-sms-phone">
            <div class="erp-sms-carrier">SMS &middot; Zain KW &middot; now</div>
            <div class="erp-sms-bubble">MEW S!aP: Fill complete at Bay 14. ${dispensed.toLocaleString()} IG dispensed, KD ${amount.toFixed(3)} debited from ${o.account || cust.account}. Meter FT-14. Ref ${o.knetRef || "—"}.</div>
          </div>
          <div class="erp-email-preview">
            <div class="erp-email-row"><span class="k">From</span><span>billing@mew.gov.kw</span></div>
            <div class="erp-email-row"><span class="k">To</span><span>${cust.email}</span></div>
            <div class="erp-email-row"><span class="k">Subject</span><span>Al Dhaher LFS — Fill Receipt · Bay 14</span></div>
            <div class="erp-email-body">
              <b>${cust.name}</b><br>
              Account: ${o.account || cust.account}<br>
              Bay: 14 &middot; Meter: FT-14<br>
              Volume: <b>${dispensed.toLocaleString()} IG</b><br>
              Amount: <b>KD ${amount.toFixed(3)}</b><br>
              K-net ref: ${o.knetRef || "—"}<br>
              Invoice: ${o.invoiceNo || "—"}
            </div>
          </div>
        </div>
      </div>
      <div class="erp-modal-footer"><button class="btn btn-primary" id="erp-rc-ok">Close</button></div>
    </div>`);
  document.getElementById("erp-rc-close").addEventListener("click", erpCloseOverlay);
  document.getElementById("erp-rc-ok").addEventListener("click", erpCloseOverlay);
}

SIAP.registerView({
  id: "erp-o2c", title: "Order-to-Cash Tracker", sub: "PO raised → Settlement · Bay 14 · Al-Salem Transport Co.",
  group: "erp", icon: "route", navLabel: "Order-to-Cash Tracker",
  html: `
    <div class="card">
      <div class="card-title">Order-to-Cash Tracker <span class="hint">PO raised &rarr; Settlement to MEW bank &middot; 15 steps, fully live</span></div>
      <div class="erp-o2c-controls">
        <button class="btn btn-primary btn-sm" id="erp-o2c-run"><i data-lucide="play"></i> Run</button>
        <button class="btn btn-sm" id="erp-o2c-pause"><i data-lucide="pause"></i> Pause</button>
        <button class="btn btn-sm" id="erp-o2c-step"><i data-lucide="step-forward"></i> Step</button>
        <button class="btn btn-sm" id="erp-o2c-reset"><i data-lucide="rotate-ccw"></i> Reset</button>
        <div class="spacer"></div>
        <div class="erp-o2c-status" id="erp-o2c-status">Ready — press Run to start the scenario.</div>
      </div>
      <div class="erp-o2c-track" id="erp-o2c-track"></div>
      <div id="erp-o2c-waiting"></div>
      <div class="erp-o2c-detail-grid" id="erp-o2c-detail"></div>
    </div>
    <div class="card" style="margin-top:16px;">
      <div class="card-title">Scenario activity log</div>
      <div id="erp-o2c-objects"></div>
    </div>
    <div class="card" style="margin-top:16px;">
      <div class="util-text">This tracker drives the rest of S!aP live &mdash; Gate LPR log, Bay 14 control &amp; fill simulation, billing ledger &amp; wallet, the alarms KPI and the ERP sync log all update as it runs.
        <button class="btn btn-sm" id="erp-o2c-reset-data" style="margin-left:10px;"><i data-lucide="database-backup"></i> Reset demo data</button>
      </div>
    </div>`,
  onMount(section) {
    section.querySelector("#erp-o2c-run").addEventListener("click", o2cRun);
    section.querySelector("#erp-o2c-pause").addEventListener("click", o2cPause);
    section.querySelector("#erp-o2c-step").addEventListener("click", o2cStep);
    section.querySelector("#erp-o2c-reset").addEventListener("click", o2cReset);
    section.querySelector("#erp-o2c-reset-data").addEventListener("click", erpResetDemoData);
    o2cRender();
  },
  onShow() { o2cRender(); },
  onTick() { if (scenario.waitingFill) { o2cRenderWaiting(); o2cRenderDetail(); } },
});

/* ============================================================
   VIEW 2 — Purchase Orders (erp-orders) + New-PO wizard
   ============================================================ */
function erpRenderOrdersScreen() {
  const section = document.getElementById("view-erp-orders"); if (!section) return;
  const open = ERP.purchaseOrders.filter(p => p.status !== "Closed").length;
  const pendingApprovalKD = ERP.purchaseOrders.filter(p => p.status === "Submitted").reduce((s, p) => s + p.amountKD, 0);
  const contractedIG = ERP.purchaseOrders.filter(p => ["Active", "Consuming"].includes(p.status)).reduce((s, p) => s + p.remainingIG, 0);
  const walletLiab = ERP.customers.reduce((s, c) => s + c.wallet, 0);
  const setText = (id, v) => { const el = section.querySelector(id); if (el) el.textContent = v; };
  setText("#erp-stat-open", open);
  setText("#erp-stat-pending", erpFmtKD(pendingApprovalKD));
  setText("#erp-stat-ig", erpFmtIG(contractedIG));
  setText("#erp-stat-wallet", erpFmtKD(walletLiab));

  const tbody = section.querySelector("#erp-po-tbody");
  tbody.innerHTML = ERP.purchaseOrders.map(po => `
    <tr>
      <td class="mono">${po.id}</td>
      <td>${po.customerName}</td>
      <td class="mono">${po.quantityIG.toLocaleString()}</td>
      <td class="mono">${erpFmtKD(po.amountKD)}</td>
      <td>${erpTag(po.status)}</td>
      <td>${po.approver}</td>
      <td class="mono">${po.invoiceNo}</td>
      <td class="mono">${po.knetRef}</td>
      <td class="erp-muted">${erpDateStr(po.updatedAt)}</td>
    </tr>`).join("");
  if (window.lucide) lucide.createIcons();
}

const poWizard = { step: 1, customerId: null, qty: 5000, tariffId: "TRF-STD", approver: "", comment: "", po: null };

function erpOpenPoWizard() {
  poWizard.step = 1; poWizard.customerId = ERP.customers[0].id; poWizard.qty = 5000;
  poWizard.tariffId = "TRF-STD"; poWizard.approver = ""; poWizard.comment = ""; poWizard.po = null;
  erpOpenOverlay("erp-modal-overlay", `
    <div class="erp-modal">
      <div class="erp-modal-header"><h3>New Purchase Order</h3><button class="erp-modal-close" id="erp-po-close"><i data-lucide="x"></i></button></div>
      <div class="erp-modal-body">
        <div class="erp-wizard-steps" id="erp-po-steps"></div>
        <div class="erp-wizard-body" id="erp-po-body"></div>
      </div>
      <div class="erp-modal-footer" id="erp-po-footer"></div>
    </div>`);
  document.getElementById("erp-po-close").addEventListener("click", erpCloseOverlay);
  erpRenderPoWizard();
}

function erpRenderPoWizard() {
  const stepsEl = document.getElementById("erp-po-steps"); if (!stepsEl) return;
  const labels = ["Customer", "Quantity & Tariff", "Approval", "Invoice & Payment"];
  stepsEl.innerHTML = labels.map((l, i) => {
    const n = i + 1; const cls = n < poWizard.step ? "done" : n === poWizard.step ? "active" : "";
    return `<div class="erp-wizard-step ${cls}">${n}. ${l}</div>`;
  }).join("");

  const body = document.getElementById("erp-po-body");
  const footer = document.getElementById("erp-po-footer");
  const customer = ERP.customers.find(c => c.id === poWizard.customerId);
  const tariff = ERP.tariffs.find(t => t.id === poWizard.tariffId);
  const amount = +(poWizard.qty * tariff.rate).toFixed(3);

  if (poWizard.step === 1) {
    body.innerHTML = `
      <div class="erp-form-grid erp-form-1col">
        <div class="erp-form-row"><label>Customer</label>
          <select id="erp-po-customer">${ERP.customers.map(c => `<option value="${c.id}" ${c.id === poWizard.customerId ? "selected" : ""}>${c.name} — ${c.account}</option>`).join("")}</select>
        </div>
      </div>
      <div class="erp-summary-box" style="margin-top:14px;">
        <div class="metric-line"><span class="k">Category</span><span class="v">${customer.category}</span></div>
        <div class="metric-line"><span class="k">Wallet balance</span><span class="v">${erpFmtKD(customer.wallet)}</span></div>
        <div class="metric-line"><span class="k">Status</span><span class="v">${erpTag(customer.status)}</span></div>
      </div>`;
    footer.innerHTML = `<button class="btn" id="erp-po-cancel">Cancel</button><button class="btn btn-primary" id="erp-po-next">Next</button>`;
    document.getElementById("erp-po-customer").addEventListener("change", e => { poWizard.customerId = e.target.value; erpRenderPoWizard(); });
  } else if (poWizard.step === 2) {
    body.innerHTML = `
      <div class="erp-form-grid">
        <div class="erp-form-row"><label>Quantity (Imp. gal)</label><input class="erp-input" type="number" id="erp-po-qty" min="500" step="500" value="${poWizard.qty}"></div>
        <div class="erp-form-row"><label>Tariff</label>
          <select id="erp-po-tariff">${ERP.tariffs.map(t => `<option value="${t.id}" ${t.id === poWizard.tariffId ? "selected" : ""}>${t.name} — KD ${t.rate}/IG</option>`).join("")}</select>
        </div>
      </div>
      <div class="erp-summary-box" style="margin-top:14px;">
        <div class="metric-line"><span class="k">Rate</span><span class="v">KD ${tariff.rate} / IG</span></div>
        <div class="metric-line"><span class="k">Estimated amount</span><span class="v" style="color:var(--accent)">${erpFmtKD(amount)}</span></div>
      </div>`;
    footer.innerHTML = `<button class="btn" id="erp-po-back">Back</button><button class="btn btn-primary" id="erp-po-next">Next</button>`;
    document.getElementById("erp-po-tariff").addEventListener("change", e => { poWizard.tariffId = e.target.value; erpRenderPoWizard(); });
  } else if (poWizard.step === 3) {
    body.innerHTML = `
      <div class="erp-approve-chip">
        <i data-lucide="badge-check" style="color:var(--accent)"></i>
        <div><b>F. Al-Ansari</b> — Ops Manager, Al Dhaher Tanker Dept.</div>
      </div>
      <div class="erp-form-row" style="margin-top:14px;"><label>Approval comment (optional)</label>
        <textarea class="erp-input" id="erp-po-comment" placeholder="e.g. Standard prepaid order, no exceptions.">${poWizard.comment}</textarea>
      </div>`;
    footer.innerHTML = `<button class="btn" id="erp-po-back">Back</button><button class="btn btn-primary" id="erp-po-next">Approve &amp; continue</button>`;
  } else if (poWizard.step === 4) {
    if (!poWizard.po) {
      const id = `PO-2026-${erpPad(200 + ERP.purchaseOrders.length)}`;
      const now = Date.now();
      poWizard.po = {
        id, customerId: customer.id, customerName: customer.name, quantityIG: poWizard.qty, tariffId: tariff.id,
        rateKD: tariff.rate, amountKD: amount, requestedWindow: "This week", status: "Invoiced",
        approver: "F. Al-Ansari (Ops Manager)", invoiceNo: `INV-${89100 + Math.floor(Math.random() * 800)}`, knetRef: "—",
        createdAt: now, updatedAt: now, remainingIG: poWizard.qty, fillsCount: 0,
      };
      ERP.purchaseOrders.unshift(poWizard.po);
      erpAudit(poWizard.po.approver, "PO approved & invoiced", id, "Draft", "Invoiced");
      erpSave();
    }
    const po = poWizard.po;
    body.innerHTML = `
      <div class="erp-summary-box">
        <div class="metric-line"><span class="k">PO</span><span class="v">${po.id}</span></div>
        <div class="metric-line"><span class="k">Invoice</span><span class="v">${po.invoiceNo}</span></div>
        <div class="metric-line"><span class="k">Amount due</span><span class="v" style="color:var(--accent)">${erpFmtKD(po.amountKD)}</span></div>
        <div class="metric-line"><span class="k">Status</span><span class="v" id="erp-po-pay-status">${erpTag(po.status)}</span></div>
      </div>
      <div class="erp-form-note" style="margin-top:10px;">K-net reference is generated once payment is captured.</div>`;
    footer.innerHTML = po.status === "Active"
      ? `<button class="btn btn-primary" id="erp-po-done">Done</button>`
      : `<button class="btn" id="erp-po-back">Back</button><button class="btn btn-primary" id="erp-po-pay"><i data-lucide="credit-card"></i> Pay now · K-net</button>`;
  }

  const back = document.getElementById("erp-po-back"); if (back) back.addEventListener("click", () => { poWizard.step--; erpRenderPoWizard(); });
  const next = document.getElementById("erp-po-next"); if (next) next.addEventListener("click", () => {
    if (poWizard.step === 2) poWizard.qty = Math.max(500, +document.getElementById("erp-po-qty").value || 500);
    if (poWizard.step === 3) poWizard.comment = document.getElementById("erp-po-comment").value;
    poWizard.step++; erpRenderPoWizard();
  });
  const cancel = document.getElementById("erp-po-cancel"); if (cancel) cancel.addEventListener("click", erpCloseOverlay);
  const pay = document.getElementById("erp-po-pay"); if (pay) pay.addEventListener("click", erpPoWizardPay);
  const done = document.getElementById("erp-po-done"); if (done) done.addEventListener("click", () => { erpCloseOverlay(); erpRenderOrdersScreen(); erpRenderCustomersScreen(); });
  if (window.lucide) lucide.createIcons();
}

function erpPoWizardPay() {
  const payBtn = document.getElementById("erp-po-pay");
  if (payBtn) { payBtn.disabled = true; payBtn.innerHTML = `<i data-lucide="loader"></i> Processing…`; if (window.lucide) lucide.createIcons(); }
  setTimeout(() => {
    const po = poWizard.po; const customer = ERP.customers.find(c => c.id === po.customerId);
    po.knetRef = `KNET-${772500 + Math.floor(Math.random() * 900)}`; po.updatedAt = Date.now();
    customer.wallet = +(customer.wallet + po.amountKD).toFixed(3);
    po.status = "Active";
    if (Array.isArray(state.ledger)) {
      state.ledger.unshift({ time: erpTimeStr(Date.now()), account: customer.account, type: "Top-up", volume: "—", amount: `+KD ${po.amountKD.toFixed(3)}`, channel: "K-net", status: "Cleared" });
      state.ledger = state.ledger.slice(0, 9);
      if (typeof renderLedger === "function") renderLedger();
    }
    erpAudit("K-net Gateway", "Payment captured & wallet credited", po.id, "Invoiced", "Active");
    erpSave();
    erpRenderPoWizard();
    erpRenderOrdersScreen();
    erpRenderCustomersScreen();
  }, 900);
}

SIAP.registerView({
  id: "erp-orders", title: "Purchase Orders", sub: "Prepaid orders · approval · invoice · K-net",
  group: "erp", icon: "file-text", navLabel: "Purchase Orders",
  html: `
    <div class="erp-stat-row">
      <div class="erp-stat"><div class="erp-stat-label">Open POs</div><div class="erp-stat-value" id="erp-stat-open">0</div></div>
      <div class="erp-stat"><div class="erp-stat-label">Pending approval</div><div class="erp-stat-value" id="erp-stat-pending">KD 0</div></div>
      <div class="erp-stat"><div class="erp-stat-label">IG contracted</div><div class="erp-stat-value" id="erp-stat-ig">0 IG</div></div>
      <div class="erp-stat"><div class="erp-stat-label">Wallet liabilities</div><div class="erp-stat-value" id="erp-stat-wallet">KD 0</div></div>
    </div>
    <div class="card">
      <div class="card-title">Purchase Orders <span class="hint">prepaid · approval · invoice · K-net</span></div>
      <div class="erp-toolbar"><div class="spacer" style="flex:1"></div><button class="btn btn-primary btn-sm" id="erp-po-new"><i data-lucide="plus"></i> New PO</button></div>
      <div class="erp-scroll-x"><table class="data-table">
        <thead><tr><th>PO</th><th>Customer</th><th>Qty (IG)</th><th>Amount</th><th>Status</th><th>Approver</th><th>Invoice</th><th>K-net ref</th><th>Updated</th></tr></thead>
        <tbody id="erp-po-tbody"></tbody>
      </table></div>
    </div>`,
  onMount(section) {
    section.querySelector("#erp-po-new").addEventListener("click", erpOpenPoWizard);
    erpRenderOrdersScreen();
  },
  onShow() { erpRenderOrdersScreen(); },
});

/* ============================================================
   VIEW 3 — Customers & Accounts (erp-customers) + drawer
   ============================================================ */
function erpRenderCustomersScreen() {
  const section = document.getElementById("view-erp-customers"); if (!section) return;
  const filterText = (section.querySelector("#erp-cust-search") || {}).value || "";
  const filterStatus = (section.querySelector("#erp-cust-filter") || {}).value || "";
  const rows = ERP.customers.filter(c => {
    const matchesText = !filterText || (c.name + c.account + c.crNo).toLowerCase().includes(filterText.toLowerCase());
    const matchesStatus = !filterStatus || c.status === filterStatus;
    return matchesText && matchesStatus;
  });
  const tbody = section.querySelector("#erp-cust-tbody");
  tbody.innerHTML = rows.length ? rows.map(c => `
    <tr class="erp-row-click" data-cust="${c.id}">
      <td class="mono">${c.id}</td>
      <td>${c.name}</td>
      <td>${c.category}</td>
      <td class="mono">${c.account}</td>
      <td class="mono">${erpFmtKD(c.wallet)}</td>
      <td>${erpTag(c.status)}</td>
      <td class="erp-muted">${c.registeredSince}</td>
    </tr>`).join("") : `<tr><td colspan="7"><div class="erp-empty">No customers match.</div></td></tr>`;
  tbody.querySelectorAll("[data-cust]").forEach(tr => tr.addEventListener("click", () => erpOpenCustomerDrawer(tr.dataset.cust)));
}

function erpOpenCustomerDrawer(id) {
  const c = ERP.customers.find(x => x.id === id); if (!c) return;
  const fleetCount = ERP.trucks.filter(t => t.ownerId === id).length;
  const pos = ERP.purchaseOrders.filter(p => p.customerId === id).slice(0, 6);
  erpOpenOverlay("erp-drawer-overlay", `
    <div class="erp-drawer">
      <div class="erp-drawer-header">
        <div><h3>${c.name}</h3><div class="sub">${c.id} &middot; ${c.category} &middot; ${c.account}</div></div>
        <button class="erp-drawer-close" id="erp-drawer-close"><i data-lucide="x"></i></button>
      </div>
      <div class="erp-drawer-body">
        <div class="erp-drawer-section">
          <div class="erp-section-title">Account</div>
          <div class="metric-line"><span class="k">Wallet balance</span><span class="v">${erpFmtKD(c.wallet)}</span></div>
          <div class="metric-line"><span class="k">Credit terms</span><span class="v">${c.creditTerms}</span></div>
          <div class="metric-line"><span class="k">Status</span><span class="v">${erpTag(c.status)}</span></div>
          <div class="metric-line"><span class="k">Fleet size</span><span class="v">${fleetCount} truck${fleetCount === 1 ? "" : "s"}</span></div>
          <div class="metric-line"><span class="k">Registered</span><span class="v">${c.registeredSince}</span></div>
        </div>
        <div class="erp-drawer-section">
          <div class="erp-section-title">KYC checklist</div>
          <div class="erp-kyc-row"><span>Civil ID</span>${erpTag(c.kyc.civilId.status)}</div>
          <div class="erp-kyc-row"><span>CR copy</span>${erpTag(c.kyc.crCopy.status)}</div>
          <div class="erp-kyc-row"><span>Tanker calibration cert</span>${erpTag(c.kyc.calibrationCert.status)}</div>
        </div>
        <div class="erp-drawer-section">
          <div class="erp-section-title">PO history</div>
          ${pos.length ? pos.map(p => `<div class="metric-line"><span class="k">${p.id}</span><span class="v">${erpTag(p.status)}</span></div>`).join("") : `<div class="erp-empty">No purchase orders yet.</div>`}
        </div>
        <div class="erp-drawer-section">
          <div class="erp-section-title">Contact</div>
          <div class="metric-line"><span class="k">Contact</span><span class="v">${c.contact}</span></div>
          <div class="metric-line"><span class="k">Phone</span><span class="v">${c.phone}</span></div>
          <div class="metric-line"><span class="k">Email</span><span class="v">${c.email}</span></div>
        </div>
      </div>
      <div class="erp-drawer-footer">
        ${c.status === "Suspended"
          ? `<button class="btn btn-primary" id="erp-cust-toggle"><i data-lucide="check-circle"></i> Re-activate</button>`
          : `<button class="btn btn-red" id="erp-cust-toggle"><i data-lucide="ban"></i> Suspend</button>`}
      </div>
    </div>`);
  document.getElementById("erp-drawer-close").addEventListener("click", erpCloseOverlay);
  document.getElementById("erp-cust-toggle").addEventListener("click", () => {
    const before = c.status;
    c.status = before === "Suspended" ? "Active" : "Suspended";
    erpAudit("F. Al-Ansari (Ops Manager)", c.status === "Suspended" ? "Customer suspended" : "Customer re-activated", c.id, before, c.status);
    erpSave();
    erpCloseOverlay();
    erpRenderCustomersScreen();
  });
}

SIAP.registerView({
  id: "erp-customers", title: "Customers & Accounts", sub: "10 tanker owners · KYC · wallet · fleet",
  group: "erp", icon: "building-2", navLabel: "Customers & Accounts",
  html: `<div class="card">
    <div class="card-title">Customers &amp; Accounts <span class="hint">search, filter, open a record</span></div>
    <div class="erp-toolbar">
      <input class="erp-search" id="erp-cust-search" placeholder="Search name, account, CR no…" />
      <select class="select" id="erp-cust-filter"><option value="">All statuses</option><option>Active</option><option>Suspended</option><option>Pending KYC</option></select>
    </div>
    <div class="erp-scroll-x"><table class="data-table">
      <thead><tr><th>ID</th><th>Customer</th><th>Category</th><th>Account</th><th>Wallet</th><th>Status</th><th>Since</th></tr></thead>
      <tbody id="erp-cust-tbody"></tbody>
    </table></div>
  </div>`,
  onMount(section) {
    section.querySelector("#erp-cust-search").addEventListener("input", erpRenderCustomersScreen);
    section.querySelector("#erp-cust-filter").addEventListener("change", erpRenderCustomersScreen);
    erpRenderCustomersScreen();
  },
  onShow() { erpRenderCustomersScreen(); },
});

/* ============================================================
   VIEW 4 — Fleet & Drivers (erp-fleet)
   ============================================================ */
function erpRenderFleetScreen() {
  const section = document.getElementById("view-erp-fleet"); if (!section) return;
  const tq = ((section.querySelector("#erp-truck-search") || {}).value || "").toLowerCase();
  const truckRows = ERP.trucks.filter(t => !tq || (t.plate + t.ownerName + t.id).toLowerCase().includes(tq));
  section.querySelector("#erp-truck-tbody").innerHTML = truckRows.map(t => `
    <tr>
      <td class="mono">${t.id}</td><td class="mono">${t.plate}</td><td>${t.ownerName}</td>
      <td class="mono">${t.capacityIG.toLocaleString()} IG</td><td>${t.make}</td>
      <td>${t.calibCertNo}<br>${erpExpiryBadge(t.calibExpiry)}</td>
      <td>${t.hatchType}</td><td>${erpTag(t.status)}</td>
    </tr>`).join("");

  const dq = ((section.querySelector("#erp-driver-search") || {}).value || "").toLowerCase();
  const driverRows = ERP.drivers.filter(d => !dq || (d.name + d.civilId).toLowerCase().includes(dq));
  section.querySelector("#erp-driver-tbody").innerHTML = driverRows.map(d => {
    const truckOptions = [`<option value="">— none —</option>`].concat(
      ERP.trucks.map(t => `<option value="${t.id}" ${d.assignedTruckIds[0] === t.id ? "selected" : ""}>${t.plate} (${t.id})</option>`)
    ).join("");
    return `<tr>
      <td class="mono">${d.id}</td><td>${d.name}</td><td class="mono">${d.civilId}</td>
      <td>${erpExpiryBadge(d.licenceExpiry)}</td><td class="mono">${d.phone}</td>
      <td><select class="select erp-driver-truck" data-driver="${d.id}">${truckOptions}</select></td>
      <td>${erpTag(d.status)}</td>
    </tr>`;
  }).join("");
  section.querySelectorAll(".erp-driver-truck").forEach(sel => sel.addEventListener("change", e => {
    const driver = ERP.drivers.find(x => x.id === e.target.dataset.driver);
    driver.assignedTruckIds = e.target.value ? [e.target.value] : [];
    erpAudit("System", "Driver linked to truck", driver.id, "—", e.target.value || "none");
    erpSave();
  }));
  if (window.lucide) lucide.createIcons();
}

function erpOpenTruckForm() {
  const defaultPlate = randPlate();
  erpOpenOverlay("erp-modal-overlay", `
    <div class="erp-modal">
      <div class="erp-modal-header"><h3>Register Truck</h3><button class="erp-modal-close" id="erp-tf-close"><i data-lucide="x"></i></button></div>
      <div class="erp-modal-body">
        <div class="erp-form-grid">
          <div class="erp-form-row"><label>Owner</label><select id="erp-tf-owner">${ERP.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}</select></div>
          <div class="erp-form-row"><label>Plate</label><input class="erp-input" id="erp-tf-plate" value="${defaultPlate}"></div>
          <div class="erp-form-row"><label>Capacity (IG)</label><select id="erp-tf-cap">${ERP_CAPACITIES.map(c => `<option value="${c}">${c.toLocaleString()}</option>`).join("")}</select></div>
          <div class="erp-form-row"><label>Make</label><select id="erp-tf-make">${ERP_TRUCK_MAKES.map(m => `<option>${m}</option>`).join("")}</select></div>
          <div class="erp-form-row"><label>Calibration cert no.</label><input class="erp-input" id="erp-tf-cert" value="CAL-${9000 + Math.floor(Math.random() * 900)}"></div>
          <div class="erp-form-row"><label>Calibration expiry</label><input class="erp-input" type="date" id="erp-tf-expiry" value="${new Date(erpDaysFromNow(365)).toISOString().slice(0, 10)}"></div>
          <div class="erp-form-row"><label>Hatch type</label><select id="erp-tf-hatch"><option>Top hatch</option><option>Rear valve</option></select></div>
        </div>
      </div>
      <div class="erp-modal-footer"><button class="btn" id="erp-tf-cancel">Cancel</button><button class="btn btn-primary" id="erp-tf-save"><i data-lucide="check"></i> Register</button></div>
    </div>`);
  document.getElementById("erp-tf-close").addEventListener("click", erpCloseOverlay);
  document.getElementById("erp-tf-cancel").addEventListener("click", erpCloseOverlay);
  document.getElementById("erp-tf-save").addEventListener("click", () => {
    const owner = ERP.customers.find(c => c.id === document.getElementById("erp-tf-owner").value);
    const truck = {
      id: `TRK-${erpPad(4300 + Math.floor(Math.random() * 600))}`,
      plate: document.getElementById("erp-tf-plate").value || randPlate(),
      ownerId: owner.id, ownerName: owner.name,
      capacityIG: +document.getElementById("erp-tf-cap").value,
      make: document.getElementById("erp-tf-make").value,
      calibCertNo: document.getElementById("erp-tf-cert").value,
      calibExpiry: new Date(document.getElementById("erp-tf-expiry").value).getTime() || erpDaysFromNow(365),
      hatchType: document.getElementById("erp-tf-hatch").value,
      status: "Active",
      rfidTag: `RFID-T${erpPad(9500 + Math.floor(Math.random() * 400))}`,
    };
    ERP.trucks.unshift(truck);
    erpAudit("System", "Truck registered", truck.id, "—", "Active");
    erpSave();
    erpCloseOverlay();
    erpRenderFleetScreen();
  });
  if (window.lucide) lucide.createIcons();
}

function erpOpenDriverForm() {
  const unassigned = ERP.trucks.filter(t => !ERP.drivers.some(d => d.assignedTruckIds.includes(t.id)));
  erpOpenOverlay("erp-modal-overlay", `
    <div class="erp-modal">
      <div class="erp-modal-header"><h3>Register Driver</h3><button class="erp-modal-close" id="erp-df-close"><i data-lucide="x"></i></button></div>
      <div class="erp-modal-body">
        <div class="erp-form-grid">
          <div class="erp-form-row"><label>Full name</label><input class="erp-input" id="erp-df-name" placeholder="e.g. Ahmad Al-Fahad"></div>
          <div class="erp-form-row"><label>Civil ID (masked on save)</label><input class="erp-input" id="erp-df-civil" placeholder="28XXXXXXXXXX"></div>
          <div class="erp-form-row"><label>Licence expiry</label><input class="erp-input" type="date" id="erp-df-expiry" value="${new Date(erpDaysFromNow(300)).toISOString().slice(0, 10)}"></div>
          <div class="erp-form-row"><label>Phone</label><input class="erp-input" id="erp-df-phone" placeholder="+965 5xxxxxxx"></div>
          <div class="erp-form-row erp-form-1col"><label>Assign truck (optional)</label>
            <select id="erp-df-truck"><option value="">— none —</option>${unassigned.map(t => `<option value="${t.id}">${t.plate} (${t.id})</option>`).join("")}</select>
          </div>
        </div>
      </div>
      <div class="erp-modal-footer"><button class="btn" id="erp-df-cancel">Cancel</button><button class="btn btn-primary" id="erp-df-save"><i data-lucide="check"></i> Register</button></div>
    </div>`);
  document.getElementById("erp-df-close").addEventListener("click", erpCloseOverlay);
  document.getElementById("erp-df-cancel").addEventListener("click", erpCloseOverlay);
  document.getElementById("erp-df-save").addEventListener("click", () => {
    const name = document.getElementById("erp-df-name").value.trim() || "New Driver";
    const truckId = document.getElementById("erp-df-truck").value;
    const civilRaw = document.getElementById("erp-df-civil").value.trim();
    const driver = {
      id: `DRV-${erpPad(7200 + Math.floor(Math.random() * 600))}`,
      name,
      civilId: civilRaw ? erpMaskCivilId(civilRaw.length * 7 + name.length) : erpMaskCivilId(name.length + Math.floor(Math.random() * 90)),
      licenceClass: "Heavy Goods · Class 4",
      licenceExpiry: new Date(document.getElementById("erp-df-expiry").value).getTime() || erpDaysFromNow(300),
      phone: document.getElementById("erp-df-phone").value || "+965 50000000",
      assignedTruckIds: truckId ? [truckId] : [],
      status: "Active",
      initials: erpInitials(name),
    };
    ERP.drivers.unshift(driver);
    erpAudit("System", "Driver registered", driver.id, "—", "Active");
    erpSave();
    erpCloseOverlay();
    erpRenderFleetScreen();
  });
  if (window.lucide) lucide.createIcons();
}

function erpScanPlate(plateInput) {
  const truck = ERP.trucks.find(t => t.plate === plateInput);
  const now = Date.now();
  const row = truck
    ? { time: erpTimeStr(now), plate: plateInput, owner: truck.ownerName, gate: "Entry", status: `Matched · Bay ${1 + Math.floor(Math.random() * 42)}` }
    : { time: erpTimeStr(now), plate: plateInput, owner: "—", gate: "Entry", status: "No match · Gate held" };
  if (Array.isArray(state.lprLog)) {
    state.lprLog.unshift(row);
    state.lprLog = state.lprLog.slice(0, 8);
    if (typeof renderLprLog === "function") renderLprLog();
  }
  erpAudit("System", "LPR scan test", plateInput, "—", truck ? "Matched" : "No match");
  erpSave();
  erpCloseOverlay();
}

function erpOpenScanPlateModal() {
  const sample = ERP.trucks[Math.floor(Math.random() * ERP.trucks.length)];
  erpOpenOverlay("erp-modal-overlay", `
    <div class="erp-modal" style="width:420px;">
      <div class="erp-modal-header"><h3>Scan plate — LPR test</h3><button class="erp-modal-close" id="erp-sp-close"><i data-lucide="x"></i></button></div>
      <div class="erp-modal-body">
        <div class="erp-form-row"><label>Plate</label><input class="erp-input" id="erp-sp-plate" value="${sample.plate}"></div>
        <div class="erp-form-note">Matches against the registered fleet and writes to the CCTV &amp; LPR log.</div>
      </div>
      <div class="erp-modal-footer"><button class="btn" id="erp-sp-cancel">Cancel</button><button class="btn btn-primary" id="erp-sp-scan"><i data-lucide="scan-line"></i> Scan</button></div>
    </div>`);
  document.getElementById("erp-sp-close").addEventListener("click", erpCloseOverlay);
  document.getElementById("erp-sp-cancel").addEventListener("click", erpCloseOverlay);
  document.getElementById("erp-sp-scan").addEventListener("click", () => erpScanPlate(document.getElementById("erp-sp-plate").value.trim()));
  if (window.lucide) lucide.createIcons();
}

SIAP.registerView({
  id: "erp-fleet", title: "Fleet & Drivers", sub: "24 trucks · 24 drivers · calibration & licences",
  group: "erp", icon: "truck", navLabel: "Fleet & Drivers",
  html: `<div class="card">
    <div class="card-title">Fleet &amp; Drivers <span class="hint">register, link, LPR-test</span></div>
    <div class="erp-tabs">
      <div class="erp-tab active" data-tab="trucks">Trucks</div>
      <div class="erp-tab" data-tab="drivers">Drivers</div>
    </div>
    <div class="erp-tabpanel active" id="erp-fleet-trucks">
      <div class="erp-toolbar">
        <input class="erp-search" id="erp-truck-search" placeholder="Search plate, owner, truck id…" />
        <button class="btn btn-sm" id="erp-scan-plate-btn"><i data-lucide="scan-line"></i> Scan plate</button>
        <button class="btn btn-primary btn-sm" id="erp-truck-new"><i data-lucide="plus"></i> Register truck</button>
      </div>
      <div class="erp-scroll-x"><table class="data-table">
        <thead><tr><th>ID</th><th>Plate</th><th>Owner</th><th>Capacity</th><th>Make</th><th>Calibration</th><th>Hatch</th><th>Status</th></tr></thead>
        <tbody id="erp-truck-tbody"></tbody>
      </table></div>
    </div>
    <div class="erp-tabpanel" id="erp-fleet-drivers">
      <div class="erp-toolbar">
        <input class="erp-search" id="erp-driver-search" placeholder="Search name, civil id…" />
        <button class="btn btn-primary btn-sm" id="erp-driver-new"><i data-lucide="plus"></i> Register driver</button>
      </div>
      <div class="erp-scroll-x"><table class="data-table">
        <thead><tr><th>ID</th><th>Name</th><th>Civil ID</th><th>Licence expiry</th><th>Phone</th><th>Truck</th><th>Status</th></tr></thead>
        <tbody id="erp-driver-tbody"></tbody>
      </table></div>
    </div>
  </div>`,
  onMount(section) {
    section.querySelectorAll(".erp-tab").forEach(tab => tab.addEventListener("click", () => {
      section.querySelectorAll(".erp-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      section.querySelectorAll(".erp-tabpanel").forEach(p => p.classList.remove("active"));
      section.querySelector(`#erp-fleet-${tab.dataset.tab}`).classList.add("active");
    }));
    section.querySelector("#erp-truck-search").addEventListener("input", erpRenderFleetScreen);
    section.querySelector("#erp-driver-search").addEventListener("input", erpRenderFleetScreen);
    section.querySelector("#erp-truck-new").addEventListener("click", erpOpenTruckForm);
    section.querySelector("#erp-driver-new").addEventListener("click", erpOpenDriverForm);
    section.querySelector("#erp-scan-plate-btn").addEventListener("click", erpOpenScanPlateModal);
    erpRenderFleetScreen();
  },
  onShow() { erpRenderFleetScreen(); },
});

/* ============================================================
   VIEW 5 — Access Credentials (erp-cards) — kanban + card mock
   ============================================================ */
function erpQrCells(seedStr) {
  let s = 0; for (let i = 0; i < seedStr.length; i++) s += seedStr.charCodeAt(i) * (i + 7);
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  let cells = "";
  for (let i = 0; i < 49; i++) cells += `<div class="erp-qr-cell ${rand() > 0.52 ? "on" : ""}"></div>`;
  return cells;
}

function erpRenderCardMockHtml(card) {
  const masked = `•••• •••• •••• ${card.id.slice(-4)}`;
  return `
    <div class="erp-card-mock">
      <div class="erp-card-top">
        <div class="erp-card-brand">MEW <span class="sub">S!aP Access</span></div>
      </div>
      <div class="erp-card-chip"></div>
      <div class="erp-card-type">${card.type}</div>
      <div class="erp-card-number">${masked}</div>
      <div class="erp-card-bottom">
        <div class="erp-card-name"><span class="label">Cardholder</span>${card.driverName || "—"}</div>
        <div class="erp-card-qr">${erpQrCells(card.id)}</div>
      </div>
    </div>
    <div class="erp-card-side">
      <div class="metric-line"><span class="k">Customer</span><span class="v">${card.customerName}</span></div>
      <div class="metric-line"><span class="k">Truck</span><span class="v">${card.truckPlate || "—"}</span></div>
      <div class="metric-line"><span class="k">Status</span><span class="v">${erpTag(card.status)}</span></div>
      <div class="metric-line"><span class="k">PIN attempts</span><span class="v">${card.pinAttempts}/3</span></div>
      <div class="metric-line"><span class="k">Issued</span><span class="v">${erpDateStr(card.issuedAt)}</span></div>
      <div class="metric-line"><span class="k">Expiry</span><span class="v">${erpDateStr(card.expiry)}</span></div>
    </div>`;
}

function erpCardAdvanceButton(c) {
  const next = { Requested: "Printed", Printed: "Activated", Suspended: "Activated" }[c.status];
  if (!next) return "";
  return `<button class="btn btn-sm" data-advance="${c.id}" data-to="${next}">&rarr; ${next}</button>`;
}

function erpAdvanceCard(id, to) {
  const c = ERP.credentials.find(x => x.id === id); if (!c) return;
  const before = c.status; c.status = to; if (to === "Activated") c.pinAttempts = 0;
  erpAudit("System", `Card ${to.toLowerCase()}`, c.id, before, to);
  erpSave();
  erpRenderCardsScreen();
}

function erpRenderCardPreview() {
  const section = document.getElementById("view-erp-cards"); if (!section) return;
  const sel = section.querySelector("#erp-card-select");
  const card = ERP.credentials.find(c => c.id === sel.value);
  section.querySelector("#erp-card-preview").innerHTML = card ? erpRenderCardMockHtml(card) : `<div class="erp-empty">No cards yet — issue one above.</div>`;
  if (window.lucide) lucide.createIcons();
}

function erpRenderCardsScreen() {
  const section = document.getElementById("view-erp-cards"); if (!section) return;
  const cols = ["Requested", "Printed", "Activated", "Suspended"];
  const kanban = section.querySelector("#erp-card-kanban");
  kanban.innerHTML = cols.map(col => {
    const items = ERP.credentials.filter(c => col === "Suspended" ? ["Suspended", "Lost", "Expired"].includes(c.status) : c.status === col);
    return `
      <div class="erp-kanban-col">
        <div class="erp-kanban-head"><span>${col}</span><span>${items.length}</span></div>
        ${items.length ? items.map(c => `
          <div class="erp-kanban-card">
            <div class="id">${c.id}</div>
            <div class="meta">${c.type} &middot; ${c.customerName}</div>
            <div class="meta">${c.truckPlate || "—"} &middot; ${c.driverName || "—"}</div>
            ${c.pinAttempts > 0 ? `<div class="attempts">${c.pinAttempts}/3 PIN attempts</div>` : ""}
            <div class="erp-inline-actions" style="margin-top:7px;">${erpCardAdvanceButton(c)}</div>
          </div>`).join("") : `<div class="erp-empty">Empty</div>`}
      </div>`;
  }).join("");
  kanban.querySelectorAll("[data-advance]").forEach(btn => btn.addEventListener("click", () => erpAdvanceCard(btn.dataset.advance, btn.dataset.to)));

  const sel = section.querySelector("#erp-card-select");
  const prevVal = sel.value;
  sel.innerHTML = ERP.credentials.map(c => `<option value="${c.id}">${c.id} — ${c.customerName}</option>`).join("");
  if (ERP.credentials.some(c => c.id === prevVal)) sel.value = prevVal;
  erpRenderCardPreview();
  sel.onchange = erpRenderCardPreview;
  if (window.lucide) lucide.createIcons();
}

function erpOpenIssueCardForm() {
  erpOpenOverlay("erp-modal-overlay", `
    <div class="erp-modal">
      <div class="erp-modal-header"><h3>Issue Access Card</h3><button class="erp-modal-close" id="erp-ic-close"><i data-lucide="x"></i></button></div>
      <div class="erp-modal-body">
        <div class="erp-form-grid">
          <div class="erp-form-row"><label>Type</label><select id="erp-ic-type"><option>RFID + PIN</option><option>QR + PIN</option><option>RFID + QR</option></select></div>
          <div class="erp-form-row"><label>Customer</label><select id="erp-ic-cust">${ERP.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}</select></div>
          <div class="erp-form-row"><label>Truck</label><select id="erp-ic-truck"></select></div>
          <div class="erp-form-row"><label>Driver</label><select id="erp-ic-driver"></select></div>
          <div class="erp-form-row"><label>Set PIN (4 digits)</label><input class="erp-input" id="erp-ic-pin" maxlength="4" inputmode="numeric" placeholder="••••"></div>
        </div>
      </div>
      <div class="erp-modal-footer"><button class="btn" id="erp-ic-cancel">Cancel</button><button class="btn btn-primary" id="erp-ic-save"><i data-lucide="credit-card"></i> Issue card</button></div>
    </div>`);
  const custSel = document.getElementById("erp-ic-cust");
  const fillLinked = () => {
    const custId = custSel.value;
    const trucks = ERP.trucks.filter(t => t.ownerId === custId);
    document.getElementById("erp-ic-truck").innerHTML = trucks.length ? trucks.map(t => `<option value="${t.id}">${t.plate}</option>`).join("") : `<option value="">—</option>`;
    const truckIds = new Set(trucks.map(t => t.id));
    const drivers = ERP.drivers.filter(d => d.assignedTruckIds.some(id => truckIds.has(id)));
    const pool = drivers.length ? drivers : ERP.drivers;
    document.getElementById("erp-ic-driver").innerHTML = pool.map(d => `<option value="${d.id}">${d.name}</option>`).join("");
  };
  custSel.addEventListener("change", fillLinked); fillLinked();
  document.getElementById("erp-ic-close").addEventListener("click", erpCloseOverlay);
  document.getElementById("erp-ic-cancel").addEventListener("click", erpCloseOverlay);
  document.getElementById("erp-ic-save").addEventListener("click", () => {
    const customer = ERP.customers.find(c => c.id === custSel.value);
    const truckId = document.getElementById("erp-ic-truck").value;
    const truck = ERP.trucks.find(t => t.id === truckId);
    const driverId = document.getElementById("erp-ic-driver").value;
    const driver = ERP.drivers.find(d => d.id === driverId);
    const card = {
      id: `CARD-${erpPad(10600 + Math.floor(Math.random() * 300))}`,
      type: document.getElementById("erp-ic-type").value,
      customerId: customer.id, customerName: customer.name,
      truckId: truck ? truck.id : "", truckPlate: truck ? truck.plate : "—",
      driverId: driver ? driver.id : "", driverName: driver ? driver.name : "—",
      pinAttempts: 0, status: "Requested", issuedAt: Date.now(), expiry: erpDaysFromNow(365),
    };
    ERP.credentials.unshift(card);
    erpAudit("System", "Card requested", card.id, "—", "Requested");
    erpSave();
    erpCloseOverlay();
    erpRenderCardsScreen();
  });
  if (window.lucide) lucide.createIcons();
}

function erpSimulateWrongPins() {
  const section = document.getElementById("view-erp-cards"); if (!section) return;
  const sel = section.querySelector("#erp-card-select");
  const card = ERP.credentials.find(c => c.id === sel.value);
  if (!card) return;
  card.pinAttempts = 3; card.status = "Suspended";
  erpAudit("System", "3 wrong PIN attempts", card.id, "Activated", "Suspended");
  state.alarms.unshift({ id: state.nextAlarmId++, sev: "crit", text: `Card ${card.id} — 3 failed PIN attempts, account ${card.customerName} locked`, ts: Date.now(), ack: false });
  state.alarms = state.alarms.slice(0, 12);
  if (typeof renderAlarms === "function") renderAlarms();
  if (typeof renderAlarmBanner === "function") renderAlarmBanner();
  if (typeof updateOpenAlarmsKpi === "function") updateOpenAlarmsKpi();
  erpSave();
  erpRenderCardsScreen();
}

SIAP.registerView({
  id: "erp-cards", title: "Access Credentials", sub: "RFID / QR / PIN lifecycle",
  group: "erp", icon: "credit-card", navLabel: "Access Credentials",
  html: `<div class="card">
    <div class="card-title">Access Credentials <span class="hint">kanban lifecycle</span></div>
    <div class="erp-toolbar"><div class="spacer" style="flex:1"></div><button class="btn btn-primary btn-sm" id="erp-card-issue-btn"><i data-lucide="plus"></i> Issue card</button></div>
    <div class="erp-kanban" id="erp-card-kanban"></div>
  </div>
  <div class="card" style="margin-top:16px;">
    <div class="card-title">Card preview <span class="hint">select a card &middot; run a PIN-abuse drill</span></div>
    <div class="erp-toolbar">
      <select class="select" id="erp-card-select"></select>
      <button class="btn btn-sm btn-red" id="erp-card-wrongpin"><i data-lucide="shield-alert"></i> Simulate 3 wrong PINs</button>
    </div>
    <div class="erp-card-wrap" id="erp-card-preview"></div>
  </div>`,
  onMount(section) {
    section.querySelector("#erp-card-issue-btn").addEventListener("click", erpOpenIssueCardForm);
    section.querySelector("#erp-card-wrongpin").addEventListener("click", erpSimulateWrongPins);
    erpRenderCardsScreen();
  },
  onShow() { erpRenderCardsScreen(); },
});

/* ============================================================
   VIEW 6 — ERP Integration (erp-integration)
   ============================================================ */
function erpRenderIntegrationScreen() {
  const section = document.getElementById("view-erp-integration"); if (!section) return;
  section.querySelector("#erp-connector-grid").innerHTML = ERP.connectors.map(c => {
    const dotClass = c.status === "Connected" ? "up" : c.status === "Degraded" ? "degraded" : "down";
    return `
      <div class="erp-connector-tile">
        <div class="erp-connector-top">
          <div><div class="erp-connector-name"><span class="erp-connector-dot ${dotClass}"></span>${c.name}</div><div class="erp-connector-proto">${c.protocol}</div></div>
          ${erpTag(c.status)}
        </div>
        <div class="metric-line"><span class="k">Last sync</span><span class="v">${erpDateTimeStr(c.lastSync)}</span></div>
        <div class="metric-line"><span class="k">Latency</span><span class="v">${c.latencyMs} ms</span></div>
        <div class="metric-line"><span class="k">Objects synced</span><span class="v">${c.objectsSynced.toLocaleString()}</span></div>
      </div>`;
  }).join("");

  const bannerSlot = section.querySelector("#erp-outage-banner-slot");
  bannerSlot.innerHTML = erpOutage.active
    ? `<div class="erp-outage-banner"><span class="dot"></span> ERP link down — Al Dhaher continues on last-known master data &middot; ${erpOutage.buffered} txns buffered (store-and-forward)</div>`
    : "";
  const toggleBtn = section.querySelector("#erp-outage-toggle");
  toggleBtn.innerHTML = erpOutage.active ? `<i data-lucide="rotate-cw"></i> Replay buffered txns` : `<i data-lucide="power-off"></i> Simulate outage`;
  toggleBtn.className = erpOutage.active ? "btn btn-primary btn-sm" : "btn btn-red btn-sm";

  section.querySelector("#erp-mapping-tbody").innerHTML = ERP.mapping.map(m => `
    <tr><td>${m.object}</td><td class="erp-muted">${m.saip}</td><td class="mono">${m.erp}</td><td>${m.frequency}</td><td>${m.direction}</td></tr>`).join("");

  section.querySelector("#erp-sync-tbody").innerHTML = ERP.erpSync.slice(0, 14).map(s => {
    const connector = ERP.connectors.find(c => c.id === s.connector);
    const canRetry = s.status === "Failed" || s.status === "Pending";
    return `<tr>
      <td class="mono">${erpTimeStr(s.ts)}</td><td>${connector ? connector.name : s.connector}</td><td>${s.object}</td>
      <td>${s.direction}</td><td>${erpTag(s.status)}</td><td>${s.retries}</td>
      <td>${canRetry ? `<button class="btn btn-sm" data-retry="${s.id}">Retry</button>` : ""}</td>
    </tr>`;
  }).join("");
  section.querySelectorAll("[data-retry]").forEach(btn => btn.addEventListener("click", () => erpRetrySync(btn.dataset.retry)));

  const mof = ERP.erpSync.find(s => s.object.toLowerCase().includes("settlement")) || ERP.erpSync[0];
  section.querySelector("#erp-mof-line").textContent = mof
    ? `Daily settlement/revenue file to the Ministry of Finance — last batch ${erpDateTimeStr(mof.ts)}, status ${mof.status}.`
    : "No settlement batches yet — run the Order-to-Cash tracker to generate one.";

  if (window.lucide) lucide.createIcons();
}

function erpRetrySync(id) {
  const row = ERP.erpSync.find(s => s.id === id); if (!row) return;
  row.status = "Synced"; row.retries += 1;
  erpAudit("System", "Sync retried", id, "Failed/Pending", "Synced");
  erpSave();
  erpRenderIntegrationScreen();
}

function erpToggleOutage() {
  if (!erpOutage.active) {
    erpOutage.active = true; erpOutage.buffered = 0;
    ERP.connectors.forEach(c => c.status = "Down");
    erpAudit("System", "ERP outage simulated", "all connectors", "Connected", "Down");
  } else {
    ERP.connectors.forEach(c => { c.status = "Connected"; c.lastSync = Date.now(); });
    erpPushSync("sap", `Replayed ${erpOutage.buffered} buffered transactions`, "S!aP → ERP", "Synced", 0);
    erpAudit("System", "ERP link restored — buffered txns replayed", `${erpOutage.buffered} txns`, "Down", "Connected");
    erpOutage.active = false; erpOutage.buffered = 0;
  }
  erpSave();
  erpRenderIntegrationScreen();
}

SIAP.registerView({
  id: "erp-integration", title: "ERP Integration", sub: "SAP S/4HANA · Oracle Fusion · MS Dynamics 365",
  group: "erp", icon: "plug-zap", navLabel: "ERP Integration",
  html: `<div class="erp-connector-grid" id="erp-connector-grid"></div>
  <div class="card" id="erp-outage-card">
    <div class="card-title">Store-and-forward &amp; outage drill <span class="hint">read-only towards bay control</span></div>
    <div id="erp-outage-banner-slot"></div>
    <div class="util-text">If the ERP link drops, S!aP keeps operating on local state and queues finance/master-data objects for replay — the bay control loop and K-net payments are unaffected.</div>
    <button class="btn btn-red btn-sm" id="erp-outage-toggle" style="margin-top:10px;"><i data-lucide="power-off"></i> Simulate outage</button>
  </div>
  <div class="card">
    <div class="card-title">Object mapping <span class="hint">S!aP object &rarr; ERP entity</span></div>
    <div class="erp-scroll-x"><table class="data-table">
      <thead><tr><th>Object</th><th>S!aP source</th><th>ERP entity</th><th>Frequency</th><th>Direction</th></tr></thead>
      <tbody id="erp-mapping-tbody"></tbody>
    </table></div>
  </div>
  <div class="card">
    <div class="card-title">Sync log <span class="hint">connector activity &middot; retry failed/pending</span></div>
    <div class="erp-scroll-x"><table class="data-table">
      <thead><tr><th>Time</th><th>Connector</th><th>Object</th><th>Direction</th><th>Status</th><th>Retries</th><th></th></tr></thead>
      <tbody id="erp-sync-tbody"></tbody>
    </table></div>
  </div>
  <div class="card">
    <div class="card-title">Ministry of Finance interface</div>
    <div class="util-text" id="erp-mof-line"></div>
  </div>`,
  onMount(section) {
    section.querySelector("#erp-outage-toggle").addEventListener("click", erpToggleOutage);
    erpRenderIntegrationScreen();
  },
  onShow() { erpRenderIntegrationScreen(); },
});

/* ============================================================
   VIEW 7 — Tariffs · Work Orders · Audit (erp-admin)
   ============================================================ */
function erpRenderAdminScreen() {
  const section = document.getElementById("view-erp-admin"); if (!section) return;
  section.querySelector("#erp-tariff-tbody").innerHTML = ERP.tariffs.map(t => `
    <tr><td class="mono">${t.id}</td><td>${t.name}</td><td>${t.tier}</td><td class="mono">KD ${t.rate}</td><td>${t.vat}%</td><td class="mono">${t.minIG.toLocaleString()}</td></tr>`).join("");
  section.querySelector("#erp-wo-tbody").innerHTML = ERP.workOrders.map(w => `
    <tr><td class="mono">${w.id}</td><td>${w.title}</td><td>${erpPriorityTag(w.priority)}</td><td>${w.assignee}</td><td class="erp-muted">${w.due}</td><td>${erpTag(w.status)}</td></tr>`).join("");
  section.querySelector("#erp-audit-tbody").innerHTML = ERP.audit.slice(0, 40).map(a => `
    <tr><td class="mono">${erpDateTimeStr(a.ts)}</td><td>${a.user}</td><td>${a.action}</td><td class="mono">${a.object}</td><td class="erp-muted">${a.before}</td><td class="erp-muted">${a.after}</td></tr>`).join("");
  if (window.lucide) lucide.createIcons();
}

SIAP.registerView({
  id: "erp-admin", title: "Tariffs · Work Orders · Audit", sub: "contract rates · CMMS · immutable log",
  group: "erp", icon: "shield-check", navLabel: "Tariffs · WOs · Audit",
  html: `<div class="card">
    <div class="card-title">Tariffs &middot; Work Orders &middot; Audit</div>
    <div class="erp-tabs">
      <div class="erp-tab active" data-tab="tariffs">Tariffs</div>
      <div class="erp-tab" data-tab="workorders">Work Orders</div>
      <div class="erp-tab" data-tab="audit">Audit Trail</div>
    </div>
    <div class="erp-tabpanel active" id="erp-admin-tariffs">
      <table class="data-table"><thead><tr><th>ID</th><th>Name</th><th>Tier</th><th>Rate</th><th>VAT</th><th>Min. IG</th></tr></thead><tbody id="erp-tariff-tbody"></tbody></table>
    </div>
    <div class="erp-tabpanel" id="erp-admin-workorders">
      <table class="data-table"><thead><tr><th>ID</th><th>Title</th><th>Priority</th><th>Assignee</th><th>Due</th><th>Status</th></tr></thead><tbody id="erp-wo-tbody"></tbody></table>
    </div>
    <div class="erp-tabpanel" id="erp-admin-audit">
      <div class="erp-toolbar"><div class="spacer" style="flex:1"></div><button class="btn btn-sm" id="erp-reset-data-2"><i data-lucide="database-backup"></i> Reset demo data</button></div>
      <div class="erp-scroll-x"><table class="data-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Object</th><th>Before</th><th>After</th></tr></thead><tbody id="erp-audit-tbody"></tbody></table></div>
    </div>
  </div>`,
  onMount(section) {
    section.querySelectorAll(".erp-tab").forEach(tab => tab.addEventListener("click", () => {
      section.querySelectorAll(".erp-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      section.querySelectorAll(".erp-tabpanel").forEach(p => p.classList.remove("active"));
      section.querySelector(`#erp-admin-${tab.dataset.tab}`).classList.add("active");
    }));
    section.querySelector("#erp-reset-data-2").addEventListener("click", erpResetDemoData);
    erpRenderAdminScreen();
  },
  onShow() { erpRenderAdminScreen(); },
});

/* ============================================================
   S!a canned answers + dashboard ERP card link + tick wiring
   ============================================================ */
(function erpWireSiaAndTick() {
  const posAwaiting = ERP.purchaseOrders.filter(p => p.status === "Submitted" || p.status === "Approved").length;
  const in30 = Date.now() + 30 * 86400000;
  const expiring = ERP.trucks.filter(t => t.calibExpiry <= in30);
  const lastFill = (state.ledger || []).find(r => r.type === "Fill (debit)" && r.channel === "Bay 14");

  Object.assign(state.siaResponses, {
    "how many pos are awaiting approval?":
      `${posAwaiting} purchase order${posAwaiting === 1 ? " is" : "s are"} awaiting approval (Submitted or Approved, not yet invoiced).\n\nOpen Enterprise &amp; ERP → Purchase Orders to review and approve, or run the Order-to-Cash Tracker to see one move through the full approve → invoice → pay lifecycle live.\n\nConfidence: 96% · source: ERP.purchaseOrders (S!aP ERP module).`,
    "which trucks have calibration expiring this month?":
      expiring.length
        ? `${expiring.length} truck${expiring.length === 1 ? "" : "s"} have a custody-meter calibration certificate expiring within 30 days: ${expiring.slice(0, 5).map(t => `${t.plate} (${t.id})`).join(", ")}${expiring.length > 5 ? "…" : ""}.\n\nRecommend scheduling recalibration via a Work Order before the expiry date — see Enterprise &amp; ERP → Fleet &amp; Drivers for badges, or → Tariffs · Work Orders · Audit to raise a CMMS ticket.\n\nConfidence: 93% · source: ERP.trucks calibration expiry.`
        : `No trucks currently have a calibration certificate expiring within 30 days.\n\nConfidence: 90% · source: ERP.trucks calibration expiry.`,
    "show me the receipt for the last fill at bay 14":
      lastFill
        ? `Last fill at Bay 14 — ${lastFill.volume} IG dispensed, ${lastFill.amount} debited, account ${lastFill.account}, status ${lastFill.status}.\n\nOpen Enterprise &amp; ERP → Order-to-Cash Tracker and press Run to generate a fresh SMS + e-mail receipt for a live fill, including meter serial and K-net reference.\n\nConfidence: 95% · source: state.ledger.`
        : `No fill has completed at Bay 14 yet in this session. Open Enterprise &amp; ERP → Order-to-Cash Tracker and press Run — the receipt (SMS + e-mail, with meter serial and K-net reference) appears automatically once the fill and exact-volume debit complete.\n\nConfidence: 92%.`,
  });

  const dashLink = document.getElementById("dash-erp-link");
  if (dashLink) dashLink.addEventListener("click", () => SIAP.showView("erp-integration"));

  erpSyncQueueKpi();
  SIAP.on("tick", erpOnTick);
})();
