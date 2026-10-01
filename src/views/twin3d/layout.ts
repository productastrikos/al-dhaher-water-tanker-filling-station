/* twin3d/layout.ts — the static station (ported from legacy/twin3d/layout.js): ground, black asphalt roads/footings,
 * fence, gates, 6 manifolds x 7 bays, and every supplied .glb placed in the yard. Geometry and numbers are the
 * legacy ones; the only structural change is draw-call hygiene: per-bay apron / status dot / kiosk / valve /
 * fine-fill valve are InstancedMeshes (per-instance colour via setColorAt — never vertexColors), and all the other
 * small primitives (pipework, instrument bodies, loading arms, lane paint, ...) are merged per material, so the
 * yard costs a few dozen draw calls instead of ~1500. */
import * as THREE from 'three';
import type { Bay, BayStatus } from '../../sim/data';
import {
  loadModel, cloneModel, normalizeToHeight, centerAndGround, optimizeMeshCount, makeFlowTexture, mergeStaticMeshes,
} from './assets';

export const MANIFOLDS = 6;
export const BAYS_PER_MANIFOLD = 7;
export const BAY_COUNT = MANIFOLDS * BAYS_PER_MANIFOLD; // 42

const MANIFOLD_DX = 32;
const BAY_DZ = 13;
const HEADER_Z = -66;
// Hugging the ground (not just "below truck height") is what reads as underground yard piping from an elevated camera.
const HEADER_Y = 0.35;
const MANIFOLD_Y = 0.28;
// The manifold's N-S spine sits in the open aisle between bay rows, clear of the apron/canopy footprint.
const PIPE_X_OFFSET = 6;
// Where each bay's valve/meter/PT/TT stack sits — just inside the apron's west edge, short of the kiosk.
const INSTRUMENT_X_OFFSET = 2.3;

export function manifoldX(m: number): number { return (m - (MANIFOLDS - 1) / 2) * MANIFOLD_DX; }
export function baySlotZ(s: number): number { return (s - (BAYS_PER_MANIFOLD - 1) / 2) * BAY_DZ; }

export const GATE_ENTRY = new THREE.Vector3(-26, 0, 66);
export const GATE_EXIT = new THREE.Vector3(26, 0, 66);
// Z of the east-west perimeter loop road — trucks route their arrival/departure along it.
export const ROAD_LOOP_Z = 58;
export function laneX(manifoldIndex: number): number { return manifoldX(manifoldIndex) + 7.6; }

export const STATUS_COLOR: Record<BayStatus, number> = {
  idle: 0x2c3b52, filling: 0x22d3ee, done: 0x34d399, fault: 0xf87171, offline: 0x5f7292,
};
const FINE_FILL_COLOR = 0xf59e0b;

export interface BayAnchors {
  id: number; manifold: number; slot: number; manifoldX: number; z: number;
  riser: THREE.Vector3; truckPos: THREE.Vector3; instrumentPos: THREE.Vector3;
}
/** Bay id (1..42) -> world-space anchors used by trucks.ts / labels.ts. */
export function bayLayout(id: number): BayAnchors {
  const m = Math.floor((id - 1) / BAYS_PER_MANIFOLD);
  const s = (id - 1) % BAYS_PER_MANIFOLD;
  const x = manifoldX(m);
  const z = baySlotZ(s);
  return {
    id, manifold: m, slot: s, manifoldX: x, z,
    riser: new THREE.Vector3(x, 0, z),
    truckPos: new THREE.Vector3(x + 7.6, 0, z),
    instrumentPos: new THREE.Vector3(x + INSTRUMENT_X_OFFSET, 0, z),
  };
}

export interface Editable { id: string; name: string; object: THREE.Object3D }

export interface StationHandle {
  group: THREE.Group;
  editables: Editable[];
  /** Recolour the per-bay status dots / valves from live bay state (cheap; call when the bays array changes). */
  updateBays(bays: readonly Bay[]): void;
  /** Animate the process-pipe flow texture (call every frame). */
  updateFlow(dt: number): void;
  /** If `obj` is one of the instanced per-bay meshes, the bay id for `instanceId`, else null. */
  bayIdFromInstance(obj: THREE.Object3D, instanceId: number | undefined): number | null;
}

