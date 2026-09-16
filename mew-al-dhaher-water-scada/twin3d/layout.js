/* twin3d/layout.js — the static station: ground, black asphalt roads/footings, fence, gates,
 * 6 manifolds x 7 bays, and every supplied .glb placed in the yard. Two kinds of content live
 * here:
 *   1. Fixed procedural geometry (ground, roads, fence, manifold pipework, bay aprons, canopies,
 *      the LCC building) -- each wrapped in its own named group so it's individually selectable
 *      and movable from the 3D view, same as the placed .glb assets.
 *   2. "Placements" -- one instance per named yard asset (storage tanks, control hut, pump,
 *      valve, pipe kit pieces, cameras, guard booth, forklift, vegetation). Default transforms
 *      are already tuned per-model (scale especially -- the raw GLBs come in wildly different
 *      native sizes).
 * `editables` was consumed by the in-app scene editor (twin3d/editor.js), which has since been
 * removed now that the yard layout is finished; it's kept as a return value here only because
 * buildStation()'s callers destructure it, but nothing reads it any more.
 */
import * as THREE from "three";
import { loadModel, cloneModel, normalizeToHeight, centerAndGround, optimizeMeshCount, makeFlowTexture } from "./assets.js?v=6";

export const MANIFOLDS = 6;
export const BAYS_PER_MANIFOLD = 7;
export const BAY_COUNT = MANIFOLDS * BAYS_PER_MANIFOLD; // 42

const MANIFOLD_DX = 32;
const BAY_DZ = 13;
const HEADER_Z = -66;
// Hugging the ground (not just "below truck height") is what actually reads as underground
// yard piping. 1.05-1.7m was technically below a 3.3m truck, but from any normal elevated
// viewing angle a pipe run spanning the whole yard at that height still visually crosses behind
// the canopies and truck cabs -- it read as "floating through" them. Sitting near y=0 removes
// that illusion entirely; only the short riser stub climbs up to the valve connection height.
const HEADER_Y = 0.35;
const MANIFOLD_Y = 0.28;
// The manifold's N-S spine used to run flush with the bay apron/canopy's west edge (only
// 1.2-1.6m clearance) -- from the aerial camera angle that reads as the pipe running directly
// under the canopies and parked trucks, which is exactly the "trucks on the pipes" bug. Shifting
// it this far further west drops it into the open aisle between bay rows (~22m wide, unused)
// instead, with the horizontal branch (see riser add in buildHeaderAndManifolds) covering the
// extra distance into each bay's instrument stack.
const PIPE_X_OFFSET = 6;
// Where each bay's valve/meter/PT/TT stack sits -- just inside the apron's west edge (apron
// starts at manifoldX+1.2), short of the kiosk at manifoldX+3.4.
const INSTRUMENT_X_OFFSET = 2.3;

function manifoldX(m) { return (m - (MANIFOLDS - 1) / 2) * MANIFOLD_DX; }
function baySlotZ(s) { return (s - (BAYS_PER_MANIFOLD - 1) / 2) * BAY_DZ; }

export const GATE_ENTRY = new THREE.Vector3(-26, 0, 66);
export const GATE_EXIT = new THREE.Vector3(26, 0, 66);
// Z of the east-west perimeter loop road (see buildGroundAndRoads) -- trucks.js routes its
// arrival/departure paths along this so they follow the actual road instead of cutting a
// diagonal shortcut across the yard.
export const ROAD_LOOP_Z = 58;
export function laneX(manifoldIndex) { return manifoldX(manifoldIndex) + 7.6; }

export const STATUS_COLOR = {
  idle: 0x2c3b52, filling: 0x22d3ee, done: 0x34d399, fault: 0xf87171, offline: 0x5f7292,
};

/** Bay id (1..42) -> world-space anchors used by trucks.js. */
export function bayLayout(id) {
  const m = Math.floor((id - 1) / BAYS_PER_MANIFOLD);
  const s = (id - 1) % BAYS_PER_MANIFOLD;
  const x = manifoldX(m);
  const z = baySlotZ(s);
  return {
    id, manifold: m, slot: s,
    manifoldX: x, z,
    riser: new THREE.Vector3(x, 0, z),
    truckPos: new THREE.Vector3(x + 7.6, 0, z),
    instrumentPos: new THREE.Vector3(x + INSTRUMENT_X_OFFSET, 0, z),
  };
}

