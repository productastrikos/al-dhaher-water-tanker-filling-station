/* twin3d/picking.js — raycast hover/click on bay apron meshes. */
import * as THREE from "three";

export function createPicker(renderer, camera, getPickables) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let onHoverCb = null;
  let onClickCb = null;
  let lastHover = null;

  function setNdc(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  function pick() {
    ray.setFromCamera(ndc, camera);
    const list = getPickables();
    const hits = ray.intersectObjects(list.map((p) => p.mesh), false);
    if (!hits.length) return null;
    return list.find((p) => p.mesh === hits[0].object) || null;
  }

  function onMove(e) {
    setNdc(e);
    const hit = pick();
    const bayId = hit ? hit.bayId : null;
    if (bayId !== lastHover) {
      lastHover = bayId;
      renderer.domElement.style.cursor = bayId ? "pointer" : "grab";
      if (onHoverCb) onHoverCb(hit);
    }
  }
  function onClick(e) {
    setNdc(e);
    const hit = pick();
    if (hit && onClickCb) onClickCb(hit);
  }

  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("click", onClick);

  return {
    onHover(cb) { onHoverCb = cb; },
    onClick(cb) { onClickCb = cb; },
    dispose() {
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("click", onClick);
    },
  };
}
