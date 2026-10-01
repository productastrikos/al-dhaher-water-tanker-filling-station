import { useState } from 'react';
import type { ViewProps } from '../../shell/types';
import { useT } from '../../i18n';
import { Icon } from '../../lib/Icon';
import { randPlate } from '../../sim/data';
import { useErp } from '../../erp/store';
import { ERP_CAPACITIES, ERP_TRUCK_MAKES, daysFromNow, erpPad } from '../../erp/data';
import { ExpiryBadge, Modal, Tabs, Tag } from './ui';

const isoDate = (ts: number) => new Date(ts).toISOString().slice(0, 10);

function TruckForm() {
  const { t } = useT();
  const customers = useErp((s) => s.customers);
  const { closeOverlay, registerTruck } = useErp.getState();
  const [f, setF] = useState(() => ({
    ownerId: customers[0]?.id ?? '', plate: randPlate(), capacityIG: ERP_CAPACITIES[0], make: ERP_TRUCK_MAKES[0],
    calibCertNo: `CAL-${9000 + Math.floor(Math.random() * 900)}`, calibExpiry: isoDate(daysFromNow(365)), hatchType: 'Top hatch',
  }));
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title="Register Truck" footer={
      <><button className="btn" id="erp-tf-cancel" onClick={closeOverlay}>{t('Cancel')}</button>
        <button className="btn btn-primary" id="erp-tf-save" onClick={() => { registerTruck(f); closeOverlay(); }}><Icon name="check" /> {t('Register')}</button></>
    }>
      <div className="erp-form-grid">
        <div className="erp-form-row"><label>{t('Owner')}</label><select id="erp-tf-owner" value={f.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="erp-form-row"><label>{t('Plate')}</label><input className="erp-input" id="erp-tf-plate" value={f.plate} onChange={(e) => set('plate', e.target.value)} /></div>
        <div className="erp-form-row"><label>{t('Capacity (IG)')}</label><select id="erp-tf-cap" value={f.capacityIG} onChange={(e) => set('capacityIG', +e.target.value)}>{ERP_CAPACITIES.map((c) => <option key={c} value={c}>{c.toLocaleString()}</option>)}</select></div>
        <div className="erp-form-row"><label>{t('Make')}</label><select id="erp-tf-make" value={f.make} onChange={(e) => set('make', e.target.value)}>{ERP_TRUCK_MAKES.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div className="erp-form-row"><label>{t('Calibration cert no.')}</label><input className="erp-input" id="erp-tf-cert" value={f.calibCertNo} onChange={(e) => set('calibCertNo', e.target.value)} /></div>
        <div className="erp-form-row"><label>{t('Calibration expiry')}</label><input className="erp-input" type="date" id="erp-tf-expiry" value={f.calibExpiry} onChange={(e) => set('calibExpiry', e.target.value)} /></div>
        <div className="erp-form-row"><label>{t('Hatch type')}</label><select id="erp-tf-hatch" value={f.hatchType} onChange={(e) => set('hatchType', e.target.value)}><option value="Top hatch">{t('Top hatch')}</option><option value="Rear valve">{t('Rear valve')}</option></select></div>
      </div>
    </Modal>
  );
}

function DriverForm() {
  const { t } = useT();
  const trucks = useErp((s) => s.trucks);
  const drivers = useErp((s) => s.drivers);
  const { closeOverlay, registerDriver } = useErp.getState();
  const unassigned = trucks.filter((tr) => !drivers.some((d) => d.assignedTruckIds.includes(tr.id)));
  const [f, setF] = useState({ name: '', civilId: '', licenceExpiry: isoDate(daysFromNow(300)), phone: '', truckId: '' });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title="Register Driver" footer={
      <><button className="btn" id="erp-df-cancel" onClick={closeOverlay}>{t('Cancel')}</button>
        <button className="btn btn-primary" id="erp-df-save" onClick={() => { registerDriver(f); closeOverlay(); }}><Icon name="check" /> {t('Register')}</button></>
    }>
      <div className="erp-form-grid">
        <div className="erp-form-row"><label>{t('Full name')}</label><input className="erp-input" id="erp-df-name" placeholder="e.g. Ahmad Al-Fahad" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="erp-form-row"><label>{t('Civil ID (masked on save)')}</label><input className="erp-input" id="erp-df-civil" placeholder="28XXXXXXXXXX" value={f.civilId} onChange={(e) => set('civilId', e.target.value)} /></div>
        <div className="erp-form-row"><label>{t('Licence expiry')}</label><input className="erp-input" type="date" id="erp-df-expiry" value={f.licenceExpiry} onChange={(e) => set('licenceExpiry', e.target.value)} /></div>
        <div className="erp-form-row"><label>{t('Phone')}</label><input className="erp-input" id="erp-df-phone" placeholder="+965 5xxxxxxx" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="erp-form-row erp-form-1col"><label>{t('Assign truck (optional)')}</label>
          <select id="erp-df-truck" value={f.truckId} onChange={(e) => set('truckId', e.target.value)}>
            <option value="">{t('— none —')}</option>
            {unassigned.map((tr) => <option key={tr.id} value={tr.id}>{tr.plate} ({tr.id})</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}

function ScanPlateModal() {
  const { t } = useT();
  const trucks = useErp((s) => s.trucks);
  const { closeOverlay, scanPlate } = useErp.getState();
  const [plate, setPlate] = useState(() => trucks[Math.floor(Math.random() * trucks.length)]?.plate ?? '');
  return (
    <Modal title="Scan plate — LPR test" width={420} footer={
      <><button className="btn" id="erp-sp-cancel" onClick={closeOverlay}>{t('Cancel')}</button>
        <button className="btn btn-primary" id="erp-sp-scan" onClick={() => scanPlate(plate.trim())}><Icon name="scan-line" /> {t('Scan')}</button></>
    }>
      <div className="erp-form-row"><label>{t('Plate')}</label><input className="erp-input" id="erp-sp-plate" value={plate} onChange={(e) => setPlate(e.target.value)} /></div>
      <div className="erp-form-note">{t('Matches against the registered fleet and writes to the CCTV & LPR log.')}</div>
    </Modal>
  );
}

export default function Fleet({ active }: ViewProps) {
  void active;
  const { t } = useT();
  const trucks = useErp((s) => s.trucks);
  const drivers = useErp((s) => s.drivers);
  const overlay = useErp((s) => s.overlay);
  const openOverlay = useErp((s) => s.openOverlay);
  const assignDriverTruck = useErp((s) => s.assignDriverTruck);
  const [tab, setTab] = useState('trucks');
  const [tq, setTq] = useState('');
  const [dq, setDq] = useState('');

  const truckRows = trucks.filter((x) => !tq || (x.plate + x.ownerName + x.id).toLowerCase().includes(tq.toLowerCase()));
  const driverRows = drivers.filter((d) => !dq || (d.name + d.civilId).toLowerCase().includes(dq.toLowerCase()));

  return (
    <>
      <div className="card">
        <div className="card-title">{t('Fleet & Drivers')} <span className="hint">{t('register, link, LPR-test')}</span></div>
        <Tabs tabs={[{ id: 'trucks', label: 'Trucks' }, { id: 'drivers', label: 'Drivers' }]} value={tab} onChange={setTab} />
        <div className={`erp-tabpanel${tab === 'trucks' ? ' active' : ''}`} id="erp-fleet-trucks">
          <div className="erp-toolbar">
            <input className="erp-search" id="erp-truck-search" placeholder={t('Search plate, owner, truck id…')} value={tq} onChange={(e) => setTq(e.target.value)} />
            <button className="btn btn-sm" id="erp-scan-plate-btn" onClick={() => openOverlay({ kind: 'scan-plate' })}><Icon name="scan-line" /> {t('Scan plate')}</button>
            <button className="btn btn-primary btn-sm" id="erp-truck-new" onClick={() => openOverlay({ kind: 'truck-form' })}><Icon name="plus" /> {t('Register truck')}</button>
          </div>
          <div className="erp-scroll-x"><table className="data-table">
            <thead><tr><th>{t('ID')}</th><th>{t('Plate')}</th><th>{t('Owner')}</th><th>{t('Capacity')}</th><th>{t('Make')}</th><th>{t('Calibration')}</th><th>{t('Hatch')}</th><th>{t('Status')}</th></tr></thead>
            <tbody id="erp-truck-tbody">
              {truckRows.map((x) => (
                <tr key={x.id}>
                  <td className="mono">{x.id}</td><td className="mono">{x.plate}</td><td>{x.ownerName}</td>
                  <td className="mono">{x.capacityIG.toLocaleString()} IG</td><td>{x.make}</td>
                  <td>{x.calibCertNo}<br /><ExpiryBadge ts={x.calibExpiry} /></td>
                  <td>{t(x.hatchType)}</td><td><Tag status={x.status} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
        <div className={`erp-tabpanel${tab === 'drivers' ? ' active' : ''}`} id="erp-fleet-drivers">
          <div className="erp-toolbar">
            <input className="erp-search" id="erp-driver-search" placeholder={t('Search name, civil id…')} value={dq} onChange={(e) => setDq(e.target.value)} />
            <button className="btn btn-primary btn-sm" id="erp-driver-new" onClick={() => openOverlay({ kind: 'driver-form' })}><Icon name="plus" /> {t('Register driver')}</button>
          </div>
          <div className="erp-scroll-x"><table className="data-table">
            <thead><tr><th>{t('ID')}</th><th>{t('Name')}</th><th>{t('Civil ID')}</th><th>{t('Licence expiry')}</th><th>{t('Phone')}</th><th>{t('Truck')}</th><th>{t('Status')}</th></tr></thead>
            <tbody id="erp-driver-tbody">
              {driverRows.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{d.id}</td><td>{d.name}</td><td className="mono">{d.civilId}</td>
                  <td><ExpiryBadge ts={d.licenceExpiry} /></td><td className="mono">{d.phone}</td>
                  <td>
                    <select className="select erp-driver-truck" value={d.assignedTruckIds[0] ?? ''} onChange={(e) => assignDriverTruck(d.id, e.target.value)}>
                      <option value="">{t('— none —')}</option>
                      {trucks.map((x) => <option key={x.id} value={x.id}>{x.plate} ({x.id})</option>)}
                    </select>
                  </td>
                  <td><Tag status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
      {overlay?.kind === 'truck-form' && <TruckForm />}
      {overlay?.kind === 'driver-form' && <DriverForm />}
      {overlay?.kind === 'scan-plate' && <ScanPlateModal />}
    </>
  );
}

void erpPad;
