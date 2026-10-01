import '../../styles/hmi.css';
import { useEffect, useRef, useState } from 'react';
import type { ViewProps } from '../../shell/types';
import { useSiap } from '../../sim/store';
import { pad, type Bay } from '../../sim/data';
import { useT, statusLabel, timeAgo } from '../../i18n';
import { useHmi, seedHistory, type BatchRec } from './hmiStore';
import { Mimic } from './Mimic';
import { FlowTrend } from './FlowTrend';

const pad5 = (n: number) => Math.max(0, Math.round(n)).toString().padStart(5, '0');

interface Col extends Omit<BatchRec, 'ok'> { ok?: boolean; isCurrent?: boolean }

function StatusCell({ bay, c }: { bay: Bay; c: Col }) {
  if (c.isCurrent) {
    if (bay.status === 'filling') return <span className="hmi-status-chip hmi-status-run">RUNNING</span>;
    if (bay.status === 'done') return <span className="hmi-status-chip hmi-status-ok">DONE</span>;
    if (bay.status === 'fault') return <span className="hmi-status-chip hmi-status-fault">FAULT</span>;
    if (bay.status === 'offline') return <span className="hmi-status-chip hmi-status-fault">OFFLINE</span>;
    return <span className="hmi-status-chip hmi-status-idle">IDLE</span>;
  }
  return c.ok
    ? <span className="hmi-status-chip hmi-status-ok">OK</span>
    : <span className="hmi-status-chip hmi-status-idle">STOPPED</span>;
}

