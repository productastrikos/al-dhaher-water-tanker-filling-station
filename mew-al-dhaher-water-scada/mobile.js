/* ==========================================================
   S!aP — MEW Pay mobile companion — standalone demo logic.
   Deliberately self-contained (no data.js dependency) — this
   page is meant to be opened on its own during a demo.
   ========================================================== */

let balance = 139.950;
const activity = [
  { label: "Fill — Bay 14", delta: -8.550, time: "2m ago" },
  { label: "K-net Top-up", delta: 100.000, time: "1h ago" },
  { label: "Fill — Bay 03", delta: -12.100, time: "5h ago" },
  { label: "Fill — Bay 22", delta: -6.820, time: "yesterday" },
  { label: "K-net Top-up", delta: 50.000, time: "2 days ago" },
  { label: "Fill — Bay 08", delta: -9.140, time: "3 days ago" },
];

/* ---------- Fleet / Orders seed data (Al-Salem Transport Co. · KWT-40216) ---------- */
const trucks = [
  { plate: "3 / 84621", capacity: 5000, calibExpiry: "15 Dec 2026", calibStatus: "green" },
  { plate: "7 / 55210", capacity: 8000, calibExpiry: "02 Oct 2026", calibStatus: "amber" },
  { plate: "2 / 19983", capacity: 3000, calibExpiry: "28 Sep 2026", calibStatus: "red" },
];
const drivers = [
  { name: "Yousef Al-Rashidi", licence: "Class 4 · exp 2027", truck: "3 / 84621" },
  { name: "Marwan Haddad", licence: "Class 4 · exp 2026", truck: "7 / 55210" },
];
const PO_RATE_PER_IG = 0.0025; // KD / IG
const PO_STATUS_TAG = { Draft: "gray", Approved: "blue", Invoiced: "amber", Paid: "green", Active: "green" };
let purchaseOrders = [
  { id: "PO-2026-0187", qty: 5000, kd: 12.500, status: "Active" },
  { id: "PO-2026-0186", qty: 3000, kd: 7.500, status: "Invoiced" },
  { id: "PO-2026-0185", qty: 8000, kd: 20.000, status: "Approved" },
  { id: "PO-2026-0184", qty: 4000, kd: 10.000, status: "Draft" },
];

function fmtKD(n) {
  const sign = n < 0 ? "-" : "";
  return `${sign}KD ${Math.abs(n).toFixed(3)}`;
}

function renderBalance() {
  document.getElementById("m-balance").textContent = fmtKD(balance);
}

function activityRow(a) {
  return `
    <div class="m-activity-row">
      <div>
        <div class="m-activity-label">${a.label}</div>
        <div class="m-activity-time">${a.time}</div>
      </div>
      <div class="m-activity-amt ${a.delta >= 0 ? "pos" : "neg"}">${a.delta >= 0 ? "+" : ""}${fmtKD(a.delta)}</div>
    </div>`;
}

function renderActivity() {
  const el = document.getElementById("m-activity");
  if (el) el.innerHTML = activity.slice(0, 4).map(activityRow).join("");
}

function renderHistory() {
  const el = document.getElementById("m-history-list");
  if (el) el.innerHTML = activity.map(activityRow).join("");
}

/* ---------- QR block renderer (reused for wallet QR Pay + Receipt) ---------- */
function renderQrBlock(elId, seed) {
  const block = document.getElementById(elId);
  if (!block) return;
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  let cells = "";
  for (let i = 0; i < 121; i++) cells += `<div class="qr-cell ${rand() > 0.55 ? "on" : ""}"></div>`;
  block.innerHTML = cells;
}
function renderQr() { renderQrBlock("qr-block", 40216); }
function renderReceiptQr() { renderQrBlock("receipt-qr-block", 88213); }

/* ---------- Orders (Purchase Orders) ---------- */
function poRow(po) {
  return `
    <div class="po-row">
      <div>
        <div class="po-id">${po.id}</div>
        <div class="po-sub">${po.qty.toLocaleString()} IG &middot; KD ${po.kd.toFixed(3)}</div>
      </div>
      <span class="tag ${PO_STATUS_TAG[po.status] || "gray"}">${po.status}</span>
    </div>`;
}
function renderOrders() {
  const el = document.getElementById("m-po-list");
  if (el) el.innerHTML = purchaseOrders.map(poRow).join("");
}
function wirePoForm() {
  const qtyInput = document.getElementById("po-qty-input");
  const kdOut = document.getElementById("po-kd-preview");
  if (!qtyInput || !kdOut) return;
  qtyInput.addEventListener("input", () => {
    const qty = parseFloat(qtyInput.value) || 0;
    kdOut.textContent = `KD ${(qty * PO_RATE_PER_IG).toFixed(3)}`;
  });
  document.getElementById("po-submit-btn")?.addEventListener("click", () => {
    const qty = parseFloat(qtyInput.value);
    if (!qty || qty <= 0) { showToast("Enter a quantity to raise a PO"); return; }
    const kd = qty * PO_RATE_PER_IG;
    const seq = 190 + purchaseOrders.length;
    const id = `PO-2026-0${seq}`;
    purchaseOrders.unshift({ id, qty, kd, status: "Draft" });
    renderOrders();
    qtyInput.value = "";
    kdOut.textContent = "KD 0.000";
    showToast(`${id} raised as Draft`);
  });
}