function pipeMat(color = 0x8a97a8) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.4 });
}

let flowTexture = null;
/** Process-piping material: same steel look as pipeMat, plus the animated cyan flow texture
 *  (see updatePipeFlow) so the header/manifold/riser network reads as carrying water instead of
 *  being static grey tube. All pipe meshes share one texture object, so a single per-frame
 *  offset update animates the whole network at once. */
function flowPipeMat() {
  if (!flowTexture) flowTexture = makeFlowTexture();
  return new THREE.MeshStandardMaterial({ map: flowTexture, metalness: 0.55, roughness: 0.35 });
}
/** Called once per frame from twin3d.js's tick handler. */
export function updatePipeFlow(dt) {
  if (flowTexture) flowTexture.offset.y -= dt * 0.6;
}
function asphaltMat() {
  return new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.92, metalness: 0.02 });
}

function addStraightPipe(group, from, to, radius, material) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, 12);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/** Wraps a just-built chunk of procedural geometry as a single named, editable unit -- so
 *  clicking any part of it in the 3D view (or finding it in the editor's search list) selects
 *  and moves the whole thing together. Mirrors how placed .glb assets are tagged. */
function makeEditableGroup(id, name) {
  const g = new THREE.Group();
  g.name = name;
  g.userData.placementId = id;
  return g;
}

/* ---------------- ground + roads (proper black asphalt "footing" everywhere) ---------------- */
function buildGroundAndRoads(parent) {
  const g = makeEditableGroup("ground-roads", "Ground & Roads");
  parent.add(g);

  // Hardstanding: a neutral, fairly dark grey concrete apron -- NOT the sandy/khaki colour the
  // old build used (that warm tint was a big part of why the whole scene read "yellow").
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x545a63, roughness: 0.95, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 160, 1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);

  const grid = new THREE.GridHelper(240, 60, 0x3c4048, 0x454a52);
  grid.position.y = 0.015;
  grid.material.opacity = 0.15;
  grid.material.transparent = true;
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

  return { editable: { id: "ground-roads", name: "Ground & Roads", object: g }, asphalt, groundMat };
}

/** A black asphalt pad under a structure's footprint so it doesn't look like it's floating on
 *  bare ground. `w`/`d` are the pad's world-space width/depth. Added straight to the ground
 *  group so it moves with the ground if that's ever repositioned. */
function addFootingPad(groundGroup, asphalt, x, z, w, d, y = 0.016) {
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(w, d), asphalt);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(x, y, z);
  pad.receiveShadow = true;
  groundGroup.add(pad);
}