export interface BuildCtx { cancelled(): boolean }

function pipeMat(color = 0x8a97a8) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.4 });
}
function asphaltMat() {
  return new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.92, metalness: 0.02 });
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
function addStraightPipe(group: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, 12);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, dir.clone().normalize());
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/** Wraps a chunk of procedural geometry as a single named, editable unit (mirrors how placed .glb assets are tagged). */
function makeEditableGroup(id: string, name: string): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.userData.placementId = id;
  return g;
}

/* ---------------- ground + roads (proper black asphalt "footing" everywhere) ---------------- */
function buildGroundAndRoads(parent: THREE.Object3D) {
  const g = makeEditableGroup('ground-roads', 'Ground & Roads');
  parent.add(g);

  // Neutral, fairly dark grey concrete hardstanding.
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x545a63, roughness: 0.95, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 160, 1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);

  const grid = new THREE.GridHelper(240, 60, 0x3c4048, 0x454a52);
  grid.position.y = 0.015;
  const gridMat = grid.material as THREE.LineBasicMaterial;
  gridMat.opacity = 0.15;
  gridMat.transparent = true;
  g.add(grid);

  const asphalt = asphaltMat();

  // Perimeter loop road (entry -> lane strip -> exit).
  const loop = new THREE.Mesh(new THREE.PlaneGeometry(210, 11), asphalt);
  loop.rotation.x = -Math.PI / 2; loop.position.set(0, 0.02, 58);
  loop.receiveShadow = true;
  g.add(loop);

  // Lane paint down the middle of the entry loop.
  const paint = new THREE.MeshBasicMaterial({ color: 0xd8dee6 });
  const dash = new THREE.PlaneGeometry(2.4, 0.28);
  for (let x = -95; x <= 95; x += 8) {
    const m = new THREE.Mesh(dash, paint);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, 58);
    g.add(m);
  }

  // One black lane per manifold, running the full depth of the bay rows.
  for (let m = 0; m < MANIFOLDS; m++) {
    const x = manifoldX(m) + 7.6;
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 124), asphalt);
    lane.rotation.x = -Math.PI / 2; lane.position.set(x, 0.018, -8);
    lane.receiveShadow = true;
    g.add(lane);
  }

  return { editable: { id: 'ground-roads', name: 'Ground & Roads', object: g } as Editable, asphalt };
}

/** A black asphalt pad under a structure's footprint so it doesn't look like it's floating on bare ground. */
function addFootingPad(groundGroup: THREE.Object3D, asphalt: THREE.Material, x: number, z: number, w: number, d: number, y = 0.016) {
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(w, d), asphalt);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(x, y, z);
  pad.receiveShadow = true;
  groundGroup.add(pad);
}

