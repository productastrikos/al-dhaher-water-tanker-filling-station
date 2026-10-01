/* twin3d.js — 3D Digital Twin entry point (ES module). Builds the scene from twin3d/layout.js
 * (real .glb assets + black asphalt roads/footings), drives trucks.js's arrival/departure
 * animation from live bay status, and shows always-on colour-coded status dots (twin3d/labels.js).
 *
 * The click-drag-scale scene EDITOR (twin3d/editor.js) was removed in an earlier pass and has
 * been brought back per client request -- "Edit objects" toggles a panel + TransformControls
 * gizmo for repositioning the static yard dressing; edits autosave to localStorage and are
 * re-applied on every load via `applyOverrides()`, even with the panel closed.
 *
 * Click-to-info: clicking a truck or a bay apron in the 3D view (when the editor is OFF) raycasts
 * against the trucks group and the station group, and opens a FIXED, screen-anchored side panel
 * with that bay's live numbers (same fields as the Bay Control transaction card). This replaces
 * the previous floating CSS2D text chips, which visibly drifted across the screen as the camera
 * orbited -- the exact "trucks with a moving panel" complaint this rebuild addresses. */
import * as THREE from "three";
import { createScene } from "./twin3d/scene.js?v=1";
import { buildStation, refreshBayStatusDots, updatePipeFlow } from "./twin3d/layout.js?v=12";
import { initTrucks, updateTrucks, getTruckObject } from "./twin3d/trucks.js?v=5";
import { createLabelLayer, legendHtml } from "./twin3d/labels.js?v=2";
import { createEditor, editorPanelHtml, applyOverrides } from "./twin3d/editor.js?v=1";

const VIEW_ID = "twin3d";

function detectWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) { return false; }
}

function viewHtml() {
  return `
  <div class="t3-wrap">
    <div class="card t3-stage-card" style="padding:0; overflow:hidden;">
      <div class="t3-canvas-wrap" id="t3-canvas-wrap">
        <canvas id="t3-canvas"></canvas>
        <div class="t3-status-chip" id="t3-status-chip">
          <span id="t3-status-dot" style="width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block;"></span>
          <strong>Astriverse</strong> station &amp; bay &middot; live from S!aP Connect
          <span class="t3-click-hint">&middot; click a truck or bay for live info</span>
        </div>
        <button class="btn btn-sm t3-labels-btn active" id="t3-labels-toggle"><i data-lucide="circle-dot"></i> Status dots</button>
        <button class="btn btn-sm t3-editor-btn" id="t3-editor-toggle"><i data-lucide="move-3d"></i> Edit objects</button>
        ${legendHtml()}
        <div class="t3-fallback-note util-text" id="t3-fallback-note" hidden>
          <i data-lucide="alert-triangle" style="width:12px;height:12px;display:inline;"></i>
          WebGL unavailable on this device.
        </div>
        <div class="t3-camnav" id="t3-camnav" title="Move the camera">
          <div></div><button data-cam="up" title="Move forward"><i data-lucide="chevron-up"></i></button><div></div>
          <button data-cam="left" title="Move left"><i data-lucide="chevron-left"></i></button>
          <button class="t3-cam-center" data-cam="home" title="Reset view"><i data-lucide="home"></i></button>
          <button data-cam="right" title="Move right"><i data-lucide="chevron-right"></i></button>
          <div></div><button data-cam="down" title="Move back"><i data-lucide="chevron-down"></i></button><div></div>
        </div>
        <div class="t3-camzoom" id="t3-camzoom" title="Zoom the camera">
          <button data-cam="zoom-in" title="Zoom in"><i data-lucide="plus"></i></button>
          <button data-cam="zoom-out" title="Zoom out"><i data-lucide="minus"></i></button>
        </div>

        <div class="t3-info-panel" id="t3-info-panel" hidden>
          <div class="t3-info-head">
            <div>
              <div class="t3-info-title" id="t3-info-title">Bay 14</div>
              <div class="t3-info-sub" id="t3-info-sub">Al-Salem Transport Co.</div>
            </div>
            <button class="btn btn-sm" id="t3-info-close" title="Close (Esc)" aria-label="Close"><i data-lucide="x"></i></button>
          </div>
          <div class="t3-info-body">
            <div class="metric-line"><span class="k">Status</span><span class="v" id="t3-info-status">Idle</span></div>
            <div class="metric-line"><span class="k">Account #</span><span class="v mono" id="t3-info-account">&mdash;</span></div>
            <div class="metric-line"><span class="k">License plate</span><span class="v mono" id="t3-info-plate">&mdash;</span></div>
            <div class="metric-line"><span class="k">Dispensed / Target</span><span class="v" id="t3-info-volume">&mdash;</span></div>
            <div class="metric-line"><span class="k">Instantaneous flow</span><span class="v" id="t3-info-flow">&mdash;</span></div>
            <div class="metric-line"><span class="k">ETA to full</span><span class="v" id="t3-info-eta">&mdash;</span></div>
          </div>
          <button class="btn btn-sm btn-primary" id="t3-info-baycontrol" style="width:100%; justify-content:center; margin-top:12px;">
            <i data-lucide="gauge"></i> Open in Bay Control
          </button>
        </div>

        ${editorPanelHtml()}
      </div>
    </div>
  </div>`;
}

