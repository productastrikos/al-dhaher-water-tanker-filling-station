import { useMemo, useState } from 'react';
import type { ViewProps } from '../../shell/types';
import { useT } from '../../i18n';
import { Icon } from '../../lib/Icon';
import { useErp } from '../../erp/store';
import { dateStr } from '../../erp/data';
import type { Credential } from '../../erp/data';
import { Modal, Tag } from './ui';

/** deterministic fake QR pattern (same LCG as legacy erpQrCells) */
function qrCells(seedStr: string): boolean[] {
  let s = 0;
  for (let i = 0; i < seedStr.length; i++) s += seedStr.charCodeAt(i) * (i + 7);
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return Array.from({ length: 49 }, () => rand() > 0.52);
}

function CardMock({ card }: { card: Credential }) {
  const { t } = useT();
  const cells = useMemo(() => qrCells(card.id), [card.id]);
  return (
    <>
      <div className="erp-card-mock">
        <div className="erp-card-top"><div className="erp-card-brand">MEW <span className="sub">S!aP Access</span></div></div>
        <div className="erp-card-chip" />
        <div className="erp-card-type">{card.type}</div>
        <div className="erp-card-number">{`•••• •••• •••• ${card.id.slice(-4)}`}</div>
        <div className="erp-card-bottom">
          <div className="erp-card-name"><span className="label">{t('Cardholder')}</span>{card.driverName || '—'}</div>
          <div className="erp-card-qr">{cells.map((on, i) => <div key={i} className={`erp-qr-cell ${on ? 'on' : ''}`} />)}</div>
        </div>
      </div>
      <div className="erp-card-side">
        <div className="metric-line"><span className="k">{t('Customer')}</span><span className="v">{card.customerName}</span></div>
        <div className="metric-line"><span className="k">{t('Truck')}</span><span className="v">{card.truckPlate || '—'}</span></div>
        <div className="metric-line"><span className="k">{t('Status')}</span><span className="v"><Tag status={card.status} /></span></div>
        <div className="metric-line"><span className="k">{t('PIN attempts')}</span><span className="v">{card.pinAttempts}/3</span></div>
        <div className="metric-line"><span className="k">{t('Issued')}</span><span className="v">{dateStr(card.issuedAt)}</span></div>
        <div className="metric-line"><span className="k">{t('Expiry')}</span><span className="v">{dateStr(card.expiry)}</span></div>
      </div>
    </>
  );
}

