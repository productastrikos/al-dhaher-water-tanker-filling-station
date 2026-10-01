import { useMemo, useState } from 'react';
import type { ViewProps } from '../../shell/types';
import { useT } from '../../i18n';
import { Icon } from '../../lib/Icon';
import { useErp } from '../../erp/store';
import { dateStr, fmtIG, fmtKD } from '../../erp/data';
import { Modal, Tag } from './ui';

const STEP_LABELS = ['Customer', 'Quantity & Tariff', 'Approval', 'Invoice & Payment'];

function PoWizard() {
  const { t } = useT();
  const customers = useErp((s) => s.customers);
  const tariffs = useErp((s) => s.tariffs);
  const purchaseOrders = useErp((s) => s.purchaseOrders);
  const { closeOverlay, createPo, payPo } = useErp.getState();

  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState(customers[0].id);
  const [qty, setQty] = useState('5000');
  const [tariffId, setTariffId] = useState('TRF-STD');
  const [comment, setComment] = useState('');
  const [poId, setPoId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const customer = customers.find((c) => c.id === customerId)!;
  const tariff = tariffs.find((x) => x.id === tariffId)!;
  const qtyNum = Math.max(500, +qty || 500);
  const amount = +(qtyNum * tariff.rate).toFixed(3);
  const po = poId ? purchaseOrders.find((p) => p.id === poId) : undefined;

  const next = () => {
    if (step === 2) setQty(String(qtyNum));
    if (step === 3 && !poId) setPoId(createPo({ customerId, qty: qtyNum, tariffId }).id);
    setStep(step + 1);
  };
  const pay = () => { setPaying(true); payPo(poId!); };

  let body, footer;
  if (step === 1) {
    body = (
      <>
        <div className="erp-form-grid erp-form-1col">
          <div className="erp-form-row"><label>{t('Customer')}</label>
            <select id="erp-po-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.account}</option>)}
            </select>
          </div>
        </div>
        <div className="erp-summary-box" style={{ marginTop: 14 }}>
          <div className="metric-line"><span className="k">{t('Category')}</span><span className="v">{t(customer.category)}</span></div>
          <div className="metric-line"><span className="k">{t('Wallet balance')}</span><span className="v">{fmtKD(customer.wallet)}</span></div>
          <div className="metric-line"><span className="k">{t('Status')}</span><span className="v"><Tag status={customer.status} /></span></div>
        </div>
      </>
    );
    footer = <><button className="btn" id="erp-po-cancel" onClick={closeOverlay}>{t('Cancel')}</button><button className="btn btn-primary" id="erp-po-next" onClick={next}>{t('Next')}</button></>;
  } else if (step === 2) {
    body = (
      <>
        <div className="erp-form-grid">
          <div className="erp-form-row"><label>{t('Quantity (Imp. gal)')}</label>
            <input className="erp-input" type="number" id="erp-po-qty" min={500} step={500} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="erp-form-row"><label>{t('Tariff')}</label>
            <select id="erp-po-tariff" value={tariffId} onChange={(e) => setTariffId(e.target.value)}>
              {tariffs.map((x) => <option key={x.id} value={x.id}>{t(x.name)} — KD {x.rate}/IG</option>)}
            </select>
          </div>
        </div>
        <div className="erp-summary-box" style={{ marginTop: 14 }}>
          <div className="metric-line"><span className="k">{t('Rate')}</span><span className="v">KD {tariff.rate} / IG</span></div>
          <div className="metric-line"><span className="k">{t('Estimated amount')}</span><span className="v" style={{ color: 'var(--accent)' }}>{fmtKD(amount)}</span></div>
        </div>
      </>
    );
    footer = <><button className="btn" id="erp-po-back" onClick={() => setStep(step - 1)}>{t('Back')}</button><button className="btn btn-primary" id="erp-po-next" onClick={next}>{t('Next')}</button></>;
  } else if (step === 3) {
    body = (
      <>
        <div className="erp-approve-chip">
          <Icon name="badge-check" style={{ color: 'var(--accent)' }} />
          <div><b>F. Al-Ansari</b> — {t('Ops Manager, Al Dhaher Tanker Dept.')}</div>
        </div>
        <div className="erp-form-row" style={{ marginTop: 14 }}><label>{t('Approval comment (optional)')}</label>
          <textarea className="erp-input" id="erp-po-comment" placeholder={t('e.g. Standard prepaid order, no exceptions.')} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      </>
    );
    footer = <><button className="btn" id="erp-po-back" onClick={() => setStep(step - 1)}>{t('Back')}</button><button className="btn btn-primary" id="erp-po-next" onClick={next}>{t('Approve & continue')}</button></>;
  } else {
    const p = po!;
    body = (
      <>
        <div className="erp-summary-box">
          <div className="metric-line"><span className="k">{t('PO')}</span><span className="v">{p.id}</span></div>
          <div className="metric-line"><span className="k">{t('Invoice')}</span><span className="v">{p.invoiceNo}</span></div>
          <div className="metric-line"><span className="k">{t('Amount due')}</span><span className="v" style={{ color: 'var(--accent)' }}>{fmtKD(p.amountKD)}</span></div>
          <div className="metric-line"><span className="k">{t('Status')}</span><span className="v" id="erp-po-pay-status"><Tag status={p.status} /></span></div>
        </div>
        <div className="erp-form-note" style={{ marginTop: 10 }}>{t('K-net reference is generated once payment is captured.')}</div>
      </>
    );
    footer = p.status === 'Active'
      ? <button className="btn btn-primary" id="erp-po-done" onClick={closeOverlay}>{t('Done')}</button>
      : <>
          <button className="btn" id="erp-po-back" onClick={() => setStep(step - 1)} disabled={paying}>{t('Back')}</button>
          <button className="btn btn-primary" id="erp-po-pay" disabled={paying} onClick={pay}>
            {paying ? <><Icon name="loader" /> {t('Processing…')}</> : <><Icon name="credit-card" /> {t('Pay now · K-net')}</>}
          </button>
        </>;
  }

  return (
    <Modal title="New Purchase Order" footer={footer}>
      <div className="erp-wizard-steps" id="erp-po-steps">
        {STEP_LABELS.map((l, i) => {
          const n = i + 1; const cls = n < step ? 'done' : n === step ? 'active' : '';
          return <div key={l} className={`erp-wizard-step ${cls}`}>{n}. {t(l)}</div>;
        })}
      </div>
      <div className="erp-wizard-body" id="erp-po-body">{body}</div>
    </Modal>
  );
}

export default function Orders({ active }: ViewProps) {
  void active;
  const { t } = useT();
  const purchaseOrders = useErp((s) => s.purchaseOrders);
  const customers = useErp((s) => s.customers);
  const overlay = useErp((s) => s.overlay);
  const openOverlay = useErp((s) => s.openOverlay);

  const stats = useMemo(() => ({
    open: purchaseOrders.filter((p) => p.status !== 'Closed').length,
    pendingKD: purchaseOrders.filter((p) => p.status === 'Submitted').reduce((s, p) => s + p.amountKD, 0),
    contractedIG: purchaseOrders.filter((p) => ['Active', 'Consuming'].includes(p.status)).reduce((s, p) => s + p.remainingIG, 0),
    walletLiab: customers.reduce((s, c) => s + c.wallet, 0),
  }), [purchaseOrders, customers]);

  return (
    <>
      <div className="erp-stat-row">
        <div className="erp-stat"><div className="erp-stat-label">{t('Open POs')}</div><div className="erp-stat-value" id="erp-stat-open">{stats.open}</div></div>
        <div className="erp-stat"><div className="erp-stat-label">{t('Pending approval')}</div><div className="erp-stat-value" id="erp-stat-pending">{fmtKD(stats.pendingKD)}</div></div>
        <div className="erp-stat"><div className="erp-stat-label">{t('IG contracted')}</div><div className="erp-stat-value" id="erp-stat-ig">{fmtIG(stats.contractedIG)}</div></div>
        <div className="erp-stat"><div className="erp-stat-label">{t('Wallet liabilities')}</div><div className="erp-stat-value" id="erp-stat-wallet">{fmtKD(stats.walletLiab)}</div></div>
      </div>
      <div className="card">
        <div className="card-title">{t('Purchase Orders')} <span className="hint">{t('prepaid · approval · invoice · K-net')}</span></div>
        <div className="erp-toolbar"><div className="spacer" style={{ flex: 1 }} /><button className="btn btn-primary btn-sm" id="erp-po-new" onClick={() => openOverlay({ kind: 'po-wizard' })}><Icon name="plus" /> {t('New PO')}</button></div>
        <div className="erp-scroll-x"><table className="data-table">
          <thead><tr><th>{t('PO')}</th><th>{t('Customer')}</th><th>{t('Qty (IG)')}</th><th>{t('Amount')}</th><th>{t('Status')}</th><th>{t('Approver')}</th><th>{t('Invoice')}</th><th>{t('K-net ref')}</th><th>{t('Updated')}</th></tr></thead>
          <tbody id="erp-po-tbody">
            {purchaseOrders.map((po) => (
              <tr key={po.id}>
                <td className="mono">{po.id}</td>
                <td>{po.customerName}</td>
                <td className="mono">{po.quantityIG.toLocaleString()}</td>
                <td className="mono">{fmtKD(po.amountKD)}</td>
                <td><Tag status={po.status} /></td>
                <td>{po.approver}</td>
                <td className="mono">{po.invoiceNo}</td>
                <td className="mono">{po.knetRef}</td>
                <td className="erp-muted">{dateStr(po.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
      {overlay?.kind === 'po-wizard' && <PoWizard />}
    </>
  );
}
