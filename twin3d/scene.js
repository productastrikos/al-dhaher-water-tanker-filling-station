/* twin3d/scene.js — renderer, camera, lights, RAF loop. Kept deliberately simple: no per-view
 * camera-preset tweening, no follow-truck logic — those belonged to the old toolbar-heavy build.
 * This is the minimal rebuild: a scene you can orbit/zoom, lit and tone-mapped so PBR materials
 * read as photographed rather than flat-shaded. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const SKY_HEX = 0x9fb8d6; // neutral overcast sky-blue — used until/if an HDRI is added back
const FOG_HEX = 0xb9c7d8;

/** Creates the Three.js scene graph + renderer. Throws if WebGL is unavailable so the caller
 *  can show a fallback message. */
export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.shadowMap.enabled = true;
  // This vendored three.js build dropped PCFSoftShadowMap support (silently falls back to
  // PCFShadowMap with a console warning) -- VSMShadowMap is the supported soft-shadow option.
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Kept close to 1: the previous build combined a high-intensity warm sun with a high exposure,
  // which is what blew the whole scene out toward yellow/orange. Neutral light colour + modest
  // exposure is what keeps materials reading as their actual (grey/white/steel) colours.
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_HEX);
  scene.fog = new THREE.Fog(FOG_HEX, 180, 440);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(70, 62, 96);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.03; // never dip under the ground
  controls.minDistance = 6;
  controls.maxDistance = 260;
  controls.target.set(0, 2, 0);

  // Neutral-white sky/ground hemisphere (no warm tint) + a moderate, neutral-white sun. This
  // combination is what actually fixes "everything looks yellow" — the old scene used a warm
  // (0xfff3d9) sun at 2.3-3.1 intensity, which saturates every surface toward amber once tone
  // mapping compresses the highlights.
  scene.add(new THREE.HemisphereLight(0xdce8f7, 0x4a4d46, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(120, 160, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  const d = 130; // tight enough to cover the station without wasting shadow-map texels
  sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
  sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 2;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35);
  fill.position.set(-90, 60, -60);
  scene.add(fill);

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
  }

  function dispose() {
    stop();
    controls.dispose();
    renderer.dispose();
  }

  return {
    renderer, scene, camera, controls, clock,
    start, stop, onTick, resize, dispose,
    get running() { return running; },
  };
}
