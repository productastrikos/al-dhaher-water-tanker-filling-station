/* twin3d/assets.ts — GLTF cache + helpers shared by layout.ts and trucks.ts (ported from legacy/twin3d/assets.js).
 * Loading is cached per filename (module level, survives remounts) so placing the same catalog model many
 * times only downloads/parses it once; every placement gets its own clone(). Disposing a scene releases GPU
 * resources only (three re-uploads on next use), so the shared templates stay valid across remounts. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const MODEL_BASE = `${import.meta.env.BASE_URL}assets/models/`;
const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Object3D | null>>();

type AnyMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
const isMesh = (o: THREE.Object3D): o is AnyMesh => (o as THREE.Mesh).isMesh === true;

/** Loads (and caches) a GLB as a template Object3D. Resolves to null (never rejects) on failure so callers
 *  can fall back to a primitive without a try/catch at every call site. */
export function loadModel(file: string): Promise<THREE.Object3D | null> {
  let p = cache.get(file);
  if (!p) {
    p = new Promise((resolve) => {
      loader.load(
        MODEL_BASE + file,
        (gltf) => {
          const root = gltf.scene;
          root.traverse((o) => { if (isMesh(o)) { o.castShadow = true; o.receiveShadow = true; } });
          resolve(root);
        },
        undefined,
        (err) => { console.warn(`[twin3d] model failed: ${file}`, (err as { message?: string })?.message); resolve(null); },
      );
    });
    cache.set(file, p);
  }
  return p;
}

/** Parses a GLB already in memory (user-picked File). Never rejects. Kept for the editor's "drop a .glb" flow. */
export function parseModelBuffer(arrayBuffer: ArrayBuffer): Promise<THREE.Object3D | null> {
  return new Promise((resolve) => {
    loader.parse(
      arrayBuffer, '',
      (gltf) => {
        const root = gltf.scene;
        root.traverse((o) => { if (isMesh(o)) { o.castShadow = true; o.receiveShadow = true; } });
        resolve(root);
      },
      (err) => { console.warn('[twin3d] uploaded model failed to parse', (err as { message?: string })?.message); resolve(null); },
    );
  });
}

/** Deep-clones a template Object3D, INCLUDING per-mesh material clones, so per-instance tinting (truck status
 *  colour) never leaks across every placed copy. */
export function cloneModel<T extends THREE.Object3D>(template: T): T;
export function cloneModel<T extends THREE.Object3D>(template: T | null): T | null;
export function cloneModel<T extends THREE.Object3D>(template: T | null): T | null {
  if (!template) return null;
  const clone = template.clone(true) as T;
  clone.traverse((o) => {
    if (isMesh(o)) {
      o.castShadow = true; o.receiveShadow = true;
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    }
  });
  return clone;
}

/** Wraps `obj` in a fresh Group offset so the group's own origin sits at the object's footprint centre, resting on y=0.
 *  Several of the supplied GLBs bake geometry far from their local origin, so this runs before any position/scale. */
export function centerAndGround(obj: THREE.Object3D): THREE.Group {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  obj.position.set(-center.x, -box.min.y, -center.z);
  wrapper.add(obj);
  return wrapper;
}

