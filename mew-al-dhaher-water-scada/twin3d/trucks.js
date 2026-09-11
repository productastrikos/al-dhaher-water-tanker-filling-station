/* twin3d/trucks.js — truck pool driven by SIAP.state.bays[].status.
 * idle -> no truck; filling/done/fault/offline -> truck present (parked or animating). */
import * as THREE from "three";
import { loadModel, cloneModel, normalizeToHeight, recolor, fallbackTruck } from "./assets.js";
import { bayLayout, laneEntryPoint, GATE_ENTRY, GATE_EXIT } from "./station.js";

const POOL_SIZE = 46;
const TRUCK_HEIGHT_M = 3.3;

let group = null;
let template = null;
let pool = []; // { obj, inUse, bayId, phase, t, dur, curve, gauge, beacon }
const bayToTruck = new Map(); // bayId -> pool item
const prevStatus = new Map(); // bayId -> last seen status

function makeGauge() {
  const g = new THREE.Group();
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.6), new THREE.MeshBasicMaterial({ color: 0x08101d, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 1.4), new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide }));
  fill.position.z = 0.01;
  fill.userData.isFill = true;
  g.add(back, fill);
  g.position.set(1.6, 2.6, 0);
  return g;
}

function makeBeacon() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshBasicMaterial({ color: 0xf87171 }));
  m.position.set(0, TRUCK_HEIGHT_M + 0.3, -1.5);
  m.visible = false;
  return m;
}

export async function initTrucks(scene) {
  group = new THREE.Group();
  group.name = "trucks";
  scene.add(group);

  template = await loadModel("truck-tank-kolos.glb");
  if (template) {
    recolor(template, {});
    normalizeToHeight(template, TRUCK_HEIGHT_M);
  }

  for (let i = 0; i < POOL_SIZE; i++) {
    const obj = template ? cloneModel(template) : fallbackTruck();
    obj.visible = false;
    const gauge = makeGauge();
    const beacon = makeBeacon();
    obj.add(gauge, beacon);
    group.add(obj);
    pool.push({ obj, inUse: false, bayId: null, phase: "idle", t: 0, dur: 4, curve: null, gauge, beacon });
  }
  return group;
}

function spawnAt(bay, layout) {
  const item = pool.find((p) => !p.inUse);
  if (!item) return null;
  item.inUse = true;
  item.bayId = bay.id;
  item.obj.visible = true;
  const entry = laneEntryPoint(layout.manifold);
  item.curve = new THREE.CatmullRomCurve3([
    GATE_ENTRY.clone(),
    new THREE.Vector3(entry.x, 0, GATE_ENTRY.z * 0.5),
    entry.clone(),
    layout.truckPos.clone(),
  ]);
  item.t = 0; item.dur = 4;
  item.phase = "arriving";
  bayToTruck.set(bay.id, item);
  return item;
}

function startLeaving(item, layout) {
  const entry = laneEntryPoint(layout.manifold);
  item.curve = new THREE.CatmullRomCurve3([
    layout.truckPos.clone(),
    entry.clone(),
    new THREE.Vector3(entry.x * 0.4, 0, 40),
    GATE_EXIT.clone(),
  ]);
  item.t = 0; item.dur = 6;
  item.phase = "leaving";
}

function orientAlongCurve(obj, curve, u) {
  const pos = curve.getPointAt(Math.min(0.999, u));
  const ahead = curve.getPointAt(Math.min(1, u + 0.01));
  obj.position.copy(pos);
  const dir = new THREE.Vector3().subVectors(ahead, pos);
  if (dir.lengthSq() > 1e-6) {
    const angle = Math.atan2(dir.x, dir.z);
    obj.rotation.y = angle;
  }
}

/** Called every tick with the live SIAP state. Handles arrival/departure edges + parked visuals. */
export function updateTrucks(bays, dt, tNow) {
  if (!group) return;

  bays.forEach((bay) => {
    const prev = prevStatus.get(bay.id);
    const wantTruck = bay.status !== "idle";
    let item = bayToTruck.get(bay.id);
    const layout = bayLayout(bay.id);

    if (wantTruck && !item) {
      item = spawnAt(bay, layout);
    } else if (!wantTruck && item && item.phase !== "leaving") {
      startLeaving(item, layout);
    } else if (wantTruck && item && item.phase === "parked") {
      // status changed while parked (e.g. filling -> fault) — nothing to move, visuals update below
    }
    prevStatus.set(bay.id, bay.status);
  });

  pool.forEach((item) => {
    if (!item.inUse) return;
    const bay = bays.find((b) => b.id === item.bayId);
    if (item.phase === "arriving" || item.phase === "leaving") {
      item.t += dt;
      const u = Math.min(1, item.t / item.dur);
      orientAlongCurve(item.obj, item.curve, u);
      // wheel roll for visual life
      item.obj.rotation.x = 0;
      if (u >= 1) {
        if (item.phase === "arriving") {
          item.phase = "parked";
          item.obj.position.copy(bayLayout(item.bayId).truckPos);
          item.obj.rotation.y = Math.PI / 2;
        } else {
          item.inUse = false;
          item.obj.visible = false;
          bayToTruck.delete(item.bayId);
          item.bayId = null;
        }
      }
      return;
    }
    if (!bay) return;
    // parked: update fill gauge + fault/offline visuals
    const pct = Math.max(0, Math.min(1, bay.target ? bay.dispensed / bay.target : 0));
    const fillMesh = item.gauge.children.find((c) => c.userData.isFill);
    if (fillMesh) {
      fillMesh.scale.y = Math.max(0.02, pct);
      fillMesh.position.y = -0.7 + (1.4 * pct) / 2;
      fillMesh.material.color.setHex(bay.status === "fault" ? 0xf87171 : 0x22d3ee);
    }
    item.gauge.visible = bay.status === "filling" || bay.status === "done";
    item.beacon.visible = bay.status === "fault";
    if (bay.status === "fault") {
      const blink = (Math.sin(tNow * 10) + 1) / 2;
      item.beacon.material.opacity = 1;
      item.beacon.scale.setScalar(0.7 + blink * 0.6);
    }
    if (item.obj.userData.__tint !== bay.status) {
      item.obj.userData.__tint = bay.status;
      const grey = bay.status === "offline";
      item.obj.traverse((o) => {
        if (o.isMesh && o.material && o.material.color) {
          if (!o.material.userData.__origColor) o.material.userData.__origColor = o.material.color.getHex();
          o.material.color.setHex(grey ? 0x6b7688 : o.material.userData.__origColor);
        }
      });
    }
  });
}

export function getTruckObject(bayId) {
  const item = bayToTruck.get(bayId);
  return item ? item.obj : null;
}

export function truckCount() {
  return pool.filter((p) => p.inUse).length;
}
