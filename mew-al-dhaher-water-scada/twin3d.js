/* twin3d.js — WP-A: 3D Digital Twin entry point (ES module).
 * Registers the "3D Digital Twin" view via SIAP.registerView and owns everything under
 * twin3d/*.js. Falls back to a 2.5D render tab if WebGL is unavailable or the renderer throws.
 * See docs/IMPLEMENTATION_PLAN.md section "WP-A" for the full spec this file implements. */
import * as THREE from "three";
import { createScene } from "./twin3d/scene.js";
import {
  buildStation, refreshBayStatusDots, bayLayout, manifoldX, STATUS_COLOR,
  MANIFOLDS, BAY_COUNT, GATE_ENTRY, GATE_EXIT,
} from "./twin3d/station.js";
import { initTrucks, updateTrucks, getTruckObject } from "./twin3d/trucks.js";
import { buildBayRig } from "./twin3d/bay.js";
import { overviewShot, manifoldShot, bayShot, createCameraTween } from "./twin3d/camera.js";
import { createPicker } from "./twin3d/picking.js";

const VIEW_ID = "twin3d";

const HOTSPOTS = [
  { label: "Control Center", x: 46, y: 10 },
  { label: "Flow Computer", x: 66, y: 21 },
  { label: "Level Transmitter", x: 35, y: 31 },
  { label: "Pressure Transmitter", x: 45, y: 61 },
  { label: "Custody Flowmeter", x: 61, y: 62 },
  { label: "Temperature Transmitter", x: 68, y: 62 },
  { label: "Outlet Valve", x: 79, y: 62 },
  { label: "Container / Tanker", x: 93, y: 55 },
  { label: "Tanker Truck", x: 6, y: 55 },
  { label: "Inlet Valve", x: 17, y: 62 },
];

function pad2(n) { return n.toString().padStart(2, "0"); }

function detectWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) { return false; }
}

function viewHtml() {
  return `
  <div class="t3-wrap">
    <div class="card t3-toolbar-card">
      <div class="t3-tabrow">
        <div class="t3-tabs" id="t3-tabs">
          <button class="btn btn-sm t3-tab active" data-tab="3d"><i data-lucide="box"></i> 3D</button>
          <button class="btn btn-sm t3-tab" data-tab="pid"><i data-lucide="workflow"></i> P&amp;ID</button>
          <button class="btn btn-sm t3-tab" data-tab="render"><i data-lucide="image"></i> Render</button>
        </div>
        <div class="util-text" id="t3-status-text">Astriverse &middot; station &amp; bay &middot; live from S!aP Connect</div>
      </div>
      <div class="t3-toolbar" id="t3-toolbar">
        <button class="btn btn-sm t3-preset active" data-preset="overview"><i data-lucide="maximize"></i> Overview</button>
        <button class="btn btn-sm t3-preset" data-preset="manifold"><i data-lucide="git-branch"></i> Manifold</button>
        <button class="btn btn-sm t3-preset" data-preset="bay"><i data-lucide="crosshair"></i> Bay</button>
        <button class="btn btn-sm t3-preset" data-preset="follow"><i data-lucide="truck"></i> Follow truck</button>
        <span class="t3-sep"></span>
        <button class="btn btn-sm" id="t3-tour"><i data-lucide="repeat"></i> Auto-tour</button>
        <button class="btn btn-sm active" id="t3-flow-toggle"><i data-lucide="waves"></i> Flow lines</button>
        <button class="btn btn-sm active" id="t3-labels-toggle"><i data-lucide="tag"></i> Labels</button>
      </div>
    </div>

    <div class="grid-2 t3-body">
      <div class="card t3-stage-card">
        <div class="t3-canvas-wrap" id="t3-canvas-wrap">
          <canvas id="t3-canvas"></canvas>
          <div id="t3-labels" class="t3-labels-layer"></div>
          <div id="t3-pid-layer" class="t3-layer" hidden><div id="t3-pid-diagram" class="t3-pid-diagram"></div></div>
          <div id="t3-render-layer" class="t3-layer" hidden>
            <img src="assets/images/twin/bay-aerial.jpg" alt="Bay aerial render" id="t3-render-img"/>
            <div class="t3-hotspots" id="t3-hotspots"></div>
          </div>
          <div class="t3-fallback-note util-text" id="t3-fallback-note" hidden>
            <i data-lucide="alert-triangle" style="width:12px;height:12px;display:inline;"></i>
            WebGL unavailable on this device &mdash; showing the 2.5D render instead.
          </div>
          <div class="t3-legend" id="t3-legend"></div>
          <div class="t3-hover" id="t3-hover" hidden></div>
        </div>
      </div>
      <div class="card" id="t3-bay-card">
        <div class="card-title">Bay <span id="t3-bay-id">14</span> &middot; live <span class="hint" id="t3-bay-hint"></span></div>
        <div id="t3-bay-metrics"></div>
      </div>
    </div>
  </div>`;
}

