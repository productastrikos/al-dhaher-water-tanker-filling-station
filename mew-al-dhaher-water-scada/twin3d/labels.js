/* twin3d/labels.js — CSS2DRenderer HUD chips pinned to instruments. */
import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

/** Creates a `.t3-label` chip attached (as a CSS2DObject) to `anchor` at local `offset`.
 *  Returns a handle with `.set(html)` and `.setTone(tone)` for cheap updates. */
export function createLabel(anchor, offset, initialHtml = "", tone = "") {
  const el = document.createElement("div");
  el.className = `t3-label${tone ? ` t3-label--${tone}` : ""}`;
  el.innerHTML = initialHtml;
  const obj = new CSS2DObject(el);
  obj.position.copy(offset);
  anchor.add(obj);
  return {
    el, obj,
    set(html) { if (el.innerHTML !== html) el.innerHTML = html; },
    setTone(tone2) { el.className = `t3-label${tone2 ? ` t3-label--${tone2}` : ""}`; },
    setVisible(v) { obj.visible = v; },
    dispose() { anchor.remove(obj); el.remove(); },
  };
}

export function kv(key, value) {
  return `<span class="t3-k">${key}</span><span class="t3-v">${value}</span>`;
}
