/* twin3d/station.js — static station geometry: ground, fences, silos, LCC, DN800 header,
 * 6 manifolds x 7 bays, gates, road loop. Exports the layout math other modules key off of. */
import * as THREE from "three";
import { loadModel, cloneModel, normalizeToHeight } from "./assets.js";

export const MANIFOLDS = 6;
export const BAYS_PER_MANIFOLD = 7;
export const BAY_COUNT = MANIFOLDS * BAYS_PER_MANIFOLD; // 42

const MANIFOLD_DX = 32;
const BAY_DZ = 13;
const HEADER_Z = -58;
const HEADER_Y = 4.6;
const MANIFOLD_Y = 3.4;

function manifoldX(m) { return (m - (MANIFOLDS - 1) / 2) * MANIFOLD_DX; }
function baySlotZ(s) { return (s - (BAYS_PER_MANIFOLD - 1) / 2) * BAY_DZ; }

export const GATE_ENTRY = new THREE.Vector3(-26, 0, 66);
export const GATE_EXIT = new THREE.Vector3(26, 0, 66);
export const QUEUE_POINT = new THREE.Vector3(-26, 0, 48);

const STATUS_COLOR = {
  idle: 0x2c3b52, filling: 0x22d3ee, done: 0x34d399, fault: 0xf87171, offline: 0x5f7292,
};

/** Bay id (1..42) -> world-space anchors used by every other module. */
export function bayLayout(id) {
  const m = Math.floor((id - 1) / BAYS_PER_MANIFOLD);
  const s = (id - 1) % BAYS_PER_MANIFOLD;
  const x = manifoldX(m);
  const z = baySlotZ(s);
  return {
    id, manifold: m, slot: s,
    manifoldX: x, z,
    riser: new THREE.Vector3(x, 0, z), // ground anchor for the riser stub
    valve: new THREE.Vector3(x + 2.4, 1.1, z), // inlet valve position
    armBase: new THREE.Vector3(x + 3.2, 2.6, z),
    truckPos: new THREE.Vector3(x + 7.6, 0, z), // where the tanker parks
    kiosk: new THREE.Vector3(x + 3.4, 0, z + 2.6),
    laneApproach: new THREE.Vector3(x + 7.6, 0, z - BAY_DZ * 0.4),
  };
}

export function laneEntryPoint(manifoldIndex) {
  return new THREE.Vector3(manifoldX(manifoldIndex) + 7.6, 0, 58);
}

function pipeMat(color = 0x8fa3c2) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.32 });
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

async function buildFence(group) {
  const tmpl = await loadModel("metal-fence.glb");
  if (!tmpl) return;
  normalizeToHeight(tmpl, 2.2);
  const perim = [];
  const w = 108, d = 68; // half-extents
  const step = 20;
  for (let x = -w; x <= w; x += step) { perim.push([x, -d, 0]); perim.push([x, d, Math.PI]); }
  for (let z = -d + step; z < d; z += step) { perim.push([-w, z, Math.PI / 2]); perim.push([w, z, -Math.PI / 2]); }
  perim.forEach(([x, z, ry]) => {
    const c = cloneModel(tmpl);
    c.position.set(x, 0, z);
    c.rotation.y = ry;
    group.add(c);
  });
}

async function buildGates(group) {
  const barrierTmpl = await loadModel("traffic-barrier.glb");
  const camTmpl = await loadModel("security-camera.glb");
  if (barrierTmpl) normalizeToHeight(barrierTmpl, 1.1);
  if (camTmpl) normalizeToHeight(camTmpl, 0.6);
  const gates = [
    { pos: GATE_ENTRY, ry: 0, label: "entry" },
    { pos: GATE_EXIT, ry: Math.PI, label: "exit" },
  ];
  const barriers = [];
  gates.forEach((g) => {
    if (barrierTmpl) {
      const b = cloneModel(barrierTmpl);
      b.position.set(g.pos.x, 0, g.pos.z);
      b.rotation.y = g.ry;
      group.add(b);
      barriers.push(b);
    }
    if (camTmpl) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 8), pipeMat(0x33455e));
      pole.position.set(g.pos.x + 2.2, 1.7, g.pos.z);
      pole.castShadow = true;
      group.add(pole);
      const cam = cloneModel(camTmpl);
      cam.position.set(g.pos.x + 2.2, 3.3, g.pos.z);
      cam.rotation.y = g.ry;
      group.add(cam);
    }
  });
  return barriers;
}

