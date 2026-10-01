import type { ViewProps } from '../../shell/types';
import { useT, statusLabel } from '../../i18n';
import { Icon } from '../../lib/Icon';
import { useSiap } from '../../sim/store';
import { O2C_BAY, O2C_FILL_INDEX, O2C_STEPS, useErp } from '../../erp/store';
import { timeStr } from '../../erp/data';
import { Modal, Tag } from './ui';

function Receipt() {
  const { t } = useT();
  const close = useErp((s) => s.closeOverlay);
  const o = useErp((s) => s.scenario.objects);
  const customers = useErp((s) => s.customers);
  const bay = useSiap((s) => s.bays.find((b) => b.id === O2C_BAY));
  const cust = customers.find((c) => c.id === o.customerId) ?? customers[0];
  const dispensed = o.dispensed || (bay ? bay.dispensed : 5000);
  const amount = o.amountKD != null ? o.amountKD : +(dispensed * 0.0025).toFixed(3);
  return (
    <Modal title="Receipt — Bay 14" footer={<button className="btn btn-primary" id="erp-rc-ok" onClick={close}>{t('Close')}</button>}>
      <div className="erp-receipt-grid">
        <div className="erp-sms-phone">
          <div className="erp-sms-carrier">SMS &middot; Zain KW &middot; {t('now')}</div>
          <div className="erp-sms-bubble">MEW S!aP: Fill complete at Bay 14. {dispensed.toLocaleString()} IG dispensed, KD {amount.toFixed(3)} debited from {o.account || cust.account}. Meter FT-14. Ref {o.knetRef || '—'}.</div>
        </div>
        <div className="erp-email-preview">
          <div className="erp-email-row"><span className="k">{t('From')}</span><span>billing@mew.gov.kw</span></div>
          <div className="erp-email-row"><span className="k">{t('To')}</span><span>{cust.email}</span></div>
          <div className="erp-email-row"><span className="k">{t('Subject')}</span><span>Al Dhaher LFS — Fill Receipt · Bay 14</span></div>
          <div className="erp-email-body">
            <b>{cust.name}</b><br />
            {t('Account')}: {o.account || cust.account}<br />
            {t('Bay')}: 14 &middot; {t('Meter')}: FT-14<br />
            {t('Volume')}: <b>{dispensed.toLocaleString()} IG</b><br />
            {t('Amount')}: <b>KD {amount.toFixed(3)}</b><br />
            {t('K-net ref')}: {o.knetRef || '—'}<br />
            {t('Invoice')}: {o.invoiceNo || '—'}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function O2C({ active }: ViewProps) {
  void active;
  const { t } = useT();
  const sc = useErp((s) => s.scenario);
  const overlay = useErp((s) => s.overlay);
  const purchaseOrders = useErp((s) => s.purchaseOrders);
  const credentials = useErp((s) => s.credentials);
  const { o2cRun, o2cPause, o2cStep, o2cReset, resetDemo } = useErp.getState();
  const bay = useSiap((s) => s.bays.find((b) => b.id === O2C_BAY));

  const o = sc.objects;
  const po = o.poId ? purchaseOrders.find((p) => p.id === o.poId) : undefined;
  const card = o.cardId ? credentials.find((c) => c.id === o.cardId) : undefined;
  const dispensed = bay ? bay.dispensed : 0;
  const target = bay ? bay.target : 5000;
  const pct = Math.min(100, Math.round((dispensed / target) * 100));

  return (
    <>
      <div className="card">
        <div className="card-title">{t('Order-to-Cash Tracker')} <span className="hint">{t('PO raised → Settlement to MEW bank · 15 steps, fully live')}</span></div>
        <div className="erp-o2c-controls">
          <button className="btn btn-primary btn-sm" id="erp-o2c-run" disabled={sc.running} onClick={o2cRun}><Icon name="play" /> {t('Run')}</button>
          <button className="btn btn-sm" id="erp-o2c-pause" disabled={!sc.running} onClick={o2cPause}><Icon name="pause" /> {t('Pause')}</button>
          <button className="btn btn-sm" id="erp-o2c-step" onClick={o2cStep}><Icon name="step-forward" /> {t('Step')}</button>
          <button className="btn btn-sm" id="erp-o2c-reset" onClick={o2cReset}><Icon name="rotate-ccw" /> {t('Reset')}</button>
          <div className="spacer" />
          <div className="erp-o2c-status" id="erp-o2c-status">{t(sc.status)}</div>
        </div>

        <div className="erp-o2c-track" id="erp-o2c-track">
          {O2C_STEPS.map((s, i) => {
            let cls = '';
            if (i < sc.index) cls = 'done';
            else if (i === sc.index) cls = (sc.waitingFill && i === O2C_FILL_INDEX) ? 'active' : 'done';
            const ts = sc.stepTs[i];
            return (
              <div key={s.key} className={`erp-o2c-step ${cls}`}>
                <div className="erp-o2c-line" />
                <div className="erp-o2c-dot">{cls === 'done' ? <Icon name="check" /> : i + 1}</div>
                <div className="erp-o2c-label">{t(s.label)}</div>
                <div className="erp-o2c-time">{ts ? timeStr(ts) : ''}</div>
              </div>
            );
          })}
        </div>

        <div id="erp-o2c-waiting">
          {sc.waitingFill && (
            <>
              <div className="erp-o2c-waiting"><span className="erp-spin" /> {t('Filling Bay 14')} — {dispensed.toLocaleString()} / {target.toLocaleString()} IG ({pct}%)</div>
              <div className="erp-progress-mini"><div style={{ width: `${pct}%` }} /></div>
            </>
          )}
        </div>

        <div className="erp-o2c-detail-grid" id="erp-o2c-detail">
          <div className="erp-summary-box">
            <div className="erp-section-title">{t('Order')}</div>
            <div className="metric-line"><span className="k">{t('PO')}</span><span className="v">{po ? po.id : '—'}</span></div>
            <div className="metric-line"><span className="k">{t('Customer')}</span><span className="v">{o.customerName || '—'}</span></div>
            <div className="metric-line"><span className="k">{t('Status')}</span><span className="v">{po ? <Tag status={po.status} /> : '—'}</span></div>
            <div className="metric-line"><span className="k">{t('Invoice / K-net')}</span><span className="v">{o.invoiceNo || '—'} / {o.knetRef || '—'}</span></div>
          </div>
          <div className="erp-summary-box">
            <div className="erp-section-title">{t('Fleet & Credential')}</div>
            <div className="metric-line"><span className="k">{t('Truck')}</span><span className="v">{o.truckId || '—'} ({o.plate || '—'})</span></div>
            <div className="metric-line"><span className="k">{t('Driver')}</span><span className="v">{o.driverId || '—'}</span></div>
            <div className="metric-line"><span className="k">{t('Card')}</span><span className="v">{card ? <Tag status={card.status} /> : '—'}</span></div>
          </div>
          <div className="erp-summary-box">
            <div className="erp-section-title">{t('Bay & Settlement')}</div>
            <div className="metric-line"><span className="k">{t('Bay 14')}</span><span className="v">{bay ? statusLabel(bay.status) : '—'}</span></div>
            <div className="metric-line"><span className="k">{t('Dispensed')}</span><span className="v">{bay ? bay.dispensed.toLocaleString() : 0} / {bay ? bay.target.toLocaleString() : 5000} IG</span></div>
            <div className="metric-line"><span className="k">{t('GL / Settlement')}</span><span className="v">{t(sc.index >= O2C_STEPS.length - 1 ? 'Posted' : 'Pending')}</span></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">{t('Scenario activity log')}</div>
        <div id="erp-o2c-objects">
          {sc.log.length ? (
            <table className="data-table">
              <thead><tr><th>{t('Time')}</th><th>{t('Step')}</th><th>{t('Detail')}</th></tr></thead>
              <tbody>
                {sc.log.map((l) => (
                  <tr key={`${l.i}-${l.ts}`}><td className="mono">{timeStr(l.ts)}</td><td>{t(O2C_STEPS[l.i].label)}</td><td>{l.text}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <div className="erp-empty">{t('No activity yet — press Run.')}</div>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="util-text">
          {t('This tracker drives the rest of S!aP live — Gate LPR log, Bay 14 control & fill simulation, billing ledger & wallet, the alarms KPI and the ERP sync log all update as it runs.')}
          <button className="btn btn-sm" id="erp-o2c-reset-data" style={{ marginLeft: 10 }} onClick={resetDemo}><Icon name="database-backup" /> {t('Reset demo data')}</button>
        </div>
      </div>

      {overlay?.kind === 'receipt' && <Receipt />}
    </>
  );
}

