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

function renderQr() {
  const block = document.getElementById("qr-block");
  if (!block) return;
  let s = 40216;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  let cells = "";
  for (let i = 0; i < 121; i++) cells += `<div class="qr-cell ${rand() > 0.55 ? "on" : ""}"></div>`;
  block.innerHTML = cells;
}

function goto(screen) {
  document.querySelectorAll(".mscreen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(`mscreen-${screen}`);
  if (target) target.classList.add("active");
  document.querySelectorAll(".mtab").forEach(t => t.classList.toggle("active", t.dataset.screen === screen));
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

  const requestedScreen = new URLSearchParams(window.location.search).get("screen");
  if (requestedScreen && document.getElementById(`mscreen-${requestedScreen}`)) {
    goto(requestedScreen);
  }

  document.querySelectorAll("[data-goto]").forEach(b => b.addEventListener("click", () => goto(b.dataset.goto)));
  document.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", () => goto(b.dataset.back)));
  document.querySelectorAll(".mtab").forEach(t => t.addEventListener("click", () => goto(t.dataset.screen)));

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
