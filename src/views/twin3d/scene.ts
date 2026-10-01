/* twin3d/scene.ts — renderer, camera, lights, RAF loop (ported from legacy/twin3d/scene.js). Deliberately simple: a
 * scene you can orbit/zoom, lit and tone-mapped so PBR materials read as photographed rather than flat-shaded. */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const SKY_HEX = 0x9fb8d6; // neutral overcast sky-blue (offline: no HDRI needed)
const FOG_HEX = 0xb9c7d8;

export interface TwinScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  start(): void;
  stop(): void;
  onTick(fn: (dt: number) => void): () => void;
  resize(w: number, h: number): void;
  dispose(): void;
  readonly running: boolean;
}

/** Creates the Three.js scene graph + renderer. Throws if WebGL is unavailable so the caller can show a fallback. */
export function createScene(canvas: HTMLCanvasElement): TwinScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap; // soft shadows (PCFSoft is deprecated in current three)
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Kept close to 1: neutral light colour + modest exposure keeps materials reading as their actual (grey/white/steel) colours.
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

  // Neutral-white sky/ground hemisphere + a moderate neutral-white sun (a warm high-intensity sun saturated everything to amber).
  scene.add(new THREE.HemisphereLight(0xdce8f7, 0x4a4d46, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(120, 160, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  const d = 130;
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
  let rafId: number | null = null;
  let last = 0;
  const tickFns: ((dt: number) => void)[] = [];

  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const fn of tickFns) {
      try { fn(dt); } catch (e) { console.error('[twin3d] tick handler error', e); }
    }
    controls.update();
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(frame);
  }

  return {
    renderer, scene, camera, controls,
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
    },
    onTick(fn) { tickFns.push(fn); return () => { const i = tickFns.indexOf(fn); if (i >= 0) tickFns.splice(i, 1); }; },
    resize(w, h) {
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    },
    dispose() {
      this.stop();
      controls.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
    get running() { return running; },
  };
}
