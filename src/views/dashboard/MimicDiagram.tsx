import { useSiap } from '../../sim/store';

const MANIFOLD_COUNT = 6;
const BAYS_PER_MANIFOLD = 7;
const XS = [230, 370, 510, 650, 790, 930];
const HEADER_Y = 70;

/** Station process mimic (P&ID) — inlet header -> 6 manifolds x 7 bays (legacy renderMimicDiagram). */
export default function MimicDiagram() {
  const bays = useSiap((s) => s.bays);
  const inletFlow = useSiap((s) => s.kpis.inletFlow);

  const manifolds = Array.from({ length: MANIFOLD_COUNT }, (_, idx) => {
    const start = idx * BAYS_PER_MANIFOLD + 1;
    const end = start + BAYS_PER_MANIFOLD - 1;
    const group = bays.filter((b) => b.id >= start && b.id <= end);
    const filling = group.filter((b) => b.status === 'filling').length;
    const fault = group.filter((b) => b.status === 'fault').length;
    const done = group.filter((b) => b.status === 'done').length;
    let cls = 'valve-idle';
    if (fault > 0) cls = 'valve-fault';
    else if (filling > 0) cls = 'valve-open';
    else if (done === group.length) cls = 'valve-done';
    return { idx, start, end, filling, fault, cls };
  });

  return (
    <svg className="scada-svg" viewBox="0 0 1180 200" xmlns="http://www.w3.org/2000/svg">
      <rect className="box box-accent" x="10" y="46" width="160" height="48" rx="8" />
      <text className="title" x="22" y="66">WNCC INLET</text>
      <text x="22" y="80" style={{ fontSize: '9.5px' }}>Shuwaikh · DN800</text>
      <text id="mimic-inlet-flow" className="mono" x="22" y="106" style={{ fill: 'var(--accent)', fontSize: '12px', fontWeight: 700 }}>{inletFlow} m³/h</text>

      <path id="mimic-header-pipe" className="pipe-flow" d={`M170,${HEADER_Y} L990,${HEADER_Y}`} />
      {manifolds.map(({ idx, start, end, filling, fault, cls }) => {
        const x = XS[idx];
        return (
          <g key={idx}>
            <line className="pipe" x1={x} y1={HEADER_Y} x2={x} y2="118" />
            <circle className={cls} cx={x} cy="128" r="11" strokeWidth="2" id={`manifold-valve-${idx}`} />
            <rect className="box" x={x - 68} y="146" width="136" height="42" rx="6" />
            <text className="title" x={x} y="163" textAnchor="middle">MANIFOLD {String.fromCharCode(65 + idx)}</text>
            <text x={x} y="178" textAnchor="middle" id={`manifold-sub-${idx}`} style={{ fontSize: '9.5px' }}>
              Bays {start}-{end} · {filling} filling{fault ? ` · ${fault} fault` : ''}
            </text>
          </g>
        );
      })}

      <text x="1000" y={HEADER_Y - 6} style={{ fontSize: '9px', fill: 'var(--text-faint)' }}>S!aP Connect —</text>
      <text x="1000" y={HEADER_Y + 8} style={{ fontSize: '9px', fill: 'var(--text-faint)' }}>read-only tap</text>
    </svg>
  );
}
