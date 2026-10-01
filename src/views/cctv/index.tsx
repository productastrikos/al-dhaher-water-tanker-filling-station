import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ViewProps } from '../../shell/types';
import { useT, timeAgo } from '../../i18n';
import { useSiap } from '../../sim/store';

const CAMERAS = [
  { id: 'CAM-01', label: 'Gate Entry', meta: 'LPR · UHD', img: '/assets/images/cctv/gate-entry.jpg', tag: 'PLATE OK' },
  { id: 'CAM-07', label: 'Bay 14 Arm', meta: '60fps', img: '/assets/images/cctv/bay14-arm.jpg', tag: 'FILL ARM OK' },
  { id: 'CAM-12', label: 'Apron West', meta: 'LPR · UHD', img: '/assets/images/cctv/apron-west.jpg', tag: 'AREA CLEAR' },
  { id: 'CAM-19', label: 'Bay 22 PTZ', meta: '60fps', img: '/assets/images/cctv/bay22-ptz.jpg', tag: 'TANKER ID' },
  { id: 'CAM-24', label: 'Gate Exit', meta: 'LPR · UHD', img: '/assets/images/cctv/gate-exit.jpg', tag: 'PLATE OK' },
  { id: 'CAM-31', label: 'Overview', meta: '60fps', img: '/assets/images/cctv/overview.jpg', tag: '42 BAYS OK' },
];

interface Det { show: boolean; left: number; top: number; w: number; h: number; }
interface Frames { time: string; dets: Det[]; }

const clock = () => new Date().toLocaleTimeString('en-GB', { hour12: false });

/** Port of legacy drawCameraFrames(): refresh the on-screen timestamp and occasionally (re)position a
 *  detection box (decorative overlay only — not telemetry). Positions are kept while hidden so the box
 *  glides (CSS transition) to the new spot when it reappears. */
function drawFrames(prev?: Frames): Frames {
  return {
    time: clock(),
    dets: CAMERAS.map((_, i) => {
      if (Math.random() > 0.35) {
        return { show: true, left: 12 + Math.random() * 55, top: 30 + Math.random() * 40, w: 22 + Math.random() * 14, h: 16 + Math.random() * 12 };
      }
      return { ...(prev?.dets[i] ?? { left: 12, top: 30, w: 22, h: 16 }), show: false };
    }),
  };
}

const sevClass = { crit: 'crit', warn: 'warn', info: 'info', amber2: 'warn' } as const;

export default function Cctv({ active }: ViewProps) {
  const { t } = useT();
  const lprLog = useSiap((s) => s.lprLog);
  const videoEvents = useSiap((s) => s.videoEvents);
  const tickCount = useSiap((s) => s.tickCount);
  const [frames, setFrames] = useState<Frames>(() => drawFrames());
  const [lightbox, setLightbox] = useState<{ i: number; time: string } | null>(null);

  // redraw camera frames each sim tick, only while this screen is visible
  useEffect(() => {
    if (active) setFrames((prev) => drawFrames(prev));
  }, [tickCount, active]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const open = (i: number) => setLightbox({ i, time: clock() });
  const cam = lightbox ? CAMERAS[lightbox.i] : null;

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"><span>{t('IP Video Surveillance — Al Dhaher → Salmiya Control Centre')}</span> <span className="hint">{t('42 cameras · UHD · 60-day NVR · triplex live/playback/record')}</span></div>
        <div className="cctv-grid" id="cctv-grid">
          {CAMERAS.map((c, i) => {
            const d = frames.dets[i];
            return (
              <div
                key={c.id}
                className="cam-tile"
                data-cam={i}
                role="button"
                tabIndex={0}
                aria-label={`${c.id} ${c.label}`}
                style={{ backgroundImage: `url('${c.img}')` }}
                onClick={() => open(i)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } }}
              >
                <div className="cam-crosshair"><span className="h" /><span className="v" /></div>
                <div className="cam-time">{frames.time}</div>
                <div className="cam-rec"><span className="dot" /> REC</div>
                <div className="cam-overlay-box" style={{ display: d.show ? 'block' : 'none', left: `${d.left}%`, top: `${d.top}%`, width: `${d.w}%`, height: `${d.h}%` }} />
                <div className="cam-overlay-tag" style={{ display: d.show ? 'block' : 'none', left: `${d.left}%`, top: `${d.top}%` }}>{c.tag}</div>
                <div className="cam-label"><span>{c.id} {c.label}</span><span>{c.meta}</span></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">{t('License Plate Recognition — Gate Log')}</div>
          <table className="data-table">
            <thead><tr><th>{t('Time')}</th><th>{t('Plate')}</th><th>{t('Tanker Owner')}</th><th>{t('Gate')}</th><th>{t('Status')}</th></tr></thead>
            <tbody id="lpr-log">
              {lprLog.slice(0, 8).map((r, i) => (
                <tr key={`${r.time}-${r.plate}-${i}`}>
                  <td className="mono">{r.time}</td>
                  <td className="mono">{r.plate}</td>
                  <td>{r.owner}</td>
                  <td>{t(r.gate)}</td>
                  <td>
                    {r.status.startsWith('Matched') ? <span className="tag green">{r.status}</span>
                      : r.status.startsWith('Filled') ? <span className="tag blue">{r.status}</span>
                      : <span className="tag amber">{r.status}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-title">{t('S!aP ML & AI — Video Analytics Events')}</div>
          <div id="video-events">
            {videoEvents.slice(0, 6).map((e, i) => (
              <div className="alarm-item" key={`${e.ts}-${e.text}-${i}`}>
                <div className={`alarm-dot ${sevClass[e.sev]}`} />
                <div>
                  <div className="alarm-text">{e.text}</div>
                  <div className="alarm-time">{e.tag} · {timeAgo(e.ts)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {cam && lightbox && createPortal(
        <div className="cam-lightbox" id="cam-lightbox" onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}>
          <div className="cam-lightbox-inner">
            <div className="cam-lightbox-frame" style={{ backgroundImage: `url('${cam.img}')` }}>
              <div className="cam-crosshair"><span className="h" /><span className="v" /></div>
              <div className="cam-time">{lightbox.time}</div>
              <div className="cam-rec"><span className="dot" /> REC</div>
              <div className="cam-label"><span>{cam.id} {cam.label}</span><span>{cam.meta}</span></div>
            </div>
            <div className="cam-lightbox-bar">
              <div className="util-text">{t('Live feed · Al Dhaher → Salmiya Control Centre · 60-day NVR retention')}</div>
              <div className="cam-lightbox-close" role="button" tabIndex={0} onClick={() => setLightbox(null)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setLightbox(null); }}>{t('Close (Esc)')}</div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
