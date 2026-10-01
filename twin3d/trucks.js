/* twin3d/trucks.js — truck presence + arrival/departure driving, driven by
 * SIAP.state.bays[].status.
 *
 * Movement model: every trip is a fixed sequence of straight-line "legs" that follow the actual
 * road geometry (perimeter loop -> lane -> bay), with an in-place rotation only at the corners
 * where the road actually turns. This is deliberate: the previous version of this feature (long
 * since removed) drove trucks along a single smooth CatmullRom spline from gate to bay, which
 * cuts a diagonal shortcut across the yard and, worse, overshoots at sharp turns -- a well-known
 * spline artifact that reads as the truck swinging wide or snapping through an unnatural heading
 * near corners ("weird turns"). Straight legs + snap-free in-place turns can't produce that: the
 * heading is always either exactly the current leg's direction or interpolating between two
 * fixed headings while the truck is stationary, so it never travels sideways or through a curve
 * it isn't actually facing. */
import * as THREE from "three";
import { loadModel, cloneModel, normalizeToHeight, fallbackTruck } from "./assets.js?v=6";
import { bayLayout, GATE_ENTRY, GATE_EXIT, ROAD_LOOP_Z } from "./layout.js?v=12";

const POOL_SIZE = 46;
const TRUCK_HEIGHT_M = 3.3;
const SPEED = 9; // m/s along a straight leg
const TURN_DURATION = 0.45; // seconds for an in-place corner turn
// truck-tank-kolos.glb's own forward axis is LOCAL -X, not +Z (the usual convention) or even
// +X: the model is 7.6m long on X vs 3.1m on Z at rotation.y=0 (confirming X is the long axis),
// and inspecting the individual meshes placed the small trim/mirror-type parts (compact, near one
// end) toward -X while the tank body (color 8f4334) extends toward +X -- i.e. the cab is the -X
// end. Every heading in this file accounts for that (see headingBetween); PARKED_HEADING=PI is
// what points the cab (-X) toward the lane/open side of the stall rather than at the kiosk/valve.
const PARKED_HEADING = Math.PI;

// Fill-progress gauge floated above each parked truck -- a "which trucks are filled, by how
// much" readout that reads at a glance across the whole yard, independent of the per-bay HUD
// chips (see twin3d/labels.js) which give the exact numbers on hover/selection. Built as a plain
// cylinder (not attached to any tank geometry on the GLB, whose UVs/bounds aren't known) so it
// looks the same regardless of the model's actual tank shape or the truck's current heading.
const GAUGE_H = 1.1;
const GAUGE_Y = TRUCK_HEIGHT_M + 0.5;

function makeGauge() {
  const g = new THREE.Group();
  g.position.y = GAUGE_Y;
  g.visible = false;
  const bg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, GAUGE_H, 10),
    new THREE.MeshBasicMaterial({ color: 0x0a1a2c, transparent: true, opacity: 0.55 })
  );
  bg.position.y = GAUGE_H / 2;
  const fg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, GAUGE_H, 10),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee })
  );
  g.add(bg, fg);
  setGaugeFraction(fg, 0);
  return { group: g, fg };
}

/** Keeps the fill bar bottom-anchored (matching `bg`, which sits at local y in [0, GAUGE_H])
 *  while its height scales with `frac` -- scaling a centered cylinder alone would shrink it
 *  toward the group's origin instead of draining from the top. */
function setGaugeFraction(fg, frac) {
  const f = THREE.MathUtils.clamp(frac, 0.02, 1);
  fg.scale.y = f;
  fg.position.y = (GAUGE_H * f) / 2;
  fg.material.color.setHex(f > 0.85 ? 0x34d399 : 0x22d3ee);
}

let group = null;
let template = null;
let pool = []; // { obj, bayId, mode, legs, legIndex, legT, tint, gauge, gaugeFg }
const bayToTruck = new Map();

