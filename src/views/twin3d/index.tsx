/* 3D Digital Twin screen (ported from legacy/twin3d.js). Imperative Three.js scene wrapped in a React component:
 * the render loop only runs while the view is `active`; everything is disposed on unmount. Click a truck or a bay apron
 * for a fixed info panel; "Edit objects" opens the scene editor (positions autosave to localStorage). */
import { useEffect, useReducer, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ViewProps } from '../../shell/types';
import { useT, statusLabel } from '../../i18n';
import { Icon } from '../../lib/Icon';
import { pad } from '../../sim/data';
import { useSiap } from '../../sim/store';
import { showView } from '../../shell/ui';
import { createScene, type TwinScene } from './scene';
import { buildStation, STATUS_COLOR, type StationHandle } from './layout';
import { createTrucks, type Trucks } from './trucks';
import { createLabelLayer, hex, type LabelLayer } from './labels';
import { applyOverrides, createEditor, type Editor, type EditorFields, type EditorMode } from './editor';
import { disposeObject } from './assets';

const DEFAULT_CAM_POS = new THREE.Vector3(150, 115, 175);
const DEFAULT_CAM_TARGET = new THREE.Vector3(10, 3, 0);

function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

interface Rig {
  three: TwinScene; station: StationHandle; trucks: Trucks; labels: LabelLayer; editor: Editor; selBox: THREE.BoxHelper;
  canvas: HTMLCanvasElement; ro: ResizeObserver; offTick: () => void;
}

/** On-screen camera D-pad: pans camera + target along the camera's ground-projected forward/right vectors, plus dolly zoom / reset. */
function nudgeCamera(three: TwinScene, dir: string) {
  const cam = three.camera, ctr = three.controls;
  if (dir === 'home') { cam.position.copy(DEFAULT_CAM_POS); ctr.target.copy(DEFAULT_CAM_TARGET); return; }
  if (dir === 'zoom-in' || dir === 'zoom-out') {
    const offset = new THREE.Vector3().subVectors(cam.position, ctr.target);
    const next = THREE.MathUtils.clamp(offset.length() * (dir === 'zoom-in' ? 0.8 : 1.25), ctr.minDistance, ctr.maxDistance);
    offset.setLength(next);
    cam.position.copy(ctr.target).add(offset);
    return;
  }
  const forward = new THREE.Vector3();
  cam.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1); else forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const step = Math.max(5, cam.position.distanceTo(ctr.target) * 0.18);
  const move = new THREE.Vector3();
  if (dir === 'up') move.copy(forward).multiplyScalar(step);
  else if (dir === 'down') move.copy(forward).multiplyScalar(-step);
  else if (dir === 'left') move.copy(right).multiplyScalar(-step);
  else if (dir === 'right') move.copy(right).multiplyScalar(step);
  cam.position.add(move);
  ctr.target.add(move);
}

const STATUS_TEXT_COLOR: Record<string, string> = {
  idle: 'var(--text-faint)', filling: 'var(--accent)', done: 'var(--green)', fault: 'var(--red)', offline: 'var(--text-faint)',
};

function InfoPanel({ bayId, onClose }: { bayId: number; onClose(): void }) {
  const { t } = useT();
  const bay = useSiap((s) => s.bays.find((b) => b.id === bayId));
  if (!bay) return null;
  let eta = '—';
  if (bay.status === 'filling' && bay.flow > 0) {
    // dispensed/target are Imp.gal, flow is m³/h (1 Imp.gal = 0.004546 m³) — same conversion Bay Control uses.
    const etaMin = (Math.max(0, bay.target - bay.dispensed) * 0.004546) / bay.flow;
    eta = `${Math.floor(etaMin)}m ${Math.floor((etaMin % 1) * 60)}s`;
  }
  return (
    <div className="t3-info-panel" id="t3-info-panel">
      <div className="t3-info-head">
        <div>
          <div className="t3-info-title" id="t3-info-title">{t('Bay')} {pad(bay.id)}</div>
          <div className="t3-info-sub" id="t3-info-sub">{bay.owner || '—'}</div>
        </div>
        <button className="btn btn-sm" id="t3-info-close" title="Close (Esc)" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="t3-info-body">
        <div className="metric-line"><span className="k">{t('Status')}</span><span className="v" id="t3-info-status" style={{ color: STATUS_TEXT_COLOR[bay.status] || 'var(--text)' }}>{statusLabel(bay.status)}</span></div>
        <div className="metric-line"><span className="k">{t('Account #')}</span><span className="v mono">{bay.account || '—'}</span></div>
        <div className="metric-line"><span className="k">{t('License plate')}</span><span className="v mono">{bay.plate || '—'}</span></div>
        <div className="metric-line"><span className="k">{t('Dispensed / Target')}</span><span className="v">{Math.round(bay.dispensed).toLocaleString()} / {Math.round(bay.target).toLocaleString()} IG</span></div>
        <div className="metric-line"><span className="k">{t('Instantaneous flow')}</span><span className="v">{(bay.flow ?? 0).toFixed(1)} m³/h</span></div>
        <div className="metric-line"><span className="k">{t('ETA to full')}</span><span className="v">{eta}</span></div>
      </div>
      <button className="btn btn-sm btn-primary" id="t3-info-baycontrol" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
        onClick={() => { useSiap.getState().selectBay(bayId); showView('baycontrol'); }}>
        <Icon name="gauge" /> {t('Open in Bay Control')}
      </button>
    </div>
  );
}

