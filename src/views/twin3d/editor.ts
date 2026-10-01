/* twin3d/editor.ts — click-to-select-and-move scene editor (ported from legacy/twin3d/editor.js, UI moved to React).
 * Every edit autosaves to localStorage as a per-object override keyed by id, layered on top of layout.ts's shipped
 * defaults (so "reset" = back to the shipped layout). Saved overrides are re-applied on every load via applyOverrides(). */
import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Editable } from './layout';

const LS_KEY = 'twin3d.editor.overrides.v2';
const RAD = Math.PI / 180;

type Vec3 = [number, number, number];
interface Override { position?: Vec3; rotation?: Vec3; scale?: Vec3 }

function loadOverrides(): Record<string, Override> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function saveOverrides(o: Record<string, Override>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch { /* private mode etc — non-fatal */ }
}

/** Applies saved overrides onto the freshly built scene (called once after buildStation, even with the panel closed). */
export function applyOverrides(items: readonly Editable[]) {
  const overrides = loadOverrides();
  for (const { id, object } of items) {
    const o = overrides[id];
    if (!o || !object) continue;
    if (o.position) object.position.set(...o.position);
    if (o.rotation) object.rotation.set(...o.rotation);
    if (o.scale) object.scale.set(...o.scale);
  }
}

export type EditorMode = 'translate' | 'rotate' | 'scale';

export interface EditorFields { p: Vec3; r: Vec3; s: Vec3 }

export interface Editor {
  readonly enabled: boolean;
  readonly items: readonly Editable[];
  readonly selected: Editable | null;
  readonly mode: EditorMode;
  setEnabled(v: boolean): void;
  select(id: string): void;
  deselect(): void;
  setMode(m: EditorMode): void;
  getFields(): EditorFields | null;
  setFields(f: EditorFields): void;
  resetItem(): void;
  resetAll(): void;
  /** subscribe to any state change (selection, mode, transform) */
  subscribe(cb: () => void): () => void;
  dispose(): void;
}

export function createEditor(opts: {
  scene: THREE.Scene; camera: THREE.Camera; renderer: THREE.WebGLRenderer; controls: OrbitControls; items: readonly Editable[];
}): Editor {
  const { scene, camera, renderer, controls } = opts;
  const items = opts.items.filter((it) => it && it.object);
  const overrides = loadOverrides();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  let enabled = false;
  let selected: Editable | null = null;
  let mode: EditorMode = 'translate';

  const gizmo = new TransformControls(camera, renderer.domElement);
  gizmo.setSize(0.85);
  gizmo.enabled = false;
  const helper = gizmo.getHelper();
  helper.visible = false;
  scene.add(helper);

  gizmo.addEventListener('dragging-changed', (e) => { controls.enabled = !(e as unknown as { value: boolean }).value; });
  gizmo.addEventListener('objectChange', () => { persistSelected(); emit(); });

  function persistSelected() {
    if (!selected) return;
    const o = selected.object;
    overrides[selected.id] = {
      position: [o.position.x, o.position.y, o.position.z],
      rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
      scale: [o.scale.x, o.scale.y, o.scale.z],
    };
    saveOverrides(overrides);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function onCanvasClick(e: MouseEvent) {
    if (!enabled || (gizmo as unknown as { dragging: boolean }).dragging) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(items.map((it) => it.object), true);
    if (!hits.length) return;
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj && !items.some((it) => it.object === obj)) obj = obj.parent;
    const item = items.find((it) => it.object === obj);
    if (item) api.select(item.id);
  }
  renderer.domElement.addEventListener('click', onCanvasClick);

  const api: Editor = {
    get enabled() { return enabled; },
    get items() { return items; },
    get selected() { return selected; },
    get mode() { return mode; },
    setEnabled(v) {
      enabled = v;
      if (!v) api.deselect();
      emit();
    },
    select(id) {
      const item = items.find((it) => it.id === id);
      if (!item) return;
      selected = item;
      gizmo.attach(item.object);
      helper.visible = true;
      gizmo.enabled = true;
      emit();
    },
    deselect() {
      selected = null;
      gizmo.detach();
      helper.visible = false;
      gizmo.enabled = false;
      emit();
    },
    setMode(m) { mode = m; gizmo.setMode(m); emit(); },
    getFields() {
      if (!selected) return null;
      const o = selected.object;
      return {
        p: [o.position.x, o.position.y, o.position.z],
        r: [o.rotation.x / RAD, o.rotation.y / RAD, o.rotation.z / RAD],
        s: [o.scale.x, o.scale.y, o.scale.z],
      };
    },
    setFields(f) {
      if (!selected) return;
      const o = selected.object;
      o.position.set(f.p[0] || 0, f.p[1] || 0, f.p[2] || 0);
      o.rotation.set((f.r[0] || 0) * RAD, (f.r[1] || 0) * RAD, (f.r[2] || 0) * RAD);
      o.scale.set(f.s[0] || 1, f.s[1] || 1, f.s[2] || 1);
      persistSelected();
      emit();
    },
    resetItem() {
      if (!selected) return;
      delete overrides[selected.id];
      saveOverrides(overrides);
      // The shipped default only exists in layout.ts's source, so the honest reset is a reload.
      if (confirm(`Reset "${selected.name}" to its shipped position? The page will reload.`)) location.reload();
    },
    resetAll() {
      if (confirm('Reset ALL objects to the shipped layout? This clears every saved edit and reloads the page.')) {
        saveOverrides({});
        location.reload();
      }
    },
    subscribe(cb) { listeners.add(cb); return () => { listeners.delete(cb); }; },
    dispose() {
      renderer.domElement.removeEventListener('click', onCanvasClick);
      gizmo.detach();
      scene.remove(helper);
      gizmo.dispose();
      listeners.clear();
    },
  };
  return api;
}