/* ---------------- module state (must exist before SIAP.registerView, since it mounts
   synchronously when the document is already ready by the time this module executes) ---------------- */
let els = {};
let three = null; // { scene renderer camera controls ... } from createScene()
let cameraTween = null;
let picker = null;
let stationHandle = null; // { group, pickables, barriers }
let bayRig = null;
let webglOk = false;
let currentTab = "3d";
let currentPreset = "overview";
let followBayId = null;
let autoTourOn = false;
let autoTourTimer = null;
let bayCardTimer = null;
let labelsOn = true;
let flowLinesOn = true;
let selectedBayId = SIAP.selectedBayId || 14;

SIAP.registerView({
  id: VIEW_ID,
  group: "operations",
  icon: "box",
  title: "3D Digital Twin",
  sub: "Astriverse · station & bay · live from S!aP Connect",
  navLabel: "3D Digital Twin",
  html: viewHtml(),
  onMount(section) { mountTwin(section); },
  onShow() { showTwin(); },
  onHide() { hideTwin(); },
  onTick(state) { onTickTwin(state); },
});

function mountTwin(section) {
  els = {
    section,
    canvas: section.querySelector("#t3-canvas"),
    canvasWrap: section.querySelector("#t3-canvas-wrap"),
    labelsEl: section.querySelector("#t3-labels"),
    pidLayer: section.querySelector("#t3-pid-layer"),
    pidDiagram: section.querySelector("#t3-pid-diagram"),
    renderLayer: section.querySelector("#t3-render-layer"),
    hotspots: section.querySelector("#t3-hotspots"),
    fallbackNote: section.querySelector("#t3-fallback-note"),
    legend: section.querySelector("#t3-legend"),
    hover: section.querySelector("#t3-hover"),
    bayId: section.querySelector("#t3-bay-id"),
    bayHint: section.querySelector("#t3-bay-hint"),
    bayMetrics: section.querySelector("#t3-bay-metrics"),
    tabs: section.querySelector("#t3-tabs"),
    toolbar: section.querySelector("#t3-toolbar"),
    tour: section.querySelector("#t3-tour"),
    flowToggle: section.querySelector("#t3-flow-toggle"),
    labelsToggle: section.querySelector("#t3-labels-toggle"),
    statusText: section.querySelector("#t3-status-text"),
  };

  buildLegend();
  buildHotspots();
  wireTabs();
  wireToolbar();
  wireKeyboard();

  // Don't rely solely on the `hidden` attribute + `[hidden]` CSS: a stale cache of twin3d.css
  // (it's @imported by modules.css with no cache-busting query we're allowed to add) could still
  // apply the note's own `display: flex` and leave it visible by default. Force it off explicitly.
  els.fallbackNote.style.display = "none";

  webglOk = detectWebGL();
  if (!webglOk) {
    activateFallback("WebGL is not available in this browser/GPU.");
  } else {
    initThree().catch((e) => {
      console.error("[twin3d] init failed, falling back to 2.5D render", e);
      activateFallback("The 3D renderer failed to start.");
    });
  }

  SIAP.on("bay:select", (bay) => { if (bay) onBaySelected(bay.id); });
  SIAP.on("fill:start", () => { /* truck spawn handled by the per-frame state read */ });
  SIAP.on("fill:stop", () => { /* truck departure handled by the per-frame state read */ });

  window.__twin3d = {
    get running() { return three ? three.running : false; },
    get webglOk() { return webglOk; },
    selectBay: (id) => SIAP.selectBay(id),
    screenshot: () => (three ? three.renderer.domElement.toDataURL("image/png") : null),
  };
}