let els = {};
let three = null;
let stationHandle = null;
let labelLayer = null;
let webglOk = false;
let editor = null;
let selectionBox = null;
let raycaster = null;
let pointerNdc = null;
let selectedBayId = null;

const DEFAULT_CAM_POS = new THREE.Vector3(150, 115, 175);
const DEFAULT_CAM_TARGET = new THREE.Vector3(10, 3, 0);

/** On-screen camera D-pad: pans the camera+target together along the camera's current
 *  ground-projected forward/right vectors (so "left/right/forward/back" stay intuitive at any
 *  orbit angle), plus a dolly zoom and a one-click reset back to the default overview. */
function nudgeCamera(dir) {
  if (!three) return;
  const cam = three.camera, ctr = three.controls;
  if (dir === "home") {
    cam.position.copy(DEFAULT_CAM_POS);
    ctr.target.copy(DEFAULT_CAM_TARGET);
    return;
  }
  if (dir === "zoom-in" || dir === "zoom-out") {
    const offset = new THREE.Vector3().subVectors(cam.position, ctr.target);
    const dist = offset.length();
    const next = THREE.MathUtils.clamp(dist * (dir === "zoom-in" ? 0.8 : 1.25), ctr.minDistance, ctr.maxDistance);
    offset.setLength(next);
    cam.position.copy(ctr.target).clone().add(offset);
    return;
  }
  const forward = new THREE.Vector3();
  cam.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1); else forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const step = Math.max(5, cam.position.distanceTo(ctr.target) * 0.18);
  const move = new THREE.Vector3();
  if (dir === "up") move.copy(forward).multiplyScalar(step);
  else if (dir === "down") move.copy(forward).multiplyScalar(-step);
  else if (dir === "left") move.copy(right).multiplyScalar(-step);
  else if (dir === "right") move.copy(right).multiplyScalar(step);
  cam.position.add(move);
  ctr.target.add(move);
}

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
    fallbackNote: section.querySelector("#t3-fallback-note"),
    labelsToggle: section.querySelector("#t3-labels-toggle"),
    editorToggle: section.querySelector("#t3-editor-toggle"),
    camnav: section.querySelector("#t3-camnav"),
    camzoom: section.querySelector("#t3-camzoom"),
    infoPanel: section.querySelector("#t3-info-panel"),
    infoClose: section.querySelector("#t3-info-close"),
    infoTitle: section.querySelector("#t3-info-title"),
    infoSub: section.querySelector("#t3-info-sub"),
    infoStatus: section.querySelector("#t3-info-status"),
    infoAccount: section.querySelector("#t3-info-account"),
    infoPlate: section.querySelector("#t3-info-plate"),
    infoVolume: section.querySelector("#t3-info-volume"),
    infoFlow: section.querySelector("#t3-info-flow"),
    infoEta: section.querySelector("#t3-info-eta"),
    infoBayControlBtn: section.querySelector("#t3-info-baycontrol"),
  };
  els.fallbackNote.style.display = "none";

  els.infoClose.addEventListener("click", () => selectBay(null));
  els.infoBayControlBtn.addEventListener("click", () => {
    if (selectedBayId == null) return;
    SIAP.selectBay(selectedBayId);
    SIAP.showView("baycontrol");
  });

  webglOk = detectWebGL();
  if (!webglOk) {
    els.fallbackNote.hidden = false;
    els.fallbackNote.style.display = "flex";
    console.warn("[twin3d] WebGL is not available in this browser/GPU.");
    return;
  }
  initThree().catch((e) => console.error("[twin3d] init failed", e));

  window.__twin3d = {
    get running() { return three ? three.running : false; },
    get webglOk() { return webglOk; },
    get scene() { return three ? three.scene : null; },
    get camera() { return three ? three.camera : null; },
    get controls() { return three ? three.controls : null; },
    get renderer() { return three ? three.renderer : null; },
    get editor() { return editor; },
    screenshot: () => (three ? three.renderer.domElement.toDataURL("image/png") : null),
    /** Debug helper: find a placed object by its `userData.placementId` or `.name` and report its
     *  world position + bounding box, for tuning `twin3d/layout.js` PLACEMENTS/footings numbers
     *  without guessing blind. Not used by the running app itself. */
    describe(idOrName) {
      if (!three) return null;
      let found = null;
      three.scene.traverse((o) => { if (o.userData?.placementId === idOrName || o.name === idOrName) found = o; });
      if (!found) return null;
      found.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(found);
      return {
        position: found.position.toArray(),
        min: box.min.toArray(), max: box.max.toArray(),
        size: box.getSize(new THREE.Vector3()).toArray(),
      };
    },
  };
}