export async function initTrucks(scene) {
  group = new THREE.Group();
  group.name = "trucks";
  scene.add(group);

  template = await loadModel("truck-tank-kolos.glb");
  // No recolor() here on purpose: this model's meshes have generic names ("Cube000_1",
  // "Material.002", no "tank"/"tyre" keywords), so the name-matching recolor() heuristic
  // couldn't tell parts apart and painted the entire truck one flat near-white "body" colour --
  // which is what wiped out its actual varied factory palette. Left alone, it keeps its native
  // GLTF colours.
  if (template) normalizeToHeight(template, TRUCK_HEIGHT_M);

  for (let i = 0; i < POOL_SIZE; i++) {
    const obj = template ? cloneModel(template) : fallbackTruck();
    obj.visible = false;
    const { group: gauge, fg: gaugeFg } = makeGauge();
    obj.add(gauge);
    group.add(obj);
    pool.push({ obj, bayId: null, mode: "idle", legs: [], legIndex: 0, legT: 0, tint: null, gauge, gaugeFg });
  }
  return group;
}

/* ---------------- leg-based path helpers ---------------- */
/** Rotation.y that points the model's local -X (its actual cab/forward end -- see the note by
 *  PARKED_HEADING) at the direction from a to b. Getting the AXIS right (X, not the usual +Z)
 *  fixed trucks driving sideways; getting the SIGN wrong on that axis (assuming +X instead of -X
 *  was forward) is what made them drive tank-first instead -- "moving backwards". */
function headingBetween(a, b) {
  return Math.atan2(b.z - a.z, -(b.x - a.x));
}
/** Shortest-path angle difference, result in (-PI, PI]. */
function angleDiff(a, b) {
  return ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}
function easeInOut(u) {
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}

/** Turns a list of waypoints into alternating move/turn legs -- a "turn" leg is inserted only
 *  where the heading actually changes between segments (including into `finalHeading`, e.g. the
 *  90-degree swing into a parking stall at the very end of an arrival). */
function buildLegs(waypoints, finalHeading) {
  const legs = [];
  let prevHeading = null;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i], b = waypoints[i + 1];
    if (a.distanceTo(b) < 1e-6) continue; // degenerate segment, skip
    const heading = headingBetween(a, b);
    if (prevHeading !== null && Math.abs(angleDiff(prevHeading, heading)) > 0.02) {
      legs.push({ type: "turn", at: a.clone(), from: prevHeading, to: heading });
    }
    legs.push({ type: "move", from: a.clone(), to: b.clone(), heading });
    prevHeading = heading;
  }
  if (finalHeading != null && prevHeading != null && Math.abs(angleDiff(prevHeading, finalHeading)) > 0.02) {
    legs.push({ type: "turn", at: waypoints[waypoints.length - 1].clone(), from: prevHeading, to: finalHeading });
  }
  return legs;
}

/** Gate -> perimeter loop -> manifold's lane -> bay. Ends facing PARKED_HEADING, across the
 *  stall, matching the apron/canopy orientation. */
function arrivalLegs(layout) {
  const laneX = layout.manifoldX + 7.6;
  const waypoints = [
    GATE_ENTRY.clone(),
    new THREE.Vector3(GATE_ENTRY.x, 0, ROAD_LOOP_Z),
    new THREE.Vector3(laneX, 0, ROAD_LOOP_Z),
    new THREE.Vector3(laneX, 0, layout.z),
  ];
  return buildLegs(waypoints, PARKED_HEADING);
}
/** Reverse of arrivalLegs, out through the exit gate. Starting heading is whatever the truck is
 *  currently parked at, so the first turn is computed at animation start (see startLeaving). */