async function initThree() {
  three = createScene(els.canvas, els.labelsEl);
  cameraTween = createCameraTween(three.camera, three.controls);

  three.controls.addEventListener("start", () => { followBayId = null; });

  stationHandle = await buildStation(three.scene);
  await initTrucks(three.scene);
  bayRig = await buildBayRig(three.scene);
  bayRig.moveTo(selectedBayId);

  picker = createPicker(three.renderer, three.camera, () => stationHandle.pickables);
  picker.onHover((hit) => showHoverCard(hit));
  picker.onClick((hit) => {
    if (!hit) return;
    SIAP.selectBay(hit.bayId);
    flyToPreset("bay");
  });

  three.onTick((dt) => frameUpdate(dt));

  const ro = new ResizeObserver(() => {
    const r = els.canvasWrap.getBoundingClientRect();
    three.resize(r.width, r.height);
  });
  ro.observe(els.canvasWrap);
  three._resizeObserver = ro;

  // initial sizing before first paint
  const r0 = els.canvasWrap.getBoundingClientRect();
  three.resize(r0.width || 800, r0.height || 560);

  applyPreset("overview", true);
  refreshBayCard();
  if (window.lucide) lucide.createIcons();
}

function activateFallback(reason) {
  console.warn("[twin3d] fallback engaged:", reason);
  els.fallbackNote.hidden = false;
  els.fallbackNote.style.display = "flex"; // belt-and-braces: don't rely solely on `[hidden]` CSS
  els.tabs.querySelectorAll('[data-tab="3d"], [data-tab="pid"]').forEach((b) => (b.disabled = true));
  setTab("render");
}

/* ---------------- lifecycle ---------------- */
function showTwin() {
  selectedBayId = SIAP.selectedBayId || selectedBayId;
  if (three && webglOk && currentTab === "3d") {
    three.start();
  }
  refreshBayCard();
  if (currentTab === "pid") refreshPid();
  bayCardTimer = window.setInterval(refreshBayCard, 250);
  if (window.lucide) lucide.createIcons();
}
function hideTwin() {
  if (three) three.stop();
  if (bayCardTimer) { clearInterval(bayCardTimer); bayCardTimer = null; }
  stopAutoTour();
}
function onTickTwin(state) {
  refreshBayCard();
  refreshHotspotLive(state);
  if (currentTab === "pid") refreshPid();
}

/* ---------------- per-frame update (while shown + tab === 3d) ---------------- */
function frameUpdate(dt) {
  const state = SIAP.state;
  const tNow = performance.now() / 1000;
  updateTrucks(state.bays, dt, tNow);
  if (stationHandle) refreshBayStatusDots(stationHandle.group, state.bays);
  const bay = state.bays.find((b) => b.id === selectedBayId);
  if (bayRig) bayRig.update(bay, state, tNow);
  cameraTween.update(dt);
  if (followBayId != null) {
    const truck = getTruckObject(followBayId);
    if (truck) {
      const target = truck.position.clone();
      const behind = new THREE.Vector3(0, 4.5, 8).applyAxisAngle(new THREE.Vector3(0, 1, 0), truck.rotation.y);
      const desired = target.clone().add(behind);
      three.camera.position.lerp(desired, 0.04);
      three.controls.target.lerp(target.clone().add(new THREE.Vector3(0, 1.4, 0)), 0.08);
    }
  }
}

/* ---------------- bay selection ---------------- */
function onBaySelected(bayId) {
  selectedBayId = bayId;
  if (bayRig) bayRig.moveTo(bayId);
  refreshBayCard();
  if (currentTab === "pid") refreshPid();
  if (currentPreset === "bay") flyToPreset("bay");
}