/* ---------- Fleet (trucks, drivers, access card) ---------- */
function truckRow(t) {
  return `
    <div class="fleet-row">
      <div>
        <div class="fleet-title mono">${t.plate}</div>
        <div class="fleet-sub">${t.capacity.toLocaleString()} IG capacity</div>
      </div>
      <span class="tag ${t.calibStatus}">Calib ${t.calibExpiry}</span>
    </div>`;
}
function driverRow(d) {
  return `
    <div class="fleet-row">
      <div>
        <div class="fleet-title">${d.name}</div>
        <div class="fleet-sub">${d.licence} &middot; ${d.truck}</div>
      </div>
    </div>`;
}
function renderFleet() {
  const tEl = document.getElementById("m-truck-list");
  const dEl = document.getElementById("m-driver-list");
  if (tEl) tEl.innerHTML = trucks.map(truckRow).join("");
  if (dEl) dEl.innerHTML = drivers.map(driverRow).join("");
}

const CARD_TIMELINE_STEPS = [
  { key: "requested", label: "Requested" },
  { key: "printed", label: "Printed" },
  { key: "activated", label: "Activated" },
];
function renderCardTimeline(panel, cardId, activeIndex) {
  // Re-render the whole block each step rather than mutating an <i> in place —
  // lucide.createIcons() replaces each <i data-lucide> with an <svg>, so a later
  // querySelector("i") on the same node would find nothing.
  panel.hidden = false;
  panel.innerHTML = `
    <div class="timeline-title">Access card ${cardId}</div>
    ${CARD_TIMELINE_STEPS.map((s, i) => `
      <div class="timeline-step ${i <= activeIndex ? "active" : ""}">
        <i data-lucide="${i < activeIndex ? "check-circle-2" : i === activeIndex ? "circle-dot" : "circle"}"></i> ${s.label}
      </div>`).join("")}
  `;
  lucide.createIcons();
}
function requestAccessCard() {
  const panel = document.getElementById("card-timeline");
  if (!panel) return;
  const cardId = `CARD-${10000 + Math.floor(Math.random() * 89999)}`;
  renderCardTimeline(panel, cardId, 0);
  showToast(`Access card ${cardId} requested`);
  clearTimeout(requestAccessCard._t1);
  clearTimeout(requestAccessCard._t2);
  requestAccessCard._t1 = setTimeout(() => {
    renderCardTimeline(panel, cardId, 1);
    showToast(`Access card ${cardId} printed`);
  }, 1600);
  requestAccessCard._t2 = setTimeout(() => {
    renderCardTimeline(panel, cardId, 2);
    showToast(`Access card ${cardId} activated`);
  }, 3400);
}

function goto(screen) {
  document.querySelectorAll(".mscreen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(`mscreen-${screen}`);
  if (target) target.classList.add("active");
  const underMore = ["stations", "history", "receipt"];
  const tabScreen = underMore.includes(screen) ? "more" : screen;
  document.querySelectorAll(".mtab").forEach(t => t.classList.toggle("active", t.dataset.screen === tabScreen));
  document.querySelector(".mobile-screens").scrollTop = 0;
}

function showToast(msg) {
  let t = document.getElementById("m-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "m-toast";
    t.className = "m-toast";
    document.querySelector(".phone-frame").appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove("show"), 2200);
}

document.addEventListener("DOMContentLoaded", () => {
  renderBalance();
  renderActivity();
  renderHistory();
  renderQr();
  renderReceiptQr();
  renderOrders();
  renderFleet();
  wirePoForm();

  const requestedScreen = new URLSearchParams(window.location.search).get("screen");
  if (requestedScreen && document.getElementById(`mscreen-${requestedScreen}`)) {
    goto(requestedScreen);
  }

  document.querySelectorAll("[data-goto]").forEach(b => b.addEventListener("click", () => goto(b.dataset.goto)));
  document.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", () => goto(b.dataset.back)));
  document.querySelectorAll(".mtab").forEach(t => t.addEventListener("click", () => goto(t.dataset.screen)));

  document.getElementById("push-banner-close")?.addEventListener("click", () => {
    const banner = document.getElementById("push-banner");
    if (banner) banner.hidden = true;
  });

  document.getElementById("request-card-btn")?.addEventListener("click", requestAccessCard);
  document.getElementById("receipt-share-btn")?.addEventListener("click", () => showToast("Receipt shared"));

  document.querySelectorAll(".amt-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".amt-chip").forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
      document.getElementById("topup-custom-input").value = chip.dataset.amt;
    });
  });

  document.getElementById("topup-pay-btn").addEventListener("click", () => {
    const input = document.getElementById("topup-custom-input");
    const amt = parseFloat(input.value);
    if (!amt || amt <= 0) {
      showToast("Enter an amount to top up");
      return;
    }
    balance += amt;
    activity.unshift({ label: "K-net Top-up", delta: amt, time: "just now" });
    renderBalance();
    renderActivity();
    renderHistory();
    input.value = "";
    document.querySelectorAll(".amt-chip").forEach(c => c.classList.remove("selected"));
    showToast(`Topped up KD ${amt.toFixed(3)}`);
    goto("wallet");
  });

  lucide.createIcons();
});