function departureLegs(layout, currentHeading) {
  const laneX = layout.manifoldX + 7.6;
  const waypoints = [
    new THREE.Vector3(laneX, 0, layout.z),
    new THREE.Vector3(laneX, 0, ROAD_LOOP_Z),
    new THREE.Vector3(GATE_EXIT.x, 0, ROAD_LOOP_Z),
    GATE_EXIT.clone(),
  ];
  const legs = buildLegs(waypoints, null);
  // Splice in the initial swing out of the stall, from however the truck is currently facing to
  // the first leg's heading -- buildLegs can't know the starting heading on its own.
  if (legs.length && Math.abs(angleDiff(currentHeading, legs[0].heading ?? legs[0].to)) > 0.02) {
    const firstMoveHeading = legs[0].type === "move" ? legs[0].heading : legs[0].to;
    legs.unshift({ type: "turn", at: waypoints[0].clone(), from: currentHeading, to: firstMoveHeading });
  }
  return legs;
}

function startArriving(item, bay, layout) {
  item.bayId = bay.id;
  item.mode = "arriving";
  item.legs = arrivalLegs(layout);
  item.legIndex = 0;
  item.legT = 0;
  item.obj.position.copy(GATE_ENTRY);
  item.obj.rotation.y = item.legs.length ? (item.legs[0].heading ?? item.legs[0].to) : 0;
  item.obj.visible = true;
  // Tagged on the THREE object itself (not just the pool item) so twin3d.js's click raycaster
  // can walk up from whatever mesh it hit to find the owning bay id -- see the click-to-info
  // panel wired in twin3d.js, which replaced the old always-on floating text chips.
  item.obj.userData.bayId = bay.id;
  bayToTruck.set(bay.id, item);
}
function startLeaving(item, layout) {
  item.mode = "leaving";
  item.legs = departureLegs(layout, item.obj.rotation.y);
  item.legIndex = 0;
  item.legT = 0;
}

/** Advances one truck's current leg by dt. Returns true once every leg is complete. */
function advance(item, dt) {
  if (item.legIndex >= item.legs.length) return true;
  const leg = item.legs[item.legIndex];
  item.legT += dt;
  if (leg.type === "move") {
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

/** Called every tick with live SIAP state + frame delta. */
export function updateTrucks(bays, dt) {
  if (!group) return;

  bays.forEach((bay) => {
    const wantTruck = bay.status !== "idle";
    let item = bayToTruck.get(bay.id);
    const layout = bayLayout(bay.id);

    if (wantTruck && !item) {
      item = pool.find((p) => p.bayId == null);
      if (item) startArriving(item, bay, layout);
    } else if (!wantTruck && item && item.mode === "parked") {
      startLeaving(item, layout);
    }

    if (item && item.tint !== bay.status) {
      item.tint = bay.status;
      const grey = bay.status === "offline";
      const red = bay.status === "fault";
      item.obj.traverse((o) => {
        if (o.isMesh && o.material && o.material.color) {
          if (!o.material.userData.__origColor) o.material.userData.__origColor = o.material.color.getHex();
          const orig = o.material.userData.__origColor;
          o.material.color.setHex(grey ? 0x6b7688 : red ? 0xef6f6f : orig);
        }
      });
    }

    if (item && item.mode === "parked" && bay.target > 0) {
      item.gauge.visible = true;
      setGaugeFraction(item.gaugeFg, bay.dispensed / bay.target);
    } else if (item) {
      item.gauge.visible = false;
    }
  });

  pool.forEach((item) => {
    if (item.mode === "arriving") {
      if (advance(item, dt)) {
        item.mode = "parked";
        item.obj.position.copy(bayLayout(item.bayId).truckPos);
        item.obj.rotation.y = PARKED_HEADING;
      }
    } else if (item.mode === "leaving") {
      if (advance(item, dt)) {
        item.mode = "idle";
        item.obj.visible = false;
        bayToTruck.delete(item.bayId);
        item.bayId = null;
        item.tint = null;
        delete item.obj.userData.bayId;
      }
    }
  });
}

export function getTruckObject(bayId) {
  const item = bayToTruck.get(bayId);
  return item ? item.obj : null;
}

export function truckCount() {
  return pool.filter((p) => p.bayId != null).length;
}