/* ---------------- right-side "Bay N · live" card ---------------- */
function refreshBayCard() {
  const state = SIAP.state;
  const bay = state.bays.find((b) => b.id === selectedBayId);
  if (!bay || !els.bayId) return;
  els.bayId.textContent = pad2(bay.id);
  els.bayHint.textContent = SIAP.statusLabel ? SIAP.statusLabel(bay.status) : bay.status;
  const pct = bay.target ? Math.min(100, (bay.dispensed / bay.target) * 100) : 0;
  const rate = 0.0025;
  const charge = bay.dispensed * rate;
  els.bayMetrics.innerHTML = `
    <div class="metric-line"><span class="k">Tanker owner</span><span class="v">${bay.owner}</span></div>
    <div class="metric-line"><span class="k">Account #</span><span class="v mono">${bay.account}</span></div>
    <div class="metric-line"><span class="k">License plate</span><span class="v mono">${bay.plate}</span></div>
    <div class="metric-line"><span class="k">Dispensed</span><span class="v">${Math.round(bay.dispensed).toLocaleString()} / ${bay.target.toLocaleString()} IG</span></div>
    <div style="margin: 8px 0;"><div class="progress-outer"><div class="progress-inner" style="width:${pct.toFixed(0)}%;"></div></div></div>
    <div class="metric-line"><span class="k">Flow</span><span class="v">${(bay.status === "filling" ? bay.flow : 0).toFixed(1)} m&sup3;/h</span></div>
    <div class="metric-line"><span class="k">Status</span><span class="v"><span class="tag ${tagClassFor(bay.status)}">${(SIAP.statusLabel ? SIAP.statusLabel(bay.status) : bay.status).toUpperCase()}</span></span></div>
    <div class="metric-line"><span class="k">Est. charge</span><span class="v">KD ${charge.toFixed(3)}</span></div>
  `;
}
function tagClassFor(status) {
  return { filling: "blue", done: "green", fault: "red", offline: "gray", idle: "gray" }[status] || "gray";
}

/* ---------------- P&ID tab (reuses the existing 2D SVG generator) ---------------- */
function refreshPid() {
  if (typeof window.renderBayTwinDiagram !== "function") return;
  window.renderBayTwinDiagram(selectedBayId);
  const src = document.getElementById("twin-diagram");
  if (src && els.pidDiagram) els.pidDiagram.innerHTML = src.innerHTML;
}

/* ---------------- tabs ---------------- */
function wireTabs() {
  els.tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".t3-tab");
    if (!btn || btn.disabled) return;
    setTab(btn.dataset.tab);
  });
}
function setTab(tab) {
  currentTab = tab;
  els.tabs.querySelectorAll(".t3-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  els.canvas.style.display = tab === "3d" ? "block" : "none";
  els.labelsEl.style.display = tab === "3d" ? "block" : "none";
  els.pidLayer.hidden = tab !== "pid";
  els.renderLayer.hidden = tab !== "render";
  els.toolbar.style.display = tab === "3d" ? "flex" : "none";
  if (tab === "3d" && three && webglOk) three.start();
  else if (three) three.stop();
  if (tab === "pid") refreshPid();
}

/* ---------------- toolbar: presets / auto-tour / toggles ---------------- */
function wireToolbar() {
  els.toolbar.querySelectorAll(".t3-preset").forEach((btn) => {
    btn.addEventListener("click", () => flyToPreset(btn.dataset.preset));
  });
  els.tour.addEventListener("click", () => (autoTourOn ? stopAutoTour() : startAutoTour()));
  els.flowToggle.addEventListener("click", () => {
    flowLinesOn = !flowLinesOn;
    els.flowToggle.classList.toggle("active", flowLinesOn);
    if (bayRig) bayRig.setFlowVisible(flowLinesOn);
  });
  els.labelsToggle.addEventListener("click", () => {
    labelsOn = !labelsOn;
    els.labelsToggle.classList.toggle("active", labelsOn);
    els.labelsEl.style.visibility = labelsOn ? "visible" : "hidden";
  });
}

function flyToPreset(preset) {
  currentPreset = preset;
  els.toolbar.querySelectorAll(".t3-preset").forEach((b) => b.classList.toggle("active", b.dataset.preset === preset));
  if (!three) return;
  followBayId = null;
  if (preset === "overview") {
    const s = overviewShot();
    cameraTween.to(s.pos, s.target);
  } else if (preset === "manifold") {
    const bay = SIAP.state.bays.find((b) => b.id === selectedBayId);
    const m = bay ? bayLayout(bay.id).manifold : 2;
    const s = manifoldShot(m);
    cameraTween.to(s.pos, s.target);
  } else if (preset === "bay") {
    const l = bayLayout(selectedBayId);
    const s = bayShot(new THREE.Vector3(l.manifoldX, 0, l.z));
    cameraTween.to(s.pos, s.target);
  } else if (preset === "follow") {
    followBayId = selectedBayId;
    const truck = getTruckObject(selectedBayId);
    if (truck) {
      const l = bayLayout(selectedBayId);
      cameraTween.to(new THREE.Vector3(l.manifoldX - 6, 6, l.z + 10), truck.position.clone(), 1.0);
    }
  }
}
function applyPreset(preset) { flyToPreset(preset); }

function startAutoTour() {
  autoTourOn = true;
  els.tour.classList.add("active");
  autoTourTimer = window.setInterval(() => {
    const filling = SIAP.state.bays.filter((b) => b.status === "filling");
    if (!filling.length) return;
    const idx = filling.findIndex((b) => b.id === selectedBayId);
    const next = filling[(idx + 1) % filling.length];
    SIAP.selectBay(next.id);
    flyToPreset("bay");
  }, 4000);
}
function stopAutoTour() {
  autoTourOn = false;
  if (els.tour) els.tour.classList.remove("active");
  if (autoTourTimer) { clearInterval(autoTourTimer); autoTourTimer = null; }
}

/* ---------------- keyboard shortcuts (only while this view is active) ---------------- */
function wireKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (SIAP.activeView() !== VIEW_ID) return;
    if (/input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key === "1") flyToPreset("overview");
    else if (e.key === "2") flyToPreset("manifold");
    else if (e.key === "3") flyToPreset("bay");
    else if (e.key === "l" || e.key === "L") els.labelsToggle.click();
    else if (e.key === "Escape") flyToPreset("overview");
  });
}

