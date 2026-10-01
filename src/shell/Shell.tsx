import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useSiap } from '../sim/store';
import { useT } from '../i18n';
import { useLangStore } from '../i18n';
import { useTheme } from '../lib/theme';
import { Icon } from '../lib/Icon';
import { GROUPS, VIEWS, viewById } from '../views/registry';
import { showView, useUi } from './ui';
import type { ViewProps } from './types';
import AiFab from './AiFab';

const LAZY = Object.fromEntries(VIEWS.map((v) => [v.id, lazy(v.load)])) as Record<string, React.ComponentType<ViewProps>>;

function Sidebar() {
  const { t } = useT();
  const active = useUi((s) => s.activeView);
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">S!</div>
        <div className="brand-text">
          <div className="name">S!aP Platform</div>
          <div className="sub">{t('MEW · Al Dhaher LFS')}</div>
        </div>
      </div>

      {GROUPS.map((g) => (
        <div key={g.id} style={{ display: 'contents' }}>
          <div className="nav-group-label" id={`nav-group-${g.id}`}>{t(g.label)}</div>
          {VIEWS.filter((v) => v.group === g.id).map((v) => (
            <div
              key={v.id}
              className={`nav-item${active === v.id ? ' active' : ''}`}
              data-view={v.id}
              tabIndex={0}
              role="button"
              aria-label={v.title}
              title={v.title}
              onClick={() => showView(v.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showView(v.id); } }}
            >
              <Icon name={v.icon} />
              <span className="nav-label">{t(v.navLabel || v.title)}</span>
            </div>
          ))}
        </div>
      ))}

      <div className="sidebar-footer">
        <div className="avatar-chip">TD</div>
        <div>
          <div style={{ color: 'var(--text)', fontWeight: 600 }}>{t('Tanker Dept.')}</div>
          <div>{t('MEW · Operator')}</div>
        </div>
      </div>
    </aside>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return <div className="clock" id="clock">{now.toLocaleTimeString('en-GB', { hour12: false })} AST</div>;
}

function Topbar() {
  const { t, lang } = useT();
  const toggleLang = useLangStore((s) => s.toggle);
  const { theme, toggle: toggleTheme } = useTheme();
  const wanForced = useSiap((s) => s.wan.forced);
  const toggleWan = useSiap((s) => s.toggleWan);
  const activeId = useUi((s) => s.activeView);
  const def = viewById(activeId);

  const onWan = () => {
    const turningOn = !useSiap.getState().wan.forced;
    toggleWan();
    if (turningOn) {
      // the effect (red link dots, buffered counter) lives in the architecture diagram on the dashboard —
      // jump there and flash the card so the toggle visibly does something.
      showView('dashboard');
      setTimeout(() => {
        const card = document.getElementById('arch-diagram')?.closest('.card') as HTMLElement | null;
        if (!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.remove('flash-highlight');
        void card.offsetWidth;
        card.classList.add('flash-highlight');
      }, 60);
    }
  };

  return (
    <div className="topbar">
      <div>
        <div className="topbar-title" id="view-title">{def ? t(def.title) : ''}</div>
        <div className="topbar-sub" id="view-sub">{def ? t(def.sub) : ''}</div>
      </div>
      <div className="topbar-right">
        <div className="live-pill"><span className="live-dot" /> <span>{t('LIVE')}</span></div>
        <button className={`btn btn-sm${wanForced ? ' btn-red' : ''}`} id="btn-wan-toggle" title="Demo: force the Al Dhaher LCC WAN links offline" onClick={onWan}>
          <Icon name="wifi-off" /> <span>{wanForced ? t('WAN loss: ON') : t('Simulate WAN loss')}</span>
        </button>
        <div>{t('Salmiya DC → DR South Surra')}</div>
        <Clock />
        <button className="btn btn-sm lang-toggle" id="lang-toggle-desktop" title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'} aria-label="Switch language" aria-pressed={lang === 'ar'} onClick={toggleLang}>
          <Icon name="languages" /> <span className="lang-toggle-label">{lang === 'ar' ? 'EN' : 'AR'}</span>
        </button>
        <button className="btn btn-sm theme-toggle" title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} aria-label="Toggle light or dark mode" aria-pressed={theme === 'light'} onClick={toggleTheme}>
          <Icon name={theme === 'light' ? 'moon' : 'sun'} />
        </button>
      </div>
    </div>
  );
}

/** Top-right toast (ported from legacy renderAlarmBanner): WAN-outage banner > WAN-restored > newest unacked critical alarm (auto-dismiss 8 s). */
function AlarmBanner() {
  const { t } = useT();
  const alarms = useSiap((s) => s.alarms);
  const wan = useSiap((s) => s.wan);
  const crit = useMemo(() => alarms.filter((a) => !a.ack && a.sev === 'crit'), [alarms]);
  const topId = crit[0]?.id ?? null;
  const [dismissedId, setDismissedId] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (topId !== null) timer.current = setTimeout(() => setDismissedId(topId), 8000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [topId]);

  const jump = () => {
    showView('dashboard');
    setTimeout(() => document.getElementById('alarm-list')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  };
  const common = { onClick: jump, tabIndex: 0, role: 'button' as const, 'data-jump-alarms': true };

  if (wan.forced) {
    return (
      <div className="alarm-banner amber" id="alarm-banner" {...common}>
        <span className="dot" />
        <span>{t('Al Dhaher LCC offline — 42 bays continue on last-known balance')} · {wan.bufferedCount} {t(wan.bufferedCount === 1 ? 'transaction' : 'transactions')} {t('buffered (store-and-forward)')}<a>{t('View system architecture')}</a></span>
      </div>
    );
  }
  if (wan.restoredMsg) {
    return <div className="alarm-banner green" id="alarm-banner" {...common}><span className="dot" /><span>{wan.restoredMsg}</span></div>;
  }
  if (!crit.length || dismissedId === topId) return <div className="alarm-banner" id="alarm-banner" hidden />;
  return (
    <div className="alarm-banner" id="alarm-banner" {...common}>
      <span className="dot" />
      <span>{crit.length} {t(crit.length > 1 ? 'unacknowledged critical alarms' : 'unacknowledged critical alarm')} — "{crit[0].text}" <a>{t('View & acknowledge')}</a></span>
    </div>
  );
}

export default function Shell() {
  const tick = useSiap((s) => s.tick);
  const lang = useLangStore((s) => s.lang);
  const active = useUi((s) => s.activeView);
  const visited = useUi((s) => s.visited);

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }, [lang]);

  useEffect(() => { const id = setInterval(tick, 2200); return () => clearInterval(id); }, [tick]);

  return (
    <>
      <Sidebar />
      <main className="main">
        <Topbar />
        <AlarmBanner />
        <div className="view-scroll">
          {visited.map((id) => {
            const View = LAZY[id];
            return (
              <section key={id} className={`view${active === id ? ' active' : ''}`} id={`view-${id}`}>
                <Suspense fallback={<div style={{ padding: 24, color: 'var(--text-dim)' }}>Loading…</div>}>
                  <View active={active === id} />
                </Suspense>
              </section>
            );
          })}
        </div>
      </main>
      <AiFab />
    </>
  );
}
