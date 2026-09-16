/* twin3d/labels.js — at-a-glance bay status markers.
 *
 * Previously this file drew floating CSS2D text chips ("Bay 14 · 3,420/5,000 IG · 68% · 41.8
 * m³/h ...") pinned above active bays. Those chips are world-anchored, so as the camera orbited
 * the readable text visibly slid/drifted across the screen -- the client's exact complaint
 * ("the trucks with mooving panal looks bad"). twin3d.js now answers "what's happening at this
 * truck/bay" with a proper click-to-select, screen-fixed info panel (raycast in twin3d.js's
 * onCanvasClick) that shows the real numbers and stays put regardless of camera movement.
 *
 * This file's remaining job is just the at-a-glance layer: one small colour-coded dot per bay,
 * billboarded (THREE.Sprite always faces the camera) so it reads as a status light rather than a
 * UI element that can drift/slide -- a dot carries no text to visually "read while moving", so
 * unlike the old chips it can safely stay world-anchored without looking broken.
 */
import * as THREE from "three";
import { bayLayout, BAY_COUNT, STATUS_COLOR } from "./layout.js?v=12";

const MARKER_Y = 3.75; // just above the loading-arm connection point / truck cab height
const MARKER_SIZE = 1.15;

function hex(n) { return `#${n.toString(16).padStart(6, "0")}`; }

/** A soft radial-gradient dot baked once into a small canvas texture and shared by every marker
 *  sprite (only each sprite's material .color differs, done cheaply via SpriteMaterial.color). */
function makeDotTexture() {
  const size = 64;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.6, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** One sprite per bay (all 42), positioned once at build time; only .material.color changes
 *  per tick, so this is a handful of cheap uniform updates, not per-frame geometry work. */
export function createLabelLayer() {
  const group = new THREE.Group();
  group.name = "statusMarkers";
  const texture = makeDotTexture();
  const markers = new Map(); // bayId -> THREE.Sprite

  for (let id = 1; id <= BAY_COUNT; id++) {
    const l = bayLayout(id);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      color: STATUS_COLOR.idle,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(MARKER_SIZE, MARKER_SIZE, 1);
    sprite.position.set(l.instrumentPos.x, MARKER_Y, l.z);
    group.add(sprite);
    markers.set(id, sprite);
  }

  let enabled = true;

  /** Called once per app tick (~2.2s) with the live bay array. */
  function update(bays) {
    bays.forEach((bay) => {
      const sprite = markers.get(bay.id);
      if (!sprite) return;
      sprite.material.color.setHex(STATUS_COLOR[bay.status] ?? STATUS_COLOR.idle);
      // Faults always pop a little bigger so they don't get lost among 42 idle/filling dots.
      const s = bay.status === "fault" ? MARKER_SIZE * 1.35 : MARKER_SIZE;
      sprite.scale.set(s, s, 1);
    });
  }

  function setEnabled(v) {
    enabled = v;
    group.visible = v;
  }

  return { group, update, setEnabled, get enabled() { return enabled; } };
}

/** Always-on colour-key so the status colours (shared with the dashboard/HMI via
 *  layout.js's STATUS_COLOR) are self-explanatory without hovering anything. */
export function legendHtml() {
  const rows = Object.entries(STATUS_COLOR)
    .map(([k, v]) => `<span class="t3-legend-item"><span class="t3-legend-dot" style="background:${hex(v)}"></span>${k}</span>`)
    .join("");
  return `<div class="t3-legend" id="t3-legend">${rows}</div>`;
}
