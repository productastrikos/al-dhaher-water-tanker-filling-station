import { pad } from '../../sim/data';
import type { Bay } from '../../sim/data';

/** Bay faceplate: inlet pipe -> control valve -> tanker tank with live fill level (legacy renderBayFaceplate). */
export default function BayFaceplate({ bay }: { bay: Bay }) {
  const pct = Math.min(100, (bay.dispensed / bay.target) * 100);
  const tankY = 24, tankH = 84;
  const levelH = (pct / 100) * tankH;
  const levelY = tankY + (tankH - levelH);
  const pipeClass = bay.status === 'filling' ? 'pipe-flow' : 'pipe-idle';
  const valveClass = bay.status === 'filling' ? 'valve-open' : bay.status === 'fault' ? 'valve-fault' : bay.status === 'done' ? 'valve-done' : 'valve-idle';
  const valveLabel = bay.status === 'filling' ? `${Math.min(100, Math.round((bay.flow / 60) * 100))}%` : bay.status === 'fault' ? 'FAULT' : 'CLOSED';

  return (
    <svg className="scada-svg" viewBox="0 0 600 130" xmlns="http://www.w3.org/2000/svg" style={{ maxWidth: 460 }}>
      <defs>
        <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="0.9" />
        </linearGradient>
        <clipPath id="tankClip"><rect x="258" y={tankY + 2} width="296" height={tankH - 4} rx="8" /></clipPath>
      </defs>

      <text x="10" y="16" style={{ fontSize: '9.5px', fill: 'var(--text-faint)' }}>INLET HEADER</text>
      <line className={pipeClass} x1="10" y1="65" x2="140" y2="65" />

      <circle className={valveClass} cx="152" cy="65" r="15" strokeWidth="2" />
      <line x1="152" y1="50" x2="152" y2="38" stroke="var(--text-dim)" strokeWidth="2" />
      <rect x="140" y="30" width="24" height="8" rx="2" fill="var(--panel-alt)" stroke="var(--border-strong)" />
      <text x="152" y="98" textAnchor="middle" style={{ fontSize: '9px', fill: 'var(--text-dim)' }}>VALVE</text>
      <text x="152" y="111" textAnchor="middle" className="mono" style={{ fontSize: '10px', fontWeight: 700, fill: 'var(--text)' }}>{valveLabel}</text>

      <line className={pipeClass} x1="167" y1="65" x2="256" y2="65" />

      <rect x="256" y={tankY} width="300" height={tankH} rx="10" fill="var(--panel-alt)" stroke="var(--border-strong)" strokeWidth="1.5" />
      <rect x="258" y={levelY} width="296" height={levelH} fill="url(#waterGrad)" clipPath="url(#tankClip)" style={{ transition: 'y .5s ease, height .5s ease' }} />
      <text x="406" y={tankY + tankH / 2 - 4} textAnchor="middle" className="mono" style={{ fontSize: '20px', fontWeight: 800, fill: '#fff' }}>{pct.toFixed(0)}%</text>
      <text x="406" y={tankY + tankH / 2 + 15} textAnchor="middle" style={{ fontSize: '9.5px', fill: 'rgba(255,255,255,0.9)' }}>TANKER — BAY {pad(bay.id)}</text>
      <text x="406" y={tankY - 6} textAnchor="middle" style={{ fontSize: '9.5px', fill: 'var(--text-faint)' }}>Custody-transfer EMF meter · ±0.18%</text>
    </svg>
  );
}