/* ---------------- fence + gates ---------------- */
async function buildFenceAndGates(parent) {
  const editables = [];
  const tmpl = await loadModel("metal-fence.glb");
  if (tmpl) {
    // Fence height bumped from 2.2m -> 3m (a 2.2m perimeter fence read as a toy next to a 3.3m
    // truck). Panels MUST be spaced by their own post-scale width or they don't connect -- the
    // previous build hardcoded a 20m step against a ~2.7m-wide panel, leaving ~17m gaps that
    // looked like scattered fence posts rather than a fence.
    const FENCE_HEIGHT = 3;
    normalizeToHeight(tmpl, FENCE_HEIGHT);
    const box = new THREE.Box3().setFromObject(tmpl);
    const panelWidth = box.getSize(new THREE.Vector3()).x || 3;
    const w = 112, d = 72;
    const perim = [];
    for (let x = -w; x <= w + 0.001; x += panelWidth) { perim.push([Math.min(x, w), -d, 0]); perim.push([Math.min(x, w), d, Math.PI]); }
    for (let z = -d + panelWidth; z < d; z += panelWidth) { perim.push([-w, z, Math.PI / 2]); perim.push([w, z, -Math.PI / 2]); }
    // Build the whole perimeter as loose clones first, then collapse the lot into a handful of
    // merged meshes -- as separate objects a continuous fence at real spacing is 150+ draw calls
    // for something nobody needs to move panel-by-panel.
    const fenceLoose = new THREE.Group();
    perim.forEach(([x, z, ry]) => {
      const c = cloneModel(tmpl);
      c.position.set(x, 0, z);
      c.rotation.y = ry;
      fenceLoose.add(c);
    });
    const fenceGroup = makeEditableGroup("fence", "Perimeter Fence");
    fenceGroup.add(optimizeMeshCount(fenceLoose, 4));
    parent.add(fenceGroup);
    editables.push({ id: "fence", name: "Perimeter Fence", object: fenceGroup });
  }

  const barrierTmpl = await loadModel("traffic-barrier.glb");
  const camTmpl = await loadModel("security-camera.glb");
  // Both read as toy-scale next to a 3.3m truck at their old sizes -- barrier arm bumped up and
  // the camera pole thickened (its 0.08-radius cylinder was the "lamp post" that looked like a
  // wire) as well as made taller so the camera head actually reads as mounted equipment.
  if (barrierTmpl) normalizeToHeight(barrierTmpl, 1.6);
  if (camTmpl) normalizeToHeight(camTmpl, 1.0);
  const POLE_HEIGHT = 4.2;
  [
    { pos: GATE_ENTRY, ry: 0, id: "gate-entry", name: "Gate — Entry" },
    { pos: GATE_EXIT, ry: Math.PI, id: "gate-exit", name: "Gate — Exit" },
  ].forEach((g) => {
    const gateGroup = makeEditableGroup(g.id, g.name);
    if (barrierTmpl) {
      const b = cloneModel(barrierTmpl);
      b.position.set(g.pos.x, 0, g.pos.z);
      b.rotation.y = g.ry;
      gateGroup.add(b);
    }
    if (camTmpl) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, POLE_HEIGHT, 10), pipeMat(0x33455e));
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
function buildHeaderAndManifolds(parent) {
  const g = makeEditableGroup("pipework", "Header & Manifold Pipework");
  parent.add(g);

  // One shared material (and one shared animated texture) across the whole network -- see
  // updatePipeFlow, called once per frame from twin3d.js, for the actual flow animation.
  const headerMat = flowPipeMat();
  const manifoldMat = flowPipeMat();
  const riserMat = flowPipeMat();

  addStraightPipe(g, new THREE.Vector3(-88, HEADER_Y, HEADER_Z), new THREE.Vector3(88, HEADER_Y, HEADER_Z), 0.42, headerMat);
  addStraightPipe(g, new THREE.Vector3(-88, HEADER_Y, -20), new THREE.Vector3(-88, HEADER_Y, HEADER_Z), 0.42, headerMat);

  for (let m = 0; m < MANIFOLDS; m++) {
    // px is the spine's actual world X -- shifted into the aisle west of this row (see
    // PIPE_X_OFFSET) so it clears the apron/canopy footprint instead of running flush with it.
    const x = manifoldX(m);
    const px = x - PIPE_X_OFFSET;
    addStraightPipe(g, new THREE.Vector3(px, HEADER_Y, HEADER_Z), new THREE.Vector3(px, MANIFOLD_Y, HEADER_Z), 0.22, manifoldMat);
    const zStart = baySlotZ(0) - BAY_DZ * 0.5;
    const zEnd = baySlotZ(BAYS_PER_MANIFOLD - 1) + BAY_DZ * 0.5;
    addStraightPipe(g, new THREE.Vector3(px, MANIFOLD_Y, HEADER_Z), new THREE.Vector3(px, MANIFOLD_Y, zStart), 0.22, manifoldMat);
    addStraightPipe(g, new THREE.Vector3(px, MANIFOLD_Y, zStart), new THREE.Vector3(px, MANIFOLD_Y, zEnd), 0.22, manifoldMat);
    for (let s = 0; s < BAYS_PER_MANIFOLD; s++) {
      const z = baySlotZ(s);
      // Branch line from the spine into this bay's instrument stack (see buildBayAprons) --
      // ends short of the apron, at ground level; the stack itself carries the vertical rise
      // through the valve/meter/fine-fill valve up to the loading arm.
      addStraightPipe(g, new THREE.Vector3(px, MANIFOLD_Y, z), new THREE.Vector3(x + INSTRUMENT_X_OFFSET, 0.5, z), 0.09, riserMat);
    }
  }
  return { id: "pipework", name: "Header & Manifold Pipework", object: g };
}

const CANOPY_HEIGHT = 4.6;

/** Bakes the real canopy .glb down to one (or a handful, if geometry merge can't fully collapse
 *  it) baked meshes, ready to build InstancedMeshes from -- replaces the earlier flat-box-and-
 *  poles procedural canopy, which the reference photo showed up as visibly worse than the
 *  truss-and-post structure this asset actually has. All 3 of the model's meshes share one
 *  identical material, so `optimizeMeshCount` USUALLY collapses them to a single mesh; returning
 *  every baked mesh (not just the first) means a partial-merge fallback still renders the whole
 *  canopy instead of silently dropping the truss or the legs.
 *
 *  IMPORTANT: this model is a cantilever -- every support leg sits within local X in
 *  [-halfWidth, ~0], i.e. one whole edge, with the roof overhanging leg-free on the other side.
 *  Placed naively (legs toward the header pipe, roof cantilevering over the lane) the legs still
 *  ended up close enough to the truck's parked footprint (and its in-place turn into the stall)
 *  to visually clip it -- the canopy is about as wide as the only clear channel between the pipe
 *  and the lane, so there's no anchor offset that keeps both a full-length roof AND leg clearance
 *  along that axis. Fix: rotate the model 90 degrees so the legs run along the bay's DEPTH (Z)
 *  axis instead, where each bay has ~13m of clearance to itself -- the roof's lane-facing (X)
 *  span is then leg-free along its entire width, so it can be centred exactly on the parked
 *  truck with no collision risk in the direction the truck actually swings through. */
async function bakeCanopyMeshes(targetWidth, targetHeight, targetDepth) {
  const template = await loadModel("canopy.glb");
  if (!template) return [];
  const clone = cloneModel(template);
  clone.updateMatrixWorld(true);
  const rawSize = new THREE.Box3().setFromObject(clone).getSize(new THREE.Vector3());
  // targetDepth applies to the model's native X (the leg axis, now mapped to world Z by the
  // rotation below) and targetWidth to its native Z (mapped to world X, the lane/truck-length
  // direction) -- swapped from a naive width->X, depth->Z assignment for exactly that reason.
  clone.scale.set(targetDepth / rawSize.x, targetHeight / rawSize.y, targetWidth / rawSize.z);
  clone.rotation.y = Math.PI / 2;
  clone.updateMatrixWorld(true);

  const baked = optimizeMeshCount(clone, 0); // bakes each mesh's transform into its geometry
  const meshes = baked.children.filter((c) => c.isMesh);
  if (!meshes.length) return [];
  const box = new THREE.Box3().setFromObject(baked);
  const center = box.getCenter(new THREE.Vector3());
  const offset = new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z);
  meshes.forEach((m) => m.geometry.applyMatrix4(offset));
  return meshes;
}

