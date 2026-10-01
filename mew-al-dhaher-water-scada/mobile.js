/* ==========================================================
   S!aP — MEW Pay mobile companion — standalone demo logic.
   Deliberately self-contained (no data.js dependency) — this
   page is meant to be opened on its own during a demo.

   Grounded in the offer PDF's §6.4 spec for the MEW Pay app --
   "registration, wallet management, quick payment, station
   locator and statements" (Android/iOS, EN/AR) -- and the
   workflow deck's three MEW Pay screen states (scan to fill /
   filling in progress / receipt). See docs/IMPLEMENTATION_PLAN.md
   and reference/offer-text-extract.txt for the source requirements.
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

/* ---------- Station locator (26-station Kuwait network) -----------------------------------
   Same station table as network-map.js / docs/KUWAIT_NETWORK_MAP_BRIEF.md, duplicated here on
   purpose: this page is deliberately standalone (no shared backend, works opened cold on a
   phone), so it carries its own copy rather than importing the desktop module. Distances are
   computed from Al Dhaher (this wallet's home station) with a flat-Earth approximation -- Kuwait
   is small enough (~170km across) that this reads as plausible "km away" figures for a demo. */
const HOME_STATION = { lat: 29.055, lon: 48.105 };
const NETWORK_STATIONS = [
  { name: "Al Dhaher", governorate: "Ahmadi", lat: 29.055, lon: 48.105, flagship: true, status: "open" },
  { name: "Fahaheel", governorate: "Ahmadi", lat: 29.083, lon: 48.128, status: "open" },
  { name: "Abu Halifa", governorate: "Ahmadi", lat: 29.114, lon: 48.117, status: "open" },
  { name: "Fintas", governorate: "Ahmadi", lat: 29.164, lon: 48.128, status: "open" },
  { name: "Mina Abdullah", governorate: "Ahmadi", lat: 29.028, lon: 48.146, status: "open" },
  { name: "Shuaiba", governorate: "Ahmadi", lat: 29.027, lon: 48.178, status: "soon" },
  { name: "Sabah Al-Ahmad City", governorate: "Ahmadi", lat: 28.972, lon: 48.086, status: "soon" },
  { name: "Wafra", governorate: "Ahmadi", lat: 28.633, lon: 47.933, status: "soon" },
  { name: "Farwaniya", governorate: "Farwaniya", lat: 29.277, lon: 47.939, status: "open" },
  { name: "Jleeb Al-Shuyoukh", governorate: "Farwaniya", lat: 29.263, lon: 47.925, status: "open" },
  { name: "Khaitan", governorate: "Farwaniya", lat: 29.297, lon: 47.966, status: "soon" },
  { name: "Ardiya", governorate: "Farwaniya", lat: 29.280, lon: 47.900, status: "soon" },
  { name: "Sabah Al-Nasser", governorate: "Farwaniya", lat: 29.240, lon: 47.867, status: "soon" },
  { name: "Andalous", governorate: "Farwaniya", lat: 29.291, lon: 47.953, status: "soon" },
  { name: "Qurain", governorate: "Mubarak Al-Kabeer", lat: 29.267, lon: 48.080, status: "open" },
  { name: "Sabah Al-Salem", governorate: "Mubarak Al-Kabeer", lat: 29.243, lon: 48.098, status: "soon" },
  { name: "Adan", governorate: "Mubarak Al-Kabeer", lat: 29.250, lon: 48.070, status: "soon" },
  { name: "Shuwaikh", governorate: "Al Asimah", lat: 29.343, lon: 47.933, status: "soon" },
  { name: "Sulaibikhat", governorate: "Al Asimah", lat: 29.343, lon: 47.905, status: "soon" },
  { name: "Jahra", governorate: "Jahra", lat: 29.347, lon: 47.660, status: "soon" },
  { name: "Sulaibiya", governorate: "Jahra", lat: 29.296, lon: 47.752, status: "soon" },
  { name: "Amghara", governorate: "Jahra", lat: 29.323, lon: 47.807, status: "soon" },
  { name: "Saad Al-Abdullah", governorate: "Jahra", lat: 29.417, lon: 47.683, status: "soon" },
  { name: "Naeem", governorate: "Jahra", lat: 29.336, lon: 47.678, status: "soon" },
  { name: "Taima", governorate: "Jahra", lat: 29.360, lon: 47.628, status: "soon" },
  { name: "Abdali", governorate: "Jahra", lat: 29.786, lon: 47.555, status: "soon" },
];
function kmBetween(a, b) {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
const STATIONS_WITH_DISTANCE = NETWORK_STATIONS
  .map((s) => ({ ...s, km: kmBetween(HOME_STATION, s) }))
  .sort((a, b) => a.km - b.km);

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
    if (!qty || qty <= 0) { showToast(t("toastEnterQty")); return; }
    const kd = qty * PO_RATE_PER_IG;
    const seq = 190 + purchaseOrders.length;
    const id = `PO-2026-0${seq}`;
    purchaseOrders.unshift({ id, qty, kd, status: "Draft" });
    renderOrders();
    qtyInput.value = "";
    kdOut.textContent = "KD 0.000";
    showToast(`${id} ${t("toastRaisedDraft")}`);
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
  showToast(`${t("toastCardRequested")} ${cardId}`);
  clearTimeout(requestAccessCard._t1);
  clearTimeout(requestAccessCard._t2);
  requestAccessCard._t1 = setTimeout(() => {
    renderCardTimeline(panel, cardId, 1);
    showToast(`${t("toastCardPrinted")} ${cardId}`);
  }, 1600);
  requestAccessCard._t2 = setTimeout(() => {
    renderCardTimeline(panel, cardId, 2);
    showToast(`${t("toastCardActivated")} ${cardId}`);
  }, 3400);
}