async function initThree() {
  three = createScene(els.canvas);

  stationHandle = await buildStation(three.scene);
  applyOverrides(stationHandle.editables); // re-apply any layout tweaks saved via the editor
  await initTrucks(three.scene);

  editor = createEditor({
    scene: three.scene,
    camera: three.camera,
    renderer: three.renderer,
    controls: three.controls,
    section: els.section,
    baseItems: stationHandle.editables,
  });
  els.editorToggle.addEventListener("click", () => {
    editor.setEnabled(!editor.enabled);
    els.editorToggle.classList.toggle("active", editor.enabled);
    if (editor.enabled) selectBay(null); // don't show both the bay-info panel and the editor gizmo
  });

  labelLayer = createLabelLayer();
  three.scene.add(labelLayer.group);
  els.labelsToggle.addEventListener("click", () => {
    labelLayer.setEnabled(!labelLayer.enabled);
    els.labelsToggle.classList.toggle("active", labelLayer.enabled);
  });

  selectionBox = new THREE.BoxHelper(undefined, 0x22d3ee);
  selectionBox.visible = false;
  selectionBox.material.depthTest = false;
  selectionBox.material.transparent = true;
  selectionBox.renderOrder = 999;
  three.scene.add(selectionBox);

  raycaster = new THREE.Raycaster();
  pointerNdc = new THREE.Vector2();
  els.canvas.addEventListener("click", onCanvasClick);
  document.addEventListener("keydown", onGlobalKeydown);

  els.camnav.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cam]");
    if (btn) nudgeCamera(btn.dataset.cam);
  });
  els.camzoom.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cam]");
    if (btn) nudgeCamera(btn.dataset.cam);
  });

  three.onTick((dt) => {
    const state = SIAP.state;
    updateTrucks(state.bays, dt);
    refreshBayStatusDots(stationHandle.group, state.bays);
    updatePipeFlow(dt);
    labelLayer.update(state.bays);
    updateSelection();
    editor.update();
  });

  const ro = new ResizeObserver(() => {
    const r = els.canvasWrap.getBoundingClientRect();
    three.resize(r.width, r.height);
  });
  ro.observe(els.canvasWrap);
  three._resizeObserver = ro;

  const r0 = els.canvasWrap.getBoundingClientRect();
  three.resize(r0.width || 800, r0.height || 560);

  three.camera.position.copy(DEFAULT_CAM_POS);
  three.controls.target.copy(DEFAULT_CAM_TARGET);

  if (window.lucide) lucide.createIcons();
}

/** Raycasts the click against the trucks group + the station group (bay aprons carry
 *  `userData.bayId`, set in layout.js; arrived/parked trucks carry it too, set in trucks.js).
 *  Walks each hit up its parent chain looking for that tag, skipping any hit that sits under an
 *  invisible ancestor (the truck pool keeps ~46 objects alive but hidden at the origin when not
 *  in use, so a naive "closest hit wins" could pick an invisible pooled truck over a real one). */
