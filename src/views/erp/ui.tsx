/* Shared UI bits for the Enterprise & ERP screens (same class names as legacy/erp.js markup). */
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../i18n';
import { Icon } from '../../lib/Icon';
import { useErp } from '../../erp/store';

export function statusTagClass(status: string): 'green' | 'amber' | 'red' | 'gray' {
  const s = String(status).toLowerCase();
  if (['active', 'activated', 'connected', 'synced', 'closed', 'verified', 'done', 'cleared', 'posted', 'matched'].some((k) => s.includes(k))) return 'green';
  if (['pending', 'printed', 'requested', 'scheduled', 'degraded', 'open', 'draft', 'submitted', 'syncing', 'consuming', 'in progress'].some((k) => s.includes(k))) return 'amber';
  if (['suspended', 'blocked', 'failed', 'fault', 'down', 'expired', 'lost', 'no match'].some((k) => s.includes(k))) return 'red';
  return 'gray';
}

/** Status pill (<span class="tag green">Active</span>) — label is translated. */
export function Tag({ status }: { status: string }) {
  const { t } = useT();
  return <span className={`tag ${statusTagClass(status)}`}>{t(status)}</span>;
}

export function PriorityTag({ p }: { p: string }) {
  const { t } = useT();
  return <span className={`tag ${p === 'High' ? 'red' : p === 'Medium' ? 'amber' : 'gray'}`}>{t(p)}</span>;
}

export function ExpiryBadge({ ts }: { ts: number }) {
  const { t } = useT();
  const days = Math.floor((ts - Date.now()) / 86400000);
  if (days < 0) return <span className="tag red">{t('Expired')} {Math.abs(days)}{t('d ago')}</span>;
  if (days <= 30) return <span className="tag amber">{t('Due in')} {days}{t('d')}</span>;
  return <span className="tag green">{t('Valid')} · {days}{t('d')}</span>;
}

/** Singleton modal / drawer overlay rendered into <body> (like legacy erpOpenOverlay): Esc + backdrop click close it. */
export function Overlay({ className, children }: { className: 'erp-modal-overlay' | 'erp-drawer-overlay'; children: ReactNode }) {
  const close = useErp((s) => s.closeOverlay);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);
  return createPortal(
    <div className={className} id="erp-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>{children}</div>,
    document.body,
  );
}

export function Modal({ title, width, children, footer }: { title: string; width?: number; children: ReactNode; footer: ReactNode }) {
  const { t } = useT();
  const close = useErp((s) => s.closeOverlay);
  return (
    <Overlay className="erp-modal-overlay">
      <div className="erp-modal" style={width ? { width } : undefined} role="dialog" aria-label={t(title)}>
        <div className="erp-modal-header">
          <h3>{t(title)}</h3>
          <button className="erp-modal-close" aria-label={t('Close')} onClick={close}><Icon name="x" /></button>
        </div>
        <div className="erp-modal-body">{children}</div>
        <div className="erp-modal-footer">{footer}</div>
      </div>
    </Overlay>
  );
}

/** Switchable tabs (.erp-tab / .erp-tabpanel) — panels are all rendered and toggled via the .active class like legacy. */
export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  const { t } = useT();
  return (
    <div className="erp-tabs">
      {tabs.map((tab) => (
        <div key={tab.id} className={`erp-tab${value === tab.id ? ' active' : ''}`} data-tab={tab.id} role="tab" tabIndex={0}
          aria-selected={value === tab.id} onClick={() => onChange(tab.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(tab.id); } }}>{t(tab.label)}</div>
      ))}
    </div>
  );
}