/* ---------------- fence + gates ---------------- */
async function buildFenceAndGates(parent: THREE.Object3D, ctx: BuildCtx): Promise<Editable[]> {
  const editables: Editable[] = [];
  const tmpl = await loadModel('metal-fence.glb');
  if (ctx.cancelled()) return editables;
  if (tmpl) {
    // 3m fence; panels spaced by their own post-scale width so they actually connect.
    const FENCE_HEIGHT = 3;
    normalizeToHeight(tmpl, FENCE_HEIGHT);
    const box = new THREE.Box3().setFromObject(tmpl);
    const panelWidth = box.getSize(new THREE.Vector3()).x || 3;
    const w = 112, d = 72;
    const perim: [number, number, number][] = [];
    for (let x = -w; x <= w + 0.001; x += panelWidth) { perim.push([Math.min(x, w), -d, 0]); perim.push([Math.min(x, w), d, Math.PI]); }
    for (let z = -d + panelWidth; z < d; z += panelWidth) { perim.push([-w, z, Math.PI / 2]); perim.push([w, z, -Math.PI / 2]); }
    // Build the whole perimeter as loose clones, then collapse into a handful of merged meshes.
    const fenceLoose = new THREE.Group();
    perim.forEach(([x, z, ry]) => {
      const c = cloneModel(tmpl);
      c.position.set(x, 0, z);
      c.rotation.y = ry;
      fenceLoose.add(c);
    });
    const fenceGroup = makeEditableGroup('fence', 'Perimeter Fence');
    fenceGroup.add(optimizeMeshCount(fenceLoose, 4));
    parent.add(fenceGroup);
    editables.push({ id: 'fence', name: 'Perimeter Fence', object: fenceGroup });
  }

  const barrierTmpl = await loadModel('traffic-barrier.glb');
  const camTmpl = await loadModel('security-camera.glb');
  if (ctx.cancelled()) return editables;
  if (barrierTmpl) normalizeToHeight(barrierTmpl, 1.6);
  if (camTmpl) normalizeToHeight(camTmpl, 1.0);
  const POLE_HEIGHT = 4.2;
  const poleMat = pipeMat(0x33455e);
  [
    { pos: GATE_ENTRY, ry: 0, id: 'gate-entry', name: 'Gate — Entry' },
    { pos: GATE_EXIT, ry: Math.PI, id: 'gate-exit', name: 'Gate — Exit' },
  ].forEach((g) => {
    const gateGroup = makeEditableGroup(g.id, g.name);
    if (barrierTmpl) {
      const b = cloneModel(barrierTmpl);
      b.position.set(g.pos.x, 0, g.pos.z);
      b.rotation.y = g.ry;
      gateGroup.add(b);
    }
    if (camTmpl) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, POLE_HEIGHT, 10), poleMat);
      pole.position.set(g.pos.x + 2.2, POLE_HEIGHT / 2, g.pos.z);
      pole.castShadow = true;
      gateGroup.add(pole);
      const cam = cloneModel(camTmpl);
      cam.position.set(g.pos.x + 2.2, POLE_HEIGHT, g.pos.z);
      cam.rotation.y = g.ry;
      gateGroup.add(cam);
    }
    parent.add(gateGroup);
    editables.push({ id: g.id, name: g.name, object: gateGroup });
  });
  return editables;
}

/* ---------------- manifold headers (fixed pipework, editable as one unit) ---------------- */
function buildHeaderAndManifolds(parent: THREE.Object3D, flowTexture: THREE.Texture): Editable {
  const g = makeEditableGroup('pipework', 'Header & Manifold Pipework');
  parent.add(g);

  // One shared animated texture across the whole network (see StationHandle.updateFlow).
  const flowMat = () => new THREE.MeshStandardMaterial({ map: flowTexture, metalness: 0.55, roughness: 0.35 });
  const headerMat = flowMat();
  const manifoldMat = flowMat();
  const riserMat = flowMat();

  addStraightPipe(g, new THREE.Vector3(-88, HEADER_Y, HEADER_Z), new THREE.Vector3(88, HEADER_Y, HEADER_Z), 0.42, headerMat);
  addStraightPipe(g, new THREE.Vector3(-88, HEADER_Y, -20), new THREE.Vector3(-88, HEADER_Y, HEADER_Z), 0.42, headerMat);

  for (let m = 0; m < MANIFOLDS; m++) {
    const x = manifoldX(m);
    const px = x - PIPE_X_OFFSET;
    addStraightPipe(g, new THREE.Vector3(px, HEADER_Y, HEADER_Z), new THREE.Vector3(px, MANIFOLD_Y, HEADER_Z), 0.22, manifoldMat);
    const zStart = baySlotZ(0) - BAY_DZ * 0.5;
    const zEnd = baySlotZ(BAYS_PER_MANIFOLD - 1) + BAY_DZ * 0.5;
    addStraightPipe(g, new THREE.Vector3(px, MANIFOLD_Y, HEADER_Z), new THREE.Vector3(px, MANIFOLD_Y, zStart), 0.22, manifoldMat);
    addStraightPipe(g, new THREE.Vector3(px, MANIFOLD_Y, zStart), new THREE.Vector3(px, MANIFOLD_Y, zEnd), 0.22, manifoldMat);
    for (let s = 0; s < BAYS_PER_MANIFOLD; s++) {
      const z = baySlotZ(s);
      // Branch line from the spine into this bay's instrument stack, ending at ground level short of the apron.
      addStraightPipe(g, new THREE.Vector3(px, MANIFOLD_Y, z), new THREE.Vector3(x + INSTRUMENT_X_OFFSET, 0.5, z), 0.09, riserMat);
    }
  }
  mergeStaticMeshes(g);
  return { id: 'pipework', name: 'Header & Manifold Pipework', object: g };
}

