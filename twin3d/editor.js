/* twin3d/editor.js — click-to-select-and-move scene editor.
 *
 * Restored per client request after being removed in an earlier pass ("bring the editing
 * feature back"). Does one job: click something (or find it in the searchable list), see it
 * highlighted, drag the gizmo or type numbers to move/rotate/scale it. Every edit autosaves to
 * localStorage as a small override keyed by object id, layered on top of layout.js's defaults --
 * so "Reset" always means "back to the shipped layout", not "lose your only copy", and a saved
 * arrangement still shows up with the editor panel closed (see `applyOverrides`, called once from
 * twin3d.js right after the station is built).
 */
import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";

const LS_KEY = "twin3d.editor.overrides.v2";
const RAD = Math.PI / 180;

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (e) { return {}; }
}
function saveOverrides(overrides) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(overrides)); } catch (e) { /* private mode etc — non-fatal */ }
}

/** Applies any saved overrides onto `{ id, object }` items. Called once at scene-build time (not
 *  just while the editor panel is open) so a saved arrangement persists across reloads. */
export function applyOverrides(items) {
  const overrides = loadOverrides();
  items.forEach(({ id, object }) => {
    const o = overrides[id];
    if (!o || !object) return;
    if (o.position) object.position.set(o.position[0], o.position[1], o.position[2]);
    if (o.rotation) object.rotation.set(o.rotation[0], o.rotation[1], o.rotation[2]);
    if (o.scale) object.scale.set(o.scale[0], o.scale[1], o.scale[2]);
  });
}

export function editorPanelHtml() {
  return `
  <div class="t3-editor-panel" id="t3-editor-panel" hidden>
    <div class="t3-editor-head">
      <span>Scene Editor</span>
      <button class="btn btn-sm" id="t3-editor-close" title="Close" aria-label="Close editor"><i data-lucide="x"></i></button>
    </div>
    <div class="t3-editor-search">
      <i data-lucide="search"></i>
      <input type="text" id="t3-editor-search-input" placeholder="Find an object&hellip;" />
    </div>
    <div class="t3-editor-list" id="t3-editor-list"></div>

    <div class="t3-editor-selected" id="t3-editor-selected" hidden>
      <div class="t3-editor-selected-name" id="t3-editor-selected-name">—</div>
      <div class="t3-editor-modes" id="t3-editor-modes">
        <button data-mode="translate" class="active" title="Move (G)"><i data-lucide="move"></i></button>
        <button data-mode="rotate" title="Rotate (R)"><i data-lucide="rotate-cw"></i></button>
        <button data-mode="scale" title="Scale (S)"><i data-lucide="scale"></i></button>
      </div>
      <div class="t3-editor-fields" id="t3-editor-fields-position">
        <label>X<input type="number" step="0.1" id="t3-editor-px" /></label>
        <label>Y<input type="number" step="0.1" id="t3-editor-py" /></label>
        <label>Z<input type="number" step="0.1" id="t3-editor-pz" /></label>
      </div>
      <div class="t3-editor-fields" id="t3-editor-fields-rotation" hidden>
        <label>X&deg;<input type="number" step="1" id="t3-editor-rx" /></label>
        <label>Y&deg;<input type="number" step="1" id="t3-editor-ry" /></label>
        <label>Z&deg;<input type="number" step="1" id="t3-editor-rz" /></label>
      </div>
      <div class="t3-editor-fields" id="t3-editor-fields-scale" hidden>
        <label>X<input type="number" step="0.05" id="t3-editor-sx" /></label>
        <label>Y<input type="number" step="0.05" id="t3-editor-sy" /></label>
        <label>Z<input type="number" step="0.05" id="t3-editor-sz" /></label>
      </div>
      <button class="btn btn-sm" id="t3-editor-reset-item" style="width:100%; justify-content:center; margin-top:8px;">
        <i data-lucide="undo-2"></i> Reset this item
      </button>
    </div>

    <div class="t3-editor-footer">
      <button class="btn btn-sm" id="t3-editor-reset-all" style="width:100%; justify-content:center;">
        <i data-lucide="rotate-ccw"></i> Reset all to shipped layout
      </button>
      <div class="util-text" style="margin-top:8px;">Click an object in the scene, or pick one from the list above. Edits autosave to this browser.</div>
    </div>
  </div>`;
}

