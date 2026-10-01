import { useState } from 'react';
import type { ViewProps } from '../../shell/types';
import { useT } from '../../i18n';
import { Icon } from '../../lib/Icon';
import { useErp } from '../../erp/store';
import { dateTimeStr } from '../../erp/data';
import { PriorityTag, Tabs, Tag } from './ui';

export default function Admin({ active }: ViewProps) {
  void active;
  const { t } = useT();
  const tariffs = useErp((s) => s.tariffs);
  const workOrders = useErp((s) => s.workOrders);
  const audit = useErp((s) => s.audit);
  const resetDemo = useErp((s) => s.resetDemo);
  const [tab, setTab] = useState('tariffs');

  return (
    <div className="card">
      <div className="card-title">{t('Tariffs · Work Orders · Audit')}</div>
      <Tabs tabs={[{ id: 'tariffs', label: 'Tariffs' }, { id: 'workorders', label: 'Work Orders' }, { id: 'audit', label: 'Audit Trail' }]} value={tab} onChange={setTab} />
      <div className={`erp-tabpanel${tab === 'tariffs' ? ' active' : ''}`} id="erp-admin-tariffs">
        <table className="data-table">
          <thead><tr><th>{t('ID')}</th><th>{t('Name')}</th><th>{t('Tier')}</th><th>{t('Rate')}</th><th>{t('VAT')}</th><th>{t('Min. IG')}</th></tr></thead>
          <tbody id="erp-tariff-tbody">
            {tariffs.map((x) => <tr key={x.id}><td className="mono">{x.id}</td><td>{x.name}</td><td>{x.tier}</td><td className="mono">KD {x.rate}</td><td>{x.vat}%</td><td className="mono">{x.minIG.toLocaleString()}</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className={`erp-tabpanel${tab === 'workorders' ? ' active' : ''}`} id="erp-admin-workorders">
        <table className="data-table">
          <thead><tr><th>{t('ID')}</th><th>{t('Title')}</th><th>{t('Priority')}</th><th>{t('Assignee')}</th><th>{t('Due')}</th><th>{t('Status')}</th></tr></thead>
          <tbody id="erp-wo-tbody">
            {workOrders.map((w) => <tr key={w.id}><td className="mono">{w.id}</td><td>{w.title}</td><td><PriorityTag p={w.priority} /></td><td>{w.assignee}</td><td className="erp-muted">{w.due}</td><td><Tag status={w.status} /></td></tr>)}
          </tbody>
        </table>
      </div>
      <div className={`erp-tabpanel${tab === 'audit' ? ' active' : ''}`} id="erp-admin-audit">
        <div className="erp-toolbar"><div className="spacer" style={{ flex: 1 }} /><button className="btn btn-sm" id="erp-reset-data-2" onClick={resetDemo}><Icon name="database-backup" /> {t('Reset demo data')}</button></div>
        <div className="erp-scroll-x"><table className="data-table">
          <thead><tr><th>{t('Time')}</th><th>{t('User')}</th><th>{t('Action')}</th><th>{t('Object')}</th><th>{t('Before')}</th><th>{t('After')}</th></tr></thead>
          <tbody id="erp-audit-tbody">
            {audit.slice(0, 40).map((a) => <tr key={a.id}><td className="mono">{dateTimeStr(a.ts)}</td><td>{a.user}</td><td>{a.action}</td><td className="mono">{a.object}</td><td className="erp-muted">{a.before}</td><td className="erp-muted">{a.after}</td></tr>)}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