const CANOPY_HEIGHT = 4.6;

/** Bakes the real canopy .glb down to one (or a handful of) baked meshes ready to build InstancedMeshes from.
 *  The model is a cantilever (legs on one edge only), so it is rotated 90 degrees so the legs run along the bay's
 *  DEPTH (Z) axis, leaving the lane-facing (X) span leg-free: it can be centred exactly on the parked truck. */
async function bakeCanopyMeshes(targetWidth: number, targetHeight: number, targetDepth: number): Promise<THREE.Mesh[]> {
  const template = await loadModel('canopy.glb');
  if (!template) return [];
  const clone = cloneModel(template);
  clone.updateMatrixWorld(true);
  const rawSize = new THREE.Box3().setFromObject(clone).getSize(new THREE.Vector3());
  clone.scale.set(targetDepth / rawSize.x, targetHeight / rawSize.y, targetWidth / rawSize.z);
  clone.rotation.y = Math.PI / 2;
  clone.updateMatrixWorld(true);

  const baked = optimizeMeshCount(clone, 0); // bakes each mesh's transform into its geometry
  const meshes = baked.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh);
  if (!meshes.length) return [];
  const box = new THREE.Box3().setFromObject(baked);
  const center = box.getCenter(new THREE.Vector3());
  const offset = new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z);
  meshes.forEach((m) => m.geometry.applyMatrix4(offset));
  return meshes;
}

/** Per-bay valve/meter/PT/TT/fine-fill-valve stack + a simple 2-segment loading arm. Everything static is built from
 *  small primitives (merged per material afterwards by mergeStaticMeshes); the valve and fine-fill valve (the two
 *  status-coloured parts) are instanced separately and are NOT created here. */
function buildBayInstrumentStack(g: THREE.Object3D, l: BayAnchors, mats: { emf: THREE.Material; inst: THREE.Material; pt: THREE.Material; tt: THREE.Material; arm: THREE.Material; handle: THREE.Material }) {
  const { emf, inst, pt, tt, arm, handle: handleMat } = mats;
  const x = l.instrumentPos.x, z = l.z;
  const stack = new THREE.Group();
  stack.position.set(x, 0, z);
  g.add(stack);

  // Vertical connector: ground branch (0.5) up through the instrument bodies to the arm (2.15).
  addStraightPipe(stack, new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 0.75, 0), 0.12, inst);
  // (valve body at y=0.95 is the instanced, status-coloured part)
  // Handle/wedge on the valve body — reads as an actuator, not just a fat pipe segment.
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), handleMat);
  handle.position.set(0, 1.2, 0);
  stack.add(handle);

  addStraightPipe(stack, new THREE.Vector3(0, 1.15, 0), new THREE.Vector3(0, 1.3, 0), 0.12, inst);
  const emfBody = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.5, 12), emf);
  emfBody.position.set(0, 1.58, 0);
  emfBody.castShadow = true;
  const flangeGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.06, 12);
  const flangeA = new THREE.Mesh(flangeGeo, inst); flangeA.position.set(0, 1.34, 0);
  const flangeB = new THREE.Mesh(flangeGeo, inst); flangeB.position.set(0, 1.82, 0);
  stack.add(emfBody, flangeA, flangeB);

  // PT (pressure transmitter) — small stem + head branching off to one side.
  const ptStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), inst);
  ptStem.rotation.z = Math.PI / 2;
  ptStem.position.set(0.22, 1.05, 0.16);
  const ptHead = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), pt);
  ptHead.position.set(0.36, 1.05, 0.16);
  // TT (temperature transmitter) — offset to the other side so it doesn't overlap PT.
  const ttStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), inst);
  ttStem.rotation.z = Math.PI / 2;
  ttStem.position.set(0.22, 1.42, -0.16);
  const ttHead = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), tt);
  ttHead.position.set(0.36, 1.42, -0.16);
  stack.add(ptStem, ptHead, ttStem, ttHead);

  addStraightPipe(stack, new THREE.Vector3(0, 1.82, 0), new THREE.Vector3(0, 1.95, 0), 0.1, inst);
  // (fine-fill valve at y=2.13 is the instanced, status-coloured part)

  // Simple 2-segment loading arm reaching toward the parked truck's tank top; static (no extend/retract animation).
  const armMid = new THREE.Vector3(x + 3.5, 2.6, z - 0.6);
  const armEnd = new THREE.Vector3(x + 6.2, 2.75, z - 0.2);
  addStraightPipe(g, new THREE.Vector3(x, 2.3, z), armMid, 0.07, arm);
  addStraightPipe(g, armMid, armEnd, 0.07, arm);
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), arm);
  elbow.position.copy(armMid);
  g.add(elbow);
}

