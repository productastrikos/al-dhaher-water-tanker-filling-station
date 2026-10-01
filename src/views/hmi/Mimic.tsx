import { memo } from 'react';
import { pad, type Bay } from '../../sim/data';

interface Props { bay: Bay; disp: number; inletPressure: number; now: number; }

/** PCS 7 style loading-bay mimic (SVG) — JSX port of legacy renderMimic(). Pure function of its props. */
function MimicImpl({ bay, disp, inletPressure, now }: Props) {
  const pct = Math.max(0, Math.min(100, (disp / bay.target) * 100));
  const filling = bay.status === 'filling';
  const fault = bay.status === 'fault';
  const offline = bay.status === 'offline';
  const commsDown = fault || offline;
  const fineFill = filling && disp > bay.target * 0.85;

  const pressure = (inletPressure + (bay.id % 5) * 0.06 + Math.sin(now / 4000 + bay.id) * 0.08).toFixed(2);
  const temp = (26 + Math.sin(now / 4000 + bay.id + 50) * 0.7).toFixed(1);
  const flow = filling ? bay.flow : 0;

  const pipeClass = filling ? 'pipe-flow' : 'pipe-idle';
  const pumpRunning = filling && !commsDown;
  const inletClass = commsDown ? 'valve-fault' : filling ? 'valve-open' : bay.status === 'done' ? 'valve-done' : 'valve-idle';
  const fineClass = commsDown ? 'valve-fault' : fineFill ? 'valve-open' : filling ? 'valve-done' : 'valve-idle';
  const inletLabel = offline ? 'NO COMMS' : fault ? 'FAULT' : filling ? 'OPEN' : 'CLOSED';
  const fineLabel = offline ? 'NO COMMS' : fault ? 'FAULT' : fineFill ? `${Math.round(pct)}%` : filling ? 'FULL' : 'CLOSED';

  // truck tank geometry (side elevation)
  const tankX = 190, tankY = 235, tankW = 560, tankH = 92, tankRx = tankH / 2;
  const levelH = (pct / 100) * (tankH - 6);
  const levelY = tankY + (tankH - 3) - levelH;
  const id2 = pad(bay.id);

  return (
    <svg className="scada-svg hmi-svg" viewBox="0 0 1000 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hmiWaterGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="0.92" />
        </linearGradient>
        <clipPath id="hmiTankClip"><rect x={tankX + 3} y={tankY + 3} width={tankW - 6} height={tankH - 6} rx={tankRx - 3} /></clipPath>
      </defs>

      {/* ===== upstream: storage, pump, inlet valve, EMF meter, PT, TT, fine-fill valve ===== */}
      <rect className="box box-accent" x="10" y="20" width="58" height="72" rx="6" />
      <text className="title" x="39" y="16" textAnchor="middle" style={{ fontSize: '9.5px' }}>STORAGE</text>
      <rect x="18" y="30" width="42" height="54" rx="4" fill="#0891b2" opacity="0.55" />
      <text x="39" y="100" textAnchor="middle" style={{ fontSize: '8.5px', fill: 'var(--text-faint)' }}>TK-01</text>

      <line className={pipeClass} x1="68" y1="56" x2="112" y2="56" />

      {/* Pump P-01 : ISA circle-with-triangle */}
      <circle cx="128" cy="56" r="17" fill="var(--bg-alt)" stroke={pumpRunning ? 'var(--green)' : 'var(--border-strong)'} strokeWidth="2" />
      <path d="M 121 47 L 121 65 L 137 56 Z" fill={pumpRunning ? 'var(--green)' : '#33445c'} />
      <text x="128" y="86" textAnchor="middle" style={{ fontSize: '9px' }}>P-01</text>
      <text x="128" y="98" textAnchor="middle" className="mono" style={{ fontSize: '8.5px', fontWeight: 700, fill: pumpRunning ? 'var(--green)' : 'var(--text-faint)' }}>{pumpRunning ? 'RUNNING' : 'STOPPED'}</text>

      <line className={pipeClass} x1="145" y1="56" x2="186" y2="56" />

      {/* Inlet valve XV-14A */}
      <circle className={inletClass} cx="202" cy="56" r="15" strokeWidth="2" />
      <text x="202" y="90" textAnchor="middle" style={{ fontSize: '8.5px' }}>XV-{id2}A</text>
      <text x="202" y="101" textAnchor="middle" className="mono" style={{ fontSize: '8.5px', fontWeight: 700 }}>{inletLabel}</text>

      <line className={pipeClass} x1="217" y1="56" x2="266" y2="56" />

      {/* EMF custody meter FT-14 */}
      <rect className="box" x="266" y="38" width="82" height="36" rx="6" />
      <text className="title" x="307" y="53" textAnchor="middle" style={{ fontSize: '9px' }}>FT-{id2}</text>
      <text x="307" y="68" textAnchor="middle" className="mono" style={{ fontSize: '10.5px', fontWeight: 700, fill: 'var(--accent)' }}>{flow.toFixed(1)} m³/h</text>

      <line className={pipeClass} x1="348" y1="56" x2="560" y2="56" />

      {/* PT-14 branch up */}
      <line x1="400" y1="56" x2="400" y2="34" stroke="var(--border-strong)" strokeWidth="1.4" />
      <circle cx="400" cy="20" r="13" fill="var(--bg-alt)" stroke="var(--border-strong)" strokeWidth="1.4" />
      <text x="400" y="24" textAnchor="middle" className="mono" style={{ fontSize: '8px', fontWeight: 700 }}>PT</text>
      <text x="446" y="24" textAnchor="start" className="mono" style={{ fontSize: '9.5px', fontWeight: 700, fill: 'var(--accent)' }}>{pressure} bar</text>

      {/* TT-14 branch down */}
      <line x1="470" y1="56" x2="470" y2="78" stroke="var(--border-strong)" strokeWidth="1.4" />
      <circle cx="470" cy="92" r="13" fill="var(--bg-alt)" stroke="var(--border-strong)" strokeWidth="1.4" />
      <text x="470" y="96" textAnchor="middle" className="mono" style={{ fontSize: '8px', fontWeight: 700 }}>TT</text>
      <text x="470" y="118" textAnchor="middle" className="mono" style={{ fontSize: '9.5px', fontWeight: 700, fill: '#fbbf24' }}>{temp}°C</text>

      {/* Fine-fill valve XV-14B */}
      <circle className={fineClass} cx="576" cy="56" r="15" strokeWidth="2" />
      <text x="576" y="90" textAnchor="middle" style={{ fontSize: '8.5px' }}>XV-{id2}B</text>
      <text x="576" y="101" textAnchor="middle" className="mono" style={{ fontSize: '8.5px', fontWeight: 700 }}>{fineLabel}</text>

      {/* header down to gantry */}
      <line className={pipeClass} x1="591" y1="56" x2="650" y2="56" />
      <line className={pipeClass} x1="650" y1="56" x2="650" y2="120" />

      {/* Loading arm gantry (yellow/black hazard) */}
      <rect x="600" y="118" width="100" height="10" fill="#f4b13d" stroke="#7a5a12" strokeWidth="1" />
      <rect x="606" y="112" width="6" height="16" fill="#1c1c1c" />
      <rect x="688" y="112" width="6" height="16" fill="#1c1c1c" />
      <line className={pipeClass} x1="650" y1="128" x2="650" y2="160" />
      <line className={pipeClass} x1="650" y1="160" x2="530" y2="205" />

      {/* ===== apron + truck side elevation ===== */}
      <line x1="20" y1="368" x2="980" y2="368" stroke="var(--border-strong)" strokeWidth="2" />
      <text x="20" y="386" style={{ fontSize: '8.5px', fill: 'var(--text-faint)' }}>APRON — BAY {id2}</text>

      {/* chassis */}
      <line x1="90" y1="330" x2="920" y2="330" stroke="#33445c" strokeWidth="6" strokeLinecap="round" />

      {/* cab */}
      <rect x="90" y="255" width="90" height="76" rx="6" fill="var(--panel-alt)" stroke="var(--border-strong)" strokeWidth="1.5" />
      <path d="M 96 255 L 100 224 L 168 224 L 172 255 Z" fill="var(--panel-alt)" stroke="var(--border-strong)" strokeWidth="1.5" />
      <rect x="108" y="230" width="52" height="22" rx="3" fill="#6fb8d6" opacity="0.5" />

      {/* tank (cylindrical side elevation) */}
      <rect x={tankX} y={tankY} width={tankW} height={tankH} rx={tankRx} fill="var(--panel-alt)" stroke="var(--border-strong)" strokeWidth="1.6" />
      <rect x={tankX + 3} y={levelY} width={tankW - 6} height={levelH} fill="url(#hmiWaterGrad)" clipPath="url(#hmiTankClip)" style={{ transition: 'y .35s ease, height .35s ease' }} />
      <text x={tankX + tankW / 2} y={tankY + tankH / 2 - 6} textAnchor="middle" className="mono" style={{ fontSize: '22px', fontWeight: 800, fill: '#fff' }}>{pct.toFixed(0)}%</text>
      <text x={tankX + tankW / 2} y={tankY + tankH / 2 + 16} textAnchor="middle" style={{ fontSize: '10px', fill: 'rgba(255,255,255,0.92)' }}>{bay.plate} · {bay.owner}</text>

      {/* rear ladder */}
      <line x1="905" y1="240" x2="905" y2="325" stroke="var(--border-strong)" strokeWidth="2" />
      <line x1="915" y1="240" x2="915" y2="325" stroke="var(--border-strong)" strokeWidth="2" />
      <line x1="905" y1="255" x2="915" y2="255" stroke="var(--border-strong)" strokeWidth="2" />
      <line x1="905" y1="275" x2="915" y2="275" stroke="var(--border-strong)" strokeWidth="2" />
      <line x1="905" y1="295" x2="915" y2="295" stroke="var(--border-strong)" strokeWidth="2" />
      <line x1="905" y1="315" x2="915" y2="315" stroke="var(--border-strong)" strokeWidth="2" />

      {/* wheels: 1 steer + 3 rear axles (6 wheels) */}
      <circle cx="130" cy="335" r="16" fill="#1c1c1c" stroke="#000" strokeWidth="1" />
      <circle cx="130" cy="335" r="6" fill="#555" />
      {[700, 760, 820].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="335" r="16" fill="#1c1c1c" stroke="#000" strokeWidth="1" />
          <circle cx={cx} cy="335" r="6" fill="#555" />
        </g>
      ))}
    </svg>
  );
}

export const Mimic = memo(MimicImpl);
