/* twin3d/trucks.ts — truck presence + arrival/departure driving, driven by live bay status (ported from
 * legacy/twin3d/trucks.js, turned from module-level state into a factory so remounting the view can't leak).
 *
 * Movement model: every trip is a fixed sequence of straight-line "legs" that follow the actual road geometry
 * (perimeter loop -> lane -> bay), with an in-place rotation only at the corners where the road turns. A spline from
 * gate to bay would cut diagonals and overshoot at corners; straight legs + stationary turns can't. */
import * as THREE from 'three';
import type { Bay } from '../../sim/data';
import { loadModel, cloneModel, normalizeToHeight, fallbackTruck } from './assets';
import { bayLayout, GATE_ENTRY, GATE_EXIT, ROAD_LOOP_Z, type BayAnchors } from './layout';

const POOL_SIZE = 46;
const TRUCK_HEIGHT_M = 3.3;
const SPEED = 9; // m/s along a straight leg
const TURN_DURATION = 0.45; // seconds for an in-place corner turn
// truck-tank-kolos.glb's own forward axis is LOCAL -X (cab at the -X end). Every heading below accounts for that
// (see headingBetween); PARKED_HEADING = PI points the cab toward the lane/open side of the stall, not the kiosk/valve.
const PARKED_HEADING = Math.PI;

// Fill-progress gauge floated above each parked truck — a plain cylinder so it looks the same regardless of tank shape/heading.
const GAUGE_H = 1.1;
const GAUGE_Y = TRUCK_HEIGHT_M + 0.5;

function makeGauge() {
  const g = new THREE.Group();
  g.position.y = GAUGE_Y;
  g.visible = false;
  const bg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, GAUGE_H, 10),
    new THREE.MeshBasicMaterial({ color: 0x0a1a2c, transparent: true, opacity: 0.55 }),
  );
  bg.position.y = GAUGE_H / 2;
  const fg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, GAUGE_H, 10), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  g.add(bg, fg);
  setGaugeFraction(fg, 0);
  return { group: g, fg };
}

/** Keeps the fill bar bottom-anchored (matching `bg`) while its height scales with `frac`. */
function setGaugeFraction(fg: THREE.Mesh, frac: number) {
  const f = THREE.MathUtils.clamp(frac, 0.02, 1);
  fg.scale.y = f;
  fg.position.y = (GAUGE_H * f) / 2;
  (fg.material as THREE.MeshBasicMaterial).color.setHex(f > 0.85 ? 0x34d399 : 0x22d3ee);
}

type Leg =
  | { type: 'move'; from: THREE.Vector3; to: THREE.Vector3; heading: number }
  | { type: 'turn'; at: THREE.Vector3; from: number; to: number };

interface PoolItem {
  obj: THREE.Object3D;
  bayId: number | null;
  mode: 'idle' | 'arriving' | 'parked' | 'leaving';
  legs: Leg[];
  legIndex: number;
  legT: number;
  tint: Bay['status'] | null;
  gauge: THREE.Group;
  gaugeFg: THREE.Mesh;
}

/** Rotation.y that points the model's local -X (its cab/forward end) at the direction from a to b. */
function headingBetween(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.atan2(b.z - a.z, -(b.x - a.x));
}
/** Shortest-path angle difference, result in (-PI, PI]. */
function angleDiff(a: number, b: number): number {
  return ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}
function easeInOut(u: number): number {
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}

/** Turns a list of waypoints into alternating move/turn legs — a "turn" leg is inserted only where the heading actually changes. */
function buildLegs(waypoints: THREE.Vector3[], finalHeading: number | null): Leg[] {
  const legs: Leg[] = [];
  let prevHeading: number | null = null;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i], b = waypoints[i + 1];
    if (a.distanceTo(b) < 1e-6) continue;
    const heading = headingBetween(a, b);
    if (prevHeading !== null && Math.abs(angleDiff(prevHeading, heading)) > 0.02) {
      legs.push({ type: 'turn', at: a.clone(), from: prevHeading, to: heading });
    }
    legs.push({ type: 'move', from: a.clone(), to: b.clone(), heading });
    prevHeading = heading;
  }
  if (finalHeading != null && prevHeading != null && Math.abs(angleDiff(prevHeading, finalHeading)) > 0.02) {
    legs.push({ type: 'turn', at: waypoints[waypoints.length - 1].clone(), from: prevHeading, to: finalHeading });
  }
  return legs;
}

const legHeading = (l: Leg) => (l.type === 'move' ? l.heading : l.to);

/** Gate -> perimeter loop -> manifold's lane -> bay. Ends facing PARKED_HEADING, across the stall. */
function arrivalLegs(layout: BayAnchors): Leg[] {
  const lx = layout.manifoldX + 7.6;
  return buildLegs([
    GATE_ENTRY.clone(),
    new THREE.Vector3(GATE_ENTRY.x, 0, ROAD_LOOP_Z),
    new THREE.Vector3(lx, 0, ROAD_LOOP_Z),
    new THREE.Vector3(lx, 0, layout.z),
  ], PARKED_HEADING);
}
/** Reverse of arrivalLegs, out through the exit gate, starting with a swing out of the stall from the current heading. */
function departureLegs(layout: BayAnchors, currentHeading: number): Leg[] {
  const lx = layout.manifoldX + 7.6;
  const waypoints = [
    new THREE.Vector3(lx, 0, layout.z),
    new THREE.Vector3(lx, 0, ROAD_LOOP_Z),
    new THREE.Vector3(GATE_EXIT.x, 0, ROAD_LOOP_Z),
    GATE_EXIT.clone(),
  ];
  const legs = buildLegs(waypoints, null);
  if (legs.length && Math.abs(angleDiff(currentHeading, legHeading(legs[0]))) > 0.02) {
    legs.unshift({ type: 'turn', at: waypoints[0].clone(), from: currentHeading, to: legHeading(legs[0]) });
  }
  return legs;
}