function buildGround(group) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(232, 148, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xc9b58b, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const grid = new THREE.GridHelper(232, 58, 0x8a7a58, 0x9c8c68);
  grid.position.y = 0.02;
  grid.material.opacity = 0.18;
  grid.material.transparent = true;
  group.add(grid);

  // road loop: entry -> lane strip -> exit (simple dark strips, cheap on a laptop GPU)
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 0.9 });
  const loop = new THREE.Mesh(new THREE.PlaneGeometry(200, 10), roadMat);
  loop.rotation.x = -Math.PI / 2; loop.position.set(0, 0.015, 58);
  loop.receiveShadow = true;
  group.add(loop);
  for (let m = 0; m < MANIFOLDS; m++) {
    const x = manifoldX(m) + 7.6;
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 122), roadMat);
    lane.rotation.x = -Math.PI / 2; lane.position.set(x, 0.012, -8);
    lane.receiveShadow = true;
    group.add(lane);
  }
}

function buildLCC(group) {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(20, 6.5, 12),
    new THREE.MeshStandardMaterial({ color: 0x9aa5b4, roughness: 0.6 })
  );
  box.position.set(-70, 3.25, -46);
  box.castShadow = true; box.receiveShadow = true;
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(21, 0.5, 13),
    new THREE.MeshStandardMaterial({ color: 0x30506f, roughness: 0.5 })
  );
  roof.position.set(-70, 6.75, -46);
  roof.castShadow = true;
  const glazing = new THREE.Mesh(
    new THREE.BoxGeometry(19.2, 3, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x0c1a2c, roughness: 0.15, metalness: 0.4, emissive: 0x0a2233, emissiveIntensity: 0.5 })
  );
  glazing.position.set(-70, 3.6, -39.9);
  group.add(box, roof, glazing);

  const sign = document.createElement("canvas");
  // (kept as pure geometry — a text sprite is unnecessary weight for a small demo win)
}

async function buildStorage(group) {
  const siloTmpl = await loadModel("silo-quaternius.glb");
  const tankTmpl = await loadModel("water-tank-quaternius.glb");
  if (siloTmpl) {
    normalizeToHeight(siloTmpl, 9);
    [[-92, -30], [-92, -18]].forEach(([x, z]) => {
      const s = cloneModel(siloTmpl);
      s.position.set(x, 0, z);
      group.add(s);
    });
  }
  if (tankTmpl) {
    normalizeToHeight(tankTmpl, 6.5);
    const t = cloneModel(tankTmpl);
    t.position.set(-92, 0, -4);
    group.add(t);
  }
}