/** Per-bay valve/meter/PT/TT/fine-fill-valve stack + a simple loading arm -- the instrument
 *  bodies the reference P&ID (reference/bulk-unloading-station-reference.png) and the offer PDF
 *  call for ("custody-transfer EMF meter, tight shut-off valve... per bay") but which the
 *  procedural rebuild never modelled: previously a bay was just an apron + canopy + kiosk with a
 *  bare pipe stub, no instrument geometry at all. Built as small primitives (not GLBs) so 42
 *  copies stay cheap -- no InstancedMesh needed at this triangle count.
 *  Returns the meshes that need live status colour (valve, fine-fill valve) so the caller can tag
 *  them for refreshBayStatusDots. */
function buildBayInstrumentStack(g, l, valveMat, fineFillMat, emfMat, instMat, ptMat, ttMat, armMat) {
  const x = l.instrumentPos.x, z = l.z;
  const stack = new THREE.Group();
  stack.position.set(x, 0, z);
  g.add(stack);

  // Vertical connector: ground branch (0.5) up through the instrument bodies to the arm (2.15).
  addStraightPipe(stack, new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 0.75, 0), 0.12, instMat);
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.4, 12), valveMat);
  valve.position.set(0, 0.95, 0);
  valve.castShadow = true;
  // Handle/wedge on the valve body -- reads as an actuator, not just a fat pipe segment.
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), pipeMat(0x1c2230));
  handle.position.set(0, 1.2, 0);
  stack.add(valve, handle);

  addStraightPipe(stack, new THREE.Vector3(0, 1.15, 0), new THREE.Vector3(0, 1.3, 0), 0.12, instMat);
  const emfBody = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.5, 12), emfMat);
  emfBody.position.set(0, 1.58, 0);
  emfBody.castShadow = true;
  const flangeGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.06, 12);
  const flangeA = new THREE.Mesh(flangeGeo, instMat); flangeA.position.set(0, 1.34, 0);
  const flangeB = new THREE.Mesh(flangeGeo, instMat); flangeB.position.set(0, 1.82, 0);
  stack.add(emfBody, flangeA, flangeB);

  // PT (pressure transmitter) -- small stem + head branching off to one side.
  const ptStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), instMat);
  ptStem.rotation.z = Math.PI / 2;
  ptStem.position.set(0.22, 1.05, 0.16);
  const ptHead = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), ptMat);
  ptHead.position.set(0.36, 1.05, 0.16);
  // TT (temperature transmitter) -- same idea, offset to the other side so it doesn't overlap PT.
  const ttStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), instMat);
  ttStem.rotation.z = Math.PI / 2;
  ttStem.position.set(0.22, 1.42, -0.16);
  const ttHead = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), ttMat);
  ttHead.position.set(0.36, 1.42, -0.16);
  stack.add(ptStem, ptHead, ttStem, ttHead);

  addStraightPipe(stack, new THREE.Vector3(0, 1.82, 0), new THREE.Vector3(0, 1.95, 0), 0.1, instMat);
  const fineFill = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.35, 10), fineFillMat);
  fineFill.position.set(0, 2.13, 0);
  fineFill.castShadow = true;
  stack.add(fineFill);

  // Simple 2-segment loading arm reaching toward the parked truck's tank top -- none existed
  // before; kept static (no extend/retract animation) to stay in scope.
  const armMid = new THREE.Vector3(x + 3.5, 2.6, z - 0.6);
  const armEnd = new THREE.Vector3(x + 6.2, 2.75, z - 0.2);
  addStraightPipe(g, new THREE.Vector3(x, 2.3, z), armMid, 0.07, armMat);
  addStraightPipe(g, armMid, armEnd, 0.07, armMat);
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), armMat);
  elbow.position.copy(armMid);
  g.add(elbow);

  valve.userData.instrumentBay = l.id; valve.userData.instrumentKind = "valve";
  fineFill.userData.instrumentBay = l.id; fineFill.userData.instrumentKind = "finefill";
}

