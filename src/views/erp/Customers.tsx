import { useState } from 'react';
import type { ViewProps } from '../../shell/types';
import { useT } from '../../i18n';
import { Icon } from '../../lib/Icon';
import { useErp } from '../../erp/store';
import { fmtKD } from '../../erp/data';
import { Overlay, Tag } from './ui';

function CustomerDrawer({ id }: { id: string }) {
  const { t } = useT();
  const customers = useErp((s) => s.customers);
  const trucks = useErp((s) => s.trucks);
  const purchaseOrders = useErp((s) => s.purchaseOrders);
  const { closeOverlay, toggleCustomerSuspend } = useErp.getState();
  const c = customers.find((x) => x.id === id);
  if (!c) return null;
  const fleetCount = trucks.filter((tr) => tr.ownerId === id).length;
  const pos = purchaseOrders.filter((p) => p.customerId === id).slice(0, 6);
  return (
    <Overlay className="erp-drawer-overlay">
      <div className="erp-drawer" role="dialog" aria-label={c.name}>
        <div className="erp-drawer-header">
          <div><h3>{c.name}</h3><div className="sub">{c.id} &middot; {t(c.category)} &middot; {c.account}</div></div>
          <button className="erp-drawer-close" id="erp-drawer-close" aria-label={t('Close')} onClick={closeOverlay}><Icon name="x" /></button>
        </div>
        <div className="erp-drawer-body">
          <div className="erp-drawer-section">
            <div className="erp-section-title">{t('Account')}</div>
            <div className="metric-line"><span className="k">{t('Wallet balance')}</span><span className="v">{fmtKD(c.wallet)}</span></div>
            <div className="metric-line"><span className="k">{t('Credit terms')}</span><span className="v">{t(c.creditTerms)}</span></div>
            <div className="metric-line"><span className="k">{t('Status')}</span><span className="v"><Tag status={c.status} /></span></div>
            <div className="metric-line"><span className="k">{t('Fleet size')}</span><span className="v">{fleetCount} {t(fleetCount === 1 ? 'truck' : 'trucks')}</span></div>
            <div className="metric-line"><span className="k">{t('Registered')}</span><span className="v">{c.registeredSince}</span></div>
          </div>
          <div className="erp-drawer-section">
            <div className="erp-section-title">{t('KYC checklist')}</div>
            <div className="erp-kyc-row"><span>{t('Civil ID')}</span><Tag status={c.kyc.civilId.status} /></div>
            <div className="erp-kyc-row"><span>{t('CR copy')}</span><Tag status={c.kyc.crCopy.status} /></div>
            <div className="erp-kyc-row"><span>{t('Tanker calibration cert')}</span><Tag status={c.kyc.calibrationCert.status} /></div>
          </div>
          <div className="erp-drawer-section">
            <div className="erp-section-title">{t('PO history')}</div>
            {pos.length
              ? pos.map((p) => <div key={p.id} className="metric-line"><span className="k">{p.id}</span><span className="v"><Tag status={p.status} /></span></div>)
              : <div className="erp-empty">{t('No purchase orders yet.')}</div>}
          </div>
          <div className="erp-drawer-section">
            <div className="erp-section-title">{t('Contact')}</div>
            <div className="metric-line"><span className="k">{t('Contact')}</span><span className="v">{c.contact}</span></div>
            <div className="metric-line"><span className="k">{t('Phone')}</span><span className="v">{c.phone}</span></div>
            <div className="metric-line"><span className="k">{t('Email')}</span><span className="v">{c.email}</span></div>
          </div>
        </div>
        <div className="erp-drawer-footer">
          {c.status === 'Suspended'
            ? <button className="btn btn-primary" id="erp-cust-toggle" onClick={() => { toggleCustomerSuspend(id); closeOverlay(); }}><Icon name="check-circle" /> {t('Re-activate')}</button>
            : <button className="btn btn-red" id="erp-cust-toggle" onClick={() => { toggleCustomerSuspend(id); closeOverlay(); }}><Icon name="ban" /> {t('Suspend')}</button>}
        </div>
      </div>
    </Overlay>
  );
}

export default function Customers({ active }: ViewProps) {
  void active;
  const { t } = useT();
  const customers = useErp((s) => s.customers);
  const overlay = useErp((s) => s.overlay);
  const openOverlay = useErp((s) => s.openOverlay);
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const rows = customers.filter((c) => {
    const matchesText = !filterText || (c.name + c.account + c.crNo).toLowerCase().includes(filterText.toLowerCase());
    const matchesStatus = !filterStatus || c.status === filterStatus;
    return matchesText && matchesStatus;
  });

  return (
    <>
      <div className="card">
        <div className="card-title">{t('Customers & Accounts')} <span className="hint">{t('search, filter, open a record')}</span></div>
        <div className="erp-toolbar">
          <input className="erp-search" id="erp-cust-search" placeholder={t('Search name, account, CR no…')} value={filterText} onChange={(e) => setFilterText(e.target.value)} />
          <select className="select" id="erp-cust-filter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">{t('All statuses')}</option>
            <option value="Active">{t('Active')}</option>
            <option value="Suspended">{t('Suspended')}</option>
            <option value="Pending KYC">{t('Pending KYC')}</option>
          </select>
        </div>
        <div className="erp-scroll-x"><table className="data-table">
          <thead><tr><th>{t('ID')}</th><th>{t('Customer')}</th><th>{t('Category')}</th><th>{t('Account')}</th><th>{t('Wallet')}</th><th>{t('Status')}</th><th>{t('Since')}</th></tr></thead>
          <tbody id="erp-cust-tbody">
            {rows.length ? rows.map((c) => (
              <tr key={c.id} className="erp-row-click" data-cust={c.id} tabIndex={0}
                onClick={() => openOverlay({ kind: 'customer', id: c.id })}
                onKeyDown={(e) => { if (e.key === 'Enter') openOverlay({ kind: 'customer', id: c.id }); }}>
                <td className="mono">{c.id}</td>
                <td>{c.name}</td>
                <td>{t(c.category)}</td>
                <td className="mono">{c.account}</td>
                <td className="mono">{fmtKD(c.wallet)}</td>
                <td><Tag status={c.status} /></td>
                <td className="erp-muted">{c.registeredSince}</td>
              </tr>
            )) : <tr><td colSpan={7}><div className="erp-empty">{t('No customers match.')}</div></td></tr>}
          </tbody>
        </table></div>
      </div>
      {overlay?.kind === 'customer' && <CustomerDrawer id={overlay.id} />}
    </>
  );
}