function buildHeaderAndManifolds(group) {
  const headerMat = pipeMat(0x9db3d6);
  const manifoldMat = pipeMat(0x8098bc);
  const riserMat = pipeMat(0x6f88ab);

  // DN800 header along X at the north edge, fed from the storage tanks
  addStraightPipe(group, new THREE.Vector3(-88, HEADER_Y, HEADER_Z), new THREE.Vector3(88, HEADER_Y, HEADER_Z), 0.42, headerMat);
  addStraightPipe(group, new THREE.Vector3(-88, HEADER_Y, -20), new THREE.Vector3(-88, HEADER_Y, HEADER_Z), 0.42, headerMat);

  for (let m = 0; m < MANIFOLDS; m++) {
    const x = manifoldX(m);
    // drop from header down to manifold height
    addStraightPipe(group, new THREE.Vector3(x, HEADER_Y, HEADER_Z), new THREE.Vector3(x, MANIFOLD_Y, HEADER_Z), 0.22, manifoldMat);
    // manifold runs south along Z, spanning all 7 bay slots
    const zStart = baySlotZ(0) - BAY_DZ * 0.5;
    const zEnd = baySlotZ(BAYS_PER_MANIFOLD - 1) + BAY_DZ * 0.5;
    addStraightPipe(group, new THREE.Vector3(x, MANIFOLD_Y, HEADER_Z), new THREE.Vector3(x, MANIFOLD_Y, zStart), 0.22, manifoldMat);
    addStraightPipe(group, new THREE.Vector3(x, MANIFOLD_Y, zStart), new THREE.Vector3(x, MANIFOLD_Y, zEnd), 0.22, manifoldMat);

    // manifold label chip position stored on userData for labels.js
    for (let s = 0; s < BAYS_PER_MANIFOLD; s++) {
      const z = baySlotZ(s);
      addStraightPipe(group, new THREE.Vector3(x, MANIFOLD_Y, z), new THREE.Vector3(x + 2.4, 1.1, z), 0.09, riserMat);
    }
  }
}

/** Builds one bay apron + kiosk + camera pole (cheap procedural geometry so all 42 are affordable). */
function buildBayAprons(group, pickables) {
  const apronMat = new THREE.MeshStandardMaterial({ color: 0xb9ab86, roughness: 0.95 });
  const kioskMat = new THREE.MeshStandardMaterial({ color: 0xe4e9f0, roughness: 0.5 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0a2233, emissive: 0x22d3ee, emissiveIntensity: 0.55 });

  for (let id = 1; id <= BAY_COUNT; id++) {
    const l = bayLayout(id);
    const apron = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.15, BAY_DZ - 1.4), apronMat);
    apron.position.set(l.manifoldX + 6, 0.08, l.z);
    apron.receiveShadow = true;
    apron.userData.bayId = id;
    group.add(apron);
    pickables.push({ mesh: apron, bayId: id });

    // status dot on the apron
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshBasicMaterial({ color: STATUS_COLOR.idle }));
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(l.manifoldX + 6, 0.17, l.z);
    dot.userData.statusDot = id;
    group.add(dot);

    // kiosk
    const kiosk = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.5, 0.5), kioskMat);
    kiosk.position.set(l.kiosk.x, 0.75, l.kiosk.z);
    kiosk.castShadow = true;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.55), screenMat);
    screen.position.set(0, 0.15, 0.26);
    kiosk.add(screen);
    group.add(kiosk);

    // camera pole (only every other bay to keep drawcalls sane — still reads as "covered by CCTV")
    if (id % 2 === 0) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), new THREE.MeshStandardMaterial({ color: 0x33455e }));
      pole.position.set(l.manifoldX + 9.6, 1.5, l.z);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.5), new THREE.MeshStandardMaterial({ color: 0x1b2534 }));
      head.position.set(l.manifoldX + 9.6, 3, l.z);
      group.add(head);
    }
  }
}

/** Updates the per-bay status dot colours; called on tick from twin3d.js. Cheap: 42 material swaps. */
export function refreshBayStatusDots(group, bays) {
  const byId = new Map(bays.map((b) => [b.id, b]));
  group.traverse((o) => {
    if (o.userData && o.userData.statusDot) {
      const bay = byId.get(o.userData.statusDot);
      if (bay) o.material.color.setHex(STATUS_COLOR[bay.status] ?? STATUS_COLOR.idle);
    }
  });
}

/** Builds the whole static station. Returns { group, pickables, barriers }. */
export async function buildStation(scene) {
  const group = new THREE.Group();
  group.name = "station";
  scene.add(group);
  const pickables = [];

  buildGround(group);
  buildLCC(group);
  buildHeaderAndManifolds(group);
  buildBayAprons(group, pickables);
  const [barriers] = await Promise.all([buildGates(group), buildStorage(group), buildFence(group)]);

  return { group, pickables, barriers: barriers || [] };
}

export { manifoldX, baySlotZ, STATUS_COLOR };