async function buildBayAprons(parent) {
  const g = makeEditableGroup("bay-infrastructure", "Bay Aprons & Canopies");
  parent.add(g);

  // Light concrete apron -- greyish, not the old sandy/khaki tone.
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x8b8f95, roughness: 0.9, metalness: 0.02 });
  const kioskMat = new THREE.MeshStandardMaterial({ color: 0xd7dde6, roughness: 0.55 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0a2233, emissive: 0x22d3ee, emissiveIntensity: 0.5 });
  // Instrument materials -- shared across all 42 stacks (refreshBayStatusDots mutates .color on
  // the valve/fine-fill instances directly, same pattern as the apron status dot).
  const instMat = pipeMat(0x8a97a8);
  const armMat = pipeMat(0x9aa5b4);
  const emfMat = new THREE.MeshStandardMaterial({ color: 0x2f6fb8, metalness: 0.5, roughness: 0.35 });
  const ptMat = new THREE.MeshStandardMaterial({ color: 0xe4e8ee, emissive: 0xf87171, emissiveIntensity: 0.4, roughness: 0.4 });
  const ttMat = new THREE.MeshStandardMaterial({ color: 0xe4e8ee, emissive: 0xfbbf24, emissiveIntensity: 0.4, roughness: 0.4 });

  // One InstancedMesh per baked canopy piece (normally just 1) -- each instanced BAY_COUNT
  // times, so all 42 canopies together still cost only a handful of draw calls. Shadows off:
  // one instance is already ~170k triangles, so casting x42 isn't worth the render cost.
  const canopyMeshes = await bakeCanopyMeshes(9.6, CANOPY_HEIGHT, 7.5);
  const canopyInsts = canopyMeshes.map((m) => {
    const inst = new THREE.InstancedMesh(m.geometry, m.material, BAY_COUNT);
    inst.castShadow = false; inst.receiveShadow = false;
    return inst;
  });

  const m4 = new THREE.Matrix4();
  for (let id = 1; id <= BAY_COUNT; id++) {
    const l = bayLayout(id);
    const apron = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.15, BAY_DZ - 1.4), apronMat);
    apron.position.set(l.manifoldX + 6, 0.08, l.z);
    apron.receiveShadow = true;
    apron.userData.bayId = id;
    g.add(apron);

    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshBasicMaterial({ color: STATUS_COLOR.idle }));
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(l.manifoldX + 6, 0.17, l.z);
    dot.userData.statusDot = id;
    g.add(dot);

    const kiosk = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.5, 0.5), kioskMat);
    kiosk.position.set(l.manifoldX + 3.4, 0.75, l.z + 2.6);
    kiosk.castShadow = true;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.55), screenMat);
    screen.position.set(0, 0.15, 0.26);
    kiosk.add(screen);
    g.add(kiosk);

    // Each bay needs its own valve/fine-fill materials (cloned from the shared base) so
    // refreshBayStatusDots can recolour one bay's instruments without affecting the other 41.
    buildBayInstrumentStack(
      g, l,
      new THREE.MeshStandardMaterial({ color: STATUS_COLOR.idle, metalness: 0.5, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: STATUS_COLOR.idle, metalness: 0.5, roughness: 0.4 }),
      emfMat, instMat, ptMat, ttMat, armMat
    );

    if (canopyInsts.length) {
      m4.makeTranslation(l.manifoldX + 6.4, 0, l.z);
      canopyInsts.forEach((inst) => inst.setMatrixAt(id - 1, m4));
    }
  }
  canopyInsts.forEach((inst) => { inst.instanceMatrix.needsUpdate = true; g.add(inst); });
  return { id: "bay-infrastructure", name: "Bay Aprons & Canopies", object: g };
}

