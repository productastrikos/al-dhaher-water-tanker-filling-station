/* twin3d/labels.ts — at-a-glance bay status markers (ported from legacy/twin3d/labels.js).
 *
 * One small colour-coded, camera-facing dot (THREE.Sprite) per bay. The legacy build deliberately replaced floating
 * CSS2D text chips with these dots plus a screen-fixed click-to-info panel (the chips visibly drifted across the screen
 * as the camera orbited); a dot carries no text so it can safely stay world-anchored. The "which bay is it" detail
 * lives in the info panel (index.tsx). */
import * as THREE from 'three';
import type { Bay } from '../../sim/data';
import { bayLayout, BAY_COUNT, STATUS_COLOR } from './layout';

const MARKER_Y = 3.75; // just above the loading-arm connection point / truck cab height
const MARKER_SIZE = 1.15;

export function hex(n: number): string { return `#${n.toString(16).padStart(6, '0')}`; }

/** A soft radial-gradient dot baked once into a small canvas texture, shared by every marker sprite. */
function makeDotTexture(): THREE.CanvasTexture {
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface LabelLayer {
  group: THREE.Group;
  update(bays: readonly Bay[]): void;
  setEnabled(v: boolean): void;
  readonly enabled: boolean;
}

/** One sprite per bay (all 42), positioned once; only .material.color / scale change on a bay update. */
export function createLabelLayer(): LabelLayer {
  const group = new THREE.Group();
  group.name = 'statusMarkers';
  const texture = makeDotTexture();
  const markers = new Map<number, THREE.Sprite>();

  for (let id = 1; id <= BAY_COUNT; id++) {
    const l = bayLayout(id);
    const mat = new THREE.SpriteMaterial({ map: texture, color: STATUS_COLOR.idle, transparent: true, depthWrite: false, sizeAttenuation: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(MARKER_SIZE, MARKER_SIZE, 1);
    sprite.position.set(l.instrumentPos.x, MARKER_Y, l.z);
    group.add(sprite);
    markers.set(id, sprite);
  }

  let enabled = true;
  return {
    group,
    update(bays) {
      bays.forEach((bay) => {
        const sprite = markers.get(bay.id);
        if (!sprite) return;
        sprite.material.color.setHex(STATUS_COLOR[bay.status] ?? STATUS_COLOR.idle);
        // Faults pop a little bigger so they don't get lost among 42 idle/filling dots.
        const s = bay.status === 'fault' ? MARKER_SIZE * 1.35 : MARKER_SIZE;
        sprite.scale.set(s, s, 1);
      });
    },
    setEnabled(v) { enabled = v; group.visible = v; },
    get enabled() { return enabled; },
  };
}