function EditorPanel({ editor }: { editor: Editor }) {
  const { t } = useT();
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [filter, setFilter] = useState('');
  useEffect(() => editor.subscribe(bump), [editor]);
  const f = editor.getFields();
  const mode = editor.mode;
  const term = filter.trim().toLowerCase();
  const rows = editor.items.filter((it) => !term || it.name.toLowerCase().includes(term));
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const setField = (group: 'p' | 'r' | 's', i: number, v: string) => {
    const cur = editor.getFields();
    if (!cur) return;
    const next: EditorFields = { p: [...cur.p], r: [...cur.r], s: [...cur.s] };
    next[group][i] = parseFloat(v);
    editor.setFields(next);
  };
  const axis = ['X', 'Y', 'Z'];
  const group = mode === 'translate' ? 'p' : mode === 'rotate' ? 'r' : 's';
  const step = mode === 'translate' ? 0.1 : mode === 'rotate' ? 1 : 0.05;
  const modes: { m: EditorMode; icon: string; title: string }[] = [
    { m: 'translate', icon: 'move', title: 'Move (G)' }, { m: 'rotate', icon: 'rotate-cw', title: 'Rotate (R)' }, { m: 'scale', icon: 'scale', title: 'Scale (S)' },
  ];

  return (
    <div className="t3-editor-panel" id="t3-editor-panel">
      <div className="t3-editor-head">
        <span>{t('Scene Editor')}</span>
        <button className="btn btn-sm" id="t3-editor-close" title="Close" aria-label="Close editor" onClick={() => editor.setEnabled(false)}><Icon name="x" /></button>
      </div>
      <div className="t3-editor-search">
        <Icon name="search" />
        <input type="text" id="t3-editor-search-input" placeholder={t('Find an object…')} value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <div className="t3-editor-list" id="t3-editor-list">
        {rows.length
          ? rows.map((it) => <button key={it.id} type="button" className={`t3-editor-row${editor.selected?.id === it.id ? ' active' : ''}`} onClick={() => editor.select(it.id)}>{it.name}</button>)
          : <div className="util-text" style={{ padding: '8px 2px' }}>{t('No match.')}</div>}
      </div>
      {editor.selected && f && (
        <div className="t3-editor-selected" id="t3-editor-selected">
          <div className="t3-editor-selected-name">{editor.selected.name}</div>
          <div className="t3-editor-modes" id="t3-editor-modes">
            {modes.map((x) => <button key={x.m} className={mode === x.m ? 'active' : ''} title={x.title} onClick={() => editor.setMode(x.m)}><Icon name={x.icon} /></button>)}
          </div>
          <div className="t3-editor-fields">
            {axis.map((a, i) => (
              <label key={a}>{a}{mode === 'rotate' ? '°' : ''}
                <input type="number" step={step} value={r2(f[group][i])} onChange={(e) => setField(group, i, e.target.value)} />
              </label>
            ))}
          </div>
          <button className="btn btn-sm" id="t3-editor-reset-item" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => editor.resetItem()}>
            <Icon name="undo-2" /> {t('Reset this item')}
          </button>
        </div>
      )}
      <div className="t3-editor-footer">
        <button className="btn btn-sm" id="t3-editor-reset-all" style={{ width: '100%', justifyContent: 'center' }} onClick={() => editor.resetAll()}>
          <Icon name="rotate-ccw" /> {t('Reset all to shipped layout')}
        </button>
        <div className="util-text" style={{ marginTop: 8 }}>{t('Click an object in the scene, or pick one from the list above. Edits autosave to this browser.')}</div>
      </div>
    </div>
  );
}