const FINE_FILL_COLOR = 0xf59e0b;

/** Called every tick with live SIAP bay state; cheap material colour swap on the 42 status dots
 *  plus every bay's valve/fine-fill-valve instruments (single traverse for all of them). The
 *  fine-fill valve additionally flags amber once a fill crosses the 85% fine-fill threshold,
 *  matching the same cutover the 2D twin and HMI use. */
export function refreshBayStatusDots(group, bays) {
  const byId = new Map(bays.map((b) => [b.id, b]));
  group.traverse((o) => {
    if (!o.userData) return;
    if (o.userData.statusDot) {
      const bay = byId.get(o.userData.statusDot);
      if (bay) o.material.color.setHex(STATUS_COLOR[bay.status] ?? STATUS_COLOR.idle);
    } else if (o.userData.instrumentBay) {
      const bay = byId.get(o.userData.instrumentBay);
      if (!bay) return;
      if (o.userData.instrumentKind === "finefill" && bay.status === "filling" && bay.dispensed > bay.target * 0.85) {
        o.material.color.setHex(FINE_FILL_COLOR);
      } else {
        o.material.color.setHex(STATUS_COLOR[bay.status] ?? STATUS_COLOR.idle);
      }
    }
  });
}

/** Simple, legible control-centre building -- replaces building-l.glb, which turned out to
 *  render as an unrecognisable oversized pipe-elbow shape (not what "Local Control Centre"
 *  should look like) rather than anything resembling an office/control building. Staged copy of
 *  the original .glb is kept in the unused-assets area in case it's wanted after all. */
