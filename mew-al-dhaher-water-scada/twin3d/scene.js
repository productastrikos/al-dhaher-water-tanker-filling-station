/* twin3d/scene.js — renderer, camera, lights, RAF loop.
 * Owned by WP-A. Keeps rendering cheap: capped pixel ratio, one shadow map, no post-processing. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

const BG_HEX = 0x0a1424;

/** Creates the Three.js scene graph + both renderers. Throws if WebGL is unavailable so the
 *  caller (twin3d.js) can fall back to the 2.5D render tab. */
export function createScene(canvas, labelsEl) {
  // preserveDrawingBuffer: needed so renderer.domElement.toDataURL() (used for evidence
  // screenshots / the window.__twin3d.screenshot() helper) doesn't read back a cleared buffer.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const labelRenderer = new CSS2DRenderer({ element: labelsEl });
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0";
  labelRenderer.domElement.style.left = "0";
  labelRenderer.domElement.style.pointerEvents = "none";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG_HEX);
  scene.fog = new THREE.Fog(BG_HEX, 160, 420);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(70, 62, 96);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.03; // never go under the ground
  controls.minDistance = 6;
  controls.maxDistance = 260;
  controls.target.set(0, 2, 0);

  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x2a3f2a, 1.35));
  const sun = new THREE.DirectionalLight(0xfff3d9, 2.3);
  sun.position.set(130, 170, 70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const d = 150;
  sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
  sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);

  new HDRLoader().load(
    "assets/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr",
    (tex) => { tex.mapping = THREE.EquirectangularReflectionMapping; scene.environment = tex; },
    undefined,
    (err) => console.warn("[twin3d] HDRI environment failed to load (non-fatal):", err && err.message)
  );

  let running = false;
  let rafId = null;
  const clock = new THREE.Clock();
  const tickFns = [];

  function frame() {
    if (!running) return;
    const dt = Math.min(0.1, clock.getDelta());
    for (const fn of tickFns) {
      try { fn(dt); } catch (e) { console.error("[twin3d] tick handler error", e); }
    }
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    clock.start();
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }
  function onTick(fn) { tickFns.push(fn); return () => { const i = tickFns.indexOf(fn); if (i >= 0) tickFns.splice(i, 1); }; }

  function resize(w, h) {
    if (w <= 0 || h <= 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    labelRenderer.setSize(w, h);
  }

  function dispose() {
    stop();
    controls.dispose();
    renderer.dispose();
  }

  return {
    renderer, labelRenderer, scene, camera, controls, clock,
    start, stop, onTick, resize, dispose,
    get running() { return running; },
  };
}