/* ---------- Station locator ---------- */
function stationRow(s) {
  const tagClass = s.status === "open" ? "green" : "gray";
  const tagText = s.status === "open" ? t("statusOpen") : t("statusSoon");
  return `
    <div class="station-card${s.flagship ? " station-card-home" : ""}">
      <i data-lucide="${s.flagship ? "star" : "map-pin"}"></i>
      <div>
        <div class="station-name">${s.name}${s.flagship ? ` &middot; ${t("homeStation")}` : ""}</div>
        <div class="station-sub">${s.governorate} &middot; ${s.flagship ? "42" : "2"} ${t("bays")} &middot; ${s.km.toFixed(1)} km</div>
      </div>
      <span class="tag ${tagClass}">${tagText}</span>
    </div>`;
}
function renderStations(filterText) {
  const el = document.getElementById("m-station-list");
  if (!el) return;
  const term = (filterText || "").trim().toLowerCase();
  const list = STATIONS_WITH_DISTANCE.filter((s) =>
    !term || s.name.toLowerCase().includes(term) || s.governorate.toLowerCase().includes(term));
  el.innerHTML = list.map(stationRow).join("") || `<div class="util-text">${t("noStationsMatch")}</div>`;
  lucide.createIcons();
}

/* ---------- PIN authorize step (mirrors the workflow deck's Stage 2: "Scan the bay QR ...
   Enter PIN ... three wrong tries locks the account and alerts the owner") ---------- */