function buildLCC(parent) {
  const g = makeEditableGroup("lcc", "Local Control Centre");
  parent.add(g);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x9aa5b4, roughness: 0.65 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2f4258, roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0c1a2c, roughness: 0.15, metalness: 0.4, emissive: 0x0a2233, emissiveIntensity: 0.5 });

  // Enlarged from the original 20x6.5x12 -- client feedback: "the control room is too small" for
  // what's meant to be the Al Dhaher LCC (the building housing S!aP Connect edge, RTU comms and
  // the on-site operator desks), not a garden shed.
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
  return { id: "lcc", name: "Local Control Centre", object: g };
}

/* ---------------- placed yard assets: catalog .glb models, individually editable ---------------- */
/** Default transform per placement. Scale values were empirically tuned per source model (they
 *  vary by orders of magnitude between assets) -- these are starting points; the in-app editor
 *  lets you nudge any of them and persists the change locally. */
const PLACEMENTS = [
  // Water storage: the detailed multi-tank farm is the ONLY storage feature here -- the plain
  // Quaternius silos + buffer tank that used to sit alongside it were a placeholder from before
  // this asset was in place and just duplicated/crowded it (client feedback: "the old water
  // silos are back" -- they'd already been told to go). One real asset, sized and grounded via
  // `normalizeHeight` (self-correcting for this model's actual bounding box) rather than a
  // hand-picked raw `scale`, which is what produced the earlier "misaligned" look.
  // This particular model is a genuinely sprawling multi-tank cluster (2480 source meshes), not a
  // single tall tower: measured in-scene, its footprint-to-height ratio is a fixed ~4.7:1 (width)
  // and ~2.7:1 (depth) at ANY uniform scale -- normalizing to a "tall silo" height like 15m blew
  // the footprint out to 71m x 40m and drove it into the LCC building next door. 6.5m keeps it a
  // wide-but-contained ~31m x 17m installation that fits its footing pad and stays clear of the LCC.
  { id: "tank-farm", name: "Storage Tank Farm", file: "msl_storage_tanks.glb", position: [-95, 0, -18], rotationY: 0, normalizeHeight: 6.5 },

  { id: "control-hut", name: "Industrial Control Hut", file: "Meshy_AI_Industrial_Control_Hu_0912072421_texture.glb", position: [92, 0, -52], rotationY: 0, scale: 3.7365455028405448 },
  { id: "pump", name: "Centrifugal Pump", file: "centrifugal_pump__bomba_centrifuga.glb", position: [92, 0, -30], rotationY: 0, scale: 0.030681129346612407 },
  { id: "dn-valve", name: "DN Valve", file: "valve_dn.glb", position: [92, 0, -10], rotationY: 0, scale: 3.3722756732311243 },

  // Pipe-kit and modular-pipe fragments thinned from 19 pieces down to 6 representative ones and
  // spaced ~6-7m apart instead of ~1.4m -- the rest are staged, not deleted.
  { id: "pipekit-long", name: "Pipe Kit — pipe_long", file: "factory_pipe_kit.glb", nodeName: "pipe_long", position: [92, 0, 8], scale: 0.3 },
  { id: "pipekit-t", name: "Pipe Kit — pipe_t", file: "factory_pipe_kit.glb", nodeName: "pipe_t", position: [92, 0, 15], scale: 0.3 },
  { id: "pipekit-valve", name: "Pipe Kit — pipe_valve", file: "factory_pipe_kit.glb", nodeName: "pipe_valve", position: [92, 0, 22], scale: 0.3 },

  { id: "modpipe-1", name: "Modular Pipe 01", file: "modular_industrial_pipes_01_4k.glb", nodeName: "modular_industrial_pipes_01_pipe01", position: [98, 0, 8], scale: 0.02 },
  { id: "modpipe-3", name: "Modular Pipe 03", file: "modular_industrial_pipes_01_4k.glb", nodeName: "modular_industrial_pipes_01_pipe03", position: [98, 0, 15], scale: 0.02 },
  { id: "modpipe-5", name: "Modular Pipe 05", file: "modular_industrial_pipes_01_4k.glb", nodeName: "modular_industrial_pipes_01_pipe05", position: [98, 0, 22], scale: 0.02 },

  { id: "cam-a", name: "Security Camera A", file: "security_cameras_low_polygon__game_ready.glb", nodeName: "SM_Kamera_1_0", position: [104, 0, -60], scale: 0.005888325615863227 },
  { id: "cam-b", name: "Security Camera B", file: "security_cameras_low_polygon__game_ready.glb", nodeName: "SM_Kamera_2_1", position: [104, 0, 60], scale: 0.009392802257907206 },
  { id: "guard-booth", name: "Guard Booth", file: "small_guard_booth.glb", position: [98, 0, 44], scale: 1 },
  { id: "forklift", name: "Forklift", file: "forklift_low_poly.glb", position: [92, 0, 34], scale: 0.010365058731111439 },
  { id: "veg-1", name: "Vegetation Clump A", file: "grass_vegitation_mix.glb", position: [104, 0, -50], scale: 1, noShadowCast: true },
  { id: "veg-2", name: "Vegetation Clump B", file: "grass_vegitation_mix.glb", position: [104, 0, 0], scale: 1, noShadowCast: true },
  { id: "veg-3", name: "Vegetation Clump C", file: "grass_vegitation_mix.glb", position: [104, 0, 50], scale: 1, noShadowCast: true },
];