function BatchTable({ bay }: { bay: Bay }) {
  const stored = useHmi((s) => s.batchHistory[bay.id]);
  const hist = stored ?? seedHistory(bay).rows;
  const current: Col = {
    batchNo: `B-${pad(bay.id)}-CUR`,
    preset: bay.target,
    delivered: bay.dispensed,
    remaining: Math.max(0, bay.target - bay.dispensed),
    flow: bay.status === 'filling' ? bay.flow : 0,
    account: bay.account,
    isCurrent: true,
  };
  const cols: Col[] = [current, ...hist].slice(0, 2);
  const rowsDef: [string, (c: Col) => React.ReactNode][] = [
    ['Preset (IG)', (c) => c.preset.toLocaleString()],
    ['Delivered (IG)', (c) => Math.round(c.delivered).toLocaleString()],
    ['Remaining (IG)', (c) => Math.round(c.remaining).toLocaleString()],
    ['Flow (m³/h)', (c) => c.flow.toFixed(1)],
    ['Batch No.', (c) => c.batchNo],
    ['Account', (c) => c.account],
    ['Status', (c) => <StatusCell bay={bay} c={c} />],
  ];
  return (
    <table className="hmi-batch-table" id="hmi-batch-table">
      <thead><tr><th></th>{cols.map((_, i) => <th key={i}>{i === 0 ? 'CURRENT' : 'BATCH ' + i}</th>)}</tr></thead>
      <tbody>
        {rowsDef.map(([label, fn]) => (
          <tr key={label}>
            <td className="hmi-row-label">{label}</td>
            {cols.map((c, i) => <td key={i} className={!c.isCurrent && c.ok ? 'hmi-cell-ok' : ''}>{fn(c)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const LAMPS: { key: string; label: string; cls: (b: Bay, ctx: { filling: boolean; fault: boolean; offline: boolean; nearFull: boolean }) => string }[] = [
  { key: 'earth', label: 'Earth clamp', cls: (b, c) => (c.fault ? 'hmi-lamp-red' : c.filling || b.status === 'done' ? 'hmi-lamp-green' : 'hmi-lamp-off') },
  { key: 'hatch', label: 'Hatch open', cls: (_, c) => (c.filling ? 'hmi-lamp-amber' : 'hmi-lamp-off') },
  { key: 'overfill', label: 'Overfill probe', cls: (_, c) => (c.nearFull ? 'hmi-lamp-red' : 'hmi-lamp-off') },
  { key: 'estop', label: 'Emergency stop', cls: (_, c) => (c.fault ? 'hmi-lamp-red' : 'hmi-lamp-green') },
  { key: 'rtu', label: 'RTU comms', cls: (_, c) => (c.offline ? 'hmi-lamp-red' : 'hmi-lamp-green') },
];

export default function View({ active }: ViewProps) {
  const { t } = useT();
  const bays = useSiap((s) => s.bays);
  const selectedBayId = useSiap((s) => s.selectedBayId);
  const alarms = useSiap((s) => s.alarms);
  const inletPressure = useSiap((s) => s.kpis.inletPressure);
  const tickCount = useSiap((s) => s.tickCount);
  const selectBay = useSiap((s) => s.selectBay);
  const startFill = useSiap((s) => s.startFill);
  const stopFill = useSiap((s) => s.stopFill);

  const classic = useHmi((s) => s.classic);
  const setClassic = useHmi((s) => s.setClassic);
  const setMode = useHmi((s) => s.setMode);
  const bay = bays.find((b) => b.id === selectedBayId);
  const mode = useHmi((s) => s.mode[selectedBayId]) ?? 'AUTO';
  const storedDisp = useHmi((s) => s.displayDispensed[selectedBayId]);

  const [now, setNow] = useState(() => Date.now());

  /* Reset the trend when the view is shown / the bay changes (legacy buildChart + bay:select). */
  useEffect(() => {
    if (!active) return;
    const b = useSiap.getState().bays.find((x) => x.id === selectedBayId);
    if (b) useHmi.getState().resetFlow(b.id, b.status === 'filling' ? b.flow : 0);
    setNow(Date.now());
  }, [active, selectedBayId]);

  /* Per-tick flow sample — only while this view is active. */
  const lastTick = useRef(tickCount);
  useEffect(() => {
    if (!active) { lastTick.current = tickCount; return; }
    if (lastTick.current === tickCount) return;
    lastTick.current = tickCount;
    const b = useSiap.getState().bays.find((x) => x.id === useSiap.getState().selectedBayId);
    if (b) useHmi.getState().pushFlowSample(b.id, b.status === 'filling' ? b.flow : 0);
    setNow(Date.now());
  }, [active, tickCount]);

  /* 250 ms smoothing of the mimic fill level — stops completely when the view is hidden. */
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const st = useSiap.getState();
      const b = st.bays.find((x) => x.id === st.selectedBayId);
      if (b) {
        const hmi = useHmi.getState();
        const cur = hmi.displayDispensed[b.id] ?? b.dispensed;
        const next = cur + (b.dispensed - cur) * 0.35;
        const val = Math.abs(next - b.dispensed) < 0.5 ? b.dispensed : next;
        if (val !== hmi.displayDispensed[b.id]) hmi.setDisplay(b.id, val);
      }
      setNow(Date.now());
    }, 250);
    return () => clearInterval(id);
  }, [active]);

  if (!bay) return null;

  const disp = storedDisp ?? bay.dispensed;
  const filling = bay.status === 'filling';
  const fault = bay.status === 'fault';
  const offline = bay.status === 'offline';
  const nearFull = filling && bay.dispensed > bay.target * 0.97;

  const needle = `Bay ${pad(bay.id)}`;
  const alarm = alarms.find((a) => a.text.includes(needle));

  const d = new Date(now);
  const datetime = `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  return (
    <div className={'hmi-root' + (classic ? ' hmi-classic' : '')} id="hmi-root">

      <div className="hmi-topstrip">
        <div className="hmi-topstrip-left">
          <label className="hmi-field-label">{t('Bay')}</label>
          <select className="select" id="hmi-bay-select" value={selectedBayId} onChange={(e) => selectBay(parseInt(e.target.value, 10))}>
            {bays.map((b) => <option key={b.id} value={b.id}>{`Bay ${pad(b.id)} — ${statusLabel(b.status)}`}</option>)}
          </select>
          <span className="hmi-tag" id="hmi-tag">LFS-BAY-{pad(bay.id)}</span>
        </div>
        <div className="hmi-topstrip-mid">
          <div className="hmi-mode-lamp" id="hmi-mode-lamp">
            <span className={'hmi-lamp-dot ' + (mode === 'AUTO' ? 'hmi-lamp-green' : 'hmi-lamp-amber')} id="hmi-mode-dot"></span>
            <span id="hmi-mode-text">{mode}</span>
          </div>
          <div className={'hmi-alarm-line' + (alarm ? ' hmi-alarm-active' : '')} id="hmi-alarm-line">
            {alarm ? `⚠ ${alarm.text} · ${timeAgo(alarm.ts)}` : t('No active alarms for this bay')}
          </div>
        </div>
        <div className="hmi-topstrip-right">
          <div className="hmi-classic-toggle">
            <span>{t('PCS 7 classic')}</span>
            <label className="hmi-switch">
              <input type="checkbox" id="hmi-classic-check" checked={classic} onChange={(e) => setClassic(e.target.checked)} />
              <span className="hmi-switch-track"><span className="hmi-switch-thumb"></span></span>
            </label>
          </div>
          <div className="hmi-datetime" id="hmi-datetime">{datetime}</div>
        </div>
      </div>

      <div className="hmi-body">
        <div className="hmi-col-left">
          <div className="hmi-panel">
            <div className="hmi-panel-title">{t('Batch Record')}</div>
            <div className="hmi-table-wrap">
              <BatchTable bay={bay} />
            </div>
          </div>
          <div className="hmi-panel hmi-totaliser-panel">
            <div className="hmi-totaliser-block">
              <div className="hmi-totaliser-label">DELIVERED (IG)</div>
              <div className="hmi-totaliser-digits" id="hmi-delivered-digits">{pad5(disp)}</div>
            </div>
            <div className="hmi-totaliser-block hmi-totaliser-block-sm">
              <div className="hmi-totaliser-label">REMAINING (IG)</div>
              <div className="hmi-totaliser-digits hmi-totaliser-digits-sm" id="hmi-remaining-digits">{pad5(Math.max(0, bay.target - disp))}</div>
            </div>
          </div>
        </div>

        <div className="hmi-col-mid">
          <div className="hmi-panel hmi-mimic-panel">
            <div id="hmi-mimic-svg">
              <Mimic bay={bay} disp={disp} inletPressure={inletPressure} now={now} />
            </div>
          </div>
        </div>

        <div className="hmi-col-right">
          <div className="hmi-panel hmi-controls-panel">
            <div className="hmi-panel-title">{t('Commands')}</div>
            <div className="hmi-btn-grid">
              <button className={'hmi-btn' + (mode === 'MANUAL' ? ' hmi-btn-active' : '')} id="hmi-btn-manual" onClick={() => setMode(bay.id, 'MANUAL')}>MANUAL</button>
              <button className={'hmi-btn' + (mode === 'AUTO' ? ' hmi-btn-active' : '')} id="hmi-btn-auto" onClick={() => setMode(bay.id, 'AUTO')}>AUTO</button>
              <button className="hmi-btn hmi-btn-green" id="hmi-btn-start" disabled={filling}
                onClick={() => { if (bay.status !== 'filling') startFill(bay.id); }}>START</button>
              <button className="hmi-btn hmi-btn-red" id="hmi-btn-stop" disabled={!filling}
                onClick={() => stopFill(bay.id, 'idle')}>STOP</button>
              <button className="hmi-btn" id="hmi-btn-reset" disabled={!(fault || offline)}
                onClick={() => stopFill(bay.id, 'idle')}>RESET</button>
            </div>
          </div>
          <div className="hmi-panel hmi-lamps-panel">
            <div className="hmi-panel-title">{t('Interlocks')}</div>
            {LAMPS.map((l) => (
              <div className="hmi-lamp-row" data-lamp={l.key} key={l.key}>
                <span className={'hmi-lamp-dot ' + l.cls(bay, { filling, fault, offline, nearFull })}></span>{t(l.label)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hmi-panel hmi-trend-panel">
        <div className="hmi-panel-title">{t('Flow Trend')} <span className="hint">FT-14 · {t('last ~2 min')}</span></div>
        <FlowTrend bayId={bay.id} active={active} />
      </div>

      <div className="util-text hmi-util-text">{t('Commands are S!aP BPM authorisations relayed to the RTU — the platform is read-only towards the control loop.')}</div>
    </div>
  );
}