interface BayVisuals {
  editable: Editable;
  apron: THREE.InstancedMesh;
  dots: THREE.InstancedMesh;
  valves: THREE.InstancedMesh;
  fineFills: THREE.InstancedMesh;
}

async function buildBayAprons(parent: THREE.Object3D): Promise<BayVisuals> {
  const g = makeEditableGroup('bay-infrastructure', 'Bay Aprons & Canopies');
  parent.add(g);

  const apronMat = new THREE.MeshStandardMaterial({ color: 0x8b8f95, roughness: 0.9, metalness: 0.02 });
  const kioskMat = new THREE.MeshStandardMaterial({ color: 0xd7dde6, roughness: 0.55 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0a2233, emissive: 0x22d3ee, emissiveIntensity: 0.5 });
  const mats = {
    inst: pipeMat(0x8a97a8),
    arm: pipeMat(0x9aa5b4),
    emf: new THREE.MeshStandardMaterial({ color: 0x2f6fb8, metalness: 0.5, roughness: 0.35 }),
    pt: new THREE.MeshStandardMaterial({ color: 0xe4e8ee, emissive: 0xf87171, emissiveIntensity: 0.4, roughness: 0.4 }),
    tt: new THREE.MeshStandardMaterial({ color: 0xe4e8ee, emissive: 0xfbbf24, emissiveIntensity: 0.4, roughness: 0.4 }),
    handle: pipeMat(0x1c2230),
  };

  // One InstancedMesh per baked canopy piece (normally just 1), instanced BAY_COUNT times. Shadows off (heavy model).
  const canopyMeshes = await bakeCanopyMeshes(9.6, CANOPY_HEIGHT, 7.5);
  const canopyInsts = canopyMeshes.map((m) => {
    const inst = new THREE.InstancedMesh(m.geometry, m.material, BAY_COUNT);
    inst.castShadow = false; inst.receiveShadow = false;
    return inst;
  });

  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, cast: boolean, recv: boolean) => {
    const im = new THREE.InstancedMesh(geo, mat, BAY_COUNT);
    im.castShadow = cast; im.receiveShadow = recv;
    im.name = 'bay-instanced';
    return im;
  };
  const apronI = inst(new THREE.BoxGeometry(9.6, 0.15, BAY_DZ - 1.4), apronMat, false, true);
  apronI.userData.bayInstanced = true;
  const dotI = inst(new THREE.CircleGeometry(0.9, 20), new THREE.MeshBasicMaterial({ color: 0xffffff }), false, false);
  const kioskI = inst(new THREE.BoxGeometry(0.7, 1.5, 0.5), kioskMat, true, false);
  const screenI = inst(new THREE.PlaneGeometry(0.42, 0.55), screenMat, false, false);
  const valveMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.4 });
  const valveI = inst(new THREE.CylinderGeometry(0.24, 0.24, 0.4, 12), valveMat, true, false);
  const fineI = inst(new THREE.CylinderGeometry(0.16, 0.16, 0.35, 10), valveMat, true, false);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const one = new THREE.Vector3(1, 1, 1);
  const kioskM = new THREE.Matrix4();
  const screenLocal = new THREE.Matrix4().makeTranslation(0, 0.15, 0.26);
  const idle = new THREE.Color(STATUS_COLOR.idle);

  for (let id = 1; id <= BAY_COUNT; id++) {
    const l = bayLayout(id);
    const i = id - 1;
    apronI.setMatrixAt(i, m4.makeTranslation(l.manifoldX + 6, 0.08, l.z));
    dotI.setMatrixAt(i, m4.compose(new THREE.Vector3(l.manifoldX + 6, 0.17, l.z), flat, one));
    kioskM.makeTranslation(l.manifoldX + 3.4, 0.75, l.z + 2.6);
    kioskI.setMatrixAt(i, kioskM);
    screenI.setMatrixAt(i, m4.multiplyMatrices(kioskM, screenLocal));
    valveI.setMatrixAt(i, m4.makeTranslation(l.instrumentPos.x, 0.95, l.z));
    fineI.setMatrixAt(i, m4.makeTranslation(l.instrumentPos.x, 2.13, l.z));
    dotI.setColorAt(i, idle); valveI.setColorAt(i, idle); fineI.setColorAt(i, idle);

    buildBayInstrumentStack(g, l, mats);

    if (canopyInsts.length) {
      m4.compose(new THREE.Vector3(l.manifoldX + 6.4, 0, l.z), q.identity(), one);
      canopyInsts.forEach((ci) => ci.setMatrixAt(i, m4));
    }
  }
  [apronI, dotI, kioskI, screenI, valveI, fineI, ...canopyInsts].forEach((im) => {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    g.add(im);
  });
  mergeStaticMeshes(g); // instrument stacks, loading arms, elbows... -> one mesh per material

  return { editable: { id: 'bay-infrastructure', name: 'Bay Aprons & Canopies', object: g }, apron: apronI, dots: dotI, valves: valveI, fineFills: fineI };
}