function onCanvasClick(e) {
  if (!three || !raycaster) return;
  if (editor && editor.enabled) return; // the scene editor owns clicks on the canvas while it's open
  const rect = els.canvas.getBoundingClientRect();
  pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, three.camera);

  const targets = [];
  const trucksGroup = three.scene.getObjectByName("trucks");
  if (trucksGroup) targets.push(trucksGroup);
  if (stationHandle && stationHandle.group) targets.push(stationHandle.group);
  if (!targets.length) return;

  const hits = raycaster.intersectObjects(targets, true);
  for (const hit of hits) {
    let cursor = hit.object;
    let visible = true;
    while (cursor) { if (cursor.visible === false) { visible = false; break; } cursor = cursor.parent; }
    if (!visible) continue;
    let o = hit.object;
    while (o && o.userData.bayId == null) o = o.parent;
    if (o && o.userData.bayId != null) { selectBay(o.userData.bayId); return; }
  }
}

function onGlobalKeydown(e) {
  if (e.key === "Escape" && selectedBayId != null) selectBay(null);
}

function selectBay(id) {
  selectedBayId = id;
  if (id == null) {
    if (els.infoPanel) els.infoPanel.hidden = true;
    if (selectionBox) selectionBox.visible = false;
    return;
  }
  els.infoPanel.hidden = false;
  renderInfoPanel();
  syncSelectionBox();
  if (window.lucide) lucide.createIcons();
}

const STATUS_TEXT_COLOR = {
  idle: "var(--text-faint)", filling: "var(--accent)", done: "var(--green)",
  fault: "var(--red)", offline: "var(--text-faint)",
};

function renderInfoPanel() {
  if (selectedBayId == null || !els.infoPanel) return;
  const bay = SIAP.state.bays.find((b) => b.id === selectedBayId);
  if (!bay) { selectBay(null); return; }

  els.infoTitle.textContent = `Bay ${SIAP.pad(bay.id)}`;
  els.infoSub.textContent = bay.owner || "—";
  els.infoStatus.textContent = SIAP.statusLabel(bay.status);
  els.infoStatus.style.color = STATUS_TEXT_COLOR[bay.status] || "var(--text)";
  els.infoAccount.textContent = bay.account || "—";
  els.infoPlate.textContent = bay.plate || "—";
  els.infoVolume.textContent = `${Math.round(bay.dispensed).toLocaleString()} / ${Math.round(bay.target).toLocaleString()} IG`;
  els.infoFlow.textContent = `${(bay.flow ?? 0).toFixed(1)} m³/h`;

  if (bay.status === "filling" && bay.flow > 0) {
    // dispensed/target are Imp.gal, flow is m³/h (1 Imp.gal = 0.004546 m³) -- same conversion
    // Bay Control uses (app.js), so the two screens always agree.
    const remaining = Math.max(0, bay.target - bay.dispensed);
    const etaMin = (remaining * 0.004546) / bay.flow;
    els.infoEta.textContent = `${Math.floor(etaMin)}m ${Math.floor((etaMin % 1) * 60)}s`;
  } else {
    els.infoEta.textContent = "—";
  }
}

function syncSelectionBox() {
  if (!selectionBox) return;
  const truckObj = selectedBayId != null ? getTruckObject(selectedBayId) : null;
  if (truckObj) {
    selectionBox.setFromObject(truckObj);
    selectionBox.visible = true;
  } else {
    selectionBox.visible = false;
  }
}

/** Runs every rendered frame (RAF) while a bay is selected, so the panel's numbers and the
 *  selection outline stay live without waiting for the next ~2.2s SIAP tick. */
function updateSelection() {
  if (selectedBayId == null) return;
  renderInfoPanel();
  syncSelectionBox();
}

function showTwin() {
  if (three && webglOk) three.start();
  if (window.lucide) lucide.createIcons();
}
function hideTwin() {
  if (three) three.stop();
}
function onTickTwin() {
  // live bay status is read straight from SIAP.state inside the onTick handler registered in
  // initThree(); nothing else needs driving per app-level tick.
}
