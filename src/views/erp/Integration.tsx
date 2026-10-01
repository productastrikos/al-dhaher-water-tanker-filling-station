import type { ViewProps } from '../../shell/types';
import { useT } from '../../i18n';
import { Icon } from '../../lib/Icon';
import { useErp } from '../../erp/store';
import { dateTimeStr, timeStr } from '../../erp/data';
import { Tag } from './ui';

export default function Integration({ active }: ViewProps) {
  void active;
  const { t } = useT();
  const connectors = useErp((s) => s.connectors);
  const mapping = useErp((s) => s.mapping);
  const erpSync = useErp((s) => s.erpSync);
  const outage = useErp((s) => s.outage);
  const toggleOutage = useErp((s) => s.toggleOutage);
  const retrySync = useErp((s) => s.retrySync);

  const mof = erpSync.find((s) => s.object.toLowerCase().includes('settlement')) ?? erpSync[0];

  return (
    <>
      <div className="erp-connector-grid" id="erp-connector-grid">
        {connectors.map((c) => {
          const dot = c.status === 'Connected' ? 'up' : c.status === 'Degraded' ? 'degraded' : 'down';
          return (
            <div key={c.id} className="erp-connector-tile">
              <div className="erp-connector-top">
                <div><div className="erp-connector-name"><span className={`erp-connector-dot ${dot}`} />{c.name}</div><div className="erp-connector-proto">{c.protocol}</div></div>
                <Tag status={c.status} />
              </div>
              <div className="metric-line"><span className="k">{t('Last sync')}</span><span className="v">{dateTimeStr(c.lastSync)}</span></div>
              <div className="metric-line"><span className="k">{t('Latency')}</span><span className="v">{c.latencyMs} ms</span></div>
              <div className="metric-line"><span className="k">{t('Objects synced')}</span><span className="v">{c.objectsSynced.toLocaleString()}</span></div>
            </div>
          );
        })}
      </div>
      <div className="card" id="erp-outage-card">
        <div className="card-title">{t('Store-and-forward & outage drill')} <span className="hint">{t('read-only towards bay control')}</span></div>
        <div id="erp-outage-banner-slot">
          {outage.active && <div className="erp-outage-banner"><span className="dot" /> {t('ERP link down — Al Dhaher continues on last-known master data')} &middot; {outage.buffered} {t('txns buffered (store-and-forward)')}</div>}
        </div>
        <div className="util-text">{t('If the ERP link drops, S!aP keeps operating on local state and queues finance/master-data objects for replay — the bay control loop and K-net payments are unaffected.')}</div>
        <button className={outage.active ? 'btn btn-primary btn-sm' : 'btn btn-red btn-sm'} id="erp-outage-toggle" style={{ marginTop: 10 }} onClick={toggleOutage}>
          {outage.active ? <><Icon name="rotate-cw" /> {t('Replay buffered txns')}</> : <><Icon name="power-off" /> {t('Simulate outage')}</>}
        </button>
      </div>
      <div className="card">
        <div className="card-title">{t('Object mapping')} <span className="hint">{t('S!aP object → ERP entity')}</span></div>
        <div className="erp-scroll-x"><table className="data-table">
          <thead><tr><th>{t('Object')}</th><th>{t('S!aP source')}</th><th>{t('ERP entity')}</th><th>{t('Frequency')}</th><th>{t('Direction')}</th></tr></thead>
          <tbody id="erp-mapping-tbody">
            {mapping.map((m, i) => <tr key={i}><td>{m.object}</td><td className="erp-muted">{m.saip}</td><td className="mono">{m.erp}</td><td>{m.frequency}</td><td>{m.direction}</td></tr>)}
          </tbody>
        </table></div>
      </div>
      <div className="card">
        <div className="card-title">{t('Sync log')} <span className="hint">{t('connector activity · retry failed/pending')}</span></div>
        <div className="erp-scroll-x"><table className="data-table">
          <thead><tr><th>{t('Time')}</th><th>{t('Connector')}</th><th>{t('Object')}</th><th>{t('Direction')}</th><th>{t('Status')}</th><th>{t('Retries')}</th><th /></tr></thead>
          <tbody id="erp-sync-tbody">
            {erpSync.slice(0, 14).map((s) => {
              const connector = connectors.find((c) => c.id === s.connector);
              const canRetry = s.status === 'Failed' || s.status === 'Pending';
              return (
                <tr key={s.id}>
                  <td className="mono">{timeStr(s.ts)}</td><td>{connector ? connector.name : s.connector}</td><td>{s.object}</td>
                  <td>{s.direction}</td><td><Tag status={s.status} /></td><td>{s.retries}</td>
                  <td>{canRetry && <button className="btn btn-sm" onClick={() => retrySync(s.id)}>{t('Retry')}</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
      <div className="card">
        <div className="card-title">{t('Ministry of Finance interface')}</div>
        <div className="util-text" id="erp-mof-line">
          {mof
            ? `${t('Daily settlement/revenue file to the Ministry of Finance — last batch')} ${dateTimeStr(mof.ts)}, ${t('status')} ${t(mof.status)}.`
            : t('No settlement batches yet — run the Order-to-Cash tracker to generate one.')}
        </div>
      </div>
    </>
  );
}