/** Simple, legible control-centre building (replaces building-l.glb, which didn't read as a control building). */
function buildLCC(parent: THREE.Object3D): Editable {
  const g = makeEditableGroup('lcc', 'Local Control Centre');
  parent.add(g);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x9aa5b4, roughness: 0.65 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2f4258, roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0c1a2c, roughness: 0.15, metalness: 0.4, emissive: 0x0a2233, emissiveIntensity: 0.5 });

  // Enlarged per client feedback: "the control room is too small".
  const box = new THREE.Mesh(new THREE.BoxGeometry(30, 8.5, 18), wallMat);
  box.position.set(0, 4.25, 0);
  box.castShadow = true; box.receiveShadow = true;

  const roof = new THREE.Mesh(new THREE.BoxGeometry(31, 0.5, 19), roofMat);
  roof.position.set(0, 8.75, 0);
  roof.castShadow = true;

  const glazing = new THREE.Mesh(new THREE.BoxGeometry(28.8, 3.6, 0.2), glassMat);
  glazing.position.set(0, 4.4, 9.1);

  g.add(box, roof, glazing);
  g.position.set(-70, 0, -46);
  return { id: 'lcc', name: 'Local Control Centre', object: g };
}

/* ---------------- placed yard assets: catalog .glb models, individually editable ---------------- */
interface Placement {
  id: string; name: string; file: string; nodeName?: string; position: [number, number, number];
  rotationY?: number; scale?: number; normalizeHeight?: number; noShadowCast?: boolean;
}
/** Default transform per placement. Scale values were tuned per source model (they vary by orders of magnitude between
 *  assets). The storage tank farm is a sprawling multi-tank cluster (2480 source meshes) normalised by HEIGHT (6.5m),
 *  which keeps it a ~31m x 17m installation that fits its footing pad and clears the LCC. */