/** Scales a model uniformly so its bounding-box height equals `metres`, then rests it on y=0. */
export function normalizeToHeight<T extends THREE.Object3D>(root: T, metres: number): T {
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

/** Simple procedural fallback (box-on-wheels) used if a GLB fails to load, so the scene never shows a hole where a truck should be. */
export function fallbackTruck(): THREE.Group {
  const g = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.1, 2), new THREE.MeshStandardMaterial({ color: 0xe8edf3, roughness: 0.5 }));
  cab.position.set(0, 1.2, 3.1);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 5.4, 16), new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.4 }));
  tank.rotation.z = Math.PI / 2;
  tank.position.set(0, 1.7, -0.6);
  g.add(cab, tank);
  g.traverse((o) => { if (isMesh(o)) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** A repeating cyan-on-steel band texture for the process piping. Animating its V offset each frame (see
 *  layout.ts updatePipeFlow) is what reads as water moving through the header/manifold/riser network. */
export function makeFlowTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 8; cv.height = 64;
  const cx = cv.getContext('2d')!;
  cx.fillStyle = '#5b7089'; cx.fillRect(0, 0, 8, 64);
  cx.fillStyle = '#67e8f9';
  for (let y = 0; y < 64; y += 16) cx.fillRect(0, y, 8, 8);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Grouping key by CONTENT, not object identity (clones of one shared source material must still bucket together). */
function materialSignature(m: THREE.Material): string {
  const s = m as THREE.MeshStandardMaterial;
  const map = s.map ? s.map.uuid : '';
  const color = s.color ? s.color.getHexString() : '';
  const emissive = s.emissive ? s.emissive.getHexString() : '';
  return [m.type, m.name, color, map, s.metalness, s.roughness, m.opacity, emissive, s.emissiveIntensity, m.transparent, m.side].join('|');
}
function geometrySignature(g: THREE.BufferGeometry): string {
  return Object.keys(g.attributes).sort().join(',') + (g.index ? ':i' : ':n');
}

/** Collapses a deep hierarchy of many small meshes into a handful of merged meshes (one per distinct material),
 *  baking each mesh's transform into its geometry first. Biggest lever for the supplied GLBs (several ship as 2000+
 *  mesh nodes, e.g. the storage tank farm). Below `threshold` meshes this is a no-op. Returns a NEW group; `root`
 *  is left untouched. Falls back to leaving a bucket's meshes unmerged if their attributes can't be combined. */
export function optimizeMeshCount(root: THREE.Object3D, threshold = 24): THREE.Object3D {
  const meshes: AnyMesh[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (isMesh(o) && o.geometry && o.geometry.attributes.position) meshes.push(o); });
  if (meshes.length <= threshold) return root;

  interface Bucket { material: THREE.Material; geoms: THREE.BufferGeometry[]; castShadow: boolean; receiveShadow: boolean }
  const buckets = new Map<string, Bucket>();
  meshes.forEach((mesh) => {
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!mat) return;
    const key = materialSignature(mat) + '#' + geometrySignature(mesh.geometry);
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
      let merged: THREE.BufferGeometry | null = null;
      try { merged = mergeGeometries(b.geoms, false); } catch { merged = null; }
      if (merged) {
        const m = new THREE.Mesh(merged, b.material);
        m.castShadow = b.castShadow; m.receiveShadow = b.receiveShadow;
        out.add(m);
        b.geoms.forEach((g) => g.dispose());
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

/** In-place variant used on the procedural station groups: merges every plain Mesh under `group` (relative to the
 *  group's own transform) into one mesh per (material, attributes, shadow flags) bucket, removes the originals and
 *  disposes whatever is no longer referenced. InstancedMesh / Line / Sprite children are left alone. Keeps the
 *  yard to a few dozen draw calls instead of ~1500 (42 bays x ~30 primitives each). */
export function mergeStaticMeshes(group: THREE.Object3D, filter: (m: AnyMesh) => boolean = () => true): void {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const meshes: AnyMesh[] = [];
  group.traverse((o) => {
    if (isMesh(o) && !(o as unknown as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(o.material) && filter(o)) meshes.push(o);
  });
  if (meshes.length < 2) return;

  interface Bucket { material: THREE.Material; geoms: THREE.BufferGeometry[]; src: AnyMesh[]; cast: boolean; recv: boolean }
  const buckets = new Map<string, Bucket>();
  const rel = new THREE.Matrix4();
  meshes.forEach((mesh) => {
    const mat = mesh.material as THREE.Material;
    const key = `${materialSignature(mat)}#${geometrySignature(mesh.geometry)}#${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}`;
    let b = buckets.get(key);
    if (!b) { b = { material: mat, geoms: [], src: [], cast: mesh.castShadow, recv: mesh.receiveShadow }; buckets.set(key, b); }
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(rel.multiplyMatrices(inv, mesh.matrixWorld));
    b.geoms.push(geo);
    b.src.push(mesh);
  });

  const kept = new Set<THREE.Material>();
  buckets.forEach((b) => {
    let merged: THREE.BufferGeometry | null = null;
    try { merged = b.geoms.length > 1 ? mergeGeometries(b.geoms, false) : b.geoms[0]; } catch { merged = null; }
    if (!merged) { b.geoms.forEach((g) => g.dispose()); return; } // leave this bucket's originals in place
    if (b.geoms.length > 1) b.geoms.forEach((g) => g.dispose());
    const m = new THREE.Mesh(merged, b.material);
    m.castShadow = b.cast; m.receiveShadow = b.recv;
    group.add(m);
    kept.add(b.material);
    b.src.forEach((mesh) => {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material;
      if (mat !== b.material && !kept.has(mat)) mat.dispose();
    });
  });
}

/** Frees GPU/CPU resources for everything under `root`: geometries, materials and every texture they reference. */
export function disposeObject(root: THREE.Object3D): void {
  const mats = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((o) => {
    const any = o as THREE.Mesh & { isInstancedMesh?: boolean; geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
    if (any.geometry) any.geometry.dispose();
    if ((any as unknown as THREE.InstancedMesh).isInstancedMesh) (any as unknown as THREE.InstancedMesh).dispose();
    const m = any.material;
    if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => mats.add(mm));
  });
  mats.forEach((m) => {
    for (const v of Object.values(m)) if (v && (v as THREE.Texture).isTexture) textures.add(v as THREE.Texture);
    m.dispose();
  });
  textures.forEach((t) => t.dispose());
}
