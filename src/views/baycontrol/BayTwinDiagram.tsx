import { pad } from '../../sim/data';
import { useSiap } from '../../sim/store';
import { twinJitter } from './helpers';

/** End-to-end instrumented flow for one bay (legacy renderBayTwinDiagram). It has no screen of its own any
 *  more — the 3D Digital Twin's P&ID tab consumes it: `import BayTwinDiagram from '../baycontrol/BayTwinDiagram'`
 *  and render `<BayTwinDiagram bayId={n} />` (re-renders on every sim tick via the store). */
export default function BayTwinDiagram({ bayId }: { bayId: number }) {
  const bay = useSiap((s) => s.bays.find((b) => b.id === bayId));
  const inletFlow = useSiap((s) => s.kpis.inletFlow);
  const inletPressure = useSiap((s) => s.kpis.inletPressure);
  if (!bay) return null;

  const filling = bay.status === 'filling';
  const fault = bay.status === 'fault';
  const offline = bay.status === 'offline';
  const commsDown = fault || offline;
  const authed = bay.status !== 'idle' && !offline;
  const pct = Math.min(100, (bay.dispensed / bay.target) * 100);
  const fineFill = filling && bay.dispensed > bay.target * 0.85;
  const flow = filling ? bay.flow : 0;
  const pressure = (inletPressure + (bay.id % 5) * 0.06 + twinJitter(bay.id, 0.08)).toFixed(2);
  const temp = (26 + twinJitter(bay.id + 50, 0.7)).toFixed(1);
  const charge = (bay.dispensed * 0.0025).toFixed(3);

  const pipeClass = filling ? 'pipe-flow' : 'pipe-idle';
  const inletValveClass = commsDown ? 'valve-fault' : filling ? 'valve-open' : bay.status === 'done' ? 'valve-done' : 'valve-idle';
  const fineValveClass = commsDown ? 'valve-fault' : fineFill ? 'valve-open' : filling ? 'valve-done' : 'valve-idle';
  const inletValveLabel = offline ? 'NO COMMS' : fault ? 'FAULT' : filling ? 'OPEN' : 'CLOSED';
  const fineValveLabel = offline ? 'NO COMMS' : fault ? 'FAULT' : fineFill ? `${Math.round(pct)}%` : filling ? 'FULL FLOW' : 'CLOSED';
  const computerStatus = offline ? 'Offline · no comms' : fault ? 'Fault · locked' : filling ? (fineFill ? 'Auto · fine-fill top-up' : 'Auto · full flow') : bay.status === 'done' ? 'Cycle complete' : 'Standby';

  const tankY = 118, tankH = 92, tankX = 830, tankW = 190;
  const levelH = (pct / 100) * (tankH - 4);
  const levelY = tankY + 2 + (tankH - 4 - levelH);
  // LPR/QR badges live in the top band, centered over the tank — clear of the Flow Computer box and the tank below.
  const badgeW = 130, badgeX = tankX + tankW / 2 - badgeW / 2, badgeCx = tankX + tankW / 2;
  const okFill = authed ? 'var(--green)' : 'var(--text-faint)';

  return (
    <svg className="scada-svg" viewBox="0 0 1180 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="twinWaterGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="0.9" />
        </linearGradient>
        <clipPath id="twinTankClip"><rect x={tankX + 2} y={tankY + 2} width={tankW - 4} height={tankH - 4} rx="8" /></clipPath>
      </defs>

      {/* Control center + flow computer (mirrors S!aP Connect / RTU already on the arch diagram) */}
      <rect className="box box-chip" x="430" y="14" width="160" height="54" rx="6" />
      <text className="title" x="510" y="35" textAnchor="middle">CONTROL CENTER</text>
      <text x="510" y="51" textAnchor="middle" style={{ fontSize: '9px' }}>S!aP Connect · Bay {pad(bay.id)} RTU</text>

      <rect className="box box-chip" x="605" y="14" width="150" height="54" rx="6" />
      <text className="title" x="680" y="35" textAnchor="middle">FLOW COMPUTER</text>
      <text x="680" y="51" textAnchor="middle" style={{ fontSize: '9px' }}>{computerStatus}</text>

      <line x1="440" y1="68" x2="255" y2="150" stroke="var(--border-strong)" strokeWidth="1.3" />
      <line x1="480" y1="68" x2="400" y2="150" stroke="var(--border-strong)" strokeWidth="1.3" />
      <line x1="650" y1="68" x2="560" y2="150" stroke="var(--border-strong)" strokeWidth="1.3" />
      <line x1="700" y1="68" x2="655" y2="150" stroke="var(--border-strong)" strokeWidth="1.3" />

      {/* Station inlet (source) */}
      <rect className="box box-accent" x="10" y="130" width="150" height="82" rx="8" />
      <text className="title" x="24" y="152">STATION INLET</text>
      <text x="24" y="168" style={{ fontSize: '9.5px' }}>WNCC header · DN800</text>
      <text x="24" y="196" className="mono" style={{ fill: 'var(--accent)', fontSize: '13px', fontWeight: 700 }}>{inletFlow} m³/h</text>

      <line className={pipeClass} x1="160" y1="170" x2="238" y2="170" />

      {/* Inlet valve */}
      <circle className={inletValveClass} cx="255" cy="170" r="16" strokeWidth="2" />
      <text x="255" y="207" textAnchor="middle" style={{ fontSize: '9px' }}>INLET VALVE</text>
      <text x="255" y="220" textAnchor="middle" className="mono" style={{ fontSize: '9.5px', fontWeight: 700 }}>{inletValveLabel}</text>

      <line className={pipeClass} x1="271" y1="170" x2="330" y2="170" />

      {/* Custody flowmeter */}
      <rect className="box" x="330" y="150" width="90" height="42" rx="6" />
      <text className="title" x="375" y="167" textAnchor="middle" style={{ fontSize: '9.5px' }}>FLOWMETER</text>
      <text x="375" y="183" textAnchor="middle" className="mono" style={{ fontSize: '11px', fontWeight: 700, fill: 'var(--accent)' }}>{flow.toFixed(1)} m³/h</text>
      <text x="375" y="207" textAnchor="middle" style={{ fontSize: '8.5px', fill: 'var(--text-faint)' }}>custody ±0.18%</text>

      <line className={pipeClass} x1="420" y1="170" x2="620" y2="170" />

      {/* Pressure transmitter (branch up) */}
      <line x1="480" y1="170" x2="480" y2="142" stroke="var(--border-strong)" strokeWidth="1.5" />
      <circle cx="480" cy="126" r="15" fill="var(--bg-alt)" stroke="var(--border-strong)" strokeWidth="1.5" />
      <text x="480" y="130" textAnchor="middle" className="mono" style={{ fontSize: '8.5px', fontWeight: 700, fill: 'var(--text)' }}>PT</text>
      <text x="480" y="102" textAnchor="middle" className="mono" style={{ fontSize: '10px', fontWeight: 700, fill: 'var(--accent)' }}>{pressure} bar</text>
      <text x="480" y="207" textAnchor="middle" style={{ fontSize: '8.5px', fill: 'var(--text-faint)' }}>inlet pressure</text>

      {/* Temperature transmitter (branch down) */}
      <line x1="560" y1="170" x2="560" y2="198" stroke="var(--border-strong)" strokeWidth="1.5" />
      <circle cx="560" cy="214" r="15" fill="var(--bg-alt)" stroke="var(--border-strong)" strokeWidth="1.5" />
      <text x="560" y="218" textAnchor="middle" className="mono" style={{ fontSize: '8.5px', fontWeight: 700, fill: 'var(--text)' }}>TT</text>
      <text x="560" y="242" textAnchor="middle" className="mono" style={{ fontSize: '10px', fontWeight: 700, fill: '#fbbf24' }}>{temp}°C</text>
      <text x="560" y="258" textAnchor="middle" style={{ fontSize: '8.5px', fill: 'var(--text-faint)' }}>water temp</text>

      {/* Fine-fill valve */}
      <circle className={fineValveClass} cx="640" cy="170" r="16" strokeWidth="2" />
      <text x="640" y="207" textAnchor="middle" style={{ fontSize: '9px' }}>FINE-FILL VALVE</text>
      <text x="640" y="220" textAnchor="middle" className="mono" style={{ fontSize: '9.5px', fontWeight: 700 }}>{fineValveLabel}</text>

      <line className={pipeClass} x1="656" y1="170" x2="760" y2="170" />

      {/* LPR + auth badges — sit in the clear top band above the tank */}
      <rect className="box-chip" x={badgeX} y="20" width={badgeW} height="24" rx="5" style={{ fill: 'var(--bg-alt)', stroke: 'var(--border)' }} />
      <text x={badgeCx} y="36" textAnchor="middle" style={{ fontSize: '9px' }}>
        <tspan style={{ fill: 'var(--text-dim)' }}>LPR{' '}</tspan>
        <tspan style={{ fill: okFill, fontWeight: 700 }}>{authed ? 'PLATE OK' : 'AWAITING'}</tspan>
      </text>
      <rect x={badgeX} y="48" width={badgeW} height="24" rx="5" style={{ fill: 'var(--bg-alt)', stroke: 'var(--border)' }} />
      <text x={badgeCx} y="64" textAnchor="middle" style={{ fontSize: '9px' }}>
        <tspan style={{ fill: 'var(--text-dim)' }}>QR/PIN{' '}</tspan>
        <tspan style={{ fill: okFill, fontWeight: 700 }}>{authed ? 'VERIFIED' : 'AWAITING'}</tspan>
      </text>
      <line x1={badgeCx} y1="44" x2={badgeCx} y2="48" stroke="var(--border-strong)" strokeWidth="1.3" />
      <line x1={badgeCx} y1="72" x2={badgeCx} y2={tankY} stroke="var(--border-strong)" strokeWidth="1.3" />

      {/* Tanker receiving vessel */}
      <rect x={tankX} y={tankY} width={tankW} height={tankH} rx="10" fill="var(--panel-alt)" stroke="var(--border-strong)" strokeWidth="1.5" />
      <rect x={tankX + 2} y={levelY} width={tankW - 4} height={levelH} fill="url(#twinWaterGrad)" clipPath="url(#twinTankClip)" style={{ transition: 'y .5s ease, height .5s ease' }} />
      <text x={tankX + tankW / 2} y={tankY + tankH / 2 - 2} textAnchor="middle" className="mono" style={{ fontSize: '20px', fontWeight: 800, fill: '#fff' }}>{pct.toFixed(0)}%</text>
      <text x={tankX + tankW / 2} y={tankY + tankH / 2 + 17} textAnchor="middle" style={{ fontSize: '9.5px', fill: 'rgba(255,255,255,0.9)' }}>TANKER · BAY {pad(bay.id)}</text>
      <text x={tankX + tankW / 2} y={tankY - 8} textAnchor="middle" style={{ fontSize: '9px', fill: 'var(--text-faint)' }}>{bay.plate} · {bay.owner}</text>

      {/* Debit + receipt */}
      <line x1={tankX + tankW} y1={tankY + tankH / 2} x2="1020" y2={tankY + tankH / 2} stroke="var(--border-strong)" strokeWidth="1.5" strokeDasharray="3 4" />
      <rect className="box box-green" x="1020" y={tankY + tankH / 2 - 36} width="150" height="72" rx="8" />
      <text className="title" x="1095" y={tankY + tankH / 2 - 14} textAnchor="middle" style={{ fill: 'var(--green)' }}>DEBIT &amp; RECEIPT</text>
      <text x="1095" y={tankY + tankH / 2 + 6} textAnchor="middle" className="mono" style={{ fontSize: '14px', fontWeight: 800, fill: 'var(--green)' }}>KD {charge}</text>
      <text x="1095" y={tankY + tankH / 2 + 24} textAnchor="middle" style={{ fontSize: '8.5px', fill: 'var(--text-faint)' }}>SMS + email on completion</text>
    </svg>
  );
}