export interface Trucks {
  group: THREE.Group;
  /** Called every frame with live bay state + frame delta (seconds). */
  update(bays: readonly Bay[], dt: number): void;
  getTruckObject(bayId: number): THREE.Object3D | null;
}

export async function createTrucks(scene: THREE.Scene, ctx: { cancelled(): boolean } = { cancelled: () => false }): Promise<Trucks> {
  const group = new THREE.Group();
  group.name = 'trucks';
  scene.add(group);
  const pool: PoolItem[] = [];
  const bayToTruck = new Map<number, PoolItem>();

  const template = await loadModel('truck-tank-kolos.glb');
  // No recolor(): this model's meshes have generic names so name-matching would paint the whole truck one flat colour;
  // left alone it keeps its native GLTF palette.
  if (template && !ctx.cancelled()) normalizeToHeight(template, TRUCK_HEIGHT_M);

  if (!ctx.cancelled()) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const obj = template ? cloneModel(template) : fallbackTruck();
      obj.visible = false;
      const { group: gauge, fg } = makeGauge();
      obj.add(gauge);
      group.add(obj);
      pool.push({ obj, bayId: null, mode: 'idle', legs: [], legIndex: 0, legT: 0, tint: null, gauge, gaugeFg: fg });
    }
  }

  function startArriving(item: PoolItem, bay: Bay, layout: BayAnchors) {
    item.bayId = bay.id;
    item.mode = 'arriving';
    item.legs = arrivalLegs(layout);
    item.legIndex = 0;
    item.legT = 0;
    item.obj.position.copy(GATE_ENTRY);
    item.obj.rotation.y = item.legs.length ? legHeading(item.legs[0]) : 0;
    item.obj.visible = true;
    // Tagged on the THREE object so the click raycaster can walk up from any mesh to the owning bay id.
    item.obj.userData.bayId = bay.id;
    bayToTruck.set(bay.id, item);
  }
  function startLeaving(item: PoolItem, layout: BayAnchors) {
    item.mode = 'leaving';
    item.legs = departureLegs(layout, item.obj.rotation.y);
    item.legIndex = 0;
    item.legT = 0;
  }

  /** Advances one truck's current leg by dt. Returns true once every leg is complete. */
  function advance(item: PoolItem, dt: number): boolean {
    if (item.legIndex >= item.legs.length) return true;
    const leg = item.legs[item.legIndex];
    item.legT += dt;
    if (leg.type === 'move') {
      const dist = leg.from.distanceTo(leg.to);
      const duration = Math.max(0.05, dist / SPEED);
      const u = Math.min(1, item.legT / duration);
      item.obj.position.lerpVectors(leg.from, leg.to, u);
      item.obj.rotation.y = leg.heading;
      if (u >= 1) { item.legIndex++; item.legT = 0; }
    } else {
      const u = Math.min(1, item.legT / TURN_DURATION);
      item.obj.position.copy(leg.at);
      item.obj.rotation.y = leg.from + angleDiff(leg.from, leg.to) * easeInOut(u);
      if (u >= 1) { item.legIndex++; item.legT = 0; }
    }
    return item.legIndex >= item.legs.length;
  }

  function tintTruck(item: PoolItem, status: Bay['status']) {
    item.tint = status;
    const grey = status === 'offline';
    const red = status === 'fault';
    item.obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material)) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!mat || !mat.color) return;
      if (mat.userData.__origColor === undefined) mat.userData.__origColor = mat.color.getHex();
      mat.color.setHex(grey ? 0x6b7688 : red ? 0xef6f6f : (mat.userData.__origColor as number));
    });
  }

  return {
    group,
    update(bays, dt) {
      bays.forEach((bay) => {
        const wantTruck = bay.status !== 'idle';
        let item = bayToTruck.get(bay.id);
        const layout = bayLayout(bay.id);

        if (wantTruck && !item) {
          item = pool.find((p) => p.bayId == null);
          if (item) startArriving(item, bay, layout);
        } else if (!wantTruck && item && item.mode === 'parked') {
          startLeaving(item, layout);
        }

        if (item && item.tint !== bay.status) tintTruck(item, bay.status);

        if (item && item.mode === 'parked' && bay.target > 0) {
          item.gauge.visible = true;
          setGaugeFraction(item.gaugeFg, bay.dispensed / bay.target);
        } else if (item) {
          item.gauge.visible = false;
        }
      });

      pool.forEach((item) => {
        if (item.mode === 'arriving') {
          if (advance(item, dt)) {
            item.mode = 'parked';
            item.obj.position.copy(bayLayout(item.bayId!).truckPos);
            item.obj.rotation.y = PARKED_HEADING;
          }
        } else if (item.mode === 'leaving') {
          if (advance(item, dt)) {
            item.mode = 'idle';
            item.obj.visible = false;
            bayToTruck.delete(item.bayId!);
            item.bayId = null;
            item.tint = null;
            delete item.obj.userData.bayId;
          }
        }
      });
    },
    getTruckObject(bayId) {
      return bayToTruck.get(bayId)?.obj ?? null;
    },
  };
}
