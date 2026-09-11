/* twin3d/assets.js — GLTF cache, recolour helpers, scale normalisation, primitive fallbacks. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
const cache = new Map(); // file -> Promise<Object3D|null>

/** Loads (and caches) a GLB as a template Object3D. Resolves to null (never rejects) on failure
 *  so callers can fall back to a primitive without a try/catch at every call site. */
export function loadModel(file) {
  if (!cache.has(file)) {
    cache.set(
      file,
      new Promise((resolve) => {
        loader.load(
          `assets/models/${file}`,
          (gltf) => {
            const root = gltf.scene;
            root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            resolve(root);
          },
          undefined,
          (err) => { console.warn(`[twin3d] model failed: ${file}`, err && err.message); resolve(null); }
        );
      })
    );
  }
  return cache.get(file);
}

/** Deep-clones a template Object3D, INCLUDING per-mesh material clones. Plain Object3D.clone(true)
 *  only clones the scene graph — every instance would keep sharing the same material objects, so
 *  per-truck tinting (offline grey, fault red) would leak across the whole pool without this. */
export function cloneModel(template) {
  if (!template) return null;
  const clone = template.clone(true);
  clone.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    }
  });
  return clone;
}

/** Scales a model uniformly so its bounding-box height equals `metres`, then sits it on y=0. */
export function normalizeToHeight(root, metres) {
  if (!root) return root;
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const h = size.y || 1;
  root.scale.multiplyScalar(metres / h);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
  return root;
}

export function boundingSize(root) {
  return new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
}

/** Recolours a loaded GLB template in place (heuristic by mesh/material name). Used to turn the
 *  KolosStudios olive-drab tanker into a white body/tank with dark tyres. Safe to call once on
 *  the cached template — every pool clone then inherits the new colours. */
export function recolor(root, { body = "#e8edf3", tank = "#f4f6f8", tyre = "#1c2230" } = {}) {
  if (!root) return root;
  const seen = new Set();
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (seen.has(m) || !m.color) return;
      seen.add(m);
      const name = `${o.name || ""} ${m.name || ""}`.toLowerCase();
      if (/tyre|tire|wheel|rim|track/.test(name)) m.color.set(tyre);
      else if (/tank|drum|cylinder|barrel|vessel/.test(name)) m.color.set(tank);
      else m.color.set(body);
      m.metalness = Math.min(0.6, m.metalness ?? 0.3);
      m.roughness = Math.max(0.35, m.roughness ?? 0.5);
      m.needsUpdate = true;
    });
  });
  return root;
}

/** Simple procedural fallback (box-on-wheels) used if a GLB fails to load, so the scene never
 *  shows a hole where a truck should be. */
export function fallbackTruck() {
  const g = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.1, 2), new THREE.MeshStandardMaterial({ color: 0xe8edf3 }));
  cab.position.set(0, 1.2, 3.1);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 5.4, 16), new THREE.MeshStandardMaterial({ color: 0xf4f6f8 }));
  tank.rotation.z = Math.PI / 2;
  tank.position.set(0, 1.7, -0.6);
  g.add(cab, tank);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Builds a cyan dashed-flow canvas texture for the animated process-line overlay. */
export function makeFlowTexture() {
  const cv = document.createElement("canvas");
  cv.width = 64; cv.height = 8;
  const cx = cv.getContext("2d");
  cx.fillStyle = "#04141c"; cx.fillRect(0, 0, 64, 8);
  cx.fillStyle = "#22d3ee"; cx.fillRect(0, 0, 26, 8);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(20, 1);
  return tex;
}
