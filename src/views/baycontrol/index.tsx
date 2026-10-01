import type { ViewProps } from '../../shell/types';
import { Icon } from '../../lib/Icon';
import { useSiap } from '../../sim/store';
import { pad } from '../../sim/data';
import { showView } from '../../shell/ui';
import { statusLabel, useT } from '../../i18n';
import BayFaceplate from './BayFaceplate';
import BayTwinDiagram from './BayTwinDiagram';
import { accountBalanceSeed, bayFlowStepIndex } from './helpers';

const FLOW_STEPS = ['Tanker Detected (LPR)', 'Scan QR / Enter PIN', 'Account Validated', 'Filling In Progress', 'Debit & SMS Receipt'];

export default function View(_: ViewProps) {
  const { t, lang } = useT();
  const bays = useSiap((s) => s.bays);
  const selectedBayId = useSiap((s) => s.selectedBayId);
  const selectBay = useSiap((s) => s.selectBay);
  const startFill = useSiap((s) => s.startFill);
  const stopFill = useSiap((s) => s.stopFill);
  useSiap((s) => s.tickCount); // keep the date/time line fresh

  const bay = bays.find((b) => b.id === selectedBayId) ?? bays[0];
  if (!bay) return null;

  const filling = bay.status === 'filling';
  const pct = Math.min(100, (bay.dispensed / bay.target) * 100);
  const valve = filling ? 'Open · modulating' : bay.status === 'done' ? 'Closed · complete' : bay.status === 'fault' ? 'Fault · locked' : 'Closed';
  const remaining = bay.target - bay.dispensed;
  // dispensed/target are Imp.gal, flow is m³/h (1 Imp.gal = 0.004546 m³); the demo clock runs ~60× real time
  const etaMin = bay.flow > 0 ? Math.max(0, (remaining * 0.004546) / bay.flow) : 0;
  const eta = filling ? `${Math.floor(etaMin)}m ${Math.floor((etaMin % 1) * 60)}s` : '—';
  const rate = 0.0025; // KD per unit, arbitrary demo rate
  const chargeNum = bay.dispensed * rate;
  const preBalance = accountBalanceSeed(bay.account);
  const now = new Date();
  const datetime = `${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const activeIdx = bayFlowStepIndex(bay);

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"><span>{t('Select Bay')}</span>
          <select className="select" id="bay-select" value={selectedBayId} onChange={(e) => selectBay(parseInt(e.target.value, 10))}>
            {bays.map((b) => <option key={b.id} value={b.id}>Bay {pad(b.id)} — {statusLabel(b.status, lang)}</option>)}
          </select>
        </div>
        <div className="flow-track" id="flow-track">
          {FLOW_STEPS.map((label, i) => {
            const cls = i < activeIdx ? 'done' : i === activeIdx ? 'active' : '';
            return (
              <div key={label} className={`flow-step ${cls}`}>
                <div className="dot"><div className="flow-line" />{i < activeIdx ? '✓' : i + 1}</div>
                <div className="label">{t(label)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title" id="bc-heading">Bay {pad(bay.id)} — {t('Live Transaction')}</div>
          <div id="bay-faceplate" style={{ marginBottom: 10 }}><BayFaceplate bay={bay} /></div>
          <div className="big-metric" id="bc-volume">{bay.dispensed.toLocaleString()}<span style={{ fontSize: 16, color: 'var(--text-dim)', fontWeight: 600 }}> / <span id="bc-target">{bay.target.toLocaleString()}</span> Imp.gal</span></div>
          <div style={{ margin: '12px 0 6px' }}><div className="progress-outer"><div className="progress-inner" id="bc-progress" style={{ width: `${pct.toFixed(0)}%` }} /></div></div>
          <div className="metric-line"><span className="k">{t('ETA to full')}</span><span className="v" id="bc-eta">{eta}</span></div>
          <div className="metric-line"><span className="k">{t('Instantaneous flow')}</span><span className="v" id="bc-flow">{filling ? bay.flow : 0} m³/h</span></div>
          <div className="metric-line"><span className="k">{t('Control valve position')}</span><span className="v" id="bc-valve">{t(valve)}</span></div>
          <div className="metric-line"><span className="k">{t('Meter accuracy (custody)')}</span><span className="v">±0.18%</span></div>
          <div className="metric-line"><span className="k">{t('Mode')}</span><span className="v">{t('Auto · fine-fill top-up')}</span></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn btn-green" id="btn-start-fill" disabled={filling} onClick={() => startFill(bay.id)}><Icon name="play" /> <span>{t('Authorize fill')}</span></button>
            <button className="btn btn-red" id="btn-stop-fill" disabled={!filling} onClick={() => stopFill(bay.id)}><Icon name="square" /> <span>{t('Release & close')}</span></button>
            <button className="btn" id="btn-view-twin" onClick={() => showView('twin3d')}><Icon name="box" /> <span>{t('View 3D Twin')}</span></button>
          </div>
          <div className="util-text" style={{ marginTop: 10 }}>{t('S!aP BPM authorises the transaction and releases the hold; the bay RTU executes valve control locally — the platform is read-only towards the control loop and continues on last-known balance if the WAN drops.')}</div>
        </div>

        <div className="card">
          <div className="card-title"><span>{t('Transaction & Authorization')}</span> <span className="tag green">{t('AUTHORIZED')}</span></div>
          <div className="metric-line"><span className="k">{t('Tanker owner')}</span><span className="v" id="bc-owner">{bay.owner}</span></div>
          <div className="metric-line"><span className="k">{t('Account #')}</span><span className="v mono" id="bc-account">{bay.account}</span></div>
          <div className="metric-line"><span className="k">{t('Auth method')}</span><span className="v">QR + PIN</span></div>
          <div className="metric-line"><span className="k">{t('License plate')}</span><span className="v mono" id="bc-plate">{bay.plate}</span></div>
          <div className="metric-line"><span className="k">{t('Date / Time')}</span><span className="v" id="bc-datetime">{datetime}</span></div>
          <div className="metric-line"><span className="k">{t('Wallet balance (pre)')}</span><span className="v" id="bc-balance-pre">KD {preBalance.toFixed(3)}</span></div>
          <div className="metric-line"><span className="k">{t('Est. charge')}</span><span className="v" id="bc-charge">KD {chargeNum.toFixed(3)}</span></div>
          <div className="metric-line"><span className="k">{t('Balance on completion')}</span><span className="v" id="bc-balance">KD {Math.max(0, preBalance - chargeNum).toFixed(3)}</span></div>
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--accent-dim)', border: '1px solid rgba(var(--accent-rgb),0.3)', borderRadius: 8, fontSize: 11.5, color: 'var(--accent)' }}>
            <Icon name="sparkle" style={{ width: 12, height: 12, display: 'inline' }} />
            <span>{t('S!a live guidance: Hatch alignment confirmed by arm-camera. Filling nominal — no surge on valve open. Receipt auto-sends to +965 ···6873 & email on completion.')}</span>
          </div>
        </div>
      </div>

      {/* The end-to-end flow SVG has no nav page of its own; the P&ID tab of the 3D Digital Twin consumes it.
          Kept in the DOM (hidden) for parity with legacy #twin-diagram. */}
      <div id="twin-diagram" hidden style={{ display: 'none' }}><BayTwinDiagram bayId={bay.id} /></div>
    </>
  );
}