const PIN_STATE = { digits: "", attempts: 0 };
function resetPinStep() {
  PIN_STATE.digits = "";
  PIN_STATE.attempts = 0;
  renderPinDots();
  document.getElementById("pin-error").hidden = true;
}
function renderPinDots() {
  const dots = document.querySelectorAll("#pin-dots .pin-dot");
  dots.forEach((d, i) => d.classList.toggle("filled", i < PIN_STATE.digits.length));
}
function pinKeyPress(key) {
  const errorEl = document.getElementById("pin-error");
  if (key === "clear") { PIN_STATE.digits = ""; renderPinDots(); errorEl.hidden = true; return; }
  if (key === "back") { PIN_STATE.digits = PIN_STATE.digits.slice(0, -1); renderPinDots(); return; }
  if (PIN_STATE.digits.length >= 4) return;
  PIN_STATE.digits += key;
  renderPinDots();
  if (PIN_STATE.digits.length === 4) {
    setTimeout(() => submitPin(), 180); // brief pause so the 4th dot is visible before it resolves
  }
}
function submitPin() {
  const errorEl = document.getElementById("pin-error");
  const errorText = document.getElementById("pin-error-text");
  if (PIN_STATE.digits === "0000") {
    PIN_STATE.attempts += 1;
    const remaining = 3 - PIN_STATE.attempts;
    if (remaining > 0) {
      errorText.textContent = `${t("pinWrong")} ${remaining} ${remaining === 1 ? t("attemptLeft") : t("attemptsLeft")}.`;
      errorEl.hidden = false;
      PIN_STATE.digits = "";
      renderPinDots();
    } else {
      errorText.textContent = t("pinLocked");
      errorEl.hidden = false;
      showToast(t("toastAccountLocked"));
      setTimeout(() => { goto("wallet"); resetPinStep(); showQrStep("scan"); }, 1800);
    }
    return;
  }
  errorEl.hidden = true;
  startFilling();
}
function showQrStep(step) {
  document.getElementById("qr-step-scan").hidden = step !== "scan";
  document.getElementById("qr-step-pin").hidden = step !== "pin";
}