/* ---------------- hover mini-HUD ---------------- */
function showHoverCard(hit) {
  if (!hit) { els.hover.hidden = true; return; }
  const bay = SIAP.state.bays.find((b) => b.id === hit.bayId);
  if (!bay) { els.hover.hidden = true; return; }
  const pct = bay.target ? Math.min(100, (bay.dispensed / bay.target) * 100) : 0;
  els.hover.hidden = false;
  els.hover.innerHTML = `<strong>Bay ${pad2(bay.id)}</strong><br>${bay.owner}<br>${bay.plate}<br>${pct.toFixed(0)}% &middot; ${(SIAP.statusLabel ? SIAP.statusLabel(bay.status) : bay.status)}`;
}

/* ---------------- legend ---------------- */
function buildLegend() {
  const rows = [
    ["idle", "Idle"], ["filling", "Filling"], ["done", "Done"], ["fault", "Fault"], ["offline", "Offline"],
  ];
  els.legend.innerHTML = rows.map(([k, label]) => {
    const hex = "#" + STATUS_COLOR[k].toString(16).padStart(6, "0");
    return `<span class="t3-legend-item"><span class="t3-legend-dot" style="background:${hex}"></span>${label}</span>`;
  }).join("");
}

/* ---------------- Render tab hotspots ---------------- */
function buildHotspots() {
  els.hotspots.innerHTML = HOTSPOTS.map((h) => `<div class="t3-hotspot" style="left:${h.x}%; top:${h.y}%;" title="${h.label}"><span></span>${h.label}</div>`).join("")
    + `<div class="t3-hotspot t3-hotspot--live" id="t3-hotspot-live" style="left:93%; top:70%;"></div>`;
}
function refreshHotspotLive(state) {
  const live = document.getElementById("t3-hotspot-live");
  if (!live) return;
  const bay = state.bays.find((b) => b.id === selectedBayId);
  if (!bay) return;
  const pct = bay.target ? Math.min(100, (bay.dispensed / bay.target) * 100) : 0;
  live.innerHTML = `<span></span>Bay ${pad2(bay.id)} &middot; ${pct.toFixed(0)}% &middot; ${(bay.status === "filling" ? bay.flow : 0).toFixed(1)} m&sup3;/h`;
}
