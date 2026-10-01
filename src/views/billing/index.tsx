import type { ViewProps } from '../../shell/types';
import { useT } from '../../i18n';
import { Icon } from '../../lib/Icon';
import { useSiap } from '../../sim/store';

// MEW Pay companion deep links (the React mobile app lives at /mobile)
const MOBILE_LINKS: { screen: string; label: string; primary?: boolean }[] = [
  { screen: 'topup', label: 'Top-up', primary: true },
  { screen: 'qr', label: 'QR Pay' },
  { screen: 'stations', label: 'Stations' },
  { screen: 'history', label: 'History' },
  { screen: 'receipt', label: 'Receipt' },
];

export default function Billing(_props: ViewProps) {
  const { t } = useT();
  const ledger = useSiap((s) => s.ledger);
  const mewActivity = useSiap((s) => s.mewActivity);

  return (
    <>
      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon green"><Icon name="banknote" /></div><div className="kpi-label">{t('Revenue — Month to Date')}</div></div>
          <div className="kpi-value">KD 486,320</div>
          <div className="kpi-delta up">▲ 7.4%</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon blue"><Icon name="credit-card" /></div><div className="kpi-label">{t('K-net Top-ups Today')}</div></div>
          <div className="kpi-value" id="kpi-topups">1,027</div>
          <div className="kpi-delta up">▲ 2.1%</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon"><Icon name="wallet" /></div><div className="kpi-label">{t('Active Wallets')}</div></div>
          <div className="kpi-value">8,942</div>
          <div className="kpi-delta">234 new / 30d</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon green"><Icon name="check-check" /></div><div className="kpi-label">{t('Settlement to MEW')}</div></div>
          <div className="kpi-value" style={{ color: 'var(--green)', fontSize: 20 }}>{t('Reconciled')}</div>
          <div className="kpi-delta up">100% matched</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title"><span>{t('Recent Transactions — Prepaid Ledger')}</span> <span className="hint">{t('S!aP BPM · immutable')}</span></div>
          <table className="data-table">
            <thead><tr><th>{t('Time')}</th><th>{t('Account')}</th><th>{t('Type')}</th><th>{t('Volume')}</th><th>{t('Amount')}</th><th>{t('Channel')}</th><th>{t('Status')}</th></tr></thead>
            <tbody id="ledger-log">
              {ledger.slice(0, 9).map((r, i) => (
                <tr key={`${r.time}-${r.account}-${i}`}>
                  <td className="mono">{r.time}</td>
                  <td className="mono">{r.account}</td>
                  <td>{t(r.type)}</td>
                  <td className="mono">{r.volume}</td>
                  <td className="mono" style={{ color: r.amount.startsWith('+') ? 'var(--green)' : 'var(--text)' }}>{r.amount}</td>
                  <td>{t(r.channel)}</td>
                  <td>{r.status === 'Cleared' || r.status === 'Posted' ? <span className="tag green">{t(r.status)}</span> : <span className="tag amber">{t(r.status)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-title"><span>{t('MEW Pay — Customer App')}</span> <span className="hint">{t('fully interactive on your phone')}</span></div>
          <div className="wallet-panel">
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t('Water Wallet Balance')}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', margin: '4px 0 2px' }} id="mew-balance">KD 139.950</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Al-Salem Transport · Acct KWT-40216</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {MOBILE_LINKS.map((l) => (
                <a key={l.screen} href={`/mobile?screen=${l.screen}`} target="_blank" rel="noreferrer" className={`btn btn-sm${l.primary ? ' btn-primary' : ''}`} style={{ flex: '1 1 40%', justifyContent: 'center' }}>{t(l.label)}</a>
              ))}
            </div>
            <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-dim)' }}>{t('Recent')}</div>
            <div id="mew-activity" style={{ marginTop: 6 }}>
              {mewActivity.map((a, i) => (
                <div className="metric-line" key={i}>
                  <span className="k">{a.label}</span>
                  <span className="v" style={{ color: a.delta.startsWith('+') ? 'var(--green)' : 'var(--text)' }}>{a.delta}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, fontSize: 10.5, color: 'var(--text-faint)' }}>{t('Android & iOS · EN / AR · K-net')}</div>
          </div>
          <div className="mobile-open-row">
            <div><Icon name="smartphone" /> <span>{t('Open the full MEW Pay companion on a phone')}</span></div>
            <a href="/mobile" target="_blank" rel="noreferrer" className="btn btn-sm">{t('Open on phone →')}</a>
          </div>
        </div>
      </div>
    </>
  );
}