export default function Twin3D({ active }: ViewProps) {
  const { t } = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<Rig | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const selectedRef = useRef<number | null>(null);
  const [webglOk] = useState(detectWebGL);
  const [rig, setRig] = useState<Rig | null>(null);
  const [selectedBay, setSelectedBay] = useState<number | null>(null);
  const [labelsOn, setLabelsOn] = useState(true);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const selectBay = (id: number | null) => {
    selectedRef.current = id;
    setSelectedBay(id);
    const r = rigRef.current;
    if (r && id == null) r.selBox.visible = false;
  };

  useEffect(() => {
    if (!webglOk || !wrapRef.current) return;
    const wrap = wrapRef.current;
    let cancelled = false;
    const ctx = { cancelled: () => cancelled };

    // A fresh canvas per mount (a lost WebGL context cannot be reused — matters for React StrictMode remounts).
    const canvas = document.createElement('canvas');
    canvas.id = 't3-canvas';
    wrap.insertBefore(canvas, wrap.firstChild);

    let three: TwinScene | null = null;
    let station: StationHandle | null = null;
    let trucks: Trucks | null = null;
    let labels: LabelLayer | null = null;
    let editor: Editor | null = null;
    let ro: ResizeObserver | null = null;
    let offTick: (() => void) | null = null;
    let selBox: THREE.BoxHelper | null = null;

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    /** Raycast against trucks + station; bay aprons are instanced (bayIdFromInstance), trucks carry userData.bayId. */
    const onCanvasClick = (e: MouseEvent) => {
      if (!three || !station || !editor || editor.enabled) return;
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, three.camera);
      const targets: THREE.Object3D[] = [];
      const trucksGroup = three.scene.getObjectByName('trucks');
      if (trucksGroup) targets.push(trucksGroup);
      targets.push(station.group);
      for (const hit of raycaster.intersectObjects(targets, true)) {
        let c: THREE.Object3D | null = hit.object;
        let visible = true;
        while (c) { if (c.visible === false) { visible = false; break; } c = c.parent; }
        if (!visible) continue;
        const inst = station.bayIdFromInstance(hit.object, hit.instanceId);
        if (inst != null) { selectBay(inst); return; }
        let o: THREE.Object3D | null = hit.object;
        while (o && o.userData.bayId == null) o = o.parent;
        if (o && o.userData.bayId != null) { selectBay(o.userData.bayId as number); return; }
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && selectedRef.current != null) selectBay(null); };

    (async () => {
      try {
        three = createScene(canvas);
        three.camera.position.copy(DEFAULT_CAM_POS);
        three.controls.target.copy(DEFAULT_CAM_TARGET);
        const r0 = wrap.getBoundingClientRect();
        three.resize(r0.width || 800, r0.height || 560);

        station = await buildStation(three.scene, ctx);
        if (cancelled) return;
        applyOverrides(station.editables);
        trucks = await createTrucks(three.scene, ctx);
        if (cancelled) return;
        editor = createEditor({ scene: three.scene, camera: three.camera, renderer: three.renderer, controls: three.controls, items: station.editables });
        labels = createLabelLayer();
        three.scene.add(labels.group);
        selBox = new THREE.BoxHelper(new THREE.Object3D(), 0x22d3ee);
        selBox.visible = false;
        (selBox.material as THREE.LineBasicMaterial).depthTest = false;
        (selBox.material as THREE.LineBasicMaterial).transparent = true;
        selBox.renderOrder = 999;
        three.scene.add(selBox);

        const st = station, tr = trucks, lb = labels, sb = selBox;
        offTick = three.onTick((dt) => {
          const bays = useSiap.getState().bays;
          tr.update(bays, dt);
          st.updateBays(bays);
          st.updateFlow(dt);
          lb.update(bays);
          const sel = selectedRef.current;
          const obj = sel != null ? tr.getTruckObject(sel) : null;
          if (obj) { sb.setFromObject(obj); sb.visible = true; } else sb.visible = false;
        });

        ro = new ResizeObserver(() => { const r = wrap.getBoundingClientRect(); three?.resize(r.width, r.height); });
        ro.observe(wrap);
        canvas.addEventListener('click', onCanvasClick);
        document.addEventListener('keydown', onKey);

        const made: Rig = { three, station, trucks, labels, editor, selBox, canvas, ro, offTick };
        rigRef.current = made;
        setRig(made);
        if (activeRef.current) three.start();

        (window as unknown as Record<string, unknown>).__twin3d = {
          get scene() { return three?.scene; }, get camera() { return three?.camera; }, get renderer() { return three?.renderer; },
          get running() { return three?.running ?? false; }, get editor() { return editor; },
          screenshot: () => three?.renderer.domElement.toDataURL('image/png'),
        };
      } catch (err) {
        console.error('[twin3d] init failed', err);
      }
    })();

    return () => {
      cancelled = true;
      document.removeEventListener('keydown', onKey);
      canvas.removeEventListener('click', onCanvasClick);
      ro?.disconnect();
      offTick?.();
      editor?.dispose();
      if (three) {
        three.stop();
        three.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh || (o as THREE.Sprite).isSprite) disposeObject(o); });
        three.dispose();
      }
      canvas.remove();
      rigRef.current = null;
      setRig(null);
    };
  }, [webglOk]);

  // pause/resume the render loop with the view
  useEffect(() => {
    const r = rigRef.current;
    if (!r) return;
    if (active) r.three.start(); else r.three.stop();
  }, [active, rig]);

  useEffect(() => { if (rig) return rig.editor.subscribe(bump); }, [rig]);

  const editor = rig?.editor ?? null;

  return (
    <div className="t3-wrap">
      <div className="card t3-stage-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="t3-canvas-wrap" id="t3-canvas-wrap" ref={wrapRef}>
          <div className="t3-status-chip" id="t3-status-chip">
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            <strong>Astriverse</strong> {t('station & bay · live from S!aP Connect')}
            <span className="t3-click-hint">· {t('click a truck or bay for live info')}</span>
          </div>
          <button className={`btn btn-sm t3-labels-btn${labelsOn ? ' active' : ''}`} id="t3-labels-toggle"
            onClick={() => { if (rig) { rig.labels.setEnabled(!rig.labels.enabled); setLabelsOn(rig.labels.enabled); } }}>
            <Icon name="circle-dot" /> {t('Status dots')}
          </button>
          <button className={`btn btn-sm t3-editor-btn${editor?.enabled ? ' active' : ''}`} id="t3-editor-toggle"
            onClick={() => { if (editor) { editor.setEnabled(!editor.enabled); if (editor.enabled) selectBay(null); } }}>
            <Icon name="move-3d" /> {t('Edit objects')}
          </button>
          <div className="t3-legend" id="t3-legend">
            {Object.entries(STATUS_COLOR).map(([k, v]) => <span key={k} className="t3-legend-item"><span className="t3-legend-dot" style={{ background: hex(v) }} />{t(k)}</span>)}
          </div>
          {!webglOk && <div className="t3-fallback-note util-text" id="t3-fallback-note" style={{ display: 'flex' }}><Icon name="alert-triangle" /> {t('WebGL unavailable on this device.')}</div>}
          <div className="t3-camnav" id="t3-camnav" title="Move the camera" onClick={(e) => { const b = (e.target as HTMLElement).closest('[data-cam]') as HTMLElement | null; if (b && rig) nudgeCamera(rig.three, b.dataset.cam!); }}>
            <div /><button data-cam="up" title="Move forward"><Icon name="chevron-up" /></button><div />
            <button data-cam="left" title="Move left"><Icon name="chevron-left" /></button>
            <button className="t3-cam-center" data-cam="home" title="Reset view"><Icon name="home" /></button>
            <button data-cam="right" title="Move right"><Icon name="chevron-right" /></button>
            <div /><button data-cam="down" title="Move back"><Icon name="chevron-down" /></button><div />
          </div>
          <div className="t3-camzoom" id="t3-camzoom" title="Zoom the camera" onClick={(e) => { const b = (e.target as HTMLElement).closest('[data-cam]') as HTMLElement | null; if (b && rig) nudgeCamera(rig.three, b.dataset.cam!); }}>
            <button data-cam="zoom-in" title="Zoom in"><Icon name="plus" /></button>
            <button data-cam="zoom-out" title="Zoom out"><Icon name="minus" /></button>
          </div>
          {selectedBay != null && <InfoPanel bayId={selectedBay} onClose={() => selectBay(null)} />}
          {editor?.enabled && <EditorPanel editor={editor} />}
        </div>
      </div>
    </div>
  );
}
