/* twin3d/assets.js — GLTF cache + small helpers shared by layout.js and trucks.js.
 * Loading is cached per filename so placing the same catalog model many times (e.g. bay
 * canopies) only downloads/parses it once; every placement gets its own clone(). */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

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
            // NOTE: deliberately no blanket "recolour untextured white meshes" step here anymore
            // -- that used to flatten every white/no-map material to one grey regardless of what
            // part it was (it's why the 4-truck fleet's cab/tank/tyre/glass all rendered as the
            // same dull grey despite having distinct, semantically-named materials). Assets that
            // genuinely need colour get it explicitly via `recolor()`, called per-asset by the
            // code placing them, so different parts can get different, intentional colours.
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

/** Parses a GLB/GLTF already sitting in memory (e.g. a user-picked File read as an
 *  ArrayBuffer) instead of fetching one from assets/models/. Used by the editor's "drop a
 *  .glb" flow. Never rejects. */
export function parseModelBuffer(arrayBuffer) {
  return new Promise((resolve) => {
    loader.parse(
      arrayBuffer,
      "",
      (gltf) => {
        const root = gltf.scene;
        root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        resolve(root);
      },
      (err) => { console.warn("[twin3d] uploaded model failed to parse", err && err.message); resolve(null); }
    );
  });
}

/** Deep-clones a template Object3D, INCLUDING per-mesh material clones, so per-instance tinting
 *  (e.g. truck status colour) never leaks across every placed copy. */
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

/** Wraps `obj` in a fresh Group offset so the group's own origin sits at the object's footprint
 *  centre, resting on y=0. Several of the supplied GLBs bake geometry far from their local
 *  origin, so this must run before any position/scale is applied by the caller. */
export function centerAndGround(obj) {
  if (!obj) return obj;
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  obj.position.set(-center.x, -box.min.y, -center.z);
  wrapper.add(obj);
  return wrapper;
}

/** Scales a model uniformly so its bounding-box height equals `metres`, then rests it on y=0. */
export function normalizeToHeight(root, metres) {
  if (!root) return root;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const h = size.y || 1;
  root.scale.multiplyScalar(metres / h);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
  return root;
}

/** Recolours a loaded GLB template in place (heuristic by mesh/material name). Used to turn the
 *  KolosStudios olive-drab tanker into a white body/tank with dark tyres. Safe to call once on
 *  the cached template — every clone then inherits the new colours. */
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
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.1, 2), new THREE.MeshStandardMaterial({ color: 0xe8edf3, roughness: 0.5 }));
  cab.position.set(0, 1.2, 3.1);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 5.4, 16), new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.4 }));
  tank.rotation.z = Math.PI / 2;
  tank.position.set(0, 1.7, -0.6);
  g.add(cab, tank);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** A repeating cyan-on-steel band texture for the process piping. Animating its V offset (see
 *  layout.js's updatePipeFlow) each frame is what reads as water moving through the header/
 *  manifold/riser network instead of static pipe colour. */
export function makeFlowTexture() {
  const cv = document.createElement("canvas");
  cv.width = 8; cv.height = 64;
  const cx = cv.getContext("2d");
  cx.fillStyle = "#5b7089"; cx.fillRect(0, 0, 8, 64);
  cx.fillStyle = "#67e8f9";
  for (let y = 0; y < 64; y += 16) cx.fillRect(0, y, 8, 8);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Collapses a deep hierarchy of many small meshes into a handful of merged meshes (one per
 *  distinct material), baking each mesh's local transform into its geometry first. This is the
 *  single biggest lever for the supplied "3D Assets" GLBs: several of them ship as 2000+
 *  individual mesh nodes (e.g. the storage tank farm) or dozens of foliage cards (vegetation
 *  clumps), and every one of those is a separate WebGL draw call. Below `threshold` meshes this
 *  is a no-op — merging a handful of meshes isn't worth the extra complexity. Falls back to
 *  leaving a material's meshes unmerged (not the whole object) if their geometries turn out to
 *  have mismatched vertex attributes, which `mergeGeometries` can't combine. */
function materialSignature(m) {
  // Grouping key by CONTENT, not object identity: cloneModel() (used on every placement before
  // this runs, so per-instance tinting works elsewhere) gives every mesh its own material clone
  // even when the source GLB shared one material across thousands of nodes -- grouping by
  // `material.uuid` would then never find a match and this whole function would be a no-op.
  const map = m.map ? m.map.uuid : "";
  const color = m.color ? m.color.getHexString() : "";
  const emissive = m.emissive ? m.emissive.getHexString() : "";
  return [m.type, m.name, color, map, m.metalness, m.roughness, m.opacity, emissive].join("|");
}

export function optimizeMeshCount(root, threshold = 24) {
  const meshes = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes.position) meshes.push(o); });
  if (meshes.length <= threshold) return root;

  const buckets = new Map(); // material signature -> { material, geoms: [], castShadow, receiveShadow }
  meshes.forEach((mesh) => {
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!mat) return;
    const key = materialSignature(mat);
    let bucket = buckets.get(key);
    if (!bucket) { bucket = { material: mat, geoms: [], castShadow: false, receiveShadow: false }; buckets.set(key, bucket); }
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    bucket.geoms.push(geo);
    bucket.castShadow = bucket.castShadow || mesh.castShadow;
    bucket.receiveShadow = bucket.receiveShadow || mesh.receiveShadow;
  });

  const out = new THREE.Group();
  buckets.forEach((b) => {
    if (b.geoms.length > 1) {
      let merged = null;
      try { merged = mergeGeometries(b.geoms, false); } catch (e) { merged = null; }
      if (merged) {
        const m = new THREE.Mesh(merged, b.material);
        m.castShadow = b.castShadow; m.receiveShadow = b.receiveShadow;
        out.add(m);
        return;
      }
    }
    b.geoms.forEach((geo) => {
      const m = new THREE.Mesh(geo, b.material);
      m.castShadow = b.castShadow; m.receiveShadow = b.receiveShadow;
      out.add(m);
    });
  });
  return out;
}

export function boundingSize(root) {
  return new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
}