/* ---------- Filling in progress (workflow deck Stage 3/"MEW Pay — filling in progress") ---------- */
const FILL = { bay: 14, target: 5000, ratePerSec: 0, dispensed: 0, timer: null, active: false };
const RING_CIRC = 2 * Math.PI * 52;
function startFilling() {
  FILL.bay = 14;
  FILL.target = 5000;
  FILL.dispensed = 0;
  FILL.active = true;
  FILL.ratePerSec = FILL.target / 7; // ~7s demo fill, fast enough to sit through, slow enough to read
  document.getElementById("filling-target").textContent = FILL.target.toLocaleString();
  document.getElementById("filling-bay-label").textContent = `${t("bay")} ${FILL.bay} · Al Dhaher LFS`;
  const ring = document.getElementById("filling-ring-fill");
  ring.style.strokeDasharray = `${RING_CIRC}`;
  ring.style.strokeDashoffset = `${RING_CIRC}`;
  goto("filling");
  clearInterval(FILL.timer);
  const stepMs = 200;
  FILL.timer = setInterval(() => {
    if (!FILL.active) return;
    FILL.dispensed = Math.min(FILL.target, FILL.dispensed + FILL.ratePerSec * (stepMs / 1000));
    const pct = FILL.dispensed / FILL.target;
    const fineFill = pct > 0.85;
    document.getElementById("filling-pct").textContent = `${Math.round(pct * 100)}%`;
    document.getElementById("filling-volume").textContent = Math.round(FILL.dispensed).toLocaleString();
    document.getElementById("filling-flow").textContent = fineFill ? "9.4 m³/h" : "41.8 m³/h";
    document.getElementById("filling-valve").textContent = fineFill ? t("valveFineFill") : t("valveOpen");
    ring.style.strokeDashoffset = `${RING_CIRC * (1 - pct)}`;
    if (pct >= 1) {
      FILL.active = false;
      clearInterval(FILL.timer);
      setTimeout(() => completeFilling(), 500);
    }
  }, stepMs);
}
function completeFilling() {
  const kd = FILL.target * 0.0025;
  balance -= kd;
  activity.unshift({ label: `Fill — Bay ${FILL.bay}`, delta: -kd, time: "just now" });
  renderBalance();
  renderActivity();
  renderHistory();
  const now = new Date();
  document.getElementById("receipt-bay").textContent = FILL.bay;
  document.getElementById("receipt-volume").textContent = `${FILL.target.toLocaleString()} IG`;
  document.getElementById("receipt-amount").textContent = fmtKD(kd);
  document.getElementById("receipt-time").textContent = `Today ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  renderReceiptQr();
  showToast(t("toastFillComplete"));
  goto("receipt");
  resetPinStep();
  showQrStep("scan");
}

/* ---------- Notifications panel ("add a cross button to the notifications" -- the bell icon
   previously had no click behaviour at all; this gives it a real, dismissible panel). ---------- */
const NOTIFICATIONS = [
  { icon: "navigation", title: "Bay assignment", body: "Proceed to Bay 14 — hatch guidance active.", time: "2m ago" },
  { icon: "receipt", title: "Receipt sent", body: "Last fill receipt sent by SMS & e-mail.", time: "1h ago" },
  { icon: "alert-triangle", title: "Low balance warning", body: "Wallet balance below KD 20 threshold after your next fill.", time: "3h ago" },
];
function renderNotifications() {
  const list = document.getElementById("notif-list");
  if (!list) return;
  list.innerHTML = NOTIFICATIONS.map((n, i) => `
    <div class="notif-row" data-idx="${i}">
      <i data-lucide="${n.icon}"></i>
      <div class="notif-text">
        <div class="notif-title">${n.title}</div>
        <div class="notif-body">${n.body}</div>
        <div class="notif-time">${n.time}</div>
      </div>
      <button class="notif-dismiss" data-dismiss="${i}" aria-label="Dismiss"><i data-lucide="x"></i></button>
    </div>`).join("") || `<div class="util-text" style="padding:14px;">${t("noNotifications")}</div>`;
  lucide.createIcons();
}
function toggleNotifPanel(show) {
  const panel = document.getElementById("notif-panel");
  const backdrop = document.getElementById("notif-backdrop");
  if (!panel) return;
  const willShow = show ?? panel.hidden;
  panel.hidden = !willShow;
  if (backdrop) backdrop.hidden = !willShow;
}

/* ---------- i18n: EN/AR (offer PDF §6.4/Module 5 -- "MEW Pay app (Android/iOS, English/Arabic)")
   Pragmatic demo-grade coverage: every visible chrome label, section title, and key sentence is
   covered via data-i18n; numbers/plate/account formatting stay as-is in both languages. ---------- */
const AR_STRINGS = {
  wallet: "المحفظة", pay: "الدفع", orders: "الطلبات", fleet: "الأسطول", more: "المزيد",
  pushBanner: "التوجه إلى الحوض 14 — إرشادات فتحة التعبئة نشطة · الوصول خلال دقيقتين",
  walletBalanceLabel: "رصيد محفظة المياه", topup: "شحن الرصيد", qrPay: "الدفع بالرمز",
  recentActivity: "النشاط الأخير", topupTitle: "شحن محفظة المياه", payWithKnet: "الدفع عبر K-net",
  demoOnlyPayment: "للعرض فقط — لا تتم أي عملية دفع حقيقية.",
  showAtBay: "اعرض هذا عند الحوض",
  qrScanHint: "امسح عند أي كشك حوض في الظاهر لبدء تعبئة مدفوعة مسبقًا — بدون نقود. يُخصم الرصيد تلقائيًا عند الانتهاء.",
  enterPinToAuthorize: "أدخل الرقم السري للتفويض", enterPin: "أدخل الرقم السري",
  pinSub: "الحوض 14 · محطة الظاهر · نفس الرقم السري المستخدم عند الكشك.",
  pinClear: "مسح", pinDemoHint: "نصيحة للعرض: أي 4 أرقام تفوض التعبئة — جرّب 0000 لرؤية إيقاف الحساب بعد 3 محاولات.",
  fillingTitle: "جارٍ التعبئة", dispensed: "الكمية المصروفة", flowRate: "معدل التدفق",
  valveState: "الصمام", valveOpen: "مفتوح · تعديل تلقائي", fillMode: "الوضع", fillModeVal: "تلقائي · تعبئة دقيقة",
  siaFillingGuidance: "إرشاد S!a المباشر: تم تأكيد محاذاة الفتحة. التعبئة تسير بشكل طبيعي — سيُرسل الإيصال تلقائيًا عبر الرسائل والبريد عند الانتهاء.",
  purchaseOrders: "أوامر الشراء", raisePo: "إنشاء أمر شراء", autoKdRate: "حساب تلقائي 0.0025 د.ك/غالون",
  submit: "إرسال", myTrucks: "شاحناتي", driversTitle: "السائقون", requestAccessCard: "طلب بطاقة دخول",
  lastReceipt: "إيصال آخر تعبئة", bay: "الحوض", volume: "الكمية", amount: "المبلغ", meter: "العداد",
  knetRef: "مرجع K-net", timestamp: "الوقت", sentSms: "أُرسل عبر الرسائل", sentEmail: "أُرسل عبر البريد",
  share: "مشاركة", stationsTitle: "محطات تعبئة المياه", stationsSub: "26 موقعًا في الكويت · 52 حوضًا · مرتبة حسب المسافة",
  stationSearchPh: "ابحث بالمنطقة أو المحافظة…", txnHistory: "سجل المعاملات",
  accountTitle: "الحساب", verified: "موثّق", registeredSince: "مسجل منذ", civilId: "البطاقة المدنية",
  crNumber: "رقم السجل التجاري", kycStatus: "مستندات التحقق", kycComplete: "3/3 موثّقة",
  languageTitle: "اللغة", registerNewTitle: "التسجيل", registerNewTanker: "تسجيل صهريج وسائق جديد",
  topupWallet: "شحن المحفظة", homeStation: "المحطة الرئيسية", bays: "حوض",
  statusOpen: "مفتوحة", statusSoon: "قريبًا", noStationsMatch: "لا توجد محطات مطابقة.",
  noNotifications: "لا توجد إشعارات.", notifications: "الإشعارات",
};
let currentLang = "en";
let EN_CACHE = null;
function captureEnglish() {
  EN_CACHE = {};
  document.querySelectorAll("[data-i18n]").forEach((el) => { EN_CACHE[el.dataset.i18n] ??= el.innerHTML; });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = "ph:" + el.dataset.i18nPlaceholder;
    EN_CACHE[key] ??= el.getAttribute("placeholder");
  });
}
function t(key) {
  if (currentLang === "ar" && AR_STRINGS[key]) return AR_STRINGS[key];
  return (EN_CACHE && EN_CACHE[key]) || key;
}
function applyLanguage(lang) {
  currentLang = lang;
  const dict = lang === "ar" ? AR_STRINGS : EN_CACHE;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (dict && dict[key]) el.innerHTML = dict[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    const val = lang === "ar" ? AR_STRINGS[key] : EN_CACHE?.["ph:" + key];
    if (val) el.setAttribute("placeholder", val);
  });
  const frame = document.getElementById("phone-frame");
  frame.dir = lang === "ar" ? "rtl" : "ltr";
  frame.classList.toggle("lang-ar", lang === "ar");
  document.getElementById("lang-toggle-label").textContent = lang === "ar" ? "EN" : "AR";
  document.querySelectorAll(".lang-opt").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
  try { localStorage.setItem("siap.lang", lang); } catch (e) {}
  // Re-render dynamic (JS-built) content so its labels/tags follow the language too.
  renderStations(document.getElementById("station-search-input")?.value || "");
  renderNotifications();
  lucide.createIcons();
}

function goto(screen) {
  document.querySelectorAll(".mscreen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(`mscreen-${screen}`);
  if (target) target.classList.add("active");
  const underMore = ["stations", "history", "receipt", "account"];
  const tabScreen = underMore.includes(screen) ? "more" : (screen === "filling" ? "qr" : screen);
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
  captureEnglish();
  // A couple of toast strings aren't tied to any on-page element for captureEnglish() to grab,
  // so they're seeded directly instead of round-tripping through the DOM.
  EN_CACHE.toastEnterQty = "Enter a quantity to raise a PO";
  EN_CACHE.toastRaisedDraft = "raised as Draft";
  EN_CACHE.toastCardRequested = "Access card requested";
  EN_CACHE.toastCardPrinted = "Access card printed";
  EN_CACHE.toastCardActivated = "Access card activated";
  EN_CACHE.pinWrong = "Wrong PIN.";
  EN_CACHE.attemptLeft = "attempt left";
  EN_CACHE.attemptsLeft = "attempts left";
  EN_CACHE.pinLocked = "Account locked after 3 wrong attempts. Owner alerted by SMS.";
  EN_CACHE.toastAccountLocked = "Account locked — owner alerted (demo)";
  EN_CACHE.toastFillComplete = "Fill complete — receipt sent by SMS & e-mail";
  EN_CACHE.valveFineFill = "Fine-fill top-up";
  EN_CACHE.bays = "bays";
  EN_CACHE.homeStation = "Home station";
  EN_CACHE.noNotifications = "No notifications.";
  EN_CACHE.noStationsMatch = "No stations match your search.";
  EN_CACHE.statusOpen = "Open";
  EN_CACHE.statusSoon = "Coming online";
  Object.assign(AR_STRINGS, {
    toastEnterQty: "أدخل كمية لإنشاء أمر شراء", toastRaisedDraft: "تم إنشاؤه كمسودة",
    toastCardRequested: "تم طلب بطاقة الدخول", toastCardPrinted: "تمت طباعة بطاقة الدخول",
    toastCardActivated: "تم تفعيل بطاقة الدخول", pinWrong: "رقم سري خاطئ.",
    attemptLeft: "محاولة متبقية", attemptsLeft: "محاولات متبقية",
    pinLocked: "تم قفل الحساب بعد 3 محاولات خاطئة. تم تنبيه المالك عبر الرسائل.",
    toastAccountLocked: "تم قفل الحساب — تم تنبيه المالك (عرض توضيحي)",
    toastFillComplete: "اكتملت التعبئة — أُرسل الإيصال عبر الرسائل والبريد",
    valveFineFill: "تعبئة دقيقة",
  });

  renderBalance();
  renderActivity();
  renderHistory();
  renderQr();
  renderReceiptQr();
  renderOrders();
  renderFleet();
  renderStations();
  renderNotifications();
  wirePoForm();
  resetPinStep();

  let savedLang = "en";
  try { savedLang = localStorage.getItem("siap.lang") || "en"; } catch (e) {}
  applyLanguage(savedLang);

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
  document.getElementById("register-truck-btn")?.addEventListener("click", () => goto("fleet"));
  document.getElementById("filling-cancel-btn")?.addEventListener("click", () => {
    FILL.active = false;
    clearInterval(FILL.timer);
    resetPinStep();
    showQrStep("scan");
    goto("qr");
  });

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
      showToast(t("toastEnterQty") === "Enter a quantity to raise a PO" ? "Enter an amount to top up" : "أدخل مبلغًا للشحن");
      return;
    }
    balance += amt;
    activity.unshift({ label: "K-net Top-up", delta: amt, time: "just now" });
    renderBalance();
    renderActivity();
    renderHistory();
    input.value = "";
    document.querySelectorAll(".amt-chip").forEach(c => c.classList.remove("selected"));
    showToast(`${currentLang === "ar" ? "تم شحن" : "Topped up"} KD ${amt.toFixed(3)}`);
    goto("wallet");
  });

  /* ---- QR / PIN / Filling flow ---- */
  document.getElementById("qr-continue-btn")?.addEventListener("click", () => {
    resetPinStep();
    showQrStep("pin");
  });
  document.getElementById("pin-pad")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-key]");
    if (btn) pinKeyPress(btn.dataset.key);
  });

  /* ---- Station search ---- */
  document.getElementById("station-search-input")?.addEventListener("input", (e) => renderStations(e.target.value));

  /* ---- Notifications (bell -> panel with an explicit close/cross button) ---- */
  document.querySelector(".mobile-icon-btn[aria-label='Notifications']")?.addEventListener("click", () => toggleNotifPanel());
  document.getElementById("notif-close")?.addEventListener("click", () => toggleNotifPanel(false));
  document.getElementById("notif-backdrop")?.addEventListener("click", () => toggleNotifPanel(false));
  document.getElementById("notif-list")?.addEventListener("click", (e) => {
    const dismiss = e.target.closest("[data-dismiss]");
    if (dismiss) { NOTIFICATIONS.splice(parseInt(dismiss.dataset.dismiss, 10), 1); renderNotifications(); }
  });

  /* ---- Language toggle (header quick-switch + Account screen's explicit EN/AR rows) ---- */
  document.getElementById("lang-toggle")?.addEventListener("click", () => applyLanguage(currentLang === "en" ? "ar" : "en"));
  document.querySelectorAll(".lang-opt").forEach((b) => b.addEventListener("click", () => applyLanguage(b.dataset.lang)));

  lucide.createIcons();
});