function IssueCardForm() {
  const { t } = useT();
  const customers = useErp((s) => s.customers);
  const trucks = useErp((s) => s.trucks);
  const drivers = useErp((s) => s.drivers);
  const { closeOverlay, issueCard } = useErp.getState();
  const [type, setType] = useState('RFID + PIN');
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [pin, setPin] = useState('');

  const ownTrucks = trucks.filter((x) => x.ownerId === customerId);
  const truckIds = new Set(ownTrucks.map((x) => x.id));
  const linked = drivers.filter((d) => d.assignedTruckIds.some((id) => truckIds.has(id)));
  const driverPool = linked.length ? linked : drivers;
  const [truckSel, setTruckSel] = useState('');
  const [driverSel, setDriverSel] = useState('');
  const truckId = ownTrucks.some((x) => x.id === truckSel) ? truckSel : ownTrucks[0]?.id ?? '';
  const driverId = driverPool.some((d) => d.id === driverSel) ? driverSel : driverPool[0]?.id ?? '';

  return (
    <Modal title="Issue Access Card" footer={
      <><button className="btn" id="erp-ic-cancel" onClick={closeOverlay}>{t('Cancel')}</button>
        <button className="btn btn-primary" id="erp-ic-save" onClick={() => { issueCard({ type, customerId, truckId, driverId }); closeOverlay(); }}><Icon name="credit-card" /> {t('Issue card')}</button></>
    }>
      <div className="erp-form-grid">
        <div className="erp-form-row"><label>{t('Type')}</label><select id="erp-ic-type" value={type} onChange={(e) => setType(e.target.value)}><option>RFID + PIN</option><option>QR + PIN</option><option>RFID + QR</option></select></div>
        <div className="erp-form-row"><label>{t('Customer')}</label><select id="erp-ic-cust" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="erp-form-row"><label>{t('Truck')}</label><select id="erp-ic-truck" value={truckId} onChange={(e) => setTruckSel(e.target.value)}>{ownTrucks.length ? ownTrucks.map((x) => <option key={x.id} value={x.id}>{x.plate}</option>) : <option value="">—</option>}</select></div>
        <div className="erp-form-row"><label>{t('Driver')}</label><select id="erp-ic-driver" value={driverId} onChange={(e) => setDriverSel(e.target.value)}>{driverPool.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div className="erp-form-row"><label>{t('Set PIN (4 digits)')}</label><input className="erp-input" id="erp-ic-pin" maxLength={4} inputMode="numeric" placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></div>
      </div>
    </Modal>
  );
}

const COLS = ['Requested', 'Printed', 'Activated', 'Suspended'] as const;
const NEXT: Record<string, string> = { Requested: 'Printed', Printed: 'Activated', Suspended: 'Activated' };

export default function Cards({ active }: ViewProps) {
  void active;
  const { t } = useT();
  const credentials = useErp((s) => s.credentials);
  const overlay = useErp((s) => s.overlay);
  const { openOverlay, advanceCard, simulateWrongPins } = useErp.getState();
  const [sel, setSel] = useState('');
  const selected = credentials.find((c) => c.id === sel) ?? credentials[0];

  return (
    <>
      <div className="card">
        <div className="card-title">{t('Access Credentials')} <span className="hint">{t('kanban lifecycle')}</span></div>
        <div className="erp-toolbar"><div className="spacer" style={{ flex: 1 }} /><button className="btn btn-primary btn-sm" id="erp-card-issue-btn" onClick={() => openOverlay({ kind: 'issue-card' })}><Icon name="plus" /> {t('Issue card')}</button></div>
        <div className="erp-kanban" id="erp-card-kanban">
          {COLS.map((col) => {
            const items = credentials.filter((c) => (col === 'Suspended' ? ['Suspended', 'Lost', 'Expired'].includes(c.status) : c.status === col));
            return (
              <div key={col} className="erp-kanban-col">
                <div className="erp-kanban-head"><span>{t(col)}</span><span>{items.length}</span></div>
                {items.length ? items.map((c) => (
                  <div key={c.id} className="erp-kanban-card">
                    <div className="id">{c.id}</div>
                    <div className="meta">{c.type} &middot; {c.customerName}</div>
                    <div className="meta">{c.truckPlate || '—'} &middot; {c.driverName || '—'}</div>
                    {c.pinAttempts > 0 && <div className="attempts">{c.pinAttempts}/3 {t('PIN attempts')}</div>}
                    <div className="erp-inline-actions" style={{ marginTop: 7 }}>
                      {NEXT[c.status] && <button className="btn btn-sm" onClick={() => advanceCard(c.id, NEXT[c.status])}>&rarr; {t(NEXT[c.status])}</button>}
                    </div>
                  </div>
                )) : <div className="erp-empty">{t('Empty')}</div>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">{t('Card preview')} <span className="hint">{t('select a card · run a PIN-abuse drill')}</span></div>
        <div className="erp-toolbar">
          <select className="select" id="erp-card-select" value={selected?.id ?? ''} onChange={(e) => setSel(e.target.value)}>
            {credentials.map((c) => <option key={c.id} value={c.id}>{c.id} — {c.customerName}</option>)}
          </select>
          <button className="btn btn-sm btn-red" id="erp-card-wrongpin" onClick={() => selected && simulateWrongPins(selected.id)}><Icon name="shield-alert" /> {t('Simulate 3 wrong PINs')}</button>
        </div>
        <div className="erp-card-wrap" id="erp-card-preview">
          {selected ? <CardMock card={selected} /> : <div className="erp-empty">{t('No cards yet — issue one above.')}</div>}
        </div>
      </div>
      {overlay?.kind === 'issue-card' && <IssueCardForm />}
    </>
  );
}