const PLACEMENTS: Placement[] = [
  { id: 'tank-farm', name: 'Storage Tank Farm', file: 'msl_storage_tanks.glb', position: [-95, 0, -18], rotationY: 0, normalizeHeight: 6.5 },

  { id: 'control-hut', name: 'Industrial Control Hut', file: 'Meshy_AI_Industrial_Control_Hu_0912072421_texture.glb', position: [92, 0, -52], rotationY: 0, scale: 3.7365455028405448 },
  { id: 'pump', name: 'Centrifugal Pump', file: 'centrifugal_pump__bomba_centrifuga.glb', position: [92, 0, -30], rotationY: 0, scale: 0.030681129346612407 },
  { id: 'dn-valve', name: 'DN Valve', file: 'valve_dn.glb', position: [92, 0, -10], rotationY: 0, scale: 3.3722756732311243 },

  // Pipe-kit and modular-pipe fragments: 6 representative pieces spaced ~6-7m apart.
  { id: 'pipekit-long', name: 'Pipe Kit — pipe_long', file: 'factory_pipe_kit.glb', nodeName: 'pipe_long', position: [92, 0, 8], scale: 0.3 },
  { id: 'pipekit-t', name: 'Pipe Kit — pipe_t', file: 'factory_pipe_kit.glb', nodeName: 'pipe_t', position: [92, 0, 15], scale: 0.3 },
  { id: 'pipekit-valve', name: 'Pipe Kit — pipe_valve', file: 'factory_pipe_kit.glb', nodeName: 'pipe_valve', position: [92, 0, 22], scale: 0.3 },

  { id: 'modpipe-1', name: 'Modular Pipe 01', file: 'modular_industrial_pipes_01_4k.glb', nodeName: 'modular_industrial_pipes_01_pipe01', position: [98, 0, 8], scale: 0.02 },
  { id: 'modpipe-3', name: 'Modular Pipe 03', file: 'modular_industrial_pipes_01_4k.glb', nodeName: 'modular_industrial_pipes_01_pipe03', position: [98, 0, 15], scale: 0.02 },
  { id: 'modpipe-5', name: 'Modular Pipe 05', file: 'modular_industrial_pipes_01_4k.glb', nodeName: 'modular_industrial_pipes_01_pipe05', position: [98, 0, 22], scale: 0.02 },

  { id: 'cam-a', name: 'Security Camera A', file: 'security_cameras_low_polygon__game_ready.glb', nodeName: 'SM_Kamera_1_0', position: [104, 0, -60], scale: 0.005888325615863227 },
  { id: 'cam-b', name: 'Security Camera B', file: 'security_cameras_low_polygon__game_ready.glb', nodeName: 'SM_Kamera_2_1', position: [104, 0, 60], scale: 0.009392802257907206 },
  { id: 'guard-booth', name: 'Guard Booth', file: 'small_guard_booth.glb', position: [98, 0, 44], scale: 1 },
  { id: 'forklift', name: 'Forklift', file: 'forklift_low_poly.glb', position: [92, 0, 34], scale: 0.010365058731111439 },
  { id: 'veg-1', name: 'Vegetation Clump A', file: 'grass_vegitation_mix.glb', position: [104, 0, -50], scale: 1, noShadowCast: true },
  { id: 'veg-2', name: 'Vegetation Clump B', file: 'grass_vegitation_mix.glb', position: [104, 0, 0], scale: 1, noShadowCast: true },
  { id: 'veg-3', name: 'Vegetation Clump C', file: 'grass_vegitation_mix.glb', position: [104, 0, 50], scale: 1, noShadowCast: true },
];