async function loadPlacement(p) {
  const template = await loadModel(p.file);
  if (!template) return null;
  let source3d = template;
  if (p.nodeName) {
    const found = template.getObjectByName(p.nodeName);
    if (found) source3d = found;
    else console.warn(`[twin3d] node "${p.nodeName}" not found in ${p.file}`);
  }
  const cloned = cloneModel(source3d);
  // Collapses assets that ship as hundreds/thousands of individual mesh nodes (the storage tank
  // farm alone was 2480 separate draw calls) down to a handful of merged meshes.
  const optimized = optimizeMeshCount(cloned);
  if (p.noShadowCast) optimized.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  const obj = centerAndGround(optimized);
  if (p.normalizeHeight) normalizeToHeight(obj, p.normalizeHeight);
  else obj.scale.setScalar(p.scale ?? 1);
  obj.userData.placementId = p.id;
  return obj;
}

async function buildPlacements(group) {
  const editables = [];
  for (const p of PLACEMENTS) {
    const obj = await loadPlacement(p);
    if (!obj) continue;
    obj.position.set(p.position[0], p.position[1], p.position[2]);
    if (p.rotationY) obj.rotation.y = p.rotationY;
    group.add(obj);
    editables.push({ id: p.id, name: p.name, object: obj });
  }
  return editables;
}

/** Builds the whole static station. Returns { group, editables }. */
export async function buildStation(scene) {
  const group = new THREE.Group();
  group.name = "station";
  scene.add(group);

  const { editable: groundEditable, asphalt } = buildGroundAndRoads(group);
  const groundGroup = groundEditable.object;
  addFootingPad(groundGroup, asphalt, -70, -46, 36, 24);   // LCC building pad
  addFootingPad(groundGroup, asphalt, -95, -18, 34, 20);    // storage tank-farm pad
  addFootingPad(groundGroup, asphalt, 95, -30, 20, 50);     // utility yard pad (control hut/pump/valve/pipe fragments)
  addFootingPad(groundGroup, asphalt, 96, 39, 18, 20);      // guard booth / forklift pad

  const editables = [groundEditable];
  editables.push(buildLCC(group));
  editables.push(buildHeaderAndManifolds(group));
  editables.push(await buildBayAprons(group));
  editables.push(...(await buildFenceAndGates(group)));
  editables.push(...(await buildPlacements(group)));

  return { group, editables };
}

export { manifoldX, baySlotZ };