export function createEditor({ scene, camera, renderer, controls, section, baseItems }) {
  const items = flattenItems(baseItems);
  const overrides = loadOverrides();
  let enabled = false;
  let selected = null; // { id, name, object }
  let mode = "translate";

  const gizmo = new TransformControls(camera, renderer.domElement);
  gizmo.setSize(0.85);
  gizmo.visible = false;
  gizmo.enabled = false;
  scene.add(gizmo.getHelper());

  gizmo.addEventListener("dragging-changed", (e) => { controls.enabled = !e.value; });
  gizmo.addEventListener("objectChange", () => { if (selected) { syncFieldsFromObject(); persistSelected(); } });

  const els = {
    panel: section.querySelector("#t3-editor-panel"),
    close: section.querySelector("#t3-editor-close"),
    searchInput: section.querySelector("#t3-editor-search-input"),
    list: section.querySelector("#t3-editor-list"),
    selectedBox: section.querySelector("#t3-editor-selected"),
    selectedName: section.querySelector("#t3-editor-selected-name"),
    modes: section.querySelector("#t3-editor-modes"),
    fieldsPos: section.querySelector("#t3-editor-fields-position"),
    fieldsRot: section.querySelector("#t3-editor-fields-rotation"),
    fieldsScale: section.querySelector("#t3-editor-fields-scale"),
    px: section.querySelector("#t3-editor-px"), py: section.querySelector("#t3-editor-py"), pz: section.querySelector("#t3-editor-pz"),
    rx: section.querySelector("#t3-editor-rx"), ry: section.querySelector("#t3-editor-ry"), rz: section.querySelector("#t3-editor-rz"),
    sx: section.querySelector("#t3-editor-sx"), sy: section.querySelector("#t3-editor-sy"), sz: section.querySelector("#t3-editor-sz"),
    resetItem: section.querySelector("#t3-editor-reset-item"),
    resetAll: section.querySelector("#t3-editor-reset-all"),
  };

  /** `baseItems` is `stationHandle.editables`: a flat array of `{id, name, object}`, one per
   *  top-level placed group (ground, LCC, header/manifolds, bay aprons, fence/gates, each
   *  PLACEMENTS entry). Kept flat (not nested) -- good enough for "click it, nudge it". */
  function flattenItems(list) {
    return list.filter((it) => it && it.object);
  }

  function renderList(filter) {
    const term = (filter || "").trim().toLowerCase();
    const rows = items
      .filter((it) => !term || it.name.toLowerCase().includes(term))
      .map((it) => `<button type="button" class="t3-editor-row${selected && selected.id === it.id ? " active" : ""}" data-id="${it.id}">${it.name}</button>`)
      .join("");
    els.list.innerHTML = rows || `<div class="util-text" style="padding:8px 2px;">No match.</div>`;
  }

  function selectItem(id) {
    const item = items.find((it) => it.id === id);
    if (!item) return;
    selected = item;
    gizmo.attach(item.object);
    gizmo.visible = true;
    gizmo.enabled = true;
    els.selectedBox.hidden = false;
    els.selectedName.textContent = item.name;
    syncFieldsFromObject();
    renderList(els.searchInput.value);
  }

  function deselect() {
    selected = null;
    gizmo.detach();
    gizmo.visible = false;
    gizmo.enabled = false;
    els.selectedBox.hidden = true;
    renderList(els.searchInput.value);
  }

  function setMode(next) {
    mode = next;
    gizmo.setMode(mode);
    els.modes.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    els.fieldsPos.hidden = mode !== "translate";
    els.fieldsRot.hidden = mode !== "rotate";
    els.fieldsScale.hidden = mode !== "scale";
  }

  function syncFieldsFromObject() {
    if (!selected) return;
    const o = selected.object;
    els.px.value = round2(o.position.x); els.py.value = round2(o.position.y); els.pz.value = round2(o.position.z);
    els.rx.value = round2(o.rotation.x / RAD); els.ry.value = round2(o.rotation.y / RAD); els.rz.value = round2(o.rotation.z / RAD);
    els.sx.value = round2(o.scale.x); els.sy.value = round2(o.scale.y); els.sz.value = round2(o.scale.z);
  }
  function round2(n) { return Math.round(n * 100) / 100; }

  function applyFieldsToObject() {
    if (!selected) return;
    const o = selected.object;
    o.position.set(parseFloat(els.px.value) || 0, parseFloat(els.py.value) || 0, parseFloat(els.pz.value) || 0);
    o.rotation.set((parseFloat(els.rx.value) || 0) * RAD, (parseFloat(els.ry.value) || 0) * RAD, (parseFloat(els.rz.value) || 0) * RAD);
    const sx = parseFloat(els.sx.value), sy = parseFloat(els.sy.value), sz = parseFloat(els.sz.value);
    o.scale.set(sx || 1, sy || 1, sz || 1);
    persistSelected();
  }

  function persistSelected() {
    if (!selected) return;
    const o = selected.object;
    overrides[selected.id] = {
      position: [o.position.x, o.position.y, o.position.z],
      rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
      scale: [o.scale.x, o.scale.y, o.scale.z],
    };
    saveOverrides(overrides);
  }

  function resetSelected() {
    if (!selected) return;
    delete overrides[selected.id];
    saveOverrides(overrides);
    // There's no separate "original" copy kept in memory -- the shipped default only exists in
    // layout.js's source. Simplest honest reset: tell the user to reload, which rebuilds the
    // scene from layout.js defaults with (now-empty) overrides applied on top.
    if (confirm(`Reset "${selected.name}" to its shipped position? The page will reload.`)) location.reload();
  }
  function resetAll() {
    if (confirm("Reset ALL objects to the shipped layout? This clears every saved edit and reloads the page.")) {
      saveOverrides({});
      location.reload();
    }
  }

  /* ---------------- click-to-select raycasting ---------------- */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function onCanvasClick(e) {
    if (!enabled || gizmo.dragging) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(items.map((it) => it.object), true);
    if (!hits.length) return;
    let obj = hits[0].object;
    while (obj && !items.some((it) => it.object === obj)) obj = obj.parent;
    if (obj) {
      const item = items.find((it) => it.object === obj);
      if (item) selectItem(item.id);
    }
  }
  renderer.domElement.addEventListener("click", onCanvasClick);

  /* ---------------- UI wiring ---------------- */
  els.close.addEventListener("click", () => setEnabled(false));
  els.searchInput.addEventListener("input", () => renderList(els.searchInput.value));
  els.list.addEventListener("click", (e) => {
    const row = e.target.closest(".t3-editor-row");
    if (row) selectItem(row.dataset.id);
  });
  els.modes.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-mode]");
    if (btn) setMode(btn.dataset.mode);
  });
  [els.px, els.py, els.pz, els.rx, els.ry, els.rz, els.sx, els.sy, els.sz].forEach((input) => {
    input.addEventListener("change", applyFieldsToObject);
  });
  els.resetItem.addEventListener("click", resetSelected);
  els.resetAll.addEventListener("click", resetAll);

  renderList("");

  function setEnabled(v) {
    enabled = v;
    els.panel.hidden = !v;
    if (!v) deselect();
    if (window.lucide) lucide.createIcons();
  }

  return {
    get enabled() { return enabled; },
    setEnabled,
    update() { /* TransformControls (a `Controls` subclass) drives itself off pointer events —
                  nothing needs a per-frame tick here; kept as a no-op for interface symmetry with
                  the rest of twin3d.js's per-tick calls. */ },
  };
}
