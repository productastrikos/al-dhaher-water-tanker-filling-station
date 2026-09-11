/* twin3d/camera.js — camera presets (Overview / Manifold / Bay / Follow-truck) with eased tweens. */
import * as THREE from "three";
import { manifoldX } from "./station.js";

export function overviewShot() {
  return { pos: new THREE.Vector3(78, 66, 104), target: new THREE.Vector3(0, 0, -4) };
}
export function manifoldShot(manifoldIndex) {
  const x = manifoldX(manifoldIndex ?? 2);
  return { pos: new THREE.Vector3(x + 34, 26, 34), target: new THREE.Vector3(x, 3, -6) };
}
export function bayShot(bayPos) {
  return {
    pos: bayPos.clone().add(new THREE.Vector3(-9, 6.5, 11)),
    target: bayPos.clone().add(new THREE.Vector3(0, 1.6, 0)),
  };
}

/** Eased camera+target tween manager. `to()` starts a tween; `update(dt)` advances it each frame
 *  (called from the scene's onTick list). Follow-mode is handled separately by twin3d.js since it
 *  needs to keep re-targeting every frame rather than reach a fixed destination. */
export function createCameraTween(camera, controls) {
  let active = null;
  function to(pos, target, duration = 1.2) {
    active = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), pos: pos.clone(), target: target.clone(), duration, t: 0 };
  }
  function update(dt) {
    if (!active) return;
    active.t += dt;
    const k = Math.min(1, active.t / active.duration);
    const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
    camera.position.lerpVectors(active.fromPos, active.pos, e);
    controls.target.lerpVectors(active.fromTarget, active.target, e);
    if (k >= 1) active = null;
  }
  return { to, update, get active() { return !!active; } };
}
