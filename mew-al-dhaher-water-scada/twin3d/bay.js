/* twin3d/bay.js — bay-detail sub-scene built at the selected bay: inlet header -> inlet valve ->
 * PT -> EMF custody flowmeter -> TT -> fine-fill valve -> loading arm -> tanker hatch, plus kiosk
 * and arm camera. One reusable rig is repositioned to the selected bay (cheap vs. 42 full rigs). */
import * as THREE from "three";
import { loadModel, cloneModel, normalizeToHeight, makeFlowTexture } from "./assets.js";
import { bayLayout } from "./station.js";
import { createLabel, kv } from "./labels.js";

function jitter(seed, amp) {
  return typeof window.twinJitter === "function" ? window.twinJitter(seed, amp) : Math.sin(Date.now() / 4000 + seed) * amp;
}
function balanceSeed(account) {
  return typeof window.accountBalanceSeed === "function" ? window.accountBalanceSeed(account) : 120;
}

const VALVE_COLOR = { open: 0x34d399, closed: 0x5f7292, fault: 0xf87171, done: 0x22d3ee };

function metalMat(color) { return new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3 }); }

export async function buildBayRig(scene) {
  const rig = new THREE.Group();
  rig.name = "bay-detail-rig";
  scene.add(rig);

  // 1. inlet header stub (short thick pipe entering from the manifold)
  const header = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3, 12), metalMat(0x8098bc));
  header.rotation.z = Math.PI / 2;
  header.position.set(-3.6, 2.6, 0);
  header.castShadow = true;
  rig.add(header);

  // 2. inlet valve (wedge body + rotating stem)
  const inletValve = new THREE.Group();
  const ivBody = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 14), metalMat(VALVE_COLOR.closed));
  const ivStem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), metalMat(0x33455e));
  ivStem.position.y = 0.42;
  const ivHandle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.06), metalMat(0xffcf5c));
  ivHandle.position.y = 0.68;
  inletValve.add(ivBody, ivStem, ivHandle);
  inletValve.position.set(-1.8, 2.6, 0);
  rig.add(inletValve);

  // 3. PT — pressure transmitter (head on a stub, branches up)
  const pt = new THREE.Group();
  const ptStub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), metalMat(0x6f88ab));
  ptStub.position.y = 0.25;
  const ptHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), metalMat(0x3b82f6));
  ptHead.position.y = 0.6;
  pt.add(ptStub, ptHead);
  pt.position.set(-0.9, 2.6, 0);
  rig.add(pt);

  // 4. EMF custody flowmeter (flanged body, blue)
  const emf = new THREE.Group();
  const emfBody = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), metalMat(0x2563eb));
  emfBody.rotation.z = Math.PI / 2;
  const flangeGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.06, 16);
  const flangeA = new THREE.Mesh(flangeGeo, metalMat(0x33455e));
  flangeA.rotation.z = Math.PI / 2; flangeA.position.x = -0.45;
  const flangeB = flangeA.clone(); flangeB.position.x = 0.45;
  emf.add(emfBody, flangeA, flangeB);
  emf.position.set(0.2, 2.6, 0);
  rig.add(emf);

  // 5. TT — temperature transmitter (branch down)
  const tt = new THREE.Group();
  const ttStub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), metalMat(0x6f88ab));
  ttStub.position.y = -0.25;
  const ttHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), metalMat(0xfbbf24));
  ttHead.position.y = -0.55;
  tt.add(ttStub, ttHead);
  tt.position.set(1.1, 2.6, 0);
  rig.add(tt);

  // 6. fine-fill valve
  const fineValve = new THREE.Group();
  const fvBody = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 14), metalMat(VALVE_COLOR.closed));
  const fvStem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.45, 8), metalMat(0x33455e));
  fvStem.position.y = 0.38;
  fineValve.add(fvBody, fvStem);
  fineValve.position.set(2.1, 2.6, 0);
  rig.add(fineValve);

  // 7. loading arm — 3-segment articulated tube from the fine-fill valve down/out to the hatch
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.6, 2.6, 0),
    new THREE.Vector3(3.6, 2.9, 0),
    new THREE.Vector3(4.5, 2.1, 0),
    new THREE.Vector3(4.9, 1.4, 0),
  ]);
  const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 24, 0.1, 8, false), metalMat(0x9db3d6));
  arm.castShadow = true;
  rig.add(arm);

  // animated flow overlay along the header -> arm run
  const flowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-5.1, 2.6, 0), new THREE.Vector3(-1.8, 2.6, 0), new THREE.Vector3(0.2, 2.6, 0),
    new THREE.Vector3(2.1, 2.6, 0), new THREE.Vector3(3.6, 2.9, 0), new THREE.Vector3(4.9, 1.4, 0),
  ]);
  const flowTex = makeFlowTexture();
  const flowTube = new THREE.Mesh(
    new THREE.TubeGeometry(flowCurve, 60, 0.06, 8, false),
    new THREE.MeshBasicMaterial({ map: flowTex, transparent: true, opacity: 0.95 })
  );
  rig.add(flowTube);

  // 8. tanker hatch marker (a small ring at the truck's parking anchor, y matches tank top)
  const hatch = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 8, 16), metalMat(0x1c2230));
  hatch.rotation.x = Math.PI / 2;
  hatch.position.set(5.2, 1.35, 0);
  rig.add(hatch);

  // kiosk (QR/PIN) + arm camera
  const kiosk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.7, 0.55), metalMat(0xe4e9f0));
  kiosk.position.set(0.2, 0.85, 2.4);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.62), new THREE.MeshStandardMaterial({ color: 0x0a2233, emissive: 0x22d3ee, emissiveIntensity: 0.6 }));
  screen.position.set(0, 0.2, 0.29);
  kiosk.add(screen);
  rig.add(kiosk);

  const armCamPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 8), metalMat(0x33455e));
  armCamPole.position.set(4.4, 3.6, -1.2);
  const armCamHead = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.4), metalMat(0x1b2534));
  armCamHead.position.set(4.4, 4.6, -1.0);
  rig.add(armCamPole, armCamHead);

  // labels
  const labels = {
    inlet: createLabel(inletValve, new THREE.Vector3(0, 1, 0), "", ""),
    pt: createLabel(pt, new THREE.Vector3(0, 0.9, 0), "", ""),
    emf: createLabel(emf, new THREE.Vector3(0, 0.8, 0), "", ""),
    tt: createLabel(tt, new THREE.Vector3(0, -1, 0), "", ""),
    fine: createLabel(fineValve, new THREE.Vector3(0, 0.9, 0), "", ""),
    dispensed: createLabel(hatch, new THREE.Vector3(0, 1.1, 0), "", ""),
    auth: createLabel(kiosk, new THREE.Vector3(0, 1.2, 0), "", ""),
    wallet: createLabel(kiosk, new THREE.Vector3(0, 1.8, 0), "", ""),
  };

  let flowVisible = true;

  return {
    group: rig,
    parts: { inletValve, ptHead, emf, ttHead, fineValve, flowTex, flowTube, hatch },
    labels,
    moveTo(bayId) {
      const l = bayLayout(bayId);
      rig.position.set(l.manifoldX, 0, l.z);
    },
    setFlowVisible(v) { flowVisible = v; },
    update(bay, state, tNow) {
      if (!bay) return;
      const filling = bay.status === "filling";
      const fault = bay.status === "fault";
      const offline = bay.status === "offline";
      const commsDown = fault || offline;
      const authed = bay.status !== "idle" && !offline;
      const pct = bay.target ? Math.min(100, (bay.dispensed / bay.target) * 100) : 0;
      const fineFill = filling && bay.dispensed > bay.target * 0.85;
      const flow = filling ? bay.flow : 0;
      const pressure = (state.kpis.inletPressure + (bay.id % 5) * 0.06 + jitter(bay.id, 0.08));
      const temp = 26 + jitter(bay.id + 50, 0.7);
      const charge = bay.dispensed * 0.0025;
      const preBalance = balanceSeed(bay.account || "KWT-00000");
      const postBalance = Math.max(0, preBalance - charge);

      const ivColor = commsDown ? VALVE_COLOR.fault : filling ? VALVE_COLOR.open : bay.status === "done" ? VALVE_COLOR.done : VALVE_COLOR.closed;
      ivBody.material.color.setHex(ivColor);
      inletValve.rotation.y = filling ? Math.PI / 2 : 0;
      const fvColor = commsDown ? VALVE_COLOR.fault : fineFill ? VALVE_COLOR.open : filling ? VALVE_COLOR.done : VALVE_COLOR.closed;
      fvBody.material.color.setHex(fvColor);
      fineValve.rotation.y = fineFill ? Math.PI / 2 : 0;

      // animated flow: offset scaled by bay.flow, halved during fine-fill
      const speed = filling ? flow * (fineFill ? 0.012 : 0.024) : 0;
      flowTex.offset.x -= speed * 0.016;
      flowTube.visible = filling && flowVisible;

      labels.inlet.set(kv("INLET", offline ? "NO COMMS" : fault ? "FAULT" : filling ? "OPEN" : "CLOSED"));
      labels.inlet.setTone(commsDown ? "bad" : filling ? "good" : "");
      labels.pt.set(kv("PT", `${pressure.toFixed(2)} bar`));
      labels.emf.set(kv("FLOW", `${flow.toFixed(1)} m&sup3;/h`));
      labels.tt.set(kv("TT", `${temp.toFixed(1)} &deg;C`));
      labels.fine.set(kv("FINE-FILL", offline ? "NO COMMS" : fault ? "FAULT" : fineFill ? `${Math.round(pct)}%` : filling ? "FULL FLOW" : "CLOSED"));
      labels.dispensed.set(
        `${kv("DISPENSED", `${Math.round(bay.dispensed).toLocaleString()} / ${bay.target.toLocaleString()} IG &middot; ${pct.toFixed(0)}%`)}` +
        `<br>${kv("MODE", fault ? "FAULT" : offline ? "OFFLINE" : fineFill ? "AUTO &rarr; FINE-FILL" : filling ? "AUTO" : bay.status.toUpperCase())}`
      );
      labels.auth.set(`${kv("LPR", authed ? `${bay.plate} &#10003;` : "AWAITING")}<br>${kv("QR/PIN", authed ? "VERIFIED &#10003;" : "AWAITING")}`);
      labels.wallet.set(kv("WALLET", `KD ${preBalance.toFixed(3)} &rarr; KD ${postBalance.toFixed(3)}`));
    },
  };
}