async function loadPlacement(p: Placement): Promise<THREE.Object3D | null> {
  const template = await loadModel(p.file);
  if (!template) return null;
  let source3d: THREE.Object3D = template;
  if (p.nodeName) {
    const found = template.getObjectByName(p.nodeName);
    if (found) source3d = found;
    else console.warn(`[twin3d] node "${p.nodeName}" not found in ${p.file}`);
  }
  // Static yard dressing never needs per-instance material tinting, so (unlike trucks) materials stay shared with the template.
  const cloned = source3d.clone(true);
  // Collapses assets that ship as hundreds/thousands of mesh nodes (the tank farm is 2480 draw calls) into a handful.
  const optimized = optimizeMeshCount(cloned);
  if (p.noShadowCast) optimized.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = false; });
  const obj = centerAndGround(optimized);
  if (p.normalizeHeight) normalizeToHeight(obj, p.normalizeHeight);
  else obj.scale.setScalar(p.scale ?? 1);
  obj.userData.placementId = p.id;
  return obj;
}

async function buildPlacements(group: THREE.Object3D, ctx: BuildCtx): Promise<Editable[]> {
  const editables: Editable[] = [];
  for (const p of PLACEMENTS) {
    if (ctx.cancelled()) break;
    const obj = await loadPlacement(p);
    if (!obj || ctx.cancelled()) continue;
    obj.position.set(p.position[0], p.position[1], p.position[2]);
    if (p.rotationY) obj.rotation.y = p.rotationY;
    group.add(obj);
    editables.push({ id: p.id, name: p.name, object: obj });
  }
  return editables;
}

/** Builds the whole static station. Never throws on a missing GLB (that placement is just skipped). */
export async function buildStation(scene: THREE.Scene, ctx: BuildCtx = { cancelled: () => false }): Promise<StationHandle> {
  const group = new THREE.Group();
  group.name = 'station';
  scene.add(group);

  const flowTexture = makeFlowTexture();

  const { editable: groundEditable, asphalt } = buildGroundAndRoads(group);
  const groundGroup = groundEditable.object;
  addFootingPad(groundGroup, asphalt, -70, -46, 36, 24);   // LCC building pad
  addFootingPad(groundGroup, asphalt, -95, -18, 34, 20);    // storage tank-farm pad
  addFootingPad(groundGroup, asphalt, 95, -30, 20, 50);     // utility yard pad (control hut/pump/valve/pipe fragments)
  addFootingPad(groundGroup, asphalt, 96, 39, 18, 20);      // guard booth / forklift pad
  mergeStaticMeshes(groundGroup);

  const editables: Editable[] = [groundEditable];
  editables.push(buildLCC(group));
  editables.push(buildHeaderAndManifolds(group, flowTexture));
  const bayVis = await buildBayAprons(group);
  editables.push(bayVis.editable);
  if (!ctx.cancelled()) editables.push(...(await buildFenceAndGates(group, ctx)));
  if (!ctx.cancelled()) editables.push(...(await buildPlacements(group, ctx)));

  const tmp = new THREE.Color();
  const bayIds = new Set<THREE.Object3D>([bayVis.apron]);
  return {
    group,
    editables,
    updateBays(bays) {
      for (const b of bays) {
        const i = b.id - 1;
        if (i < 0 || i >= BAY_COUNT) continue;
        const base = STATUS_COLOR[b.status] ?? STATUS_COLOR.idle;
        tmp.setHex(base);
        bayVis.dots.setColorAt(i, tmp);
        bayVis.valves.setColorAt(i, tmp);
        // The fine-fill valve additionally flags amber once a fill crosses the 85% fine-fill threshold (same cutover as 2D twin/HMI).
        tmp.setHex(b.status === 'filling' && b.dispensed > b.target * 0.85 ? FINE_FILL_COLOR : base);
        bayVis.fineFills.setColorAt(i, tmp);
      }
      for (const im of [bayVis.dots, bayVis.valves, bayVis.fineFills]) if (im.instanceColor) im.instanceColor.needsUpdate = true;
    },
    updateFlow(dt) { flowTexture.offset.y -= dt * 0.6; },
    bayIdFromInstance(obj, instanceId) {
      return bayIds.has(obj) && instanceId != null ? instanceId + 1 : null;
    },
  };
}
