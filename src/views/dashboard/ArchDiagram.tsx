import { useSiap } from '../../sim/store';

const MODULES = ['S!aP Connect', 'S!aP Datalake', 'S!aP ML & AI', 'S!aP BPM', 'S!aP Viz', 'S!a Agentic'];

/** S!aP system architecture & data-flow diagram (legacy renderArchDiagram + updateArchLiveBadges).
 *  Link A/B dots and the DR status line follow useSiap kpis (the topbar WAN toggle drives them). */
export default function ArchDiagram() {
  const wanLinkA = useSiap((s) => s.kpis.wanLinkA);
  const wanLinkB = useSiap((s) => s.kpis.wanLinkB);
  const drSync = useSiap((s) => s.kpis.drSync);
  const drLagSec = useSiap((s) => s.kpis.drLagSec);
  const synced = drSync === 'synced';

  return (
    <svg className="scada-svg" viewBox="0 0 1180 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrowData" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0L10,5L0,10z" fill="#60a5fa" />
        </marker>
        <marker id="arrowRepl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0L10,5L0,10z" fill="#34d399" />
        </marker>
      </defs>

      {/* Edge box */}
      <rect className="box box-accent" x="16" y="90" width="204" height="110" rx="8" />
      <text className="title" x="30" y="112">AL DHAHER LCC</text>
      <text x="30" y="126">S!aP Connect — Edge</text>
      <text x="30" y="146">• 42 Bay RTUs — Modbus/OPC-UA</text>
      <text x="30" y="162">• CCTV / LPR — RTSP</text>
      <text x="30" y="178">• K-net Gateway — HTTPS</text>
      <text x="30" y="194" style={{ fill: 'var(--text-faint)' }}>Field control &amp; safety unchanged</text>

      {/* Edge -> WAN */}
      <path className="pipe-data" d="M220,135 L282,135" markerEnd="url(#arrowData)" />

      {/* WAN pill */}
      <rect className="box" x="282" y="112" width="150" height="46" rx="23" />
      <text className="title" x="357" y="132" textAnchor="middle">SECURED WAN</text>
      <text x="357" y="146" textAnchor="middle" style={{ fontSize: '9.5px' }}>5G / GPRS / LTE · IPsec</text>
      <circle id="wan-a-dot" className={`link-dot-${wanLinkA}`} cx="322" cy="172" r="4" />
      <text x="332" y="176" style={{ fontSize: '9.5px' }}>Link A</text>
      <circle id="wan-b-dot" className={`link-dot-${wanLinkB}`} cx="382" cy="172" r="4" />
      <text x="392" y="176" style={{ fontSize: '9.5px' }}>Link B</text>

      {/* WAN -> DC */}
      <path className="pipe-data" d="M432,135 L466,135" markerEnd="url(#arrowData)" />

      {/* Salmiya DC box */}
      <rect className="box box-accent" x="466" y="40" width="304" height="180" rx="8" />
      <text className="title" x="480" y="62">S!aP PLATFORM — SALMIYA MAIN DC</text>
      <text x="480" y="76" style={{ fill: 'var(--text-faint)' }}>Astrikos scope · Glass Box</text>

      <g id="arch-modules">
        {MODULES.map((m, i) => {
          const col = i % 3, row = Math.floor(i / 3);
          const x = 480 + col * 100, y = 88 + row * 40;
          return (
            <g key={m}>
              <rect className="box box-chip" x={x} y={y} width="92" height="32" rx="5" />
              <text x={x + 46} y={y + 20} textAnchor="middle" style={{ fontSize: '9px', fontWeight: 600, fill: 'var(--text)', letterSpacing: 0 }}>{m}</text>
            </g>
          );
        })}
      </g>
      <rect className="box box-chip" x="480" y="176" width="272" height="26" rx="6" />
      <text x="616" y="193" textAnchor="middle" style={{ fontSize: '9.5px' }}>S!aP Core — RBAC · SSO/AD · Immutable Audit</text>

      {/* DC -> DR */}
      <text x="788" y="32" textAnchor="middle" style={{ fontSize: '9.5px', fill: 'var(--green)' }}>continuous replication</text>
      <path
        className="pipe-repl" d="M770,105 L806,105" markerEnd="url(#arrowRepl)"
        style={{ fill: 'none', stroke: '#34d399', strokeWidth: 2, strokeDasharray: '3 5', animation: 'flowmove .9s linear infinite' }}
      />

      {/* DR box */}
      <rect className="box box-green" x="806" y="55" width="220" height="100" rx="8" />
      <text className="title" x="820" y="76" style={{ fill: 'var(--green)' }}>DISASTER RECOVERY</text>
      <text x="820" y="90">MEW HQ — South Surra</text>
      <text id="dr-status-text" x="820" y="110" className="mono" style={{ fill: synced ? 'var(--green)' : 'var(--amber)' }}>
        {synced ? 'RPO ≈ 0s · Synced' : `Syncing · lag ${drLagSec}s`}
      </text>
      <text x="820" y="128" style={{ fill: 'var(--text-faint)' }}>Business continuity · Astrikos scope</text>

      {/* DC -> Payment branch */}
      <path className="pipe-data" d="M618,220 L618,240" markerEnd="url(#arrowData)" />
      <rect className="box" x="466" y="248" width="304" height="42" rx="8" />
      <text className="title" x="618" y="266" textAnchor="middle">PAYMENT &amp; CUSTOMER SYSTEMS</text>
      <text x="618" y="282" textAnchor="middle" style={{ fontSize: '9.5px' }}>K-net gateway · MEW web portal · MEW Pay app (EN/AR)</text>
    </svg>
  );
}
